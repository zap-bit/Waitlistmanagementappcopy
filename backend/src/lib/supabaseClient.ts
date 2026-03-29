import { config, supabaseConfigured } from '../config.js';

export type SupabaseAccountRecord = {
  uuid: string;
  email: string;
  name: string | null;
  account_type: string | null;
  password_hash?: string | null;
  password?: string | null;
  business_uuid?: string | null;
};

async function querySupabase<T>(path: string): Promise<T[]> {
  if (!supabaseConfigured) {
    return [];
  }

  const response = await fetch(`${config.supabaseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: config.supabaseServiceRoleKey,
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Supabase query failed (${response.status})`);
  }

  return (await response.json()) as T[];
}

export async function findAccountByEmail(email: string): Promise<SupabaseAccountRecord | null> {
  const rows = await querySupabase<SupabaseAccountRecord>(
    `account?select=uuid,email,name,account_type,password_hash,password,business_uuid&email=eq.${encodeURIComponent(email)}&limit=1`,
  );
  return rows[0] ?? null;
}
