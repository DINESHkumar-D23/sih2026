// Web Audio API Synthesizer for MTC Radar Hazard Chimes & VHF Squelch / Clicks

export class MtcSoundSynthesizer {
  private ctx: AudioContext | null = null;
  private lastBeepTime = 0;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  /**
   * Industrial dual-tone MTC alert chime: 880 Hz (A5) pulsing down to 660 Hz (E5)
   * Strictly respects isMuted parameter.
   */
  public playHazardChime(isMuted: boolean) {
    if (isMuted) return;

    const now = Date.now();
    // Throttle beeps so they trigger rhythmically every 2.2 seconds during active conflict
    if (now - this.lastBeepTime < 2200) return;
    this.lastBeepTime = now;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'square';
      osc2.type = 'sawtooth';

      const t = ctx.currentTime;
      osc1.frequency.setValueAtTime(880, t);
      osc1.frequency.exponentialRampToValueAtTime(660, t + 0.18);
      osc2.frequency.setValueAtTime(440, t);

      gain.gain.setValueAtTime(0.001, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start(t);
      osc2.start(t);
      osc1.stop(t + 0.3);
      osc2.stop(t + 0.3);
    } catch {
      // Graceful fallback if browser policies block audio
    }
  }

  public playCollisionWarning(isMuted: boolean) {
    this.playHazardChime(isMuted);
  }

  /**
   * Klaxon for all-pit emergency stop interlock
   */
  public playEmergencyKlaxon(isMuted: boolean) {
    if (isMuted) return;
    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(400, t);
      osc.frequency.linearRampToValueAtTime(800, t + 0.25);
      osc.frequency.linearRampToValueAtTime(400, t + 0.5);

      gain.gain.setValueAtTime(0.15, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.55);
    } catch {
      // Audio safety
    }
  }

  /**
   * Radio push-to-talk squelch click for dispatch actions.
   * Strictly respects isMuted parameter.
   */
  public playRadioClick(isMuted: boolean) {
    if (isMuted) return;

    try {
      const ctx = this.getContext();
      if (!ctx) return;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const t = ctx.currentTime;

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, t);
      gain.gain.setValueAtTime(0.05, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(t);
      osc.stop(t + 0.09);
    } catch {
      // Audio safety
    }
  }
}

export const audioSynth = new MtcSoundSynthesizer();
export const soundSynth = audioSynth;
export const mtcSynth = audioSynth;
