/** Tiny procedural sound engine — no audio files needed. */
class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.ready = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.32;
    this.master.connect(ctx.destination);

    // Engine: two detuned saws through a lowpass.
    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 900;
    this.oscA = ctx.createOscillator(); this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator(); this.oscB.type = 'square';
    this.oscB.detune.value = -9;
    const mixA = ctx.createGain(); mixA.gain.value = 0.6;
    const mixB = ctx.createGain(); mixB.gain.value = 0.22;
    this.oscA.connect(mixA).connect(this.engineFilter);
    this.oscB.connect(mixB).connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain).connect(this.master);
    this.oscA.start(); this.oscB.start();

    // Noise source for tire scrub and impacts.
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = ctx.createBufferSource();
    this.noise.buffer = buffer;
    this.noise.loop = true;
    this.skidFilter = ctx.createBiquadFilter();
    this.skidFilter.type = 'bandpass';
    this.skidFilter.frequency.value = 1700;
    this.skidFilter.Q.value = 1.2;
    this.skidGain = ctx.createGain();
    this.skidGain.gain.value = 0;
    this.noise.connect(this.skidFilter).connect(this.skidGain).connect(this.master);
    this.noise.start();
    this.ready = true;
  }

  setEngine(rpm, throttle, slip, active) {
    if (!this.ready) return;
    const now = this.ctx.currentTime;
    const freq = 32 + Math.max(rpm, 700) / 60 * 2.2;
    this.oscA.frequency.setTargetAtTime(freq, now, 0.04);
    this.oscB.frequency.setTargetAtTime(freq * 1.005, now, 0.04);
    this.engineFilter.frequency.setTargetAtTime(420 + throttle * 1500 + rpm * 0.08, now, 0.06);
    this.engineGain.gain.setTargetAtTime(active ? 0.11 + throttle * 0.16 : 0, now, 0.08);
    this.skidGain.gain.setTargetAtTime(active ? Math.min(slip * 0.015, 0.22) : 0, now, 0.05);
  }

  beep(freq = 660, duration = 0.16, volume = 0.25, type = 'square') {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + duration + 0.02);
  }

  hit() {
    if (!this.ready || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(45, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.2);
    osc.connect(gain).connect(this.master);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  }

  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.32, this.ctx.currentTime, 0.05);
    return this.muted;
  }
}

export const audio = new GameAudio();
