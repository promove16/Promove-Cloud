import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { CampusDrive } from './campusDrive.model';
import { PlacementRecord } from '../college/placementRecord.model';
import { User } from '../user/user.model';
import { createBridge, getStudentCollegeId, mapCollege, mapDrive, mapPlacement, notifyUser } from './recruiter.mappers';
import { RecruiterCollegeCard, RecruiterDriveView, RecruiterPlacementRow } from './recruiter.types';
import { driveCreateSchema } from './recruiter.schemas';
import { z } from 'zod';

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

export const getRecruiterOnboarding = async (recruiterId: string): Promise<RecruiterPlacementRow[]> => {
  const placements = await PlacementRecord.find({ recruiterId }).sort({ updatedAt: -1 }).lean();
  if (placements.length === 0) {
    return [];
  }

  const students = await User.find({ _id: { $in: placements.map((placement) => placement.studentId) } })
    .select('_id displayName avatar innovationScore')
    .lean();
  const studentMap = new Map(students.map((student) => [String(student._id), student]));

  const colleges = await User.find({ _id: { $in: placements.map((placement) => placement.collegeId) } })
    .select('_id displayName')
    .lean();
  const collegeMap = new Map(colleges.map((college) => [String(college._id), college.displayName]));

  return placements.map((placement) =>
    mapPlacement(
      placement,
      studentMap.get(String(placement.studentId)),
      collegeMap.get(String(placement.collegeId)),
    ),
  );
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
