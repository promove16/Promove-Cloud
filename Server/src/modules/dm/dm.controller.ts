import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DirectMessage } from './dm.model';
import { User } from '../user/user.model';
import { ApiError } from '../../utils/ApiError';
import { uploadToCloudinary } from '../../services/cloudinaryService';
const allowedMimeTypes = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']);
const pdfFileNamePattern = /\.pdf$/i;
const allowedQueryTypes = new Set(['project_mentor', 'investor', 'recruiter', 'general'] as const);

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

  const upload = await uploadToCloudinary(
    req.file.buffer,
    `dm/${userId}`,
    resourceType,
    fileType === 'pdf' ? { format: 'pdf' } : undefined,
  );

  res.json({
    success: true,
    data: {
      url: upload.secure_url,
      publicId: upload.public_id,
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

  // Fetch user profiles for conversation partners
  const partnerIds = recent.map((r) => r._id);
  const users = await User.find({ _id: { $in: partnerIds } })
    .select('_id displayName avatar role')
    .lean();

  const userMap = new Map(users.map((u) => [u._id.toString(), u]));

  const conversations = recent.map((r) => ({
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
    isOnline: onlineUsers.has(r._id.toString()),
  }));

  res.json({ success: true, data: conversations });
};

/** GET /api/dm/partner/:userId — get partner profile for chat header */
export const getPartnerProfile = async (req: Request, res: Response) => {
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  const user = await User.findById(userId)
    .select('_id displayName avatar role')
    .lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  res.json({
    success: true,
    data: {
      ...user,
      isOnline: onlineUsers.has(user._id.toString()),
    },
  });
};

/** GET /api/dm/:userId — get message thread with a user */
export const getThread = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

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

  res.json({ success: true, data: messages });
};

/** PATCH /api/dm/:userId/read — mark all messages from a partner as read */
export const markAsRead = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

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
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId as string)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  const recipientId = new Types.ObjectId(userId as string);
  const { message, messageType, scheduledAt, meetLink, attachmentUrl, attachmentType, attachmentName, queryType } = req.body as {
    message?: string;
    messageType?: 'text' | 'interview_request';
    scheduledAt?: string;
    meetLink?: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'pdf';
    attachmentName?: string;
    queryType?: 'project_mentor' | 'investor' | 'recruiter' | 'general';
  };

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const type = messageType === 'interview_request' ? 'interview_request' : 'text';

  if (!normalizedMessage && type !== 'interview_request' && !attachmentUrl) {
    throw new ApiError(400, 'EMPTY_MESSAGE', 'Message cannot be empty');
  }

  if (type === 'interview_request' && !scheduledAt) {
    throw new ApiError(400, 'MISSING_DATE', 'scheduledAt is required for interview requests');
  }

  if (queryType && !allowedQueryTypes.has(queryType)) {
    throw new ApiError(400, 'INVALID_QUERY_TYPE', 'Invalid message query type');
  }

  if (myId.toString() === userId) {
    throw new ApiError(400, 'SELF_MESSAGE', 'You cannot send a message to yourself');
  }

  const recipientExists = await User.exists({ _id: recipientId });
  if (!recipientExists) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Recipient not found');
  }

  const msg = await DirectMessage.create({
    senderId: myId,
    recipientId,
    message: normalizedMessage,
    messageType: type,
    queryType: queryType || 'general',
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    ...(meetLink ? { meetLink } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(attachmentType ? { attachmentType } : {}),
    ...(attachmentName ? { attachmentName } : {}),
  });

  res.status(201).json({ success: true, data: msg });
};
