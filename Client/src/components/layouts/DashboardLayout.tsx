import { PropsWithChildren, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Menu,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../types/roles.types';
import { useLogoutMutation } from '../../features/auth/useAuth';
import { notificationApi } from '../../api/notification.api';
import { dmApi } from '../../api/dm.api';
import { useNotifications } from '../../hooks/useNotifications';
import { trackNavigationClick } from '../../lib/activityTracker';
import { NotificationItem } from '../../types/notification.types';
import { roleRedirect } from '../../utils/roleRedirect';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../../app/components/ui/dropdown-menu';
import { DashboardNavItem, SIDEBAR_CONFIG } from './dashboardNavigation';
import { BusinessLogo } from '../branding/BusinessLogo';

interface DashboardLayoutProps {
  role?: UserRole;
}

const ACTIVE_NAV_ITEM_CLASS =
  'bg-cyan-500/10 text-cyan-200 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.3)]';

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

export function DashboardLayout({ children, role }: PropsWithChildren<DashboardLayoutProps>) {
  const location = useLocation();
  const navigate = useNavigate();
  const logoutMutation = useLogoutMutation();
  const user = useAuthStore((state) => state.user);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const resolvedRole = user?.role ?? role;
  const navItems = resolvedRole ? SIDEBAR_CONFIG[resolvedRole] : [];
  const dashboardHomePath = resolvedRole ? roleRedirect(resolvedRole) : '/dashboard';
  const hasMessagesItem = navItems.some(
    (item) => item.kind === 'link' && item.label === 'Messages',
  );
  const exactMatchPaths = useMemo(
    () =>
      new Set(
        navItems.flatMap((item) =>
          item.kind === 'group'
            ? item.children.filter((child) => child.path === item.path).map((child) => child.path)
            : [],
        ),
      ),
    [navItems],
  );

  const conversationsQuery = useQuery({
    queryKey: ['dm', 'conversations'],
    queryFn: dmApi.listConversations,
    enabled: Boolean(user) && hasMessagesItem,
    staleTime: 30_000,
  });

  const unreadMessagesCount = (conversationsQuery.data ?? []).reduce(
    (total, conversation) => total + conversation.unreadCount,
    0,
  );

  const isPathActive = (path: string, exact = false) =>
    location.pathname === path || (!exact && location.pathname.startsWith(`${path}/`));

  const isHomePath = (path: string) => path === dashboardHomePath;
  const shouldMatchExactly = (path: string) => isHomePath(path) || exactMatchPaths.has(path);

  const currentLabel = useMemo(() => {
    for (const item of navItems) {
      if (item.kind === 'link' && isPathActive(item.path, shouldMatchExactly(item.path))) {
        return item.label;
      }

      if (item.kind === 'group') {
        const activeChild = item.children.find((child) => isPathActive(child.path, shouldMatchExactly(child.path)));
        if (activeChild) {
          return activeChild.label;
        }

        if (isPathActive(item.path)) {
          return item.label;
        }
      }
    }

    return 'Dashboard';
  }, [location.pathname, navItems, exactMatchPaths]);

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

  const renderLink = (label: string, path: string, Icon: LucideIcon) => (
    <NavLink
      key={label}
      to={path}
      end={shouldMatchExactly(path)}
      onClick={() => {
        trackNavigationClick(path, label);
        setSidebarOpen(false);
      }}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
          isActive || isPathActive(path, shouldMatchExactly(path))
            ? ACTIVE_NAV_ITEM_CLASS
            : 'text-slate-300 hover:bg-slate-900 hover:text-white'
        }`
      }
    >
      <Icon className="h-5 w-5" />
      <span>{label}</span>
      {label === 'Messages' && unreadMessagesCount > 0 ? (
        <span
          aria-label={`${unreadMessagesCount} unread messages`}
          className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.7)]"
        />
      ) : null}
    </NavLink>
  );

  const renderItem = (item: DashboardNavItem) => {
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

    if (item.kind === 'link') {
      return renderLink(item.label, item.path, item.icon);
    }

    const groupExpanded = isPathActive(item.path) || item.children.some((child) => isPathActive(child.path));

    return (
      <div key={item.label}>
        <NavLink
          to={item.path}
          onClick={() => {
            trackNavigationClick(item.path, item.label);
            setSidebarOpen(false);
          }}
          className={() =>
            `flex items-center gap-3 rounded-2xl px-4 py-3 transition ${
              groupExpanded
                ? ACTIVE_NAV_ITEM_CLASS
                : 'text-slate-300 hover:bg-slate-900 hover:text-white'
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
          <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${groupExpanded ? 'rotate-90' : ''}`} />
        </NavLink>

        {groupExpanded ? (
          <div className="ml-6 mt-2 space-y-1 border-l border-slate-800 pl-4">
            {item.children.map((child) => (
              <NavLink
                key={child.path}
                to={child.path}
                end={shouldMatchExactly(child.path)}
                onClick={() => {
                  trackNavigationClick(child.path, `${item.label}: ${child.label}`);
                  setSidebarOpen(false);
                }}
                className={({ isActive }) =>
                  `flex rounded-xl px-3 py-2 text-sm transition ${
                    isActive || isPathActive(child.path, shouldMatchExactly(child.path))
                      ? 'bg-slate-900 text-cyan-200'
                      : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                  }`
                }
              >
                {child.label}
              </NavLink>
            ))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-slate-950 text-white">
      <div className="flex h-full">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-80 min-h-0 flex-col overflow-hidden transform border-r border-slate-800 bg-slate-950/95 px-6 py-6 backdrop-blur-xl transition lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-8 flex items-center justify-between">
            <BusinessLogo
              to={dashboardHomePath}
              imageWrapperClassName="h-12 w-12"
              titleClassName="text-lg text-white"
              subtitleClassName="text-slate-500"
            />
            <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">{navItems.map(renderItem)}</div>

            <div className="mt-8 rounded-3xl border border-slate-800 bg-slate-900/70 p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-300">Active Role</div>
              <div className="mt-3 text-xl font-semibold text-white capitalize">{user.role}</div>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Role-aware access is controlled from a single sidebar config so navigation stays auditable.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
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

          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-6 lg:px-8">
            {children ?? <Outlet />}
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
