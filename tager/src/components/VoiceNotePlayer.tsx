import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause, RotateCcw, Volume2 } from 'lucide-react';

interface VoiceNotePlayerProps {
  src: string;
  isMerchant?: boolean;
}

// Pseudo-random realistic waveform bar heights (percentage 20% to 100%)
const WAVEFORM_BARS = [
  35, 60, 90, 50, 75, 100, 80, 60, 40, 70, 95, 85, 55, 45, 
  65, 90, 100, 80, 50, 35, 60, 85, 95, 70, 55, 40, 65, 45
];

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, isMerchant = false }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const waveformRef = useRef<HTMLDivElement | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);
  const [isLoading, setIsLoading] = useState(true);

  // Normalize media URL if relative
  const normalizedSrc = src.startsWith('http') 
    ? src 
    : `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}${src.startsWith('/') ? src : `/${src}`}`;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
      setIsLoading(false);
    };

    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (!duration && audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    const handleCanPlay = () => {
      setIsLoading(false);
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const handleError = () => {
      setIsPlaying(false);
      setIsLoading(false);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(err => {
        console.warn('Audio play notice (file might be corrupt or unsupported in test):', err);
        setIsPlaying(false);
      });
    }
  };

  const cyclePlaybackRate = () => {
    const audio = audioRef.current;
    if (!audio) return;

    let nextRate: 1 | 1.5 | 2 = 1;
    if (playbackRate === 1) nextRate = 1.5;
    else if (playbackRate === 1.5) nextRate = 2;
    else nextRate = 1;

    setPlaybackRate(nextRate);
    audio.playbackRate = nextRate;
  };

  const handleWaveformClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const container = waveformRef.current;
    if (!audio || !container || !duration) return;

    const rect = container.getBoundingClientRect();
    // In RTL, the start is at the right edge
    const clickX = e.clientX - rect.left;
    // Calculate percentage from right to left because Arabic is RTL
    const percent = 1 - (clickX / rect.width);
    const newTime = Math.max(0, Math.min(duration, percent * duration));

    audio.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className={`
      w-full min-w-[260px] sm:min-w-[300px] p-2.5 rounded-2xl transition-all select-none
      ${isMerchant ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-800'}
    `}>
      <audio ref={audioRef} src={normalizedSrc} preload="metadata" />

      <div className="flex items-center gap-3">
        {/* Play/Pause Circular Button */}
        <button
          type="button"
          onClick={togglePlay}
          className={`
            w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-md transition-transform active:scale-95 cursor-pointer
            ${isMerchant 
              ? 'bg-white text-primary hover:bg-white/90' 
              : 'bg-primary text-white hover:bg-pink-700 shadow-primary/20'}
          `}
          title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل التسجيل الصوتي'}
        >
          {isPlaying ? (
            <Pause size={18} className="fill-current" />
          ) : (
            <Play size={18} className="fill-current mr-0.5" />
          )}
        </button>

        {/* Waveform Visualization */}
        <div className="flex-1 flex flex-col justify-center min-w-0">
          <div
            ref={waveformRef}
            onClick={handleWaveformClick}
            className="h-7 flex items-center justify-between gap-0.5 cursor-pointer py-1"
            title="انقر للتخطي في التسجيل الصوتي"
          >
            {WAVEFORM_BARS.map((height, i) => {
              const barPercent = i / (WAVEFORM_BARS.length - 1);
              const isPlayed = barPercent <= progress;

              return (
                <div
                  key={i}
                  style={{ height: `${height}%` }}
                  className={`
                    flex-1 rounded-full transition-all duration-75 min-w-[2px]
                    ${isPlayed 
                      ? (isMerchant ? 'bg-white shadow-xs' : 'bg-primary') 
                      : (isMerchant ? 'bg-white/35 hover:bg-white/50' : 'bg-slate-300 hover:bg-slate-400')}
                  `}
                />
              );
            })}
          </div>

          {/* Time Display */}
          <div className="flex items-center justify-between text-[10px] font-extrabold opacity-90 mt-0.5 px-0.5">
            <span>{formatTime(currentTime)}</span>
            <span>{duration > 0 ? formatTime(duration) : '••:••'}</span>
          </div>
        </div>

        {/* Playback Speed Switcher Button */}
        <button
          type="button"
          onClick={cyclePlaybackRate}
          className={`
            px-2 py-1 rounded-lg text-[10px] font-black tracking-tight shrink-0 transition-all cursor-pointer
            ${isMerchant 
              ? 'bg-white/20 hover:bg-white/30 text-white' 
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'}
          `}
          title="تغيير سرعة الاستماع"
        >
          {playbackRate}x
        </button>
      </div>
    </div>
  );
};
