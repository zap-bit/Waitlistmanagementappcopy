import { Router } from 'express';
import { requireAuth, requireRole, requireStaffEventAccess } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { supabase } from '../lib/supabase.js';

export const staffRouter = Router({ mergeParams: true });

staffRouter.use(requireAuth, requireRole('staff'), requireStaffEventAccess);

staffRouter.get('/dashboard', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };

  const [{ data: waitlist, error: waitlistError }, { data: tables, error: tablesError }] = await Promise.all([
    supabase.from('party').select('*').eq('event_uuid', eventId),
    supabase.from('event_table').select('*').eq('event_uuid', eventId),
  ]);

  if (waitlistError || tablesError) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to load dashboard'));

  const occupiedTables = 0;
  const guestsSeated = 0;

  return res.json({
    occupancy: {
      occupiedTables,
      totalTables: tables?.length ?? 0,
      guestsSeated,
    },
    waitlist: waitlist ?? [],
    tables: tables ?? [],
  });
});

staffRouter.post('/promote', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : undefined;

  let query = supabase.from('party').select('*').eq('event_uuid', eventId).limit(1);
  if (entryId) query = supabase.from('party').select('*').eq('event_uuid', eventId).eq('uuid', entryId).limit(1);
  const { data, error } = await query;

  if (error || !data?.length) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  const entry = data[0];
  await supabase.from('notifications').insert({ account_uuid: entry.account_uuid, event_uuid: eventId, sent_time: new Date().toISOString() });

  return res.json({ promoted: [entry] });
});

staffRouter.post('/seat', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const { entryId } = req.body ?? {};

  const { data: entry, error } = await supabase.from('party').select('*').eq('uuid', entryId).eq('event_uuid', eventId).maybeSingle();
  if (error || !entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  await supabase.from('party').delete().eq('uuid', entry.uuid);
  await supabase.from('cap_waitlist').insert({
    account_uuid: entry.account_uuid,
    event_uuid: eventId,
    dropped_out: false,
    no_show: false,
    exit_reason: 'SERVED',
  });

  return res.json({ entryId, status: 'SEATED' });
});

staffRouter.post('/clear-table', async (_req, res) => {
  return res.json({ ok: true });
});
