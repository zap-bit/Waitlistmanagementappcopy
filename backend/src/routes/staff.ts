import { Router } from 'express';
import { db, recalcQueuePositions } from '../data/store.js';
import { ApiError } from '../middleware/error.js';

export const staffRouter = Router({ mergeParams: true });

staffRouter.get('/dashboard', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const occupiedTables = event.tables.filter((t) => t.occupied).length;
  const guestsSeated = event.tables.reduce((sum, t) => sum + (t.partySize ?? 0), 0);

  return res.json({
    occupancy: {
      occupiedTables,
      totalTables: event.tables.length,
      guestsSeated,
    },
    waitlist: event.waitlist,
    tables: event.tables,
  });
});

staffRouter.post('/promote', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const requestedType = req.body?.type;
  const nextEntry = requestedType ? event.waitlist.find((e) => e.type === requestedType) : event.waitlist[0];

  if (!nextEntry) return next(new ApiError(409, 'NO_CAPACITY', 'No queued guests found'));

  nextEntry.status = 'NOTIFIED';
  return res.json({ promoted: [nextEntry] });
});

staffRouter.post('/seat', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const { entryId, tableId } = req.body ?? {};
  const entry = event.waitlist.find((e) => e.id === entryId);
  const table = event.tables.find((t) => t.id === tableId);

  if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));
  if (!table) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Table not found'));
  if (table.occupied) return next(new ApiError(409, 'TABLE_OCCUPIED', 'Table is occupied'));
  if (entry.partySize > table.capacity) return next(new ApiError(409, 'INVALID_INPUT', 'Party exceeds table capacity'));

  table.occupied = true;
  table.guestName = entry.name;
  table.partySize = entry.partySize;
  table.seatedAt = new Date().toISOString();

  event.waitlist = event.waitlist.filter((e) => e.id !== entryId);
  recalcQueuePositions(eventId);

  return res.json({ entryId, tableId, status: 'SEATED' });
});
