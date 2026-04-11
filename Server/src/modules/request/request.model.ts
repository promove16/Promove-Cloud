import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const REQUEST_TYPES = [
  'generic',
  'helpdesk_ticket',
  'workspace_member',
  'workspace_chat_access',
  'startup_member',
  'startup_cofounder',
  'mentor_assignment',
  'investor_startup_access',
  'recruiter_job_invite',
  'campus_drive_registration',
  'college_event_invite',
  'college_recruiter_partnership',
  'patent_coinventor',
  'problem_review',
  'startup_review',
  'patent_request_review',
] as const;

export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_ACTION_TYPES = [
  'join',
  'collaborate',
  'mentor',
  'invest',
  'review',
  'approve',
  'register',
  'shortlist',
  'hire',
  'access_chat',
  'access_private_details',
  'co_invent',
  'partner',
  'assign',
  'connect',
] as const;

export type RequestActionType = (typeof REQUEST_ACTION_TYPES)[number];

export const REQUEST_STATUSES = [
  'pending',
  'accepted',
  'declined',
  'withdrawn',
  'expired',
  'cancelled',
  'completed',
] as const;

export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface IRequestAuditEntry {
  status: RequestStatus | 'created';
  actorUserId?: Types.ObjectId;
  message?: string;
  metadata?: Record<string, unknown>;
  at: Date;
}

export interface IRequest {
  _id: Types.ObjectId;
  institutionId?: Types.ObjectId | null;
  type: RequestType;
  actionType?: RequestActionType;
  fromUserId: Types.ObjectId;
  toUserId?: Types.ObjectId;
  recipientEmail?: string;
  targetEntityType: string;
  targetEntityId: string;
  targetEntityTitle?: string;
  targetRole?: string;
  requestedRole?: string;
  requestedPermission?: string;
  status: RequestStatus;
  message: string;
  metadata?: Record<string, unknown>;
  deepLink?: string;
  acceptRedirect?: string;
  declineRedirect?: string;
  expiresAt: Date;
  respondedAt?: Date | null;
  auditTrail: IRequestAuditEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const requestAuditEntrySchema = new Schema<IRequestAuditEntry>(
  {
    status: {
      type: String,
      enum: ['created', ...REQUEST_STATUSES],
      required: true,
    },
    actorUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    at: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
  },
  { _id: false },
);

const requestSchema = new Schema<IRequest>(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: REQUEST_TYPES,
      required: true,
      index: true,
    },
    actionType: {
      type: String,
      enum: REQUEST_ACTION_TYPES,
      default: undefined,
      index: true,
    },
    fromUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    toUserId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
      index: true,
    },
    recipientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: undefined,
      index: true,
    },
    targetEntityType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 80,
      index: true,
    },
    targetEntityId: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    targetEntityTitle: {
      type: String,
      trim: true,
      maxlength: 180,
      default: undefined,
    },
    targetRole: {
      type: String,
      trim: true,
      maxlength: 80,
      default: undefined,
    },
    requestedRole: {
      type: String,
      trim: true,
      maxlength: 80,
      default: undefined,
    },
    requestedPermission: {
      type: String,
      trim: true,
      maxlength: 120,
      default: undefined,
    },
    status: {
      type: String,
      enum: REQUEST_STATUSES,
      default: 'pending',
      required: true,
      index: true,
    },
    message: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    deepLink: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
    acceptRedirect: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
    declineRedirect: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    respondedAt: {
      type: Date,
      default: null,
    },
    auditTrail: {
      type: [requestAuditEntrySchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

requestSchema.index({ toUserId: 1, status: 1, createdAt: -1 });
requestSchema.index({ recipientEmail: 1, status: 1, createdAt: -1 });
requestSchema.index({ fromUserId: 1, status: 1, createdAt: -1 });
requestSchema.index({ institutionId: 1, status: 1, createdAt: -1 });
requestSchema.index({ type: 1, targetEntityType: 1, targetEntityId: 1, status: 1 });
requestSchema.index({
  fromUserId: 1,
  toUserId: 1,
  recipientEmail: 1,
  type: 1,
  targetEntityType: 1,
  targetEntityId: 1,
  status: 1,
});

export type RequestDocument = HydratedDocument<IRequest>;
export const RequestRecord = model<IRequest>('Request', requestSchema);
