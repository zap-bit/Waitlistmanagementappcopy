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
  try {
    return JSON.parse(saved) as User;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: User | null) => {
  if (typeof window === 'undefined') return;
  if (user) localStorage.setItem('currentUser', JSON.stringify(user));
  else localStorage.removeItem('currentUser');
};

export const logout = () => {
  setStoredUser(null);
};
