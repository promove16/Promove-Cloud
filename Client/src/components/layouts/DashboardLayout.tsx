import { PropsWithChildren, useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronDown,
  ChevronRight,
  LogOut,
  Menu,
  Settings,
  Trophy,
  X,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '../ui/Button';
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
import { GlobalWorkspaceInviteDialog } from '../workspace/GlobalWorkspaceInviteDialog';

interface DashboardLayoutProps {
  role?: UserRole;
}

type SidebarNotificationSection = 'applications' | 'events' | 'messages';
type DashboardAccountMenuItem =
  | {
      kind: 'link';
      label: string;
      icon: LucideIcon;
      path: string;
    }
  | {
      kind: 'action';
      label: 'Logout';
      icon: LucideIcon;
      action: 'logout';
    };

const SHARED_ROUTE_LABELS = [
  { path: '/dashboard/settings', label: 'Settings' },
] as const;

const SIDEBAR_PARENT_PATH_ALIASES: Partial<Record<UserRole, Record<string, string[]>>> = {
  [UserRole.SCHOOL]: {
    '/dashboard/school/students': [
      '/dashboard/school/operations',
    ],
  },
  [UserRole.COLLEGE]: {
    '/dashboard/college/students': [
      '/dashboard/college/operations',
    ],
  },
  [UserRole.RECRUITER]: {
    '/dashboard/recruiter/marketplace': ['/dashboard/recruiter/applications'],
    '/dashboard/recruiter/drives': [
      '/dashboard/recruiter/hiring-events',
      '/dashboard/recruiter/onboarding',
    ],
  },
  [UserRole.INVESTOR]: {
    '/dashboard/investor/product-workshop': ['/product-workspace'],
  },
};

const ACTIVE_NAV_ITEM_CLASS =
  'dashboard-theme-nav-active';
const INACTIVE_NAV_ITEM_CLASS = 'dashboard-theme-muted dashboard-theme-hover';
const INACTIVE_CHILD_NAV_ITEM_CLASS = 'dashboard-theme-subtle dashboard-theme-hover';
const SIDEBAR_NOTIFICATION_PATHS: Record<SidebarNotificationSection, string[]> = {
  applications: ['/dashboard/student/applications', '/dashboard/recruiter/applications'],
  events: [
    '/dashboard/student/events',
    '/dashboard/school/events',
    '/dashboard/college/events',
    '/dashboard/recruiter/hiring-events',
  ],
  messages: ['/dashboard/messages', '/dashboard/recruiter/messages'],
};

const findNavLinkItem = (items: DashboardNavItem[], label: string) =>
  items.find(
    (item): item is Extract<DashboardNavItem, { kind: 'link' }> =>
      item.kind === 'link' && item.label === label,
  );

const buildAccountMenuItems = (
  items: DashboardNavItem[],
): DashboardAccountMenuItem[] => {
  const primaryItem =
    findNavLinkItem(items, 'Portfolio') ??
    findNavLinkItem(items, 'Profile') ??
    ({
      kind: 'link',
      label: 'Portfolio',
      icon: Trophy,
      path: '/portfolio',
    } as const);

  const settingsItem =
    findNavLinkItem(items, 'Settings') ??
    ({
      kind: 'link',
      label: 'Settings',
      icon: Settings,
      path: '/dashboard/settings',
    } as const);

  return [
    primaryItem,
    settingsItem,
    {
      kind: 'action',
      label: 'Logout',
      icon: LogOut,
      action: 'logout',
    },
  ];
};

const splitPathSegments = (value: string) =>
  value
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean);

const matchesPath = (pathname: string, path: string, exact = false) => {
  const currentSegments = splitPathSegments(pathname);
  const targetSegments = splitPathSegments(path);

  if (targetSegments.length === 0) {
    return currentSegments.length === 0;
  }

  if (exact) {
    return (
      currentSegments.length === targetSegments.length &&
      targetSegments.every((segment, index) => currentSegments[index] === segment)
    );
  }

  return (
    currentSegments.length >= targetSegments.length &&
    targetSegments.every((segment, index) => currentSegments[index] === segment)
  );
};

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

const normalizeNotificationPath = (target: string) => {
  const trimmedTarget = target.trim();
  if (!trimmedTarget) {
    return '';
  }

  try {
    const parsed = new URL(trimmedTarget, 'https://promove.local');
    return (parsed.pathname.replace(/\/+$/, '') || '/');
  } catch {
    return trimmedTarget.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || trimmedTarget;
  }
};

const getNotificationTargets = (notification: NotificationItem) =>
  [
    notification.link,
    notification.metadata?.deepLink,
    notification.metadata?.acceptRedirect,
    notification.metadata?.declineRedirect,
  ]
    .filter((target): target is string => typeof target === 'string' && target.trim().length > 0)
    .map(normalizeNotificationPath);

const getNotificationNavigationTarget = (
  notification: NotificationItem,
  role?: UserRole,
) => {
  const dealId = notification.metadata?.dealId;
  if (dealId && role === UserRole.INVESTOR) {
    return `/dashboard/investor/pipeline?dealId=${dealId}`;
  }

  if (dealId && notification.metadata?.startupId && role === UserRole.STUDENT) {
    return `/startup-launch/${notification.metadata.startupId}/cap-table?view=pipeline&dealId=${dealId}`;
  }

  if (notification.metadata?.agreementId) {
    return `/agreements/${notification.metadata.agreementId}`;
  }

  if (notification.link && notification.link !== '/dashboard/admin') {
    return notification.link;
  }

  if (notification.title.toLowerCase().includes('equity transfer verified')) {
    if (role === UserRole.INVESTOR) {
      return '/dashboard/investor/pipeline';
    }
    if (role === UserRole.STUDENT) {
      return '/startup-launch';
    }
  }

  return notification.metadata?.deepLink ?? notification.metadata?.acceptRedirect ?? undefined;
};

const hasNotificationTarget = (targets: string[], pathPrefixes: string[]) =>
  targets.some((target) =>
    pathPrefixes.some((pathPrefix) => {
      const normalizedPrefix = normalizeNotificationPath(pathPrefix);
      return target === normalizedPrefix || target.startsWith(`${normalizedPrefix}/`);
    }),
  );

const doesCurrentPathMatchTargets = (pathname: string, targets: string[]) => {
  const normalizedPathname = normalizeNotificationPath(pathname);
  return targets.some((target) =>
    normalizedPathname === target || normalizedPathname.startsWith(`${target}/`),
  );
};

const getUnreadSidebarNotificationState = (notifications: NotificationItem[]) =>
  notifications.reduce<Record<SidebarNotificationSection, boolean>>(
    (state, notification) => {
      if (notification.isRead) {
        return state;
      }

      const targets = getNotificationTargets(notification);
      const requestedPermission = notification.metadata?.requestedPermission ?? '';

      if (
        !state.applications &&
        (hasNotificationTarget(targets, SIDEBAR_NOTIFICATION_PATHS.applications) ||
          requestedPermission === 'job_application' ||
          notification.metadata?.requestType === 'recruiter_job_invite')
      ) {
        state.applications = true;
      }

      if (
        !state.events &&
        (hasNotificationTarget(targets, SIDEBAR_NOTIFICATION_PATHS.events) ||
          notification.metadata?.requestType === 'college_event_invite' ||
          notification.metadata?.requestType === 'campus_drive_registration')
      ) {
        state.events = true;
      }

      if (
        !state.messages &&
        (hasNotificationTarget(targets, SIDEBAR_NOTIFICATION_PATHS.messages) ||
          notification.type === 'chat_invite' ||
          requestedPermission.startsWith('dm_') ||
          (notification.metadata?.requestType === 'generic' &&
            notification.metadata?.actionType === 'connect'))
      ) {
        state.messages = true;
      }

      return state;
    },
    {
      applications: false,
      events: false,
      messages: false,
    },
  );

function NotificationBell({
  notifications,
  unreadCount,
  role,
}: {
  notifications: NotificationItem[];
  unreadCount: number;
  role?: UserRole;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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
            className="text-xs font-semibold text-blue-600 hover:text-blue-500 dark:text-blue-300 dark:hover:text-blue-200"
          >
            Mark all read
          </button>
        </div>
        <DropdownMenuSeparator className="dashboard-theme-separator" />
        {inviteFeedback ? (
          <>
            <div className="px-3 py-2 text-xs text-blue-600 dark:text-blue-300">{inviteFeedback}</div>
            <DropdownMenuSeparator className="dashboard-theme-separator" />
          </>
        ) : null}
        {notifications.length === 0 ? (
          <div className="dashboard-theme-subtle px-3 py-4 text-sm">You're all caught up.</div>
        ) : (
          notifications.slice(0, 6).map((notification) => (
            <DropdownMenuItem
              key={notification._id}
              className={`dashboard-theme-menu-item rounded-xl px-3 py-3 ${getNotificationNavigationTarget(notification, role) || notification.type === 'team_invite' ? 'cursor-pointer' : 'cursor-default'} ${notification.isRead ? 'opacity-70' : ''}`}
              onSelect={(event) => {
                const isTeamInvite = notification.type === 'team_invite';
                if (isTeamInvite) {
                  event.preventDefault();
                }
                markReadMutation.mutate(notification._id);
                const target = getNotificationNavigationTarget(notification, role);
                if (!isTeamInvite && target) {
                  navigate(target);
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
                      className="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
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
  const queryClient = useQueryClient();
  const autoMarkedNotificationIds = useRef<Set<string>>(new Set());
  const mainScrollRef = useRef<HTMLElement | null>(null);

  const resolvedRole = user?.role ?? role;
  const navItems = resolvedRole ? SIDEBAR_CONFIG[resolvedRole] : [];
  const accountMenuItems = useMemo(
    () => buildAccountMenuItems(navItems),
    [navItems],
  );
  const accountMenuLabels = useMemo(
    () =>
      new Set(
        accountMenuItems
          .filter((item): item is Extract<DashboardAccountMenuItem, { kind: 'link' }> => item.kind === 'link')
          .map((item) => item.label),
      ),
    [accountMenuItems],
  );
  const sidebarNavItems = useMemo(
    () =>
      navItems.filter((item) => {
        if (item.kind === 'action') {
          return item.action !== 'logout';
        }

        return true;
      }),
    [accountMenuLabels, navItems],
  );
  const normalizedPathname = location.pathname.replace(/\/+$/, '') || '/';
  const isMarketplaceRoute = normalizedPathname.includes('/marketplace');
  const isRecruiterMarketplaceRoute =
    resolvedRole === UserRole.RECRUITER &&
    normalizedPathname.startsWith('/dashboard/recruiter/marketplace');
  const isPortfolioRoute =
    normalizedPathname === '/portfolio' ||
    normalizedPathname.startsWith('/portfolio/');
  const shouldUseFullBleedMain = isPortfolioRoute || (isMarketplaceRoute && !isRecruiterMarketplaceRoute);
  const dashboardHomePath = resolvedRole ? roleRedirect(resolvedRole) : '/dashboard';
  const hasMessagesItem = navItems.some(
    (item) => item.kind === 'link' && item.label === 'Messages',
  );
  const { data: notificationsData, unreadCount: unreadNotificationsCount } = useNotifications();
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
  const notifications = notificationsData ?? [];
  const unreadSidebarNotificationState = useMemo(
    () => getUnreadSidebarNotificationState(notifications),
    [notifications],
  );

  useEffect(() => {
    const matchingUnreadNotifications = notifications.filter((notification) => {
      if (notification.isRead || autoMarkedNotificationIds.current.has(notification._id)) {
        return false;
      }

      return doesCurrentPathMatchTargets(location.pathname, [
        ...getNotificationTargets(notification),
        ...(getNotificationNavigationTarget(notification, resolvedRole)
          ? [normalizeNotificationPath(getNotificationNavigationTarget(notification, resolvedRole)!)]
          : []),
      ]);
    });

    if (matchingUnreadNotifications.length === 0) {
      return;
    }

    matchingUnreadNotifications.forEach((notification) => {
      autoMarkedNotificationIds.current.add(notification._id);

      notificationApi
        .markRead(notification._id)
        .then((updated) => {
          queryClient.setQueryData<NotificationItem[] | undefined>(['notifications'], (current) =>
            current?.map((item) => (item._id === updated._id ? updated : item)),
          );
        })
        .catch(() => {
          autoMarkedNotificationIds.current.delete(notification._id);
        });
    });
  }, [location.pathname, notifications, queryClient]);

  useEffect(() => {
    mainScrollRef.current?.scrollTo({ top: 0, left: 0 });
  }, [location.pathname]);

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

    const matchedSharedRouteLabel = SHARED_ROUTE_LABELS.find((item) => isPathActive(item.path));
    if (matchedSharedRouteLabel) {
      return matchedSharedRouteLabel.label;
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
  };

  const getNavNotificationText = (label: string) => {
    if (label === 'Messages' && unreadMessagesCount > 0) {
      return `${unreadMessagesCount} unread messages`;
    }

    return `Unread ${label.toLowerCase()} notifications`;
  };

  const shouldShowNavIndicator = (label: string) => {
    if (label === 'Applications') {
      return unreadSidebarNotificationState.applications;
    }

    if (label === 'Marketplace' && resolvedRole === UserRole.RECRUITER) {
      return unreadSidebarNotificationState.applications;
    }

    if (label === 'Events' || label === 'Hiring Events') {
      return unreadSidebarNotificationState.events;
    }

    if (label === 'Drive' && resolvedRole === UserRole.RECRUITER) {
      return unreadSidebarNotificationState.events;
    }

    if (label === 'Messages') {
      return unreadMessagesCount > 0 || unreadSidebarNotificationState.messages;
    }

    return false;
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
      {shouldShowNavIndicator(label) ? (
        <>
          <span
            aria-hidden="true"
            className="ml-auto inline-flex h-2.5 w-2.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.7)]"
          />
          <span className="sr-only">{getNavNotificationText(label)}</span>
        </>
      ) : null}
    </NavLink>
  );

  const renderItem = (item: DashboardNavItem) => {
    if (item.kind === 'header') {
      return (
        <div
          key={item.label}
          className="px-4 pt-4 pb-1.5 text-[10px] font-bold uppercase tracking-[0.25em] text-slate-500/80 cursor-default select-none pointer-events-none"
        >
          {item.label}
        </div>
      );
    }

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

  const renderAccountMenu = ({
    align = 'end' as 'start' | 'end',
    side = 'bottom' as 'top' | 'bottom',
  } = {}) => {
    if (accountMenuItems.length === 0) {
      return null;
    }

    const roleBadgeStyles: Record<string, string> = {
      [UserRole.INVESTOR]: 'border-teal-300/20 bg-teal-300/10 text-teal-200',
      [UserRole.RECRUITER]: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
      [UserRole.STUDENT]: 'border-sky-300/20 bg-sky-300/10 text-sky-200',
      [UserRole.MENTOR]: 'border-violet-300/20 bg-violet-300/10 text-violet-200',
      [UserRole.SCHOOL]: 'border-pink-300/20 bg-pink-300/10 text-pink-200',
      [UserRole.COLLEGE]: 'border-indigo-300/20 bg-indigo-300/10 text-indigo-200',
      [UserRole.ADMIN]: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
    };

    const currentBadgeStyle = roleBadgeStyles[user.role] ?? 'border-slate-500/20 bg-slate-500/10 text-slate-200';

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Open account menu"
            className="group relative flex min-w-0 items-center gap-3 overflow-hidden rounded-[1.35rem] border border-white/[0.08] bg-[#0b1020]/85 px-2.5 py-2 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_18px_38px_rgba(0,0,0,0.22)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-200/20 hover:bg-[#10172a]/95 data-[state=open]:-translate-y-0.5 data-[state=open]:border-cyan-200/25 data-[state=open]:bg-[#10172a]/95 sm:min-w-[13.5rem]"
          >
            <span className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-cyan-100/30 to-transparent" />
            <span className="pointer-events-none absolute inset-y-2 left-[3.75rem] w-px bg-white/[0.06]" />
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] text-sm font-black tracking-tight text-white shadow-[0_12px_26px_rgba(56,189,248,0.16)] sm:h-11 sm:w-11">
              <div className="absolute inset-0 overflow-hidden rounded-[1rem] bg-[linear-gradient(135deg,#5b21b6_0%,#312e81_54%,#0f766e_100%)]" />
              <div className="absolute inset-[1px] flex items-center justify-center overflow-hidden rounded-[0.92rem] bg-slate-950/20">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border border-[#0b1020] bg-[#0b1020]">
                <span className="h-2.5 w-2.5 rounded-full bg-teal-300 shadow-[0_0_12px_rgba(94,234,212,0.75)]" />
              </span>
            </div>
            <div className="hidden min-w-0 flex-1 md:block">
              <div className="mb-1 flex items-center gap-2">
                <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-slate-500">
                  Account
                </span>
                <span className={`inline-flex max-w-[5.75rem] items-center rounded-md border px-1.5 py-[2px] text-[9px] font-bold uppercase leading-none tracking-[0.16em] ${currentBadgeStyle}`}>
                  <span className="truncate">{user.role}</span>
                </span>
              </div>
              <div className="truncate text-sm font-semibold leading-tight text-slate-100 transition-colors duration-200 group-hover:text-white">
                {user.displayName}
              </div>
            </div>
            <ChevronDown className="hidden h-4 w-4 shrink-0 text-slate-500 transition-all duration-200 group-hover:text-cyan-100 group-data-[state=open]:rotate-180 group-data-[state=open]:text-cyan-100 sm:block" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align={align}
          side={side}
          sideOffset={12}
          className="w-[20rem] rounded-2xl border border-white/10 bg-[#070c19]/95 backdrop-blur-xl p-3 text-slate-50 shadow-[0_28px_52px_rgba(2,6,23,0.7)]"
        >
          {/* Profile Quick Overview */}
          <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 mb-3">
            <div className="flex items-center gap-3">
              <div className="relative h-12 w-12 shrink-0 rounded-xl overflow-hidden bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 flex items-center justify-center font-black text-white text-base shadow-[0_0_15px_rgba(139,92,246,0.3)]">
                {user.avatar ? (
                  <img src={user.avatar} alt={user.displayName} className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-white leading-snug">
                  {user.displayName}
                </div>
                <div className="truncate text-xs text-slate-400 font-medium leading-none mt-0.5">
                  {user.email}
                </div>
              </div>
            </div>
            
            {/* Innovation Score & Role Info */}
            <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/5">
              {user.role === UserRole.STUDENT ? (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Score:</span>
                    <span className="text-xs font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                      {user.innovationScore ?? 0}
                    </span>
                  </div>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider ${currentBadgeStyle}`}>
                    {user.role}
                  </span>
                </>
              ) : (
                <div className="flex w-full justify-end">
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${currentBadgeStyle}`}>
                    {user.role}
                  </span>
                </div>
              )}
            </div>
          </div>

          <DropdownMenuSeparator className="bg-white/5 my-1" />

          {/* Menu Items */}
          <div className="space-y-1">
            {accountMenuItems.map((item) => {
              const isLogout = item.kind === 'action' && item.action === 'logout';
              
              // Custom colors & descriptions
              let iconColor = 'text-cyan-400';
              let hoverBg = 'hover:bg-cyan-500/5 hover:border-cyan-500/15';
              let description = 'Manage settings';
              
              if (item.label === 'Portfolio' || item.label === 'Profile') {
                iconColor = 'text-amber-400';
                hoverBg = 'hover:bg-amber-500/5 hover:border-amber-500/15';
                description = 'Showcase achievements';
              } else if (item.label === 'Settings') {
                iconColor = 'text-blue-400';
                hoverBg = 'hover:bg-blue-500/5 hover:border-blue-500/15';
                description = 'Configure preferences';
              } else if (isLogout) {
                iconColor = 'text-rose-400';
                hoverBg = 'hover:bg-rose-500/5 hover:border-rose-500/15';
                description = 'Sign out of session';
              }

              const handleSelect = () => {
                if (item.kind === 'link') {
                  trackNavigationClick(item.path, item.label);
                  navigate(item.path);
                  setSidebarOpen(false);
                } else {
                  void handleLogout();
                }
              };

              return (
                <DropdownMenuItem
                  key={item.label}
                  onSelect={handleSelect}
                  className={`group flex items-start gap-3 rounded-xl border border-transparent p-2.5 transition-all duration-200 cursor-pointer focus:bg-white/5 focus:text-slate-50 ${hoverBg}`}
                >
                  <div className={`p-2 rounded-lg bg-white/5 group-hover:scale-105 transition-transform duration-200 ${iconColor}`}>
                    <item.icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-100 group-hover:text-white transition-colors">
                      {item.label}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5 leading-none">
                      {description}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 self-center opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all duration-200" />
                </DropdownMenuItem>
              );
            })}
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div className="dashboard-theme-bg fixed inset-0 overflow-hidden">
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
            <div className="space-y-2">{sidebarNavItems.map(renderItem)}</div>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {!isPortfolioRoute ? (
            <header className="dashboard-theme-border dashboard-theme-header sticky top-0 z-30 border-b backdrop-blur-xl">
              <div className="flex items-center justify-between gap-3 px-4 py-4 lg:px-8">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Button variant="ghost" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                    <Menu className="h-5 w-5" />
                  </Button>
                  <div className="min-w-0">
                    <div className="dashboard-theme-faint text-xs uppercase tracking-[0.3em]">Workspace</div>
                    <div className="dashboard-theme-text mt-1 truncate text-xl font-semibold">{currentLabel}</div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2 sm:gap-3">
                  <GlobalWorkspaceInviteDialog />
                  <NotificationBell notifications={notifications} unreadCount={unreadNotificationsCount} role={resolvedRole} />
                  {renderAccountMenu()}
                </div>
              </div>
            </header>
          ) : null}

          <main
            ref={mainScrollRef}
            className={`flex min-h-0 flex-1 flex-col overflow-y-auto ${
              shouldUseFullBleedMain ? 'min-w-0 p-0' : 'min-w-0 px-4 py-6 lg:px-8'
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
