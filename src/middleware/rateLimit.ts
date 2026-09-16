import { Request, Response, NextFunction } from "express";
import { ApiError } from "../utils/ApiError";

interface Bucket { count: number; resetAt: number; }

/**
 * Simple in-memory fixed-window limiter, keyed by IP + route name.
 * Good enough for a single-instance deployment; a multi-instance production
 * deployment would back this with Redis (the same Redis already used for
 * BullMQ) instead of an in-process Map.
 */
export function rateLimit(routeKey: string, maxRequests: number, windowMs: number) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, _res: Response, next: NextFunction) => {
    const key = `${routeKey}:${req.ip}`;
    const now = Date.now();
    const bucket = buckets.get(key);

    if (!bucket || bucket.resetAt < now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (bucket.count >= maxRequests) {
      return next(ApiError.rateLimited());
    }
    bucket.count += 1;
    next();
  };
}
