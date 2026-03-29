import type { NextFunction, Request, Response } from 'express';
import { db } from '../data/store.js';
import { ApiError } from './error.js';
import type { SessionUser } from '../types/contracts.js';
import { supabase } from '../lib/supabase.js';

declare global {
  namespace Express {
    interface Request {
      authUser?: SessionUser;
      authAccessToken?: string;
    }
  }
}

function readBearerToken(req: Request): string | null {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.replace('Bearer ', '').trim();
}

export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const token = readBearerToken(req);
  if (!token) return next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));

  const session = db.accessTokens.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) db.accessTokens.delete(token);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Access token expired or invalid'));
  }

  const { data: account, error } = await supabase
    .from('ACCOUNT')
    .select('UUID,name,email,account_type')
    .eq('UUID', session.userId)
    .maybeSingle();

  if (error || !account) {
    db.accessTokens.delete(token);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Session user not found'));
  }

  req.authUser = {
    id: account.UUID,
    email: account.email,
    name: account.name,
    role: account.account_type === 'BUSINESS' ? 'staff' : 'user',
    businessId: account.account_type === 'BUSINESS' ? account.UUID : undefined,
  };
  req.authAccessToken = token;
  return next();
}

export function requireRole(role: SessionUser['role']) {
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

  const { data: event, error } = await supabase
    .from('EVENTS')
    .select('UUID,account_uuid')
    .eq('UUID', eventId)
    .maybeSingle();

  if (error || !event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));
  if (!user.businessId || event.account_uuid !== user.businessId) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this event'));
  }

  return next();
}
