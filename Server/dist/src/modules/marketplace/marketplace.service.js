"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceUser = exports.listMarketplaceUsers = void 0;
const connectionGuard_1 = require("../../middleware/connectionGuard");
const ApiError_1 = require("../../utils/ApiError");
const user_model_1 = require("../user/user.model");
const compactString = (value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : undefined;
};
const mapLinkSet = (user) => {
    const links = {
        ...(compactString(user.websiteUrl) ? { websiteUrl: compactString(user.websiteUrl) } : {}),
        ...(compactString(user.githubUrl) ? { githubUrl: compactString(user.githubUrl) } : {}),
        ...(compactString(user.linkedinUrl) ? { linkedinUrl: compactString(user.linkedinUrl) } : {}),
    };
    return Object.keys(links).length > 0 ? links : undefined;
};
const mapGithubStats = (githubStats) => {
    if (!githubStats) {
        return undefined;
    }
    const hasMeaningfulStats = githubStats.totalRepos > 0 ||
        githubStats.totalStars > 0 ||
        githubStats.totalForks > 0 ||
        githubStats.contributionsLastYear > 0 ||
        githubStats.topLanguages.length > 0;
    if (!hasMeaningfulStats) {
        return undefined;
    }
    return githubStats;
};
const mapPublicUser = (user) => ({
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
            skills: user.skills
                .filter((skill) => compactString(skill.name))
                .slice(0, 8)
                .map((skill) => ({
                name: skill.name.trim(),
                level: skill.level,
            })),
        }
        : {}),
    ...(user.experience && user.experience.length > 0
        ? {
            experienceHighlights: user.experience.slice(0, 3).map((item) => ({
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
            educationHighlights: user.education.slice(0, 2).map((item) => ({
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
            portfolioHighlights: user.portfolioProjects.slice(0, 3).map((project) => ({
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
    insightCounts: {
        skills: user.skills?.length ?? 0,
        experience: user.experience?.length ?? 0,
        education: user.education?.length ?? 0,
        portfolioProjects: user.portfolioProjects?.length ?? 0,
    },
});
const listMarketplaceUsers = async (requesterRole, role, domain, page = 1, limit = 20) => {
    if (!(connectionGuard_1.ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(role)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${role}`);
    }
    const users = await user_model_1.User.find({
        role,
        isActive: true,
        ...(domain ? { domain: new RegExp(domain, 'i') } : {}),
    })
        .select('displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats lastLogin')
        .sort({ lastLogin: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    return users.map((user) => mapPublicUser(user));
};
exports.listMarketplaceUsers = listMarketplaceUsers;
const getMarketplaceUser = async (requesterRole, userId) => {
    const user = await user_model_1.User.findById(userId)
        .select('displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats')
        .lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (!(connectionGuard_1.ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(user.role)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', `Your role cannot connect with ${user.role}`);
    }
    return mapPublicUser(user);
};
exports.getMarketplaceUser = getMarketplaceUser;
