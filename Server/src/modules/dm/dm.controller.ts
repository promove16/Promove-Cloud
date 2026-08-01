import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DirectMessage } from './dm.model';
import { User } from '../user/user.model';
import { ApiError } from '../../utils/ApiError';
import { uploadFile } from '../../services/fileStorageService';
import { serializeDirectMessage, serializeDirectMessages } from './dm.serializer';
import { ensureDmAccess, ensureDmThreadAccess } from './dm.permissions';
import { createRequest } from '../request/request.service';
import { Settings } from '../settings/settings.model';
import { Startup } from '../startup/startup.model';
import { Workspace } from '../workspace/workspace.model';
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const pdfFileNamePattern = /\.pdf$/i;
const allowedQueryTypes = new Set([
  'project_mentor',
  'project_join',
  'investor',
  'recruiter',
  'hiring_event',
  'mentorship_program',
  'general',
] as const);

const validateDmAttachmentStorage = (
  userId: string,
  attachmentStorageProvider?: unknown,
  attachmentStorageKey?: unknown,
) => {
  if (!attachmentStorageProvider && !attachmentStorageKey) {
    return {};
  }

  if (
    attachmentStorageProvider !== 's3' &&
    attachmentStorageProvider !== 'cloudinary'
  ) {
    throw new ApiError(400, 'INVALID_ATTACHMENT', 'Attachment storage provider is invalid');
  }

  if (typeof attachmentStorageKey !== 'string' || !attachmentStorageKey.trim()) {
    throw new ApiError(400, 'INVALID_ATTACHMENT', 'Attachment storage key is invalid');
  }

  const normalizedKey = attachmentStorageKey.trim();
  const expectedPrefix = `dm/${userId}/`;
  if (!normalizedKey.startsWith(expectedPrefix)) {
    throw new ApiError(400, 'INVALID_ATTACHMENT', 'Attachment does not belong to this sender');
  }

  return {
    attachmentStorageProvider,
    attachmentStorageKey: normalizedKey,
  };
};

const workflowQueryActions = {
  project_mentor: 'mentor',
  project_join: 'join',
  investor: 'invest',
  recruiter: 'hire',
  hiring_event: 'register',
  mentorship_program: 'mentor',
} as const;

const getPitchContextString = (
  context: { startupId?: unknown; workspaceId?: unknown } | undefined,
  key: 'startupId' | 'workspaceId',
) => {
  const value = context?.[key];
  return typeof value === 'string' && Types.ObjectId.isValid(value) ? value : '';
};

const resolveInvestorPitchContext = async (
  senderId: string,
  pitchContext?: { startupId?: unknown; workspaceId?: unknown },
  requireMarketplaceLaunch = false,
) => {
  const startupId = getPitchContextString(pitchContext, 'startupId');
  const explicitWorkspaceId = getPitchContextString(pitchContext, 'workspaceId');

  if (!startupId && !explicitWorkspaceId) {
    return {};
  }

  const startup = startupId
    ? await Startup.findOne({
        _id: startupId,
        isActive: true,
        founderIds: new Types.ObjectId(senderId),
        ...(requireMarketplaceLaunch
          ? { launchedToInvestors: true, reviewStatus: 'approved' }
          : {}),
      })
        .select('_id name projectId')
        .lean()
    : null;

  const workspaceId = startup?.projectId ? String(startup.projectId) : explicitWorkspaceId;
  const workspace = workspaceId
    ? await Workspace.findOne({
        _id: workspaceId,
        isActive: true,
        $or: [
          { ownerId: new Types.ObjectId(senderId) },
          { teamMemberIds: new Types.ObjectId(senderId) },
        ],
      })
        .select('_id title')
        .lean()
    : null;

  return {
    ...(startup ? { startupId: String(startup._id), startupName: startup.name } : {}),
    ...(workspace ? { workspaceId: String(workspace._id), workspaceTitle: workspace.title } : {}),
  };
};

/** Shared online-users set — populated by dmSocket */
export const onlineUsers = new Set<string>();

/** POST /api/dm/upload — upload a file and return URL */
export const uploadAttachment = async (req: Request, res: Response) => {
  const userId = req.user!._id;

  if (!req.file) {
    throw new ApiError(400, 'FILE_REQUIRED', 'A file is required');
  }

  const isAllowedMimeType = allowedMimeTypes.has(req.file.mimetype);
  const isPdfByName = pdfFileNamePattern.test(req.file.originalname);
  if (!isAllowedMimeType && !isPdfByName) {
    throw new ApiError(400, 'INVALID_FILE_TYPE', 'Only JPEG, PNG, GIF, WebP images and PDF files are allowed');
  }

  const maxSize = 10 * 1024 * 1024; // 10MB
  if (req.file.size > maxSize) {
    throw new ApiError(400, 'FILE_TOO_LARGE', 'File size must be less than 10MB');
  }

  const fileType = req.file.mimetype === 'application/pdf' || isPdfByName ? 'pdf' : 'image';
  const resourceType = fileType === 'pdf' ? 'raw' : 'image';

  const upload = await uploadFile({
    buffer: req.file.buffer,
    folder: `dm/${userId}`,
    fileName: req.file.originalname,
    contentType: req.file.mimetype || (fileType === 'pdf' ? 'application/pdf' : 'image/jpeg'),
  });

  res.json({
    success: true,
    data: {
      url: upload.url,
      publicId: upload.key,
      storageProvider: upload.provider,
      storageKey: upload.key,
      fileType,
      fileName: req.file.originalname,
      fileSize: req.file.size,
    },
  });
};

/** GET /api/dm/conversations — list recent conversation partners */
export const listConversations = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);

  // Find the most recent message per conversation partner
  const recent = await DirectMessage.aggregate([
    {
      $match: {
        $or: [{ senderId: myId }, { recipientId: myId }],
      },
    },
    { $sort: { sentAt: -1 } },
    {
      $group: {
        _id: {
          $cond: [
            { $eq: ['$senderId', myId] },
            '$recipientId',
            '$senderId',
          ],
        },
        lastMessage: { $first: '$$ROOT' },
        unreadCount: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $eq: ['$recipientId', myId] },
                  { $eq: ['$readAt', null] },
                ],
              },
              1,
              0,
            ],
          },
        },
      },
    },
    { $sort: { 'lastMessage.sentAt': -1 } },
    { $limit: 50 },
  ]);

  const filteredRecent = recent.filter((conversation) => String(conversation._id) !== String(myId));

  // Fetch user profiles for conversation partners
  const partnerIds = filteredRecent.map((r) => r._id);
  const users = await User.find({ _id: { $in: partnerIds } })
    .select('_id displayName avatar role')
    .lean();
  const partnerSettings = await Settings.find({ userId: { $in: partnerIds } })
    .select('userId privacy.showOnlineStatus')
    .lean<Array<{ userId: Types.ObjectId; privacy?: { showOnlineStatus?: boolean } }>>();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));
  const onlineVisibilityMap = new Map(
    partnerSettings.map((setting) => [
      String(setting.userId),
      setting.privacy?.showOnlineStatus ?? true,
    ]),
  );

  const conversations = filteredRecent.map((r) => ({
    partnerId: r._id,
    partner: userMap.get(r._id.toString()) ?? null,
    lastMessage: {
      _id: r.lastMessage._id,
      message: r.lastMessage.message,
      messageType: r.lastMessage.messageType,
      sentAt: r.lastMessage.sentAt,
      senderId: r.lastMessage.senderId,
      readAt: r.lastMessage.readAt ?? null,
    },
    unreadCount: r.unreadCount,
    isOnline: onlineUsers.has(r._id.toString()) && (onlineVisibilityMap.get(r._id.toString()) ?? true),
  }));

  res.json({ success: true, data: conversations });
};

/** GET /api/dm/partner/:userId — get partner profile for chat header */
export const getPartnerProfile = async (req: Request, res: Response) => {
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  await ensureDmThreadAccess(req.user!._id, userId);

  const user = await User.findById(userId)
    .select('_id displayName avatar role')
    .lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const settings = await Settings.findOne({ userId })
    .select('privacy.showOnlineStatus')
    .lean<{ privacy?: { showOnlineStatus?: boolean } } | null>();

  res.json({
    success: true,
    data: {
      ...user,
      isOnline: onlineUsers.has(user._id.toString()) && (settings?.privacy?.showOnlineStatus ?? true),
    },
  });
};

/** GET /api/dm/:userId — get message thread with a user */
export const getThread = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  await ensureDmThreadAccess(req.user!._id, userId);

  const partnerId = new Types.ObjectId(userId as string);

  // Mark messages from partner as read
  await DirectMessage.updateMany(
    { senderId: partnerId, recipientId: myId, readAt: null },
    { $set: { readAt: new Date() } },
  );

  const messages = await DirectMessage.find({
    $or: [
      { senderId: myId, recipientId: partnerId },
      { senderId: partnerId, recipientId: myId },
    ],
  })
    .sort({ sentAt: 1 })
    .limit(200)
    .lean();

  res.json({ success: true, data: await serializeDirectMessages(messages) });
};

/** PATCH /api/dm/:userId/read — mark all messages from a partner as read */
export const markAsRead = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  await ensureDmThreadAccess(req.user!._id, userId);

  const partnerId = new Types.ObjectId(userId as string);

  const result = await DirectMessage.updateMany(
    { senderId: partnerId, recipientId: myId, readAt: null },
    { $set: { readAt: new Date() } },
  );

  res.json({ success: true, data: { modifiedCount: result.modifiedCount } });
};

/** POST /api/dm/:userId — send a message */
export const sendMessage = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const rawUserId = req.params.userId;
  const userId = Array.isArray(rawUserId) ? rawUserId[0] : rawUserId;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  const recipientId = new Types.ObjectId(userId as string);
  const { message, messageType, scheduledAt, meetLink, attachmentUrl, attachmentType, attachmentName, attachmentStorageProvider, attachmentStorageKey, queryType, pitchContext } =
    req.body as {
    message?: string;
    messageType?: 'text' | 'interview_request' | 'funding_request';
    scheduledAt?: string;
    meetLink?: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'pdf';
    attachmentName?: string;
    attachmentStorageProvider?: 's3' | 'cloudinary';
    attachmentStorageKey?: string;
    pitchContext?: {
      startupId?: string;
      workspaceId?: string;
    };
    queryType?:
      | 'project_mentor'
      | 'project_join'
      | 'investor'
      | 'recruiter'
      | 'hiring_event'
      | 'mentorship_program'
      | 'general';
  };

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const type =
    messageType === 'interview_request'
      ? 'interview_request'
      : messageType === 'funding_request'
        ? 'funding_request'
        : 'text';

  if (!normalizedMessage && type === 'text' && !attachmentUrl) {
    throw new ApiError(400, 'EMPTY_MESSAGE', 'Message cannot be empty');
  }

  if (type === 'interview_request' && !scheduledAt) {
    throw new ApiError(400, 'MISSING_DATE', 'scheduledAt is required for interview requests');
  }

  if (queryType && !allowedQueryTypes.has(queryType)) {
    throw new ApiError(400, 'INVALID_QUERY_TYPE', 'Invalid message query type');
  }

  // Resolve the pitched startup up front so investor pitches and founder funding
  // requests can be persisted with a direct reference, letting the recipient act on
  // the startup straight from the chat. Investor first contact additionally requires
  // an approved startup that is live in the investor marketplace.
  const investorPitchContext =
    queryType === 'investor' || type === 'funding_request'
      ? await resolveInvestorPitchContext(
          req.user!._id,
          pitchContext,
          queryType === 'investor',
        )
      : {};

  if (queryType === 'investor' && !investorPitchContext.startupId) {
    throw new ApiError(
      409,
      'INVESTOR_PITCH_NOT_ELIGIBLE',
      'Only an approved startup that is live in the investor marketplace can be pitched',
    );
  }

  if (type === 'funding_request' && !investorPitchContext.startupId) {
    throw new ApiError(
      400,
      'INVALID_FUNDING_REQUEST',
      'A funding request must reference one of your startups',
    );
  }

  await ensureDmAccess(req.user!._id, userId, queryType || 'general', {
    allowConnectionRequest: queryType === 'investor' && Boolean(investorPitchContext.startupId),
  });
  const attachmentStorage = validateDmAttachmentStorage(
    req.user!._id,
    attachmentStorageProvider,
    attachmentStorageKey,
  );

  const msg = await DirectMessage.create({
    senderId: myId,
    recipientId,
    message: normalizedMessage,
    messageType: type,
    queryType: queryType || 'general',
    ...(investorPitchContext.startupId ? { startupId: investorPitchContext.startupId } : {}),
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    ...(meetLink ? { meetLink } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(attachmentType ? { attachmentType } : {}),
    ...(attachmentName ? { attachmentName } : {}),
    ...attachmentStorage,
  });

  if (queryType && queryType !== 'general') {
    const recipient = await User.findById(recipientId).select('displayName role').lean();
    const acceptRedirect = investorPitchContext.workspaceId
      ? `/product-workspace/${investorPitchContext.workspaceId}`
      : `/dashboard/messages/${String(recipientId)}`;

    await createRequest({
      type: 'generic',
      actionType: workflowQueryActions[queryType],
      fromUserId: req.user!._id,
      toUserId: String(recipientId),
      targetEntityType: 'user_profile',
      targetEntityId: `${String(recipientId)}:${queryType}`,
      targetEntityTitle: recipient?.displayName ?? 'User profile',
      requestedPermission: `dm_${queryType}`,
      message: normalizedMessage,
      deepLink: `/dashboard/messages/${String(recipientId)}`,
      acceptRedirect,
      metadata: {
        queryType,
        recipientRole: recipient?.role,
        messageId: String(msg._id),
        ...investorPitchContext,
      },
    });
  }

  res.status(201).json({ success: true, data: await serializeDirectMessage(msg.toObject()) });
};
