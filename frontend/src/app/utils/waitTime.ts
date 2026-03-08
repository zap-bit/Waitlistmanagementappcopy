import { WaitlistEntry } from '../App';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent } from './events';

/**
 * Calculate dynamic wait time based on current position in queue
 */
export const calculateDynamicWaitTime = (
  entry: WaitlistEntry,
  allEntries: WaitlistEntry[]
): number => {
  if (!entry.eventId) {
    // Legacy entries without eventId - use stored value
    return entry.estimatedWait;
  }

  const event = getStoredEvents().find(e => e.id === entry.eventId);
  if (!event) {
    return entry.estimatedWait; // Fallback to stored value
  }

  // Filter entries for the same event and type
  let relevantEntries = allEntries.filter(
    e => e.eventId === entry.eventId && e.type === entry.type
  );

  // For multiple-queue capacity events, filter by queue
  if (event.type === 'capacity-based') {
    const capacityEvent = event as CapacityBasedEvent;
    if (capacityEvent.queueMode === 'multiple' && entry.queueId) {
      relevantEntries = relevantEntries.filter(e => e.queueId === entry.queueId);
    }
  }

  // Sort by joinedAt to get correct order
  relevantEntries.sort((a, b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());

  // Find position (index + 1)
  const position = relevantEntries.findIndex(e => e.id === entry.id) + 1;
  const peopleAhead = position - 1;

  // Calculate wait time based on event type
  if (event.type === 'capacity-based') {
    const capacityEvent = event as CapacityBasedEvent;
    return peopleAhead * capacityEvent.estimatedWaitPerPerson;
  } else if (event.type === 'table-based') {
    const tableEvent = event as TableBasedEvent;
    return Math.round(peopleAhead * (tableEvent.reservationDuration / tableEvent.averageTableSize));
  }

  return entry.estimatedWait; // Fallback
};
