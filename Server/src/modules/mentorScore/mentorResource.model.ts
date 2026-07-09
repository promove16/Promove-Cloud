import { Schema, Types, model } from 'mongoose';

export type ResourceType = 'case_study' | 'guide' | 'template';

export interface IMentorResource {
  _id:                Types.ObjectId;
  mentorId:           Types.ObjectId;
  title:              string;
  description:        string;
  type:               ResourceType;
  fileUrl:            string;
  tags:               string[];
  downloadCount:      number;
  downloadedByUsers:  Types.ObjectId[];
  milestonesAwarded:  number;
  savedByUsers:       Types.ObjectId[];
  savedCount:         number;
  isCuratedByAdmin:   boolean;
  createdAt:          Date;
  updatedAt:          Date;
}

const mentorResourceSchema = new Schema<IMentorResource>(
  {
    mentorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      default: '',
      maxlength: 1000,
    },
    type: {
      type: String,
      enum: ['case_study', 'guide', 'template'],
      required: true,
    },
    fileUrl: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2048,
    },
    tags: {
      type: [String],
      default: [],
    },
    downloadCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    downloadedByUsers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    milestonesAwarded: {
      type: Number,
      default: 0,
      min: 0,
    },
    savedByUsers: {
      type: [Schema.Types.ObjectId],
      ref: 'User',
      default: [],
    },
    savedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isCuratedByAdmin: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true },
);

mentorResourceSchema.index({ downloadCount: -1 });
mentorResourceSchema.index({ type: 1 });
mentorResourceSchema.index({ tags: 1 });
mentorResourceSchema.index({ isCuratedByAdmin: 1 });

export const MentorResource = model<IMentorResource>('MentorResource', mentorResourceSchema);
