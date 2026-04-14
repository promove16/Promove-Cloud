import {
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  FileText,
  FolderKanban,
  Globe,
  GraduationCap,
  Home,
  LifeBuoy,
  LogOut,
  MessageCircle,
  Rocket,
  Settings,
  Sparkles,
  Trophy,
  User,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { getMarketplaceBasePath } from '../../features/marketplace/navigation';
import { STARTUP_LAUNCH_BASE_PATH } from '../../features/startup/navigation';
import { UserRole } from '../../types/roles.types';

export interface DashboardNavLinkItem {
  kind: 'link';
  label: string;
  icon: LucideIcon;
  path: string;
}

export interface DashboardNavGroupItem {
  kind: 'group';
  label: string;
  icon: LucideIcon;
  path: string;
  children: Array<Pick<DashboardNavLinkItem, 'label' | 'path'>>;
}

export interface DashboardNavActionItem {
  kind: 'action';
  label: string;
  icon: LucideIcon;
  action: 'logout';
}

export type DashboardNavItem = DashboardNavLinkItem | DashboardNavGroupItem | DashboardNavActionItem;

export interface DashboardRouteLabelItem {
  path: string;
  label: string;
}

export const SIDEBAR_CONFIG: Record<UserRole, DashboardNavItem[]> = {
  [UserRole.STUDENT]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/student' },
    { kind: 'link', label: 'Problem Bank', icon: Sparkles, path: '/problem-bank' },
    { kind: 'link', label: 'Startup', icon: Rocket, path: STARTUP_LAUNCH_BASE_PATH },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: getMarketplaceBasePath(UserRole.STUDENT) },
    { kind: 'link', label: 'Events', icon: CalendarDays, path: '/dashboard/student/events' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.SCHOOL]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/school' },
    { kind: 'link', label: 'Operations', icon: Home, path: '/dashboard/school/operations' },
    { kind: 'link', label: 'Analytics', icon: BarChart3, path: '/dashboard/school/analytics' },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.COLLEGE]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/college' },
    { kind: 'link', label: 'Operations', icon: Home, path: '/dashboard/college/operations' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: getMarketplaceBasePath(UserRole.COLLEGE) },
    { kind: 'link', label: 'Placement Tracker', icon: BarChart3, path: '/dashboard/college/placement' },
    { kind: 'link', label: 'Analytics', icon: BarChart3, path: '/dashboard/college/analytics' },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.MENTOR]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/mentor' },
    { kind: 'link', label: 'Problem Bank', icon: Sparkles, path: '/problem-bank' },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: getMarketplaceBasePath(UserRole.MENTOR) },
    { kind: 'link', label: 'Student Feed', icon: Users, path: '/dashboard/mentor/students' },
    { kind: 'link', label: 'Sessions', icon: GraduationCap, path: '/dashboard/mentor/sessions' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.INVESTOR]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/investor' },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: '/dashboard/investor/startups' },
    { kind: 'link', label: 'Product Workshop', icon: FolderKanban, path: '/dashboard/investor/product-workshop' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.RECRUITER]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/recruiter' },
    { kind: 'link', label: 'Portfolio', icon: Trophy, path: '/portfolio' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: getMarketplaceBasePath(UserRole.RECRUITER) },
    { kind: 'link', label: 'Drive', icon: BarChart3, path: '/dashboard/recruiter/drives' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.ADMIN]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/admin' },
    { kind: 'link', label: 'Problems', icon: Sparkles, path: '/dashboard/admin/problems' },
    { kind: 'link', label: 'Users', icon: Users, path: '/dashboard/admin/users' },
    { kind: 'link', label: 'Patents', icon: FileText, path: '/dashboard/admin/patents' },
    { kind: 'link', label: 'Startups', icon: Rocket, path: '/dashboard/admin/startups' },
    { kind: 'link', label: 'Deals', icon: BriefcaseBusiness, path: '/dashboard/admin/deals' },
    { kind: 'link', label: 'Mentorship', icon: GraduationCap, path: '/dashboard/admin/mentorship' },
    { kind: 'link', label: 'Help Desk', icon: LifeBuoy, path: '/dashboard/admin/help-desk' },
    { kind: 'link', label: 'Analytics', icon: BarChart3, path: '/dashboard/admin/analytics' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
};

export const DASHBOARD_ROUTE_LABELS: Partial<Record<UserRole, DashboardRouteLabelItem[]>> = {
  [UserRole.SCHOOL]: [
    { path: '/dashboard/school/operations', label: 'Operations' },
    { path: '/dashboard/school/students', label: 'Student Innovators' },
    { path: '/dashboard/school/mentors', label: 'Mentorship' },
    { path: '/dashboard/school/events', label: 'Events' },
    { path: '/dashboard/school/projects', label: 'Projects' },
    { path: '/dashboard/school/patents', label: 'Patents' },
    { path: '/dashboard/school/startups', label: 'Startups' },
    { path: '/dashboard/school/analytics', label: 'Analytics' },
  ],
  [UserRole.COLLEGE]: [
    { path: '/dashboard/college/operations', label: 'Operations' },
    { path: '/dashboard/college/students', label: 'Student Innovators' },
    { path: '/dashboard/college/mentors', label: 'Mentorship' },
    { path: '/dashboard/college/events', label: 'Events' },
    { path: '/dashboard/college/projects', label: 'Projects' },
    { path: '/dashboard/college/analytics', label: 'Analytics' },
  ],
  [UserRole.RECRUITER]: [
    { path: '/dashboard/recruiter/applications', label: 'Applications' },
    { path: '/dashboard/recruiter/colleges', label: 'College Students' },
    { path: '/dashboard/recruiter/hiring-events', label: 'Hiring Events' },
    { path: '/dashboard/recruiter/onboarding', label: 'Onboarding Tracker' },
  ],
};
