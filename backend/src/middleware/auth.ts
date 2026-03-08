import type { NextFunction, Request, Response } from 'express';
import { db } from '../data/store.js';
import { ApiError } from './error.js';
import { verifyAuthToken } from '../utils/security.js';
import type { UserModel } from '../types/contracts.js';

export interface AuthenticatedRequest extends Request {
  user?: UserModel;
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
}

export function requireAuth(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));

  const payload = verifyAuthToken(token);
  if (!payload) return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));

  const user = db.users.get(payload.uid);
  if (!user) return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token user'));

  req.user = user;
  return next();
}

export function requireStaff(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
  if (req.user.role !== 'staff') return next(new ApiError(403, 'FORBIDDEN', 'Staff role required'));
  return next();
}
