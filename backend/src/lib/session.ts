import crypto from 'node:crypto';
import { config } from '../config.js';

type TokenKind = 'access' | 'refresh';

interface SessionTokenPayload {
  userId: string;
  kind: TokenKind;
  exp: number;
}

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8');
}

function signPayload(payload: SessionTokenPayload): string {
  const body = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  return `${body}.${signature}`;
}

function verifyToken(token: string, kind: TokenKind): SessionTokenPayload | null {
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = crypto.createHmac('sha256', config.sessionSecret).update(body).digest('base64url');
  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (signatureBuffer.length !== expectedBuffer.length) return null;
  if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) return null;

  let payload: SessionTokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(body)) as SessionTokenPayload;
  } catch {
    return null;
  }

  if (payload.kind !== kind) return null;
  if (!payload.userId || !payload.exp || payload.exp <= Date.now()) return null;
  return payload;
}

export function issueSession(userId: string) {
  const accessToken = signPayload({ userId, kind: 'access', exp: Date.now() + config.accessTokenTtlMs });
  const refreshToken = signPayload({ userId, kind: 'refresh', exp: Date.now() + config.refreshTokenTtlMs });
  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(config.accessTokenTtlMs / 1000),
    userId,
  };
}

export function verifyAccessToken(token: string): { userId: string } | null {
  const payload = verifyToken(token, 'access');
  return payload ? { userId: payload.userId } : null;
}

export function rotateRefreshToken(refreshToken: string) {
  const payload = verifyToken(refreshToken, 'refresh');
  if (!payload) return null;
  return issueSession(payload.userId);
}
