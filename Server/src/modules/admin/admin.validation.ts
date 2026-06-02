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

export const registrationRequestReviewSchema = z.object({
  decision: z.enum(['approved', 'rejected']),
  reason: z.string().trim().max(300).optional(),
});

export const listRegistrationRequestsQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).default('pending'),
  role: z
    .enum([
      UserRole.SCHOOL,
      UserRole.COLLEGE,
      UserRole.MENTOR,
      UserRole.INVESTOR,
      UserRole.RECRUITER,
    ])
    .optional(),
});

export const createMentorProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z.string().trim().email(),
  domain: z.string().trim().max(120).optional(),
  bio: z.string().trim().max(500).optional(),
  headline: z.string().trim().max(120).optional(),
});

const directOnboardRoleSchema = z.enum([
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
  UserRole.SCHOOL,
  UserRole.COLLEGE,
]);

const onboardInstitutionProfileSchema = z.object({
  institutionName: z.string().trim().min(2).max(160).optional(),
  location: z.string().trim().min(2).max(160).optional(),
  totalStudentsEnrolled: z.coerce.number().int().min(0).max(10_000_000).optional(),
  academicYear: z.string().trim().min(4).max(20).optional(),
  organizationType: z.string().trim().max(120).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: z.string().trim().max(40).optional(),
});

const INSTITUTION_ONBOARD_ROLES: UserRole[] = [UserRole.SCHOOL, UserRole.COLLEGE];
const STAFF_ONBOARD_ROLES: UserRole[] = [UserRole.MENTOR, UserRole.INVESTOR, UserRole.RECRUITER];

export const onboardAccountSchema = z
  .object({
    role: directOnboardRoleSchema,
    displayName: z.string().trim().min(2).max(120),
    email: z.string().trim().email(),
    domain: z.string().trim().max(120).optional(),
    bio: z.string().trim().max(500).optional(),
    headline: z.string().trim().max(120).optional(),
    institutionProfile: onboardInstitutionProfileSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (STAFF_ONBOARD_ROLES.includes(value.role) && !value.domain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: 'Domain or focus area is required for this role',
      });
    }

    if (INSTITUTION_ONBOARD_ROLES.includes(value.role)) {
      const profile = value.institutionProfile;
      if (!profile?.location) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['institutionProfile', 'location'],
          message: 'Location is required for school and college accounts',
        });
      }
    }
  });

export const adminInstitutionRosterQuerySchema = z.object({
  search: z.string().trim().max(120).optional(),
});

export const listMentorshipProgramsQuerySchema = z.object({
  status: z.enum(['Pending', 'Assigned', 'Rejected']).optional(),
});

export const analyticsLogsQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(10000).default(50),
  page: z.coerce.number().int().positive().default(1),
});

export const analyticsUsersQuerySchema = z.object({
  q: z.string().trim().max(120).optional(),
  limit: z.coerce.number().int().positive().max(10).default(8),
});

export const dealReviewSchema = z
  .object({
    stockTransferStatus: z.enum(['pending_review', 'under_review', 'rejected']).optional(),
    reviewNotes: z.string().trim().max(1500).optional(),
    royaltyPercentage: z.number().min(0).max(100).optional(),
    royaltyStatus: z.enum(['pending', 'invoiced', 'received']).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.stockTransferStatus === 'rejected' && (!value.reviewNotes || value.reviewNotes.length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewNotes'],
        message: 'Review notes are required when rejecting a stock transfer.',
      });
    }
  });

export const dealCancellationReviewSchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    reviewNotes: z.string().trim().max(1000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'rejected' && (!value.reviewNotes || value.reviewNotes.length < 10)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reviewNotes'],
        message: 'Review notes are required when rejecting a cancellation request.',
      });
    }
  });
