import { Types } from 'mongoose';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import {
  ComplianceAction,
  ComplianceAlert,
  ComplianceIncident,
  complianceActionPriority,
  complianceActionStatus,
  complianceAlertLevel,
  complianceIncidentCategory,
  complianceIncidentSeverity,
  complianceIncidentStatus,
  complianceIncidentSource,
} from './institutionCompliance.model';
import type { InstitutionPolicy } from '../user/user.types';

export type InstitutionComplianceType = 'school' | 'college';

type ComplianceStatusView = 'on_track' | 'in_progress' | 'needs_attention';

export interface ComplianceFrameworkItem {
  name: string;
  status: ComplianceStatusView;
  displayStatus: string;
  lastUpdated?: string;
  scoreLevel: string;
}

export interface ComplianceIncidentView {
  _id: string;
  title: string;
  description?: string;
  category: (typeof complianceIncidentCategory)[number];
  severity: (typeof complianceIncidentSeverity)[number];
  status: (typeof complianceIncidentStatus)[number];
  source: (typeof complianceIncidentSource)[number];
  reportedBy: string;
  assignedTo?: string;
  dueAt?: string;
  relatedStudentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceAlertView {
  _id: string;
  title: string;
  message: string;
  level: (typeof complianceAlertLevel)[number];
  isRead: boolean;
  incidentId?: string;
  ruleKey?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ComplianceActionView {
  _id: string;
  incidentId?: string;
  title: string;
  details?: string;
  ownerId?: string;
  dueAt?: string;
  status: (typeof complianceActionStatus)[number];
  priority: (typeof complianceActionPriority)[number];
  completedAt?: string;
  completionNote?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isOverdue: boolean;
}

export interface ComplianceAuditItem {
  _id: string;
  type: 'incident' | 'alert' | 'action';
  title: string;
  detail: string;
  createdAt: string;
}

export interface ComplianceOverview {
  institutionType: InstitutionComplianceType;
  frameworkSummary: {
    total: number;
    onTrack: number;
    inProgress: number;
    needsAttention: number;
  };
  incidentSummary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    critical: number;
  };
  alertSummary: {
    total: number;
    unread: number;
    critical: number;
  };
  actionSummary: {
    total: number;
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };
  frameworks: ComplianceFrameworkItem[];
  latestIncidents: ComplianceIncidentView[];
  latestAlerts: ComplianceAlertView[];
  latestActions: ComplianceActionView[];
  auditTrail: ComplianceAuditItem[];
}

const defaultFrameworksByType: Record<InstitutionComplianceType, string[]> = {
  school: [
    'ATL / School Innovation Program',
    'SQAAF / School Quality Assurance',
    'NEP 2020 School Compliance',
    'Attendance Governance',
    'Student Safety & Conduct',
  ],
  college: [
    "IIC (Institution's Innovation Council)",
    'NAAC (Accreditation)',
    'NIRF (Innovation Ranking)',
    'AICTE Regulations',
    'NEP 2020 Compliance',
    'NISP (Innovation Startup Policy)',
  ],
};

const incidentQuerySchema = z.object({
  status: z.enum(complianceIncidentStatus).optional(),
  severity: z.enum(complianceIncidentSeverity).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createComplianceIncidentSchema = z.object({
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().max(2000).optional(),
  category: z.enum(complianceIncidentCategory),
  severity: z.enum(complianceIncidentSeverity).default('medium'),
  status: z.enum(complianceIncidentStatus).optional(),
  source: z.enum(complianceIncidentSource).default('manual'),
  assignedTo: z.string().trim().optional(),
  dueAt: z.string().datetime().optional(),
  relatedStudentId: z.string().trim().optional(),
});

export const updateComplianceIncidentSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    description: z.string().trim().max(2000).optional(),
    category: z.enum(complianceIncidentCategory).optional(),
    severity: z.enum(complianceIncidentSeverity).optional(),
    status: z.enum(complianceIncidentStatus).optional(),
    assignedTo: z.string().trim().optional(),
    dueAt: z.string().datetime().optional(),
    relatedStudentId: z.string().trim().optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
  });

const alertQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const createComplianceAlertSchema = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(1000),
  level: z.enum(complianceAlertLevel).default('warning'),
  incidentId: z.string().trim().optional(),
  ruleKey: z.string().trim().max(120).optional(),
});

export const createComplianceActionSchema = z.object({
  incidentId: z.string().trim().optional(),
  title: z.string().trim().min(3).max(160),
  details: z.string().trim().max(2000).optional(),
  ownerId: z.string().trim().optional(),
  dueAt: z.string().datetime().optional(),
  status: z.enum(complianceActionStatus).default('pending'),
  priority: z.enum(complianceActionPriority).default('medium'),
});

export const updateComplianceActionSchema = z
  .object({
    title: z.string().trim().min(3).max(160).optional(),
    details: z.string().trim().max(2000).optional(),
    ownerId: z.string().trim().optional(),
    dueAt: z.string().datetime().optional(),
    status: z.enum(complianceActionStatus).optional(),
    priority: z.enum(complianceActionPriority).optional(),
    completionNote: z.string().trim().max(1000).optional(),
  })
  .refine((payload) => Object.keys(payload).length > 0, {
    message: 'At least one field is required',
  });

const toObjectId = (value?: string): Types.ObjectId | undefined => {
  if (!value) {
    return undefined;
  }

  return Types.ObjectId.isValid(value) ? new Types.ObjectId(value) : undefined;
};

const toFrameworkStatus = (policyStatus: InstitutionPolicy['status']): ComplianceStatusView => {
  if (policyStatus === 'Active' || policyStatus === 'On Track') {
    return 'on_track';
  }
  if (policyStatus === 'Pending') {
    return 'in_progress';
  }
  return 'needs_attention';
};

const toFrameworkScore = (status: ComplianceStatusView) => {
  if (status === 'on_track') {
    return 'Healthy';
  }
  if (status === 'in_progress') {
    return 'In Progress';
  }
  return 'Needs Attention';
};

const mapIncident = (incident: {
  _id: Types.ObjectId;
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
}): ComplianceIncidentView => ({
  _id: String(incident._id),
  title: incident.title,
  ...(incident.description ? { description: incident.description } : {}),
  category: incident.category,
  severity: incident.severity,
  status: incident.status,
  source: incident.source,
  reportedBy: String(incident.reportedBy),
  ...(incident.assignedTo ? { assignedTo: String(incident.assignedTo) } : {}),
  ...(incident.dueAt ? { dueAt: incident.dueAt.toISOString() } : {}),
  ...(incident.relatedStudentId ? { relatedStudentId: String(incident.relatedStudentId) } : {}),
  createdAt: incident.createdAt.toISOString(),
  updatedAt: incident.updatedAt.toISOString(),
});

const mapAlert = (alert: {
  _id: Types.ObjectId;
  title: string;
  message: string;
  level: (typeof complianceAlertLevel)[number];
  isRead: boolean;
  incidentId?: Types.ObjectId;
  ruleKey?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}): ComplianceAlertView => ({
  _id: String(alert._id),
  title: alert.title,
  message: alert.message,
  level: alert.level,
  isRead: alert.isRead,
  ...(alert.incidentId ? { incidentId: String(alert.incidentId) } : {}),
  ...(alert.ruleKey ? { ruleKey: alert.ruleKey } : {}),
  ...(alert.createdBy ? { createdBy: String(alert.createdBy) } : {}),
  createdAt: alert.createdAt.toISOString(),
  updatedAt: alert.updatedAt.toISOString(),
});

const mapAction = (action: {
  _id: Types.ObjectId;
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
}): ComplianceActionView => {
  const isOverdue = Boolean(action.dueAt && action.status !== 'completed' && action.dueAt.getTime() < Date.now());
  return {
    _id: String(action._id),
    ...(action.incidentId ? { incidentId: String(action.incidentId) } : {}),
    title: action.title,
    ...(action.details ? { details: action.details } : {}),
    ...(action.ownerId ? { ownerId: String(action.ownerId) } : {}),
    ...(action.dueAt ? { dueAt: action.dueAt.toISOString() } : {}),
    status: action.status,
    priority: action.priority,
    ...(action.completedAt ? { completedAt: action.completedAt.toISOString() } : {}),
    ...(action.completionNote ? { completionNote: action.completionNote } : {}),
    createdBy: String(action.createdBy),
    createdAt: action.createdAt.toISOString(),
    updatedAt: action.updatedAt.toISOString(),
    isOverdue,
  };
};

const ensureInstitution = async (institutionId: string, institutionType: InstitutionComplianceType) => {
  const institution = await User.findById(institutionId).select('role institutionProfile.policies').lean();
  if (!institution || institution.role !== institutionType) {
    throw new ApiError(404, 'INSTITUTION_NOT_FOUND', 'Institution not found');
  }
  return institution;
};

const buildFrameworks = (
  institutionType: InstitutionComplianceType,
  policies: InstitutionPolicy[] = [],
): ComplianceFrameworkItem[] => {
  const defaultNames = defaultFrameworksByType[institutionType];
  const policyMap = new Map(policies.map((policy) => [policy.name.toLowerCase(), policy]));

  const fromDefaults = defaultNames.map((name) => {
    const match = policyMap.get(name.toLowerCase());
    const mappedStatus = match ? toFrameworkStatus(match.status) : 'in_progress';

    return {
      name,
      status: mappedStatus,
      displayStatus:
        mappedStatus === 'on_track'
          ? 'On Track'
          : mappedStatus === 'in_progress'
            ? 'In Progress'
            : 'Needs Attention',
      ...(match?.lastUpdated ? { lastUpdated: new Date(match.lastUpdated).toISOString() } : {}),
      scoreLevel: toFrameworkScore(mappedStatus),
    } satisfies ComplianceFrameworkItem;
  });

  const extraPolicies = policies
    .filter((policy) => !defaultNames.some((name) => name.toLowerCase() === policy.name.toLowerCase()))
    .map((policy) => {
      const mappedStatus = toFrameworkStatus(policy.status);
      return {
        name: policy.name,
        status: mappedStatus,
        displayStatus:
          mappedStatus === 'on_track'
            ? 'On Track'
            : mappedStatus === 'in_progress'
              ? 'In Progress'
              : 'Needs Attention',
        ...(policy.lastUpdated ? { lastUpdated: new Date(policy.lastUpdated).toISOString() } : {}),
        scoreLevel: toFrameworkScore(mappedStatus),
      } satisfies ComplianceFrameworkItem;
    });

  return [...fromDefaults, ...extraPolicies];
};

export const getComplianceOverview = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
): Promise<ComplianceOverview> => {
  const institution = await ensureInstitution(institutionId, institutionType);

  const [
    incidents,
    alerts,
    actions,
    totalIncidents,
    totalAlerts,
    totalActions,
    openIncidentCount,
    inProgressIncidentCount,
    resolvedIncidentCount,
    criticalIncidentCount,
    unreadAlertCount,
    criticalAlertCount,
    pendingActionCount,
    inProgressActionCount,
    completedActionCount,
  ] = await Promise.all([
    ComplianceIncident.find({ institutionId, institutionType }).sort({ createdAt: -1 }).limit(5).lean(),
    ComplianceAlert.find({ institutionId, institutionType }).sort({ createdAt: -1 }).limit(5).lean(),
    ComplianceAction.find({ institutionId, institutionType }).sort({ createdAt: -1 }).limit(5).lean(),
    ComplianceIncident.countDocuments({ institutionId, institutionType }),
    ComplianceAlert.countDocuments({ institutionId, institutionType }),
    ComplianceAction.countDocuments({ institutionId, institutionType }),
    ComplianceIncident.countDocuments({ institutionId, institutionType, status: 'open' }),
    ComplianceIncident.countDocuments({ institutionId, institutionType, status: 'in_progress' }),
    ComplianceIncident.countDocuments({ institutionId, institutionType, status: 'resolved' }),
    ComplianceIncident.countDocuments({ institutionId, institutionType, severity: 'critical' }),
    ComplianceAlert.countDocuments({ institutionId, institutionType, isRead: false }),
    ComplianceAlert.countDocuments({ institutionId, institutionType, level: 'critical' }),
    ComplianceAction.countDocuments({ institutionId, institutionType, status: 'pending' }),
    ComplianceAction.countDocuments({ institutionId, institutionType, status: 'in_progress' }),
    ComplianceAction.countDocuments({ institutionId, institutionType, status: 'completed' }),
  ]);

  const overdueActionCount = await ComplianceAction.countDocuments({
    institutionId,
    institutionType,
    status: { $in: ['pending', 'in_progress'] },
    dueAt: { $lt: new Date() },
  });

  const mappedIncidents = incidents.map(mapIncident);
  const mappedAlerts = alerts.map(mapAlert);
  const mappedActions = actions.map(mapAction);

  const frameworks = buildFrameworks(
    institutionType,
    (institution.institutionProfile?.policies ?? []) as InstitutionPolicy[],
  );

  const auditTrail: ComplianceAuditItem[] = [
    ...mappedIncidents.map((item) => ({
      _id: `incident-${item._id}`,
      type: 'incident' as const,
      title: item.title,
      detail: `${item.severity.toUpperCase()} • ${item.status.replace('_', ' ')}`,
      createdAt: item.createdAt,
    })),
    ...mappedAlerts.map((item) => ({
      _id: `alert-${item._id}`,
      type: 'alert' as const,
      title: item.title,
      detail: `${item.level.toUpperCase()} • ${item.isRead ? 'Read' : 'Unread'}`,
      createdAt: item.createdAt,
    })),
    ...mappedActions.map((item) => ({
      _id: `action-${item._id}`,
      type: 'action' as const,
      title: item.title,
      detail: `${item.priority.toUpperCase()} • ${item.status.replace('_', ' ')}`,
      createdAt: item.createdAt,
    })),
  ]
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, 12);

  return {
    institutionType,
    frameworkSummary: {
      total: frameworks.length,
      onTrack: frameworks.filter((item) => item.status === 'on_track').length,
      inProgress: frameworks.filter((item) => item.status === 'in_progress').length,
      needsAttention: frameworks.filter((item) => item.status === 'needs_attention').length,
    },
    incidentSummary: {
      total: totalIncidents,
      open: openIncidentCount,
      inProgress: inProgressIncidentCount,
      resolved: resolvedIncidentCount,
      critical: criticalIncidentCount,
    },
    alertSummary: {
      total: totalAlerts,
      unread: unreadAlertCount,
      critical: criticalAlertCount,
    },
    actionSummary: {
      total: totalActions,
      pending: pendingActionCount,
      inProgress: inProgressActionCount,
      completed: completedActionCount,
      overdue: overdueActionCount,
    },
    frameworks,
    latestIncidents: mappedIncidents,
    latestAlerts: mappedAlerts,
    latestActions: mappedActions,
    auditTrail,
  };
};

export const listComplianceIncidents = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  query: unknown,
): Promise<ComplianceIncidentView[]> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = incidentQuerySchema.parse(query ?? {});

  const incidents = await ComplianceIncident.find({
    institutionId,
    institutionType,
    ...(parsed.status ? { status: parsed.status } : {}),
    ...(parsed.severity ? { severity: parsed.severity } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(parsed.limit)
    .lean();

  return incidents.map(mapIncident);
};

export const createComplianceIncident = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  actorId: string,
  payload: unknown,
): Promise<ComplianceIncidentView> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = createComplianceIncidentSchema.parse(payload);

  const incident = await ComplianceIncident.create({
    institutionId,
    institutionType,
    title: parsed.title,
    ...(parsed.description ? { description: parsed.description } : {}),
    category: parsed.category,
    severity: parsed.severity,
    status: parsed.status ?? 'open',
    source: parsed.source,
    reportedBy: new Types.ObjectId(actorId),
    ...(toObjectId(parsed.assignedTo) ? { assignedTo: toObjectId(parsed.assignedTo) } : {}),
    ...(parsed.dueAt ? { dueAt: new Date(parsed.dueAt) } : {}),
    ...(toObjectId(parsed.relatedStudentId) ? { relatedStudentId: toObjectId(parsed.relatedStudentId) } : {}),
  });

  await ComplianceAlert.create({
    institutionId,
    institutionType,
    title: `Incident reported: ${incident.title}`,
    message: `${incident.category} issue marked as ${incident.severity} severity.`,
    level: incident.severity === 'critical' ? 'critical' : 'warning',
    incidentId: incident._id,
    createdBy: new Types.ObjectId(actorId),
    ruleKey: 'incident_created',
  });

  return mapIncident(incident.toObject());
};

export const updateComplianceIncident = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  incidentId: string,
  payload: unknown,
): Promise<ComplianceIncidentView> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = updateComplianceIncidentSchema.parse(payload);

  const incident = await ComplianceIncident.findOneAndUpdate(
    { _id: incidentId, institutionId, institutionType },
    {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.description !== undefined ? { description: parsed.description } : {}),
      ...(parsed.category ? { category: parsed.category } : {}),
      ...(parsed.severity ? { severity: parsed.severity } : {}),
      ...(parsed.status ? { status: parsed.status } : {}),
      ...(parsed.assignedTo !== undefined ? { assignedTo: toObjectId(parsed.assignedTo) } : {}),
      ...(parsed.dueAt !== undefined ? { dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined } : {}),
      ...(parsed.relatedStudentId !== undefined
        ? { relatedStudentId: toObjectId(parsed.relatedStudentId) }
        : {}),
    },
    { new: true },
  ).lean();

  if (!incident) {
    throw new ApiError(404, 'INCIDENT_NOT_FOUND', 'Compliance incident not found');
  }

  return mapIncident(incident);
};

export const listComplianceAlerts = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  query: unknown,
): Promise<ComplianceAlertView[]> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = alertQuerySchema.parse(query ?? {});

  const alerts = await ComplianceAlert.find({
    institutionId,
    institutionType,
    ...(parsed.unreadOnly ? { isRead: false } : {}),
  })
    .sort({ createdAt: -1 })
    .limit(parsed.limit)
    .lean();

  return alerts.map(mapAlert);
};

export const createComplianceAlert = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  actorId: string,
  payload: unknown,
): Promise<ComplianceAlertView> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = createComplianceAlertSchema.parse(payload);

  const alert = await ComplianceAlert.create({
    institutionId,
    institutionType,
    title: parsed.title,
    message: parsed.message,
    level: parsed.level,
    ...(toObjectId(parsed.incidentId) ? { incidentId: toObjectId(parsed.incidentId) } : {}),
    ...(parsed.ruleKey ? { ruleKey: parsed.ruleKey } : {}),
    createdBy: new Types.ObjectId(actorId),
  });

  return mapAlert(alert.toObject());
};

export const markComplianceAlertRead = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  alertId: string,
): Promise<ComplianceAlertView> => {
  await ensureInstitution(institutionId, institutionType);

  const alert = await ComplianceAlert.findOneAndUpdate(
    { _id: alertId, institutionId, institutionType },
    { isRead: true },
    { new: true },
  ).lean();

  if (!alert) {
    throw new ApiError(404, 'ALERT_NOT_FOUND', 'Compliance alert not found');
  }

  return mapAlert(alert);
};

export const listComplianceActions = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
): Promise<ComplianceActionView[]> => {
  await ensureInstitution(institutionId, institutionType);

  const actions = await ComplianceAction.find({ institutionId, institutionType })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  return actions.map(mapAction);
};

export const createComplianceAction = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  actorId: string,
  payload: unknown,
): Promise<ComplianceActionView> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = createComplianceActionSchema.parse(payload);

  const action = await ComplianceAction.create({
    institutionId,
    institutionType,
    ...(toObjectId(parsed.incidentId) ? { incidentId: toObjectId(parsed.incidentId) } : {}),
    title: parsed.title,
    ...(parsed.details ? { details: parsed.details } : {}),
    ...(toObjectId(parsed.ownerId) ? { ownerId: toObjectId(parsed.ownerId) } : {}),
    ...(parsed.dueAt ? { dueAt: new Date(parsed.dueAt) } : {}),
    status: parsed.status,
    priority: parsed.priority,
    createdBy: new Types.ObjectId(actorId),
    ...(parsed.status === 'completed' ? { completedAt: new Date() } : {}),
  });

  return mapAction(action.toObject());
};

export const updateComplianceAction = async (
  institutionId: string,
  institutionType: InstitutionComplianceType,
  actionId: string,
  payload: unknown,
): Promise<ComplianceActionView> => {
  await ensureInstitution(institutionId, institutionType);
  const parsed = updateComplianceActionSchema.parse(payload);

  const nextStatus = parsed.status;
  const action = await ComplianceAction.findOneAndUpdate(
    { _id: actionId, institutionId, institutionType },
    {
      ...(parsed.title ? { title: parsed.title } : {}),
      ...(parsed.details !== undefined ? { details: parsed.details } : {}),
      ...(parsed.ownerId !== undefined ? { ownerId: toObjectId(parsed.ownerId) } : {}),
      ...(parsed.dueAt !== undefined ? { dueAt: parsed.dueAt ? new Date(parsed.dueAt) : undefined } : {}),
      ...(parsed.priority ? { priority: parsed.priority } : {}),
      ...(nextStatus ? { status: nextStatus } : {}),
      ...(nextStatus === 'completed' ? { completedAt: new Date() } : {}),
      ...(nextStatus && nextStatus !== 'completed' ? { completedAt: undefined } : {}),
      ...(parsed.completionNote !== undefined ? { completionNote: parsed.completionNote } : {}),
    },
    { new: true },
  ).lean();

  if (!action) {
    throw new ApiError(404, 'ACTION_NOT_FOUND', 'Compliance action not found');
  }

  return mapAction(action);
};
