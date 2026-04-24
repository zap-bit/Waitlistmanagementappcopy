import { useEffect, useRef } from 'react';

interface SplashScreenProps {
  onVideoEnd: () => void;
}

export function SplashScreen({ onVideoEnd }: SplashScreenProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.play().catch(() => onVideoEnd());
    }
    const timer = setTimeout(onVideoEnd, 10000);
    return () => clearTimeout(timer);
  }, [onVideoEnd]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
      <video
        ref={videoRef}
        src="/animation_logo.mp4"
        muted
        playsInline
        onEnded={onVideoEnd}
        style={{ width: 320, height: 320, objectFit: 'contain', pointerEvents: 'none', display: 'block' }}
      />
    </div>
  );
}
