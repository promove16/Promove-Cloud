import { Types } from 'mongoose';
import { deleteFromCloudinary } from './cloudinaryService';
import { logError, logger } from '../config/logger';
import { DirectMessage } from '../modules/dm/dm.model';
import { ChatMessage } from '../modules/chat/chat.model';
import { Workspace } from '../modules/workspace/workspace.model';

const deleteCloudinaryAssets = async (
  items: Array<{ publicId?: string; resourceType: 'image' | 'raw' }>,
) => {
  const seen = new Set<string>();

  await Promise.allSettled(
    items.flatMap((item) => {
      if (!item.publicId || seen.has(item.publicId)) {
        return [];
      }

      seen.add(item.publicId);
      return deleteFromCloudinary(item.publicId, item.resourceType);
    }),
  );
};

export const cleanupTemporaryMemory = async (now = new Date()) => {
  const expiredDirectMessages = await DirectMessage.find({
    memoryMode: 'temporary',
    expiresAt: { $lte: now },
  })
    .select('_id attachmentPublicId attachmentType')
    .lean();

  await deleteCloudinaryAssets(
    expiredDirectMessages.map((message) => ({
      publicId: message.attachmentPublicId,
      resourceType: message.attachmentType === 'pdf' ? 'raw' : 'image',
    })),
  );

  if (expiredDirectMessages.length > 0) {
    await DirectMessage.deleteMany({
      _id: {
        $in: expiredDirectMessages.map((message) => new Types.ObjectId(message._id)),
      },
    });
  }

  const expiredWorkspaceMessages = await ChatMessage.deleteMany({
    memoryMode: 'temporary',
    expiresAt: { $lte: now },
  });

  const workspacesWithExpiredUploads = await Workspace.find({
    'uploads.memoryMode': 'temporary',
    'uploads.expiresAt': { $lte: now },
  }).select('_id uploads');

  let deletedWorkspaceUploads = 0;

  for (const workspace of workspacesWithExpiredUploads) {
    const expiredUploads = workspace.uploads.filter(
      (upload) => upload.memoryMode === 'temporary' && upload.expiresAt && upload.expiresAt <= now,
    );

    if (expiredUploads.length === 0) {
      continue;
    }

    await deleteCloudinaryAssets(
      expiredUploads.map((upload) => ({
        publicId: upload.cloudinaryPublicId,
        resourceType: upload.fileType === 'pdf' ? 'raw' : 'image',
      })),
    );

    deletedWorkspaceUploads += expiredUploads.length;
    workspace.uploads = workspace.uploads.filter(
      (upload) => !(upload.memoryMode === 'temporary' && upload.expiresAt && upload.expiresAt <= now),
    );
    await workspace.save();
  }

  return {
    deletedDirectMessages: expiredDirectMessages.length,
    deletedWorkspaceMessages: expiredWorkspaceMessages.deletedCount ?? 0,
    deletedWorkspaceUploads,
  };
};

export const runTemporaryMemoryCleanupOnce = async () => {
  try {
    const result = await cleanupTemporaryMemory();

    if (
      result.deletedDirectMessages > 0 ||
      result.deletedWorkspaceMessages > 0 ||
      result.deletedWorkspaceUploads > 0
    ) {
      logger.info('Temporary memory cleanup completed', result);
    }
  } catch (error) {
    logError('Temporary memory cleanup failed', error);
  }
};
