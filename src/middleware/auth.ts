import { Request, Response, NextFunction } from "express";
import { verifyAccessToken, Role } from "../utils/jwt";
import { ApiError } from "../utils/ApiError";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: { id: string; role: Role; isActive: boolean };
    }
  }
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return next(ApiError.unauthorized());
  }
  const token = header.slice("Bearer ".length);
  try {
    const payload = verifyAccessToken(token);
    if (payload.type !== "access") return next(ApiError.unauthorized("Wrong token type"));
    req.user = { id: payload.sub, role: payload.role, isActive: payload.isActive !== false };
    next();
  } catch {
    return next(ApiError.unauthorized("Access token is invalid or has expired"));
  }
}
