import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { applyScoreAsync } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { UserRole } from '../../types/roles.types';
import { normalizeInnovationScore } from '../innovationScore/score.utils';
const pdfFileNamePattern = /\.pdf$/i;

export const startupSchema = z.object({
  projectId: z.string().optional(),
  name: z.string().trim().min(0).max(120).default(''),
  tagline: z.string().trim().min(0).max(200).default(''),
  category: z.string().trim().min(0).max(100).default(''),
  stage: z.enum(['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched']).default('Pre-Idea'),
  fundingNeeded: z.number().optional(),
  activeProducts: z.number().int().min(0).default(1),
  teamSize: z.number().int().min(1).default(1),
  traction: z
    .object({
      patentFiled: z.boolean().default(false),
      mvpBuilt: z.boolean().default(false),
      revenueGenerating: z.boolean().default(false),
      usersCount: z.number().int().min(0).optional(),
    })
    .default({
      patentFiled: false,
      mvpBuilt: false,
      revenueGenerating: false,
    }),
});

export const launchSchema = z.object({
  launchTo: z.enum(['investors', 'mentors', 'both', 'recruiters']),
});

export const reviewStartupSubmissionSchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested']),
    adminNotes: z.string().trim().max(1500).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'changes_requested' && (!value.adminNotes || value.adminNotes.length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adminNotes'],
        message: 'Admin notes are required when requesting changes.',
      });
    }
  });

const clearReviewMetadata = (startup: InstanceType<typeof Startup>) => {
  startup.reviewRequestedAt = undefined;
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
};

const isStartupProfileReady = (startup: {
  name?: string;
  tagline?: string;
  category?: string;
  founderIds: Array<unknown>;
}) => Boolean(startup.name && startup.tagline && startup.category && startup.founderIds.length > 0);

export const createStartupProfile = async (userId: string, payload: z.infer<typeof startupSchema>) => {
  const existing = await Startup.findOne({ founderIds: userId, isActive: true });
  if (existing) {
    throw new ApiError(400, 'STARTUP_EXISTS', 'You already have an active startup.');
  }

  const startup = await Startup.create({
    founderIds: [userId],
    ...payload,
  });

  return startup.toObject();
};

export const getMyStartup = async (userId: string) => Startup.findOne({ founderIds: userId, isActive: true }).lean();

export const getStartupForFounder = async (startupId: string, userId: string) => {
  const startup = await Startup.findById(startupId);
  if (!startup) {
    throw new ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
  }

  const isFounder = startup.founderIds.some((founderId) => String(founderId) === String(userId));
  if (!isFounder) {
    throw new ApiError(403, 'FORBIDDEN', 'Only founders can access this startup.');
  }

  return startup;
};

export const updateStartupProfile = async (
  startupId: string,
  userId: string,
  payload: Partial<z.infer<typeof startupSchema>>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  Object.assign(startup, payload);

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

  await startup.save();
  return startup.toObject();
};

export const requestStartupReview = async (startupId: string, userId: string) => {
  const startup = await getStartupForFounder(startupId, userId);

  if (!isStartupProfileReady(startup)) {
    throw new ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for review.');
  }

  if (startup.reviewStatus === 'approved') {
    throw new ApiError(409, 'STARTUP_ALREADY_APPROVED', 'Startup has already been approved.');
  }

  if (startup.reviewStatus === 'review_requested') {
    throw new ApiError(409, 'STARTUP_ALREADY_UNDER_REVIEW', 'Startup review is already pending.');
  }

  startup.reviewStatus = 'review_requested';
  startup.reviewRequestedAt = new Date();
  startup.adminReviewedAt = undefined;
  startup.adminReviewedBy = null;
  startup.adminNotes = undefined;
  await startup.save();

  return startup.toObject();
};

export const launchStartup = async (
  startupId: string,
  userId: string,
  payload: z.infer<typeof launchSchema>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  if (!isStartupProfileReady(startup)) {
    throw new ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for launch.');
  }

  if (payload.launchTo !== 'recruiters' && startup.reviewStatus !== 'approved') {
    throw new ApiError(
      403,
      'STARTUP_REVIEW_REQUIRED',
      'Startup must be approved by admin before it can be launched to the marketplace.',
    );
  }

  const user = await User.findById(userId).select('innovationScore').lean();
  const score = normalizeInnovationScore(user?.innovationScore ?? 0);

  startup.launchedToInvestors = payload.launchTo === 'investors' || payload.launchTo === 'both';
  startup.launchedToMentors = payload.launchTo === 'mentors' || payload.launchTo === 'both';
  startup.launchedToRecruiters = payload.launchTo === 'recruiters';
  startup.launchedAt = new Date();
  startup.innovationScoreAtLaunch = score;
  if (payload.launchTo !== 'recruiters') {
    startup.stage = 'Launched';
  }
  await startup.save();

  if (payload.launchTo === 'recruiters') {
    const founder = await User.findByIdAndUpdate(
      userId,
      { discoverableToRecruiters: true },
      { new: true },
    )
      .select('innovationScore institutionId')
      .lean();

    if (founder?.institutionId) {
      const institution = await User.findById(founder.institutionId).select('role').lean();
      if (institution?.role === UserRole.COLLEGE) {
        await PlacementRecord.findOneAndUpdate(
          {
            studentId: userId,
            collegeId: founder.institutionId,
            status: 'Discovered',
          },
          {
            studentId: userId,
            collegeId: founder.institutionId,
            status: 'Discovered',
            innovationScoreAtTime: normalizeInnovationScore(founder.innovationScore ?? 0),
          },
          {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true,
          },
        );
      }
    }
  } else {
    await applyScoreAsync({
      userId,
      trigger: 'STARTUP_LAUNCHED',
      metadata: { startupId, launchTo: payload.launchTo },
    });
  }

  const targetRoles =
    payload.launchTo === 'both'
      ? [UserRole.INVESTOR, UserRole.MENTOR]
      : payload.launchTo === 'investors'
        ? [UserRole.INVESTOR]
        : payload.launchTo === 'mentors'
          ? [UserRole.MENTOR]
          : [UserRole.RECRUITER];

  const recipients = await User.find({ role: { $in: targetRoles }, isActive: true })
    .select('_id role')
    .lean<Array<{ _id: unknown; role: UserRole }>>();

  const getLaunchNotification = (recipientRole: UserRole) => {
    if (recipientRole === UserRole.INVESTOR) {
      return {
        type: 'startup_launch' as const,
        title: 'New startup is seeking investors',
        body: `${startup.name} is seeking investors on ProMove.`,
        link: '/dashboard/investor/startups',
      };
    }

    if (recipientRole === UserRole.MENTOR) {
      return {
        type: 'startup_launch' as const,
        title: 'New startup in your area launched',
        body: `${startup.name} has launched and is looking for mentorship.`,
        link: '/dashboard/mentor/students',
      };
    }

    return {
      type: 'deal_interest' as const,
      title: 'New startup launch',
      body: `${startup.name} is now live on ProMove.`,
      link: '/dashboard/recruiter',
    };
  };

  await Promise.all(
    recipients.map((recipient) =>
      notificationQueue.add('startup-launch', {
        userId: String(recipient._id),
        ...getLaunchNotification(recipient.role),
      }),
    ),
  );

  return startup.toObject();
};

export const uploadPitchDeck = async (startupId: string, userId: string, file: Express.Multer.File) => {
  if (file.mimetype !== 'application/pdf' && !pdfFileNamePattern.test(file.originalname)) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
  }
  const startup = await getStartupForFounder(startupId, userId);
  const uploaded = await uploadToCloudinary(file.buffer, 'promove/startups', 'raw', { format: 'pdf' });
  startup.pitchDeckUrl = uploaded.secure_url;
  startup.pitchDeckName = file.originalname;

  if (startup.reviewStatus === 'review_requested') {
    startup.reviewStatus = 'draft';
    clearReviewMetadata(startup);
  }

  await startup.save();
  return startup.toObject();
};

export const listStartupsForAdmin = async (status?: 'draft' | 'review_requested' | 'changes_requested' | 'approved') => {
  const query =
    status && status !== 'draft'
      ? { isActive: true, reviewStatus: status }
      : status
        ? { isActive: true, reviewStatus: status }
        : { isActive: true };

  const startups = await Startup.find(query)
    .sort({ reviewRequestedAt: -1, updatedAt: -1, createdAt: -1 })
    .lean<Array<{
      _id: Types.ObjectId;
      founderIds: Types.ObjectId[];
      name: string;
      tagline: string;
      category: string;
      stage: string;
      fundingNeeded?: number;
      activeProducts: number;
      teamSize: number;
      launchedToInvestors: boolean;
      launchedToMentors: boolean;
      launchedAt?: Date;
      reviewStatus: 'draft' | 'review_requested' | 'changes_requested' | 'approved';
      reviewRequestedAt?: Date;
      adminReviewedAt?: Date;
      adminReviewedBy?: Types.ObjectId | null;
      adminNotes?: string;
      createdAt: Date;
      updatedAt: Date;
      pitchDeckUrl?: string;
      pitchDeckName?: string;
      traction: {
        patentFiled: boolean;
        mvpBuilt: boolean;
        revenueGenerating: boolean;
        usersCount?: number;
      };
    }>>();

  const founderIds = [...new Set(startups.flatMap((startup) => startup.founderIds.map(String)))];
  const founders =
    founderIds.length > 0
      ? await User.find({ _id: { $in: founderIds } })
          .select('_id displayName avatar innovationScore domain')
          .lean<Array<{
            _id: Types.ObjectId;
            displayName: string;
            avatar?: string;
            innovationScore: number;
            domain?: string;
          }>>()
      : [];

  const founderMap = new Map(founders.map((founder) => [String(founder._id), founder]));

  return startups.map((startup) => ({
    _id: String(startup._id),
    name: startup.name,
    tagline: startup.tagline,
    category: startup.category,
    stage: startup.stage,
    fundingNeeded: startup.fundingNeeded,
    activeProducts: startup.activeProducts,
    teamSize: startup.teamSize,
    launchedToInvestors: startup.launchedToInvestors,
    launchedToMentors: startup.launchedToMentors,
    ...(startup.launchedAt ? { launchedAt: startup.launchedAt.toISOString() } : {}),
    reviewStatus: startup.reviewStatus,
    ...(startup.reviewRequestedAt ? { reviewRequestedAt: startup.reviewRequestedAt.toISOString() } : {}),
    ...(startup.adminReviewedAt ? { adminReviewedAt: startup.adminReviewedAt.toISOString() } : {}),
    ...(startup.adminReviewedBy ? { adminReviewedBy: String(startup.adminReviewedBy) } : {}),
    ...(startup.adminNotes ? { adminNotes: startup.adminNotes } : {}),
    ...(startup.pitchDeckUrl ? { pitchDeckUrl: startup.pitchDeckUrl } : {}),
    ...(startup.pitchDeckName ? { pitchDeckName: startup.pitchDeckName } : {}),
    traction: startup.traction,
    founders: startup.founderIds
      .map((founderId) => founderMap.get(String(founderId)))
      .filter((founder): founder is NonNullable<typeof founder> => Boolean(founder))
      .map((founder) => ({
        _id: String(founder._id),
        displayName: founder.displayName,
        ...(founder.avatar ? { avatar: founder.avatar } : {}),
        innovationScore: founder.innovationScore ?? 0,
        ...(founder.domain ? { domain: founder.domain } : {}),
      })),
    createdAt: startup.createdAt.toISOString(),
    updatedAt: startup.updatedAt.toISOString(),
  }));
};

export const reviewStartupSubmission = async (
  adminId: string,
  startupId: string,
  payload: z.infer<typeof reviewStartupSubmissionSchema>,
) => {
  const startup = await Startup.findById(startupId);

  if (!startup || !startup.isActive) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found');
  }

  startup.reviewStatus = payload.decision;
  startup.adminReviewedAt = new Date();
  startup.adminReviewedBy = new Types.ObjectId(adminId);
  startup.adminNotes = payload.adminNotes?.trim() || undefined;

  if (payload.decision === 'approved') {
    startup.reviewRequestedAt = startup.reviewRequestedAt ?? new Date();
  }

  await startup.save();
  return startup.toObject();
};
