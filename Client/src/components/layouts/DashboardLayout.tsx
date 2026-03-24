import { Outlet, useNavigate } from 'react-router-dom';
import {
  Bell,
  Briefcase,
  Building2,
  Compass,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Rocket,
  Shield,
  TrendingUp,
  UserRoundCheck,
  Users,
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useLogoutMutation } from '../../features/auth/useAuth';
import { useAuthStore } from '../../store/authStore';
import { roleRedirect } from '../../utils/roleRedirect';
import { UserRole } from '../../types/roles.types';

const navConfig: Record<UserRole, Array<{ label: string; icon: typeof LayoutDashboard }>> = {
  student: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Innovation Profile', icon: Compass },
    { label: 'Mentor Connections', icon: Users },
  ],
  school: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Programs', icon: GraduationCap },
    { label: 'Mentor Access', icon: Users },
  ],
  college: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Incubation', icon: Building2 },
    { label: 'Student Network', icon: Users },
  ],
  mentor: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Students', icon: UserRoundCheck },
    { label: 'Reviews', icon: Compass },
  ],
  investor: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Opportunities', icon: TrendingUp },
    { label: 'Institutions', icon: Building2 },
  ],
  recruiter: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Talent Network', icon: Briefcase },
    { label: 'College Access', icon: Building2 },
  ],
  admin: [
    { label: 'Overview', icon: LayoutDashboard },
    { label: 'Verification', icon: Shield },
    { label: 'Platform Control', icon: Compass },
  ],
};

export function DashboardLayout() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const logoutMutation = useLogoutMutation();

  if (!user) {
    return null;
  }

  const initials = user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside className="hidden w-72 border-r border-slate-800 bg-slate-900/90 lg:block">
          <div className="flex h-full flex-col px-6 py-8">
            <div className="mb-10 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-purple-600">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">ProMove</div>
                <div className="text-xs text-slate-400">Innovation Cloud</div>
              </div>
            </div>

            <nav className="space-y-2">
              {navConfig[user.role].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-left text-slate-300"
                >
                  <item.icon className="h-5 w-5 text-slate-400" />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>

            <div className="mt-auto rounded-2xl border border-slate-800 bg-slate-950/70 p-4">
              <div className="text-sm font-semibold text-white">Phase 1 Shell</div>
              <p className="mt-2 text-sm text-slate-400">
                Feature modules stay intentionally empty here until the next phase.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-950/90 backdrop-blur">
            <div className="flex items-center justify-between px-6 py-4">
              <div>
                <div className="text-lg font-semibold">Dashboard</div>
                <div className="text-sm text-slate-400">
                  {roleRedirect(user.role)}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  className="rounded-full border border-slate-800 bg-slate-900 p-3 text-slate-300"
                >
                  <Bell className="h-5 w-5" />
                </button>

                <div className="hidden items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2 md:flex">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-sm font-bold">
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{user.displayName}</div>
                    <Badge>{user.role}</Badge>
                  </div>
                </div>

                <Button
                  variant="secondary"
                  className="gap-2"
                  onClick={async () => {
                    await logoutMutation.mutateAsync();
                    navigate('/login', { replace: true });
                  }}
                >
                  <LogOut className="h-4 w-4" />
                  Logout
                </Button>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-8">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
