import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  sendPatentMessage,
  listPatentMessages,
  markPatentMessagesRead,
  getUnreadCount,
  sendMessageSchema,
  listMessagesQuerySchema,
} from './patentConversation.service';

const isObjectId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);

export const sendMessageController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const payload = sendMessageSchema.parse(req.body);
  const message = await sendPatentMessage(req.user._id, req.user.role, id, payload);
  res.status(201).json(new ApiResponse(message));
};

export const listMessagesController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const filters = listMessagesQuerySchema.parse(req.query);
  const messages = await listPatentMessages(req.user._id, req.user.role, id, filters);
  res.json(new ApiResponse(messages));
};

export const markReadController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const result = await markPatentMessagesRead(req.user._id, req.user.role, id);
  res.json(new ApiResponse(result));
};

export const unreadCountController = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  const id = String(req.params.id);
  if (!id || !isObjectId(id)) throw new ApiError(400, 'INVALID_ID', 'Invalid ID format');
  const result = await getUnreadCount(req.user._id, req.user.role, id);
  res.json(new ApiResponse(result));
};
