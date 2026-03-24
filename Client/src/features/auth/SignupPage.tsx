import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Lock,
  Mail,
  Rocket,
  Ticket,
  UserCircle,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { RoleSelector } from './RoleSelector';
import { useSignupMutation } from './useAuth';
import { UserRole } from '../../types/roles.types';
import { roleRedirect } from '../../utils/roleRedirect';

export function SignupPage() {
  const navigate = useNavigate();
  const signupMutation = useSignupMutation();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    accessCode: '',
    institution: '',
  });
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (!selectedRole) {
      setError('Please select a role');
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    try {
      const payload = await signupMutation.mutateAsync({
        displayName: formData.displayName,
        email: formData.email,
        password: formData.password,
        role: selectedRole,
        accessCode: formData.accessCode,
      });

      navigate(roleRedirect(payload.user.role), { replace: true });
    } catch (submissionError) {
      if (isAxiosError(submissionError)) {
        const apiError = submissionError.response?.data?.error;
        setError(
          apiError?.code === 'CAPACITY_REACHED'
            ? 'Platform is at capacity for Year 1. Please join the waitlist.'
            : apiError?.message ?? 'Unable to create your account right now.',
        );
        return;
      }

      setError('Unable to create your account right now.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="mx-auto w-full max-w-4xl py-8">
        <div className="mb-8 text-center">
          <Link to="/" className="mb-6 inline-flex items-center justify-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600">
              <Rocket className="h-7 w-7 text-white" />
            </div>
            <div>
              <div className="text-2xl font-bold text-white">ProMove</div>
              <div className="text-xs text-slate-400">Innovation Cloud</div>
            </div>
          </Link>
          <h1 className="mb-2 text-3xl font-bold text-white">Create Your Account</h1>
          <p className="text-slate-400">Join the global innovation ecosystem</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-800 bg-slate-900 p-8">
          <div className="mb-6">
            <h2 className="mb-4 text-xl font-bold text-white">Personal Information</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Display Name <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <UserCircle className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={formData.displayName}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, displayName: event.target.value }))
                    }
                    placeholder="Sarah Chen"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Email Address <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="sarah@university.edu"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-white">
              Institution / Organization (Optional)
            </label>
            <div className="relative">
              <GraduationCap className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.institution}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, institution: event.target.value }))
                }
                placeholder="Stanford University"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="mb-6">
            <label className="mb-2 block text-sm font-semibold text-white">
              Access Code <span className="text-red-400">*</span>
            </label>
            <div className="relative">
              <Ticket className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={formData.accessCode}
                onChange={(event) =>
                  setFormData((current) => ({ ...current, accessCode: event.target.value }))
                }
                placeholder="STARTUP_SCHOOL"
                className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                required
              />
            </div>
          </div>

          <div className="mb-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Password <span className="text-red-400">*</span>
                </label>
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
                    minLength={8}
                  />
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-white">
                  Confirm Password <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="password"
                    value={formData.confirmPassword}
                    onChange={(event) =>
                      setFormData((current) => ({ ...current, confirmPassword: event.target.value }))
                    }
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-slate-800 bg-slate-950 py-3 pl-12 pr-4 text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none"
                    required
                    minLength={8}
                  />
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Password must be at least 8 characters long
            </p>
          </div>

          <div className="mb-6">
            <label className="mb-3 block text-sm font-semibold text-white">
              Select Your Role <span className="text-red-400">*</span>
            </label>
            <RoleSelector value={selectedRole} onChange={setSelectedRole} />
          </div>

          <div className="mb-6">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                required
                className="mt-1 h-4 w-4 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-slate-400">
                I agree to the{' '}
                <span className="font-semibold text-blue-500">Terms of Service</span> and{' '}
                <span className="font-semibold text-blue-500">Privacy Policy</span>
              </span>
            </label>
          </div>

          {error ? (
            <div className="mb-6 rounded-lg border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={signupMutation.isPending}
            className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-4 text-lg font-semibold text-white transition-all hover:from-blue-700 hover:to-purple-700 disabled:opacity-70"
          >
            {signupMutation.isPending ? 'Creating Account...' : 'Create Account'}
          </button>

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-blue-500 hover:text-blue-400">
              Sign in
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
