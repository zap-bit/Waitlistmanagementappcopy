import { Router } from 'express';
import { requireAuth, requireRole, requireStaffEventAccess } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { supabase } from '../lib/supabase.js';

export const staffRouter = Router({ mergeParams: true });

staffRouter.use(requireAuth, requireRole('staff'), requireStaffEventAccess);

staffRouter.get('/dashboard', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };

  const [
    { data: waitlist, error: waitlistError },
    { data: tables, error: tablesError },
    { data: seated, error: seatedError },
  ] = await Promise.all([
    supabase.from('party').select('*').eq('event_uuid', eventId),
    supabase.from('event_table').select('*').eq('event_uuid', eventId),
    supabase.from('cap_waitlist').select('uuid').eq('event_uuid', eventId).eq('exit_reason', 'SERVED'),
  ]);

  if (waitlistError || tablesError || seatedError) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to load dashboard'));

  const occupiedTables = (tables ?? []).filter((t: Record<string, unknown>) => t.occupied).length;
  const guestsSeated = seated?.length ?? 0;

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
  const { entryId, tableId } = req.body ?? {};

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

  if (tableId !== undefined) {
    await supabase
      .from('event_table')
      .update({ occupied: true })
      .eq('event_uuid', eventId)
      .eq('table_number', tableId);
  }

  return res.json({ entryId, tableId, status: 'SEATED' });
});

staffRouter.post('/clear-table', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const { tableId } = req.body ?? {};

  if (tableId === undefined) return next(new ApiError(400, 'INVALID_INPUT', 'tableId is required'));

  const { error } = await supabase
    .from('event_table')
    .update({ occupied: false })
    .eq('event_uuid', eventId)
    .eq('table_number', tableId);

  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to clear table'));
  return res.json({ ok: true, tableId });
});
