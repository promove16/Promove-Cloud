import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { resetPassword } from '../features/auth/authAPI';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const [form, setForm] = useState({ newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!token) {
      setError('Invalid reset link');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSubmitting(true);

    try {
      const response = await resetPassword(token, form.newPassword);
      setMessage(response.message || 'Password reset! You can now log in.');
      setForm({ newPassword: '', confirmPassword: '' });
    } catch (requestError) {
      setError(requestError.response?.data?.message || 'Unable to reset password.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-panel">
        <h1 className="text-3xl font-bold text-slate-900">Reset password</h1>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <Input label="New password" name="newPassword" type="password" value={form.newPassword} onChange={handleChange} required />
          <Input label="Confirm password" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required />

          {error ? <Alert>{error}</Alert> : null}
          {message ? <Alert variant="success">{message} <Link className="font-semibold underline" to="/login">Go to login</Link></Alert> : null}

          <Button type="submit" disabled={submitting}>{submitting ? 'Resetting...' : 'Reset password'}</Button>
        </form>
      </div>
    </div>
  );
}
