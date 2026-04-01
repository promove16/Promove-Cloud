import { Outlet } from 'react-router-dom';
import { DashboardLayout } from '../../app/components/DashboardLayout';
import { StartupSectionTabs } from './StartupSectionTabs';

export function StartupLaunchShell() {
  return (
    <DashboardLayout role="student">
      <div className="space-y-6">
        <StartupSectionTabs />

        <Outlet />
      </div>
    </DashboardLayout>
  );
}
