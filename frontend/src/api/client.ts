import type { ApiWaitlistEntry, DashboardResponse, EntryType } from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';
const EVENT_ID = import.meta.env.VITE_EVENT_ID || 'demo-event';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    ...init,
  });

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`);
  }

  return response.json();
}

export const apiClient = {
  eventId: EVENT_ID,

  async getDashboard() {
    return request<DashboardResponse>(`/events/${EVENT_ID}/staff/dashboard`);
  },

  async addToWaitlist(payload: {
    name: string;
    partySize: number;
    type: EntryType;
    specialRequests?: string;
  }) {
    return request<ApiWaitlistEntry>(`/events/${EVENT_ID}/waitlist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async removeWaitlistEntry(entryId: string) {
    return request<{ ok: boolean }>(`/events/${EVENT_ID}/waitlist/${entryId}`, {
      method: 'DELETE',
    });
  },
};
