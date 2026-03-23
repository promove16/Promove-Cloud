import { Link, useSearchParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import Alert from '../components/ui/Alert';
import Spinner from '../components/ui/Spinner';
import { verifyEmail } from '../features/auth/authAPI';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    verifyEmail(token)
      .then((response) => {
        setStatus('success');
        setMessage(response.message || 'Email verified! You can now log in.');
      })
      .catch((error) => {
        setStatus('error');
        setMessage(error.response?.data?.message || 'Unable to verify email.');
      });
  }, [searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-8 shadow-panel">
        <h1 className="text-3xl font-bold text-slate-900">Verify your email</h1>
        <div className="mt-6">
          {status === 'loading' ? <Spinner label="Verifying your account..." /> : null}
          {status === 'success' ? (
            <Alert variant="success">
              {message} <Link className="font-semibold underline" to="/login">Go to login</Link>
            </Alert>
          ) : null}
          {status === 'error' ? <Alert>{message}</Alert> : null}
        </div>
      </div>
    </div>
  );
}
