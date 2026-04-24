import { useState, useEffect, useRef } from 'react';
import { StaffDashboard } from './components/StaffDashboard';
import { AttendeeView } from './components/AttendeeView';
import { Welcome } from './components/Welcome';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { SplashScreen } from './components/SplashScreen';
import { Users, ClipboardList } from 'lucide-react';
import { Toaster, toast } from 'sonner';
import { Table } from './components/TableGrid';
import {
  getStoredUser,
  login as authLogin,
  signupUser as authSignupUser,
  signupBusiness as authSignupBusiness,
  logout as authLogout,
  User
} from './utils/auth';
import { getStoredEvents, CapacityBasedEvent, TableBasedEvent, loadEventsFromSupabase } from './utils/events';
import { queueOp, cancelQueuedAdd, flushPendingOps, getPendingOps } from './utils/offlineQueue';

type Role = 'staff' | 'attendee' | null;
type AuthScreen = 'welcome' | 'login' | 'signup' | null;

export interface WaitlistEntry {
  id: string;
  remoteId?: string; // Supabase UUID — set after successful POST or sync
  name: string;
  partySize: number;
  joinedAt: Date;
  estimatedWait: number;
  specialRequests?: string;
  type: 'reservation' | 'waitlist';
  eventId?: string;
  queueId?: string; // For multiple-queue capacity events
  reservationTime?: Date; // Optional time for reservation
  position?: number; // 1-based queue position from Supabase
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
          reservationTime: entry.reservationTime ? new Date(entry.reservationTime) : undefined,
        }));
      } catch (e) {
        console.error('Error loading waitlist from localStorage:', e);
      }
    }
  }
  return [];
};

const getInitialTables = (): Table[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tables');
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

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

export default function App() {
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(getInitialWaitlist);
  const [tables, setTables] = useState<Table[]>(getInitialTables);
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [user, setUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [showingSplash, setShowingSplash] = useState(false);
  const [splashVideoEnded, setSplashVideoEnded] = useState(false);
  const [splashDataReady, setSplashDataReady] = useState(false);

  // Stable ref so the online handler can call setWaitlist without being in its dep array
  const setWaitlistRef = useRef(setWaitlist);

  // Check for logged in user on mount; refresh events if already authenticated
  useEffect(() => {
    const storedUser = getStoredUser();
    if (storedUser) {
      setUser(storedUser);
      setSelectedRole(storedUser.role === 'staff' ? 'staff' : 'attendee');
      loadEventsFromSupabase().catch(() => {});
    } else {
      setAuthScreen('welcome');
    }
  }, []);

  // Dismiss splash when both video and data are ready
  useEffect(() => {
    if (showingSplash && splashVideoEnded && splashDataReady) {
      setShowingSplash(false);
    }
  }, [showingSplash, splashVideoEnded, splashDataReady]);

  // Online/offline detection + sync flush
  useEffect(() => {
    const handleOnline = async () => {
      toast.dismiss('offline-toast');
      const token = localStorage.getItem('authToken');
      if (!token) return;

      const ops = getPendingOps();
      if (ops.length === 0) {
        toast.success('Back online');
        return;
      }

      toast.loading(`Syncing ${ops.length} offline change${ops.length !== 1 ? 's' : ''}…`, { id: 'sync-toast' });
      const result = await flushPendingOps(token, API_BASE, (localId, remoteId, type) => {
        if (type === 'ADD_WAITLIST') {
          setWaitlistRef.current(prev =>
            prev.map(e => e.id === localId ? { ...e, remoteId } : e)
          );
        }
      });
      toast.dismiss('sync-toast');
      if (result.synced > 0) toast.success(`Synced ${result.synced} offline change${result.synced !== 1 ? 's' : ''}`);
      if (result.errors > 0) toast.error(`${result.errors} change${result.errors !== 1 ? 's' : ''} failed to sync`);

      // Reload events in case any ADD_EVENT ops resolved new UUIDs
      await loadEventsFromSupabase();
    };

    const handleOffline = () => {
      toast.warning('You are offline. Changes will sync when reconnected.', {
        id: 'offline-toast',
        duration: Infinity,
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Persist waitlist to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('waitlist', JSON.stringify(waitlist));
    }
  }, [waitlist]);

  // Persist tables to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tables', JSON.stringify(tables));
    }
  }, [tables]);

  const handleLogout = () => {
    setSelectedRole(null);
    authLogout();
    setUser(null);
    setWaitlist([]);
    setAuthScreen('welcome');
  };

  /** Loads the current user's waitlist entries from Supabase and replaces local state.
   * Maps the `party` table rows (where name is encoded as the first segment of special_req). */
  const loadWaitlistFromSupabase = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/auth/me/waitlist`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const { data } = await res.json() as { data: Array<Record<string, unknown>> };
      if (!Array.isArray(data)) return;

      const entries: WaitlistEntry[] = data.map((p: any) => {
        const parts = String(p.special_req || '').split(' | ');
        return {
          id: p.uuid as string,
          remoteId: p.uuid as string,
          name: parts[0] || p.name || 'Guest',
          partySize: (p.party_size as number) || 1,
          joinedAt: new Date((p.joined_at as string) || Date.now()),
          estimatedWait: p.estimated_wait || 15,
          specialRequests: parts[1] || undefined,
          // Map the specific database columns here:
          type: p.type === 'reservation' ? 'reservation' : 'waitlist',
          reservationTime: p.reservation_time ? new Date(p.reservation_time) : undefined,
          eventId: p.event_uuid as string,
          position: p.position as number | undefined,
        };
      });
      setWaitlist(entries);
    } catch (e) {
      console.error('Failed to load waitlist from Supabase:', e);
    }
  };

  // Attendees: keep waitlist position live by polling every 15 s.
  // Staff dashboard has its own polling interval in StaffDashboard.tsx.
  useEffect(() => {
    if (!user || user.role === 'staff') return;
    const interval = setInterval(loadWaitlistFromSupabase, 15_000);
    return () => clearInterval(interval);
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const startSplash = () => {
    setShowingSplash(true);
    setSplashVideoEnded(false);
    setSplashDataReady(false);
  };

  const handleLogin = async (email: string, password: string) => {
    localStorage.removeItem("events");
    localStorage.removeItem("waitlist");
    localStorage.removeItem("myWaitlistIds");
    localStorage.removeItem("currentUser");
    localStorage.removeItem("usersDb");
    localStorage.removeItem("passwordsDb");
    localStorage.removeItem("businessesDb");
    const loggedInUser = await authLogin(email, password);
    if (loggedInUser) {
      setUser(loggedInUser);
      setSelectedRole(loggedInUser.role === 'staff' ? 'staff' : 'attendee');
      setAuthScreen(null);
      toast.success(`Welcome back, ${loggedInUser.name}!`);
      startSplash();
      Promise.all([loadEventsFromSupabase(), loadWaitlistFromSupabase()])
        .finally(() => setSplashDataReady(true));
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
      startSplash();
      Promise.all([loadEventsFromSupabase(), loadWaitlistFromSupabase()])
        .finally(() => setSplashDataReady(true));
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
      startSplash();
      loadEventsFromSupabase().finally(() => setSplashDataReady(true));
    } else {
      toast.error('Email already exists');
    }
  };

  const addToWaitlist = (name: string, partySize: number, specialRequests?: string, type: 'reservation' | 'waitlist' = 'waitlist', eventId?: string, queueId?: string, reservationTime?: Date, onIdResolved?: (localId: string, remoteId: string) => void) => {
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

    const localId = Date.now().toString();
    const newEntry: WaitlistEntry = {
      id: localId,
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

    if (eventId) {
      const token = localStorage.getItem('authToken');
      if (token && navigator.onLine) {
        // Online: POST immediately and reconcile local ID → Supabase UUID
        fetch(`${API_BASE}/events/${eventId}/waitlist`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name, partySize, specialRequests, type, reservationTime }),
        })
          .then(r => r.ok ? r.json() : Promise.reject(r))
          .then((data: Record<string, unknown>) => {
            const remoteId = data.uuid as string | undefined;
            if (remoteId) {
              setWaitlist(prev => prev.map(e => e.id === localId ? { ...e, id: remoteId, remoteId } : e));
              onIdResolved?.(localId, remoteId);
            }
          })
          .catch(() => {
            // Request failed despite being online (server error) — queue for retry
            queueOp({ type: 'ADD_WAITLIST', localId, eventId, payload: { name, partySize, specialRequests, type } });
          });
      } else if (token) {
        // Offline — queue immediately
        queueOp({ type: 'ADD_WAITLIST', localId, eventId, payload: { name, partySize, specialRequests, type } });
      }
    }

    return localId;
  };

  const removeFromWaitlist = (id: string) => {
    const entry = waitlist.find(e => e.id === id);
    setWaitlist((prev) => prev.filter((e) => e.id !== id));

    if (entry?.eventId) {
      const token = localStorage.getItem('authToken');
      if (!token) return;

      if (!entry.remoteId) {
        // Entry was never synced — cancel the queued ADD_WAITLIST instead of issuing a DELETE
        cancelQueuedAdd(id);
        return;
      }

      const deleteUrl = `${API_BASE}/events/${entry.eventId}/waitlist/${entry.remoteId}`;
      if (navigator.onLine) {
        fetch(deleteUrl, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
          .catch(() => {
            queueOp({ type: 'REMOVE_WAITLIST', localId: id, eventId: entry.eventId, payload: { remoteId: entry.remoteId! } });
          });
      } else {
        queueOp({ type: 'REMOVE_WAITLIST', localId: id, eventId: entry.eventId, payload: { remoteId: entry.remoteId } });
      }
    }
  };

  const updateWaitlistEntry = (id: string, updates: Partial<Omit<WaitlistEntry, 'id' | 'joinedAt'>>) => {
    // 1. Find the entry before we update state so we have its current values (like eventId and remoteId)
    const entry = waitlist.find(e => e.id === id);

    // 2. Update local state immediately for fast UI feedback
    setWaitlist((prev) => prev.map((e) =>
      e.id === id ? { ...e, ...updates } : e
    ));

    // 3. Sync changes to the backend
    if (entry?.eventId) {
      const token = localStorage.getItem('authToken');
      if (!token || !entry.remoteId) return; // Need remoteId to update on server

      const updateUrl = `${API_BASE}/events/${entry.eventId}/waitlist/${entry.remoteId}`;

      const payload = {
        name: updates.name,
        partySize: updates.partySize,
        specialRequests: updates.specialRequests,
        reservationTime: updates.reservationTime
      };

      if (navigator.onLine) {
        fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        }).catch(() => {
          // If the fetch fails despite being online (server error), queue it
          queueOp({
            type: 'UPDATE_WAITLIST',
            localId: id,
            eventId: entry.eventId,
            payload: { remoteId: entry.remoteId!, ...payload }
          });
        });
      } else {
        // Offline -> queue it for later
        queueOp({
          type: 'UPDATE_WAITLIST',
          localId: id,
          eventId: entry.eventId,
          payload: { remoteId: entry.remoteId, ...payload }
        });
      }
    }
  };

  if (showingSplash) {
    return <SplashScreen onVideoEnd={() => setSplashVideoEnded(true)} />;
  }

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