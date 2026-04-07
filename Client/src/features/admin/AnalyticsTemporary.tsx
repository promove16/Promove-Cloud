import { BarChart3, Clock3, LayoutDashboard, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/ui/Card';

const temporaryLinks = [
  {
    label: 'Back to Admin Dashboard',
    description: 'Return to the main control center and continue with active admin workflows.',
    path: '/dashboard/admin',
    icon: LayoutDashboard,
  },
  {
    label: 'Manage Users',
    description: 'Review access, approvals, and operator activity from the current admin workspace.',
    path: '/dashboard/admin/users/directory',
    icon: Users,
  },
];

export default function AnalyticsTemporary() {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden border border-slate-800 bg-slate-950">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.12),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(59,130,246,0.12),transparent_30%)]" />
        <div className="relative space-y-6 px-6 py-8 lg:px-8 lg:py-10">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
            <BarChart3 className="h-6 w-6" />
          </div>

          <div className="max-w-3xl space-y-3">
            <div className="text-[11px] uppercase tracking-[0.35em] text-cyan-300">Admin Analytics</div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Temporary page for now</h1>
            <p className="text-sm leading-6 text-slate-400">
              This is a temporary placeholder for the admin analytics route while the full analytics workspace is
              wired later.
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-2 text-sm text-amber-100">
            <Clock3 className="h-4 w-4" />
            The temporary analytics workspace stays in place until the real reporting pages are ready.
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        {temporaryLinks.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="group border border-slate-800 bg-slate-950 px-6 py-5 transition hover:border-cyan-500/40 hover:bg-slate-950/80"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-cyan-300 transition group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                <item.icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="text-base font-semibold text-white">{item.label}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </section>

      <Card className="border-slate-800/90 bg-slate-950/85 p-6">
        <div className="text-sm font-semibold text-white">Why this page exists</div>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
          Admin dashboard metrics remain available on the home screen. This route is temporarily reserved so future
          analytics work can be reintroduced without changing the main admin navigation again.
        </p>
      </Card>
    </div>
  );
}
