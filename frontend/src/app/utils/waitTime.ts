import { WaitlistEntry } from '../App';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent } from './events';

export const fetchPredictedWait = async (eventId: string) => {
  try {
    const res = await fetch(
      `http://localhost:8000/v1/events/${eventId}/waitlist/estimate`,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('authToken') || ''}`,
        },
      }
    );

    if (!res.ok) return null;
    const data = await res.json();
    return data;
  } catch (err) {
    return null;
  }
};

export const calculateDynamicWaitTime = (
  entry: any,
  backendResponse: { estimatedWait: number; queueSize: number } | null
): number => {
  if (!backendResponse) {
    return entry.estimatedWait;
  }

  const { estimatedWait, queueSize } = backendResponse;
  const position = entry.position;

  if (!queueSize || queueSize === 0) {
    return estimatedWait;
  }

  const perPersonWait = estimatedWait / queueSize;
  const total = perPersonWait * (position - 1);
  const finalWait = Math.ceil(total);

  return finalWait;
};