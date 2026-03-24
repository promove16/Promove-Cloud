export interface ApiSuccessMeta {
  page?: number;
  limit?: number;
  total?: number;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiSuccessMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown[];
  };
}

export type ApiResponseEnvelope<T> = ApiSuccess<T> | ApiFailure;
