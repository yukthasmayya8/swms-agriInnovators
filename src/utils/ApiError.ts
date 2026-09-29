export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: unknown) { return new ApiError(400, "BAD_REQUEST", message, details); }
  static unauthorized(message = "Missing or invalid authentication token") { return new ApiError(401, "UNAUTHORIZED", message); }
  static forbidden(message = "You do not have permission to perform this action") { return new ApiError(403, "FORBIDDEN", message); }
  static notFound(message = "Resource does not exist") { return new ApiError(404, "RESOURCE_NOT_FOUND", message); }
  static conflict(message: string, details?: unknown) { return new ApiError(409, "CONFLICT", message, details); }
  static tooLarge(message = "File exceeds the maximum allowed size") { return new ApiError(413, "PAYLOAD_TOO_LARGE", message); }
  static rateLimited(message = "Too many requests — please try again shortly") { return new ApiError(429, "RATE_LIMITED", message); }
  static internal(message = "Unexpected server error") { return new ApiError(500, "INTERNAL_ERROR", message); }
}
