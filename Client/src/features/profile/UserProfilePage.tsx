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
import { userApi } from '../../api/user.api';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

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
  const analysisReadiness = useMemo(() => {
    const hasGithub = Boolean((form.githubUrl || profile?.githubUrl || '').trim());
    const hasLinkedIn = Boolean((form.linkedinUrl || profile?.linkedinUrl || '').trim());

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
  }, [form.githubUrl, form.linkedinUrl, profile?.githubUrl, profile?.linkedinUrl]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    await updateMutation.mutateAsync({
      displayName: form.displayName.trim(),
      avatar: form.avatar.trim() || '',
      bio: form.bio.trim() || '',
      domain: form.domain.trim() || '',
      githubUrl: form.githubUrl.trim() || '',
      linkedinUrl: form.linkedinUrl.trim() || '',
      discoverableToRecruiters: currentUser.role === UserRole.STUDENT ? form.discoverableToRecruiters : undefined,
      profileComplete: Boolean(
        form.displayName.trim() &&
          (form.bio.trim() || form.domain.trim() || form.githubUrl.trim() || form.linkedinUrl.trim()),
      ),
    });
  };

  const handleSocialSave = async () => {
    await updateMutation.mutateAsync({
      githubUrl: form.githubUrl.trim() || '',
      linkedinUrl: form.linkedinUrl.trim() || '',
      profileComplete: Boolean(
        form.displayName.trim() &&
          (form.bio.trim() || form.domain.trim() || form.githubUrl.trim() || form.linkedinUrl.trim()),
      ),
    });
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <div className="fixed bottom-6 right-6 z-50 rounded-2xl border border-cyan-500/30 bg-slate-950/95 px-4 py-3 text-sm text-cyan-200 shadow-2xl">
          {toast}
        </div>
      ) : null}

      <Card className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.18),_transparent_35%),linear-gradient(135deg,_rgba(15,23,42,0.95),_rgba(2,6,23,0.98))] p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-500 text-2xl font-bold text-white shadow-lg shadow-cyan-900/40">
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
                </div>
                <p className="mt-2 max-w-2xl text-slate-300">{roleMeta.description}</p>
                <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-400">
                  <span className="inline-flex items-center gap-2">
                    <Mail className="h-4 w-4 text-cyan-300" />
                    {profile?.email}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-cyan-300" />
                    Innovation Score: {profile?.innovationScore ?? 0}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-cyan-300" />
                    Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN') : 'recently'}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Profile Status</div>
                <div className="mt-3 flex items-center gap-2 text-white">
                  <BadgeCheck className="h-5 w-5 text-emerald-400" />
                  {profile?.profileComplete ? 'Complete' : 'Needs attention'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Access</div>
                <div className="mt-3 flex items-center gap-2 text-white">
                  <ShieldCheck className="h-5 w-5 text-cyan-300" />
                  {profile?.accessGrantedBy ?? 'self_registered'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.45fr_0.95fr]">
        <Card className="p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-white">{roleMeta.title}</h2>
              <p className="mt-2 text-sm text-slate-400">
                Update the details the platform uses across dashboards, matching, and profile surfaces.
              </p>
            </div>
            <Button variant="ghost" onClick={() => profileQuery.refetch()} disabled={profileQuery.isFetching}>
              <RefreshCw className={`mr-2 h-4 w-4 ${profileQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-5 md:grid-cols-2">
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
                className="min-h-36 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-cyan-500"
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
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white">Profile Snapshot</h3>
            <div className="mt-5 space-y-4 text-sm">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Email</div>
                <div className="mt-2 text-white">{profile?.email}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Role</div>
                <div className="mt-2 capitalize text-white">{currentUser.role}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Verification</div>
                <div className="mt-2 text-white">{profile?.verificationStatus ?? 'not_required'}</div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Institution</div>
                <div className="mt-2 text-white">
                  {profile?.institutionProfile?.institutionName ?? profile?.institutionId ?? 'Not linked'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">GitHub</div>
                <div className="mt-2">
                  {profile?.githubUrl ? (
                    <a
                      href={profile.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
                    >
                      Open profile
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-white">Not linked</span>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">LinkedIn</div>
                <div className="mt-2">
                  {profile?.linkedinUrl ? (
                    <a
                      href={profile.linkedinUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"
                    >
                      Open profile
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : (
                    <span className="text-white">Not linked</span>
                  )}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white">Skill Analysis Readiness</h3>
            <div className="mt-5 space-y-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Analysis signal</div>
                    <div className="mt-2 text-white">{analysisReadiness.description}</div>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${analysisReadiness.tone}`}>
                    {analysisReadiness.label}
                  </span>
                </div>
              </div>
              <div className="grid gap-4">
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
                  <div className="mt-2 text-xs text-slate-500">
                    Enter a public GitHub profile to support repo and language-based skill analysis.
                  </div>
                </label>

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
                  <div className="mt-2 text-xs text-slate-500">
                    Enter a public LinkedIn profile to enrich experience, education, and skill context.
                  </div>
                </label>

                <div className="flex justify-end">
                  <Button onClick={() => void handleSocialSave()} disabled={updateMutation.isPending}>
                    {updateMutation.isPending ? 'Saving links...' : 'Save skill sources'}
                  </Button>
                </div>
              </div>
              {[
                {
                  label: 'GitHub repository and language analysis',
                  done: Boolean((form.githubUrl || profile?.githubUrl || '').trim()),
                },
                {
                  label: 'LinkedIn experience and skill enrichment',
                  done: Boolean((form.linkedinUrl || profile?.linkedinUrl || '').trim()),
                },
                {
                  label: 'Manual profile context from bio and domain',
                  done: Boolean(form.bio.trim() || form.domain.trim()),
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3"
                >
                  <div className="text-sm text-slate-300">{item.label}</div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {item.done ? 'Ready' : 'Missing'}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-white">Profile Quality</h3>
            <div className="mt-5 space-y-3">
              {[
                { label: 'Display name added', done: Boolean(form.displayName.trim()) },
                { label: 'Bio added', done: Boolean(form.bio.trim()) },
                { label: 'Domain added', done: Boolean(form.domain.trim()) },
                { label: 'Avatar added', done: Boolean(form.avatar.trim() || profile?.avatar) },
                { label: 'GitHub URL added', done: Boolean((form.githubUrl || profile?.githubUrl || '').trim()) },
                { label: 'LinkedIn URL added', done: Boolean((form.linkedinUrl || profile?.linkedinUrl || '').trim()) },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-950/80 px-4 py-3"
                >
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <User className="h-4 w-4 text-cyan-300" />
                    {item.label}
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      item.done ? 'bg-emerald-500/10 text-emerald-300' : 'bg-amber-500/10 text-amber-300'
                    }`}
                  >
                    {item.done ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
