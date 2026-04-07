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
}

export interface BaseEvent {
  id: string;
  businessId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: Date;
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
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

export const syncEventToSupabase = async (event: Event): Promise<void> => {
  const token = localStorage.getItem('authToken');
  if (!token) return;

  const eventType = event.type === 'table-based' ? 'TABLE' : 'CAPACITY';

  const isTable = event.type === 'table-based';
  const payload: Record<string, unknown> = {
    name: event.name,
    event_type: eventType,
    archived: event.archived ?? false,
    location: !isTable ? (event as CapacityBasedEvent).location : null,
    queue_capacity: !isTable ? (event as CapacityBasedEvent).capacity : null,
    est_wait: !isTable ? (event as CapacityBasedEvent).estimatedWaitPerPerson : null,
    cap_type: !isTable ? 'SINGLE' : null,
    num_tables: isTable ? (event as TableBasedEvent).numberOfTables : null,
    avg_size: isTable ? (event as TableBasedEvent).averageTableSize : null,
    reservation_duration: isTable ? (event as TableBasedEvent).reservationDuration : null,
    no_show_policy: isTable ? 15 : null,
    no_show_rate: null,
    avg_service_time: null,
  };

  try {
    await fetch(`${API_BASE}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    console.error('Failed to sync event to Supabase:', e);
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
        createdAt: new Date(e.created_at as string || Date.now()),
        archived: e.archived as boolean,
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

      return {
        ...base,
        type: 'capacity-based' as const,
        queueMode: 'single' as const,
        capacity: (e.queue_capacity as number) || 100,
        estimatedWaitPerPerson: (e.est_wait as number) || 5,
        location: (e.location as string) || '',
        currentCount: 0,
      } as CapacityBasedEvent;
    });

    saveEvents(mapped);
  } catch (e) {
    console.error('Failed to load events from Supabase:', e);
  }
};
