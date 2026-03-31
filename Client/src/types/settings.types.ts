export type NotificationChannel = 'email' | 'inApp';
export type NotificationCategory = 'messages' | 'deals' | 'sessions' | 'patents' | 'platform';
export type ProfileVisibility = 'public' | 'private' | 'connections';
export type DmPermission = 'all' | 'connections' | 'none';
export type AppTheme = 'dark' | 'light' | 'system';
export type InnovationVisibility = 'public' | 'private';
export type SessionType = 'video' | 'text' | 'in-person';

export interface NotificationPreferences {
  messages: boolean;
  deals: boolean;
  sessions: boolean;
  patents: boolean;
  platform: boolean;
}

export interface UserSettings {
  _id?: string;
  userId?: string;
  displayName?: string;
  bio?: string;
  timezone: string;
  language: string;
  notifications: {
    email: NotificationPreferences;
    inApp: NotificationPreferences;
  };
  privacy: {
    profileVisibility: ProfileVisibility;
    showEmail: boolean;
    showPhone: boolean;
    allowDMs: DmPermission;
    showOnlineStatus: boolean;
  };
  appearance: {
    theme: AppTheme;
    compactMode: boolean;
    showAnimations: boolean;
  };
  roleSettings: {
    // Student
    jobSeeking?: boolean;
    openToMentorship?: boolean;
    innovationVisibility?: InnovationVisibility;
    // Investor
    dealFlowNotifications?: boolean;
    minInvestmentSize?: number;
    maxInvestmentSize?: number;
    preferredSectors?: string[];
    // Mentor
    availableForSessions?: boolean;
    sessionTypes?: SessionType[];
    maxStudents?: number;
    // Recruiter
    activelyHiring?: boolean;
    preferredRoles?: string[];
    // School/College
    publicProfile?: boolean;
    allowStudentApplications?: boolean;
  };
}

export type SettingsUpdate = Partial<UserSettings>;
