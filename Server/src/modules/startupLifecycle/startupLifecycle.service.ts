import { Types } from 'mongoose';
import { io } from '../../config/socket';
import { UserRole } from '../../types/roles.types';
import { ApiError } from '../../utils/ApiError';
import { Deal } from '../deal/deal.model';
import { Workspace } from '../workspace/workspace.model';
import { Startup } from '../startup/startup.model';
import {
  StartupLifecycleEvent,
  StartupLifecycleSource,
} from './startupLifecycle.model';

type LifecycleInput = {
  startupId?: string | Types.ObjectId;
  workspaceId?: string | Types.ObjectId;
  actorId?: string | Types.ObjectId;
  source: StartupLifecycleSource;
  type: string;
  title: string;
  description?: string;
  status?: string;
  metadata?: Record<string, unknown>;
};

const toObjectId = (value?: string | Types.ObjectId) => {
  if (!value) return undefined;
  return value instanceof Types.ObjectId ? value : new Types.ObjectId(value);
};

const serializeLifecycleEvent = (event: Record<string, any>) => ({
  _id: String(event._id),
  startupId: String(event.startupId),
  ...(event.workspaceId ? { workspaceId: String(event.workspaceId) } : {}),
  ...(event.actorId ? { actorId: String(event.actorId) } : {}),
  source: event.source,
  type: event.type,
  title: event.title,
  ...(event.description ? { description: event.description } : {}),
  ...(event.status ? { status: event.status } : {}),
  metadata: event.metadata ?? {},
  createdAt: event.createdAt instanceof Date ? event.createdAt.toISOString() : event.createdAt,
  updatedAt: event.updatedAt instanceof Date ? event.updatedAt.toISOString() : event.updatedAt,
});

const findStartupForWorkspace = async (workspaceId?: string | Types.ObjectId) => {
  if (!workspaceId) return null;
  return Startup.findOne({ projectId: workspaceId, isActive: true })
    .select('_id founderIds teamMemberIds projectId')
    .lean<{
      _id: Types.ObjectId;
      founderIds: Types.ObjectId[];
      teamMemberIds: Types.ObjectId[];
      projectId?: Types.ObjectId;
    } | null>();
};

const emitLifecycleEvent = (
  event: ReturnType<typeof serializeLifecycleEvent>,
  participantIds: string[],
) => {
  const namespace = io.of('/notifications');
  namespace.to(`startup:${event.startupId}`).emit('startup:lifecycle:event', event);
  participantIds.forEach((participantId) => {
    namespace.to(`user:${participantId}`).emit('startup:lifecycle:event', event);
    namespace.to(`user:${participantId}`).emit('startup:updated', {
      startupId: event.startupId,
      source: event.source,
      type: event.type,
    });
  });
};

export const recordStartupLifecycleEvent = async (input: LifecycleInput) => {
  const linkedStartup = input.startupId
    ? await Startup.findById(input.startupId)
        .select('_id founderIds teamMemberIds projectId')
        .lean<{
          _id: Types.ObjectId;
          founderIds: Types.ObjectId[];
          teamMemberIds: Types.ObjectId[];
          projectId?: Types.ObjectId;
        } | null>()
    : await findStartupForWorkspace(input.workspaceId);

  if (!linkedStartup) {
    return null;
  }

  const event = await StartupLifecycleEvent.create({
    startupId: linkedStartup._id,
    ...(input.workspaceId || linkedStartup.projectId
      ? { workspaceId: toObjectId(input.workspaceId ?? linkedStartup.projectId) }
      : {}),
    ...(input.actorId ? { actorId: toObjectId(input.actorId) } : {}),
    source: input.source,
    type: input.type,
    title: input.title,
    ...(input.description ? { description: input.description } : {}),
    ...(input.status ? { status: input.status } : {}),
    metadata: input.metadata ?? {},
  });

  const serialized = serializeLifecycleEvent(event.toObject());
  const participantIds = Array.from(
    new Set([
      ...linkedStartup.founderIds.map(String),
      ...linkedStartup.teamMemberIds.map(String),
    ]),
  );
  emitLifecycleEvent(serialized, participantIds);

  return serialized;
};

export const listStartupLifecycleEvents = async (startupId: string, limit = 100) => {
  const events = await StartupLifecycleEvent.find({ startupId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .lean();

  return events.map(serializeLifecycleEvent);
};

const assertCanReadStartupTimeline = async (
  startupId: string,
  userId: string,
  role: UserRole,
) => {
  if (role === UserRole.ADMIN) {
    return;
  }

  const startup = await Startup.findOne({ _id: startupId, isActive: true })
    .select('_id founderIds teamMemberIds projectId')
    .lean<{
      _id: Types.ObjectId;
      founderIds: Types.ObjectId[];
      teamMemberIds: Types.ObjectId[];
      projectId?: Types.ObjectId;
    } | null>();

  if (!startup) {
    throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
  }

  const isStartupMember =
    startup.founderIds.some((id) => String(id) === userId) ||
    startup.teamMemberIds.some((id) => String(id) === userId);

  if (isStartupMember) {
    return;
  }

  if (startup.projectId) {
    const hasWorkspaceAccess = await Workspace.exists({
      _id: startup.projectId,
      isActive: true,
      $or: [
        { ownerId: userId },
        { teamMemberIds: userId },
        { 'chatParticipants.userId': userId },
      ],
    });
    if (hasWorkspaceAccess) {
      return;
    }
  }

  if (role === UserRole.INVESTOR) {
    const hasInvestorAccess = await Deal.exists({
      startupId,
      investorId: userId,
      status: { $ne: 'cancelled' },
      $or: [{ 'founderDecision.status': 'accepted' }, { stage: { $gte: 2 } }],
    });
    if (hasInvestorAccess) {
      return;
    }
  }

  throw new ApiError(404, 'STARTUP_NOT_FOUND', 'Startup not found.');
};

export const listStartupLifecycleEventsForUser = async (
  startupId: string,
  userId: string,
  role: UserRole,
  limit = 100,
) => {
  await assertCanReadStartupTimeline(startupId, userId, role);
  const events = await StartupLifecycleEvent.find({ startupId })
    .sort({ createdAt: -1 })
    .limit(Math.min(Math.max(limit, 1), 200))
    .lean();

  return events.map(serializeLifecycleEvent);
};
