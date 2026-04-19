import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { BadgeCheck, Github, Sparkles, X } from 'lucide-react';
import { userApi } from '../../api/user.api';
import { Button } from '../ui/Button';
import { useAuthStore } from '../../store/authStore';

const getDismissKey = (userId: string) => `promove-student-proof-dismissed:${userId}`;

export function StudentGithubProofPrompt() {
  const authUser = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [toast, setToast] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!authUser?._id) {
      setDismissed(false);
      return;
    }

    setDismissed(localStorage.getItem(getDismissKey(authUser._id)) === 'true');
  }, [authUser?._id]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(''), 3000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const refreshUserMutation = useMutation({
    mutationFn: userApi.getMe,
    onSuccess: (user) => {
      setUser(user);
      queryClient.setQueryData(['profile', 'me'], user);
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
    },
  });

  useEffect(() => {
    const githubStatus = searchParams.get('github');
    if (!githubStatus) return;

    if (githubStatus === 'connected') {
      setToast('GitHub connected. Your profile can now use your repos, skills, and activity.');
      void refreshUserMutation.mutateAsync();
    } else if (githubStatus === 'error') {
      setToast(searchParams.get('message') ?? 'GitHub connection failed.');
    }

    const next = new URLSearchParams(searchParams);
    next.delete('github');
    next.delete('message');
    setSearchParams(next, { replace: true });
  }, [refreshUserMutation, searchParams, setSearchParams]);

  const startGithubMutation = useMutation({
    mutationFn: () => userApi.startGithubOauth('/portfolio'),
    onSuccess: ({ authorizationUrl }) => {
      window.location.assign(authorizationUrl);
    },
    onError: (error) => {
      setToast(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message ??
          'Unable to start GitHub sign-in right now.',
      );
    },
  });

  const shouldShow = useMemo(() => {
    if (!authUser?._id) return false;
    if (authUser.role !== 'student') return false;
    if (!authUser.githubOAuthAvailable) return false;
    if (authUser.verificationStatus !== 'verified') return false;
    if (authUser.connectedAccounts?.github?.userId) return false;
    if (dismissed) return false;
    return searchParams.get('onboarding') === 'proof';
  }, [authUser, dismissed, searchParams]);

  if (!shouldShow || !authUser?._id) {
    return toast ? (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
        {toast}
      </div>
    ) : null;
  }

  return (
    <div className="rounded-3xl border border-cyan-800/40 bg-gradient-to-br from-slate-900 via-cyan-950/20 to-slate-900 p-6">
      {toast ? (
        <div className="mb-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 px-4 py-3 text-sm text-cyan-200">
          {toast}
        </div>
      ) : null}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.2em] text-cyan-300">
            <BadgeCheck className="h-4 w-4" />
            Institution Verified
          </div>
          <h2 className="mt-3 text-2xl font-bold text-white">Add proof, not just profile data</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-300">
            Your school or college has approved your account. If your work has a technical footprint, connect GitHub now so ProMove can link your profile, extract your tech stack, and pull repositories and activity into your student profile.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(getDismissKey(authUser._id), 'true');
            setDismissed(true);
          }}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300"
          aria-label="Skip GitHub proof for now"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr,0.8fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Github className="h-4 w-4 text-cyan-300" />
            Link GitHub To Your Profile
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Connect GitHub, then ProMove will sync your languages, GitHub-based skills, repositories, and recent activity so your student profile shows what you actually build.
          </p>
        </div>
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Sparkles className="h-4 w-4 text-cyan-300" />
            Skip If Needed
          </div>
          <p className="mt-2 text-sm text-slate-400">
            Not every startup is code-first. You can continue with manual profile, projects, market proof, and leadership signals instead.
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Button onClick={() => startGithubMutation.mutate(undefined)} disabled={startGithubMutation.isPending || refreshUserMutation.isPending}>
          {startGithubMutation.isPending ? 'Redirecting...' : 'Connect GitHub'}
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            localStorage.setItem(getDismissKey(authUser._id), 'true');
            setDismissed(true);
          }}
        >
          Continue Without GitHub
        </Button>
      </div>
    </div>
  );
}
