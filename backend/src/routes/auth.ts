import { Router } from 'express';
import { db } from '../data/store.js';
import { createBusinessAccount, createUserAccount, findAccountByEmail, listWaitlistByCreator } from '../data/supabaseStore.js';
import { ApiError } from '../middleware/error.js';
import type { UserModel } from '../types/contracts.js';
import { hashPassword, verifyPassword } from '../lib/security.js';
import { issueSession, revokeAccessToken, revokeRefreshToken, rotateRefreshToken } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';

export const authRouter = Router();
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeUser = (user: UserModel) => ({ id: user.id, email: user.email, name: user.name, role: user.role, businessId: user.businessId });

const toAuthResponse = (user: UserModel) => {
  db.users.set(user.id, user);
  db.usersByEmail.set(user.email.toLowerCase(), user.id);
  const session = issueSession(user.id);
  return { token: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn, user: sanitizeUser(user) };
};

function validateEmail(email: unknown): string {
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) throw new ApiError(400, 'INVALID_INPUT', 'A valid email address is required');
  return normalizedEmail;
}
function validatePassword(password: unknown): string {
  const value = String(password || '');
  if (value.length < 12) throw new ApiError(400, 'INVALID_INPUT', 'Password must be at least 12 characters');
  return value;
}
function validateName(name: unknown, fieldName: string): string {
  const value = String(name || '').trim();
  if (value.length < 2 || value.length > 80) throw new ApiError(400, 'INVALID_INPUT', `${fieldName} must be between 2 and 80 characters`);
  return value;
}

authRouter.post('/login', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!password) return next(new ApiError(400, 'INVALID_INPUT', 'email and password are required'));

    const account = await findAccountByEmail(email);
    if (!account || !(await verifyPassword(password, account.passwordHash))) {
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    return res.json(toAuthResponse(account.user));
  } catch (error) { return next(error); }
});

authRouter.post('/signup/user', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const name = validateName(req.body?.name, 'name');

    if (await findAccountByEmail(email)) return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));
    const user = await createUserAccount(email, name, await hashPassword(password));
    return res.status(201).json(toAuthResponse(user));
  } catch (error) { return next(error); }
});

authRouter.post('/signup/business', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const ownerName = validateName(req.body?.ownerName, 'ownerName');
    const businessName = validateName(req.body?.businessName, 'businessName');

    if (await findAccountByEmail(email)) return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));
    const { user } = await createBusinessAccount(email, ownerName, businessName, await hashPassword(password));
    return res.status(201).json(toAuthResponse(user));
  } catch (error) { return next(error); }
});

authRouter.post('/refresh', (req, res, next) => {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) return next(new ApiError(400, 'INVALID_INPUT', 'refreshToken is required'));
  const session = rotateRefreshToken(refreshToken);
  if (!session) return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token expired or invalid'));

  const user = db.users.get(db.accessTokens.get(session.accessToken)?.userId || '');
  if (!user) {
    revokeAccessToken(session.accessToken);
    revokeRefreshToken(session.refreshToken);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token user not found'));
  }

  return res.json({ token: session.accessToken, refreshToken: session.refreshToken, expiresIn: session.expiresIn, user: sanitizeUser(user) });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  revokeAccessToken(req.authAccessToken);
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  revokeRefreshToken(refreshToken);
  return res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => res.json({ user: sanitizeUser(req.authUser!) }));

authRouter.get('/me/waitlist', requireAuth, async (req, res, next) => {
  try { return res.json({ data: await listWaitlistByCreator(req.authUser!.id) }); }
  catch (error) { return next(error); }
});
