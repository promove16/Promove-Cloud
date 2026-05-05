import { Types } from 'mongoose';
import { ALLOWED_CONNECTIONS } from '../../middleware/connectionGuard';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { JobPost, type IJobApplicationRecord, type IJobPost } from '../recruiter/jobPost.model';
import { mapJob } from '../recruiter/recruiter.mappers';
import { Startup } from '../startup/startup.model';
import { Workspace } from '../workspace/workspace.model';
import { extractS3KeyFromUrl, generatePresignedUrl } from '../../services/fileStorageService';
import { generateSignedCloudinaryUrl } from '../../services/cloudinaryService';

type PublicLinkSet = {
  websiteUrl?: string;
  githubUrl?: string;
  linkedinUrl?: string;
};

type PublicSkill = {
  name: string;
  level: string;
};

type PublicExperienceHighlight = {
  title: string;
  company: string;
  type: string;
  location?: string;
  startDate?: Date;
  endDate?: Date | null;
  isCurrent: boolean;
  skills: string[];
  description?: string;
};

type PublicEducationHighlight = {
  institution: string;
  degree?: string;
  fieldOfStudy?: string;
  startYear?: number;
  endYear?: number | null;
  isCurrent: boolean;
  grade?: string;
};

type PublicPortfolioHighlight = {
  title: string;
  description?: string;
  techStack: string[];
  repoUrl?: string | null;
  liveUrl?: string | null;
  stars: number;
  forks: number;
  languages: string[];
};

type PublicGithubStats = {
  totalRepos: number;
  totalStars: number;
  totalForks: number;
  contributionsLastYear: number;
  topLanguages: Array<{
    language: string;
    percentage: number;
  }>;
  lastSyncedAt?: Date | null;
};

type PublicUser = {
  _id: { toString(): string };
  displayName: string;
  avatar?: string;
  role: UserRole;
  domain?: string;
  bio?: string;
  headline?: string;
  location?: string;
  websiteUrl?: string | null;
  githubUrl?: string | null;
  linkedinUrl?: string | null;
  skills?: PublicSkill[];
  experience?: PublicExperienceHighlight[];
  education?: PublicEducationHighlight[];
  portfolioProjects?: PublicPortfolioHighlight[];
  githubStats?: PublicGithubStats;
  institutionProfile?: {
    institutionName: string;
    location: string;
    totalStudentsEnrolled: number;
    academicYear: string;
    iicStarRating: number;
    organizationType?: string;
    foundedYear?: number;
    specialties?: string[];
    locations?: string[];
    alumniCount?: number;
    employeeCount?: number;
    contactEmail?: string;
    contactPhone?: string;
    stats?: {
      totalInnovationActivities: number;
      patentsFiled: number;
      totalMentoringHours: number;
      startupsLaunched: number;
      industryCollaborations: number;
      totalHRConnections?: number;
      studentsPlaced?: number;
      directShortlistsThisQuarter?: number;
      topHiringSector?: string;
    };
  };
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
};

type PublicStartup = {
  _id: Types.ObjectId;
  founderIds: Types.ObjectId[];
  teamMemberIds: Types.ObjectId[];
  projectId?: Types.ObjectId;
  name: string;
  tagline: string;
  category: string;
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  pitchDeckUrl?: string;
  pitchDeckStorageProvider?: 'cloudinary' | 's3';
  pitchDeckStorageKey?: string;
  teamSize: number;
  fundingNeeded?: number;
  activeProducts: number;
  businessProfile?: {
    problemStatement?: string;
    solutionSummary?: string;
    targetCustomers?: string;
    marketAnalysis?: string;
    revenueModel?: string;
    goToMarketPlan?: string;
  };
  initializationProfile?: {
    vision?: string;
    mission?: string;
    productStage?: string;
    productOverview?: string;
    customerProfile?: string;
    marketOpportunity?: string;
    businessModel?: string;
    currentTraction?: string;
    upcomingMilestones?: string;
    fundingAsk?: string;
  };
  launchedToInvestors: boolean;
  launchedToMentors: boolean;
  launchedToRecruiters: boolean;
  launchedAt?: Date;
  innovationScoreAtLaunch: number;
  totalShares: number;
  availableShares: number;
  reservedForSole: number;
  maxPennyInvestors: number;
  currentPennyCount: number;
  hasSoleInvestor: boolean;
  traction: {
    patentFiled: boolean;
    mvpBuilt: boolean;
    revenueGenerating: boolean;
    usersCount?: number;
  };
  innovationProfile?: {
    companyProfile?: {
      legalStructure?: string;
      cinNumber?: string;
      dpiitRecognitionNumber?: string;
      msmeUdyamNumber?: string;
      otherGovernmentCertificationName?: string;
      otherGovernmentCertificationNumber?: string;
      websiteUrl?: string;
      productDemoUrl?: string;
      portfolioUrl?: string;
    };
    tractionProfile?: {
      startupStage?: 'idea' | 'mvp_ready' | 'market_ready' | 'revenue_generating';
      problemClarity?: string;
      uniqueSolution?: string;
      marketDifferentiation?: string;
      patentStatus?: 'none' | 'filed' | 'published';
      hasItrFiling?: boolean;
      hasRevenueProof?: boolean;
      hasGovernmentGrant?: boolean;
      hasAwardRecognition?: boolean;
      fundingStatus?: 'none' | 'bootstrapped' | 'angel_seed' | 'vc';
    };
  };
  documents?: Array<{
    category: string;
  }>;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type StartupTrustProfile = {
  signals: string[];
  proofCount: number;
  hasWebsite: boolean;
  hasProductDemo: boolean;
  hasPortfolio: boolean;
  legalStructure?: string;
  fundingStatus?: string;
};

type MarketplaceFounder = {
  _id: Types.ObjectId;
  displayName: string;
  avatar?: string;
  headline?: string;
  domain?: string;
  location?: string;
  bio?: string;
  innovationScore: number;
};

type MarketplaceWorkspace = {
  _id: Types.ObjectId;
  title: string;
  category: string;
  stage: string;
  progressPercent: number;
  updatedAt: Date;
  milestones: Array<{
    isCompleted: boolean;
  }>;
  tasks: Array<{
    done: boolean;
  }>;
  uploads: Array<unknown>;
  repoSubmissions: Array<unknown>;
  progressUpdates: Array<{
    note: string;
    submittedAt: Date;
  }>;
};

type MarketplaceUserRelatedCounts = {
  jobs: number;
  startups: number;
};

export type MarketplaceEntityType =
  | UserRole.STUDENT
  | UserRole.SCHOOL
  | UserRole.COLLEGE
  | UserRole.MENTOR
  | UserRole.INVESTOR
  | UserRole.RECRUITER
  | 'startup';

const MARKETPLACE_USER_ROLES = new Set<MarketplaceEntityType>([
  UserRole.STUDENT,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);

const compactString = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
};

const STARTUP_PROOF_DOCUMENT_CATEGORIES = new Set([
  'incorporation_certificate',
  'startup_india_certificate',
  'dpiit_certificate',
  'udyam_certificate',
  'government_certificate_other',
  'business_plan',
  'dpr',
  'patent_proof',
  'itr_filing',
  'revenue_proof',
  'grant_certificate',
  'award_certificate',
  'funding_proof',
]);

const STARTUP_LEGAL_STRUCTURE_LABELS: Record<string, string> = {
  sole_proprietorship: 'Sole Proprietorship',
  partnership: 'Partnership',
  llp: 'LLP',
  private_limited: 'Pvt Ltd',
  opc: 'OPC',
  public_limited: 'Public Ltd',
};

const STARTUP_FUNDING_STATUS_LABELS: Record<string, string> = {
  bootstrapped: 'Bootstrapped',
  angel_seed: 'Angel / Seed',
  vc: 'VC Funded',
};

const uniqueStrings = (values: Array<string | undefined>) =>
  Array.from(new Set(values.filter((value): value is string => Boolean(value))));

const mapTextSection = (value?: string | null) => compactString(value);

const mapStartupPublicDetails = (startup: PublicStartup) => {
  const businessProfile = startup.businessProfile ?? {};
  const initializationProfile = startup.initializationProfile ?? {};
  const companyProfile = startup.innovationProfile?.companyProfile ?? {};
  const tractionProfile = startup.innovationProfile?.tractionProfile ?? {};
  const publicLinks = {
    ...(compactString(companyProfile.websiteUrl) ? { websiteUrl: compactString(companyProfile.websiteUrl) } : {}),
    ...(compactString(companyProfile.productDemoUrl) ? { productDemoUrl: compactString(companyProfile.productDemoUrl) } : {}),
    ...(compactString(companyProfile.portfolioUrl) ? { portfolioUrl: compactString(companyProfile.portfolioUrl) } : {}),
  };

  const details = {
    business: {
      ...(mapTextSection(businessProfile.problemStatement) ? { problemStatement: mapTextSection(businessProfile.problemStatement) } : {}),
      ...(mapTextSection(businessProfile.solutionSummary) ? { solutionSummary: mapTextSection(businessProfile.solutionSummary) } : {}),
      ...(mapTextSection(businessProfile.targetCustomers) ? { targetCustomers: mapTextSection(businessProfile.targetCustomers) } : {}),
      ...(mapTextSection(businessProfile.marketAnalysis) ? { marketAnalysis: mapTextSection(businessProfile.marketAnalysis) } : {}),
      ...(mapTextSection(businessProfile.revenueModel) ? { revenueModel: mapTextSection(businessProfile.revenueModel) } : {}),
      ...(mapTextSection(businessProfile.goToMarketPlan) ? { goToMarketPlan: mapTextSection(businessProfile.goToMarketPlan) } : {}),
    },
    launch: {
      ...(mapTextSection(initializationProfile.vision) ? { vision: mapTextSection(initializationProfile.vision) } : {}),
      ...(mapTextSection(initializationProfile.mission) ? { mission: mapTextSection(initializationProfile.mission) } : {}),
      ...(mapTextSection(initializationProfile.productStage) ? { productStage: mapTextSection(initializationProfile.productStage) } : {}),
      ...(mapTextSection(initializationProfile.productOverview) ? { productOverview: mapTextSection(initializationProfile.productOverview) } : {}),
      ...(mapTextSection(initializationProfile.customerProfile) ? { customerProfile: mapTextSection(initializationProfile.customerProfile) } : {}),
      ...(mapTextSection(initializationProfile.marketOpportunity) ? { marketOpportunity: mapTextSection(initializationProfile.marketOpportunity) } : {}),
      ...(mapTextSection(initializationProfile.businessModel) ? { businessModel: mapTextSection(initializationProfile.businessModel) } : {}),
      ...(mapTextSection(initializationProfile.currentTraction) ? { currentTraction: mapTextSection(initializationProfile.currentTraction) } : {}),
      ...(mapTextSection(initializationProfile.upcomingMilestones) ? { upcomingMilestones: mapTextSection(initializationProfile.upcomingMilestones) } : {}),
      ...(mapTextSection(initializationProfile.fundingAsk) ? { fundingAsk: mapTextSection(initializationProfile.fundingAsk) } : {}),
    },
    innovation: {
      ...(mapTextSection(tractionProfile.startupStage) ? { startupStage: mapTextSection(tractionProfile.startupStage) } : {}),
      ...(mapTextSection(tractionProfile.problemClarity) ? { problemClarity: mapTextSection(tractionProfile.problemClarity) } : {}),
      ...(mapTextSection(tractionProfile.uniqueSolution) ? { uniqueSolution: mapTextSection(tractionProfile.uniqueSolution) } : {}),
      ...(mapTextSection(tractionProfile.marketDifferentiation) ? { marketDifferentiation: mapTextSection(tractionProfile.marketDifferentiation) } : {}),
      ...(mapTextSection(tractionProfile.patentStatus) ? { patentStatus: mapTextSection(tractionProfile.patentStatus) } : {}),
      ...(mapTextSection(tractionProfile.fundingStatus) ? { fundingStatus: mapTextSection(tractionProfile.fundingStatus) } : {}),
      hasItrFiling: Boolean(tractionProfile.hasItrFiling || hasStartupDocument(startup, 'itr_filing')),
      hasRevenueProof: Boolean(tractionProfile.hasRevenueProof || hasStartupDocument(startup, 'revenue_proof')),
      hasGovernmentGrant: Boolean(tractionProfile.hasGovernmentGrant || hasStartupDocument(startup, 'grant_certificate')),
      hasAwardRecognition: Boolean(tractionProfile.hasAwardRecognition || hasStartupDocument(startup, 'award_certificate')),
    },
    ...(Object.keys(publicLinks).length > 0 ? { publicLinks } : {}),
  };

  return {
    ...(Object.keys(details.business).length > 0 ? { business: details.business } : {}),
    ...(Object.keys(details.launch).length > 0 ? { launch: details.launch } : {}),
    ...(Object.keys(details.innovation).length > 0 ? { innovation: details.innovation } : {}),
    ...(details.publicLinks ? { publicLinks: details.publicLinks } : {}),
  };
};

const hasStartupDocument = (startup: PublicStartup, ...categories: string[]) => {
  const uploaded = new Set((startup.documents ?? []).map((document) => document.category));
  return categories.some((category) => uploaded.has(category));
};

const countStartupProofs = (startup: PublicStartup) => {
  const uploaded = new Set((startup.documents ?? []).map((document) => document.category));
  const proofDocuments = Array.from(uploaded).filter((category) =>
    STARTUP_PROOF_DOCUMENT_CATEGORIES.has(category),
  ).length;

  return proofDocuments + (startup.pitchDeckUrl ? 1 : 0);
};

const buildStartupTrustProfile = (startup: PublicStartup): StartupTrustProfile => {
  const companyProfile = startup.innovationProfile?.companyProfile;
  const tractionProfile = startup.innovationProfile?.tractionProfile;
  const legalStructure = companyProfile?.legalStructure;
  const legalStructureLabel =
    legalStructure && legalStructure !== 'not_registered'
      ? STARTUP_LEGAL_STRUCTURE_LABELS[legalStructure] ?? legalStructure
      : undefined;
  const fundingStatus = tractionProfile?.fundingStatus;
  const fundingStatusLabel =
    fundingStatus && fundingStatus !== 'none'
      ? STARTUP_FUNDING_STATUS_LABELS[fundingStatus] ?? fundingStatus
      : undefined;
  const hasWebsite = Boolean(compactString(companyProfile?.websiteUrl));
  const hasProductDemo = Boolean(compactString(companyProfile?.productDemoUrl));
  const hasPortfolio = Boolean(compactString(companyProfile?.portfolioUrl));
  const patentStatus = tractionProfile?.patentStatus;

  return {
    signals: uniqueStrings([
      legalStructureLabel ? 'Registered Entity' : undefined,
      compactString(companyProfile?.cinNumber) ? 'CIN Listed' : undefined,
      compactString(companyProfile?.dpiitRecognitionNumber) ||
      hasStartupDocument(startup, 'startup_india_certificate', 'dpiit_certificate')
        ? 'DPIIT Recognized'
        : undefined,
      compactString(companyProfile?.msmeUdyamNumber) || hasStartupDocument(startup, 'udyam_certificate')
        ? 'Udyam Registered'
        : undefined,
      compactString(companyProfile?.otherGovernmentCertificationName) ||
      compactString(companyProfile?.otherGovernmentCertificationNumber) ||
      hasStartupDocument(startup, 'government_certificate_other')
        ? 'Govt Certified'
        : undefined,
      startup.pitchDeckUrl ? 'Pitch Deck Ready' : undefined,
      hasStartupDocument(startup, 'business_plan', 'dpr') ? 'DPR Ready' : undefined,
      hasWebsite ? 'Website Live' : undefined,
      hasProductDemo ? 'Demo Available' : undefined,
      hasPortfolio ? 'Portfolio Linked' : undefined,
      patentStatus === 'published'
        ? 'Patent Published'
        : patentStatus === 'filed' || startup.traction?.patentFiled
          ? 'Patent Filed'
          : undefined,
      tractionProfile?.hasItrFiling || hasStartupDocument(startup, 'itr_filing') ? 'ITR Filed' : undefined,
      tractionProfile?.hasRevenueProof || hasStartupDocument(startup, 'revenue_proof')
        ? 'Revenue Verified'
        : undefined,
      tractionProfile?.hasGovernmentGrant || hasStartupDocument(startup, 'grant_certificate')
        ? 'Grant Backed'
        : undefined,
      tractionProfile?.hasAwardRecognition || hasStartupDocument(startup, 'award_certificate')
        ? 'Award Recognized'
        : undefined,
      fundingStatus === 'bootstrapped'
        ? 'Bootstrapped'
        : fundingStatus === 'angel_seed'
          ? 'Angel Backed'
          : fundingStatus === 'vc'
            ? 'VC Funded'
            : undefined,
      hasStartupDocument(startup, 'funding_proof') ? 'Funding Verified' : undefined,
    ]),
    proofCount: countStartupProofs(startup),
    hasWebsite,
    hasProductDemo,
    hasPortfolio,
    ...(legalStructureLabel ? { legalStructure: legalStructureLabel } : {}),
    ...(fundingStatusLabel ? { fundingStatus: fundingStatusLabel } : {}),
  };
};

type PublicUserMapOptions = {
  skillLimit?: number;
  experienceLimit?: number;
  educationLimit?: number;
  portfolioLimit?: number;
};

const sliceWithOptionalLimit = <T>(items: T[] | undefined, limit?: number) => {
  const source = items ?? [];
  return typeof limit === 'number' ? source.slice(0, limit) : source;
};

const MARKETPLACE_CARD_LIMITS: Required<PublicUserMapOptions> = {
  skillLimit: 8,
  experienceLimit: 3,
  educationLimit: 2,
  portfolioLimit: 3,
};

const MARKETPLACE_DETAIL_LIMITS: PublicUserMapOptions = {
  skillLimit: 16,
  experienceLimit: 12,
  educationLimit: 8,
  portfolioLimit: 12,
};

const isAppliedStage = (stage?: IJobApplicationRecord['stage']) =>
  Boolean(stage && !['Invited Pending', 'Invite Declined'].includes(stage));

const getStudentHasAppliedToJob = (
  job: Pick<IJobPost, 'applicantIds' | 'applicationRecords'>,
  studentId?: string,
) => {
  if (!studentId) {
    return undefined;
  }

  const applicationRecord = (job.applicationRecords ?? []).find(
    (record) => String(record.studentId) === studentId,
  );

  if (applicationRecord) {
    return isAppliedStage(applicationRecord.stage);
  }

  return (job.applicantIds ?? []).some((applicantId) => String(applicantId) === studentId);
};

const mapLinkSet = (user: PublicUser): PublicLinkSet | undefined => {
  const links = {
    ...(compactString(user.websiteUrl) ? { websiteUrl: compactString(user.websiteUrl) } : {}),
    ...(compactString(user.githubUrl) ? { githubUrl: compactString(user.githubUrl) } : {}),
    ...(compactString(user.linkedinUrl) ? { linkedinUrl: compactString(user.linkedinUrl) } : {}),
  };

  return Object.keys(links).length > 0 ? links : undefined;
};

const mapGithubStats = (githubStats?: PublicGithubStats) => {
  if (!githubStats) {
    return undefined;
  }

  const hasMeaningfulStats =
    githubStats.totalRepos > 0 ||
    githubStats.totalStars > 0 ||
    githubStats.totalForks > 0 ||
    githubStats.contributionsLastYear > 0 ||
    githubStats.topLanguages.length > 0;

  if (!hasMeaningfulStats) {
    return undefined;
  }

  return githubStats;
};

const mapPublicUser = (user: PublicUser, options: PublicUserMapOptions = MARKETPLACE_CARD_LIMITS) => ({
  _id: user._id.toString(),
  displayName: user.displayName,
  ...(user.avatar ? { avatar: user.avatar } : {}),
  role: user.role,
  ...(compactString(user.domain) ? { domain: compactString(user.domain) } : {}),
  ...(compactString(user.bio) ? { bio: compactString(user.bio) } : {}),
  ...(compactString(user.headline) ? { headline: compactString(user.headline) } : {}),
  ...(compactString(user.location) ? { location: compactString(user.location) } : {}),
  ...(mapLinkSet(user) ? { links: mapLinkSet(user) } : {}),
  ...(user.skills && user.skills.length > 0
    ? {
        skills: sliceWithOptionalLimit(user.skills, options.skillLimit)
          .filter((skill) => compactString(skill.name))
          .map((skill) => ({
            name: skill.name.trim(),
            level: skill.level,
          })),
      }
    : {}),
  ...(user.experience && user.experience.length > 0
    ? {
        experienceHighlights: sliceWithOptionalLimit(user.experience, options.experienceLimit).map((item) => ({
          title: item.title,
          company: item.company,
          type: item.type,
          ...(compactString(item.location) ? { location: compactString(item.location) } : {}),
          ...(item.startDate ? { startDate: item.startDate } : {}),
          ...(item.endDate !== undefined ? { endDate: item.endDate } : {}),
          isCurrent: item.isCurrent,
          skills: item.skills.slice(0, 4),
          ...(compactString(item.description) ? { description: compactString(item.description) } : {}),
        })),
      }
    : {}),
  ...(user.education && user.education.length > 0
    ? {
        educationHighlights: sliceWithOptionalLimit(user.education, options.educationLimit).map((item) => ({
          institution: item.institution,
          ...(compactString(item.degree) ? { degree: compactString(item.degree) } : {}),
          ...(compactString(item.fieldOfStudy) ? { fieldOfStudy: compactString(item.fieldOfStudy) } : {}),
          ...(item.startYear ? { startYear: item.startYear } : {}),
          ...(item.endYear !== undefined ? { endYear: item.endYear } : {}),
          isCurrent: item.isCurrent,
          ...(compactString(item.grade) ? { grade: compactString(item.grade) } : {}),
        })),
      }
    : {}),
  ...(user.portfolioProjects && user.portfolioProjects.length > 0
    ? {
        portfolioHighlights: sliceWithOptionalLimit(user.portfolioProjects, options.portfolioLimit).map((project) => ({
          title: project.title,
          ...(compactString(project.description) ? { description: compactString(project.description) } : {}),
          techStack: project.techStack.slice(0, 6),
          ...(compactString(project.repoUrl) ? { repoUrl: compactString(project.repoUrl) } : {}),
          ...(compactString(project.liveUrl) ? { liveUrl: compactString(project.liveUrl) } : {}),
          stars: project.stars,
          forks: project.forks,
          languages: project.languages.slice(0, 4),
        })),
      }
    : {}),
  ...(mapGithubStats(user.githubStats) ? { githubStats: mapGithubStats(user.githubStats) } : {}),
  ...(user.institutionProfile
    ? {
        institutionProfile: {
          institutionName: user.institutionProfile.institutionName,
          location: user.institutionProfile.location,
          totalStudentsEnrolled: user.institutionProfile.totalStudentsEnrolled,
          academicYear: user.institutionProfile.academicYear,
          iicStarRating: user.institutionProfile.iicStarRating,
          ...(user.institutionProfile.organizationType
            ? { organizationType: user.institutionProfile.organizationType }
            : {}),
          ...(user.institutionProfile.foundedYear ? { foundedYear: user.institutionProfile.foundedYear } : {}),
          specialties: user.institutionProfile.specialties ?? [],
          locations: user.institutionProfile.locations ?? [],
          ...(typeof user.institutionProfile.alumniCount === 'number'
            ? { alumniCount: user.institutionProfile.alumniCount }
            : {}),
          ...(typeof user.institutionProfile.employeeCount === 'number'
            ? { employeeCount: user.institutionProfile.employeeCount }
            : {}),
          ...(user.institutionProfile.contactEmail
            ? { contactEmail: user.institutionProfile.contactEmail }
            : {}),
          ...(user.institutionProfile.contactPhone
            ? { contactPhone: user.institutionProfile.contactPhone }
            : {}),
          ...(user.institutionProfile.stats ? { stats: user.institutionProfile.stats } : {}),
        },
      }
    : {}),
  insightCounts: {
    skills: user.skills?.length ?? 0,
    experience: user.experience?.length ?? 0,
    education: user.education?.length ?? 0,
    portfolioProjects: user.portfolioProjects?.length ?? 0,
  },
});

const toStartupVisibility = (startup: PublicStartup) =>
  [
    startup.launchedToMentors ? 'Mentors' : null,
    startup.launchedToInvestors ? 'Investors' : null,
    startup.launchedToRecruiters ? 'Recruiters' : null,
  ].filter((entry): entry is string => Boolean(entry));

const mapFounder = (founder: MarketplaceFounder) => ({
  _id: String(founder._id),
  displayName: founder.displayName || 'Team Member',
  ...(founder.avatar ? { avatar: founder.avatar } : {}),
  innovationScore: founder.innovationScore ?? 0,
  ...(compactString(founder.headline) ? { headline: compactString(founder.headline) } : {}),
  ...(compactString(founder.domain) ? { domain: compactString(founder.domain) } : {}),
  ...(compactString(founder.location) ? { location: compactString(founder.location) } : {}),
  ...(compactString(founder.bio) ? { bio: compactString(founder.bio) } : {}),
});

const mapWorkspace = (
  requesterRole: UserRole,
  workspace?: MarketplaceWorkspace | null,
) => {
  if (!workspace) {
    return undefined;
  }

  const lastUpdate = workspace.progressUpdates
    .slice()
    .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())[0];

  const baseWorkspaceView = {
    _id: String(workspace._id),
    title: workspace.title,
    category: workspace.category,
    stage: workspace.stage,
    progressPercent: workspace.progressPercent ?? 0,
    updatedAt: workspace.updatedAt.toISOString(),
    completedMilestones: workspace.milestones.filter((milestone) => milestone.isCompleted).length,
    totalMilestones: workspace.milestones.length,
    openTasks: workspace.tasks.filter((task) => !task.done).length,
    ...(lastUpdate
      ? {
          lastUpdate: {
            note: lastUpdate.note,
            submittedAt: lastUpdate.submittedAt.toISOString(),
          },
        }
      : {}),
  };

  if (requesterRole === UserRole.RECRUITER) {
    return undefined;
  }

  if (requesterRole === UserRole.MENTOR) {
    return baseWorkspaceView;
  }

  return {
    ...baseWorkspaceView,
    assetCount: workspace.uploads.length,
    repoCount: workspace.repoSubmissions.length,
  };
};

const getStartupVisibilityClauses = (requesterRole: UserRole) => {
  if (requesterRole === UserRole.INVESTOR) {
    return [{ launchedToInvestors: true }];
  }

  if (requesterRole === UserRole.MENTOR) {
    return [{ launchedToMentors: true }];
  }

  if (requesterRole === UserRole.RECRUITER) {
    return [{ launchedToRecruiters: true }];
  }

  return [
    { launchedToInvestors: true },
    { launchedToMentors: true },
    { launchedToRecruiters: true },
  ];
};

const buildStartupVisibilityQuery = (requesterRole: UserRole, search?: string) => ({
  isActive: true,
  reviewStatus: 'approved',
  $and: [
    {
      $or: getStartupVisibilityClauses(requesterRole),
    },
    ...(search
      ? [
          {
            $or: [
              { name: new RegExp(search, 'i') },
              { tagline: new RegExp(search, 'i') },
              { category: new RegExp(search, 'i') },
            ],
          },
        ]
      : []),
  ],
});

const getSignedPitchDeckUrl = async (startup: PublicStartup) => {
  if (!startup.pitchDeckUrl) {
    return undefined;
  }

  try {
    if (startup.pitchDeckStorageProvider === 'cloudinary') {
      const storageKey = startup.pitchDeckStorageKey || extractCloudinaryPublicId(startup.pitchDeckUrl);
      return storageKey ? generateSignedCloudinaryUrl(storageKey, 'raw') : startup.pitchDeckUrl;
    }

    const s3Key =
      startup.pitchDeckStorageProvider === 's3'
        ? startup.pitchDeckStorageKey || extractS3KeyFromUrl(startup.pitchDeckUrl)
        : extractS3KeyFromUrl(startup.pitchDeckUrl);

    return s3Key ? await generatePresignedUrl(s3Key) : startup.pitchDeckUrl;
  } catch (error) {
    console.error('Error generating signed pitch deck URL for marketplace startup:', error);
    return startup.pitchDeckUrl;
  }
};

const extractCloudinaryPublicId = (url: string): string | null => {
  if (!url || !url.includes('cloudinary.com')) return null;
  const match = url.match(/upload\/v\d+\/(.+)$/);
  return match ? match[1].replace(/\.[^.]+$/, '') : null;
};

const buildStartupView = async (
  requesterRole: UserRole,
  startup: PublicStartup,
  founders: MarketplaceFounder[],
  workspace?: MarketplaceWorkspace | null,
) => {
  const project = mapWorkspace(requesterRole, workspace);
  const pitchDeckUrl = await getSignedPitchDeckUrl(startup);
  const publicDetails = mapStartupPublicDetails(startup);

  return {
    _id: String(startup._id),
    entityType: 'startup' as const,
    name: startup.name,
    tagline: startup.tagline,
    category: startup.category,
    stage: startup.stage,
    ...(pitchDeckUrl ? { pitchDeckUrl } : {}),
    teamSize: startup.teamSize || startup.founderIds.length,
    activeProducts: startup.activeProducts,
    innovationScoreAtLaunch: startup.innovationScoreAtLaunch,
    ...(typeof startup.fundingNeeded === 'number' ? { fundingNeeded: startup.fundingNeeded } : {}),
    ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
    traction: {
      patentFiled: startup.traction?.patentFiled ?? false,
      mvpBuilt: startup.traction?.mvpBuilt ?? false,
      revenueGenerating: startup.traction?.revenueGenerating ?? false,
      ...(typeof startup.traction?.usersCount === 'number' ? { usersCount: startup.traction.usersCount } : {}),
    },
    launchTargets: toStartupVisibility(startup),
    trustProfile: buildStartupTrustProfile(startup),
    ...(Object.keys(publicDetails).length > 0 ? { publicDetails } : {}),
    founders: founders.map(mapFounder),
    ...(founders[0] ? { primaryFounderId: String(founders[0]._id) } : {}),
    ...(project ? { project } : {}),
  };
};

const attachUserCardMetadata = (
  user: PublicUser,
  relatedCounts: MarketplaceUserRelatedCounts,
  options?: PublicUserMapOptions,
) => ({
  entityType: user.role as Extract<MarketplaceEntityType, UserRole>,
  ...mapPublicUser(user, options),
  relatedCounts,
});

const applyMarketplaceUserVisibility = (
  requesterRole: UserRole,
  targetRole: MarketplaceEntityType,
  query: Record<string, unknown>,
) => {
  if (requesterRole === UserRole.RECRUITER && targetRole === UserRole.STUDENT) {
    query.discoverableToRecruiters = true;
  }

  return query;
};

const canBrowseMarketplaceRole = (
  requesterRole: UserRole,
  targetRole: UserRole,
) =>
  (requesterRole === UserRole.STUDENT && targetRole === UserRole.STUDENT) ||
  (ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(targetRole);

export const listMarketplaceUsers = async (
  requesterRole: UserRole,
  role: MarketplaceEntityType,
  domain?: string,
  page = 1,
  limit = 20,
) => {
  if (role === 'startup') {
    return listMarketplaceStartups(requesterRole, domain, page, limit);
  }

  if (!MARKETPLACE_USER_ROLES.has(role)) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
  }

  if (!canBrowseMarketplaceRole(requesterRole, role as UserRole)) {
    throw new ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${role}`);
  }

  const users = await User.find(
    applyMarketplaceUserVisibility(requesterRole, role, {
      role,
      isActive: true,
      ...(domain ? { domain: new RegExp(domain, 'i') } : {}),
    }),
  )
    .select(
      'displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats institutionProfile lastLogin discoverableToRecruiters',
    )
    .sort({ lastLogin: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  const userIds = users.map((user) => user._id);
  const [jobCounts, startupCounts]: [
    Array<{ _id: Types.ObjectId; total: number }>,
    Array<{ _id: Types.ObjectId; total: number }>,
  ] = await Promise.all([
    role === UserRole.RECRUITER
      ? JobPost.aggregate<{ _id: Types.ObjectId; total: number }>([
          { $match: { recruiterId: { $in: userIds }, isActive: true } },
          { $group: { _id: '$recruiterId', total: { $sum: 1 } } },
        ])
      : Promise.resolve([]),
    Startup.aggregate<{ _id: Types.ObjectId; total: number }>([
      {
        $match: {
          ...buildStartupVisibilityQuery(requesterRole),
          founderIds: { $in: userIds },
        },
      },
      { $unwind: '$founderIds' },
      { $match: { founderIds: { $in: userIds } } },
      { $group: { _id: '$founderIds', total: { $sum: 1 } } },
    ]),
  ]);

  const jobCountMap = new Map(jobCounts.map((entry) => [String(entry._id), entry.total]));
  const startupCountMap = new Map(startupCounts.map((entry) => [String(entry._id), entry.total]));

  return users.map((user) =>
    attachUserCardMetadata(user as PublicUser, {
      jobs: jobCountMap.get(String(user._id)) ?? 0,
      startups: startupCountMap.get(String(user._id)) ?? 0,
    }, MARKETPLACE_CARD_LIMITS),
  );
};

const listMarketplaceStartups = async (requesterRole: UserRole, search?: string, page = 1, limit = 20) => {
  const query = buildStartupVisibilityQuery(requesterRole, search);
  const startups = await Startup.find(query)
    .select(
      '_id founderIds teamMemberIds projectId name tagline category stage pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey teamSize fundingNeeded activeProducts businessProfile initializationProfile launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction innovationProfile documents isActive createdAt updatedAt',
    )
    .sort({ launchedAt: -1, innovationScoreAtLaunch: -1, updatedAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean<PublicStartup[]>();

  const allMemberIds = [
    ...new Set(
      startups.flatMap((startup) => [
        ...(startup.founderIds ?? []).map(String),
        ...(startup.teamMemberIds ?? []).map(String),
      ]),
    ),
  ];
  const projectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];

  const [founders, workspaces] = await Promise.all([
    allMemberIds.length > 0
      ? User.find({ _id: { $in: allMemberIds } })
          .select('_id displayName avatar headline domain location bio innovationScore')
          .lean<MarketplaceFounder[]>()
      : Promise.resolve([]),
    projectIds.length > 0
      ? Workspace.find({ _id: { $in: projectIds }, isActive: true })
          .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
          .lean<MarketplaceWorkspace[]>()
      : Promise.resolve([]),
  ]);

  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
  const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));

  return Promise.all(startups.map((startup) => {
    const startupMemberIds = [
      ...(startup.founderIds ?? []).map(String),
      ...(startup.teamMemberIds ?? []).map(String),
    ];
    const uniqueMemberIds = [...new Set(startupMemberIds)];
    const startupFounders = uniqueMemberIds
      .map((id) => founderMap.get(id))
      .filter((founder): founder is MarketplaceFounder => Boolean(founder));

    return buildStartupView(
      requesterRole,
      startup,
      startupFounders,
      startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined,
    );
  }));
};

const getMarketplaceUserDetail = async (
  requesterRole: UserRole,
  userId: string,
  requesterId?: string,
) => {
  const user = await User.findById(userId)
    .select(
      'displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats institutionProfile discoverableToRecruiters',
    )
    .lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (!MARKETPLACE_USER_ROLES.has(user.role as MarketplaceEntityType)) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
  }

  if (!canBrowseMarketplaceRole(requesterRole, user.role)) {
    throw new ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${user.role}`);
  }

  if (requesterRole === UserRole.RECRUITER && user.role === UserRole.STUDENT && !user.discoverableToRecruiters) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const [jobs, startups] = await Promise.all([
    user.role === UserRole.RECRUITER
      ? JobPost.find({ recruiterId: userId, isActive: true })
          .sort({ createdAt: -1 })
          .limit(8)
          .lean()
      : Promise.resolve([]),
    Startup.find({
      ...buildStartupVisibilityQuery(requesterRole),
      founderIds: userId,
    })
      .select(
        '_id founderIds teamMemberIds projectId name tagline category stage pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey teamSize fundingNeeded activeProducts businessProfile initializationProfile launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction innovationProfile documents isActive createdAt updatedAt',
      )
      .sort({ launchedAt: -1, updatedAt: -1 })
      .limit(6)
      .lean<PublicStartup[]>(),
  ]);

  const allStartupMemberIds = [
    ...new Set(
      startups.flatMap((startup) => [
        ...(startup.founderIds ?? []).map(String),
        ...(startup.teamMemberIds ?? []).map(String),
      ]),
    ),
  ];
  const startupProjectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];

  const [founders, workspaces] = await Promise.all([
    allStartupMemberIds.length > 0
      ? User.find({ _id: { $in: allStartupMemberIds } })
          .select('_id displayName avatar headline domain location bio innovationScore')
          .lean<MarketplaceFounder[]>()
      : Promise.resolve([]),
    startupProjectIds.length > 0
      ? Workspace.find({ _id: { $in: startupProjectIds }, isActive: true })
          .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
          .lean<MarketplaceWorkspace[]>()
      : Promise.resolve([]),
  ]);

  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
  const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
  const viewerStudentId = requesterRole === UserRole.STUDENT ? requesterId : undefined;

  return {
    ...attachUserCardMetadata(user as PublicUser, {
      jobs: jobs.length,
      startups: startups.length,
    }, MARKETPLACE_DETAIL_LIMITS),
    relatedJobs: jobs.map((job) => {
      const hasApplied = getStudentHasAppliedToJob(job, viewerStudentId);
      return mapJob(job, typeof hasApplied === 'boolean' ? { hasApplied } : undefined);
    }),
    relatedStartups: await Promise.all(startups.map((startup) => {
      const memberIds = [...new Set([
        ...(startup.founderIds ?? []).map(String),
        ...(startup.teamMemberIds ?? []).map(String),
      ])];
      return buildStartupView(
        requesterRole,
        startup,
        memberIds
          .map((id) => founderMap.get(id))
          .filter((founder): founder is MarketplaceFounder => Boolean(founder)),
        startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined,
      );
    })),
  };
};

const getMarketplaceStartupDetail = async (requesterRole: UserRole, startupId: string) => {
  const startup = await Startup.findOne({
    _id: startupId,
    ...buildStartupVisibilityQuery(requesterRole),
  })
    .select(
      '_id founderIds teamMemberIds projectId name tagline category stage pitchDeckUrl pitchDeckStorageProvider pitchDeckStorageKey teamSize fundingNeeded activeProducts businessProfile initializationProfile launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction innovationProfile documents isActive createdAt updatedAt',
    )
    .lean<PublicStartup | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const memberIds = [
    ...new Set([
      ...(startup.founderIds ?? []).map(String),
      ...(startup.teamMemberIds ?? []).map(String),
    ]),
  ];

  const [founders, workspace] = await Promise.all([
    memberIds.length > 0
      ? User.find({ _id: { $in: memberIds } })
          .select('_id displayName avatar headline domain location bio innovationScore')
          .lean<MarketplaceFounder[]>()
      : Promise.resolve([]),
    startup.projectId
      ? Workspace.findOne({ _id: startup.projectId, isActive: true })
          .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
          .lean<MarketplaceWorkspace | null>()
      : Promise.resolve(null),
  ]);

  return {
    ...(await buildStartupView(requesterRole, startup, founders, workspace)),
    ...(requesterRole === UserRole.INVESTOR
      ? {
          sharePool: {
            totalShares: startup.totalShares,
            availableShares: startup.availableShares,
            reservedForSole: startup.reservedForSole,
            currentPennyCount: startup.currentPennyCount,
            maxPennyInvestors: startup.maxPennyInvestors,
            hasSoleInvestor: startup.hasSoleInvestor,
          },
          acceptsPennyInvestors: startup.currentPennyCount < startup.maxPennyInvestors,
          acceptsSoleInvestor: !startup.hasSoleInvestor,
        }
      : {}),
  };
};

export const getMarketplaceEntity = async (
  requesterRole: UserRole,
  entityType: MarketplaceEntityType,
  entityId: string,
  requesterId?: string,
) => {
  if (entityType === 'startup') {
    return getMarketplaceStartupDetail(requesterRole, entityId);
  }

  if (!MARKETPLACE_USER_ROLES.has(entityType)) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
  }

  return getMarketplaceUserDetail(requesterRole, entityId, requesterId);
};

export const getMarketplaceUser = async (
  requesterRole: UserRole,
  userId: string,
  requesterId?: string,
) => getMarketplaceUserDetail(requesterRole, userId, requesterId);
