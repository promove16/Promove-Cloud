import { Types } from 'mongoose';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './user.model';
import {
  IUser,
  LaunchToRecruitersResult,
  PublicStudentProfile,
  SanitizedUser,
  StudentMentorSessionView,
} from './user.types';
import { ApiError } from '../../utils/ApiError';
import { recordClientActivity, recordClientActivitySchema } from '../analytics/activity.service';
import { MentorSession } from '../mentor/mentorSession.model';
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

export const updateMeSchema = z
  .object({
    displayName: z.string().trim().min(2).max(100).optional(),
    avatar: z.string().trim().url().optional().or(z.literal('')),
    bio: z.string().trim().max(500).optional().or(z.literal('')),
    domain: z.string().trim().max(120).optional().or(z.literal('')),
    githubUrl: z.string().trim().url().optional().or(z.literal('')),
    linkedinUrl: z.string().trim().url().optional().or(z.literal('')),
    profileComplete: z.boolean().optional(),
    discoverableToRecruiters: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export const socialEnrichSchema = z.object({
  githubUrl: z.string().trim().url().optional(),
  linkedinUrl: z.string().trim().url().optional(),
  confirmLinkedinFetch: z.boolean().optional(),
});

export const importGithubRepositoriesSchema = z.object({
  repoIds: z.array(z.string().trim().min(1)).min(1).max(8),
});

type UserLike = Omit<IUser, '_id' | 'institutionId'> & {
  _id: { toString(): string };
  institutionId?: { toString(): string } | null;
};

const GITHUB_PROFILE_ROLES = new Set<UserRole>([UserRole.STUDENT, UserRole.MENTOR]);

const supportsGithubProfile = (role: UserRole) => GITHUB_PROFILE_ROLES.has(role);

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

export const toSanitizedUser = (user: UserLike): SanitizedUser => ({
  _id: user._id.toString(),
  email: user.email,
  role: user.role,
  displayName: user.displayName,
  githubOAuthAvailable: isGithubOauthAvailable(),
  ...(user.avatar ? { avatar: user.avatar } : {}),
  ...(user.bio ? { bio: user.bio } : {}),
  headline: user.headline ?? '',
  location: user.location ?? '',
  websiteUrl: user.websiteUrl ?? null,
  githubUrl: user.githubUrl ?? null,
  linkedinUrl: user.linkedinUrl ?? null,
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
  ...(user.institutionToken !== undefined ? { institutionToken: user.institutionToken ?? null } : {}),
  ...(user.institutionId ? { institutionId: user.institutionId.toString() } : { institutionId: null }),
  ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
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
    user: toSanitizedUser(user.toObject() as UserLike),
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

  if (payload.bio !== undefined) {
    user.bio = payload.bio ? sanitizePlainText(payload.bio) : undefined;
  }

  if (payload.domain !== undefined) {
    user.domain = payload.domain ? sanitizePlainText(payload.domain) : undefined;
  }

  if (payload.githubUrl !== undefined) {
    user.githubUrl = payload.githubUrl || null;
  }

  if (payload.linkedinUrl !== undefined) {
    user.linkedinUrl = payload.linkedinUrl || null;
  }

  if (payload.discoverableToRecruiters !== undefined) {
    user.discoverableToRecruiters = payload.discoverableToRecruiters;
  }

  await ensureProfileSlug(user);
  user.profileComplete = computeProfileComplete(user);

  await user.save();
  await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'profile_update');
  await queueProfileCompletionMilestoneEmail(
    userId,
    previousProfilePercent,
    getProfileCompletionProgress(user).percent,
  );

  return toSanitizedUser(user.toObject() as UserLike);
};

export const getPublicStudentProfileBySlug = async (profileSlug: string): Promise<PublicStudentProfile> => {
  const student = await User.findOne({
    profileSlug,
    role: UserRole.STUDENT,
    isActive: true,
    isProfilePublic: true,
    profileComplete: true,
    verificationStatus: 'verified',
  }).lean();

  if (!student) {
    throw new ApiError(404, 'PUBLIC_PROFILE_NOT_FOUND', 'Public student profile not found');
  }

  const institution = student.institutionId
    ? await User.findById(student.institutionId).select('_id displayName').lean()
    : null;

  return {
    _id: String(student._id),
    displayName: student.displayName,
    ...(student.avatar ? { avatar: student.avatar } : {}),
    ...(student.bio ? { bio: student.bio } : {}),
    headline: student.headline ?? '',
    location: student.location ?? '',
    websiteUrl: student.websiteUrl ?? null,
    githubUrl: student.githubUrl ?? null,
    linkedinUrl: student.linkedinUrl ?? null,
    profileSlug: student.profileSlug ?? '',
    ...(student.domain ? { domain: student.domain } : {}),
    innovationScore: normalizeInnovationScore(student.innovationScore),
    institutionVerifiedAt: student.institutionVerifiedAt ?? null,
    ...(student.verifiedAt ? { verifiedAt: student.verifiedAt } : {}),
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
    skills: student.skills ?? [],
    experience: student.experience ?? [],
    education: student.education ?? [],
    certifications: student.certifications ?? [],
    portfolioProjects: student.portfolioProjects ?? [],
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
