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

const institutionMentorshipProgramBaseSchema = z.object({
  title: z.string().trim().min(2).max(160),
  objective: z.string().trim().min(10).max(1000),
  preferredDate: z.string().datetime(),
  durationMinutes: z.number().int().min(30).max(480),
  expectedParticipants: z.number().int().min(1).max(10000),
  deliveryMode: z.enum(['Online', 'Offline']),
  platform: z.enum(['Google Meet', 'Microsoft Teams', 'Zoom', 'Offline']),
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  venue: z.string().trim().max(240).optional().or(z.literal('')),
  preferredExpertise: z.string().trim().max(160).optional().or(z.literal('')),
});

const refineInstitutionMentorshipProgramPayload = (
  value: z.infer<typeof institutionMentorshipProgramBaseSchema>,
  ctx: z.RefinementCtx,
) => {
  if (value.deliveryMode === 'Offline' && value.platform !== 'Offline') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['platform'],
      message: 'Offline programs must use the Offline platform option',
    });
  }

  if (value.deliveryMode === 'Online' && value.platform === 'Offline') {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['platform'],
      message: 'Online programs must use Google Meet, Microsoft Teams, or Zoom',
    });
  }

  if (value.deliveryMode === 'Online' && value.venue) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['venue'],
      message: 'Venue is only allowed for offline programs',
    });
  }
};

export const createInstitutionMentorshipProgramSchema = institutionMentorshipProgramBaseSchema
  .superRefine(refineInstitutionMentorshipProgramPayload);

export const createAdminInstitutionMentorshipProgramSchema = institutionMentorshipProgramBaseSchema
  .extend({
    institutionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
    mentorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
    scheduledAt: z.string().datetime(),
    adminNotes: z.string().trim().max(1000).optional().or(z.literal('')),
  })
  .superRefine(refineInstitutionMentorshipProgramPayload);

export const projectMentorAssignmentSchema = z.union([
  z.object({
    decision: z.literal('assigned'),
    mentorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  }),
  z.object({
    decision: z.literal('unassigned'),
  }),
]);

const assignedInstitutionMentorshipProgramReviewSchema = z.object({
  decision: z.literal('assigned'),
  mentorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  scheduledAt: z.string().datetime(),
  deliveryMode: z.enum(['Online', 'Offline']),
  platform: z.enum(['Google Meet', 'Microsoft Teams', 'Zoom', 'Offline']),
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  venue: z.string().trim().max(240).optional().or(z.literal('')),
  adminNotes: z.string().trim().max(1000).optional().or(z.literal('')),
});

export const updateAdminInstitutionMentorshipProgramSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  objective: z.string().trim().min(10).max(1000).optional(),
  preferredDate: z.string().datetime().optional(),
  scheduledAt: z.string().datetime().optional(),
  durationMinutes: z.number().int().min(30).max(480).optional(),
  expectedParticipants: z.number().int().min(1).max(10000).optional(),
  deliveryMode: z.enum(['Online', 'Offline']).optional(),
  platform: z.enum(['Google Meet', 'Microsoft Teams', 'Zoom', 'Offline']).optional(),
  meetingLink: z.string().trim().url().optional().or(z.literal('')),
  venue: z.string().trim().max(240).optional().or(z.literal('')),
  preferredExpertise: z.string().trim().max(160).optional().or(z.literal('')),
  adminNotes: z.string().trim().max(1000).optional().or(z.literal('')),
  mentorId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format').optional(),
});

export const submitMentorBidSchema = z.object({
  opportunityId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID format'),
  kind: z.enum(['startup', 'problem_bank']),
  expertise: z.string().trim().min(2).max(400),
  hoursPerWeek: z.number().int().min(1).max(40),
  proposedDurationWeeks: z.number().int().min(1).max(52),
  coverNote: z.string().trim().min(10).max(800),
});

export const reviewInstitutionMentorshipProgramSchema = z
  .union([
    assignedInstitutionMentorshipProgramReviewSchema,
    z.object({
      decision: z.literal('rejected'),
      rejectionReason: z.string().trim().min(5).max(500),
      adminNotes: z.string().trim().max(1000).optional().or(z.literal('')),
    }),
  ])
  .superRefine((value, ctx) => {
    if (value.decision !== 'assigned') {
      return;
    }

    if (value.deliveryMode === 'Offline' && value.platform !== 'Offline') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['platform'],
        message: 'Offline programs must use the Offline platform option',
      });
    }

    if (value.deliveryMode === 'Online' && value.platform === 'Offline') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['platform'],
        message: 'Online programs must use Google Meet, Microsoft Teams, or Zoom',
      });
    }

    if (value.deliveryMode === 'Online' && value.venue) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['venue'],
        message: 'Venue is only allowed for offline programs',
      });
    }
  });
