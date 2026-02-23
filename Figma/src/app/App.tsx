import { useState, useEffect } from 'react';
import { StaffDashboard } from './components/StaffDashboard';
import { AttendeeView } from './components/AttendeeView';
import { Users, ClipboardList } from 'lucide-react';
import { Toaster } from 'sonner';
import { Table } from './components/TableGrid';

type Role = 'staff' | 'attendee' | null;

export interface WaitlistEntry {
  id: string;
  name: string;
  partySize: number;
  joinedAt: Date;
  estimatedWait: number;
  specialRequests?: string;
  type: 'reservation' | 'waitlist';
}

const getInitialWaitlist = (): WaitlistEntry[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('waitlist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.map((entry: any) => ({
          ...entry,
          joinedAt: new Date(entry.joinedAt),
          type: entry.type || 'waitlist', // Default to 'waitlist' if type is missing
        }));
      } catch (e) {
        console.error('Error loading waitlist from localStorage:', e);
      }
    }
  }
  // Default demo data
  return [
    {
      id: '1',
      name: 'Sarah Johnson',
      partySize: 4,
      joinedAt: new Date(Date.now() - 15 * 60000),
      estimatedWait: 25,
      type: 'waitlist' as const,
    },
    {
      id: '2',
      name: 'Michael Chen',
      partySize: 2,
      joinedAt: new Date(Date.now() - 10 * 60000),
      estimatedWait: 20,
      type: 'reservation' as const,
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      partySize: 6,
      joinedAt: new Date(Date.now() - 8 * 60000),
      estimatedWait: 30,
      type: 'waitlist' as const,
    },
    {
      id: '4',
      name: 'David Thompson',
      partySize: 3,
      joinedAt: new Date(Date.now() - 5 * 60000),
      estimatedWait: 15,
      type: 'reservation' as const,
    },
    {
      id: '5',
      name: 'Jessica Lee',
      partySize: 2,
      joinedAt: new Date(Date.now() - 3 * 60000),
      estimatedWait: 12,
      type: 'waitlist' as const,
    },
  ];
};

const getInitialTables = (): Table[] => {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem('tables');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert date strings back to Date objects
        return parsed.map((table: any) => ({
          ...table,
          seatedAt: table.seatedAt ? new Date(table.seatedAt) : undefined,
        }));
      } catch (e) {
        console.error('Error loading tables from localStorage:', e);
      }
    }
  }
  // Default tables
  const initialTables: Table[] = [];
  const defaultCapacities = [2, 2, 4, 4, 2, 4, 6, 6, 4, 4, 6, 8];
  const cols = 4;
  
  for (let i = 0; i < 12; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    initialTables.push({
      id: i + 1,
      row,
      col,
      name: `Table ${i + 1}`,
      capacity: defaultCapacities[i] || 4,
      occupied: false,
    });
  }
  return initialTables;
};

export default function App() {
  const [selectedRole, setSelectedRole] = useState<Role>(null);
  const [waitlist, setWaitlist] = useState<WaitlistEntry[]>(getInitialWaitlist);
  const [tables, setTables] = useState<Table[]>(getInitialTables);

  // Persist waitlist to localStorage whenever it changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('waitlist', JSON.stringify(waitlist));
    }
  }, [waitlist]);

  // Persist tables to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('tables', JSON.stringify(tables));
    }
  }, [tables]);

  const handleLogout = () => {
    setSelectedRole(null);
  };

  const addToWaitlist = (name: string, partySize: number, specialRequests?: string, type: 'reservation' | 'waitlist' = 'waitlist') => {
    const newEntry: WaitlistEntry = {
      id: Date.now().toString(),
      name,
      partySize,
      joinedAt: new Date(),
      estimatedWait: 15 + waitlist.length * 5,
      specialRequests,
      type,
    };
    setWaitlist((prev) => [...prev, newEntry]);
    return newEntry.id;
  };

  const removeFromWaitlist = (id: string) => {
    setWaitlist((prev) => prev.filter((e) => e.id !== id));
  };

  if (selectedRole === 'staff') {
    return (
      <>
        <StaffDashboard 
          onLogout={handleLogout} 
          waitlist={waitlist}
          setWaitlist={setWaitlist}
          tables={tables}
          setTables={setTables}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  if (selectedRole === 'attendee') {
    return (
      <>
        <AttendeeView 
          onLogout={handleLogout}
          waitlist={waitlist}
          addToWaitlist={addToWaitlist}
          removeFromWaitlist={removeFromWaitlist}
          allWaitlistEntries={waitlist}
          tables={tables}
        />
        <Toaster position="top-center" />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex flex-col items-center justify-center p-6 max-w-md mx-auto">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <ClipboardList className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-3 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Waitlist Manager
          </h1>
          <p className="text-gray-600">
            Select your role to continue
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => setSelectedRole('staff')}
            className="w-full bg-black hover:bg-gray-800 text-white py-6 px-6 rounded-2xl font-semibold flex items-center justify-between gap-4 shadow-lg active:scale-95 transition-transform group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center group-hover:bg-white/20 transition-colors">
                <ClipboardList className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-lg">Staff Dashboard</div>
                <div className="text-sm text-gray-400">Manage waitlist & capacity</div>
              </div>
            </div>
            <div className="text-2xl">→</div>
          </button>

          <button
            onClick={() => setSelectedRole('attendee')}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-6 px-6 rounded-2xl font-semibold flex items-center justify-between gap-4 shadow-lg active:scale-95 transition-transform group"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center group-hover:bg-white/30 transition-colors">
                <Users className="w-6 h-6" />
              </div>
              <div className="text-left">
                <div className="text-lg">Attendee View</div>
                <div className="text-sm text-white/80">Join & track your position</div>
              </div>
            </div>
            <div className="text-2xl">→</div>
          </button>
        </div>

        <div className="text-center text-sm text-gray-500 pt-4">
          <p>Demo Mode • All data is stored locally</p>
        </div>
      </div>
    </div>
  );
}
