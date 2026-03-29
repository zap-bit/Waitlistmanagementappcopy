export type AccountType = 'USER' | 'BUSINESS';
export type EventType = 'TABLE' | 'CAPACITY';
export type CapType = 'SINGLE' | 'MULTI' | 'ATTENDANCE';
export type ExitReason = 'SERVED' | 'CANCEL' | 'NO_SHOW';

export interface AccountModel {
  UUID: string;
  name: string;
  account_type: AccountType;
  email: string;
  password: string;
  business_name: string | null;
  phone: string | null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string;
}

export interface EventModel {
  UUID: string;
  account_uuid: string;
  name: string;
  event_type: EventType;
  archived: boolean;
  location: string | null;
  cap_type: CapType | null;
  queue_capacity: number | null;
  est_wait: number | null;
  num_tables: number | null;
  avg_size: number | null;
  reservation_duration: number | null;
  no_show_policy: number | null;
  no_show_rate: number | null;
  avg_service_time: number | null;
}

export interface PartyModel {
  UUID: string;
  account_uuid: string;
  event_uuid: string;
  party_size: number;
  special_req: string | null;
}

export interface EventTableModel {
  UUID: string;
  account_uuid: string | null;
  event_uuid: string;
  table_capacity: number;
  name: string;
}

export interface AccessSession {
  userId: string;
  expiresAt: number;
}

export interface RefreshSession {
  userId: string;
  expiresAt: number;
}
