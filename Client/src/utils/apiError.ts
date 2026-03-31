import { isAxiosError } from 'axios';
import { ApiErrorResponse } from '../types/auth.types';

export const getApiErrorMessage = (error: unknown, fallback: string) => {
  if (!isAxiosError<ApiErrorResponse>(error)) {
    return fallback;
  }

  const apiError = error.response?.data?.error;
  if (!apiError) {
    return fallback;
  }

  const details = apiError.details
    ?.map((detail) => detail.message?.trim())
    .filter((message): message is string => Boolean(message));

  if (details && details.length > 0) {
    return apiError.message === 'Validation failed' ? details.join(' ') : `${apiError.message} ${details.join(' ')}`;
  }

  return apiError.message || fallback;
};
