import { Types } from 'mongoose';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './user.model';
import {
  IUser,
  LaunchToRecruitersResult,
  PublicStudentProfile,
  SanitizedUser,
  StudentInstitutionMentorshipProgramView,
  StudentMentorSessionView,
} from './user.types';
import { buildTermsAcceptance, CURRENT_TERMS_VERSION, hasAcceptedCurrentTerms } from './user.terms';
import { ApiError } from '../../utils/ApiError';
import { recordClientActivity, recordClientActivitySchema } from '../analytics/activity.service';
import { MentorSession } from '../mentor/mentorSession.model';
import { InstitutionMentorshipProgram } from '../mentor/mentorshipProgram.model';
import { UserRole } from '../../types/roles.types';
import { RelevanceBridge } from '../recruiter/relevanceBridge.model';
import { PlacementRecord } from '../college/placementRecord.model';
import { NotificationService } from '../notification/notification.service';
import { io } from '../../config/socket';
import { getStudentCollegeId } from '../recruiter/recruiter.mappers';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { applyScore, applyScoreAsync } from '../../services/scoreEngine';
import { getProfileCompletionProgress } from './profileCompletion';
import { queueProfileCompletionMilestoneEmail } from '../../services/retentionEmailService';
import { normalizeInnovationScore, normalizeScoreBreakdown } from '../innovationScore/score.utils';
import { fetchLinkedInPublicProfile } from './linkedinPublicProfile';
import {
  consumeGithubOauthState,
  createGithubOauthStart,
  GithubRepositoryChoice,
  isGithubOauthAvailable,
  listGithubRepositoryChoices,
  replaceImportedGithubRepositories,
  resolveGithubOauthCallback,
  syncGithubProofForUser,
} from './githubProof';
import { InstitutionStudentRosterEntry } from '../institution/studentRoster.model';
import { ALLOWED_CONNECTIONS } from '../../middleware/connectionGuard';
import { Workspace } from '../workspace/workspace.model';

export const socialEnrichSchema = z.object({
  githubUrl: z.string().trim().url().optional(),
  linkedinUrl: z.string().trim().url().optional(),
  confirmLinkedinFetch: z.boolean().optional(),
});

export const importGithubRepositoriesSchema = z.object({
  repoIds: z.array(z.string().trim().min(1)).min(1).max(8),
});

export const acceptTermsSchema = z.object({
  version: z.string().trim().min(1).max(50),
});

type UserLike = Omit<IUser, '_id' | 'institutionId'> & {
  _id: { toString(): string };
  institutionId?: { toString(): string } | null;
};

const GITHUB_PROFILE_ROLES = new Set<UserRole>([UserRole.STUDENT, UserRole.MENTOR]);

const supportsGithubProfile = (role: UserRole) => GITHUB_PROFILE_ROLES.has(role);

const optionalUrlSchema = z.string().trim().url().optional().or(z.literal(''));

const nullableUrlSchema = z
  .preprocess((value) => (value === '' || value === undefined ? null : value), z.string().trim().url().nullable())
  .optional();

const nullableDateSchema = z.preprocess(
  (value) => (value === '' || value === undefined ? null : value),
  z.coerce.date().nullable(),
);

const optionalYearSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().min(1900).max(3000).optional(),
);

const optionalInstitutionYearSchema = z.preprocess(
  (value) => (value === '' || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().min(1800).max(3000).optional(),
);

const stringListSchema = z.array(z.string().trim().min(1).max(100)).max(24).default([]);
const locationListSchema = z.array(z.string().trim().min(1).max(160)).max(12).default([]);
const institutionPolicySchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.enum(['Active', 'On Track', 'Pending', 'Inactive']),
  lastUpdated: nullableDateSchema.optional(),
});
const institutionStatsSchema = z.object({
  totalInnovationActivities: z.coerce.number().int().min(0).optional(),
  patentsFiled: z.coerce.number().int().min(0).optional(),
  totalMentoringHours: z.coerce.number().int().min(0).optional(),
  startupsLaunched: z.coerce.number().int().min(0).optional(),
  industryCollaborations: z.coerce.number().int().min(0).optional(),
  totalHRConnections: z.coerce.number().int().min(0).optional(),
  studentsPlaced: z.coerce.number().int().min(0).optional(),
  directShortlistsThisQuarter: z.coerce.number().int().min(0).optional(),
  topHiringSector: z.string().trim().max(120).optional().or(z.literal('')),
});
const institutionProfilePatchSchema = z.object({
  institutionName: z.string().trim().min(2).max(160).optional(),
  location: z.string().trim().min(2).max(160).optional(),
  totalStudentsEnrolled: z.coerce.number().int().min(0).optional(),
  academicYear: z.string().trim().min(4).max(20).optional(),
  iicStarRating: z.coerce.number().min(0).max(5).optional(),
  organizationType: z.string().trim().max(120).optional().or(z.literal('')),
  foundedYear: optionalInstitutionYearSchema,
  specialties: stringListSchema.optional(),
  locations: locationListSchema.optional(),
  alumniCount: z.coerce.number().int().min(0).optional(),
  employeeCount: z.coerce.number().int().min(0).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  policies: z.array(institutionPolicySchema).max(20).optional(),
  stats: institutionStatsSchema.optional(),
});

const skillEntrySchema = z.object({
  name: z.string().trim().min(1).max(100),
  category: z.enum(['programming', 'design', 'business', 'research', 'other']).default('other'),
  source: z.enum(['platform', 'github', 'linkedin', 'manual']).default('manual'),
  level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']).default('beginner'),
  endorsements: z.coerce.number().int().min(0).max(100000).default(0),
  addedAt: z.coerce.date().optional(),
});

const experienceEntrySchema = z.object({
  _id: z.string().trim().optional(),
  title: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(160),
  type: z.enum(['full_time', 'part_time', 'internship', 'freelance', 'volunteer']).default('internship'),
  location: z.string().trim().max(100).default(''),
  startDate: z.coerce.date(),
  endDate: nullableDateSchema.default(null),
  isCurrent: z.boolean().default(false),
  description: z.string().trim().max(1000).default(''),
  skills: stringListSchema,
  source: z.enum(['manual', 'linkedin']).default('manual'),
  linkedinId: z.string().trim().nullable().default(null),
});

const educationEntrySchema = z.object({
  _id: z.string().trim().optional(),
  institution: z.string().trim().min(1).max(160),
  degree: z.string().trim().max(160).default(''),
  fieldOfStudy: z.string().trim().max(160).default(''),
  startYear: optionalYearSchema,
  endYear: z.preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.coerce.number().int().min(1900).max(3000).nullable(),
  ).default(null),
  isCurrent: z.boolean().default(false),
  grade: z.string().trim().max(80).default(''),
  activities: z.string().trim().max(500).default(''),
  description: z.string().trim().max(1000).default(''),
  source: z.enum(['manual', 'linkedin']).default('manual'),
});

const certificationEntrySchema = z.object({
  _id: z.string().trim().optional(),
  name: z.string().trim().min(1).max(160),
  issuingOrganization: z.string().trim().min(1).max(160),
  issueDate: nullableDateSchema.default(null),
  expiryDate: nullableDateSchema.default(null),
  credentialId: z.string().trim().max(120).default(''),
  credentialUrl: nullableUrlSchema.default(null),
  source: z.enum(['manual', 'linkedin']).default('manual'),
});

const portfolioProjectEntrySchema = z.object({
  _id: z.string().trim().optional(),
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1000).default(''),
  techStack: stringListSchema,
  repoUrl: nullableUrlSchema.default(null),
  liveUrl: nullableUrlSchema.default(null),
  coverImageUrl: nullableUrlSchema.default(null),
  startDate: nullableDateSchema.default(null),
  endDate: nullableDateSchema.default(null),
  isCurrent: z.boolean().default(false),
  source: z.enum(['manual', 'github']).default('manual'),
  githubRepoId: z.string().trim().nullable().default(null),
  stars: z.coerce.number().int().min(0).max(1000000).default(0),
  forks: z.coerce.number().int().min(0).max(1000000).default(0),
  languages: stringListSchema,
});

const portfolioServiceEntrySchema = z.object({
  _id: z.string().trim().optional(),
  icon: z.string().trim().max(16).optional().or(z.literal('')),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).default(''),
});

const portfolioTestimonialEntrySchema = z.object({
  _id: z.string().trim().optional(),
  name: z.string().trim().min(1).max(120),
  role: z.string().trim().max(160).default(''),
  text: z.string().trim().max(500).default(''),
});

const portfolioBlogPostEntrySchema = z.object({
  _id: z.string().trim().optional(),
  tag: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(160),
  excerpt: z.string().trim().max(500).default(''),
  tagColor: z.string().trim().max(32).default('#7c3aed'),
  url: nullableUrlSchema.default(null),
  publishedAt: nullableDateSchema.default(null),
});

const portfolioTextFieldSchema = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal(''));

const portfolioContentPatchSchema = z.object({
  heroEyebrow: portfolioTextFieldSchema(80),
  heroTitle: portfolioTextFieldSchema(160),
  heroDescription: portfolioTextFieldSchema(500),
  primaryButtonLabel: portfolioTextFieldSchema(60),
  secondaryButtonLabel: portfolioTextFieldSchema(60),
  statOneLabel: portfolioTextFieldSchema(60),
  statTwoLabel: portfolioTextFieldSchema(60),
  statThreeLabel: portfolioTextFieldSchema(60),
  statFourLabel: portfolioTextFieldSchema(60),
  aboutTitle: portfolioTextFieldSchema(80),
  aboutEmpty: portfolioTextFieldSchema(200),
  experienceTitle: portfolioTextFieldSchema(80),
  experienceEmpty: portfolioTextFieldSchema(200),
  skillsTitle: portfolioTextFieldSchema(80),
  skillsEmpty: portfolioTextFieldSchema(200),
  projectsTitle: portfolioTextFieldSchema(80),
  projectsEmpty: portfolioTextFieldSchema(200),
  educationTitle: portfolioTextFieldSchema(80),
  educationEmpty: portfolioTextFieldSchema(200),
  certificationsTitle: portfolioTextFieldSchema(80),
  certificationsEmpty: portfolioTextFieldSchema(200),
  startupsTitle: portfolioTextFieldSchema(80),
  startupsEmpty: portfolioTextFieldSchema(200),
  linksTitle: portfolioTextFieldSchema(80),
  linksEmpty: portfolioTextFieldSchema(200),
  institutionDetailsTitle: portfolioTextFieldSchema(80),
  institutionDetailsEmpty: portfolioTextFieldSchema(200),
  institutionSpecialtiesTitle: portfolioTextFieldSchema(80),
  institutionSpecialtiesEmpty: portfolioTextFieldSchema(200),
  institutionLocationsTitle: portfolioTextFieldSchema(80),
  institutionLocationsEmpty: portfolioTextFieldSchema(200),
  institutionOutcomesTitle: portfolioTextFieldSchema(80),
  institutionOutcomesEmpty: portfolioTextFieldSchema(200),
  footerNote: portfolioTextFieldSchema(200),
});

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatar: optionalUrlSchema,
    avatarWallpaper: optionalUrlSchema,
    bio: z.string().trim().max(500).optional().or(z.literal('')),
    domain: z.string().trim().max(120).optional().or(z.literal('')),
    headline: z.string().trim().max(160).optional().or(z.literal('')),
    location: z.string().trim().max(160).optional().or(z.literal('')),
    websiteUrl: optionalUrlSchema,
    githubUrl: optionalUrlSchema,
    linkedinUrl: optionalUrlSchema,
    twitterUrl: optionalUrlSchema,
    youtubeUrl: optionalUrlSchema,
    behanceUrl: optionalUrlSchema,
    dribbbleUrl: optionalUrlSchema,
    instagramUrl: optionalUrlSchema,
    researchGateUrl: optionalUrlSchema,
    mediumUrl: optionalUrlSchema,
    institutionProfile: institutionProfilePatchSchema.optional(),
    skills: z.array(skillEntrySchema).max(80).optional(),
    experience: z.array(experienceEntrySchema).max(25).optional(),
    education: z.array(educationEntrySchema).max(25).optional(),
    certifications: z.array(certificationEntrySchema).max(40).optional(),
    portfolioProjects: z.array(portfolioProjectEntrySchema).max(40).optional(),
    portfolioServices: z.array(portfolioServiceEntrySchema).max(20).optional(),
    portfolioTestimonials: z.array(portfolioTestimonialEntrySchema).max(20).optional(),
    portfolioBlogPosts: z.array(portfolioBlogPostEntrySchema).max(20).optional(),
    portfolioContent: portfolioContentPatchSchema.optional(),
    profileComplete: z.boolean().optional(),
    discoverableToRecruiters: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

const slugifyDisplayName = (displayName: string) => {
  const normalized = displayName
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized || 'user';
};

const generateProfileSlug = async (displayName: string) => {
  const baseSlug = slugifyDisplayName(displayName);

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const suffix = randomBytes(2).toString('hex');
    const candidate = `${baseSlug}-${suffix}`;
    const existing = await User.exists({ profileSlug: candidate });

    if (!existing) {
      return candidate;
    }
  }

  throw new ApiError(500, 'PROFILE_SLUG_GENERATION_FAILED', 'Unable to generate a unique profile URL');
};

const ensureProfileSlug = async (user: UserDocument) => {
  if (user.profileSlug) {
    return false;
  }

  user.profileSlug = await generateProfileSlug(user.displayName);
  return true;
};

const applyProfileCompleteScoreIfNeeded = async (
  user: UserDocument,
  userId: string,
  wasProfileComplete: boolean,
  source: string,
) => {
  if (wasProfileComplete || !user.profileComplete) {
    return;
  }

  const newScore = await applyScore({
    userId,
    trigger: 'PROFILE_COMPLETE',
    metadata: { source },
  });
  user.innovationScore = newScore;
};

const computeProfileComplete = (user: Pick<IUser, 'role' | 'displayName' | 'bio' | 'domain' | 'githubUrl' | 'linkedinUrl'>) =>
  Boolean(
    user.displayName?.trim() &&
      ((user.bio && user.bio.trim()) ||
        (user.domain && user.domain.trim()) ||
        (user.linkedinUrl && user.linkedinUrl.trim()) ||
        (supportsGithubProfile(user.role) && user.githubUrl && user.githubUrl.trim())),
  );

type EducationResolverUser = Pick<IUser, 'role' | 'institutionId' | 'email' | 'education'>;
type EducationEntryDraft = Omit<IUser['education'][number], '_id'> & {
  _id?: IUser['education'][number]['_id'];
};

type InstitutionEducationContext = {
  institutionName: string;
  academicYear?: string;
  gradeOrProgram?: string;
  notes?: string;
};

const normalizeInstitutionName = (value: string) => sanitizePlainText(value).toLowerCase();

const parseAcademicYearStart = (academicYear?: string) => {
  const match = academicYear?.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : undefined;
};

const isCurrentInstitutionEducationMatch = (
  education: IUser['education'][number],
  institutionName: string,
) => education.isCurrent && normalizeInstitutionName(education.institution) === normalizeInstitutionName(institutionName);

const sortEducationEntries = (entries: IUser['education']) =>
  [...entries].sort((left, right) => {
    const sourceRank = (entry: IUser['education'][number]) => {
      if (entry.source === 'institution') return 0;
      if (entry.isCurrent) return 1;
      return 2;
    };

    const leftRank = sourceRank(left);
    const rightRank = sourceRank(right);
    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    const leftYear = left.endYear ?? left.startYear ?? 0;
    const rightYear = right.endYear ?? right.startYear ?? 0;
    if (leftYear !== rightYear) {
      return rightYear - leftYear;
    }

    return left.institution.localeCompare(right.institution);
  }) as IUser['education'];

const resolveInstitutionEducationContext = async (
  user: EducationResolverUser,
): Promise<InstitutionEducationContext | null> => {
  if (user.role !== UserRole.STUDENT || !user.institutionId) {
    return null;
  }

  const [institution, rosterEntry] = await Promise.all([
    User.findById(user.institutionId).select('displayName institutionProfile').lean(),
    InstitutionStudentRosterEntry.findOne({
      institutionId: user.institutionId,
      email: user.email.trim().toLowerCase(),
      isActive: true,
    })
      .sort({ updatedAt: -1 })
      .select('gradeOrProgram notes')
      .lean(),
  ]);

  if (!institution) {
    return null;
  }

  return {
    institutionName: institution.institutionProfile?.institutionName ?? institution.displayName,
    ...(institution.institutionProfile?.academicYear
      ? { academicYear: institution.institutionProfile.academicYear }
      : {}),
    ...(rosterEntry?.gradeOrProgram ? { gradeOrProgram: rosterEntry.gradeOrProgram } : {}),
    ...(rosterEntry?.notes ? { notes: rosterEntry.notes } : {}),
  };
};

const buildInstitutionEducationEntry = (
  context: InstitutionEducationContext,
  existing?: IUser['education'][number],
): EducationEntryDraft => {
  const startYear = existing?.startYear ?? parseAcademicYearStart(context.academicYear);
  const description = existing?.description
    ? sanitizePlainText(existing.description)
    : [context.academicYear ? `Current session ${context.academicYear}` : null, context.notes ? sanitizePlainText(context.notes) : null]
        .filter(Boolean)
        .join('. ');

  return {
    ...(existing?._id ? { _id: existing._id } : {}),
    institution: sanitizePlainText(context.institutionName),
    degree: sanitizePlainText(existing?.degree || context.gradeOrProgram || ''),
    fieldOfStudy: sanitizePlainText(existing?.fieldOfStudy || ''),
    ...(startYear ? { startYear } : {}),
    endYear: null,
    isCurrent: true,
    grade: sanitizePlainText(existing?.grade || ''),
    activities: sanitizePlainText(existing?.activities || (context.academicYear ? `Academic year ${context.academicYear}` : '')),
    description,
    source: 'institution',
  };
};

export const resolveEducationEntriesForUser = async (
  user: EducationResolverUser,
): Promise<IUser['education']> => {
  const baseEducation = (user.education ?? []) as IUser['education'];
  const context = await resolveInstitutionEducationContext(user);

  if (!context) {
    return sortEducationEntries(
      baseEducation.filter((entry) => entry.source !== 'institution') as IUser['education'],
    );
  }

  const existingInstitutionEntry =
    baseEducation.find((entry) => entry.source === 'institution') ??
    baseEducation.find((entry) => isCurrentInstitutionEducationMatch(entry, context.institutionName));

  const remainingEntries = baseEducation.filter(
    (entry) =>
      entry !== existingInstitutionEntry &&
      entry.source !== 'institution' &&
      !isCurrentInstitutionEducationMatch(entry, context.institutionName),
  ) as IUser['education'];

  return sortEducationEntries([
    buildInstitutionEducationEntry(context, existingInstitutionEntry),
    ...remainingEntries,
  ] as IUser['education']);
};

export const syncInstitutionEducationForUser = async (user: UserDocument) => {
  user.education = await resolveEducationEntriesForUser({
    role: user.role,
    institutionId: user.institutionId,
    email: user.email,
    education: user.education,
  });

  return user.education;
};

const toSanitizedConnectedAccounts = (connectedAccounts: IUser['connectedAccounts']): SanitizedUser['connectedAccounts'] => ({
  github: {
    userId: connectedAccounts.github.userId ?? null,
    ...(connectedAccounts.github.username !== undefined
      ? { username: connectedAccounts.github.username ?? null }
      : {}),
    connectedAt: connectedAccounts.github.connectedAt ?? null,
    lastSyncedAt: connectedAccounts.github.lastSyncedAt ?? null,
  },
  google: {
    userId: connectedAccounts.google.userId ?? null,
    ...(connectedAccounts.google.username !== undefined
      ? { username: connectedAccounts.google.username ?? null }
      : {}),
    connectedAt: connectedAccounts.google.connectedAt ?? null,
    lastSyncedAt: connectedAccounts.google.lastSyncedAt ?? null,
  },
  linkedin: {
    userId: connectedAccounts.linkedin.userId ?? null,
    ...(connectedAccounts.linkedin.username !== undefined
      ? { username: connectedAccounts.linkedin.username ?? null }
      : {}),
    connectedAt: connectedAccounts.linkedin.connectedAt ?? null,
    lastSyncedAt: connectedAccounts.linkedin.lastSyncedAt ?? null,
  },
});

const toSanitizedInstitutionVerification = (
  institutionVerification?: IUser['institutionVerification'],
): SanitizedUser['institutionVerification'] | undefined => {
  if (!institutionVerification) {
    return undefined;
  }

  return {
    regulatoryBodies: institutionVerification.regulatoryBodies ?? [],
    ...(institutionVerification.affiliationName
      ? { affiliationName: institutionVerification.affiliationName }
      : {}),
    ...(institutionVerification.websiteUrl
      ? { websiteUrl: institutionVerification.websiteUrl }
      : {}),
    ...(institutionVerification.referenceCode
      ? { referenceCode: institutionVerification.referenceCode }
      : {}),
    ...(institutionVerification.notes ? { notes: institutionVerification.notes } : {}),
    documents: (institutionVerification.documents ?? []).map((document) => ({
      _id: document._id.toString(),
      category: document.category,
      fileUrl: document.fileUrl,
      fileType: document.fileType,
      fileName: document.fileName,
      fileSizeBytes: document.fileSizeBytes,
      uploadedAt: document.uploadedAt,
      uploadedBy: document.uploadedBy.toString(),
    })),
    readiness: institutionVerification.readiness,
  };
};

export const toSanitizedUser = (user: UserLike): SanitizedUser => ({
  _id: user._id.toString(),
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  githubOAuthAvailable: isGithubOauthAvailable(),
  ...(user.avatar ? { avatar: user.avatar } : {}),
  ...(user.avatarWallpaper ? { avatarWallpaper: user.avatarWallpaper } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
  headline: user.headline ?? '',
  location: user.location ?? '',
  websiteUrl: user.websiteUrl ?? null,
  githubUrl: user.githubUrl ?? null,
  linkedinUrl: user.linkedinUrl ?? null,
  twitterUrl: user.twitterUrl ?? null,
  youtubeUrl: user.youtubeUrl ?? null,
  behanceUrl: user.behanceUrl ?? null,
  dribbbleUrl: user.dribbbleUrl ?? null,
  instagramUrl: user.instagramUrl ?? null,
  researchGateUrl: user.researchGateUrl ?? null,
  mediumUrl: user.mediumUrl ?? null,
  isProfilePublic: user.isProfilePublic ?? true,
  ...(user.profileSlug !== undefined ? { profileSlug: user.profileSlug ?? null } : {}),
  ...(user.domain ? { domain: user.domain } : {}),
  profileComplete: user.profileComplete,
  registrationStage: user.registrationStage,
  innovationScore: normalizeInnovationScore(user.innovationScore),
  scoreBreakdown: normalizeScoreBreakdown(user.scoreBreakdown),
  accessGrantedBy: user.accessGrantedBy,
  accessExpiresAt: user.accessExpiresAt,
  isActive: user.isActive,
  ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
  discoverableToRecruiters: user.discoverableToRecruiters ?? false,
  mustChangePasswordOnNextLogin: user.mustChangePasswordOnNextLogin ?? false,
  termsAcceptance: user.termsAcceptance ?? null,
  termsCurrentVersion: CURRENT_TERMS_VERSION,
  hasAcceptedCurrentTerms: hasAcceptedCurrentTerms(user.role, user.termsAcceptance),
  ...(user.institutionToken !== undefined ? { institutionToken: user.institutionToken ?? null } : {}),
  ...(user.institutionId ? { institutionId: user.institutionId.toString() } : { institutionId: null }),
  ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
  ...(user.portfolioContent ? { portfolioContent: user.portfolioContent } : {}),
  ...(user.institutionVerification
    ? { institutionVerification: toSanitizedInstitutionVerification(user.institutionVerification) }
    : {}),
  institutionVerifiedAt: user.institutionVerifiedAt ?? null,
  institutionVerificationStatus: user.institutionVerificationStatus,
  verificationStatus: user.verificationStatus,
  ...(user.verificationRequestedAt ? { verificationRequestedAt: user.verificationRequestedAt } : {}),
  ...(user.verifiedAt ? { verifiedAt: user.verifiedAt } : {}),
  ...(user.verificationRejectedAt ? { verificationRejectedAt: user.verificationRejectedAt } : {}),
  ...(user.verificationRejectedReason
    ? { verificationRejectedReason: user.verificationRejectedReason }
    : {}),
  adminApprovalStatus: user.adminApprovalStatus,
  ...(user.adminApprovalRequestedAt
    ? { adminApprovalRequestedAt: user.adminApprovalRequestedAt }
    : {}),
  ...(user.adminApprovedAt ? { adminApprovedAt: user.adminApprovedAt } : {}),
  ...(user.adminApprovedBy ? { adminApprovedBy: user.adminApprovedBy.toString() } : { adminApprovedBy: null }),
  ...(user.adminApprovalRejectedAt
    ? { adminApprovalRejectedAt: user.adminApprovalRejectedAt }
    : {}),
  ...(user.adminApprovalRejectedReason
    ? { adminApprovalRejectedReason: user.adminApprovalRejectedReason }
    : {}),
  connectedAccounts: toSanitizedConnectedAccounts(user.connectedAccounts),
  skills: user.skills ?? [],
  experience: user.experience ?? [],
  education: user.education ?? [],
  certifications: user.certifications ?? [],
  portfolioProjects: user.portfolioProjects ?? [],
  portfolioServices: user.portfolioServices ?? [],
  portfolioTestimonials: user.portfolioTestimonials ?? [],
  portfolioBlogPosts: user.portfolioBlogPosts ?? [],
  resume: user.resume ?? {
    fileUrl: null,
    fileName: null,
    uploadedAt: null,
    isPublic: false,
  },
  githubStats: user.githubStats ?? {
    totalRepos: 0,
    totalStars: 0,
    totalForks: 0,
    topLanguages: [],
    contributionsLastYear: 0,
    lastSyncedAt: null,
  },
  githubProof: user.githubProof ?? {
    importedRepoIds: [],
    importedRepos: [],
    recentActivity: [],
    commitCount30Days: 0,
    activeDays30Days: 0,
    pushEvents30Days: 0,
    pullRequests30Days: 0,
    issues30Days: 0,
    lastSyncedAt: null,
  },
  teamRequestsSent: (user.teamRequestsSent ?? []).map((requestId) => requestId.toString()),
  teamRequestsReceived: (user.teamRequestsReceived ?? []).map((requestId) => requestId.toString()),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const profileSlugCreated = await ensureProfileSlug(user);
  if (profileSlugCreated) {
    await user.save();
  }

  return {
    ...toSanitizedUser(user.toObject() as UserLike),
    education: await resolveEducationEntriesForUser({
      role: user.role,
      institutionId: user.institutionId,
      email: user.email,
      education: user.education,
    }),
  };
};

export const acceptCurrentTerms = async (
  userId: string,
  payload: z.infer<typeof acceptTermsSchema>,
) => {
  if (payload.version !== CURRENT_TERMS_VERSION) {
    throw new ApiError(
      409,
      'TERMS_VERSION_MISMATCH',
      'The Terms & Conditions were updated. Please reload and review the latest version.',
    );
  }

  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  user.termsAcceptance = buildTermsAcceptance(user.role);
  await user.save();

  return toSanitizedUser(user.toObject() as UserLike);
};

export const recordCurrentUserActivity = async (userId: string, payload: unknown) => {
  const parsed = recordClientActivitySchema.parse(payload);
  await recordClientActivity(userId, parsed);
  return { tracked: true };
};

const extractGithubUsername = (githubUrl: string) => {
  try {
    const url = new URL(githubUrl);
    if (!/github\.com$/i.test(url.hostname)) {
      throw new Error('Invalid GitHub hostname');
    }

    const [username] = url.pathname.split('/').filter(Boolean);
    if (!username) {
      throw new Error('GitHub username missing');
    }

    return username;
  } catch (_error) {
    throw new ApiError(400, 'INVALID_GITHUB_URL', 'Enter a valid GitHub profile URL');
  }
};

const extractLinkedInHandle = (linkedinUrl: string) => {
  try {
    const url = new URL(linkedinUrl);
    if (!/linkedin\.com$/i.test(url.hostname) && !/linkedin\.com$/i.test(url.hostname.replace(/^www\./i, ''))) {
      throw new Error('Invalid LinkedIn hostname');
    }

    return url.pathname.split('/').filter(Boolean).join('/');
  } catch (_error) {
    throw new ApiError(400, 'INVALID_LINKEDIN_URL', 'Enter a valid LinkedIn profile URL');
  }
};

type GithubUserResponse = {
  id: number;
  login: string;
  name: string | null;
  avatar_url: string;
  bio: string | null;
  blog: string | null;
  location: string | null;
  company: string | null;
  html_url: string;
  public_repos: number;
};

type GithubRepoResponse = {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  fork: boolean;
  archived: boolean;
  updated_at: string;
};

type GithubEventResponse = {
  type: string;
  created_at: string;
};

const fetchGithubJson = async <T>(url: string): Promise<T> => {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'ProMove-Innovation-Cloud',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (response.status === 404) {
    throw new ApiError(404, 'GITHUB_PROFILE_NOT_FOUND', 'GitHub profile not found');
  }

  if (!response.ok) {
    throw new ApiError(502, 'GITHUB_API_ERROR', 'Unable to fetch GitHub data right now');
  }

  return (await response.json()) as T;
};

const determineGithubSkillLevel = (percentage: number): IUser['skills'][number]['level'] => {
  if (percentage > 40) return 'advanced';
  if (percentage > 15) return 'intermediate';
  return 'beginner';
};

const normalizeOptionalUrl = (value?: string | null) => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const applyLinkedInProfileFields = (
  user: IUser,
  profile: Awaited<ReturnType<typeof fetchLinkedInPublicProfile>>,
) => {
  let importedProfileFields = 0;

  if ((!user.displayName || user.displayName.trim().length === 0) && profile.displayName) {
    user.displayName = sanitizePlainText(profile.displayName);
    importedProfileFields += 1;
  }

  if ((!user.headline || user.headline.trim().length === 0) && profile.headline) {
    user.headline = sanitizePlainText(profile.headline);
    importedProfileFields += 1;
  }

  if ((!user.location || user.location.trim().length === 0) && profile.location) {
    user.location = sanitizePlainText(profile.location);
    importedProfileFields += 1;
  }

  if ((!user.bio || user.bio.trim().length === 0) && profile.bio) {
    user.bio = sanitizePlainText(profile.bio);
    importedProfileFields += 1;
  }

  if ((!user.avatar || user.avatar.trim().length === 0) && profile.avatar) {
    user.avatar = profile.avatar;
    importedProfileFields += 1;
  }

  user.skills = [...(user.skills ?? []).filter((skill) => skill.source !== 'linkedin'), ...profile.skills];
  user.experience = [
    ...(user.experience ?? []).filter((experience) => experience.source !== 'linkedin'),
    ...profile.experience,
  ];
  user.education = [
    ...(user.education ?? []).filter((education) => education.source !== 'linkedin'),
    ...profile.education,
  ];
  user.certifications = [
    ...(user.certifications ?? []).filter((certification) => certification.source !== 'linkedin'),
    ...profile.certifications,
  ];

  return {
    importedProfileFields,
    importedSkills: profile.skills.length,
    importedExperience: profile.experience.length,
    importedEducation: profile.education.length,
    importedCertifications: profile.certifications.length,
  };
};

export const enrichCurrentUserFromSocialLinks = async (
  userId: string,
  payload: z.infer<typeof socialEnrichSchema>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const wasProfileComplete = user.profileComplete;
  const previousProfilePercent = getProfileCompletionProgress(user).percent;

  if (payload.githubUrl !== undefined) {
    user.githubUrl = payload.githubUrl;
  }

  if (payload.linkedinUrl !== undefined) {
    user.linkedinUrl = payload.linkedinUrl;
  }

  const githubUrl = payload.githubUrl ?? user.githubUrl ?? undefined;
  const linkedinUrl = payload.linkedinUrl ?? user.linkedinUrl ?? undefined;

  const warnings: string[] = [];
  let githubImported = false;
  let linkedinImported = false;
  let importedSkills = 0;
  let importedProjects = 0;
  let importedProfileFields = 0;
  let importedExperience = 0;
  let importedEducation = 0;
  let importedCertifications = 0;

  if (githubUrl) {
    const username = extractGithubUsername(githubUrl);
    const [githubUser, repos, publicEvents] = await Promise.all([
      fetchGithubJson<GithubUserResponse>(`https://api.github.com/users/${username}`),
      fetchGithubJson<GithubRepoResponse[]>(
        `https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`,
      ),
      fetchGithubJson<GithubEventResponse[]>(
        `https://api.github.com/users/${username}/events/public?per_page=100`,
      ).catch(() => []),
    ]);

    const ownedRepos = repos.filter((repo) => !repo.fork);
    const totalStars = ownedRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
    const totalForks = ownedRepos.reduce((sum, repo) => sum + repo.forks_count, 0);
    const languageCounts = ownedRepos.reduce<Record<string, number>>((acc, repo) => {
      if (repo.language) {
        acc[repo.language] = (acc[repo.language] ?? 0) + 1;
      }
      return acc;
    }, {});
    const totalLanguageMentions = Object.values(languageCounts).reduce((sum, count) => sum + count, 0);
    const topLanguages = Object.entries(languageCounts)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([language, count]) => ({
        language,
        percentage: totalLanguageMentions > 0 ? Number(((count / totalLanguageMentions) * 100).toFixed(1)) : 0,
      }));

    const githubSkills = topLanguages.map((entry) => ({
      name: entry.language,
      category: 'programming' as const,
      source: 'github' as const,
      level: determineGithubSkillLevel(entry.percentage),
      endorsements: 0,
      addedAt: new Date(),
    }));

    const githubProjects = ownedRepos
      .filter((repo) => repo.stargazers_count >= 1 || !repo.archived)
      .slice(0, 8)
      .map((repo) => ({
        _id: new Types.ObjectId(),
        title: repo.name,
        description: repo.description ?? '',
        techStack: repo.language ? [repo.language] : [],
        repoUrl: repo.html_url,
        liveUrl: normalizeOptionalUrl(repo.homepage),
        coverImageUrl: null,
        startDate: null,
        endDate: null,
        isCurrent: !repo.archived,
        source: 'github' as const,
        githubRepoId: String(repo.id),
        stars: repo.stargazers_count,
        forks: repo.forks_count,
        languages: repo.language ? [repo.language] : [],
      }));

    const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
    const contributionsLastYear = publicEvents.filter(
      (event) => event.type === 'PushEvent' && new Date(event.created_at).getTime() >= oneYearAgo,
    ).length;

    user.connectedAccounts.github = {
      ...user.connectedAccounts.github,
      userId: String(githubUser.id),
      username: githubUser.login,
      connectedAt: user.connectedAccounts.github.connectedAt ?? new Date(),
      lastSyncedAt: new Date(),
    };

    user.githubStats = {
      totalRepos: githubUser.public_repos,
      totalStars,
      totalForks,
      topLanguages,
      contributionsLastYear,
      lastSyncedAt: new Date(),
    };

    user.skills = [...(user.skills ?? []).filter((skill) => skill.source !== 'github'), ...githubSkills];
    user.portfolioProjects = [
      ...(user.portfolioProjects ?? []).filter((project) => project.source !== 'github'),
      ...githubProjects,
    ];

    if (!user.avatar && githubUser.avatar_url) {
      user.avatar = githubUser.avatar_url;
    }

    if ((!user.bio || user.bio.trim().length === 0) && githubUser.bio) {
      user.bio = githubUser.bio;
    }

    if ((!user.websiteUrl || user.websiteUrl.trim().length === 0) && githubUser.blog) {
      user.websiteUrl = normalizeOptionalUrl(githubUser.blog);
    }

    if ((!user.location || user.location.trim().length === 0) && githubUser.location) {
      user.location = githubUser.location;
    }

    user.githubUrl = githubUser.html_url;
    githubImported = true;
    importedSkills += githubSkills.length;
    importedProjects += githubProjects.length;

    await applyScoreAsync({
      userId,
      trigger: 'GITHUB_CONNECTED',
      metadata: { username: githubUser.login },
    });
  }

  if (linkedinUrl) {
    const handle = extractLinkedInHandle(linkedinUrl);
    const shouldFetchLinkedIn = payload.confirmLinkedinFetch === true;
    const shouldWarnSkippedLinkedIn =
      payload.linkedinUrl !== undefined && payload.confirmLinkedinFetch !== true;

    if (shouldFetchLinkedIn) {
      try {
        const linkedInProfile = await fetchLinkedInPublicProfile(linkedinUrl, handle);
        const summary = applyLinkedInProfileFields(user, linkedInProfile);
        const hasLinkedInPublicData = Boolean(
          linkedInProfile.displayName ||
            linkedInProfile.headline ||
            linkedInProfile.location ||
            linkedInProfile.bio ||
            linkedInProfile.avatar ||
            linkedInProfile.skills.length > 0 ||
            linkedInProfile.experience.length > 0 ||
            linkedInProfile.education.length > 0 ||
            linkedInProfile.certifications.length > 0,
        );

        importedProfileFields += summary.importedProfileFields;
        importedSkills += summary.importedSkills;
        importedExperience += summary.importedExperience;
        importedEducation += summary.importedEducation;
        importedCertifications += summary.importedCertifications;

        user.connectedAccounts.linkedin = {
          ...user.connectedAccounts.linkedin,
          userId: handle,
          username: handle.split('/').filter(Boolean).pop() ?? handle,
          connectedAt: user.connectedAccounts.linkedin.connectedAt ?? new Date(),
          lastSyncedAt: new Date(),
        };
        user.linkedinUrl = linkedInProfile.canonicalUrl;

        if (hasLinkedInPublicData) {
          linkedinImported = true;

          if (
            summary.importedProfileFields +
              summary.importedSkills +
              summary.importedExperience +
              summary.importedEducation +
              summary.importedCertifications ===
            0
          ) {
            warnings.push(
              'LinkedIn data was fetched successfully, but your existing profile fields were already populated so nothing new was applied.',
            );
          }

          await applyScoreAsync({
            userId,
            trigger: 'LINKEDIN_CONNECTED',
            metadata: {
              handle,
              importedProfileFields: summary.importedProfileFields,
              importedSkills: summary.importedSkills,
              importedExperience: summary.importedExperience,
              importedEducation: summary.importedEducation,
              importedCertifications: summary.importedCertifications,
            },
          });
        } else {
          warnings.push(
            'LinkedIn profile was reachable, but no public data could be imported. The URL was still saved.',
          );
        }
      } catch (error) {
        const code = error instanceof Error ? error.message : 'LINKEDIN_FETCH_FAILED';

        if (code === 'LINKEDIN_PROFILE_NOT_FOUND') {
          throw new ApiError(404, code, 'LinkedIn profile not found');
        }

        if (code === 'LINKEDIN_FETCH_BLOCKED') {
          warnings.push(
            'LinkedIn blocked automatic profile extraction for this URL. The link was saved, but no LinkedIn data was imported.',
          );
        } else {
          warnings.push(
            'Unable to fetch LinkedIn data right now. The link was saved, but LinkedIn details were not imported.',
          );
        }
      }
    } else if (shouldWarnSkippedLinkedIn) {
      warnings.push(
        'LinkedIn URL was saved, but profile data was not fetched because you did not confirm the LinkedIn import.',
      );
    }
  }

  await syncInstitutionEducationForUser(user);
  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);

  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'social_enrich');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  return {
    user: {
      ...toSanitizedUser(user.toObject() as UserLike),
      education: user.education ?? [],
    },
    summary: {
      githubImported,
      linkedinImported,
      warnings,
      importedSkills,
      importedProjects,
      importedProfileFields,
      importedExperience,
      importedEducation,
      importedCertifications,
    },
  };
};

export const beginGithubOauthForCurrentUser = async (userId: string, returnTo?: string) =>
  createGithubOauthStart(userId, returnTo);

export const connectGithubForCurrentUserFromCallback = async (state: string, code: string) => {
  const { userId, returnTo } = await consumeGithubOauthState(state);
  const accessToken = await resolveGithubOauthCallback(code);
  const user = await User.findById(userId).select('+connectedAccounts.github.accessToken');

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const wasConnected = Boolean(user.connectedAccounts.github.userId);
  const wasProfileComplete = user.profileComplete;
  user.connectedAccounts.github = {
    ...user.connectedAccounts.github,
    accessToken,
    connectedAt: user.connectedAccounts.github.connectedAt ?? new Date(),
  };

  const previousProfilePercent = getProfileCompletionProgress(user).percent;
  await syncGithubProofForUser(user);
  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);
  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_oauth');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  if (!wasConnected) {
    await applyScoreAsync({
      userId,
      trigger: 'GITHUB_CONNECTED',
      metadata: { username: user.connectedAccounts.github.username ?? null },
    });
  }

  return {
    user,
    returnTo,
  };
};

const getCurrentUserWithGithubAccess = async (userId: string) => {
  const user = await User.findById(userId).select('+connectedAccounts.github.accessToken');

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return user;
};

export const syncCurrentUserGithubProof = async (userId: string) => {
  const user = await getCurrentUserWithGithubAccess(userId);
  const wasProfileComplete = user.profileComplete;
  const previousProfilePercent = getProfileCompletionProgress(user).percent;
  const result = await syncGithubProofForUser(user);
  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);
  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_sync');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  return {
    user: toSanitizedUser(user.toObject() as UserLike),
    repositoryCount: result.repositoryCount,
  };
};

export const listCurrentUserGithubRepositories = async (userId: string): Promise<GithubRepositoryChoice[]> => {
  const user = await getCurrentUserWithGithubAccess(userId);
  return listGithubRepositoryChoices(user);
};

export const importCurrentUserGithubRepositories = async (
  userId: string,
  payload: z.infer<typeof importGithubRepositoriesSchema>,
) => {
  const user = await getCurrentUserWithGithubAccess(userId);
  const wasProfileComplete = user.profileComplete;
  const previousProfilePercent = getProfileCompletionProgress(user).percent;
  const result = await replaceImportedGithubRepositories(user, payload.repoIds);
  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);
  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_import');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  return {
    user: toSanitizedUser(user.toObject() as UserLike),
    importedCount: result.importedCount,
  };
};

export const getCurrentUserMentorSessions = async (
  studentId: string,
): Promise<StudentMentorSessionView[]> => {
  const sessions = await MentorSession.find({ studentId }).sort({ scheduledAt: 1 }).lean();
  const mentorIds = sessions.map((session) => session.mentorId);
  const mentors =
    mentorIds.length > 0
      ? await User.find({ _id: { $in: mentorIds } }).select('_id displayName avatar').lean()
      : [];

  const mentorMap = new Map(mentors.map((mentor) => [String(mentor._id), mentor]));

  return sessions.map((session) => {
    const mentor = mentorMap.get(String(session.mentorId));

    return {
      _id: String(session._id),
      mentor: {
        _id: String(session.mentorId),
        displayName: mentor?.displayName ?? 'Mentor',
        ...(mentor?.avatar ? { avatar: mentor.avatar } : {}),
      },
      ...(session.workspaceId ? { workspaceId: String(session.workspaceId) } : {}),
      title: session.title,
      scheduledAt: session.scheduledAt,
      durationMinutes: session.durationMinutes,
      ...(session.meetLink ? { meetLink: session.meetLink } : {}),
      status: session.status,
      ...(session.mentorNotes ? { mentorNotes: session.mentorNotes } : {}),
      ...(session.studentFeedback ? { studentFeedback: session.studentFeedback } : {}),
      createdAt: session.createdAt,
    };
  });
};

export const getCurrentUserInstitutionMentorshipPrograms = async (
  studentId: string,
): Promise<StudentInstitutionMentorshipProgramView[]> => {
  const student = await User.findById(studentId).select('institutionId role').lean();
  if (!student || student.role !== UserRole.STUDENT || !student.institutionId) {
    return [];
  }

  const institution = await User.findById(student.institutionId)
    .select('_id displayName role institutionProfile')
    .lean();

  if (!institution || (institution.role !== UserRole.SCHOOL && institution.role !== UserRole.COLLEGE)) {
    return [];
  }

  const institutionType: 'school' | 'college' =
    institution.role === UserRole.COLLEGE ? 'college' : 'school';

  const programs = await InstitutionMentorshipProgram.find({
    institutionId: institution._id,
    status: { $in: ['Pending', 'Assigned'] },
  })
    .sort({ scheduledAt: 1, preferredDate: 1, createdAt: -1 })
    .lean();

  if (programs.length === 0) {
    return [];
  }

  const mentorIds = programs
    .map((program) => program.mentorId)
    .filter((mentorId): mentorId is Types.ObjectId => Boolean(mentorId));

  const mentors =
    mentorIds.length > 0
      ? await User.find({ _id: { $in: mentorIds } })
          .select('_id displayName avatar domain')
          .lean()
      : [];
  const mentorMap = new Map(mentors.map((mentor) => [String(mentor._id), mentor]));

  const institutionDisplayName =
    institution.institutionProfile?.institutionName ?? institution.displayName;

  return programs.map((program) => {
    const mentor = program.mentorId ? mentorMap.get(String(program.mentorId)) : undefined;

    return {
      _id: String(program._id),
      institution: {
        _id: String(institution._id),
        displayName: institutionDisplayName,
        type: institutionType,
      },
      ...(mentor
        ? {
            mentor: {
              _id: String(mentor._id),
              displayName: mentor.displayName,
              ...(mentor.avatar ? { avatar: mentor.avatar } : {}),
              ...(mentor.domain ? { domain: mentor.domain } : {}),
            },
          }
        : {}),
      title: program.title,
      objective: program.objective,
      preferredDate: new Date(program.preferredDate).toISOString(),
      ...(program.scheduledAt ? { scheduledAt: new Date(program.scheduledAt).toISOString() } : {}),
      durationMinutes: program.durationMinutes,
      expectedParticipants: program.expectedParticipants,
      deliveryMode: program.deliveryMode,
      platform: program.platform,
      ...(program.meetingLink ? { meetingLink: program.meetingLink } : {}),
      ...(program.venue ? { venue: program.venue } : {}),
      ...(program.preferredExpertise ? { preferredExpertise: program.preferredExpertise } : {}),
      status: program.status,
      createdAt: new Date(program.createdAt).toISOString(),
    };
  });
};

export const launchCurrentUserToRecruiters = async (studentId: string): Promise<LaunchToRecruitersResult> => {
  const student = await User.findById(studentId);

  if (!student || student.role !== UserRole.STUDENT) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (!student.profileComplete) {
    throw new ApiError(
      409,
      'PROFILE_INCOMPLETE',
      'Complete your profile before launching it to recruiters or sharing it publicly.',
    );
  }

  if (student.verificationStatus !== 'verified') {
    throw new ApiError(
      409,
      'PROFILE_NOT_VERIFIED',
      'Your school or college must verify your account before this profile can be shared.',
    );
  }

  await ensureProfileSlug(student);
  student.discoverableToRecruiters = true;
  student.isProfilePublic = true;
  await student.save();

  const recruiters = await User.find({ role: UserRole.RECRUITER, isActive: true })
    .select('_id')
    .lean();
  const collegeId = await getStudentCollegeId(studentId);

  await Promise.all(
    recruiters.map((recruiter) =>
      RelevanceBridge.updateOne(
        {
          studentId,
          recruiterId: recruiter._id,
        },
        {
          studentId,
          recruiterId: recruiter._id,
          bridgeType: 'LAUNCH_TRIGGER',
          isActive: true,
        },
        {
          upsert: true,
        },
      ),
    ),
  );

  if (collegeId) {
    await Promise.all(
      recruiters.map((recruiter) =>
        PlacementRecord.findOneAndUpdate(
          {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
          },
          {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
            status: 'Discovered',
            innovationScoreAtTime: student.innovationScore ?? 0,
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        ),
      ),
    );
  }

  const notification = await NotificationService.create({
    userId: studentId,
    type: 'system',
    title: 'Your profile is now visible to all active recruiters',
    body: 'Your profile is now visible to all active recruiters.',
    link: '/leadership-profile',
  });

  if (io) {
    io.of('/notifications').to(`user:${studentId}`).emit('notification:new', notification);
  }

  return {
    bridgesCreated: recruiters.length,
    user: toSanitizedUser(student.toObject() as UserLike),
  };
};

const getExistingObjectId = (id: string | undefined) =>
  id && Types.ObjectId.isValid(id) ? { _id: new Types.ObjectId(id) } : {};

const normalizeStringList = (items: string[]) =>
  items.map((item) => sanitizePlainText(item)).filter(Boolean);

const normalizeInstitutionPolicies = (
  items: z.infer<typeof institutionPolicySchema>[],
): NonNullable<IUser['institutionProfile']>['policies'] =>
  items.map((policy) => ({
    name: sanitizePlainText(policy.name),
    status: policy.status,
    ...(policy.lastUpdated ? { lastUpdated: policy.lastUpdated } : {}),
  }));

const normalizeInstitutionStats = (
  stats: z.infer<typeof institutionStatsSchema>,
): NonNullable<IUser['institutionProfile']>['stats'] => ({
  totalInnovationActivities: stats.totalInnovationActivities ?? 0,
  patentsFiled: stats.patentsFiled ?? 0,
  totalMentoringHours: stats.totalMentoringHours ?? 0,
  startupsLaunched: stats.startupsLaunched ?? 0,
  industryCollaborations: stats.industryCollaborations ?? 0,
  ...(typeof stats.totalHRConnections === 'number' ? { totalHRConnections: stats.totalHRConnections } : {}),
  ...(typeof stats.studentsPlaced === 'number' ? { studentsPlaced: stats.studentsPlaced } : {}),
  ...(typeof stats.directShortlistsThisQuarter === 'number'
    ? { directShortlistsThisQuarter: stats.directShortlistsThisQuarter }
    : {}),
  ...(stats.topHiringSector ? { topHiringSector: sanitizePlainText(stats.topHiringSector) } : {}),
});

const applyInstitutionProfilePatch = (
  current: IUser['institutionProfile'] | undefined,
  patch: z.infer<typeof institutionProfilePatchSchema>,
): IUser['institutionProfile'] => {
  const baseStats = current?.stats ?? {
    totalInnovationActivities: 0,
    patentsFiled: 0,
    totalMentoringHours: 0,
    startupsLaunched: 0,
    industryCollaborations: 0,
  };

  return {
    institutionName: sanitizePlainText(patch.institutionName ?? current?.institutionName ?? ''),
    location: sanitizePlainText(patch.location ?? current?.location ?? ''),
    totalStudentsEnrolled: patch.totalStudentsEnrolled ?? current?.totalStudentsEnrolled ?? 0,
    academicYear: sanitizePlainText(patch.academicYear ?? current?.academicYear ?? ''),
    iicStarRating: patch.iicStarRating ?? current?.iicStarRating ?? 0,
    ...(current?.iicLastUpdated ? { iicLastUpdated: current.iicLastUpdated } : {}),
    ...(patch.organizationType !== undefined
      ? patch.organizationType
        ? { organizationType: sanitizePlainText(patch.organizationType) }
        : {}
      : current?.organizationType
        ? { organizationType: current.organizationType }
        : {}),
    ...(patch.foundedYear !== undefined
      ? patch.foundedYear
        ? { foundedYear: patch.foundedYear }
        : {}
      : current?.foundedYear
        ? { foundedYear: current.foundedYear }
        : {}),
    specialties:
      patch.specialties !== undefined
        ? normalizeStringList(patch.specialties)
        : current?.specialties ?? [],
    locations:
      patch.locations !== undefined
        ? patch.locations.map((item) => sanitizePlainText(item)).filter(Boolean)
        : current?.locations ?? [],
    ...(patch.alumniCount !== undefined
      ? { alumniCount: patch.alumniCount }
      : typeof current?.alumniCount === 'number'
        ? { alumniCount: current.alumniCount }
        : {}),
    ...(patch.employeeCount !== undefined
      ? { employeeCount: patch.employeeCount }
      : typeof current?.employeeCount === 'number'
        ? { employeeCount: current.employeeCount }
        : {}),
    ...(patch.contactEmail !== undefined
      ? patch.contactEmail
        ? { contactEmail: patch.contactEmail.trim().toLowerCase() }
        : {}
      : current?.contactEmail
        ? { contactEmail: current.contactEmail }
        : {}),
    ...(patch.contactPhone !== undefined
      ? patch.contactPhone
        ? { contactPhone: sanitizePlainText(patch.contactPhone) }
        : {}
      : current?.contactPhone
        ? { contactPhone: current.contactPhone }
        : {}),
    policies:
      patch.policies !== undefined
        ? normalizeInstitutionPolicies(patch.policies)
        : current?.policies ?? [],
    stats:
      patch.stats !== undefined
        ? {
            ...baseStats,
            ...normalizeInstitutionStats(patch.stats),
          }
        : baseStats,
  };
};

const normalizeSkillEntries = (items: z.infer<typeof skillEntrySchema>[]): IUser['skills'] =>
  items.map((skill) => ({
    name: sanitizePlainText(skill.name),
    category: skill.category,
    source: skill.source,
    level: skill.level,
    endorsements: skill.endorsements,
    addedAt: skill.addedAt ?? new Date(),
  }));

const normalizeExperienceEntries = (items: z.infer<typeof experienceEntrySchema>[]): IUser['experience'] =>
  items.map((experience) => ({
    ...getExistingObjectId(experience._id),
    title: sanitizePlainText(experience.title),
    company: sanitizePlainText(experience.company),
    type: experience.type,
    location: sanitizePlainText(experience.location),
    startDate: experience.startDate,
    endDate: experience.isCurrent ? null : experience.endDate,
    isCurrent: experience.isCurrent,
    description: sanitizePlainText(experience.description),
    skills: normalizeStringList(experience.skills),
    source: experience.source,
    linkedinId: experience.linkedinId ? sanitizePlainText(experience.linkedinId) : null,
  })) as IUser['experience'];

const normalizeEducationEntries = (items: z.infer<typeof educationEntrySchema>[]): IUser['education'] =>
  items.map((education) => ({
    ...getExistingObjectId(education._id),
    institution: sanitizePlainText(education.institution),
    degree: sanitizePlainText(education.degree),
    fieldOfStudy: sanitizePlainText(education.fieldOfStudy),
    ...(education.startYear ? { startYear: education.startYear } : {}),
    endYear: education.isCurrent ? null : education.endYear,
    isCurrent: education.isCurrent,
    grade: sanitizePlainText(education.grade),
    activities: sanitizePlainText(education.activities),
    description: sanitizePlainText(education.description),
    source: education.source,
  })) as IUser['education'];

const normalizeCertificationEntries = (items: z.infer<typeof certificationEntrySchema>[]): IUser['certifications'] =>
  items.map((certification) => ({
    ...getExistingObjectId(certification._id),
    name: sanitizePlainText(certification.name),
    issuingOrganization: sanitizePlainText(certification.issuingOrganization),
    issueDate: certification.issueDate,
    expiryDate: certification.expiryDate,
    credentialId: sanitizePlainText(certification.credentialId),
    credentialUrl: certification.credentialUrl ?? '',
    source: certification.source,
  })) as IUser['certifications'];

const normalizePortfolioProjectEntries = (
  items: z.infer<typeof portfolioProjectEntrySchema>[],
): IUser['portfolioProjects'] =>
  items.map((project) => ({
    ...getExistingObjectId(project._id),
    title: sanitizePlainText(project.title),
    description: sanitizePlainText(project.description),
    techStack: normalizeStringList(project.techStack),
    repoUrl: project.repoUrl ?? null,
    liveUrl: project.liveUrl ?? null,
    coverImageUrl: project.coverImageUrl ?? null,
    startDate: project.startDate,
    endDate: project.isCurrent ? null : project.endDate,
    isCurrent: project.isCurrent,
    source: project.source,
    githubRepoId: project.githubRepoId ? sanitizePlainText(project.githubRepoId) : null,
    stars: project.stars,
    forks: project.forks,
    languages: normalizeStringList(project.languages),
  })) as IUser['portfolioProjects'];

const normalizePortfolioServiceEntries = (
  items: z.infer<typeof portfolioServiceEntrySchema>[],
): IUser['portfolioServices'] =>
  items.map((service) => ({
    ...getExistingObjectId(service._id),
    ...(service.icon ? { icon: sanitizePlainText(service.icon) } : {}),
    title: sanitizePlainText(service.title),
    description: sanitizePlainText(service.description),
  })) as IUser['portfolioServices'];

const normalizePortfolioTestimonialEntries = (
  items: z.infer<typeof portfolioTestimonialEntrySchema>[],
): IUser['portfolioTestimonials'] =>
  items.map((testimonial) => ({
    ...getExistingObjectId(testimonial._id),
    name: sanitizePlainText(testimonial.name),
    role: sanitizePlainText(testimonial.role),
    text: sanitizePlainText(testimonial.text),
  })) as IUser['portfolioTestimonials'];

const normalizePortfolioBlogPostEntries = (
  items: z.infer<typeof portfolioBlogPostEntrySchema>[],
): IUser['portfolioBlogPosts'] =>
  items.map((post) => ({
    ...getExistingObjectId(post._id),
    tag: sanitizePlainText(post.tag),
    title: sanitizePlainText(post.title),
    excerpt: sanitizePlainText(post.excerpt),
    tagColor: sanitizePlainText(post.tagColor) || '#7c3aed',
    url: post.url ?? null,
    publishedAt: post.publishedAt,
  })) as IUser['portfolioBlogPosts'];

const applyPortfolioContentPatch = (
  current: IUser['portfolioContent'] | undefined,
  patch: z.infer<typeof portfolioContentPatchSchema>,
): IUser['portfolioContent'] => ({
  heroEyebrow: sanitizePlainText(patch.heroEyebrow ?? current?.heroEyebrow ?? ''),
  heroTitle: sanitizePlainText(patch.heroTitle ?? current?.heroTitle ?? ''),
  heroDescription: sanitizePlainText(patch.heroDescription ?? current?.heroDescription ?? ''),
  primaryButtonLabel: sanitizePlainText(
    patch.primaryButtonLabel ?? current?.primaryButtonLabel ?? '',
  ),
  secondaryButtonLabel: sanitizePlainText(
    patch.secondaryButtonLabel ?? current?.secondaryButtonLabel ?? '',
  ),
  statOneLabel: sanitizePlainText(patch.statOneLabel ?? current?.statOneLabel ?? ''),
  statTwoLabel: sanitizePlainText(patch.statTwoLabel ?? current?.statTwoLabel ?? ''),
  statThreeLabel: sanitizePlainText(patch.statThreeLabel ?? current?.statThreeLabel ?? ''),
  statFourLabel: sanitizePlainText(patch.statFourLabel ?? current?.statFourLabel ?? ''),
  aboutTitle: sanitizePlainText(patch.aboutTitle ?? current?.aboutTitle ?? ''),
  aboutEmpty: sanitizePlainText(patch.aboutEmpty ?? current?.aboutEmpty ?? ''),
  experienceTitle: sanitizePlainText(patch.experienceTitle ?? current?.experienceTitle ?? ''),
  experienceEmpty: sanitizePlainText(patch.experienceEmpty ?? current?.experienceEmpty ?? ''),
  skillsTitle: sanitizePlainText(patch.skillsTitle ?? current?.skillsTitle ?? ''),
  skillsEmpty: sanitizePlainText(patch.skillsEmpty ?? current?.skillsEmpty ?? ''),
  projectsTitle: sanitizePlainText(patch.projectsTitle ?? current?.projectsTitle ?? ''),
  projectsEmpty: sanitizePlainText(patch.projectsEmpty ?? current?.projectsEmpty ?? ''),
  educationTitle: sanitizePlainText(patch.educationTitle ?? current?.educationTitle ?? ''),
  educationEmpty: sanitizePlainText(patch.educationEmpty ?? current?.educationEmpty ?? ''),
  certificationsTitle: sanitizePlainText(
    patch.certificationsTitle ?? current?.certificationsTitle ?? '',
  ),
  certificationsEmpty: sanitizePlainText(
    patch.certificationsEmpty ?? current?.certificationsEmpty ?? '',
  ),
  startupsTitle: sanitizePlainText(patch.startupsTitle ?? current?.startupsTitle ?? ''),
  startupsEmpty: sanitizePlainText(patch.startupsEmpty ?? current?.startupsEmpty ?? ''),
  linksTitle: sanitizePlainText(patch.linksTitle ?? current?.linksTitle ?? ''),
  linksEmpty: sanitizePlainText(patch.linksEmpty ?? current?.linksEmpty ?? ''),
  institutionDetailsTitle: sanitizePlainText(
    patch.institutionDetailsTitle ?? current?.institutionDetailsTitle ?? '',
  ),
  institutionDetailsEmpty: sanitizePlainText(
    patch.institutionDetailsEmpty ?? current?.institutionDetailsEmpty ?? '',
  ),
  institutionSpecialtiesTitle: sanitizePlainText(
    patch.institutionSpecialtiesTitle ?? current?.institutionSpecialtiesTitle ?? '',
  ),
  institutionSpecialtiesEmpty: sanitizePlainText(
    patch.institutionSpecialtiesEmpty ?? current?.institutionSpecialtiesEmpty ?? '',
  ),
  institutionLocationsTitle: sanitizePlainText(
    patch.institutionLocationsTitle ?? current?.institutionLocationsTitle ?? '',
  ),
  institutionLocationsEmpty: sanitizePlainText(
    patch.institutionLocationsEmpty ?? current?.institutionLocationsEmpty ?? '',
  ),
  institutionOutcomesTitle: sanitizePlainText(
    patch.institutionOutcomesTitle ?? current?.institutionOutcomesTitle ?? '',
  ),
  institutionOutcomesEmpty: sanitizePlainText(
    patch.institutionOutcomesEmpty ?? current?.institutionOutcomesEmpty ?? '',
  ),
  footerNote: sanitizePlainText(patch.footerNote ?? current?.footerNote ?? ''),
});

export const updateCurrentUser = async (
  userId: string,
  payload: z.infer<typeof updateMeSchema>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const wasProfileComplete = user.profileComplete;
  const previousProfilePercent = getProfileCompletionProgress(user).percent;

  if (payload.displayName !== undefined) {
    user.displayName = sanitizePlainText(payload.displayName);
  }

  if (payload.avatar !== undefined) {
    user.avatar = payload.avatar || undefined;
  }

  if (payload.avatarWallpaper !== undefined) {
    user.avatarWallpaper = payload.avatarWallpaper || undefined;
  }

  if (payload.bio !== undefined) {
    user.bio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  }

  if (payload.domain !== undefined) {
    user.domain = payload.domain ? sanitizePlainText(payload.domain) : undefined;
  }

  if (payload.headline !== undefined) {
    user.headline = payload.headline ? sanitizePlainText(payload.headline) : '';
  }

  if (payload.location !== undefined) {
    user.location = payload.location ? sanitizePlainText(payload.location) : '';
  }

  if (payload.websiteUrl !== undefined) {
    user.websiteUrl = payload.websiteUrl || null;
  }

  if (payload.githubUrl !== undefined) {
    user.githubUrl = payload.githubUrl || null;
  }

  if (payload.linkedinUrl !== undefined) {
    user.linkedinUrl = payload.linkedinUrl || null;
  }

  if (payload.twitterUrl !== undefined) {
    user.twitterUrl = payload.twitterUrl || null;
  }

  if (payload.youtubeUrl !== undefined) {
    user.youtubeUrl = payload.youtubeUrl || null;
  }

  if (payload.behanceUrl !== undefined) {
    user.behanceUrl = payload.behanceUrl || null;
  }

  if (payload.dribbbleUrl !== undefined) {
    user.dribbbleUrl = payload.dribbbleUrl || null;
  }

  if (payload.instagramUrl !== undefined) {
    user.instagramUrl = payload.instagramUrl || null;
  }

  if (payload.researchGateUrl !== undefined) {
    user.researchGateUrl = payload.researchGateUrl || null;
  }

  if (payload.mediumUrl !== undefined) {
    user.mediumUrl = payload.mediumUrl || null;
  }

  if (payload.institutionProfile !== undefined) {
    if (user.role !== UserRole.SCHOOL && user.role !== UserRole.COLLEGE) {
      throw new ApiError(
        400,
        'INSTITUTION_PROFILE_NOT_SUPPORTED',
        'Institution profile fields are only available for school and college accounts.',
      );
    }

    user.institutionProfile = applyInstitutionProfilePatch(user.institutionProfile, payload.institutionProfile);

    if (payload.institutionProfile.location !== undefined && payload.location === undefined) {
      user.location = sanitizePlainText(payload.institutionProfile.location);
    }
  }

  if (payload.skills !== undefined) {
    user.skills = normalizeSkillEntries(payload.skills);
  }

  if (payload.experience !== undefined) {
    user.experience = normalizeExperienceEntries(payload.experience);
  }

  if (payload.education !== undefined) {
    user.education = normalizeEducationEntries(payload.education);
  }

  if (payload.certifications !== undefined) {
    user.certifications = normalizeCertificationEntries(payload.certifications);
  }

  if (payload.portfolioProjects !== undefined) {
    user.portfolioProjects = normalizePortfolioProjectEntries(payload.portfolioProjects);
  }

  if (payload.portfolioServices !== undefined) {
    user.portfolioServices = normalizePortfolioServiceEntries(payload.portfolioServices);
  }

  if (payload.portfolioTestimonials !== undefined) {
    user.portfolioTestimonials = normalizePortfolioTestimonialEntries(payload.portfolioTestimonials);
  }

  if (payload.portfolioBlogPosts !== undefined) {
    user.portfolioBlogPosts = normalizePortfolioBlogPostEntries(payload.portfolioBlogPosts);
  }

  if (payload.portfolioContent !== undefined) {
    user.portfolioContent = applyPortfolioContentPatch(user.portfolioContent, payload.portfolioContent);
  }

  if (payload.discoverableToRecruiters !== undefined) {
    user.discoverableToRecruiters = payload.discoverableToRecruiters;
  }

  await syncInstitutionEducationForUser(user);
  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);

  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'profile_update');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  return {
    ...toSanitizedUser(user.toObject() as UserLike),
    education: user.education ?? [],
  };
};

const buildStudentPortfolioProfile = async (student: IUser): Promise<PublicStudentProfile> => {
  const institution = student.institutionId
    ? await User.findById(student.institutionId).select('_id displayName').lean()
    : null;
  const education = await resolveEducationEntriesForUser({
    role: student.role,
    institutionId: student.institutionId,
    email: student.email,
    education: student.education,
  });

  return {
    _id: String(student._id),
    displayName: student.displayName,
    ...(student.avatar ? { avatar: student.avatar } : {}),
    ...(student.avatarWallpaper ? { avatarWallpaper: student.avatarWallpaper } : {}),
    ...(student.bio ? { bio: student.bio } : {}),
    headline: student.headline ?? '',
    location: student.location ?? '',
    websiteUrl: student.websiteUrl ?? null,
    githubUrl: student.githubUrl ?? null,
    linkedinUrl: student.linkedinUrl ?? null,
    twitterUrl: student.twitterUrl ?? null,
    youtubeUrl: student.youtubeUrl ?? null,
    behanceUrl: student.behanceUrl ?? null,
    dribbbleUrl: student.dribbbleUrl ?? null,
    instagramUrl: student.instagramUrl ?? null,
    researchGateUrl: student.researchGateUrl ?? null,
    mediumUrl: student.mediumUrl ?? null,
    profileSlug: student.profileSlug ?? '',
    ...(student.domain ? { domain: student.domain } : {}),
    innovationScore: normalizeInnovationScore(student.innovationScore),
    institutionVerifiedAt: student.institutionVerifiedAt ?? null,
    ...(student.verifiedAt ? { verifiedAt: student.verifiedAt } : {}),
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    skills: student.skills ?? [],
    experience: student.experience ?? [],
    education,
    certifications: student.certifications ?? [],
    portfolioProjects: student.portfolioProjects ?? [],
    portfolioServices: student.portfolioServices ?? [],
    portfolioTestimonials: student.portfolioTestimonials ?? [],
    portfolioBlogPosts: student.portfolioBlogPosts ?? [],
    ...(student.portfolioContent ? { portfolioContent: student.portfolioContent } : {}),
    githubStats: student.githubStats ?? {
      totalRepos: 0,
      totalStars: 0,
      totalForks: 0,
      topLanguages: [],
      contributionsLastYear: 0,
      lastSyncedAt: null,
    },
    githubProof: {
      importedRepos: (student.githubProof?.importedRepos ?? []).filter((repo) => !repo.isPrivate),
      recentActivity: (student.githubProof?.recentActivity ?? []).filter((activity) => !activity.isPrivate),
      commitCount30Days: student.githubProof?.commitCount30Days ?? 0,
      activeDays30Days: student.githubProof?.activeDays30Days ?? 0,
      pushEvents30Days: student.githubProof?.pushEvents30Days ?? 0,
      pullRequests30Days: student.githubProof?.pullRequests30Days ?? 0,
      issues30Days: student.githubProof?.issues30Days ?? 0,
      lastSyncedAt: student.githubProof?.lastSyncedAt ?? null,
    },
    institution: institution
      ? {
          _id: String(institution._id),
          displayName: institution.displayName,
        }
      : null,
  };
};

export const getPublicStudentProfileBySlug = async (profileSlug: string): Promise<PublicStudentProfile> => {
  const student = await User.findOne({
    profileSlug,
    role: UserRole.STUDENT,
    isActive: true,
    isProfilePublic: true,
    profileComplete: true,
    verificationStatus: 'verified',
  }).lean<IUser>();

  if (!student) {
    throw new ApiError(404, 'PUBLIC_PROFILE_NOT_FOUND', 'Public student profile not found');
  }

  return buildStudentPortfolioProfile(student);
};

export const getStudentPortfolioForViewer = async (
  requesterId: string,
  requesterRole: UserRole,
  studentId: string,
): Promise<PublicStudentProfile> => {
  if (!Types.ObjectId.isValid(studentId)) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  }).lean<IUser>();

  if (!student) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const studentObjectId = new Types.ObjectId(studentId);

  switch (requesterRole) {
    case UserRole.ADMIN:
      break;
    case UserRole.STUDENT:
      break;
    case UserRole.SCHOOL:
    case UserRole.COLLEGE:
      if (!student.institutionId || String(student.institutionId) !== requesterId) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
      }
      break;
    case UserRole.MENTOR: {
      const hasAssignment = await Workspace.exists({
        isActive: true,
        chatParticipants: {
          $elemMatch: {
            userId: new Types.ObjectId(requesterId),
            role: 'mentor',
          },
        },
        $or: [{ ownerId: studentObjectId }, { teamMemberIds: studentObjectId }],
      });

      if (!hasAssignment) {
        throw new ApiError(403, 'MENTOR_ASSIGNMENT_REQUIRED', 'This student is not assigned to you');
      }
      break;
    }
    case UserRole.RECRUITER:
      if (!student.discoverableToRecruiters) {
        throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
      }
      break;
    default:
      if (!(ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(UserRole.STUDENT)) {
        throw new ApiError(403, 'CONNECTION_FORBIDDEN', 'Your role cannot connect with student');
      }
      break;
  }

  return buildStudentPortfolioProfile(student);
};
