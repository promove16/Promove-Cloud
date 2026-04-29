import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import { listStartupLifecycleEventsForUser } from './startupLifecycle.service';

const objectIdSchema = /^[0-9a-fA-F]{24}$/;

export const listStartupLifecycleEventsController = async (req: Request, res: Response) => {
  const rawStartupId = req.params.id;
  const startupId = Array.isArray(rawStartupId) ? rawStartupId[0] : rawStartupId;
  if (!startupId || !objectIdSchema.test(startupId)) {
    throw new ApiError(400, 'INVALID_ID', 'Invalid startup id');
  }

  const limit = Number(req.query.limit ?? 100);
  const events = await listStartupLifecycleEventsForUser(
    startupId,
    req.user!._id,
    req.user!.role,
    Number.isFinite(limit) ? limit : 100,
  );
  res.json(new ApiResponse(events));
};
