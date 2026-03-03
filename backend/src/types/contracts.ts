export type EntryType = 'reservation' | 'waitlist';
export type EntryStatus = 'QUEUED' | 'NOTIFIED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED';

export type EventType = 'capacity-based' | 'table-based';
export type EventStatus = 'active' | 'paused' | 'closed';

export interface WaitlistEntry {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  type: EntryType;
  status: EntryStatus;
  position: number;
  estimatedWait: number;
  specialRequests?: string;
  joinedAt: string;
}

export interface Table {
  id: number;
  row: number;
  col: number;
  name: string;
  capacity: number;
  occupied: boolean;
  guestName?: string;
  partySize?: number;
  seatedAt?: string;
}

export interface BaseEvent {
  id: string;
  businessId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: string;
  waitlist: WaitlistEntry[];
  tables: Table[];
}

export interface CapacityEvent extends BaseEvent {
  type: 'capacity-based';
  capacity: number;
  estimatedWaitPerPerson: number;
  location: string;
  currentCount: number;
}

export interface TableEvent extends BaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number;
  noShowPolicy: string;
  currentFilledTables: number;
}

export type EventModel = CapacityEvent | TableEvent;

export interface UserModel {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string;
}

export interface BusinessModel {
  id: string;
  name: string;
  ownerId: string;
}
