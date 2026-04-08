import { Request, Response } from 'express';
import { z } from 'zod';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { REQUEST_ACTION_TYPES, REQUEST_TYPES } from './request.model';
import {
  acceptRequest,
  createRequest,
  declineRequest,
  getRequestForUser,
  listIncomingRequests,
  listOutgoingRequests,
  withdrawRequest,
} from './request.service';

const createRequestSchema = z
  .object({
    type: z.enum(REQUEST_TYPES).optional(),
    requestType: z.enum(REQUEST_TYPES).optional(),
    actionType: z.enum(REQUEST_ACTION_TYPES).optional(),
    toUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
    recipientEmail: z.string().email().optional(),
    targetEntityType: z.string().trim().min(1).max(80),
    targetEntityId: z.string().trim().min(1).max(120),
    targetEntityTitle: z.string().trim().min(1).max(180).optional(),
    targetRole: z.string().trim().min(1).max(80).optional(),
    requestedRole: z.string().trim().min(1).max(80).optional(),
    requestedPermission: z.string().trim().min(1).max(120).optional(),
    message: z.string().trim().max(1000).optional(),
    metadata: z.record(z.unknown()).optional(),
    deepLink: z.string().trim().max(500).optional(),
    acceptRedirect: z.string().trim().max(500).optional(),
    declineRedirect: z.string().trim().max(500).optional(),
    expiresAt: z.string().datetime().optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.type && !value.requestType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['requestType'],
        message: 'requestType is required.',
      });
    }
    if (!value.toUserId && !value.recipientEmail) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['toUserId'],
        message: 'toUserId or recipientEmail is required.',
      });
    }
  });

const requireUser = (req: Request) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  return req.user;
};

const getRequestId = (req: Request) => {
  const requestId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (!requestId) {
    throw new ApiError(400, 'REQUEST_ID_REQUIRED', 'Request id is required.');
  }

  return requestId;
};

export const listIncomingRequestsController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await listIncomingRequests(user._id, user.email, user.institutionId)));
};

export const listOutgoingRequestsController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await listOutgoingRequests(user._id, user.institutionId)));
};

export const createRequestController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  const payload = createRequestSchema.parse(req.body ?? {});
  const request = await createRequest({
    type: (payload.requestType ?? payload.type)!,
    actionType: payload.actionType,
    institutionId: user.institutionId,
    fromUserId: user._id,
    toUserId: payload.toUserId,
    recipientEmail: payload.recipientEmail,
    targetEntityType: payload.targetEntityType,
    targetEntityId: payload.targetEntityId,
    targetEntityTitle: payload.targetEntityTitle,
    targetRole: payload.targetRole ?? payload.requestedRole,
    requestedRole: payload.requestedRole ?? payload.targetRole,
    requestedPermission: payload.requestedPermission,
    message: payload.message,
    metadata: payload.metadata,
    deepLink: payload.deepLink,
    acceptRedirect: payload.acceptRedirect,
    declineRedirect: payload.declineRedirect,
    expiresAt: payload.expiresAt ? new Date(payload.expiresAt) : undefined,
  });
  res.status(201).json(new ApiResponse(request));
};

export const getRequestController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await getRequestForUser(getRequestId(req), user._id, user.email, user.institutionId)));
};

export const acceptRequestController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await acceptRequest(getRequestId(req), user._id, user.email, user.institutionId)));
};

export const declineRequestController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await declineRequest(getRequestId(req), user._id, user.email, user.institutionId)));
};

export const withdrawRequestController = async (req: Request, res: Response) => {
  const user = requireUser(req);
  res.json(new ApiResponse(await withdrawRequest(getRequestId(req), user._id, user.institutionId)));
};
