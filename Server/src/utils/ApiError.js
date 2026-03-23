class ApiError extends Error {
  constructor(statusCode, message, code, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }

  static badRequest(message, details) { return new ApiError(400, message, 'BAD_REQUEST', details); }
  static unauthorized(message) { return new ApiError(401, message || 'Unauthorized', 'UNAUTHORIZED'); }
  static forbidden(message) { return new ApiError(403, message || 'Forbidden', 'FORBIDDEN'); }
  static notFound(resource) { return new ApiError(404, `${resource} not found`, 'NOT_FOUND'); }
  static conflict(message) { return new ApiError(409, message, 'CONFLICT'); }
  static unprocessable(message, details) { return new ApiError(422, message, 'UNPROCESSABLE', details); }
  static internal(message) { return new ApiError(500, message || 'Internal server error', 'INTERNAL'); }
}

module.exports = ApiError;
