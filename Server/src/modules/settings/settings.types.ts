import { Document, Types } from 'mongoose';

export interface IUserSettings {
  userId: Types.ObjectId;

  // Account
  displayName?: string;
  bio?: string;
  timezone: string;
  language: string;

  // Notifications
  notifications: {
    email: {
      messages: boolean;
      deals: boolean;
      sessions: boolean;
      patents: boolean;
      platform: boolean;
    };
    inApp: {
      messages: boolean;
      deals: boolean;
      sessions: boolean;
      patents: boolean;
      platform: boolean;
    };
  };

  // Privacy
  privacy: {
    profileVisibility: 'public' | 'private' | 'connections';
    showEmail: boolean;
    showPhone: boolean;
    allowDMs: 'all' | 'connections' | 'none';
    showOnlineStatus: boolean;
  };

  // Appearance
  appearance: {
    compactMode: boolean;
    showAnimations: boolean;
  };

  // Role-specific
  roleSettings: {
    // Student
    jobSeeking?: boolean;
    openToMentorship?: boolean;
    innovationVisibility?: 'public' | 'private';

    // Investor
    dealFlowNotifications?: boolean;
    minInvestmentSize?: number;
    maxInvestmentSize?: number;
    preferredSectors?: string[];

    // Mentor
    availableForSessions?: boolean;
    sessionTypes?: ('video' | 'text' | 'in-person')[];
    maxStudents?: number;

    // Recruiter
    activelyHiring?: boolean;
    preferredRoles?: string[];

    // School/College
    publicProfile?: boolean;
    allowStudentApplications?: boolean;
  };

  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsDocument extends IUserSettings, Document {}
