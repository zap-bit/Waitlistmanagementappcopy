import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { ApiError } from './error.js';

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function getClientKey(req: Request): string {
  return `${req.ip}:${req.path}`;
}

export function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = getClientKey(req);
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + config.rateLimitWindowMs;
    buckets.set(key, { count: 1, resetAt });
    res.setHeader('X-RateLimit-Limit', String(config.rateLimitMaxRequests));
    res.setHeader('X-RateLimit-Remaining', String(config.rateLimitMaxRequests - 1));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));
    return next();
  }

  if (existing.count >= config.rateLimitMaxRequests) {
    return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests', { retryAfterMs: existing.resetAt - now }));
  }

  existing.count += 1;
  res.setHeader('X-RateLimit-Limit', String(config.rateLimitMaxRequests));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, config.rateLimitMaxRequests - existing.count)));
  res.setHeader('X-RateLimit-Reset', String(Math.ceil(existing.resetAt / 1000)));
  return next();
}
