import { useState, useEffect } from 'react';
import { StatusBar } from './StatusBar';
import { QRScanner } from './QRScanner';
import { QrCode, Clock, Users, LogOut, X, Calendar, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistEntry } from '../App';
import { Table } from './TableGrid';

interface AttendeeViewProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  addToWaitlist: (name: string, partySize: number, specialRequests?: string, type?: 'reservation' | 'waitlist') => string;
  removeFromWaitlist: (id: string) => void;
  allWaitlistEntries: WaitlistEntry[];
  tables: Table[];
}

export function AttendeeView({ onLogout, waitlist, addToWaitlist, removeFromWaitlist, allWaitlistEntries, tables }: AttendeeViewProps) {
  const [myWaitlistId, setMyWaitlistId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('myWaitlistId');
    }
    return null;
  });
  const [partySize, setPartySize] = useState(2);
  const [guestName, setGuestName] = useState('');
  const [specialRequests, setSpecialRequests] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showAddAnotherForm, setShowAddAnotherForm] = useState(false);
  const [joinType, setJoinType] = useState<'choice' | 'reservation' | 'waitlist'>('choice');
  const [viewingStatus, setViewingStatus] = useState(false);
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

  // Persist attendee state to localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (myWaitlistId) {
        localStorage.setItem('myWaitlistId', myWaitlistId);
      } else {
        localStorage.removeItem('myWaitlistId');
      }
    }
  }, [myWaitlistId]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('attendeeIsOnline', JSON.stringify(isOnline));
    }
  }, [isOnline]);

  // Find my entry in the waitlist or full list
  const myEntry = allWaitlistEntries.find((e) => e.id === myWaitlistId);
  const isOnWaitlist = !!myEntry;
  
  // Calculate position only for entries of the same type
  const sameTypeEntries = myEntry ? allWaitlistEntries.filter(e => e.type === myEntry.type) : [];
  const position = myEntry ? sameTypeEntries.findIndex((e) => e.id === myWaitlistId) + 1 : 0;
  const estimatedWaitMinutes = myEntry ? myEntry.estimatedWait : 0;
  
  // Check if all tables are occupied
  const allTablesOccupied = tables.every((table) => table.occupied);

  // Clear stored ID if entry no longer exists in waitlist
  useEffect(() => {
    if (myWaitlistId && !myEntry) {
      setMyWaitlistId(null);
      setViewingStatus(false);
      toast.info('You have been seated or removed from the waitlist');
    }
  }, [myWaitlistId, myEntry]);

  // Countdown timer
  const [timeRemaining, setTimeRemaining] = useState(estimatedWaitMinutes * 60);

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

  const handleScanSuccess = (data: string) => {
    setShowScanner(false);
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const id = addToWaitlist(guestName, partySize, specialRequests.trim() || undefined, 'waitlist');
    setMyWaitlistId(id);
    setIsSyncing(true);
    toast.success('Successfully joined the waitlist!');
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleJoinManually = () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    const id = addToWaitlist(guestName, partySize, specialRequests.trim() || undefined, joinType === 'reservation' ? 'reservation' : 'waitlist');
    
    // Save the ID so user can view their status
    setMyWaitlistId(id);
    
    setIsSyncing(true);
    const message = joinType === 'reservation' 
      ? 'Reservation confirmed! You will be seated shortly.' 
      : 'Successfully joined the waitlist!';
    toast.success(message);
    
    // Reset form and go back to choice screen for both reservations and waitlist
    setGuestName('');
    setPartySize(2);
    setSpecialRequests('');
    setJoinType('choice');
    
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleAddAnother = () => {
    if (!guestName.trim()) {
      toast.error('Please enter guest name');
      return;
    }
    addToWaitlist(guestName, partySize, specialRequests.trim() || undefined, 'waitlist');
    setIsSyncing(true);
    toast.success(`${guestName} added to the waitlist!`);
    // Reset form
    setGuestName('');
    setPartySize(2);
    setSpecialRequests('');
    setShowAddAnotherForm(false);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleLeaveWaitlist = () => {
    if (myWaitlistId) {
      const entryType = myEntry?.type;
      removeFromWaitlist(myWaitlistId);
      setMyWaitlistId(null);
      setViewingStatus(false);
      setIsSyncing(true);
      const message = entryType === 'reservation' ? 'Reservation cancelled' : 'Removed from waitlist';
      toast.success(message);
      setTimeout(() => setIsSyncing(false), 1500);
    }
  };

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
            {joinType === 'choice' ? (
              <>
                <div className="text-center mb-8">
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">Welcome</h2>
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

                {myWaitlistId && allWaitlistEntries.find(e => e.id === myWaitlistId) && (
                  <button
                    onClick={() => setViewingStatus(true)}
                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-transform"
                  >
                    <Clock className="w-6 h-6" />
                    View My Status
                  </button>
                )}

                <button
                  onClick={() => setIsOnline(!isOnline)}
                  className="w-full text-xs text-gray-500 py-2"
                >
                  Toggle {isOnline ? 'Offline' : 'Online'} Mode
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-8">
                  <button
                    onClick={() => setJoinType('choice')}
                    className="text-blue-600 hover:text-blue-700 text-sm mb-4 flex items-center gap-1 mx-auto"
                  >
                    ← Back to options
                  </button>
                  <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Users className="w-10 h-10 text-blue-600" />
                  </div>
                  <h2 className="text-2xl font-semibold mb-2">
                    {joinType === 'reservation' ? 'Make a Reservation' : 'Join the Waitlist'}
                  </h2>
                  <p className="text-gray-600 text-sm">
                    {joinType === 'reservation' 
                      ? 'Complete the form to reserve your table'
                      : 'Scan the QR code or join manually to get in line'
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

                {joinType === 'waitlist' && (
                  <button
                    onClick={() => setShowScanner(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform"
                  >
                    <QrCode className="w-6 h-6" />
                    Scan QR Code
                  </button>
                )}

                <button
                  onClick={handleJoinManually}
                  className="w-full bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform"
                >
                  {joinType === 'reservation' ? 'Confirm Reservation' : 'Join Manually'}
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
              <p className="text-gray-600">
                {myEntry?.type === 'reservation' 
                  ? 'You will be seated shortly'
                  : position === 1
                    ? "You're next!"
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
