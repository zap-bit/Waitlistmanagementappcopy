import { apiClient } from '../../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string;
}

export interface Business {
  id: string;
  name: string;
  ownerId: string;
}

let currentUser: User | null = null;

function toErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback;
  const raw = error.message;
  const jsonStart = raw.indexOf('{');
  if (jsonStart === -1) return raw || fallback;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as { message?: string };
    return parsed.message || raw || fallback;
  } catch {
    return raw || fallback;
  }
}

export const getStoredUser = (): User | null => currentUser;

export const setStoredUser = (user: User | null) => {
  currentUser = user;
};

export const loadCurrentUser = async (): Promise<User | null> => {
  if (!apiClient.hasToken()) {
    currentUser = null;
    return null;
  }
  try {
    const { user } = await apiClient.getMe();
    currentUser = user;
    return user;
  } catch {
    currentUser = null;
    return null;
  }
};

export const login = async (email: string, password: string): Promise<User> => {
  try {
    const response = await apiClient.login({ email, password });
    currentUser = response.user;
    return response.user;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Login failed'));
  }
};

export const signupUser = async (email: string, password: string, name: string): Promise<User> => {
  try {
    const response = await apiClient.signupUser({ email, password, name });
    currentUser = response.user;
    return response.user;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Signup failed'));
  }
};

export const signupBusiness = async (
  email: string,
  password: string,
  ownerName: string,
  businessName: string
): Promise<User> => {
  try {
    const response = await apiClient.signupBusiness({ email, password, ownerName, businessName });
    currentUser = response.user;
    return response.user;
  } catch (error) {
    throw new Error(toErrorMessage(error, 'Business signup failed'));
  }
};

export const logout = async () => {
  currentUser = null;
  await apiClient.logout();
};

export const getBusiness = (_businessId: string): Business | null => null;
