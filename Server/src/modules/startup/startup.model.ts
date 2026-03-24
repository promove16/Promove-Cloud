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
    teamSize: { type: Number, default: 1 },
    fundingNeeded: { type: Number, default: undefined },
    activeProducts: { type: Number, default: 1 },
    launchedToInvestors: { type: Boolean, default: false },
    launchedToMentors: { type: Boolean, default: false },
    launchedToRecruiters: { type: Boolean, default: false },
    launchedAt: { type: Date, default: undefined },
    innovationScoreAtLaunch: { type: Number, default: 0 },
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

startupSchema.index({ launchedToInvestors: 1, innovationScoreAtLaunch: -1 });
startupSchema.index({ launchedToMentors: 1 });
startupSchema.index({ launchedToRecruiters: 1 });

export const Startup = model<IStartup>('Startup', startupSchema);
