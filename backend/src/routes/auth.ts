import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../data/store.js';
import { ApiError } from '../middleware/error.js';
import type { BusinessModel, UserModel } from '../types/contracts.js';
import { hashPassword, verifyPassword } from '../lib/security.js';
import { issueSession, revokeAccessToken, revokeRefreshToken, rotateRefreshToken } from '../lib/session.js';
import { requireAuth } from '../middleware/auth.js';
import { findAccountByEmail } from '../lib/supabaseClient.js';
import { supabaseConfigured } from '../config.js';

export const authRouter = Router();

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const sanitizeUser = (user: UserModel) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  role: user.role,
  businessId: user.businessId,
});

const toAuthResponse = (user: UserModel) => {
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
  if (value.length < 12) {
    // #SPEC GAP: password policy details were not fully specified in the repo docs, so 12 characters is enforced here as a secure default.
    throw new ApiError(400, 'INVALID_INPUT', 'Password must be at least 12 characters');
  }
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
    if (!password) {
      return next(new ApiError(400, 'INVALID_INPUT', 'email and password are required'));
    }

    const user = supabaseConfigured
      ? await loginFromSupabase(email, password)
      : await loginFromInMemoryStore(email, password);

    if (!user) {
      return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
    }

    return res.json(toAuthResponse(user));
  } catch (error) {
    return next(error);
  }
});

async function loginFromInMemoryStore(email: string, password: string): Promise<UserModel | null> {
  const userId = db.usersByEmail.get(email);
  if (!userId) return null;

  const savedPasswordHash = db.passwordHashes.get(userId);
  if (!savedPasswordHash || !(await verifyPassword(password, savedPasswordHash))) {
    return null;
  }

  return db.users.get(userId) ?? null;
}

async function loginFromSupabase(email: string, password: string): Promise<UserModel | null> {
  const account = await findAccountByEmail(email);
  if (!account) return null;

  const storedPasswordHash = account.password_hash ?? account.password;
  if (!storedPasswordHash) return null;

  // #SPEC GAP: legacy Supabase rows may still use a non-scrypt `password` column from earlier prototypes;
  // secure login now requires scrypt hashes produced by backend/src/lib/security.ts.
  const isValid = await verifyPassword(password, storedPasswordHash);
  if (!isValid) return null;

  return {
    id: account.uuid,
    email: account.email,
    name: account.name || 'User',
    role: account.account_type?.toUpperCase() === 'BUSINESS' ? 'staff' : 'user',
    businessId: account.business_uuid ?? undefined,
  };
}

authRouter.post('/signup/user', async (req, res, next) => {
  try {
    const email = validateEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const name = validateName(req.body?.name, 'name');

    if (db.usersByEmail.has(email)) {
      return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));
    }

    const user: UserModel = {
      id: nanoid(),
      email,
      name,
      role: 'user',
    };

    db.users.set(user.id, user);
    db.usersByEmail.set(email, user.id);
    db.passwordHashes.set(user.id, await hashPassword(password));

    return res.status(201).json(toAuthResponse(user));
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

    if (db.usersByEmail.has(email)) {
      return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));
    }

    const business: BusinessModel = {
      id: `biz-${nanoid()}`,
      name: businessName,
      ownerId: '',
    };

    const user: UserModel = {
      id: nanoid(),
      email,
      name: ownerName,
      role: 'staff',
      businessId: business.id,
    };

    business.ownerId = user.id;

    db.businesses.set(business.id, business);
    db.users.set(user.id, user);
    db.usersByEmail.set(email, user.id);
    db.passwordHashes.set(user.id, await hashPassword(password));

    return res.status(201).json(toAuthResponse(user));
  } catch (error) {
    return next(error);
  }
});

authRouter.post('/refresh', (req, res, next) => {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) {
    return next(new ApiError(400, 'INVALID_INPUT', 'refreshToken is required'));
  }

  const session = rotateRefreshToken(refreshToken);
  if (!session) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token expired or invalid'));
  }

  const user = db.users.get(db.accessTokens.get(session.accessToken)?.userId || '');
  if (!user) {
    revokeAccessToken(session.accessToken);
    revokeRefreshToken(session.refreshToken);
    return next(new ApiError(401, 'UNAUTHORIZED', 'Refresh token user not found'));
  }

  return res.json({
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: session.expiresIn,
    user: sanitizeUser(user),
  });
});

authRouter.post('/logout', requireAuth, (req, res) => {
  revokeAccessToken(req.authAccessToken);
  const refreshToken = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
  revokeRefreshToken(refreshToken);
  return res.json({ ok: true });
});

authRouter.get('/me', requireAuth, (req, res) => {
  return res.json({ user: sanitizeUser(req.authUser!) });
});

authRouter.get('/me/waitlist', requireAuth, (req, res) => {
  const entries = Array.from(db.events.values()).flatMap((event) =>
    event.waitlist.filter((entry) => entry.createdByUserId === req.authUser!.id),
  );

  return res.json({ data: entries });
});
