import { nanoid } from 'nanoid';
import type { BusinessModel, EventModel, Table, UserModel, WaitlistEntry } from '../types/contracts.js';
import { supabaseRequest } from '../lib/supabase.js';

interface AccountRow { uuid: string; name: string; account_type: 'USER' | 'BUSINESS'; email: string; password: string; business_name: string | null; }
interface EventRow { uuid: string; account_uuid: string; name: string; event_type: 'TABLE' | 'CAPACITY'; archived: boolean; location: string | null; queue_capacity: number | null; est_wait: number | null; num_tables: number | null; avg_size: number | null; reservation_duration: number | null; no_show_policy: number | null; current_count?: number | null; current_filled_tables?: number | null; status?: string | null; created_at?: string | null; }
interface PartyRow { uuid: string; account_uuid: string; event_uuid: string; party_size: number; special_req: string | null; name: string; type: 'reservation' | 'waitlist'; status: string; position: number; estimated_wait: number; joined_at: string; }
interface EventTableRow { uuid: string; account_uuid: string | null; event_uuid: string; table_capacity: number; name: string; row_index: number; col_index: number; table_number: number; occupied: boolean; guest_name: string | null; party_size: number | null; seated_at: string | null; }

const partySelect = 'uuid,account_uuid,event_uuid,party_size,special_req,name,type,status,position,estimated_wait,joined_at';
const tableSelect = 'uuid,account_uuid,event_uuid,table_capacity,name,row_index,col_index,table_number,occupied,guest_name,party_size,seated_at';

const makeTables = (n = 12): Table[] => Array.from({ length: n }).map((_, i) => ({ id: i + 1, row: Math.floor(i / 4), col: i % 4, name: `Table ${i + 1}`, capacity: [2,2,4,4,2,4,6,6,4,4,6,8][i] ?? 4, occupied: false }));

function mapUser(row: AccountRow): UserModel { return { id: row.uuid, email: row.email, name: row.name, role: row.account_type === 'BUSINESS' ? 'staff' : 'user', businessId: row.account_type === 'BUSINESS' ? row.uuid : undefined }; }
function mapTable(r: EventTableRow): Table { return { id: r.table_number, row: r.row_index, col: r.col_index, name: r.name, capacity: r.table_capacity, occupied: r.occupied, guestName: r.guest_name ?? undefined, partySize: r.party_size ?? undefined, seatedAt: r.seated_at ?? undefined }; }
function mapWaitlist(r: PartyRow): WaitlistEntry { return { id: r.uuid, eventId: r.event_uuid, name: r.name, partySize: r.party_size, type: r.type, status: r.status as WaitlistEntry['status'], position: r.position, estimatedWait: r.estimated_wait, specialRequests: r.special_req ?? undefined, joinedAt: r.joined_at, createdByUserId: r.account_uuid }; }

export async function findAccountByEmail(email: string): Promise<{ user: UserModel; passwordHash: string } | null> {
  const rows = await supabaseRequest<AccountRow[]>('account', { query: { select: 'uuid,name,account_type,email,password,business_name', email: `eq.${email}`, limit: '1' } });
  if (!rows[0]) return null;
  return { user: mapUser(rows[0]), passwordHash: rows[0].password };
}

export async function createUserAccount(email: string, name: string, passwordHash: string): Promise<UserModel> {
  const [row] = await supabaseRequest<AccountRow[]>('account', { method: 'POST', body: [{ name, account_type: 'USER', email, password: passwordHash }] });
  return mapUser(row);
}

export async function createBusinessAccount(email: string, ownerName: string, businessName: string, passwordHash: string): Promise<{ user: UserModel; business: BusinessModel }> {
  const [row] = await supabaseRequest<AccountRow[]>('account', { method: 'POST', body: [{ name: ownerName, account_type: 'BUSINESS', email, password: passwordHash, business_name: businessName }] });
  return { user: mapUser(row), business: { id: row.uuid, name: businessName, ownerId: row.uuid } };
}

async function hydrateEvent(row: EventRow): Promise<EventModel> {
  const [tables, waitlist] = await Promise.all([
    supabaseRequest<EventTableRow[]>('event_table', { query: { select: tableSelect, event_uuid: `eq.${row.uuid}`, order: 'table_number.asc' } }),
    supabaseRequest<PartyRow[]>('party', { query: { select: partySelect, event_uuid: `eq.${row.uuid}`, order: 'position.asc' } }),
  ]);

  const base = { id: row.uuid, businessId: row.account_uuid, name: row.name, status: (row.status as EventModel['status']) || 'active', createdAt: row.created_at || new Date().toISOString(), waitlist: waitlist.map(mapWaitlist), tables: tables.map(mapTable) };
  if (row.event_type === 'CAPACITY') return { ...base, type: 'capacity-based', capacity: row.queue_capacity ?? 100, estimatedWaitPerPerson: row.est_wait ?? 5, location: row.location ?? 'Main Entrance', currentCount: row.current_count ?? 0 };
  return { ...base, type: 'table-based', numberOfTables: row.num_tables ?? base.tables.length, averageTableSize: row.avg_size ?? 4, reservationDuration: row.reservation_duration ?? 90, noShowPolicy: String(row.no_show_policy ?? 15), currentFilledTables: row.current_filled_tables ?? base.tables.filter((t) => t.occupied).length };
}

export async function listEventsForUser(user: UserModel): Promise<EventModel[]> {
  const query: Record<string, string> = { select: '*' };
  if (user.role === 'staff' && user.businessId) query.account_uuid = `eq.${user.businessId}`;
  else query.archived = 'eq.false';
  const rows = await supabaseRequest<EventRow[]>('events', { query });
  return Promise.all(rows.map(hydrateEvent));
}

export async function getEventById(eventId: string): Promise<EventModel | null> {
  const rows = await supabaseRequest<EventRow[]>('events', { query: { select: '*', uuid: `eq.${eventId}`, limit: '1' } });
  return rows[0] ? hydrateEvent(rows[0]) : null;
}

export async function saveEvent(event: EventModel): Promise<EventModel> {
  const eventType = event.type === 'table-based' ? 'TABLE' : 'CAPACITY';
  await supabaseRequest<EventRow[]>('events', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
    body: [{ uuid: event.id, account_uuid: event.businessId, name: event.name, event_type: eventType, archived: event.status !== 'active', location: event.type === 'capacity-based' ? event.location : null, queue_capacity: event.type === 'capacity-based' ? event.capacity : null, est_wait: event.type === 'capacity-based' ? event.estimatedWaitPerPerson : null, num_tables: event.type === 'table-based' ? event.numberOfTables : null, avg_size: event.type === 'table-based' ? event.averageTableSize : null, reservation_duration: event.type === 'table-based' ? event.reservationDuration : null, no_show_policy: event.type === 'table-based' ? Number.parseInt(event.noShowPolicy, 10) || 15 : null, status: event.status, created_at: event.createdAt, current_count: event.type === 'capacity-based' ? event.currentCount : null, current_filled_tables: event.type === 'table-based' ? event.currentFilledTables : null }],
    query: { on_conflict: 'uuid' },
  });

  const tables = event.tables.length ? event.tables : makeTables(event.type === 'table-based' ? event.numberOfTables : 0);
  if (tables.length) {
    await supabaseRequest('event_table', { method: 'DELETE', query: { event_uuid: `eq.${event.id}` } });
    await supabaseRequest<EventTableRow[]>('event_table', { method: 'POST', body: tables.map((t) => ({ uuid: nanoid(), account_uuid: event.businessId, event_uuid: event.id, table_capacity: t.capacity, name: t.name, row_index: t.row, col_index: t.col, table_number: t.id, occupied: t.occupied, guest_name: t.guestName ?? null, party_size: t.partySize ?? null, seated_at: t.seatedAt ?? null })) });
  }

  return (await getEventById(event.id))!;
}

export async function deleteEventById(eventId: string): Promise<void> {
  await supabaseRequest('event_table', { method: 'DELETE', query: { event_uuid: `eq.${eventId}` } });
  await supabaseRequest('party', { method: 'DELETE', query: { event_uuid: `eq.${eventId}` } });
  await supabaseRequest('events', { method: 'DELETE', query: { uuid: `eq.${eventId}` } });
}

export async function insertWaitlistEntry(eventId: string, payload: Pick<WaitlistEntry, 'name'|'partySize'|'type'|'specialRequests'|'createdByUserId'>): Promise<WaitlistEntry> {
  const existing = await supabaseRequest<PartyRow[]>('party', { query: { select: 'position', event_uuid: `eq.${eventId}`, order: 'position.desc', limit: '1' } });
  const next = (existing[0]?.position ?? 0) + 1;
  const [row] = await supabaseRequest<PartyRow[]>('party', { method: 'POST', body: [{ uuid: nanoid(), account_uuid: payload.createdByUserId, event_uuid: eventId, name: payload.name, party_size: payload.partySize, special_req: payload.specialRequests ?? null, type: payload.type, status: 'QUEUED', position: next, estimated_wait: Math.max(5, next * 8), joined_at: new Date().toISOString() }] });
  return mapWaitlist(row);
}

export async function deleteWaitlistEntry(entryId: string): Promise<void> { await supabaseRequest('party', { method: 'DELETE', query: { uuid: `eq.${entryId}` } }); }
export async function updateWaitlistStatus(entryId: string, status: WaitlistEntry['status']): Promise<WaitlistEntry | null> {
  const rows = await supabaseRequest<PartyRow[]>('party', { method: 'PATCH', query: { uuid: `eq.${entryId}` }, body: { status } });
  return rows[0] ? mapWaitlist(rows[0]) : null;
}

export async function clearTableOccupancy(eventId: string, tableId: number): Promise<void> {
  await supabaseRequest('event_table', { method: 'PATCH', query: { event_uuid: `eq.${eventId}`, table_number: `eq.${tableId}` }, body: { occupied: false, guest_name: null, party_size: null, seated_at: null } });
}

export async function seatWaitlistAtTable(eventId: string, entry: WaitlistEntry, tableId: number): Promise<void> {
  await supabaseRequest('event_table', { method: 'PATCH', query: { event_uuid: `eq.${eventId}`, table_number: `eq.${tableId}` }, body: { occupied: true, guest_name: entry.name, party_size: entry.partySize, seated_at: new Date().toISOString() } });
  await deleteWaitlistEntry(entry.id);
}

export async function listWaitlistByCreator(userId: string): Promise<WaitlistEntry[]> {
  const rows = await supabaseRequest<PartyRow[]>('party', { query: { select: partySelect, account_uuid: `eq.${userId}`, order: 'joined_at.desc' } });
  return rows.map(mapWaitlist);
}
