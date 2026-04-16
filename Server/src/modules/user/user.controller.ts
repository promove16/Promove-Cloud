import { Request, Response } from 'express';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  acceptCurrentTerms,
  acceptTermsSchema,
  beginGithubOauthForCurrentUser,
  connectGithubForCurrentUserFromCallback,
  enrichCurrentUserFromSocialLinks,
  getCurrentUser,
  getPublicStudentProfileBySlug,
  getStudentPortfolioForViewer,
  getCurrentUserMentorSessions,
  getCurrentUserInstitutionMentorshipPrograms,
  importCurrentUserGithubRepositories,
  importGithubRepositoriesSchema,
  launchCurrentUserToRecruiters,
  listCurrentUserGithubRepositories,
  recordCurrentUserActivity,
  socialEnrichSchema,
  syncCurrentUserGithubProof,
  updateCurrentUser,
  updateMeSchema,
} from './user.service';
import { getOnboardingStatus, claimOnboardingStep } from './onboarding.service';
import { User } from './user.model';
import { canSearchUserForDm } from '../dm/dm.permissions';

export const getMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const user = await getCurrentUser(req.user._id);
  res.status(200).json(new ApiResponse(user));
};

export const getPublicStudentProfile = async (req: Request, res: Response) => {
  const profileSlug = String(req.params.profileSlug ?? '').trim().toLowerCase();
  const profile = await getPublicStudentProfileBySlug(profileSlug);
  res.status(200).json(new ApiResponse(profile));
};

export const getStudentPortfolioView = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const userId = String(req.params.userId ?? '').trim();
  const profile = await getStudentPortfolioForViewer(req.user._id, req.user.role, userId);
  res.status(200).json(new ApiResponse(profile));
};

export const patchMe = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = updateMeSchema.parse(req.body);
  const user = await updateCurrentUser(req.user._id, payload);
  res.status(200).json(new ApiResponse(user));
};

export const acceptMyTerms = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = acceptTermsSchema.parse(req.body);
  const user = await acceptCurrentTerms(req.user._id, payload);
  res.status(200).json(new ApiResponse(user));
};

export const enrichMeFromSocialLinks = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = socialEnrichSchema.parse(req.body);
  const result = await enrichCurrentUserFromSocialLinks(req.user._id, payload);
  res.status(200).json(new ApiResponse(result));
};

export const startGithubOauth = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const rawReturnTo = req.query.returnTo;
  const returnTo =
    typeof rawReturnTo === 'string'
      ? rawReturnTo
      : Array.isArray(rawReturnTo) && typeof rawReturnTo[0] === 'string'
        ? rawReturnTo[0]
        : undefined;
  const result = await beginGithubOauthForCurrentUser(req.user._id, returnTo);
  res.status(200).json(new ApiResponse(result));
};

export const githubOauthCallback = async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const state = typeof req.query.state === 'string' ? req.query.state : '';
  const clientUrl = process.env.CLIENT_URL ?? 'http://localhost:5173';

  if (!code || !state) {
    res.redirect(`${clientUrl}/portfolio?github=error`);
    return;
  }

  try {
    const { returnTo } = await connectGithubForCurrentUserFromCallback(state, code);
    const separator = returnTo.includes('?') ? '&' : '?';
    res.redirect(`${clientUrl}${returnTo}${separator}github=connected`);
  } catch (error) {
    const message =
      error instanceof ApiError ? encodeURIComponent(error.message) : encodeURIComponent('GitHub connection failed.');
    res.redirect(`${clientUrl}/portfolio?github=error&message=${message}`);
  }
};

export const syncGithubProof = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const result = await syncCurrentUserGithubProof(req.user._id);
  res.status(200).json(new ApiResponse(result));
};

export const listGithubRepositories = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const result = await listCurrentUserGithubRepositories(req.user._id);
  res.status(200).json(new ApiResponse(result));
};

export const importGithubRepositories = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const payload = importGithubRepositoriesSchema.parse(req.body);
  const result = await importCurrentUserGithubRepositories(req.user._id, payload);
  res.status(200).json(new ApiResponse(result));
};

export const trackMeActivity = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const result = await recordCurrentUserActivity(req.user._id, req.body);
  res.status(201).json(new ApiResponse(result));
};

export const getMySessions = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const sessions = await getCurrentUserMentorSessions(req.user._id);
  res.status(200).json(new ApiResponse(sessions));
};

export const getMyInstitutionMentorshipPrograms = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const programs = await getCurrentUserInstitutionMentorshipPrograms(req.user._id);
  res.status(200).json(new ApiResponse(programs));
};

export const launchToRecruiters = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const result = await launchCurrentUserToRecruiters(req.user._id);
  res.status(200).json(new ApiResponse(result));
};

export const getMyOnboarding = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const status = await getOnboardingStatus(req.user._id);
  res.status(200).json(new ApiResponse(status));
};

export const claimMyOnboardingStep = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const rawStepId = req.params.stepId;
  const stepId = Array.isArray(rawStepId) ? rawStepId[0] : rawStepId;
  if (!stepId) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Onboarding step is required');
  }
  const result = await claimOnboardingStep(req.user._id, stepId);
  res.status(200).json(new ApiResponse(result));
};

export const searchUsers = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const q = (req.query.q as string || '').trim();
  if (!q || q.length < 2) {
    res.status(200).json(new ApiResponse([]));
    return;
  }

  // Escape regex special characters to prevent ReDoS
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const candidates = await User.find(
    {
      $or: [
        { displayName: { $regex: escaped, $options: 'i' } },
        { email: { $regex: escaped, $options: 'i' } },
      ],
      isActive: true,
      _id: { $ne: req.user._id },
    },
    { _id: 1, displayName: 1, avatar: 1, role: 1 },
  )
    .limit(30)
    .lean();

  const candidateAccess = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      allowed: await canSearchUserForDm(req.user!._id, String(candidate._id)),
    })),
  );

  res
    .status(200)
    .json(new ApiResponse(candidateAccess.filter((entry) => entry.allowed).map((entry) => entry.candidate).slice(0, 15)));
};
