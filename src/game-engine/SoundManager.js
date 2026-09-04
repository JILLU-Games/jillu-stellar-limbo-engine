/**
 * SoundManager - Comprehensive Web Audio API Sound Utility for Casino Limbo
 *
 * Provides procedural sound synthesis with zero external audio assets or latency:
 * - Game State Triggers: Takeoff, Crashing, Multiplier Ticks, Victory Fanfare, Ignition Countdown, UI Clicks, Chips
 * - Full Web Audio API synthesizer using custom oscillators, noise buffers, and exponential gain curves
 * - State synchronization with LimboEngine lifecycle (IDLE, COUNTDOWN, FLYING, CRASHED)
 * - Mute and master volume management with localStorage persistence and cross-tab sync
 */

export class SoundManager {
  constructor(options = {}) {
    this.audioCtx = null;
    this.masterGain = null;
    this.isMuted = false;
    this.volume = options.defaultVolume ?? 0.6;
    this._listeners = new Set();
    this._activeThrustSource = null;
    this._activeThrustGain = null;

    // Load persisted mute and volume preferences
    if (typeof window !== "undefined") {
      try {
        const storedMute = window.localStorage.getItem("limbo_sound_muted");
        if (storedMute !== null) {
          this.isMuted = storedMute === "true";
        }
        const storedVol = window.localStorage.getItem("limbo_sound_volume");
        if (storedVol !== null) {
          const parsedVol = parseFloat(storedVol);
          if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 1) {
            this.volume = parsedVol;
          }
        }
      } catch (e) {
        // Handle localStorage restrictions in sandboxed iframes
      }
    }
  }

  /**
   * Initializes or resumes the Web Audio API AudioContext upon user gesture.
   * @returns {AudioContext|null}
   */
  getAudioContext() {
    if (typeof window === "undefined") return null;

    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
        this.masterGain = this.audioCtx.createGain();
        this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, this.audioCtx.currentTime);
        this.masterGain.connect(this.audioCtx.destination);
      }
    }

    if (this.audioCtx && this.audioCtx.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }

    return this.audioCtx;
  }

  /**
   * Toggles mute state and persists preference.
   * @returns {boolean} New mute state
   */
  toggleMute() {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  /**
   * Explicitly sets mute state.
   * @param {boolean} muted
   */
  setMuted(muted) {
    this.isMuted = !!muted;
    if (this.masterGain && this.audioCtx) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : this.volume, now);
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("limbo_sound_muted", String(this.isMuted));
      } catch (e) {}
    }
    this._notifyListeners();
  }

  /**
   * Sets master volume (0.0 to 1.0).
   * @param {number} vol
   */
  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.masterGain && this.audioCtx && !this.isMuted) {
      const now = this.audioCtx.currentTime;
      this.masterGain.gain.cancelScheduledValues(now);
      this.masterGain.gain.setValueAtTime(this.volume, now);
    }
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem("limbo_sound_volume", String(this.volume));
      } catch (e) {}
    }
    this._notifyListeners();
  }

  /**
   * Subscribes to sound settings changes.
   * @param {Function} listener
   * @returns {Function} Unsubscribe callback
   */
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notifyListeners() {
    for (const listener of this._listeners) {
      try {
        listener({ isMuted: this.isMuted, volume: this.volume });
      } catch (e) {
        console.error("[SoundManager] Error in listener:", e);
      }
    }
  }

  // ==========================================
  // Core Game State Trigger Synthesizers
  // ==========================================

  /**
   * Premium 'bet locked in' / bet placed trigger.
   * Plays a crisp, short confirmation double-chirp.
   */
  playBetPlaced() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(1800, now + 0.05);
      osc.frequency.setValueAtTime(1800, now + 0.05);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.1);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {}
  }

  /**
   * Tactile UI button click trigger.
   */
  playClick() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(650, now);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.04);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.045);
    } catch (e) {}
  }

  /**
   * Casino chip / multiplier quick-chip selection trigger.
   */
  playChip() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "triangle";
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(900, now + 0.07);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.075);
    } catch (e) {}
  }

  /**
   * Pre-launch countdown / ignition ignition beep trigger.
   * @param {number} [pitch=800]
   */
  playCountdown(pitch = 800) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(pitch, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.12);
    } catch (e) {}
  }

  /**
   * Takeoff / Rocket launch thruster trigger.
   * Synthesizes an ascending low-frequency rumble with supersonic harmonics.
   */
  playTakeoff() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Low frequency thruster rumble (Sawtooth)
      const rumbleOsc = ctx.createOscillator();
      const rumbleGain = ctx.createGain();

      rumbleOsc.type = "sawtooth";
      rumbleOsc.frequency.setValueAtTime(70, now);
      rumbleOsc.frequency.exponentialRampToValueAtTime(260, now + 0.45);

      rumbleGain.gain.setValueAtTime(0.24, now);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      rumbleOsc.connect(rumbleGain);
      rumbleGain.connect(this.masterGain || ctx.destination);

      rumbleOsc.start(now);
      rumbleOsc.stop(now + 0.52);

      // 2. High-frequency supersonic jet sweep (Triangle)
      const sweepOsc = ctx.createOscillator();
      const sweepGain = ctx.createGain();

      sweepOsc.type = "triangle";
      sweepOsc.frequency.setValueAtTime(280, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(850, now + 0.4);

      sweepGain.gain.setValueAtTime(0.12, now);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      sweepOsc.connect(sweepGain);
      sweepGain.connect(this.masterGain || ctx.destination);

      sweepOsc.start(now);
      sweepOsc.stop(now + 0.45);
    } catch (e) {}
  }

  // Backward compatibility alias for launch
  playLaunch() {
    this.playTakeoff();
  }

  /**
   * Ascending multiplier ticker frequency trigger.
   * Pitch scales mathematically with the current multiplier.
   * @param {number} [multiplier=1.0]
   */
  playTick(multiplier = 1.0) {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      // Dynamically scale pitch: 420 Hz at 1.0x up to 2400 Hz at high multipliers
      const baseFreq = Math.min(2400, 420 + Math.log2(Math.max(1, multiplier)) * 220);
      osc.type = "sine";
      osc.frequency.setValueAtTime(baseFreq, now);

      gain.gain.setValueAtTime(0.09, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.032);

      osc.connect(gain);
      gain.connect(this.masterGain || ctx.destination);

      osc.start(now);
      osc.stop(now + 0.035);
    } catch (e) {}
  }

  /**
   * Crashing / explosion loss trigger.
   * Synthesizes a heavy sub-bass impact with resonant explosion decay.
   */
  playCrash() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // 1. Heavy sub-bass thud (Triangle pitch-drop)
      const thudOsc = ctx.createOscillator();
      const thudGain = ctx.createGain();

      thudOsc.type = "triangle";
      thudOsc.frequency.setValueAtTime(160, now);
      thudOsc.frequency.exponentialRampToValueAtTime(32, now + 0.38);

      thudGain.gain.setValueAtTime(0.35, now);
      thudGain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

      thudOsc.connect(thudGain);
      thudGain.connect(this.masterGain || ctx.destination);

      thudOsc.start(now);
      thudOsc.stop(now + 0.45);

      // 2. Metallic distortion burst (Square wave)
      const burstOsc = ctx.createOscillator();
      const burstGain = ctx.createGain();

      burstOsc.type = "square";
      burstOsc.frequency.setValueAtTime(90, now);
      burstOsc.frequency.exponentialRampToValueAtTime(25, now + 0.2);

      burstGain.gain.setValueAtTime(0.15, now);
      burstGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      burstOsc.connect(burstGain);
      burstGain.connect(this.masterGain || ctx.destination);

      burstOsc.start(now);
      burstOsc.stop(now + 0.25);
    } catch (e) {}
  }

  // Backward compatibility alias for loss
  playLoss() {
    this.playCrash();
  }

  /**
   * Victory celebration fanfare trigger.
   * Plays a 4-note ascending C-major arpeggio (C5, E5, G5, C6) with harmonic overtones.
   */
  playWin() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6

      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.065;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, noteTime);

        gain.gain.setValueAtTime(0.24, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.38);

        osc.connect(gain);
        gain.connect(this.masterGain || ctx.destination);

        osc.start(noteTime);
        osc.stop(noteTime + 0.42);
      });
    } catch (e) {}
  }

  /**
   * High multiplier jackpot chime (for 10x+ payouts).
   */
  playJackpot() {
    if (this.isMuted) return;
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const chords = [
        [523.25, 659.25, 783.99], // C Major
        [587.33, 739.99, 880.0],  // D Major
        [659.25, 830.61, 987.77], // E Major
        [1046.5, 1318.5, 1567.98] // High C Major
      ];

      chords.forEach((chord, step) => {
        const chordTime = now + step * 0.08;
        chord.forEach((freq) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, chordTime);

          gain.gain.setValueAtTime(0.14, chordTime);
          gain.gain.exponentialRampToValueAtTime(0.001, chordTime + 0.45);

          osc.connect(gain);
          gain.connect(this.masterGain || ctx.destination);

          osc.start(chordTime);
          osc.stop(chordTime + 0.5);
        });
      });
    } catch (e) {}
  }

  /**
   * Handles game engine state transitions and fires the appropriate sound trigger.
   * @param {string} state - 'IDLE' | 'COUNTDOWN' | 'FLYING' | 'CRASHED'
   * @param {Object} [payload={}]
   */
  handleGameState(state, payload = {}) {
    switch (state) {
      case "COUNTDOWN":
        this.playCountdown();
        break;
      case "FLYING":
        this.playTakeoff();
        break;
      case "CRASHED":
        if (payload.win === true || payload.isWin === true) {
          if ((payload.multiplier || 0) >= 10.0) {
            this.playJackpot();
          } else {
            this.playWin();
          }
        } else if (payload.win === false || payload.isWin === false) {
          this.playCrash();
        }
        break;
      case "IDLE":
      default:
        break;
    }
  }

  /**
   * Automatically binds to an instance of LimboEngine to handle all audio triggers.
   * @param {Object} engine - LimboEngine instance
   * @returns {Function} Cleanup / unbind function
   */
  bindEngine(engine) {
    if (!engine || typeof engine.on !== "function") return () => {};

    const unsubCountdown = engine.on("state:countdown", (payload) => this.handleGameState("COUNTDOWN", payload));
    const unsubFlying = engine.on("state:flying", (payload) => this.handleGameState("FLYING", payload));
    const unsubCrashed = engine.on("state:crashed", (payload) => this.handleGameState("CRASHED", payload));
    const unsubTick = engine.on("round:tick", ({ multiplier }) => this.playTick(multiplier));

    return () => {
      unsubCountdown();
      unsubFlying();
      unsubCrashed();
      unsubTick();
    };
  }
}

// Export singleton instance for app-wide use
export const soundManager = new SoundManager();
export default soundManager;
