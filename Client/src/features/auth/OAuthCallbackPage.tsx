import { useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Chrome, Linkedin, LoaderCircle, Rocket, ShieldAlert } from 'lucide-react';
import { refreshClient } from '../../api/axiosInstance';
import { useAuthStore } from '../../store/authStore';
import { ApiSuccessResponse, AuthPayload } from '../../types/auth.types';
import { roleRedirect } from '../../utils/roleRedirect';
import { buildOAuthStartUrl, getOAuthErrorMessage, OAuthProvider, OAUTH_PROVIDER_LABELS } from './oauth';

const isOAuthProvider = (value: string | null): value is OAuthProvider =>
  value === 'google' || value === 'linkedin';

export function OAuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [error, setError] = useState('');

  const providerParam = searchParams.get('provider');
  const provider = isOAuthProvider(providerParam) ? providerParam : null;

  const providerLabel = provider ? OAUTH_PROVIDER_LABELS[provider] : 'OAuth';
  const queryStatus = searchParams.get('status');
  const queryCode = searchParams.get('code');
  const queryMessage = searchParams.get('message');

  useEffect(() => {
    let active = true;

    const completeSignIn = async () => {
      if (queryStatus !== 'success') {
        if (active) {
          setStatus('error');
          setError(getOAuthErrorMessage(provider, queryCode, queryMessage));
        }
        return;
      }

      try {
        const response = await refreshClient.post<ApiSuccessResponse<AuthPayload>>(
          '/api/auth/refresh',
        );
        const payload = response.data.data;

        if (!active) {
          return;
        }

        setAuth(payload.user, payload.accessToken);
        navigate(roleRedirect(payload.user.role), { replace: true });
      } catch (submissionError) {
        if (!active) {
          return;
        }

        setStatus('error');

        if (isAxiosError(submissionError)) {
          const apiError = submissionError.response?.data?.error;
          setError(
            getOAuthErrorMessage(provider, apiError?.code, apiError?.message) ||
              `We could not complete ${providerLabel} sign-in.`,
          );
          return;
        }

        setError(`We could not complete ${providerLabel} sign-in.`);
      }
    };

    void completeSignIn();

    return () => {
      active = false;
    };
  }, [navigate, provider, providerLabel, queryCode, queryMessage, queryStatus, setAuth]);

  const retryUrl = provider ? buildOAuthStartUrl(provider) : '/login';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900/90 p-8 shadow-2xl shadow-slate-950/40">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
            <Rocket className="h-7 w-7 text-white" />
          </div>
          <div>
            <div className="text-2xl font-bold text-white">ProMove</div>
            <div className="text-xs text-slate-400">Innovation Cloud</div>
          </div>
        </div>

        {status === 'loading' ? (
          <div className="space-y-4 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-slate-800 bg-slate-950">
              <LoaderCircle className="h-8 w-8 animate-spin text-cyan-300" />
            </div>
            <h1 className="text-2xl font-bold text-white">Completing {providerLabel} sign-in</h1>
            <p className="text-sm text-slate-400">
              We&apos;re verifying your account and restoring your ProMove session.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-5">
              <div className="mb-3 flex items-center gap-3 text-red-300">
                <ShieldAlert className="h-5 w-5" />
                <h1 className="text-xl font-semibold">Sign-in could not be completed</h1>
              </div>
              <p className="text-sm text-red-100/90">{error}</p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-sm text-slate-300">
              If you already have a ProMove account, you can retry with the same provider or go back
              to email and password login.
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {provider ? (
                <a
                  href={retryUrl}
                  className="inline-flex items-center justify-center gap-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-sm font-semibold text-white transition hover:from-blue-700 hover:to-purple-700"
                >
                  {provider === 'google' ? (
                    <Chrome className="h-5 w-5" />
                  ) : (
                    <Linkedin className="h-5 w-5" />
                  )}
                  Retry with {providerLabel}
                </a>
              ) : null}
              <Link
                to="/login"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Login
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
