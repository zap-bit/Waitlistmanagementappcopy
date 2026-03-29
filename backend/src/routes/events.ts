import { Router } from 'express';
import { nanoid } from 'nanoid';
import { ApiError } from '../middleware/error.js';
import type { EventModel, Table } from '../types/contracts.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { deleteEventById, getEventById, listEventsForUser, saveEvent } from '../data/supabaseStore.js';

export const eventsRouter = Router();

type EventPayload = Partial<EventModel> & {
  businessId?: string; name?: string; type?: EventModel['type']; capacity?: number; estimatedWaitPerPerson?: number;
  location?: string; currentCount?: number; numberOfTables?: number; averageTableSize?: number; reservationDuration?: number;
  noShowPolicy?: string; currentFilledTables?: number;
};

function makeTables(totalTables: number): Table[] {
  const cols = 4;
  return Array.from({ length: totalTables }).map((_, index) => ({ id: index + 1, row: Math.floor(index / cols), col: index % cols, name: `Table ${index + 1}`, capacity: [2,2,4,4,2,4,6,6,4,4,6,8][index] ?? 4, occupied: false }));
}

function toEvent(payload: EventPayload, existing?: EventModel): EventModel {
  const type = payload.type ?? existing?.type;
  if (type !== 'capacity-based' && type !== 'table-based') throw new ApiError(400, 'INVALID_INPUT', 'type must be capacity-based or table-based');

  const base = { id: existing?.id ?? nanoid(), businessId: payload.businessId ?? existing?.businessId ?? '', name: String(payload.name ?? existing?.name ?? '').trim(), type, status: payload.status ?? existing?.status ?? 'active', createdAt: existing?.createdAt ?? new Date().toISOString(), waitlist: existing?.waitlist ?? [], tables: existing?.tables ?? payload.tables ?? [] };
  if (!base.businessId || !base.name) throw new ApiError(400, 'INVALID_INPUT', 'businessId and name are required');

  if (type === 'capacity-based') {
    return { ...base, type: 'capacity-based', capacity: Number(payload.capacity ?? (existing?.type === 'capacity-based' ? existing.capacity : 100)) || 100, estimatedWaitPerPerson: Number(payload.estimatedWaitPerPerson ?? (existing?.type === 'capacity-based' ? existing.estimatedWaitPerPerson : 5)) || 5, location: String(payload.location ?? (existing?.type === 'capacity-based' ? existing.location : 'Main Entrance')).trim() || 'Main Entrance', currentCount: Number(payload.currentCount ?? (existing?.type === 'capacity-based' ? existing.currentCount : 0)) || 0 };
  }

  const numberOfTables = Number(payload.numberOfTables ?? (existing?.type === 'table-based' ? existing.numberOfTables : 12)) || 12;
  return { ...base, type: 'table-based', tables: existing?.tables?.length ? existing.tables : makeTables(numberOfTables), numberOfTables, averageTableSize: Number(payload.averageTableSize ?? (existing?.type === 'table-based' ? existing.averageTableSize : 4)) || 4, reservationDuration: Number(payload.reservationDuration ?? (existing?.type === 'table-based' ? existing.reservationDuration : 90)) || 90, noShowPolicy: String(payload.noShowPolicy ?? (existing?.type === 'table-based' ? existing.noShowPolicy : 'Hold table for 15 minutes')).trim() || 'Hold table for 15 minutes', currentFilledTables: Number(payload.currentFilledTables ?? (existing?.type === 'table-based' ? existing.currentFilledTables : 0)) || 0 };
}

eventsRouter.use(requireAuth);

eventsRouter.get('/', async (req, res, next) => {
  try { return res.json({ data: await listEventsForUser(req.authUser!) }); }
  catch (error) { return next(error); }
});

eventsRouter.get('/:eventId', async (req, res, next) => {
  try {
    const event = await getEventById(req.params.eventId);
    if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
    if (req.authUser?.role === 'staff' && (!req.authUser.businessId || event.businessId !== req.authUser.businessId)) {
      return next(new ApiError(403, 'FORBIDDEN', 'You cannot access this event'));
    }
    return res.json(event);
  } catch (error) { return next(error); }
});

eventsRouter.post('/', requireRole('staff'), async (req, res, next) => {
  try {
    const event = toEvent({ ...(req.body as Partial<EventPayload>), businessId: req.authUser!.businessId });
    return res.status(201).json(await saveEvent(event));
  } catch (error) { return next(error); }
});

eventsRouter.patch('/:eventId', requireRole('staff'), async (req, res, next) => {
  try {
    const existing = await getEventById(req.params.eventId);
    if (!existing) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
    if (!req.authUser?.businessId || existing.businessId !== req.authUser.businessId) return next(new ApiError(403, 'FORBIDDEN', 'You cannot modify this event'));
    const event = toEvent({ ...existing, ...req.body, businessId: existing.businessId, type: existing.type }, existing);
    return res.json(await saveEvent(event));
  } catch (error) { return next(error); }
});

eventsRouter.delete('/:eventId', requireRole('staff'), async (req, res, next) => {
  try {
    const existing = await getEventById(req.params.eventId);
    if (!existing) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
    if (!req.authUser?.businessId || existing.businessId !== req.authUser.businessId) return next(new ApiError(403, 'FORBIDDEN', 'You cannot delete this event'));
    await deleteEventById(req.params.eventId);
    return res.json({ ok: true });
  } catch (error) { return next(error); }
});
