import { Router } from 'express';
import { ApiError } from '../middleware/error.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { supabase } from '../lib/supabase.js';

export const eventsRouter = Router();

eventsRouter.use(requireAuth);

eventsRouter.get('/', async (req, res, next) => {
  let query = supabase.from('events').select('*');
  if (req.authUser?.role === 'staff') query = query.eq('account_uuid', req.authUser.businessId!);
  else query = query.eq('archived', false);

  const { data, error } = await query;
  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to fetch events'));
  return res.json({ data });
});

eventsRouter.get('/:eventId', async (req, res, next) => {
  const { data: event, error } = await supabase.from('events').select('*').eq('uuid', req.params.eventId).maybeSingle();
  if (error || !event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));

  if (req.authUser?.role === 'staff' && (!req.authUser.businessId || event.account_uuid !== req.authUser.businessId)) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this event'));
  }

  return res.json(event);
});

eventsRouter.post('/', requireRole('staff'), async (req, res, next) => {
  const payload = req.body ?? {};
  const eventType = payload.event_type;

  if (eventType !== 'TABLE' && eventType !== 'CAPACITY') {
    return next(new ApiError(400, 'INVALID_INPUT', 'event_type must be TABLE or CAPACITY'));
  }

  const insertPayload = {
    account_uuid: req.authUser!.businessId,
    name: String(payload.name || '').trim(),
    event_type: eventType,
    archived: Boolean(payload.archived ?? false),
    location: payload.location ?? null,
    cap_type: payload.cap_type ?? null,
    queue_capacity: payload.queue_capacity ?? null,
    est_wait: payload.est_wait ?? null,
    num_tables: payload.num_tables ?? null,
    avg_size: payload.avg_size ?? null,
    reservation_duration: payload.reservation_duration ?? null,
    no_show_policy: payload.no_show_policy ?? null,
    no_show_rate: payload.no_show_rate ?? null,
    avg_service_time: payload.avg_service_time ?? null,
  };

  const { data, error } = await supabase.from('events').insert(insertPayload).select('*').single();
  if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));

  return res.status(201).json(data);
});

eventsRouter.patch('/:eventId', requireRole('staff'), async (req, res, next) => {
  const { data: existing } = await supabase.from('events').select('uuid,account_uuid').eq('uuid', req.params.eventId).maybeSingle();
  if (!existing) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
  if (!req.authUser?.businessId || existing.account_uuid !== req.authUser.businessId) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot modify this event'));
  }

  const { data, error } = await supabase.from('events').update(req.body ?? {}).eq('uuid', req.params.eventId).select('*').single();
  if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));
  return res.json(data);
});

eventsRouter.delete('/:eventId', requireRole('staff'), async (req, res, next) => {
  const { data: existing } = await supabase.from('events').select('uuid,account_uuid').eq('uuid', req.params.eventId).maybeSingle();
  if (!existing) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
  if (!req.authUser?.businessId || existing.account_uuid !== req.authUser.businessId) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot delete this event'));
  }

  const { error } = await supabase.from('events').update({ archived: true }).eq('uuid', req.params.eventId);
  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to archive event'));

  return res.json({ ok: true });
});

eventsRouter.put('/:eventId/tables/:tableId', requireRole('staff'), async (req, res, next) => {
  const { eventId, tableId } = req.params;
  const payload = req.body ?? {};

  const { data: existing } = await supabase
    .from('event_table')
    .select('uuid')
    .eq('event_uuid', eventId)
    .eq('table_number', tableId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('event_table')
      .update(payload)
      .eq('uuid', existing.uuid);
    if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));
  } else {
    const { error } = await supabase
      .from('event_table')
      .insert({ ...payload, event_uuid: eventId, account_uuid: req.authUser!.businessId });
    if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));
  }

  return res.json({ ok: true });
});
