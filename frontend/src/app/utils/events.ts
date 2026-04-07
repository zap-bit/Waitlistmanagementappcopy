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