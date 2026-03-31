import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  FileText,
  Globe,
  GraduationCap,
  Home,
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
import { UserRole } from '../../types/roles.types';

export type DashboardNavItem =
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

export const SIDEBAR_CONFIG: Record<UserRole, DashboardNavItem[]> = {
  [UserRole.STUDENT]: [
    { kind: 'link', label: 'Dashboard', icon: Home, path: '/dashboard/student' },
    { kind: 'link', label: 'Problem Bank', icon: Sparkles, path: '/problem-bank' },
    { kind: 'link', label: 'Product Workspace', icon: Trophy, path: '/product-workspace' },
    { kind: 'link', label: 'Patent Support', icon: FileText, path: '/patent-support' },
    { kind: 'link', label: 'Startup Launch', icon: Rocket, path: '/startup-launch' },
    { kind: 'link', label: 'Cap Table', icon: BarChart3, path: '/startup-launch/cap-table' },
    { kind: 'link', label: 'Mentor Sessions', icon: CalendarDays, path: '/dashboard/student/mentor-sessions' },
    { kind: 'link', label: 'Investor Deals', icon: BriefcaseBusiness, path: '/dashboard/student/investor-deals' },
    { kind: 'link', label: 'Leadership Profile', icon: Trophy, path: '/leadership-profile' },
    { kind: 'link', label: 'Marketplace', icon: Globe, path: '/marketplace' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
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
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
  [UserRole.INVESTOR]: [
    { kind: 'link', label: 'Deal Flow', icon: ArrowRight, path: '/dashboard/investor' },
    { kind: 'link', label: 'Startups', icon: Rocket, path: '/dashboard/investor/startups' },
    { kind: 'link', label: 'Institutions', icon: Building2, path: '/dashboard/investor/institutions' },
    { kind: 'link', label: 'My Portfolio', icon: BriefcaseBusiness, path: '/dashboard/investor/portfolio' },
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/messages' },
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
    { kind: 'link', label: 'Messages', icon: MessageCircle, path: '/dashboard/recruiter/messages' },
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
    { kind: 'link', label: 'Profile', icon: User, path: '/dashboard/profile' },
    { kind: 'link', label: 'Settings', icon: Settings, path: '/dashboard/settings' },
    { kind: 'action', label: 'Logout', icon: LogOut, action: 'logout' },
  ],
};
