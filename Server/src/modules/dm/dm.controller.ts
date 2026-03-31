import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { DirectMessage } from './dm.model';
import { User } from '../user/user.model';
import { ApiError } from '../../utils/ApiError';

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
    },
    unreadCount: r.unreadCount,
  }));

  res.json({ success: true, data: conversations });
};

/** GET /api/dm/:userId — get message thread with a user */
export const getThread = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  const partnerId = new Types.ObjectId(userId);

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

/** POST /api/dm/:userId — send a message */
export const sendMessage = async (req: Request, res: Response) => {
  const myId = new Types.ObjectId(req.user!._id);
  const { userId } = req.params;

  if (!Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid user ID');
  }

  const recipientId = new Types.ObjectId(userId);
  const { message, messageType, scheduledAt, meetLink, attachmentUrl, attachmentType } = req.body as {
    message?: string;
    messageType?: 'text' | 'interview_request';
    scheduledAt?: string;
    meetLink?: string;
    attachmentUrl?: string;
    attachmentType?: 'image' | 'pdf';
  };

  const normalizedMessage = typeof message === 'string' ? message.trim() : '';
  const type = messageType === 'interview_request' ? 'interview_request' : 'text';

  if (!normalizedMessage && type !== 'interview_request') {
    throw new ApiError(400, 'EMPTY_MESSAGE', 'Message cannot be empty');
  }

  if (type === 'interview_request' && !scheduledAt) {
    throw new ApiError(400, 'MISSING_DATE', 'scheduledAt is required for interview requests');
  }

  const msg = await DirectMessage.create({
    senderId: myId,
    recipientId,
    message: normalizedMessage,
    messageType: type,
    ...(scheduledAt ? { scheduledAt: new Date(scheduledAt) } : {}),
    ...(meetLink ? { meetLink } : {}),
    ...(attachmentUrl ? { attachmentUrl } : {}),
    ...(attachmentType ? { attachmentType } : {}),
  });

  res.status(201).json({ success: true, data: msg });
};
