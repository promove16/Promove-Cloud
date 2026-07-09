import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, Bell, Shield, Palette, Settings2, Save, Loader2, Check, Lock, Globe } from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { userApi } from '../../api/user.api';
import type { UserSettings } from '../../types/settings.types';
import { useSettings } from '../../hooks/useSettings';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { OptionTabs } from '../../components/ui/OptionTabs';
import { toast } from '../../app/components/ui/sonner';
import { AuthPasswordField } from '../auth/AuthPasswordField';
import { StudentInstitutionStatusPanel } from '../institution/studentInstitutionStatus';

// ─── Layout helper ────────────────────────────────────────────────────────────

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls = 'w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors text-sm';
const labelCls = 'block text-sm font-medium text-slate-300 mb-1.5';
const sectionHdr = 'text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4';
const card = 'bg-slate-900 rounded-2xl border border-slate-800 p-6';
const saveBtnCls = 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold rounded-xl px-6 py-2.5 flex items-center gap-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed';
const radioCardCls = (active: boolean) =>
  `flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${active ? 'border-cyan-500/50 bg-cyan-500/5' : 'border-slate-700 hover:border-slate-600'}`;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-cyan-500' : 'bg-slate-700'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function ToggleRow({ label, desc, checked, onChange }: { label: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div><p className="text-sm font-medium text-white">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function RadioGroup<T extends string>({ name, value, onChange, options }: {
  name: string; value: T; onChange: (v: T) => void;
  options: { value: T; label: string; desc: string }[];
}) {
  return (
    <div className="space-y-3">
      {options.map((o) => (
        <label key={o.value} className={radioCardCls(value === o.value)}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-0.5 accent-cyan-500" />
          <div><p className="text-sm font-medium text-white">{o.label}</p><p className="text-xs text-slate-500 mt-0.5">{o.desc}</p></div>
        </label>
      ))}
    </div>
  );
}

// ─── Tabs config ──────────────────────────────────────────────────────────────

const TABS = [
  { id: 'account', label: 'Account', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'privacy', label: 'Privacy & Security', icon: Shield },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'role', label: 'Role Settings', icon: Settings2 },
] as const;

type TabId = (typeof TABS)[number]['id'];
const TAB_ID_SET = new Set<TabId>(TABS.map((tab) => tab.id));
const TAB_LABELS: Record<TabId, string> = {
  account: 'Account',
  notifications: 'Notifications',
  privacy: 'Privacy & Security',
  appearance: 'Appearance',
  role: 'Role Settings',
};
const normalizeSettingsTab = (value: string | null): TabId =>
  value && TAB_ID_SET.has(value as TabId) ? (value as TabId) : 'account';
const serializeState = (value: unknown) => JSON.stringify(value);

// ─── State types ──────────────────────────────────────────────────────────────

type NotifRow = { email: boolean; inApp: boolean };
type NotifMatrix = { messages: NotifRow; deals: NotifRow; sessions: NotifRow; patents: NotifRow; platform: NotifRow };
type PrivacyState = { profileVisibility: 'public' | 'connections' | 'private'; dmPermissions: 'everyone' | 'connections' | 'nobody'; showEmail: boolean; showOnlineStatus: boolean };
type AppearanceState = { compactMode: boolean; showAnimations: boolean };
type SessionTypes = { video: boolean; text: boolean; inPerson: boolean };
type RoleState = {
  jobSeeking: boolean; openToMentorship: boolean; innovationVisibility: 'public' | 'private';
  dealFlowNotifications: boolean; minInvestment: number; maxInvestment: number; preferredSectors: string;
  availableForSessions: boolean; sessionTypes: SessionTypes; maxConcurrentStudents: number;
  activelyHiring: boolean; preferredRoles: string;
  publicProfile: boolean; allowStudentApplications: boolean;
};
type AccountValues = { displayName: string; bio: string; timezone: string; language: string };
type PasswordValues = { currentPassword: string; newPassword: string; confirmPassword: string };
type SettingsSnapshot = {
  account: AccountValues;
  notifications: NotifMatrix;
  privacy: PrivacyState;
  appearance: AppearanceState;
  role: RoleState;
};

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const defaultNotif: NotifMatrix = {
  messages: { email: true, inApp: true }, deals: { email: true, inApp: true },
  sessions: { email: true, inApp: true }, patents: { email: false, inApp: true }, platform: { email: true, inApp: false },
};
const defaultPrivacy: PrivacyState = { profileVisibility: 'public', dmPermissions: 'everyone', showEmail: false, showOnlineStatus: true };
const defaultAppearance: AppearanceState = { compactMode: false, showAnimations: true };
const defaultRole: RoleState = {
  jobSeeking: false, openToMentorship: false, innovationVisibility: 'public',
  dealFlowNotifications: true, minInvestment: 10000, maxInvestment: 500000, preferredSectors: '',
  availableForSessions: true, sessionTypes: { video: true, text: true, inPerson: false }, maxConcurrentStudents: 5,
  activelyHiring: false, preferredRoles: '',
  publicProfile: true, allowStudentApplications: true,
};

const TEMPORARY_MEMORY_PREFIXES = ['promove-', 'dm_first_contact_'];
const defaultPasswordValues: PasswordValues = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};
const cloneSettingsSnapshot = (snapshot: SettingsSnapshot): SettingsSnapshot =>
  JSON.parse(JSON.stringify(snapshot)) as SettingsSnapshot;
const createSettingsSnapshot = (
  account: AccountValues,
  notifications: NotifMatrix,
  privacy: PrivacyState,
  appearance: AppearanceState,
  role: RoleState,
): SettingsSnapshot => ({
  account,
  notifications,
  privacy,
  appearance,
  role,
});

const clearBrowserTemporaryMemory = () => {
  const clearStorage = (storage: Storage) => {
    const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => Boolean(key),
    );

    keys.forEach((key) => {
      if (TEMPORARY_MEMORY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
        storage.removeItem(key);
      }
    });
  };

  clearStorage(localStorage);
  clearStorage(sessionStorage);
};

const deriveRoleState = (
  role: UserRole,
  settings: UserSettings | undefined,
  authUser: ReturnType<typeof useAuthStore.getState>['user'],
): RoleState => {
  const persistedRoleSettings = settings?.roleSettings ?? {};
  const nextRoleState: RoleState = {
    ...defaultRole,
    ...persistedRoleSettings,
    minInvestment: persistedRoleSettings.minInvestmentSize ?? defaultRole.minInvestment,
    maxInvestment: persistedRoleSettings.maxInvestmentSize ?? defaultRole.maxInvestment,
    preferredSectors: persistedRoleSettings.preferredSectors?.join(', ') ?? defaultRole.preferredSectors,
    sessionTypes: {
      video: persistedRoleSettings.sessionTypes?.includes('video') ?? defaultRole.sessionTypes.video,
      text: persistedRoleSettings.sessionTypes?.includes('text') ?? defaultRole.sessionTypes.text,
      inPerson: persistedRoleSettings.sessionTypes?.includes('in-person') ?? defaultRole.sessionTypes.inPerson,
    },
    maxConcurrentStudents: persistedRoleSettings.maxStudents ?? defaultRole.maxConcurrentStudents,
    preferredRoles: persistedRoleSettings.preferredRoles?.join(', ') ?? defaultRole.preferredRoles,
  };

  if (role === UserRole.STUDENT && authUser?.discoverableToRecruiters !== undefined) {
    nextRoleState.jobSeeking = authUser.discoverableToRecruiters;
  }

  if ((role === UserRole.SCHOOL || role === UserRole.COLLEGE) && authUser?.isProfilePublic !== undefined) {
    nextRoleState.publicProfile = authUser.isProfilePublic;
  }

  return nextRoleState;
};

const buildRoleSettingsPayload = (role: UserRole, roleState: RoleState): UserSettings['roleSettings'] => {
  switch (role) {
    case UserRole.STUDENT:
      return {
        jobSeeking: roleState.jobSeeking,
        openToMentorship: roleState.openToMentorship,
        innovationVisibility: roleState.innovationVisibility,
      };
    case UserRole.INVESTOR:
      return {
        dealFlowNotifications: roleState.dealFlowNotifications,
        minInvestmentSize: roleState.minInvestment,
        maxInvestmentSize: roleState.maxInvestment,
        preferredSectors: splitCsv(roleState.preferredSectors),
      };
    case UserRole.MENTOR:
      return {
        availableForSessions: roleState.availableForSessions,
        sessionTypes: [
          ...(roleState.sessionTypes.video ? ['video' as const] : []),
          ...(roleState.sessionTypes.text ? ['text' as const] : []),
          ...(roleState.sessionTypes.inPerson ? ['in-person' as const] : []),
        ],
        maxStudents: roleState.maxConcurrentStudents,
      };
    case UserRole.RECRUITER:
      return {
        activelyHiring: roleState.activelyHiring,
        preferredRoles: splitCsv(roleState.preferredRoles),
      };
    case UserRole.SCHOOL:
    case UserRole.COLLEGE:
      return {
        publicProfile: roleState.publicProfile,
        allowStudentApplications: roleState.allowStudentApplications,
      };
    case UserRole.ADMIN:
    default:
      return {};
  }
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SettingsSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-48 bg-slate-800 rounded-lg" /><div className="h-4 w-72 bg-slate-800 rounded" />
      <div className="flex gap-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 w-28 bg-slate-800 rounded-xl" />)}</div>
      <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 space-y-4">
        {[...Array(4)].map((_, i) => <div key={i} className="space-y-1.5"><div className="h-4 w-24 bg-slate-800 rounded" /><div className="h-10 bg-slate-800 rounded-xl" /></div>)}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SettingsPage() {
  const { settings, isLoading, updateSettingsAsync, isSaving } = useSettings();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const activeTab = normalizeSettingsTab(searchParams.get('tab'));
  const [savedTab, setSavedTab] = useState<TabId | null>(null);
  const [savingTab, setSavingTab] = useState<TabId | null>(null);
  const [isClearingCache, setIsClearingCache] = useState(false);
  const [notif, setNotif] = useState<NotifMatrix>(defaultNotif);
  const [privacy, setPrivacy] = useState<PrivacyState>(defaultPrivacy);
  const [appearance, setAppearance] = useState<AppearanceState>(defaultAppearance);
  const [roleState, setRoleState] = useState<RoleState>(defaultRole);
  const [passwordValues, setPasswordValues] = useState<PasswordValues>(defaultPasswordValues);
  const [passwordError, setPasswordError] = useState('');
  const [passwordNotice, setPasswordNotice] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [institutionToken, setInstitutionToken] = useState('');
  const [institutionTokenError, setInstitutionTokenError] = useState('');
  const [institutionTokenNotice, setInstitutionTokenNotice] = useState('');
  const [isSavingInstitutionToken, setIsSavingInstitutionToken] = useState(false);
  const role = authUser?.role ?? UserRole.STUDENT;
  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: userApi.getMe,
    enabled: role === UserRole.STUDENT,
  });

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<AccountValues>({
    defaultValues: { displayName: '', bio: '', timezone: 'UTC', language: 'en' },
  });
  const accountValues = watch();
  const bioLen = (accountValues.bio ?? '').length;
  const savedRoleState = useMemo(
    () => deriveRoleState(role, settings, authUser),
    [authUser, role, settings],
  );
  const initialSnapshotRef = useRef<SettingsSnapshot | null>(null);
  const currentAccountSnapshot = useMemo<AccountValues>(
    () => ({
      displayName: accountValues.displayName ?? '',
      bio: accountValues.bio ?? '',
      timezone: accountValues.timezone ?? 'UTC',
      language: accountValues.language ?? 'en',
    }),
    [accountValues.bio, accountValues.displayName, accountValues.language, accountValues.timezone],
  );
  const dirtyTabs = useMemo(() => {
    const baseline = initialSnapshotRef.current;
    if (!baseline) {
      return {
        account: false,
        notifications: false,
        privacy: false,
        appearance: false,
        role: false,
      } satisfies Record<TabId, boolean>;
    }

    return {
      account: serializeState(currentAccountSnapshot) !== serializeState(baseline.account),
      notifications: serializeState(notif) !== serializeState(baseline.notifications),
      privacy: serializeState(privacy) !== serializeState(baseline.privacy),
      appearance: serializeState(appearance) !== serializeState(baseline.appearance),
      role: serializeState(roleState) !== serializeState(baseline.role),
    } satisfies Record<TabId, boolean>;
  }, [appearance, currentAccountSnapshot, notif, privacy, roleState]);
  const activeTabDirty = dirtyTabs[activeTab];

  useEffect(() => {
    const currentTab = searchParams.get('tab');
    const normalizedTab = normalizeSettingsTab(currentTab);

    if (currentTab !== normalizedTab) {
      const nextParams = new URLSearchParams(searchParams);
      nextParams.set('tab', normalizedTab);
      setSearchParams(nextParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (!settings) return;
    reset({
      displayName: authUser?.displayName ?? settings.displayName ?? '',
      bio: authUser?.bio ?? settings.bio ?? '',
      timezone: settings.timezone ?? 'UTC',
      language: settings.language ?? 'en',
    });
    if (settings.notifications) {
      setNotif({
        messages: {
          email: settings.notifications.email.messages,
          inApp: settings.notifications.inApp.messages,
        },
        deals: {
          email: settings.notifications.email.deals,
          inApp: settings.notifications.inApp.deals,
        },
        sessions: {
          email: settings.notifications.email.sessions,
          inApp: settings.notifications.inApp.sessions,
        },
        patents: {
          email: settings.notifications.email.patents,
          inApp: settings.notifications.inApp.patents,
        },
        platform: {
          email: settings.notifications.email.platform,
          inApp: settings.notifications.inApp.platform,
        },
      });
    }
    if (settings.privacy) {
      setPrivacy({
        profileVisibility: settings.privacy.profileVisibility,
        dmPermissions:
          settings.privacy.allowDMs === 'all'
            ? 'everyone'
            : settings.privacy.allowDMs === 'none'
              ? 'nobody'
              : 'connections',
        showEmail: settings.privacy.showEmail,
        showOnlineStatus: settings.privacy.showOnlineStatus,
      });
    }
    if (settings.appearance) {
      setAppearance(settings.appearance);
    }
    setRoleState(savedRoleState);
    initialSnapshotRef.current = cloneSettingsSnapshot(
      createSettingsSnapshot(
        {
          displayName: authUser?.displayName ?? settings.displayName ?? '',
          bio: authUser?.bio ?? settings.bio ?? '',
          timezone: settings.timezone ?? 'UTC',
          language: settings.language ?? 'en',
        },
        settings.notifications
          ? {
              messages: {
                email: settings.notifications.email.messages,
                inApp: settings.notifications.inApp.messages,
              },
              deals: {
                email: settings.notifications.email.deals,
                inApp: settings.notifications.inApp.deals,
              },
              sessions: {
                email: settings.notifications.email.sessions,
                inApp: settings.notifications.inApp.sessions,
              },
              patents: {
                email: settings.notifications.email.patents,
                inApp: settings.notifications.inApp.patents,
              },
              platform: {
                email: settings.notifications.email.platform,
                inApp: settings.notifications.inApp.platform,
              },
            }
          : defaultNotif,
        settings.privacy
          ? {
              profileVisibility: settings.privacy.profileVisibility,
              dmPermissions:
                settings.privacy.allowDMs === 'all'
                  ? 'everyone'
                  : settings.privacy.allowDMs === 'none'
                    ? 'nobody'
                    : 'connections',
              showEmail: settings.privacy.showEmail,
              showOnlineStatus: settings.privacy.showOnlineStatus,
            }
          : defaultPrivacy,
        settings.appearance ?? defaultAppearance,
        savedRoleState,
      ),
    );
  }, [
    authUser?.bio,
    authUser?.displayName,
    authUser?.discoverableToRecruiters,
    authUser?.isProfilePublic,
    reset,
    savedRoleState,
    settings,
  ]);

  useEffect(() => {
    setInstitutionToken(authUser?.institutionToken ?? '');
  }, [authUser?.institutionToken]);

  const getSettingsErrorMessage = (error: unknown, fallback: string) =>
    (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
    (error instanceof Error ? error.message : fallback);

  const markSaved = (tab: TabId) => { setSavedTab(tab); setTimeout(() => setSavedTab(null), 2000); };
  const withSaveState = async (tab: TabId, action: () => Promise<void>) => {
    setSavingTab(tab);
    try {
      await action();
      initialSnapshotRef.current = cloneSettingsSnapshot(
        createSettingsSnapshot(
          currentAccountSnapshot,
          notif,
          privacy,
          appearance,
          roleState,
        ),
      );
      markSaved(tab);
      toast.success(`${TAB_LABELS[tab]} saved.`);
    } catch (error) {
      toast.error(getSettingsErrorMessage(error, `Unable to save ${TAB_LABELS[tab].toLowerCase()} right now.`));
      throw error;
    } finally {
      setSavingTab((current) => (current === tab ? null : current));
    }
  };

  const onSaveAccount = handleSubmit(async (values) => {
    await withSaveState('account', async () => {
      const [updatedUser] = await Promise.all([
        userApi.updateMe({
          displayName: values.displayName.trim(),
          bio: values.bio.trim() || '',
        }),
        updateSettingsAsync({
          timezone: values.timezone,
          language: values.language,
        }),
      ]);

      setAuthUser(updatedUser);
    });
  });
  const onSaveNotif = async () => {
    await withSaveState('notifications', async () => {
      await updateSettingsAsync({
        notifications: {
          email: {
            messages: notif.messages.email,
            deals: notif.deals.email,
            sessions: notif.sessions.email,
            patents: notif.patents.email,
            platform: notif.platform.email,
          },
          inApp: {
            messages: notif.messages.inApp,
            deals: notif.deals.inApp,
            sessions: notif.sessions.inApp,
            patents: notif.patents.inApp,
            platform: notif.platform.inApp,
          },
        },
      });
    });
  };
  const onSavePrivacy = async () => {
    await withSaveState('privacy', async () => {
      await updateSettingsAsync({
        privacy: {
          profileVisibility: privacy.profileVisibility,
          showEmail: privacy.showEmail,
          showPhone: settings?.privacy?.showPhone ?? false,
          allowDMs:
            privacy.dmPermissions === 'everyone'
              ? 'all'
              : privacy.dmPermissions === 'nobody'
                ? 'none'
                : 'connections',
          showOnlineStatus: privacy.showOnlineStatus,
        },
      });
    });
  };
  const onSaveAppearance = async () => {
    await withSaveState('appearance', async () => {
      await updateSettingsAsync({ appearance });
    });
  };
  const onSaveRole = async () => {
    await withSaveState('role', async () => {
      await updateSettingsAsync({
        roleSettings: buildRoleSettingsPayload(role, roleState),
      });

      if (!authUser) {
        return;
      }

      if (role === UserRole.STUDENT) {
        setAuthUser({ ...authUser, discoverableToRecruiters: roleState.jobSeeking });
      }

      if (role === UserRole.SCHOOL || role === UserRole.COLLEGE) {
        setAuthUser({ ...authUser, isProfilePublic: roleState.publicProfile });
      }
    });
  };

  const onChangePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError('');
    setPasswordNotice('');

    const currentPassword = passwordValues.currentPassword;
    const newPassword = passwordValues.newPassword;
    const confirmPassword = passwordValues.confirmPassword;

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('Enter your current password, new password, and confirmation.');
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setPasswordError('New password must be different from your current password.');
      return;
    }

    setIsChangingPassword(true);

    try {
      const result = await authApi.changePassword({ currentPassword, newPassword });
      setPasswordValues(defaultPasswordValues);
      setPasswordNotice(result.message || 'Password changed successfully.');
      toast.success(result.message || 'Password changed successfully.');

      if (authUser?.mustChangePasswordOnNextLogin) {
        setAuthUser({ ...authUser, mustChangePasswordOnNextLogin: false });
      }
    } catch (error) {
      const apiError = (error as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error;
      const message = apiError?.message ?? 'Unable to change password right now.';
      setPasswordError(message);
      toast.error(message);
    } finally {
      setIsChangingPassword(false);
    }
  };

  const onClearTemporaryCache = async () => {
    if (isClearingCache) {
      return;
    }

    const confirmed = window.confirm(
      'Clear temporary browser memory and cached dashboard state? This will sign you out and reload the app.',
    );

    if (!confirmed) {
      return;
    }

    setIsClearingCache(true);

    try {
      queryClient.clear();
      clearBrowserTemporaryMemory();
      logout();
    } finally {
      setIsClearingCache(false);
    }
  };

  const onSaveInstitutionToken = async () => {
    if (role !== UserRole.STUDENT) {
      return;
    }

    const normalizedToken = institutionToken.trim().toUpperCase();
    setInstitutionTokenError('');
    setInstitutionTokenNotice('');

    if (!normalizedToken) {
      setInstitutionTokenError('Enter the token shared by your school or college.');
      return;
    }

    setIsSavingInstitutionToken(true);

    try {
      const result = await authApi.submitInstitutionToken(normalizedToken);
      setAuthUser(result.user);
      setInstitutionToken(result.user.institutionToken ?? normalizedToken);

      const refreshedProfile = await userApi.getMe();
      queryClient.setQueryData(['profile', 'me'], refreshedProfile);
      const message = result.message || 'Institution token saved.';
      setInstitutionTokenNotice(message);
      toast.success(message);
    } catch (error) {
      const apiError = (error as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error;
      const message = apiError?.message ?? 'Unable to save institution token right now.';
      setInstitutionTokenError(message);
      toast.error(message);
    } finally {
      setIsSavingInstitutionToken(false);
    }
  };

  const getSaveActionForTab = (tab: TabId) =>
    tab === 'account'
      ? onSaveAccount
      : tab === 'notifications'
        ? onSaveNotif
        : tab === 'privacy'
          ? onSavePrivacy
          : tab === 'appearance'
            ? onSaveAppearance
            : role !== UserRole.ADMIN
              ? onSaveRole
              : null;
  const dirtyTabList = TABS.map((tab) => tab.id).filter((tab) => dirtyTabs[tab]);
  const stickyTargetTab = activeTabDirty ? activeTab : dirtyTabList[0] ?? null;
  const stickySaveAction = stickyTargetTab ? getSaveActionForTab(stickyTargetTab) : null;
  const isActiveTabSaving = savingTab === activeTab || isSaving;
  const isStickyTargetActive = stickyTargetTab === activeTab;
  const isStickyTabSaving =
    stickyTargetTab !== null && (savingTab === stickyTargetTab || isSaving);
  const showStickySaveBar = Boolean(stickyTargetTab && stickySaveAction);

  function SaveBtn({ tab, onSave }: { tab: TabId; onSave: () => void }) {
    const saved = savedTab === tab;
    const isTabSaving = savingTab === tab || isSaving;
    return (
      <button type="button" onClick={onSave} disabled={isTabSaving} className={saveBtnCls}>
        {isTabSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
        {isTabSaving ? 'Saving...' : saved ? 'Saved!' : 'Save Changes'}
      </button>
    );
  }

  if (isLoading) {
    return (
      <div className="mx-auto w-full max-w-4xl p-6 pb-32">
        <SettingsSkeleton />
      </div>
    );
  }

  const institutionEducation = profileQuery.data?.education?.find((entry) => entry.source === 'institution') ?? null;

  return (
    <>
      <div className="mx-auto w-full max-w-4xl p-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your account preferences and configurations</p>
        </div>

        {/* Tab bar */}
        <OptionTabs
          items={TABS}
          activeId={activeTab}
          onChange={(nextTab) => {
            const nextParams = new URLSearchParams(searchParams);
            nextParams.set('tab', nextTab);
            setSearchParams(nextParams, { replace: true });
          }}
          className="mb-8"
          aria-label="Settings sections"
        />

        {/* ── Account ─────────────────────────────────────────────────────── */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div className={card}>
              <p className={sectionHdr}>Profile Information</p>
              <div className="space-y-5">
                <div>
                  <label className={labelCls} htmlFor="displayName">Display Name</label>
                  <input id="displayName" type="text" className={inputCls} placeholder="Your display name"
                    {...register('displayName', { required: 'Display name is required', maxLength: { value: 80, message: 'Max 80 characters' } })} />
                  {errors.displayName && <p className="mt-1 text-xs text-red-400">{errors.displayName.message}</p>}
                </div>
                <div>
                  <label className={labelCls} htmlFor="bio">Bio</label>
                  <textarea id="bio" rows={4} maxLength={280} className={`${inputCls} resize-none`} placeholder="Tell others a little about yourself..."
                    {...register('bio', { maxLength: { value: 280, message: 'Max 280 characters' } })} />
                  <div className="flex justify-between mt-1">
                    {errors.bio ? <p className="text-xs text-red-400">{errors.bio.message}</p> : <span />}
                    <span className={`text-xs ${bioLen >= 260 ? 'text-amber-400' : 'text-slate-500'}`}>{bioLen}/280</span>
                  </div>
                </div>
              </div>
            </div>

            <div className={card}>
              <p className={sectionHdr}>Localization</p>
              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className={labelCls} htmlFor="timezone"><Globe className="inline w-3.5 h-3.5 mr-1 -mt-0.5" />Timezone</label>
                  <select id="timezone" className={inputCls} {...register('timezone')}>
                    <option value="UTC">UTC</option>
                    <option value="America/New_York">America/New York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Los_Angeles">America/Los Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (GMT/BST)</option>
                    <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls} htmlFor="language">Language</label>
                  <select id="language" className={inputCls} {...register('language')}>
                    <option value="en">English</option><option value="es">Spanish</option>
                    <option value="fr">French</option><option value="de">German</option>
                    <option value="ja">Japanese</option><option value="hi">Hindi</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="flex justify-end"><SaveBtn tab="account" onSave={onSaveAccount} /></div>
          </div>
        )}

        {/* ── Notifications ────────────────────────────────────────────────── */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className={card}>
              <p className={sectionHdr}>Notification Preferences</p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[420px]">
                  <thead>
                    <tr>
                      <th className="text-left text-slate-500 text-xs font-medium pb-4 w-1/2">Category</th>
                      <th className="text-center text-slate-400 text-xs font-semibold pb-4 px-4">Email</th>
                      <th className="text-center text-slate-400 text-xs font-semibold pb-4 px-4">In-App</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {([
                      { key: 'messages', label: 'Messages', desc: 'Direct messages and replies' },
                      { key: 'deals', label: 'Deals', desc: 'Investment opportunities and updates' },
                      { key: 'sessions', label: 'Sessions', desc: 'Mentor session requests and reminders' },
                      { key: 'patents', label: 'Patents', desc: 'Patent application status changes' },
                      { key: 'platform', label: 'Platform Updates', desc: 'New features and announcements' },
                    ] as const).map(({ key, label, desc }) => (
                      <tr key={key}>
                        <td className="py-4 pr-4"><p className="text-sm font-medium text-white">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></td>
                        <td className="py-4 px-4 text-center">
                          <Toggle checked={notif[key].email} onChange={(v) => setNotif((p) => ({ ...p, [key]: { ...p[key], email: v } }))} />
                        </td>
                        <td className="py-4 px-4 text-center">
                          <Toggle checked={notif[key].inApp} onChange={(v) => setNotif((p) => ({ ...p, [key]: { ...p[key], inApp: v } }))} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="flex justify-end"><SaveBtn tab="notifications" onSave={onSaveNotif} /></div>
          </div>
        )}

        {/* ── Privacy & Security ───────────────────────────────────────────── */}
        {activeTab === 'privacy' && (
          <div className="space-y-6">
            <div className={card}>
              <p className={sectionHdr}>Profile Visibility</p>
              <RadioGroup name="profileVisibility" value={privacy.profileVisibility}
                onChange={(v) => setPrivacy((p) => ({ ...p, profileVisibility: v }))}
                options={[
                  { value: 'public', label: 'Public', desc: 'Anyone on ProMove can view your profile' },
                  { value: 'connections', label: 'Connections Only', desc: 'Only your connections can view your profile' },
                  { value: 'private', label: 'Private', desc: 'Only you can view your profile' },
                ]} />
            </div>

            <div className={card}>
              <p className={sectionHdr}>Allow Direct Messages From</p>
              <RadioGroup name="dmPermissions" value={privacy.dmPermissions}
                onChange={(v) => setPrivacy((p) => ({ ...p, dmPermissions: v }))}
                options={[
                  { value: 'everyone', label: 'Everyone', desc: 'Any registered user can send you a message' },
                  { value: 'connections', label: 'Connections Only', desc: 'Only people you are connected with' },
                  { value: 'nobody', label: 'Nobody', desc: 'Disable incoming direct messages' },
                ]} />
            </div>

            <div className={card}>
              <p className={sectionHdr}>Contact Info Visibility</p>
              <div className="space-y-5">
                <ToggleRow label="Show Email Address" desc="Display your email on your public profile" checked={privacy.showEmail} onChange={(v) => setPrivacy((p) => ({ ...p, showEmail: v }))} />
                <ToggleRow label="Show Online Status" desc="Let others see when you are active on the platform" checked={privacy.showOnlineStatus} onChange={(v) => setPrivacy((p) => ({ ...p, showOnlineStatus: v }))} />
              </div>
            </div>

            <div className={`${card} border-slate-700`}>
              <p className={sectionHdr}>Password &amp; Security</p>
              <p className="text-sm text-slate-400 mb-4">Keep your account secure by updating your password regularly. We recommend using a unique, strong password.</p>
              <form onSubmit={onChangePassword} className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <AuthPasswordField
                    label="Current password"
                    value={passwordValues.currentPassword}
                    onChange={(event) => setPasswordValues((current) => ({ ...current, currentPassword: event.target.value }))}
                    placeholder="Current password"
                    labelClassName={labelCls}
                    inputClassName={`${inputCls} pr-12`}
                    required
                    autoComplete="current-password"
                  />
                  <AuthPasswordField
                    label="New password"
                    value={passwordValues.newPassword}
                    onChange={(event) => setPasswordValues((current) => ({ ...current, newPassword: event.target.value }))}
                    placeholder="Min. 8 characters"
                    labelClassName={labelCls}
                    inputClassName={`${inputCls} pr-12`}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                  <AuthPasswordField
                    label="Confirm password"
                    value={passwordValues.confirmPassword}
                    onChange={(event) => setPasswordValues((current) => ({ ...current, confirmPassword: event.target.value }))}
                    placeholder="Repeat new password"
                    labelClassName={labelCls}
                    inputClassName={`${inputCls} pr-12`}
                    required
                    minLength={8}
                    autoComplete="new-password"
                  />
                </div>
                {passwordError ? (
                  <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                    {passwordError}
                  </div>
                ) : null}
                {passwordNotice ? (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                    {passwordNotice}
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex items-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
                    {isChangingPassword ? 'Changing Password...' : 'Change Password'}
                  </button>
                </div>
              </form>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onClearTemporaryCache}
                  disabled={isClearingCache}
                  className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/50 hover:bg-amber-500/15 disabled:opacity-60"
                >
                  <Shield className="h-4 w-4" />
                  {isClearingCache ? 'Clearing Cache...' : 'Clear Temporary Cache'}
                </button>
              </div>
              <p className="mt-4 text-xs leading-5 text-slate-500">
                Removes temporary browser memory, cached dashboard state, and first-contact messaging hints. The current session will be cleared.
              </p>
            </div>
            <div className="flex justify-end"><SaveBtn tab="privacy" onSave={onSavePrivacy} /></div>
          </div>
        )}

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className={card}>
              <p className={sectionHdr}>Display Options</p>
              <div className="space-y-5">
                <ToggleRow label="Compact Mode" desc="Reduce padding and spacing for a denser layout" checked={appearance.compactMode} onChange={(v) => setAppearance((a) => ({ ...a, compactMode: v }))} />
                <ToggleRow label="Show Animations" desc="Enable transition and motion effects across the platform" checked={appearance.showAnimations} onChange={(v) => setAppearance((a) => ({ ...a, showAnimations: v }))} />
              </div>
            </div>
            <div className="flex justify-end"><SaveBtn tab="appearance" onSave={onSaveAppearance} /></div>
          </div>
        )}

        {/* ── Role Settings ────────────────────────────────────────────────── */}
        {activeTab === 'role' && (
          <div className="space-y-6">
            {role === UserRole.STUDENT && (
              <>
                <div className={card}>
                  <p className={sectionHdr}>Career &amp; Discovery</p>
                  <div className="space-y-5">
                    <ToggleRow label="Job Seeking" desc="Signal to recruiters that you are open to opportunities" checked={roleState.jobSeeking} onChange={(v) => setRoleState((r) => ({ ...r, jobSeeking: v }))} />
                    <ToggleRow label="Open to Mentorship" desc="Allow mentors to reach out and offer guidance" checked={roleState.openToMentorship} onChange={(v) => setRoleState((r) => ({ ...r, openToMentorship: v }))} />
                  </div>
                </div>
                <div className={card}>
                  <p className={sectionHdr}>Institution Access</p>
                  <div className="space-y-5">
                    <StudentInstitutionStatusPanel user={authUser} />

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-sm font-semibold text-white">Institution-managed education lock</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Institution-managed education is controlled by the linked school or college after approval. You can still add separate past or future education entries in your portfolio editor without changing this managed record.
                      </p>
                    </div>

                    <div>
                      <label className={labelCls} htmlFor="institutionToken">Institution token</label>
                      <div className="flex flex-col gap-3 md:flex-row">
                        <input
                          id="institutionToken"
                          type="text"
                          className={inputCls}
                          placeholder="SCH-XXXXXXX or COL-XXXXXXX"
                          value={institutionToken}
                          onChange={(event) => setInstitutionToken(event.target.value)}
                        />
                        <button
                          type="button"
                          onClick={() => void onSaveInstitutionToken()}
                          disabled={isSavingInstitutionToken}
                          className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60 md:min-w-[180px]"
                        >
                          {isSavingInstitutionToken ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          {isSavingInstitutionToken ? 'Saving Token...' : authUser?.institutionToken ? 'Update Token' : 'Add Token'}
                        </button>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Use the latest invitation token from your school or college. If it belongs to a different institution, your account will go back for that institution&apos;s review before approval.
                      </p>
                      {institutionTokenError ? (
                        <div className="mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
                          {institutionTokenError}
                        </div>
                      ) : null}
                      {institutionTokenNotice ? (
                        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
                          {institutionTokenNotice}
                        </div>
                      ) : null}
                    </div>

                    <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                      <div className="text-sm font-semibold text-white">Institution-managed education</div>
                      {profileQuery.isLoading ? (
                        <p className="mt-2 text-sm text-slate-400">Loading linked education...</p>
                      ) : institutionEducation ? (
                        <div className="mt-3 space-y-1 text-sm">
                          <div className="font-semibold text-white">{institutionEducation.institution}</div>
                          <div className="text-slate-300">
                            {[institutionEducation.degree, institutionEducation.fieldOfStudy].filter(Boolean).join(' in ') || 'Current academic profile'}
                          </div>
                          <div className="text-slate-400">
                            {institutionEducation.isCurrent ? 'Current institution entry' : 'Historical institution entry'}
                          </div>
                          {institutionEducation.description ? (
                            <p className="text-slate-400">{institutionEducation.description}</p>
                          ) : null}
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-400">
                          No institution-managed education has been synced yet. Once your institution token is approved, this section will update automatically.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <div className={card}>
                  <p className={sectionHdr}>Innovation Visibility</p>
                  <RadioGroup name="innovationVisibility" value={roleState.innovationVisibility}
                    onChange={(v) => setRoleState((r) => ({ ...r, innovationVisibility: v }))}
                    options={[
                      { value: 'public', label: 'Public', desc: 'Your projects and innovations are visible to everyone' },
                      { value: 'private', label: 'Private', desc: 'Only you can see your innovations' },
                    ]} />
                </div>
              </>
            )}

            {role === UserRole.INVESTOR && (
              <>
                <div className={card}>
                  <p className={sectionHdr}>Deal Flow</p>
                  <ToggleRow label="Deal Flow Notifications" desc="Receive alerts when new startups match your investment criteria" checked={roleState.dealFlowNotifications} onChange={(v) => setRoleState((r) => ({ ...r, dealFlowNotifications: v }))} />
                </div>
                <div className={card}>
                  <p className={sectionHdr}>Investment Criteria</p>
                  <div className="space-y-5">
                    <div className="grid md:grid-cols-2 gap-5">
                      <div>
                        <label className={labelCls} htmlFor="minInv">Min Investment Size ($)</label>
                        <input id="minInv" type="number" min={0} className={inputCls} value={roleState.minInvestment}
                          onChange={(e) => setRoleState((r) => ({ ...r, minInvestment: Number(e.target.value) }))} />
                      </div>
                      <div>
                        <label className={labelCls} htmlFor="maxInv">Max Investment Size ($)</label>
                        <input id="maxInv" type="number" min={0} className={inputCls} value={roleState.maxInvestment}
                          onChange={(e) => setRoleState((r) => ({ ...r, maxInvestment: Number(e.target.value) }))} />
                      </div>
                    </div>
                    <div>
                      <label className={labelCls} htmlFor="sectors">Preferred Sectors</label>
                      <input id="sectors" type="text" className={inputCls} placeholder="e.g. FinTech, HealthTech, EdTech (comma-separated)"
                        value={roleState.preferredSectors} onChange={(e) => setRoleState((r) => ({ ...r, preferredSectors: e.target.value }))} />
                      <p className="mt-1 text-xs text-slate-500">Separate multiple sectors with commas</p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {role === UserRole.MENTOR && (
              <>
                <div className={card}>
                  <p className={sectionHdr}>Availability</p>
                  <div className="space-y-5">
                    <ToggleRow label="Available for Sessions" desc="Allow students to request mentorship sessions with you" checked={roleState.availableForSessions} onChange={(v) => setRoleState((r) => ({ ...r, availableForSessions: v }))} />
                    <div>
                      <label className={labelCls} htmlFor="maxStudents">Max Concurrent Students</label>
                      <input id="maxStudents" type="number" min={1} max={50} className={`${inputCls} max-w-xs`} value={roleState.maxConcurrentStudents}
                        onChange={(e) => setRoleState((r) => ({ ...r, maxConcurrentStudents: Number(e.target.value) }))} />
                    </div>
                  </div>
                </div>
                <div className={card}>
                  <p className={sectionHdr}>Session Types</p>
                  <div className="space-y-3">
                    {([
                      { key: 'video' as const, label: 'Video Call', desc: 'One-on-one video sessions' },
                      { key: 'text' as const, label: 'Text / Chat', desc: 'Async or real-time text mentorship' },
                      { key: 'inPerson' as const, label: 'In Person', desc: 'Meet physically at an agreed location' },
                    ]).map(({ key, label, desc }) => (
                      <label key={key} className={radioCardCls(roleState.sessionTypes[key])}>
                        <input type="checkbox" checked={roleState.sessionTypes[key]} className="mt-0.5 accent-cyan-500 w-4 h-4"
                          onChange={(e) => setRoleState((r) => ({ ...r, sessionTypes: { ...r.sessionTypes, [key]: e.target.checked } }))} />
                        <div><p className="text-sm font-medium text-white">{label}</p><p className="text-xs text-slate-500 mt-0.5">{desc}</p></div>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {role === UserRole.RECRUITER && (
              <div className={card}>
                <p className={sectionHdr}>Hiring Preferences</p>
                <div className="space-y-5">
                  <ToggleRow label="Actively Hiring" desc="Show students that your company is currently hiring" checked={roleState.activelyHiring} onChange={(v) => setRoleState((r) => ({ ...r, activelyHiring: v }))} />
                  <div>
                    <label className={labelCls} htmlFor="prefRoles">Preferred Roles</label>
                    <input id="prefRoles" type="text" className={inputCls} placeholder="e.g. Frontend Engineer, Product Manager (comma-separated)"
                      value={roleState.preferredRoles} onChange={(e) => setRoleState((r) => ({ ...r, preferredRoles: e.target.value }))} />
                    <p className="mt-1 text-xs text-slate-500">Separate multiple roles with commas</p>
                  </div>
                </div>
              </div>
            )}

            {(role === UserRole.SCHOOL || role === UserRole.COLLEGE) && (
              <div className={card}>
                <p className={sectionHdr}>Institution Settings</p>
                <div className="space-y-5">
                  <ToggleRow label="Public Profile" desc="Make your institution profile discoverable by students and partners" checked={roleState.publicProfile} onChange={(v) => setRoleState((r) => ({ ...r, publicProfile: v }))} />
                  <ToggleRow label="Allow Student Applications" desc="Let students apply to join your institution on ProMove" checked={roleState.allowStudentApplications} onChange={(v) => setRoleState((r) => ({ ...r, allowStudentApplications: v }))} />
                </div>
              </div>
            )}

            {role === UserRole.ADMIN && (
              <div className={card}>
                <div className="flex items-center gap-3 mb-3"><Settings2 className="w-5 h-5 text-cyan-400" /><p className="text-base font-semibold text-white">Admin Settings</p></div>
                <p className="text-sm text-slate-400">Admin settings are managed system-wide. Use the Admin panel to configure platform-level settings, permissions, and system parameters.</p>
              </div>
            )}

            {role !== UserRole.ADMIN && <div className="flex justify-end"><SaveBtn tab="role" onSave={onSaveRole} /></div>}
          </div>
        )}

        {showStickySaveBar ? (
          <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-4">
            <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 rounded-2xl border border-cyan-400/20 bg-slate-950 px-5 py-4 shadow-[0_-12px_40px_rgba(2,6,23,0.55)] backdrop-blur pointer-events-auto">
              <div>
                <div className="text-sm font-semibold text-white">Unsaved changes in {TAB_LABELS[activeTab]}</div>
                <p className="mt-1 text-sm text-slate-400">
                  {isStickyTargetActive
                    ? 'Save this tab to keep your changes after refresh or sign-out.'
                    : `You still have unsaved changes in ${TAB_LABELS[stickyTargetTab!]}. Save them before leaving settings.`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  void stickySaveAction?.();
                }}
                disabled={isStickyTabSaving}
                className={saveBtnCls}
              >
                {isStickyTabSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isStickyTabSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
