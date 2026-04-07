import type {
  ApiEvent,
  ApiTable,
  ApiUser,
  ApiWaitlistEntry,
  AuthResponse,
  DashboardResponse,
  EntryType,
  LoginRequest,
  SignupBusinessRequest,
  SignupUserRequest,
} from './types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';
const EVENT_ID = import.meta.env.VITE_EVENT_ID || 'demo-event';
const TOKEN_STORAGE_KEY = 'authToken';
const REFRESH_TOKEN_STORAGE_KEY = 'refreshToken';

function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
}

function getStoredRefreshToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) : null;
}

function setStoredTokens(token: string | null, refreshToken?: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);

  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, refreshToken);
  else if (refreshToken === null) localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (response.status === 401 && retry) {
    const refreshToken = getStoredRefreshToken();
    if (refreshToken) {
      const refreshed = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshed.ok) {
        const auth = (await refreshed.json()) as AuthResponse;
        setStoredTokens(auth.token, auth.refreshToken);
        return request<T>(path, init, false);
      }
    }

    setStoredTokens(null, null);
  }

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`API request failed: ${response.status} ${payload}`);
  }

  return response.json();
}

export const apiClient = {
  eventId: EVENT_ID,

  hasToken() {
    return Boolean(getStoredToken());
  },

  async login(payload: LoginRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredTokens(response.token, response.refreshToken);
    return response;
  },

  async signupUser(payload: SignupUserRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/signup/user', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredTokens(response.token, response.refreshToken);
    return response;
  },

  async signupBusiness(payload: SignupBusinessRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/signup/business', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredTokens(response.token, response.refreshToken);
    return response;
  },

  async logout() {
    const refreshToken = getStoredRefreshToken();
    try {
      await request<{ ok: boolean }>('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }, false);
    } finally {
      setStoredTokens(null, null);
    }
  },

  async getMe() {
    return request<{ user: ApiUser }>('/auth/me');
  },

  async getMyWaitlist() {
    return request<{ data: ApiWaitlistEntry[] }>('/auth/me/waitlist');
  },

  async listEvents() {
    return request<{ data: ApiEvent[] }>('/events');
  },

  async createEvent(payload: Omit<ApiEvent, 'id' | 'createdAt' | 'businessId'>) {
    return request<ApiEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteEvent(eventId: string) {
    return request<{ ok: boolean }>(`/events/${eventId}`, {
      method: 'DELETE',
    });
  },

  async getDashboard(eventId = EVENT_ID) {
    return request<DashboardResponse>(`/events/${eventId}/staff/dashboard`);
  },

  async addToWaitlist(eventId: string, payload: {
    name: string;
    partySize: number;
    type: EntryType;
    specialRequests?: string;
  }) {
    return request<ApiWaitlistEntry>(`/events/${eventId}/waitlist`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async removeWaitlistEntry(eventId: string, entryId: string) {
    return request<{ ok: boolean }>(`/events/${eventId}/waitlist/${entryId}`, {
      method: 'DELETE',
    });
  },

  async promoteWaitlistEntry(eventId: string, entryId: string) {
    return request<{ promoted: ApiWaitlistEntry[] }>(`/events/${eventId}/staff/promote`, {
      method: 'POST',
      body: JSON.stringify({ entryId }),
    });
  },

  async seatWaitlistEntry(eventId: string, entryId: string, tableId: number) {
    return request<{ entryId: string; tableId: number; status: string }>(`/events/${eventId}/staff/seat`, {
      method: 'POST',
      body: JSON.stringify({ entryId, tableId }),
    });
  },

  async clearTable(eventId: string, tableId: number) {
    return request<{ ok: boolean; tableId: number }>(`/events/${eventId}/staff/clear-table`, {
      method: 'POST',
      body: JSON.stringify({ tableId }),
    });
  },

  // #SPEC GAP: table rename/capacity-edit APIs are not defined in the current backend contract,
  // so the phase 4 UI keeps those controls local-only until the contract is finalized.
  async listMyEventWaitlist(eventId: string) {
    return request<{ data: ApiWaitlistEntry[] }>(`/events/${eventId}/waitlist`);
  },
};

export type { ApiEvent, ApiTable, ApiUser, ApiWaitlistEntry, EntryType };
