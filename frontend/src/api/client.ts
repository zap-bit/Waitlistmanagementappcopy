import type {
  ApiEvent,
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

function getStoredToken(): string | null {
  return typeof window !== 'undefined' ? localStorage.getItem(TOKEN_STORAGE_KEY) : null;
}

function setStoredToken(token: string | null): void {
  if (typeof window === 'undefined') return;
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`API request failed: ${response.status} ${payload}`);
  }

  return response.json();
}

export const apiClient = {
  eventId: EVENT_ID,

  async login(payload: LoginRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(response.token);
    return response;
  },

  async signupUser(payload: SignupUserRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/signup/user', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(response.token);
    return response;
  },

  async signupBusiness(payload: SignupBusinessRequest): Promise<AuthResponse> {
    const response = await request<AuthResponse>('/auth/signup/business', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setStoredToken(response.token);
    return response;
  },

  logout() {
    setStoredToken(null);
  },

  async getMe() {
    return request<{ user: ApiUser }>('/auth/me');
  },

  async listEvents(businessId?: string) {
    const query = businessId ? `?businessId=${encodeURIComponent(businessId)}` : '';
    return request<{ data: ApiEvent[] }>(`/events${query}`);
  },

  async createEvent(payload: Omit<ApiEvent, 'id' | 'createdAt'>) {
    return request<ApiEvent>('/events', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateEvent(eventId: string, payload: Partial<ApiEvent>) {
    return request<ApiEvent>(`/events/${eventId}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async deleteEvent(eventId: string) {
    return request<{ ok: boolean }>(`/events/${eventId}`, {
      method: 'DELETE',
    });
  },

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
