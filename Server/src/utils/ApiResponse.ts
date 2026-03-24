import { ApiSuccess, ApiSuccessMeta } from '../types/api.types';

export class ApiResponse<T> implements ApiSuccess<T> {
  success = true as const;

  constructor(
    public data: T,
    public meta?: ApiSuccessMeta,
  ) {}
}
