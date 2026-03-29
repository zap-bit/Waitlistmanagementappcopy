import type { NextFunction, Request, Response } from 'express';
import { db } from '../data/store.js';
import { getEventById } from '../data/supabaseStore.js';
import { ApiError } from './error.js';
import type { UserModel } from '../types/contracts.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: UserModel;
      authAccessToken?: string;
    }
  }
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));

  const session = db.accessTokens.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) db.accessTokens.delete(token);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Access token expired or invalid'));
  }

  const user = db.users.get(session.userId);
  if (!user) {
    db.accessTokens.delete(token);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Session user not found'));
  }

  req.authUser = user;
  req.authAccessToken = token;
  return next();
}

export function requireRole(role: UserModel['role']) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.authUser) return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
    if (req.authUser.role !== role) return next(new ApiError(403, 'FORBIDDEN', 'Insufficient role'));
    return next();
  };
}

export async function requireStaffEventAccess(req: Request, _res: Response, next: NextFunction) {
  const user = req.authUser;
  const { eventId } = req.params as { eventId?: string };
  if (!user) return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
  if (user.role !== 'staff') return next(new ApiError(403, 'FORBIDDEN', 'Staff access required'));
  if (!eventId) return next(new ApiError(400, 'INVALID_INPUT', 'eventId is required'));

  try {
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));
    if (!user.businessId || event.businessId !== user.businessId) return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this event'));
    return next();
  } catch (error) {
    return next(error);
  }
}
