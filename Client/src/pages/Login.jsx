import { useState } from 'react';
import { Navigate, Link, useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Alert from '../components/ui/Alert';
import useAuth from '../hooks/useAuth';
import { loginUser } from '../features/auth/authAPI';
import { setCredentials, setError, setLoading } from '../features/auth/authSlice';

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, isLoading } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errorMessage, setErrorMessage] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setErrorMessage('');
    dispatch(setLoading(true));

    try {
      const response = await loginUser(form.email, form.password);
      dispatch(setCredentials({
        user: response.user,
        accessToken: response.accessToken,
      }));
      navigate('/dashboard');
    } catch (error) {
      const message = error.response?.data?.message || 'Unable to log in. Please try again.';
      setErrorMessage(message);
      dispatch(setError(message));
    } finally {
      dispatch(setLoading(false));
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-panel">
        <div className="mb-8">
          <p className="text-sm uppercase tracking-[0.35em] text-brand-600">ProMove</p>
          <h1 className="mt-3 text-3xl font-bold text-slate-900">Welcome back</h1>
          <p className="mt-2 text-sm text-slate-500">Sign in to continue into your innovation workspace.</p>
        </div>

        <form className="space-y-5" onSubmit={handleSubmit}>
          <Input label="Email" name="email" type="email" value={form.email} onChange={handleChange} placeholder="you@example.com" required />
          <Input label="Password" name="password" type="password" value={form.password} onChange={handleChange} placeholder="Enter your password" required />

          {errorMessage ? <Alert>{errorMessage}</Alert> : null}

          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Signing in...' : 'Sign In'}
          </Button>
        </form>

        <div className="mt-6 flex items-center justify-between text-sm text-slate-500">
          <Link className="font-medium text-brand-600 hover:text-brand-700" to="/forgot-password">Forgot password?</Link>
          <Link className="font-medium text-brand-600 hover:text-brand-700" to="/register">Create account</Link>
        </div>
      </div>
    </div>
  );
}
