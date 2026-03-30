import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { supabase } from '../lib/supabase.js';

export const waitlistRouter = Router({ mergeParams: true });

waitlistRouter.use(requireAuth);

waitlistRouter.get('/', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };

  if (req.authUser?.role === 'staff') {
    const { data: event } = await supabase.from('events').select('account_uuid').eq('uuid', eventId).maybeSingle();
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId }));
    if (!req.authUser.businessId || event.account_uuid !== req.authUser.businessId) {
      return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this waitlist'));
    }

    const { data, error } = await supabase.from('party').select('*').eq('event_uuid', eventId);
    if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to fetch waitlist'));
    return res.json({ data });
  }

  const { data, error } = await supabase.from('party').select('*').eq('event_uuid', eventId).eq('account_uuid', req.authUser!.id);
  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to fetch waitlist'));

  return res.json({ data });
});

waitlistRouter.post('/', async (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const { name, partySize, specialRequests } = req.body ?? {};

  const trimmedName = String(name || '').trim();
  const normalizedPartySize = Number(partySize);
  if (!trimmedName || !Number.isInteger(normalizedPartySize) || normalizedPartySize < 1 || normalizedPartySize > 20) {
    return next(new ApiError(400, 'INVALID_INPUT', 'Valid name and partySize (1-20) are required'));
  }

  const { data: event } = await supabase.from('events').select('uuid').eq('uuid', eventId).maybeSingle();
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId }));

  const { data, error } = await supabase
    .from('party')
    .insert({
      account_uuid: req.authUser!.id,
      event_uuid: eventId,
      party_size: normalizedPartySize,
      special_req: [trimmedName, typeof specialRequests === 'string' ? specialRequests.trim().slice(0, 500) : ''].filter(Boolean).join(' | '),
    })
    .select('*')
    .single();

  if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));

  return res.status(201).json(data);
});

waitlistRouter.get('/:entryId', async (req, res, next) => {
  const { eventId, entryId } = req.params as { eventId: string; entryId: string };
  const { data: entry, error } = await supabase.from('party').select('*').eq('uuid', entryId).eq('event_uuid', eventId).maybeSingle();

  if (error || !entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  if (req.authUser?.role !== 'staff' && entry.account_uuid !== req.authUser?.id) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this waitlist entry'));
  }

  return res.json(entry);
});

waitlistRouter.delete('/:entryId', async (req, res, next) => {
  const { eventId, entryId } = req.params as { eventId: string; entryId: string };
  const { data: entry } = await supabase.from('party').select('*').eq('uuid', entryId).eq('event_uuid', eventId).maybeSingle();
  if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  if (req.authUser?.role !== 'staff' && entry.account_uuid !== req.authUser?.id) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot delete this waitlist entry'));
  }

  const { error } = await supabase.from('party').delete().eq('uuid', entryId);
  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to delete waitlist entry'));
  return res.json({ ok: true });
});
