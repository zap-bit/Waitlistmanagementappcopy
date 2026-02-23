import { useState, useEffect } from 'react';
import { CircularProgress } from './CircularProgress';
import { StatusBar } from './StatusBar';
import { TableGrid, Table } from './TableGrid';
import { Plus, Minus, ArrowUp, UserX, LogOut, Menu, X } from 'lucide-react';
import { toast } from 'sonner';
import { WaitlistEntry } from '../App';

interface StaffDashboardProps {
  onLogout: () => void;
  waitlist: WaitlistEntry[];
  setWaitlist: React.Dispatch<React.SetStateAction<WaitlistEntry[]>>;
  tables: Table[];
  setTables: React.Dispatch<React.SetStateAction<Table[]>>;
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

export function StaffDashboard({ onLogout, waitlist, setWaitlist, tables, setTables }: StaffDashboardProps) {
  const [currentCapacity, setCurrentCapacity] = useState(() => getStoredNumber('currentCapacity', 45));
  const [maxCapacity] = useState(100);
  const [isOnline, setIsOnline] = useState(() => getStoredBoolean('isOnline', true));
  const [isSyncing, setIsSyncing] = useState(false);
  const [currentPage, setCurrentPage] = useState<'waitlist' | 'capacity'>('waitlist');
  const [listView, setListView] = useState<'waitlist' | 'reservation'>('waitlist');
  const [waitlistSubPage, setWaitlistSubPage] = useState<'view' | 'settings'>('view');
  const [menuOpen, setMenuOpen] = useState(false);
  const [totalTables, setTotalTables] = useState(() => getStoredNumber('totalTables', 12));

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
      localStorage.setItem('isOnline', JSON.stringify(isOnline));
    }
  }, [isOnline]);

  const handleIncreaseCapacity = () => {
    if (currentCapacity < maxCapacity) {
      setCurrentCapacity((prev) => prev + 1);
      simulateSync();
    }
  };

  const handleDecreaseCapacity = () => {
    if (currentCapacity > 0) {
      setCurrentCapacity((prev) => prev - 1);
      simulateSync();
    }
  };

  const parseSpecialRequests = (requests?: string) => {
    if (!requests) return { requestedTableId: null, nearGuestName: null };
    
    const lowerRequests = requests.toLowerCase();
    
    // Check for specific table request (e.g., "table 5" or "Table 5" or "#5")
    const tableMatch = lowerRequests.match(/table\s*(\d+)|#\s*(\d+)/);
    const requestedTableId = tableMatch ? parseInt(tableMatch[1] || tableMatch[2]) : null;
    
    // Check for "near [name]" request
    const nearMatch = requests.match(/near\s+(.+)/i);
    const nearGuestName = nearMatch ? nearMatch[1].trim() : null;
    
    return { requestedTableId, nearGuestName };
  };

  const findNearbyTable = (referenceTable: Table) => {
    // Find tables adjacent or diagonal to the reference table
    const nearbyTables = tables.filter((t) => {
      if (t.occupied) return false;
      const rowDiff = Math.abs(t.row - referenceTable.row);
      const colDiff = Math.abs(t.col - referenceTable.col);
      // Adjacent or diagonal (within 1 row and 1 column)
      return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
    });
    
    return nearbyTables.length > 0 ? nearbyTables[0] : null;
  };

  const handlePromote = (id: string) => {
    const entry = waitlist.find((e) => e.id === id);
    if (!entry) return;

    let selectedTable: Table | undefined = undefined;
    const { requestedTableId, nearGuestName } = parseSpecialRequests(entry.specialRequests);

    // Priority 1: Check if specific table was requested
    if (requestedTableId) {
      const requestedTable = tables.find((t) => t.id === requestedTableId);
      if (requestedTable && !requestedTable.occupied && requestedTable.capacity >= entry.partySize) {
        selectedTable = requestedTable;
        toast.success(`${entry.name} seated at requested ${requestedTable.name}`);
      } else if (requestedTable && requestedTable.occupied) {
        toast.info(`Requested ${requestedTable.name} is occupied. Finding alternative...`);
      } else if (requestedTable && requestedTable.capacity < entry.partySize) {
        toast.info(`Requested ${requestedTable.name} is too small. Finding alternative...`);
      }
    }

    // Priority 2: Check if they want to sit near another guest
    if (!selectedTable && nearGuestName) {
      const nearGuestTable = tables.find((t) => 
        t.occupied && t.guestName?.toLowerCase().includes(nearGuestName.toLowerCase())
      );
      
      if (nearGuestTable) {
        const nearbyTable = findNearbyTable(nearGuestTable);
        if (nearbyTable && nearbyTable.capacity >= entry.partySize) {
          selectedTable = nearbyTable;
          toast.success(`${entry.name} seated near ${nearGuestTable.guestName} at ${nearbyTable.name}`);
        } else {
          toast.info(`No tables available near ${nearGuestTable.guestName}. Finding alternative...`);
        }
      } else {
        toast.info(`Guest "${nearGuestName}" not found or not yet seated.`);
      }
    }

    // Priority 3: Find first available table that can accommodate the party size
    if (!selectedTable) {
      selectedTable = tables.find((t) => !t.occupied && t.capacity >= entry.partySize);
    }
    
    if (!selectedTable) {
      toast.error(`No tables available for party of ${entry.partySize}`);
      return;
    }

    // Assign guest to table
    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTable!.id
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

    // Remove from waitlist
    setWaitlist((prev) => prev.filter((e) => e.id !== id));
    
    if (!requestedTableId && !nearGuestName) {
      toast.success(`${entry.name} seated at ${selectedTable.name}`);
    }
    simulateSync();
  };

  const handleNoShow = (id: string) => {
    setWaitlist((prev) => prev.filter((entry) => entry.id !== id));
    simulateSync();
  };

  const simulateSync = () => {
    setIsSyncing(true);
    setTimeout(() => setIsSyncing(false), 1500);
  };

  const handleClearTable = (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              occupied: false,
              guestName: undefined,
              partySize: undefined,
              seatedAt: undefined,
            }
          : t
      )
    );

    toast.success(`Table ${tableId} cleared`);
    simulateSync();
  };

  const handleSeatAll = () => {
    const reservations = waitlist.filter((e) => e.type === 'reservation');
    
    if (reservations.length === 0) {
      toast.info('No reservations to seat');
      return;
    }

    // Sort reservations: those with special requests first
    const sortedReservations = [...reservations].sort((a, b) => {
      const aHasRequests = a.specialRequests && a.specialRequests.trim().length > 0;
      const bHasRequests = b.specialRequests && b.specialRequests.trim().length > 0;
      if (aHasRequests && !bHasRequests) return -1;
      if (!aHasRequests && bHasRequests) return 1;
      return 0;
    });

    let seatedCount = 0;
    let failedCount = 0;
    
    // Use a local copy of tables that we'll update as we process each reservation
    let updatedTables = [...tables];
    const seatedIds: string[] = [];

    // Helper function to find nearby table in local state
    const findNearbyTableLocal = (referenceTable: Table, localTables: Table[]) => {
      const nearbyTables = localTables.filter((t) => {
        if (t.occupied) return false;
        const rowDiff = Math.abs(t.row - referenceTable.row);
        const colDiff = Math.abs(t.col - referenceTable.col);
        return rowDiff <= 1 && colDiff <= 1 && !(rowDiff === 0 && colDiff === 0);
      });
      return nearbyTables.length > 0 ? nearbyTables[0] : null;
    };

    // Process each reservation
    sortedReservations.forEach((entry) => {
      let selectedTable: Table | undefined = undefined;
      const { requestedTableId, nearGuestName } = parseSpecialRequests(entry.specialRequests);

      // Priority 1: Check if specific table was requested
      if (requestedTableId) {
        const requestedTable = updatedTables.find((t) => t.id === requestedTableId);
        if (requestedTable && !requestedTable.occupied && requestedTable.capacity >= entry.partySize) {
          selectedTable = requestedTable;
        }
      }

      // Priority 2: Check if they want to sit near another guest
      if (!selectedTable && nearGuestName) {
        const nearGuestTable = updatedTables.find((t) => 
          t.occupied && t.guestName?.toLowerCase().includes(nearGuestName.toLowerCase())
        );
        
        if (nearGuestTable) {
          const nearbyTable = findNearbyTableLocal(nearGuestTable, updatedTables);
          if (nearbyTable && nearbyTable.capacity >= entry.partySize) {
            selectedTable = nearbyTable;
          }
        }
      }

      // Priority 3: Find first available table that can accommodate the party size
      if (!selectedTable) {
        selectedTable = updatedTables.find((t) => !t.occupied && t.capacity >= entry.partySize);
      }
      
      if (selectedTable) {
        // Update the local tables array
        updatedTables = updatedTables.map((t) =>
          t.id === selectedTable!.id
            ? {
                ...t,
                occupied: true,
                guestName: entry.name,
                partySize: entry.partySize,
                seatedAt: new Date(),
              }
            : t
        );

        seatedIds.push(entry.id);
        seatedCount++;
      } else {
        failedCount++;
      }
    });

    // Update state once with all changes
    if (seatedCount > 0) {
      setTables(updatedTables);
      setWaitlist((prev) => prev.filter((e) => !seatedIds.includes(e.id)));
      toast.success(`Seated ${seatedCount} reservation${seatedCount > 1 ? 's' : ''}`);
    }
    if (failedCount > 0) {
      toast.warning(`${failedCount} reservation${failedCount > 1 ? 's' : ''} could not be seated (no available tables)`);
    }
    simulateSync();
  };

  const handleClearAllTables = () => {
    const occupiedCount = tables.filter((t) => t.occupied).length;
    
    if (occupiedCount === 0) {
      toast.info('No occupied tables to clear');
      return;
    }

    setTables((prev) =>
      prev.map((t) => ({
        ...t,
        occupied: false,
        guestName: undefined,
        partySize: undefined,
        seatedAt: undefined,
      }))
    );

    toast.success(`Cleared all ${occupiedCount} occupied tables`);
    simulateSync();
  };

  const handleRenameTable = (tableId: number, newName: string) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, name: newName }
          : t
      )
    );
    toast.success(`Table renamed to "${newName}"`);
    simulateSync();
  };

  const handleUpdateCapacity = (tableId: number, capacity: number) => {
    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? { ...t, capacity }
          : t
      )
    );
    toast.success(`Table capacity updated to ${capacity}`);
    simulateSync();
  };

  const handleManualOccupy = (tableId: number) => {
    const table = tables.find((t) => t.id === tableId);
    if (!table) return;

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              occupied: true,
              guestName: undefined,
              partySize: undefined,
              seatedAt: new Date(),
            }
          : t
      )
    );

    toast.success(`${table.name} marked as occupied`);
    simulateSync();
  };

  const handleUpdateTableCount = (count: number) => {
    if (count < 1 || count > 24) return;

    const cols = 4;
    const newTables: Table[] = [];
    const defaultCapacities = [2, 2, 4, 4, 2, 4, 6, 6, 4, 4, 6, 8, 2, 4, 4, 6, 2, 4, 6, 8, 4, 4, 6, 8];

    // Keep existing table data where possible
    for (let i = 0; i < count; i++) {
      const existingTable = tables[i];
      const row = Math.floor(i / cols);
      const col = i % cols;

      if (existingTable && !existingTable.occupied) {
        // Preserve existing table settings if not occupied
        newTables.push({
          ...existingTable,
          id: i + 1,
          row,
          col,
        });
      } else if (existingTable && existingTable.occupied) {
        // Keep occupied tables as is
        newTables.push({
          ...existingTable,
          id: i + 1,
          row,
          col,
        });
      } else {
        // Create new table
        newTables.push({
          id: i + 1,
          row,
          col,
          name: `Table ${i + 1}`,
          capacity: defaultCapacities[i] || 4,
          occupied: false,
        });
      }
    }

    setTables(newTables);
    setTotalTables(count);
    toast.success(`Table count updated to ${count}`);
    simulateSync();
  };

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
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
            {currentPage === 'waitlist' 
              ? (waitlistSubPage === 'settings' ? 'Table Settings' : 'Waitlist Management')
              : 'Capacity Management'}
          </p>
        </div>
        <button
          onClick={onLogout}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </div>

      {menuOpen && (
        <div className="bg-white border-b border-gray-200 shadow-lg">
          <div>
            <button
              onClick={() => {
                setCurrentPage('waitlist');
                setWaitlistSubPage('view');
                setMenuOpen(false);
              }}
              className={`w-full p-4 text-left hover:bg-gray-100 transition-colors ${
                currentPage === 'waitlist' ? 'bg-blue-50 border-l-4 border-blue-600' : ''
              }`}
            >
              <div className="font-semibold">Waitlist & Tables</div>
              <div className="text-sm text-gray-600">Manage guests and seating</div>
            </button>
            {currentPage === 'waitlist' && (
              <div className="pl-8 bg-gray-50 border-l-4 border-blue-600">
                <button
                  onClick={() => {
                    setWaitlistSubPage('view');
                    setMenuOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-100 transition-colors ${
                    waitlistSubPage === 'view' ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="text-sm font-medium">View</div>
                </button>
                <button
                  onClick={() => {
                    setWaitlistSubPage('settings');
                    setMenuOpen(false);
                  }}
                  className={`w-full p-3 text-left hover:bg-gray-100 transition-colors ${
                    waitlistSubPage === 'settings' ? 'bg-blue-100' : ''
                  }`}
                >
                  <div className="text-sm font-medium">Table Settings</div>
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setCurrentPage('capacity');
              setMenuOpen(false);
            }}
            className={`w-full p-4 text-left hover:bg-gray-100 transition-colors ${
              currentPage === 'capacity' ? 'bg-blue-50 border-l-4 border-blue-600' : ''
            }`}
          >
            <div className="font-semibold">Capacity Management</div>
            <div className="text-sm text-gray-600">Monitor current capacity</div>
          </button>
          <button
            onClick={() => setIsOnline(!isOnline)}
            className="w-full p-4 text-left hover:bg-gray-100 transition-colors border-t border-gray-200"
          >
            <div className="font-semibold">Toggle {isOnline ? 'Offline' : 'Online'} Mode</div>
            <div className="text-sm text-gray-600">Current: {isOnline ? 'Online' : 'Offline'}</div>
          </button>
        </div>
      )}

      {currentPage === 'capacity' ? (
        <div className="flex-1 overflow-auto">
          <div className="p-6 bg-white">
            <h2 className="text-lg font-semibold mb-4 text-center">Current Capacity</h2>
            <div className="flex items-center justify-center gap-4">
              <button
                onClick={handleDecreaseCapacity}
                className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                disabled={currentCapacity === 0}
              >
                <Minus className="w-6 h-6" />
              </button>
              
              <CircularProgress current={currentCapacity} max={maxCapacity} size={180} />
              
              <button
                onClick={handleIncreaseCapacity}
                className="w-14 h-14 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center justify-center shadow-lg active:scale-95 transition-transform"
                disabled={currentCapacity === maxCapacity}
              >
                <Plus className="w-6 h-6" />
              </button>
            </div>
          </div>
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
    </div>
  );
}
