import { useState } from 'react';
import { X } from 'lucide-react';

interface CircularProgressProps {
  current: number;
  max: number;
  size?: number;
  onMaxEdit?: (newMax: number) => void;
}

export function CircularProgress({ current, max, size = 200, onMaxEdit }: CircularProgressProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [editValue, setEditValue] = useState(max.toString());
  
  const percentage = Math.min((current / max) * 100, 100);
  const radius = (size - 20) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  // Determine color based on capacity
  const getColor = () => {
    if (percentage < 50) return '#10b981'; // green
    if (percentage < 80) return '#f59e0b'; // amber
    return '#ef4444'; // red
  };

  const handleEditClick = () => {
    if (onMaxEdit) {
      setEditValue(max.toString());
      setShowEditModal(true);
    }
  };

  const handleSaveEdit = () => {
    const newMax = parseInt(editValue);
    if (!isNaN(newMax) && newMax > 0 && onMaxEdit) {
      onMaxEdit(newMax);
      setShowEditModal(false);
    }
  };

  return (
    <>
      <div className="flex flex-col items-center justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg className="transform -rotate-90" width={size} height={size}>
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="#e5e7eb"
              strokeWidth="10"
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={getColor()}
              strokeWidth="10"
              fill="none"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{
                transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease',
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-4xl font-bold">{current}</div>
            <div 
              className={`text-sm text-gray-600 ${onMaxEdit ? 'cursor-pointer hover:text-blue-600 hover:underline' : ''}`}
              onClick={handleEditClick}
              title={onMaxEdit ? 'Click to edit max capacity' : ''}
            >
              / {max}
            </div>
            <div className="text-xs text-gray-500 mt-1">Current</div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold">Edit Max Capacity</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Capacity
                </label>
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  min="1"
                  className="w-full p-3 border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSaveEdit();
                    }
                  }}
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowEditModal(false)}
                className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold active:scale-95 transition-transform"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
