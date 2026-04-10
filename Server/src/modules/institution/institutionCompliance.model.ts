import { Schema, Types, model } from 'mongoose';

export const complianceIncidentSeverity = ['low', 'medium', 'high', 'critical'] as const;
export const complianceIncidentStatus = ['open', 'in_progress', 'resolved', 'dismissed'] as const;
export const complianceIncidentCategory = [
  'attendance',
  'submission',
  'security',
  'discipline',
  'policy',
  'other',
] as const;
export const complianceIncidentSource = ['manual', 'system'] as const;

export const complianceAlertLevel = ['info', 'warning', 'critical'] as const;

export const complianceActionStatus = ['pending', 'in_progress', 'completed'] as const;
export const complianceActionPriority = ['low', 'medium', 'high'] as const;

export interface IComplianceIncident {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: 'school' | 'college';
  title: string;
  description?: string;
  category: (typeof complianceIncidentCategory)[number];
  severity: (typeof complianceIncidentSeverity)[number];
  status: (typeof complianceIncidentStatus)[number];
  source: (typeof complianceIncidentSource)[number];
  reportedBy: Types.ObjectId;
  assignedTo?: Types.ObjectId;
  dueAt?: Date;
  relatedStudentId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComplianceAlert {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: 'school' | 'college';
  title: string;
  message: string;
  level: (typeof complianceAlertLevel)[number];
  isRead: boolean;
  incidentId?: Types.ObjectId;
  ruleKey?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IComplianceAction {
  _id: Types.ObjectId;
  institutionId: Types.ObjectId;
  institutionType: 'school' | 'college';
  incidentId?: Types.ObjectId;
  title: string;
  details?: string;
  ownerId?: Types.ObjectId;
  dueAt?: Date;
  status: (typeof complianceActionStatus)[number];
  priority: (typeof complianceActionPriority)[number];
  completedAt?: Date;
  completionNote?: string;
  createdBy: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const complianceIncidentSchema = new Schema<IComplianceIncident>(
  {
    institutionId: { type: Schema.Types.ObjectId, required: true, index: true },
    institutionType: { type: String, enum: ['school', 'college'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, trim: true, maxlength: 2000 },
    category: { type: String, enum: complianceIncidentCategory, required: true },
    severity: { type: String, enum: complianceIncidentSeverity, required: true, default: 'medium' },
    status: { type: String, enum: complianceIncidentStatus, required: true, default: 'open' },
    source: { type: String, enum: complianceIncidentSource, required: true, default: 'manual' },
    reportedBy: { type: Schema.Types.ObjectId, required: true },
    assignedTo: { type: Schema.Types.ObjectId },
    dueAt: { type: Date },
    relatedStudentId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

const complianceAlertSchema = new Schema<IComplianceAlert>(
  {
    institutionId: { type: Schema.Types.ObjectId, required: true, index: true },
    institutionType: { type: String, enum: ['school', 'college'], required: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    level: { type: String, enum: complianceAlertLevel, required: true, default: 'info' },
    isRead: { type: Boolean, default: false, index: true },
    incidentId: { type: Schema.Types.ObjectId },
    ruleKey: { type: String, trim: true, maxlength: 120 },
    createdBy: { type: Schema.Types.ObjectId },
  },
  { timestamps: true },
);

const complianceActionSchema = new Schema<IComplianceAction>(
  {
    institutionId: { type: Schema.Types.ObjectId, required: true, index: true },
    institutionType: { type: String, enum: ['school', 'college'], required: true },
    incidentId: { type: Schema.Types.ObjectId },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    details: { type: String, trim: true, maxlength: 2000 },
    ownerId: { type: Schema.Types.ObjectId },
    dueAt: { type: Date },
    status: { type: String, enum: complianceActionStatus, required: true, default: 'pending' },
    priority: { type: String, enum: complianceActionPriority, required: true, default: 'medium' },
    completedAt: { type: Date },
    completionNote: { type: String, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

complianceIncidentSchema.index({ institutionId: 1, institutionType: 1, createdAt: -1 });
complianceIncidentSchema.index({ institutionId: 1, institutionType: 1, status: 1 });
complianceAlertSchema.index({ institutionId: 1, institutionType: 1, createdAt: -1 });
complianceActionSchema.index({ institutionId: 1, institutionType: 1, createdAt: -1 });
complianceActionSchema.index({ institutionId: 1, institutionType: 1, status: 1, dueAt: 1 });

export const ComplianceIncident = model<IComplianceIncident>('ComplianceIncident', complianceIncidentSchema);
export const ComplianceAlert = model<IComplianceAlert>('ComplianceAlert', complianceAlertSchema);
export const ComplianceAction = model<IComplianceAction>('ComplianceAction', complianceActionSchema);
