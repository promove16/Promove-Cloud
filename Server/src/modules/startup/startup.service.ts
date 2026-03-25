import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { applyScoreAsync } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';
import { PlacementRecord } from '../college/placementRecord.model';
import { UserRole } from '../../types/roles.types';

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
  const startup = await Startup.findOne({ _id: startupId, founderIds: userId });
  if (!startup) {
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
  await startup.save();
  return startup.toObject();
};

export const launchStartup = async (
  startupId: string,
  userId: string,
  payload: z.infer<typeof launchSchema>,
) => {
  const startup = await getStartupForFounder(startupId, userId);
  if (!startup.name || !startup.tagline || !startup.category || startup.founderIds.length === 0) {
    throw new ApiError(400, 'STARTUP_INCOMPLETE', 'Startup profile is incomplete for launch.');
  }

  const user = await User.findById(userId).select('innovationScore').lean();
  const score = user?.innovationScore ?? 0;

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
            innovationScoreAtTime: founder.innovationScore ?? 0,
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
  if (file.mimetype !== 'application/pdf') {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
  }
  const startup = await getStartupForFounder(startupId, userId);
  const uploaded = await uploadToCloudinary(file.buffer, 'promove/startups', 'raw');
  startup.pitchDeckUrl = uploaded.secure_url;
  await startup.save();
  return startup.toObject();
};
