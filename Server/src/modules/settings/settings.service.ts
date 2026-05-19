import { IUserSettings, ISettingsDocument } from './settings.types';
import { Settings } from './settings.model';
import { UserRole } from '../../types/roles.types';
import { User } from '../user/user.model';
import { ApiError } from '../../utils/ApiError';
import { sanitizePlainText } from '../../utils/sanitizeText';
import { SettingsUpdateInput, settingsUpdateSchema } from './settings.validation';

type NestedObject = Record<string, unknown>;
type RoleSettings = IUserSettings['roleSettings'];
type NotificationPreferencesUpdate = Partial<IUserSettings['notifications']['email']>;
type SettingsUpdatePayload = Partial<
  Omit<IUserSettings, 'notifications' | 'privacy' | 'appearance' | 'roleSettings'>
> & {
  notifications?: {
    email?: NotificationPreferencesUpdate;
    inApp?: NotificationPreferencesUpdate;
  };
  privacy?: Partial<IUserSettings['privacy']>;
  appearance?: Partial<IUserSettings['appearance']>;
  roleSettings?: Partial<RoleSettings>;
};

const ROLE_SETTING_KEYS: Record<UserRole, Array<keyof RoleSettings>> = {
  [UserRole.STUDENT]: ['jobSeeking', 'openToMentorship', 'innovationVisibility'],
  [UserRole.SCHOOL]: ['publicProfile', 'allowStudentApplications'],
  [UserRole.COLLEGE]: ['publicProfile', 'allowStudentApplications'],
  [UserRole.MENTOR]: ['availableForSessions', 'sessionTypes', 'maxStudents'],
  [UserRole.INVESTOR]: [
    'dealFlowNotifications',
    'minInvestmentSize',
    'maxInvestmentSize',
    'preferredSectors',
  ],
  [UserRole.RECRUITER]: ['activelyHiring', 'preferredRoles'],
  [UserRole.ADMIN]: [],
};

const sanitizeStringList = (values: string[] | undefined) =>
  values
    ? Array.from(
        new Set(
          values
            .map((value) => sanitizePlainText(value))
            .filter(Boolean),
        ),
      )
    : undefined;

const sanitizeRoleSettings = (
  role: UserRole,
  roleSettings?: SettingsUpdateInput['roleSettings'],
): Partial<RoleSettings> | undefined => {
  if (!roleSettings) {
    return undefined;
  }

  const allowedKeys = ROLE_SETTING_KEYS[role];
  const next: Partial<RoleSettings> = {};

  for (const key of allowedKeys) {
    const value = roleSettings[key];
    if (value !== undefined) {
      (next as Record<string, unknown>)[key] = value;
    }
  }

  if (next.preferredSectors) {
    next.preferredSectors = sanitizeStringList(next.preferredSectors);
  }

  if (next.preferredRoles) {
    next.preferredRoles = sanitizeStringList(next.preferredRoles);
  }

  if (
    next.minInvestmentSize !== undefined &&
    next.maxInvestmentSize !== undefined &&
    next.minInvestmentSize > next.maxInvestmentSize
  ) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Minimum investment size cannot exceed maximum');
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

const sanitizeSettingsUpdate = (role: UserRole, payload: unknown): SettingsUpdatePayload => {
  const parsed = settingsUpdateSchema.parse(payload);
  const roleSettings = sanitizeRoleSettings(role, parsed.roleSettings);

  return {
    ...(parsed.displayName !== undefined ? { displayName: sanitizePlainText(parsed.displayName) } : {}),
    ...(parsed.bio !== undefined ? { bio: parsed.bio ? sanitizePlainText(parsed.bio) : undefined } : {}),
    ...(parsed.timezone !== undefined ? { timezone: parsed.timezone } : {}),
    ...(parsed.language !== undefined ? { language: parsed.language } : {}),
    ...(parsed.notifications !== undefined ? { notifications: parsed.notifications } : {}),
    ...(parsed.privacy !== undefined ? { privacy: parsed.privacy } : {}),
    ...(parsed.appearance !== undefined ? { appearance: parsed.appearance } : {}),
    ...(roleSettings ? { roleSettings } : {}),
  };
};

const syncUserSettingsSideEffects = async (
  userId: string,
  role: UserRole,
  privacy?: Partial<IUserSettings['privacy']>,
  roleSettings?: Partial<RoleSettings>,
) => {
  const userUpdate: Record<string, unknown> = {};

  if (privacy?.profileVisibility !== undefined) {
    userUpdate.isProfilePublic = privacy.profileVisibility === 'public';
  }

  if (!roleSettings) {
    if (Object.keys(userUpdate).length > 0) {
      await User.findByIdAndUpdate(userId, { $set: userUpdate });
    }
    return;
  }

  if (role === UserRole.STUDENT && roleSettings.jobSeeking !== undefined) {
    userUpdate.discoverableToRecruiters = roleSettings.jobSeeking;
  }

  if (
    (role === UserRole.SCHOOL || role === UserRole.COLLEGE) &&
    roleSettings.publicProfile !== undefined
  ) {
    userUpdate.isProfilePublic = roleSettings.publicProfile;
  }

  if (Object.keys(userUpdate).length === 0) {
    return;
  }

  await User.findByIdAndUpdate(userId, { $set: userUpdate });
};

/**
 * Flattens nested objects to dot-notation keys for MongoDB $set operations.
 * Only descends one level for known nested keys so that partial updates to
 * e.g. notifications.email don't wipe sibling fields.
 */
function buildDotNotationUpdate(updates: SettingsUpdatePayload): Record<string, unknown> {
  const flat: Record<string, unknown> = {};

  const nestedKeys: (keyof IUserSettings)[] = ['notifications', 'privacy', 'appearance', 'roleSettings'];

  for (const [key, value] of Object.entries(updates)) {
    if (nestedKeys.includes(key as keyof IUserSettings) && value !== null && typeof value === 'object') {
      const nested = value as NestedObject;
      for (const [subKey, subValue] of Object.entries(nested)) {
        if (subValue !== null && typeof subValue === 'object' && !Array.isArray(subValue)) {
          // Two levels deep (e.g. notifications.email.messages)
          const deep = subValue as NestedObject;
          for (const [deepKey, deepValue] of Object.entries(deep)) {
            flat[`${key}.${subKey}.${deepKey}`] = deepValue;
          }
        } else {
          flat[`${key}.${subKey}`] = subValue;
        }
      }
    } else {
      flat[key] = value;
    }
  }

  return flat;
}

export async function getSettings(userId: string): Promise<ISettingsDocument> {
  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // findOneAndUpdate with upsert always returns a document when new:true
  return settings as ISettingsDocument;
}

export async function updateSettings(
  userId: string,
  role: UserRole,
  payload: unknown,
): Promise<ISettingsDocument> {
  const updates = sanitizeSettingsUpdate(role, payload);
  await syncUserSettingsSideEffects(userId, role, updates.privacy, updates.roleSettings);
  const dotUpdate = buildDotNotationUpdate(updates);

  if (Object.keys(dotUpdate).length === 0) {
    return getSettings(userId);
  }

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: dotUpdate },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return settings as ISettingsDocument;
}
