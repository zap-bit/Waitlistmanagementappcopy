import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';
import { supabase } from '../lib/supabase.js';
import { calculateHeuristicWait } from '../services/waitlistLogic.js';

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
  const { name, partySize, specialRequests, type, reservationTime } = req.body ?? {}; // <-- ADD reservationTime here

  const trimmedName = String(name || '').trim();
  const size = Number(partySize);

  if (!trimmedName || !Number.isInteger(size) || size < 1) {
    return next(new ApiError(400, 'INVALID_INPUT', 'A valid name and party size are required'));
  }

  const specialReq = specialRequests ? `${trimmedName} | ${String(specialRequests).trim()}` : trimmedName;

  // Get current max position for the event
  const { count } = await supabase
    .from('party')
    .select('*', { count: 'exact', head: true })
    .eq('event_uuid', eventId);

  const position = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from('party')
    .insert({
      account_uuid: req.authUser!.id,
      event_uuid: eventId,
      name: trimmedName,
      party_size: size,
      special_req: specialReq,
      type: type === 'reservation' ? 'reservation' : 'waitlist',
      reservation_time: reservationTime ? new Date(reservationTime).toISOString() : null, // <-- ADD THIS LINE
      status: 'QUEUED',
      position,
      estimated_wait: 15,
    })
    .select('*')
    .single();

  if (error) return next(new ApiError(400, 'INVALID_INPUT', error.message));

  return res.status(201).json(data);
});

waitlistRouter.get('/estimate', async (req, res, next) => {
  const eventId = req.params.eventId;

  if (!eventId) {
    return next(
      new ApiError(400, 'INVALID_INPUT', 'eventId is required')
    );
  }

  const result = await calculateHeuristicWait(eventId);

  return res.json(result);
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

waitlistRouter.patch('/:entryId', async (req, res, next) => {
  const { eventId, entryId } = req.params as { eventId: string; entryId: string };
  const updates = req.body ?? {};

  // Verify the entry exists and the user owns it (or is staff)
  const { data: entry, error: fetchError } = await supabase
    .from('party')
    .select('*')
    .eq('uuid', entryId)
    .eq('event_uuid', eventId)
    .maybeSingle();

  if (fetchError || !entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  if (req.authUser?.role !== 'staff' && entry.account_uuid !== req.authUser?.id) {
    return next(new ApiError(403, 'FORBIDDEN', 'You cannot edit this waitlist entry'));
  }

  // Prepare the fields to update
  const updateData: Record<string, any> = {};

  if (updates.name) updateData.name = String(updates.name).trim();
  if (updates.partySize) updateData.party_size = Number(updates.partySize);

  if (updates.reservationTime !== undefined) {
    updateData.reservation_time = updates.reservationTime ? new Date(String(updates.reservationTime)).toISOString() : null;
  }

  // Handle special requests formatting
  if (updates.specialRequests !== undefined || updates.name) {
    const baseName = updateData.name || entry.name;
    updateData.special_req = updates.specialRequests
      ? `${baseName} | ${String(updates.specialRequests).trim()}`
      : baseName;
  }

  // Send update to Supabase
  const { data, error } = await supabase
    .from('party')
    .update(updateData)
    .eq('uuid', entryId)
    .select('*')
    .single();

  if (error) return next(new ApiError(500, 'SERVER_ERROR', 'Failed to update waitlist entry'));

  return res.json(data);
});