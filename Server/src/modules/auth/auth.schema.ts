import { z } from 'zod';
import { UserRole } from '../../types/roles.types';

const optionalProfileString = (max: number) =>
  z
    .union([z.string().trim().max(max), z.literal('')])
    .optional()
    .transform((value) => {
      if (!value) {
        return undefined;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    });

const institutionProfileInputSchema = z.object({
  institutionName: z.string().trim().min(2).max(160),
  location: z.string().trim().min(2).max(160),
  totalStudentsEnrolled: z.coerce.number().int().min(1),
  academicYear: z.string().trim().min(4).max(20),
  iicStarRating: z.coerce.number().min(0).max(5).default(0),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8),
    displayName: z.string().trim().min(2).max(100),
    role: z.nativeEnum(UserRole),
    institutionToken: z.string().trim().min(1).optional(),
    accessCode: z.string().trim().min(1).optional(),
    domain: optionalProfileString(120),
    bio: optionalProfileString(500),
    institutionProfile: institutionProfileInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role === UserRole.STUDENT && !(value.institutionToken || value.accessCode)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['institutionToken'],
        message: 'Institution token is required for student registrations',
      });
    }

    if (
      (value.role === UserRole.SCHOOL || value.role === UserRole.COLLEGE) &&
      !value.institutionProfile
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['institutionProfile'],
        message: 'Institution details are required for school and college registrations',
      });
    }

    if (
      (value.role === UserRole.MENTOR ||
        value.role === UserRole.INVESTOR ||
        value.role === UserRole.RECRUITER) &&
      !value.domain
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: 'Domain or focus area is required for this role',
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.nativeEnum(UserRole),
});
