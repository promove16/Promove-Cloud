import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Lock, Mail, Rocket } from 'lucide-react';
import { isAxiosError } from 'axios';
import { RoleSelector } from './RoleSelector';
import { useLoginMutation } from './useAuth';
import { UserRole } from '../../types/roles.types';
import { roleRedirect } from '../../utils/roleRedirect';

export function LoginPage() {
  const navigate = useNavigate();
  const loginMutation = useLoginMutation();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    try {
      const payload = await loginMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
        role: selectedRole,
      });

      navigate(roleRedirect(payload.user.role), { replace: true });
    } catch (submissionError) {
      if (isAxiosError(submissionError)) {
        const apiError = submissionError.response?.data?.error;

        if (apiError?.code === 'ROLE_MISMATCH') {
          setError(apiError.message);
          return;
        }

        setError(apiError?.message ?? 'Unable to sign in right now.');
        return;
      }

      setError('Unable to sign in right now.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl items-center justify-center">
        <div className="w-full">
          <div className="mb-12 text-center">
            <Link to="/" className="mb-4 inline-flex items-center justify-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
                <Rocket className="h-7 w-7 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-white">ProMove</div>
                <div className="text-xs text-slate-400">Innovation Cloud</div>
              </div>
            </Link>
            <h1 className="mb-2 text-3xl font-bold text-white">Welcome Back</h1>
            <p className="text-slate-400">Sign in to your account</p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="mb-8 rounded-2xl border border-slate-800 bg-slate-900 p-8"
          >
            <div className="mb-6">
              <label className="mb-2 block text-sm font-semibold text-white">Email Address</label>
              <div className="relative mb-4">
                <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  value={formData.email}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, email: event.target.value }))
                  }
                  placeholder="your@email.com"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>

              <label className="mb-2 block text-sm font-semibold text-white">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  value={formData.password}
                  onChange={(event) =>
                    setFormData((current) => ({ ...current, password: event.target.value }))
                  }
                  placeholder="••••••••"
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="mb-3 block text-sm font-semibold text-white">
                Select Your Role
              </label>
              <RoleSelector value={selectedRole} onChange={setSelectedRole} />
            </div>

            {error ? (
              <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loginMutation.isPending}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-12 py-4 font-semibold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-70"
            >
              {loginMutation.isPending ? 'Signing In...' : 'Sign In'}
            </button>
          </form>

          <div className="text-center">
            <p className="text-sm text-slate-500">
              Don&apos;t have an account?{' '}
              <Link to="/signup" className="font-semibold text-blue-500 hover:text-blue-400">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
