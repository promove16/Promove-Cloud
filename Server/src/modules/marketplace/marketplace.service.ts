import { Types } from 'mongoose';
import { ALLOWED_CONNECTIONS } from '../../middleware/connectionGuard';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { JobPost } from '../recruiter/jobPost.model';
import { mapJob } from '../recruiter/recruiter.mappers';
import { Startup } from '../startup/startup.model';
import { Workspace } from '../workspace/workspace.model';

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
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
};

type PublicStartup = {
  _id: Types.ObjectId;
  founderIds: Types.ObjectId[];
  projectId?: Types.ObjectId;
  name: string;
  tagline: string;
  category: string;
  stage: 'Pre-Idea' | 'Ideation' | 'MVP' | 'Pre-Launch' | 'Launched';
  pitchDeckUrl?: string;
  teamSize: number;
  fundingNeeded?: number;
  activeProducts: number;
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
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
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

const mapPublicUser = (user: PublicUser) => ({
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

const toStartupVisibility = (startup: PublicStartup) =>
  [
    startup.launchedToMentors ? 'Mentors' : null,
    startup.launchedToInvestors ? 'Investors' : null,
    startup.launchedToRecruiters ? 'Recruiters' : null,
  ].filter((entry): entry is string => Boolean(entry));

const mapFounder = (founder: MarketplaceFounder) => ({
  _id: String(founder._id),
  displayName: founder.displayName,
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

const buildStartupView = (
  requesterRole: UserRole,
  startup: PublicStartup,
  founders: MarketplaceFounder[],
  workspace?: MarketplaceWorkspace | null,
) => {
  const project = mapWorkspace(requesterRole, workspace);

  return {
    _id: String(startup._id),
    entityType: 'startup' as const,
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
    ...(project ? { project } : {}),
  };
};

const attachUserCardMetadata = (
  user: PublicUser,
  relatedCounts: MarketplaceUserRelatedCounts,
) => ({
  entityType: user.role as Extract<MarketplaceEntityType, UserRole>,
  ...mapPublicUser(user),
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

  if (!(ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(role)) {
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
      'displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats lastLogin discoverableToRecruiters',
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
    }),
  );
};

const listMarketplaceStartups = async (requesterRole: UserRole, search?: string, page = 1, limit = 20) => {
  const query = buildStartupVisibilityQuery(requesterRole, search);
  const [startups, total] = await Promise.all([
    Startup.find(query)
      .select(
        '_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt',
      )
      .sort({ launchedAt: -1, innovationScoreAtLaunch: -1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean<PublicStartup[]>(),
    Startup.countDocuments(query),
  ]);

  const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
  const projectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];

  const [founders, workspaces] = await Promise.all([
    founderIds.length > 0
      ? User.find({ _id: { $in: founderIds } })
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

  return startups.map((startup) =>
    buildStartupView(
      requesterRole,
      startup,
      startup.founderIds
        .map((founderId) => founderMap.get(String(founderId)))
        .filter((founder): founder is MarketplaceFounder => Boolean(founder)),
      startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined,
    ),
  );
};

const getMarketplaceUserDetail = async (requesterRole: UserRole, userId: string) => {
  const user = await User.findById(userId)
    .select(
      'displayName avatar role domain bio headline location websiteUrl githubUrl linkedinUrl skills experience education portfolioProjects githubStats discoverableToRecruiters',
    )
    .lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (!MARKETPLACE_USER_ROLES.has(user.role as MarketplaceEntityType)) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
  }

  if (!(ALLOWED_CONNECTIONS[requesterRole] ?? []).includes(user.role)) {
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
        '_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt',
      )
      .sort({ launchedAt: -1, updatedAt: -1 })
      .limit(6)
      .lean<PublicStartup[]>(),
  ]);

  const startupFounderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
  const startupProjectIds = [...new Set(startups.map((startup) => String(startup.projectId ?? '')).filter(Boolean))];

  const [founders, workspaces] = await Promise.all([
    startupFounderIds.length > 0
      ? User.find({ _id: { $in: startupFounderIds } })
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

  return {
    ...attachUserCardMetadata(user as PublicUser, {
      jobs: jobs.length,
      startups: startups.length,
    }),
    relatedJobs: jobs.map((job) => mapJob(job)),
    relatedStartups: startups.map((startup) =>
      buildStartupView(
        requesterRole,
        startup,
        startup.founderIds
          .map((founderId) => founderMap.get(String(founderId)))
          .filter((founder): founder is MarketplaceFounder => Boolean(founder)),
        startup.projectId ? workspaceMap.get(String(startup.projectId)) : undefined,
      ),
    ),
  };
};

const getMarketplaceStartupDetail = async (requesterRole: UserRole, startupId: string) => {
  const startup = await Startup.findOne({
    _id: startupId,
    ...buildStartupVisibilityQuery(requesterRole),
  })
    .select(
      '_id founderIds projectId name tagline category stage pitchDeckUrl teamSize fundingNeeded activeProducts launchedToInvestors launchedToMentors launchedToRecruiters launchedAt innovationScoreAtLaunch totalShares availableShares reservedForSole maxPennyInvestors currentPennyCount hasSoleInvestor traction isActive createdAt updatedAt',
    )
    .lean<PublicStartup | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  const [founders, workspace] = await Promise.all([
    startup.founderIds.length > 0
      ? User.find({ _id: { $in: startup.founderIds } })
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
    ...buildStartupView(requesterRole, startup, founders, workspace),
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
        }
      : {}),
  };
};

export const getMarketplaceEntity = async (
  requesterRole: UserRole,
  entityType: MarketplaceEntityType,
  entityId: string,
) => {
  if (entityType === 'startup') {
    return getMarketplaceStartupDetail(requesterRole, entityId);
  }

  if (!MARKETPLACE_USER_ROLES.has(entityType)) {
    throw new ApiError(400, 'INVALID_MARKETPLACE_ENTITY', 'Unsupported marketplace entity');
  }

  return getMarketplaceUserDetail(requesterRole, entityId);
};

export const getMarketplaceUser = async (requesterRole: UserRole, userId: string) =>
  getMarketplaceUserDetail(requesterRole, userId);
