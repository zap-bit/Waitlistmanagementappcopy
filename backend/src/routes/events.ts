import { Router } from 'express';
import { nanoid } from 'nanoid';
import { db } from '../data/store.js';
import { ApiError } from '../middleware/error.js';

export const eventsRouter = Router();

eventsRouter.get('/', (_req, res) => {
  res.json({ data: Array.from(db.events.values()) });
});

eventsRouter.get('/:eventId', (req, res, next) => {
  const event = db.events.get(req.params.eventId);
  if (!event) return next(new ApiError(404, 'RESOURCE_NOT_FOUND', 'Event not found', { eventId: req.params.eventId }));
  return res.json(event);
});

eventsRouter.post('/', (req, res) => {
  const payload = req.body;
  const id = nanoid();
  const event = {
    id,
    ...payload,
    waitlist: [],
    tables: [],
  };
  db.events.set(id, event as any);
  res.status(201).json(event);
});
