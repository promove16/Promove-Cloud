import { useState } from 'react';
import Alert from '../components/ui/Alert';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { forgotPassword } from '../features/auth/authAPI';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    try {
      await forgotPassword(email);
    } catch (error) {
    } finally {
      setMessage('If that email is registered, a reset link has been sent.');
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-[2rem] bg-white p-8 shadow-panel">
        <h1 className="text-3xl font-bold text-slate-900">Forgot password</h1>
        <p className="mt-2 text-sm text-slate-500">We will send a secure reset link if your email exists in ProMove.</p>

        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" required />
          {message ? <Alert variant="success">{message}</Alert> : null}
          <Button type="submit" disabled={submitting}>{submitting ? 'Sending...' : 'Send reset link'}</Button>
        </form>
      </div>
    </div>
  );
}
