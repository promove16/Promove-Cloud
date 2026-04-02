import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { StartupLaunch } from '../../app/pages/StartupLaunch';
import { STARTUP_LAUNCH_LIST_PATH } from './navigation';

export function NewStartupPage() {
  const navigate = useNavigate();

  return (
    <DashboardLayout role="student">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800/70 bg-slate-950/40 px-4 py-3">
          <button
            onClick={() => navigate(STARTUP_LAUNCH_LIST_PATH)}
            className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All Startups
          </button>

          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
            <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-slate-300">
              Draft Startup
            </span>
            <span className="hidden sm:inline">
              Save once to unlock outreach, cap table, and investor deal sections
            </span>
          </div>
        </div>

        <StartupLaunch />
      </div>
    </DashboardLayout>
  );
}
