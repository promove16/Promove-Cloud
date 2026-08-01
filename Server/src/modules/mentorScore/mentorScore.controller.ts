import { Request, Response } from 'express';
import { ApiError } from '../../utils/ApiError';
import { ApiResponse } from '../../utils/ApiResponse';
import { MentorVerificationTask } from './mentorVerificationTask.model';
import { getMentorScore, awardMentorPoints, updateMentorRating } from './mentorScore.service';
import { MentorScoreEvent } from './mentorScoreEvent.model';
import { MentorScoreTrigger } from './mentorScore.types';
import { MentorSession } from '../mentor/mentorSession.model';
import { MentorScore } from './mentorScore.model';
import { onTrainingModuleCompleted, onQuizPassed } from './mentorScore.hooks';

// ─── My Score Dashboard ───────────────────────────────────────────────────────

export const getMyMentorScore = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const mentorId = String(req.user._id);
  const score = await getMentorScore(mentorId);

  if (!score) {
    return res.json(
      new ApiResponse({
        totalScore: 0,
        phase1Score: 0, phase2Score: 0, phase3Score: 0,
        phase1Breakdown: { training: 0, labSync: 0, curriculumMapping: 0 },
        phase2Breakdown: { industryConnects: 0, prototypeVelocity: 0, demoDay: 0 },
        phase3Breakdown: { resourceLibrary: 0, forum: 0, sessions: 0, equityLOIs: 0, outcomeBonuses: 0 },
        mentorshipRating: 0,
        rank: 0,
      }),
    );
  }

  res.json(new ApiResponse(score));
};

export const getMyScoreHistory = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const mentorId = String(req.user._id);
  const events = await MentorScoreEvent.find({ mentorId })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json(new ApiResponse(events));
};

// ─── Phase 1 – Training Completion (called by training module) ────────────────

export const completeTrainingModule = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { moduleId, modulePoints } = req.body as {
    moduleId:     string;
    modulePoints: number;
  };

  if (!moduleId) throw new ApiError(400, 'MODULE_ID_REQUIRED', 'moduleId is required');
  if (!modulePoints || modulePoints < 1) {
    throw new ApiError(400, 'INVALID_POINTS', 'modulePoints must be at least 1');
  }

  await onTrainingModuleCompleted(String(req.user._id), moduleId, Number(modulePoints));
  res.json(new ApiResponse({ recorded: true }));
};

export const completeQuiz = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { quizId, quizPoints } = req.body as {
    quizId:     string;
    quizPoints: number;
  };

  if (!quizId) throw new ApiError(400, 'QUIZ_ID_REQUIRED', 'quizId is required');
  if (!quizPoints || quizPoints < 1) {
    throw new ApiError(400, 'INVALID_POINTS', 'quizPoints must be at least 1');
  }

  await onQuizPassed(String(req.user._id), quizId, Number(quizPoints));
  res.json(new ApiResponse({ recorded: true }));
};

// ─── Phase 1 Submissions ──────────────────────────────────────────────────────

export const submitLabSync = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { photoUrls, kitDescription, labDate } = req.body as {
    photoUrls:      string[];
    kitDescription: string;
    labDate:        string;
  };

  if (!photoUrls?.length) {
    throw new ApiError(400, 'PHOTOS_REQUIRED', 'At least one photo URL is required');
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (labDate && labDate > todayStr) {
    throw new ApiError(400, 'FUTURE_DATE_NOT_ALLOWED', 'Lab date cannot be in the future');
  }

  const existing = await MentorVerificationTask.findOne({
    mentorId: req.user._id,
    type:     'lab_sync',
  });

  if (existing) {
    if (existing.status === 'pending') {
      existing.submissionUrls = photoUrls;
      existing.submissionData = { kitDescription, labDate };
      await existing.save();
      return res.status(200).json(new ApiResponse(existing));
    }
    if (existing.status === 'approved') {
      throw new ApiError(400, 'LAB_SYNC_APPROVED', 'A lab sync submission has already been approved for your account');
    }
    existing.submissionUrls = photoUrls;
    existing.submissionData = { kitDescription, labDate };
    existing.status = 'pending';
    existing.rejectionNote = undefined;
    await existing.save();
    return res.status(200).json(new ApiResponse(existing));
  }

  const task = await MentorVerificationTask.create({
    type:           'lab_sync',
    mentorId:       req.user._id,
    submissionUrls: photoUrls,
    submissionData: { kitDescription, labDate },
    pointsToAward:  40,
  });

  res.status(201).json(new ApiResponse(task));
};

export const submitCurriculumPdf = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { pdfUrl, plannedClassesCount, academicYear } = req.body as {
    pdfUrl:              string;
    plannedClassesCount: number;
    academicYear:        string;
  };

  if (!pdfUrl) throw new ApiError(400, 'PDF_REQUIRED', 'PDF URL is required');
  if (!plannedClassesCount || plannedClassesCount < 1) {
    throw new ApiError(400, 'INVALID_CLASS_COUNT', 'plannedClassesCount must be at least 1');
  }

  const existing = await MentorVerificationTask.findOne({
    mentorId: req.user._id,
    type:     'curriculum_pdf',
    'submissionData.academicYear': academicYear,
  });

  if (existing) {
    if (existing.status === 'pending') {
      existing.submissionUrls = [pdfUrl];
      existing.submissionData = { plannedClassesCount, academicYear };
      await existing.save();
      return res.status(200).json(new ApiResponse(existing));
    }
    if (existing.status === 'approved') {
      throw new ApiError(400, 'CURRICULUM_APPROVED', `Curriculum mapping for academic year ${academicYear} is already approved`);
    }
    existing.submissionUrls = [pdfUrl];
    existing.submissionData = { plannedClassesCount, academicYear };
    existing.status = 'pending';
    existing.rejectionNote = undefined;
    await existing.save();
    return res.status(200).json(new ApiResponse(existing));
  }

  const task = await MentorVerificationTask.create({
    type:           'curriculum_pdf',
    mentorId:       req.user._id,
    submissionUrls: [pdfUrl],
    submissionData: { plannedClassesCount, academicYear },
    pointsToAward:  5, // initial approval; rest distributed per class photo
  });

  res.status(201).json(new ApiResponse(task));
};

export const submitClassPhoto = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { photoUrls, curriculumTaskId, classIndex, classDate, topic } = req.body as {
    photoUrls:      string[];
    curriculumTaskId: string;
    classIndex:     number;
    classDate:      string;
    topic:          string;
  };

  if (!photoUrls?.length) throw new ApiError(400, 'PHOTOS_REQUIRED', 'At least one photo is required');
  if (!curriculumTaskId)  throw new ApiError(400, 'CURRICULUM_REQUIRED', 'curriculumTaskId is required');

  const todayStr = new Date().toISOString().split('T')[0];
  if (classDate && classDate > todayStr) {
    throw new ApiError(400, 'FUTURE_DATE_NOT_ALLOWED', 'Class date cannot be in the future');
  }

  const curriculum = await MentorVerificationTask.findOne({
    _id:      curriculumTaskId,
    mentorId: req.user._id,
    type:     'curriculum_pdf',
    status:   'approved',
  }).lean();

  if (!curriculum) {
    throw new ApiError(404, 'CURRICULUM_NOT_FOUND', 'Approved curriculum mapping not found');
  }

  const plannedClasses = Math.max(1, (curriculum.submissionData.plannedClassesCount as number) || 1);
  const basePointsPerClass = Math.max(1, Math.round(35 / plannedClasses));

  // Count already-approved class photos to know if this is the last class
  const approvedPhotoCount = await MentorVerificationTask.countDocuments({
    mentorId: req.user._id,
    type:     'class_photo',
    status:   'approved',
    'submissionData.curriculumTaskId': curriculumTaskId,
  });
  const isLastClass = approvedPhotoCount + 1 >= plannedClasses;
  const pointsPerClass = isLastClass
    ? Math.max(1, 35 - approvedPhotoCount * basePointsPerClass)
    : basePointsPerClass;

  const duplicate = await MentorVerificationTask.findOne({
    mentorId: req.user._id,
    type:     'class_photo',
    'submissionData.curriculumTaskId': curriculumTaskId,
    'submissionData.classIndex':       classIndex,
  });

  if (duplicate) {
    if (duplicate.status === 'pending') {
      duplicate.submissionUrls = photoUrls;
      duplicate.submissionData = { curriculumTaskId, classIndex, classDate, topic };
      duplicate.pointsToAward = pointsPerClass;
      await duplicate.save();
      return res.status(200).json(new ApiResponse(duplicate));
    }
    if (duplicate.status === 'approved') {
      throw new ApiError(400, 'CLASS_ALREADY_APPROVED', `Photos for Class #${classIndex} have already been approved`);
    }
    duplicate.submissionUrls = photoUrls;
    duplicate.submissionData = { curriculumTaskId, classIndex, classDate, topic };
    duplicate.pointsToAward = pointsPerClass;
    duplicate.status = 'pending';
    duplicate.rejectionNote = undefined;
    await duplicate.save();
    return res.status(200).json(new ApiResponse(duplicate));
  }

  const task = await MentorVerificationTask.create({
    type:           'class_photo',
    mentorId:       req.user._id,
    submissionUrls: photoUrls,
    submissionData: { curriculumTaskId, classIndex, classDate, topic },
    pointsToAward:  pointsPerClass,
  });

  res.status(201).json(new ApiResponse(task));
};

// ─── Phase 2 Submissions ──────────────────────────────────────────────────────

export const submitIndustrySession = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { founderName, companyName, sessionDate, topic, attendeeCount, evidenceUrl } = req.body as {
    founderName:   string;
    companyName:   string;
    sessionDate:   string;
    topic:         string;
    attendeeCount: number;
    evidenceUrl?:  string;
  };

  if (!founderName || !companyName || !sessionDate || !topic) {
    throw new ApiError(400, 'MISSING_FIELDS', 'founderName, companyName, sessionDate, and topic are required');
  }

  const todayStr = new Date().toISOString().split('T')[0];
  if (sessionDate && sessionDate > todayStr) {
    throw new ApiError(400, 'FUTURE_DATE_NOT_ALLOWED', 'Session date cannot be in the future');
  }

  const task = await MentorVerificationTask.create({
    type:           'industry_session',
    mentorId:       req.user._id,
    submissionUrls: evidenceUrl ? [evidenceUrl] : [],
    submissionData: { founderName, companyName, sessionDate, topic, attendeeCount },
    pointsToAward:  10,
  });

  res.status(201).json(new ApiResponse(task));
};

export const submitDemoDay = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const { videoUrl, winners, academicYear } = req.body as {
    videoUrl:     string;
    winners:      { studentName: string; projectTitle: string }[];
    academicYear: string;
  };

  if (!videoUrl) throw new ApiError(400, 'VIDEO_REQUIRED', 'Video URL is required');
  if (!winners?.length) throw new ApiError(400, 'WINNERS_REQUIRED', 'At least one winner is required');

  const existing = await MentorVerificationTask.findOne({
    mentorId: req.user._id,
    type:     'demo_day',
    status:   { $in: ['pending', 'approved'] },
    'submissionData.academicYear': academicYear,
  });
  if (existing) {
    throw new ApiError(409, 'DEMO_DAY_EXISTS', 'A Demo Day submission already exists for this academic year');
  }

  const task = await MentorVerificationTask.create({
    type:           'demo_day',
    mentorId:       req.user._id,
    submissionUrls: [videoUrl],
    submissionData: { winners, academicYear },
    pointsToAward:  50,
  });

  res.status(201).json(new ApiResponse(task));
};

// ─── Session Token (Phase 3) ──────────────────────────────────────────────────

export const endSessionToken = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const sessionId = String(req.params.sessionId);

  const session = await MentorSession.findById(sessionId);
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');

  // Only the student participant can release the token
  if (!session.studentId.equals(req.user._id as string)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the session student can end the session');
  }

  if (session.tokenReleased) {
    return res.json(new ApiResponse({ message: 'Session token already released' }));
  }

  // Points scale with session length: 10 pts per 30 min, max 30 pts
  const sessionPoints = Math.min(30, Math.floor(session.durationMinutes / 30) * 10);

  session.tokenReleased      = true;
  session.tokenReleasedAt    = new Date();
  session.sessionPointsAwarded = sessionPoints > 0;
  session.status             = 'Completed';
  await session.save();

  if (sessionPoints > 0) {
    await awardMentorPoints({
      mentorId:       session.mentorId,
      trigger:        MentorScoreTrigger.SESSION_TOKEN_RELEASED,
      delta:          sessionPoints,
      phase:          3,
      idempotencyKey: `session_token:${sessionId}`,
      metadata:       { sessionId, studentId: String(req.user._id), durationMinutes: session.durationMinutes },
    });
  }

  res.json(new ApiResponse({ released: true, pointsAwarded: sessionPoints }));
};

// ─── Session Rating (student rates mentor after token release) ────────────────

export const rateSession = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const sessionId = String(req.params.sessionId);
  const { rating } = req.body as { rating: number };

  if (!rating || rating < 1 || rating > 5) {
    throw new ApiError(400, 'INVALID_RATING', 'Rating must be between 1 and 5');
  }

  const session = await MentorSession.findById(sessionId);
  if (!session) throw new ApiError(404, 'SESSION_NOT_FOUND', 'Session not found');

  if (!session.studentId.equals(req.user._id as string)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the session student can rate');
  }

  if (!session.tokenReleased) {
    throw new ApiError(400, 'TOKEN_NOT_RELEASED', 'Session must be ended before rating');
  }

  // Compute rolling average: fetch current score doc to get previous rating
  const mentorId   = String(session.mentorId);
  const scoreDoc   = await MentorScore.findOne({ mentorId }).select('mentorshipRating').lean();
  const prevRating = scoreDoc?.mentorshipRating ?? 0;

  // Simple rolling average with weight (treat existing as 4 parts, new as 1)
  const newRating = prevRating === 0
    ? Number(rating)
    : parseFloat(((prevRating * 4 + Number(rating)) / 5).toFixed(2));

  await updateMentorRating(mentorId, newRating);

  res.json(new ApiResponse({ rated: true, newRating }));
};

// ─── My Submissions List ──────────────────────────────────────────────────────

export const getMySubmissions = async (req: Request, res: Response) => {
  if (!req.user) throw new ApiError(401, 'UNAUTHORIZED', 'Not authenticated');

  const type   = req.query.type   as string | undefined;
  const status = req.query.status as string | undefined;

  const filter: Record<string, unknown> = { mentorId: req.user._id };
  if (type)   filter.type   = type;
  if (status) filter.status = status;

  const tasks = await MentorVerificationTask.find(filter)
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();

  res.json(new ApiResponse(tasks));
};
