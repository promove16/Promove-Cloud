import { HydratedDocument, Schema, Types, model } from 'mongoose';

export const SUPPORT_CATEGORIES = [
  'access_login',
  'workspace_collaboration',
  'startup_patent',
  'marketplace_applications',
  'institution_operations',
  'deals_payments',
  'account_profile',
  'other',
] as const;

export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

export const SUPPORT_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;
export type SupportPriority = (typeof SUPPORT_PRIORITIES)[number];

export const SUPPORT_STATUSES = ['open', 'in_progress', 'resolved', 'closed'] as const;
export type SupportStatus = (typeof SUPPORT_STATUSES)[number];

export const SUPPORT_RELATED_ENTITY_TYPES = [
  'workspace',
  'startup',
  'patent',
  'deal',
  'job',
  'application',
  'other',
] as const;
export type SupportRelatedEntityType = (typeof SUPPORT_RELATED_ENTITY_TYPES)[number];

export const SUPPORT_MESSAGE_KINDS = [
  'user_reply',
  'admin_reply',
  'internal_note',
] as const;
export type SupportMessageKind = (typeof SUPPORT_MESSAGE_KINDS)[number];

export const SUPPORT_ACTIVITY_TYPES = [
  'created',
  'assigned',
  'status_changed',
  'priority_changed',
  'reopened',
  'escalated',
  'feedback_submitted',
  'attachment_added',
] as const;
export type SupportActivityType = (typeof SUPPORT_ACTIVITY_TYPES)[number];

export interface ISupportAttachment {
  _id?: Types.ObjectId;
  url: string;
  name: string;
  mimeType?: string;
  sizeBytes?: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface ISupportMessage {
  _id?: Types.ObjectId;
  kind: SupportMessageKind;
  authorId: Types.ObjectId;
  authorRoleSnapshot?: string;
  body: string;
  attachments: ISupportAttachment[];
  createdAt: Date;
}

export interface ISupportActivity {
  _id?: Types.ObjectId;
  type: SupportActivityType;
  actorUserId?: Types.ObjectId;
  fromValue?: string;
  toValue?: string;
  note?: string;
  at: Date;
}

export interface ISupportFeedback {
  rating: number;
  comment?: string;
  submittedAt: Date;
}

export interface ISupportTicket {
  _id: Types.ObjectId;
  ticketCode: string;
  createdBy: Types.ObjectId;
  institutionId?: Types.ObjectId | null;
  roleSnapshot: string;
  category: SupportCategory;
  title: string;
  description: string;
  priority: SupportPriority;
  status: SupportStatus;
  relatedEntityType?: SupportRelatedEntityType | null;
  relatedEntityId?: string | null;
  referenceText?: string;
  attachments: ISupportAttachment[];
  assignedTo?: Types.ObjectId | null;
  watchers: Types.ObjectId[];
  messages: ISupportMessage[];
  activity: ISupportActivity[];
  firstRespondedAt?: Date | null;
  resolvedAt?: Date | null;
  closedAt?: Date | null;
  reopenedCount: number;
  lastActivityAt: Date;
  feedback?: ISupportFeedback | null;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<ISupportAttachment>(
  {
    url: { type: String, required: true, trim: true, maxlength: 1000 },
    name: { type: String, required: true, trim: true, maxlength: 240 },
    mimeType: { type: String, trim: true, maxlength: 120, default: undefined },
    sizeBytes: { type: Number, default: undefined },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const messageSchema = new Schema<ISupportMessage>(
  {
    kind: { type: String, enum: SUPPORT_MESSAGE_KINDS, required: true },
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    authorRoleSnapshot: { type: String, trim: true, maxlength: 40, default: undefined },
    body: { type: String, required: true, trim: true, maxlength: 8000 },
    attachments: { type: [attachmentSchema], default: [] },
    createdAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const activitySchema = new Schema<ISupportActivity>(
  {
    type: { type: String, enum: SUPPORT_ACTIVITY_TYPES, required: true },
    actorUserId: { type: Schema.Types.ObjectId, ref: 'User', default: undefined },
    fromValue: { type: String, trim: true, maxlength: 120, default: undefined },
    toValue: { type: String, trim: true, maxlength: 120, default: undefined },
    note: { type: String, trim: true, maxlength: 500, default: undefined },
    at: { type: Date, required: true, default: () => new Date() },
  },
  { _id: true },
);

const feedbackSchema = new Schema<ISupportFeedback>(
  {
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, maxlength: 1000, default: undefined },
    submittedAt: { type: Date, required: true, default: () => new Date() },
  },
  { _id: false },
);

const supportTicketSchema = new Schema<ISupportTicket>(
  {
    ticketCode: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      maxlength: 32,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    roleSnapshot: { type: String, required: true, trim: true, maxlength: 40 },
    category: {
      type: String,
      enum: SUPPORT_CATEGORIES,
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 8000 },
    priority: {
      type: String,
      enum: SUPPORT_PRIORITIES,
      default: 'medium',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: SUPPORT_STATUSES,
      default: 'open',
      required: true,
      index: true,
    },
    relatedEntityType: {
      type: String,
      enum: [...SUPPORT_RELATED_ENTITY_TYPES, null],
      default: null,
    },
    relatedEntityId: { type: String, trim: true, maxlength: 120, default: null },
    referenceText: { type: String, trim: true, maxlength: 240, default: undefined },
    attachments: { type: [attachmentSchema], default: [] },
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    watchers: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    messages: { type: [messageSchema], default: [] },
    activity: { type: [activitySchema], default: [] },
    firstRespondedAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    reopenedCount: { type: Number, default: 0 },
    lastActivityAt: { type: Date, required: true, default: () => new Date(), index: true },
    feedback: { type: feedbackSchema, default: null },
  },
  { timestamps: true },
);

supportTicketSchema.index({ createdBy: 1, status: 1, createdAt: -1 });
supportTicketSchema.index({ status: 1, priority: 1, lastActivityAt: -1 });
supportTicketSchema.index({ assignedTo: 1, status: 1, lastActivityAt: -1 });
supportTicketSchema.index({ category: 1, status: 1 });

export type SupportTicketDocument = HydratedDocument<ISupportTicket>;
export const SupportTicket = model<ISupportTicket>('SupportTicket', supportTicketSchema);

interface ISupportCounter {
  _id: string;
  seq: number;
}

const supportCounterSchema = new Schema<ISupportCounter>(
  {
    _id: { type: String, required: true },
    seq: { type: Number, default: 0 },
  },
  { versionKey: false },
);

export const SupportCounter = model<ISupportCounter>('SupportCounter', supportCounterSchema);
