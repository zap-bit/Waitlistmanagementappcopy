export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'staff';
  businessId?: string; // Only for staff
}

export interface Business {
  id: string;
  name: string;
  ownerId: string;
}

// Auth state management
export const getStoredUser = (): User | null => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading user from localStorage:', e);
      }
    }
  }
  return null;
};

export const setStoredUser = (user: User | null) => {
  if (typeof window !== 'undefined') {
    if (user) {
      localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
      localStorage.removeItem('currentUser');
    }
  }
};

// Mock user database (in-memory for MVP)
const getUsersDb = (): User[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('usersDb');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading users db:', e);
      }
    }
  }
  return [];
};

const saveUsersDb = (users: User[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('usersDb', JSON.stringify(users));
  }
};

const getPasswordsDb = (): Record<string, string> => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('passwordsDb');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading passwords db:', e);
      }
    }
  }
  return {};
};

const savePasswordsDb = (passwords: Record<string, string>) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('passwordsDb', JSON.stringify(passwords));
  }
};

const getBusinessesDb = (): Business[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('businessesDb');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error loading businesses db:', e);
      }
    }
  }
  return [];
};

const saveBusinessesDb = (businesses: Business[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('businessesDb', JSON.stringify(businesses));
  }
};

// Login function
export const login = (email: string, password: string): User | null => {
  const users = getUsersDb();
  const passwords = getPasswordsDb();
  
  const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  
  if (!user) {
    return null; // User not found
  }
  
  if (passwords[user.id] !== password) {
    return null; // Invalid password
  }
  
  setStoredUser(user);
  return user;
};

// Sign up user account
export const signupUser = (email: string, password: string, name: string): User | null => {
  const users = getUsersDb();
  const passwords = getPasswordsDb();
  
  // Check if email already exists
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return null; // Email already exists
  }
  
  const newUser: User = {
    id: Date.now().toString(),
    email,
    name,
    role: 'user',
  };
  
  users.push(newUser);
  passwords[newUser.id] = password;
  
  saveUsersDb(users);
  savePasswordsDb(passwords);
  setStoredUser(newUser);
  
  return newUser;
};

// Sign up business account (creates business + owner staff account)
export const signupBusiness = (
  email: string, 
  password: string, 
  ownerName: string,
  businessName: string
): User | null => {
  const users = getUsersDb();
  const passwords = getPasswordsDb();
  const businesses = getBusinessesDb();
  
  // Check if email already exists
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    return null; // Email already exists
  }
  
  // Create business
  const newBusiness: Business = {
    id: `biz-${Date.now()}`,
    name: businessName,
    ownerId: '', // Will be set after creating user
  };
  
  // Create owner staff account
  const newUser: User = {
    id: Date.now().toString(),
    email,
    name: ownerName,
    role: 'staff',
    businessId: newBusiness.id,
  };
  
  newBusiness.ownerId = newUser.id;
  
  users.push(newUser);
  passwords[newUser.id] = password;
  businesses.push(newBusiness);
  
  saveUsersDb(users);
  savePasswordsDb(passwords);
  saveBusinessesDb(businesses);
  setStoredUser(newUser);
  
  return newUser;
};

// Logout
export const logout = () => {
  setStoredUser(null);
};

// Get business by ID
export const getBusiness = (businessId: string): Business | null => {
  const businesses = getBusinessesDb();
  return businesses.find(b => b.id === businessId) || null;
};
