import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const requiredTables = ['ACCOUNT', 'EVENTS', 'PARTY', 'EVENT_TABLE', 'CAP_WAITLIST', 'TABLE_QUEUE', 'ATTENDANCE', 'NOTIFICATIONS'];

for (const table of requiredTables) {
  const { error } = await supabase.from(table).select('*', { head: true, count: 'exact' }).limit(1);
  if (error) {
    throw new Error(`Table check failed for ${table}: ${error.message}`);
  }
}

const migrationSqlPath = resolve(process.cwd(), 'migrations/001_schema_alignment.sql');
const migrationSql = readFileSync(migrationSqlPath, 'utf8');

console.log('✅ Supabase connectivity and table checks passed.');
console.log('Run this SQL in Supabase SQL Editor if not yet applied:');
console.log('---');
console.log(migrationSql);
console.log('---');
