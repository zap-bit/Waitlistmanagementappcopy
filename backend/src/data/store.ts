import { nanoid } from 'nanoid';
import type { EventModel, WaitlistEntry } from '../types/contracts.js';

const makeTables = (totalTables = 12) => {
  const cols = 4;
  return Array.from({ length: totalTables }).map((_, index) => ({
    id: index + 1,
    row: Math.floor(index / cols),
    col: index % cols,
    name: `Table ${index + 1}`,
    capacity: [2, 2, 4, 4, 2, 4, 6, 6, 4, 4, 6, 8][index] ?? 4,
    occupied: false,
  }));
};

const now = new Date();

const demoEvent: EventModel = {
  id: 'demo-event',
  name: 'Figma Demo Restaurant',
  eventType: 'INDOOR_TABLES',
  maxCapacity: 100,
  totalTables: 12,
  startTime: new Date(now.getTime() - 60 * 60 * 1000).toISOString(),
  endTime: new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString(),
  offlineEnabled: true,
  tables: makeTables(12),
  waitlist: [
    {
      id: nanoid(),
      eventId: 'demo-event',
      name: 'Sarah Johnson',
      partySize: 4,
      type: 'waitlist',
      status: 'QUEUED',
      position: 1,
      estimatedWait: 20,
      joinedAt: new Date(now.getTime() - 15 * 60 * 1000).toISOString(),
    },
  ],
};

export const db = {
  events: new Map<string, EventModel>([[demoEvent.id, demoEvent]]),
};

export function recalcQueuePositions(eventId: string) {
  const event = db.events.get(eventId);
  if (!event) return;
  event.waitlist = event.waitlist.map((entry, idx) => ({
    ...entry,
    position: idx + 1,
    estimatedWait: Math.max(5, (idx + 1) * 8),
  }));
}

export function addWaitlistEntry(eventId: string, payload: Pick<WaitlistEntry, 'name' | 'partySize' | 'type' | 'specialRequests'>) {
  const event = db.events.get(eventId);
  if (!event) return null;

  const entry: WaitlistEntry = {
    id: nanoid(),
    eventId,
    name: payload.name,
    partySize: payload.partySize,
    type: payload.type,
    status: 'QUEUED',
    position: event.waitlist.length + 1,
    estimatedWait: Math.max(5, (event.waitlist.length + 1) * 8),
    specialRequests: payload.specialRequests,
    joinedAt: new Date().toISOString(),
  };

  event.waitlist.push(entry);
  recalcQueuePositions(eventId);
  return entry;
}
