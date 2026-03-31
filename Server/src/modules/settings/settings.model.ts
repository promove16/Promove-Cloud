import { Schema, Types, model } from 'mongoose';
import { ISettingsDocument } from './settings.types';

const notificationChannelSchema = new Schema(
  {
    messages: { type: Boolean, default: true },
    deals: { type: Boolean, default: true },
    sessions: { type: Boolean, default: true },
    patents: { type: Boolean, default: true },
    platform: { type: Boolean, default: true },
  },
  { _id: false },
);

const settingsSchema = new Schema<ISettingsDocument>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },

    // Account
    displayName: {
      type: String,
      trim: true,
      default: undefined,
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 500,
      default: undefined,
    },
    timezone: {
      type: String,
      default: 'UTC',
    },
    language: {
      type: String,
      default: 'en',
    },

    // Notifications
    notifications: {
      email: { type: notificationChannelSchema, default: () => ({}) },
      inApp: { type: notificationChannelSchema, default: () => ({}) },
    },

    // Privacy
    privacy: {
      type: new Schema(
        {
          profileVisibility: {
            type: String,
            enum: ['public', 'private', 'connections'],
            default: 'public',
          },
          showEmail: { type: Boolean, default: false },
          showPhone: { type: Boolean, default: false },
          allowDMs: {
            type: String,
            enum: ['all', 'connections', 'none'],
            default: 'all',
          },
          showOnlineStatus: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Appearance
    appearance: {
      type: new Schema(
        {
          theme: {
            type: String,
            enum: ['dark', 'light', 'system'],
            default: 'dark',
          },
          compactMode: { type: Boolean, default: false },
          showAnimations: { type: Boolean, default: true },
        },
        { _id: false },
      ),
      default: () => ({}),
    },

    // Role-specific
    roleSettings: {
      type: new Schema(
        {
          // Student
          jobSeeking: { type: Boolean },
          openToMentorship: { type: Boolean },
          innovationVisibility: { type: String, enum: ['public', 'private'] },

          // Investor
          dealFlowNotifications: { type: Boolean },
          minInvestmentSize: { type: Number },
          maxInvestmentSize: { type: Number },
          preferredSectors: [{ type: String }],

          // Mentor
          availableForSessions: { type: Boolean },
          sessionTypes: [{ type: String, enum: ['video', 'text', 'in-person'] }],
          maxStudents: { type: Number },

          // Recruiter
          activelyHiring: { type: Boolean },
          preferredRoles: [{ type: String }],

          // School/College
          publicProfile: { type: Boolean },
          allowStudentApplications: { type: Boolean },
        },
        { _id: false },
      ),
      default: () => ({}),
    },
  },
  {
    timestamps: true,
  },
);

export const Settings = model<ISettingsDocument>('Settings', settingsSchema);
