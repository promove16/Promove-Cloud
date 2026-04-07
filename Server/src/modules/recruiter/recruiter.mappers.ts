import { Types } from 'mongoose';
import { NotificationService } from '../notification/notification.service';
import { io } from '../../config/socket';
import { RelevanceBridge, RelevanceBridgeType } from './relevanceBridge.model';
import { Startup } from '../startup/startup.model';
import { User } from '../user/user.model';
import { Workspace } from '../workspace/workspace.model';
import { UserRole } from '../../types/roles.types';
import { normalizeInnovationScore, normalizeScoreBreakdown } from '../innovationScore/score.utils';
import {
  RecruiterCollegeCard,
  RecruiterDriveView,
  RecruiterInstitutionSummary,
  RecruiterJobView,
  RecruiterPlacementRow,
  RecruiterTalentProject,
  RecruiterTalentSummary,
} from './recruiter.types';

const escapeRegex = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const mapInstitution = (institution?: {
  _id: Types.ObjectId;
  displayName: string;
  institutionProfile?: {
    location: string;
    academicYear: string;
    iicStarRating: number;
  };
}) =>
  institution
    ? {
        _id: String(institution._id),
        name: institution.displayName,
        location: institution.institutionProfile?.location ?? 'Unknown',
        academicYear: institution.institutionProfile?.academicYear,
        iicStarRating: institution.institutionProfile?.iicStarRating,
      }
    : undefined;

export const getSkills = (domain?: string, activeCategory?: string, extraCategories: string[] = []) =>
  Array.from(
    new Set(
      [domain, activeCategory, ...extraCategories].filter(
        (item): item is string => Boolean(item && item.trim().length > 0),
      ),
    ),
  );

export const bridgePriority = (bridgeType?: RelevanceBridgeType) => {
  switch (bridgeType) {
    case 'HR_SHORTLIST':
      return 0;
    case 'ACTIVE_APPLICATION':
      return 1;
    case 'SCORE_MATCH':
      return 2;
    case 'LAUNCH_TRIGGER':
      return 3;
    default:
      return 4;
  }
};

export const mapTalent = (
  student: {
    _id: Types.ObjectId;
    displayName: string;
    avatar?: string;
    email: string;
    domain?: string;
    innovationScore: number;
    scoreBreakdown: RecruiterTalentSummary['scoreBreakdown'];
    institutionId?: Types.ObjectId | null;
    institutionProfile?: {
      location: string;
      academicYear: string;
      iicStarRating: number;
      institutionName: string;
    };
    createdAt: Date;
  },
  params: {
    canContact: boolean;
    bridgeType?: RelevanceBridgeType;
    activeProject?: RecruiterTalentProject;
    extraSkills?: string[];
    institution?: RecruiterInstitutionSummary;
  },
): RecruiterTalentSummary => ({
  _id: String(student._id),
  displayName: student.displayName,
  ...(student.avatar ? { avatar: student.avatar } : {}),
  innovationScore: normalizeInnovationScore(student.innovationScore),
  scoreBreakdown: normalizeScoreBreakdown(student.scoreBreakdown),
  skills: getSkills(student.domain, params.activeProject?.category, params.extraSkills ?? []),
  ...(params.institution
    ? {
        institution: params.institution,
      }
    : student.institutionId
    ? {
        institution: mapInstitution({
          _id: student.institutionId,
          displayName: student.institutionProfile?.institutionName ?? 'Institution',
          institutionProfile: {
            location: student.institutionProfile?.location ?? 'Unknown',
            academicYear: student.institutionProfile?.academicYear ?? 'AY',
            iicStarRating: student.institutionProfile?.iicStarRating ?? 0,
          },
        }),
      }
    : {}),
  ...(params.activeProject ? { activeProject: params.activeProject } : {}),
  canContact: params.canContact,
  ...(params.bridgeType ? { bridgeType: params.bridgeType } : {}),
  ...(params.canContact ? { contactEmail: student.email } : {}),
  createdAt: student.createdAt.toISOString(),
});

export const mapJob = (job: {
  _id: Types.ObjectId;
  recruiterId: Types.ObjectId;
  title: string;
  company: string;
  description: string;
  domain: string;
  minimumInnovationScore: number;
  type: RecruiterJobView['type'];
  location: string;
  workMode?: RecruiterJobView['workMode'];
  salaryExpectation?: string;
  experienceLevel?: string;
  openings?: number;
  companyOverview?: string;
  roleSummary?: string;
  keyResponsibilities?: string[];
  requirements?: string[];
  benefits?: string[];
  applicationSteps?: string[];
  isActive: boolean;
  applicantIds: Types.ObjectId[];
  shortlistedIds: Types.ObjectId[];
  createdAt: Date;
  expiresAt?: Date;
}, options?: {
  hasApplied?: boolean;
}): RecruiterJobView => ({
  _id: String(job._id),
  recruiterId: String(job.recruiterId),
  title: job.title,
  company: job.company,
  description: job.description,
  domain: job.domain,
  minimumInnovationScore: job.minimumInnovationScore ?? 0,
  type: job.type,
  location: job.location,
  ...(job.workMode ? { workMode: job.workMode } : {}),
  ...(job.salaryExpectation ? { salaryExpectation: job.salaryExpectation } : {}),
  ...(job.experienceLevel ? { experienceLevel: job.experienceLevel } : {}),
  ...(typeof job.openings === 'number' ? { openings: job.openings } : {}),
  ...(job.companyOverview ? { companyOverview: job.companyOverview } : {}),
  ...(job.roleSummary ? { roleSummary: job.roleSummary } : {}),
  keyResponsibilities: job.keyResponsibilities ?? [],
  requirements: job.requirements ?? [],
  benefits: job.benefits ?? [],
  applicationSteps: job.applicationSteps ?? [],
  isActive: job.isActive,
  applicantCount: job.applicantIds.length,
  shortlistedCount: job.shortlistedIds.length,
  ...(typeof options?.hasApplied === 'boolean' ? { hasApplied: options.hasApplied } : {}),
  createdAt: job.createdAt.toISOString(),
  ...(job.expiresAt ? { expiresAt: job.expiresAt.toISOString() } : {}),
});

export const mapDrive = async (drive: {
  _id: Types.ObjectId;
  recruiterId: Types.ObjectId;
  collegeId: Types.ObjectId;
  title: string;
  description: string;
  type: RecruiterDriveView['type'];
  scheduledAt: Date;
  minimumInnovationScore: number;
  registeredStudents: Array<{
    studentId: Types.ObjectId;
    registeredAt: Date;
    submissionScore?: number;
  }>;
  isActive: boolean;
  createdAt: Date;
},
collegeName: string,
students: Array<{ _id: Types.ObjectId; displayName: string; avatar?: string; innovationScore: number }>) => {
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  return {
    _id: String(drive._id),
    recruiterId: String(drive.recruiterId),
    collegeId: String(drive.collegeId),
    collegeName,
    title: drive.title,
    description: drive.description,
    type: drive.type,
    scheduledAt: drive.scheduledAt.toISOString(),
    minimumInnovationScore: drive.minimumInnovationScore ?? 0,
    registeredStudents: drive.registeredStudents
      .map((entry) => {
        const student = studentMap.get(String(entry.studentId));
        return {
          studentId: String(entry.studentId),
          studentName: student?.displayName ?? 'Student',
          ...(student?.avatar ? { avatar: student.avatar } : {}),
          innovationScore: normalizeInnovationScore(student?.innovationScore ?? 0),
          registeredAt: entry.registeredAt.toISOString(),
          ...(typeof entry.submissionScore === 'number' ? { submissionScore: entry.submissionScore } : {}),
        };
      })
      .sort((left, right) => right.innovationScore - left.innovationScore),
    isActive: drive.isActive,
    createdAt: drive.createdAt.toISOString(),
  } satisfies RecruiterDriveView;
};

export const mapPlacement = (
  placement: {
    _id: Types.ObjectId;
    studentId: Types.ObjectId;
    collegeId: Types.ObjectId;
    companyName?: string;
    status: RecruiterPlacementRow['status'];
    innovationScoreAtTime: number;
    updatedAt: Date;
  },
  student?: { _id: Types.ObjectId; displayName: string; avatar?: string; innovationScore: number },
  collegeName?: string,
): RecruiterPlacementRow => ({
  _id: String(placement._id),
  studentId: String(placement.studentId),
  studentName: student?.displayName ?? 'Student',
  ...(student?.avatar ? { avatar: student.avatar } : {}),
  ...(collegeName ? { collegeName } : {}),
  status: placement.status,
  ...(placement.companyName ? { companyName: placement.companyName } : {}),
  innovationScore: normalizeInnovationScore(student?.innovationScore ?? placement.innovationScoreAtTime ?? 0),
  updatedAt: placement.updatedAt.toISOString(),
});

export const mapCollege = (college: {
  _id: Types.ObjectId;
  displayName: string;
  institutionProfile?: {
    location: string;
    totalStudentsEnrolled: number;
    studentsPlaced?: number;
    iicStarRating: number;
    stats?: {
      topHiringSector?: string;
    };
  };
}): RecruiterCollegeCard => {
  const total = college.institutionProfile?.totalStudentsEnrolled ?? 0;
  const placed = college.institutionProfile?.studentsPlaced ?? 0;
  return {
    _id: String(college._id),
    displayName: college.displayName,
    location: college.institutionProfile?.location ?? 'Unknown',
    studentCount: total,
    placementVelocity: total > 0 ? Number(((placed / total) * 100).toFixed(2)) : 0,
    iicStarRating: college.institutionProfile?.iicStarRating ?? 0,
    focusLabel: college.institutionProfile?.stats?.topHiringSector ?? 'Not added',
  };
};

export const notifyUser = async (
  userId: string,
  title: string,
  body: string,
  link = '/dashboard/student',
) => {
  const notification = await NotificationService.create({
    userId,
    type: 'system',
    title,
    body,
    link,
  });
  if (io) {
    io.of('/notifications').to(`user:${userId}`).emit('notification:new', notification);
  }
  return notification;
};

export const createBridge = async (
  recruiterId: string,
  studentId: string,
  bridgeType: RelevanceBridgeType,
) => {
  const existingBridge = await RelevanceBridge.findOne({ recruiterId, studentId })
    .select('bridgeType isActive')
    .lean<{ bridgeType?: RelevanceBridgeType; isActive?: boolean }>();

  if (
    existingBridge?.isActive &&
    existingBridge.bridgeType &&
    bridgePriority(existingBridge.bridgeType) <= bridgePriority(bridgeType)
  ) {
    return;
  }

  await RelevanceBridge.updateOne(
    { recruiterId, studentId },
    {
      $set: {
        recruiterId,
        studentId,
        bridgeType,
        isActive: true,
      },
    },
    { upsert: true },
  );
};

export const getBridgeType = async (recruiterId: string, studentId: string) => {
  const bridge = await RelevanceBridge.findOne({
    recruiterId,
    studentId,
    isActive: true,
  })
    .select('bridgeType')
    .lean<{ bridgeType?: RelevanceBridgeType }>();

  return bridge?.bridgeType;
};

export const getWorkspaceMap = async (studentIds: string[]) => {
  const workspaces = await Workspace.find({
    ownerId: { $in: studentIds },
    isActive: true,
  })
    .select('ownerId title category stage progressPercent updatedAt')
    .sort({ updatedAt: -1 })
    .lean();

  const map = new Map<string, RecruiterTalentProject>();
  for (const workspace of workspaces) {
    const key = String(workspace.ownerId);
    if (!map.has(key)) {
      map.set(key, {
        _id: String(workspace._id),
        title: workspace.title,
        category: workspace.category,
        stage: workspace.stage,
        progressPercent: workspace.progressPercent ?? 0,
        updatedAt: workspace.updatedAt.toISOString(),
      });
    }
  }

  return map;
};

export const getStartupCategories = async (studentIds: string[]) => {
  const startups = await Startup.find({
    founderIds: { $in: studentIds },
    isActive: true,
  })
    .select('founderIds category')
    .lean();

  const map = new Map<string, string[]>();
  for (const startup of startups) {
    for (const founderId of startup.founderIds) {
      const key = String(founderId);
      const categories = map.get(key) ?? [];
      categories.push(startup.category);
      map.set(key, categories);
    }
  }

  return map;
};

export const resolveInstitutionIds = async (institution?: string) => {
  if (!institution) {
    return undefined;
  }

  const ids = new Set<string>();
  if (Types.ObjectId.isValid(institution)) {
    ids.add(institution);
  }

  const matches = await User.find({
    role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] },
    'institutionProfile.institutionName': new RegExp(escapeRegex(institution), 'i'),
  })
    .select('_id')
    .lean();

  matches.forEach((match) => ids.add(String(match._id)));
  return Array.from(ids);
};

export const getStudentCollegeId = async (studentId: string) => {
  const student = await User.findById(studentId).select('institutionId role').lean();
  if (!student || student.role !== UserRole.STUDENT || !student.institutionId) {
    return undefined;
  }

  const college = await User.findById(student.institutionId).select('role').lean();
  return college?.role === UserRole.COLLEGE ? String(student.institutionId) : undefined;
};
