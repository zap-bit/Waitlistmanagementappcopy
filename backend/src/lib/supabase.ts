import { config } from '../config.js';

export function isSupabaseConfigured(): boolean {
  return Boolean(config.supabaseUrl && config.supabaseServiceRoleKey);
}

export interface SupabaseRequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

/**
 * Minimal PostgREST helper so we can migrate incrementally without adding new runtime dependencies.
 */
export async function supabaseRequest<T>(table: string, options: SupabaseRequestOptions = {}): Promise<T> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }

  const url = new URL(`${config.supabaseUrl}/rest/v1/${table}`);
  if (options.query) {
    Object.entries(options.query).forEach(([key, value]) => url.searchParams.set(key, value));
  }

  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers: {
      apikey: config.supabaseServiceRoleKey!,
      Authorization: `Bearer ${config.supabaseServiceRoleKey!}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(options.headers ?? {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Supabase request failed (${response.status}): ${payload}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
