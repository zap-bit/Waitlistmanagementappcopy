import { useState, useEffect } from 'react';
import { StaffDashboard } from './components/StaffDashboard';
import { AttendeeView } from './components/AttendeeView';
import { Welcome } from './components/Welcome';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Users, ClipboardList } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Table } from './components/TableGrid';
import { 
  getStoredUser, 
  loadCurrentUser,
  login as authLogin, 
  signupUser as authSignupUser, 
  signupBusiness as authSignupBusiness,
  logout as authLogout,
  User 
} from './utils/auth';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent } from './utils/events';

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

const getInitialWaitlist = (): WaitlistEntry[] => [];

const getInitialTables = (): Table[] => {
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
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>(null);

  // Check for logged in user on mount
  useEffect(() => {
    const boot = async () => {
      const storedUser = getStoredUser() || await loadCurrentUser();
      if (storedUser) {
        setUser(storedUser);
        setSelectedRole(storedUser.role === 'staff' ? 'staff' : 'attendee');
      } else {
        setAuthScreen('welcome');
      }
    };
    void boot();
  }, []);

  const handleLogout = async () => {
    setSelectedRole(null);
    await authLogout();
    setUser(null);
    setAuthScreen('welcome');
  };

  const handleLogin = async (email: string, password: string) => {
    const loggedInUser = await authLogin(email, password);
    if (loggedInUser) {
      setUser(loggedInUser);
      setSelectedRole(loggedInUser.role === 'staff' ? 'staff' : 'attendee');
      setAuthScreen(null);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
    } else {
      toast.error('Invalid email or password');
    }
  };

  const handleSignupUser = async (email: string, password: string, name: string) => {
    const newUser = await authSignupUser(email, password, name);
    if (newUser) {
      setUser(newUser);
      setSelectedRole('attendee');
      setAuthScreen(null);
      toast.success(`Welcome, ${newUser.name}!`);
    } else {
      toast.error('Email already exists');
    }
  };

  const handleSignupBusiness = async (email: string, password: string, ownerName: string, businessName: string) => {
    const newUser = await authSignupBusiness(email, password, ownerName, businessName);
    if (newUser) {
      setUser(newUser);
      setSelectedRole('staff');
      setAuthScreen(null);
      toast.success(`Welcome, ${newUser.name}! Your business "${businessName}" has been created.`);
    } else {
      toast.error('Email already exists');
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
    return newEntry.id;
  };

  const removeFromWaitlist = (id: string) => {
    setWaitlist((prev) => prev.filter((e) => e.id !== id));
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
