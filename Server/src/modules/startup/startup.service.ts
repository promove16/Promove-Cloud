import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { uploadToCloudinary } from '../../services/cloudinaryService';
import { applyScoreAsync } from '../../services/scoreEngine';
import { User } from '../user/user.model';
import { Startup } from './startup.model';
import { ApiError } from '../../utils/ApiError';

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
    await User.findByIdAndUpdate(userId, { discoverableToRecruiters: true });
  } else {
    await applyScoreAsync({
      userId,
      trigger: 'STARTUP_LAUNCHED',
      metadata: { startupId, launchTo: payload.launchTo },
    });
  }

  const targetRoles =
    payload.launchTo === 'both'
      ? ['investor', 'mentor']
      : payload.launchTo === 'investors'
        ? ['investor']
        : payload.launchTo === 'mentors'
          ? ['mentor']
          : ['recruiter'];
  const recipients = await User.find({ role: { $in: targetRoles }, isActive: true }).select('_id').lean();

  await Promise.all(
    recipients.map((recipient) =>
      notificationQueue.add('startup-launch', {
        userId: String(recipient._id),
        type: payload.launchTo === 'recruiters' ? 'deal_interest' : 'startup_launch',
        title: 'New startup launch',
        body: `${startup.name} is now live on ProMove.`,
        link: '/startup-launch',
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
