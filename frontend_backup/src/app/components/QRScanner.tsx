import { useEffect, useRef, useState } from 'react';
import { QrCode, X, Camera, AlertCircle, RefreshCw } from 'lucide-react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [scannerActive, setScannerActive] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const hasScannedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    const readerId = 'qr-reader-' + Math.random().toString(36).substr(2, 9);

    const initScanner = async () => {
      // Wait a bit for the DOM to be ready
      await new Promise(resolve => setTimeout(resolve, 100));

      if (!isMounted || !containerRef.current) return;

      try {
        // Create a div for the scanner
        const readerDiv = document.createElement('div');
        readerDiv.id = readerId;
        containerRef.current.appendChild(readerDiv);

        // Initialize Html5QrcodeScanner (easier API)
        const scanner = new Html5QrcodeScanner(
          readerId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            rememberLastUsedCamera: true,
            showTorchButtonIfSupported: true,
            useBarCodeDetectorIfSupported: true,
          },
          /* verbose= */ false
        );

        scannerRef.current = scanner;

        scanner.render(
          (decodedText, decodedResult) => {
            // Success callback
            console.log('QR Code detected:', decodedText);
            if (!hasScannedRef.current && isMounted) {
              hasScannedRef.current = true;
              
              // Stop scanner before callback
              scanner.clear().then(() => {
                onScan(decodedText);
              }).catch(err => {
                console.error('Error clearing scanner:', err);
                onScan(decodedText);
              });
            }
          },
          (errorMessage) => {
            // Error callback - this fires often during scanning, ignore most
            // Only log actual errors, not "No QR code found"
            if (!errorMessage.includes('NotFoundException')) {
              // console.log('Scanner error:', errorMessage);
            }
          }
        );

        if (isMounted) {
          setScannerActive(true);
          setIsInitializing(false);
          setError(null);
        }
      } catch (err: any) {
        console.error('Camera initialization error:', err);
        if (isMounted) {
          setIsInitializing(false);
          setScannerActive(false);
          
          if (err.name === 'NotAllowedError' || err.message?.includes('Permission denied')) {
            setError('Camera access denied. Please allow camera permissions and try again.');
          } else if (err.name === 'NotFoundError' || err.message?.includes('not found')) {
            setError('No camera found on this device. Please use manual code entry.');
          } else if (err.name === 'NotReadableError') {
            setError('Camera is in use by another app. Please close other apps.');
          } else {
            setError(`Camera error: ${err.message || 'Unknown error'}. Please use manual code entry.`);
          }
        }
      }
    };

    initScanner();

    // Cleanup
    return () => {
      isMounted = false;
      if (scannerRef.current) {
        try {
          scannerRef.current.clear().catch(err => {
            console.log('Error clearing scanner on unmount:', err);
          });
        } catch (err) {
          console.log('Error during cleanup:', err);
        }
        scannerRef.current = null;
      }
    };
  }, [onScan]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualCode.trim()) {
      onScan(manualCode.trim().toUpperCase());
    }
  };

  const handleRetry = () => {
    setError(null);
    setIsInitializing(true);
    setScannerActive(false);
    
    // Reload the page to reinitialize everything
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-95 z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 text-white">
        <div className="flex items-center gap-2">
          <QrCode className="w-6 h-6" />
          <span className="font-medium">Scan QR Code</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>
      
      <style>{`
        /* Ensure html5-qrcode elements are visible and properly sized */
        #qr-reader-container video {
          width: 100% !important;
          height: auto !important;
          display: block !important;
          border-radius: 1rem;
        }
        
        #qr-reader-container {
          width: 100% !important;
        }
        
        /* Style the scanner UI */
        #qr-reader-container > div:first-child {
          border: none !important;
          padding: 0 !important;
        }
        
        #qr-reader-container button {
          background-color: rgba(59, 130, 246, 0.9) !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 500 !important;
          cursor: pointer !important;
          margin: 4px !important;
        }
        
        #qr-reader-container button:hover {
          background-color: rgba(37, 99, 235, 0.9) !important;
        }
        
        #qr-reader-container select {
          background-color: rgba(255, 255, 255, 0.1) !important;
          color: white !important;
          border: 1px solid rgba(255, 255, 255, 0.2) !important;
          padding: 8px !important;
          border-radius: 8px !important;
          margin: 4px !important;
        }
        
        #qr-reader-container span {
          color: white !important;
        }
        
        #qr-reader-container > div {
          background: transparent !important;
        }
      `}</style>
      
      <div className="flex-1 flex flex-col items-center justify-start p-6 gap-6 overflow-y-auto">
        {/* Camera Preview Container */}
        <div className="w-full max-w-md" id="qr-reader-container">
          <div className="relative bg-black rounded-2xl overflow-hidden shadow-2xl">
            <div 
              ref={containerRef}
              className="w-full min-h-[400px]"
            />
            
            {/* Loading State */}
            {isInitializing && !error && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
                <div className="text-center text-white p-6">
                  <Camera className="w-12 h-12 mx-auto mb-4 animate-pulse" />
                  <p className="text-lg font-semibold mb-2">Initializing Camera...</p>
                  <p className="text-sm text-white/70">Please allow camera access if prompted</p>
                </div>
              </div>
            )}
          </div>
          
          {/* Active Status */}
          {scannerActive && !error && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center gap-2 bg-green-500/20 text-green-400 px-4 py-2 rounded-full text-sm font-medium">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                Camera Active - Point at QR Code
              </div>
            </div>
          )}
        </div>

        {/* Error Message with Retry */}
        {error && (
          <div className="w-full max-w-md space-y-3">
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-semibold mb-1">Camera Error</p>
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            </div>
            
            {error.includes('denied') && (
              <button
                onClick={handleRetry}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
              >
                <RefreshCw className="w-4 h-4" />
                Retry Camera Access
              </button>
            )}
          </div>
        )}

        {/* Manual Code Entry */}
        <div className="w-full max-w-md bg-white/10 backdrop-blur-sm rounded-2xl p-6 text-white">
          <div className="text-center mb-4">
            <h3 className="text-lg font-semibold mb-1">Enter Code Manually</h3>
            <p className="text-sm text-white/70">
              Have an event code? Enter it below
            </p>
          </div>

          <form onSubmit={handleManualSubmit} className="space-y-3">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value.toUpperCase())}
              placeholder="e.g., PARK2024"
              className="w-full p-4 bg-white/10 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center text-lg font-mono tracking-wider uppercase"
              maxLength={20}
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white py-4 px-6 rounded-xl font-semibold active:scale-95 transition-transform shadow-lg"
            >
              Submit Code
            </button>
          </form>
        </div>

        <div className="text-white/60 text-sm text-center max-w-md space-y-2">
          <p>Point your camera at the QR code to scan automatically.</p>
          {scannerActive && (
            <p className="text-xs text-white/50">
              Tip: Make sure the QR code is well-lit and in focus
            </p>
          )}
        </div>
      </div>
    </div>
  );
}