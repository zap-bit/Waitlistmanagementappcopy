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

export type EventType = 'capacity-based' | 'table-based';
export type EventStatus = 'active' | 'paused' | 'closed';

export interface ApiBaseEvent {
  id: string;
  businessId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: string;
}

export interface ApiCapacityEvent extends ApiBaseEvent {
  type: 'capacity-based';
  capacity: number;
  estimatedWaitPerPerson: number;
  location: string;
  currentCount: number;
}

export interface ApiTableEvent extends ApiBaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number;
  noShowPolicy: string;
  currentFilledTables: number;
}

export type ApiEvent = ApiCapacityEvent | ApiTableEvent;

export interface ApiUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: number;
  user: ApiUser;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface SignupUserRequest {
  email: string;
  password: string;
  name: string;
}

export interface SignupBusinessRequest {
  email: string;
  password: string;
  ownerName: string;
  businessName: string;
}
