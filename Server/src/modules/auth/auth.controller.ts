import { Request, Response } from 'express';
import { env } from '../../config/env';
import { ApiResponse } from '../../utils/ApiResponse';
import { ApiError } from '../../utils/ApiError';
import {
  loginSchema,
  oauthCallbackQuerySchema,
  oauthProviderSchema,
  registerSchema,
  registrationRequestSchema,
  submitInstitutionTokenSchema,
} from './auth.schema';
import {
  buildFrontendOAuthRedirectUrl,
  changePassword,
  createOAuthAuthorizationUrl,
  loginUser,
  loginWithOAuth,
  logoutUser,
  refreshUserToken,
  registerUser,
  submitRegistrationRequest,
  submitInstitutionToken,
} from './auth.service';

const COOKIE_NAME = 'refreshToken';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: COOKIE_MAX_AGE,
};

const getRequestOrigin = (req: Request) => `${req.protocol}://${req.get('host')}`;

export const register = async (req: Request, res: Response) => {
  const payload = registerSchema.parse(req.body);
  const result = await registerUser(payload);

  if ('pendingApproval' in result) {
    res.status(201).json(new ApiResponse(result));
    return;
  }

  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.status(201).json(new ApiResponse(result));
};

export const registerRequest = async (req: Request, res: Response) => {
  const payload = registrationRequestSchema.parse(req.body);
  const result = await submitRegistrationRequest(payload);

  res.status(201).json(new ApiResponse(result));
};

export const login = async (req: Request, res: Response) => {
  const payload = loginSchema.parse(req.body);
  const result = await loginUser(payload);

  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.status(200).json(
    new ApiResponse({
      accessToken: result.accessToken,
      user: result.user,
    }),
  );
};

export const startOAuth = async (req: Request, res: Response) => {
  const provider = oauthProviderSchema.parse(req.params.provider);

  try {
    const authorizationUrl = await createOAuthAuthorizationUrl(provider, getRequestOrigin(req));
    res.redirect(302, authorizationUrl);
  } catch (error) {
    if (error instanceof ApiError) {
      res.redirect(
        302,
        buildFrontendOAuthRedirectUrl(provider, 'error', {
          code: error.code,
          message: error.message,
        }),
      );
      return;
    }

    throw error;
  }
};

export const oauthCallback = async (req: Request, res: Response) => {
  const provider = oauthProviderSchema.parse(req.params.provider);
  const callbackQuery = oauthCallbackQuerySchema.parse(req.query);

  if (callbackQuery.error) {
    res.redirect(
      302,
      buildFrontendOAuthRedirectUrl(provider, 'error', {
        code: 'OAUTH_ACCESS_DENIED',
        message: callbackQuery.error_description ?? 'Sign-in was cancelled or denied.',
      }),
    );
    return;
  }

  try {
    const result = await loginWithOAuth({
      provider,
      code: callbackQuery.code!,
      state: callbackQuery.state!,
      requestOrigin: getRequestOrigin(req),
    });

    res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
    res.redirect(302, buildFrontendOAuthRedirectUrl(provider, 'success'));
  } catch (error) {
    if (error instanceof ApiError) {
      res.redirect(
        302,
        buildFrontendOAuthRedirectUrl(provider, 'error', {
          code: error.code,
          message: error.message,
        }),
      );
      return;
    }

    throw error;
  }
};

export const refresh = async (req: Request, res: Response) => {
  const result = await refreshUserToken(req.cookies?.[COOKIE_NAME]);

  res.cookie(COOKIE_NAME, result.refreshToken, cookieOptions);
  res.status(200).json(
    new ApiResponse({
      accessToken: result.accessToken,
      user: result.user,
    }),
  );
};

export const logout = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  await logoutUser(req.cookies?.[COOKIE_NAME]);
  res.clearCookie(COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'strict',
  });
  res.status(200).json(new ApiResponse({ message: 'Logged out successfully' }));
};

export const changePasswordController = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'currentPassword and newPassword are required');
  }

  if (newPassword.length < 8) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'New password must be at least 8 characters');
  }

  await changePassword(req.user._id, currentPassword, newPassword);
  res.status(200).json(new ApiResponse({ message: 'Password changed successfully' }));
};

export const submitInstitutionTokenAfterRegister = async (req: Request, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token');
  }

  const { institutionToken } = submitInstitutionTokenSchema.parse(req.body);
  const result = await submitInstitutionToken(req.user._id, institutionToken);

  res.status(200).json(
    new ApiResponse({
      message: result.message,
    }),
  );
};
