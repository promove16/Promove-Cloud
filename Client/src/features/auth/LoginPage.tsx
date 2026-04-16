import { useState } from 'react';
import { isAxiosError } from 'axios';
import { CircleAlert, Lock, Mail } from 'lucide-react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { BusinessLogo } from '../../components/branding/BusinessLogo';
import { AuthPasswordField } from './AuthPasswordField';
import { useLoginMutation } from './useAuth';
import { getPostLoginRedirect } from '../../utils/postLoginRedirect';
import { sanitizeNextPath } from '../../utils/authRedirect';

const loginSchema = z.object({
  email: z.string().trim().min(1, 'Email is required.').email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const getLoginNotice = (message: string | null, intent: string | null) => {
  if (message === 'session_expired') {
    return {
      title: 'Session expired',
      description: 'Sign in again to continue from where you left off.',
    };
  }

  if (message !== 'auth_required') {
    return null;
  }

  if (intent === 'submit_problem') {
    return {
      title: 'Sign in to submit a problem',
      description: 'Problem submission is available inside the protected Problem Bank workspace.',
    };
  }

  return {
    title: 'Sign in required',
    description: 'This area is available after you sign in to your ProMove account.',
  };
};

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const loginMutation = useLoginMutation();
  const [error, setError] = useState('');
  const loginNotice = getLoginNotice(searchParams.get('message'), searchParams.get('intent'));
  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    setError('');

    try {
      const payload = await loginMutation.mutateAsync({
        email: values.email.trim(),
        password: values.password,
      });

      navigate(
        sanitizeNextPath(searchParams.get('next')) ?? getPostLoginRedirect(payload.user),
        { replace: true },
      );
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
          setError(
            'Your school or college has not approved your student account yet. This step is handled by the institution, not the platform admin.',
          );
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

        {loginNotice ? (
          <div
            role="alert"
            className="mb-6 grid grid-cols-[auto_1fr] gap-x-3 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-cyan-50"
          >
            <CircleAlert className="mt-0.5 h-4 w-4" />
            <div>
              <div className="font-semibold text-cyan-50">{loginNotice.title}</div>
              <p className="mt-1 text-sm text-cyan-100/90">{loginNotice.description}</p>
            </div>
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit(onSubmit)}
          noValidate
          className="rounded-[28px] border border-slate-800 bg-slate-900/80 p-8 shadow-[0_30px_80px_rgba(2,6,23,0.45)] backdrop-blur"
        >
          <div className="mb-6">
            <label htmlFor="login-email" className="mb-3 block text-lg font-semibold text-white">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                id="login-email"
                type="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="name@example.com"
                className={`w-full rounded-xl border bg-slate-950 py-4 pl-14 pr-4 text-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                  errors.email ? 'border-red-500/70' : 'border-slate-800'
                }`}
                {...register('email')}
              />
            </div>
            {errors.email ? <p className="mt-2 text-sm text-red-500">{errors.email.message}</p> : null}
          </div>

          <Controller
            name="password"
            control={control}
            render={({ field }) => (
              <div className="mb-8">
                <AuthPasswordField
                  id="login-password"
                  label="Password"
                  icon={Lock}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  name={field.name}
                  placeholder="Enter your password"
                  inputClassName={`w-full rounded-xl border bg-slate-950 py-4 pl-14 pr-14 text-lg text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none ${
                    errors.password ? 'border-red-500/70' : 'border-slate-800'
                  }`}
                  autoComplete="current-password"
                />
                {errors.password ? (
                  <p className="mt-2 text-sm text-red-500">{errors.password.message}</p>
                ) : null}
              </div>
            )}
          />

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
