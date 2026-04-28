export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: unknown[],
  ) {
    super(message);
    this.name = 'ApiError';
  }

  // Convenience constructors used by the legacy JS modules. Each helper
  // returns a fully-formed ApiError with a sensible default code so callers
  // can write `throw ApiError.notFound('Project')` instead of repeating the
  // (statusCode, code, message) triple at every call site.
  static badRequest(message: string, details?: unknown[]) {
    return new ApiError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized', details?: unknown[]) {
    return new ApiError(401, 'UNAUTHORIZED', message, details);
  }

  static forbidden(message = 'Forbidden', details?: unknown[]) {
    return new ApiError(403, 'FORBIDDEN', message, details);
  }

  // Treat a single token as a resource name and multi-word input as a full
  // message so legacy callers can use either `notFound('Project')` or a
  // complete error message.
  static notFound(resource = 'Resource', details?: unknown[]) {
    const message = /\s/.test(resource) ? resource : `${resource} not found`;
    return new ApiError(404, 'NOT_FOUND', message, details);
  }

  static conflict(message: string, details?: unknown[]) {
    return new ApiError(409, 'CONFLICT', message, details);
  }

  static unprocessable(message: string, details?: unknown[]) {
    return new ApiError(422, 'UNPROCESSABLE_ENTITY', message, details);
  }

  static serviceUnavailable(message: string, details?: unknown[]) {
    return new ApiError(503, 'SERVICE_UNAVAILABLE', message, details);
  }
}
