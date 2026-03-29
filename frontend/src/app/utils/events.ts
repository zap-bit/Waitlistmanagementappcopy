import { apiClient, ApiEvent } from '../../api/client';

export type EventType = 'capacity-based' | 'table-based' | 'simple-capacity';
export type EventStatus = 'active' | 'paused' | 'closed';
export type QueueMode = 'single' | 'multiple';

export interface Queue {
  id: string;
  name: string;
  capacity: number;
  currentCount: number;
  eventDateTime?: Date;
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
  code?: string;
}

export interface CapacityBasedEvent extends BaseEvent {
  type: 'capacity-based';
  queueMode: QueueMode;
  capacity: number;
  estimatedWaitPerPerson: number;
  location: string;
  currentCount: number;
  queues?: Queue[];
  eventDateTime?: Date;
}

export interface TableBasedEvent extends BaseEvent {
  type: 'table-based';
  numberOfTables: number;
  averageTableSize: number;
  reservationDuration: number;
  noShowPolicy: string;
  currentFilledTables: number;
  eventDateTime?: Date;
}

export interface SimpleCapacityEvent extends BaseEvent {
  type: 'simple-capacity';
  capacity: number;
  estimatedWaitPerPerson: number;
  location: string;
  currentCount: number;
}

export type Event = CapacityBasedEvent | TableBasedEvent | SimpleCapacityEvent;

let eventsCache: Event[] = [];

const fromApiEvent = (event: ApiEvent): Event => {
  if (event.type === 'table-based') {
    return {
      ...event,
      type: 'table-based',
      createdAt: new Date(event.createdAt),
    };
  }
  return {
    ...event,
    type: 'capacity-based',
    queueMode: 'single',
    createdAt: new Date(event.createdAt),
  };
};

export const syncEventsFromApi = async (): Promise<Event[]> => {
  const response = await apiClient.listEvents();
  eventsCache = response.data.map(fromApiEvent);
  return eventsCache;
};

export const getStoredEvents = (): Event[] => eventsCache;

export const saveEvents = (events: Event[]) => {
  eventsCache = events;
};

export const addEvent = (event: Event) => {
  eventsCache = [...eventsCache, event];
  if (event.type === 'simple-capacity') return;
  void apiClient.createEvent({
    name: event.name,
    type: event.type,
    status: event.status,
    ...(event.type === 'capacity-based'
      ? {
          capacity: event.capacity,
          estimatedWaitPerPerson: event.estimatedWaitPerPerson,
          location: event.location,
          currentCount: event.currentCount,
        }
      : {
          numberOfTables: event.numberOfTables,
          averageTableSize: event.averageTableSize,
          reservationDuration: event.reservationDuration,
          noShowPolicy: event.noShowPolicy,
          currentFilledTables: event.currentFilledTables,
        }),
  });
};

export const updateEvent = (eventId: string, updates: Partial<Event>) => {
  eventsCache = eventsCache.map((e) => (e.id === eventId ? { ...e, ...updates } as Event : e));
};

export const archiveEvent = (eventId: string) => {
  updateEvent(eventId, { archived: true, archivedAt: new Date() } as Partial<Event>);
};

export const restoreEvent = (eventId: string) => {
  updateEvent(eventId, { archived: false, archivedAt: undefined } as Partial<Event>);
};

export const deleteEvent = (eventId: string) => {
  eventsCache = eventsCache.filter((e) => e.id !== eventId);
  void apiClient.deleteEvent(eventId);
};

export const getActiveEvents = (): Event[] => getStoredEvents().filter((e) => !e.archived);
export const getArchivedEvents = (): Event[] => getStoredEvents().filter((e) => e.archived);
export const getEventsByBusiness = (businessId: string): Event[] => getStoredEvents().filter((e) => e.businessId === businessId);
export const getEventById = (eventId: string): Event | null => getStoredEvents().find((e) => e.id === eventId) || null;
