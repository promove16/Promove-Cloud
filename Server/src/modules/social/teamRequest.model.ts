import { HydratedDocument, Schema, Types, model } from 'mongoose';

export interface ITeamRequest {
  _id: Types.ObjectId;
  fromUserId: Types.ObjectId;
  toUserId: Types.ObjectId;
  workspaceId: Types.ObjectId;
  message: string;
  status: 'pending' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  proposedRole: 'developer' | 'designer' | 'researcher' | 'marketer' | 'lead' | 'other';
  expiresAt: Date;
  respondedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const teamRequestSchema = new Schema<ITeamRequest>(
  {
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
    },
    message: {
      type: String,
      default: '',
      maxlength: 200,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'withdrawn', 'expired'],
      default: 'pending',
    },
    proposedRole: {
      type: String,
      enum: ['developer', 'designer', 'researcher', 'marketer', 'lead', 'other'],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

teamRequestSchema.index({ fromUserId: 1, status: 1 });
teamRequestSchema.index({ toUserId: 1, status: 1 });
teamRequestSchema.index({ workspaceId: 1 });
teamRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
teamRequestSchema.index({ fromUserId: 1, toUserId: 1, workspaceId: 1 }, { unique: true });

export type TeamRequestDocument = HydratedDocument<ITeamRequest>;
export const TeamRequest = model<ITeamRequest>('TeamRequest', teamRequestSchema);
