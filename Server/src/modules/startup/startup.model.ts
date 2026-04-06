import { Schema, model } from 'mongoose';
import { IStartup } from './startup.types';

const startupSchema = new Schema<IStartup>(
  {
    founderIds: { type: [Schema.Types.ObjectId], required: true, default: [], index: true },
    projectId: { type: Schema.Types.ObjectId, default: undefined },
    name: { type: String, required: true, trim: true, default: '' },
    tagline: { type: String, required: true, trim: true, default: '' },
    category: { type: String, required: true, trim: true, default: '' },
    stage: {
      type: String,
      enum: ['Pre-Idea', 'Ideation', 'MVP', 'Pre-Launch', 'Launched'],
      default: 'Pre-Idea',
    },
    pitchDeckUrl: { type: String, default: undefined },
    pitchDeckName: { type: String, default: undefined },
    teamSize: { type: Number, default: 1 },
    fundingNeeded: { type: Number, default: undefined },
    activeProducts: { type: Number, default: 1 },
    launchedToInvestors: { type: Boolean, default: false },
    launchedToMentors: { type: Boolean, default: false },
    launchedToRecruiters: { type: Boolean, default: false },
    launchedAt: { type: Date, default: undefined },
    innovationScore: { type: Number, default: 0 },
    innovationScoreAtLaunch: { type: Number, default: 0 },
    totalShares: { type: Number, default: 1000, min: 1 },
    availableShares: { type: Number, default: 1000, min: 0 },
    reservedForSole: { type: Number, default: 510, min: 0 },
    maxPennyInvestors: { type: Number, default: 50, min: 1 },
    currentPennyCount: { type: Number, default: 0, min: 0 },
    hasSoleInvestor: { type: Boolean, default: false },
    soleInvestorId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    traction: {
      patentFiled: { type: Boolean, default: false },
      mvpBuilt: { type: Boolean, default: false },
      revenueGenerating: { type: Boolean, default: false },
      usersCount: { type: Number, default: undefined },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

startupSchema.index({ launchedToInvestors: 1, innovationScore: -1 });
startupSchema.index({ launchedToMentors: 1, innovationScore: -1 });
startupSchema.index({ launchedToRecruiters: 1 });

export const Startup = model<IStartup>('Startup', startupSchema);
