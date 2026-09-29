import { Request, Response, NextFunction } from "express";
import { Role } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

/** Rejects the request unless req.user.role is one of `roles`. Must run after requireAuth. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden(`This action requires one of these roles: ${roles.join(", ")}`));
    }
    next();
  };
}
