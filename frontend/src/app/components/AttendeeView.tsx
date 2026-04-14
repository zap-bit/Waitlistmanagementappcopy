import { useState, useEffect, useRef } from "react";
import { StatusBar } from "./StatusBar";
import { QRScanner } from "./QRScanner";
import {
  QrCode,
  Clock,
  Users,
  LogOut,
  X,
  Calendar,
  ListOrdered,
  Search,
  Ticket,
  User as UserIcon,
  Menu,
} from "lucide-react";
import { toast } from "sonner";
import { WaitlistEntry } from "../App";
import { Table } from "./TableGrid";
import {
  getStoredEvents,
  Event,
  CapacityBasedEvent,
  Queue,
} from "../utils/events";
import { Profile, getSavedProfile } from "./Profile";
import { User } from "../utils/auth";
import { calculateDynamicWaitTime, fetchPredictedWait } from "../utils/waitTime";

interface AttendeeViewProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  addToWaitlist: (
    name: string,
    partySize: number,
    specialRequests?: string,
    type?: "reservation" | "waitlist",
    eventId?: string,
    queueId?: string,
    reservationTime?: Date,
    onIdResolved?: (localId: string, remoteId: string) => void
  ) => string;
  removeFromWaitlist: (id: string) => void;
  updateWaitlistEntry: (
    id: string,
    updates: Partial<Omit<WaitlistEntry, "id" | "joinedAt">>,
  ) => void;
  allWaitlistEntries: WaitlistEntry[];
  tables: Table[];
  user: User;
}

export function AttendeeView({
  onLogout,
  waitlist,
  addToWaitlist,
  removeFromWaitlist,
  updateWaitlistEntry,
  allWaitlistEntries,
  tables,
  user,
}: AttendeeViewProps) {
  // Store multiple waitlist IDs
  const [myWaitlistIds, setMyWaitlistIds] = useState<string[]>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("myWaitlistIds");
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch (e) {
            return [];
          }
        }
      }
      return [];
    },
  );

  // Currently selected waitlist entry to view
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<
    string | null
  >(null);

  // Tracks whether we've already done the first Supabase sync (avoid re-auto-selecting on every poll)
  const hasSyncedFromSupabase = useRef(false);

  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [reservationTime, setReservationTime] = useState("");
  const [reservationDate, setReservationDate] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [showAddAnotherForm, setShowAddAnotherForm] =
    useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMyEvents, setShowMyEvents] = useState(false);

  // Past events that user has been seated for
  interface PastEvent {
    id: string;
    eventName: string;
    eventId: string;
    name: string;
    partySize: number;
    type: "reservation" | "waitlist";
    seatedAt: Date;
    queueName?: string;
  }

  const [pastEvents, setPastEvents] = useState<PastEvent[]>(
    () => {
      if (typeof window !== "undefined") {
        const saved = localStorage.getItem("pastEvents");
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            // Convert seatedAt back to Date objects
            return parsed.map((e: any) => ({
              ...e,
              seatedAt: new Date(e.seatedAt),
            }));
          } catch (e) {
            return [];
          }
        }
      }
      return [];
    },
  );

  // Update form fields when profile changes or on mount
  useEffect(() => {
    const savedProfile = getSavedProfile(user.id);
    if (savedProfile) {
      // Use saved profile if available
      setGuestName(savedProfile.displayName || "");
      setPartySize(savedProfile.defaultPartySize || 2);
      setSpecialRequests(savedProfile.preferences || "");
    } else {
      // For new users without a profile, autofill from User object
      setGuestName(user.name || "");
      setPartySize(2);
      setSpecialRequests("");
    }
  }, [user.id, user.name, showProfile]); // Re-run when showProfile changes (after closing profile modal)

  const [joinType, setJoinType] = useState<
    | "choice"
    | "event-selection"
    | "reservation"
    | "waitlist"
    | "queue-selection"
  >("choice");
  const [viewingStatus, setViewingStatus] = useState(false);
  const [eventCode, setEventCode] = useState("");
  const [selectedEvent, setSelectedEvent] =
    useState<Event | null>(null);
  const [selectedQueue, setSelectedQueue] =
    useState<Queue | null>(null);
  const [availableEvents, setAvailableEvents] = useState<
    Event[]
  >([]);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("attendeeIsOnline");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          return true;
        }
      }
    }
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load available events on mount and poll for updates + Supabase initial load
  useEffect(() => {
    let serverEvents: Event[] = [];

    const loadEvents = () => {
      const localEvents = getStoredEvents().filter(
        (e) => e.status === "active" && e.type !== "simple-capacity",
      );

      // Merge local and server events, preferring local for same ID
      const localIds = new Set(localEvents.map(e => e.id));
      const merged = [...localEvents, ...serverEvents.filter(e => !localIds.has(e.id))];

      setAvailableEvents(merged);

      // If there's a selected event, refresh it with latest data
      if (selectedEvent) {
        const updatedEvent = merged.find(e => e.id === selectedEvent.id);
        if (updatedEvent) {
          setSelectedEvent(updatedEvent);
        }
      }
    };

    // Load immediately
    loadEvents();

    // Poll for updates every 2 seconds
    const interval = setInterval(loadEvents, 2000);

    // Fetch from Supabase
    const token = localStorage.getItem('authToken');
    if (token) {
      fetch(`${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/v1'}/events`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(({ data }) => {
          if (!data?.length) return;
          const mapped = data.map((e: Record<string, unknown>) => ({
            id: e.uuid as string,
            businessId: e.account_uuid as string,
            name: e.name as string,
            type: e.event_type === 'TABLE' ? 'table-based' : 'capacity-based',
            status: 'active',
            createdAt: new Date(e.created_at as string || Date.now()),
            archived: e.archived,
            queueMode: 'single',
            capacity: (e.queue_capacity as number) || 100,
            estimatedWaitPerPerson: (e.est_wait as number) || 5,
            location: (e.location as string) || '',
            currentCount: 0,
            numberOfTables: (e.num_tables as number) || 10,
            averageTableSize: (e.avg_size as number) || 4,
            reservationDuration: (e.reservation_duration as number) || 90,
            noShowPolicy: 'Hold for 15 minutes',
            currentFilledTables: 0,
          }));
          serverEvents = mapped.filter((e: { archived: boolean }) => !e.archived);
          loadEvents(); // Trigger update with new server events
        })
        .catch(e => console.error('Failed to load events:', e));
    }

    return () => clearInterval(interval);
  }, [selectedEvent?.id]); // Re-run when selected event changes

  // Persist attendee state to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (myWaitlistIds.length > 0) {
        localStorage.setItem(
          "myWaitlistIds",
          JSON.stringify(myWaitlistIds),
        );
      } else {
        localStorage.removeItem("myWaitlistIds");
      }
    }
  }, [myWaitlistIds]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "attendeeIsOnline",
        JSON.stringify(isOnline),
      );
    }
  }, [isOnline]);

  // Persist past events to localStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (pastEvents.length > 0) {
        localStorage.setItem(
          "pastEvents",
          JSON.stringify(pastEvents),
        );
      } else {
        localStorage.removeItem("pastEvents");
      }
    }
  }, [pastEvents]);

  // When Supabase entries arrive (after login load or poll), sync them into myWaitlistIds
  useEffect(() => {
    if (allWaitlistEntries.length === 0) return;
    const supabaseIds = allWaitlistEntries.map(e => e.id);
    // Merge: keep any locally-added IDs that haven't synced yet
    setMyWaitlistIds(prev => Array.from(new Set([...prev, ...supabaseIds])));

    // Mark as synced, but do NOT auto-navigate so the user stays on the Welcome screen
    if (!hasSyncedFromSupabase.current) {
      hasSyncedFromSupabase.current = true;

      // Only keep the previously selected ID if they were already viewing one
      setSelectedWaitlistId(prev => {
        if (prev && allWaitlistEntries.find(e => e.id === prev)) return prev;
        return null;
      });
    }
  }, [allWaitlistEntries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Detect when user is seated (removed from waitlist by staff) - runs on mount and when entries change
  useEffect(() => {
    // Don't run if events haven't loaded yet or if we haven't completed initial Supabase sync
    if (availableEvents.length === 0 || !hasSyncedFromSupabase.current) return;

    // Check if any of our waitlist IDs no longer exist in the waitlist
    const removedIds = myWaitlistIds.filter(
      (id) => !allWaitlistEntries.find((e) => e.id === id),
    );

    if (removedIds.length > 0) {
      removedIds.forEach((id) => {
        // Find the event details for this entry before it was removed
        const savedIds = myWaitlistIds;
        const index = savedIds.indexOf(id);

        if (index !== -1) {
          // Try to get event info from available events
          const event = availableEvents.find(
            (e) =>
              e.id ===
              localStorage.getItem(`waitlist_${id}_eventId`),
          );

          const eventName =
            event?.name ||
            localStorage.getItem(`waitlist_${id}_eventName`) ||
            "Event";
          const name =
            localStorage.getItem(`waitlist_${id}_name`) ||
            "You";
          const partySize = parseInt(
            localStorage.getItem(`waitlist_${id}_partySize`) ||
            "1",
          );
          const type =
            (localStorage.getItem(`waitlist_${id}_type`) as
              | "reservation"
              | "waitlist") || "waitlist";
          const isTableBased = event?.type === "table-based";

          // Add to past events
          const pastEvent: PastEvent = {
            id,
            eventName,
            eventId: event?.id || "",
            name,
            partySize,
            type,
            seatedAt: new Date(),
          };

          setPastEvents((prev) =>
            [pastEvent, ...prev].slice(0, 50),
          ); // Keep last 50

          // Show notification immediately
          if (isTableBased) {
            if (type === "reservation") {
              toast.success(
                `You've been seated! Your table is ready at ${eventName}`,
                {
                  duration: 6000,
                },
              );
            } else {
              toast.success(
                `You've been seated at ${eventName}!`,
                {
                  duration: 6000,
                },
              );
            }
          } else {
            // ADD THIS ELSE BLOCK to handle capacity-based events
            toast.success(
              `It's your turn at ${eventName}! Please head to the front.`,
              {
                duration: 6000,
              },
            );
          }

          // Clean up localStorage for this entry
          localStorage.removeItem(`waitlist_${id}_eventId`);
          localStorage.removeItem(`waitlist_${id}_eventName`);
          localStorage.removeItem(`waitlist_${id}_name`);
          localStorage.removeItem(`waitlist_${id}_partySize`);
          localStorage.removeItem(`waitlist_${id}_type`);
        }
      });

      // Remove the seated IDs from active waitlist
      setMyWaitlistIds((prev) =>
        prev.filter((id) => !removedIds.includes(id)),
      );
    }
  }, [allWaitlistEntries, myWaitlistIds, availableEvents]);

  // Check for pending notifications on mount
  useEffect(() => {
    const pendingNotifications = JSON.parse(
      localStorage.getItem("pendingSeatedNotifications") ||
      "[]",
    );

    if (pendingNotifications.length > 0) {
      // Show all pending notifications
      pendingNotifications.forEach((notification: any) => {
        if (notification.type === "reservation") {
          toast.success(
            `You've been seated! Your table is ready at ${notification.eventName}`,
            {
              duration: 6000,
            },
          );
        } else {
          toast.success(
            `You've been seated at ${notification.eventName}!`,
            {
              duration: 6000,
            },
          );
        }
      });

      // Clear pending notifications
      localStorage.removeItem("pendingSeatedNotifications");
    }
  }, []); // Run only on mount

  // Store entry details for later retrieval when seated
  useEffect(() => {
    myWaitlistIds.forEach((id) => {
      const entry = allWaitlistEntries.find((e) => e.id === id);
      if (entry) {
        const event = availableEvents.find(
          (e) => e.id === entry.eventId,
        );
        localStorage.setItem(
          `waitlist_${id}_eventId`,
          entry.eventId || "",
        );
        localStorage.setItem(
          `waitlist_${id}_eventName`,
          event?.name || "",
        );
        localStorage.setItem(`waitlist_${id}_name`, entry.name);
        localStorage.setItem(
          `waitlist_${id}_partySize`,
          entry.partySize.toString(),
        );
        localStorage.setItem(`waitlist_${id}_type`, entry.type);
      }
    });
  }, [myWaitlistIds, allWaitlistEntries, availableEvents]);

  // Find my entry in the waitlist or full list
  const myEntry = allWaitlistEntries.find(
    (e) => e.id === selectedWaitlistId,
  );
  const isOnWaitlist = !!myEntry;

  // Calculate position 
  const sameTypeAndEventEntries = myEntry
    ? allWaitlistEntries.filter(
      (e) =>
        e.type === myEntry.type &&
        e.eventId === myEntry.eventId,
    )
    : [];

  // Use Supabase provided position, fallback to array index calculation
  const position = myEntry?.position ?? (myEntry
    ? sameTypeAndEventEntries.findIndex(
      (e) => e.id === selectedWaitlistId,
    ) + 1
    : 0);

  // Calculate dynamic wait time state, syncs with Supabase fetching
  const [estimatedWaitMinutes, setEstimatedWaitMinutes] = useState(
    myEntry ? calculateDynamicWaitTime(myEntry, allWaitlistEntries) : 0
  );

  // Update wait time whenever position changes (driven by 15s polling in App)
  useEffect(() => {
    if (!myEntry) return;
    const event = availableEvents.find(e => e.id === myEntry.eventId);
    if (event && event.type === 'capacity-based') {
      setEstimatedWaitMinutes(Math.max(0, (position - 1)) * (event as CapacityBasedEvent).estimatedWaitPerPerson);
    }
  }, [position, myEntry, availableEvents]);

  useEffect(() => {
    if (!myEntry?.eventId) return;
    fetchPredictedWait(myEntry.eventId).then(mins => {
      if (mins !== null) setEstimatedWaitMinutes(mins);
    });
    const interval = setInterval(() => {
      fetchPredictedWait(myEntry.eventId).then(mins => {
        if (mins !== null) setEstimatedWaitMinutes(mins);
      });
    }, 30000);
    return () => clearInterval(interval);
  }, [myEntry?.eventId]);

  // Check if all tables are occupied
  const allTablesOccupied = tables.every(
    (table) => table.occupied,
  );

  // Clear stored ID if entry no longer exists in waitlist
  useEffect(() => {
    if (selectedWaitlistId && !myEntry) {
      setMyWaitlistIds((prev) =>
        prev.filter((id) => id !== selectedWaitlistId),
      );
      setViewingStatus(false);
      setSelectedWaitlistId(null); // Add this to fully reset the view
    }
  }, [selectedWaitlistId, myEntry]);

  // Get event name for display
  const myEventName = myEntry?.eventId
    ? availableEvents.find((e) => e.id === myEntry.eventId)
      ?.name || "Event"
    : "Event";

  // Get the full event object for the current entry
  const myEvent = myEntry?.eventId
    ? availableEvents.find((e) => e.id === myEntry.eventId)
    : null;

  // Check if current entry is a table-based reservation
  const isTableBasedReservation =
    myEntry?.type === "reservation" &&
    myEvent?.type === "table-based";

  // Get queue name for display (if applicable)
  const myQueueName = myEntry?.queueId
    ? (() => {
      const event = availableEvents.find(
        (e) => e.id === myEntry.eventId,
      );
      if (event && event.type === "capacity-based") {
        const capacityEvent = event as CapacityBasedEvent;
        const queue = capacityEvent.queues?.find(
          (q) => q.id === myEntry.queueId,
        );
        return queue?.name;
      }
      return undefined;
    })()
    : undefined;

  // Full display name with queue if applicable
  const displayName = myQueueName
    ? `${myQueueName} - ${myEventName}`
    : myEventName;

  // Handler functions
  const handleFindEvent = () => {
    if (!eventCode.trim()) {
      toast.error("Please enter an event code or name");
      return;
    }

    const event = availableEvents.find(
      (e) =>
        (e as any).eventCode?.toLowerCase() === eventCode.toLowerCase() ||
        (e as any).code?.toLowerCase() === eventCode.toLowerCase() ||
        e.name.toLowerCase().includes(eventCode.toLowerCase()),
    );

    if (event) {
      setSelectedEvent(event);
      toast.success(`Selected: ${event.name}`);
      if (event.type === "table-based") {
        setJoinType("choice");
      } else {
        const capacityEvent = event as CapacityBasedEvent;
        if (
          capacityEvent.queueMode === "multiple" &&
          capacityEvent.queues &&
          capacityEvent.queues.length > 0
        ) {
          setJoinType("queue-selection");
        } else {
          setJoinType("waitlist");
        }
      }
    } else {
      toast.error(
        "Event not found. Please check the code and try again.",
      );
    }
  };

  const handleScanSuccess = (data: string) => {
    setShowScanner(false);

    try {
      // Try to parse as JSON (new format with queue info)
      const parsed = JSON.parse(data);

      if (parsed.type === "waitlist-event" && parsed.eventId) {
        const event = availableEvents.find(
          (e) =>
            e.id === parsed.eventId ||
            (e as any).eventCode === parsed.eventCode ||
            (e as any).code === parsed.eventCode,
        );

        if (event) {
          setSelectedEvent(event);
          setEventCode(parsed.eventCode || (event as any).eventCode || (event as any).code || "");

          // Check if this is a queue-specific QR code
          if (parsed.queueId && parsed.queueName) {
            // Direct queue assignment
            const capacityEvent = event as CapacityBasedEvent;
            const queue = capacityEvent.queues?.find(
              (q) => q.id === parsed.queueId,
            );

            if (queue) {
              setSelectedQueue(queue);
              toast.success(
                `Found: ${parsed.queueName} - ${event.name}`,
              );
              setJoinType("waitlist"); // Go straight to join form
            } else {
              toast.error("Queue not found.");
              setJoinType("event-selection");
            }
          } else {
            // Event-level QR code
            toast.success(`Found event: ${event.name}`);
            if (event.type === "table-based") {
              setJoinType("choice");
            } else {
              const capacityEvent = event as CapacityBasedEvent;
              if (
                capacityEvent.queueMode === "multiple" &&
                capacityEvent.queues &&
                capacityEvent.queues.length > 0
              ) {
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
      // Fallback: treat as plain event code
      const event = availableEvents.find(
        (e) => (e as any).eventCode === data || (e as any).code === data || e.id === data,
      );

      if (event) {
        setSelectedEvent(event);
        setEventCode(data);
        toast.success(`Found event: ${event.name}`);
        if (event.type === "table-based") {
          setJoinType("choice");
        } else {
          const capacityEvent = event as CapacityBasedEvent;
          if (
            capacityEvent.queueMode === "multiple" &&
            capacityEvent.queues &&
            capacityEvent.queues.length > 0
          ) {
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

    // Validate party size for capacity-based events
    if (
      selectedEvent.type === "capacity-based" &&
      joinType === "waitlist"
    ) {
      const capacityEvent = selectedEvent as CapacityBasedEvent;
      let queueCapacity = 0;
      let currentQueueSize = 0;

      // Calculate available spots based on queue mode
      if (capacityEvent.queueMode === "single") {
        queueCapacity = capacityEvent.capacity || 0;
        currentQueueSize = allWaitlistEntries
          .filter((e) => e.eventId === selectedEvent.id)
          .reduce((sum, e) => sum + e.partySize, 0);
        // Add manual offset from staff dashboard
        currentQueueSize += (capacityEvent.manualOffset || 0);
      } else if (selectedQueue) {
        // Multi-queue mode
        queueCapacity = selectedQueue.capacity;
        currentQueueSize = allWaitlistEntries
          .filter(
            (e) =>
              e.eventId === selectedEvent.id &&
              e.queueId === selectedQueue.id,
          )
          .reduce((sum, e) => sum + e.partySize, 0);
        // Add manual offset from staff dashboard for this specific queue
        currentQueueSize += (selectedQueue.manualOffset || 0);
      }

      const spotsLeft = queueCapacity - currentQueueSize;

      // Check if party size exceeds available spots
      if (partySize > spotsLeft) {
        if (spotsLeft === 0) {
          toast.error(
            "This queue is full. Please try another queue or event.",
          );
        } else {
          toast.error(
            `Party size too large. Only ${spotsLeft} spot${spotsLeft === 1 ? "" : "s"} left in this queue.`,
          );
        }
        return;
      }
    }

    // Create reservation time as a Date object in local timezone
    let reservationDateTime: Date | undefined = undefined;
    if (reservationTime) {
      // Parse the date and time inputs
      let year: number, month: number, day: number;

      if (reservationDate) {
        // Parse date string manually to avoid timezone issues
        const parts = reservationDate.split("-");
        year = parseInt(parts[0]);
        month = parseInt(parts[1]) - 1; // month is 0-indexed
        day = parseInt(parts[2]);
      } else {
        const now = new Date();
        year = now.getFullYear();
        month = now.getMonth();
        day = now.getDate();
      }

      const [hours, minutes] = reservationTime.split(":");
      reservationDateTime = new Date(
        year,
        month,
        day,
        parseInt(hours),
        parseInt(minutes),
      );
    }

    const newId = addToWaitlist(
      guestName.trim(),
      partySize,
      specialRequests.trim() || undefined,
      joinType as "reservation" | "waitlist",
      selectedEvent.id,
      selectedQueue?.id,
      reservationDateTime,
      (localId, remoteId) => {
        setMyWaitlistIds(prev => prev.map(id => id === localId ? remoteId : id));
        setSelectedWaitlistId(prev => prev === localId ? remoteId : prev);
      }
    );

    setMyWaitlistIds([...myWaitlistIds, newId]);
    setSelectedWaitlistId(newId);
    setViewingStatus(true);

    toast.success(
      joinType === "reservation"
        ? "Reservation confirmed!"
        : "Added to waitlist!",
    );

    setGuestName("");
    setPartySize(2);
    setSpecialRequests("");
    setReservationTime("");
    setReservationDate("");
    setJoinType("choice");
    setSelectedEvent(null);
    setSelectedQueue(null);
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

    // Check if we're editing a table-based reservation
    if (isTableBasedReservation && selectedWaitlistId) {
      // Update existing reservation
      let reservationDateTime: Date | undefined = undefined;
      if (reservationTime) {
        // Parse the date and time inputs
        let year: number, month: number, day: number;

        if (reservationDate) {
          // Parse date string manually to avoid timezone issues
          const parts = reservationDate.split("-");
          year = parseInt(parts[0]);
          month = parseInt(parts[1]) - 1; // month is 0-indexed
          day = parseInt(parts[2]);
        } else {
          const now = new Date();
          year = now.getFullYear();
          month = now.getMonth();
          day = now.getDate();
        }

        const [hours, minutes] = reservationTime.split(":");
        reservationDateTime = new Date(
          year,
          month,
          day,
          parseInt(hours),
          parseInt(minutes),
        );
      }

      updateWaitlistEntry(selectedWaitlistId, {
        name: guestName.trim(),
        partySize,
        specialRequests: specialRequests.trim() || undefined,
        reservationTime: reservationDateTime,
      });

      toast.success("Reservation updated!");
      setShowAddAnotherForm(false);
      setGuestName("");
      setPartySize(2);
      setSpecialRequests("");
      setReservationTime("");
      setReservationDate("");
    } else {
      // Add new guest to waitlist
      const newId = addToWaitlist(
        guestName.trim(),
        partySize,
        specialRequests.trim() || undefined,
        myEntry.type,
        myEntry.eventId,
        myEntry.queueId,
        undefined, // No reservationTime for waitlist
        (localId, remoteId) => {
          setMyWaitlistIds(prev => prev.map(id => id === localId ? remoteId : id));
        }
      );

      setMyWaitlistIds([...myWaitlistIds, newId]);
      toast.success(`Added ${guestName} to the waitlist!`);

      setShowAddAnotherForm(false);
      setGuestName("");
      setPartySize(2);
      setSpecialRequests("");
    }
  };

  const handleLeaveWaitlist = () => {
    if (!selectedWaitlistId) return;

    removeFromWaitlist(selectedWaitlistId);
    setMyWaitlistIds(
      myWaitlistIds.filter((id) => id !== selectedWaitlistId),
    );
    setViewingStatus(false);
    setSelectedWaitlistId(null);

    toast.success(
      myEntry?.type === "reservation"
        ? "Reservation cancelled"
        : "Removed from waitlist",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col max-w-md mx-auto">
      <StatusBar isOnline={isOnline} isSyncing={isSyncing} />

      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          {menuOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-xl font-semibold">Waitlist</h1>
          <p className="text-xs text-gray-500">Guest View</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onLogout}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            title="Logout"
          >
            <LogOut className="w-5 h-5 text-gray-600" />
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <button
            onClick={() => {
              setShowMyEvents(true);
              setMenuOpen(false);
            }}
            className="w-full p-4 text-left hover:bg-gray-100 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="font-semibold">My Events</div>
              {myWaitlistIds.length > 0 && (
                <span className="bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                  {myWaitlistIds.length}
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

      {!isOnWaitlist || !viewingStatus ? (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            {/* Event Selection Screen */}
            {joinType === "event-selection" && (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      setJoinType("choice");
                      setSelectedEvent(null);
                      setEventCode("");
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                  >
                    ← Back
                  </button>
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-10 h-10 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Select Event
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Enter event code or scan QR code
                  </p>
                </div>

                {/* Event Code Input */}
                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Event Code or Name
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={eventCode}
                      onChange={(e) =>
                        setEventCode(e.target.value)
                      }
                      onKeyPress={(e) =>
                        e.key === "Enter" && handleFindEvent()
                      }
                      placeholder="e.g., PARK2024 or Theme Park"
                      className="flex-1 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    <button
                      onClick={handleFindEvent}
                      className="bg-purple-600 hover:bg-purple-700 text-white px-6 rounded-lg font-semibold active:scale-95 transition-transform"
                    >
                      <Search className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Browse Available Events */}
                {availableEvents.filter((e) => e.isPublic)
                  .length > 0 && (
                    <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                      <h3 className="text-sm font-medium text-gray-700 mb-3">
                        Active Events
                      </h3>
                      <div className="space-y-2">
                        {availableEvents
                          .filter((event) => event.isPublic)
                          .map((event) => {
                            // Calculate queue capacity status for capacity-based events
                            let capacityBadge: {
                              text: string;
                              color: string;
                            } | null = null;
                            let isFull = false;

                            if (event.type === "capacity-based") {
                              const capacityEvent =
                                event as CapacityBasedEvent;

                              if (
                                capacityEvent.queueMode ===
                                "single"
                              ) {
                                // Single queue mode
                                const queueCapacity =
                                  capacityEvent.capacity || 0;
                                let currentQueueSize =
                                  allWaitlistEntries
                                    .filter(
                                      (e) =>
                                        e.eventId === event.id,
                                    )
                                    .reduce(
                                      (sum, e) =>
                                        sum + e.partySize,
                                      0,
                                    );
                                // Add manual offset
                                currentQueueSize += (capacityEvent.manualOffset || 0);

                                const spotsLeft =
                                  queueCapacity -
                                  currentQueueSize;
                                const percentFilled =
                                  queueCapacity > 0
                                    ? (currentQueueSize /
                                      queueCapacity) *
                                    100
                                    : 0;

                                // Check if full
                                if (spotsLeft <= 0) {
                                  isFull = true;
                                }

                                // Determine badge based on capacity status
                                if (
                                  spotsLeft <= 10 &&
                                  spotsLeft > 0
                                ) {
                                  capacityBadge = {
                                    text: `${spotsLeft} spots left`,
                                    color:
                                      "bg-red-100 text-red-700",
                                  };
                                } else if (spotsLeft == 0) {
                                  capacityBadge = {
                                    text: "Queue Full",
                                    color:
                                      "bg-red-100 text-red-700",
                                  };
                                } else if (percentFilled >= 80) {
                                  capacityBadge = {
                                    text: "Almost Full",
                                    color:
                                      "bg-red-100 text-red-700",
                                  };
                                } else if (percentFilled >= 50) {
                                  capacityBadge = {
                                    text: "Filling Up",
                                    color:
                                      "bg-amber-100 text-amber-700",
                                  };
                                }
                              } else if (
                                capacityEvent.queueMode === "multiple"
                              ) {
                                // Multi-queue mode - check if ALL queues are full
                                const allQueues =
                                  capacityEvent.queues || [];
                                const allQueuesFull = allQueues.every(
                                  (queue) => {
                                    const queueCapacity =
                                      queue.capacity;
                                    let currentQueueSize =
                                      allWaitlistEntries
                                        .filter(
                                          (e) =>
                                            e.eventId ===
                                            event.id &&
                                            e.queueId === queue.id,
                                        )
                                        .reduce(
                                          (sum, e) =>
                                            sum + e.partySize,
                                          0,
                                        );
                                    // Add manual offset for this queue
                                    currentQueueSize += (queue.manualOffset || 0);
                                    return (
                                      queueCapacity -
                                      currentQueueSize <=
                                      0
                                    );
                                  },
                                );

                                if (allQueuesFull && allQueues.length > 0) {
                                  isFull = true;
                                  capacityBadge = {
                                    text: "All Queues Full",
                                    color:
                                      "bg-red-100 text-red-700",
                                  };
                                }
                              }
                              // For multi-queue, we can't show a single badge since each queue has different capacity
                            }

                            return { event, capacityBadge, isFull };
                          })
                          .sort((a, b) => {
                            // Sort: non-full events first, then full events
                            if (a.isFull && !b.isFull) return 1;
                            if (!a.isFull && b.isFull) return -1;
                            return 0;
                          })
                          .map(({ event, capacityBadge, isFull }) => {
                            return (
                              <button
                                key={event.id}
                                onClick={() => {
                                  if (isFull) {
                                    toast.error(
                                      "This event is currently full",
                                    );
                                    return;
                                  }
                                  setSelectedEvent(event);
                                  toast.success(
                                    `Selected: ${event.name}`,
                                  );
                                  if (
                                    event.type === "table-based"
                                  ) {
                                    setJoinType("choice");
                                  } else {
                                    // Capacity-based event
                                    const capacityEvent =
                                      event as CapacityBasedEvent;
                                    if (
                                      capacityEvent.queueMode ===
                                      "multiple" &&
                                      capacityEvent.queues &&
                                      capacityEvent.queues
                                        .length > 0
                                    ) {
                                      // Multiple queues - show queue selection
                                      setJoinType(
                                        "queue-selection",
                                      );
                                    } else {
                                      // Single queue - go directly to waitlist form
                                      setJoinType("waitlist");
                                    }
                                  }
                                }}
                                disabled={isFull}
                                className={`w-full text-left p-3 border rounded-lg transition-colors ${isFull
                                  ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                  : "border-gray-200 hover:bg-blue-50 hover:border-blue-300"
                                  }`}
                              >
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div
                                      className={`font-medium ${isFull
                                        ? "text-gray-400"
                                        : ""
                                        }`}
                                    >
                                      {event.name}
                                    </div>
                                    <div
                                      className={`text-xs mt-1 ${isFull
                                        ? "text-gray-400"
                                        : "text-gray-500"
                                        }`}
                                    >
                                      {event.type ===
                                        "capacity-based"
                                        ? "Queue Line"
                                        : "Table Service"}
                                    </div>
                                  </div>
                                  {capacityBadge && (
                                    <div
                                      className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2`}
                                    >
                                      {capacityBadge.text}
                                    </div>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}

                {/* QR Code Scan Option */}
                <button
                  onClick={() => setShowScanner(true)}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
                >
                  <QrCode className="w-6 h-6" />
                  Scan Event QR Code
                </button>

                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className="w-full text-xs text-gray-500 py-2"
                >
                  Toggle {isOnline ? "Offline" : "Online"} Mode
                </button>
              </>
            )}

            {/* Choice Screen - After Event Selection */}
            {joinType === "choice" && !selectedEvent && (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    Welcome
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Select an event to get started
                  </p>
                </div>

                <button
                  onClick={() => setJoinType("event-selection")}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <Ticket className="w-8 h-8" />
                  <span className="text-lg">Join an Event</span>
                  <span className="text-sm opacity-90">
                    Enter code or scan QR
                  </span>
                </button>

                {myWaitlistIds.length > 0 && (
                  <button
                    onClick={() => setShowMyEvents(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                  >
                    <Ticket className="w-6 h-6" />
                    View My Events ({myWaitlistIds.length})
                  </button>
                )}

                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className="w-full text-xs text-gray-500 py-2"
                >
                  Toggle {isOnline ? "Offline" : "Online"} Mode
                </button>
              </>
            )}

            {/* Queue Selection Screen (Multiple-queue capacity events only) */}
            {joinType === "queue-selection" &&
              selectedEvent &&
              selectedEvent.type === "capacity-based" && (
                <>
                  <div className="text-center mb-8">
                    <button
                      onClick={() => {
                        setSelectedEvent(null);
                        setSelectedQueue(null);
                        setJoinType("event-selection");
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                    >
                      ← Change event
                    </button>
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <ListOrdered className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {selectedEvent.name}
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Select which queue to join
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">
                      Available Queues
                    </h3>
                    <div className="space-y-3">
                      {(
                        selectedEvent as CapacityBasedEvent
                      ).queues
                        ?.map((queue) => {
                          // Calculate live count from waitlist entries (sum party sizes)
                          let liveCount = allWaitlistEntries
                            .filter(
                              (e) =>
                                e.eventId === selectedEvent.id &&
                                e.queueId === queue.id,
                            )
                            .reduce(
                              (sum, e) => sum + e.partySize,
                              0,
                            );
                          // Add manual offset
                          liveCount += (queue.manualOffset || 0);

                          const queuePercentage =
                            (liveCount / queue.capacity) * 100;
                          const spotsLeft =
                            queue.capacity - liveCount;
                          const isFull = spotsLeft <= 0;

                          return {
                            queue,
                            liveCount,
                            queuePercentage,
                            spotsLeft,
                            isFull,
                          };
                        })
                        .sort((a, b) => {
                          // Sort: non-full queues first, then full queues
                          if (a.isFull && !b.isFull) return 1;
                          if (!a.isFull && b.isFull) return -1;
                          return 0;
                        })
                        .map(({ queue, liveCount, queuePercentage, spotsLeft, isFull }) => {
                          const getQueueColor = () => {
                            if (queuePercentage < 50)
                              return "text-green-600";
                            if (queuePercentage < 80)
                              return "text-amber-600";
                            return "text-red-600";
                          };

                          // Calculate capacity badge
                          let capacityBadge: {
                            text: string;
                            color: string;
                          } | null = null;

                          if (spotsLeft <= 0) {
                            capacityBadge = {
                              text: "Queue Full",
                              color: "bg-red-100 text-red-700",
                            };
                          } else if (spotsLeft <= 10 && spotsLeft > 0) {
                            capacityBadge = {
                              text: `${spotsLeft} spots left`,
                              color: "bg-red-100 text-red-700",
                            };
                          } else if (queuePercentage >= 80) {
                            capacityBadge = {
                              text: "Almost Full",
                              color: "bg-red-100 text-red-700",
                            };
                          } else if (queuePercentage >= 50) {
                            capacityBadge = {
                              text: "Filling Up",
                              color:
                                "bg-amber-100 text-amber-700",
                            };
                          }

                          return (
                            <button
                              key={queue.id}
                              onClick={() => {
                                if (isFull) {
                                  toast.error(
                                    "This queue is currently full",
                                  );
                                  return;
                                }
                                setSelectedQueue(queue);
                                setJoinType("waitlist");
                                toast.success(
                                  `Selected: ${queue.name}`,
                                );
                              }}
                              disabled={isFull}
                              className={`w-full text-left p-4 border-2 rounded-xl transition-all ${isFull
                                ? "border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed"
                                : "border-gray-200 hover:bg-blue-50 hover:border-blue-400"
                                }`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <div
                                  className={`font-semibold text-lg ${isFull ? "text-gray-400" : ""
                                    }`}
                                >
                                  {queue.name}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div
                                    className={`text-sm font-medium ${isFull
                                      ? "text-gray-400"
                                      : getQueueColor()
                                      }`}
                                  >
                                    {Math.round(queuePercentage)}%
                                  </div>
                                  {capacityBadge && (
                                    <div
                                      className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap`}
                                    >
                                      {capacityBadge.text}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div
                                className={`flex items-center gap-2 text-sm mb-2 ${isFull
                                  ? "text-gray-400"
                                  : "text-gray-600"
                                  }`}
                              >
                                <Users className="w-4 h-4" />
                                <span>
                                  {liveCount} / {queue.capacity}{" "}
                                  in queue
                                </span>
                              </div>
                              <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all ${queuePercentage < 50
                                    ? "bg-green-500"
                                    : queuePercentage < 80
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                    }`}
                                  style={{
                                    width: `${Math.min(queuePercentage, 100)}%`,
                                  }}
                                />
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className="w-full text-xs text-gray-500 py-2"
                  >
                    Toggle {isOnline ? "Offline" : "Online"}{" "}
                    Mode
                  </button>
                </>
              )}

            {/* Reservation vs Waitlist Choice (Table-based events only) */}
            {joinType === "choice" &&
              selectedEvent &&
              selectedEvent.type === "table-based" && (
                <>
                  <div className="text-center mb-8">
                    <button
                      onClick={() => {
                        setSelectedEvent(null);
                        setJoinType("event-selection");
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                    >
                      ← Change event
                    </button>
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {selectedEvent.name}
                    </h2>
                    <p className="text-gray-600 text-sm">
                      How would you like to join?
                    </p>
                  </div>

                  <button
                    onClick={() => setJoinType("reservation")}
                    disabled={allTablesOccupied}
                    className={`w-full py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform ${allTablesOccupied
                      ? "bg-gray-300 text-gray-500 cursor-not-allowed"
                      : "bg-green-600 hover:bg-green-700 text-white"
                      }`}
                  >
                    <Calendar className="w-8 h-8" />
                    <span className="text-lg">
                      {allTablesOccupied
                        ? "Reservations Full"
                        : "Make a Reservation"}
                    </span>
                    {!allTablesOccupied && (
                      <span className="text-sm opacity-90">
                        Immediate seating available
                      </span>
                    )}
                  </button>

                  <button
                    onClick={() => setJoinType("waitlist")}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                  >
                    <ListOrdered className="w-8 h-8" />
                    <span className="text-lg">
                      Join Waitlist
                    </span>
                    <span className="text-sm opacity-90">
                      Get in line for next available table
                    </span>
                  </button>
                </>
              )}

            {/* Form Screen (Reservation or Waitlist) */}
            {(joinType === "reservation" ||
              joinType === "waitlist") &&
              selectedEvent && (
                <>
                  <div className="text-center mb-8">
                    <button
                      onClick={() => {
                        if (
                          selectedEvent.type === "table-based"
                        ) {
                          setJoinType("choice");
                        } else {
                          setJoinType("event-selection");
                          setSelectedEvent(null);
                        }
                      }}
                      className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                    >
                      ← Back
                    </button>
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Users className="w-10 h-10 text-blue-600" />
                    </div>
                    <h2 className="text-2xl font-semibold mb-2">
                      {joinType === "reservation"
                        ? "Make a Reservation"
                        : "Join the Waitlist"}
                    </h2>
                    <p className="text-gray-600 text-sm mb-1">
                      {selectedEvent.name}
                    </p>
                    <p className="text-gray-500 text-xs">
                      {joinType === "reservation"
                        ? "Complete the form to reserve your table"
                        : "Fill out your details to join the queue"}
                    </p>
                  </div>

                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Your Name
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) =>
                          setGuestName(e.target.value)
                        }
                        placeholder="Enter your name"
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Party Size
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={
                          selectedEvent.type ===
                            "capacity-based" &&
                            joinType === "waitlist"
                            ? (() => {
                              const capacityEvent =
                                selectedEvent as CapacityBasedEvent;
                              let queueCapacity = 0;
                              let currentQueueSize = 0;

                              if (
                                capacityEvent.queueMode ===
                                "single"
                              ) {
                                queueCapacity =
                                  capacityEvent.capacity || 0;
                                currentQueueSize =
                                  allWaitlistEntries
                                    .filter(
                                      (e) =>
                                        e.eventId ===
                                        selectedEvent.id,
                                    )
                                    .reduce(
                                      (sum, e) =>
                                        sum + e.partySize,
                                      0,
                                    );
                                // Add manual offset
                                currentQueueSize += (capacityEvent.manualOffset || 0);
                              } else if (selectedQueue) {
                                queueCapacity =
                                  selectedQueue.capacity;
                                currentQueueSize =
                                  allWaitlistEntries
                                    .filter(
                                      (e) =>
                                        e.eventId ===
                                        selectedEvent.id &&
                                        e.queueId ===
                                        selectedQueue.id,
                                    )
                                    .reduce(
                                      (sum, e) =>
                                        sum + e.partySize,
                                      0,
                                    );
                                // Add manual offset for this queue
                                currentQueueSize += (selectedQueue.manualOffset || 0);
                              }

                              return (
                                queueCapacity -
                                currentQueueSize
                              );
                            })()
                            : undefined
                        }
                        value={partySize}
                        onChange={(e) =>
                          setPartySize(Number(e.target.value))
                        }
                        placeholder="Number of people"
                        className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {selectedEvent.type ===
                        "capacity-based" &&
                        joinType === "waitlist" &&
                        (() => {
                          const capacityEvent =
                            selectedEvent as CapacityBasedEvent;
                          let queueCapacity = 0;
                          let currentQueueSize = 0;

                          if (
                            capacityEvent.queueMode === "single"
                          ) {
                            queueCapacity =
                              capacityEvent.capacity || 0;
                            currentQueueSize =
                              allWaitlistEntries
                                .filter(
                                  (e) =>
                                    e.eventId ===
                                    selectedEvent.id,
                                )
                                .reduce(
                                  (sum, e) => sum + e.partySize,
                                  0,
                                );
                            // Add manual offset
                            currentQueueSize += (capacityEvent.manualOffset || 0);
                          } else if (selectedQueue) {
                            queueCapacity =
                              selectedQueue.capacity;
                            currentQueueSize =
                              allWaitlistEntries
                                .filter(
                                  (e) =>
                                    e.eventId ===
                                    selectedEvent.id &&
                                    e.queueId ===
                                    selectedQueue.id,
                                )
                                .reduce(
                                  (sum, e) => sum + e.partySize,
                                  0,
                                );
                            // Add manual offset for this queue
                            currentQueueSize += (selectedQueue.manualOffset || 0);
                          }

                          const spotsLeft =
                            queueCapacity - currentQueueSize;

                          if (spotsLeft <= 0) {
                            return (
                              <p className="text-xs text-red-600 mt-1 font-medium">
                                This queue is currently full
                              </p>
                            );
                          } else if (spotsLeft <= 10) {
                            return (
                              <p className="text-xs text-amber-600 mt-1">
                                Only {spotsLeft} spot
                                {spotsLeft === 1
                                  ? ""
                                  : "s"}{" "}
                                remaining
                              </p>
                            );
                          } else {
                            return (
                              <p className="text-xs text-gray-500 mt-1">
                                {spotsLeft} spots available
                              </p>
                            );
                          }
                        })()}
                    </div>

                    {joinType === "reservation" && (
                      <>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reservation Date
                          </label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="date"
                              value={reservationDate}
                              onChange={(e) =>
                                setReservationDate(
                                  e.target.value,
                                )
                              }
                              className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Reservation Time{" "}
                          </label>
                          <div className="relative">
                            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                              type="time"
                              value={reservationTime}
                              onChange={(e) =>
                                setReservationTime(
                                  e.target.value,
                                )
                              }
                              className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {selectedEvent.type === "table-based" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Special Requests{" "}
                          <span className="text-gray-400 font-normal">
                            (Optional)
                          </span>
                        </label>
                        <textarea
                          value={specialRequests}
                          onChange={(e) =>
                            setSpecialRequests(e.target.value)
                          }
                          placeholder="Dietary restrictions, seating preferences, etc."
                          rows={3}
                          className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                          style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                        />
                      </div>
                    )}

                  </div>

                  <button
                    onClick={handleJoinManually}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform shadow-lg"
                  >
                    {joinType === "reservation"
                      ? "Confirm Reservation"
                      : "Join Queue"}
                  </button>

                  <button
                    onClick={() => setIsOnline(!isOnline)}
                    className="w-full text-xs text-gray-500 py-2"
                  >
                    Toggle {isOnline ? "Offline" : "Online"}{" "}
                    Mode
                  </button>
                </>
              )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-full max-w-sm space-y-6">
            <div className="text-center mb-8">
              <button
                onClick={() => setViewingStatus(false)}
                className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
              >
                ← Back to menu
              </button>

              {/* Event Switcher Dropdown - only show if user has multiple events */}
              {myWaitlistIds.length > 1 && (
                <div className="mb-6">
                  <label className="block text-xs text-gray-500 mb-2">
                    Switch Event
                  </label>
                  <select
                    value={selectedWaitlistId || ""}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedWaitlistId(newId);
                      const entry = allWaitlistEntries.find(
                        (entry) => entry.id === newId,
                      );
                      const event = availableEvents.find(
                        (ev) => ev.id === entry?.eventId,
                      );
                      toast.success(
                        `Switched to ${event?.name || "event"}`,
                      );
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    {myWaitlistIds.map((id) => {
                      const entry = allWaitlistEntries.find(
                        (e) => e.id === id,
                      );
                      if (!entry) return null;

                      const event = availableEvents.find(
                        (e) => e.id === entry.eventId,
                      );
                      const eventName =
                        event?.name || "Unknown Event";

                      // Get queue name if applicable
                      const queueName = entry.queueId
                        ? (() => {
                          if (
                            event &&
                            event.type === "capacity-based"
                          ) {
                            const capacityEvent =
                              event as CapacityBasedEvent;
                            const queue =
                              capacityEvent.queues?.find(
                                (q) => q.id === entry.queueId,
                              );
                            return queue?.name;
                          }
                          return undefined;
                        })()
                        : undefined;

                      const fullDisplayName = queueName
                        ? `${queueName} - ${eventName}`
                        : eventName;

                      // Calculate position
                      const sameTypeEntries =
                        allWaitlistEntries.filter(
                          (e) =>
                            e.type === entry.type &&
                            e.eventId === entry.eventId,
                        );
                      const pos =
                        sameTypeEntries.findIndex(
                          (e) => e.id === id,
                        ) + 1;

                      return (
                        <option key={id} value={id}>
                          {fullDisplayName} - {entry.name}{" "}
                          {entry.type === "waitlist"
                            ? `(#${pos})`
                            : entry.reservationTime
                              ? `(${entry.reservationTime.toLocaleDateString([], { month: "short", day: "numeric" })} at ${entry.reservationTime.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })})`
                              : "(Reservation)"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div
                className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${myEntry?.type === "reservation"
                  ? "bg-green-100"
                  : "bg-blue-100"
                  }`}
              >
                <div className="text-center">
                  {myEntry?.type === "reservation" ? (
                    <Calendar
                      className={`w-16 h-16 ${myEntry?.type === "reservation" ? "text-green-600" : "text-blue-600"}`}
                    />
                  ) : (
                    <div className="text-6xl font-bold text-blue-600">
                      #{position}
                    </div>
                  )}
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                {myEntry?.type === "reservation"
                  ? "Your Reservation"
                  : "Your Position"}
              </h2>

              {myEntry?.type === "reservation" &&
                myEntry?.reservationTime && (
                  <div className="mb-2">
                    <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
                      <Clock className="w-5 h-5 text-green-700" />
                      <span className="text-xl font-bold text-green-700">
                        {myEntry.reservationTime.toLocaleDateString(
                          [],
                          {
                            month: "short",
                            day: "numeric",
                          },
                        )}{" "}
                        at{" "}
                        {myEntry.reservationTime.toLocaleTimeString(
                          [],
                          {
                            hour: "numeric",
                            minute: "2-digit",
                          },
                        )}
                      </span>
                    </div>
                  </div>
                )}

              <p className="text-gray-600">
                {myEntry?.type === "reservation"
                  ? "You will be seated shortly"
                  : position === 1
                    ? "You're next!"
                    : estimatedWaitMinutes === 0
                      ? "Almost there!"
                      : `${position - 1} ${position - 1 === 1 ? "party" : "parties"} ahead of you`}
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
              {myEntry?.type === "waitlist" && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <span className="font-medium">
                      Estimated Wait
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    ~{estimatedWaitMinutes} min
                  </div>
                </div>
              )}

              {myEntry?.type === "reservation" &&
                myEntry?.reservationTime && (
                  <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                      <Clock className="w-6 h-6 text-green-600" />
                      <span className="font-medium">
                        Reservation Time
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {myEntry.reservationTime.toLocaleTimeString(
                          [],
                          { hour: "numeric", minute: "2-digit" },
                        )}
                      </div>
                      <div className="text-sm text-green-700">
                        {myEntry.reservationTime.toLocaleDateString(
                          [],
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
                        )}
                      </div>
                    </div>
                  </div>
                )}

              <div
                className={
                  myEntry?.type === "waitlist" ||
                    (myEntry?.type === "reservation" &&
                      myEntry?.reservationTime)
                    ? "pt-0"
                    : ""
                }
              >
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-gray-600">
                    Guest Name
                  </span>
                  <span className="font-semibold">
                    {myEntry?.name}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">
                    Party Size
                  </span>
                  <span className="font-semibold">
                    {myEntry?.partySize} people
                  </span>
                </div>
                {myEntry?.specialRequests && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">
                      Special Requests
                    </div>
                    <div className="text-sm font-medium break-words overflow-hidden">
                      {myEntry.specialRequests}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div
              className={`border rounded-xl p-4 text-sm ${myEntry?.type === "reservation"
                ? "bg-green-50 border-green-200 text-green-800"
                : "bg-blue-50 border-blue-200 text-blue-800"
                }`}
            >
              <p className="text-center">
                {myEntry?.type === "reservation"
                  ? "✓ Your table is being prepared. A staff member will seat you shortly!"
                  : "💡 You'll be notified when it's your turn. Please stay nearby!"}
              </p>
            </div>

            <button
              onClick={() => {
                // Pre-fill form with current reservation data if editing a reservation
                if (isTableBasedReservation && myEntry) {
                  setGuestName(myEntry.name);
                  setPartySize(myEntry.partySize);
                  setSpecialRequests(
                    myEntry.specialRequests || "",
                  );
                  if (myEntry.reservationTime) {
                    const resDate = myEntry.reservationTime;
                    // Set date
                    const year = resDate.getFullYear();
                    const month = (resDate.getMonth() + 1)
                      .toString()
                      .padStart(2, "0");
                    const day = resDate
                      .getDate()
                      .toString()
                      .padStart(2, "0");
                    setReservationDate(
                      `${year}-${month}-${day}`,
                    );
                    // Set time
                    const hours = resDate
                      .getHours()
                      .toString()
                      .padStart(2, "0");
                    const minutes = resDate
                      .getMinutes()
                      .toString()
                      .padStart(2, "0");
                    setReservationTime(`${hours}:${minutes}`);
                  } else {
                    setReservationDate("");
                    setReservationTime("");
                  }
                }
                setShowAddAnotherForm(true);
              }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              {isTableBasedReservation ? (
                <>
                  <Calendar className="w-5 h-5" />
                  Edit Reservation
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Add Another Guest
                </>
              )}
            </button>

            <button
              onClick={handleLeaveWaitlist}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform"
            >
              {myEntry?.type === "reservation"
                ? "Cancel Reservation"
                : "Leave Waitlist"}
            </button>

            <button
              onClick={() => setIsOnline(!isOnline)}
              className="w-full text-xs text-gray-500 py-2"
            >
              Toggle {isOnline ? "Offline" : "Online"} Mode
            </button>
          </div>
        </div>
      )}

      {showProfile && (
        <Profile
          user={user}
          onClose={() => setShowProfile(false)}
          onLogout={onLogout}
        />
      )}

      {showMyEvents && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
              <h2 className="text-2xl font-bold text-gray-800">
                My Events
              </h2>
              <button
                onClick={() => setShowMyEvents(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {myWaitlistIds.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-10 h-10 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    No Active Events
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    You're not currently on any waitlists
                  </p>
                  <button
                    onClick={() => {
                      setShowMyEvents(false);
                      setJoinType("event-selection");
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                  >
                    Join an Event
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    You're currently on {myWaitlistIds.length}{" "}
                    {myWaitlistIds.length === 1
                      ? "waitlist"
                      : "waitlists"}
                  </p>
                  {myWaitlistIds.map((id) => {
                    const entry = allWaitlistEntries.find(
                      (e) => e.id === id,
                    );
                    if (!entry) return null; // Entry was removed

                    const event = availableEvents.find(
                      (e) => e.id === entry.eventId,
                    );
                    const eventName =
                      event?.name || "Unknown Event";

                    // Get queue name if applicable
                    const queueName = entry.queueId
                      ? (() => {
                        if (
                          event &&
                          event.type === "capacity-based"
                        ) {
                          const capacityEvent =
                            event as CapacityBasedEvent;
                          const queue =
                            capacityEvent.queues?.find(
                              (q) => q.id === entry.queueId,
                            );
                          return queue?.name;
                        }
                        return undefined;
                      })()
                      : undefined;

                    const fullDisplayName = queueName
                      ? `${queueName} - ${eventName}`
                      : eventName;

                    // Calculate position for this entry
                    const sameTypeEntries =
                      allWaitlistEntries.filter(
                        (e) =>
                          e.type === entry.type &&
                          e.eventId === entry.eventId,
                      );
                    const pos =
                      sameTypeEntries.findIndex(
                        (e) => e.id === id,
                      ) + 1;

                    // Calculate dynamic wait time
                    const dynamicWaitTime =
                      calculateDynamicWaitTime(
                        entry,
                        allWaitlistEntries,
                      );

                    // Calculate queue capacity status for capacity-based events
                    let capacityBadge: {
                      text: string;
                      color: string;
                    } | null = null;

                    if (
                      event &&
                      event.type === "capacity-based"
                    ) {
                      const capacityEvent =
                        event as CapacityBasedEvent;
                      let queueCapacity = 0;
                      let currentQueueSize = 0;

                      // Determine which queue we're looking at
                      if (
                        capacityEvent.queueMode === "single"
                      ) {
                        queueCapacity =
                          capacityEvent.capacity || 0;
                        currentQueueSize = allWaitlistEntries
                          .filter((e) => e.eventId === event.id)
                          .reduce(
                            (sum, e) => sum + e.partySize,
                            0,
                          );
                        // Add manual offset
                        currentQueueSize += (capacityEvent.manualOffset || 0);
                      } else {
                        // Multi-queue mode
                        const queue =
                          capacityEvent.queues?.find(
                            (q) => q.id === entry.queueId,
                          );
                        if (queue) {
                          queueCapacity = queue.capacity;
                          currentQueueSize = allWaitlistEntries
                            .filter(
                              (e) =>
                                e.eventId === event.id &&
                                e.queueId === entry.queueId,
                            )
                            .reduce(
                              (sum, e) => sum + e.partySize,
                              0,
                            );
                          // Add manual offset for this queue
                          currentQueueSize += (queue.manualOffset || 0);
                        }
                      }

                      const spotsLeft =
                        queueCapacity - currentQueueSize;
                      const percentFilled =
                        queueCapacity > 0
                          ? (currentQueueSize / queueCapacity) *
                          100
                          : 0;

                      // Determine badge based on capacity status
                      if (spotsLeft <= 10 && spotsLeft > 0) {
                        capacityBadge = {
                          text: `${spotsLeft} spots left`,
                          color: "bg-red-100 text-red-700",
                        };
                      } else if (percentFilled >= 80) {
                        capacityBadge = {
                          text: "Almost Full",
                          color: "bg-red-100 text-red-700",
                        };
                      } else if (percentFilled >= 50) {
                        capacityBadge = {
                          text: "Filling Up",
                          color: "bg-amber-100 text-amber-700",
                        };
                      }
                    }

                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setSelectedWaitlistId(id);
                          setViewingStatus(true);
                          setShowMyEvents(false);
                        }}
                        className="w-full p-4 border-2 border-gray-200 rounded-xl hover:border-blue-400 hover:bg-blue-50 transition-all text-left"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-800">
                              {fullDisplayName}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {entry.name}
                            </p>
                          </div>
                          <div className="flex flex-col gap-1 items-end">
                            {entry.type === "reservation" ? (
                              <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                                Reservation
                              </div>
                            ) : (
                              <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                                {event?.type === "capacity-based"
                                  ? "Queue"
                                  : "Waitlist"}
                              </div>
                            )}
                            {capacityBadge && (
                              <div
                                className={`${capacityBadge.color} text-xs font-semibold px-2 py-1 rounded whitespace-nowrap`}
                              >
                                {capacityBadge.text}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {entry.type === "waitlist" && (
                            <div className="flex items-center gap-1">
                              <ListOrdered className="w-4 h-4" />
                              <span>Position #{pos}</span>
                            </div>
                          )}
                          {entry.type === "reservation" &&
                            entry.reservationTime && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4 text-green-600" />
                                <span className="font-semibold text-green-700">
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
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {entry.partySize}{" "}
                              {entry.partySize === 1
                                ? "person"
                                : "people"}
                            </span>
                          </div>
                          {entry.type === "waitlist" &&
                            dynamicWaitTime > 0 && (
                              <div className="flex items-center gap-1">
                                <Clock className="w-4 h-4" />
                                <span>
                                  ~{dynamicWaitTime} min
                                </span>
                              </div>
                            )}
                        </div>

                        {entry.specialRequests && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500 break-words">
                              Note: {entry.specialRequests}
                            </p>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowMyEvents(false);
                        setJoinType("event-selection");
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <Ticket className="w-5 h-5" />
                      Join Another Event
                    </button>
                  </div>
                </>
              )}

              {/* Past Events Section - Always visible */}
              <div className="pt-6 mt-6 border-t-2 border-gray-300">
                <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-gray-500" />
                  Past Events
                </h3>
                {pastEvents.length > 0 ? (
                  <div className="space-y-3">
                    {pastEvents.map((event) => (
                      <div
                        key={event.id}
                        className="p-4 border-2 border-gray-200 rounded-xl bg-gray-50 opacity-75"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h4 className="font-semibold text-gray-800">
                              {event.eventName}
                            </h4>
                            <p className="text-sm text-gray-600">
                              {event.name}
                            </p>
                          </div>
                          <div className="bg-gray-300 text-gray-700 text-xs font-semibold px-2 py-1 rounded">
                            Seated
                          </div>
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>
                              {event.partySize}{" "}
                              {event.partySize === 1
                                ? "person"
                                : "people"}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="w-4 h-4" />
                            <span>
                              {event.seatedAt.toLocaleDateString(
                                [],
                                {
                                  month: "short",
                                  day: "numeric",
                                },
                              )}{" "}
                              at{" "}
                              {event.seatedAt.toLocaleTimeString(
                                [],
                                {
                                  hour: "numeric",
                                  minute: "2-digit",
                                },
                              )}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">
                      No past events yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showScanner && (
        <QRScanner
          onScan={handleScanSuccess}
          onClose={() => setShowScanner(false)}
        />
      )}

      {showAddAnotherForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-6 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">
                {isTableBasedReservation
                  ? "Edit Reservation"
                  : "Add Another Guest"}
              </h3>
              <button
                onClick={() => {
                  setShowAddAnotherForm(false);
                  setGuestName("");
                  setPartySize(2);
                  setSpecialRequests("");
                  setReservationTime("");
                  setReservationDate("");
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isTableBasedReservation
                    ? "Your Name"
                    : "Guest Name"}
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={
                    isTableBasedReservation
                      ? "Enter your name"
                      : "Enter guest name"
                  }
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Party Size
                </label>
                <input
                  type="number"
                  min="1"
                  value={partySize}
                  onChange={(e) =>
                    setPartySize(Number(e.target.value))
                  }
                  placeholder="Number of people"
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {isTableBasedReservation && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reservation Date{" "}
                      <span className="text-gray-400 font-normal">
                        (Optional)
                      </span>
                    </label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="date"
                        value={reservationDate}
                        onChange={(e) =>
                          setReservationDate(e.target.value)
                        }
                        className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reservation Time{" "}
                    </label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <input
                        type="time"
                        value={reservationTime}
                        onChange={(e) =>
                          setReservationTime(e.target.value)
                        }
                        className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Requests{" "}
                      <span className="text-gray-400 font-normal">
                        (Optional)
                      </span>
                    </label>
                    <textarea
                      value={specialRequests}
                      onChange={(e) =>
                        setSpecialRequests(e.target.value)
                      }
                      placeholder="Dietary restrictions, seating preferences, etc."
                      rows={3}
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}
                    />
                  </div>
                </>
              )}

            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAnotherForm(false);
                  setGuestName("");
                  setPartySize(2);
                  setSpecialRequests("");
                  setReservationTime("");
                  setReservationDate("");
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAnother}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                {isTableBasedReservation
                  ? "Save Changes"
                  : "Add to Waitlist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
