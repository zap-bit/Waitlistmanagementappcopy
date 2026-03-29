import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function loadEnvFromPath(envPath: string) {
  if (!existsSync(envPath)) return false;

  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const equalIndex = line.indexOf('=');
    if (equalIndex <= 0) continue;

    const key = line.slice(0, equalIndex).trim();
    const value = line.slice(equalIndex + 1).trim().replace(/^['"]|['"]$/g, '');
    if (key && process.env[key] === undefined) process.env[key] = value;
  }

  return true;
}

function loadDotEnvIfPresent() {
  const thisFileDir = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    resolve(process.cwd(), '.env'),
    resolve(process.cwd(), 'backend/.env'),
    resolve(thisFileDir, '../.env'),
    resolve(thisFileDir, '../../.env'),
  ];

  for (const candidate of candidates) {
    if (loadEnvFromPath(candidate)) return;
  }
}

loadDotEnvIfPresent();

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
  supabaseUrl: process.env.SUPABASE_URL?.trim() || undefined,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || undefined,
};

export function assertConfig(): void {
  if (config.corsAllowedOrigins.length === 0) {
    throw new Error('CORS_ALLOWED_ORIGINS must include at least one origin');
  }
  if (!config.supabaseUrl) throw new Error('SUPABASE_URL is required');
  if (!config.supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required');
}
