import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { JobPost } from './jobPost.model';
import { User } from '../user/user.model';
import { createBridge, notifyUser, mapJob } from './recruiter.mappers';
import { RecruiterJobDetail, RecruiterJobView } from './recruiter.types';
import { jobCreateSchema, jobUpdateSchema } from './recruiter.schemas';
import { z } from 'zod';

export const getRecruiterJobs = async (recruiterId: string): Promise<RecruiterJobDetail[]> => {
  const jobs = await JobPost.find({ recruiterId }).sort({ createdAt: -1 }).lean();
  return jobs.map((job) => ({
    ...mapJob(job),
    applicantIds: job.applicantIds.map((id) => String(id)),
    shortlistedIds: job.shortlistedIds.map((id) => String(id)),
  }));
};

export const getPublicRecruiterJobs = async (
  recruiterId: string,
  studentId?: string,
): Promise<RecruiterJobView[]> => {
  const jobs = await JobPost.find({ recruiterId, isActive: true }).sort({ createdAt: -1 }).lean();
  return jobs.map((job) =>
    mapJob(job, {
      hasApplied: studentId
        ? job.applicantIds.some((applicantId) => String(applicantId) === studentId)
        : undefined,
    }),
  );
};

export const getPublicRecruiterJob = async (
  jobId: string,
  studentId?: string,
): Promise<RecruiterJobView> => {
  const job = await JobPost.findOne({ _id: jobId, isActive: true }).lean();

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  return mapJob(job, {
    hasApplied: studentId
      ? job.applicantIds.some((applicantId) => String(applicantId) === studentId)
      : undefined,
  });
};

export const createRecruiterJob = async (recruiterId: string, payload: z.infer<typeof jobCreateSchema>) => {
  const job = await JobPost.create({
    recruiterId,
    ...payload,
    ...(payload.expiresAt ? { expiresAt: new Date(payload.expiresAt) } : {}),
  });

  if (payload.minimumInnovationScore > 0) {
    const students = await User.find({
      role: UserRole.STUDENT,
      isActive: true,
      innovationScore: { $gte: payload.minimumInnovationScore },
    })
      .select('_id')
      .lean();

    await Promise.all(students.map((student) => createBridge(recruiterId, String(student._id), 'SCORE_MATCH')));
  }

  return mapJob(job.toObject());
};

export const updateRecruiterJob = async (
  recruiterId: string,
  jobId: string,
  payload: z.infer<typeof jobUpdateSchema>,
) => {
  const job = await JobPost.findOne({ _id: jobId, recruiterId });
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  if (payload.expiresAt) {
    job.expiresAt = new Date(payload.expiresAt);
  }
  if (payload.title !== undefined) job.title = payload.title;
  if (payload.company !== undefined) job.company = payload.company;
  if (payload.description !== undefined) job.description = payload.description;
  if (payload.domain !== undefined) job.domain = payload.domain;
  if (payload.minimumInnovationScore !== undefined) job.minimumInnovationScore = payload.minimumInnovationScore;
  if (payload.type !== undefined) job.type = payload.type;
  if (payload.location !== undefined) job.location = payload.location;
  if (payload.isActive !== undefined) job.isActive = payload.isActive;

  await job.save();
  return mapJob(job.toObject());
};

export const deleteRecruiterJob = async (recruiterId: string, jobId: string) => {
  const job = await JobPost.findOne({ _id: jobId, recruiterId });
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  job.isActive = false;
  await job.save();
  return mapJob(job.toObject());
};

export const applyToRecruiterJob = async (studentId: string, jobId: string) => {
  const job = await JobPost.findOne({ _id: jobId, isActive: true }).lean();
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  if (job.applicantIds.some((applicantId) => String(applicantId) === studentId)) {
    return { applied: true, alreadyApplied: true };
  }

  await createBridge(String(job.recruiterId), studentId, 'ACTIVE_APPLICATION');
  await JobPost.updateOne({ _id: jobId }, { $addToSet: { applicantIds: studentId } });

  await notifyUser(
    String(job.recruiterId),
    'A student applied to your job post',
    'A student applied to your job post.',
    '/dashboard/recruiter/talent',
  );

  return { applied: true, alreadyApplied: false };
};
