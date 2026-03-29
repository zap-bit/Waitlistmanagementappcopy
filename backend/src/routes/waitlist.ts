import { Router } from 'express';
import { deleteWaitlistEntry, getEventById, insertWaitlistEntry } from '../data/supabaseStore.js';
import { requireAuth } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

export const waitlistRouter = Router({ mergeParams: true });
waitlistRouter.use(requireAuth);

waitlistRouter.get('/', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId }));

    if (req.authUser?.role === 'staff') {
      if (!req.authUser.businessId || event.businessId !== req.authUser.businessId) return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this waitlist'));
      return res.json({ data: event.waitlist });
    }
    return res.json({ data: event.waitlist.filter((item) => item.createdByUserId === req.authUser!.id) });
  } catch (error) { return next(error); }
});

waitlistRouter.post('/', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const { name, partySize, type = 'waitlist', specialRequests } = req.body ?? {};
    const trimmedName = String(name || '').trim();
    const normalizedPartySize = Number(partySize);
    if (!trimmedName || !Number.isInteger(normalizedPartySize) || normalizedPartySize < 1 || normalizedPartySize > 20) return next(new ApiError(400, 'INVALID_INPUT', 'Valid name and partySize (1-20) are required'));
    if (type !== 'waitlist' && type !== 'reservation') return next(new ApiError(400, 'INVALID_INPUT', 'type must be waitlist or reservation'));

    const entry = await insertWaitlistEntry(eventId, { name: trimmedName, partySize: normalizedPartySize, type, specialRequests: typeof specialRequests === 'string' ? specialRequests.trim().slice(0, 500) : undefined, createdByUserId: req.authUser!.id });
    return res.status(201).json(entry);
  } catch (error) { return next(error); }
});

waitlistRouter.get('/:entryId', async (req, res, next) => {
  try {
    const { eventId, entryId } = req.params as { eventId: string; entryId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

    const entry = event.waitlist.find((item) => item.id === entryId);
    if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

    const isStaffWithAccess = req.authUser?.role === 'staff' && req.authUser.businessId === event.businessId;
    const isOwner = entry.createdByUserId === req.authUser?.id;
    if (!isStaffWithAccess && !isOwner) return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this waitlist entry'));

    return res.json(entry);
  } catch (error) { return next(error); }
});

waitlistRouter.delete('/:entryId', async (req, res, next) => {
  try {
    const { eventId, entryId } = req.params as { eventId: string; entryId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

    const entry = event.waitlist.find((item) => item.id === entryId);
    if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

    const isStaffWithAccess = req.authUser?.role === 'staff' && req.authUser.businessId === event.businessId;
    const isOwner = entry.createdByUserId === req.authUser?.id;
    if (!isStaffWithAccess && !isOwner) return next(new ApiError(403, 'FORBIDDEN', 'You cannot delete this waitlist entry'));

    await deleteWaitlistEntry(entryId);
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});
