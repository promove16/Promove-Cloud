import { z } from 'zod';

const PATENT_REQUEST_STATUSES = [
  'draft',
  'submitted',
  'documents_review',
  'ready_for_filing',
  'filed_with_ipo',
  'published',
  'examination_requested',
  'fer_issued',
  'fer_response_submitted',
  'granted',
  'rejected',
  'abandoned',
] as const;

export const updateStatusSchema = z.object({
  status: z.enum(PATENT_REQUEST_STATUSES),
  note: z.string().trim().max(1500).optional(),
});

export const assignRequestSchema = z.object({
  assigneeId: z.string().min(1),
});

export const updateIpoDetailsSchema = z.object({
  applicationNumber: z.string().trim().min(1).max(50),
  filingDate: z.string().datetime(),
  priorityDate: z.string().datetime().optional(),
  controllerOffice: z.string().trim().max(100).optional(),
});

export const addNoteSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export const addTimelineEntrySchema = z.object({
  status: z.string().trim().min(1).max(100),
  note: z.string().trim().max(1500).optional(),
});

export const listRequestsQuerySchema = z.object({
  status: z.enum(PATENT_REQUEST_STATUSES).optional(),
  assignedTo: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
});
