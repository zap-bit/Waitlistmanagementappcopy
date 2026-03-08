import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../data/store.js';
import { ApiError } from '../middleware/error.js';
import { createAuthToken, verifyPassword, hashPassword, verifyAuthToken } from '../utils/security.js';
import type { BusinessModel, UserModel } from '../types/contracts.js';

export const authRouter = Router();

const toAuthResponse = (user: UserModel) => {
  const { token, expiresIn } = createAuthToken(user.id);
  return {
    token,
    expiresIn,
    user,
  };
};

authRouter.post('/login', (req, res, next) => {
  const { email, password } = req.body ?? {};

  if (!email || !password) {
    return next(new ApiError(400, 'INVALID_INPUT', 'email and password are required'));
  }

  const userId = db.usersByEmail.get(String(email).toLowerCase());
  if (!userId) {
    return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
  }

  const savedPassword = db.passwords.get(userId);
  if (!savedPassword || !verifyPassword(String(password), savedPassword)) {
    return next(new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password'));
  }

  const user = db.users.get(userId);
  if (!user) {
    return next(new ApiError(500, 'SERVER_ERROR', 'User store is inconsistent'));
  }

  return res.json(toAuthResponse(user));
});

authRouter.post('/signup/user', (req, res, next) => {
  const { email, password, name } = req.body ?? {};

  if (!email || !password || !name) {
    return next(new ApiError(400, 'INVALID_INPUT', 'email, password and name are required'));
  }

  const normalizedEmail = String(email).toLowerCase();
  if (db.usersByEmail.has(normalizedEmail)) {
    return next(new ApiError(409, 'EMAIL_EXISTS', 'Email already exists'));
  }

  const user: UserModel = {
    id: nanoid(),
    email,
    name,
    role: 'user',
  };

  db.users.set(user.id, user);
  db.usersByEmail.set(normalizedEmail, user.id);
  db.passwords.set(user.id, hashPassword(String(password)));

  return res.status(201).json(toAuthResponse(user));
});

authRouter.post('/signup/business', (req, res, next) => {
  const { email, password, ownerName, businessName } = req.body ?? {};

  if (!email || !password || !ownerName || !businessName) {
    return next(new ApiError(400, 'INVALID_INPUT', 'email, password, ownerName and businessName are required'));
  }

  const normalizedEmail = String(email).toLowerCase();
  if (db.usersByEmail.has(normalizedEmail)) {
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
  db.usersByEmail.set(normalizedEmail, user.id);
  db.passwords.set(user.id, hashPassword(String(password)));

  return res.status(201).json(toAuthResponse(user));
});

authRouter.get('/me', (req, res, next) => {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Missing bearer token'));
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid or expired token'));
  }

  const user = db.users.get(payload.uid);
  if (!user) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Invalid token user'));
  }

  return res.json({ user });
});

