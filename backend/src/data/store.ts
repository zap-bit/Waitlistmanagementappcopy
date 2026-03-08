import { nanoid } from 'nanoid';
import { hashPassword } from '../utils/security.js';
import type { BusinessModel, EventModel, UserModel, WaitlistEntry } from '../types/contracts.js';

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
const demoBusinessId = 'biz-demo';

const demoEvent: EventModel = {
  id: 'demo-event',
  businessId: demoBusinessId,
  name: 'Figma Demo Restaurant',
  type: 'table-based',
  status: 'active',
  createdAt: now.toISOString(),
  numberOfTables: 12,
  averageTableSize: 4,
  reservationDuration: 90,
  noShowPolicy: 'Hold table for 15 minutes',
  currentFilledTables: 1,
  tables: makeTables(12),
  waitlist: [
    {
      id: nanoid(),
      eventId: 'demo-event',
      queueId: 'main',
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

demoEvent.tables[0].occupied = true;
demoEvent.tables[0].guestName = 'Michael Chen';
demoEvent.tables[0].partySize = 2;
demoEvent.tables[0].seatedAt = new Date(now.getTime() - 12 * 60 * 1000).toISOString();

const demoBusiness: BusinessModel = {
  id: demoBusinessId,
  name: 'Figma Demo Restaurant',
  ownerId: 'staff-demo',
};

const demoStaffUser: UserModel = {
  id: 'staff-demo',
  email: 'admin@demo.com',
  name: 'Demo Manager',
  role: 'staff',
  businessId: demoBusiness.id,
};

const demoAttendeeUser: UserModel = {
  id: 'user-demo',
  email: 'guest@demo.com',
  name: 'Demo Guest',
  role: 'user',
};

export const db = {
  events: new Map<string, EventModel>([[demoEvent.id, demoEvent]]),
  users: new Map<string, UserModel>([
    [demoStaffUser.id, demoStaffUser],
    [demoAttendeeUser.id, demoAttendeeUser],
  ]),
  usersByEmail: new Map<string, string>([
    [demoStaffUser.email.toLowerCase(), demoStaffUser.id],
    [demoAttendeeUser.email.toLowerCase(), demoAttendeeUser.id],
  ]),
  passwords: new Map<string, string>([
    [demoStaffUser.id, hashPassword('password123')],
    [demoAttendeeUser.id, hashPassword('password123')],
  ]),
  businesses: new Map<string, BusinessModel>([[demoBusiness.id, demoBusiness]]),
  tokens: new Map<string, string>(),
};

export function recalcQueuePositions(eventId: string, queueId?: string) {
  const event = db.events.get(eventId);
  if (!event) return;

  const counters = new Map<string, number>();
  event.waitlist = event.waitlist.map((entry) => {
    if (queueId && entry.queueId !== queueId) return entry;

    const key = `${entry.type}::${entry.queueId ?? 'default'}`;
    const nextPosition = (counters.get(key) ?? 0) + 1;
    counters.set(key, nextPosition);

    return {
      ...entry,
      position: nextPosition,
      estimatedWait: Math.max(5, nextPosition * 8),
    };
  });
}

export function addWaitlistEntry(eventId: string, payload: Pick<WaitlistEntry, 'name' | 'partySize' | 'type' | 'specialRequests' | 'queueId'>) {
  const event = db.events.get(eventId);
  if (!event) return null;

  const bucketSize = event.waitlist.filter(
    (item) => item.type === payload.type && item.queueId === payload.queueId,
  ).length;

  const entry: WaitlistEntry = {
    id: nanoid(),
    eventId,
    queueId: payload.queueId,
    name: payload.name,
    partySize: payload.partySize,
    type: payload.type,
    status: 'QUEUED',
    position: bucketSize + 1,
    estimatedWait: Math.max(5, (bucketSize + 1) * 8),
    specialRequests: payload.specialRequests,
    joinedAt: new Date().toISOString(),
  };

  event.waitlist.push(entry);

  if (event.type === 'capacity-based') {
    event.currentCount += payload.partySize;
  }

  recalcQueuePositions(eventId, payload.queueId);
  return entry;
}
