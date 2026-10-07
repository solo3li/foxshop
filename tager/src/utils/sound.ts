import { Howl } from 'howler';

/**
 * Howler-powered Persistent Order Alert Manager
 * Provides continuous ringing loop for new incoming orders
 * with browser autoplay unlocking.
 */
class SoundNotifier {
  private isMuted: boolean = false;
  private continuousTimer: any = null;
  private alertSound: Howl | null = null;
  private audioCtx: AudioContext | null = null;

  constructor() {
    // Unlock AudioContext on first user interaction
    const unlock = () => {
      if (typeof window !== 'undefined') {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          if (!this.audioCtx) this.audioCtx = new AudioContextClass();
          if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        }
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('click', unlock);
      window.addEventListener('keydown', unlock);
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      this.stopContinuousAlert();
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Synthesizes a high-clarity 2-tone chime using Web Audio API
   */
  public playNewOrderAlert() {
    if (this.isMuted) return;

    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!this.audioCtx) {
        this.audioCtx = new AudioContextClass();
      }

      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;

      // First Ding (High Pitch)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc1.connect(gain1);
      gain1.connect(this.audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.4);

      // Second Dong (Harmonic confirmation)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(880, now + 0.18); // A5
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.35); // D6
      gain2.gain.setValueAtTime(0.45, now + 0.18);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.7);

      osc2.connect(gain2);
      gain2.connect(this.audioCtx.destination);
      osc2.start(now + 0.18);
      osc2.stop(now + 0.7);
    } catch {
      // Audio not permitted yet or not supported
    }
  }

  /**
   * Starts a continuous ringing loop every 2.5 seconds until accepted
   */
  public startContinuousAlert() {
    if (this.continuousTimer) return;
    this.playNewOrderAlert();
    this.continuousTimer = setInterval(() => {
      this.playNewOrderAlert();
    }, 2500);
  }

  /**
   * Stops continuous ringing loop
   */
  public stopContinuousAlert() {
    if (this.continuousTimer) {
      clearInterval(this.continuousTimer);
      this.continuousTimer = null;
    }
    if (this.alertSound) {
      this.alertSound.stop();
    }
  }
}

export const soundNotifier = new SoundNotifier();
