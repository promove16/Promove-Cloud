import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  addSubmissionScore,
  computeEventRankings,
  eventSubmissionSchema,
  getEventRankings,
  joinEvent,
} from './event.service';

export const joinEventController = async (req: Request, res: Response) => {
  await joinEvent(String(req.params.eventId), req.user!._id);
  res.status(200).json(new ApiResponse({ success: true }));
};

export const addSubmissionScoreController = async (req: Request, res: Response) => {
  const payload = eventSubmissionSchema.parse(req.body);
  await addSubmissionScore(String(req.params.eventId), String(req.params.studentId), payload.score);
  res.status(200).json(new ApiResponse({ success: true }));
};

export const computeEventRankingsController = async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  await computeEventRankings(eventId);
  const rankings = await getEventRankings(eventId);
  res.status(200).json(new ApiResponse({ rankings }));
};

export const getEventRankingsController = async (req: Request, res: Response) => {
  const rankings = await getEventRankings(String(req.params.eventId));
  res.status(200).json(
    new ApiResponse({
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      rankings,
    }),
  );
};
