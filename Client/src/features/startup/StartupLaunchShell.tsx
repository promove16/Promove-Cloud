import { Outlet, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { StartupSectionTabs } from './StartupSectionTabs';
import { STARTUP_LAUNCH_LIST_PATH } from './navigation';

export function StartupLaunchShell() {
  const navigate = useNavigate();
  const { startupId } = useParams<{ startupId: string }>();

  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <button
          onClick={() => navigate(STARTUP_LAUNCH_LIST_PATH)}
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          All Startups
        </button>

        <StartupSectionTabs />

        <Outlet context={{ startupId: startupId === 'new' ? undefined : startupId }} />
      </div>
    </DashboardLayout>
  );
}
