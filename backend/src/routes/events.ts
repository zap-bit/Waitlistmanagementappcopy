import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../data/store.js';
import { ApiError } from '../middleware/error.js';
import type { EventModel } from '../types/contracts.js';

export const eventsRouter = Router();

type EventPayload = Partial<EventModel> & { businessId: string; name: string; type: EventModel['type'] };

function toEvent(payload: EventPayload, existing?: EventModel): EventModel {
  const base = {
    id: existing?.id ?? nanoid(),
    businessId: payload.businessId,
    name: payload.name,
    type: payload.type,
    status: payload.status ?? 'active',
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    waitlist: existing?.waitlist ?? payload.waitlist ?? [],
    tables: existing?.tables ?? payload.tables ?? [],
  };

  if (payload.type === 'capacity-based') {
    return {
      ...base,
      type: 'capacity-based',
      capacity: payload.capacity ?? 100,
      estimatedWaitPerPerson: payload.estimatedWaitPerPerson ?? 5,
      location: payload.location ?? 'Main Entrance',
      currentCount: payload.currentCount ?? 0,
      queueMode: payload.queueMode ?? 'single',
      queues: payload.queues,
    };
  }

  const numberOfTables = payload.numberOfTables ?? (existing?.type === 'table-based' ? existing.numberOfTables : 12);
  return {
    ...base,
    type: 'table-based',
    numberOfTables,
    averageTableSize: payload.averageTableSize ?? 4,
    reservationDuration: payload.reservationDuration ?? 90,
    noShowPolicy: payload.noShowPolicy ?? 'Hold table for 15 minutes',
    currentFilledTables: payload.currentFilledTables ?? 0,
  };
}

eventsRouter.get('/', (req, res) => {
  const businessId = req.query.businessId ? String(req.query.businessId) : undefined;
  const allEvents = Array.from(db.events.values());
  const data = businessId ? allEvents.filter((event) => event.businessId === businessId) : allEvents;
  res.json({ data });
});

eventsRouter.get('/:eventId', (req, res, next) => {
  const event = db.events.get(req.params.eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
  return res.json(event);
});

eventsRouter.post('/', (req, res, next) => {
  const payload = req.body as Partial<EventPayload>;

  if (!payload?.businessId || !payload?.name || !payload?.type) {
    return next(new ApiError(400, 'INVALID_INPUT', 'businessId, name and type are required'));
  }

  if (payload.type !== 'capacity-based' && payload.type !== 'table-based') {
    return next(new ApiError(400, 'INVALID_INPUT', 'type must be capacity-based or table-based'));
  }

  const event = toEvent(payload as EventPayload);
  db.events.set(event.id, event);
  res.status(201).json(event);
});

eventsRouter.patch('/:eventId', (req, res, next) => {
  const existing = db.events.get(req.params.eventId);
  if (!existing) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));

  const merged = {
    ...existing,
    ...req.body,
    id: existing.id,
    createdAt: existing.createdAt,
    businessId: req.body?.businessId ?? existing.businessId,
    type: req.body?.type ?? existing.type,
  } as EventPayload;

  const event = toEvent(merged, existing);
  db.events.set(event.id, event);
  res.json(event);
});

eventsRouter.delete('/:eventId', (req, res, next) => {
  const exists = db.events.has(req.params.eventId);
  if (!exists) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));

  db.events.delete(req.params.eventId);
  res.json({ ok: true });
});
