import { z } from 'zod';
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_RELATED_ENTITY_TYPES,
  SUPPORT_STATUSES,
} from './support.model';

const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, 'A valid identifier is required.');

const attachmentInputSchema = z.object({
  url: z.string().trim().url().max(1000),
  name: z.string().trim().min(1).max(240),
  mimeType: z.string().trim().max(120).optional(),
  sizeBytes: z.number().int().nonnegative().max(50 * 1024 * 1024).optional(),
});

export const createTicketSchema = z.object({
  title: z.string().trim().min(4).max(200),
  category: z.enum(SUPPORT_CATEGORIES),
  description: z.string().trim().min(15).max(8000),
  priority: z.enum(SUPPORT_PRIORITIES).optional(),
  relatedEntityType: z.enum(SUPPORT_RELATED_ENTITY_TYPES).optional(),
  relatedEntityId: z.string().trim().min(1).max(120).optional(),
  referenceText: z.string().trim().max(240).optional(),
  attachments: z.array(attachmentInputSchema).max(10).optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const listTicketsQuerySchema = z.object({
  status: z.enum(SUPPORT_STATUSES).optional(),
  category: z.enum(SUPPORT_CATEGORIES).optional(),
  priority: z.enum(SUPPORT_PRIORITIES).optional(),
  search: z.string().trim().max(120).optional(),
});

export type ListTicketsQueryInput = z.infer<typeof listTicketsQuerySchema>;

export const adminListTicketsQuerySchema = listTicketsQuerySchema.extend({
  assignedTo: objectIdSchema.optional(),
  overdue: z
    .union([z.literal('true'), z.literal('false'), z.boolean()])
    .transform((value) => value === true || value === 'true')
    .optional(),
});

export type AdminListTicketsQueryInput = z.infer<typeof adminListTicketsQuerySchema>;

export const addReplySchema = z.object({
  body: z.string().trim().min(1).max(8000),
  attachments: z.array(attachmentInputSchema).max(10).optional(),
});

export type AddReplyInput = z.infer<typeof addReplySchema>;

export const addInternalNoteSchema = z.object({
  body: z.string().trim().min(1).max(8000),
});

export type AddInternalNoteInput = z.infer<typeof addInternalNoteSchema>;

export const assignTicketSchema = z.object({
  assignedTo: objectIdSchema.nullable(),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(SUPPORT_STATUSES),
  note: z.string().trim().max(500).optional(),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

export const changePrioritySchema = z.object({
  priority: z.enum(SUPPORT_PRIORITIES),
  note: z.string().trim().max(500).optional(),
});

export type ChangePriorityInput = z.infer<typeof changePrioritySchema>;

export const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;

export const escalateSchema = z.object({
  note: z.string().trim().min(1).max(500),
});

export type EscalateInput = z.infer<typeof escalateSchema>;

export const startupEditUnlockSchema = z.object({
  note: z.string().trim().max(500).optional(),
});

export type StartupEditUnlockInput = z.infer<typeof startupEditUnlockSchema>;
