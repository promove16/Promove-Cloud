import { z } from 'zod';
import { institutionVerificationInputSchema } from '../institution/institutionVerification.service';
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
  organizationType: optionalProfileString(120),
  foundedYear: z.coerce.number().int().min(1800).max(3000).optional(),
  specialties: z.array(z.string().trim().min(1).max(120)).max(20).optional(),
  locations: z.array(z.string().trim().min(1).max(160)).max(12).optional(),
  alumniCount: z.coerce.number().int().min(0).optional(),
  employeeCount: z.coerce.number().int().min(0).optional(),
  contactEmail: z.string().trim().email().optional(),
  contactPhone: optionalProfileString(40),
});

export const registerSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    displayName: z.string().trim().min(2).max(60),
    role: z.literal(UserRole.STUDENT),
    institutionToken: z.string().trim().min(6).max(64),
    domain: optionalProfileString(120),
    bio: optionalProfileString(500),
  });

const registrationRequestRoleSchema = z.enum([
  UserRole.SCHOOL,
  UserRole.COLLEGE,
  UserRole.MENTOR,
  UserRole.INVESTOR,
  UserRole.RECRUITER,
]);

export const registrationRequestSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(8).max(72),
    displayName: z.string().trim().min(2).max(60),
    role: registrationRequestRoleSchema,
    domain: optionalProfileString(120),
    bio: optionalProfileString(500),
    institutionProfile: institutionProfileInputSchema.optional(),
    institutionVerification: institutionVerificationInputSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (
      (value.role === UserRole.SCHOOL || value.role === UserRole.COLLEGE) &&
      !value.institutionProfile
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['institutionProfile'],
        message: 'Institution details are required for this role',
      });
    }

    if (
      (value.role === UserRole.SCHOOL || value.role === UserRole.COLLEGE) &&
      !value.institutionVerification
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['institutionVerification'],
        message: 'Institution verification details are required for this role',
      });
    }

    if (
      [UserRole.MENTOR, UserRole.INVESTOR, UserRole.RECRUITER].includes(value.role) &&
      !value.domain
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['domain'],
        message: 'Domain or focus area is required for this role',
      });
    }
  });

export const submitInstitutionTokenSchema = z.object({
  institutionToken: z.string().trim().min(6).max(64),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.nativeEnum(UserRole).optional(),
});
