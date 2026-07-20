import { Types } from 'mongoose';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { RelevanceBridge, RelevanceBridgeType } from './relevanceBridge.model';
import { ScoreEvent } from '../innovationScore/score.model';
import { Patent } from '../patent/patent.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { Event } from '../event/event.model';
import { JobPost } from './jobPost.model';
import { resolveEducationEntriesForUser } from '../user/user.service';
import {
  RecruiterDashboardData,
  RecruiterDashboardMatch,
  RecruiterListResponse,
  RecruiterMessageCheck,
  RecruiterTalentProfile,
  RecruiterTalentSummary,
} from './recruiter.types';
import {
  bridgePriority,
  createBridge,
  getBridgeType,
  getStartupCategories,
  getStudentCollegeId,
  getWorkspaceMap,
  mapInstitution,
  mapTalent,
  notifyUser,
  resolveInstitutionIds,
} from './recruiter.mappers';
import { talentQuerySchema } from './recruiter.schemas';
import { Workspace } from '../workspace/workspace.model';
import { MAX_INNOVATION_SCORE } from '../innovationScore/score.utils';

type TalentQuery = ReturnType<typeof talentQuerySchema.parse>;

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const canRecruiterViewStudent = (student: { discoverableToRecruiters?: boolean }, bridgeType?: RelevanceBridgeType | null) =>
  Boolean(student.discoverableToRecruiters || bridgeType);

const canRecruiterContactStudent = canRecruiterViewStudent;

const listTalent = async (
  recruiterId: string,
  query: TalentQuery,
  mode: 'pipeline' | 'discover',
): Promise<RecruiterListResponse<RecruiterTalentSummary>> => {
  const page = query.page;
  const limit = query.limit;
  const skip = (page - 1) * limit;

  const bridgeDocs = (await RelevanceBridge.find({ recruiterId, isActive: true })
    .select('studentId bridgeType')
    .lean()) as Array<{ studentId: Types.ObjectId; bridgeType?: RelevanceBridgeType }>;
  const bridgeMap = new Map<string, RelevanceBridgeType>();
  for (const bridge of bridgeDocs) {
    if (!bridge.bridgeType) {
      continue;
    }
    const existing = bridgeMap.get(String(bridge.studentId));
    if (!existing || bridgePriority(bridge.bridgeType) < bridgePriority(existing)) {
      bridgeMap.set(String(bridge.studentId), bridge.bridgeType);
    }
  }

  const studentFilter: Record<string, unknown> = {
    role: UserRole.STUDENT,
    isActive: true,
  };
  const baseClauses: Array<Record<string, unknown>> = [];

  if (typeof query.minScore === 'number' || typeof query.maxScore === 'number') {
    const normalizedMinScore =
      typeof query.minScore === 'number' ? Math.min(Math.max(query.minScore, 0), MAX_INNOVATION_SCORE) : undefined;
    const normalizedMaxScore =
      typeof query.maxScore === 'number' ? Math.min(Math.max(query.maxScore, 0), MAX_INNOVATION_SCORE) : undefined;

    studentFilter.innovationScore = {
      ...(typeof normalizedMinScore === 'number' ? { $gte: normalizedMinScore } : {}),
      ...(typeof normalizedMaxScore === 'number' && normalizedMaxScore < MAX_INNOVATION_SCORE
        ? { $lte: normalizedMaxScore }
        : {}),
    };
  }

  if (query.domain) {
    studentFilter.domain = new RegExp(escapeRegex(query.domain), 'i');
  }

  if (query.search) {
    const searchRegex = new RegExp(escapeRegex(query.search), 'i');
    const matchingWorkspaces = await Workspace.find({
      $or: [{ title: searchRegex }, { category: searchRegex }, { stage: searchRegex }],
    })
      .select('ownerId')
      .lean();
    studentFilter.$or = [
      { displayName: searchRegex },
      { domain: searchRegex },
      { headline: searchRegex },
      { _id: { $in: matchingWorkspaces.map((workspace) => workspace.ownerId) } },
    ];
  }

  const matchedInstitutionIds = await resolveInstitutionIds(query.institution);
  if (matchedInstitutionIds && matchedInstitutionIds.length > 0) {
    studentFilter.institutionId = { $in: matchedInstitutionIds };
  }

  if (mode === 'pipeline') {
    studentFilter._id = { $in: bridgeDocs.map((bridge) => bridge.studentId) };
  } else {
    baseClauses.push({
      $or: [{ discoverableToRecruiters: true }, { _id: { $in: bridgeDocs.map((bridge) => bridge.studentId) } }],
    });
  }

  if (baseClauses.length > 0) {
    const existingClauses = (studentFilter.$and as Array<Record<string, unknown>> | undefined) ?? [];
    studentFilter.$and = [...existingClauses, ...baseClauses];
  }

  const total = await User.countDocuments(studentFilter);
  const students = await User.find(studentFilter)
    .select('_id displayName avatar email domain innovationScore scoreBreakdown institutionId institutionProfile createdAt discoverableToRecruiters')
    .sort({ innovationScore: -1, createdAt: 1 })
    .skip(skip)
    .limit(limit)
    .lean();

  const studentIds = students.map((student) => String(student._id));
  const workspaceMap = await getWorkspaceMap(studentIds);
  const startupCategories = await getStartupCategories(studentIds);
  const institutionObjectIds = Array.from(
    new Set(students.map((student) => student.institutionId).filter((id): id is Types.ObjectId => Boolean(id))),
  );
  const institutions = institutionObjectIds.length
    ? await User.find({ _id: { $in: institutionObjectIds }, role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] } })
        .select('_id displayName institutionProfile')
        .lean()
    : [];
  const institutionMap = new Map(institutions.map((institution) => [String(institution._id), mapInstitution(institution)]));

  return {
    items: students.map((student) => {
      const studentId = String(student._id);
      const bridgeType = bridgeMap.get(studentId);
      const activeProject = workspaceMap.get(studentId);
      return mapTalent(student, {
        canContact: canRecruiterContactStudent(student, bridgeType),
        ...(bridgeType ? { bridgeType } : {}),
        ...(activeProject ? { activeProject } : {}),
        extraSkills: startupCategories.get(studentId) ?? [],
        ...(student.institutionId && institutionMap.get(String(student.institutionId))
          ? { institution: institutionMap.get(String(student.institutionId)) }
          : {}),
      });
    }),
    page,
    limit,
    total,
    nextPage: skip + students.length < total ? page + 1 : null,
  };
};

export const getRecruiterDashboard = async (recruiterId: string): Promise<RecruiterDashboardData> => {
  const [openPositions, shortlistedThisWeek, activeDrives, newScoreMatchCandidates, bridgeDocs] =
    await Promise.all([
      JobPost.countDocuments({ recruiterId, isActive: true }),
      PlacementRecord.countDocuments({
        recruiterId,
        status: 'Shortlisted',
        updatedAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      }),
      Event.countDocuments({ createdBy: recruiterId, isActive: true }),
      RelevanceBridge.countDocuments({ recruiterId, bridgeType: 'SCORE_MATCH', isActive: true }),
      RelevanceBridge.find({ recruiterId, isActive: true }).select('studentId bridgeType').lean(),
    ]);
  const normalizedBridgeDocs = bridgeDocs as Array<{ studentId: Types.ObjectId; bridgeType?: RelevanceBridgeType }>;

  const bridgeMap = new Map<string, RelevanceBridgeType>();
  for (const bridge of normalizedBridgeDocs) {
    if (!bridge.bridgeType) {
      continue;
    }
    const existing = bridgeMap.get(String(bridge.studentId));
    if (!existing || bridgePriority(bridge.bridgeType) < bridgePriority(existing)) {
      bridgeMap.set(String(bridge.studentId), bridge.bridgeType);
    }
  }

  const matchIds = Array.from(bridgeMap.entries())
    .filter(([, bridgeType]) => bridgeType === 'SCORE_MATCH')
    .map(([studentId]) => studentId);

  const students = matchIds.length
    ? await User.find({
        _id: { $in: matchIds },
        role: UserRole.STUDENT,
        isActive: true,
        $or: [{ discoverableToRecruiters: true }, { _id: { $in: matchIds } }],
      })
        .select('_id displayName avatar email domain innovationScore scoreBreakdown institutionId institutionProfile createdAt discoverableToRecruiters')
        .sort({ innovationScore: -1, createdAt: 1 })
        .limit(6)
        .lean()
    : [];

  const workspaceMap = await getWorkspaceMap(students.map((student) => String(student._id)));
  const startupCategories = await getStartupCategories(students.map((student) => String(student._id)));
  const institutionObjectIds = Array.from(
    new Set(students.map((student) => student.institutionId).filter((id): id is Types.ObjectId => Boolean(id))),
  );
  const institutions = institutionObjectIds.length
    ? await User.find({ _id: { $in: institutionObjectIds }, role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] } })
        .select('_id displayName institutionProfile')
        .lean()
    : [];
  const institutionMap = new Map(institutions.map((institution) => [String(institution._id), mapInstitution(institution)]));

  return {
    openPositions,
    shortlistedThisWeek,
    activeDrives,
    newScoreMatchCandidates,
    newMatches: students.map((student) => {
      const studentId = String(student._id);
      const activeProject = workspaceMap.get(studentId);
      const bridgeType = bridgeMap.get(studentId);
      return {
        ...mapTalent(student, {
          canContact: canRecruiterContactStudent(student, bridgeType),
          ...(bridgeType ? { bridgeType } : {}),
          ...(activeProject ? { activeProject } : {}),
          extraSkills: startupCategories.get(studentId) ?? [],
          ...(student.institutionId && institutionMap.get(String(student.institutionId))
            ? { institution: institutionMap.get(String(student.institutionId)) }
            : {}),
        }),
        headline: activeProject ? `${activeProject.title} in ${activeProject.category}` : 'Top score-match candidate',
      } satisfies RecruiterDashboardMatch;
    }),
  };
};

export const getRecruiterTalentPipeline = async (recruiterId: string, query: TalentQuery) =>
  listTalent(recruiterId, query, 'pipeline');

export const getRecruiterTalentDiscover = async (recruiterId: string, query: TalentQuery) =>
  listTalent(recruiterId, query, 'discover');

export const getRecruiterTalentProfile = async (
  recruiterId: string,
  studentId: string,
): Promise<RecruiterTalentProfile> => {
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select(
      '_id displayName avatar email bio headline domain innovationScore scoreBreakdown institutionId institutionProfile education experience portfolioProjects createdAt discoverableToRecruiters',
    )
    .lean();

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const bridgeType = await getBridgeType(recruiterId, studentId);
  if (!canRecruiterViewStudent(student, bridgeType)) {
    throw new ApiError(403, 'RECRUITER_PROFILE_FORBIDDEN', 'This student profile is not visible to recruiters');
  }
  const [scoreTimeline, workspaces, patents, startups] = await Promise.all([
    ScoreEvent.find({ userId: studentId }).sort({ createdAt: -1 }).limit(20).lean(),
    Workspace.find({ ownerId: studentId })
      .select('title category stage progressPercent updatedAt')
      .sort({ updatedAt: -1 })
      .lean(),
    Patent.find({ studentId }).select('projectTitle status submittedAt questionnaire.problemStatement').sort({ updatedAt: -1 }).lean(),
    Startup.find({ founderIds: studentId }).select('name category stage launchedAt').sort({ updatedAt: -1 }).lean(),
  ]);

  const activeProject = workspaces[0]
    ? {
        _id: String(workspaces[0]._id),
        title: workspaces[0].title,
        category: workspaces[0].category,
        stage: workspaces[0].stage,
        progressPercent: workspaces[0].progressPercent ?? 0,
        updatedAt: workspaces[0].updatedAt.toISOString(),
      }
    : undefined;

  const startupCategories = await getStartupCategories([studentId]);
  const institution = student.institutionId
    ? await User.findById(student.institutionId)
        .select('_id displayName institutionProfile')
        .lean()
    : null;
  const education = await resolveEducationEntriesForUser({
    role: student.role,
    institutionId: student.institutionId,
    email: student.email,
    education: student.education,
  });
  const talent = mapTalent(student, {
    canContact: canRecruiterContactStudent(student, bridgeType),
    ...(bridgeType ? { bridgeType } : {}),
    ...(activeProject ? { activeProject } : {}),
    extraSkills: startupCategories.get(studentId) ?? [],
    ...(institution ? { institution: mapInstitution(institution) } : {}),
  });

  const canSeeExpandedWorkspaceData = Boolean(bridgeType);
  const canSeeSensitivePatentDetails = Boolean(bridgeType);

  return {
    ...talent,
    bio: student.bio,
    headline: student.headline,
    scoreTimeline: canSeeExpandedWorkspaceData
      ? scoreTimeline.map((event) => ({
          _id: String(event._id),
          trigger: event.trigger,
          delta: event.delta,
          scoreAfter: event.scoreAfter,
          createdAt: event.createdAt.toISOString(),
        }))
      : [],
    workspaces: canSeeExpandedWorkspaceData
      ? workspaces.map((workspace) => ({
          _id: String(workspace._id),
          title: workspace.title,
          category: workspace.category,
          stage: workspace.stage,
          progressPercent: workspace.progressPercent ?? 0,
          updatedAt: workspace.updatedAt.toISOString(),
        }))
      : [],
    patents: patents.map((patent) => ({
      _id: String(patent._id),
      projectTitle: patent.projectTitle,
      status: patent.status,
      ...(canSeeSensitivePatentDetails && patent.questionnaire?.problemStatement
        ? { problemStatement: patent.questionnaire.problemStatement }
        : {}),
      submittedAt: patent.submittedAt.toISOString(),
    })),
    startups: startups.map((startup) => ({
      _id: String(startup._id),
      name: startup.name,
      category: startup.category,
      stage: startup.stage,
      ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
    })),
    education: education.map((education) => ({
      _id: String(education._id),
      institution: education.institution,
      degree: education.degree,
      fieldOfStudy: education.fieldOfStudy,
      endYear: education.endYear,
      grade: education.grade,
    })),
    experience: (student.experience ?? []).map((experience) => ({
      _id: String(experience._id),
      title: experience.title,
      company: experience.company,
      type: experience.type,
      startDate: experience.startDate.toISOString(),
      ...(experience.endDate ? { endDate: experience.endDate.toISOString() } : { endDate: null }),
      isCurrent: experience.isCurrent,
      description: experience.description,
      skills: experience.skills,
    })),
    portfolioProjects: (student.portfolioProjects ?? []).map((project) => ({
      _id: String(project._id),
      title: project.title,
      description: project.description,
      techStack: project.techStack,
      ...(project.startDate ? { startDate: project.startDate.toISOString() } : { startDate: null }),
      ...(project.endDate ? { endDate: project.endDate.toISOString() } : { endDate: null }),
      isCurrent: project.isCurrent,
    })),
  };
};

export const getRecruiterMessageCheck = async (
  recruiterId: string,
  studentId: string,
): Promise<RecruiterMessageCheck> => {
  const bridgeType = await getBridgeType(recruiterId, studentId);
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id discoverableToRecruiters')
    .lean<{ _id: Types.ObjectId; discoverableToRecruiters?: boolean } | null>();

  return {
    canContact: Boolean(student && canRecruiterContactStudent(student, bridgeType)),
    ...(bridgeType ? { bridgeType } : {}),
  };
};

export const shortlistStudent = async (recruiterId: string, studentId: string) => {
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id innovationScore')
    .lean();

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const existingBridgeType = await getBridgeType(recruiterId, studentId);
  await createBridge(recruiterId, studentId, 'HR_SHORTLIST');

  const collegeId = await getStudentCollegeId(studentId);
  if (collegeId) {
    await PlacementRecord.updateOne(
      { recruiterId, studentId, collegeId },
      {
        recruiterId,
        studentId,
        collegeId,
        status: 'Shortlisted',
        innovationScoreAtTime: student.innovationScore ?? 0,
      },
      { upsert: true },
    );
  }

  if (existingBridgeType !== 'HR_SHORTLIST') {
    await notifyUser(studentId, 'A recruiter shortlisted your profile', 'A recruiter shortlisted your profile.', '/dashboard/student');
  }

  return { bridgeCreated: true };
};

export const removeShortlist = async (recruiterId: string, studentId: string) => {
  const updateResult = await RelevanceBridge.updateOne(
    { recruiterId, studentId, bridgeType: 'HR_SHORTLIST' },
    { $set: { isActive: false } },
  );
  if (updateResult.matchedCount === 0) {
    return { bridgeCreated: false };
  }

  const collegeId = await getStudentCollegeId(studentId);
  if (collegeId) {
    await PlacementRecord.updateOne(
      { recruiterId, studentId, collegeId, status: 'Shortlisted' },
      { status: 'Discovered' },
    );
  }
  return { bridgeCreated: false };
};

export const sendRecruiterMessage = async (recruiterId: string, studentId: string, body?: string) => {
  const bridgeType = await getBridgeType(recruiterId, studentId);
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id displayName discoverableToRecruiters')
    .lean<{ _id: Types.ObjectId; displayName: string; discoverableToRecruiters?: boolean } | null>();

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  if (!canRecruiterContactStudent(student, bridgeType)) {
    throw new ApiError(
      403,
      'RELEVANCE_REQUIRED',
      'You can reach out only after the student is publicly discoverable or a recruiter bridge exists.',
    );
  }

  await notifyUser(
    studentId,
    'New message from recruiter',
    body ??
      (bridgeType
        ? `A recruiter reached out after your ${bridgeType.replace('_', ' ').toLowerCase()} bridge was created.`
        : 'A recruiter reached out after viewing your public recruiter profile.'),
  );

  return { sent: true };
};
