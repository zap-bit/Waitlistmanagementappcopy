import { QRCode } from 'react-qr-code';
import { X, Download, Copy, Share2 } from 'lucide-react';
import { Event } from '../utils/events';
import { toast } from 'sonner';

interface QRCodeModalProps {
  event: Event;
  onClose: () => void;
  queueId?: string;
  queueName?: string;
}

export function QRCodeModal({ event, onClose, queueId, queueName }: QRCodeModalProps) {
  // Create QR code data (JSON string with event info)
  const qrData = JSON.stringify({
    eventId: event.id,
    eventCode: event.eventCode,
    eventName: event.name,
    queueId: queueId || null,
    queueName: queueName || null,
    type: 'waitlist-event',
  });

  const displayName = queueName ? `${queueName} - ${event.name}` : event.name;
  const downloadFileName = queueName 
    ? `${event.name.replace(/\s+/g, '-')}-${queueName.replace(/\s+/g, '-')}-QR.png`
    : `${event.name.replace(/\s+/g, '-')}-QR.png`;

  const handleDownload = () => {
    // Get the SVG element
    const svg = document.getElementById('qr-code-svg');
    if (!svg) return;

    // Create a canvas to convert SVG to PNG
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size (QR code + padding)
    canvas.width = 600;
    canvas.height = 600;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Convert SVG to image
    const svgData = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      // Draw image centered with padding
      const padding = 40;
      const size = canvas.width - padding * 2;
      ctx.drawImage(img, padding, padding, size, size);

      // Download
      canvas.toBlob((blob) => {
        if (!blob) return;
        const link = document.createElement('a');
        link.download = downloadFileName;
        link.href = URL.createObjectURL(blob);
        link.click();
        URL.revokeObjectURL(link.href);
      });

      URL.revokeObjectURL(url);
      toast.success('QR code downloaded!');
    };

    img.src = url;
  };

  const handleCopyCode = () => {
    if (event.eventCode) {
      navigator.clipboard.writeText(event.eventCode);
      toast.success('Event code copied to clipboard!');
    }
  };

  const handleShare = async () => {
    const shareData = {
      title: displayName,
      text: queueName 
        ? `Join ${event.name} - ${queueName}! Use code: ${event.eventCode || 'N/A'}`
        : `Join ${event.name}! Use code: ${event.eventCode || 'N/A'}`,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast.success('Shared successfully!');
      } else {
        // Fallback to copy
        navigator.clipboard.writeText(`${shareData.title}\n${shareData.text}`);
        toast.success('Event details copied to clipboard!');
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className={`${queueName ? 'bg-gradient-to-r from-purple-600 to-pink-600' : 'bg-gradient-to-r from-blue-600 to-purple-600'} p-6 text-white`}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-2xl font-bold">{queueName ? 'Queue QR Code' : 'Event QR Code'}</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <p className="text-sm opacity-90">{displayName}</p>
          {queueName && (
            <p className="text-xs opacity-75 mt-1">Attendees will join this specific queue</p>
          )}
        </div>

        {/* QR Code Display */}
        <div className="p-8 flex flex-col items-center bg-gray-50">
          <div className="bg-white p-6 rounded-2xl shadow-lg border-4 border-gray-200">
            <QRCode
              id="qr-code-svg"
              value={qrData}
              size={280}
              level="H"
            />
          </div>

          {/* Event Code */}
          <div className="mt-6 bg-white rounded-xl p-4 w-full shadow-md border border-gray-200">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1 font-medium">Event Code</p>
              <div className="flex items-center justify-center gap-2">
                <p className="text-2xl font-bold text-gray-800 tracking-wider">
                  {event.eventCode || 'N/A'}
                </p>
                {event.eventCode && (
                  <button
                    onClick={handleCopyCode}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Copy code"
                  >
                    <Copy className="w-4 h-4 text-gray-600" />
                  </button>
                )}
              </div>
              {queueName && (
                <p className="text-xs text-gray-500 mt-2">
                  Queue: <span className="font-semibold text-gray-700">{queueName}</span>
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-gray-500 mt-4 text-center">
            {queueName 
              ? 'Attendees can scan this QR code to join this specific queue'
              : 'Attendees can scan this QR code or enter the event code manually'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-6 bg-white border-t border-gray-200 flex gap-3">
          <button
            onClick={handleDownload}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Download className="w-5 h-5" />
            Download
          </button>
          <button
            onClick={handleShare}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 active:scale-95 transition-transform"
          >
            <Share2 className="w-5 h-5" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}