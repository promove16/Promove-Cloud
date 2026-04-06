"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMarketplaceUser = exports.getMarketplaceEntity = exports.listMarketplaceUsers = exports.normalizeMarketplaceEntityType = void 0;
const ApiError_1 = require("../../utils/ApiError");
const user_model_1 = require("../user/user.model");
const roles_types_1 = require("../../types/roles.types");
const jobPost_model_1 = require("../recruiter/jobPost.model");
const recruiter_mappers_1 = require("../recruiter/recruiter.mappers");
const startup_model_1 = require("../startup/startup.model");
const workspace_model_1 = require("../workspace/workspace.model");
const MARKETPLACE_USER_ROLES = new Set([
    roles_types_1.UserRole.STUDENT,
    roles_types_1.UserRole.MENTOR,
    roles_types_1.UserRole.INVESTOR,
    roles_types_1.UserRole.RECRUITER,
]);
const MARKETPLACE_BROWSABLE_ROLES = new Set([
    roles_types_1.UserRole.STUDENT,
    roles_types_1.UserRole.SCHOOL,
    roles_types_1.UserRole.COLLEGE,
    roles_types_1.UserRole.MENTOR,
    roles_types_1.UserRole.INVESTOR,
    roles_types_1.UserRole.RECRUITER,
]);
const MARKETPLACE_ENTITY_TYPES = new Set([
    roles_types_1.UserRole.STUDENT,
    roles_types_1.UserRole.MENTOR,
    roles_types_1.UserRole.INVESTOR,
    roles_types_1.UserRole.RECRUITER,
    'startup',
]);
const normalizeMarketplaceEntityType = (value) => {
    const normalized = value?.trim().toLowerCase();
    if (!normalized) {
        return undefined;
    }
    return MARKETPLACE_ENTITY_TYPES.has(normalized)
        ? normalized
        : undefined;
};
exports.normalizeMarketplaceEntityType = normalizeMarketplaceEntityType;
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
    innovationScore: user.innovationScore ?? 0,
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
const toStartupVisibility = (startup) => [
    startup.launchedToMentors ? 'Mentors' : null,
    startup.launchedToInvestors ? 'Investors' : null,
    startup.launchedToRecruiters ? 'Recruiters' : null,
].filter((entry) => Boolean(entry));
const mapFounder = (founder) => ({
    _id: String(founder._id),
    displayName: founder.displayName,
    ...(founder.avatar ? { avatar: founder.avatar } : {}),
    innovationScore: founder.innovationScore ?? 0,
    ...(compactString(founder.headline) ? { headline: compactString(founder.headline) } : {}),
    ...(compactString(founder.domain) ? { domain: compactString(founder.domain) } : {}),
    ...(compactString(founder.location) ? { location: compactString(founder.location) } : {}),
    ...(compactString(founder.bio) ? { bio: compactString(founder.bio) } : {}),
});
const mapWorkspace = (workspace) => {
    if (!workspace) {
        return undefined;
    }
    const lastUpdate = workspace.progressUpdates
        .slice()
        .sort((left, right) => right.submittedAt.getTime() - left.submittedAt.getTime())[0];
    return {
        _id: String(workspace._id),
        title: workspace.title,
        category: workspace.category,
        stage: workspace.stage,
        progressPercent: workspace.progressPercent ?? 0,
        updatedAt: workspace.updatedAt.toISOString(),
        completedMilestones: workspace.milestones.filter((milestone) => milestone.isCompleted).length,
        totalMilestones: workspace.milestones.length,
        openTasks: workspace.tasks.filter((task) => !task.done).length,
        assetCount: workspace.uploads.length,
        repoCount: workspace.repoSubmissions.length,
        ...(lastUpdate
            ? {
                lastUpdate: {
                    note: lastUpdate.note,
                    submittedAt: lastUpdate.submittedAt.toISOString(),
                },
            }
            : {}),
    };
};
const buildStartupVisibilityQuery = (search) => ({
    isActive: true,
    $and: [
        {
            $or: [
                { launchedToInvestors: true },
                { launchedToMentors: true },
                { launchedToRecruiters: true },
            ],
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
const buildStartupView = (startup, founders, workspace) => ({
    _id: String(startup._id),
    entityType: 'startup',
    name: startup.name,
    tagline: startup.tagline,
    category: startup.category,
    stage: startup.stage,
    ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
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
    founders: founders.map(mapFounder),
    ...(founders[0] ? { primaryFounderId: String(founders[0]._id) } : {}),
    ...(mapWorkspace(workspace) ? { project: mapWorkspace(workspace) } : {}),
});
const attachUserCardMetadata = (user, relatedCounts) => ({
    entityType: user.role,
    ...mapPublicUser(user),
    relatedCounts,
});
const listMarketplaceUsers = async (requesterRole, role, domain, page = 1, limit = 20) => {
    if (!MARKETPLACE_ENTITY_TYPES.has(role)) {
        throw new ApiError_1.ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
    }
    if (requesterRole === roles_types_1.UserRole.RECRUITER && role !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', 'Recruiters can only browse student profiles in the marketplace');
    }
    if (role === 'startup') {
        return listMarketplaceStartups(domain, page, limit);
    }
    if (!MARKETPLACE_BROWSABLE_ROLES.has(requesterRole)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', 'Your role cannot browse the marketplace');
    }
    const users = await user_model_1.User.find({
        role,
        isActive: true,
        ...(domain ? { domain: new RegExp(domain, 'i') } : {}),
    })
        .select('displayName avatar role innovationScore domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats lastLogin')
        .sort({ lastLogin: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    const userIds = users.map((user) => user._id);
    const [jobCounts, startupCounts] = await Promise.all([
        role === roles_types_1.UserRole.RECRUITER
            ? jobPost_model_1.JobPost.aggregate([
                { $match: { recruiterId: { $in: userIds }, isActive: true } },
                { $group: { _id: '$recruiterId', total: { $sum: 1 } } },
            ])
            : Promise.resolve([]),
        startup_model_1.Startup.aggregate([
            {
                $match: {
                    ...buildStartupVisibilityQuery(),
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
    return users.map((user) => attachUserCardMetadata(user, {
        jobs: jobCountMap.get(String(user._id)) ?? 0,
        startups: startupCountMap.get(String(user._id)) ?? 0,
    }));
};
exports.listMarketplaceUsers = listMarketplaceUsers;
const listMarketplaceStartups = async (search, page = 1, limit = 20) => {
    const query = buildStartupVisibilityQuery(search);
    const [startups, total] = await Promise.all([
        startup_model_1.Startup.find(query)
            .select('_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt')
            .sort({ launchedAt: -1, innovationScoreAtLaunch: -1, updatedAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean(),
        startup_model_1.Startup.countDocuments(query),
    ]);
    const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
    const projectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];
    const [founders, workspaces] = await Promise.all([
        founderIds.length > 0
            ? user_model_1.User.find({ _id: { $in: founderIds } })
                .select('_id displayName avatar headline domain location bio innovationScore')
                .lean()
            : Promise.resolve([]),
        projectIds.length > 0
            ? workspace_model_1.Workspace.find({ _id: { $in: projectIds }, isActive: true })
                .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
                .lean()
            : Promise.resolve([]),
    ]);
    const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
    const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    return startups.map((startup) => buildStartupView(startup, startup.founderIds
        .map((founderId) => founderMap.get(String(founderId)))
        .filter((founder) => Boolean(founder)), startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined));
};
const getMarketplaceUserDetail = async (requesterRole, userId) => {
    const user = await user_model_1.User.findById(userId)
        .select('displayName avatar role innovationScore domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats')
        .lean();
    if (!user) {
        throw new ApiError_1.ApiError(404, 'USER_NOT_FOUND', 'User not found');
    }
    if (!MARKETPLACE_BROWSABLE_ROLES.has(requesterRole) || !MARKETPLACE_USER_ROLES.has(user.role)) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', 'This profile is not available in the marketplace');
    }
    const [jobs, startups] = await Promise.all([
        user.role === roles_types_1.UserRole.RECRUITER
            ? jobPost_model_1.JobPost.find({ recruiterId: userId, isActive: true })
                .sort({ createdAt: -1 })
                .limit(8)
                .lean()
            : Promise.resolve([]),
        startup_model_1.Startup.find({
            ...buildStartupVisibilityQuery(),
            founderIds: userId,
        })
            .select('_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt')
            .sort({ launchedAt: -1, updatedAt: -1 })
            .limit(6)
            .lean(),
    ]);
    const startupFounderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
    const startupProjectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];
    const [founders, workspaces] = await Promise.all([
        startupFounderIds.length > 0
            ? user_model_1.User.find({ _id: { $in: startupFounderIds } })
                .select('_id displayName avatar headline domain location bio innovationScore')
                .lean()
            : Promise.resolve([]),
        startupProjectIds.length > 0
            ? workspace_model_1.Workspace.find({ _id: { $in: startupProjectIds }, isActive: true })
                .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
                .lean()
            : Promise.resolve([]),
    ]);
    const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));
    const workspaceMap = new Map(workspaces.map((workspace) => [String(workspace._id), workspace]));
    return {
        ...attachUserCardMetadata(user, {
            jobs: jobs.length,
            startups: startups.length,
        }),
        relatedJobs: jobs.map((job) => (0, recruiter_mappers_1.mapJob)(job)),
        relatedStartups: startups.map((startup) => buildStartupView(startup, startup.founderIds
            .map((founderId) => founderMap.get(String(founderId)))
            .filter((founder) => Boolean(founder)), startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined)),
    };
};
const getMarketplaceStartupDetail = async (startupId) => {
    const startup = await startup_model_1.Startup.findOne({
        _id: startupId,
        ...buildStartupVisibilityQuery(),
    })
        .select('_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt')
        .lean();
    if (!startup) {
        throw new ApiError_1.ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
    }
    const [founders, workspace] = await Promise.all([
        startup.founderIds.length > 0
            ? user_model_1.User.find({ _id: { $in: startup.founderIds } })
                .select('_id displayName avatar headline domain location bio innovationScore')
                .lean()
            : Promise.resolve([]),
        startup.projectId
            ? workspace_model_1.Workspace.findOne({ _id: startup.projectId, isActive: true })
                .select('title category stage progressPercent updatedAt milestones tasks uploads repoSubmissions progressUpdates')
                .lean()
            : Promise.resolve(null),
    ]);
    return {
        ...buildStartupView(startup, founders, workspace),
        sharePool: {
            totalShares: startup.totalShares,
            availableShares: startup.availableShares,
            reservedForSole: startup.reservedForSole,
            currentPennyCount: startup.currentPennyCount,
            maxPennyInvestors: startup.maxPennyInvestors,
            hasSoleInvestor: startup.hasSoleInvestor,
        },
    };
};
const getMarketplaceEntity = async (requesterRole, entityType, entityId) => {
    if (requesterRole === roles_types_1.UserRole.RECRUITER && entityType !== roles_types_1.UserRole.STUDENT) {
        throw new ApiError_1.ApiError(403, 'CONNECTION_FORBIDDEN', 'Recruiters can only view student profiles in the marketplace');
    }
    if (entityType === 'startup') {
        return getMarketplaceStartupDetail(entityId);
    }
    if (!MARKETPLACE_USER_ROLES.has(entityType)) {
        throw new ApiError_1.ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
    }
    return getMarketplaceUserDetail(requesterRole, entityId);
};
exports.getMarketplaceEntity = getMarketplaceEntity;
const getMarketplaceUser = async (requesterRole, userId) => getMarketplaceUserDetail(requesterRole, userId);
exports.getMarketplaceUser = getMarketplaceUser;
