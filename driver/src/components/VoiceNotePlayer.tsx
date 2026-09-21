import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { Play, Pause, Volume2, RotateCcw } from 'lucide-react-native';
import { useThemeStore } from '../store/themeStore';
import { Fonts, Radius } from '../constants/theme';
import { normalizeMediaUrl } from '../utils/media';

interface VoiceNotePlayerProps {
  src: string;
  isDriver?: boolean;
}

const WAVEFORM_BARS = [
  35, 60, 90, 50, 75, 100, 80, 60, 40, 70, 95, 85, 55, 45,
  65, 90, 100, 80, 50, 35, 60, 85, 95, 70, 55, 40, 65, 45,
];

export const VoiceNotePlayer: React.FC<VoiceNotePlayerProps> = ({ src, isDriver = false }) => {
  const { colors } = useThemeStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const normalizedUrl = normalizeMediaUrl(src);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const audio = new Audio(normalizedUrl);
      audioRef.current = audio;

      const handleLoadedMetadata = () => {
        if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handleTimeUpdate = () => {
        setCurrentTime(audio.currentTime);
        if (!duration && audio.duration && !isNaN(audio.duration)) {
          setDuration(audio.duration);
        }
      };

      const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      audio.addEventListener('loadedmetadata', handleLoadedMetadata);
      audio.addEventListener('timeupdate', handleTimeUpdate);
      audio.addEventListener('ended', handleEnded);

      return () => {
        audio.pause();
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('ended', handleEnded);
        audioRef.current = null;
      };
    }
  }, [normalizedUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((err) => {
          console.warn('Playback error:', err);
          setIsPlaying(false);
        });
    }
  };

  const cycleSpeed = () => {
    if (!audioRef.current) return;
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    audioRef.current.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs)) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const progress = duration > 0 ? currentTime / duration : 0;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: isDriver ? 'rgba(255, 255, 255, 0.18)' : colors.surface,
        },
      ]}
    >
      {/* Play/Pause button */}
      <TouchableOpacity
        onPress={togglePlay}
        activeOpacity={0.8}
        style={[
          styles.playBtn,
          {
            backgroundColor: isDriver ? '#FFFFFF' : colors.primary,
          },
        ]}
      >
        {isPlaying ? (
          <Pause size={15} color={isDriver ? colors.primary : '#FFFFFF'} />
        ) : (
          <Play size={15} color={isDriver ? colors.primary : '#FFFFFF'} style={{ marginLeft: 2 }} />
        )}
      </TouchableOpacity>

      {/* Waveform Visualization */}
      <View style={styles.waveformContainer}>
        {WAVEFORM_BARS.map((h, i) => {
          const barProgress = i / WAVEFORM_BARS.length;
          const isPassed = barProgress <= progress;
          return (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: (h / 100) * 22 + 4,
                  backgroundColor: isDriver
                    ? isPassed
                      ? '#FFFFFF'
                      : 'rgba(255, 255, 255, 0.4)'
                    : isPassed
                    ? colors.primary
                    : colors.border,
                },
              ]}
            />
          );
        })}
      </View>

      {/* Speed & Timer info */}
      <View style={styles.metaRow}>
        <TouchableOpacity
          onPress={cycleSpeed}
          activeOpacity={0.7}
          style={[
            styles.speedBadge,
            {
              backgroundColor: isDriver ? 'rgba(255, 255, 255, 0.25)' : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.speedText,
              {
                color: isDriver ? '#FFFFFF' : colors.text,
                fontFamily: Fonts.bold,
              },
            ]}
          >
            {playbackRate}x
          </Text>
        </TouchableOpacity>

        <Text
          style={[
            styles.timeText,
            {
              color: isDriver ? 'rgba(255, 255, 255, 0.9)' : colors.textSecondary,
              fontFamily: Fonts.medium,
            },
          ]}
        >
          {isPlaying || currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: Radius.xl,
    gap: 8,
    minWidth: 220,
    maxWidth: 290,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  waveformContainer: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    height: 28,
    gap: 2,
    overflow: 'hidden',
  },
  waveformBar: {
    width: 2.5,
    borderRadius: 1.5,
  },
  metaRow: {
    alignItems: 'center',
    gap: 4,
  },
  speedBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: Radius.sm,
  },
  speedText: {
    fontSize: 10,
  },
  timeText: {
    fontSize: 10,
  },
});
