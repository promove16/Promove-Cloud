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
    password: z.string().min(8).max(72),
    displayName: z.string().trim().min(2).max(60),
    role: z.nativeEnum(UserRole),
    institutionToken: z.string().trim().min(1).optional(),
    accessCode: z.string().trim().min(1).optional(),
    domain: optionalProfileString(120),
    bio: optionalProfileString(500),
    institutionProfile: institutionProfileInputSchema.optional(),
  });

export const submitInstitutionTokenSchema = z.object({
  institutionToken: z.string().trim().min(6).max(64),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.nativeEnum(UserRole),
});
