import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { User, Bell, Shield, Palette, Settings2, Save, Loader2, Check, Lock, Globe, Monitor, Moon, Sun } from 'lucide-react';
import { userApi } from '../../api/user.api';
import type { UserSettings } from '../../types/settings.types';
import { useSettings } from '../../hooks/useSettings';
import { useAuthStore } from '../../store/authStore';
import { applyTheme } from '../../hooks/useTheme';
import { UserRole } from '../../types/roles.types';
import { OptionTabs } from '../../components/ui/OptionTabs';

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

// ─── State types ──────────────────────────────────────────────────────────────

type NotifRow = { email: boolean; inApp: boolean };
type NotifMatrix = { messages: NotifRow; deals: NotifRow; sessions: NotifRow; patents: NotifRow; platform: NotifRow };
type PrivacyState = { profileVisibility: 'public' | 'connections' | 'private'; dmPermissions: 'everyone' | 'connections' | 'nobody'; showEmail: boolean; showPhone: boolean; showOnlineStatus: boolean };
type AppearanceState = { theme: 'dark' | 'light' | 'system'; compactMode: boolean; showAnimations: boolean };
type SessionTypes = { video: boolean; text: boolean; inPerson: boolean };
type RoleState = {
  jobSeeking: boolean; openToMentorship: boolean; innovationVisibility: 'public' | 'private';
  dealFlowNotifications: boolean; minInvestment: number; maxInvestment: number; preferredSectors: string;
  availableForSessions: boolean; sessionTypes: SessionTypes; maxConcurrentStudents: number;
  activelyHiring: boolean; preferredRoles: string;
  publicProfile: boolean; allowStudentApplications: boolean;
};
type AccountValues = { displayName: string; bio: string; timezone: string; language: string };

const splitCsv = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const defaultNotif: NotifMatrix = {
  messages: { email: true, inApp: true }, deals: { email: true, inApp: true },
  sessions: { email: true, inApp: true }, patents: { email: false, inApp: true }, platform: { email: true, inApp: false },
};
const defaultPrivacy: PrivacyState = { profileVisibility: 'public', dmPermissions: 'everyone', showEmail: false, showPhone: false, showOnlineStatus: true };
const defaultAppearance: AppearanceState = { theme: 'dark', compactMode: false, showAnimations: true };
const defaultRole: RoleState = {
  jobSeeking: false, openToMentorship: false, innovationVisibility: 'public',
  dealFlowNotifications: true, minInvestment: 10000, maxInvestment: 500000, preferredSectors: '',
  availableForSessions: true, sessionTypes: { video: true, text: true, inPerson: false }, maxConcurrentStudents: 5,
  activelyHiring: false, preferredRoles: '',
  publicProfile: true, allowStudentApplications: true,
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
  const authUser = useAuthStore((s) => s.user);
  const setAuthUser = useAuthStore((s) => s.setUser);
  const [activeTab, setActiveTab] = useState<TabId>('account');
  const [savedTab, setSavedTab] = useState<TabId | null>(null);
  const [savingTab, setSavingTab] = useState<TabId | null>(null);
  const [notif, setNotif] = useState<NotifMatrix>(defaultNotif);
  const [privacy, setPrivacy] = useState<PrivacyState>(defaultPrivacy);
  const [appearance, setAppearance] = useState<AppearanceState>(defaultAppearance);
  const [roleState, setRoleState] = useState<RoleState>(defaultRole);
  const role = authUser?.role ?? UserRole.STUDENT;

  const { register, handleSubmit, watch, reset, formState: { errors } } = useForm<AccountValues>({
    defaultValues: { displayName: '', bio: '', timezone: 'UTC', language: 'en' },
  });
  const bioLen = (watch('bio') ?? '').length;

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
        showPhone: settings.privacy.showPhone,
        showOnlineStatus: settings.privacy.showOnlineStatus,
      });
    }
    if (settings.appearance) {
      setAppearance(settings.appearance);
    }
    const persistedRoleSettings = settings.roleSettings ?? {};
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

    setRoleState(nextRoleState);
  }, [
    authUser?.bio,
    authUser?.displayName,
    authUser?.discoverableToRecruiters,
    authUser?.isProfilePublic,
    reset,
    role,
    settings,
  ]);

  const markSaved = (tab: TabId) => { setSavedTab(tab); setTimeout(() => setSavedTab(null), 2000); };
  const withSaveState = async (tab: TabId, action: () => Promise<void>) => {
    setSavingTab(tab);
    try {
      await action();
      markSaved(tab);
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
          showPhone: privacy.showPhone,
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
      <div className="mx-auto w-full max-w-4xl p-6">
        <SettingsSkeleton />
      </div>
    );
  }

  return (
      <div className="mx-auto w-full max-w-4xl p-6">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-slate-400 mt-1">Manage your account preferences and configurations</p>
        </div>

        {/* Tab bar */}
        <OptionTabs items={TABS} activeId={activeTab} onChange={setActiveTab} className="mb-8" aria-label="Settings sections" />

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
                <ToggleRow label="Show Phone Number" desc="Display your phone number on your public profile" checked={privacy.showPhone} onChange={(v) => setPrivacy((p) => ({ ...p, showPhone: v }))} />
                <ToggleRow label="Show Online Status" desc="Let others see when you are active on the platform" checked={privacy.showOnlineStatus} onChange={(v) => setPrivacy((p) => ({ ...p, showOnlineStatus: v }))} />
              </div>
            </div>

            <div className={`${card} border-slate-700`}>
              <p className={sectionHdr}>Password &amp; Security</p>
              <p className="text-sm text-slate-400 mb-4">Keep your account secure by updating your password regularly. We recommend using a unique, strong password.</p>
              <button type="button" disabled title="Coming soon"
                className="flex items-center gap-2 bg-slate-800 text-slate-400 border border-slate-700 font-semibold rounded-xl px-5 py-2.5 text-sm cursor-not-allowed opacity-70">
                <Lock className="w-4 h-4" />Change Password
                <span className="ml-2 text-xs bg-slate-700 text-slate-400 rounded-md px-1.5 py-0.5">Coming soon</span>
              </button>
            </div>
            <div className="flex justify-end"><SaveBtn tab="privacy" onSave={onSavePrivacy} /></div>
          </div>
        )}

        {/* ── Appearance ───────────────────────────────────────────────────── */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className={card}>
              <p className={sectionHdr}>Theme</p>
              <div className="grid grid-cols-3 gap-4">
                {([{ value: 'dark', label: 'Dark', Icon: Moon }, { value: 'light', label: 'Light', Icon: Sun }, { value: 'system', label: 'System', Icon: Monitor }] as const).map(({ value, label, Icon }) => (
                  <button key={value} type="button" onClick={() => { setAppearance((a) => ({ ...a, theme: value })); applyTheme(value); }}
                    className={`flex flex-col items-center gap-3 p-5 rounded-2xl border-2 transition-all ${appearance.theme === value ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-700 hover:border-slate-600 bg-slate-950'}`}>
                    <Icon className={`w-6 h-6 ${appearance.theme === value ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className={`text-sm font-medium ${appearance.theme === value ? 'text-cyan-300' : 'text-slate-300'}`}>{label}</span>
                  </button>
                ))}
              </div>
            </div>

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
      </div>
  );
}
