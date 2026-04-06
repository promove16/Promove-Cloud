"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPublicStudentProfileBySlug = exports.updateCurrentUser = exports.launchCurrentUserToRecruiters = exports.getCurrentUserMentorSessions = exports.importCurrentUserGithubRepositories = exports.listCurrentUserGithubRepositories = exports.syncCurrentUserGithubProof = exports.connectGithubForCurrentUserFromCallback = exports.beginGithubOauthForCurrentUser = exports.enrichCurrentUserFromSocialLinks = exports.recordCurrentUserActivity = exports.acceptCurrentTerms = exports.getCurrentUser = exports.toSanitizedUser = exports.acceptTermsSchema = exports.importGithubRepositoriesSchema = exports.socialEnrichSchema = exports.updateMeSchema = void 0;
const mongoose_1 = require("mongoose");
const zod_1 = require("zod");
const crypto_1 = require("crypto");
const user_model_1 = require("./user.model");
const user_terms_1 = require("./user.terms");
const ApiError_1 = require("../../utils/ApiError");
const activity_service_1 = require("../analytics/activity.service");
const mentorSession_model_1 = require("../mentor/mentorSession.model");
const roles_types_1 = require("../../types/roles.types");
const relevanceBridge_model_1 = require("../recruiter/relevanceBridge.model");
const placementRecord_model_1 = require("../college/placementRecord.model");
const notification_service_1 = require("../notification/notification.service");
const socket_1 = require("../../config/socket");
const recruiter_mappers_1 = require("../recruiter/recruiter.mappers");
const sanitizeText_1 = require("../../utils/sanitizeText");
const scoreEngine_1 = require("../../services/scoreEngine");
const profileCompletion_1 = require("./profileCompletion");
const retentionEmailService_1 = require("../../services/retentionEmailService");
const score_utils_1 = require("../innovationScore/score.utils");
const linkedinPublicProfile_1 = require("./linkedinPublicProfile");
const githubProof_1 = require("./githubProof");
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
    confirmLinkedinFetch: zod_1.z.boolean().optional(),
});
exports.importGithubRepositoriesSchema = zod_1.z.object({
    repoIds: zod_1.z.array(zod_1.z.string().trim().min(1)).min(1).max(8),
});
exports.acceptTermsSchema = zod_1.z.object({
    version: zod_1.z.string().trim().min(1).max(50),
});
const GITHUB_PROFILE_ROLES = new Set([roles_types_1.UserRole.STUDENT, roles_types_1.UserRole.MENTOR]);
const supportsGithubProfile = (role) => GITHUB_PROFILE_ROLES.has(role);
const slugifyDisplayName = (displayName) => {
    const normalized = displayName
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .toLowerCase()
        .replace(/[\s_-]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return normalized || 'user';
};
const generateProfileSlug = async (displayName) => {
    const baseSlug = slugifyDisplayName(displayName);
    for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = (0, crypto_1.randomBytes)(2).toString('hex');
        const candidate = `${baseSlug}-${suffix}`;
        const existing = await user_model_1.User.exists({ profileSlug: candidate });
        if (!existing) {
            return candidate;
        }
    }
    throw new ApiError_1.ApiError(500, 'PROFILE_SLUG_GENERATION_FAILED', 'Unable to generate a unique profile URL');
};
const ensureProfileSlug = async (user) => {
    if (user.profileSlug) {
        return false;
    }
    user.profileSlug = await generateProfileSlug(user.displayName);
    return true;
};
const applyProfileCompleteScoreIfNeeded = async (user, userId, wasProfileComplete, source) => {
    if (wasProfileComplete || !user.profileComplete) {
        return;
    }
    const newScore = await (0, scoreEngine_1.applyScore)({
        userId,
        trigger: 'PROFILE_COMPLETE',
        metadata: { source },
    });
    user.innovationScore = newScore;
};
const computeProfileComplete = (user) => Boolean(user.displayName?.trim() &&
    ((user.bio && user.bio.trim()) ||
        (user.domain && user.domain.trim()) ||
        (user.linkedinUrl && user.linkedinUrl.trim()) ||
        (supportsGithubProfile(user.role) && user.githubUrl && user.githubUrl.trim())));
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
const toSanitizedInstitutionVerification = (institutionVerification) => {
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
const toSanitizedUser = (user) => ({
    _id: user._id.toString(),
    email: user.email,
    role: user.role,
    displayName: user.displayName,
    githubOAuthAvailable: (0, githubProof_1.isGithubOauthAvailable)(),
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
    termsAcceptance: user.termsAcceptance ?? null,
    termsCurrentVersion: user_terms_1.CURRENT_TERMS_VERSION,
    hasAcceptedCurrentTerms: (0, user_terms_1.hasAcceptedCurrentTerms)(user.role, user.termsAcceptance),
    ...(user.institutionToken !== undefined ? { institutionToken: user.institutionToken ?? null } : {}),
    ...(user.institutionId ? { institutionId: user.institutionId.toString() } : { institutionId: null }),
    ...(user.institutionProfile ? { institutionProfile: user.institutionProfile } : {}),
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
exports.toSanitizedUser = toSanitizedUser;
const getCurrentUser = async (userId) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const profileSlugCreated = await ensureProfileSlug(user);
    if (profileSlugCreated) {
        await user.save();
    }
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.getCurrentUser = getCurrentUser;
const acceptCurrentTerms = async (userId, payload) => {
    if (payload.version !== user_terms_1.CURRENT_TERMS_VERSION) {
        throw new ApiError_1.ApiError(409, 'TERMS_VERSION_MISMATCH', 'The Terms & Conditions were updated. Please reload and review the latest version.');
    }
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    user.termsAcceptance = (0, user_terms_1.buildTermsAcceptance)(user.role);
    await user.save();
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.acceptCurrentTerms = acceptCurrentTerms;
const recordCurrentUserActivity = async (userId, payload) => {
    const parsed = activity_service_1.recordClientActivitySchema.parse(payload);
    await (0, activity_service_1.recordClientActivity)(userId, parsed);
    return { tracked: true };
};
exports.recordCurrentUserActivity = recordCurrentUserActivity;
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
const applyLinkedInProfileFields = (user, profile) => {
    let importedProfileFields = 0;
    if ((!user.displayName || user.displayName.trim().length === 0) && profile.displayName) {
        user.displayName = (0, sanitizeText_1.sanitizePlainText)(profile.displayName);
        importedProfileFields += 1;
    }
    if ((!user.headline || user.headline.trim().length === 0) && profile.headline) {
        user.headline = (0, sanitizeText_1.sanitizePlainText)(profile.headline);
        importedProfileFields += 1;
    }
    if ((!user.location || user.location.trim().length === 0) && profile.location) {
        user.location = (0, sanitizeText_1.sanitizePlainText)(profile.location);
        importedProfileFields += 1;
    }
    if ((!user.bio || user.bio.trim().length === 0) && profile.bio) {
        user.bio = (0, sanitizeText_1.sanitizePlainText)(profile.bio);
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
const enrichCurrentUserFromSocialLinks = async (userId, payload) => {
    const user = await user_model_1.User.findById(userId);
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const wasProfileComplete = user.profileComplete;
    const previousProfilePercent = (0, profileCompletion_1.getProfileCompletionProgress)(user).percent;
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
        importedSkills += githubSkills.length;
        importedProjects += githubProjects.length;
        await (0, scoreEngine_1.applyScoreAsync)({
            userId,
            trigger: 'GITHUB_CONNECTED',
            metadata: { username: githubUser.login },
        });
    }
    if (linkedinUrl) {
        const handle = extractLinkedInHandle(linkedinUrl);
        const shouldFetchLinkedIn = payload.confirmLinkedinFetch === true;
        const shouldWarnSkippedLinkedIn = payload.linkedinUrl !== undefined && payload.confirmLinkedinFetch !== true;
        if (shouldFetchLinkedIn) {
            try {
                const linkedInProfile = await (0, linkedinPublicProfile_1.fetchLinkedInPublicProfile)(linkedinUrl, handle);
                const summary = applyLinkedInProfileFields(user, linkedInProfile);
                const hasLinkedInPublicData = Boolean(linkedInProfile.displayName ||
                    linkedInProfile.headline ||
                    linkedInProfile.location ||
                    linkedInProfile.bio ||
                    linkedInProfile.avatar ||
                    linkedInProfile.skills.length > 0 ||
                    linkedInProfile.experience.length > 0 ||
                    linkedInProfile.education.length > 0 ||
                    linkedInProfile.certifications.length > 0);
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
                    if (summary.importedProfileFields +
                        summary.importedSkills +
                        summary.importedExperience +
                        summary.importedEducation +
                        summary.importedCertifications ===
                        0) {
                        warnings.push('LinkedIn data was fetched successfully, but your existing profile fields were already populated so nothing new was applied.');
                    }
                    await (0, scoreEngine_1.applyScoreAsync)({
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
                }
                else {
                    warnings.push('LinkedIn profile was reachable, but no public data could be imported. The URL was still saved.');
                }
            }
            catch (error) {
                const code = error instanceof Error ? error.message : 'LINKEDIN_FETCH_FAILED';
                if (code === 'LINKEDIN_PROFILE_NOT_FOUND') {
                    throw new ApiError_1.ApiError(404, code, 'LinkedIn profile not found');
                }
                if (code === 'LINKEDIN_FETCH_BLOCKED') {
                    warnings.push('LinkedIn blocked automatic profile extraction for this URL. The link was saved, but no LinkedIn data was imported.');
                }
                else {
                    warnings.push('Unable to fetch LinkedIn data right now. The link was saved, but LinkedIn details were not imported.');
                }
            }
        }
        else if (shouldWarnSkippedLinkedIn) {
            warnings.push('LinkedIn URL was saved, but profile data was not fetched because you did not confirm the LinkedIn import.');
        }
    }
    await ensureProfileSlug(user);
    user.profileComplete = computeProfileComplete(user);
    await user.save();
    await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'social_enrich');
    await (0, retentionEmailService_1.queueProfileCompletionMilestoneEmail)(userId, previousProfilePercent, (0, profileCompletion_1.getProfileCompletionProgress)(user).percent);
    return {
        user: (0, exports.toSanitizedUser)(user.toObject()),
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
exports.enrichCurrentUserFromSocialLinks = enrichCurrentUserFromSocialLinks;
const beginGithubOauthForCurrentUser = async (userId, returnTo) => (0, githubProof_1.createGithubOauthStart)(userId, returnTo);
exports.beginGithubOauthForCurrentUser = beginGithubOauthForCurrentUser;
const connectGithubForCurrentUserFromCallback = async (state, code) => {
    const { userId, returnTo } = await (0, githubProof_1.consumeGithubOauthState)(state);
    const accessToken = await (0, githubProof_1.resolveGithubOauthCallback)(code);
    const user = await user_model_1.User.findById(userId).select('+connectedAccounts.github.accessToken');
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    const wasConnected = Boolean(user.connectedAccounts.github.userId);
    const wasProfileComplete = user.profileComplete;
    user.connectedAccounts.github = {
        ...user.connectedAccounts.github,
        accessToken,
        connectedAt: user.connectedAccounts.github.connectedAt ?? new Date(),
    };
    const previousProfilePercent = (0, profileCompletion_1.getProfileCompletionProgress)(user).percent;
    await (0, githubProof_1.syncGithubProofForUser)(user);
    await ensureProfileSlug(user);
    user.profileComplete = computeProfileComplete(user);
    await user.save();
    await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_oauth');
    await (0, retentionEmailService_1.queueProfileCompletionMilestoneEmail)(userId, previousProfilePercent, (0, profileCompletion_1.getProfileCompletionProgress)(user).percent);
    if (!wasConnected) {
        await (0, scoreEngine_1.applyScoreAsync)({
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
exports.connectGithubForCurrentUserFromCallback = connectGithubForCurrentUserFromCallback;
const getCurrentUserWithGithubAccess = async (userId) => {
    const user = await user_model_1.User.findById(userId).select('+connectedAccounts.github.accessToken');
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    return user;
};
const syncCurrentUserGithubProof = async (userId) => {
    const user = await getCurrentUserWithGithubAccess(userId);
    const wasProfileComplete = user.profileComplete;
    const previousProfilePercent = (0, profileCompletion_1.getProfileCompletionProgress)(user).percent;
    const result = await (0, githubProof_1.syncGithubProofForUser)(user);
    await ensureProfileSlug(user);
    user.profileComplete = computeProfileComplete(user);
    await user.save();
    await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_sync');
    await (0, retentionEmailService_1.queueProfileCompletionMilestoneEmail)(userId, previousProfilePercent, (0, profileCompletion_1.getProfileCompletionProgress)(user).percent);
    return {
        user: (0, exports.toSanitizedUser)(user.toObject()),
        repositoryCount: result.repositoryCount,
    };
};
exports.syncCurrentUserGithubProof = syncCurrentUserGithubProof;
const listCurrentUserGithubRepositories = async (userId) => {
    const user = await getCurrentUserWithGithubAccess(userId);
    return (0, githubProof_1.listGithubRepositoryChoices)(user);
};
exports.listCurrentUserGithubRepositories = listCurrentUserGithubRepositories;
const importCurrentUserGithubRepositories = async (userId, payload) => {
    const user = await getCurrentUserWithGithubAccess(userId);
    const wasProfileComplete = user.profileComplete;
    const previousProfilePercent = (0, profileCompletion_1.getProfileCompletionProgress)(user).percent;
    const result = await (0, githubProof_1.replaceImportedGithubRepositories)(user, payload.repoIds);
    await ensureProfileSlug(user);
    user.profileComplete = computeProfileComplete(user);
    await user.save();
    await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'github_import');
    await (0, retentionEmailService_1.queueProfileCompletionMilestoneEmail)(userId, previousProfilePercent, (0, profileCompletion_1.getProfileCompletionProgress)(user).percent);
    return {
        user: (0, exports.toSanitizedUser)(user.toObject()),
        importedCount: result.importedCount,
    };
};
exports.importCurrentUserGithubRepositories = importCurrentUserGithubRepositories;
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
    if (!student.profileComplete) {
        throw new ApiError_1.ApiError(409, 'PROFILE_INCOMPLETE', 'Complete your profile before launching it to recruiters or sharing it publicly.');
    }
    if (student.verificationStatus !== 'verified') {
        throw new ApiError_1.ApiError(409, 'PROFILE_NOT_VERIFIED', 'Your school or college must verify your account before this profile can be shared.');
    }
    await ensureProfileSlug(student);
    student.discoverableToRecruiters = true;
    student.isProfilePublic = true;
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
    const wasProfileComplete = user.profileComplete;
    const previousProfilePercent = (0, profileCompletion_1.getProfileCompletionProgress)(user).percent;
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
    if (payload.discoverableToRecruiters !== undefined) {
        user.discoverableToRecruiters = payload.discoverableToRecruiters;
    }
    await ensureProfileSlug(user);
    user.profileComplete = computeProfileComplete(user);
    await user.save();
    await applyProfileCompleteScoreIfNeeded(user, userId, wasProfileComplete, 'profile_update');
    await (0, retentionEmailService_1.queueProfileCompletionMilestoneEmail)(userId, previousProfilePercent, (0, profileCompletion_1.getProfileCompletionProgress)(user).percent);
    return (0, exports.toSanitizedUser)(user.toObject());
};
exports.updateCurrentUser = updateCurrentUser;
const getPublicStudentProfileBySlug = async (profileSlug) => {
    const student = await user_model_1.User.findOne({
        profileSlug,
        role: roles_types_1.UserRole.STUDENT,
        isActive: true,
        isProfilePublic: true,
        profileComplete: true,
        verificationStatus: 'verified',
    }).lean();
    if (!student) {
        throw new ApiError_1.ApiError(404, 'PUBLIC_PROFILE_NOT_FOUND', 'Public student profile not found');
    }
    const institution = student.institutionId
        ? await user_model_1.User.findById(student.institutionId).select('_id displayName').lean()
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
        innovationScore: (0, score_utils_1.normalizeInnovationScore)(student.innovationScore),
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
exports.getPublicStudentProfileBySlug = getPublicStudentProfileBySlug;
