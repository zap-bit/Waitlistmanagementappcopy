import { useState } from 'react';
import { Users, CheckCircle, Edit2, X } from 'lucide-react';

export interface Table {
  id: number;
  row: number;
  col: number;
  name: string;
  capacity: number;
  occupied: boolean;
  guestName?: string;
  partySize?: number;
  seatedAt?: Date;
}

interface TableGridProps {
  tables: Table[];
  onClearTable: (tableId: number) => void;
  onRenameTable: (tableId: number, newName: string) => void;
  onUpdateCapacity: (tableId: number, capacity: number) => void;
  onManualOccupy: (tableId: number) => void;
}

export function TableGrid({ tables, onClearTable, onRenameTable, onUpdateCapacity, onManualOccupy }: TableGridProps) {
  const [editingTableId, setEditingTableId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editCapacity, setEditCapacity] = useState<number>(2);
  const cols = 4;
  const rows = Math.ceil(tables.length / cols);

  const getTable = (row: number, col: number) => {
    return tables.find((t) => t.row === row && t.col === col);
  };

  const occupiedCount = tables.filter((t) => t.occupied).length;
  const availableCount = tables.length - occupiedCount;

  const handleStartEdit = (table: Table) => {
    setEditingTableId(table.id);
    setEditName(table.name);
    setEditCapacity(table.capacity);
  };

  const handleSaveEdit = (tableId: number) => {
    if (editName.trim()) {
      onRenameTable(tableId, editName.trim());
    }
    if (editCapacity > 0 && editCapacity <= 20) {
      onUpdateCapacity(tableId, editCapacity);
    }
    setEditingTableId(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingTableId(null);
    setEditName('');
  };

  const editingTable = tables.find((t) => t.id === editingTableId);

  return (
    <>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Table Layout</h3>
          <div className="flex gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Available ({availableCount})</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span>Occupied ({occupiedCount})</span>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <div className="space-y-3 min-w-max">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <div key={rowIndex} className="flex gap-3">
                {Array.from({ length: cols }).map((_, colIndex) => {
                  const table = getTable(rowIndex, colIndex);
                  if (!table) return null;

                  return (
                    <div
                      key={table.id}
                      className={`relative rounded-lg border-2 transition-all overflow-hidden flex-shrink-0 ${
                        table.occupied
                          ? 'bg-red-50 border-red-500'
                          : 'bg-green-50 border-green-500'
                      }`}
                      style={{ width: '180px', minHeight: '160px' }}
                    >
                      <div className="absolute inset-0 flex flex-col items-center justify-center p-3 gap-1">
                        <div className="flex items-center gap-1 w-full justify-center">
                          <div className="text-xs font-bold text-center px-1">
                            {table.name}
                          </div>
                          {!table.occupied && (
                            <button
                              onClick={() => handleStartEdit(table)}
                              className="p-0.5 hover:bg-black/10 rounded flex-shrink-0"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                        {!table.occupied && (
                          <div className="text-[10px] text-gray-500">
                            Seats {table.capacity}
                          </div>
                        )}
                        {table.occupied ? (
                          <>
                            <div className="text-xs text-center w-full px-2 font-medium mt-1">
                              {table.guestName || 'Occupied'}
                            </div>
                            {table.partySize && (
                              <div className="flex items-center gap-1 text-xs text-gray-600">
                                <Users className="w-3 h-3" />
                                <span>{table.partySize}</span>
                              </div>
                            )}
                            <button
                              onClick={() => onClearTable(table.id)}
                              className="mt-1 px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded active:scale-95 transition-transform"
                            >
                              Clear
                            </button>
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-6 h-6 text-green-600 my-1" />
                            <button
                              onClick={() => onManualOccupy(table.id)}
                              className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded active:scale-95 transition-transform"
                            >
                              Occupy
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Table Modal */}
      {editingTableId && editingTable && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Edit Table</h3>
              <button
                onClick={handleCancelEdit}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Table Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Enter table name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Seating Capacity
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={editCapacity}
                  onChange={(e) => setEditCapacity(Number(e.target.value))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(editingTableId);
                    if (e.key === 'Escape') handleCancelEdit();
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum number of guests this table can accommodate</p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => handleSaveEdit(editingTableId)}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium active:scale-95 transition-transform"
                >
                  Save Changes
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg font-medium active:scale-95 transition-transform"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
