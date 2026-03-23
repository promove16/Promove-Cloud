import useAuth from '../../hooks/useAuth';

const badgeColors = {
  student: 'bg-emerald-100 text-emerald-700',
  school: 'bg-sky-100 text-sky-700',
  college: 'bg-indigo-100 text-indigo-700',
  investor: 'bg-amber-100 text-amber-700',
  mentor: 'bg-fuchsia-100 text-fuchsia-700',
  hr: 'bg-cyan-100 text-cyan-700',
  superadmin: 'bg-rose-100 text-rose-700',
};

export default function DashboardShell({ role }) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-60 flex-col bg-slate-900 px-6 py-8 text-white md:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.35em] text-slate-400">ProMove</p>
            <h1 className="mt-3 text-2xl font-bold capitalize">{role}</h1>
          </div>
          <div className="mt-10 space-y-4">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="h-4 animate-pulse rounded-full bg-slate-700" />
            ))}
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="flex items-center justify-between bg-white px-6 py-4 shadow-sm">
            <div>
              <p className="text-sm text-slate-500">Innovation Cloud</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full border border-slate-200 bg-slate-100" />
              <div className="h-10 w-10 rounded-full bg-slate-300" />
            </div>
          </header>

          <main className="flex-1 bg-slate-50 p-6">
            <div className="mx-auto max-w-6xl space-y-8">
              <div className="space-y-3">
                <h2 className="text-3xl font-bold">Welcome back, {user?.name || 'ProMove User'}</h2>
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${badgeColors[role] || 'bg-slate-200 text-slate-700'}`}>
                  {role}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-32 animate-pulse rounded-2xl bg-white shadow-panel" />
                ))}
              </div>

              <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 px-6 py-12 text-center text-lg font-medium text-slate-500 shadow-panel">
                This dashboard is under construction.
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
