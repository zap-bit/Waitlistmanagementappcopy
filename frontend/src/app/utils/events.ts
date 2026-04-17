// Simplified event types for multi-business support
export type EventType = 'capacity-based' | 'table-based' | 'simple-capacity';
export type EventStatus = 'active' | 'paused' | 'closed';
export type QueueMode = 'single' | 'multiple';

export interface Queue {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  eventDateTime?: Date; // Optional date/time for this specific queue
  manualOffset?: number; // Tracks manual additions/removals from staff dashboard
}

export interface BaseEvent {
  id: string;
  businessId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: Date;
  isPublic: boolean; // Whether the event is publicly visible or private
  eventCode: string; // Unique code for users to join the event
  archived?: boolean;
  archivedAt?: Date;
}

export interface CapacityBasedEvent extends BaseEvent {
  type: 'capacity-based';
  queueMode: QueueMode;
  capacity: number; // Used for single queue mode
  estimatedWaitPerPerson: number; // minutes
  location: string;
  currentCount: number; // Number of people in queue/waiting (single mode)
  queues?: Queue[]; // Array of queues for multiple mode
  eventDateTime?: Date; // Optional date/time for the event
  manualOffset?: number; // Tracks manual additions/removals for single queue mode
}

export interface TableBasedEvent extends BaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number; // minutes
  noShowPolicy: string;
  currentFilledTables: number;
  eventDateTime?: Date; // Optional date/time for the event
}

export interface SimpleCapacityEvent extends BaseEvent {
  type: 'simple-capacity';
  capacity: number;
  estimatedWaitPerPerson: number; // minutes
  location: string;
  currentCount: number; // Number of people in queue/waiting
}

export type Event = CapacityBasedEvent | TableBasedEvent | SimpleCapacityEvent;

// Generate a unique event code
export const generateEventCode = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing characters
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// Get all events
export const getStoredEvents = (): Event[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('events');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((event: any) => ({
          ...event,
          createdAt: new Date(event.createdAt),
          archivedAt: event.archivedAt ? new Date(event.archivedAt) : undefined,
          eventDateTime: event.eventDateTime ? new Date(event.eventDateTime) : undefined,
          queues: event.queues?.map((queue: any) => ({
            ...queue,
            eventDateTime: queue.eventDateTime ? new Date(queue.eventDateTime) : undefined,
          })),
        }));
      } catch (e) {
        console.error('Error loading events from localStorage:', e);
      }
    }
  }
  return [];
};

// Save events
export const saveEvents = (events: Event[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('events', JSON.stringify(events));
  }
};

// Add a new event
export const addEvent = (event: Event) => {
  const events = getStoredEvents();
  events.push(event);
  saveEvents(events);
};

// Update an event
export const updateEvent = (eventId: string, updates: Partial<Event>) => {
  const events = getStoredEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], ...updates };
    saveEvents(events);
  }
};

// Update an event with full event object (overload)
export const updateEventFull = (event: Event) => {
  const events = getStoredEvents();
  const index = events.findIndex(e => e.id === event.id);
  if (index !== -1) {
    events[index] = event;
    saveEvents(events);
  }
};

// Archive an event
export const archiveEvent = (eventId: string) => {
  const events = getStoredEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], archived: true, archivedAt: new Date() };
    saveEvents(events);
  }
};

// Restore an archived event
export const restoreEvent = (eventId: string) => {
  const events = getStoredEvents();
  const index = events.findIndex(e => e.id === eventId);
  if (index !== -1) {
    events[index] = { ...events[index], archived: false, archivedAt: undefined };
    saveEvents(events);
  }
};

// Permanently delete an event
export const deleteEvent = (eventId: string) => {
  const events = getStoredEvents();
  const filtered = events.filter(e => e.id !== eventId);
  saveEvents(filtered);
};

// Get active (non-archived) events
export const getActiveEvents = (): Event[] => {
  return getStoredEvents().filter(e => !e.archived);
};

// Get archived events
export const getArchivedEvents = (): Event[] => {
  return getStoredEvents().filter(e => e.archived);
};

// Get events by business
export const getEventsByBusiness = (businessId: string): Event[] => {
  const events = getStoredEvents();
  return events.filter(e => e.businessId === businessId);
};

// Get event by ID
export const getEventById = (eventId: string): Event | null => {
  const events = getStoredEvents();
  return events.find(e => e.id === eventId) || null;
};

// --- Backend Integration ---

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

/** Patches core event fields in Supabase when an event is edited. */
export const patchEventInSupabase = async (event: Event): Promise<void> => {
  const token = localStorage.getItem('authToken');
  if (!token) return;
  const isTable = event.type === 'table-based';
  const isCapacity = event.type === 'capacity-based' || event.type === 'simple-capacity';
  try {
    await fetch(`${API_BASE}/events/${event.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        name: event.name,
        archived: event.archived ?? false,
        location: isCapacity ? (event as CapacityBasedEvent).location : null,
        queue_capacity: isCapacity ? (event as CapacityBasedEvent).capacity : null,
        est_wait: isCapacity ? (event as CapacityBasedEvent).estimatedWaitPerPerson : null,
        cap_type: event.type === 'simple-capacity'
          ? 'ATTENDANCE'
          : event.type === 'capacity-based'
            ? ((event as CapacityBasedEvent).queueMode === 'multiple' ? 'MULTI' : 'SINGLE')
            : null,
        num_tables: isTable ? (event as TableBasedEvent).numberOfTables : null,
        avg_size: isTable ? (event as TableBasedEvent).averageTableSize : null,
        reservation_duration: isTable ? (event as TableBasedEvent).reservationDuration : null,
        event_code: event.eventCode,
        public: event.isPublic ?? true,
      }),
    });
  } catch (e) {
    console.error('Failed to patch event in Supabase:', e);
  }
};

/** Replaces all queues for a MULTI-mode event in Supabase (event_queues table). */
export const patchEventQueues = async (eventId: string, queues: Queue[]): Promise<void> => {
  const token = localStorage.getItem('authToken');
  if (!token) return;
  try {
    await fetch(`${API_BASE}/events/${eventId}/queues`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ queues }),
    });
  } catch (e) {
    console.error('Failed to patch event queues:', e);
  }
};

/** Syncs a locally-created event to Supabase and replaces its local ID with the
 * returned Supabase UUID so future operations use the real ID.
 * Returns the remote UUID on success, null on failure. */
export const syncEventToSupabase = async (event: Event): Promise<string | null> => {
  const token = localStorage.getItem('authToken');
  if (!token) return null;

  const isTable = event.type === 'table-based';
  const isCapacity = event.type === 'capacity-based' || event.type === 'simple-capacity';
  const payload: Record<string, unknown> = {
    name: event.name,
    event_type: isTable ? 'TABLE' : 'CAPACITY',
    archived: event.archived ?? false,
    location: isCapacity ? (event as CapacityBasedEvent).location : null,
    queue_capacity: isCapacity ? (event as CapacityBasedEvent).capacity : null,
    est_wait: isCapacity ? (event as CapacityBasedEvent).estimatedWaitPerPerson : null,
    cap_type: event.type === 'simple-capacity'
      ? 'ATTENDANCE'
      : event.type === 'capacity-based'
        ? ((event as CapacityBasedEvent).queueMode === 'multiple' ? 'MULTI' : 'SINGLE')
        : null,
    num_tables: isTable ? (event as TableBasedEvent).numberOfTables : null,
    avg_size: isTable ? (event as TableBasedEvent).averageTableSize : null,
    reservation_duration: isTable ? (event as TableBasedEvent).reservationDuration : null,
    no_show_policy: isTable ? (event as TableBasedEvent).reservationDuration ? 15 : null : null,
    no_show_rate: null,
    avg_service_time: null,
    event_code: event.eventCode,
    is_public: event.isPublic ?? true,
  };

  try {
    const res = await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return null;
    const data = await res.json() as Record<string, unknown>;
    const remoteUuid = data.uuid as string | undefined;
    if (!remoteUuid) return null;

    // Replace the temporary local ID with the real Supabase UUID
    const events = getStoredEvents();
    const idx = events.findIndex(e => e.id === event.id);
    if (idx !== -1) {
      events[idx] = { ...events[idx], id: remoteUuid };
      saveEvents(events);
    }

    // Sync queues for multi-queue events
    const queues = (event as CapacityBasedEvent).queues;
    if (queues && queues.length > 0) {
      await patchEventQueues(remoteUuid, queues);
    }

    return remoteUuid;
  } catch (e) {
    console.error('Failed to sync event to Supabase:', e);
    return null;
  }
};

export const loadEventsFromSupabase = async (): Promise<void> => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  try {
    const res = await fetch(`${API_BASE}/events`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const { data } = await res.json();
    if (!data?.length) return;

    const mapped: Event[] = data.map((e: Record<string, unknown>) => {
      const base = {
        id: e.uuid as string,
        businessId: e.account_uuid as string,
        name: e.name as string,
        status: 'active' as EventStatus,
        createdAt: new Date((e.created_at as string) || Date.now()),
        archived: e.archived as boolean,
        isPublic: (e.public as boolean) ?? true,
        eventCode: (e.event_code as string) || generateEventCode(),
        queues: Array.isArray(e.event_queues)
          ? (e.event_queues as Record<string, unknown>[]).map((q) => ({
              id: q.uuid as string,
              name: q.name as string,
              capacity: (q.capacity as number) || 0,
              currentCount: (q.current_count as number) || 0,
              manualOffset: (q.manual_offset as number) || 0,
              eventDateTime: q.event_datetime ? new Date(q.event_datetime as string) : undefined,
            }))
          : [],
      };

      if (e.event_type === 'TABLE') {
        return {
          ...base,
          type: 'table-based' as const,
          numberOfTables: (e.num_tables as number) || 10,
          averageTableSize: (e.avg_size as number) || 4,
          reservationDuration: (e.reservation_duration as number) || 90,
          noShowPolicy: 'Hold for 15 minutes',
          currentFilledTables: 0,
        } as TableBasedEvent;
      }

      if (e.cap_type === 'ATTENDANCE') {
        return {
          ...base,
          type: 'simple-capacity' as const,
          capacity: (e.queue_capacity as number) || 100,
          estimatedWaitPerPerson: (e.est_wait as number) || 5,
          location: (e.location as string) || '',
          currentCount: (e.current_count as number) || 0,
        } as SimpleCapacityEvent;
      }

      return {
        ...base,
        type: 'capacity-based' as const,
        queueMode: (e.cap_type === 'MULTI' ? 'multiple' : 'single') as QueueMode,
        capacity: (e.queue_capacity as number) || 100,
        estimatedWaitPerPerson: (e.est_wait as number) || 5,
        location: (e.location as string) || '',
        currentCount: (e.current_count as number) || 0,
        manualOffset: 0,
      } as CapacityBasedEvent;
    });

    // Merge: keep any local-only events (offline-created, not yet in Supabase)
    const remoteIds = new Set(mapped.map(e => e.id));
    const localOnly = getStoredEvents().filter(e => !remoteIds.has(e.id));
    saveEvents([...mapped, ...localOnly]);
  } catch (e) {
    console.error('Failed to load events from Supabase:', e);
  }
};
