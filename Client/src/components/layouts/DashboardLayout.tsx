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
import { workspaceApi } from '../../api/workspace.api';
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
import { DASHBOARD_ROUTE_LABELS, DashboardNavItem, SIDEBAR_CONFIG } from './dashboardNavigation';
import { BusinessLogo } from '../branding/BusinessLogo';

interface DashboardLayoutProps {
  role?: UserRole;
}

const SIDEBAR_PARENT_PATH_ALIASES: Partial<Record<UserRole, Record<string, string[]>>> = {
  [UserRole.SCHOOL]: {
    '/dashboard/school/operations': [
      '/dashboard/school/students',
      '/dashboard/school/mentors',
      '/dashboard/school/events',
      '/dashboard/school/projects',
      '/dashboard/school/patents',
      '/dashboard/school/startups',
      '/dashboard/school/investors',
    ],
  },
  [UserRole.COLLEGE]: {
    '/dashboard/college/operations': [
      '/dashboard/college/students',
      '/dashboard/college/mentors',
      '/dashboard/college/events',
      '/dashboard/college/projects',
      '/dashboard/college/investors',
      '/dashboard/college/recruiters',
    ],
  },
};

const ACTIVE_NAV_ITEM_CLASS =
  'dashboard-theme-nav-active';
const INACTIVE_NAV_ITEM_CLASS = 'dashboard-theme-muted dashboard-theme-hover';
const INACTIVE_CHILD_NAV_ITEM_CLASS = 'dashboard-theme-subtle dashboard-theme-hover';

const matchesPath = (pathname: string, path: string, exact = false) =>
  pathname === path || (!exact && pathname.startsWith(`${path}/`));

const isSidebarPathActive = (
  pathname: string,
  path: string,
  exact = false,
  role?: UserRole,
) => {
  if (matchesPath(pathname, path, exact)) {
    return true;
  }

  if (exact || !role) {
    return false;
  }

  const aliases = SIDEBAR_PARENT_PATH_ALIASES[role]?.[path] ?? [];
  return aliases.some((alias) => matchesPath(pathname, alias));
};

function NotificationBell() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, unreadCount } = useNotifications();
  const [inviteFeedback, setInviteFeedback] = useState<string | null>(null);

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

  const teamInviteActionMutation = useMutation({
    mutationFn: async (params: {
      action: 'accept' | 'decline';
      notificationId: string;
      workspaceId: string;
      requestId: string;
    }) =>
      params.action === 'accept'
        ? workspaceApi.acceptInvite(params.workspaceId, params.requestId)
        : workspaceApi.declineInvite(params.workspaceId, params.requestId),
    onSuccess: async (_workspace, variables) => {
      setInviteFeedback(
        variables.action === 'accept' ? 'Workspace invite accepted.' : 'Workspace invite declined.',
      );
      queryClient.setQueryData<NotificationItem[] | undefined>(['notifications'], (current) =>
        current?.map((item) =>
          item._id === variables.notificationId ? { ...item, isRead: true } : item,
        ),
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['workspaces'] }),
      ]);
      if (variables.action === 'accept') {
        navigate(`/product-workspace/${variables.workspaceId}`);
      }
    },
    onError: (error) => {
      setInviteFeedback(
        (error as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error
          ?.message ?? 'Unable to update workspace invite.',
      );
    },
  });

  const notifications = data ?? [];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="dashboard-theme-hover relative rounded-lg p-2 transition-colors"
          aria-label="Notifications"
        >
          <Bell className="dashboard-theme-subtle h-5 w-5" />
          {unreadCount > 0 ? (
            <div className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-500 px-1 text-[10px] font-bold text-slate-50">
              {Math.min(unreadCount, 99)}
            </div>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="dashboard-theme-border dashboard-theme-popover dashboard-theme-text w-[22rem]">
        <div className="flex items-center justify-between px-2 py-1">
          <DropdownMenuLabel className="dashboard-theme-text px-0 text-sm font-semibold">Notifications</DropdownMenuLabel>
          <button
            type="button"
            onClick={() => markAllReadMutation.mutate()}
            className="text-xs font-semibold text-cyan-700 hover:text-cyan-600 dark:text-cyan-300 dark:hover:text-cyan-200"
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator className="dashboard-theme-separator" />
        {inviteFeedback ? (
          <>
            <div className="px-3 py-2 text-xs text-cyan-700 dark:text-cyan-200">{inviteFeedback}</div>
            <DropdownMenuSeparator className="dashboard-theme-separator" />
          </>
        ) : null}
        {notifications.length === 0 ? (
          <div className="dashboard-theme-subtle px-3 py-4 text-sm">You're all caught up.</div>
        ) : (
          notifications.slice(0, 6).map((notification) => (
            <DropdownMenuItem
              key={notification._id}
              className={`dashboard-theme-menu-item cursor-pointer rounded-xl px-3 py-3 ${notification.isRead ? 'opacity-70' : ''}`}
              onSelect={(event) => {
                const isTeamInvite = notification.type === 'team_invite';
                if (isTeamInvite) {
                  event.preventDefault();
                }
                markReadMutation.mutate(notification._id);
                if (!isTeamInvite && notification.link) {
                  navigate(notification.link);
                }
              }}
            >
              <div className="w-full space-y-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="dashboard-theme-text text-sm font-semibold">{notification.title}</div>
                  {!notification.isRead ? <span className="mt-1 h-2.5 w-2.5 rounded-full bg-cyan-400" /> : null}
                </div>
                <div className="dashboard-theme-subtle text-xs leading-5">{notification.body}</div>
                <div className="dashboard-theme-faint text-[11px] uppercase tracking-[0.25em]">
                  {new Date(notification.createdAt).toLocaleString('en-IN')}
                </div>
                {notification.type === 'team_invite' &&
                notification.metadata?.workspaceId &&
                notification.metadata?.requestId ? (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setInviteFeedback(null);
                        teamInviteActionMutation.mutate({
                          action: 'accept',
                          notificationId: notification._id,
                          workspaceId: notification.metadata!.workspaceId!,
                          requestId: notification.metadata!.requestId!,
                        });
                      }}
                      disabled={teamInviteActionMutation.isPending}
                      className="rounded-lg bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 disabled:opacity-60"
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setInviteFeedback(null);
                        teamInviteActionMutation.mutate({
                          action: 'decline',
                          notificationId: notification._id,
                          workspaceId: notification.metadata!.workspaceId!,
                          requestId: notification.metadata!.requestId!,
                        });
                      }}
                      disabled={teamInviteActionMutation.isPending}
                      className="dashboard-theme-border-strong dashboard-theme-muted dashboard-theme-hover rounded-lg border px-3 py-1.5 text-xs font-semibold disabled:opacity-60"
                    >
                      Decline
                    </button>
                  </div>
                ) : null}
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
  const isMarketplaceRoute = location.pathname.includes('/marketplace');
  const dashboardHomePath = resolvedRole ? roleRedirect(resolvedRole) : '/dashboard';
  const hasMessagesItem = navItems.some(
    (item) => item.kind === 'link' && item.label === 'Messages',
  );
  const routeLabels = resolvedRole ? DASHBOARD_ROUTE_LABELS[resolvedRole] ?? [] : [];
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

  const isPathActive = (path: string, exact = false) => matchesPath(location.pathname, path, exact);

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

    const matchedRouteLabel = routeLabels.find((item) => isPathActive(item.path));
    if (matchedRouteLabel) {
      return matchedRouteLabel.label;
    }

    return 'Dashboard';
  }, [location.pathname, navItems, exactMatchPaths, routeLabels]);

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
          isActive || isSidebarPathActive(location.pathname, path, shouldMatchExactly(path), resolvedRole)
            ? ACTIVE_NAV_ITEM_CLASS
            : INACTIVE_NAV_ITEM_CLASS
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
          className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left transition ${INACTIVE_NAV_ITEM_CLASS}`}
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
                : INACTIVE_NAV_ITEM_CLASS
            }`
          }
        >
          <item.icon className="h-5 w-5" />
          <span>{item.label}</span>
          <ChevronRight className={`ml-auto h-4 w-4 transition-transform ${groupExpanded ? 'rotate-90' : ''}`} />
        </NavLink>

        {groupExpanded ? (
          <div className="dashboard-theme-border ml-6 mt-2 space-y-1 border-l pl-4">
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
                      ? 'dashboard-theme-child-active'
                      : INACTIVE_CHILD_NAV_ITEM_CLASS
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
    <div className="dashboard-theme-bg h-screen overflow-hidden">
      <div className="flex h-full">
        <aside
          className={`dashboard-theme-border dashboard-theme-sidebar fixed inset-y-0 left-0 z-40 flex min-h-0 w-80 transform flex-col overflow-hidden border-r px-6 py-6 backdrop-blur-xl transition lg:static lg:translate-x-0 ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-8 flex items-center justify-between">
            <BusinessLogo
              to={dashboardHomePath}
              imageWrapperClassName="h-12 w-12"
              titleClassName="dashboard-theme-text text-lg"
              subtitleClassName="dashboard-theme-faint"
            />
            <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            <div className="space-y-2">{navItems.map(renderItem)}</div>

            <div className="dashboard-theme-border dashboard-theme-surface mt-8 rounded-3xl border p-5">
              <div className="text-xs uppercase tracking-[0.3em] text-cyan-700 dark:text-cyan-300">Active Role</div>
              <div className="dashboard-theme-text mt-3 text-xl font-semibold capitalize">{user.role}</div>
              <p className="dashboard-theme-subtle mt-2 text-sm leading-6">
                Role-aware access is controlled from a single sidebar config so navigation stays auditable.
              </p>
            </div>
          </div>
        </aside>

        <div className="flex min-h-0 flex-1 flex-col">
          <header className="dashboard-theme-border dashboard-theme-header sticky top-0 z-30 border-b backdrop-blur-xl">
            <div className="flex items-center justify-between px-4 py-4 lg:px-8">
              <div className="flex items-center gap-3">
                <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                  <Menu className="h-5 w-5" />
                </Button>
                <div>
                  <div className="dashboard-theme-faint text-xs uppercase tracking-[0.3em]">Workspace</div>
                  <div className="dashboard-theme-text mt-1 text-xl font-semibold">{currentLabel}</div>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <NotificationBell />
                <NavLink
                  to="/portfolio"
                  className="dashboard-theme-border dashboard-theme-surface dashboard-theme-hover flex items-center gap-3 rounded-2xl border px-4 py-2 transition hover:border-cyan-500/40"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-emerald-500 text-sm font-bold text-slate-50">
                    {initials}
                  </div>
                  <div>
                    <div className="dashboard-theme-text text-sm font-semibold">{user.displayName}</div>
                    <Badge>{user.role}</Badge>
                  </div>
                </NavLink>
              </div>
            </div>
          </header>

          <main
            className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${
              isMarketplaceRoute ? 'p-0' : 'px-4 py-6 lg:px-8'
            }`}
          >
            {children ?? <Outlet />}
          </main>
        </div>
      </div>

      {sidebarOpen ? (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          className="dashboard-theme-overlay fixed inset-0 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}
    </div>
  );
}
