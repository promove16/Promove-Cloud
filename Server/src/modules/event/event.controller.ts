import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import {
  addSubmissionScore,
  closeEvent,
  computeEventRankings,
  eventSubmissionSchema,
  getEventRankings,
  getManagedEventRankings,
  joinEvent,
  listRecruiterHiringEvents,
  listStudentInstitutionEvents,
  listStudentInstitutionDrives,
  postponeHiringEventSchema,
  requestHiringEventPostponement,
  selectStudentFromEventSchema,
  selectStudentFromHiringEvent,
  sendHiringEventInvite,
  sendHiringEventInviteSchema,
  updateHiringEvent,
  updateHiringEventSchema,
} from './event.service';

export const joinEventController = async (req: Request, res: Response) => {
  await joinEvent(String(req.params.eventId), req.user!._id, req.user!.institutionId);
  res.status(200).json(new ApiResponse({ success: true }));
};

export const addSubmissionScoreController = async (req: Request, res: Response) => {
  const payload = eventSubmissionSchema.parse(req.body);
  await addSubmissionScore(
    String(req.params.eventId),
    String(req.params.studentId),
    payload.score,
    {
      actorId: req.user!._id,
      role: req.user!.role,
      institutionId: req.user!.institutionId,
    },
  );
  res.status(200).json(new ApiResponse({ success: true }));
};

export const computeEventRankingsController = async (req: Request, res: Response) => {
  const eventId = String(req.params.eventId);
  await computeEventRankings(eventId, {
    actorId: req.user!._id,
    role: req.user!.role,
    institutionId: req.user!.institutionId,
  });
  const rankings =
    req.user!.role === 'recruiter'
      ? await getManagedEventRankings(eventId, {
          actorId: req.user!._id,
          role: req.user!.role,
          institutionId: req.user!.institutionId,
        })
      : await getEventRankings(eventId, req.user!.institutionId ?? req.user!._id);
  res.status(200).json(new ApiResponse({ rankings }));
};

export const getEventRankingsController = async (req: Request, res: Response) => {
  const rankings =
    req.user!.role === 'recruiter'
      ? await getManagedEventRankings(String(req.params.eventId), {
          actorId: req.user!._id,
          role: req.user!.role,
          institutionId: req.user!.institutionId,
        })
      : await getEventRankings(
          String(req.params.eventId),
          req.user!.role === 'student' ? req.user!.institutionId : req.user!.institutionId ?? req.user!._id,
        );
  res.status(200).json(
    new ApiResponse({
      formula: '(submissionScore * 0.6) + (innovationScore * 0.4)',
      rankings,
    }),
  );
};

export const listStudentInstitutionEventsController = async (req: Request, res: Response) => {
  if (!req.user!.institutionId) {
    throw new ApiError(403, 'NO_INSTITUTION', 'You are not linked to any institution');
  }
  const data = await listStudentInstitutionEvents(String(req.user!.institutionId));
  res.status(200).json(new ApiResponse(data));
};

export const listRecruiterHiringEventsController = async (req: Request, res: Response) => {
  const data = await listRecruiterHiringEvents(req.user!._id);
  res.status(200).json(new ApiResponse(data));
};

export const selectStudentFromHiringEventController = async (req: Request, res: Response) => {
  const { jobId, note } = selectStudentFromEventSchema.parse(req.body);
  const data = await selectStudentFromHiringEvent(
    req.user!._id,
    String(req.params.eventId),
    String(req.params.studentId),
    jobId,
    note,
  );
  res.status(200).json(new ApiResponse(data));
};

export const sendHiringEventInviteController = async (req: Request, res: Response) => {
  const payload = sendHiringEventInviteSchema.parse(req.body);
  const data = await sendHiringEventInvite(req.user!._id, String(req.params.collegeId), payload);
  res.status(201).json(new ApiResponse(data));
};

export const listStudentInstitutionDrivesController = async (req: Request, res: Response) => {
  const data = await listStudentInstitutionDrives(String(req.user!.institutionId));
  res.status(200).json(new ApiResponse(data));
};

export const closeEventController = async (req: Request, res: Response) => {
  const data = await closeEvent(String(req.params.eventId), {
    actorId: req.user!._id,
    role: req.user!.role,
    institutionId: req.user!.institutionId,
  });
  res.status(200).json(new ApiResponse(data));
};

export const postponeHiringEventController = async (req: Request, res: Response) => {
  const payload = postponeHiringEventSchema.parse(req.body);
  const data = await requestHiringEventPostponement(
    req.user!._id,
    String(req.params.eventId),
    payload,
  );
  res.status(201).json(new ApiResponse(data));
};

export const updateHiringEventController = async (req: Request, res: Response) => {
  const payload = updateHiringEventSchema.parse(req.body);
  const data = await updateHiringEvent(
    req.user!._id,
    String(req.params.eventId),
    payload,
  );
  res.status(200).json(new ApiResponse(data));
};
