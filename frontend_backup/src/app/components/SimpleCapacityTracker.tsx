import { Plus, Minus, Users, Check } from 'lucide-react';
import { SimpleCapacityEvent } from '../utils/events';

interface SimpleCapacityTrackerProps {
  event: SimpleCapacityEvent;
  onIncrement: () => void;
  onDecrement: () => void;
  onIncrementBy10: () => void;
  onDecrementBy10: () => void;
}

export function SimpleCapacityTracker({ event, onIncrement, onDecrement, onIncrementBy10, onDecrementBy10 }: SimpleCapacityTrackerProps) {
  const percentage = (event.currentCount / event.capacity) * 100;
  const remaining = event.capacity - event.currentCount;
  
  // Color based on percentage
  const getColor = () => {
    if (percentage >= 80) return { 
      stroke: '#ef4444', // Red
      lightStroke: '#fecaca',
      bg: 'bg-red-500',
      message: 'Almost at capacity',
      messageColor: 'text-red-600',
      textColor: 'text-red-600',
      percentColor: 'text-red-600'
    };
    if (percentage >= 50) return { 
      stroke: '#f97316', // Orange
      lightStroke: '#fed7aa',
      bg: 'bg-orange-500',
      message: 'Getting busy',
      messageColor: 'text-orange-600',
      textColor: 'text-orange-600',
      percentColor: 'text-orange-600'
    };
    return { 
      stroke: '#10b981', // Green
      lightStroke: '#d1fae5',
      bg: 'bg-emerald-500',
      message: 'Plenty of space available',
      messageColor: 'text-emerald-600',
      textColor: 'text-emerald-600',
      percentColor: 'text-emerald-600'
    };
  };
  
  const color = getColor();
  const radius = 130;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-start py-4 w-full min-h-screen">
      {/* Circular Progress */}
      <div className="relative flex items-center justify-center mb-6">
        <svg width="340" height="340" className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx="170"
            cy="170"
            r={radius}
            fill="none"
            stroke={color.lightStroke}
            strokeWidth="32"
          />
          {/* Progress circle */}
          <circle
            cx="170"
            cy="170"
            r={radius}
            fill="none"
            stroke={color.stroke}
            strokeWidth="32"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>
        
        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-center">
            <div className={`text-7xl font-bold ${color.textColor} leading-none`}>
              {event.currentCount}
            </div>
            <div className="text-3xl text-gray-400 font-normal">
              /{event.capacity}
            </div>
            <div className="mt-2 text-gray-500 text-lg">
              People Entered
            </div>
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className={`mb-6 flex items-center gap-2 ${color.messageColor} font-semibold text-base`}>
        <Check className="w-4 h-4" />
        {color.message}
      </div>

      {/* Control Buttons - Single Row */}
      <div className="flex items-center justify-center gap-3 mb-8">
        {/* Remove 10 */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecrementBy10}
            disabled={event.currentCount < 10}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-200 shadow-md relative
              ${event.currentCount < 10
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-red-100 hover:bg-red-200 active:scale-95'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center">
              <Minus className="w-5 h-5 text-red-600" />
              <span className="text-base text-red-600 font-bold">10</span>
            </div>
          </button>
          <span className="text-xs text-gray-700 font-medium">Remove 10</span>
        </div>

        {/* Remove 1 */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onDecrement}
            disabled={event.currentCount === 0}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-200 shadow-lg
              ${event.currentCount === 0
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-red-500 hover:bg-red-600 active:scale-95'
              }
            `}
          >
            <Minus className="w-8 h-8 stroke-[3] text-white" />
          </button>
          <span className="text-xs text-gray-700 font-medium">Remove 1</span>
        </div>

        {/* Add 1 */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onIncrement}
            disabled={event.currentCount >= event.capacity}
            className={`
              w-20 h-20 rounded-full flex items-center justify-center
              transition-all duration-200 shadow-lg
              ${event.currentCount >= event.capacity
                ? 'bg-gray-300 cursor-not-allowed'
                : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95'
              }
            `}
          >
            <Plus className="w-8 h-8 stroke-[3] text-white" />
          </button>
          <span className="text-xs text-gray-700 font-medium">Add 1</span>
        </div>

        {/* Add 10 */}
        <div className="flex flex-col items-center gap-2">
          <button
            onClick={onIncrementBy10}
            disabled={event.currentCount + 10 > event.capacity}
            className={`
              w-16 h-16 rounded-full flex items-center justify-center
              transition-all duration-200 shadow-md
              ${event.currentCount + 10 > event.capacity
                ? 'bg-gray-200 cursor-not-allowed'
                : 'bg-emerald-100 hover:bg-emerald-200 active:scale-95'
              }
            `}
          >
            <div className="flex flex-col items-center justify-center">
              <Plus className="w-5 h-5 text-emerald-600" />
              <span className="text-base text-emerald-600 font-bold">10</span>
            </div>
          </button>
          <span className="text-xs text-gray-700 font-medium">Add 10</span>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="flex gap-3 px-4">
        {/* Current */}
        <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex flex-col items-center min-w-[110px]">
          <div className="text-3xl font-bold text-gray-900 mb-1">
            {event.currentCount}
          </div>
          <div className="text-sm text-gray-500">
            Current
          </div>
        </div>

        {/* Remaining */}
        <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex flex-col items-center min-w-[110px]">
          <div className="text-3xl font-bold text-gray-600 mb-1">
            {remaining}
          </div>
          <div className="text-sm text-gray-500">
            Remaining
          </div>
        </div>

        {/* Capacity % */}
        <div className="bg-white rounded-xl shadow-sm px-6 py-4 flex flex-col items-center min-w-[110px]">
          <div className={`text-3xl font-bold ${color.percentColor} mb-1`}>
            {Math.round(percentage)}%
          </div>
          <div className="text-sm text-gray-500">
            Capacity
          </div>
        </div>
      </div>
    </div>
  );
}