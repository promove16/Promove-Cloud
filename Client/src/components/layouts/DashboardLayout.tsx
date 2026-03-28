import { useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  Globe,
  GraduationCap,
  Home,
  Bell,
  LogOut,
  Menu,
  Rocket,
  Settings,
  Sparkles,
  Trophy,
  Server,
  User,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { useLogoutMutation } from '../../features/auth/useAuth';
import { notificationApi } from '../../api/notification.api';
import { useNotifications } from '../../hooks/useNotifications';
import { NotificationItem } from '../../types/notification.types';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../app/components/ui/dropdown-menu';

type NavItem =
  | {
      kind: 'link';
      label: string;
      icon: LucideIcon;
      path: string;
    }
  | {
      kind: 'action';
      label: string;
      icon: LucideIcon;
      action: 'logout';
    };

function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, unreadCount } = useNotifications();

  const markReadMutation = useMutation({
    mutationFn: notificationApi.markRead,
    onSuccess: (updated) => {
      queryClient.setQueryData<NotificationItem[] | undefined>(['notifications'], (current) =>
        current?.map((item) => (item._id === updated._id ? updated : item)),
      );
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationApi.markAllRead,
    onSuccess: () => {
      queryClient.setQueryData<NotificationItem[] | undefined>(['notifications'], (current) =>
        current?.map((item) => ({ ...item, isRead: true })),
      );
    },
  });

  const notifications = data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative rounded-lg p-2 transition-colors hover:bg-slate-800"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5 text-slate-400" />
          {unreadCount > 0 ? (
            <div className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-white">
              {Math.min(unreadCount, 99)}
            </div>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[22rem] border-slate-800 bg-slate-950 text-white">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="px-0 text-sm font-semibold text-white">Notifications</DropdownMenuLabel>
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs font-semibold text-cyan-300 hover:text-cyan-200"
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator className="bg-slate-800" />
        {notifications.length === 0 ? (
          <div className="px-3 py-4 text-sm text-slate-400">You're all caught up.</div>
        ) : (
          notifications.slice(0, 6).map((notification) => (
            <DropdownMenuItem
              key={notification._id}
              className={`cursor-pointer rounded-xl px-3 py-3 focus:bg-slate-900 ${notification.isRead ? 'opacity-70' : ''}`}
              onSelect={() => {
                markReadMutation.mutate(notification._id);
                if (notification.link) {
                  navigate(notification.link);
                }
              }}
            >
              <div className="w-full space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="text-sm font-semibold text-white">{notification.title}</div>
                  {!notification.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" /> : null}
                </div>
                <div className="text-xs leading-5 text-slate-400">{notification.body}</div>
                <div className="text-[11px] uppercase tracking-[0.25em] text-slate-500">
                  {new Date(notification.createdAt).toLocaleString('en-IN')}
                </div>
              </div>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export const SIDEBAR_CONFIG: Record<UserRole, NavItem[]> = {
  [UserRole.STUDENT]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/student' },
    { kind: 'link', label: 'Problem Bank', icon: Sparkles, path: '/problem-bank' },
    { kind: 'link', label: 'Product Workspace', icon: Trophy, path: '/product-workspace' },
    { kind: 'link', label: 'Patent Support', icon: FileText, path: '/patent-support' },
    { kind: 'link', label: 'Startup Launch', icon: Rocket, path: '/startup-launch' },
    { kind: 'link', label: 'Cap Table', icon: BarChart3, path: '/startup-launch/cap-table' },
    { kind: 'link', label: 'Leadership Profile', icon: Trophy, path: '/leadership-profile' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: '/marketplace' },
    { kind: 'link', label: 'My Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.SCHOOL]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/school' },
    { kind: 'link', label: 'Student Innovators', icon: Users, path: '/dashboard/school/students' },
    { kind: 'link', label: 'Investors', icon: Globe, path: '/dashboard/school/investors' },
    { kind: 'link', label: 'Mentors', icon: GraduationCap, path: '/dashboard/school/mentors' },
    { kind: 'link', label: 'Compliance Report', icon: FileText, path: '/dashboard/school/compliance' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.COLLEGE]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/college' },
    { kind: 'link', label: 'Student Innovators', icon: Users, path: '/dashboard/college/students' },
    { kind: 'link', label: 'Recruiters', icon: BriefcaseBusiness, path: '/dashboard/college/recruiters' },
    { kind: 'link', label: 'Investors', icon: Globe, path: '/dashboard/college/investors' },
    { kind: 'link', label: 'Mentors', icon: GraduationCap, path: '/dashboard/college/mentors' },
    { kind: 'link', label: 'Placement Tracker', icon: BarChart3, path: '/dashboard/college/placement' },
    { kind: 'link', label: 'Events', icon: Sparkles, path: '/dashboard/college/events' },
    { kind: 'link', label: 'Compliance Report', icon: FileText, path: '/dashboard/college/compliance' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.MENTOR]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/mentor' },
    { kind: 'link', label: 'Student Feed', icon: Users, path: '/dashboard/mentor/students' },
    { kind: 'link', label: 'Sessions', icon: CalendarDays, path: '/dashboard/mentor/sessions' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.INVESTOR]: [
    { kind: 'link', label: 'Deal Flow', icon: ArrowRight, path: '/dashboard/investor' },
    { kind: 'link', label: 'Startups', icon: Rocket, path: '/dashboard/investor/startups' },
    { kind: 'link', label: 'Institutions', icon: Building2, path: '/dashboard/investor/institutions' },
    { kind: 'link', label: 'My Portfolio', icon: BriefcaseBusiness, path: '/dashboard/investor/portfolio' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.RECRUITER]: [
    { kind: 'link', label: 'Dashboard', icon: BriefcaseBusiness, path: '/dashboard/recruiter' },
    { kind: 'link', label: 'Talent Search', icon: Users, path: '/dashboard/recruiter/talent' },
    { kind: 'link', label: 'College Connect', icon: Globe, path: '/dashboard/recruiter/colleges' },
    { kind: 'link', label: 'Active Drives', icon: BarChart3, path: '/dashboard/recruiter/drives' },
    { kind: 'link', label: 'Onboarding Tracker', icon: Trophy, path: '/dashboard/recruiter/onboarding' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.ADMIN]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/admin' },
    { kind: 'link', label: 'Users', icon: Users, path: '/dashboard/admin/users' },
    { kind: 'link', label: 'Patents', icon: FileText, path: '/dashboard/admin/patents' },
    { kind: 'link', label: 'Awards', icon: Trophy, path: '/dashboard/admin/awards' },
    { kind: 'link', label: 'Deals', icon: BriefcaseBusiness, path: '/dashboard/admin/deals' },
    { kind: 'link', label: 'Analytics', icon: BarChart3, path: '/dashboard/admin/analytics' },
    { kind: 'link', label: 'Capacity', icon: Server, path: '/dashboard/admin/capacity' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
};

export function DashboardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation();
  const user = useAuthStore((state) => state.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navItems = user ? SIDEBAR_CONFIG[user.role] : [];

  const currentLabel = useMemo(() => {
    const activeItem = navItems.find(
      (item) =>
        item.kind === 'link' &&
        (location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)),
    );
    return activeItem?.label ?? 'Dashboard';
  }, [location.pathname, navItems]);

  if (!user) {
    return null;
  }

  const initials = user.displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const handleLogout = async () => {
    await logoutMutation.mutateAsync();
    navigate('/login', { replace: true });
  };

  const renderItem = (item: NavItem) => {
    if (item.kind === 'action') {
      return (
        <button
          key={item.label}
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-slate-300 transition hover:bg-slate-900 hover:text-white"
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
        </button>
      );
    }

    return (
      <NavLink
        key={item.label}
        to={item.path}
        onClick={() => setSidebarOpen(false)}
        className={({ isActive }) =>
          `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
            isActive || location.pathname.startsWith(`${item.path}/`)
              ? 'bg-cyan-500/10 text-cyan-200 ring-1 ring-cyan-500/30'
              : 'text-slate-300 hover:bg-slate-900 hover:text-white'
          }`
        }
      >
        <item.icon className="h-5 w-5" />
        <span>{item.label}</span>
      </NavLink>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 w-80 transform border-r border-slate-800 bg-slate-950/95 px-6 py-6 backdrop-blur-xl transition lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500 via-sky-500 to-emerald-500">
                <Rocket className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold">ProMove</div>
                <div className="text-xs uppercase tracking-[0.25em] text-slate-500">Innovation Cloud</div>
              </div>
            </div>
            <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="space-y-2">{navItems.map(renderItem)}</div>

          <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
            <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Role</div>
            <div className="mt-3 text-xl font-semibold text-white capitalize">{user.role}</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Role-aware access is controlled from a single sidebar config so navigation stays auditable.
            </p>
          </div>
        </aside>

        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/85 backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <div className="text-xs uppercase tracking-[0.3em] text-slate-500">Workspace</div>
                  <div className="mt-1 text-xl font-semibold text-white">{currentLabel}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                <NavLink
                  to="/dashboard/profile"
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/70 px-4 py-2 transition hover:border-cyan-500/40 hover:bg-slate-900"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-white">
                    {initials}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{user.displayName}</div>
                    <Badge>{user.role}</Badge>
                  </div>
                </NavLink>
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-6 lg:px-8">
            <Outlet />
          </main>
        </div>
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="fixed inset-0 z-30 bg-slate-950/60 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
}
