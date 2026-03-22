import { useCallback, useEffect, useMemo, useState } from 'react';
import { StaffDashboard } from './components/StaffDashboard';
import { AttendeeView } from './components/AttendeeView';
import { Welcome } from './components/Welcome';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Toaster, toast } from 'sonner';
import { apiClient, type ApiEvent, type ApiUser, type ApiWaitlistEntry } from '../api/client';
import { type Table } from './components/TableGrid';
import { getStoredUser, logout as authLogout, setStoredUser, type User } from './utils/auth';
import { saveEvents, type CapacityBasedEvent, type Event, type TableBasedEvent } from './utils/events';

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
  position: number;
  status: 'QUEUED' | 'NOTIFIED' | 'SEATED' | 'NO_SHOW' | 'CANCELLED' | 'EXPIRED';
  createdByUserId?: string;
}

function toUiWaitlistEntry(entry: ApiWaitlistEntry): WaitlistEntry {
  return {
    id: entry.id,
    name: entry.name,
    partySize: entry.partySize,
    joinedAt: new Date(entry.joinedAt),
    estimatedWait: entry.estimatedWait,
    specialRequests: entry.specialRequests,
    type: entry.type,
    eventId: entry.eventId,
    position: entry.position,
    status: entry.status,
    createdByUserId: entry.createdByUserId,
  };
}

function toUiEvent(event: ApiEvent): Event {
  const base = {
    id: event.id,
    businessId: event.businessId,
    name: event.name,
    type: event.type,
    status: event.status,
    createdAt: new Date(event.createdAt),
  };

  if (event.type === 'capacity-based') {
    return {
      ...base,
      type: 'capacity-based',
      capacity: event.capacity,
      estimatedWaitPerPerson: event.estimatedWaitPerPerson,
      location: event.location,
      currentCount: event.currentCount,
    } as CapacityBasedEvent;
  }

  return {
    ...base,
    type: 'table-based',
    numberOfTables: event.numberOfTables,
    averageTableSize: event.averageTableSize,
    reservationDuration: event.reservationDuration,
    noShowPolicy: event.noShowPolicy,
    currentFilledTables: event.currentFilledTables,
  } as TableBasedEvent;
}

function toUiUser(user: ApiUser): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    businessId: user.businessId,
  };
}

export default function App() {
  const [authScreen, setAuthScreen] = useState<AuthScreen>(null);
  const [user, setUser] = useState<User | null>(getStoredUser());
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>(apiClient.eventId);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>([]);
  const [tables, setTables] = useState<Table[]>([]);
  const [myEntries, setMyEntries] = useState<WaitlistEntry[]>([]);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  const syncEvents = useCallback(async () => {
    const response = await apiClient.listEvents();
    const nextEvents = response.data.map(toUiEvent);
    setEvents(nextEvents);
    saveEvents(nextEvents);

    if (nextEvents.length > 0) {
      setSelectedEventId((current) => (nextEvents.some((event) => event.id === current) ? current : nextEvents[0].id));
    }

    return nextEvents;
  }, []);

  const syncStaffDashboard = useCallback(async (eventId: string) => {
    const dashboard = await apiClient.getDashboard(eventId);
    setWaitlist(dashboard.waitlist.map(toUiWaitlistEntry));
    setTables(
      dashboard.tables.map((table) => ({
        ...table,
        seatedAt: table.seatedAt ? new Date(table.seatedAt) : undefined,
      })),
    );
  }, []);

  const syncMyEntries = useCallback(async () => {
    const response = await apiClient.getMyWaitlist();
    setMyEntries(response.data.map(toUiWaitlistEntry));
  }, []);

  const bootstrapSession = useCallback(async () => {
    if (!apiClient.hasToken()) {
      setUser(null);
      setSelectedRole(null);
      setAuthScreen('welcome');
      setIsBootstrapping(false);
      return;
    }

    try {
      const me = await apiClient.getMe();
      const nextUser = toUiUser(me.user);
      setUser(nextUser);
      setStoredUser(nextUser);
      setSelectedRole(nextUser.role === 'staff' ? 'staff' : 'attendee');
      const nextEvents = await syncEvents();

      if (nextUser.role === 'staff') {
        const eventId = nextEvents[0]?.id || selectedEventId;
        if (eventId) {
          setSelectedEventId(eventId);
          await syncStaffDashboard(eventId);
        }
      } else {
        await syncMyEntries();
      }

      setAuthScreen(null);
    } catch {
      authLogout();
      setUser(null);
      setSelectedRole(null);
      setAuthScreen('welcome');
    } finally {
      setIsBootstrapping(false);
    }
  }, [selectedEventId, syncEvents, syncMyEntries, syncStaffDashboard]);

  useEffect(() => {
    void bootstrapSession();
  }, [bootstrapSession]);

  useEffect(() => {
    if (user?.role === 'staff' && selectedEventId) {
      void syncStaffDashboard(selectedEventId);
    }
  }, [selectedEventId, user?.role, syncStaffDashboard]);

  const completeAuth = async (authPromise: Promise<{ user: ApiUser } & { token?: string }>) => {
    const auth = await authPromise;
    const nextUser = toUiUser(auth.user);
    setUser(nextUser);
    setStoredUser(nextUser);
    setSelectedRole(nextUser.role === 'staff' ? 'staff' : 'attendee');
    setAuthScreen(null);
    const nextEvents = await syncEvents();

    if (nextUser.role === 'staff') {
      const eventId = nextEvents[0]?.id || selectedEventId;
      if (eventId) {
        setSelectedEventId(eventId);
        await syncStaffDashboard(eventId);
      }
    } else {
      await syncMyEntries();
    }

    return nextUser;
  };

  const handleLogout = async () => {
    setSelectedRole(null);
    authLogout();
    setStoredUser(null);
    setUser(null);
    setEvents([]);
    setWaitlist([]);
    setTables([]);
    setMyEntries([]);
    setAuthScreen('welcome');
    await apiClient.logout();
  };

  const handleLogin = async (email: string, password: string) => {
    try {
      const nextUser = await completeAuth(apiClient.login({ email, password }));
      toast.success(`Welcome back, ${nextUser.name}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Login failed');
    }
  };

  const handleSignupUser = async (email: string, password: string, name: string) => {
    try {
      const nextUser = await completeAuth(apiClient.signupUser({ email, password, name }));
      toast.success(`Welcome, ${nextUser.name}!`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signup failed');
    }
  };

  const handleSignupBusiness = async (email: string, password: string, ownerName: string, businessName: string) => {
    try {
      const nextUser = await completeAuth(apiClient.signupBusiness({ email, password, ownerName, businessName }));
      toast.success(`Welcome, ${nextUser.name}! Your business "${businessName}" has been created.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Signup failed');
    }
  };

  const addToWaitlist = async (
    name: string,
    partySize: number,
    specialRequests?: string,
    type: 'reservation' | 'waitlist' = 'waitlist',
    eventId?: string,
  ) => {
    const resolvedEventId = eventId || selectedEventId;
    const entry = await apiClient.addToWaitlist(resolvedEventId, { name, partySize, type, specialRequests });
    await syncMyEntries();
    if (user?.role === 'staff') {
      await syncStaffDashboard(resolvedEventId);
    }
    return entry.id;
  };

  const removeFromWaitlist = async (id: string, eventId?: string) => {
    const resolvedEventId = eventId || myEntries.find((entry) => entry.id === id)?.eventId || selectedEventId;
    if (!resolvedEventId) return;
    await apiClient.removeWaitlistEntry(resolvedEventId, id);
    await syncMyEntries();
    if (user?.role === 'staff') {
      await syncStaffDashboard(resolvedEventId);
    }
  };

  const selectedEvent = useMemo(() => events.find((event) => event.id === selectedEventId) || null, [events, selectedEventId]);

  if (isBootstrapping) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center text-gray-600">Loading secure session…</div>;
  }

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
          <Login onLogin={handleLogin} onBackToWelcome={() => setAuthScreen('welcome')} onSwitchToSignup={() => setAuthScreen('signup')} />
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
        <StaffDashboard
          onLogout={() => void handleLogout()}
          waitlist={waitlist}
          setWaitlist={setWaitlist}
          tables={tables}
          setTables={setTables}
          events={events}
          selectedEventId={selectedEventId}
          onSelectEvent={(eventId) => setSelectedEventId(eventId)}
          onRefresh={() => (selectedEventId ? syncStaffDashboard(selectedEventId) : Promise.resolve())}
          onCreateEvent={async (eventInput) => {
            // #SPEC GAP: the Figma phase 4 modal does not model backend-owned businessId/id fields,
            // so the client only submits create-safe fields and lets the server assign ownership/ids.
            const payload = eventInput.type === 'capacity-based'
              ? {
                  type: 'capacity-based' as const,
                  name: eventInput.name,
                  status: eventInput.status,
                  capacity: eventInput.capacity,
                  estimatedWaitPerPerson: eventInput.estimatedWaitPerPerson,
                  location: eventInput.location,
                  currentCount: eventInput.currentCount,
                }
              : {
                  type: 'table-based' as const,
                  name: eventInput.name,
                  status: eventInput.status,
                  numberOfTables: eventInput.numberOfTables,
                  averageTableSize: eventInput.averageTableSize,
                  reservationDuration: eventInput.reservationDuration,
                  noShowPolicy: eventInput.noShowPolicy,
                  currentFilledTables: eventInput.currentFilledTables,
                };
            await apiClient.createEvent(payload as never);
            const nextEvents = await syncEvents();
            if (nextEvents[0]) setSelectedEventId(nextEvents[0].id);
          }}
          onDeleteEvent={async (eventId) => {
            await apiClient.deleteEvent(eventId);
            const nextEvents = await syncEvents();
            const nextEventId = nextEvents[0]?.id || apiClient.eventId;
            setSelectedEventId(nextEventId);
            if (nextEvents[0]) await syncStaffDashboard(nextEventId);
          }}
          onPromote={async (entryId) => {
            if (!selectedEvent) return;
            const entry = waitlist.find((item) => item.id === entryId);
            if (!entry) return;
            const availableTable = tables.find((table) => !table.occupied && table.capacity >= entry.partySize);
            if (!availableTable) throw new Error('No available tables for this party size');
            await apiClient.promoteWaitlistEntry(selectedEvent.id, entryId);
            await apiClient.seatWaitlistEntry(selectedEvent.id, entryId, availableTable.id);
            await syncStaffDashboard(selectedEvent.id);
          }}
          onRemoveEntry={async (entryId) => {
            if (!selectedEvent) return;
            await apiClient.removeWaitlistEntry(selectedEvent.id, entryId);
            await syncStaffDashboard(selectedEvent.id);
          }}
          onClearTable={async (tableId) => {
            if (!selectedEvent) return;
            await apiClient.clearTable(selectedEvent.id, tableId);
            await syncStaffDashboard(selectedEvent.id);
          }}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  if (selectedRole === 'attendee') {
    return (
      <>
        <AttendeeView
          onLogout={() => void handleLogout()}
          waitlist={myEntries}
          addToWaitlist={addToWaitlist}
          removeFromWaitlist={(id, eventId) => void removeFromWaitlist(id, eventId)}
          allWaitlistEntries={myEntries}
          tables={tables}
          events={events}
          refreshEntries={() => syncMyEntries()}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  return null;
}
