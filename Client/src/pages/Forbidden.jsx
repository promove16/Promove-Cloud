import { Link } from 'react-router-dom';

export default function Forbidden() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-lg rounded-[2rem] bg-white p-10 text-center shadow-panel">
        <p className="text-sm uppercase tracking-[0.35em] text-rose-500">403</p>
        <h1 className="mt-4 text-4xl font-bold text-slate-900">Access denied</h1>
        <p className="mt-3 text-slate-500">You do not have permission to access this area.</p>
        <Link className="mt-6 inline-flex rounded-xl bg-brand-600 px-5 py-3 font-semibold text-white" to="/dashboard">Return to dashboard</Link>
      </div>
    </div>
  );
}
