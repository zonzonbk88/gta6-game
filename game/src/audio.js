// Synthesized sound with WebAudio — no audio files.
// Short one-shots (gunshot, cash, crash, pickup) are built from oscillators
// and filtered noise; the engine and the police siren are loops whose pitch
// follows the game state each frame.

export class SoundFX {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenLfo = null;
    this.muted = false;
    this.padTimer = 0;
    this.padStep = 0;
  }

  /** Must be called from a user gesture at least once. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(this.ctx.destination);
    this.startEngineLoop();
    this.startSirenLoop();
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.value = muted ? 0 : 0.5;
  }

  startEngineLoop() {
    const ctx = this.ctx;
    this.engineOsc = ctx.createOscillator();
    this.engineOsc.type = 'sawtooth';
    this.engineOsc.frequency.value = 55;
    const sub = ctx.createOscillator();
    sub.type = 'square';
    sub.frequency.value = 28;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineOsc.connect(filter);
    sub.connect(filter);
    filter.connect(this.engineGain);
    this.engineGain.connect(this.master);
    this.engineOsc.start();
    sub.start();
    this.engineSub = sub;
  }

  /** rpm01: 0 at idle, 1 at redline; active when the player is driving. */
  setEngine(rpm01, active) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    const freq = 52 + rpm01 * 165;
    this.engineOsc.frequency.setTargetAtTime(freq, t, 0.06);
    this.engineSub.frequency.setTargetAtTime(freq / 2, t, 0.06);
    this.engineGain.gain.setTargetAtTime(active ? 0.05 + rpm01 * 0.075 : 0, t, 0.09);
  }

  startSirenLoop() {
    const ctx = this.ctx;
    this.sirenOsc = ctx.createOscillator();
    this.sirenOsc.type = 'triangle';
    this.sirenOsc.frequency.value = 820;
    this.sirenLfo = ctx.createOscillator();
    this.sirenLfo.type = 'sine';
    this.sirenLfo.frequency.value = 0.55;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 130;
    this.sirenLfo.connect(lfoGain);
    lfoGain.connect(this.sirenOsc.frequency);
    this.sirenGain = ctx.createGain();
    this.sirenGain.gain.value = 0;
    this.sirenOsc.connect(this.sirenGain);
    this.sirenGain.connect(this.master);
    this.sirenOsc.start();
    this.sirenLfo.start();
  }

  /** level01: how present the sirens should sound this frame. */
  setSiren(level01) {
    if (!this.ctx || !this.sirenGain) return;
    this.sirenGain.gain.setTargetAtTime(level01 * 0.045, this.ctx.currentTime, 0.2);
  }

  blip(freq, dur, type = 'square', vol = 0.12, slideTo = null) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  }

  noiseBurst(dur, vol, filterFreq) {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start();
  }

  shot() {
    this.noiseBurst(0.14, 0.5, 2600);
    this.blip(160, 0.1, 'square', 0.2, 60);
  }
  dryFire() {
    this.blip(1200, 0.04, 'square', 0.06);
  }
  crash(intensity) {
    this.noiseBurst(0.22, Math.min(0.6, 0.15 + intensity * 0.4), 700);
    this.blip(70, 0.2, 'sine', 0.3, 40);
  }
  pickup() {
    this.blip(660, 0.09, 'square', 0.1);
    setTimeout(() => this.blip(990, 0.12, 'square', 0.1), 70);
  }
  cash() {
    const notes = [880, 1108, 1318, 1760];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.14, 'triangle', 0.12), i * 55));
  }
  door() {
    this.blip(220, 0.07, 'sine', 0.15, 140);
    this.noiseBurst(0.05, 0.08, 900);
  }
  bustedJingle() {
    const notes = [392, 370, 349, 311];
    notes.forEach((f, i) => setTimeout(() => this.blip(f, 0.24, 'triangle', 0.14), i * 160));
  }

  /** A slow, soft synth pad that loops under the whole game. */
  updatePad(dt) {
    if (!this.ctx || this.muted) return;
    this.padTimer -= dt;
    if (this.padTimer > 0) return;
    this.padTimer = 2.4;
    const chords = [
      [220.0, 261.63, 329.63],
      [174.61, 220.0, 261.63],
      [196.0, 246.94, 293.66],
      [164.81, 196.0, 261.63],
    ];
    const chord = chords[this.padStep % chords.length];
    this.padStep++;
    for (const freq of chord) this.blip(freq, 2.3, 'triangle', 0.016);
  }
}
