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
  setWaitlist: React.Dispatch<
    React.SetStateAction<WaitlistEntry[]>
  >;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
  user: User;
}

const getStoredNumber = (
  key: string,
  defaultValue: number,
): number => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(
          `Error loading ${key} from localStorage:`,
          e,
        );
      }
    }
  }
  return defaultValue;
};

const getStoredBoolean = (
  key: string,
  defaultValue: boolean,
): boolean => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error(
          `Error loading ${key} from localStorage:`,
          e,
        );
      }
    }
  }
  return defaultValue;
};

const calculateWaitTime = (
  queueSize: number,
  throughput: number,
): number => {
  if (throughput === 0) return 0;
  return Math.round((queueSize / throughput) * 60);
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';

// Helper functions to save/load tables per event
const saveEventTables = (eventId: string, tables: Table[]) => {
  if (typeof window !== "undefined") {
    localStorage.setItem(
      `tables_${eventId}`,
      JSON.stringify(tables),
    );
  }
  // Sync to Supabase
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
        console.error(
          `Error loading tables for event ${eventId}:`,
          e,
        );
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
  const [currentCapacity, setCurrentCapacity] = useState(() =>
    getStoredNumber("currentCapacity", 45),
  );
  const [maxCapacity, setMaxCapacity] = useState(() =>
    getStoredNumber("maxCapacity", 100),
  );
  const [isOnline, setIsOnline] = useState(() =>
    getStoredBoolean("isOnline", true),
  );
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState<
    | "home"
    | "waitlist"
    | "capacity"
    | "simple-capacity"
    | "archived"
  >("home");
  const [listView, setListView] = useState<
    "waitlist" | "reservation"
  >("waitlist");
  const [waitlistSubPage, setWaitlistSubPage] = useState<
    "view" | "settings"
  >("view");
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [totalTables, setTotalTables] = useState(() =>
    getStoredNumber("totalTables", 12),
  );
  const [showCreateEventModal, setShowCreateEventModal] =
    useState(false);
  const [showEditEventModal, setShowEditEventModal] =
    useState(false);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(
    null,
  );
  const [events, setEvents] = useState<Event[]>(() =>
    getActiveEvents().filter(
      (e) => e.businessId === user.businessId,
    ),
  );
  const [archivedEvents, setArchivedEvents] = useState<Event[]>(
    () =>
      getArchivedEvents().filter(
        (e) => e.businessId === user.businessId,
      ),
  );
  const [selectedEvent, setSelectedEvent] =
    useState<Event | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>(
    [],
  );
  const [showAttractionModal, setShowAttractionModal] =
    useState(false);
  const [editingAttraction, setEditingAttraction] =
    useState<Attraction | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] =
    useState(false);
  const [eventToDelete, setEventToDelete] =
    useState<Event | null>(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<
    string | undefined
  >();
  const [selectedQueueName, setSelectedQueueName] = useState<
    string | undefined
  >();

  // Filter events by businessId on mount and refresh
  useEffect(() => {
    const activeEvents = getActiveEvents().filter(
      (e) => e.businessId === user.businessId,
    );
    const archived = getArchivedEvents().filter(
      (e) => e.businessId === user.businessId,
    );
    setEvents(activeEvents);
    setArchivedEvents(archived);
  }, [user.businessId]);

  // Refresh events when navigating to home or archived pages
  useEffect(() => {
    if (currentPage === "home" || currentPage === "archived") {
      const activeEvents = getActiveEvents().filter(
        (e) => e.businessId === user.businessId,
      );
      const archived = getArchivedEvents().filter(
        (e) => e.businessId === user.businessId,
      );
      setEvents(activeEvents);
      setArchivedEvents(archived);
    }
  }, [currentPage, user.businessId]);

  // Load and poll the selected event's waitlist + tables from Supabase every 10 s
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
          if (Array.isArray(data.waitlist)) {
            const entries = data.waitlist.map(p => {
              const parts = String(p.special_req || '').split(' | ');
              return {
                id: p.uuid as string,
                remoteId: p.uuid as string,
                name: parts[0] || 'Guest',
                partySize: (p.party_size as number) || 1,
                joinedAt: new Date((p.created_at as string) || Date.now()),
                estimatedWait: 15,
                specialRequests: parts[1] || undefined,
                type: 'waitlist' as const,
                eventId,
              };
            });
            setWaitlist(prev => [
              ...prev.filter(e => e.eventId !== eventId),
              ...entries,
            ]);
          }
          if (Array.isArray(data.tables) && data.tables.length > 0) {
            const mappedTables = data.tables.map(t => ({
              id: (t.table_number as number) ?? (t.uuid as string),
              row: (t.row_index as number) ?? 0,
              col: (t.col_index as number) ?? 0,
              name: (t.name as string) || 'Table',
              capacity: (t.table_capacity as number) || 4,
              occupied: Boolean(t.occupied),
              guestName: (t.guest_name as string) || undefined,
              partySize: (t.party_size as number) || undefined,
              seatedAt: t.seated_at ? new Date(t.seated_at as string) : undefined,
            }));
            setTables(mappedTables);
            saveEventTables(eventId, mappedTables);
          }
        })
        .catch(() => { /* silent — offline or server error */ });
    };

    fetchDashboard();
    const interval = setInterval(fetchDashboard, 10_000);
    return () => clearInterval(interval);
  }, [selectedEvent?.id]);

  // Poll for event updates every 2 seconds to keep staff view in sync
  useEffect(() => {
    const pollEvents = () => {
      const activeEvents = getActiveEvents().filter(
        (e) => e.businessId === user.businessId,
      );
      const archived = getArchivedEvents().filter(
        (e) => e.businessId === user.businessId,
      );
      setEvents(activeEvents);
      setArchivedEvents(archived);

      // If there's a selected event, refresh it with latest data
      if (selectedEvent) {
        const updatedEvent = [
          ...activeEvents,
          ...archived,
        ].find((e) => e.id === selectedEvent.id);
        if (
          updatedEvent &&
          JSON.stringify(updatedEvent) !==
            JSON.stringify(selectedEvent)
        ) {
          setSelectedEvent(updatedEvent);
        }
      }
    };

    const interval = setInterval(pollEvents, 2000);
    return () => clearInterval(interval);
  }, [user.businessId, selectedEvent?.id]);

  // Auto-create default line for single-queue events
  useEffect(() => {
    if (
      selectedEvent &&
      selectedEvent.type === "capacity-based"
    ) {
      const capacityEvent = selectedEvent as CapacityBasedEvent;
      if (
        capacityEvent.queueMode === "single" &&
        attractions.length === 0
      ) {
        // Create a default line with the same name as the event
        const defaultLine: Attraction = {
          id: "default-single-queue",
          name: selectedEvent.name,
          waitTime: capacityEvent.estimatedWaitPerPerson || 30,
          queueSize: capacityEvent.currentCount || 0,
          queueCapacity: capacityEvent.capacity || 100,
          throughput: 240, // default throughput
          status: "open",
          autoCalculateWait: true,
        };
        setAttractions([defaultLine]);
      } else if (capacityEvent.queueMode === "multiple") {
        // Load queues from the event if they exist
        if (
          capacityEvent.queues &&
          capacityEvent.queues.length > 0
        ) {
          const attractionsFromQueues: Attraction[] =
            capacityEvent.queues.map((queue) => ({
              id: queue.id,
              name: queue.name,
              waitTime:
                capacityEvent.estimatedWaitPerPerson || 30,
              queueSize: queue.currentCount || 0,
              queueCapacity: queue.capacity,
              throughput: 240, // default throughput
              status: "open",
              autoCalculateWait: true,
            }));
          setAttractions(attractionsFromQueues);
        } else if (attractions.length === 0) {
          // No queues defined yet, start with empty
          setAttractions([]);
        }
      }
    }
  }, [selectedEvent]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "currentCapacity",
        JSON.stringify(currentCapacity),
      );
    }
  }, [currentCapacity]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "totalTables",
        JSON.stringify(totalTables),
      );
    }
  }, [totalTables]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "maxCapacity",
        JSON.stringify(maxCapacity),
      );
    }
  }, [maxCapacity]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "isOnline",
        JSON.stringify(isOnline),
      );
    }
  }, [isOnline]);

  const simulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1000);
  };

  const handleDecreaseCapacity = () => {
    if (currentCapacity > 0) {
      setCurrentCapacity((prev) => prev - 1);
      simulateSync();
    }
  };

  const handleIncreaseCapacity = () => {
    if (currentCapacity < maxCapacity) {
      setCurrentCapacity((prev) => prev + 1);
      simulateSync();
    }
  };

  // Helper function to calculate distance between two tables
  const calculateTableDistance = (
    table1: Table,
    table2: Table,
  ): number => {
    const rowDiff = Math.abs(table1.row - table2.row);
    const colDiff = Math.abs(table1.col - table2.col);
    // Use Euclidean distance
    return Math.sqrt(rowDiff * rowDiff + colDiff * colDiff);
  };

  // Helper function to find adjacent tables (direct neighbors)
  const findAdjacentTables = (
    table: Table,
    allTables: Table[],
  ): Table[] => {
    return allTables.filter((t) => {
      const rowDiff = Math.abs(t.row - table.row);
      const colDiff = Math.abs(t.col - table.col);
      // Adjacent means within 1 row/col (including diagonals)
      return rowDiff <= 1 && colDiff <= 1 && t.id !== table.id;
    });
  };

  // Helper function to find the best table based on special requests
  const findBestTable = (
    entry: WaitlistEntry,
    allTables: Table[],
  ) => {
    if (!entry.specialRequests) {
      // No special requests, just find any available table with sufficient capacity
      return allTables.find(
        (t) => !t.occupied && t.capacity >= entry.partySize,
      );
    }

    const requestLower = entry.specialRequests.toLowerCase();

    // Check for specific table requests (e.g., "table 4", "table #4", "table number 4")
    const tableNumberMatch = requestLower.match(
      /table\s*#?\s*(\d+)/,
    );
    if (tableNumberMatch) {
      const requestedTableNumber = parseInt(
        tableNumberMatch[1],
      );
      const requestedTable = allTables.find((t) => {
        const tableNum = t.name.match(/\d+/);
        return (
          tableNum &&
          parseInt(tableNum[0]) === requestedTableNumber
        );
      });

      if (
        requestedTable &&
        !requestedTable.occupied &&
        requestedTable.capacity >= entry.partySize
      ) {
        return requestedTable;
      } else if (requestedTable && requestedTable.occupied) {
        toast.info(
          `Table ${requestedTableNumber} is occupied. Finding alternative...`,
          {
            description: `${entry.name} requested this table`,
          },
        );
      } else if (
        requestedTable &&
        requestedTable.capacity < entry.partySize
      ) {
        toast.info(
          `Table ${requestedTableNumber} is too small (capacity ${requestedTable.capacity}). Finding alternative...`,
          {
            description: `Party size: ${entry.partySize}`,
          },
        );
      }
    }

    // Check for requests to sit with another guest
    // Look for patterns like "with John", "join Sarah", "same table as Mike"
    const withGuestMatch = requestLower.match(
      /(?:with|join|same\s+table\s+as)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/,
    );
    if (withGuestMatch) {
      const requestedGuestName = withGuestMatch[1].trim();
      const occupiedTableWithGuest = allTables.find(
        (t) =>
          t.occupied &&
          t.guestName &&
          t.guestName
            .toLowerCase()
            .includes(requestedGuestName.toLowerCase()),
      );

      if (
        occupiedTableWithGuest &&
        occupiedTableWithGuest.capacity >=
          (occupiedTableWithGuest.partySize || 0) +
            entry.partySize
      ) {
        toast.success(
          `Seating ${entry.name} with ${occupiedTableWithGuest.guestName}!`,
          {
            description: `Both parties at ${occupiedTableWithGuest.name}`,
          },
        );
        return occupiedTableWithGuest; // Will combine parties at this table
      } else if (occupiedTableWithGuest) {
        toast.info(
          `Cannot join ${occupiedTableWithGuest.guestName} - table is full. Finding separate table...`,
          {
            description: `${entry.name} requested to sit together`,
          },
        );
      }
    }

    // Check for requests to sit NEAR another guest
    // Look for patterns like "near John", "close to Sarah", "next to Mike"
    const nearGuestMatch = requestLower.match(
      /(?:near|close\s+to|next\s+to)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/,
    );
    if (nearGuestMatch) {
      const requestedGuestName = nearGuestMatch[1].trim();
      const occupiedTableWithGuest = allTables.find(
        (t) =>
          t.occupied &&
          t.guestName &&
          t.guestName
            .toLowerCase()
            .includes(requestedGuestName.toLowerCase()),
      );

      if (occupiedTableWithGuest) {
        // Find adjacent tables first
        const adjacentTables = findAdjacentTables(
          occupiedTableWithGuest,
          allTables,
        );
        const availableAdjacentTables = adjacentTables.filter(
          (t) => !t.occupied && t.capacity >= entry.partySize,
        );

        if (availableAdjacentTables.length > 0) {
          // Prioritize direct neighbors (not diagonals)
          const directNeighbors =
            availableAdjacentTables.filter((t) => {
              const rowDiff = Math.abs(
                t.row - occupiedTableWithGuest.row,
              );
              const colDiff = Math.abs(
                t.col - occupiedTableWithGuest.col,
              );
              return (
                (rowDiff === 0 && colDiff === 1) ||
                (rowDiff === 1 && colDiff === 0)
              );
            });

          const tableToUse =
            directNeighbors.length > 0
              ? directNeighbors[0]
              : availableAdjacentTables[0];
          toast.success(
            `Seating ${entry.name} next to ${occupiedTableWithGuest.guestName}!`,
            {
              description: `${entry.name} at ${tableToUse.name}, near ${occupiedTableWithGuest.name}`,
            },
          );
          return tableToUse;
        }

        // If no adjacent tables available, find the closest available table
        const availableTables = allTables.filter(
          (t) => !t.occupied && t.capacity >= entry.partySize,
        );

        if (availableTables.length > 0) {
          const sortedByDistance = availableTables.sort(
            (a, b) => {
              return (
                calculateTableDistance(
                  a,
                  occupiedTableWithGuest,
                ) -
                calculateTableDistance(
                  b,
                  occupiedTableWithGuest,
                )
              );
            },
          );

          toast.info(
            `Seating ${entry.name} as close as possible to ${occupiedTableWithGuest.guestName}`,
            {
              description: `${entry.name} at ${sortedByDistance[0].name}`,
            },
          );
          return sortedByDistance[0];
        }
      } else {
        toast.info(
          `Could not find ${requestedGuestName}. Finding available table...`,
          {
            description: `${entry.name} requested to sit near ${requestedGuestName}`,
          },
        );
      }
    }

    // Check for seating preferences (window, corner, etc.) and prioritize accordingly
    const hasWindowRequest = /window/.test(requestLower);
    const hasQuietRequest = /quiet|corner/.test(requestLower);

    const availableTables = allTables.filter(
      (t) => !t.occupied && t.capacity >= entry.partySize,
    );

    if (hasWindowRequest) {
      // Prioritize tables with lower numbers (assuming they're near windows)
      const sortedTables = [...availableTables].sort((a, b) => {
        const aNum = parseInt(
          a.name.match(/\d+/)?.[0] || "999",
        );
        const bNum = parseInt(
          b.name.match(/\d+/)?.[0] || "999",
        );
        return aNum - bNum;
      });
      if (sortedTables.length > 0) {
        toast.info(`Seating near window as requested`, {
          description: `${entry.name} at ${sortedTables[0].name}`,
        });
        return sortedTables[0];
      }
    }

    if (hasQuietRequest) {
      // Prioritize tables with higher numbers (assuming they're quieter/corner)
      const sortedTables = [...availableTables].sort((a, b) => {
        const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
        const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
        return bNum - aNum;
      });
      if (sortedTables.length > 0) {
        toast.info(`Seating in quiet area as requested`, {
          description: `${entry.name} at ${sortedTables[0].name}`,
        });
        return sortedTables[0];
      }
    }

    // Default: find any available table with sufficient capacity
    return availableTables[0];
  };

  const handlePromote = (id: string) => {
    const entry = waitlist.find((e) => e.id === id);
    if (!entry) return;

    const availableTable = findBestTable(entry, tables);

    if (availableTable) {
      // Check if this is a request to join an existing party
      const isJoiningExistingParty =
        availableTable.occupied && availableTable.guestName;

      const updatedTables = tables.map((t) =>
        t.id === availableTable.id
          ? {
              ...t,
              occupied: true,
              guestName: isJoiningExistingParty
                ? `${availableTable.guestName} & ${entry.name}`
                : entry.name,
              partySize: isJoiningExistingParty
                ? (availableTable.partySize || 0) +
                  entry.partySize
                : entry.partySize,
              seatedAt: availableTable.seatedAt || new Date(),
            }
          : t,
      );

      setTables(updatedTables);
      setWaitlist(waitlist.filter((e) => e.id !== id));

      // Update event's currentFilledTables count
      if (
        selectedEvent &&
        selectedEvent.type === "table-based"
      ) {
        const filledCount = updatedTables.filter(
          (t) => t.occupied,
        ).length;
        updateEvent(selectedEvent.id, {
          currentFilledTables: filledCount,
        });
        setSelectedEvent({
          ...selectedEvent,
          currentFilledTables: filledCount,
        } as any);
        setEvents(getStoredEvents());
        saveEventTables(selectedEvent.id, updatedTables);
      }

      if (!isJoiningExistingParty) {
        toast.success(
          `${entry.name} seated at ${availableTable.name}`,
          {
            description: `Party of ${entry.partySize}`,
          },
        );
      }
      simulateSync();
    } else {
      toast.error("No available tables for this party size", {
        description: `Need table for ${entry.partySize} guests`,
      });
    }
  };

  const handleSeatAll = () => {
    const reservations = waitlist.filter(
      (e) => e.type === "reservation",
    );
    if (reservations.length === 0) return;

    let seatedCount = 0;
    const newTables = [...tables];
    const newWaitlist = [...waitlist];

    reservations.forEach((entry) => {
      const availableTable = findBestTable(entry, newTables);

      if (availableTable) {
        const availableTableIndex = newTables.findIndex(
          (t) => t.id === availableTable.id,
        );

        if (availableTableIndex !== -1) {
          const isJoiningExistingParty =
            availableTable.occupied && availableTable.guestName;

          newTables[availableTableIndex] = {
            ...newTables[availableTableIndex],
            occupied: true,
            guestName: isJoiningExistingParty
              ? `${availableTable.guestName} & ${entry.name}`
              : entry.name,
            partySize: isJoiningExistingParty
              ? (availableTable.partySize || 0) +
                entry.partySize
              : entry.partySize,
            seatedAt: availableTable.seatedAt || new Date(),
          };
          const entryIndex = newWaitlist.findIndex(
            (e) => e.id === entry.id,
          );
          if (entryIndex !== -1) {
            newWaitlist.splice(entryIndex, 1);
            seatedCount++;
          }
        }
      }
    });

    setTables(newTables);
    setWaitlist(newWaitlist);

    // Update event's currentFilledTables count
    if (selectedEvent && selectedEvent.type === "table-based") {
      const filledCount = newTables.filter(
        (t) => t.occupied,
      ).length;
      updateEvent(selectedEvent.id, {
        currentFilledTables: filledCount,
      });
      setSelectedEvent({
        ...selectedEvent,
        currentFilledTables: filledCount,
      } as any);
      setEvents(getStoredEvents());
      saveEventTables(selectedEvent.id, newTables);
    }

    if (seatedCount > 0) {
      toast.success(
        `Seated ${seatedCount} ${seatedCount === 1 ? "guest" : "groups"}`,
      );
      simulateSync();
    } else {
      toast.error("No available tables for any reservations");
    }
  };

  const handleNoShow = (id: string) => {
    const entry = waitlist.find((e) => e.id === id);
    if (!entry) return;

    setWaitlist(waitlist.filter((e) => e.id !== id));
    toast.error(`${entry.name} marked as no-show`);
    simulateSync();
  };

  const handleClearTable = (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    const updatedTables = tables.map((t) =>
      t.id === tableId
        ? {
            ...t,
            occupied: false,
            guestName: undefined,
            partySize: undefined,
            seatedAt: undefined,
          }
        : t,
    );

    setTables(updatedTables);

    // Update event's currentFilledTables count
    if (selectedEvent && selectedEvent.type === "table-based") {
      const filledCount = updatedTables.filter(
        (t) => t.occupied,
      ).length;
      updateEvent(selectedEvent.id, {
        currentFilledTables: filledCount,
      });
      setSelectedEvent({
        ...selectedEvent,
        currentFilledTables: filledCount,
      } as any);
      setEvents(getStoredEvents());
      saveEventTables(selectedEvent.id, updatedTables);
    }

    toast.success(`${table.name} cleared`);
    simulateSync();
  };

  const handleClearAllTables = () => {
    if (
      confirm("Clear all tables? This will remove all guests.")
    ) {
      const updatedTables = tables.map((t) => ({
        ...t,
        occupied: false,
        guestName: undefined,
        partySize: undefined,
        seatedAt: undefined,
      }));

      setTables(updatedTables);

      // Update event's currentFilledTables count to 0
      if (
        selectedEvent &&
        selectedEvent.type === "table-based"
      ) {
        updateEvent(selectedEvent.id, {
          currentFilledTables: 0,
        });
        setSelectedEvent({
          ...selectedEvent,
          currentFilledTables: 0,
        } as any);
        setEvents(getStoredEvents());
        saveEventTables(selectedEvent.id, updatedTables);
      }

      toast.success("All tables cleared");
      simulateSync();
    }
  };

  const handleRenameTable = (
    tableId: number,
    newName: string,
  ) => {
    const updatedTables = tables.map((t) =>
      t.id === tableId ? { ...t, name: newName } : t,
    );
    setTables(updatedTables);

    // Save tables to localStorage
    if (selectedEvent && selectedEvent.type === "table-based") {
      saveEventTables(selectedEvent.id, updatedTables);
    }

    toast.success("Table renamed");
    simulateSync();
  };

  const handleUpdateCapacity = (
    tableId: number,
    newCapacity: number,
  ) => {
    const updatedTables = tables.map((t) =>
      t.id === tableId ? { ...t, capacity: newCapacity } : t,
    );
    setTables(updatedTables);

    // Save tables to localStorage
    if (selectedEvent && selectedEvent.type === "table-based") {
      saveEventTables(selectedEvent.id, updatedTables);
    }

    toast.success("Table capacity updated");
    simulateSync();
  };

  const handleManualOccupy = (
    tableId: number,
    guestName: string,
    partySize: number,
  ) => {
    const updatedTables = tables.map((t) =>
      t.id === tableId
        ? {
            ...t,
            occupied: true,
            guestName,
            partySize,
            seatedAt: new Date(),
          }
        : t,
    );

    setTables(updatedTables);

    // Update event's currentFilledTables count
    if (selectedEvent && selectedEvent.type === "table-based") {
      const filledCount = updatedTables.filter(
        (t) => t.occupied,
      ).length;
      updateEvent(selectedEvent.id, {
        currentFilledTables: filledCount,
      });
      setSelectedEvent({
        ...selectedEvent,
        currentFilledTables: filledCount,
      } as any);
      setEvents(getStoredEvents());
      saveEventTables(selectedEvent.id, updatedTables);
    }

    toast.success(`${guestName} seated manually`);
    simulateSync();
  };

  const handleUpdateTableCount = (newCount: number) => {
    if (newCount < 1 || newCount > 24) return;

    const oldCount = tables.length;
    const newTables = [...tables];

    if (newCount > oldCount) {
      const cols = 4;
      for (let i = oldCount; i < newCount; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        newTables.push({
          id: i + 1,
          row,
          col,
          name: `Table ${i + 1}`,
          capacity: 4,
          occupied: false,
        });
      }
    } else if (newCount < oldCount) {
      newTables.splice(newCount);
    }

    setTotalTables(newCount);
    setTables(newTables);

    // Save tables to localStorage
    if (selectedEvent && selectedEvent.type === "table-based") {
      saveEventTables(selectedEvent.id, newTables);
      // Also update the event's numberOfTables
      updateEvent(selectedEvent.id, {
        numberOfTables: newCount,
      });
      setSelectedEvent({
        ...selectedEvent,
        numberOfTables: newCount,
      } as any);
      setEvents(getStoredEvents());
    }

    toast.success(`Table count updated to ${newCount}`);
    simulateSync();
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col max-w-md mx-auto">
      <StatusBar isOnline={isOnline} isSyncing={isSyncing} />

      <div className="bg-black text-white p-4 flex items-center justify-between">
        <button
          onClick={() =>
            currentPage === "archived"
              ? setCurrentPage("home")
              : setMenuOpen(!menuOpen)
          }
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {currentPage === "archived" ? (
            <ArrowLeft className="w-6 h-6" />
          ) : menuOpen ? (
            <X className="w-6 h-6" />
          ) : (
            <Menu className="w-6 h-6" />
          )}
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold">
            Staff Dashboard
          </h1>
          <p className="text-sm text-gray-400">
            {currentPage === "home"
              ? "Your Events"
              : currentPage === "archived"
                ? "Archived Events"
                : currentPage === "waitlist"
                  ? waitlistSubPage === "settings"
                    ? "Table Settings"
                    : selectedEvent?.name ||
                      "Waitlist Management"
                  : selectedEvent?.name ||
                    "Capacity Management"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Profile"
          >
            <UserIcon className="w-6 h-6" />
          </button>
          <button
            onClick={onLogout}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-6 h-6" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <button
            onClick={() => {
              setCurrentPage("home");
              setMenuOpen(false);
            }}
            className={`w-full p-4 text-left hover:bg-gray-100 transition-colors ${
              currentPage === "home"
                ? "bg-blue-50 border-l-4 border-blue-600"
                : ""
            }`}
          >
            <div className="font-semibold">Dashboard</div>
          </button>
          <button
            onClick={() => {
              setCurrentPage("archived");
              setMenuOpen(false);
            }}
            className={`w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200 ${
              currentPage === "archived"
                ? "bg-blue-50 border-l-4 border-blue-600"
                : ""
            }`}
          >
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5" />
              <span className="font-semibold">
                Archived Events
              </span>
              {archivedEvents.length > 0 && (
                <span className="ml-auto bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded-full">
                  {archivedEvents.length}
                </span>
              )}
            </div>
          </button>
          <button
            onClick={() => {
              setShowProfile(true);
              setMenuOpen(false);
            }}
            className="w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <div className="font-semibold">Profile</div>
          </button>
          <button
            onClick={() => {
              setMenuOpen(false);
              onLogout();
            }}
            className="w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200 text-red-600"
          >
            <div className="font-semibold">Logout</div>
          </button>
        </div>
      )}

      {currentPage === "home" ? (
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">
                  Your Events
                </h2>
                <p className="text-gray-600">
                  Manage your active events
                </p>
              </div>
              {events.length > 0 && (
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Create Event
                </button>
              )}
            </div>

            {events.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No events yet
                </h3>
                <p className="text-gray-600 mb-6">
                  Create your first event to get started
                </p>
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Create Event
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {events.map((event) => {
                  const statusColor =
                    event.status === "active"
                      ? "bg-green-100 text-green-700"
                      : event.status === "paused"
                        ? "bg-amber-100 text-amber-700"
                        : "bg-gray-100 text-gray-700";

                  const typeColor =
                    event.type === "capacity-based"
                      ? "blue"
                      : event.type === "simple-capacity"
                        ? "green"
                        : "purple";
                  const TypeIcon =
                    event.type === "capacity-based"
                      ? Users
                      : Users;

                  const currentCount =
                    event.type === "capacity-based"
                      ? (() => {
                          const capacityEvent =
                            event as CapacityBasedEvent;
                          if (
                            capacityEvent.queueMode ===
                            "multiple"
                          ) {
                            // For multiple queues, count entries that match any queue in this event
                            const queueIds =
                              capacityEvent.queues?.map(
                                (q) => q.id,
                              ) || [];
                            return waitlist.filter(
                              (e) =>
                                e.queueId &&
                                queueIds.includes(e.queueId),
                            ).length;
                          } else {
                            // For single queue, count entries with matching eventId
                            return waitlist.filter(
                              (e) => e.eventId === event.id,
                            ).length;
                          }
                        })()
                      : event.type === "simple-capacity"
                        ? (event as SimpleCapacityEvent)
                            .currentCount
                        : event.currentFilledTables;

                  const maxCount =
                    event.type === "capacity-based"
                      ? (event as CapacityBasedEvent)
                          .queueMode === "multiple"
                        ? (
                            event as CapacityBasedEvent
                          ).queues?.reduce(
                            (sum, q) => sum + q.capacity,
                            0,
                          ) || 0
                        : event.capacity || 0
                      : event.type === "simple-capacity"
                        ? (event as SimpleCapacityEvent)
                            .capacity
                        : event.numberOfTables || 0;

                  return (
                    <div
                      key={event.id}
                      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all text-left border-2 border-transparent hover:border-${typeColor}-500 group relative`}
                    >
                      {/* Status + Privacy Badges - Top Right, visible on hover */}
                      <div className="absolute top-4 right-4 flex items-center gap-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColor}`}
                        >
                          {event.status
                            .charAt(0)
                            .toUpperCase() +
                            event.status.slice(1)}
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                            event.isPublic
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {event.isPublic ? (
                            <>
                              <Eye className="w-3 h-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Private
                            </>
                          )}
                        </span>
                      </div>

                      {/* Action Buttons - Bottom Right, visible on hover */}
                      <div className="absolute bottom-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            setShowQRCodeModal(true);
                          }}
                          className="p-2.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg shadow-sm"
                          title="View QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToEdit(event);
                            setShowEditEventModal(true);
                          }}
                          className="p-2.5 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg shadow-sm"
                          title="Edit event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(event);
                            setShowDeleteConfirmation(true);
                          }}
                          className="p-2.5 bg-orange-50 hover:bg-orange-100 text-orange-600 rounded-lg shadow-sm"
                          title="Archive event"
                        >
                          <Archive className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Event Card Content - Make it clickable */}
                      <div
                        onClick={() => {
                          setSelectedEvent(event);
                          if (event.type === "capacity-based") {
                            setCurrentPage("capacity");
                          } else if (
                            event.type === "simple-capacity"
                          ) {
                            setCurrentPage("simple-capacity");
                          } else {
                            setCurrentPage("waitlist");
                            setWaitlistSubPage("view");

                            // Load or initialize tables when selecting a table-based event
                            const tableEvent = event as any; // TableBasedEvent
                            const newTableCount =
                              tableEvent.numberOfTables || 12;

                            // Try to load existing tables for this event
                            const existingTables =
                              loadEventTables(event.id);

                            if (
                              existingTables &&
                              existingTables.length ===
                                newTableCount
                            ) {
                              // Use existing tables if they match the event configuration
                              setTables(existingTables);
                              setTotalTables(newTableCount);
                            } else {
                              // Generate new tables based on event configuration
                              const cols = 4;
                              const newTables: Table[] = [];
                              for (
                                let i = 0;
                                i < newTableCount;
                                i++
                              ) {
                                const row = Math.floor(
                                  i / cols,
                                );
                                const col = i % cols;
                                newTables.push({
                                  id: i + 1,
                                  row,
                                  col,
                                  name: `Table ${i + 1}`,
                                  capacity:
                                    tableEvent.averageTableSize ||
                                    4,
                                  occupied: false,
                                });
                              }

                              setTotalTables(newTableCount);
                              setTables(newTables);
                              saveEventTables(
                                event.id,
                                newTables,
                              );
                            }
                          }
                        }}
                        className="cursor-pointer px-7 py-8"
                      >
                        {/* Horizontal layout */}
                        <div className="flex items-center gap-6">
                          {/* Icon */}
                          <div
                            className={`w-16 h-16 bg-${typeColor}-100 rounded-xl flex items-center justify-center group-hover:bg-${typeColor}-500 transition-colors flex-shrink-0`}
                          >
                            <TypeIcon
                              className={`w-8 h-8 text-${typeColor}-600 group-hover:text-white transition-colors`}
                            />
                          </div>

                          {/* Event Info */}
                          <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold text-gray-800 mb-2 pr-70 whitespace-nowrap overflow-hidden text-ellipsis">
                              {event.name}
                            </h3>
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="text-sm text-gray-600">
                                {event.type === "capacity-based"
                                  ? "Capacity-Based"
                                  : event.type ===
                                      "simple-capacity"
                                    ? "Attendance Tracker"
                                    : "Table-Based"}
                              </span>
                            </div>
                          </div>

                          {/* Stats & Arrow */}
                          <div className="flex items-center gap-6">
                            <div className="text-right">
                              {event.type ===
                              "capacity-based" ? (
                                <div className="text-base font-semibold text-gray-800">
                                  {(event as CapacityBasedEvent)
                                    .queueMode === "single"
                                    ? "Single Queue"
                                    : "Multiple Queues"}
                                </div>
                              ) : (
                                <>
                                  <div className="text-2xl font-bold text-gray-800 whitespace-nowrap">
                                    {currentCount}{" "}
                                    <span className="text-sm font-normal text-gray-500">
                                      / {maxCount}
                                    </span>
                                  </div>
                                  <div className="text-xs text-gray-500">
                                    {event.type ===
                                    "table-based"
                                      ? "Tables Filled"
                                      : "Current Count"}
                                  </div>
                                </>
                              )}
                            </div>
                            <div className="text-3xl font-bold text-gray-300 group-hover:text-blue-500 transition-colors">
                              →
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : currentPage === "archived" ? (
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6 max-w-4xl mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-gray-800">
                Archived Events
              </h2>
              <p className="text-gray-600">
                View and restore your archived events
              </p>
            </div>

            {archivedEvents.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Archive className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">
                  No archived events
                </h3>
                <p className="text-gray-600">
                  Events you archive will appear here
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-5">
                {archivedEvents.map((event) => {
                  const typeColor =
                    event.type === "capacity-based"
                      ? "blue"
                      : event.type === "simple-capacity"
                        ? "green"
                        : "purple";
                  const TypeIcon = Users;

                  const currentCount =
                    event.type === "capacity-based"
                      ? (() => {
                          const capacityEvent =
                            event as CapacityBasedEvent;
                          if (
                            capacityEvent.queueMode ===
                            "multiple"
                          ) {
                            // For multiple queues, count entries that match any queue in this event
                            const queueIds =
                              capacityEvent.queues?.map(
                                (q) => q.id,
                              ) || [];
                            return waitlist.filter(
                              (e) =>
                                e.queueId &&
                                queueIds.includes(e.queueId),
                            ).length;
                          } else {
                            // For single queue, count entries with matching eventId
                            return waitlist.filter(
                              (e) => e.eventId === event.id,
                            ).length;
                          }
                        })()
                      : event.type === "simple-capacity"
                        ? (event as SimpleCapacityEvent)
                            .currentCount
                        : event.currentFilledTables;

                  const maxCount =
                    event.type === "capacity-based"
                      ? (event as CapacityBasedEvent)
                          .queueMode === "multiple"
                        ? (
                            event as CapacityBasedEvent
                          ).queues?.reduce(
                            (sum, q) => sum + q.capacity,
                            0,
                          ) || 0
                        : event.capacity || 0
                      : event.type === "simple-capacity"
                        ? (event as SimpleCapacityEvent)
                            .capacity
                        : event.numberOfTables || 0;

                  return (
                    <div
                      key={event.id}
                      className="bg-white rounded-xl shadow-md p-7 text-left border-2 border-gray-300 relative opacity-75 flex flex-col"
                    >
                      {/* Archived Badge + Privacy Badge - Top Right, horizontal */}
                      <div className="absolute top-4 right-4 z-10 flex items-center gap-2">
                        <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-orange-100 text-orange-700">
                          Archived
                        </span>
                        <span
                          className={`text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1 ${
                            event.isPublic
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {event.isPublic ? (
                            <>
                              <Eye className="w-3 h-3" />
                              Public
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3" />
                              Private
                            </>
                          )}
                        </span>
                      </div>

                      {/* Horizontal layout for content */}
                      <div className="flex items-center gap-6 mb-5">
                        <div
                          className={`w-16 h-16 bg-${typeColor}-100 rounded-xl flex items-center justify-center flex-shrink-0`}
                        >
                          <TypeIcon
                            className={`w-8 h-8 text-${typeColor}-600`}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <h3 className="text-xl font-bold text-gray-800 mb-1 truncate">
                            {event.name}
                          </h3>
                          <span className="text-sm text-gray-600">
                            {event.type === "capacity-based"
                              ? "Capacity-Based"
                              : event.type === "simple-capacity"
                                ? "Attendance Tracker"
                                : "Table-Based"}
                          </span>
                        </div>

                        <div className="flex items-center gap-6">
                          {event.archivedAt && (
                            <p className="text-xs text-gray-500 whitespace-nowrap">
                              Archived{" "}
                              {new Date(
                                event.archivedAt,
                              ).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Buttons at bottom */}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => {
                            restoreEvent(event.id);
                            toast.success(
                              `Event "${event.name}" restored successfully`,
                            );
                            const token = localStorage.getItem('authToken');
                            if (token) {
                              fetch(`${API_BASE}/events/${event.id}`, {
                                method: 'PATCH',
                                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ archived: false }),
                              }).catch(() => {/* silently ignore — localStorage already updated */});
                            }
                            setEvents(
                              getActiveEvents().filter(
                                (e) =>
                                  e.businessId ===
                                  user.businessId,
                              ),
                            );
                            setArchivedEvents(
                              getArchivedEvents().filter(
                                (e) =>
                                  e.businessId ===
                                  user.businessId,
                              ),
                            );
                          }}
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <ArchiveRestore className="w-4 h-4" />
                          Restore
                        </button>
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                `Permanently delete "${event.name}"? This cannot be undone.`,
                              )
                            ) {
                              deleteEvent(event.id);
                              toast.success(
                                `Event "${event.name}" permanently deleted`,
                              );
                              setArchivedEvents(
                                getArchivedEvents().filter(
                                  (e) =>
                                    e.businessId ===
                                    user.businessId,
                                ),
                              );
                            }
                          }}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : currentPage === "capacity" ? (
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            <button
              onClick={() => {
                setCurrentPage("home");
                setSelectedEvent(null);
              }}
              className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1"
            >
              ← Back to Your Events
            </button>
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Queue Lines</h2>
              {selectedEvent &&
                selectedEvent.type === "capacity-based" &&
                (selectedEvent as CapacityBasedEvent)
                  .queueMode === "multiple" && (
                  <button
                    onClick={() => {
                      setEditingAttraction(null);
                      setShowAttractionModal(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 active:scale-95 transition-transform"
                  >
                    <Plus className="w-4 h-4" />
                    Add Line
                  </button>
                )}
            </div>

            <div className="grid gap-4">
              {attractions.map((attraction) => {
                // Get live waitlist count
                const liveWaitlistCount = selectedEvent
                  ? waitlist
                      .filter((e) => {
                        // Filter by event ID
                        if (e.eventId !== selectedEvent.id)
                          return false;

                        // For multi-queue capacity events, also filter by queue ID
                        const isSingleQueue =
                          selectedEvent.type ===
                            "capacity-based" &&
                          (selectedEvent as CapacityBasedEvent)
                            .queueMode === "single";

                        if (
                          !isSingleQueue &&
                          attraction.id !==
                            "default-single-queue"
                        ) {
                          return e.queueId === attraction.id;
                        }

                        return true;
                      })
                      .reduce(
                        (sum, entry) => sum + entry.partySize,
                        0,
                      )
                  : 0;

                // Get manual offset from event data
                let manualOffset = 0;
                if (
                  selectedEvent &&
                  selectedEvent.type === "capacity-based"
                ) {
                  const capacityEvent =
                    selectedEvent as CapacityBasedEvent;
                  if (capacityEvent.queueMode === "single") {
                    manualOffset =
                      capacityEvent.manualOffset || 0;
                  } else {
                    // Multi-queue mode
                    const queue = capacityEvent.queues?.find(
                      (q) => q.id === attraction.id,
                    );
                    manualOffset = queue?.manualOffset || 0;
                  }
                }

                // Actual queue size = live count + manual offset
                const actualQueueSize =
                  liveWaitlistCount + manualOffset;

                const queuePercentage =
                  (actualQueueSize / attraction.queueCapacity) *
                  100;
                const getQueueColor = () => {
                  if (queuePercentage < 50)
                    return "bg-green-500";
                  if (queuePercentage < 80)
                    return "bg-amber-500";
                  return "bg-red-500";
                };

                // In auto mode, calculate wait time. In manual mode, use stored waitTime
                const displayWaitTime =
                  attraction.autoCalculateWait
                    ? calculateWaitTime(
                        actualQueueSize,
                        attraction.throughput,
                      )
                    : attraction.waitTime;

                const isSingleQueueEvent =
                  selectedEvent &&
                  selectedEvent.type === "capacity-based" &&
                  (selectedEvent as CapacityBasedEvent)
                    .queueMode === "single";

                return (
                  <div
                    key={attraction.id}
                    className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold">
                          {attraction.name}
                        </h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <span
                            className={`inline-block w-2 h-2 rounded-full ${
                              attraction.status === "open"
                                ? "bg-green-500"
                                : attraction.status ===
                                    "delayed"
                                  ? "bg-amber-500"
                                  : "bg-red-500"
                            }`}
                          />
                          {attraction.status
                            .charAt(0)
                            .toUpperCase() +
                            attraction.status.slice(1)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* QR Code button for multiple-queue events */}
                        {!isSingleQueueEvent && (
                          <button
                            onClick={() => {
                              setSelectedQueueId(attraction.id);
                              setSelectedQueueName(
                                attraction.name,
                              );
                              setShowQRCodeModal(true);
                            }}
                            className="p-2 bg-purple-50 hover:bg-purple-100 text-purple-600 rounded-lg transition-colors"
                            title="View Queue QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}
                        {!isSingleQueueEvent && (
                          <>
                            <button
                              onClick={() => {
                                setEditingAttraction(
                                  attraction,
                                );
                                setShowAttractionModal(true);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Delete ${attraction.name}?`,
                                  )
                                ) {
                                  setAttractions(
                                    attractions.filter(
                                      (a) =>
                                        a.id !== attraction.id,
                                    ),
                                  );
                                  toast.success(
                                    `${attraction.name} deleted`,
                                  );
                                  simulateSync();
                                }
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-red-600" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Clock className="w-3 h-3" />
                          Wait Time
                        </div>
                        {attraction.autoCalculateWait ? (
                          <div className="text-center py-1">
                            <span className="text-2xl font-bold">
                              {displayWaitTime}m
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              Auto-calculated
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                setAttractions(
                                  attractions.map((a) =>
                                    a.id === attraction.id
                                      ? {
                                          ...a,
                                          waitTime: Math.max(
                                            0,
                                            a.waitTime - 5,
                                          ),
                                        }
                                      : a,
                                  ),
                                );
                                simulateSync();
                              }}
                              className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-2xl font-bold">
                              {displayWaitTime}m
                            </span>
                            <button
                              onClick={() => {
                                setAttractions(
                                  attractions.map((a) =>
                                    a.id === attraction.id
                                      ? {
                                          ...a,
                                          waitTime:
                                            a.waitTime + 5,
                                        }
                                      : a,
                                  ),
                                );
                                simulateSync();
                              }}
                              className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Users className="w-3 h-3" />
                          Queue Size
                        </div>
                        {!attraction.autoCalculateWait ? (
                          <div className="flex items-center justify-between">
                            <button
                              onClick={() => {
                                if (
                                  !selectedEvent ||
                                  selectedEvent.type !==
                                    "capacity-based"
                                )
                                  return;

                                const capacityEvent =
                                  selectedEvent as CapacityBasedEvent;
                                const currentOffset =
                                  manualOffset;
                                const newOffset = Math.max(
                                  -liveWaitlistCount,
                                  currentOffset - 1,
                                );

                                // Update event data with new manual offset
                                if (
                                  capacityEvent.queueMode ===
                                  "single"
                                ) {
                                  updateEvent(
                                    selectedEvent.id,
                                    {
                                      manualOffset: newOffset,
                                    },
                                  );
                                } else {
                                  // Multi-queue mode - update specific queue
                                  const updatedQueues =
                                    capacityEvent.queues?.map(
                                      (q) =>
                                        q.id === attraction.id
                                          ? {
                                              ...q,
                                              manualOffset:
                                                newOffset,
                                            }
                                          : q,
                                    );
                                  updateEvent(
                                    selectedEvent.id,
                                    {
                                      queues: updatedQueues,
                                    },
                                  );
                                }

                                // Reload events to reflect changes
                                const updatedEvents =
                                  getActiveEvents();
                                const refreshedEvent =
                                  updatedEvents.find(
                                    (e) =>
                                      e.id === selectedEvent.id,
                                  );
                                if (refreshedEvent) {
                                  setSelectedEvent(
                                    refreshedEvent,
                                  );
                                }

                                simulateSync();
                              }}
                              className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="text-xl font-bold">
                              {actualQueueSize}/
                              {attraction.queueCapacity}
                            </span>
                            <button
                              onClick={() => {
                                if (
                                  !selectedEvent ||
                                  selectedEvent.type !==
                                    "capacity-based"
                                )
                                  return;

                                const capacityEvent =
                                  selectedEvent as CapacityBasedEvent;
                                const currentOffset =
                                  manualOffset;
                                const maxPossibleOffset =
                                  attraction.queueCapacity -
                                  liveWaitlistCount;
                                const newOffset = Math.min(
                                  maxPossibleOffset,
                                  currentOffset + 1,
                                );

                                // Update event data with new manual offset
                                if (
                                  capacityEvent.queueMode ===
                                  "single"
                                ) {
                                  updateEvent(
                                    selectedEvent.id,
                                    {
                                      manualOffset: newOffset,
                                    },
                                  );
                                } else {
                                  // Multi-queue mode - update specific queue
                                  const updatedQueues =
                                    capacityEvent.queues?.map(
                                      (q) =>
                                        q.id === attraction.id
                                          ? {
                                              ...q,
                                              manualOffset:
                                                newOffset,
                                            }
                                          : q,
                                    );
                                  updateEvent(
                                    selectedEvent.id,
                                    {
                                      queues: updatedQueues,
                                    },
                                  );
                                }

                                // Reload events to reflect changes
                                const updatedEvents =
                                  getActiveEvents();
                                const refreshedEvent =
                                  updatedEvents.find(
                                    (e) =>
                                      e.id === selectedEvent.id,
                                  );
                                if (refreshedEvent) {
                                  setSelectedEvent(
                                    refreshedEvent,
                                  );
                                }

                                simulateSync();
                              }}
                              className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="text-center">
                            <span className="text-xl font-bold">
                              {actualQueueSize}/
                              {attraction.queueCapacity}
                            </span>
                            <p className="text-xs text-gray-500 mt-1">
                              Updates as guests join
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Queue Capacity</span>
                        <span>
                          {Math.round(queuePercentage)}%
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getQueueColor()} transition-all duration-500`}
                          style={{
                            width: `${Math.min(queuePercentage, 100)}%`,
                          }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                      <span>
                        Throughput: {attraction.throughput}{" "}
                        ppl/hr
                      </span>
                      {attraction.autoCalculateWait ? (
                        <button
                          onClick={() => {
                            setAttractions(
                              attractions.map((a) =>
                                a.id === attraction.id
                                  ? {
                                      ...a,
                                      autoCalculateWait: false,
                                    }
                                  : a,
                              ),
                            );
                            toast.info("Manual mode enabled");
                          }}
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Switch to Manual
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAttractions(
                              attractions.map((a) =>
                                a.id === attraction.id
                                  ? {
                                      ...a,
                                      autoCalculateWait: true,
                                    }
                                  : a,
                              ),
                            );
                            toast.info("Auto mode enabled");
                          }}
                          className="text-green-600 hover:text-green-700 underline"
                        >
                          Switch to Auto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {attractions.length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p>No queue lines added yet.</p>
                <p className="text-sm">
                  Click "Add Line" to get started.
                </p>
              </div>
            )}
          </div>

          {showAttractionModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">
                  {editingAttraction
                    ? "Edit Line"
                    : "Add New Line"}
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(
                      e.currentTarget,
                    );
                    const queueSize = parseInt(
                      formData.get("queueSize") as string,
                    );
                    const throughput = parseInt(
                      formData.get("throughput") as string,
                    );
                    const autoCalculateWait =
                      formData.get("autoCalculateWait") ===
                      "on";

                    const newAttraction: Attraction = {
                      id:
                        editingAttraction?.id ||
                        Date.now().toString(),
                      name: formData.get("name") as string,
                      waitTime: autoCalculateWait
                        ? calculateWaitTime(
                            queueSize,
                            throughput,
                          )
                        : parseInt(
                            formData.get("waitTime") as string,
                          ),
                      queueSize,
                      queueCapacity: parseInt(
                        formData.get("queueCapacity") as string,
                      ),
                      throughput,
                      status: formData.get("status") as
                        | "open"
                        | "closed"
                        | "delayed",
                      autoCalculateWait,
                    };

                    if (editingAttraction) {
                      setAttractions(
                        attractions.map((a) =>
                          a.id === editingAttraction.id
                            ? newAttraction
                            : a,
                        ),
                      );
                      toast.success("Line updated");
                    } else {
                      setAttractions([
                        ...attractions,
                        newAttraction,
                      ]);
                      toast.success("Line added");
                    }
                    simulateSync();
                    setShowAttractionModal(false);
                    setEditingAttraction(null);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Line Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={
                        editingAttraction?.name || ""
                      }
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Main Entrance Queue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Wait Time (minutes)
                    </label>
                    <input
                      type="number"
                      name="waitTime"
                      defaultValue={
                        editingAttraction?.waitTime || 30
                      }
                      required
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Current Queue Size
                    </label>
                    <input
                      type="number"
                      name="queueSize"
                      defaultValue={
                        editingAttraction?.queueSize || 0
                      }
                      required
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Queue Capacity
                    </label>
                    <input
                      type="number"
                      name="queueCapacity"
                      defaultValue={
                        editingAttraction?.queueCapacity || 200
                      }
                      required
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Throughput (people/hour)
                    </label>
                    <input
                      type="number"
                      name="throughput"
                      defaultValue={
                        editingAttraction?.throughput || 240
                      }
                      required
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      How many people can be processed per hour
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      defaultValue={
                        editingAttraction?.status || "open"
                      }
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="open">Open</option>
                      <option value="delayed">Delayed</option>
                      <option value="closed">Closed</option>
                    </select>
                  </div>
                  <div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        name="autoCalculateWait"
                        defaultChecked={
                          editingAttraction?.autoCalculateWait ??
                          true
                        }
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">
                        Auto-calculate wait time from queue size
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">
                      When enabled, wait time updates
                      automatically based on queue size and
                      throughput
                    </p>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowAttractionModal(false);
                        setEditingAttraction(null);
                      }}
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
                    >
                      {editingAttraction
                        ? "Save Changes"
                        : "Add Line"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : currentPage === "simple-capacity" &&
        selectedEvent &&
        selectedEvent.type === "simple-capacity" ? (
        <div className="flex-1 overflow-auto flex flex-col p-6">
          <button
            onClick={() => {
              setCurrentPage("home");
              setSelectedEvent(null);
            }}
            className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 self-start"
          >
            ← Back to Your Events
          </button>
          <div className="flex-1 flex items-center justify-center">
            <SimpleCapacityTracker
              event={selectedEvent as SimpleCapacityEvent}
              onIncrement={() => {
                const simpleEvent =
                  selectedEvent as SimpleCapacityEvent;
                if (
                  simpleEvent.currentCount <
                  simpleEvent.capacity
                ) {
                  const updated: SimpleCapacityEvent = {
                    ...simpleEvent,
                    currentCount: simpleEvent.currentCount + 1,
                  };
                  updateEvent(simpleEvent.id, {
                    currentCount: updated.currentCount,
                  });
                  setSelectedEvent(updated);
                  setEvents(getStoredEvents());
                  toast.success("Count increased");
                  simulateSync();
                } else {
                  toast.error("At full capacity");
                }
              }}
              onDecrement={() => {
                const simpleEvent =
                  selectedEvent as SimpleCapacityEvent;
                if (simpleEvent.currentCount > 0) {
                  const updated: SimpleCapacityEvent = {
                    ...simpleEvent,
                    currentCount: simpleEvent.currentCount - 1,
                  };
                  updateEvent(simpleEvent.id, {
                    currentCount: updated.currentCount,
                  });
                  setSelectedEvent(updated);
                  setEvents(getStoredEvents());
                  toast.success("Count decreased");
                  simulateSync();
                }
              }}
              onIncrementBy10={() => {
                const simpleEvent =
                  selectedEvent as SimpleCapacityEvent;
                if (
                  simpleEvent.currentCount + 10 <=
                  simpleEvent.capacity
                ) {
                  const updated: SimpleCapacityEvent = {
                    ...simpleEvent,
                    currentCount: simpleEvent.currentCount + 10,
                  };
                  updateEvent(simpleEvent.id, {
                    currentCount: updated.currentCount,
                  });
                  setSelectedEvent(updated);
                  setEvents(getStoredEvents());
                  toast.success("Added 10 people");
                  simulateSync();
                } else {
                  toast.error(
                    "Not enough capacity for 10 more people",
                  );
                }
              }}
              onDecrementBy10={() => {
                const simpleEvent =
                  selectedEvent as SimpleCapacityEvent;
                if (simpleEvent.currentCount >= 10) {
                  const updated: SimpleCapacityEvent = {
                    ...simpleEvent,
                    currentCount: simpleEvent.currentCount - 10,
                  };
                  updateEvent(simpleEvent.id, {
                    currentCount: updated.currentCount,
                  });
                  setSelectedEvent(updated);
                  setEvents(getStoredEvents());
                  toast.success("Removed 10 people");
                  simulateSync();
                } else {
                  toast.error("Cannot remove 10 people");
                }
              }}
            />
          </div>
        </div>
      ) : waitlistSubPage === "settings" ? (
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-2xl mx-auto">
            <button
              onClick={() => {
                setCurrentPage("home");
                setSelectedEvent(null);
              }}
              className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1"
            >
              ← Back to Your Events
            </button>
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-6">
                Table Configuration
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Tables
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() =>
                        handleUpdateTableCount(totalTables - 1)
                      }
                      className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow active:scale-95 transition-transform"
                      disabled={totalTables <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>

                    <div className="flex-1 text-center">
                      <div className="text-4xl font-bold text-gray-900">
                        {totalTables}
                      </div>
                      <div className="text-sm text-gray-500 mt-1">
                        {totalTables === 1 ? "table" : "tables"}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        handleUpdateTableCount(totalTables + 1)
                      }
                      className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow active:scale-95 transition-transform"
                      disabled={totalTables >= 24}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Tables are arranged in a 4-column grid. Min:
                    1, Max: 24
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">
                    Quick Presets
                  </h3>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      onClick={() => handleUpdateTableCount(6)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium active:scale-95 transition-transform"
                    >
                      6 Tables
                    </button>
                    <button
                      onClick={() => handleUpdateTableCount(12)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium active:scale-95 transition-transform"
                    >
                      12 Tables
                    </button>
                    <button
                      onClick={() => handleUpdateTableCount(20)}
                      className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium active:scale-95 transition-transform"
                    >
                      20 Tables
                    </button>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-200 bg-blue-50 p-4 rounded-lg">
                  <h3 className="text-sm font-medium text-blue-900 mb-2">
                    Note
                  </h3>
                  <p className="text-xs text-blue-800">
                    Changing the table count will preserve
                    occupied tables and their guest information.
                    New tables will be created with default
                    capacity of 4 seats.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            <button
              onClick={() => {
                setCurrentPage("home");
                setSelectedEvent(null);
              }}
              className="text-blue-600 hover:text-blue-700 text-sm mb-2 flex items-center gap-1"
            >
              ← Back to Your Events
            </button>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                Table Management
              </h2>
              <button
                onClick={handleClearAllTables}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow"
              >
                <X className="w-4 h-4" />
                Clear All Tables
              </button>
            </div>

            <TableGrid
              tables={tables}
              onClearTable={handleClearTable}
              onRenameTable={handleRenameTable}
              onUpdateCapacity={handleUpdateCapacity}
              onManualOccupy={handleManualOccupy}
            />

            <div className="flex gap-3 mb-4">
              <button
                onClick={() => setListView("reservation")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  listView === "reservation"
                    ? "bg-black text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Reservation List (
                {
                  waitlist.filter(
                    (e) =>
                      e.type === "reservation" &&
                      e.eventId === selectedEvent?.id,
                  ).length
                }
                )
              </button>
              <button
                onClick={() => setListView("waitlist")}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  listView === "waitlist"
                    ? "bg-black text-white shadow-lg"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Live Waitlist (
                {
                  waitlist.filter(
                    (e) =>
                      e.type === "waitlist" &&
                      e.eventId === selectedEvent?.id,
                  ).length
                }
                )
              </button>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {listView === "reservation"
                  ? "Reservation List"
                  : "Live Waitlist"}{" "}
                (
                {
                  waitlist.filter(
                    (e) =>
                      e.type === listView &&
                      e.eventId === selectedEvent?.id,
                  ).length
                }
                )
              </h2>
              {listView === "reservation" &&
                waitlist.filter(
                  (e) =>
                    e.type === "reservation" &&
                    e.eventId === selectedEvent?.id,
                ).length > 0 && (
                  <button
                    onClick={handleSeatAll}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow"
                  >
                    <ArrowUp className="w-4 h-4" />
                    Seat All
                  </button>
                )}
            </div>

            {waitlist.filter(
              (e) =>
                e.type === listView &&
                e.eventId === selectedEvent?.id,
            ).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>
                  {listView === "reservation"
                    ? "No reservations"
                    : "No guests on the waitlist"}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitlist
                  .filter(
                    (e) =>
                      e.type === listView &&
                      e.eventId === selectedEvent?.id,
                  )
                  .sort((a, b) => {
                    // Sort reservations by reservation time (chronological)
                    if (
                      listView === "reservation" &&
                      a.reservationTime &&
                      b.reservationTime
                    ) {
                      return (
                        a.reservationTime.getTime() -
                        b.reservationTime.getTime()
                      );
                    }
                    // For waitlist, keep original order (FIFO)
                    return 0;
                  })
                  .map((entry, index) => (
                    <div
                      key={entry.id}
                      className="bg-white border-2 border-black p-4 rounded-lg shadow-sm"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-bold text-black">
                              #{index + 1}
                            </span>
                            <span className="text-lg font-semibold">
                              {entry.name}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-gray-600">
                            Party of {entry.partySize} • Est.
                            wait:{" "}
                            {formatWaitTime(
                              entry.estimatedWait,
                            )}
                          </div>
                          {entry.type === "reservation" &&
                            entry.reservationTime && (
                              <div className="mt-2 inline-flex items-center gap-2 bg-green-100 border border-green-300 rounded-lg px-3 py-1">
                                <Clock className="w-4 h-4 text-green-700" />
                                <span className="text-sm font-bold text-green-700">
                                  {entry.reservationTime.toLocaleDateString(
                                    [],
                                    {
                                      month: "short",
                                      day: "numeric",
                                    },
                                  )}{" "}
                                  at{" "}
                                  {entry.reservationTime.toLocaleTimeString(
                                    [],
                                    {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    },
                                  )}
                                </span>
                              </div>
                            )}
                          {entry.specialRequests &&
                            (() => {
                              const requestLower =
                                entry.specialRequests.toLowerCase();
                              const tableMatch =
                                requestLower.match(
                                  /table\s*#?\s*(\d+)/,
                                );
                              const withGuestMatch =
                                requestLower.match(
                                  /(?:with|join|same\s+table\s+as)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/,
                                );
                              const nearGuestMatch =
                                requestLower.match(
                                  /(?:near|close\s+to|next\s+to)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/,
                                );
                              const hasPreference =
                                /window|quiet|corner/.test(
                                  requestLower,
                                );

                              return (
                                <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-full">
                                  <div className="flex items-center gap-2 mb-1">
                                    <div className="text-xs font-semibold text-blue-900">
                                      Special Request:
                                    </div>
                                    {(tableMatch ||
                                      withGuestMatch ||
                                      nearGuestMatch ||
                                      hasPreference) && (
                                      <span className="text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                                        Action Required
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-sm text-blue-800 break-words overflow-hidden whitespace-pre-wrap">
                                    {entry.specialRequests}
                                  </div>
                                  {tableMatch && (
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                      <div className="text-xs text-blue-700 font-medium">
                                        💺 Requesting Table #
                                        {tableMatch[1]}
                                      </div>
                                    </div>
                                  )}
                                  {withGuestMatch &&
                                    !nearGuestMatch && (
                                      <div className="mt-2 pt-2 border-t border-blue-200">
                                        <div className="text-xs text-blue-700 font-medium">
                                          👥 Wants to join:{" "}
                                          {withGuestMatch[1]}
                                        </div>
                                      </div>
                                    )}
                                  {nearGuestMatch && (
                                    <div className="mt-2 pt-2 border-t border-blue-200">
                                      <div className="text-xs text-blue-700 font-medium">
                                        📍 Wants to sit near:{" "}
                                        {nearGuestMatch[1]}
                                      </div>
                                    </div>
                                  )}
                                  {hasPreference &&
                                    !tableMatch &&
                                    !withGuestMatch &&
                                    !nearGuestMatch && (
                                      <div className="mt-2 pt-2 border-t border-blue-200">
                                        <div className="text-xs text-blue-700 font-medium">
                                          ⭐ Seating preference
                                          noted
                                        </div>
                                      </div>
                                    )}
                                </div>
                              );
                            })()}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handlePromote(entry.id)
                          }
                          className="flex-1 bg-green-600 hover:bg-green-700 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <ArrowUp className="w-5 h-5" />
                          Seat Guest
                        </button>
                        <button
                          onClick={() => handleNoShow(entry.id)}
                          className="flex-1 bg-red-600 hover:bg-red-700 text-white py-3 px-4 rounded-lg font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                        >
                          <UserX className="w-5 h-5" />
                          No-show
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Event Modal */}
      {showCreateEventModal && (
        <CreateEventModal
          businessId={getStoredUser()?.businessId || "default"}
          onClose={() => setShowCreateEventModal(false)}
          onCreateEvent={(event) => {
            addEvent(event);
            syncEventToSupabase(event);
            setEvents(
              getActiveEvents().filter(
                (e) => e.businessId === user.businessId,
              ),
            );
            setArchivedEvents(
              getArchivedEvents().filter(
                (e) => e.businessId === user.businessId,
              ),
            );

            // Initialize tables for table-based events
            if (event.type === "table-based") {
              const tableEvent = event as any; // TableBasedEvent
              const newTableCount =
                tableEvent.numberOfTables || 12;

              // Generate new tables based on event configuration
              const cols = 4;
              const newTables: Table[] = [];
              for (let i = 0; i < newTableCount; i++) {
                const row = Math.floor(i / cols);
                const col = i % cols;
                newTables.push({
                  id: i + 1,
                  row,
                  col,
                  name: `Table ${i + 1}`,
                  capacity: tableEvent.averageTableSize || 4,
                  occupied: false,
                });
              }

              setTotalTables(newTableCount);
              setTables(newTables);
              saveEventTables(event.id, newTables);
              toast.success(
                `Initialized ${newTableCount} tables for ${event.name}`,
              );
            }
          }}
        />
      )}

      {/* Edit Event Modal */}
      {showEditEventModal && eventToEdit && (
        <CreateEventModal
          businessId={getStoredUser()?.businessId || "default"}
          onClose={() => {
            setShowEditEventModal(false);
            setEventToEdit(null);
          }}
          onCreateEvent={(event) => {
            // Update event in storage
            updateEventFull(event);

            // Refresh events list
            const updatedActiveEvents =
              getActiveEvents().filter(
                (e) => e.businessId === user.businessId,
              );
            setEvents(updatedActiveEvents);
            setArchivedEvents(
              getArchivedEvents().filter(
                (e) => e.businessId === user.businessId,
              ),
            );

            // If this is the currently selected event, update it
            if (
              selectedEvent &&
              selectedEvent.id === event.id
            ) {
              setSelectedEvent(event);

              // Re-sync attractions for capacity-based events
              if (event.type === "capacity-based") {
                const capacityEvent =
                  event as CapacityBasedEvent;
                if (
                  capacityEvent.queueMode === "multiple" &&
                  capacityEvent.queues
                ) {
                  setAttractions(
                    capacityEvent.queues.map((queue) => ({
                      id: queue.id,
                      name: queue.name,
                      waitTime: 0,
                      queueSize: queue.currentCount || 0,
                      queueCapacity: queue.capacity,
                      throughput: 60,
                      status: "open",
                      autoCalculateWait: true,
                    })),
                  );
                } else {
                  // Single queue mode
                  setAttractions([
                    {
                      id: "default-single-queue",
                      name: capacityEvent.name,
                      waitTime: 0,
                      queueSize:
                        capacityEvent.currentCount || 0,
                      queueCapacity: capacityEvent.capacity,
                      throughput: 60,
                      status: "open",
                      autoCalculateWait: true,
                    },
                  ]);
                }
              }

              // Handle table-based events - resize tables if numberOfTables changed
              if (event.type === "table-based") {
                const tableEvent = event as any;
                const newTableCount =
                  tableEvent.numberOfTables || 12;

                if (newTableCount !== totalTables) {
                  // Load existing tables or create new ones
                  const existingTables = loadEventTables(
                    event.id,
                  );
                  const cols = 4;
                  let updatedTables: Table[] = [];

                  if (
                    existingTables &&
                    existingTables.length > 0
                  ) {
                    // Resize existing tables array
                    if (newTableCount > existingTables.length) {
                      // Add more tables
                      updatedTables = [...existingTables];
                      for (
                        let i = existingTables.length;
                        i < newTableCount;
                        i++
                      ) {
                        const row = Math.floor(i / cols);
                        const col = i % cols;
                        updatedTables.push({
                          id: i + 1,
                          row,
                          col,
                          status: "available",
                          partySize: 0,
                          guestName: "",
                        });
                      }
                    } else {
                      // Remove excess tables
                      updatedTables = existingTables.slice(
                        0,
                        newTableCount,
                      );
                    }
                  } else {
                    // Create new tables
                    for (let i = 0; i < newTableCount; i++) {
                      const row = Math.floor(i / cols);
                      const col = i % cols;
                      updatedTables.push({
                        id: i + 1,
                        row,
                        col,
                        status: "available",
                        partySize: 0,
                        guestName: "",
                      });
                    }
                  }

                  setTotalTables(newTableCount);
                  setTables(updatedTables);
                  saveEventTables(event.id, updatedTables);
                }
              }
            }

            setShowEditEventModal(false);
            setEventToEdit(null);
            toast.success("Event updated successfully");
          }}
          editEvent={eventToEdit}
        />
      )}

      {/* Profile Modal */}
      {showProfile && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}

      {/* Archive Confirmation Modal */}
      {showDeleteConfirmation && eventToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            {/* Archive Icon */}
            <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Archive className="w-8 h-8 text-orange-600" />
            </div>

            <h3 className="text-2xl font-bold text-center mb-2">
              Archive Event?
            </h3>

            <p className="text-center text-gray-600 mb-4">
              You're about to archive the{" "}
              <span className="font-semibold text-gray-900">
                "{eventToDelete.name}"
              </span>{" "}
              event
            </p>

            {/* Info Card */}
            <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">
                    i
                  </span>
                </div>
                <div>
                  <h4 className="font-semibold text-blue-900 mb-1">
                    Event will be archived
                  </h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>
                      • Event will be moved to archived events
                    </li>
                    <li>• Data will be preserved</li>
                    <li>• You can restore it anytime</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteConfirmation(false);
                  setEventToDelete(null);
                }}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl hover:bg-gray-50 font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (eventToDelete) {
                    archiveEvent(eventToDelete.id);
                    toast.success(
                      `Event "${eventToDelete.name}" archived successfully`,
                    );
                    const token = localStorage.getItem('authToken');
                    if (token) {
                      fetch(`${API_BASE}/events/${eventToDelete.id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                      }).catch(() => {/* silently ignore — localStorage already updated */});
                    }
                    // Refresh events
                    setEvents(
                      getActiveEvents().filter(
                        (e) => e.businessId === user.businessId,
                      ),
                    );
                    setArchivedEvents(
                      getArchivedEvents().filter(
                        (e) => e.businessId === user.businessId,
                      ),
                    );
                  }
                  setShowDeleteConfirmation(false);
                  setEventToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl font-semibold active:scale-95 transition-transform shadow-lg"
              >
                Archive Event
              </button>
            </div>
          </div>
        </div>
      )}

      {/* QR Code Modal */}
      {showQRCodeModal && selectedEvent && (
        <QRCodeModal
          event={selectedEvent}
          onClose={() => {
            setShowQRCodeModal(false);
            setSelectedQueueId(undefined);
            setSelectedQueueName(undefined);
          }}
          queueId={selectedQueueId}
          queueName={selectedQueueName}
        />
      )}
    </div>
  );
}
