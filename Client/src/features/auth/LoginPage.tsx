import { FormEvent, useState } from 'react';
import { isAxiosError } from 'axios';
import { Lock, Mail } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BusinessLogo } from '../../components/branding/BusinessLogo';
import { useLoginMutation } from './useAuth';
import { getPostLoginRedirect } from '../../utils/postLoginRedirect';

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    try {
      const payload = await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
      });

      navigate(getPostLoginRedirect(payload.user), { replace: true });
    } catch (submissionError) {
      if (isAxiosError(submissionError)) {
        const apiError = submissionError.response?.data?.error;

        if (apiError?.code === 'ADMIN_APPROVAL_PENDING') {
          setError('Your registration request is still waiting for admin approval.');
          return;
        }

        if (apiError?.code === 'ADMIN_APPROVAL_REJECTED') {
          setError(
            apiError.message ||
              'Your registration request was rejected. Please contact the ProMove admin team.',
          );
          return;
        }

        if (apiError?.code === 'INSTITUTION_APPROVAL_PENDING') {
          setError('Your institution has not approved your student account yet.');
          return;
        }

        setError(apiError?.message ?? 'Unable to sign in right now.');
        return;
      }

      setError('Unable to sign in right now.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-6 py-10">
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-12 text-center">
          <BusinessLogo
            to="/"
            className="mb-6"
            titleClassName="text-3xl text-white"
            subtitleClassName="text-slate-400"
          />
          <h1 className="text-5xl font-bold tracking-tight text-white">Welcome Back</h1>
          <p className="mt-3 text-xl text-slate-400">Sign in to your account</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur"
        >
          <div className="mb-6">
            <label className="mb-3 block text-lg font-semibold text-white">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="email"
                value={formData.email}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, email: event.target.value }))
                }
                placeholder="your@email.com"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-4 pl-14 pr-4 text-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="mb-8">
            <label className="mb-3 block text-lg font-semibold text-white">Password</label>
            <div className="relative">
              <Lock className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                value={formData.password}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, password: event.target.value }))
                }
                placeholder="••••••••"
                className="w-full rounded-xl border border-slate-800 bg-slate-950 py-4 pl-14 pr-4 text-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          {error ? (
            <div className="mb-6 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-4 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-70"
          >
            {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center">
          <p className="text-lg text-slate-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-semibold text-blue-500 hover:text-blue-400">
              Sign Up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
