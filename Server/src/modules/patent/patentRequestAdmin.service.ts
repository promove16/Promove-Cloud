import { Types } from 'mongoose';
import { z } from 'zod';
import { notificationQueue } from '../../config/bullmq';
import { ApiError } from '../../utils/ApiError';
import { User } from '../user/user.model';
import { UserRole } from '../../types/roles.types';
import { PatentRequest } from './patentRequest.model';
import { LEGACY_STATUS_MAP, type PatentRequestStatus } from './patent.types';
import {
  updateStatusSchema,
  assignRequestSchema,
  updateIpoDetailsSchema,
  addNoteSchema,
  addTimelineEntrySchema,
  listRequestsQuerySchema,
} from './patentRequestAdmin.validation';

// ─── Status transition map ───────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<PatentRequestStatus, PatentRequestStatus[]> = {
  draft: ['submitted'],
  submitted: ['documents_review', 'abandoned'],
  documents_review: ['ready_for_filing', 'abandoned'],
  ready_for_filing: ['filed_with_ipo', 'abandoned'],
  filed_with_ipo: ['published', 'abandoned'],
  published: ['examination_requested'],
  examination_requested: ['fer_issued', 'granted', 'rejected'],
  fer_issued: ['fer_response_submitted', 'abandoned'],
  fer_response_submitted: ['granted', 'rejected'],
  granted: [],
  rejected: [],
  abandoned: [],
};

const TERMINAL_STATUSES = new Set<PatentRequestStatus>(['granted', 'rejected', 'abandoned']);

const normalizeStatus = (raw: string): PatentRequestStatus =>
  (LEGACY_STATUS_MAP[raw] as PatentRequestStatus) ?? (raw as PatentRequestStatus);

const toIso = (value: Date | string) => new Date(value).toISOString();

// ─── List patent requests ────────────────────────────────────────────────────

export const listPatentRequests = async (
  filters: z.infer<typeof listRequestsQuerySchema>,
) => {
  const query: Record<string, unknown> = {};

  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.assignedTo) {
    query.adminAssignedTo = filters.assignedTo;
  }

  const skip = (filters.page - 1) * filters.limit;
  const [requests, total] = await Promise.all([
    PatentRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(filters.limit).lean(),
    PatentRequest.countDocuments(query),
  ]);

  const studentIds = [...new Set(requests.map((r) => String(r.studentId)))];
  const students =
    studentIds.length > 0
      ? await User.find({ _id: { $in: studentIds } })
          .select('_id displayName email avatar innovationScore')
          .lean()
      : [];
  const studentMap = new Map(students.map((s) => [String(s._id), s]));

  const items = requests.map((r) => {
    const student = studentMap.get(String(r.studentId));
    const status = normalizeStatus(r.status);

    return {
      _id: String(r._id),
      studentId: String(r.studentId),
      inventionTitle: r.inventionTitle ?? r.projectTitle ?? 'Untitled',
      patentType: r.patentType,
      status,
      specificationType: r.specificationType,
      applicantEntityType: r.applicantDetails?.entityType,
      submittedAt: r.submittedAt ? toIso(r.submittedAt) : undefined,
      ipoApplicationNumber: r.ipoApplicationNumber,
      ipoFilingDate: r.ipoFilingDate ? toIso(r.ipoFilingDate) : undefined,
      adminAssignedTo: r.adminAssignedTo ? String(r.adminAssignedTo) : undefined,
      completeSpecDeadline: r.completeSpecDeadline ? toIso(r.completeSpecDeadline) : undefined,
      examRequestDeadline: r.examRequestDeadline ? toIso(r.examRequestDeadline) : undefined,
      ferResponseDeadline: r.ferResponseDeadline ? toIso(r.ferResponseDeadline) : undefined,
      nextActionRequired: r.nextActionRequired,
      createdAt: toIso(r.createdAt),
      student: {
        _id: String(r.studentId),
        displayName: student?.displayName ?? 'Student',
        email: student?.email ?? '',
        ...(student?.avatar ? { avatar: student.avatar } : {}),
        innovationScore: student?.innovationScore ?? 0,
      },
    };
  });

  return { items, total, page: filters.page, limit: filters.limit };
};

// ─── Get patent request detail ───────────────────────────────────────────────

export const getPatentRequestDetail = async (requestId: string) => {
  const request = await PatentRequest.findById(requestId).lean();
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const student = await User.findById(request.studentId)
    .select('_id displayName email avatar innovationScore')
    .lean();

  const status = normalizeStatus(request.status);

  return {
    ...request,
    _id: String(request._id),
    studentId: String(request.studentId),
    status,
    adminAssignedTo: request.adminAssignedTo ? String(request.adminAssignedTo) : undefined,
    submittedAt: request.submittedAt ? toIso(request.submittedAt) : undefined,
    ipoFilingDate: request.ipoFilingDate ? toIso(request.ipoFilingDate) : undefined,
    ipoPriorityDate: request.ipoPriorityDate ? toIso(request.ipoPriorityDate) : undefined,
    completeSpecDeadline: request.completeSpecDeadline ? toIso(request.completeSpecDeadline) : undefined,
    examRequestDeadline: request.examRequestDeadline ? toIso(request.examRequestDeadline) : undefined,
    ferResponseDeadline: request.ferResponseDeadline ? toIso(request.ferResponseDeadline) : undefined,
    publicationDate: request.publicationDate ? toIso(request.publicationDate) : undefined,
    grantDate: request.grantDate ? toIso(request.grantDate) : undefined,
    lastStatusUpdate: request.lastStatusUpdate ? toIso(request.lastStatusUpdate) : undefined,
    createdAt: toIso(request.createdAt),
    updatedAt: toIso(request.updatedAt),
    student: {
      _id: String(request.studentId),
      displayName: student?.displayName ?? 'Student',
      email: student?.email ?? '',
      ...(student?.avatar ? { avatar: student.avatar } : {}),
      innovationScore: student?.innovationScore ?? 0,
    },
  };
};

// ─── Update status ───────────────────────────────────────────────────────────

export const updatePatentRequestStatus = async (
  adminId: string,
  requestId: string,
  payload: z.infer<typeof updateStatusSchema>,
) => {
  const request = await PatentRequest.findById(requestId);
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const currentStatus = normalizeStatus(request.status);
  const targetStatus = payload.status;

  if (TERMINAL_STATUSES.has(currentStatus)) {
    throw new ApiError(400, 'STATUS_TERMINAL', `Cannot transition from terminal status "${currentStatus}".`);
  }

  const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
  if (!allowed.includes(targetStatus)) {
    throw new ApiError(
      400,
      'INVALID_STATUS_TRANSITION',
      `Cannot transition from "${currentStatus}" to "${targetStatus}". Allowed: ${allowed.join(', ') || 'none'}.`,
    );
  }

  const now = new Date();
  const updates: Record<string, unknown> = {
    status: targetStatus,
    lastStatusUpdate: now,
  };

  // Auto-compute deadlines on status transitions
  if (targetStatus === 'filed_with_ipo') {
    // 48-month exam request deadline from filing
    updates.examRequestDeadline = new Date(now.getTime() + 48 * 30 * 24 * 60 * 60 * 1000);
  }
  if (targetStatus === 'fer_issued') {
    // 6-month FER response deadline
    updates.ferResponseDeadline = new Date(now.getTime() + 6 * 30 * 24 * 60 * 60 * 1000);
  }
  if (targetStatus === 'granted') {
    updates.grantDate = now;
  }

  await PatentRequest.updateOne(
    { _id: request._id },
    {
      $set: updates,
      $push: {
        trackingTimeline: {
          status: targetStatus,
          note: payload.note ?? `Status changed to ${targetStatus.replace(/_/g, ' ')}`,
          updatedAt: now,
          updatedBy: new Types.ObjectId(adminId),
        },
      },
    },
  );

  // Notify student
  await notificationQueue.add('patent-request-status-update', {
    userId: String(request.studentId),
    type: 'patent_status',
    title: 'Patent case update',
    body: `Your patent case "${request.inventionTitle ?? request.projectTitle}" status: ${targetStatus.replace(/_/g, ' ')}.`,
    link: '/startup-launch',
  });

  return { status: targetStatus };
};

// ─── Assign case ─────────────────────────────────────────────────────────────

export const assignPatentRequest = async (
  adminId: string,
  requestId: string,
  payload: z.infer<typeof assignRequestSchema>,
) => {
  const request = await PatentRequest.findById(requestId);
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  const assignee = await User.findOne({ _id: payload.assigneeId, role: UserRole.ADMIN }).lean();
  if (!assignee) {
    throw new ApiError(400, 'INVALID_ASSIGNEE', 'Assignee must be an active admin user.');
  }

  await PatentRequest.updateOne(
    { _id: request._id },
    {
      $set: { adminAssignedTo: new Types.ObjectId(payload.assigneeId) },
      $push: {
        trackingTimeline: {
          status: 'assigned',
          note: `Case assigned to ${assignee.displayName}`,
          updatedAt: new Date(),
          updatedBy: new Types.ObjectId(adminId),
        },
      },
    },
  );

  return { assignedTo: payload.assigneeId };
};

// ─── Update IPO details ──────────────────────────────────────────────────────

export const updateIpoDetails = async (
  adminId: string,
  requestId: string,
  payload: z.infer<typeof updateIpoDetailsSchema>,
) => {
  const request = await PatentRequest.findById(requestId);
  if (!request) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  await PatentRequest.updateOne(
    { _id: request._id },
    {
      $set: {
        ipoApplicationNumber: payload.applicationNumber,
        ipoFilingDate: new Date(payload.filingDate),
        ...(payload.priorityDate ? { ipoPriorityDate: new Date(payload.priorityDate) } : {}),
        ...(payload.controllerOffice ? { controllerOffice: payload.controllerOffice } : {}),
      },
      $push: {
        trackingTimeline: {
          status: 'ipo_details_updated',
          note: `IPO application number: ${payload.applicationNumber}`,
          updatedAt: new Date(),
          updatedBy: new Types.ObjectId(adminId),
        },
      },
    },
  );

  return { applicationNumber: payload.applicationNumber };
};

// ─── Add internal note ───────────────────────────────────────────────────────

export const addInternalNote = async (
  adminId: string,
  requestId: string,
  payload: z.infer<typeof addNoteSchema>,
) => {
  const result = await PatentRequest.updateOne(
    { _id: requestId },
    {
      $push: {
        internalNotes: {
          text: payload.text,
          createdAt: new Date(),
          createdBy: new Types.ObjectId(adminId),
        },
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  return { added: true };
};

// ─── Add timeline entry ──────────────────────────────────────────────────────

export const addTimelineEntry = async (
  adminId: string,
  requestId: string,
  payload: z.infer<typeof addTimelineEntrySchema>,
) => {
  const result = await PatentRequest.updateOne(
    { _id: requestId },
    {
      $push: {
        trackingTimeline: {
          status: payload.status,
          note: payload.note,
          updatedAt: new Date(),
          updatedBy: new Types.ObjectId(adminId),
        },
      },
    },
  );

  if (result.matchedCount === 0) {
    throw new ApiError(404, 'PATENT_REQUEST_NOT_FOUND', 'Patent request not found.');
  }

  return { added: true };
};
