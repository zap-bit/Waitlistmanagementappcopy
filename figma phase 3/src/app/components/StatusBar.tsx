import { Loader2, Wifi, WifiOff } from 'lucide-react';

interface StatusBarProps {
  isOnline: boolean;
  isSyncing: boolean;
}

export function StatusBar({ isOnline, isSyncing }: StatusBarProps) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2 ${
        isOnline ? 'bg-green-600' : 'bg-red-600'
      } text-white`}
    >
      <div className="flex items-center gap-2">
        {isOnline ? (
          <Wifi className="w-4 h-4" />
        ) : (
          <WifiOff className="w-4 h-4" />
        )}
        <span className="text-sm font-medium">
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
      {isSyncing && (
        <div className="flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Syncing...</span>
        </div>
      )}
    </div>
  );
}
