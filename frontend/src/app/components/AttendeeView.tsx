import { useState, useEffect } from 'react';
import { StatusBar } from './StatusBar';
import { QRScanner } from './QRScanner';
import { QrCode, Clock, Users, LogOut, X, Calendar, ListOrdered, Search, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistEntry } from '../App';
import { Table } from './TableGrid';
import { Event } from '../utils/events';

interface AttendeeViewProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  addToWaitlist: (name: string, partySize: number, specialRequests?: string, type?: 'reservation' | 'waitlist', eventId?: string) => Promise<string>;
  removeFromWaitlist: (id: string, eventId?: string) => void;
  allWaitlistEntries: WaitlistEntry[];
  tables: Table[];
  events: Event[];
  refreshEntries: () => Promise<void>;
}

export function AttendeeView({ onLogout, waitlist, addToWaitlist, removeFromWaitlist, allWaitlistEntries, tables, events, refreshEntries }: AttendeeViewProps) {
  const [myWaitlistIds, setMyWaitlistIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const savedIds = localStorage.getItem('myWaitlistIds');
      if (savedIds) {
        try {
          const parsed = JSON.parse(savedIds);
          if (Array.isArray(parsed)) {
            return parsed;
          }
        } catch (e) {
          // fall through to legacy key
        }
      }

      const legacyId = localStorage.getItem('myWaitlistId');
      if (legacyId) return [legacyId];
    }
    return [];
  });
  const [activeWaitlistId, setActiveWaitlistId] = useState<string | null>(null);
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showAddAnotherForm, setShowAddAnotherForm] = useState(false);
  const [joinType, setJoinType] = useState<'choice' | 'event-selection' | 'reservation' | 'waitlist'>('choice');
  const [viewingStatus, setViewingStatus] = useState(false);
  const [eventCode, setEventCode] = useState('');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [availableEvents, setAvailableEvents] = useState<Event[]>([]);
  const [isOnline, setIsOnline] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendeeIsOnline');
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

  // Load available events on mount
  useEffect(() => {
    setAvailableEvents(events.filter((event) => event.status === 'active'));
  }, [events]);

  // Persist attendee state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (myWaitlistIds.length > 0) {
        localStorage.setItem('myWaitlistIds', JSON.stringify(myWaitlistIds));
        // keep legacy key for backwards compatibility
        localStorage.setItem('myWaitlistId', myWaitlistIds[0]);
      } else {
        localStorage.removeItem('myWaitlistIds');
        localStorage.removeItem('myWaitlistId');
      }
    }
  }, [myWaitlistIds]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendeeIsOnline', JSON.stringify(isOnline));
    }
  }, [isOnline]);

  // Find all of my active entries in the waitlist
  const myEntries = allWaitlistEntries.filter((e) => myWaitlistIds.includes(e.id));
  const isOnWaitlist = myEntries.length > 0;

  // Pick active entry for status view (selected, otherwise first)
  const myEntry = myEntries.find((e) => e.id === activeWaitlistId) || myEntries[0] || null;
  
  // Calculate position only for entries of the same type and event
  const sameTypeAndEventEntries = myEntry 
    ? allWaitlistEntries.filter(e => e.type === myEntry.type && e.eventId === myEntry.eventId) 
    : [];
  const position = myEntry?.position || (myEntry ? sameTypeAndEventEntries.findIndex((e) => e.id === myEntry.id) + 1 : 0);
  const estimatedWaitMinutes = myEntry ? (myEntry.estimatedWait > 0 ? myEntry.estimatedWait : Math.max(5, position * 8)) : 0;
  
  // Check if all tables are occupied
  const allTablesOccupied = tables.every((table) => table.occupied);

  // Keep only active IDs that still exist in waitlist
  useEffect(() => {
    const nextIds = myWaitlistIds.filter((id) => allWaitlistEntries.some((entry) => entry.id === id));
    if (nextIds.length !== myWaitlistIds.length) {
      setMyWaitlistIds(nextIds);
      if (nextIds.length === 0) {
        setViewingStatus(false);
        setActiveWaitlistId(null);
      } else if (!activeWaitlistId || !nextIds.includes(activeWaitlistId)) {
        setActiveWaitlistId(nextIds[0]);
      }
      toast.info('One or more waitlist entries were seated or removed');
    }
  }, [myWaitlistIds, allWaitlistEntries, activeWaitlistId]);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState(estimatedWaitMinutes * 60);

  useEffect(() => {
    if (myEntry?.type === 'waitlist') {
      setTimeRemaining(estimatedWaitMinutes * 60);
    }
  }, [myEntry?.id, myEntry?.type, estimatedWaitMinutes]);

  useEffect(() => {
    if (isOnWaitlist) {
      const interval = setInterval(() => {
        setTimeRemaining((prev) => {
          if (prev <= 0) return 0;
          return prev - 1;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOnWaitlist]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleFindEvent = () => {
    const trimmedCode = eventCode.trim().toLowerCase();
    const event = availableEvents.find(e => 
      e.name.toLowerCase().includes(trimmedCode) || 
      e.id.toLowerCase() === trimmedCode
    );
    
    if (event) {
      setSelectedEvent(event);
      toast.success(`Event found: ${event.name}`);
      // Determine next screen based on event type
      if (event.type === 'table-based') {
        setJoinType('choice'); // Will show reservation vs waitlist choice
      } else {
        setJoinType('waitlist'); // Capacity-based only has waitlist
      }
    } else {
      toast.error('Event not found. Please check the code and try again.');
    }
  };

  const handleScanSuccess = (eventData: string) => {
    setShowScanner(false);
    // Try to find event from QR code data
    const event = availableEvents.find(e => e.id === eventData || e.name === eventData);
    if (event) {
      setSelectedEvent(event);
      if (event.type === 'table-based') {
        setJoinType('choice');
      } else {
        setJoinType('waitlist');
      }
      toast.success(`Scanned: ${event.name}`);
    } else {
      toast.error('Invalid QR code');
    }
  };

  const handleJoinManually = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    
    if (!selectedEvent) {
      toast.error('Please select an event first');
      return;
    }

    const id = await addToWaitlist(
      guestName, 
      partySize, 
      specialRequests.trim() || undefined, 
      joinType === 'reservation' ? 'reservation' : 'waitlist',
      selectedEvent.id
    );
    
    // Save the ID so user can view status (supports multiple entries)
    setMyWaitlistIds((prev) => [...new Set([...prev, id])]);
    setActiveWaitlistId(id);
    
    setIsSyncing(true);
    const message = joinType === 'reservation' 
      ? 'Reservation confirmed! You will be seated shortly.' 
      : `Successfully joined ${selectedEvent.name}!`;
    toast.success(message);
    
    // Reset form
    setGuestName('');
    setPartySize(2);
    setSpecialRequests('');
    setSelectedEvent(null);
    setEventCode('');
    setJoinType('choice');
    
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleAddAnother = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter guest name');
      return;
    }
    await addToWaitlist(guestName, partySize, specialRequests.trim() || undefined, 'waitlist', myEntry?.eventId);
    setIsSyncing(true);
    toast.success(`${guestName} added to the waitlist!`);
    // Reset form
    setGuestName('');
    setPartySize(2);
    setSpecialRequests('');
    setShowAddAnotherForm(false);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleLeaveWaitlist = async () => {
    if (myEntry) {
      const entryType = myEntry?.type;
      removeFromWaitlist(myEntry.id, myEntry.eventId);
      setMyWaitlistIds((prev) => prev.filter((id) => id !== myEntry.id));
      setActiveWaitlistId((prev) => (prev === myEntry.id ? null : prev));
      setViewingStatus(false);
      setIsSyncing(true);
      const message = entryType === 'reservation' ? 'Reservation cancelled' : 'Removed from waitlist';
      toast.success(message);
      setTimeout(() => setIsSyncing(false), 1500);
    }
  };

  // Get event name for display
  const myEventName = myEntry?.eventId 
    ? availableEvents.find(e => e.id === myEntry.eventId)?.name || 'Event'
    : 'Event';

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col max-w-md mx-auto">
      <StatusBar isOnline={isOnline} isSyncing={isSyncing} />
      
      <div className="bg-white shadow-sm p-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Waitlist</h1>
          <p className="text-xs text-gray-500">Guest View</p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>

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
                              setJoinType('waitlist');
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

                {isOnWaitlist && (
                  <button
                    onClick={() => {
                      if (!activeWaitlistId && myEntries[0]) {
                        setActiveWaitlistId(myEntries[0].id);
                      }
                      setViewingStatus(true);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                  >
                    <Clock className="w-6 h-6" />
                    View My Status ({myEntries.length})
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
              <p className="text-sm text-gray-500 mb-1">{myEventName}</p>
              <p className="text-gray-600">
                {myEntry?.type === 'reservation' 
                  ? 'You will be seated shortly'
                  : position === 1
                    ? "You're next!"
                    : `${position - 1} ${position - 1 === 1 ? 'party' : 'parties'} ahead of you`
                }
              </p>
            </div>

            {myEntries.length > 1 && (
              <div className="bg-white rounded-2xl p-4 shadow border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Entry</label>
                <select
                  value={myEntry?.id ?? ''}
                  onChange={(e) => setActiveWaitlistId(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white"
                >
                  {myEntries.map((entry, idx) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name} • {entry.type === 'reservation' ? 'Reservation' : 'Waitlist'} • #{idx + 1}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-200 space-y-4">
              {myEntry?.type === 'waitlist' && (
                <div className="flex items-center justify-between pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <Clock className="w-6 h-6 text-blue-600" />
                    <span className="font-medium">Estimated Wait</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600 tabular-nums">
                    {formatTime(timeRemaining)}
                  </div>
                </div>
              )}
              
              <div className={myEntry?.type === 'waitlist' ? 'pt-0' : ''}>
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
              onClick={() => setShowAddAnotherForm(true)}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <Users className="w-5 h-5" />
              Add Another Guest
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
              <h3 className="text-xl font-semibold">Add Another Guest</h3>
              <button
                onClick={() => {
                  setShowAddAnotherForm(false);
                  setGuestName('');
                  setPartySize(2);
                  setSpecialRequests('');
                }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Guest Name
                </label>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Enter guest name"
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
                }}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleAddAnother}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Add to Waitlist
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
