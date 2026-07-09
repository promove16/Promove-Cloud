import { Schema, model } from 'mongoose';
import {
  IMentorScore,
  IMentorPhase1Breakdown,
  IMentorPhase2Breakdown,
  IMentorPhase3Breakdown,
} from './mentorScore.types';

const phase1BreakdownSchema = new Schema<IMentorPhase1Breakdown>(
  {
    training:          { type: Number, default: 0, min: 0 },
    labSync:           { type: Number, default: 0, min: 0 },
    curriculumMapping: { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const phase2BreakdownSchema = new Schema<IMentorPhase2Breakdown>(
  {
    industryConnects:  { type: Number, default: 0, min: 0 },
    prototypeVelocity: { type: Number, default: 0, min: 0 },
    demoDay:           { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const phase3BreakdownSchema = new Schema<IMentorPhase3Breakdown>(
  {
    resourceLibrary: { type: Number, default: 0, min: 0 },
    forum:           { type: Number, default: 0, min: 0 },
    sessions:        { type: Number, default: 0, min: 0 },
    equityLOIs:      { type: Number, default: 0, min: 0 },
    outcomeBonuses:  { type: Number, default: 0, min: 0 },
  },
  { _id: false },
);

const mentorScoreSchema = new Schema<IMentorScore>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    totalScore: { type: Number, default: 0, min: 0 },
    phase1Score: { type: Number, default: 0, min: 0 },
    phase2Score: { type: Number, default: 0, min: 0 },
    phase3Score: { type: Number, default: 0, min: 0 },
    phase1Breakdown: {
      type: phase1BreakdownSchema,
      default: () => ({ training: 0, labSync: 0, curriculumMapping: 0 }),
    },
    phase2Breakdown: {
      type: phase2BreakdownSchema,
      default: () => ({ industryConnects: 0, prototypeVelocity: 0, demoDay: 0 }),
    },
    phase3Breakdown: {
      type: phase3BreakdownSchema,
      default: () => ({ resourceLibrary: 0, forum: 0, sessions: 0, equityLOIs: 0, outcomeBonuses: 0 }),
    },
    lastActivityAt:   { type: Date, default: () => new Date() },
    mentorshipRating: { type: Number, default: 0, min: 0, max: 5 },
    incubationRate:   { type: Number, default: 0, min: 0, max: 100 },
    rank:             { type: Number, default: 0, min: 0 },
  },
  {
    timestamps: true,
  },
);

mentorScoreSchema.index({ totalScore: -1 });
mentorScoreSchema.index({ phase1Score: -1 });
mentorScoreSchema.index({ phase2Score: -1 });
mentorScoreSchema.index({ phase3Score: -1 });
mentorScoreSchema.index({ lastActivityAt: 1 });

export const MentorScore = model<IMentorScore>('MentorScore', mentorScoreSchema);
