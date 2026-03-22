// Simplified event types for UI state and API caching
export type EventType = 'capacity-based' | 'table-based';
export type EventStatus = 'active' | 'paused' | 'closed';

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
  capacity: number;
  estimatedWaitPerPerson: number;
  location: string;
  currentCount: number;
}

export interface TableBasedEvent extends BaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number;
  noShowPolicy: string;
  currentFilledTables: number;
}

export type Event = CapacityBasedEvent | TableBasedEvent;

export const getStoredEvents = (): Event[] => {
  if (typeof window === 'undefined') return [];
  const saved = localStorage.getItem('events');
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return parsed.map((event: Event & { createdAt: string }) => ({
      ...event,
      createdAt: new Date(event.createdAt),
    }));
  } catch {
    return [];
  }
};

export const saveEvents = (events: Event[]) => {
  if (typeof window === 'undefined') return;
  localStorage.setItem('events', JSON.stringify(events));
};
