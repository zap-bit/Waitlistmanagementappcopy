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
};

export function assertConfig(): void {
  if (config.corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must include at least one origin');
  }
}
