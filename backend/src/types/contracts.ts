export type EventType = 'OUTDOOR' | 'INDOOR_TABLES' | 'INDOOR_SEATED';
export type EntryType = 'reservation' | 'waitlist';
export type EntryStatus = 'QUEUED' | 'NOTIFIED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED';

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

export interface EventModel {
  id: string;
  name: string;
  eventType: EventType;
  maxCapacity: number;
  totalTables?: number;
  totalSeats?: number;
  startTime: string;
  endTime: string;
  offlineEnabled?: boolean;
  waitlist: WaitlistEntry[];
  tables: Table[];
}
