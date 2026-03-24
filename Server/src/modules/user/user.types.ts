import { Types } from 'mongoose';
import { UserRole } from '../../types/roles.types';

export type AccessGrantedBy =
  | 'startup_school'
  | 'instant_internship'
  | 'skill_dev'
  | 'iii'
  | 'admin';

export interface ScoreBreakdown {
  problemsClaimed: number;
  skillsCompleted: number;
  progressUploads: number;
  patentsSubmitted: number;
  patentsApproved: number;
  mvpsVerified: number;
  marketReadyVerified: number;
  startupsLaunched: number;
  awardsApproved: number;
}

export interface IUser {
  _id: Types.ObjectId;
  email: string;
  passwordHash: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  profileComplete: boolean;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  institutionId?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface SanitizedUser {
  _id: string;
  email: string;
  role: UserRole;
  displayName: string;
  avatar?: string;
  bio?: string;
  domain?: string;
  profileComplete: boolean;
  innovationScore: number;
  scoreBreakdown: ScoreBreakdown;
  accessGrantedBy: AccessGrantedBy;
  accessExpiresAt: Date;
  isActive: boolean;
  lastLogin?: Date;
  discoverableToRecruiters?: boolean;
  institutionId?: string;
  createdAt: Date;
  updatedAt: Date;
}
