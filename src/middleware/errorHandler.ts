import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound("No route matches this URL"));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      success: false,
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) }
    });
  }

  // Postgres unique_violation -> 409 Conflict instead of a raw 500
  const pgErr = err as { code?: string; constraint?: string };
  if (pgErr && pgErr.code === "23505") {
    return res.status(409).json({
      success: false,
      error: { code: "CONFLICT", message: "This record already exists", details: pgErr.constraint }
    });
  }

  // eslint-disable-next-line no-console
  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    error: { code: "INTERNAL_ERROR", message: "Unexpected server error" }
  });
}
