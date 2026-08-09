// Fully procedural audio: synthesized SFX + a layered synthwave loop.
// No assets. AudioContext unlocks on first user gesture.

import { clamp } from '../core/math';

// Captured before any seeded-run override — audio jitter is cosmetic and
// must not consume from the daily challenge's deterministic stream.
const nativeRandom = Math.random.bind(Math);

class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  sfxEnabled = true;
  musicEnabled = true;

  // --- music state ---
  private musicPlaying = false;
  private musicFilter: BiquadFilterNode | null = null;
  private lastIntensity = -1;
  private schedTimer: number | null = null;
  private nextNoteTime = 0;
  private step = 0; // 16th-note step counter
  private tempo = 112;
  intensity = 0; // 0 menu · 1 early · 2 mid · 3 boss/overdrive
  private barOfPhrase = 0;

  private lastShot = 0;
  private lastHit = 0;

  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.85;
    this.master.connect(this.ctx.destination);

    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.connect(this.master);

    this.sfxBus = this.ctx.createGain();
    this.sfxBus.gain.value = 0.9;
    this.sfxBus.connect(comp);

    this.musicBus = this.ctx.createGain();
    this.musicBus.gain.value = 0.4;
    // intensity-driven low-pass: the mix opens up as the run heats up
    this.musicFilter = this.ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 1400;
    this.musicFilter.Q.value = 0.8;
    this.musicBus.connect(this.musicFilter);
    this.musicFilter.connect(comp);

    // shared noise buffer
    const len = this.ctx.sampleRate;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = nativeRandom() * 2 - 1;
  }

  get ready(): boolean {
    return !!this.ctx;
  }

  // ---------------------------------------------------------------- SFX

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    vol: number,
    opts: { slideTo?: number; attack?: number; when?: number } = {},
  ): void {
    if (!this.ctx || !this.sfxBus || !this.sfxEnabled) return;
    const t = (opts.when ?? this.ctx.currentTime);
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (opts.slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.slideTo), t + dur);
    const atk = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g).connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private noise(dur: number, vol: number, filterFreq: number, opts: { slideTo?: number; type?: BiquadFilterType; when?: number } = {}): void {
    if (!this.ctx || !this.sfxBus || !this.noiseBuf || !this.sfxEnabled) return;
    const t = opts.when ?? this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(filterFreq, t);
    if (opts.slideTo !== undefined) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.slideTo), t + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  shoot(kind: number): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastShot < 0.045) return; // rate-limit
    this.lastShot = now;
    switch (kind) {
      case 0: this.tone(880, 0.07, 'square', 0.05, { slideTo: 330 }); break; // blaster
      case 1: this.noise(0.08, 0.1, 3000, { slideTo: 500, type: 'bandpass' }); break; // tesla
      case 2: this.tone(220, 0.12, 'sawtooth', 0.06, { slideTo: 90 }); break; // nova
      case 3: this.tone(1200, 0.05, 'triangle', 0.05, { slideTo: 2200 }); break; // swarm
      case 4: this.noise(0.22, 0.16, 6000, { slideTo: 300 }); this.tone(140, 0.22, 'sawtooth', 0.1, { slideTo: 60 }); break; // rail
      default: this.tone(700, 0.06, 'square', 0.04, { slideTo: 400 });
    }
  }

  hit(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    if (now - this.lastHit < 0.04) return;
    this.lastHit = now;
    this.tone(200 + nativeRandom() * 80, 0.05, 'square', 0.05, { slideTo: 100 });
  }

  kill(combo: number): void {
    const p = clamp(combo, 0, 40) / 40;
    this.noise(0.12, 0.14, 900 + p * 1200, { slideTo: 100 });
    this.tone(330 + p * 220, 0.1, 'square', 0.07, { slideTo: 55 });
  }

  bigKill(): void {
    this.noise(0.35, 0.3, 2500, { slideTo: 80 });
    this.tone(110, 0.35, 'sawtooth', 0.18, { slideTo: 40 });
  }

  // pentatonic ladder that climbs with pickup streak
  gem(streak: number): void {
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.7, 1318.5];
    const n = scale[clamp(streak, 0, scale.length - 1)];
    this.tone(n, 0.09, 'sine', 0.09, { slideTo: n * 1.001 });
    this.tone(n * 2, 0.06, 'sine', 0.03);
  }

  dash(): void {
    this.noise(0.18, 0.2, 800, { slideTo: 5000, type: 'bandpass' });
  }

  /** Rising zap ladder — one per dash-chain link. */
  chainKill(chain: number): void {
    const base = 440 * Math.pow(1.06, Math.min(chain, 24));
    this.tone(base, 0.12, 'square', 0.1, { slideTo: base * 1.5 });
    this.noise(0.1, 0.12, 2000 + chain * 150, { slideTo: 400 });
  }

  reaction(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.4, 0.25, 400, { slideTo: 6000, type: 'bandpass', when: t });
    this.tone(660, 0.3, 'sawtooth', 0.1, { when: t, slideTo: 1320 });
  }

  surgeStart(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 4; i++) {
      this.tone(110 * (i + 1), 0.5, 'sawtooth', 0.12, { when: t + i * 0.08, slideTo: 110 * (i + 1) * 1.2 });
    }
    this.noise(0.9, 0.2, 300, { slideTo: 5000, type: 'bandpass', when: t });
  }

  hurt(): void {
    this.tone(160, 0.25, 'sawtooth', 0.22, { slideTo: 60 });
    this.noise(0.2, 0.2, 400, { slideTo: 120 });
  }

  levelup(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, 0.22, 'triangle', 0.12, { when: t + i * 0.07, attack: 0.005 }));
  }

  chest(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 523.25, 659.25, 783.99, 1046.5].forEach((n, i) =>
      this.tone(n, 0.3, 'square', 0.06, { when: t + i * 0.06 }));
  }

  evolve(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.8, 0.15, 300, { slideTo: 6000, type: 'bandpass', when: t });
    [261.63, 329.63, 392, 523.25, 659.25, 783.99].forEach((n, i) =>
      this.tone(n, 0.5, 'sawtooth', 0.07, { when: t + i * 0.08 }));
  }

  overdrive(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.5, 0.2, 200, { slideTo: 8000, type: 'bandpass', when: t });
    [220, 277.18, 329.63, 440].forEach((n, i) => this.tone(n, 0.35, 'sawtooth', 0.09, { when: t + i * 0.05 }));
  }

  bossWarning(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.tone(98, 0.4, 'sawtooth', 0.2, { when: t + i * 0.5, slideTo: 92 });
      this.tone(103, 0.4, 'sawtooth', 0.15, { when: t + i * 0.5 });
    }
  }

  bossDown(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(1.2, 0.35, 4000, { slideTo: 50, when: t });
    this.tone(55, 1.2, 'sawtooth', 0.25, { when: t, slideTo: 30 });
    [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((n, i) =>
      this.tone(n, 0.6, 'triangle', 0.1, { when: t + 0.5 + i * 0.09 }));
  }

  gameOver(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [440, 415.3, 392, 329.63].forEach((n, i) => this.tone(n, 0.5, 'triangle', 0.14, { when: t + i * 0.28 }));
  }

  victory(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5].forEach((n, i) =>
      this.tone(n, 0.4, 'square', 0.1, { when: t + i * 0.15 }));
  }

  ui(): void {
    this.tone(700, 0.05, 'sine', 0.08, { slideTo: 900 });
  }

  buy(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(659.25, 0.1, 'sine', 0.1, { when: t });
    this.tone(987.77, 0.15, 'sine', 0.1, { when: t + 0.08 });
  }

  deny(): void {
    this.tone(180, 0.15, 'square', 0.08, { slideTo: 120 });
  }

  // ---------------------------------------------------------------- music
  // 8-bar phrase in A minor, 16th-note scheduler with lookahead.

  startMusic(): void {
    if (!this.ctx || this.musicPlaying) return;
    this.musicPlaying = true;
    this.nextNoteTime = this.ctx.currentTime + 0.06;
    this.step = 0;
    this.barOfPhrase = 0;
    this.schedTimer = window.setInterval(() => this.schedule(), 25);
  }

  stopMusic(): void {
    this.musicPlaying = false;
    if (this.schedTimer !== null) {
      clearInterval(this.schedTimer);
      this.schedTimer = null;
    }
  }

  setMusicEnabled(on: boolean): void {
    this.musicEnabled = on;
    if (this.musicBus && this.ctx) {
      this.musicBus.gain.cancelScheduledValues(this.ctx.currentTime);
      this.musicBus.gain.setValueAtTime(on ? 0.4 : 0, this.ctx.currentTime);
    }
  }

  private schedule(): void {
    if (!this.ctx || !this.musicPlaying) return;
    // sweep the filter when intensity shifts
    if (this.intensity !== this.lastIntensity && this.musicFilter) {
      this.lastIntensity = this.intensity;
      const cutoff = [900, 2400, 5200, 12000][Math.min(3, Math.max(0, this.intensity))];
      this.musicFilter.frequency.setTargetAtTime(cutoff, this.ctx.currentTime, 0.6);
    }
    const secPer16 = 60 / this.tempo / 4;
    while (this.nextNoteTime < this.ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextNoteTime);
      this.nextNoteTime += secPer16;
      this.step = (this.step + 1) % 16;
      if (this.step === 0) this.barOfPhrase = (this.barOfPhrase + 1) % 8;
    }
  }

  private mTone(freq: number, dur: number, type: OscillatorType, vol: number, when: number, slideTo?: number): void {
    if (!this.ctx || !this.musicBus || !this.musicEnabled) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, when);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), when + dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(when);
    osc.stop(when + dur + 0.02);
  }

  private mNoise(dur: number, vol: number, freq: number, when: number): void {
    if (!this.ctx || !this.musicBus || !this.noiseBuf || !this.musicEnabled) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, when);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    src.connect(f).connect(g).connect(this.musicBus);
    src.start(when);
    src.stop(when + dur + 0.02);
  }

  private playStep(s: number, t: number): void {
    // chord roots per 2 bars: Am F C G (classic synthwave loop)
    const roots = [110, 87.31, 65.41, 98]; // A2 F2 C2 G2
    const root = roots[(this.barOfPhrase >> 1) & 3];
    const lvl = this.intensity;

    // kick on quarters (always, quiet in menu) + sidechain-style duck
    if (s % 4 === 0) {
      this.mTone(150, 0.14, 'sine', lvl === 0 ? 0.12 : 0.3, t, 40);
      if (lvl >= 1 && this.musicBus && this.musicEnabled) {
        const g = this.musicBus.gain;
        g.setTargetAtTime(0.26, t, 0.015);
        g.setTargetAtTime(0.4, t + 0.06, 0.09);
      }
    }
    // bass: driving synthwave line with octave pops and a pickup note
    if (lvl >= 1) {
      const bassPat = [1, 0, 1, 1, 0, 1, 0, 2, 1, 0, 1, 1, 0, 2, 0, 0.5];
      const b = bassPat[s];
      if (b > 0) {
        this.mTone(root * (b === 2 ? 2 : 1) * (b === 0.5 ? 1.5 : 1), 0.11, 'sawtooth', 0.15, t);
      }
    }
    // arp: 16ths at lvl>=2
    if (lvl >= 2) {
      const arp = [1, 1.5, 2, 3, 2, 1.5]; // root, fifth, octave, twelfth...
      const mult = arp[(s + this.barOfPhrase * 3) % arp.length];
      this.mTone(root * 4 * mult, 0.08, 'square', 0.045, t);
    } else if (lvl === 1 && s % 4 === 2) {
      this.mTone(root * 4, 0.1, 'square', 0.04, t);
    }
    // hats: offbeat 8ths, 16ths at lvl 3
    if (lvl >= 1 && (s % 2 === (lvl >= 3 ? 0 : 1) || lvl >= 3)) {
      this.mNoise(0.03, lvl >= 3 ? 0.09 : 0.06, 8000, t);
    }
    // snare on 2 & 4 at lvl>=2, with a roll-fill closing every 8-bar phrase
    if (lvl >= 2 && (s === 4 || s === 12)) {
      this.mNoise(0.09, 0.16, 2000, t);
    }
    if (lvl >= 2 && this.barOfPhrase === 7 && s >= 12) {
      this.mNoise(0.05, 0.1 + (s - 12) * 0.03, 2400 + s * 100, t);
    }
    // pad swell at bar starts
    if (s === 0 && (this.barOfPhrase & 1) === 0) {
      const third = this.barOfPhrase >> 1 === 1 ? 5 / 4 : 6 / 5; // F major-ish color
      this.mTone(root * 2, 1.8, 'triangle', 0.05, t);
      this.mTone(root * 2 * third, 1.8, 'triangle', 0.04, t);
      this.mTone(root * 3, 1.8, 'triangle', 0.03, t);
    }
    // lead melody at lvl>=3, sparse
    if (lvl >= 3 && s % 8 === 6) {
      const mel = [4, 4.5, 6, 8][this.barOfPhrase % 4];
      this.mTone(root * mel, 0.3, 'sawtooth', 0.05, t, root * mel * 0.99);
    }
  }
}

export const audio = new AudioEngine();
