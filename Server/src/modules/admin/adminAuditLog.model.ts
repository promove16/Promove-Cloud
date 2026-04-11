import { Schema, Types, model } from 'mongoose';

export type AdminAction =
  | 'STARTUP_APPROVED'
  | 'STARTUP_CHANGES_REQUESTED'
  | 'STARTUP_EDIT_UNLOCKED'
  | 'DEAL_REJECTED'
  | 'PATENT_APPROVED'
  | 'PATENT_REJECTED'
  | 'AWARD_APPROVED'
  | 'AWARD_REJECTED'
  | 'MILESTONE_VERIFIED'
  | 'DEAL_STAGE_APPROVED'
  | 'DEAL_REVIEW_UPDATED'
  | 'REGISTRATION_REQUEST_APPROVED'
  | 'REGISTRATION_REQUEST_REJECTED'
  | 'SOLE_INVESTOR_RESET'
  | 'USER_ROLE_CHANGED'
  | 'USER_DEACTIVATED'
  | 'USER_ACTIVATED'
  | 'MENTOR_PROFILE_CREATED'
  | 'MENTORSHIP_PROGRAM_CREATED'
  | 'MENTORSHIP_REQUEST_ASSIGNED'
  | 'MENTORSHIP_REQUEST_REJECTED'
  | 'HELPDESK_TICKET_RESOLVED'
  | 'PROJECT_MENTOR_ASSIGNED'
  | 'PROJECT_MENTOR_UNASSIGNED';

export interface IAdminAuditLog {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  action: AdminAction;
  targetId: Types.ObjectId;
  targetModel: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const adminAuditLogSchema = new Schema<IAdminAuditLog>(
  {
    adminId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    action: {
      type: String,
      enum: [
        'STARTUP_APPROVED',
        'STARTUP_CHANGES_REQUESTED',
        'STARTUP_EDIT_UNLOCKED',
        'DEAL_REJECTED',
        'PATENT_APPROVED',
        'PATENT_REJECTED',
        'AWARD_APPROVED',
        'AWARD_REJECTED',
        'MILESTONE_VERIFIED',
        'DEAL_STAGE_APPROVED',
        'DEAL_REVIEW_UPDATED',
        'REGISTRATION_REQUEST_APPROVED',
        'REGISTRATION_REQUEST_REJECTED',
        'SOLE_INVESTOR_RESET',
        'USER_ROLE_CHANGED',
        'USER_DEACTIVATED',
        'USER_ACTIVATED',
        'MENTOR_PROFILE_CREATED',
        'MENTORSHIP_PROGRAM_CREATED',
        'MENTORSHIP_REQUEST_ASSIGNED',
        'MENTORSHIP_REQUEST_REJECTED',
        'HELPDESK_TICKET_RESOLVED',
        'PROJECT_MENTOR_ASSIGNED',
        'PROJECT_MENTOR_UNASSIGNED',
      ],
      required: true,
    },
    targetId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    targetModel: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

adminAuditLogSchema.index({ adminId: 1, createdAt: -1 });
adminAuditLogSchema.index({ targetId: 1 });

export const AdminAuditLog = model<IAdminAuditLog>('AdminAuditLog', adminAuditLogSchema);
