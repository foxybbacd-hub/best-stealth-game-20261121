// Every sound in the game, synthesised with WebAudio. No audio files are
// shipped: footsteps are filtered noise, the alert is a dissonant brass-like
// swell, pickups and jingles are sine arpeggios. Nothing plays until the
// player has pressed a key or clicked, which is when the browser allows
// audio to start.

export class SoundEngine {
  constructor() {
    this.context = null;
    this.master = null;
    this.noiseBuffer = null;
    this.ambientNodes = null;
    this.muted = false;
  }

  /** Create the context on the first user gesture; safe to call repeatedly. */
  unlock() {
    if (this.context) {
      if (this.context.state === 'suspended') this.context.resume();
      return;
    }
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    this.context = new AudioContextClass();
    this.master = this.context.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.context.destination);
    const length = Math.floor(this.context.sampleRate * 0.25);
    this.noiseBuffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = this.noiseBuffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    this.startAmbient();
  }

  /** A very quiet low drone under the game, so silence never feels dead. */
  startAmbient() {
    if (!this.context || this.ambientNodes) return;
    const gain = this.context.createGain();
    gain.gain.value = 0.018;
    gain.connect(this.master);
    const oscillators = [52, 52.6].map((frequency) => {
      const oscillator = this.context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      oscillator.connect(gain);
      oscillator.start();
      return oscillator;
    });
    this.ambientNodes = { gain, oscillators };
  }

  /** A short tone with an attack and an exponential fade. */
  tone(frequency, seconds, type, volume, when = 0, slideTo = null) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + when;
    const oscillator = this.context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + seconds);
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    oscillator.connect(gain);
    gain.connect(this.master);
    oscillator.start(start);
    oscillator.stop(start + seconds + 0.05);
  }

  /** A burst of the shared noise buffer through a band-pass filter. */
  noise(seconds, filterFrequency, volume, when = 0, pan = 0) {
    if (!this.context || this.muted) return;
    const start = this.context.currentTime + when;
    const source = this.context.createBufferSource();
    source.buffer = this.noiseBuffer;
    const filter = this.context.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = filterFrequency;
    filter.Q.value = 1.1;
    const gain = this.context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + seconds);
    const panner =
      typeof StereoPannerNode !== 'undefined'
        ? this.context.createStereoPanner()
        : null;
    source.connect(filter);
    filter.connect(gain);
    if (panner) {
      panner.pan.value = Math.max(-1, Math.min(1, pan));
      gain.connect(panner);
      panner.connect(this.master);
    } else {
      gain.connect(this.master);
    }
    source.start(start);
    source.stop(start + seconds + 0.05);
  }

  /** The player's own step: soft when sneaking, a clear tap when walking. */
  footstep(sneaking) {
    this.noise(0.07, sneaking ? 320 : 480, sneaking ? 0.05 : 0.13);
  }

  /**
   * A guard's step, heard from where the guard stands: quieter with
   * distance, panned left or right, so the player can tell where a guard
   * is without looking. Beyond hearing range it is silent.
   */
  guardStep(distance, dx) {
    const hearRange = 11 * 40;
    if (distance > hearRange) return;
    const volume = 0.16 * (1 - distance / hearRange);
    const pan = Math.max(-0.8, Math.min(0.8, dx / 320));
    this.noise(0.09, 240, volume, 0, pan);
  }

  /** A single rising blip as a guard grows wary. */
  waryBlip() {
    this.tone(520, 0.12, 'sine', 0.12, 0, 660);
  }

  /** The alarm: two clashing sawtooth notes that say run or hide. */
  alertSting() {
    this.tone(196, 0.5, 'sawtooth', 0.16, 0, 185);
    this.tone(207.6, 0.5, 'sawtooth', 0.14, 0, 196);
    this.tone(392, 0.28, 'square', 0.07, 0.02, 415);
  }

  /** A pebble landing: a bright metallic tick, then a soft ring. */
  pebbleClink() {
    this.tone(1240, 0.09, 'triangle', 0.16, 0, 980);
    this.tone(1860, 0.16, 'sine', 0.07, 0.03);
  }

  /** Collecting a relic: a warm three-note chime. */
  pickupChime() {
    this.tone(659, 0.16, 'sine', 0.14);
    this.tone(880, 0.16, 'sine', 0.14, 0.08);
    this.tone(1318, 0.28, 'sine', 0.12, 0.16);
  }

  /** The exit unlocking once the last relic is taken. */
  unlockChime() {
    this.tone(523, 0.2, 'sine', 0.14);
    this.tone(784, 0.34, 'sine', 0.14, 0.12);
  }

  /** The win jingle: a short rising major arpeggio. */
  winJingle() {
    [523, 659, 784, 1046].forEach((frequency, i) => {
      this.tone(frequency, 0.3, 'sine', 0.15, i * 0.11);
    });
  }

  /** The caught jingle: a short falling minor figure. */
  loseJingle() {
    [392, 370, 311, 233].forEach((frequency, i) => {
      this.tone(frequency, 0.32, 'triangle', 0.13, i * 0.13);
    });
  }
}
