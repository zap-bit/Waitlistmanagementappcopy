import { useState, useEffect } from "react";
import { StatusBar } from "./StatusBar";
import { QRScanner } from "./QRScanner";
import {
  QrCode, Clock, Users, LogOut, X, Calendar, ListOrdered, Search, Ticket, User as UserIcon, Menu, AlertCircle
} from "lucide-react";
import { toast } from "sonner";
import { WaitlistEntry } from "../App";
import { getStoredEvents, Event, CapacityBasedEvent, TableBasedEvent, Queue } from "../utils/events";
import { Profile, getSavedProfile } from "./Profile";
import { User } from "../utils/auth";
import { calculateDynamicWaitTime, fetchPredictedWait} from "../utils/waitTime";
import { Table } from "./TableGrid";
interface AttendeeViewProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  addToWaitlist: (
    name: string, partySize: number, specialRequests?: string, type?: "reservation" | "waitlist",
    eventId?: string, queueId?: string, reservationTime?: Date, onIdResolved?: (localId: string, remoteId: string) => void
  ) => string;
  removeFromWaitlist: (id: string) => void;
  updateWaitlistEntry: (id: string, updates: Partial<Omit<WaitlistEntry, "id" | "joinedAt">>) => void;
  allWaitlistEntries: WaitlistEntry[];
  tables: Table[];
  user: User;
}

export function AttendeeView({
  onLogout, waitlist, addToWaitlist, removeFromWaitlist, updateWaitlistEntry, allWaitlistEntries, tables, user,
}: AttendeeViewProps) {

  // Strictly mirror server state for active waitlists
  const [myWaitlistIds, setMyWaitlistIds] = useState<string[]>([]);
  useEffect(() => {
    setMyWaitlistIds(allWaitlistEntries.map(e => e.id));
  }, [allWaitlistEntries]);

  const [selectedWaitlistId, setSelectedWaitlistId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showAddAnotherForm, setShowAddAnotherForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMyEvents, setShowMyEvents] = useState(false);
  const [backendWaitMap, setBackendWaitMap] = useState<Record<string, number>>({});

  // RESTORED: Info about a table the user is currently seated at
  interface SeatedTableInfo {
    tableNumber: number;
    tableName: string;
    eventId: string;
    eventName: string;
    seatedAt: Date;
  }
  const [seatedTableInfo, setSeatedTableInfo] = useState<SeatedTableInfo | null>(null);

  interface PastEvent {
    id: string;
    eventName: string;
    eventId: string;
    name: string;
    partySize: number;
    type: "reservation" | "waitlist";
    seatedAt: Date;
  }
  const [pastEvents, setPastEvents] = useState<PastEvent[]>([]);

  useEffect(() => {
    const savedProfile = getSavedProfile(user.id);
    if (savedProfile) {
      setGuestName(savedProfile.displayName || "");
      setPartySize(savedProfile.defaultPartySize || 2);
      setSpecialRequests(savedProfile.preferences || "");
    } else {
      setGuestName(user.name || "");
      setPartySize(2);
      setSpecialRequests("");
    }
  }, [user.id, user.name, showProfile]);

  const [joinType, setJoinType] = useState<"choice" | "event-selection" | "reservation" | "waitlist" | "queue-selection">("choice");
  const [viewingStatus, setViewingStatus] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("attendeeIsOnline");
      if (saved) return JSON.parse(saved);
    }
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load active events
  useEffect(() => {
    let serverEvents: Event[] = [];
    const loadEvents = () => {
      // If we are currently syncing an update, 
      // don't let the background poll overwrite our local state.
      if (isSyncing) return;
      const localEvents = getStoredEvents().filter(e => e.status === "active" && e.type !== "simple-capacity");
      const localIds = new Set(localEvents.map(e => e.id));
      const merged = [...localEvents, ...serverEvents.filter(e => !localIds.has(e.id))];
      setAvailableEvents(merged);
      if (selectedEvent) {
        const updatedEvent = merged.find(e => e.id === selectedEvent.id);
        if (updatedEvent) setSelectedEvent(updatedEvent);
      }
    };

    loadEvents();
    const interval = setInterval(loadEvents, 2000);

    const token = localStorage.getItem('authToken');
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1'}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(({ data }) => {
          if (!data?.length) return;
          const mapped = data.map((e: any) => ({
            id: e.uuid as string,
            businessId: e.account_uuid as string,
            name: e.name as string,
            type: e.event_type === 'TABLE' ? 'table-based' : 'capacity-based',
            status: 'active',
            createdAt: new Date(e.created_at as string || Date.now()),
            archived: e.archived,
            isPublic: (e.public as boolean) ?? true,
            eventCode: (e.event_code as string) || '',
            queueMode: e.cap_type === 'MULTI' ? 'multiple' : 'single',
            capacity: (e.queue_capacity as number) || 100,
            estimatedWaitPerPerson: (e.est_wait as number) || 5,
            location: (e.location as string) || '',
            currentCount: (e.current_count as number) || 0,
            queues: Array.isArray(e.event_queues) ? e.event_queues.map((q: any) => ({
              id: q.uuid as string, name: q.name as string, capacity: (q.capacity as number) || 0,
              currentCount: (q.current_count as number) || 0, manualOffset: (q.manual_offset as number) || 0,
            })) : [],
            numberOfTables: (e.num_tables as number) || 10,
            averageTableSize: (e.avg_size as number) || 4,
            reservationDuration: (e.reservation_duration as number) || 90,
            noShowPolicy: (e.no_show_policy as string) || "Hold table for 15 minutes", // MAP NO-SHOW POLICY
          }));
          serverEvents = mapped.filter((e: any) =>
            !e.archived && e.type !== "simple-capacity"
          );
          loadEvents();
        }).catch(e => console.error('Failed to load events:', e));
    }
    return () => clearInterval(interval);
  }, [selectedEvent?.id]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("attendeeIsOnline", JSON.stringify(isOnline));
    }
  }, [isOnline]);

  // RESTORED: Poll backend for currently seated tables
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token || availableEvents.length === 0) return;

    const checkSeated = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';
        const res = await fetch(`${apiBase}/auth/me/seated`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const { data } = await res.json();

        if (Array.isArray(data) && data.length > 0) {
          const first = data[0];
          setSeatedTableInfo({
            tableNumber: first.tableNumber,
            tableName: first.tableName,
            eventId: first.eventId,
            eventName: first.eventName,
            seatedAt: new Date(first.seatedAt || Date.now()),
          });
        } else {
          setSeatedTableInfo(null);
        }
      } catch (e) {
        console.error('Failed to fetch seated status:', e);
      }
    };

    checkSeated();
    const interval = setInterval(checkSeated, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, [availableEvents]);

  // Poll backend history for seating records
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    const checkHistory = async () => {
      try {
        const apiBase = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1';
        const res = await fetch(`${apiBase}/auth/me/history`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const { data } = await res.json();

        if (Array.isArray(data)) {
          const notified = JSON.parse(localStorage.getItem('notifiedHistory') || '[]');
          let newNotifications = false;
          const historyEvents: PastEvent[] = [];

          data.forEach((entry: any) => {
            const uniqueKey = entry.uuid || `${entry.event_uuid}-${entry.created_at}`;
            // Backend now resolves the event name directly — no availableEvents lookup needed
            const eventName = entry.event_name || "Past Event";

            if (!notified.includes(uniqueKey)) {
              toast.success(`You've been seated at ${eventName}!`, { duration: 8000 });
              notified.push(uniqueKey);
              newNotifications = true;
            }

            historyEvents.push({
              id: uniqueKey,
              eventName: eventName,
              eventId: entry.event_uuid,
              name: user.name || "You",
              partySize: 1,
              type: "waitlist",
              seatedAt: new Date(entry.created_at),
            });
          });

          if (newNotifications) {
            localStorage.setItem('notifiedHistory', JSON.stringify(notified));
            setViewingStatus(false);
            setSelectedWaitlistId(null);
          }

          setPastEvents(historyEvents);
        }
      } catch (e) {
        console.error('Failed to fetch history:', e);
      }
    };

    checkHistory();
    const interval = setInterval(checkHistory, 5000);
    return () => clearInterval(interval);
  }, [user.name]);

  // Drop view if entry is removed actively
  useEffect(() => {
    if (selectedWaitlistId && !allWaitlistEntries.find(e => e.id === selectedWaitlistId)) {
      setViewingStatus(false);
      setSelectedWaitlistId(null);
    }
  }, [allWaitlistEntries, selectedWaitlistId]);

  const myEntry = allWaitlistEntries.find(e => e.id === selectedWaitlistId);
  const isOnWaitlist = !!myEntry;

  const sameTypeAndEventEntries = myEntry ? allWaitlistEntries.filter(e => e.type === myEntry.type && e.eventId === myEntry.eventId) : [];
  const position = myEntry?.position ?? (myEntry ? sameTypeAndEventEntries.findIndex(e => e.id === selectedWaitlistId) + 1 : 0);

  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState(0);
  const [queueSizeMap, setQueueSizeMap] = useState<Record<string, number>>({});

  useEffect(() => {
    const eventId = myEntry?.eventId;

    if (!eventId || !myEntry) return;

    const backendWait = backendWaitMap[eventId];
    const queueSize = queueSizeMap[eventId];

    if (backendWait == null || queueSize == null) return;

    const backendResponse =
      backendWait != null && queueSize != null
        ? { estimatedWait: backendWait, queueSize }
        : null;

    const result = calculateDynamicWaitTime(myEntry, backendResponse);

    setEstimatedWaitMinutes(result);
  }, [myEntry, backendWaitMap, queueSizeMap]);

useEffect(() => {
  const eventId = myEntry?.eventId;

  if (!eventId || !myEntry) return;

  const run = async () => {
    const res = await fetchPredictedWait(eventId);

    if (res === null) return;

    const { estimatedWait, queueSize } = res;

    setBackendWaitMap(prev => ({
      ...prev,
      [eventId]: estimatedWait,
    }));

    setQueueSizeMap(prev => ({
      ...prev,
      [eventId]: queueSize,
    }));
  };

  run();

  const interval = setInterval(run, 30000);
  return () => clearInterval(interval);
}, [myEntry?.eventId]);

  const getQueueStats = () => {
    if (!selectedEvent) return { current: 0, max: 0 };

    let current = 0;
    let max = 0;

    if (selectedEvent.type === "capacity-based") {
      const capacityEvent = selectedEvent as CapacityBasedEvent;
      if (capacityEvent.queueMode === "single") {
        max = capacityEvent.capacity || 0;
        current = allWaitlistEntries
          .filter((e) => e.eventId === selectedEvent.id)
          .reduce((sum, e) => sum + e.partySize, 0) + (capacityEvent.manualOffset || 0);
      } else if (selectedQueue) {
        max = selectedQueue.capacity;
        current = allWaitlistEntries
          .filter((e) => e.eventId === selectedEvent.id && e.queueId === selectedQueue.id)
          .reduce((sum, e) => sum + e.partySize, 0) + (selectedQueue.manualOffset || 0);
      }
    } else if (selectedEvent.type === "table-based") {
      // For table events, show filled tables vs total tables
      max = selectedEvent.numberOfTables || 0;
      current = tables.filter(t => t.occupied).length;
    }

    return { current, max };
  };

  const stats = getQueueStats();

  const allTablesOccupied = tables.every((table) => table.occupied);

  const myEventName = myEntry?.eventId ? availableEvents.find((e) => e.id === myEntry.eventId)?.name || "Event" : "Event";
  const myEvent = myEntry?.eventId ? availableEvents.find((e) => e.id === myEntry.eventId) : null;
  const isTableBasedReservation = myEntry?.type === "reservation" && myEvent?.type === "table-based";

  const myQueueName = myEntry?.queueId ? (() => {
    const event = availableEvents.find((e) => e.id === myEntry.eventId);
    if (event && event.type === "capacity-based") {
      const capacityEvent = event as CapacityBasedEvent;
      const queue = capacityEvent.queues?.find((q) => q.id === myEntry.queueId);
      return queue?.name;
    }
    return undefined;
  })() : undefined;

  const displayName = myQueueName ? `${myQueueName} - ${myEventName}` : myEventName;

  const handleFindEvent = () => {
    if (!eventCode.trim()) {
      toast.error("Please enter an event code or name");
      return;
    }

    const event = availableEvents.find(
      (e) => (e as any).eventCode?.toLowerCase() === eventCode.toLowerCase() || (e as any).code?.toLowerCase() === eventCode.toLowerCase() || e.name.toLowerCase().includes(eventCode.toLowerCase())
    );

    if (event) {
      setSelectedEvent(event);
      toast.success(`Selected: ${event.name}`);
      if (event.type === "table-based") {
        setJoinType("choice");
      } else {
        const capacityEvent = event as CapacityBasedEvent;
        if (capacityEvent.queueMode === "multiple" && capacityEvent.queues && capacityEvent.queues.length > 0) {
          setJoinType("queue-selection");
        } else {
          setJoinType("waitlist");
        }
      }
    } else {
      toast.error("Event not found. Please check the code and try again.");
    }
  };

  const handleScanSuccess = (data: string) => {
    setShowScanner(false);
    try {
      const parsed = JSON.parse(data);
      if (parsed.type === "waitlist-event" && parsed.eventId) {
        const event = availableEvents.find(e => e.id === parsed.eventId || (e as any).eventCode === parsed.eventCode || (e as any).code === parsed.eventCode);
        if (event) {
          setSelectedEvent(event);
          setEventCode(parsed.eventCode || (event as any).eventCode || (event as any).code || "");

          if (parsed.queueId && parsed.queueName) {
            const capacityEvent = event as CapacityBasedEvent;
            const queue = capacityEvent.queues?.find((q) => q.id === parsed.queueId);
            if (queue) {
              setSelectedQueue(queue);
              toast.success(`Found: ${parsed.queueName} - ${event.name}`);
              setJoinType("waitlist");
            } else {
              toast.error("Queue not found.");
              setJoinType("event-selection");
            }
          } else {
            toast.success(`Found event: ${event.name}`);
            if (event.type === "table-based") {
              setJoinType("choice");
            } else {
              const capacityEvent = event as CapacityBasedEvent;
              if (capacityEvent.queueMode === "multiple" && capacityEvent.queues && capacityEvent.queues.length > 0) {
                setJoinType("queue-selection");
              } else {
                setJoinType("waitlist");
              }
            }
          }
        } else {
          toast.error("Event not found. Please try again.");
          setJoinType("event-selection");
        }
      } else {
        throw new Error("Invalid QR code format");
      }
    } catch (e) {
      const event = availableEvents.find((e) => (e as any).eventCode === data || (e as any).code === data || e.id === data);
      if (event) {
        setSelectedEvent(event);
        setEventCode(data);
        toast.success(`Found event: ${event.name}`);
        if (event.type === "table-based") {
          setJoinType("choice");
        } else {
          const capacityEvent = event as CapacityBasedEvent;
          if (capacityEvent.queueMode === "multiple" && capacityEvent.queues && capacityEvent.queues.length > 0) {
            setJoinType("queue-selection");
          } else {
            setJoinType("waitlist");
          }
        }
      } else {
        toast.error("Invalid QR code. Event not found.");
        setJoinType("event-selection");
      }
    }
  };

  const handleJoinManually = () => {
    if (!guestName.trim()) {
      toast.error("Please enter your name");
      return;
    }
    if (!selectedEvent) {
      toast.error("No event selected");
      return;
    }

    // REQUIRED FIELDS VALIDATION: Prevent empty date or time
    if (joinType === "reservation" && (!reservationDate || !reservationTime)) {
      toast.error("Please select both a date and time for your reservation.");
      return;
    }

    if (selectedEvent.type === "capacity-based" && joinType === "waitlist") {
      const capacityEvent = selectedEvent as CapacityBasedEvent;
      let queueCapacity = 0;
      let currentQueueSize = 0;

      if (capacityEvent.queueMode === "single") {
        queueCapacity = capacityEvent.capacity || 0;
        currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === selectedEvent.id).reduce((sum, e) => sum + e.partySize, 0);
        currentQueueSize += (capacityEvent.manualOffset || 0);
      } else if (selectedQueue) {
        queueCapacity = selectedQueue.capacity;
        currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === selectedEvent.id && e.queueId === selectedQueue.id).reduce((sum, e) => sum + e.partySize, 0);
        currentQueueSize += (selectedQueue.manualOffset || 0);
      }

      const spotsLeft = queueCapacity - currentQueueSize;

      if (partySize > spotsLeft) {
        if (spotsLeft === 0) {
          toast.error("This queue is full. Please try another queue or event.");
        } else {
          toast.error(`Party size too large. Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left in this queue.`);
        }
        return;
      }
    }

    let reservationDateTime: Date | undefined = undefined;
    if (reservationTime && reservationDate) {
      const parts = reservationDate.split("-");
      const year = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1;
      const day = parseInt(parts[2]);
      const [hours, minutes] = reservationTime.split(":");
      reservationDateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes));
    }

    const newId = addToWaitlist(
      guestName.trim(), partySize, specialRequests.trim() || undefined, joinType as "reservation" | "waitlist",
      selectedEvent.id, selectedQueue?.id, reservationDateTime,
      (localId, remoteId) => {
        setSelectedWaitlistId(prev => prev === localId ? remoteId : prev);
      }
    );

    setSelectedWaitlistId(newId);
    setViewingStatus(true);
    toast.success(joinType === "reservation" ? "Reservation confirmed!" : "Added to waitlist!");
    setGuestName(""); setPartySize(2); setSpecialRequests(""); setReservationTime(""); setReservationDate(""); setJoinType("choice"); setSelectedEvent(null); setSelectedQueue(null);
  };

  const handleAddAnother = () => {
    if (!guestName.trim()) {
      toast.error("Please enter a name");
      return;
    }
    if (!myEntry) {
      toast.error("No active waitlist");
      return;
    }

    if (isTableBasedReservation && selectedWaitlistId) {
      // REQUIRED FIELDS VALIDATION: Prevent empty date or time when editing
      if (!reservationDate || !reservationTime) {
        toast.error("Please select both a date and time for your reservation.");
        return;
      }

      let reservationDateTime: Date | undefined = undefined;
      if (reservationTime && reservationDate) {
        const parts = reservationDate.split("-");
        const year = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const day = parseInt(parts[2]);
        const [hours, minutes] = reservationTime.split(":");
        reservationDateTime = new Date(year, month, day, parseInt(hours), parseInt(minutes));
      }

      updateWaitlistEntry(selectedWaitlistId, {
        name: guestName.trim(), partySize, specialRequests: specialRequests.trim() || undefined, reservationTime: reservationDateTime,
      });

      toast.success("Reservation updated!");
      setShowAddAnotherForm(false); setGuestName(""); setPartySize(2); setSpecialRequests(""); setReservationTime(""); setReservationDate("");
    } else {
      addToWaitlist(
        guestName.trim(), partySize, specialRequests.trim() || undefined, myEntry.type, myEntry.eventId, myEntry.queueId, undefined
      );

      toast.success(`Added ${guestName} to the waitlist!`);
      setShowAddAnotherForm(false); setGuestName(""); setPartySize(2); setSpecialRequests("");
    }
  };

  const handleLeaveWaitlist = () => {
    if (!selectedWaitlistId) return;
    removeFromWaitlist(selectedWaitlistId);
    setViewingStatus(false);
    setSelectedWaitlistId(null);
    toast.success(myEntry?.type === "reservation" ? "Reservation cancelled" : "Removed from waitlist");
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col max-w-md mx-auto">
      <StatusBar isOnline={isOnline} isSyncing={isSyncing} />

      <div className="bg-white shadow-sm py-1 px-4 flex items-center justify-between">
        <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <div className="flex-1 flex justify-center">
          <img src="/gil.png" alt="Get-In-Line" className="h-20 object-contain" />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onLogout} className="p-2 hover:bg-gray-100 rounded-lg transition-colors" title="Logout">
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <button onClick={() => { setShowMyEvents(true); setMenuOpen(false); }} className="w-full p-4 text-left hover:bg-gray-100 transition-colors">
            <div className="flex items-center justify-between">
              <div className="font-semibold">My Events</div>
              {myWaitlistIds.length > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">{myWaitlistIds.length}</span>
              )}
            </div>
          </button>
          <button onClick={() => { setShowProfile(true); setMenuOpen(false); }} className="w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200">
            <div className="font-semibold">Profile</div>
          </button>
          <button onClick={() => { setMenuOpen(false); onLogout(); }} className="w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200 text-red-600">
            <div className="font-semibold">Logout</div>
          </button>
        </div>
      )}

      {!isOnWaitlist || !viewingStatus ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Event Selection Screen */}
            {joinType === "event-selection" && (
              <>
                <div className="text-center mb-8">
                  <button onClick={() => { setJoinType("choice"); setSelectedEvent(null); setEventCode(""); }} className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto">
                    ← Back
                  </button>
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-10 h-10 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Select Event</h2>
                  <p className="text-gray-600 text-sm">Enter event code or scan QR code</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Event Code or Name</label>
                  <div className="flex gap-2">
                    <input type="text" value={eventCode} onChange={(e) => setEventCode(e.target.value)} onKeyPress={(e) => e.key === "Enter" && handleFindEvent()} placeholder="e.g., PARK2024 or Theme Park" className="flex-1 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500" />
                    <button onClick={handleFindEvent} className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg font-semibold active:scale-95 transition-transform"><Search className="w-5 h-5" /></button>
                  </div>
                </div>

                {availableEvents.filter((e) => e.isPublic).length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Active Events</h3>
                    <div className="space-y-2">
                      {availableEvents.filter((event) => event.isPublic).map((event) => {
                        let capacityBadge: { text: string; color: string; } | null = null;
                        let isFull = false;

                        if (event.type === "capacity-based") {
                          const capacityEvent = event as CapacityBasedEvent;
                          if (capacityEvent.queueMode === "single") {
                            const queueCapacity = capacityEvent.capacity || 0;
                            let currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === event.id).reduce((sum, e) => sum + e.partySize, 0);
                            currentQueueSize += (capacityEvent.manualOffset || 0);
                            const spotsLeft = queueCapacity - currentQueueSize;
                            const percentFilled = queueCapacity > 0 ? (currentQueueSize / queueCapacity) * 100 : 0;
                            if (spotsLeft <= 0) isFull = true;

                            if (spotsLeft <= 10 && spotsLeft > 0) capacityBadge = { text: `${spotsLeft} spots left`, color: "bg-red-100 text-red-700" };
                            else if (spotsLeft == 0) capacityBadge = { text: "Queue Full", color: "bg-red-100 text-red-700" };
                            else if (percentFilled >= 80) capacityBadge = { text: "Almost Full", color: "bg-red-100 text-red-700" };
                            else if (percentFilled >= 50) capacityBadge = { text: "Filling Up", color: "bg-amber-100 text-amber-700" };
                          } else if (capacityEvent.queueMode === "multiple") {
                            const allQueues = capacityEvent.queues || [];
                            const allQueuesFull = allQueues.every((queue) => {
                              const queueCapacity = queue.capacity;
                              let currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === event.id && e.queueId === queue.id).reduce((sum, e) => sum + e.partySize, 0);
                              currentQueueSize += (queue.manualOffset || 0);
                              return (queueCapacity - currentQueueSize <= 0);
                            });
                            if (allQueuesFull && allQueues.length > 0) {
                              isFull = true;
                              capacityBadge = { text: "All Queues Full", color: "bg-red-100 text-red-700" };
                            }
                          }
                        }
                        return { event, capacityBadge, isFull };
                      }).sort((a, b) => {
                        if (a.isFull && !b.isFull) return 1;
                        if (!a.isFull && b.isFull) return -1;
                        return 0;
                      }).map(({ event, capacityBadge, isFull }) => {
                        return (
                          <button key={event.id} disabled={isFull}
                            onClick={() => {
                              if (isFull) { toast.error("This event is currently full"); return; }
                              setSelectedEvent(event);
                              toast.success(`Selected: ${event.name}`);
                              if (event.type === "table-based") setJoinType("choice");
                              else {
                                const capacityEvent = event as CapacityBasedEvent;
                                if (capacityEvent.queueMode === "multiple" && capacityEvent.queues && capacityEvent.queues.length > 0) setJoinType("queue-selection");
                                else setJoinType("waitlist");
                              }
                            }}
                            className={`w-full text-left p-3 border rounded-lg transition-colors ${isFull ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-gray-200 hover:bg-blue-50 hover:border-blue-300"}`}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className={`font-medium ${isFull ? "text-gray-400" : ""}`}>{event.name}</div>
                                <div className={`text-xs mt-1 ${isFull ? "text-gray-400" : "text-gray-500"}`}>{event.type === "capacity-based" ? "Queue Line" : "Table Service"}</div>
                              </div>
                              {capacityBadge && <div className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2`}>{capacityBadge.text}</div>}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button onClick={() => setShowScanner(true)} className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform">
                  <QrCode className="w-6 h-6" /> Scan Event QR Code
                </button>
                <button onClick={() => setIsOnline(!isOnline)} className="w-full text-xs text-gray-500 py-2">
                  Toggle {isOnline ? "Offline" : "Online"} Mode
                </button>
              </>
            )}

            {/* Choice Screen */}
            {joinType === "choice" && !selectedEvent && (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
                  <p className="text-gray-600 text-sm">Select an event to get started</p>
                </div>

                <button onClick={() => setJoinType("event-selection")} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                  <Ticket className="w-8 h-8" />
                  <span className="text-lg">Join an Event</span>
                  <span className="text-sm opacity-90">Enter code or scan QR</span>
                </button>

                {myWaitlistIds.length > 0 && (
                  <button onClick={() => setShowMyEvents(true)} className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                    <Ticket className="w-6 h-6" /> View My Events ({myWaitlistIds.length})
                  </button>
                )}
                <button onClick={() => setIsOnline(!isOnline)} className="w-full text-xs text-gray-500 py-2">
                  Toggle {isOnline ? "Offline" : "Online"} Mode
                </button>
              </>
            )}

            {/* Queue Selection Screen */}
            {joinType === "queue-selection" && selectedEvent && selectedEvent.type === "capacity-based" && (
              <>
                <div className="text-center mb-8">
                  <button onClick={() => { setSelectedEvent(null); setSelectedQueue(null); setJoinType("event-selection"); }} className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto">
                    ← Change event
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ListOrdered className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">{selectedEvent.name}</h2>
                  <p className="text-gray-600 text-sm">Select which queue to join</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Available Queues</h3>
                  <div className="space-y-3">
                    {(selectedEvent as CapacityBasedEvent).queues?.map((queue) => {
                      let liveCount = allWaitlistEntries.filter((e) => e.eventId === selectedEvent.id && e.queueId === queue.id).reduce((sum, e) => sum + e.partySize, 0);
                      liveCount += (queue.manualOffset || 0);

                      const queuePercentage = (liveCount / queue.capacity) * 100;
                      const spotsLeft = queue.capacity - liveCount;
                      const isFull = spotsLeft <= 0;
                      return { queue, liveCount, queuePercentage, spotsLeft, isFull };
                    }).sort((a, b) => {
                      if (a.isFull && !b.isFull) return 1;
                      if (!a.isFull && b.isFull) return -1;
                      return 0;
                    }).map(({ queue, liveCount, queuePercentage, spotsLeft, isFull }) => {
                      const getQueueColor = () => {
                        if (queuePercentage < 50) return "text-green-600";
                        if (queuePercentage < 80) return "text-amber-600";
                        return "text-red-600";
                      };

                      let capacityBadge: { text: string; color: string; } | null = null;
                      if (spotsLeft <= 0) capacityBadge = { text: "Queue Full", color: "bg-red-100 text-red-700" };
                      else if (spotsLeft <= 10 && spotsLeft > 0) capacityBadge = { text: `${spotsLeft} spots left`, color: "bg-red-100 text-red-700" };
                      else if (queuePercentage >= 80) capacityBadge = { text: "Almost Full", color: "bg-red-100 text-red-700" };
                      else if (queuePercentage >= 50) capacityBadge = { text: "Filling Up", color: "bg-amber-100 text-amber-700" };

                      return (
                        <button key={queue.id} disabled={isFull} onClick={() => {
                          if (isFull) { toast.error("This queue is currently full"); return; }
                          setSelectedQueue(queue); setJoinType("waitlist"); toast.success(`Selected: ${queue.name}`);
                        }}
                          className={`w-full text-left p-4 border-2 rounded-xl transition-all ${isFull ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed" : "border-gray-200 hover:bg-blue-50 hover:border-blue-400"}`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className={`font-semibold text-lg ${isFull ? "text-gray-400" : ""}`}>{queue.name}</div>
                            <div className="flex items-center gap-2">
                              <div className={`text-sm font-medium ${isFull ? "text-gray-400" : getQueueColor()}`}>{Math.round(queuePercentage)}%</div>
                              {capacityBadge && <div className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap`}>{capacityBadge.text}</div>}
                            </div>
                          </div>
                          <div className={`flex items-center gap-2 text-sm mb-2 ${isFull ? "text-gray-400" : "text-gray-600"}`}>
                            <Users className="w-4 h-4" /><span>{liveCount} / {queue.capacity} in queue</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full transition-all ${queuePercentage < 50 ? "bg-green-500" : queuePercentage < 80 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${Math.min(queuePercentage, 100)}%` }} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={() => setIsOnline(!isOnline)} className="w-full text-xs text-gray-500 py-2">Toggle {isOnline ? "Offline" : "Online"} Mode</button>
              </>
            )}

            {/* Reservation vs Waitlist Choice */}
            {joinType === "choice" && selectedEvent && selectedEvent.type === "table-based" && (
              <>
                <div className="text-center mb-8">
                  <button onClick={() => { setSelectedEvent(null); setJoinType("event-selection"); }} className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto">
                    ← Change event
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">{selectedEvent.name}</h2>
                  <p className="text-gray-600 text-sm">How would you like to join?</p>
                </div>

                <button onClick={() => setJoinType("reservation")} disabled={allTablesOccupied} className={`w-full py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform ${allTablesOccupied ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-green-600 hover:bg-green-700 text-white"}`}>
                  <Calendar className="w-8 h-8" />
                  <span className="text-lg">{allTablesOccupied ? "Reservations Full" : "Make a Reservation"}</span>
                  {!allTablesOccupied && <span className="text-sm opacity-90">Immediate seating available</span>}
                </button>

                <button onClick={() => setJoinType("waitlist")} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform">
                  <ListOrdered className="w-8 h-8" />
                  <span className="text-lg">Join Waitlist</span>
                  <span className="text-sm opacity-90">Get in line for next available table</span>
                </button>
              </>
            )}

            {/* Form Screen */}
            {(joinType === "reservation" || joinType === "waitlist") && selectedEvent && (
              <>
                <div className="text-center mb-8">
                  <button onClick={() => { if (selectedEvent.type === "table-based") setJoinType("choice"); else { setJoinType("event-selection"); setSelectedEvent(null); } }} className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto">
                    ← Back
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">{joinType === "reservation" ? "Make a Reservation" : "Join the Waitlist"}</h2>
                  <p className="text-gray-600 text-sm mb-1">{selectedEvent.name}</p>
                  <p className="text-gray-500 text-xs">{joinType === "reservation" ? "Complete the form to reserve your table" : "Fill out your details to join the queue"}</p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Your Name *</label>
                    <input type="text" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Enter your name" className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Party Size *</label>
                    {selectedEvent && (
                      <span className="text-xs font-mono bg-gray-100 px-2 py-0.5 rounded-full text-gray-600">
                        ({stats.current}/{stats.max} {selectedEvent.type === 'table-based' ? 'tables' : 'spots'})
                      </span>
                    )}

                    <input type="number" min="1" max={selectedEvent.type === "capacity-based" && joinType === "waitlist" ? (() => {
                      const capacityEvent = selectedEvent as CapacityBasedEvent;
                      let queueCapacity = 0; let currentQueueSize = 0;
                      if (capacityEvent.queueMode === "single") {
                        queueCapacity = capacityEvent.capacity || 0;
                        currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === selectedEvent.id).reduce((sum, e) => sum + e.partySize, 0);
                        currentQueueSize += (capacityEvent.manualOffset || 0);
                      } else if (selectedQueue) {
                        queueCapacity = selectedQueue.capacity;
                        currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === selectedEvent.id && e.queueId === selectedQueue.id).reduce((sum, e) => sum + e.partySize, 0);
                        currentQueueSize += (selectedQueue.manualOffset || 0);
                      }
                      return queueCapacity - currentQueueSize;
                    })() : undefined}
                      value={partySize} onChange={(e) => setPartySize(Number(e.target.value))} placeholder="Number of people" className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>

                  {joinType === "reservation" && (
                    <>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reservation Date *</label>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="date" value={reservationDate} onChange={(e) => setReservationDate(e.target.value)} className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Reservation Time *</label>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <input type="time" value={reservationTime} onChange={(e) => setReservationTime(e.target.value)} className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        </div>
                      </div>
                    </>
                  )}

                  {selectedEvent.type === "table-based" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Special Requests <span className="text-gray-400 font-normal">(Optional)</span></label>
                      <textarea value={specialRequests} onChange={(e) => setSpecialRequests(e.target.value)} placeholder="Dietary restrictions, seating preferences, etc." rows={3} className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }} />
                    </div>
                  )}
                </div>

                <button onClick={handleJoinManually} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform shadow-lg">
                  {joinType === "reservation" ? "Confirm Reservation" : "Join Queue"}
                </button>
                <button onClick={() => setIsOnline(!isOnline)} className="w-full text-xs text-gray-500 py-2">Toggle {isOnline ? "Offline" : "Online"} Mode</button>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center mb-8">
              <button onClick={() => setViewingStatus(false)} className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto">
                ← Back to menu
              </button>

              {myWaitlistIds.length > 1 && (
                <div className="mb-6">
                  <label className="block text-xs text-gray-500 mb-2">Switch Event</label>
                  <select value={selectedWaitlistId || ""} onChange={(e) => {
                    const newId = e.target.value; setSelectedWaitlistId(newId);
                    const entry = allWaitlistEntries.find((entry) => entry.id === newId);
                    const event = availableEvents.find((ev) => ev.id === entry?.eventId);
                    toast.success(`Switched to ${event?.name || "event"}`);
                  }} className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium">
                    {myWaitlistIds.map((id) => {
                      const entry = allWaitlistEntries.find((e) => e.id === id);
                      if (!entry) return null;
                      const event = availableEvents.find((e) => e.id === entry.eventId);
                      const eventName = event?.name || "Unknown Event";
                      const queueName = entry.queueId ? (() => {
                        if (event && event.type === "capacity-based") {
                          const capacityEvent = event as CapacityBasedEvent;
                          const queue = capacityEvent.queues?.find((q) => q.id === entry.queueId);
                          return queue?.name;
                        }
                        return undefined;
                      })() : undefined;
                      const fullDisplayName = queueName ? `${queueName} - ${eventName}` : eventName;
                      const sameTypeEntries = allWaitlistEntries.filter((e) => e.type === entry.type && e.eventId === entry.eventId);
                      const pos = sameTypeEntries.findIndex((e) => e.id === id) + 1;

                      return (
                        <option key={id} value={id}>
                          {fullDisplayName} - {entry.name} {entry.type === "waitlist" ? `(#${pos})` : entry.reservationTime ? `(${entry.reservationTime.toLocaleDateString([], { month: "short", day: "numeric" })} at ${entry.reservationTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})` : "(Reservation)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${myEntry?.type === "reservation" ? "bg-green-100" : "bg-blue-100"}`}>
                <div className="text-center">
                  {myEntry?.type === "reservation" ? <Calendar className={`w-16 h-16 ${myEntry?.type === "reservation" ? "text-green-600" : "text-blue-600"}`} /> : <div className="text-6xl font-bold text-blue-600">#{position}</div>}
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2">{myEntry?.type === "reservation" ? "Your Reservation" : "Your Position"}</h2>

              {myEntry?.type === "reservation" && myEntry?.reservationTime && (
                <div className="mb-2">
                  <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
                    <Clock className="w-5 h-5 text-green-700" />
                    <span className="text-xl font-bold text-green-700">
                      {myEntry.reservationTime.toLocaleDateString([], { month: "short", day: "numeric" })} at {myEntry.reservationTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </div>
                </div>
              )}

              <p className="text-gray-600">
                {myEntry?.type === "reservation" ? "You will be seated shortly" : position === 1 ? "You're next!" : estimatedWaitMinutes === 0 ? "Almost there!" : `${position - 1} ${position - 1 === 1 ? "party" : "parties"} ahead of you`}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
              {myEntry?.type === "waitlist" && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3"><Clock className="w-6 h-6 text-blue-600" /><span className="font-medium">Estimated Wait</span></div>
                  <div className="text-2xl font-bold text-blue-600">~{estimatedWaitMinutes} min</div>
                </div>
              )}

              {myEntry?.type === "reservation" && myEntry?.reservationTime && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3"><Clock className="w-6 h-6 text-green-600" /><span className="font-medium">Reservation Time</span></div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600">{myEntry.reservationTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
                    <div className="text-sm text-green-700">{myEntry.reservationTime.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</div>
                  </div>
                </div>
              )}

              <div className={myEntry?.type === "waitlist" || (myEntry?.type === "reservation" && myEntry?.reservationTime) ? "pt-0" : ""}>
                <div className="flex items-center justify-between text-sm mb-3"><span className="text-gray-600">Guest Name</span><span className="font-semibold">{myEntry?.name}</span></div>
                <div className="flex items-center justify-between text-sm"><span className="text-gray-600">Party Size</span><span className="font-semibold">{myEntry?.partySize} people</span></div>

                {myEntry?.specialRequests && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">Special Requests</div>
                    <div className="text-sm font-medium break-words overflow-hidden">{myEntry.specialRequests}</div>
                  </div>
                )}

                {/* NEW CODE: No-Show Policy Warning */}
                {myEntry?.type === "reservation" && isTableBasedReservation && (myEvent as TableBasedEvent)?.noShowPolicy && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-red-600 mb-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-semibold">No-Show Policy</span>
                    </div>
                    <div className="text-sm font-medium text-gray-700 break-words overflow-hidden">
                      {(myEvent as TableBasedEvent).noShowPolicy}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className={`border rounded-xl p-4 text-sm ${myEntry?.type === "reservation" ? "bg-green-50 border-green-200 text-green-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
              <p className="text-center">{myEntry?.type === "reservation" ? "✓ Your table is being prepared. A staff member will seat you shortly!" : "💡 You'll be notified when it's your turn. Please stay nearby!"}</p>
            </div>

            <button onClick={() => {
              if (isTableBasedReservation && myEntry) {
                setGuestName(myEntry.name); setPartySize(myEntry.partySize); setSpecialRequests(myEntry.specialRequests || "");
                if (myEntry.reservationTime) {
                  const resDate = myEntry.reservationTime;
                  const year = resDate.getFullYear(); const month = (resDate.getMonth() + 1).toString().padStart(2, "0"); const day = resDate.getDate().toString().padStart(2, "0");
                  setReservationDate(`${year}-${month}-${day}`);
                  const hours = resDate.getHours().toString().padStart(2, "0"); const minutes = resDate.getMinutes().toString().padStart(2, "0");
                  setReservationTime(`${hours}:${minutes}`);
                } else { setReservationDate(""); setReservationTime(""); }
              }
              setShowAddAnotherForm(true);
            }} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
              {isTableBasedReservation ? <><Calendar className="w-5 h-5" />Edit Reservation</> : <><Users className="w-5 h-5" />Add Another Guest</>}
            </button>

            <button onClick={handleLeaveWaitlist} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform">
              {myEntry?.type === "reservation" ? "Cancel Reservation" : "Leave Waitlist"}
            </button>
            <button onClick={() => setIsOnline(!isOnline)} className="w-full text-xs text-gray-500 py-2">Toggle {isOnline ? "Offline" : "Online"} Mode</button>
          </div>
        </div>
      )
      }

      {
        showAddAnotherForm && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800">
                  {isTableBasedReservation ? "Edit Reservation" : "Add Another Guest"}
                </h2>
                <button
                  onClick={() => setShowAddAnotherForm(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    placeholder="Guest name"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Party Size *</label>
                  <input
                    type="number"
                    min="1"
                    value={partySize}
                    onChange={(e) => setPartySize(Number(e.target.value))}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {isTableBasedReservation && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reservation Date *</label>
                      <div className="relative">
                        <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="date"
                          value={reservationDate}
                          onChange={(e) => setReservationDate(e.target.value)}
                          className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Reservation Time *</label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="time"
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Special Requests</label>
                  <textarea
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    rows={3}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>

                <button
                  onClick={handleAddAnother}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform mt-2"
                >
                  {isTableBasedReservation ? "Save Changes" : "Confirm"}
                </button>
              </div>
            </div>
          </div>
        )
      }

      {showProfile && <Profile user={user} onClose={() => setShowProfile(false)} onLogout={onLogout} />}

      {
        showMyEvents && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
            <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
                <h2 className="text-2xl font-bold text-gray-800">My Events</h2>
                <button onClick={() => setShowMyEvents(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-6 h-6" /></button>
              </div>

              <div className="p-6 space-y-4">
                {myWaitlistIds.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4"><Ticket className="w-10 h-10 text-gray-400" /></div>
                    <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Events</h3>
                    <p className="text-sm text-gray-600 mb-4">You're not currently on any waitlists</p>
                    <button onClick={() => { setShowMyEvents(false); setJoinType("event-selection"); }} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold">Join an Event</button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-gray-600 mb-4">You're currently on {myWaitlistIds.length} {myWaitlistIds.length === 1 ? "waitlist" : "waitlists"}</p>
                    {myWaitlistIds.map((id) => {
                      const entry = allWaitlistEntries.find((e) => e.id === id);
                      if (!entry) return null;

                      const event = availableEvents.find((e) => e.id === entry.eventId);
                      const eventName = event?.name || "Unknown Event";

                      const queueName = entry.queueId ? (() => {
                        if (event && event.type === "capacity-based") {
                          const capacityEvent = event as CapacityBasedEvent;
                          const queue = capacityEvent.queues?.find((q) => q.id === entry.queueId);
                          return queue?.name;
                        }
                        return undefined;
                      })() : undefined;

                      const fullDisplayName = queueName ? `${queueName} - ${eventName}` : eventName;
                      const sameTypeEntries = allWaitlistEntries.filter((e) => e.type === entry.type && e.eventId === entry.eventId);
                      const pos = sameTypeEntries.findIndex((e) => e.id === id) + 1;
                      const dynamicWaitTime = calculateDynamicWaitTime(entry, allWaitlistEntries);

                      let capacityBadge: { text: string; color: string; } | null = null;
                      if (event && event.type === "capacity-based") {
                        const capacityEvent = event as CapacityBasedEvent;
                        let queueCapacity = 0; let currentQueueSize = 0;

                        if (capacityEvent.queueMode === "single") {
                          queueCapacity = capacityEvent.capacity || 0;
                          currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === event.id).reduce((sum, e) => sum + e.partySize, 0);
                          currentQueueSize += (capacityEvent.manualOffset || 0);
                        } else {
                          const queue = capacityEvent.queues?.find((q) => q.id === entry.queueId);
                          if (queue) {
                            queueCapacity = queue.capacity;
                            currentQueueSize = allWaitlistEntries.filter((e) => e.eventId === event.id && e.queueId === entry.queueId).reduce((sum, e) => sum + e.partySize, 0);
                            currentQueueSize += (queue.manualOffset || 0);
                          }
                        }
                        const spotsLeft = queueCapacity - currentQueueSize;
                        const percentFilled = queueCapacity > 0 ? (currentQueueSize / queueCapacity) * 100 : 0;

                        if (spotsLeft <= 10 && spotsLeft > 0) capacityBadge = { text: `${spotsLeft} spots left`, color: "bg-red-100 text-red-700" };
                        else if (percentFilled >= 80) capacityBadge = { text: "Almost Full", color: "bg-red-100 text-red-700" };
                        else if (percentFilled >= 50) capacityBadge = { text: "Filling Up", color: "bg-amber-100 text-amber-700" };
                      }

                      return (
                        <button key={id} onClick={() => { setSelectedWaitlistId(id); setViewingStatus(true); setShowMyEvents(false); }} className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left">
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h3 className="font-semibold text-lg text-gray-800">{fullDisplayName}</h3>
                              <p className="text-sm text-gray-600">{entry.name}</p>
                            </div>
                            <div className="flex flex-col gap-1 items-end">
                              {entry.type === "reservation" ? <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">Reservation</div> : <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">{event?.type === "capacity-based" ? "Queue" : "Waitlist"}</div>}
                              {capacityBadge && <div className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap`}>{capacityBadge.text}</div>}
                            </div>
                          </div>

                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            {entry.type === "waitlist" && <div className="flex items-center gap-1"><ListOrdered className="w-4 h-4" /><span>Position #{pos}</span></div>}
                            {entry.type === "reservation" && entry.reservationTime && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-green-700">
                                  {entry.reservationTime.toLocaleDateString([], { month: "short", day: "numeric" })} at {entry.reservationTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </span>
                              </div>
                            )}
                            <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{entry.partySize} {entry.partySize === 1 ? "person" : "people"}</span></div>
                            {entry.type === "waitlist" && dynamicWaitTime > 0 && <div className="flex items-center gap-1"><Clock className="w-4 h-4" /><span>~{dynamicWaitTime} min</span></div>}
                          </div>
                          {entry.specialRequests && <div className="mt-2 pt-2 border-t border-gray-200"><p className="text-xs text-gray-500 break-words">Note: {entry.specialRequests}</p></div>}
                        </button>
                      );
                    })}
                    <div className="pt-4 border-t border-gray-200">
                      <button onClick={() => { setShowMyEvents(false); setJoinType("event-selection"); }} className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform">
                        <Ticket className="w-5 h-5" /> Join Another Event
                      </button>
                    </div>
                  </>
                )}

                {/* RESTORED: Currently Seated Section */}
                {seatedTableInfo && (
                  <div className="pt-6 mt-6 border-t-2 border-green-200">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                      <Users className="w-5 h-5 text-green-600" />
                      Currently Seated
                    </h3>
                    <div className="p-4 border-2 border-green-400 rounded-xl bg-green-50 animate-pulse-slow">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-bold text-green-900 text-lg">
                            {seatedTableInfo.tableName}
                          </h4>
                          <p className="text-sm text-green-700">
                            {seatedTableInfo.eventName}
                          </p>
                        </div>
                        <div className="bg-green-600 text-white text-xs font-bold px-3 py-1.5 rounded-full">
                          Seated ✓
                        </div>
                      </div>
                      <p className="text-xs text-green-600 mt-2">
                        Seated at{" "}
                        {seatedTableInfo.seatedAt.toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {" · "}This card will move to Past Events when your table is cleared.
                      </p>
                    </div>
                  </div>
                )}

                {/* Past Events Section */}
                <div className="pt-6 mt-6 border-t-2 border-gray-300">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                    <Clock className="w-5 h-5 text-gray-500" />
                    Past Events
                  </h3>
                  {(() => {
                    // Hide only the single most-recent history entry for the currently seated event.
                    // Backend returns entries sorted newest-first, so the first match is the active session.
                    const currentSessionId = seatedTableInfo
                      ? pastEvents.find(e => e.eventId === seatedTableInfo.eventId)?.id
                      : null;
                    const visiblePastEvents = pastEvents.filter(e => e.id !== currentSessionId);
                    return visiblePastEvents.length > 0 ? (
                      <div className="space-y-3">
                        {visiblePastEvents.map((event) => (
                          <div key={event.id} className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 opacity-75">
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <h4 className="font-semibold text-gray-800">{event.eventName}</h4>
                                <p className="text-sm text-gray-600">{event.name}</p>
                              </div>
                              <div className="bg-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded">Seated</div>
                            </div>

                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <div className="flex items-center gap-1"><Users className="w-4 h-4" /><span>{event.partySize} {event.partySize === 1 ? "party" : "people"}</span></div>
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>{event.seatedAt.toLocaleDateString([], { month: "short", day: "numeric" })} at {event.seatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8 text-gray-500"><p className="text-sm">No past events yet</p></div>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
