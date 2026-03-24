import { z } from 'zod';
import { UserRole } from '../../types/roles.types';

export const registerSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8),
  displayName: z.string().trim().min(2).max(100),
  role: z.nativeEnum(UserRole),
  accessCode: z.string().trim().min(1),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  role: z.nativeEnum(UserRole),
});
