import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  CalendarDays,
  ExternalLink,
  Github,
  Linkedin,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  User,
} from 'lucide-react';
import { SocialEnrichSummary, userApi } from '../../api/user.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

const GITHUB_PROFILE_ROLES = new Set<UserRole>([UserRole.STUDENT, UserRole.MENTOR]);

const supportsGithubProfile = (role: UserRole) => GITHUB_PROFILE_ROLES.has(role);

const roleCopy: Record<UserRole, { title: string; description: string }> = {
  [UserRole.STUDENT]: {
    title: 'Build your maker identity',
    description: 'Keep your innovation story fresh so mentors, recruiters, and collaborators see the right snapshot of you.',
  },
  [UserRole.SCHOOL]: {
    title: 'Represent your institution clearly',
    description: 'This profile helps students, mentors, and investors understand who is leading your innovation ecosystem.',
  },
  [UserRole.COLLEGE]: {
    title: 'Showcase your college innovation desk',
    description: 'Use this profile to make your college presence feel credible, current, and easy to trust.',
  },
  [UserRole.MENTOR]: {
    title: 'Make your guidance discoverable',
    description: 'A complete profile helps students understand your domain, working style, and credibility at a glance.',
  },
  [UserRole.INVESTOR]: {
    title: 'Present your investor profile',
    description: 'Founders and institutions use this page as a quick read on your focus area and platform presence.',
  },
  [UserRole.RECRUITER]: {
    title: 'Clarify your hiring identity',
    description: 'A polished profile helps students and institutions understand what kind of opportunities you represent.',
  },
  [UserRole.ADMIN]: {
    title: 'Keep your admin identity current',
    description: 'This profile is shown across platform-level workflows where trust and clarity matter.',
  },
};

export function UserProfilePage() {
  const queryClient = useQueryClient();
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);
  const [toast, setToast] = useState('');
  const [confirmLinkedinFetch, setConfirmLinkedinFetch] = useState(false);
  const [form, setForm] = useState({
    displayName: '',
    avatar: '',
    bio: '',
    domain: '',
    githubUrl: '',
    linkedinUrl: '',
    discoverableToRecruiters: false,
  });

  const profileQuery = useQuery({
    queryKey: ['profile', 'me'],
    queryFn: userApi.getMe,
  });

  useEffect(() => {
    if (!profileQuery.data) {
      return;
    }

    setForm({
      displayName: profileQuery.data.displayName ?? '',
      avatar: profileQuery.data.avatar ?? '',
      bio: profileQuery.data.bio ?? '',
      domain: profileQuery.data.domain ?? '',
      githubUrl: profileQuery.data.githubUrl ?? '',
      linkedinUrl: profileQuery.data.linkedinUrl ?? '',
      discoverableToRecruiters: profileQuery.data.discoverableToRecruiters ?? false,
    });
    setConfirmLinkedinFetch(false);
  }, [profileQuery.data]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const updateMutation = useMutation({
    mutationFn: userApi.updateMe,
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(['profile', 'me'], updatedUser);
      setUser(updatedUser);
      setToast('Profile updated.');
    },
    onError: (error) => {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Unable to update your profile right now.',
      );
    },
  });

  const buildSocialToast = (summary: SocialEnrichSummary) => {
    const imported: string[] = [];

    if (summary.githubImported) {
      imported.push(
        [
          summary.importedProjects > 0 ? `${summary.importedProjects} GitHub projects` : null,
          summary.importedSkills > 0 ? `${summary.importedSkills} skills` : null,
        ]
          .filter(Boolean)
          .join(', ') || 'GitHub data',
      );
    }

    if (summary.linkedinImported) {
      imported.push(
        [
          summary.importedProfileFields > 0 ? `${summary.importedProfileFields} LinkedIn profile fields` : null,
          summary.importedExperience > 0 ? `${summary.importedExperience} experience items` : null,
          summary.importedEducation > 0 ? `${summary.importedEducation} education items` : null,
          summary.importedCertifications > 0 ? `${summary.importedCertifications} certifications` : null,
        ]
          .filter(Boolean)
          .join(', ') || 'LinkedIn data',
      );
    }

    if (imported.length > 0) {
      return `Imported ${imported.join(' and ')}.${summary.warnings.length > 0 ? ` ${summary.warnings[0]}` : ''}`;
    }

    if (summary.warnings.length > 0) {
      return summary.warnings[0];
    }

    return 'No new social data was imported.';
  };

  const socialEnrichMutation = useMutation({
    mutationFn: userApi.enrichFromSocialLinks,
    onSuccess: ({ user, summary }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setToast(buildSocialToast(summary));
      setConfirmLinkedinFetch(false);
    },
    onError: (error) => {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Unable to fetch social profile data right now.',
      );
    },
  });

  const profile = profileQuery.data ?? currentUser;
  const initials = useMemo(
    () =>
      (profile?.displayName ?? 'User')
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
    [profile?.displayName],
  );

  if (!currentUser) {
    return null;
  }

  const roleMeta = roleCopy[currentUser.role];
  const githubEnabled = supportsGithubProfile(currentUser.role);
  const isBusy = updateMutation.isPending || socialEnrichMutation.isPending;
  const hasSocialSource = Boolean((githubEnabled && form.githubUrl.trim()) || form.linkedinUrl.trim());
  const isProfileComplete = (
    displayName: string,
    bio: string,
    domain: string,
    githubUrl: string,
    linkedinUrl: string,
  ) =>
    Boolean(
      displayName.trim() &&
        (bio.trim() ||
          domain.trim() ||
          linkedinUrl.trim() ||
          (githubEnabled && githubUrl.trim())),
    );

  const analysisReadiness = useMemo(() => {
    const hasGithub = githubEnabled && Boolean((form.githubUrl || profile?.githubUrl || '').trim());
    const hasLinkedIn = Boolean((form.linkedinUrl || profile?.linkedinUrl || '').trim());

    if (!githubEnabled) {
      if (hasLinkedIn) {
        return {
          label: 'Profile link added',
          tone: 'bg-emerald-500/10 text-emerald-300',
          description: 'LinkedIn is enough for trust, role context, and platform-facing identity on this profile.',
        };
      }

      return {
        label: 'Optional',
        tone: 'bg-cyan-500/10 text-cyan-300',
        description: 'Add a LinkedIn URL if you want a stronger public identity across platform workflows.',
      };
    }

    if (hasGithub && hasLinkedIn) {
      return {
        label: 'High confidence',
        tone: 'bg-emerald-500/10 text-emerald-300',
        description: 'GitHub repositories plus LinkedIn experience give the best base for richer skill analysis.',
      };
    }

    if (hasGithub || hasLinkedIn) {
      return {
        label: 'Medium confidence',
        tone: 'bg-cyan-500/10 text-cyan-300',
        description: 'One social source is linked. Add the other one to deepen profile enrichment and skill inference.',
      };
    }

    return {
      label: 'Starter mode',
      tone: 'bg-amber-500/10 text-amber-300',
      description: 'Add GitHub and LinkedIn URLs to improve future skill extraction, portfolio context, and profile matching.',
    };
  }, [form.githubUrl, form.linkedinUrl, githubEnabled, profile?.githubUrl, profile?.linkedinUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await updateMutation.mutateAsync({
      displayName: form.displayName.trim(),
      avatar: form.avatar.trim() || '',
      bio: form.bio.trim() || '',
      domain: form.domain.trim() || '',
      ...(githubEnabled ? { githubUrl: form.githubUrl.trim() || '' } : {}),
      linkedinUrl: form.linkedinUrl.trim() || '',
      discoverableToRecruiters: currentUser.role === UserRole.STUDENT ? form.discoverableToRecruiters : undefined,
      profileComplete: isProfileComplete(
        form.displayName,
        form.bio,
        form.domain,
        form.githubUrl,
        form.linkedinUrl,
      ),
    });
  };

  const handleSocialSave = async () => {
    await updateMutation.mutateAsync({
      ...(githubEnabled ? { githubUrl: form.githubUrl.trim() || '' } : {}),
      linkedinUrl: form.linkedinUrl.trim() || '',
      profileComplete: isProfileComplete(
        form.displayName,
        form.bio,
        form.domain,
        form.githubUrl,
        form.linkedinUrl,
      ),
    });
  };

  const handleSocialEnrich = async () => {
    await socialEnrichMutation.mutateAsync({
      ...(githubEnabled && form.githubUrl.trim() ? { githubUrl: form.githubUrl.trim() } : {}),
      ...(form.linkedinUrl.trim() ? { linkedinUrl: form.linkedinUrl.trim() } : {}),
      ...(form.linkedinUrl.trim() ? { confirmLinkedinFetch } : {}),
    });
  };

  const completionItems = [
    { label: 'Display name', done: Boolean(form.displayName.trim()) },
    { label: 'Bio', done: Boolean(form.bio.trim()) },
    { label: 'Domain', done: Boolean(form.domain.trim()) },
    { label: 'Avatar', done: Boolean(form.avatar.trim() || profile?.avatar) },
    ...(githubEnabled
      ? [{ label: 'GitHub', done: Boolean((form.githubUrl || profile?.githubUrl || '').trim()) }]
      : []),
    { label: 'LinkedIn', done: Boolean((form.linkedinUrl || profile?.linkedinUrl || '').trim()) },
  ];
  const completionPct = Math.round((completionItems.filter((i) => i.done).length / completionItems.length) * 100);

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-cyan-500/30 bg-slate-950/95 px-4 py-3 text-sm text-cyan-200 shadow-2xl">
          {toast}
        </div>
      ) : null}

      {/* Hero header */}
      <Card className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.98))] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            {/* Avatar + name */}
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-500 text-2xl font-bold text-white shadow-lg shadow-cyan-900/40">
                {profile?.avatar ? (
                  <img src={profile.avatar} alt={profile.displayName} className="h-24 w-24 rounded-3xl object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-3xl font-bold text-white">{profile?.displayName ?? 'Your Profile'}</h1>
                  <span className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                    {currentUser.role}
                  </span>
                  {profile?.profileComplete ? (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                      <BadgeCheck className="h-3.5 w-3.5" /> Complete
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
                      {completionPct}% complete
                    </span>
                  )}
                </div>
                <p className="mt-2 max-w-2xl text-slate-300">{roleMeta.description}</p>
                <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-300" />
                    {profile?.email}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    Score: {profile?.innovationScore ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-cyan-300" />
                    Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN') : 'recently'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-cyan-300" />
                    {profile?.accessGrantedBy ?? 'self_registered'}
                  </span>
                  {githubEnabled && profile?.githubUrl ? (
                    <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
                      <Github className="h-4 w-4" /> GitHub
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                  {profile?.linkedinUrl ? (
                    <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200">
                      <Linkedin className="h-4 w-4" /> LinkedIn
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              </div>
            </div>

            {/* Completion ring */}
            <div className="flex flex-shrink-0 flex-col items-center gap-2 rounded-2xl border border-slate-800 bg-slate-950/70 p-5 lg:min-w-[160px]">
              <svg className="h-20 w-20 -rotate-90">
                <circle cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent" className="text-slate-800" />
                <circle
                  cx="40" cy="40" r="32" stroke="currentColor" strokeWidth="6" fill="transparent"
                  strokeDasharray={`${2 * Math.PI * 32}`}
                  strokeDashoffset={`${2 * Math.PI * 32 * (1 - completionPct / 100)}`}
                  className="text-cyan-400" strokeLinecap="round"
                />
              </svg>
              <div className="text-center">
                <div className="text-2xl font-bold text-white">{completionPct}%</div>
                <div className="text-xs text-slate-500">Profile filled</div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Two-column edit area */}
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Left — edit form */}
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{roleMeta.title}</h2>
              <p className="mt-1 text-sm text-slate-400">
                Update the details shown across dashboards, matching, and profile surfaces.
              </p>
            </div>
            <Button variant="ghost" onClick={() => profileQuery.refetch()} disabled={profileQuery.isFetching || isBusy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${profileQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block">
                <div className="mb-2 text-sm font-semibold text-white">Display Name</div>
                <input
                  value={form.displayName}
                  onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="How your name appears on ProMove"
                />
              </label>

              <label className="block">
                <div className="mb-2 text-sm font-semibold text-white">Domain / Focus Area</div>
                <input
                  value={form.domain}
                  onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="AI, Product Design, Hiring, Fintech..."
                />
              </label>
            </div>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-white">Avatar URL</div>
              <input
                value={form.avatar}
                onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))}
                className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                placeholder="Paste an image URL"
              />
            </label>

            <label className="block">
              <div className="mb-2 text-sm font-semibold text-white">Bio</div>
              <textarea
                value={form.bio}
                onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))}
                className="min-h-32 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                placeholder="Tell people what you build, guide, hire for, or invest in."
              />
            </label>

            {currentUser.role === UserRole.STUDENT ? (
              <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <input
                  type="checkbox"
                  checked={form.discoverableToRecruiters}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, discoverableToRecruiters: event.target.checked }))
                  }
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-semibold text-white">Visible to recruiters</div>
                  <div className="mt-1 text-sm text-slate-400">
                    Let recruiter workflows surface your student profile when your score and activity are relevant.
                  </div>
                </div>
              </label>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy}>
                {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </Card>

        {/* Right — skill sources + quality checklist */}
        <div className="space-y-6">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white">{githubEnabled ? 'Skill Sources' : 'Profile Links'}</h3>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysisReadiness.tone}`}>
                {analysisReadiness.label}
              </span>
            </div>
            <p className="mb-5 text-sm text-slate-400">{analysisReadiness.description}</p>
            <div className="space-y-4">
              {githubEnabled ? (
                <label className="block rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                    <Github className="h-4 w-4 text-cyan-300" />
                    GitHub URL
                  </div>
                  <input
                    type="url"
                    value={form.githubUrl}
                    onChange={(event) => setForm((current) => ({ ...current, githubUrl: event.target.value }))}
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                    placeholder="https://github.com/your-handle"
                  />
                </label>
              ) : null}

              <label className="block rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                  <Linkedin className="h-4 w-4 text-cyan-300" />
                  LinkedIn URL
                </div>
                <input
                  type="url"
                  value={form.linkedinUrl}
                  onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
                  placeholder="https://www.linkedin.com/in/your-profile"
                />
              </label>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <input
                  type="checkbox"
                  checked={confirmLinkedinFetch}
                  onChange={(event) => setConfirmLinkedinFetch(event.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
                />
                <div>
                  <div className="font-semibold text-white">Fetch public LinkedIn data</div>
                  <div className="mt-1 text-sm text-slate-400">
                    LinkedIn data is only fetched when you confirm it here. Without confirmation, the URL is saved
                    but no LinkedIn profile data is imported.
                  </div>
                </div>
              </label>

              <div className="flex flex-wrap justify-end gap-3">
                <Button variant="secondary" onClick={() => void handleSocialEnrich()} disabled={isBusy || !hasSocialSource}>
                  {socialEnrichMutation.isPending ? 'Fetching...' : 'Fetch and use social data'}
                </Button>
                <Button onClick={() => void handleSocialSave()} disabled={isBusy}>
                  {updateMutation.isPending ? 'Saving...' : githubEnabled ? 'Save skill sources' : 'Save links'}
                </Button>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Profile Completeness</h3>
            {/* Progress bar */}
            <div className="mb-5">
              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                <span>{completionItems.filter((i) => i.done).length} of {completionItems.length} fields filled</span>
                <span className="font-semibold text-white">{completionPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-500 transition-all"
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {completionItems.map((item) => (
                <div
                  key={item.label}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${
                    item.done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-slate-900 text-slate-500'
                  }`}
                >
                  <User className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{item.label}</span>
                  {item.done ? <BadgeCheck className="ml-auto h-3.5 w-3.5 flex-shrink-0" /> : null}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
