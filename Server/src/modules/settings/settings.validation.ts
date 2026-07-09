import { z } from 'zod';

const notificationPreferencesSchema = z
  .object({
    messages: z.boolean().optional(),
    deals: z.boolean().optional(),
    sessions: z.boolean().optional(),
    patents: z.boolean().optional(),
    platform: z.boolean().optional(),
  })
  .strict();

const notificationsSchema = z
  .object({
    email: notificationPreferencesSchema.optional(),
    inApp: notificationPreferencesSchema.optional(),
  })
  .strict();

const privacySchema = z
  .object({
    profileVisibility: z.enum(['public', 'private', 'connections']).optional(),
    showEmail: z.boolean().optional(),
    showPhone: z.boolean().optional(),
    allowDMs: z.enum(['all', 'connections', 'none']).optional(),
    showOnlineStatus: z.boolean().optional(),
  })
  .strict();

const appearanceSchema = z
  .object({
    compactMode: z.boolean().optional(),
    showAnimations: z.boolean().optional(),
  })
  .strict();

const roleSettingsSchema = z
  .object({
    jobSeeking: z.boolean().optional(),
    openToMentorship: z.boolean().optional(),
    innovationVisibility: z.enum(['public', 'private']).optional(),
    dealFlowNotifications: z.boolean().optional(),
    minInvestmentSize: z.number().finite().min(0).optional(),
    maxInvestmentSize: z.number().finite().min(0).optional(),
    preferredSectors: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    availableForSessions: z.boolean().optional(),
    sessionTypes: z.array(z.enum(['video', 'text', 'in-person'])).max(3).optional(),
    maxStudents: z.number().int().min(1).max(50).optional(),
    activelyHiring: z.boolean().optional(),
    preferredRoles: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
    publicProfile: z.boolean().optional(),
    allowStudentApplications: z.boolean().optional(),
  })
  .strict();

export const settingsUpdateSchema = z
  .object({
    displayName: z.string().trim().min(1).max(80).optional(),
    bio: z.string().trim().max(500).optional(),
    timezone: z.string().trim().min(1).max(100).optional(),
    language: z.string().trim().min(2).max(12).optional(),
    notifications: notificationsSchema.optional(),
    privacy: privacySchema.optional(),
    appearance: appearanceSchema.optional(),
    roleSettings: roleSettingsSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
