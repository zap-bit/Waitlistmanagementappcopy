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

export const login = async (email: string, password: string): Promise<User | null> => {
  try {
    const response = await apiClient.login({ email, password });
    currentUser = response.user;
    return response.user;
  } catch {
    return null;
  }
};

export const signupUser = async (email: string, password: string, name: string): Promise<User | null> => {
  try {
    const response = await apiClient.signupUser({ email, password, name });
    currentUser = response.user;
    return response.user;
  } catch {
    return null;
  }
};

export const signupBusiness = async (
  email: string,
  password: string,
  ownerName: string,
  businessName: string
): Promise<User | null> => {
  try {
    const response = await apiClient.signupBusiness({ email, password, ownerName, businessName });
    currentUser = response.user;
    return response.user;
  } catch {
    return null;
  }
};

export const logout = async () => {
  currentUser = null;
  await apiClient.logout();
};

export const getBusiness = (_businessId: string): Business | null => null;
