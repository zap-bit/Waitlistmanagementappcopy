import { useState, useEffect } from 'react';
import { StaffDashboard } from './components/StaffDashboard';
import { AttendeeView } from './components/AttendeeView';
import { Welcome } from './components/Welcome';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Users, ClipboardList } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Table } from './components/TableGrid';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent } from './utils/events';
import { appStorage } from './utils/appStorage';
import { apiClient } from '../api/client';
import type { ApiUser } from '../api/types';

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
  queueId?: string; // For multiple-queue capacity events
  reservationTime?: Date; // Optional time for reservation
}

const getInitialWaitlist = (): WaitlistEntry[] => {
  if (typeof window !== 'undefined') {
    const saved = appStorage.getItem('waitlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((entry: any) => ({
          ...entry,
          joinedAt: new Date(entry.joinedAt),
          type: entry.type || 'waitlist', // Default to 'waitlist' if type is missing
          reservationTime: entry.reservationTime ? new Date(entry.reservationTime) : undefined,
        }));
      } catch (e) {
        console.error('Error loading waitlist from localStorage:', e);
      }
    }
  }
  // Default demo data
  return [
    {
      id: '1',
      name: 'Sarah Johnson',
      partySize: 4,
      joinedAt: new Date(Date.now() - 15 * 60000),
      estimatedWait: 25,
      type: 'waitlist' as const,
    },
    {
      id: '2',
      name: 'Michael Chen',
      partySize: 2,
      joinedAt: new Date(Date.now() - 10 * 60000),
      estimatedWait: 20,
      type: 'reservation' as const,
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      partySize: 6,
      joinedAt: new Date(Date.now() - 8 * 60000),
      estimatedWait: 30,
      type: 'waitlist' as const,
    },
    {
      id: '4',
      name: 'David Thompson',
      partySize: 3,
      joinedAt: new Date(Date.now() - 5 * 60000),
      estimatedWait: 15,
      type: 'reservation' as const,
    },
    {
      id: '5',
      name: 'Jessica Lee',
      partySize: 2,
      joinedAt: new Date(Date.now() - 3 * 60000),
      estimatedWait: 12,
      type: 'waitlist' as const,
    },
  ];
};

const getInitialTables = (): Table[] => {
  if (typeof window !== 'undefined') {
    const saved = appStorage.getItem('tables');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        return parsed.map((table: any) => ({
          ...table,
          seatedAt: table.seatedAt ? new Date(table.seatedAt) : undefined,
        }));
      } catch (e) {
        console.error('Error loading tables from localStorage:', e);
      }
    }
  }
  // Default tables
  const initialTables: Table[] = [];
  const defaultCapacities = [2, 2, 4, 4, 2, 4, 6, 6, 4, 4, 6, 8];
  const cols = 4;
  
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    initialTables.push({
      id: i + 1,
      row,
      col,
      name: `Table ${i + 1}`,
      capacity: defaultCapacities[i] || 4,
      occupied: false,
    });
  }
  return initialTables;
};

export default function App() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(getInitialWaitlist);
  const [tables, setTables] = useState<Table[]>(getInitialTables);
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [user, setUser] = useState<ApiUser | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  const syncWaitlistFromApi = async () => {
    try {
      const response = await apiClient.listMyEventWaitlist(apiClient.eventId);
      const mapped: WaitlistEntry[] = response.data.map((entry) => ({
        id: entry.id,
        name: entry.name,
        partySize: entry.partySize,
        joinedAt: new Date(entry.joinedAt),
        estimatedWait: entry.estimatedWait,
        specialRequests: entry.specialRequests,
        type: entry.type,
        eventId: entry.eventId,
      }));
      setWaitlist(mapped);
    } catch {
      // #SPEC GAP: backend currently exposes one canonical event waitlist endpoint;
      // frontend still maintains local fallback state when remote sync is unavailable.
    }
  };

  // Check for logged in user on mount
  useEffect(() => {
    const initializeAuth = async () => {
      if (!apiClient.hasToken()) {
        setAuthScreen('welcome');
        return;
      }

      try {
        const { user: me } = await apiClient.getMe();
        setUser(me);
        setSelectedRole(me.role === 'staff' ? 'staff' : 'attendee');
        await syncWaitlistFromApi();
      } catch {
        setAuthScreen('welcome');
      }
    };

    void initializeAuth();
  }, []);

  // Persist waitlist to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      appStorage.setItem('waitlist', JSON.stringify(waitlist));
    }
  }, [waitlist]);

  // Persist tables to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      appStorage.setItem('tables', JSON.stringify(tables));
    }
  }, [tables]);

  const handleLogout = async () => {
    setSelectedRole(null);
    await apiClient.logout();
    setUser(null);
    setAuthScreen('welcome');
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const auth = await apiClient.login({ email, password });
      setUser(auth.user);
      setSelectedRole(auth.user.role === 'staff' ? 'staff' : 'attendee');
      await syncWaitlistFromApi();
      setAuthScreen(null);
      toast.success(`Welcome back, ${auth.user.name}!`);
    } catch {
      toast.error('Invalid email or password');
    }
  };

  const handleSignupUser = async (email: string, password: string, name: string) => {
    try {
      const auth = await apiClient.signupUser({ email, password, name });
      setUser(auth.user);
      setSelectedRole('attendee');
      await syncWaitlistFromApi();
      setAuthScreen(null);
      toast.success(`Welcome, ${auth.user.name}!`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      toast.error(message.includes('409') ? 'Email already exists' : 'Unable to create account');
    }
  };

  const handleSignupBusiness = async (email: string, password: string, ownerName: string, businessName: string) => {
    try {
      const auth = await apiClient.signupBusiness({ email, password, ownerName, businessName });
      setUser(auth.user);
      setSelectedRole('staff');
      await syncWaitlistFromApi();
      setAuthScreen(null);
      toast.success(`Welcome, ${auth.user.name}! Your business "${businessName}" has been created.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign up failed';
      toast.error(message.includes('409') ? 'Email already exists' : 'Unable to create business account');
    }
  };

  const addToWaitlist = (name: string, partySize: number, specialRequests?: string, type: 'reservation' | 'waitlist' = 'waitlist', eventId?: string, queueId?: string, reservationTime?: Date) => {
    // Calculate estimated wait based on event settings
    let estimatedWait = 15; // Default fallback
    
    if (eventId) {
      const event = getStoredEvents().find(e => e.id === eventId);
      if (event && event.type === 'capacity-based') {
        const capacityEvent = event as CapacityBasedEvent;
        
        // Count people ahead in the same queue/event
        let peopleAhead = 0;
        if (capacityEvent.queueMode === 'multiple' && queueId) {
          // For multiple queues, count only people in the same queue
          peopleAhead = waitlist.filter(e => e.eventId === eventId && e.queueId === queueId).length;
        } else {
          // For single queue, count all people in the event
          peopleAhead = waitlist.filter(e => e.eventId === eventId).length;
        }
        
        // Calculate wait time: people ahead × wait time per person
        estimatedWait = peopleAhead * capacityEvent.estimatedWaitPerPerson;
      } else if (event && event.type === 'table-based') {
        const tableEvent = event as TableBasedEvent;
        // For table-based events, use reservation duration
        const peopleAhead = waitlist.filter(e => e.eventId === eventId && e.type === type).length;
        estimatedWait = peopleAhead * (tableEvent.reservationDuration / tableEvent.averageTableSize);
      }
    } else {
      // Legacy fallback for entries without eventId
      estimatedWait = 15 + waitlist.length * 5;
    }
    
    const newEntry: WaitlistEntry = {
      id: Date.now().toString(),
      name,
      partySize,
      joinedAt: new Date(),
      estimatedWait: Math.round(estimatedWait),
      specialRequests,
      type,
      eventId,
      queueId,
      reservationTime,
    };
    setWaitlist((prev) => [...prev, newEntry]);

    void apiClient
      .addToWaitlist(eventId || apiClient.eventId, { name, partySize, type, specialRequests })
      .then(() => syncWaitlistFromApi())
      .catch(() => {
        // #SPEC GAP: queueId/reservationTime are richer than current backend waitlist contract,
        // so those fields are kept client-side until API schema expansion lands.
      });

    return newEntry.id;
  };

  const removeFromWaitlist = (id: string) => {
    setWaitlist((prev) => prev.filter((e) => e.id !== id));
    void apiClient.removeWaitlistEntry(apiClient.eventId, id).then(() => syncWaitlistFromApi()).catch(() => undefined);
  };

  const updateWaitlistEntry = (id: string, updates: Partial<Omit<WaitlistEntry, 'id' | 'joinedAt'>>) => {
    setWaitlist((prev) => prev.map((entry) => 
      entry.id === id ? { ...entry, ...updates } : entry
    ));
  };

  // Show auth screens if not logged in
  if (!user) {
    if (authScreen === 'welcome') {
      return (
        <>
          <Welcome
            onNavigateToLogin={() => setAuthScreen('login')}
            onNavigateToSignup={() => setAuthScreen('signup')}
          />
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

  // User is logged in - show appropriate dashboard
  if (selectedRole === 'staff') {
    return (
      <>
        <StaffDashboard 
          onLogout={handleLogout} 
          waitlist={waitlist}
          setWaitlist={setWaitlist}
          tables={tables}
          setTables={setTables}
          user={user!}
        />
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
          updateWaitlistEntry={updateWaitlistEntry}
          allWaitlistEntries={waitlist}
          tables={tables}
          user={user!}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  // Fallback (shouldn't happen)
  return null;
}
