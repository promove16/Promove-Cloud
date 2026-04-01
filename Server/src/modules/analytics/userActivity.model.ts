import { HydratedDocument, Model, Schema, model } from 'mongoose';
import { IUserActivity } from './activity.types';

const USER_ACTIVITY_RETENTION_SECONDS = 90 * 24 * 60 * 60;

type UserActivityDocument = HydratedDocument<IUserActivity>;
type UserActivityModel = Model<IUserActivity>;

const userActivitySchema = new Schema<IUserActivity, UserActivityModel>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['login', 'api_request', 'page_view', 'navigation_click'],
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ['server', 'client'],
      required: true,
    },
    path: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
      index: true,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    feature: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
      index: true,
    },
    method: {
      type: String,
      trim: true,
      maxlength: 10,
    },
    statusCode: {
      type: Number,
      min: 100,
      max: 599,
    },
    durationMs: {
      type: Number,
      min: 0,
    },
    isWrite: {
      type: Boolean,
      default: false,
    },
    referrerPath: {
      type: String,
      trim: true,
      maxlength: 240,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: USER_ACTIVITY_RETENTION_SECONDS });
userActivitySchema.index({ userId: 1, createdAt: -1 });
userActivitySchema.index({ eventType: 1, createdAt: -1 });
userActivitySchema.index({ path: 1, createdAt: -1 });

export const UserActivity = model<IUserActivity, UserActivityModel>('UserActivity', userActivitySchema);
export type { UserActivityDocument };
