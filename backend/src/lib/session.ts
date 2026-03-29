import { config } from '../config.js';
import { db } from '../data/store.js';
import { createOpaqueToken } from './security.js';

export function issueSession(userId: string) {
  const accessToken = createOpaqueToken('atk');
  const refreshToken = createOpaqueToken('rtk');
  const now = Date.now();

  db.accessTokens.set(accessToken, {
    userId,
    expiresAt: now + config.accessTokenTtlMs,
  });

  db.refreshTokens.set(refreshToken, {
    userId,
    expiresAt: now + config.refreshTokenTtlMs,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(config.accessTokenTtlMs / 1000),
    userId,
  };
}

export function revokeAccessToken(token: string | undefined) {
  if (token) db.accessTokens.delete(token);
}

export function revokeRefreshToken(token: string | undefined) {
  if (token) db.refreshTokens.delete(token);
}

export function rotateRefreshToken(refreshToken: string) {
  const existing = db.refreshTokens.get(refreshToken);
  if (!existing || existing.expiresAt <= Date.now()) {
    db.refreshTokens.delete(refreshToken);
    return null;
  }

  db.refreshTokens.delete(refreshToken);
  return issueSession(existing.userId);
}
