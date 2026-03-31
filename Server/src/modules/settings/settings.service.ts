import { IUserSettings, ISettingsDocument } from './settings.types';
import { Settings } from './settings.model';

type NestedObject = Record<string, unknown>;

/**
 * Flattens nested objects to dot-notation keys for MongoDB $set operations.
 * Only descends one level for known nested keys so that partial updates to
 * e.g. notifications.email don't wipe sibling fields.
 */
function buildDotNotationUpdate(updates: Partial<IUserSettings>): Record<string, unknown> {
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
  updates: Partial<IUserSettings>,
): Promise<ISettingsDocument> {
  const dotUpdate = buildDotNotationUpdate(updates);

  const settings = await Settings.findOneAndUpdate(
    { userId },
    { $set: dotUpdate },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  return settings as ISettingsDocument;
}
