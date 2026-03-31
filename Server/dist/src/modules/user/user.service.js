"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateCurrentUser = exports.launchCurrentUserToRecruiters = exports.getCurrentUserMentorSessions = exports.enrichCurrentUserFromSocialLinks = exports.getCurrentUser = exports.toSanitizedUser = exports.socialEnrichSchema = exports.updateMeSchema = void 0;
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const user_model_1 = require("./user.model");
const ApiError_1 = require("../../utils/ApiError");
const mentorSession_model_1 = require("../mentor/mentorSession.model");
const roles_types_1 = require("../../types/roles.types");
const relevanceBridge_model_1 = require("../recruiter/relevanceBridge.model");
const placementRecord_model_1 = require("../college/placementRecord.model");
const notification_service_1 = require("../notification/notification.service");
const socket_1 = require("../../config/socket");
const recruiter_mappers_1 = require("../recruiter/recruiter.mappers");
const sanitizeText_1 = require("../../utils/sanitizeText");
const scoreEngine_1 = require("../../services/scoreEngine");
const score_utils_1 = require("../innovationScore/score.utils");
exports.updateMeSchema = zod_1.z
    .object({
    displayName: zod_1.z.string().trim().min(2).max(100).optional(),
    avatar: zod_1.z.string().trim().url().optional().or(zod_1.z.literal('')),
    bio: zod_1.z.string().trim().max(500).optional().or(zod_1.z.literal('')),
    domain: zod_1.z.string().trim().max(120).optional().or(zod_1.z.literal('')),
    githubUrl: zod_1.z.string().trim().url().optional().or(zod_1.z.literal('')),
    linkedinUrl: zod_1.z.string().trim().url().optional().or(zod_1.z.literal('')),
    profileComplete: zod_1.z.boolean().optional(),
    discoverableToRecruiters: zod_1.z.boolean().optional(),
})
    .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
});
exports.socialEnrichSchema = zod_1.z.object({
    githubUrl: zod_1.z.string().trim().url().optional(),
    linkedinUrl: zod_1.z.string().trim().url().optional(),
});
const toSanitizedConnectedAccounts = (connectedAccounts) => ({
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
const toSanitizedUser = (user) => ({
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
    innovationScore: (0, score_utils_1.normalizeInnovationScore)(user.innovationScore),
    scoreBreakdown: (0, score_utils_1.normalizeScoreBreakdown)(user.scoreBreakdown),
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
    teamRequestsSent: (user.teamRequestsSent ?? []).map((requestId) => requestId.toString()),
    teamRequestsReceived: (user.teamRequestsReceived ?? []).map((requestId) => requestId.toString()),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
});
exports.toSanitizedUser = toSanitizedUser;
const getCurrentUser = async (userId) => {
    const user = await user_model_1.User.findById(userId).lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return (0, exports.toSanitizedUser)(user);
};
exports.getCurrentUser = getCurrentUser;
const extractGithubUsername = (githubUrl) => {
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
    }
    catch (_error) {
        throw new ApiError_1.ApiError(400, 'INVALID_GITHUB_URL', 'Enter a valid GitHub profile URL');
    }
};
const extractLinkedInHandle = (linkedinUrl) => {
    try {
        const url = new URL(linkedinUrl);
        if (!/linkedin\.com$/i.test(url.hostname) && !/linkedin\.com$/i.test(url.hostname.replace(/^www\./i, ''))) {
            throw new Error('Invalid LinkedIn hostname');
        }
        return url.pathname.split('/').filter(Boolean).join('/');
    }
    catch (_error) {
        throw new ApiError_1.ApiError(400, 'INVALID_LINKEDIN_URL', 'Enter a valid LinkedIn profile URL');
    }
};
const fetchGithubJson = async (url) => {
    const response = await fetch(url, {
        headers: {
            Accept: 'application/vnd.github+json',
            'User-Agent': 'ProMove-Innovation-Cloud',
            'X-GitHub-Api-Version': '2022-11-28',
        },
    });
    if (response.status === 404) {
        throw new ApiError_1.ApiError(404, 'GITHUB_PROFILE_NOT_FOUND', 'GitHub profile not found');
    }
    if (!response.ok) {
        throw new ApiError_1.ApiError(502, 'GITHUB_API_ERROR', 'Unable to fetch GitHub data right now');
    }
    return (await response.json());
};
const determineGithubSkillLevel = (percentage) => {
    if (percentage > 40)
        return 'advanced';
    if (percentage > 15)
        return 'intermediate';
    return 'beginner';
};
const normalizeOptionalUrl = (value) => {
    if (!value)
        return null;
    const trimmed = value.trim();
    if (!trimmed)
        return null;
    if (/^https?:\/\//i.test(trimmed))
        return trimmed;
    return `https://${trimmed}`;
};
const enrichCurrentUserFromSocialLinks = async (userId, payload) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (payload.githubUrl !== undefined) {
        user.githubUrl = payload.githubUrl;
    }
    if (payload.linkedinUrl !== undefined) {
        user.linkedinUrl = payload.linkedinUrl;
    }
    const githubUrl = payload.githubUrl ?? user.githubUrl ?? undefined;
    const linkedinUrl = payload.linkedinUrl ?? user.linkedinUrl ?? undefined;
    const warnings = [];
    let githubImported = false;
    if (githubUrl) {
        const username = extractGithubUsername(githubUrl);
        const [githubUser, repos, publicEvents] = await Promise.all([
            fetchGithubJson(`https://api.github.com/users/${username}`),
            fetchGithubJson(`https://api.github.com/users/${username}/repos?sort=updated&per_page=100&type=owner`),
            fetchGithubJson(`https://api.github.com/users/${username}/events/public?per_page=100`).catch(() => []),
        ]);
        const ownedRepos = repos.filter((repo) => !repo.fork);
        const totalStars = ownedRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
        const totalForks = ownedRepos.reduce((sum, repo) => sum + repo.forks_count, 0);
        const languageCounts = ownedRepos.reduce((acc, repo) => {
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
            category: 'programming',
            source: 'github',
            level: determineGithubSkillLevel(entry.percentage),
            endorsements: 0,
            addedAt: new Date(),
        }));
        const githubProjects = ownedRepos
            .filter((repo) => repo.stargazers_count >= 1 || !repo.archived)
            .slice(0, 8)
            .map((repo) => ({
            _id: new mongoose_1.Types.ObjectId(),
            title: repo.name,
            description: repo.description ?? '',
            techStack: repo.language ? [repo.language] : [],
            repoUrl: repo.html_url,
            liveUrl: normalizeOptionalUrl(repo.homepage),
            coverImageUrl: null,
            startDate: null,
            endDate: null,
            isCurrent: !repo.archived,
            source: 'github',
            githubRepoId: String(repo.id),
            stars: repo.stargazers_count,
            forks: repo.forks_count,
            languages: repo.language ? [repo.language] : [],
        }));
        const oneYearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        const contributionsLastYear = publicEvents.filter((event) => event.type === 'PushEvent' && new Date(event.created_at).getTime() >= oneYearAgo).length;
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
        await (0, scoreEngine_1.applyScoreAsync)({
            userId,
            trigger: 'GITHUB_CONNECTED',
            metadata: { username: githubUser.login },
        });
    }
    if (linkedinUrl) {
        extractLinkedInHandle(linkedinUrl);
        warnings.push('LinkedIn profile import is not enabled yet. Your LinkedIn URL was saved successfully.');
    }
    user.profileComplete = Boolean(user.displayName?.trim() &&
        ((user.bio && user.bio.trim()) ||
            (user.domain && user.domain.trim()) ||
            (user.githubUrl && user.githubUrl.trim()) ||
            (user.linkedinUrl && user.linkedinUrl.trim())));
    await user.save();
    return {
        user: (0, exports.toSanitizedUser)(user.toObject()),
        summary: {
            githubImported,
            linkedinImported: false,
            warnings,
            importedSkills: user.skills.filter((skill) => skill.source === 'github').length,
            importedProjects: user.portfolioProjects.filter((project) => project.source === 'github').length,
        },
    };
};
exports.enrichCurrentUserFromSocialLinks = enrichCurrentUserFromSocialLinks;
const getCurrentUserMentorSessions = async (studentId) => {
    const sessions = await mentorSession_model_1.MentorSession.find({ studentId }).sort({ scheduledAt: 1 }).lean();
    const mentorIds = sessions.map((session) => session.mentorId);
    const mentors = mentorIds.length > 0
        ? await user_model_1.User.find({ _id: { $in: mentorIds } }).select('_id displayName avatar').lean()
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
exports.getCurrentUserMentorSessions = getCurrentUserMentorSessions;
const launchCurrentUserToRecruiters = async (studentId) => {
    const student = await user_model_1.User.findById(studentId);
    if (!student || student.role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
    }
    student.discoverableToRecruiters = true;
    await student.save();
    const recruiters = await user_model_1.User.find({ role: roles_types_1.UserRole.RECRUITER, isActive: true })
        .select('_id')
        .lean();
    const collegeId = await (0, recruiter_mappers_1.getStudentCollegeId)(studentId);
    await Promise.all(recruiters.map((recruiter) => relevanceBridge_model_1.RelevanceBridge.updateOne({
        studentId,
        recruiterId: recruiter._id,
    }, {
        studentId,
        recruiterId: recruiter._id,
        bridgeType: 'LAUNCH_TRIGGER',
        isActive: true,
    }, {
        upsert: true,
    })));
    if (collegeId) {
        await Promise.all(recruiters.map((recruiter) => placementRecord_model_1.PlacementRecord.findOneAndUpdate({
            studentId,
            recruiterId: recruiter._id,
            collegeId,
        }, {
            studentId,
            recruiterId: recruiter._id,
            collegeId,
            status: 'Discovered',
            innovationScoreAtTime: student.innovationScore ?? 0,
        }, {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
        })));
    }
    const notification = await notification_service_1.NotificationService.create({
        userId: studentId,
        type: 'system',
        title: 'Your profile is now visible to all active recruiters',
        body: 'Your profile is now visible to all active recruiters.',
        link: '/leadership-profile',
    });
    if (socket_1.io) {
        socket_1.io.of('/notifications').to(`user:${studentId}`).emit('notification:new', notification);
    }
    return {
        bridgesCreated: recruiters.length,
        user: (0, exports.toSanitizedUser)(student.toObject()),
    };
};
exports.launchCurrentUserToRecruiters = launchCurrentUserToRecruiters;
const updateCurrentUser = async (userId, payload) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (payload.displayName !== undefined) {
        user.displayName = (0, sanitizeText_1.sanitizePlainText)(payload.displayName);
    }
    if (payload.avatar !== undefined) {
        user.avatar = payload.avatar || undefined;
    }
    if (payload.bio !== undefined) {
        user.bio = payload.bio ? (0, sanitizeText_1.sanitizePlainText)(payload.bio) : undefined;
    }
    if (payload.domain !== undefined) {
        user.domain = payload.domain ? (0, sanitizeText_1.sanitizePlainText)(payload.domain) : undefined;
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
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.updateCurrentUser = updateCurrentUser;
