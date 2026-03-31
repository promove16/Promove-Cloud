import { ReactNode } from 'react';
import { DashboardLayout as SharedDashboardLayout } from '../../components/layouts/DashboardLayout';
import { UserRole } from '../../types/roles.types';

type LegacyDashboardRole =
  | UserRole
  | 'student'
  | 'school'
  | 'college'
  | 'mentor'
  | 'investor'
  | 'recruiter'
  | 'admin';

interface DashboardLayoutProps {
  children: ReactNode;
  role: LegacyDashboardRole;
}

export function DashboardLayout({ children, role }: DashboardLayoutProps) {
  return <SharedDashboardLayout role={role as UserRole}>{children}</SharedDashboardLayout>;
}
