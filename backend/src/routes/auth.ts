import 'dotenv/config';
import { Router } from 'express';
import { ApiError } from '../middleware/error.js';
import { hashPassword, verifyPassword } from '../lib/security.js';
import { issueSession, rotateRefreshToken } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { supabase } from '../lib/supabase.js';
import type { SessionUser } from '../types/contracts.js';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeUser = (user: SessionUser) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  businessId: user.businessId,
});

const toAuthResponse = (user: SessionUser) => {
  const session = issueSession(user.id);
  return {
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    user: sanitizeUser(user),
  };
};

function validateEmail(email: unknown): string {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, 'INVALID_INPUT', 'A valid email address is required');
  }
  return normalizedEmail;
}

function validatePassword(password: unknown): string {
  const value = String(password || '');
  if (value.length < 12) throw new ApiError(400, 'INVALID_INPUT', 'Password must be at least 12 characters');
  return value;
}

function validateName(name: unknown, fieldName: string): string {
  const value = String(name || '').trim();
  if (value.length < 2 || value.length > 80) {
    throw new ApiError(400, 'INVALID_INPUT', `${fieldName} must be between 2 and 80 characters`);
  }
  return value;
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!password) return next(new ApiError(400, 'INVALID_INPUT', 'email and password are required'));

    const { data: account, error } = await supabase
      .from('account')
      .select('uuid,name,email,password,account_type')
      .eq('email', email)
      .maybeSingle();

    if (error || !account || !(await verifyPassword(password, account.password))) {
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    const user: SessionUser = {
      id: account.uuid,
      email: account.email,
      name: account.name,
      role: account.account_type === 'BUSINESS' ? 'staff' : 'user',
      businessId: account.account_type === 'BUSINESS' ? account.uuid : undefined,
    };

    return res.json(toAuthResponse(user));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/signup/user', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const name = validateName(req.body?.name, 'name');

    const { data: existing } = await supabase.from('account').select('uuid').eq('email', email).maybeSingle();
    if (existing) return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));

    const { data: account, error } = await supabase
      .from('account')
      .insert({ name, account_type: 'USER', email, password: await hashPassword(password) })
      .select('uuid,name,email,account_type')
      .single();

    if (error || !account) {
      console.error('Supabase insert error:', JSON.stringify(error));
      return next(new ApiError(500, 'SERVER_ERROR', 'Failed to create user account'));
    }

    return res.status(201).json(toAuthResponse({ id: account.uuid, email: account.email, name: account.name, role: 'user' }));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/signup/business', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const ownerName = validateName(req.body?.ownerName, 'ownerName');
    const businessName = validateName(req.body?.businessName, 'businessName');

    const { data: existing } = await supabase.from('account').select('uuid').eq('email', email).maybeSingle();
    if (existing) return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));

    const { data: account, error } = await supabase
      .from('account')
      .insert({ name: ownerName, account_type: 'BUSINESS', email, password: await hashPassword(password), business_name: businessName })
      .select('uuid,name,email,account_type')
      .single();

    if (error || !account) {
      console.error('Supabase insert error:', JSON.stringify(error));
      return next(new ApiError(500, 'SERVER_ERROR', 'Failed to create business account'));
    }

    return res.status(201).json(toAuthResponse({ id: account.uuid, email: account.email, name: account.name, role: 'staff', businessId: account.uuid }));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', async (req, res, next) => {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) return next(new ApiError(400, 'INVALID_INPUT', 'refreshToken is required'));

  const session = rotateRefreshToken(refreshToken);
  if (!session) return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token expired or invalid'));

  const { data: account, error } = await supabase
    .from('account')
    .select('uuid,name,email,account_type')
    .eq('uuid', session.userId)
    .maybeSingle();

  if (error || !account) return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token user not found'));

  return res.json({
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    user: sanitizeUser({
      id: account.uuid,
      email: account.email,
      name: account.name,
      role: account.account_type === 'BUSINESS' ? 'staff' : 'user',
      businessId: account.account_type === 'BUSINESS' ? account.uuid : undefined,
    }),
  });
});

authRouter.post('/logout', requireAuth, (_req, res) => {
  return res.json({ ok: true, note: 'Stateless token logout; discard tokens client-side' });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: sanitizeUser(req.authUser!) }));

authRouter.get('/me/waitlist', requireAuth, async (req, res, next) => {
  const { data, error } = await supabase.from('party').select('*').eq('account_uuid', req.authUser!.id);
  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to load waitlist entries'));
  return res.json({ data });
});
