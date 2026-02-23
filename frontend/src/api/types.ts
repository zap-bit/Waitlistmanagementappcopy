export type EntryType = 'reservation' | 'waitlist';

export interface ApiWaitlistEntry {
  id: string;
  eventId: string;
  name: string;
  partySize: number;
  type: EntryType;
  status: 'QUEUED' | 'NOTIFIED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED';
  estimatedWait: number;
  specialRequests?: string;
  joinedAt: string;
}

export interface ApiTable {
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

export interface DashboardResponse {
  occupancy: { occupiedTables: number; totalTables: number; guestsSeated: number };
  waitlist: ApiWaitlistEntry[];
  tables: ApiTable[];
}
