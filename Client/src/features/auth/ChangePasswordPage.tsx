import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound } from 'lucide-react';
import api from '../../api/axiosInstance';
import { useAuthStore } from '../../store/authStore';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ApiSuccessResponse } from '../../types/auth.types';
import { roleRedirect } from '../../utils/roleRedirect';
import { AuthPasswordField } from './AuthPasswordField';

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuthStore();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }

    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      await api.put<ApiSuccessResponse<{ message: string }>>('/api/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });

      if (user) {
        setUser({ ...user, mustChangePasswordOnNextLogin: false });
      }

      navigate(user ? roleRedirect(user.role) : '/login', { replace: true });
    } catch (err) {
      const apiError = (err as { response?: { data?: { error?: { message?: string } } } })
        ?.response?.data?.error;
      setError(apiError?.message ?? 'Failed to change password. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputCls =
    'w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-3 text-white placeholder-slate-500 focus:border-cyan-500 focus:outline-none text-sm';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
          <KeyRound className="h-6 w-6 text-cyan-300" />
        </div>

        <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Security</div>
        <h1 className="mt-2 text-2xl font-bold text-white">Change your password</h1>
        <p className="mt-2 text-sm text-slate-400">
          Your account was created with a temporary password. Please set a new password to continue.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <AuthPasswordField
            label="Current (temporary) password"
            value={form.currentPassword}
            onChange={(e) => setForm((c) => ({ ...c, currentPassword: e.target.value }))}
            placeholder="Enter temporary password"
            labelClassName="mb-1.5 block text-xs text-slate-400"
            inputClassName={`${inputCls} pr-12`}
            required
            autoComplete="current-password"
          />
          <AuthPasswordField
            label="New password"
            value={form.newPassword}
            onChange={(e) => setForm((c) => ({ ...c, newPassword: e.target.value }))}
            placeholder="Min. 8 characters"
            labelClassName="mb-1.5 block text-xs text-slate-400"
            inputClassName={`${inputCls} pr-12`}
            required
            autoComplete="new-password"
          />
          <AuthPasswordField
            label="Confirm new password"
            value={form.confirm}
            onChange={(e) => setForm((c) => ({ ...c, confirm: e.target.value }))}
            placeholder="Repeat new password"
            labelClassName="mb-1.5 block text-xs text-slate-400"
            inputClassName={`${inputCls} pr-12`}
            required
            autoComplete="new-password"
          />

          {error && (
            <div className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Changing password...' : 'Set new password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
