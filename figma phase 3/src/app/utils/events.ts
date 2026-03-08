// Simplified event types for multi-business support
export type EventType = 'capacity-based' | 'table-based';
export type EventStatus = 'active' | 'paused' | 'closed';
export type QueueMode = 'single' | 'multiple';

export interface Queue {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
}

export interface BaseEvent {
  id: string;
  businessId: string;
  name: string;
  type: EventType;
  status: EventStatus;
  createdAt: Date;
}

export interface CapacityBasedEvent extends BaseEvent {
  type: 'capacity-based';
  queueMode: QueueMode;
  capacity: number; // Used for single queue mode
  estimatedWaitPerPerson: number; // minutes
  location: string;
  currentCount: number; // Number of people in queue/waiting (single mode)
  queues?: Queue[]; // Array of queues for multiple mode
}

export interface TableBasedEvent extends BaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number; // minutes
  noShowPolicy: string;
  currentFilledTables: number;
}

export type Event = CapacityBasedEvent | TableBasedEvent;

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

// Delete an event
export const deleteEvent = (eventId: string) => {
  const events = getStoredEvents();
  const filtered = events.filter(e => e.id !== eventId);
  saveEvents(filtered);
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