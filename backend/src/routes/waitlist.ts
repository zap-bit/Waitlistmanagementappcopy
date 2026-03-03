import { Router } from 'express';
import { addWaitlistEntry, db, recalcQueuePositions } from '../data/store.js';
import { ApiError } from '../middleware/error.js';

export const waitlistRouter = Router({ mergeParams: true });

waitlistRouter.get('/', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId }));
  return res.json({ data: event.waitlist });
});

waitlistRouter.post('/', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const { name, partySize, type = 'waitlist', specialRequests } = req.body ?? {};
  if (!name || !partySize) return next(new ApiError(400, 'INVALID_INPUT', 'name and partySize are required'));

  const entry = addWaitlistEntry(eventId, { name, partySize, type, specialRequests });
  if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId }));

  return res.status(201).json(entry);
});

waitlistRouter.get('/:entryId', (req, res, next) => {
  const { eventId, entryId } = req.params as { eventId: string; entryId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const entry = event.waitlist.find((item) => item.id === entryId);
  if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));
  return res.json(entry);
});

waitlistRouter.delete('/:entryId', (req, res, next) => {
  const { eventId, entryId } = req.params as { eventId: string; entryId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const exists = event.waitlist.some((item) => item.id === entryId);
  if (!exists) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  event.waitlist = event.waitlist.filter((item) => item.id !== entryId);
  recalcQueuePositions(eventId);
  return res.json({ ok: true });
});
