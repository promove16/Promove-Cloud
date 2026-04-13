import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { normalizeInnovationScore } from '../innovationScore/score.utils';
import { CampusDrive } from './campusDrive.model';
import { PlacementRecord } from '../college/placementRecord.model';
import { RequestRecord } from '../request/request.model';
import { createRequestRecord } from '../request/request.service';
import { User } from '../user/user.model';
import { createBridge, getStudentCollegeId, mapCollege, mapDrive, notifyUser } from './recruiter.mappers';
import { RecruiterCollegeCard, RecruiterDriveView, RecruiterPlacementRow } from './recruiter.types';
import { driveCreateSchema } from './recruiter.schemas';
import { z } from 'zod';
import { JobPost, type JobApplicationStage } from './jobPost.model';

type OnboardingRecordLike = {
  _id: string;
  studentId: string;
  collegeId?: string;
  companyName?: string;
  status: RecruiterPlacementRow['status'];
  innovationScoreAtTime: number;
  updatedAt: Date;
  createdAt: Date;
};

const APPLICATION_STAGE_TO_ONBOARDING_STATUS: Partial<
  Record<JobApplicationStage, RecruiterPlacementRow['status'] | null>
> = {
  'Invited Pending': null,
  'Invite Accepted': 'In Progress',
  'Invite Declined': null,
  Applied: 'In Progress',
  Screening: 'In Progress',
  Shortlisted: 'Shortlisted',
  Interview: 'In Progress',
  Offered: 'In Progress',
  Hired: 'Hired',
  Rejected: 'Rejected',
};

const ONBOARDING_STATUS_PRIORITY: Record<RecruiterPlacementRow['status'], number> = {
  Hired: 5,
  Shortlisted: 4,
  'In Progress': 3,
  Discovered: 2,
  Rejected: 1,
};

const shouldReplaceOnboardingRecord = (
  current: OnboardingRecordLike | undefined,
  next: OnboardingRecordLike,
) => {
  if (!current) {
    return true;
  }

  const currentPriority = ONBOARDING_STATUS_PRIORITY[current.status] ?? 0;
  const nextPriority = ONBOARDING_STATUS_PRIORITY[next.status] ?? 0;

  if (nextPriority !== currentPriority) {
    return nextPriority > currentPriority;
  }

  return next.updatedAt.getTime() > current.updatedAt.getTime();
};

export const getLinkedCollegeIdsForRecruiter = async (recruiterId: string): Promise<string[]> => {
  const requests = await RequestRecord.find({
    type: 'college_recruiter_partnership',
    fromUserId: recruiterId,
    targetEntityType: 'college',
    status: 'accepted',
  })
    .select('targetEntityId')
    .lean();

  return [...new Set(requests.map((request) => request.targetEntityId))];
};

export const assertRecruiterLinkedToCollege = async (
  recruiterId: string,
  collegeId: string,
): Promise<void> => {
  const linkedCollegeIds = await getLinkedCollegeIdsForRecruiter(recruiterId);
  if (!linkedCollegeIds.includes(collegeId)) {
    throw new ApiError(
      403,
      'COLLEGE_NOT_LINKED',
      'Recruiter can only create hiring events for colleges with an accepted partnership.',
    );
  }
};

export const getRecruiterDrives = async (recruiterId: string): Promise<RecruiterDriveView[]> => {
  const drives = await CampusDrive.find({ recruiterId }).sort({ scheduledAt: -1 }).lean();
  const mapped = await Promise.all(
    drives.map(async (drive) => {
      const college = await User.findById(drive.collegeId).select('displayName').lean();
      const students = drive.registeredStudents.length
        ? await User.find({ _id: { $in: drive.registeredStudents.map((entry) => entry.studentId) } })
            .select('_id displayName avatar innovationScore')
            .lean()
        : [];
      return mapDrive(drive, college?.displayName ?? 'Unknown College', students);
    }),
  );
  return mapped;
};

export const createRecruiterDrive = async (
  recruiterId: string,
  payload: z.infer<typeof driveCreateSchema>,
) => {
  const drive = await CampusDrive.create({
    recruiterId,
    collegeId: payload.collegeId,
    title: payload.title,
    description: payload.description,
    type: payload.type,
    scheduledAt: new Date(payload.scheduledAt),
    minimumInnovationScore: payload.minimumInnovationScore,
  });

  return mapDrive(
    drive.toObject(),
    (await User.findById(payload.collegeId).select('displayName').lean())?.displayName ?? 'Unknown College',
    [],
  );
};

export const registerForDrive = async (studentId: string, driveId: string) => {
  const drive = await CampusDrive.findOne({ _id: driveId, isActive: true }).lean();
  if (!drive) {
    throw new ApiError(404, 'DRIVE_NOT_FOUND', 'Campus drive not found');
  }

  await createBridge(String(drive.recruiterId), studentId, 'ACTIVE_APPLICATION');

  await CampusDrive.updateOne(
    {
      _id: driveId,
      'registeredStudents.studentId': { $ne: studentId },
    },
    {
      $push: {
        registeredStudents: {
          studentId,
          registeredAt: new Date(),
        },
      },
    },
  );

  return { registered: true };
};

export const submitDriveScore = async (
  recruiterId: string,
  driveId: string,
  studentId: string,
  submissionScore: number,
) => {
  const drive = await CampusDrive.findOne({ _id: driveId, recruiterId }).lean();
  if (!drive) {
    throw new ApiError(404, 'DRIVE_NOT_FOUND', 'Campus drive not found');
  }

  const existing = drive.registeredStudents.find((entry) => String(entry.studentId) === studentId);
  if (!existing) {
    throw new ApiError(404, 'STUDENT_NOT_REGISTERED', 'Student is not registered for this drive');
  }

  await CampusDrive.updateOne(
    { _id: driveId, 'registeredStudents.studentId': studentId },
    { $set: { 'registeredStudents.$.submissionScore': submissionScore } },
  );

  return { updated: true };
};

export const closeRecruiterDrive = async (recruiterId: string, driveId: string) => {
  const drive = await CampusDrive.findOne({ _id: driveId, recruiterId });
  if (!drive) {
    throw new ApiError(404, 'DRIVE_NOT_FOUND', 'Campus drive not found');
  }

  drive.isActive = false;
  await drive.save();

  return { updated: true };
};

export const getRecruiterColleges = async (): Promise<RecruiterCollegeCard[]> => {
  const colleges = await User.find({
    role: UserRole.COLLEGE,
    isActive: true,
  })
    .select('_id displayName institutionProfile')
    .sort({ updatedAt: -1 })
    .lean();

  return colleges.map(mapCollege);
};

export const getRecruiterLinkedColleges = async (recruiterId: string): Promise<RecruiterCollegeCard[]> => {
  const linkedCollegeIds = await getLinkedCollegeIdsForRecruiter(recruiterId);
  if (linkedCollegeIds.length === 0) {
    return [];
  }

  const colleges = await User.find({
    _id: { $in: linkedCollegeIds },
    role: UserRole.COLLEGE,
    isActive: true,
  })
    .select('_id displayName institutionProfile')
    .sort({ updatedAt: -1 })
    .lean();

  return colleges.map(mapCollege);
};

export const getRecruiterOnboarding = async (recruiterId: string): Promise<RecruiterPlacementRow[]> => {
  const [placements, jobs] = await Promise.all([
    PlacementRecord.find({ recruiterId }).sort({ updatedAt: -1 }).lean(),
    JobPost.find({ recruiterId })
      .select('company createdAt applicantIds shortlistedIds applicationRecords')
      .sort({ createdAt: -1 })
      .lean(),
  ]);

  const derivedRecords = new Map<string, OnboardingRecordLike>();

  jobs.forEach((job) => {
    const shortlistedIds = new Set(job.shortlistedIds.map((id) => String(id)));
    const seenStudentIds = new Set<string>();

    (job.applicationRecords ?? []).forEach((record) => {
      const studentId = String(record.studentId);
      seenStudentIds.add(studentId);

      const baseStatus = APPLICATION_STAGE_TO_ONBOARDING_STATUS[record.stage];
      const status =
        shortlistedIds.has(studentId) && baseStatus !== 'Hired' && baseStatus !== 'Rejected'
          ? 'Shortlisted'
          : baseStatus;

      if (!status) {
        return;
      }

      const nextRecord: OnboardingRecordLike = {
        _id: `job-${String(job._id)}-${studentId}`,
        studentId,
        companyName: job.company,
        status,
        innovationScoreAtTime: 0,
        updatedAt: record.updatedAt,
        createdAt: record.appliedAt,
      };

      if (shouldReplaceOnboardingRecord(derivedRecords.get(studentId), nextRecord)) {
        derivedRecords.set(studentId, nextRecord);
      }
    });

    job.shortlistedIds.forEach((studentObjectId) => {
      const studentId = String(studentObjectId);
      if (seenStudentIds.has(studentId)) {
        return;
      }

      const nextRecord: OnboardingRecordLike = {
        _id: `job-${String(job._id)}-${studentId}`,
        studentId,
        companyName: job.company,
        status: 'Shortlisted',
        innovationScoreAtTime: 0,
        updatedAt: job.createdAt,
        createdAt: job.createdAt,
      };

      if (shouldReplaceOnboardingRecord(derivedRecords.get(studentId), nextRecord)) {
        derivedRecords.set(studentId, nextRecord);
      }
    });
  });

  const persistedRecords = placements.map<OnboardingRecordLike>((placement) => ({
    _id: String(placement._id),
    studentId: String(placement.studentId),
    collegeId: String(placement.collegeId),
    ...(placement.companyName ? { companyName: placement.companyName } : {}),
    status: placement.status,
    innovationScoreAtTime: placement.innovationScoreAtTime ?? 0,
    updatedAt: placement.updatedAt,
    createdAt: placement.createdAt,
  }));

  const combinedRecords = new Map<string, OnboardingRecordLike>(derivedRecords);
  persistedRecords.forEach((record) => {
    combinedRecords.set(record.studentId, record);
  });

  if (combinedRecords.size === 0) {
    return [];
  }

  const records = Array.from(combinedRecords.values()).sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
  const studentIds = records.map((record) => record.studentId);

  const students = await User.find({ _id: { $in: studentIds } })
    .select('_id displayName avatar innovationScore institutionId')
    .lean();
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  const collegeIds = Array.from(
    new Set(
      records
        .map((record) => record.collegeId ?? String(studentMap.get(record.studentId)?.institutionId ?? ''))
        .filter((collegeId) => Boolean(collegeId && collegeId !== 'undefined')),
    ),
  );

  const colleges = await User.find({ _id: { $in: collegeIds }, role: UserRole.COLLEGE })
    .select('_id displayName')
    .lean();
  const collegeMap = new Map(colleges.map((college) => [String(college._id), college.displayName]));

  return records.map((record) => {
    const student = studentMap.get(record.studentId);
    const collegeId = record.collegeId ?? String(student?.institutionId ?? '');

    return {
      _id: record._id,
      studentId: record.studentId,
      studentName: student?.displayName ?? 'Student',
      ...(student?.avatar ? { avatar: student.avatar } : {}),
      ...(collegeMap.get(collegeId) ? { collegeName: collegeMap.get(collegeId) } : {}),
      status: record.status,
      ...(record.companyName ? { companyName: record.companyName } : {}),
      innovationScore: normalizeInnovationScore(
        student?.innovationScore ?? record.innovationScoreAtTime ?? 0,
      ),
      updatedAt: record.updatedAt.toISOString(),
    } satisfies RecruiterPlacementRow;
  });
};

export const sendOnboardingReminder = async (
  recruiterId: string,
  studentId: string,
  message?: string,
) => {
  const placement = await PlacementRecord.findOne({ recruiterId, studentId }).lean();
  if (!placement) {
    throw new ApiError(404, 'PLACEMENT_NOT_FOUND', 'No onboarding record exists for this student');
  }

  const recruiter = await User.findById(recruiterId).select('displayName').lean();
  const recruiterName = recruiter?.displayName ?? 'Your recruiter';
  const body =
    message?.trim() ||
    `${recruiterName} sent a reminder about your onboarding. Please review your pending steps.`;

  await notifyUser(studentId, 'Onboarding reminder', body, '/dashboard/student');

  return { sent: true };
};

export const requestCollegePartnership = async (
  recruiterId: string,
  collegeId: string,
  message?: string,
) => {
  const college = await User.findOne({ _id: collegeId, role: UserRole.COLLEGE, isActive: true })
    .select('_id displayName')
    .lean();
  if (!college) {
    throw new ApiError(404, 'COLLEGE_NOT_FOUND', 'College not found');
  }

  const recruiter = await User.findById(recruiterId).select('displayName').lean();
  const recruiterName = recruiter?.displayName ?? 'A recruiter';
  const body =
    message?.trim() ||
    `${recruiterName} is interested in partnering with ${college.displayName} for placements and drives.`;

  const existingAccepted = await RequestRecord.findOne({
    type: 'college_recruiter_partnership',
    fromUserId: recruiterId,
    targetEntityType: 'college',
    targetEntityId: String(college._id),
    status: 'accepted',
  })
    .select('_id')
    .lean();

  if (existingAccepted) {
    return { sent: true, alreadyLinked: true };
  }

  await createRequestRecord({
    type: 'college_recruiter_partnership',
    actionType: 'partner',
    fromUserId: recruiterId,
    toUserId: String(college._id),
    targetEntityType: 'college',
    targetEntityId: String(college._id),
    targetEntityTitle: college.displayName,
    targetRole: UserRole.COLLEGE,
    requestedRole: 'partner',
    message: body,
    metadata: {
      recruiterId,
      collegeId: String(college._id),
      recruiterName,
    },
    deepLink: '/dashboard/invitations',
    acceptRedirect: '/dashboard/college',
    declineRedirect: '/dashboard/college',
  });

  return { sent: true };
};

export const markStudentHired = async (recruiterId: string, studentId: string, companyName: string) => {
  const student = await User.findOne({
    _id: studentId,
    role: UserRole.STUDENT,
    isActive: true,
  })
    .select('_id displayName institutionId innovationScore')
    .lean();

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const collegeId = await getStudentCollegeId(studentId);
  if (!collegeId) {
    throw new ApiError(404, 'COLLEGE_NOT_FOUND', 'Student is not linked to a college institution');
  }

  await PlacementRecord.updateOne(
    { recruiterId, studentId, collegeId },
    {
      recruiterId,
      studentId,
      collegeId,
      companyName,
      status: 'Hired',
      innovationScoreAtTime: student.innovationScore ?? 0,
    },
    { upsert: true },
  );

  await notifyUser(studentId, `Congratulations! You have been hired by ${companyName}`, `Congratulations! You have been hired by ${companyName}.`);

  const collegeAdmin = await User.findById(collegeId).select('_id').lean();
  if (collegeAdmin) {
    await notifyUser(
      String(collegeAdmin._id),
      `${student.displayName} has been hired by ${companyName}`,
      `${student.displayName} has been hired by ${companyName}.`,
      '/dashboard/college/placement',
    );
  }

  return { updated: true };
};
