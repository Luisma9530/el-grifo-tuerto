// Web Audio API Synthesizer for El Grifo Tuerto
// Generates realistic dice rolling, tankard clinks, tavern fire crackle, and victory/fail sounds

const SFX_MUTED_KEY = 'tavern_sfx_muted';

function readMutedPreference() {
  try {
    return localStorage.getItem(SFX_MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

class TavernAudioEngine {
  constructor() {
    this.ctx = null;
    this.ambienceNode = null;
    this.isAmbiencePlaying = false;
    this.muted = readMutedPreference();
  }

  /** Turn sound effects (dice, fanfares, clinks) on or off; remembered across visits. */
  setMuted(muted) {
    this.muted = Boolean(muted);
    try {
      if (this.muted) localStorage.setItem(SFX_MUTED_KEY, '1');
      else localStorage.removeItem(SFX_MUTED_KEY);
    } catch {
      // ignore: the preference just won't persist
    }
  }

  init() {
    if (!this.ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.ctx = new AudioContext();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  // Realistic polyhedral dice rolling sound (multiple bounces)
  playDiceRoll() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const bounces = 4 + Math.floor(Math.random() * 3);

    for (let i = 0; i < bounces; i++) {
      const bounceTime = now + (i * 0.08) + (Math.random() * 0.04);
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      // Sharp wooden/acrylic clack frequency
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(450 + Math.random() * 300, bounceTime);
      osc.frequency.exponentialRampToValueAtTime(120, bounceTime + 0.04);

      gain.gain.setValueAtTime(0.25 / (i * 0.4 + 1), bounceTime);
      gain.gain.exponentialRampToValueAtTime(0.001, bounceTime + 0.045);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(bounceTime);
      osc.stop(bounceTime + 0.05);
    }
  }

  // Single clack of a die hitting the table, synced with the 3D dice physics.
  // strength: impact speed from the simulation (roughly 1.5–40)
  playDiceImpact(strength = 10) {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const level = Math.min(1, Math.max(0.08, strength / 30));
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380 + Math.random() * 260 + level * 160, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.045);

    gain.gain.setValueAtTime(0.28 * level, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  }

  // Natural 20 - Critical Hit Fanfare
  playCritSuccess() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6 (Epic Chord)

    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.09);

      gain.gain.setValueAtTime(0.2, now + idx * 0.09);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.09 + 0.8);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now + idx * 0.09);
      osc.stop(now + idx * 0.09 + 0.85);
    });
  }

  // Natural 1 - Critical Failure Ominous Gong
  playCritFail() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.9);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 1.1);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 1.2);
  }

  // Tavern Mug / Tankard Clink
  playTankardClink() {
    if (this.muted) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs = [1800, 2400, 3100];

    freqs.forEach((freq) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.4);
    });
  }

  // Ambient Fireplace & Tavern Embers Generator
  toggleTavernAmbience(forceState) {
    this.init();
    if (!this.ctx) return false;

    const targetState = forceState !== undefined ? forceState : !this.isAmbiencePlaying;

    if (targetState) {
      if (this.isAmbiencePlaying) return true;

      try {
        // Generate continuous warm crackle with noise buffer & bandpass filter
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const output = buffer.getChannelData(0);

        for (let i = 0; i < bufferSize; i++) {
          // Pink/Brown noise with random pop spikes simulating wood embers
          const isPop = Math.random() < 0.002;
          output[i] = isPop ? (Math.random() * 2 - 1) * 0.9 : (Math.random() * 2 - 1) * 0.08;
        }

        const whiteNoise = this.ctx.createBufferSource();
        whiteNoise.buffer = buffer;
        whiteNoise.loop = true;

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(800, this.ctx.currentTime);

        const gain = this.ctx.createGain();
        gain.gain.setValueAtTime(0.08, this.ctx.currentTime);

        whiteNoise.connect(filter);
        filter.connect(gain);
        gain.connect(this.ctx.destination);

        whiteNoise.start();
        this.ambienceNode = { source: whiteNoise, gain: gain };
        this.isAmbiencePlaying = true;
      } catch (e) {
        console.warn('Audio ambience start failed:', e);
      }
    } else {
      if (this.ambienceNode) {
        try {
          this.ambienceNode.source.stop();
          this.ambienceNode.source.disconnect();
        } catch {
          // source may already be stopped
        }
        this.ambienceNode = null;
      }
      this.isAmbiencePlaying = false;
    }

    return this.isAmbiencePlaying;
  }
}

export const tavernAudio = new TavernAudioEngine();
