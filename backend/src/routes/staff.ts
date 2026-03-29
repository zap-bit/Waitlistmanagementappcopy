import { Router } from 'express';
import { clearTableOccupancy, getEventById, seatWaitlistAtTable, updateWaitlistStatus } from '../data/supabaseStore.js';
import { requireAuth, requireRole, requireStaffEventAccess } from '../middleware/auth.js';
import { ApiError } from '../middleware/error.js';

export const staffRouter = Router({ mergeParams: true });
staffRouter.use(requireAuth, requireRole('staff'), requireStaffEventAccess);

staffRouter.get('/dashboard', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));
    const occupiedTables = event.tables.filter((t) => t.occupied).length;
    const guestsSeated = event.tables.reduce((sum, t) => sum + (t.partySize ?? 0), 0);
    return res.json({ occupancy: { occupiedTables, totalTables: event.tables.length, guestsSeated }, waitlist: event.waitlist, tables: event.tables });
  } catch (error) { return next(error); }
});

staffRouter.post('/promote', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

    const entryId = typeof req.body?.entryId === 'string' ? req.body.entryId : undefined;
    const entry = entryId ? event.waitlist.find((item) => item.id === entryId) : event.waitlist[0];
    if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));

    const updated = await updateWaitlistStatus(entry.id, 'NOTIFIED');
    return res.json({ promoted: updated ? [updated] : [entry] });
  } catch (error) { return next(error); }
});

staffRouter.post('/seat', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const event = await getEventById(eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found'));

    const { entryId, tableId } = req.body ?? {};
    const entry = event.waitlist.find((e) => e.id === entryId);
    const table = event.tables.find((t) => t.id === Number(tableId));
    if (!entry) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Waitlist entry not found'));
    if (!table) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Table not found'));
    if (table.occupied) return next(new ApiError(409, 'TABLE_OCCUPIED', 'Table is occupied'));
    if (entry.partySize > table.capacity) return next(new ApiError(409, 'INVALID_INPUT', 'Party exceeds table capacity'));

    await seatWaitlistAtTable(eventId, entry, table.id);
    return res.json({ entryId, tableId: table.id, status: 'SEATED' });
  } catch (error) { return next(error); }
});

staffRouter.post('/clear-table', async (req, res, next) => {
  try {
    const { eventId } = req.params as { eventId: string };
    const tableId = Number(req.body?.tableId);
    if (!Number.isInteger(tableId) || tableId < 1) return next(new ApiError(400, 'INVALID_INPUT', 'tableId must be a positive integer'));

    await clearTableOccupancy(eventId, tableId);
    return res.json({ ok: true, tableId });
  } catch (error) { return next(error); }
});
