import { Router } from 'express';
import { db, recalcQueuePositions } from '../data/store.js';
import { requireAuth, requireRole, requireStaffEventAccess } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

export const staffRouter = Router({ mergeParams: true });

staffRouter.use(requireAuth, requireRole('staff'), requireStaffEventAccess);

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

  const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : undefined;
  const entry = entryId ? event.waitlist.find((item) => item.id === entryId) : event.waitlist[0];

  if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

  entry.status = 'NOTIFIED';
  return res.json({ promoted: [entry] });
});

staffRouter.post('/seat', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const { entryId, tableId } = req.body ?? {};
  const entry = event.waitlist.find((e) => e.id === entryId);
  const table = event.tables.find((t) => t.id === Number(tableId));

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

  return res.json({ entryId, tableId: table.id, status: 'SEATED' });
});

staffRouter.post('/clear-table', (req, res, next) => {
  const { eventId } = req.params as { eventId: string };
  const event = db.events.get(eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

  const tableId = Number(req.body?.tableId);
  const table = event.tables.find((item) => item.id === tableId);
  if (!table) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Table not found'));

  table.occupied = false;
  table.guestName = undefined;
  table.partySize = undefined;
  table.seatedAt = undefined;

  return res.json({ ok: true, tableId });
});
