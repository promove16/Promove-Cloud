import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-[2rem] bg-white p-10 text-center shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-slate-500">404</p>
        <h1 className="mt-4 text-4xl font-bold text-slate-900">Page not found</h1>
        <p className="mt-3 text-slate-500">The page you are looking for does not exist.</p>
        <Link className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white" to="/login">Go to login</Link>
      </div>
    </div>
  );
}
