import { Types } from 'mongoose';
import { z } from 'zod';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { RequestRecord } from '../request/request.model';
import { createRequest, registerRequestHandler } from '../request/request.service';
import { User } from '../user/user.model';
import {
  JobApplicationSource,
  JobApplicationStage,
  JobPost,
  type IJobApplicationRecord,
  type IJobPost,
} from './jobPost.model';
import {
  createBridge,
  getStartupCategories,
  getStudentCollegeId,
  getWorkspaceMap,
  mapInstitution,
  mapJob,
  mapTalent,
  notifyUser,
} from './recruiter.mappers';
import { RelevanceBridge } from './relevanceBridge.model';
import {
  RecruiterJobApplicantView,
  RecruiterJobDetail,
  RecruiterJobPipelineView,
  RecruiterStudentApplicationView,
  RecruiterJobView,
} from './recruiter.types';
import {
  recruiterJobInviteSchema,
  jobApplicationUpdateSchema,
  jobCreateSchema,
  jobUpdateSchema,
} from './recruiter.schemas';
import { markStudentHired } from './recruiter.drive.service';

const SHORTLISTED_STAGES = new Set<JobApplicationStage>(['Shortlisted', 'Interview', 'Offered', 'Hired']);

const IN_PROGRESS_STAGES = new Set<JobApplicationStage>(['Screening', 'Interview', 'Offered']);

const getApplicationSource = (
  record?: Pick<IJobApplicationRecord, 'source'> | null,
): JobApplicationSource => (record?.source === 'recruiter_invite' ? 'recruiter_invite' : 'student_apply');

const isAppliedStage = (stage?: JobApplicationStage) =>
  Boolean(stage && !['Invited Pending', 'Invite Declined'].includes(stage));

const buildApplicationRecord = ({
  studentId,
  source = 'student_apply',
  stage = 'Applied',
  appliedAt = new Date(),
  updatedAt = new Date(),
  note,
}: {
  studentId: string | Types.ObjectId;
  source?: JobApplicationSource;
  stage?: JobApplicationStage;
  appliedAt?: Date;
  updatedAt?: Date;
  note?: string;
}): IJobApplicationRecord => ({
  studentId: typeof studentId === 'string' ? new Types.ObjectId(studentId) : studentId,
  source,
  stage,
  appliedAt,
  updatedAt,
  ...(note ? { note } : {}),
});

const getStudentApplicationRecord = (
  job: Pick<IJobPost, 'applicantIds' | 'applicationRecords' | 'shortlistedIds' | 'createdAt'>,
  studentId?: string,
) => {
  if (!studentId) {
    return undefined;
  }

  return getNormalizedApplicationRecords(job).find((record) => String(record.studentId) === studentId);
};

const toJobDetail = (job: Pick<IJobPost, '_id' | 'recruiterId' | 'title' | 'company' | 'description' | 'domain' | 'minimumInnovationScore' | 'type' | 'location' | 'workMode' | 'salaryExpectation' | 'experienceLevel' | 'openings' | 'companyOverview' | 'roleSummary' | 'keyResponsibilities' | 'requirements' | 'benefits' | 'applicationSteps' | 'isActive' | 'applicantIds' | 'shortlistedIds' | 'createdAt' | 'expiresAt'>): RecruiterJobDetail => ({
  ...mapJob(job),
  applicantIds: job.applicantIds.map((id) => String(id)),
  shortlistedIds: job.shortlistedIds.map((id) => String(id)),
});

const getNormalizedApplicationRecords = (
  job: Pick<IJobPost, 'applicantIds' | 'applicationRecords' | 'shortlistedIds' | 'createdAt'>,
  placementMap = new Map<string, { status: 'Discovered' | 'Shortlisted' | 'Hired' | 'Rejected' | 'In Progress'; createdAt: Date; updatedAt: Date }>(),
) => {
  const recordMap = new Map<string, IJobApplicationRecord>();

  for (const record of job.applicationRecords ?? []) {
    recordMap.set(String(record.studentId), {
      ...record,
      source: getApplicationSource(record),
    });
  }

  for (const applicantId of job.applicantIds ?? []) {
    const key = String(applicantId);
    if (recordMap.has(key)) {
      continue;
    }

    const placement = placementMap.get(key);
    let stage: JobApplicationStage = 'Applied';

    if (placement?.status === 'Hired') {
      stage = 'Hired';
    } else if (placement?.status === 'Rejected') {
      stage = 'Rejected';
    } else if (placement?.status === 'In Progress') {
      stage = job.shortlistedIds.some((id) => String(id) === key) ? 'Interview' : 'Screening';
    } else if (placement?.status === 'Shortlisted' || job.shortlistedIds.some((id) => String(id) === key)) {
      stage = 'Shortlisted';
    }

    recordMap.set(
      key,
      buildApplicationRecord({
        studentId: applicantId,
        stage,
        source: 'student_apply',
        appliedAt: placement?.createdAt ?? job.createdAt,
        updatedAt: placement?.updatedAt ?? job.createdAt,
      }),
    );
  }

  return Array.from(recordMap.values()).sort(
    (left, right) => right.updatedAt.getTime() - left.updatedAt.getTime(),
  );
};

const syncPlacementStage = async (
  recruiterId: string,
  studentId: string,
  job: Pick<IJobPost, 'company'>,
  stage: JobApplicationStage,
  scoreAtTime: number,
) => {
  const collegeId = await getStudentCollegeId(studentId);
  if (!collegeId) {
    return;
  }

  if (stage === 'Hired') {
    await markStudentHired(recruiterId, studentId, job.company);
    return;
  }

  const status =
    stage === 'Shortlisted'
      ? 'Shortlisted'
      : stage === 'Rejected'
      ? 'Rejected'
      : IN_PROGRESS_STAGES.has(stage)
      ? 'In Progress'
      : 'Discovered';

  await PlacementRecord.updateOne(
    { recruiterId, studentId, collegeId },
    {
      recruiterId,
      studentId,
      collegeId,
      companyName: job.company,
      status,
      innovationScoreAtTime: scoreAtTime,
    },
    { upsert: true },
  );
};

export const getRecruiterJobs = async (recruiterId: string): Promise<RecruiterJobDetail[]> => {
  const jobs = await JobPost.find({ recruiterId }).sort({ createdAt: -1 }).lean();
  return jobs.map(toJobDetail);
};

export const getPublicRecruiterJobs = async (
  recruiterId: string,
  studentId?: string,
): Promise<RecruiterJobView[]> => {
  const jobs = await JobPost.find({ recruiterId, isActive: true }).sort({ createdAt: -1 }).lean();
  return jobs.map((job) => {
    const applicationRecord = getStudentApplicationRecord(job, studentId);
    return mapJob(job, {
      hasApplied: isAppliedStage(applicationRecord?.stage),
      ...(applicationRecord
        ? {
            applicationStage: applicationRecord.stage,
            applicationSource: applicationRecord.source,
            applicationUpdatedAt: applicationRecord.updatedAt.toISOString(),
          }
        : {}),
    });
  });
};

export const getPublicRecruiterJob = async (
  jobId: string,
  studentId?: string,
): Promise<RecruiterJobView> => {
  const job = await JobPost.findOne({ _id: jobId, isActive: true }).lean();

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  const applicationRecord = getStudentApplicationRecord(job, studentId);

  return mapJob(job, {
    hasApplied: isAppliedStage(applicationRecord?.stage),
    ...(applicationRecord
      ? {
          applicationStage: applicationRecord.stage,
          applicationSource: applicationRecord.source,
          applicationUpdatedAt: applicationRecord.updatedAt.toISOString(),
        }
      : {}),
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
  if (payload.workMode !== undefined) job.workMode = payload.workMode;
  if (payload.salaryExpectation !== undefined) job.salaryExpectation = payload.salaryExpectation;
  if (payload.experienceLevel !== undefined) job.experienceLevel = payload.experienceLevel;
  if (payload.openings !== undefined) job.openings = payload.openings;
  if (payload.companyOverview !== undefined) job.companyOverview = payload.companyOverview;
  if (payload.roleSummary !== undefined) job.roleSummary = payload.roleSummary;
  if (payload.keyResponsibilities !== undefined) job.keyResponsibilities = payload.keyResponsibilities;
  if (payload.requirements !== undefined) job.requirements = payload.requirements;
  if (payload.benefits !== undefined) job.benefits = payload.benefits;
  if (payload.applicationSteps !== undefined) job.applicationSteps = payload.applicationSteps;
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
  const job = await JobPost.findOne({ _id: jobId, isActive: true });
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  const alreadyApplied = job.applicantIds.some((applicantId) => String(applicantId) === studentId);

  if (alreadyApplied) {
    if (!job.applicationRecords.some((record) => String(record.studentId) === studentId)) {
      job.applicationRecords.push(buildApplicationRecord({ studentId, source: 'student_apply' }));
      await job.save();
    }

    return { applied: true, alreadyApplied: true };
  }

  await createBridge(String(job.recruiterId), studentId, 'ACTIVE_APPLICATION');
  job.applicantIds.push(new Types.ObjectId(studentId));
  job.applicationRecords.push(buildApplicationRecord({ studentId, source: 'student_apply' }));
  await job.save();

  await notifyUser(
    String(job.recruiterId),
    'A student applied to your job post',
    'A student applied to your job post.',
    '/dashboard/recruiter/applications',
  );

  return { applied: true, alreadyApplied: false };
};

export const inviteStudentToRecruiterJob = async (
  recruiterId: string,
  jobId: string,
  studentId: string,
  payload: z.infer<typeof recruiterJobInviteSchema>,
) => {
  const parsed = recruiterJobInviteSchema.parse(payload ?? {});
  const [job, student] = await Promise.all([
    JobPost.findOne({ _id: jobId, recruiterId, isActive: true }),
    User.findOne({ _id: studentId, role: UserRole.STUDENT, isActive: true })
      .select('_id')
      .lean(),
  ]);

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const alreadyApplied = job.applicantIds.some((applicantId) => String(applicantId) === studentId);
  const recordIndex = job.applicationRecords.findIndex((record) => String(record.studentId) === studentId);
  const existingRecord = recordIndex >= 0 ? job.applicationRecords[recordIndex] : undefined;
  const existingSource = existingRecord ? getApplicationSource(existingRecord) : undefined;

  if (alreadyApplied || existingSource === 'student_apply') {
    return {
      invited: true,
      alreadyApplied: true,
      alreadyInvited: false,
    };
  }

  const existingInvite = await RequestRecord.findOne({
    type: 'recruiter_job_invite',
    fromUserId: recruiterId,
    toUserId: student._id,
    targetEntityType: 'recruiter_job',
    targetEntityId: jobId,
    status: 'pending',
  }).lean();

  const alreadyInvited = Boolean(existingInvite) || existingSource === 'recruiter_invite';

  if (existingSource === 'recruiter_invite' && recordIndex >= 0 && existingRecord?.stage !== 'Invite Accepted') {
    const record = job.applicationRecords[recordIndex];
    record.source = 'recruiter_invite';
    record.stage = 'Invited Pending';
    record.updatedAt = new Date();
    if (parsed.note) {
      record.note = parsed.note;
    }
    await job.save();
  }

  if (!existingRecord) {
    job.applicationRecords.push(
      buildApplicationRecord({
        studentId,
        source: 'recruiter_invite',
        stage: 'Invited Pending',
        note: parsed.note,
      }),
    );
    await job.save();
  }

  if (!existingInvite) {
    await createRequest({
      type: 'recruiter_job_invite',
      actionType: 'hire',
      fromUserId: recruiterId,
      toUserId: String(student._id),
      targetEntityType: 'recruiter_job',
      targetEntityId: jobId,
      targetEntityTitle: job.title,
      targetRole: 'candidate',
      requestedRole: 'candidate',
      requestedPermission: 'job_application',
      message: parsed.note,
      deepLink: `/marketplace/jobs/${jobId}`,
      acceptRedirect: '/dashboard/student/applications',
      declineRedirect: `/marketplace/jobs/${jobId}`,
      metadata: {
        jobId,
        jobTitle: job.title,
        company: job.company,
        recruiterId,
        entityName: job.title,
      },
    });
  }

  return {
    invited: true,
    alreadyApplied,
    alreadyInvited,
  };
};

export const getRecruiterJobApplications = async (
  recruiterId: string,
  jobId: string,
): Promise<RecruiterJobPipelineView> => {
  const job = await JobPost.findOne({ _id: jobId, recruiterId }).lean();
  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  const candidateIds = Array.from(
    new Set([
      ...(job.applicantIds ?? []).map((id) => String(id)),
      ...((job.applicationRecords ?? []).map((record) => String(record.studentId))),
    ]),
  );

  if (candidateIds.length === 0) {
    return {
      job: toJobDetail(job),
      applications: [],
    };
  }

  const [students, bridgeDocs, placements] = await Promise.all([
    User.find({
      _id: { $in: candidateIds },
      role: UserRole.STUDENT,
      isActive: true,
    })
      .select(
        '_id displayName avatar email domain innovationScore scoreBreakdown institutionId institutionProfile createdAt discoverableToRecruiters',
      )
      .lean(),
    RelevanceBridge.find({
      recruiterId,
      studentId: { $in: candidateIds },
      isActive: true,
    })
      .select('studentId bridgeType')
      .lean<{ studentId: Types.ObjectId; bridgeType?: RecruiterJobApplicantView['bridgeType'] }[]>(),
    PlacementRecord.find({
      recruiterId,
      studentId: { $in: candidateIds },
    })
      .select('studentId status createdAt updatedAt')
      .lean<Array<{ studentId: Types.ObjectId; status: 'Discovered' | 'Shortlisted' | 'Hired' | 'Rejected' | 'In Progress'; createdAt: Date; updatedAt: Date }>>(),
  ]);

  const placementMap = new Map(placements.map((placement) => [String(placement.studentId), placement]));
  const applicationRecords = getNormalizedApplicationRecords(job, placementMap);
  const applicationMap = new Map(applicationRecords.map((record) => [String(record.studentId), record]));
  const bridgeMap = new Map(bridgeDocs.map((bridge) => [String(bridge.studentId), bridge.bridgeType]));

  const studentIds = students.map((student) => String(student._id));
  const [workspaceMap, startupCategories] = await Promise.all([
    getWorkspaceMap(studentIds),
    getStartupCategories(studentIds),
  ]);

  const institutionObjectIds = Array.from(
    new Set(students.map((student) => student.institutionId).filter((id): id is Types.ObjectId => Boolean(id))),
  );

  const institutions = institutionObjectIds.length
    ? await User.find({
        _id: { $in: institutionObjectIds },
        role: { $in: [UserRole.SCHOOL, UserRole.COLLEGE] },
      })
        .select('_id displayName institutionProfile')
        .lean()
    : [];

  const institutionMap = new Map(
    institutions.map((institution) => [String(institution._id), mapInstitution(institution)]),
  );

  const applications = students
    .map((student) => {
      const studentId = String(student._id);
      const record = applicationMap.get(studentId);

      if (!record) {
        return null;
      }

      const bridgeType = bridgeMap.get(studentId);
      const activeProject = workspaceMap.get(studentId);

      return {
        ...mapTalent(student, {
          canContact: true,
          ...(bridgeType ? { bridgeType } : {}),
          ...(activeProject ? { activeProject } : {}),
          extraSkills: startupCategories.get(studentId) ?? [],
          ...(student.institutionId && institutionMap.get(String(student.institutionId))
            ? { institution: institutionMap.get(String(student.institutionId)) }
            : {}),
        }),
        stage: record.stage,
        source: record.source,
        appliedAt: record.appliedAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        ...(record.note ? { note: record.note } : {}),
      } satisfies RecruiterJobApplicantView;
    })
    .filter((application): application is RecruiterJobApplicantView => Boolean(application))
    .sort((left, right) => {
      const byUpdatedAt = new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      return byUpdatedAt !== 0 ? byUpdatedAt : right.innovationScore - left.innovationScore;
    });

  return {
    job: toJobDetail(job),
    applications,
  };
};

export const getStudentRecruiterApplications = async (
  studentId: string,
): Promise<RecruiterStudentApplicationView[]> => {
  const jobs = await JobPost.find({
    $or: [
      { applicantIds: new Types.ObjectId(studentId) },
      { 'applicationRecords.studentId': new Types.ObjectId(studentId) },
    ],
  })
    .sort({ createdAt: -1 })
    .lean();

  if (jobs.length === 0) {
    return [];
  }

  const recruiterIds = Array.from(new Set(jobs.map((job) => String(job.recruiterId))));
  const recruiters = await User.find({
    _id: { $in: recruiterIds },
    role: UserRole.RECRUITER,
    isActive: true,
  })
    .select('_id displayName avatar headline')
    .lean();

  const recruiterMap = new Map(
    recruiters.map((recruiter) => [
      String(recruiter._id),
      {
        _id: String(recruiter._id),
        displayName: recruiter.displayName,
        ...(recruiter.avatar ? { avatar: recruiter.avatar } : {}),
        ...(recruiter.headline ? { headline: recruiter.headline } : {}),
      },
    ]),
  );

  return jobs
    .map((job) => {
      const record = getStudentApplicationRecord(job, studentId);
      if (!record) {
        return null;
      }

      const recruiter = recruiterMap.get(String(job.recruiterId));
      if (!recruiter) {
        return null;
      }

      return {
        job: mapJob(job, {
          hasApplied: isAppliedStage(record.stage),
          applicationStage: record.stage,
          applicationSource: record.source,
          applicationUpdatedAt: record.updatedAt.toISOString(),
        }),
        recruiter,
        stage: record.stage,
        source: record.source,
        appliedAt: record.appliedAt.toISOString(),
        updatedAt: record.updatedAt.toISOString(),
        ...(record.note ? { note: record.note } : {}),
      } satisfies RecruiterStudentApplicationView;
    })
    .filter((application): application is RecruiterStudentApplicationView => Boolean(application))
    .sort(
      (left, right) =>
        new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
    );
};

export const updateRecruiterJobApplicationStage = async (
  recruiterId: string,
  jobId: string,
  studentId: string,
  payload: z.infer<typeof jobApplicationUpdateSchema>,
): Promise<RecruiterJobApplicantView> => {
  const parsed = jobApplicationUpdateSchema.parse(payload);
  const [job, student] = await Promise.all([
    JobPost.findOne({ _id: jobId, recruiterId }),
    User.findOne({
      _id: studentId,
      role: UserRole.STUDENT,
      isActive: true,
    })
      .select(
        '_id displayName avatar email domain innovationScore scoreBreakdown institutionId institutionProfile createdAt discoverableToRecruiters',
      )
      .lean(),
  ]);

  if (!job) {
    throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
  }

  if (!student) {
    throw new ApiError(404, 'STUDENT_NOT_FOUND', 'Student not found');
  }

  const alreadyApplied = job.applicantIds.some((applicantId) => String(applicantId) === studentId);
  const recordIndex = job.applicationRecords.findIndex((record) => String(record.studentId) === studentId);

  if (!alreadyApplied && recordIndex === -1) {
    throw new ApiError(404, 'JOB_APPLICATION_NOT_FOUND', 'This student has not applied to the selected job');
  }

  const now = new Date();
  const existingRecord = recordIndex >= 0 ? job.applicationRecords[recordIndex] : undefined;
  const previousStage = existingRecord?.stage;
  const nextRecord: IJobApplicationRecord = buildApplicationRecord({
    studentId,
    source: getApplicationSource(existingRecord),
    stage: parsed.stage,
    appliedAt: existingRecord?.appliedAt ?? now,
    updatedAt: now,
    note: parsed.note,
  });

  if (!alreadyApplied) {
    job.applicantIds.push(new Types.ObjectId(studentId));
  }

  if (recordIndex >= 0) {
    job.applicationRecords[recordIndex] = nextRecord;
  } else {
    job.applicationRecords.push(nextRecord);
  }

  if (SHORTLISTED_STAGES.has(parsed.stage)) {
    if (!job.shortlistedIds.some((candidateId) => String(candidateId) === studentId)) {
      job.shortlistedIds.push(new Types.ObjectId(studentId));
    }
    await createBridge(recruiterId, studentId, 'HR_SHORTLIST');
  } else {
    job.shortlistedIds = job.shortlistedIds.filter((candidateId) => String(candidateId) !== studentId);
    await createBridge(recruiterId, studentId, 'ACTIVE_APPLICATION');
  }

  await Promise.all([
    job.save(),
    syncPlacementStage(recruiterId, studentId, job, parsed.stage, student.innovationScore ?? 0),
  ]);

  if (previousStage !== parsed.stage && parsed.stage !== 'Hired') {
    await notifyUser(
      studentId,
      `Application update for ${job.title}`,
      `Your application for ${job.title} moved to ${parsed.stage}.`,
      '/dashboard/student/applications',
    );
  }

  const [workspaceMap, startupCategories] = await Promise.all([
    getWorkspaceMap([studentId]),
    getStartupCategories([studentId]),
  ]);

  const bridge = await RelevanceBridge.findOne({
    recruiterId,
    studentId,
    isActive: true,
  })
    .select('bridgeType')
    .lean<{ bridgeType?: RecruiterJobApplicantView['bridgeType'] } | null>();

  const institution = student.institutionId
    ? await User.findById(student.institutionId).select('_id displayName institutionProfile').lean()
    : null;

  return {
    ...mapTalent(student, {
      canContact: true,
      ...(bridge?.bridgeType ? { bridgeType: bridge.bridgeType } : {}),
      ...(workspaceMap.get(studentId) ? { activeProject: workspaceMap.get(studentId) } : {}),
      extraSkills: startupCategories.get(studentId) ?? [],
      ...(institution ? { institution: mapInstitution(institution) } : {}),
    }),
    stage: nextRecord.stage,
    source: nextRecord.source,
    appliedAt: nextRecord.appliedAt.toISOString(),
    updatedAt: nextRecord.updatedAt.toISOString(),
    ...(nextRecord.note ? { note: nextRecord.note } : {}),
  };
};

registerRequestHandler('recruiter_job_invite', {
  validateAccept: async (request) => {
    const job = await JobPost.findOne({
      _id: request.targetEntityId,
      recruiterId: request.fromUserId,
      isActive: true,
    })
      .select('_id')
      .lean();

    if (!job) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
    }
  },
  onAccept: async (request, actorUserId) => {
    const job = await JobPost.findOne({
      _id: request.targetEntityId,
      recruiterId: request.fromUserId,
      isActive: true,
    });

    if (!job) {
      throw new ApiError(404, 'JOB_NOT_FOUND', 'Job post not found');
    }

    const alreadyApplied = job.applicantIds.some((applicantId) => String(applicantId) === actorUserId);
    const recordIndex = job.applicationRecords.findIndex((record) => String(record.studentId) === actorUserId);

    if (!alreadyApplied) {
      job.applicantIds.push(new Types.ObjectId(actorUserId));
    }

    if (recordIndex >= 0) {
      const record = job.applicationRecords[recordIndex];
      record.source = 'recruiter_invite';
      record.stage = 'Invite Accepted';
      record.updatedAt = new Date();
      if (request.message) {
        record.note = request.message;
      }
    } else {
      job.applicationRecords.push(
        buildApplicationRecord({
          studentId: actorUserId,
          source: 'recruiter_invite',
          stage: 'Invite Accepted',
          note: request.message,
        }),
      );
    }

    await Promise.all([
      createBridge(String(request.fromUserId), actorUserId, 'ACTIVE_APPLICATION'),
      job.save(),
    ]);

    await notifyUser(
      String(request.fromUserId),
      `Invite accepted for ${job.title}`,
      'A student accepted your recruiter invite.',
      '/dashboard/recruiter/applications',
    );
  },
  onDecline: async (request, actorUserId) => {
    const job = await JobPost.findOne({
      _id: request.targetEntityId,
      recruiterId: request.fromUserId,
    });

    if (!job) {
      return;
    }

    const recordIndex = job.applicationRecords.findIndex((record) => String(record.studentId) === actorUserId);
    if (recordIndex >= 0) {
      const record = job.applicationRecords[recordIndex];
      record.source = 'recruiter_invite';
      record.stage = 'Invite Declined';
      record.updatedAt = new Date();
      if (request.message) {
        record.note = request.message;
      }
    } else {
      job.applicationRecords.push(
        buildApplicationRecord({
          studentId: actorUserId,
          source: 'recruiter_invite',
          stage: 'Invite Declined',
          note: request.message,
        }),
      );
    }

    await job.save();
  },
});
