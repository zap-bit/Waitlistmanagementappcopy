import { useState, useEffect } from "react";
import { CircularProgress } from "./CircularProgress";
import { SimpleCapacityTracker } from "./SimpleCapacityTracker";
import { StatusBar } from "./StatusBar";
import { TableGrid, Table } from "./TableGrid";
import { CreateEventModal } from "./CreateEventModal";
import { QRCodeModal } from "./QRCodeModal";
import {
  Plus,
  Minus,
  ArrowUp,
  UserX,
  LogOut,
  Menu,
  X,
  Clock,
  Users,
  Edit2,
  Trash2,
  User as UserIcon,
  QrCode,
  Archive,
  ArchiveRestore,
  Eye,
  EyeOff,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { toast } from "sonner";
import { WaitlistEntry } from "../App";
import {
  Event,
  getStoredEvents,
  addEvent,
  deleteEvent,
  updateEvent,
  updateEventFull,
  archiveEvent,
  restoreEvent,
  getActiveEvents,
  getArchivedEvents,
  CapacityBasedEvent,
  SimpleCapacityEvent,
  syncEventToSupabase,
  patchEventQueues,
  patchEventInSupabase,
  loadEventsFromSupabase,
  TableBasedEvent,
} from "../utils/events";
import { getStoredUser, User } from "../utils/auth";
import { Profile } from "./Profile";

interface Attraction {
  id: string;
  name: string;
  waitTime: number;
  queueSize: number;
  queueCapacity: number;
  throughput: number;
  status: "open" | "closed" | "delayed";
  autoCalculateWait: boolean;
}

interface StaffDashboardProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  user: User;
}

const getStoredNumber = (key: string, defaultValue: number): number => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(`Error loading ${key} from localStorage:`, e);
      }
    }
  }
  return defaultValue;
};

const getStoredBoolean = (key: string, defaultValue: boolean): boolean => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(`Error loading ${key} from localStorage:`, e);
      }
    }
  }
  return defaultValue;
};

const calculateWaitTime = (queueSize: number, throughput: number): number => {
  if (throughput === 0) return 0;
  return Math.round((queueSize / throughput) * 60);
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

const saveEventTables = (eventId: string, tables: Table[]) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(`tables_${eventId}`, JSON.stringify(tables));
  }
  const token = localStorage.getItem('authToken');
  if (token) {
    tables.forEach(table => {
      fetch(`${API_BASE}/events/${eventId}/tables/${table.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          table_capacity: table.capacity,
          name: table.name,
          occupied: table.occupied,
          guest_name: table.guestName || null,
          party_size: table.partySize || null,
          seated_at: table.seatedAt || null,
          row_index: table.row,
          col_index: table.col,
          table_number: table.id,
        }),
      }).catch(e => console.error('Failed to sync table:', e));
    });
  }
};

const loadEventTables = (eventId: string): Table[] | null => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(`tables_${eventId}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(`Error loading tables for event ${eventId}:`, e);
      }
    }
  }
  return null;
};

export function StaffDashboard({
  onLogout,
  waitlist,
  setWaitlist,
  tables,
  setTables,
  user,
}: StaffDashboardProps) {
  const [currentCapacity, setCurrentCapacity] = useState(() => getStoredNumber("currentCapacity", 45));
  const [maxCapacity, setMaxCapacity] = useState(() => getStoredNumber("maxCapacity", 100));
  const [isOnline, setIsOnline] = useState(() => getStoredBoolean("isOnline", true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState<"home" | "waitlist" | "capacity" | "simple-capacity" | "archived">("home");
  const [listView, setListView] = useState<"waitlist" | "reservation">("waitlist");
  const [waitlistSubPage, setWaitlistSubPage] = useState<"view" | "settings">("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [totalTables, setTotalTables] = useState(() => getStoredNumber("totalTables", 12));
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [showEditEventModal, setShowEditEventModal] = useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [events, setEvents] = useState<Event[]>(() => getActiveEvents().filter((e) => e.businessId === user.businessId));
  const [archivedEvents, setArchivedEvents] = useState<Event[]>(() => getArchivedEvents().filter((e) => e.businessId === user.businessId));
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [showAttractionModal, setShowAttractionModal] = useState(false);
  const [editingAttraction, setEditingAttraction] = useState<Attraction | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | undefined>();
  const [selectedQueueName, setSelectedQueueName] = useState<string | undefined>();
  const [eventTypeFilter, setEventTypeFilter] = useState<"all" | "capacity-based" | "table-based" | "simple-capacity">("all");
  const [filterOpen, setFilterOpen] = useState(false);

  useEffect(() => {
    const activeEvents = getActiveEvents().filter((e) => e.businessId === user.businessId);
    const archived = getArchivedEvents().filter((e) => e.businessId === user.businessId);
    setEvents(activeEvents);
    setArchivedEvents(archived);
  }, [user.businessId]);

  useEffect(() => {
    if (currentPage === "home" || currentPage === "archived") {
      const activeEvents = getActiveEvents().filter((e) => e.businessId === user.businessId);
      const archived = getArchivedEvents().filter((e) => e.businessId === user.businessId);
      setEvents(activeEvents);
      setArchivedEvents(archived);

      if (currentPage === "archived") {
        loadEventsFromSupabase().then(() => {
          setArchivedEvents(getArchivedEvents().filter((e) => e.businessId === user.businessId));
        }).catch(() => { });
      }
    }
  }, [currentPage, user.businessId]);

  useEffect(() => {
    if (!selectedEvent) return;
    const token = localStorage.getItem('authToken');
    if (!token) return;
    const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';
    const eventId = selectedEvent.id;

    const fetchDashboard = () => {
      fetch(`${apiBase}/events/${eventId}/staff/dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.ok ? r.json() : Promise.reject(r))
        .then((data: { waitlist: Array<Record<string, unknown>>; tables: Array<Record<string, unknown>> }) => {
          if (Array.isArray(data.tables) && data.tables.length > 0) {
            const maxAllowedTables = (selectedEvent as any).numberOfTables || 12;

            const mappedTables = data.tables
              .map(t => ({
                id: (t.table_number as number) ?? (t.uuid as string),
                row: (t.row_index as number) ?? 0,
                col: (t.col_index as number) ?? 0,
                name: (t.name as string) || 'Table',
                capacity: (t.table_capacity as number) || 4,
                occupied: Boolean(t.occupied),
                guestName: (t.guest_name as string) || undefined,
                partySize: (t.party_size as number) || undefined,
                seatedAt: t.seated_at ? new Date(t.seated_at as string) : undefined,
              }))
              .filter(t => t.id <= maxAllowedTables)
              .sort((a, b) => a.id - b.id);

            setTables(mappedTables);
            saveEventTables(eventId, mappedTables);
          }
        })
        .catch(() => { });
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(interval);
  }, [selectedEvent?.id]);

  const handlePromote = (id: string) => {
    const entry = waitlist.find((e) => e.id === id);
    if (!entry) return;
    const availableTable = findBestTable(entry, tables);
    if (availableTable) {
      const isJoiningExistingParty = availableTable.occupied && availableTable.guestName;
      const updatedTables = tables.map((t) =>
        t.id === availableTable.id
          ? {
            ...t,
            occupied: true,
            guestName: isJoiningExistingParty ? `${availableTable.guestName} & ${entry.name}` : entry.name,
            partySize: isJoiningExistingParty ? (availableTable.partySize || 0) + entry.partySize : entry.partySize,
            seatedAt: availableTable.seatedAt || new Date(),
          }
          : t,
      );
      setTables(updatedTables);
      setWaitlist(waitlist.filter((e) => e.id !== id));
      if (selectedEvent && selectedEvent.type === "table-based") {
        const filledCount = updatedTables.filter((t) => t.occupied).length;
        updateEvent(selectedEvent.id, { currentFilledTables: filledCount });
        setSelectedEvent({ ...selectedEvent, currentFilledTables: filledCount } as any);
        saveEventTables(selectedEvent.id, updatedTables);
      }
      simulateSync();
      const token = localStorage.getItem('authToken');
      if (token && selectedEvent) {
        fetch(`${API_BASE}/events/${selectedEvent.id}/staff/seat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ entryId: id, tableId: availableTable.id })
        }).catch(err => console.error('Failed to sync seating to server:', err));
      }
    }
  };

  const handleClearTable = (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;
    const updatedTables = tables.map((t) =>
      t.id === tableId ? { ...t, occupied: false, guestName: undefined, partySize: undefined, seatedAt: undefined } : t
    );
    setTables(updatedTables);
    if (selectedEvent && selectedEvent.type === "table-based") {
      const filledCount = updatedTables.filter((t) => t.occupied).length;
      updateEvent(selectedEvent.id, { currentFilledTables: filledCount });
      setSelectedEvent({ ...selectedEvent, currentFilledTables: filledCount } as any);
      saveEventTables(selectedEvent.id, updatedTables);
    }
    toast.success(`${table.name} cleared`);
    simulateSync();
    const token = localStorage.getItem('authToken');
    if (token && selectedEvent) {
      fetch(`${API_BASE}/events/${selectedEvent.id}/staff/clear-table`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ tableId }),
      }).catch(() => { });
    }
  };

  const handleClearAllTables = () => {
    if (confirm("Clear all tables? This will remove all guests.")) {
      const updatedTables = tables.map((t) => ({ ...t, occupied: false, guestName: undefined, partySize: undefined, seatedAt: undefined }));
      setTables(updatedTables);
      if (selectedEvent && selectedEvent.type === "table-based") {
        updateEvent(selectedEvent.id, { currentFilledTables: 0 });
        setSelectedEvent({ ...selectedEvent, currentFilledTables: 0 } as any);
        saveEventTables(selectedEvent.id, updatedTables);
      }
      toast.success("All tables cleared");
      simulateSync();
    }
  };

  const handleRenameTable = (tableId: number, newName: string) => {
    const updatedTables = tables.map((t) => t.id === tableId ? { ...t, name: newName } : t);
    setTables(updatedTables);
    if (selectedEvent && selectedEvent.type === "table-based") {
      saveEventTables(selectedEvent.id, updatedTables);
    }
    toast.success("Table renamed");
  };

  const handleUpdateCapacity = (tableId: number, newCapacity: number) => {
    const updatedTables = tables.map((t) => t.id === tableId ? { ...t, capacity: newCapacity } : t);
    setTables(updatedTables);
    if (selectedEvent && selectedEvent.type === "table-based") {
      saveEventTables(selectedEvent.id, updatedTables);
    }
    toast.success("Table capacity updated");
  };

  const handleManualOccupy = (tableId: number, guestName: string, partySize: number) => {
    const updatedTables = tables.map((t) =>
      t.id === tableId ? { ...t, occupied: true, guestName, partySize, seatedAt: new Date() } : t,
    );
    setTables(updatedTables);
    if (selectedEvent && selectedEvent.type === "table-based") {
      const filledCount = updatedTables.filter((t) => t.occupied).length;
      updateEvent(selectedEvent.id, { currentFilledTables: filledCount });
      setSelectedEvent({ ...selectedEvent, currentFilledTables: filledCount } as any);
      saveEventTables(selectedEvent.id, updatedTables);
    }
    toast.success(`${guestName} seated manually`);
    simulateSync();
  };

  const findBestTable = (entry: WaitlistEntry, allTables: Table[]) => {
    if (!entry.specialRequests) return allTables.find((t) => !t.occupied && t.capacity >= entry.partySize);
    const requestLower = entry.specialRequests.toLowerCase();
    const tableNumberMatch = requestLower.match(/table\s*#?\s*(\d+)/);
    if (tableNumberMatch) {
      const requestedTableNumber = parseInt(tableNumberMatch[1]);
      const requestedTable = allTables.find((t) => t.id === requestedTableNumber);
      if (requestedTable && !requestedTable.occupied && requestedTable.capacity >= entry.partySize) return requestedTable;
    }
    return allTables.find((t) => !t.occupied && t.capacity >= entry.partySize);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto">
      <StatusBar isOnline={isOnline} isSyncing={isSyncing} />

      <div className="bg-white shadow-sm py-1 px-4 flex items-center justify-between">
        <button onClick={() => currentPage === "archived" ? setCurrentPage("home") : setMenuOpen(!menuOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          {currentPage === "archived" ? <ArrowLeft className="w-6 h-6 text-gray-700" /> : menuOpen ? <X className="w-6 h-6 text-gray-700" /> : <Menu className="w-6 h-6 text-gray-700" />}
        </button>
        <div className="flex-1 flex justify-center"><img src="/gil.png" alt="Get-In-Line" className="h-20 object-contain" /></div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowProfile(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><UserIcon className="w-6 h-6 text-gray-700" /></button>
          <button onClick={onLogout} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><LogOut className="w-6 h-6 text-gray-700" /></button>
        </div>
      </div>

      {currentPage === "home" ? (
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Your Events</h2>
                <p className="text-gray-600">Manage your active events</p>
              </div>
              <button onClick={() => setShowCreateEventModal(true)} className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold active:scale-95 transition-transform shadow-lg">
                <Plus className="w-5 h-5" />Create Event
              </button>
            </div>

            {/* RESTORED: Screenshot 10.41.24 UI (Filtered List) */}
            <div className="mb-5">
              <button onClick={() => setFilterOpen(!filterOpen)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-sm font-medium transition-colors">
                {filterOpen ? <X className="w-4 h-4" /> : <Filter className="w-4 h-4" />} Filter {eventTypeFilter !== "all" && <span className="w-2 h-2 rounded-full bg-blue-500" />}
              </button>
            </div>

            <div className="flex flex-col gap-5">
              {events.filter(e => eventTypeFilter === 'all' || e.type === eventTypeFilter).map((event) => {
                const typeColor = event.type === "capacity-based" ? "blue" : event.type === "simple-capacity" ? "green" : "purple";
                const TypeIcon = Users;
                const currentFilled = loadEventTables(event.id)?.filter(t => t.occupied).length ?? event.currentFilledTables ?? 0;
                const totalPossible = event.numberOfTables || 0;

                return (
                  <div key={event.id} className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all text-left border-2 border-transparent hover:border-${typeColor}-500 group relative`}>
                    {/* RESTORED: Hover Badges from Screenshot 10.41.34 */}
                    <div className="absolute top-4 right-4 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                      <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-green-100 text-green-700">Active</span>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${event.isPublic ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"}`}>
                        {event.isPublic ? <><Eye className="w-3 h-3" />Public</> : <><EyeOff className="w-3 h-3" />Private</>}
                      </span>
                    </div>

                    <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                      <button onClick={(e) => { e.stopPropagation(); setSelectedEvent(event); setShowQRCodeModal(true); }} className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg"><QrCode className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEventToEdit(event); setShowEditEventModal(true); }} className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); setEventToDelete(event); setShowDeleteConfirmation(true); }} className="p-2 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg"><Archive className="w-4 h-4" /></button>
                    </div>

                    <div onClick={() => {
                      setSelectedEvent(event);
                      if (event.type === "capacity-based") setCurrentPage("capacity");
                      else if (event.type === "simple-capacity") setCurrentPage("simple-capacity");
                      else {
                        setCurrentPage("waitlist"); setWaitlistSubPage("view");
                        const tableEvent = event as any;
                        const newTableCount = tableEvent.numberOfTables || 12;
                        const newAvgSize = tableEvent.averageTableSize || 4;
                        const existingTables = loadEventTables(event.id);
                        let reconciled: Table[] = [];
                        if (existingTables) {
                          reconciled = existingTables.slice(0, newTableCount).map(t => ({ ...t, capacity: newAvgSize }));
                          if (reconciled.length < newTableCount) {
                            for (let i = reconciled.length; i < newTableCount; i++) {
                              reconciled.push({ id: i + 1, row: Math.floor(i / 4), col: i % 4, name: `Table ${i + 1}`, capacity: newAvgSize, occupied: false });
                            }
                          }
                        } else {
                          for (let i = 0; i < newTableCount; i++) {
                            reconciled.push({ id: i + 1, row: Math.floor(i / 4), col: i % 4, name: `Table ${i + 1}`, capacity: newAvgSize, occupied: false });
                          }
                        }
                        setTotalTables(newTableCount); setTables(reconciled); saveEventTables(event.id, reconciled);
                      }
                    }} className="cursor-pointer px-7 py-8">
                      <div className="flex items-center gap-6">
                        <div className={`w-16 h-16 bg-${typeColor}-100 rounded-xl flex items-center justify-center group-hover:bg-${typeColor}-500 transition-colors`}>
                          <TypeIcon className={`w-8 h-8 text-${typeColor}-600 group-hover:text-white transition-colors`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-800 mb-2">{event.name}</h3>
                          <span className="text-sm text-gray-600 capitalize">{event.type.replace('-', ' ')}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            {event.type === "table-based" ? (
                              <>
                                <div className="text-2xl font-bold text-gray-800">{currentFilled} <span className="text-sm font-normal text-gray-500">/ {totalPossible}</span></div>
                                <div className="text-xs text-gray-500">Tables Filled</div>
                              </>
                            ) : (<div className="text-2xl font-bold">→</div>)}
                          </div>
                          <div className="text-3xl font-bold text-gray-300 group-hover:text-blue-500 transition-colors">→</div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : currentPage === "waitlist" ? (
        <div className="flex-1 overflow-auto p-4 space-y-4">
          <button onClick={() => setCurrentPage("home")} className="text-blue-600 text-sm">← Back to Your Events</button>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Table Management</h2>
            <button onClick={handleClearAllTables} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow shadow-red-200">
              <X className="w-4 h-4" />Clear All Tables
            </button>
          </div>
          <TableGrid tables={tables} onClearTable={handleClearTable} onRenameTable={handleRenameTable} onUpdateCapacity={handleUpdateCapacity} onManualOccupy={(id) => { const name = prompt("Guest Name?"); if (name) handleManualOccupy(id, name, 1); }} />
        </div>
      ) : null}

      {/* Edit Event Modal with OCCUPANCY PROTECTION */}
      {showEditEventModal && eventToEdit && (
        <CreateEventModal
          businessId={getStoredUser()?.businessId || "default"}
          onClose={() => { setShowEditEventModal(false); setEventToEdit(null); }}
          onCreateEvent={(updatedEvent) => {
            // NEW LOGIC: Check if reducing table count while tables are occupied
            if (updatedEvent.type === "table-based") {
              const currentTables = loadEventTables(updatedEvent.id) || [];
              const newTableCount = (updatedEvent as TableBasedEvent).numberOfTables || 0;

              // Find tables that would be deleted (id > newTableCount)
              const tablesToDelete = currentTables.filter(t => t.id > newTableCount);
              const occupiedTablesToDelete = tablesToDelete.filter(t => t.occupied);

              if (occupiedTablesToDelete.length > 0) {
                const names = occupiedTablesToDelete.map(t => t.name).join(", ");
                toast.error("Cannot reduce table count", {
                  description: `The following tables are currently occupied: ${names}. Please clear them before updating the event.`,
                  duration: 6000
                });
                return; // EXIT: Do not save changes
              }
            }

            updateEventFull(updatedEvent);
            patchEventInSupabase(updatedEvent);
            setEvents(getActiveEvents().filter(e => e.businessId === user.businessId));
            if (selectedEvent && selectedEvent.id === updatedEvent.id) setSelectedEvent(updatedEvent);
            setShowEditEventModal(false);
            setEventToEdit(null);
            toast.success("Event updated successfully!");
          }}
          editEvent={eventToEdit}
        />
      )}

      {showCreateEventModal && (
        <CreateEventModal businessId={getStoredUser()?.businessId || "default"} onClose={() => setShowCreateEventModal(false)} onCreateEvent={(event) => { addEvent(event); syncEventToSupabase(event); setEvents(getActiveEvents().filter(e => e.businessId === user.businessId)); }} />
      )}
      {showProfile && <Profile user={user} onClose={() => setShowProfile(false)} onLogout={onLogout} />}
      {showQRCodeModal && selectedEvent && <QRCodeModal event={selectedEvent} onClose={() => { setShowQRCodeModal(false); setSelectedQueueId(undefined); }} queueId={selectedQueueId} queueName={selectedQueueName} />}
    </div>
  );
}