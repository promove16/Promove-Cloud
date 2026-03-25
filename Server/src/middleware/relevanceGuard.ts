import { NextFunction, Request, Response } from 'express';
import { RelevanceBridge } from '../modules/recruiter/relevanceBridge.model';
import { ApiError } from '../utils/ApiError';

export const relevanceGuard =
  (getStudentId: (req: Request) => string) =>
  async (req: Request, _res: Response, next: NextFunction) => {
    const studentId = getStudentId(req);
    const recruiterId = req.user?._id;

    if (!recruiterId) {
      return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
    }

    const bridge = await RelevanceBridge.findOne({
      studentId,
      recruiterId,
      isActive: true,
    })
      .select('bridgeType')
      .lean();

    if (!bridge) {
      return next(
        new ApiError(
          403,
          'RELEVANCE_REQUIRED',
          'You can reach out once you are shortlisted or apply to an active drive.',
        ),
      );
    }

    return next();
  };
