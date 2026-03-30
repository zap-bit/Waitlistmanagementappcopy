import { apiClient } from '../../api/client';

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string;
}

export const getStoredUser = (): User | null => {
  if (typeof window === 'undefined') return null;
  const saved = localStorage.getItem('currentUser');
  if (!saved) return null;
  try { return JSON.parse(saved); } catch { return null; }
};

export const setStoredUser = (user: User | null) => {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem('currentUser', JSON.stringify(user));
  else localStorage.removeItem('currentUser');
};

export const login = async (email: string, password: string): Promise<User | null> => {
  try {
    const response = await apiClient.login({ email, password });
    const user = response.user as User;
    setStoredUser(user);
    return user;
  } catch {
    return null;
  }
};

export const signupUser = async (email: string, password: string, name: string): Promise<User | null> => {
  try {
    const response = await apiClient.signupUser({ email, password, name });
    const user = response.user as User;
    setStoredUser(user);
    return user;
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
    const user = response.user as User;
    setStoredUser(user);
    return user;
  } catch {
    return null;
  }
};

export const logout = async () => {
  if (typeof window !== "undefined") {
    localStorage.removeItem("events");
    localStorage.removeItem("myWaitlistIds");
    localStorage.removeItem("currentUser");
  }
  try { await apiClient.logout(); } catch {}
  setStoredUser(null);
};
