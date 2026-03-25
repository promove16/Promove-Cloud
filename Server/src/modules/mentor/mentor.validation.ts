import { z } from 'zod';

export const createMentorSessionSchema = z.object({
  studentId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  title: z.string().trim().min(2).max(160),
  scheduledAt: z.string().datetime(),
  durationMinutes: z.number().int().min(15).max(240),
  meetLink: z.string().trim().url().optional().or(z.literal('')),
});

export const mentorSessionUpdateSchema = z.object({
  status: z.enum(['Scheduled', 'Completed', 'Cancelled']).optional(),
  mentorNotes: z.string().trim().max(4000).optional().or(z.literal('')),
  meetLink: z.string().trim().url().optional().or(z.literal('')),
});

export const createMentorFeedbackSchema = z.object({
  workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
  feedbackText: z.string().trim().min(10).max(4000),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]),
});
