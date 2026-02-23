import { useEffect, useRef, useState } from 'react';
import { QrCode, X, Camera } from 'lucide-react';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const hasAttemptedCamera = useRef(false);

  useEffect(() => {
    // Check if camera access is available
    const checkCamera = async () => {
      if (hasAttemptedCamera.current) return;
      hasAttemptedCamera.current = true;

      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const hasCamera = devices.some(device => device.kind === 'videoinput');
        
        if (!hasCamera) {
          setError('No camera detected. Please enter code manually.');
        }
      } catch (err) {
        setError('Camera access not available in this environment. Please enter code manually.');
      }
    };

    checkCamera();
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim());
    }
  };

  const handleSimulateJoin = () => {
    // Simulate scanning a QR code with a demo code
    onScan('WAITLIST-DEMO-' + Date.now());
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-90 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <QrCode className="w-6 h-6" />
          <span className="font-medium">Join Waitlist</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-8 text-white">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Camera className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Camera Not Available</h3>
            <p className="text-sm text-white/80">
              QR scanning requires camera access. Use the options below to join.
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-sm text-yellow-200">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleSimulateJoin}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-4 px-6 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
            >
              <QrCode className="w-5 h-5" />
              Join with Demo Code
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-transparent text-white/60">OR</span>
              </div>
            </div>

            <form onSubmit={handleManualSubmit} className="space-y-3">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Enter venue code manually"
                className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50"
              />
              <button
                type="submit"
                disabled={!manualCode.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform"
              >
                Submit Code
              </button>
            </form>
          </div>
        </div>

        <p className="text-white/60 text-sm text-center max-w-md">
          In a real environment, this would scan a QR code displayed at the venue.
        </p>
      </div>
    </div>
  );
}
