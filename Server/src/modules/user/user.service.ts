import { Types } from 'mongoose';
import { z } from 'zod';
import { User } from './user.model';
import { IUser, LaunchToRecruitersResult, SanitizedUser, StudentMentorSessionView } from './user.types';
import { ApiError } from '../../utils/ApiError';
import { MentorSession } from '../mentor/mentorSession.model';
import { UserRole } from '../../types/roles.types';
import { RelevanceBridge } from '../recruiter/relevanceBridge.model';
import { PlacementRecord } from '../college/placementRecord.model';
import { NotificationService } from '../notification/notification.service';
import { io } from '../../config/socket';
import { getStudentCollegeId } from '../recruiter/recruiter.mappers';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { applyScoreAsync } from '../../services/scoreEngine';

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
});

type UserLike = Omit<IUser, '_id' | 'institutionId'> & {
  _id: { toString(): string };
  institutionId?: { toString(): string } | null;
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
  innovationScore: user.innovationScore,
  scoreBreakdown: user.scoreBreakdown,
  accessGrantedBy: user.accessGrantedBy,
  accessExpiresAt: user.accessExpiresAt,
  isActive: user.isActive,
  ...(user.lastLogin ? { lastLogin: user.lastLogin } : {}),
  discoverableToRecruiters: user.discoverableToRecruiters ?? false,
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
  teamRequestsSent: (user.teamRequestsSent ?? []).map((requestId) => requestId.toString()),
  teamRequestsReceived: (user.teamRequestsReceived ?? []).map((requestId) => requestId.toString()),
  createdAt: user.createdAt,
  updatedAt: user.updatedAt,
});

export const getCurrentUser = async (userId: string) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return toSanitizedUser(user as UserLike);
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

export const enrichCurrentUserFromSocialLinks = async (
  userId: string,
  payload: z.infer<typeof socialEnrichSchema>,
) => {
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

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

    await applyScoreAsync({
      userId,
      trigger: 'GITHUB_CONNECTED',
      metadata: { username: githubUser.login },
    });
  }

  if (linkedinUrl) {
    extractLinkedInHandle(linkedinUrl);
    warnings.push(
      'LinkedIn official profile import requires OAuth-based member authorization. Your LinkedIn URL was saved, but profile extraction is not enabled yet.',
    );
  }

  user.profileComplete = Boolean(
    user.displayName?.trim() &&
      ((user.bio && user.bio.trim()) ||
        (user.domain && user.domain.trim()) ||
        (user.githubUrl && user.githubUrl.trim()) ||
        (user.linkedinUrl && user.linkedinUrl.trim())),
  );

  await user.save();

  return {
    user: toSanitizedUser(user.toObject() as UserLike),
    summary: {
      githubImported,
      linkedinImported: false,
      warnings,
      importedSkills: user.skills.filter((skill) => skill.source === 'github').length,
      importedProjects: user.portfolioProjects.filter((project) => project.source === 'github').length,
    },
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

  student.discoverableToRecruiters = true;
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

  if (payload.profileComplete !== undefined) {
    user.profileComplete = payload.profileComplete;
  }

  if (payload.discoverableToRecruiters !== undefined) {
    user.discoverableToRecruiters = payload.discoverableToRecruiters;
  }

  await user.save();

  return toSanitizedUser(user.toObject() as UserLike);
};
