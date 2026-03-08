import { useState, useEffect } from 'react';
import { CircularProgress } from './CircularProgress';
import { StatusBar } from './StatusBar';
import { TableGrid, Table } from './TableGrid';
import { CreateEventModal } from './CreateEventModal';
import { QRCodeModal } from './QRCodeModal';
import { Plus, Minus, ArrowUp, UserX, LogOut, Menu, X, Clock, Users, Edit2, Trash2, User as UserIcon, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistEntry } from '../App';
import { Event, getStoredEvents, addEvent, deleteEvent, CapacityBasedEvent } from '../utils/events';
import { getStoredUser, User } from '../utils/auth';
import { Profile } from './Profile';

interface Attraction {
  id: string;
  name: string;
  waitTime: number;
  queueSize: number;
  queueCapacity: number;
  throughput: number;
  status: 'open' | 'closed' | 'delayed';
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
  if (typeof window !== 'undefined') {
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
  if (typeof window !== 'undefined') {
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

export function StaffDashboard({ onLogout, waitlist, setWaitlist, tables, setTables, user }: StaffDashboardProps) {
  const [currentCapacity, setCurrentCapacity] = useState(() => getStoredNumber('currentCapacity', 45));
  const [maxCapacity, setMaxCapacity] = useState(() => getStoredNumber('maxCapacity', 100));
  const [isOnline, setIsOnline] = useState(() => getStoredBoolean('isOnline', true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState<'home' | 'waitlist' | 'capacity'>('home');
  const [listView, setListView] = useState<'waitlist' | 'reservation'>('waitlist');
  const [waitlistSubPage, setWaitlistSubPage] = useState<'view' | 'settings'>('view');
  const [menuOpen, setMenuOpen] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [totalTables, setTotalTables] = useState(() => getStoredNumber('totalTables', 12));
  const [showCreateEventModal, setShowCreateEventModal] = useState(false);
  const [events, setEvents] = useState<Event[]>(getStoredEvents);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [showAttractionModal, setShowAttractionModal] = useState(false);
  const [editingAttraction, setEditingAttraction] = useState<Attraction | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [showQRCodeModal, setShowQRCodeModal] = useState(false);
  const [selectedQueueId, setSelectedQueueId] = useState<string | undefined>();
  const [selectedQueueName, setSelectedQueueName] = useState<string | undefined>();

  // Auto-create default line for single-queue events
  useEffect(() => {
    if (selectedEvent && selectedEvent.type === 'capacity-based') {
      const capacityEvent = selectedEvent as CapacityBasedEvent;
      if (capacityEvent.queueMode === 'single' && attractions.length === 0) {
        // Create a default line with the same name as the event
        const defaultLine: Attraction = {
          id: 'default-single-queue',
          name: selectedEvent.name,
          waitTime: capacityEvent.estimatedWaitPerPerson || 30,
          queueSize: capacityEvent.currentCount || 0,
          queueCapacity: capacityEvent.capacity || 100,
          throughput: 240, // default throughput
          status: 'open',
          autoCalculateWait: true,
        };
        setAttractions([defaultLine]);
      } else if (capacityEvent.queueMode === 'multiple') {
        // Load queues from the event if they exist
        if (capacityEvent.queues && capacityEvent.queues.length > 0) {
          const attractionsFromQueues: Attraction[] = capacityEvent.queues.map(queue => ({
            id: queue.id,
            name: queue.name,
            waitTime: capacityEvent.estimatedWaitPerPerson || 30,
            queueSize: queue.currentCount || 0,
            queueCapacity: queue.capacity,
            throughput: 240, // default throughput
            status: 'open',
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
    if (typeof window !== 'undefined') {
      localStorage.setItem('currentCapacity', JSON.stringify(currentCapacity));
    }
  }, [currentCapacity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('totalTables', JSON.stringify(totalTables));
    }
  }, [totalTables]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('maxCapacity', JSON.stringify(maxCapacity));
    }
  }, [maxCapacity]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('isOnline', JSON.stringify(isOnline));
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

  const handlePromote = (id: string) => {
    const entry = waitlist.find((e) => e.id === id);
    if (!entry) return;

    const availableTable = tables.find(
      (t) => !t.occupied && t.capacity >= entry.partySize
    );

    if (availableTable) {
      setTables(
        tables.map((t) =>
          t.id === availableTable.id
            ? {
                ...t,
                occupied: true,
                guestName: entry.name,
                partySize: entry.partySize,
                seatedAt: new Date(),
              }
            : t
        )
      );
      setWaitlist(waitlist.filter((e) => e.id !== id));
      toast.success(`${entry.name} seated at ${availableTable.name}`, {
        description: `Party of ${entry.partySize}`,
      });
      simulateSync();
    } else {
      toast.error('No available tables for this party size', {
        description: `Need table for ${entry.partySize} guests`,
      });
    }
  };

  const handleSeatAll = () => {
    const reservations = waitlist.filter((e) => e.type === 'reservation');
    if (reservations.length === 0) return;

    let seatedCount = 0;
    const newTables = [...tables];
    const newWaitlist = [...waitlist];

    reservations.forEach((entry) => {
      const availableTableIndex = newTables.findIndex(
        (t) => !t.occupied && t.capacity >= entry.partySize
      );

      if (availableTableIndex !== -1) {
        newTables[availableTableIndex] = {
          ...newTables[availableTableIndex],
          occupied: true,
          guestName: entry.name,
          partySize: entry.partySize,
          seatedAt: new Date(),
        };
        const entryIndex = newWaitlist.findIndex((e) => e.id === entry.id);
        if (entryIndex !== -1) {
          newWaitlist.splice(entryIndex, 1);
          seatedCount++;
        }
      }
    });

    setTables(newTables);
    setWaitlist(newWaitlist);
    
    if (seatedCount > 0) {
      toast.success(`Seated ${seatedCount} ${seatedCount === 1 ? 'guest' : 'groups'}`);
      simulateSync();
    } else {
      toast.error('No available tables for any reservations');
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

    setTables(
      tables.map((t) =>
        t.id === tableId
          ? { ...t, occupied: false, guestName: undefined, partySize: undefined, seatedAt: undefined }
          : t
      )
    );
    toast.success(`${table.name} cleared`);
    simulateSync();
  };

  const handleClearAllTables = () => {
    if (confirm('Clear all tables? This will remove all guests.')) {
      setTables(
        tables.map((t) => ({
          ...t,
          occupied: false,
          guestName: undefined,
          partySize: undefined,
          seatedAt: undefined,
        }))
      );
      toast.success('All tables cleared');
      simulateSync();
    }
  };

  const handleRenameTable = (tableId: number, newName: string) => {
    setTables(
      tables.map((t) =>
        t.id === tableId ? { ...t, name: newName } : t
      )
    );
    toast.success('Table renamed');
    simulateSync();
  };

  const handleUpdateCapacity = (tableId: number, newCapacity: number) => {
    setTables(
      tables.map((t) =>
        t.id === tableId ? { ...t, capacity: newCapacity } : t
      )
    );
    toast.success('Table capacity updated');
    simulateSync();
  };

  const handleManualOccupy = (tableId: number, guestName: string, partySize: number) => {
    setTables(
      tables.map((t) =>
        t.id === tableId
          ? { ...t, occupied: true, guestName, partySize, seatedAt: new Date() }
          : t
      )
    );
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
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
        <div className="flex-1 text-center">
          <h1 className="text-2xl font-bold">Staff Dashboard</h1>
          <p className="text-sm text-gray-400">
            {currentPage === 'home'
              ? 'Your Events'
              : currentPage === 'waitlist' 
                ? (waitlistSubPage === 'settings' ? 'Table Settings' : selectedEvent?.name || 'Waitlist Management')
                : selectedEvent?.name || 'Capacity Management'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowProfile(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            title="Profile"
          >
            
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
              setCurrentPage('home');
              setMenuOpen(false);
            }}
            className={`w-full p-4 text-left hover:bg-gray-100 transition-colors ${
              currentPage === 'home' ? 'bg-blue-50 border-l-4 border-blue-600' : ''
            }`}
          >
            <div className="font-semibold">Dashboard</div>
            
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

      {currentPage === 'home' ? (
        <div className="flex-1 overflow-auto bg-gray-50">
          <div className="p-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">Your Events</h2>
                <p className="text-gray-600">Manage your active events</p>
              </div>
              <button
                onClick={() => setShowCreateEventModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
              >
                <Plus className="w-5 h-5" />
                Create Event
              </button>
            </div>
            
            {events.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-xl font-semibold text-gray-800 mb-2">No events yet</h3>
                <p className="text-gray-600 mb-6">Create your first event to get started</p>
                <button
                  onClick={() => setShowCreateEventModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold shadow-lg active:scale-95 transition-transform"
                >
                  <Plus className="w-5 h-5" />
                  Create Event
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((event) => {
                  const statusColor = 
                    event.status === 'active' ? 'bg-green-100 text-green-700' :
                    event.status === 'paused' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-700';
                  
                  const typeColor = event.type === 'capacity-based' ? 'blue' : 'purple';
                  const TypeIcon = event.type === 'capacity-based' ? Users : Users;
                  
                  const currentCount = event.type === 'capacity-based' 
                    ? waitlist.filter(e => e.eventId === event.id).length
                    : event.currentFilledTables;
                  
                  const maxCount = event.type === 'capacity-based'
                    ? (event as CapacityBasedEvent).queueMode === 'multiple'
                      ? ((event as CapacityBasedEvent).queues?.reduce((sum, q) => sum + q.capacity, 0) || 0)
                      : (event.capacity || 0)
                    : (event.numberOfTables || 0);

                  return (
                    <div
                      key={event.id}
                      className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all p-6 text-left border-2 border-transparent hover:border-${typeColor}-500 group relative`}
                    >
                      {/* Action Buttons - Top Right */}
                      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedEvent(event);
                            setShowQRCodeModal(true);
                          }}
                          className="p-2 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg"
                          title="View QR Code"
                        >
                          <QrCode className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setEventToDelete(event);
                            setShowDeleteConfirmation(true);
                          }}
                          className="p-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg"
                          title="Delete event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Event Card Content - Make it clickable */}
                      <div
                        onClick={() => {
                          setSelectedEvent(event);
                          if (event.type === 'capacity-based') {
                            setCurrentPage('capacity');
                          } else {
                            setCurrentPage('waitlist');
                            setWaitlistSubPage('view');
                          }
                        }}
                        className="cursor-pointer"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-12 h-12 bg-${typeColor}-100 rounded-lg flex items-center justify-center group-hover:bg-${typeColor}-500 transition-colors`}>
                            <TypeIcon className={`w-6 h-6 text-${typeColor}-600 group-hover:text-white`} />
                          </div>
                          <span className={`text-xs px-3 py-1 rounded-full font-medium ${statusColor}`}>
                            {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                          </span>
                        </div>
                        
                        <h3 className="text-xl font-bold text-gray-800 mb-2">{event.name}</h3>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-sm text-gray-600">
                            {event.type === 'capacity-based' ? 'Capacity-Based' : 'Table-Based'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="flex-1">
                            <div className="text-2xl font-bold text-gray-800">
                              {currentCount} <span className="text-sm font-normal text-gray-500">/ {maxCount}</span>
                            </div>
                            <div className="text-xs text-gray-500">
                              {event.type === 'capacity-based' ? 'In Queue' : 'Tables Filled'}
                            </div>
                          </div>
                          <div className="text-2xl font-bold text-gray-300 group-hover:text-blue-500 transition-colors">→</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : currentPage === 'capacity' ? (
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Queue Lines</h2>
              {selectedEvent && selectedEvent.type === 'capacity-based' && (selectedEvent as CapacityBasedEvent).queueMode === 'multiple' && (
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
                // Get actual queue size from waitlist for this event
                const actualQueueSize = selectedEvent ? waitlist.filter(e => e.eventId === selectedEvent.id).length : attraction.queueSize;
                const queuePercentage = (actualQueueSize / attraction.queueCapacity) * 100;
                const getQueueColor = () => {
                  if (queuePercentage < 50) return 'bg-green-500';
                  if (queuePercentage < 80) return 'bg-amber-500';
                  return 'bg-red-500';
                };

                // Auto-update wait time based on actual queue size
                const displayWaitTime = attraction.autoCalculateWait 
                  ? calculateWaitTime(actualQueueSize, attraction.throughput)
                  : attraction.waitTime;

                const isSingleQueueEvent = selectedEvent && selectedEvent.type === 'capacity-based' && (selectedEvent as CapacityBasedEvent).queueMode === 'single';

                return (
                  <div key={attraction.id} className="bg-white rounded-lg shadow-md p-4 border-2 border-gray-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold">{attraction.name}</h3>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                          <span className={`inline-block w-2 h-2 rounded-full ${
                            attraction.status === 'open' ? 'bg-green-500' :
                            attraction.status === 'delayed' ? 'bg-amber-500' : 'bg-red-500'
                          }`} />
                          {attraction.status.charAt(0).toUpperCase() + attraction.status.slice(1)}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {/* QR Code button for multiple-queue events */}
                        {!isSingleQueueEvent && (
                          <button
                            onClick={() => {
                              setSelectedQueueId(attraction.id);
                              setSelectedQueueName(attraction.name);
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
                                setEditingAttraction(attraction);
                                setShowAttractionModal(true);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <Edit2 className="w-4 h-4 text-gray-600" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`Delete ${attraction.name}?`)) {
                                  setAttractions(attractions.filter(a => a.id !== attraction.id));
                                  toast.success(`${attraction.name} deleted`);
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
                          Wait Time {attraction.autoCalculateWait && <span className="text-green-600">(Auto)</span>}
                        </div>
                        <div className="flex items-center justify-between">
                          <button
                            onClick={() => {
                              setAttractions(attractions.map(a =>
                                a.id === attraction.id
                                  ? { ...a, waitTime: Math.max(0, a.waitTime - 5), autoCalculateWait: false }
                                  : a
                              ));
                              simulateSync();
                            }}
                            className="w-8 h-8 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                          >
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-2xl font-bold">{displayWaitTime}m</span>
                          <button
                            onClick={() => {
                              setAttractions(attractions.map(a =>
                                a.id === attraction.id
                                  ? { ...a, waitTime: a.waitTime + 5, autoCalculateWait: false }
                                  : a
                              ));
                              simulateSync();
                            }}
                            className="w-8 h-8 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center active:scale-95 transition-transform"
                          >
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center gap-1 text-xs text-gray-600 mb-2">
                          <Users className="w-3 h-3" />
                          Queue Size (Live)
                        </div>
                        <div className="text-center">
                          <span className="text-xl font-bold">{actualQueueSize}/{attraction.queueCapacity}</span>
                          <p className="text-xs text-gray-500 mt-1">Updates as guests join</p>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex justify-between text-xs text-gray-600">
                        <span>Queue Capacity</span>
                        <span>{Math.round(queuePercentage)}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${getQueueColor()} transition-all duration-500`}
                          style={{ width: `${Math.min(queuePercentage, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="text-xs text-gray-500 mt-2 flex justify-between items-center">
                      <span>Throughput: {attraction.throughput} ppl/hr</span>
                      {attraction.autoCalculateWait ? (
                        <button
                          onClick={() => {
                            setAttractions(attractions.map(a =>
                              a.id === attraction.id ? { ...a, autoCalculateWait: false } : a
                            ));
                            toast.info('Manual wait time mode enabled');
                          }}
                          className="text-blue-600 hover:text-blue-700 underline"
                        >
                          Switch to Manual
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setAttractions(attractions.map(a => {
                              if (a.id === attraction.id) {
                                return {
                                  ...a,
                                  autoCalculateWait: true,
                                  waitTime: calculateWaitTime(a.queueSize, a.throughput)
                                };
                              }
                              return a;
                            }));
                            toast.info('Auto-calculate wait time enabled');
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
                <p className="text-sm">Click "Add Line" to get started.</p>
              </div>
            )}
          </div>

          {showAttractionModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
                <h3 className="text-xl font-bold mb-4">
                  {editingAttraction ? 'Edit Line' : 'Add New Line'}
                </h3>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const formData = new FormData(e.currentTarget);
                    const queueSize = parseInt(formData.get('queueSize') as string);
                    const throughput = parseInt(formData.get('throughput') as string);
                    const autoCalculateWait = formData.get('autoCalculateWait') === 'on';
                    
                    const newAttraction: Attraction = {
                      id: editingAttraction?.id || Date.now().toString(),
                      name: formData.get('name') as string,
                      waitTime: autoCalculateWait 
                        ? calculateWaitTime(queueSize, throughput)
                        : parseInt(formData.get('waitTime') as string),
                      queueSize,
                      queueCapacity: parseInt(formData.get('queueCapacity') as string),
                      throughput,
                      status: formData.get('status') as 'open' | 'closed' | 'delayed',
                      autoCalculateWait,
                    };

                    if (editingAttraction) {
                      setAttractions(attractions.map(a =>
                        a.id === editingAttraction.id ? newAttraction : a
                      ));
                      toast.success('Line updated');
                    } else {
                      setAttractions([...attractions, newAttraction]);
                      toast.success('Line added');
                    }
                    simulateSync();
                    setShowAttractionModal(false);
                    setEditingAttraction(null);
                  }}
                  className="space-y-4"
                >
                  <div>
                    <label className="block text-sm font-medium mb-1">Line Name</label>
                    <input
                      type="text"
                      name="name"
                      defaultValue={editingAttraction?.name || ''}
                      required
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                      placeholder="e.g., Main Entrance Queue"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Wait Time (minutes)</label>
                    <input
                      type="number"
                      name="waitTime"
                      defaultValue={editingAttraction?.waitTime || 30}
                      required
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Current Queue Size</label>
                    <input
                      type="number"
                      name="queueSize"
                      defaultValue={editingAttraction?.queueSize || 0}
                      required
                      min="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Queue Capacity</label>
                    <input
                      type="number"
                      name="queueCapacity"
                      defaultValue={editingAttraction?.queueCapacity || 200}
                      required
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Throughput (people/hour)</label>
                    <input
                      type="number"
                      name="throughput"
                      defaultValue={editingAttraction?.throughput || 240}
                      required
                      min="1"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    />
                    <p className="text-xs text-gray-500 mt-1">How many people can be processed per hour</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Status</label>
                    <select
                      name="status"
                      defaultValue={editingAttraction?.status || 'open'}
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
                        defaultChecked={editingAttraction?.autoCalculateWait ?? true}
                        className="w-4 h-4"
                      />
                      <span className="text-sm font-medium">Auto-calculate wait time from queue size</span>
                    </label>
                    <p className="text-xs text-gray-500 mt-1">When enabled, wait time updates automatically based on queue size and throughput</p>
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
                      {editingAttraction ? 'Save Changes' : 'Add Line'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      ) : waitlistSubPage === 'settings' ? (
        <div className="flex-1 overflow-auto">
          <div className="p-6 max-w-2xl mx-auto">
            <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <h2 className="text-lg font-semibold mb-6">Table Configuration</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Number of Tables
                  </label>
                  <div className="flex items-center gap-4">
                    <button
                      onClick={() => handleUpdateTableCount(totalTables - 1)}
                      className="w-12 h-12 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow active:scale-95 transition-transform"
                      disabled={totalTables <= 1}
                    >
                      <Minus className="w-5 h-5" />
                    </button>
                    
                    <div className="flex-1 text-center">
                      <div className="text-4xl font-bold text-gray-900">{totalTables}</div>
                      <div className="text-sm text-gray-500 mt-1">
                        {totalTables === 1 ? 'table' : 'tables'}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handleUpdateTableCount(totalTables + 1)}
                      className="w-12 h-12 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow active:scale-95 transition-transform"
                      disabled={totalTables >= 24}
                    >
                      <Plus className="w-5 h-5" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-3 text-center">
                    Tables are arranged in a 4-column grid. Min: 1, Max: 24
                  </p>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Presets</h3>
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
                  <h3 className="text-sm font-medium text-blue-900 mb-2">Note</h3>
                  <p className="text-xs text-blue-800">
                    Changing the table count will preserve occupied tables and their guest information. 
                    New tables will be created with default capacity of 4 seats.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="p-4 space-y-4">
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
                onClick={() => setListView('reservation')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  listView === 'reservation'
                    ? 'bg-black text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Reservation List ({waitlist.filter(e => e.type === 'reservation').length})
              </button>
              <button
                onClick={() => setListView('waitlist')}
                className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                  listView === 'waitlist'
                    ? 'bg-black text-white shadow-lg'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Live Waitlist ({waitlist.filter(e => e.type === 'waitlist').length})
              </button>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">
                {listView === 'reservation' ? 'Reservation List' : 'Live Waitlist'} ({waitlist.filter(e => e.type === listView).length})
              </h2>
              {listView === 'reservation' && waitlist.filter(e => e.type === 'reservation').length > 0 && (
                <button
                  onClick={handleSeatAll}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 active:scale-95 transition-transform shadow"
                >
                  <ArrowUp className="w-4 h-4" />
                  Seat All
                </button>
              )}
            </div>
            
            {waitlist.filter(e => e.type === listView).length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>{listView === 'reservation' ? 'No reservations' : 'No guests on the waitlist'}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {waitlist.filter(e => e.type === listView).map((entry, index) => (
                  <div
                    key={entry.id}
                    className="bg-white border-2 border-black p-4 rounded-lg shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-2xl font-bold text-black">
                            #{index + 1}
                          </span>
                          <span className="text-lg font-semibold">{entry.name}</span>
                        </div>
                        <div className="mt-1 text-sm text-gray-600">
                          Party of {entry.partySize} • Est. wait: {formatWaitTime(entry.estimatedWait)}
                        </div>
                        {entry.specialRequests && (
                          <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-2">
                            <div className="text-xs font-semibold text-blue-900 mb-1">Special Request:</div>
                            <div className="text-sm text-blue-800">{entry.specialRequests}</div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handlePromote(entry.id)}
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
          businessId={getStoredUser()?.businessId || 'default'}
          onClose={() => setShowCreateEventModal(false)}
          onCreateEvent={(event) => {
            addEvent(event);
            setEvents(getStoredEvents());
          }}
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

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && eventToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl">
            {/* Warning Icon */}
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-red-600" />
            </div>
            
            <h3 className="text-2xl font-bold text-center mb-2">
              Delete Event?
            </h3>
            
            <p className="text-center text-gray-600 mb-4">
              You're about to delete the <span className="font-semibold text-gray-900">"{eventToDelete.name}"</span> event
            </p>
            
            {/* Warning Card */}
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-sm font-bold">!</span>
                </div>
                <div>
                  <h4 className="font-semibold text-red-900 mb-1">Warning: This action cannot be undone</h4>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• The event will be permanently deleted</li>
                    <li>• All waitlist entries will be removed</li>
                    <li>• Event data cannot be recovered</li>
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
                    deleteEvent(eventToDelete.id);
                    // Also remove all waitlist entries for this event
                    setWaitlist(waitlist.filter(w => w.eventId !== eventToDelete.id));
                    toast.success(`Event \"${eventToDelete.name}\" deleted successfully`);
                    // Refresh events
                    const updatedEvents = getStoredEvents().filter(e => e.businessId === user.businessId);
                    setEvents(updatedEvents);
                  }
                  setShowDeleteConfirmation(false);
                  setEventToDelete(null);
                }}
                className="flex-1 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold active:scale-95 transition-transform shadow-lg"
              >
                Delete Event
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