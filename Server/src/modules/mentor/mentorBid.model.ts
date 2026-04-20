import { model, Schema, Types } from 'mongoose';

export interface IMentorBid {
  mentorId: Types.ObjectId;
  opportunityId: Types.ObjectId;
  opportunityTitle: string;
  kind: 'startup' | 'problem_bank';
  expertise: string;
  hoursPerWeek: number;
  proposedDurationWeeks: number;
  coverNote: string;
  status: 'pending' | 'accepted' | 'rejected' | 'withdrawn';
  createdAt: Date;
  updatedAt: Date;
}

const mentorBidSchema = new Schema<IMentorBid>(
  {
    mentorId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    opportunityId: { type: Schema.Types.ObjectId, required: true, index: true },
    opportunityTitle: { type: String, required: true },
    kind: { type: String, enum: ['startup', 'problem_bank'], required: true },
    expertise: { type: String, required: true, maxlength: 400 },
    hoursPerWeek: { type: Number, required: true, min: 1, max: 40 },
    proposedDurationWeeks: { type: Number, required: true, min: 1, max: 52 },
    coverNote: { type: String, required: true, maxlength: 800 },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected', 'withdrawn'],
      default: 'pending',
    },
  },
  { timestamps: true },
);

// A mentor can only have one active (non-withdrawn) bid per opportunity
mentorBidSchema.index({ mentorId: 1, opportunityId: 1 }, { unique: true });

export const MentorBid = model<IMentorBid>('MentorBid', mentorBidSchema);
