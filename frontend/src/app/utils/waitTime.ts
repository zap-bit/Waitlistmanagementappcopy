import { WaitlistEntry } from '../App';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent } from './events';

const AI_BASE_URL =
  import.meta.env.VITE_AI_API_BASE_URL || 'http://localhost:8001/v1';

const backendWaitCache: Record<string, number> = {};

export const fetchPredictedWait = async (
  eventId: string
): Promise<number | null> => {
  try {
    const res = await fetch(
      `${AI_BASE_URL}/events/${eventId}/predicted-wait`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    return data.minutes_remaining ?? null;
  } catch {
    return null;
  }
};

export const calculateDynamicWaitTime = (
  entry: WaitlistEntry,
  allEntries: WaitlistEntry[]
): number => {
  if (!entry.eventId) return entry.estimatedWait;

  const event = getStoredEvents().find(e => e.id === entry.eventId);
  if (!event) return entry.estimatedWait;

  let relevantEntries = allEntries.filter(
    e => e.eventId === entry.eventId && e.type === entry.type
  );

  if (event.type === 'capacity-based') {
    const capacityEvent = event as CapacityBasedEvent;

    if (capacityEvent.queueMode === 'multiple' && entry.queueId) {
      relevantEntries = relevantEntries.filter(
        e => e.queueId === entry.queueId
      );
    }
  }

  relevantEntries.sort(
    (a, b) =>
      new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime()
  );

  const position =
    relevantEntries.findIndex(e => e.id === entry.id) + 1;

  const queueSize = relevantEntries.length || 1;

  const backendWait = backendWaitCache[entry.eventId];

  if (event.type === 'capacity-based') {
    const capacityEvent = event as CapacityBasedEvent;

    const totalQueueWait =
      backendWait !== undefined
        ? backendWait
        : capacityEvent.estimatedWaitPerPerson;

    const wait = (totalQueueWait / queueSize) * (position - 1);

    return Math.round(wait);
  }

  if (event.type === 'table-based') {
    const tableEvent = event as TableBasedEvent;

    const totalQueueWait =
      tableEvent.reservationDuration * queueSize;

    const wait = (totalQueueWait / queueSize) * (position - 1);

    return Math.round(wait);
  }

  return entry.estimatedWait;
};