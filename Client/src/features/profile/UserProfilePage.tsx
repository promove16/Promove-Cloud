import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import {
  BadgeCheck,
  CalendarDays,
  Copy,
  ExternalLink,
  GitCommitHorizontal,
  Github,
  Globe,
  Instagram,
  Linkedin,
  Link2,
  Mail,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Twitter,
  Youtube,
} from 'lucide-react';
import { authApi } from '../../api/auth.api';
import { GithubRepositoryChoice, SocialEnrichSummary, UserProfile, userApi } from '../../api/user.api';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';

const GITHUB_PROFILE_ROLES = new Set<UserRole>([UserRole.STUDENT, UserRole.MENTOR]);

const roleCopy: Record<UserRole, { title: string; description: string }> = {
  [UserRole.STUDENT]: {
    title: 'Build your maker identity',
    description: 'Shift your profile from claims to proof with GitHub-backed repositories and activity.',
  },
  [UserRole.SCHOOL]: {
    title: 'Represent your institution clearly',
    description: 'Keep your institution profile clear and current across platform workflows.',
  },
  [UserRole.COLLEGE]: {
    title: 'Showcase your college innovation desk',
    description: 'Make your college presence credible, current, and easy to trust.',
  },
  [UserRole.MENTOR]: {
    title: 'Make your guidance discoverable',
    description: 'Connect real work proof so students can trust your technical credibility.',
  },
  [UserRole.INVESTOR]: {
    title: 'Present your investor profile',
    description: 'Keep your public context sharp for founders and institutions.',
  },
  [UserRole.RECRUITER]: {
    title: 'Clarify your hiring identity',
    description: 'A clear profile helps students and institutions understand what you represent.',
  },
  [UserRole.ADMIN]: {
    title: 'Keep your admin identity current',
    description: 'This profile appears across platform-level workflows where trust matters.',
  },
};

const supportsGithubProfile = (role: UserRole) => GITHUB_PROFILE_ROLES.has(role);

const readError = (error: unknown, fallback: string) =>
  (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ?? fallback;

const buildSocialToast = (summary: SocialEnrichSummary) => {
  const chunks: string[] = [];

  if (summary.linkedinImported) {
    chunks.push(
      [
        summary.importedProfileFields ? `${summary.importedProfileFields} profile fields` : null,
        summary.importedExperience ? `${summary.importedExperience} experience items` : null,
        summary.importedEducation ? `${summary.importedEducation} education items` : null,
        summary.importedCertifications ? `${summary.importedCertifications} certifications` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'LinkedIn data',
    );
  }

  if (summary.githubImported) {
    chunks.push(
      [
        summary.importedProjects ? `${summary.importedProjects} GitHub projects` : null,
        summary.importedSkills ? `${summary.importedSkills} skills` : null,
      ]
        .filter(Boolean)
        .join(', ') || 'GitHub data',
    );
  }

  if (chunks.length > 0) {
    return `Imported ${chunks.join(' and ')}.${summary.warnings[0] ? ` ${summary.warnings[0]}` : ''}`;
  }

  return summary.warnings[0] ?? 'No new social data was imported.';
};

type ProfileForm = {
  displayName: string;
  avatar: string;
  bio: string;
  domain: string;
  linkedinUrl: string;
  websiteUrl: string;
  twitterUrl: string;
  youtubeUrl: string;
  behanceUrl: string;
  dribbbleUrl: string;
  instagramUrl: string;
  researchGateUrl: string;
  mediumUrl: string;
  discoverableToRecruiters: boolean;
};

function RepoRow({
  repo,
  checked,
  onToggle,
}: {
  repo: GithubRepositoryChoice;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer gap-3 rounded-2xl border border-slate-800 bg-slate-950/80 p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-semibold text-white">{repo.fullName}</span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${repo.isPrivate ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
            {repo.isPrivate ? 'Private' : 'Public'}
          </span>
          {repo.imported ? (
            <span className="rounded-full bg-cyan-500/10 px-2 py-0.5 text-[11px] font-semibold text-cyan-300">
              Imported
            </span>
          ) : null}
        </div>
        <div className="mt-1 text-sm text-slate-400">{repo.description || 'No description added.'}</div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
          {repo.primaryLanguage ? <span>{repo.primaryLanguage}</span> : null}
          <span>Stars {repo.stars}</span>
          <span>Forks {repo.forks}</span>
        </div>
      </div>
    </label>
  );
}

export function UserProfilePage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const setUser = useAuthStore((state) => state.setUser);
  const currentUser = useAuthStore((state) => state.user);
  const [toast, setToast] = useState('');
  const [confirmLinkedinFetch, setConfirmLinkedinFetch] = useState(false);
  const [selectedRepoIds, setSelectedRepoIds] = useState<string[]>([]);
  const [institutionToken, setInstitutionToken] = useState('');
  const [form, setForm] = useState<ProfileForm>({
    displayName: '',
    avatar: '',
    bio: '',
    domain: '',
    linkedinUrl: '',
    websiteUrl: '',
    twitterUrl: '',
    youtubeUrl: '',
    behanceUrl: '',
    dribbbleUrl: '',
    instagramUrl: '',
    researchGateUrl: '',
    mediumUrl: '',
    discoverableToRecruiters: false,
  });

  const profileQuery = useQuery({ queryKey: ['profile', 'me'], queryFn: userApi.getMe });
  const profile = (profileQuery.data ?? currentUser ?? null) as UserProfile | null;

  useEffect(() => {
    if (!profileQuery.data) return;
    setForm({
      displayName: profileQuery.data.displayName ?? '',
      avatar: profileQuery.data.avatar ?? '',
      bio: profileQuery.data.bio ?? '',
      domain: profileQuery.data.domain ?? '',
      linkedinUrl: profileQuery.data.linkedinUrl ?? '',
      websiteUrl: profileQuery.data.websiteUrl ?? '',
      twitterUrl: profileQuery.data.twitterUrl ?? '',
      youtubeUrl: profileQuery.data.youtubeUrl ?? '',
      behanceUrl: profileQuery.data.behanceUrl ?? '',
      dribbbleUrl: profileQuery.data.dribbbleUrl ?? '',
      instagramUrl: profileQuery.data.instagramUrl ?? '',
      researchGateUrl: profileQuery.data.researchGateUrl ?? '',
      mediumUrl: profileQuery.data.mediumUrl ?? '',
      discoverableToRecruiters: profileQuery.data.discoverableToRecruiters ?? false,
    });
  }, [profileQuery.data]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const githubRoleSupported = currentUser ? supportsGithubProfile(currentUser.role) : false;
  const githubOauthAvailable = profile?.githubOAuthAvailable ?? currentUser?.githubOAuthAvailable ?? false;
  const githubConnected = githubRoleSupported && Boolean(profile?.connectedAccounts?.github?.userId);
  const hasGithubProof =
    githubConnected ||
    (profile?.githubProof?.importedRepos?.length ?? 0) > 0 ||
    Boolean(profile?.githubProof?.lastSyncedAt);
  const githubEnabled = githubRoleSupported && (githubOauthAvailable || hasGithubProof);

  const githubRepositoriesQuery = useQuery({
    queryKey: ['profile', 'github-repositories'],
    queryFn: userApi.listGithubRepositories,
    enabled: githubConnected,
  });

  useEffect(() => {
    if (!githubRepositoriesQuery.data) return;
    setSelectedRepoIds(githubRepositoriesQuery.data.filter((repo) => repo.imported).map((repo) => repo.repoId));
  }, [githubRepositoriesQuery.data]);

  useEffect(() => {
    const githubStatus = searchParams.get('github');
    if (!githubStatus) return;

    if (githubStatus === 'connected') {
      setToast('GitHub connected. Your profile has been enriched with GitHub activity, tech, and skills.');
      void queryClient.invalidateQueries({ queryKey: ['profile', 'me'] });
      void queryClient.invalidateQueries({ queryKey: ['profile', 'github-repositories'] });
    } else if (githubStatus === 'error') {
      setToast(searchParams.get('message') ?? 'GitHub connection failed.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('github');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [queryClient, searchParams, setSearchParams]);

  const updateMutation = useMutation({
    mutationFn: userApi.updateMe,
    onSuccess: (user) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setToast('Profile updated.');
    },
    onError: (error) => setToast(readError(error, 'Unable to update your profile right now.')),
  });

  const socialMutation = useMutation({
    mutationFn: userApi.enrichFromSocialLinks,
    onSuccess: ({ user, summary }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setConfirmLinkedinFetch(false);
      setToast(buildSocialToast(summary));
    },
    onError: (error) => setToast(readError(error, 'Unable to fetch LinkedIn data right now.')),
  });

  const startGithubMutation = useMutation({
    mutationFn: userApi.startGithubOauth,
    onSuccess: ({ authorizationUrl }) => window.location.assign(authorizationUrl),
    onError: (error) => setToast(readError(error, 'Unable to start GitHub sign-in.')),
  });

  const syncGithubMutation = useMutation({
    mutationFn: userApi.syncGithubProof,
    onSuccess: ({ user, repositoryCount }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'github-repositories'] });
      setToast(`GitHub proof refreshed from ${repositoryCount} repositories.`);
    },
    onError: (error) => setToast(readError(error, 'Unable to refresh GitHub proof.')),
  });

  const importGithubMutation = useMutation({
    mutationFn: userApi.importGithubRepositories,
    onSuccess: ({ user, importedCount }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      void queryClient.invalidateQueries({ queryKey: ['profile', 'github-repositories'] });
      setToast(`Imported ${importedCount} repositories into your proof layer.`);
    },
    onError: (error) => setToast(readError(error, 'Unable to import repositories.')),
  });
  const submitInstitutionTokenMutation = useMutation({
    mutationFn: authApi.submitInstitutionToken,
    onSuccess: ({ message, user }) => {
      queryClient.setQueryData(['profile', 'me'], user);
      setUser(user);
      setInstitutionToken('');
      setToast(message);
    },
    onError: (error) => setToast(readError(error, 'Unable to submit the institution token.')),
  });

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

  if (!currentUser) return null;

  const roleMeta = roleCopy[currentUser.role];
  const importedRepos = profile?.githubProof?.importedRepos ?? [];
  const repoChoices = githubRepositoriesQuery.data ?? [];
  const githubTopLanguages = profile?.githubStats?.topLanguages ?? [];
  const githubSkills = (profile?.skills ?? []).filter((skill) => skill.source === 'github');
  const githubProjects = (profile?.portfolioProjects ?? []).filter((project) => project.source === 'github');
  const allSocialLinks = [
    form.linkedinUrl, form.websiteUrl, form.twitterUrl, form.youtubeUrl,
    form.behanceUrl, form.dribbbleUrl, form.instagramUrl, form.researchGateUrl, form.mediumUrl,
    profile?.githubUrl,
  ];
  const hasAnySocialLink = allSocialLinks.some((url) => Boolean((url ?? '').trim()));
  const completionItems = [
    Boolean(form.displayName.trim()),
    Boolean(form.bio.trim()),
    Boolean(form.domain.trim()),
    Boolean(form.avatar.trim() || profile?.avatar),
    hasAnySocialLink,
  ];
  const completionPct = Math.round((completionItems.filter(Boolean).length / completionItems.length) * 100);
  const publicProfileUrl =
    profile?.profileSlug && typeof window !== 'undefined'
      ? `${window.location.origin}/students/${profile.profileSlug}`
      : '';
  const isBusy =
    updateMutation.isPending ||
    socialMutation.isPending ||
    startGithubMutation.isPending ||
    syncGithubMutation.isPending ||
    importGithubMutation.isPending ||
    submitInstitutionTokenMutation.isPending;

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await updateMutation.mutateAsync({
      displayName: form.displayName.trim(),
      avatar: form.avatar.trim() || '',
      bio: form.bio.trim() || '',
      domain: form.domain.trim() || '',
      linkedinUrl: form.linkedinUrl.trim() || '',
      websiteUrl: form.websiteUrl.trim() || '',
      twitterUrl: form.twitterUrl.trim() || '',
      youtubeUrl: form.youtubeUrl.trim() || '',
      behanceUrl: form.behanceUrl.trim() || '',
      dribbbleUrl: form.dribbbleUrl.trim() || '',
      instagramUrl: form.instagramUrl.trim() || '',
      researchGateUrl: form.researchGateUrl.trim() || '',
      mediumUrl: form.mediumUrl.trim() || '',
      discoverableToRecruiters: currentUser.role === UserRole.STUDENT ? form.discoverableToRecruiters : undefined,
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
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex items-center gap-5">
              <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-500 text-2xl font-bold text-white">
                {profile?.avatar ? <img src={profile.avatar} alt={profile.displayName} className="h-24 w-24 rounded-3xl object-cover" /> : initials}
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
                  <span className="inline-flex items-center gap-2"><Mail className="h-4 w-4 text-cyan-300" />{profile?.email}</span>
                  <span className="inline-flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan-300" />Score: {profile?.innovationScore ?? 0}</span>
                  <span className="inline-flex items-center gap-2"><CalendarDays className="h-4 w-4 text-cyan-300" />Joined {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-IN') : 'recently'}</span>
                  <span className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-cyan-300" />{profile?.accessGrantedBy ?? 'self_registered'}</span>
                  {profile?.githubUrl ? <a href={profile.githubUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"><Github className="h-4 w-4" />GitHub<ExternalLink className="h-3 w-3" /></a> : null}
                  {profile?.linkedinUrl ? <a href={profile.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-cyan-300 hover:text-cyan-200"><Linkedin className="h-4 w-4" />LinkedIn<ExternalLink className="h-3 w-3" /></a> : null}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-5 py-4 text-center">
              <div className="text-2xl font-bold text-white">{completionPct}%</div>
              <div className="text-xs text-slate-500">Profile filled</div>
            </div>
          </div>
        </div>
      </Card>

      {currentUser.role === UserRole.STUDENT ? (
        <Card className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Institution Verification</div>
              <h2 className="mt-2 text-xl font-semibold text-white">
                {profile?.verificationStatus === 'verified'
                  ? 'Verified and share-ready'
                  : profile?.verificationStatus === 'pending'
                    ? 'Waiting for institution review'
                    : profile?.verificationStatus === 'rejected'
                      ? 'Verification was rejected'
                      : 'Submit your institution token'}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                {profile?.verificationStatus === 'verified'
                  ? 'Your school or college has verified this account. Once your profile is complete, the public link is live.'
                  : profile?.verificationStatus === 'pending'
                    ? 'Your institution token is on file. A school or college reviewer must approve the account before the public profile can be shared.'
                    : profile?.verificationStatus === 'rejected'
                      ? profile?.verificationRejectedReason ?? 'This account was rejected by the institution reviewer. Contact your institution for support.'
                      : 'Complete your profile first, then submit the token shared by your school or college to move into the verification queue.'}
              </p>
              {profile?.verificationStatus === 'pending' && profile?.verificationRequestedAt ? (
                <div className="mt-3 text-sm text-slate-500">
                  Submitted {new Date(profile.verificationRequestedAt).toLocaleString('en-IN')}
                </div>
              ) : null}
              {profile?.verificationStatus === 'verified' && publicProfileUrl ? (
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={publicProfileUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-400 hover:text-cyan-100"
                  >
                    Open Public Profile
                    <ExternalLink className="h-4 w-4" />
                  </a>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      navigator.clipboard
                        .writeText(publicProfileUrl)
                        .then(() => setToast('Public profile link copied.'))
                        .catch(() => setToast('Unable to copy the public profile link.'))
                    }
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Share Link
                  </Button>
                </div>
              ) : null}
            </div>

            {profile?.verificationStatus === 'not_required' ? (
              <form
                className="w-full max-w-md space-y-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (!institutionToken.trim()) {
                    setToast('Enter the institution token provided by your school or college.');
                    return;
                  }

                  submitInstitutionTokenMutation.mutate(institutionToken.trim());
                }}
              >
                <input
                  type="text"
                  value={institutionToken}
                  onChange={(event) => setInstitutionToken(event.target.value)}
                  className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500"
                  placeholder="COL-AB12CD34"
                />
                <Button type="submit" disabled={submitInstitutionTokenMutation.isPending || !profile?.profileComplete}>
                  {submitInstitutionTokenMutation.isPending ? 'Submitting...' : 'Submit Institution Token'}
                </Button>
                {!profile?.profileComplete ? (
                  <div className="text-xs text-amber-300">
                    Finish your profile before requesting institution verification.
                  </div>
                ) : null}
              </form>
            ) : null}
          </div>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">{roleMeta.title}</h2>
              <p className="mt-1 text-sm text-slate-400">Update the identity shown across ProMove.</p>
            </div>
            <Button variant="ghost" onClick={() => profileQuery.refetch()} disabled={profileQuery.isFetching || isBusy}>
              <RefreshCw className={`mr-2 h-4 w-4 ${profileQuery.isFetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          <form className="space-y-4" onSubmit={saveProfile}>
            <div className="grid gap-4 sm:grid-cols-2">
              <input value={form.displayName} onChange={(event) => setForm((current) => ({ ...current, displayName: event.target.value }))} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500" placeholder="Display name" />
              <input value={form.domain} onChange={(event) => setForm((current) => ({ ...current, domain: event.target.value }))} className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500" placeholder="Domain / focus area" />
            </div>
            <input value={form.avatar} onChange={(event) => setForm((current) => ({ ...current, avatar: event.target.value }))} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500" placeholder="Avatar URL" />
            <textarea value={form.bio} onChange={(event) => setForm((current) => ({ ...current, bio: event.target.value }))} className="min-h-32 w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-white outline-none focus:border-cyan-500" placeholder="Bio" />
            {currentUser.role === UserRole.STUDENT ? (
              <label className="flex items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950 p-4">
                <input type="checkbox" checked={form.discoverableToRecruiters} onChange={(event) => setForm((current) => ({ ...current, discoverableToRecruiters: event.target.checked }))} className="mt-1 h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500" />
                <div>
                  <div className="font-semibold text-white">Visible to recruiters</div>
                  <div className="mt-1 text-sm text-slate-400">Let recruiter workflows surface your profile when your score and proof signal fit.</div>
                </div>
              </label>
            ) : null}
            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy}>{updateMutation.isPending ? 'Saving...' : 'Save Profile'}</Button>
            </div>
          </form>
        </Card>

        <Card className="p-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-white">Profile Links</h3>
            <p className="mt-1 text-sm text-slate-400">Add links relevant to your background — fill in what applies to you.</p>
          </div>

          <form className="space-y-3" onSubmit={saveProfile}>
            {/* LinkedIn + fetch */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><Linkedin className="h-4 w-4 text-cyan-300" />LinkedIn</div>
              <input type="url" value={form.linkedinUrl} onChange={(event) => setForm((current) => ({ ...current, linkedinUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://linkedin.com/in/your-profile" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={confirmLinkedinFetch} onChange={(event) => setConfirmLinkedinFetch(event.target.checked)} className="h-4 w-4 rounded border-slate-600 bg-slate-900 text-cyan-500 focus:ring-cyan-500" />
                  Import public LinkedIn data
                </label>
                <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => socialMutation.mutate({ ...(form.linkedinUrl.trim() ? { linkedinUrl: form.linkedinUrl.trim(), confirmLinkedinFetch } : {}) })} disabled={isBusy || !form.linkedinUrl.trim()}>
                  {socialMutation.isPending ? 'Fetching...' : 'Fetch'}
                </Button>
              </div>
            </div>

            {/* Website */}
            <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><Globe className="h-4 w-4 text-cyan-300" />Personal Website / Portfolio</div>
              <input type="url" value={form.websiteUrl} onChange={(event) => setForm((current) => ({ ...current, websiteUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://yourportfolio.com" />
            </label>

            {/* Twitter/X */}
            <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-white"><Twitter className="h-4 w-4 text-cyan-300" />Twitter / X</div>
              <input type="url" value={form.twitterUrl} onChange={(event) => setForm((current) => ({ ...current, twitterUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://twitter.com/yourhandle" />
            </label>

            {/* Creative platforms row */}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4 text-cyan-300" />Behance
                </div>
                <input type="url" value={form.behanceUrl} onChange={(event) => setForm((current) => ({ ...current, behanceUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://behance.net/you" />
              </label>
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4 text-cyan-300" />Dribbble
                </div>
                <input type="url" value={form.dribbbleUrl} onChange={(event) => setForm((current) => ({ ...current, dribbbleUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://dribbble.com/you" />
              </label>
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Youtube className="h-4 w-4 text-cyan-300" />YouTube
                </div>
                <input type="url" value={form.youtubeUrl} onChange={(event) => setForm((current) => ({ ...current, youtubeUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://youtube.com/@yourchannel" />
              </label>
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Instagram className="h-4 w-4 text-cyan-300" />Instagram
                </div>
                <input type="url" value={form.instagramUrl} onChange={(event) => setForm((current) => ({ ...current, instagramUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://instagram.com/yourhandle" />
              </label>
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4 text-cyan-300" />ResearchGate
                </div>
                <input type="url" value={form.researchGateUrl} onChange={(event) => setForm((current) => ({ ...current, researchGateUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://researchgate.net/profile/you" />
              </label>
              <label className="block rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-white">
                  <Link2 className="h-4 w-4 text-cyan-300" />Medium / Blog
                </div>
                <input type="url" value={form.mediumUrl} onChange={(event) => setForm((current) => ({ ...current, mediumUrl: event.target.value }))} className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-cyan-500" placeholder="https://medium.com/@you" />
              </label>
            </div>

            {/* GitHub — optional, only shown when OAuth is available for this role */}
            {githubEnabled ? (
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-white">
                    <Github className="h-4 w-4 text-cyan-300" />GitHub
                    {githubConnected ? (
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-300">Connected</span>
                    ) : (
                      <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs text-slate-400">Optional</span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {githubOauthAvailable ? (
                      <Button variant="secondary" className="px-3 py-2 text-xs" onClick={() => startGithubMutation.mutate(undefined)} disabled={startGithubMutation.isPending}>
                        {startGithubMutation.isPending ? 'Redirecting...' : githubConnected ? 'Reconnect' : 'Connect GitHub'}
                      </Button>
                    ) : null}
                    {githubConnected ? (
                      <Button className="px-3 py-2 text-xs" onClick={() => syncGithubMutation.mutate(undefined)} disabled={syncGithubMutation.isPending}>
                        {syncGithubMutation.isPending ? 'Refreshing...' : 'Sync Repos'}
                      </Button>
                    ) : null}
                  </div>
                </div>
                {githubConnected ? (
                  <div className="text-xs text-slate-500">
                    @{profile?.connectedAccounts?.github.username} · {importedRepos.length} repos imported · Last sync {profile?.githubProof?.lastSyncedAt ? new Date(profile.githubProof.lastSyncedAt).toLocaleString('en-IN') : 'never'}
                  </div>
                ) : !githubOauthAvailable ? (
                  <div className="text-xs text-slate-500">GitHub OAuth is unavailable in this environment.</div>
                ) : (
                  <div className="text-xs text-slate-500">Connect to import repositories and auto-populate skills from your code activity.</div>
                )}
                {githubConnected && repoChoices.length > 0 ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">Select repos to import as proof</span>
                      <Button className="px-3 py-2 text-xs" onClick={() => importGithubMutation.mutate(selectedRepoIds)} disabled={importGithubMutation.isPending || selectedRepoIds.length === 0}>
                        {importGithubMutation.isPending ? 'Importing...' : 'Save'}
                      </Button>
                    </div>
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                      {repoChoices.map((repo) => (
                        <RepoRow key={repo.repoId} repo={repo} checked={selectedRepoIds.includes(repo.repoId)} onToggle={() => setSelectedRepoIds((current) => current.includes(repo.repoId) ? current.filter((value) => value !== repo.repoId) : [...current, repo.repoId])} />
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button type="submit" disabled={isBusy}>{updateMutation.isPending ? 'Saving...' : 'Save Links'}</Button>
            </div>
          </form>
        </Card>
      </div>

      {githubEnabled && githubConnected ? (
        <div className="grid gap-6 xl:grid-cols-[1.1fr,0.9fr]">
          <Card className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white">Imported Repositories</h3>
                <p className="mt-1 text-sm text-slate-400">These repos now act as proof artifacts on your profile.</p>
              </div>
              <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-300">{importedRepos.length} imported</span>
            </div>
            {importedRepos.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-800 bg-slate-950 p-6 text-sm text-slate-400">
                Import the repositories that best prove what you actually build.
              </div>
            ) : (
              <div className="space-y-4">
                {importedRepos.map((repo) => (
                  <div key={repo.repoId} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <a href={repo.url} target="_blank" rel="noreferrer" className="font-semibold text-white hover:text-cyan-300">{repo.fullName}</a>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${repo.isPrivate ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                        {repo.isPrivate ? 'Private proof' : 'Public'}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-400">{repo.description || 'No description added.'}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      {repo.primaryLanguage ? <span>{repo.primaryLanguage}</span> : null}
                      <span>Stars {repo.stars}</span>
                      <span>Forks {repo.forks}</span>
                      <span>Open issues {repo.openIssues}</span>
                    </div>
                    <div className="mt-4 space-y-2">
                      {repo.recentCommits.slice(0, 3).map((commit) => (
                        <div key={commit.sha} className="flex items-start gap-3 rounded-xl bg-slate-900/70 px-3 py-3">
                          <GitCommitHorizontal className="mt-0.5 h-4 w-4 flex-shrink-0 text-cyan-300" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm text-white">{commit.message}</div>
                            <div className="mt-1 text-xs text-slate-500">{commit.sha.slice(0, 7)} • {new Date(commit.committedAt).toLocaleString('en-IN')}</div>
                          </div>
                        </div>
                      ))}
                      {repo.recentCommits.length === 0 ? <div className="text-sm text-slate-500">No recent commits available.</div> : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="space-y-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white">GitHub Profile Enrichment</h3>
              <p className="mt-1 text-sm text-slate-400">
                These skills and technologies are extracted from your connected GitHub account and shown on your student profile.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-2xl bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Tech Signals</div>
                  <div className="mt-2 text-2xl font-bold text-white">{githubTopLanguages.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">GitHub Skills</div>
                  <div className="mt-2 text-2xl font-bold text-white">{githubSkills.length}</div>
                </div>
                <div className="rounded-2xl bg-slate-950 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Profile Projects</div>
                  <div className="mt-2 text-2xl font-bold text-white">{githubProjects.length}</div>
                </div>
              </div>
              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Extracted Tech Stack</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {githubTopLanguages.map((entry) => (
                    <span key={entry.language} className="rounded-full bg-cyan-500/10 px-3 py-1 text-sm text-cyan-200">
                      {entry.language} {entry.percentage > 0 ? `${entry.percentage}%` : ''}
                    </span>
                  ))}
                  {githubTopLanguages.length === 0 ? (
                    <div className="text-sm text-slate-400">No language signal extracted yet.</div>
                  ) : null}
                </div>
              </div>
              <div className="mt-5">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">GitHub-Derived Skills</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {githubSkills.slice(0, 12).map((skill) => (
                    <span key={`${skill.name}-${skill.source}`} className="rounded-full bg-slate-900 px-3 py-1 text-sm text-slate-200">
                      {skill.name}
                    </span>
                  ))}
                  {githubSkills.length === 0 ? (
                    <div className="text-sm text-slate-400">Connect and sync GitHub to populate profile skills automatically.</div>
                  ) : null}
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white">GitHub Activity</h3>
              <p className="mt-1 text-sm text-slate-400">A 30-day proof snapshot from the connected account.</p>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-slate-950 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Commits</div><div className="mt-2 text-2xl font-bold text-white">{profile?.githubProof?.commitCount30Days ?? 0}</div></div>
                <div className="rounded-2xl bg-slate-950 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Active Days</div><div className="mt-2 text-2xl font-bold text-white">{profile?.githubProof?.activeDays30Days ?? 0}</div></div>
                <div className="rounded-2xl bg-slate-950 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Push Events</div><div className="mt-2 text-2xl font-bold text-white">{profile?.githubProof?.pushEvents30Days ?? 0}</div></div>
                <div className="rounded-2xl bg-slate-950 p-4"><div className="text-xs uppercase tracking-[0.2em] text-slate-500">Pull Requests</div><div className="mt-2 text-2xl font-bold text-white">{profile?.githubProof?.pullRequests30Days ?? 0}</div></div>
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold text-white">Recent GitHub Activity</h3>
              <div className="mt-4 space-y-3">
                {(profile?.githubProof?.recentActivity ?? []).slice(0, 6).map((activity) => (
                  <div key={activity.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
                    <div className="font-semibold text-white">{activity.title}</div>
                    <div className="mt-1 text-sm text-slate-400">{activity.summary}</div>
                    <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500">
                      <span>{activity.repoFullName}</span>
                      <span>{activity.isPrivate ? 'Private activity' : 'Public activity'}</span>
                      <span>{new Date(activity.occurredAt).toLocaleString('en-IN')}</span>
                    </div>
                  </div>
                ))}
                {(profile?.githubProof?.recentActivity ?? []).length === 0 ? <div className="text-sm text-slate-400">No recent GitHub activity captured yet.</div> : null}
              </div>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}
