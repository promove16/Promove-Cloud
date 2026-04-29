import { Schema, model } from 'mongoose';

export type StartupLifecycleSource =
  | 'startup'
  | 'workspace'
  | 'patent'
  | 'investor'
  | 'marketplace'
  | 'admin';

export interface IStartupLifecycleEvent {
  startupId: Schema.Types.ObjectId;
  workspaceId?: Schema.Types.ObjectId;
  actorId?: Schema.Types.ObjectId;
  source: StartupLifecycleSource;
  type: string;
  title: string;
  description?: string;
  status?: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const startupLifecycleEventSchema = new Schema<IStartupLifecycleEvent>(
  {
    startupId: {
      type: Schema.Types.ObjectId,
      ref: 'Startup',
      required: true,
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      default: undefined,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: undefined,
      index: true,
    },
    source: {
      type: String,
      enum: ['startup', 'workspace', 'patent', 'investor', 'marketplace', 'admin'],
      required: true,
      index: true,
    },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 160 },
    description: { type: String, default: undefined, trim: true, maxlength: 1000 },
    status: { type: String, default: undefined, trim: true, maxlength: 80 },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true },
);

startupLifecycleEventSchema.index({ startupId: 1, createdAt: -1 });
startupLifecycleEventSchema.index({ workspaceId: 1, createdAt: -1 });
startupLifecycleEventSchema.index({ source: 1, type: 1, createdAt: -1 });

export const StartupLifecycleEvent = model<IStartupLifecycleEvent>(
  'StartupLifecycleEvent',
  startupLifecycleEventSchema,
);
