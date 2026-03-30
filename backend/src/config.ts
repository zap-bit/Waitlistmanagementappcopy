import 'dotenv/config';

const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'];

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export const config = {
  port: parsePositiveNumber(process.env.PORT, 8000),
  corsAllowedOrigins: (process.env.CORS_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(','))
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean),
  accessTokenTtlMs: parsePositiveNumber(process.env.ACCESS_TOKEN_TTL_MS, 15 * 60 * 1000),
  refreshTokenTtlMs: parsePositiveNumber(process.env.REFRESH_TOKEN_TTL_MS, 7 * 24 * 60 * 60 * 1000),
  rateLimitWindowMs: parsePositiveNumber(process.env.RATE_LIMIT_WINDOW_MS, 60 * 1000),
  rateLimitMaxRequests: parsePositiveNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 120),
  sessionSecret: process.env.SESSION_SECRET || '',
};

export function assertConfig(): void {
  if (config.corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must include at least one origin');
  }
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  if (!config.sessionSecret || config.sessionSecret.length < 32) {
    throw new Error('SESSION_SECRET is required and must be at least 32 characters');
  }
}
