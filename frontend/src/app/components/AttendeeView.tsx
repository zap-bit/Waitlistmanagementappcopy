import { useState, useEffect } from 'react';
import { StatusBar } from './StatusBar';
import { QRScanner } from './QRScanner';
import { QrCode, Clock, Users, LogOut, X, Calendar, ListOrdered, Search, Ticket, User as UserIcon, Menu } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistEntry } from '../App';
import { Table } from './TableGrid';
import { getStoredEvents, Event, CapacityBasedEvent, Queue, syncEventsFromApi } from '../utils/events';
import { Profile, getSavedProfile } from './Profile';
import { User } from '../utils/auth';
import { calculateDynamicWaitTime } from '../utils/waitTime';

interface AttendeeViewProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  addToWaitlist: (name: string, partySize: number, specialRequests?: string, type?: 'reservation' | 'waitlist', eventId?: string, queueId?: string, reservationTime?: Date) => string;
  removeFromWaitlist: (id: string) => void;
  updateWaitlistEntry: (id: string, updates: Partial<Omit<WaitlistEntry, 'id' | 'joinedAt'>>) => void;
  allWaitlistEntries: WaitlistEntry[];
  tables: Table[];
  user: User;
}

export function AttendeeView({ onLogout, waitlist, addToWaitlist, removeFromWaitlist, updateWaitlistEntry, allWaitlistEntries, tables, user }: AttendeeViewProps) {
  // Store multiple waitlist IDs
  const [myWaitlistIds, setMyWaitlistIds] = useState<string[]>(() => {
    return [];
  });
  
  // Currently selected waitlist entry to view
  const [selectedWaitlistId, setSelectedWaitlistId] = useState<string | null>(null);
  
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [reservationTime, setReservationTime] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showAddAnotherForm, setShowAddAnotherForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showMyEvents, setShowMyEvents] = useState(false);

  // Update form fields when profile changes or on mount
  useEffect(() => {
    const savedProfile = getSavedProfile(user.id);
    if (savedProfile) {
      // Use saved profile if available
      setGuestName(savedProfile.displayName || '');
      setPartySize(savedProfile.defaultPartySize || 2);
      setSpecialRequests(savedProfile.preferences || '');
    } else {
      // For new users without a profile, autofill from User object
      setGuestName(user.name || '');
      setPartySize(2);
      setSpecialRequests('');
    }
  }, [user.id, user.name, showProfile]); // Re-run when showProfile changes (after closing profile modal)

  const [joinType, setJoinType] = useState<'choice' | 'event-selection' | 'reservation' | 'waitlist' | 'queue-selection'>('choice');
  const [viewingStatus, setViewingStatus] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedQueue, setSelectedQueue] = useState<Queue | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [isOnline, setIsOnline] = useState(() => {
    return true;
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Load available events on mount
  useEffect(() => {
    const loadEvents = async () => {
      await syncEventsFromApi();
      const events = getStoredEvents().filter(e => e.status === 'active');
      setAvailableEvents(events);
    };
    void loadEvents();
  }, []);

  useEffect(() => {}, [myWaitlistIds, isOnline]);

  // Find my entry in the waitlist or full list
  const myEntry = allWaitlistEntries.find((e) => e.id === selectedWaitlistId);
  const isOnWaitlist = !!myEntry;
  
  // Calculate position only for entries of the same type and event
  const sameTypeAndEventEntries = myEntry 
    ? allWaitlistEntries.filter(e => e.type === myEntry.type && e.eventId === myEntry.eventId) 
    : [];
  const position = myEntry ? sameTypeAndEventEntries.findIndex((e) => e.id === selectedWaitlistId) + 1 : 0;
  
  // Calculate dynamic wait time based on current position
  const estimatedWaitMinutes = myEntry ? calculateDynamicWaitTime(myEntry, allWaitlistEntries) : 0;
  
  // Check if all tables are occupied
  const allTablesOccupied = tables.every((table) => table.occupied);

  // Clear stored ID if entry no longer exists in waitlist
  useEffect(() => {
    if (selectedWaitlistId && !myEntry) {
      setMyWaitlistIds(myWaitlistIds.filter(id => id !== selectedWaitlistId));
      setViewingStatus(false);
      toast.info('You have been seated or removed from the waitlist');
    }
  }, [selectedWaitlistId, myEntry]);

  // Get event name for display
  const myEventName = myEntry?.eventId 
    ? availableEvents.find(e => e.id === myEntry.eventId)?.name || 'Event'
    : 'Event';
  
  // Get the full event object for the current entry
  const myEvent = myEntry?.eventId 
    ? availableEvents.find(e => e.id === myEntry.eventId)
    : null;
  
  // Check if current entry is a table-based reservation
  const isTableBasedReservation = myEntry?.type === 'reservation' && myEvent?.type === 'table-based';
  
  // Get queue name for display (if applicable)
  const myQueueName = myEntry?.queueId 
    ? (() => {
        const event = availableEvents.find(e => e.id === myEntry.eventId);
        if (event && event.type === 'capacity-based') {
          const capacityEvent = event as CapacityBasedEvent;
          const queue = capacityEvent.queues?.find(q => q.id === myEntry.queueId);
          return queue?.name;
        }
        return undefined;
      })()
    : undefined;
  
  // Full display name with queue if applicable
  const displayName = myQueueName ? `${myQueueName} - ${myEventName}` : myEventName;

  // Handler functions
  const handleFindEvent = () => {
    if (!eventCode.trim()) {
      toast.error('Please enter an event code or name');
      return;
    }

    const event = availableEvents.find(e => 
      e.code?.toLowerCase() === eventCode.toLowerCase() || 
      e.name.toLowerCase().includes(eventCode.toLowerCase())
    );

    if (event) {
      setSelectedEvent(event);
      toast.success(`Selected: ${event.name}`);
      if (event.type === 'table-based') {
        setJoinType('choice');
      } else {
        const capacityEvent = event as CapacityBasedEvent;
        if (capacityEvent.queueMode === 'multiple' && capacityEvent.queues && capacityEvent.queues.length > 0) {
          setJoinType('queue-selection');
        } else {
          setJoinType('waitlist');
        }
      }
    } else {
      toast.error('Event not found. Please check the code and try again.');
    }
  };

  const handleScanSuccess = (data: string) => {
    setShowScanner(false);
    
    try {
      // Try to parse as JSON (new format with queue info)
      const parsed = JSON.parse(data);
      
      if (parsed.type === 'waitlist-event' && parsed.eventId) {
        const event = availableEvents.find(e => e.id === parsed.eventId || e.code === parsed.eventCode);
        
        if (event) {
          setSelectedEvent(event);
          setEventCode(parsed.eventCode || event.code || '');
          
          // Check if this is a queue-specific QR code
          if (parsed.queueId && parsed.queueName) {
            // Direct queue assignment
            const capacityEvent = event as CapacityBasedEvent;
            const queue = capacityEvent.queues?.find(q => q.id === parsed.queueId);
            
            if (queue) {
              setSelectedQueue(queue);
              toast.success(`Found: ${parsed.queueName} - ${event.name}`);
              setJoinType('waitlist'); // Go straight to join form
            } else {
              toast.error('Queue not found.');
              setJoinType('event-selection');
            }
          } else {
            // Event-level QR code
            toast.success(`Found event: ${event.name}`);
            if (event.type === 'table-based') {
              setJoinType('choice');
            } else {
              const capacityEvent = event as CapacityBasedEvent;
              if (capacityEvent.queueMode === 'multiple' && capacityEvent.queues && capacityEvent.queues.length > 0) {
                setJoinType('queue-selection');
              } else {
                setJoinType('waitlist');
              }
            }
          }
        } else {
          toast.error('Event not found. Please try again.');
          setJoinType('event-selection');
        }
      } else {
        throw new Error('Invalid QR code format');
      }
    } catch (e) {
      // Fallback: treat as plain event code
      const event = availableEvents.find(e => e.code === data || e.id === data);
      
      if (event) {
        setSelectedEvent(event);
        setEventCode(data);
        toast.success(`Found event: ${event.name}`);
        if (event.type === 'table-based') {
          setJoinType('choice');
        } else {
          const capacityEvent = event as CapacityBasedEvent;
          if (capacityEvent.queueMode === 'multiple' && capacityEvent.queues && capacityEvent.queues.length > 0) {
            setJoinType('queue-selection');
          } else {
            setJoinType('waitlist');
          }
        }
      } else {
        toast.error('Invalid QR code. Event not found.');
        setJoinType('event-selection');
      }
    }
  };

  const handleJoinManually = () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!selectedEvent) {
      toast.error('No event selected');
      return;
    }

    // Create reservation time as a Date object in local timezone
    let reservationDateTime: Date | undefined = undefined;
    if (reservationTime) {
      const today = new Date();
      const [hours, minutes] = reservationTime.split(':');
      reservationDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
    }

    const newId = addToWaitlist(
      guestName.trim(), 
      partySize, 
      specialRequests.trim() || undefined,
      joinType as 'reservation' | 'waitlist',
      selectedEvent.id,
      selectedQueue?.id,
      reservationDateTime
    );
    
    setMyWaitlistIds([...myWaitlistIds, newId]);
    setSelectedWaitlistId(newId);
    setViewingStatus(true);
    
    toast.success(
      joinType === 'reservation' 
        ? 'Reservation confirmed!' 
        : 'Added to waitlist!'
    );

    setGuestName('');
    setPartySize(2);
    setSpecialRequests('');
    setReservationTime('');
    setJoinType('choice');
    setSelectedEvent(null);
    setSelectedQueue(null);
  };

  const handleAddAnother = () => {
    if (!guestName.trim()) {
      toast.error('Please enter a name');
      return;
    }

    if (!myEntry) {
      toast.error('No active waitlist');
      return;
    }

    // Check if we're editing a table-based reservation
    if (isTableBasedReservation && selectedWaitlistId) {
      // Update existing reservation
      let reservationDateTime: Date | undefined = undefined;
      if (reservationTime) {
        const today = new Date();
        const [hours, minutes] = reservationTime.split(':');
        reservationDateTime = new Date(today.getFullYear(), today.getMonth(), today.getDate(), parseInt(hours), parseInt(minutes));
      }

      updateWaitlistEntry(selectedWaitlistId, {
        name: guestName.trim(),
        partySize,
        specialRequests: specialRequests.trim() || undefined,
        reservationTime: reservationDateTime,
      });

      toast.success('Reservation updated!');
      setShowAddAnotherForm(false);
      setGuestName('');
      setPartySize(2);
      setSpecialRequests('');
      setReservationTime('');
    } else {
      // Add new guest to waitlist
      const newId = addToWaitlist(
        guestName.trim(), 
        partySize, 
        specialRequests.trim() || undefined,
        myEntry.type,
        myEntry.eventId,
        myEntry.queueId
      );
      
      setMyWaitlistIds([...myWaitlistIds, newId]);
      toast.success(`Added ${guestName} to the waitlist!`);
      
      setShowAddAnotherForm(false);
      setGuestName('');
      setPartySize(2);
      setSpecialRequests('');
    }
  };

  const handleLeaveWaitlist = () => {
    if (!selectedWaitlistId) return;
    
    removeFromWaitlist(selectedWaitlistId);
    setMyWaitlistIds(myWaitlistIds.filter(id => id !== selectedWaitlistId));
    setViewingStatus(false);
    setSelectedWaitlistId(null);
    
    toast.success(
      myEntry?.type === 'reservation'
        ? 'Reservation cancelled'
        : 'Removed from waitlist'
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
          {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
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
            {joinType === 'event-selection' && (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      setJoinType('choice');
                      setSelectedEvent(null);
                      setEventCode('');
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                  >
                    ← Back
                  </button>
                  <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Ticket className="w-10 h-10 text-purple-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Select Event</h2>
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
                      onChange={(e) => setEventCode(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleFindEvent()}
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
                {availableEvents.length > 0 && (
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                    <h3 className="text-sm font-medium text-gray-700 mb-3">Active Events</h3>
                    <div className="space-y-2">
                      {availableEvents.map(event => (
                        <button
                          key={event.id}
                          onClick={() => {
                            setSelectedEvent(event);
                            toast.success(`Selected: ${event.name}`);
                            if (event.type === 'table-based') {
                              setJoinType('choice');
                            } else {
                              // Capacity-based event
                              const capacityEvent = event as CapacityBasedEvent;
                              if (capacityEvent.queueMode === 'multiple' && capacityEvent.queues && capacityEvent.queues.length > 0) {
                                // Multiple queues - show queue selection
                                setJoinType('queue-selection');
                              } else {
                                // Single queue - go directly to waitlist form
                                setJoinType('waitlist');
                              }
                            }
                          }}
                          className="w-full text-left p-3 border border-gray-200 rounded-lg hover:bg-blue-50 hover:border-blue-300 transition-colors"
                        >
                          <div className="font-medium">{event.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {event.type === 'capacity-based' ? 'Queue Line' : 'Table Service'}
                          </div>
                        </button>
                      ))}
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
                  Toggle {isOnline ? 'Offline' : 'Online'} Mode
                </button>
              </>
            )}

            {/* Choice Screen - After Event Selection */}
            {joinType === 'choice' && !selectedEvent && (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
                  <p className="text-gray-600 text-sm">
                    Select an event to get started
                  </p>
                </div>

                <button
                  onClick={() => setJoinType('event-selection')}
                  className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <Ticket className="w-8 h-8" />
                  <span className="text-lg">Join an Event</span>
                  <span className="text-sm opacity-90">Enter code or scan QR</span>
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
                  Toggle {isOnline ? 'Offline' : 'Online'} Mode
                </button>
              </>
            )}

            {/* Queue Selection Screen (Multiple-queue capacity events only) */}
            {joinType === 'queue-selection' && selectedEvent && selectedEvent.type === 'capacity-based' && (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      setSelectedEvent(null);
                      setSelectedQueue(null);
                      setJoinType('event-selection');
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                  >
                    ← Change event
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <ListOrdered className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">{selectedEvent.name}</h2>
                  <p className="text-gray-600 text-sm">
                    Select which queue to join
                  </p>
                </div>

                <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Available Queues</h3>
                  <div className="space-y-3">
                    {(selectedEvent as CapacityBasedEvent).queues?.map(queue => {
                      // Calculate live count from waitlist entries
                      const liveCount = allWaitlistEntries.filter(e => 
                        e.eventId === selectedEvent.id && e.queueId === queue.id
                      ).length;
                      const queuePercentage = (liveCount / queue.capacity) * 100;
                      const getQueueColor = () => {
                        if (queuePercentage < 50) return 'text-green-600';
                        if (queuePercentage < 80) return 'text-amber-600';
                        return 'text-red-600';
                      };

                      return (
                        <button
                          key={queue.id}
                          onClick={() => {
                            setSelectedQueue(queue);
                            setJoinType('waitlist');
                            toast.success(`Selected: ${queue.name}`);
                          }}
                          className="w-full text-left p-4 border-2 border-gray-200 rounded-xl hover:bg-blue-50 hover:border-blue-400 transition-all"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="font-semibold text-lg">{queue.name}</div>
                            <div className={`text-sm font-medium ${getQueueColor()}`}>
                              {Math.round(queuePercentage)}%
                            </div>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                            <Users className="w-4 h-4" />
                            <span>{liveCount} / {queue.capacity} in queue</span>
                          </div>
                          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all ${
                                queuePercentage < 50 ? 'bg-green-500' :
                                queuePercentage < 80 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(queuePercentage, 100)}%` }}
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
                  Toggle {isOnline ? 'Offline' : 'Online'} Mode
                </button>
              </>
            )}

            {/* Reservation vs Waitlist Choice (Table-based events only) */}
            {joinType === 'choice' && selectedEvent && selectedEvent.type === 'table-based' && (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      setSelectedEvent(null);
                      setJoinType('event-selection');
                    }}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                  >
                    ← Change event
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">{selectedEvent.name}</h2>
                  <p className="text-gray-600 text-sm">
                    How would you like to join?
                  </p>
                </div>

                <button
                  onClick={() => setJoinType('reservation')}
                  disabled={allTablesOccupied}
                  className={`w-full py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform ${
                    allTablesOccupied
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : 'bg-green-600 hover:bg-green-700 text-white'
                  }`}
                >
                  <Calendar className="w-8 h-8" />
                  <span className="text-lg">{allTablesOccupied ? 'Reservations Full' : 'Make a Reservation'}</span>
                  {!allTablesOccupied && <span className="text-sm opacity-90">Immediate seating available</span>}
                </button>

                <button
                  onClick={() => setJoinType('waitlist')}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white py-6 px-6 rounded-xl font-semibold flex flex-col items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                >
                  <ListOrdered className="w-8 h-8" />
                  <span className="text-lg">Join Waitlist</span>
                  <span className="text-sm opacity-90">Get in line for next available table</span>
                </button>
              </>
            )}

            {/* Form Screen (Reservation or Waitlist) */}
            {(joinType === 'reservation' || joinType === 'waitlist') && selectedEvent && (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => {
                      if (selectedEvent.type === 'table-based') {
                        setJoinType('choice');
                      } else {
                        setJoinType('event-selection');
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
                    {joinType === 'reservation' ? 'Make a Reservation' : 'Join the Waitlist'}
                  </h2>
                  <p className="text-gray-600 text-sm mb-1">
                    {selectedEvent.name}
                  </p>
                  <p className="text-gray-500 text-xs">
                    {joinType === 'reservation' 
                      ? 'Complete the form to reserve your table'
                      : 'Fill out your details to join the queue'
                    }
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
                      onChange={(e) => setGuestName(e.target.value)}
                      placeholder="Enter your name"
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Party Size
                    </label>
                    <select
                      value={partySize}
                      onChange={(e) => setPartySize(Number(e.target.value))}
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                    >
                      {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                        <option key={size} value={size}>
                          {size} {size === 1 ? 'person' : 'people'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {joinType === 'reservation' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Reservation Time <span className="text-gray-400 font-normal">(Optional)</span>
                      </label>
                      <div className="relative">
                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="time"
                          value={reservationTime}
                          onChange={(e) => setReservationTime(e.target.value)}
                          className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Special Requests <span className="text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder="e.g., 'Table 5' or 'Near Sarah Johnson'"
                      className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                      rows={3}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Request a specific table number or to sit near another guest
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleJoinManually}
                  className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform shadow-lg"
                >
                  {joinType === 'reservation' ? 'Confirm Reservation' : 'Join Queue'}
                </button>

                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className="w-full text-xs text-gray-500 py-2"
                >
                  Toggle {isOnline ? 'Offline' : 'Online'} Mode
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
                  <label className="block text-xs text-gray-500 mb-2">Switch Event</label>
                  <select
                    value={selectedWaitlistId || ''}
                    onChange={(e) => {
                      const newId = e.target.value;
                      setSelectedWaitlistId(newId);
                      const entry = allWaitlistEntries.find(entry => entry.id === newId);
                      const event = availableEvents.find(ev => ev.id === entry?.eventId);
                      toast.success(`Switched to ${event?.name || 'event'}`);
                    }}
                    className="w-full p-3 border-2 border-gray-300 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium"
                  >
                    {myWaitlistIds.map((id) => {
                      const entry = allWaitlistEntries.find(e => e.id === id);
                      if (!entry) return null;
                      
                      const event = availableEvents.find(e => e.id === entry.eventId);
                      const eventName = event?.name || 'Unknown Event';
                      
                      // Get queue name if applicable
                      const queueName = entry.queueId 
                        ? (() => {
                            if (event && event.type === 'capacity-based') {
                              const capacityEvent = event as CapacityBasedEvent;
                              const queue = capacityEvent.queues?.find(q => q.id === entry.queueId);
                              return queue?.name;
                            }
                            return undefined;
                          })()
                        : undefined;
                      
                      const fullDisplayName = queueName ? `${queueName} - ${eventName}` : eventName;
                      
                      // Calculate position
                      const sameTypeEntries = allWaitlistEntries.filter(e => 
                        e.type === entry.type && e.eventId === entry.eventId
                      );
                      const pos = sameTypeEntries.findIndex(e => e.id === id) + 1;
                      
                      return (
                        <option key={id} value={id}>
                          {fullDisplayName} - {entry.name} {entry.type === 'waitlist' ? `(#${pos})` : entry.reservationTime ? `(${entry.reservationTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })})` : '(Reservation)'}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              <div className={`w-32 h-32 rounded-full flex items-center justify-center mx-auto mb-6 ${
                myEntry?.type === 'reservation' ? 'bg-green-100' : 'bg-blue-100'
              }`}>
                <div className="text-center">
                  {myEntry?.type === 'reservation' ? (
                    <Calendar className={`w-16 h-16 ${myEntry?.type === 'reservation' ? 'text-green-600' : 'text-blue-600'}`} />
                  ) : (
                    <div className="text-6xl font-bold text-blue-600">#{position}</div>
                  )}
                </div>
              </div>
              <h2 className="text-3xl font-bold mb-2">
                {myEntry?.type === 'reservation' ? 'Your Reservation' : 'Your Position'}
              </h2>
              
              {myEntry?.type === 'reservation' && myEntry?.reservationTime && (
                <div className="mb-2">
                  <div className="inline-flex items-center gap-2 bg-green-100 px-4 py-2 rounded-lg">
                    <Clock className="w-5 h-5 text-green-700" />
                    <span className="text-xl font-bold text-green-700">
                      {myEntry.reservationTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              )}
              
              <p className="text-gray-600">
                {myEntry?.type === 'reservation' 
                  ? 'You will be seated shortly'
                  : position === 1
                    ? "You're next!"
                    : estimatedWaitMinutes === 0
                      ? "Almost there!"
                      : `${position - 1} ${position - 1 === 1 ? 'party' : 'parties'} ahead of you`
                }
              </p>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
              {myEntry?.type === 'waitlist' && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <span className="font-medium">Estimated Wait</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">
                    ~{estimatedWaitMinutes} min
                  </div>
                </div>
              )}
              
              {myEntry?.type === 'reservation' && myEntry?.reservationTime && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-green-600" />
                    <span className="font-medium">Reservation Time</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">
                    {myEntry.reservationTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              )}
              
              <div className={myEntry?.type === 'waitlist' || (myEntry?.type === 'reservation' && myEntry?.reservationTime) ? 'pt-0' : ''}>
                <div className="flex items-center justify-between text-sm mb-3">
                  <span className="text-gray-600">Guest Name</span>
                  <span className="font-semibold">{myEntry?.name}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Party Size</span>
                  <span className="font-semibold">{myEntry?.partySize} people</span>
                </div>
                {myEntry?.specialRequests && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <div className="text-sm text-gray-600 mb-1">Special Requests</div>
                    <div className="text-sm font-medium">{myEntry.specialRequests}</div>
                  </div>
                )}
              </div>
            </div>

            <div className={`border rounded-xl p-4 text-sm ${
              myEntry?.type === 'reservation' 
                ? 'bg-green-50 border-green-200 text-green-800'
                : 'bg-blue-50 border-blue-200 text-blue-800'
            }`}>
              <p className="text-center">
                {myEntry?.type === 'reservation'
                  ? '✓ Your table is being prepared. A staff member will seat you shortly!'
                  : '💡 You\'ll be notified when it\'s your turn. Please stay nearby!'
                }
              </p>
            </div>

            <button
              onClick={() => {
                // Pre-fill form with current reservation data if editing a reservation
                if (isTableBasedReservation && myEntry) {
                  setGuestName(myEntry.name);
                  setPartySize(myEntry.partySize);
                  setSpecialRequests(myEntry.specialRequests || '');
                  if (myEntry.reservationTime) {
                    const hours = myEntry.reservationTime.getHours().toString().padStart(2, '0');
                    const minutes = myEntry.reservationTime.getMinutes().toString().padStart(2, '0');
                    setReservationTime(`${hours}:${minutes}`);
                  } else {
                    setReservationTime('');
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
              {myEntry?.type === 'reservation' ? 'Cancel Reservation' : 'Leave Waitlist'}
            </button>

            <button
              onClick={() => setIsOnline(!isOnline)}
              className="w-full text-xs text-gray-500 py-2"
            >
              Toggle {isOnline ? 'Offline' : 'Online'} Mode
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
              <h2 className="text-2xl font-bold text-gray-800">My Events</h2>
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
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">No Active Events</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    You're not currently on any waitlists
                  </p>
                  <button
                    onClick={() => {
                      setShowMyEvents(false);
                      setJoinType('event-selection');
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-semibold"
                  >
                    Join an Event
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    You're currently on {myWaitlistIds.length} {myWaitlistIds.length === 1 ? 'waitlist' : 'waitlists'}
                  </p>
                  {myWaitlistIds.map((id) => {
                    const entry = allWaitlistEntries.find(e => e.id === id);
                    if (!entry) return null; // Entry was removed

                    const event = availableEvents.find(e => e.id === entry.eventId);
                    const eventName = event?.name || 'Unknown Event';
                    
                    // Get queue name if applicable
                    const queueName = entry.queueId 
                      ? (() => {
                          if (event && event.type === 'capacity-based') {
                            const capacityEvent = event as CapacityBasedEvent;
                            const queue = capacityEvent.queues?.find(q => q.id === entry.queueId);
                            return queue?.name;
                          }
                          return undefined;
                        })()
                      : undefined;
                    
                    const fullDisplayName = queueName ? `${queueName} - ${eventName}` : eventName;
                    
                    // Calculate position for this entry
                    const sameTypeEntries = allWaitlistEntries.filter(e => 
                      e.type === entry.type && e.eventId === entry.eventId
                    );
                    const pos = sameTypeEntries.findIndex(e => e.id === id) + 1;
                    
                    // Calculate dynamic wait time
                    const dynamicWaitTime = calculateDynamicWaitTime(entry, allWaitlistEntries);
                    
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
                            <h3 className="font-semibold text-lg text-gray-800">{fullDisplayName}</h3>
                            <p className="text-sm text-gray-600">{entry.name}</p>
                          </div>
                          {entry.type === 'reservation' ? (
                            <div className="bg-green-100 text-green-700 text-xs font-semibold px-2 py-1 rounded">
                              Reservation
                            </div>
                          ) : (
                            <div className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded">
                              Waitlist
                            </div>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          {entry.type === 'waitlist' && (
                            <div className="flex items-center gap-1">
                              <ListOrdered className="w-4 h-4" />
                              <span>Position #{pos}</span>
                            </div>
                          )}
                          {entry.type === 'reservation' && entry.reservationTime && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4 text-green-600" />
                              <span className="font-semibold text-green-700">
                                {entry.reservationTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                              </span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <Users className="w-4 h-4" />
                            <span>{entry.partySize} {entry.partySize === 1 ? 'person' : 'people'}</span>
                          </div>
                          {entry.type === 'waitlist' && dynamicWaitTime > 0 && (
                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>~{dynamicWaitTime} min</span>
                            </div>
                          )}
                        </div>
                        
                        {entry.specialRequests && (
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <p className="text-xs text-gray-500">Note: {entry.specialRequests}</p>
                          </div>
                        )}
                      </button>
                    );
                  })}

                  <div className="pt-4 border-t border-gray-200">
                    <button
                      onClick={() => {
                        setShowMyEvents(false);
                        setJoinType('event-selection');
                      }}
                      className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white py-3 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
                    >
                      <Ticket className="w-5 h-5" />
                      Join Another Event
                    </button>
                  </div>
                </>
              )}
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
                {isTableBasedReservation ? 'Edit Reservation' : 'Add Another Guest'}
              </h3>
              <button
                onClick={() => {
                  setShowAddAnotherForm(false);
                  setGuestName('');
                  setPartySize(2);
                  setSpecialRequests('');
                  setReservationTime('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {isTableBasedReservation ? 'Your Name' : 'Guest Name'}
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder={isTableBasedReservation ? 'Enter your name' : 'Enter guest name'}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Party Size
                </label>
                <select
                  value={partySize}
                  onChange={(e) => setPartySize(Number(e.target.value))}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                    <option key={size} value={size}>
                      {size} {size === 1 ? 'person' : 'people'}
                    </option>
                  ))}
                </select>
              </div>

              {isTableBasedReservation && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Reservation Time <span className="text-gray-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                      type="time"
                      value={reservationTime}
                      onChange={(e) => setReservationTime(e.target.value)}
                      className="w-full pl-10 pr-4 p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Special Requests <span className="text-gray-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  value={specialRequests}
                  onChange={(e) => setSpecialRequests(e.target.value)}
                  placeholder="e.g., 'Table 5' or 'Near Sarah Johnson'"
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  rows={3}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Request a specific table number or to sit near another guest
                </p>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => {
                  setShowAddAnotherForm(false);
                  setGuestName('');
                  setPartySize(2);
                  setSpecialRequests('');
                  setReservationTime('');
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAnother}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                {isTableBasedReservation ? 'Save Changes' : 'Add to Waitlist'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
