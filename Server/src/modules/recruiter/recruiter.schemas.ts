import { z } from 'zod';
import { MAX_INNOVATION_SCORE } from '../innovationScore/score.utils';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format');

export const talentQuerySchema = z.object({
  minScore: z.coerce.number().min(0).max(MAX_INNOVATION_SCORE).optional(),
  maxScore: z.coerce.number().min(0).max(MAX_INNOVATION_SCORE).optional(),
  domain: z.string().trim().min(1).max(120).optional(),
  institution: z.string().trim().min(1).max(160).optional(),
  search: z.string().trim().min(1).max(160).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const jobCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  company: z.string().trim().min(2).max(160),
  description: z.string().trim().min(10).max(4000),
  domain: z.string().trim().min(2).max(120),
  minimumInnovationScore: z.coerce.number().min(0).max(MAX_INNOVATION_SCORE).default(0),
  type: z.enum(['Full-time', 'Internship', 'Contract', 'Part-time']),
  location: z.string().trim().min(2).max(120),
  workMode: z.enum(['On-site', 'Hybrid', 'Remote']).optional(),
  salaryExpectation: z.string().trim().min(2).max(120).optional(),
  experienceLevel: z.string().trim().min(2).max(120).optional(),
  openings: z.coerce.number().int().min(1).max(500).optional(),
  companyOverview: z.string().trim().min(10).max(1500).optional(),
  roleSummary: z.string().trim().min(10).max(1200).optional(),
  keyResponsibilities: z.array(z.string().trim().min(2).max(240)).max(12).default([]),
  requirements: z.array(z.string().trim().min(2).max(240)).max(12).default([]),
  benefits: z.array(z.string().trim().min(2).max(240)).max(12).default([]),
  applicationSteps: z.array(z.string().trim().min(2).max(240)).max(8).default([]),
  expiresAt: z.string().datetime().optional(),
});

export const jobUpdateSchema = jobCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const driveCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  collegeId: objectIdSchema,
  type: z.enum(['Placement Drive', 'Internship Drive', 'Hackathon']),
  scheduledAt: z.string().datetime(),
  description: z.string().trim().min(10).max(4000),
  minimumInnovationScore: z.coerce.number().min(0).max(MAX_INNOVATION_SCORE).default(0),
});

export const driveScoreSchema = z.object({
  studentId: objectIdSchema,
  submissionScore: z.coerce.number().min(0).max(100),
});

export const hireSchema = z.object({
  companyName: z.string().trim().min(2).max(160),
});

export const messageSchema = z.object({
  body: z.string().trim().min(2).max(500).optional(),
});

export const driveIdSchema = z.object({
  driveId: objectIdSchema,
});

export const jobIdSchema = z.object({
  jobId: objectIdSchema,
});

export const studentIdSchema = z.object({
  studentId: objectIdSchema,
});

export const publicJobsQuerySchema = z.object({
  recruiterId: objectIdSchema,
});
