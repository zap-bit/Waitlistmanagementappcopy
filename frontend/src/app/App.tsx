import { useEffect, useState } from 'react';
import { Toaster, toast } from 'sonner';
import { AttendeeView } from './components/AttendeeView';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { StaffDashboard } from './components/StaffDashboard';
import { Welcome } from './components/Welcome';
import { Table } from './components/TableGrid';
import {
  getStoredUser,
  login as authLogin,
  logout as authLogout,
  signupBusiness as authSignupBusiness,
  signupUser as authSignupUser,
  User,
} from './utils/auth';
import { apiClient } from '../api/client';

type Role = 'staff' | 'attendee' | null;
type AuthScreen = 'welcome' | 'login' | 'signup' | null;

export interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  joinedAt: Date;
  estimatedWait: number;
  specialRequests?: string;
  type: 'reservation' | 'waitlist';
  eventId?: string;
}

const getInitialWaitlist = (): WaitlistEntry[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('waitlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((entry: any) => ({
          ...entry,
          joinedAt: new Date(entry.joinedAt),
          type: entry.type || 'waitlist',
        }));
      } catch (e) {
        console.error('Error loading waitlist from localStorage:', e);
      }
    }
  }

  return [
    { id: '1', name: 'Sarah Johnson', partySize: 4, joinedAt: new Date(Date.now() - 15 * 60000), estimatedWait: 25, type: 'waitlist' },
    { id: '2', name: 'Michael Chen', partySize: 2, joinedAt: new Date(Date.now() - 10 * 60000), estimatedWait: 20, type: 'reservation' },
    { id: '3', name: 'Emily Rodriguez', partySize: 6, joinedAt: new Date(Date.now() - 8 * 60000), estimatedWait: 30, type: 'waitlist' },
  ];
};

const getInitialTables = (): Table[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tables');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((table: any) => ({
          ...table,
          seatedAt: table.seatedAt ? new Date(table.seatedAt) : undefined,
        }));
      } catch (e) {
        console.error('Error loading tables from localStorage:', e);
      }
    }
  }

  const initialTables: Table[] = [];
  const defaultCapacities = [2, 2, 4, 4, 2, 4, 6, 6, 4, 4, 6, 8];
  const cols = 4;

  for (let i = 0; i < 12; i++) {
    initialTables.push({
      id: i + 1,
      row: Math.floor(i / cols),
      col: i % cols,
      name: `Table ${i + 1}`,
      capacity: defaultCapacities[i] || 4,
      occupied: false,
    });
  }
  return initialTables;
};

const mapApiEntryToUi = (entry: any): WaitlistEntry => ({
  id: entry.id,
  name: entry.name,
  partySize: entry.partySize,
  joinedAt: new Date(entry.joinedAt),
  estimatedWait: entry.estimatedWait,
  specialRequests: entry.specialRequests,
  type: entry.type || 'waitlist',
  eventId: entry.eventId,
});

const mapApiTableToUi = (table: any): Table => ({
  ...table,
  seatedAt: table.seatedAt ? new Date(table.seatedAt) : undefined,
});

export default function App() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(getInitialWaitlist);
  const [tables, setTables] = useState<Table[]>(getInitialTables);
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  useEffect(() => {
    const initializeUser = async () => {
      const storedUser = getStoredUser();
      if (storedUser) {
        setUser(storedUser);
        setSelectedRole(storedUser.role === 'staff' ? 'staff' : 'attendee');
        return;
      }

      try {
        const me = await apiClient.getMe();
        if (me.user) {
          const apiUser: User = {
            id: me.user.id,
            email: me.user.email,
            name: me.user.name,
            role: me.user.role,
            businessId: me.user.businessId,
          };
          setUser(apiUser);
          setSelectedRole(apiUser.role === 'staff' ? 'staff' : 'attendee');
          return;
        }
      } catch {
        // no auth session available, continue to welcome
      }

      setAuthScreen('welcome');
    };

    initializeUser();
  }, []);

  useEffect(() => {
    localStorage.setItem('waitlist', JSON.stringify(waitlist));
  }, [waitlist]);

  useEffect(() => {
    localStorage.setItem('tables', JSON.stringify(tables));
  }, [tables]);

  useEffect(() => {
    const bootstrapFromApi = async () => {
      try {
        const dashboard = await apiClient.getDashboard();
        setWaitlist(dashboard.waitlist.map(mapApiEntryToUi));
        setTables(dashboard.tables.map(mapApiTableToUi));
      } catch (error) {
        console.warn('Falling back to local/demo data; backend unavailable.', error);
      }
    };

    bootstrapFromApi();
  }, []);

  const handleLogout = () => {
    setSelectedRole(null);
    apiClient.logout();
    authLogout();
    setUser(null);
    setAuthScreen('welcome');
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const response = await apiClient.login({ email, password });
      const loggedInUser: User = response.user;
      setUser(loggedInUser);
      setSelectedRole(loggedInUser.role === 'staff' ? 'staff' : 'attendee');
      setAuthScreen(null);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      return;
    } catch {
      const loggedInUser = authLogin(email, password);
      if (loggedInUser) {
        setUser(loggedInUser);
        setSelectedRole(loggedInUser.role === 'staff' ? 'staff' : 'attendee');
        setAuthScreen(null);
        toast.success(`Welcome back, ${loggedInUser.name}!`);
        return;
      }
    }

    toast.error('Invalid email or password');
  };

  const handleSignupUser = async (email: string, password: string, name: string) => {
    try {
      const response = await apiClient.signupUser({ email, password, name });
      const newUser: User = response.user;
      setUser(newUser);
      setSelectedRole('attendee');
      setAuthScreen(null);
      toast.success(`Welcome, ${newUser.name}!`);
      return;
    } catch {
      const newUser = authSignupUser(email, password, name);
      if (newUser) {
        setUser(newUser);
        setSelectedRole('attendee');
        setAuthScreen(null);
        toast.success(`Welcome, ${newUser.name}!`);
        return;
      }
    }

    toast.error('Email already exists');
  };

  const handleSignupBusiness = async (email: string, password: string, ownerName: string, businessName: string) => {
    try {
      const response = await apiClient.signupBusiness({ email, password, ownerName, businessName });
      const newUser: User = response.user;
      setUser(newUser);
      setSelectedRole('staff');
      setAuthScreen(null);
      toast.success(`Welcome, ${newUser.name}! Your business "${businessName}" has been created.`);
      return;
    } catch {
      const newUser = authSignupBusiness(email, password, ownerName, businessName);
      if (newUser) {
        setUser(newUser);
        setSelectedRole('staff');
        setAuthScreen(null);
        toast.success(`Welcome, ${newUser.name}! Your business "${businessName}" has been created.`);
        return;
      }
    }

    toast.error('Email already exists');
  };

  const addToWaitlist = async (
    name: string,
    partySize: number,
    specialRequests?: string,
    type: 'reservation' | 'waitlist' = 'waitlist',
    eventId?: string,
  ) => {
    try {
      const created = await apiClient.addToWaitlist({ name, partySize, specialRequests, type });
      const mapped = mapApiEntryToUi(created);
      setWaitlist((prev) => [...prev, mapped]);
      return mapped.id;
    } catch {
      const newEntry: WaitlistEntry = {
        id: Date.now().toString(),
        name,
        partySize,
        joinedAt: new Date(),
        estimatedWait: 15 + waitlist.length * 5,
        specialRequests,
        type,
        eventId,
      };
      setWaitlist((prev) => [...prev, newEntry]);
      return newEntry.id;
    }
  };

  const removeFromWaitlist = async (id: string) => {
    try {
      await apiClient.removeWaitlistEntry(id);
    } catch {
      // local fallback still removes from client state
    }
    setWaitlist((prev) => prev.filter((e) => e.id !== id));
  };

  if (!user) {
    if (authScreen === 'welcome') {
      return (
        <>
          <Welcome onNavigateToLogin={() => setAuthScreen('login')} onNavigateToSignup={() => setAuthScreen('signup')} />
          <Toaster position="top-center" />
        </>
      );
    }

    if (authScreen === 'login') {
      return (
        <>
          <Login
            onLogin={handleLogin}
            onBackToWelcome={() => setAuthScreen('welcome')}
            onSwitchToSignup={() => setAuthScreen('signup')}
          />
          <Toaster position="top-center" />
        </>
      );
    }

    if (authScreen === 'signup') {
      return (
        <>
          <Signup
            onSignupUser={handleSignupUser}
            onSignupBusiness={handleSignupBusiness}
            onBackToWelcome={() => setAuthScreen('welcome')}
            onSwitchToLogin={() => setAuthScreen('login')}
          />
          <Toaster position="top-center" />
        </>
      );
    }
  }

  if (selectedRole === 'staff') {
    return (
      <>
        <StaffDashboard onLogout={handleLogout} waitlist={waitlist} setWaitlist={setWaitlist} tables={tables} setTables={setTables} />
        <Toaster position="top-center" />
      </>
    );
  }

  if (selectedRole === 'attendee') {
    return (
      <>
        <AttendeeView
          onLogout={handleLogout}
          waitlist={waitlist}
          addToWaitlist={addToWaitlist}
          removeFromWaitlist={removeFromWaitlist}
          allWaitlistEntries={waitlist}
          tables={tables}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  return null;
}
