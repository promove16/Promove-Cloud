import { z } from 'zod';
import { UserRole } from '../../types/roles.types';

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(2000).default(50),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
});

export const patentRejectSchema = z.object({
  adminNotes: z.string().trim().min(20),
});

export const awardRejectSchema = z.object({
  adminNotes: z.string().trim().min(5),
});

export const milestoneVerifySchema = z.object({
  milestoneType: z.enum(['MVP', 'PROTOTYPE', 'MARKET_READY']),
});
