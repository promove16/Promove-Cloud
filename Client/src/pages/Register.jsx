import { useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import useAuth from '../hooks/useAuth';
import { registerUser } from '../features/auth/authAPI';
import ROLES from '../constants/roles';

const roleOptions = Object.values(ROLES);

export default function Register() {
  const { isAuthenticated } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.STUDENT,
  });
  const [fieldErrors, setFieldErrors] = useState({});
  const [statusMessage, setStatusMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hasSuccess = statusMessage.includes('Registration successful');

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    setFieldErrors((current) => ({ ...current, [event.target.name]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setStatusMessage('');

    try {
      await registerUser(form.name, form.email, form.password, form.role);
      setStatusMessage('Registration successful. Please check your email.');
    } catch (error) {
      const details = error.response?.data?.details || [];
      const nextFieldErrors = details.reduce((accumulator, item) => {
        accumulator[item.field] = item.message;
        return accumulator;
      }, {});
      setFieldErrors(nextFieldErrors);
      setStatusMessage(error.response?.data?.message || 'Unable to register right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-8 shadow-panel">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-600">ProMove</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">Register for your role in the innovation cloud.</p>
        </div>

        <form className="grid gap-5 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="md:col-span-2">
            <Input label="Full name" name="name" value={form.name} onChange={handleChange} placeholder="Your name" error={fieldErrors.name} required />
          </div>
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" error={fieldErrors.email} required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Create a strong password" error={fieldErrors.password} required />
          <label className="block space-y-2 text-sm font-medium text-slate-700 md:col-span-2">
            <span>Role</span>
            <select
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none focus:border-brand-500"
              name="role"
              value={form.role}
              onChange={handleChange}
            >
              {roleOptions.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            {fieldErrors.role ? <span className="text-xs text-rose-600">{fieldErrors.role}</span> : null}
          </label>

          {statusMessage ? (
            <div className="md:col-span-2">
              <Alert variant={hasSuccess ? 'success' : 'error'}>{statusMessage}</Alert>
            </div>
          ) : null}

          <div className="md:col-span-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Creating account...' : 'Register'}
            </Button>
          </div>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{' '}
          <Link className="font-medium text-brand-600 hover:text-brand-700" to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
