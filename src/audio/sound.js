// Sound, synthesised with WebAudio (no files): shaped noise and oscillators for footsteps, chops, strikes, thunder and
// roars, and ambient beds that follow the world (wind, rain, birdsong by day, crickets at night, the crackle of fires).
let ctx = null, master = null, noiseBuf = null, volume = 0.8;
export function setVolume(v) { volume = v; if (master) master.gain.value = 0.9 * v; }
const amb = {};
function init() {
  if (ctx) return true;
  try {
    ctx = new AudioContext(); master = ctx.createGain(); master.gain.value = 0.9 * volume; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate); const d = noiseBuf.getChannelData(0); let b = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b = 0.98 * b + 0.02 * w; d[i] = w * 0.6 + b * 2.5; }   // a little pinkish
    // ambient beds: looping noise through filters, faded by update()
    const bed = (type, freq, q, gain) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(f).connect(g).connect(master); s.start(); return { g, f, gain }; };
    amb.wind = bed('lowpass', 420, 0.7, 0.16); amb.rain = bed('highpass', 1800, 0.3, 0.22); amb.fire = bed('bandpass', 900, 1.2, 0.0);
    return true;
  } catch { return false; }
}
addEventListener('pointerdown', () => { init(); ctx?.resume?.(); }, { once: false });
addEventListener('keydown', () => { init(); ctx?.resume?.(); });
const now = () => ctx.currentTime;
function noise(dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.005, slide = 0, delay = 0 } = {}) {
  if (!init()) return; const t = now() + delay, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, attack = 0.005, delay = 0 } = {}) {
  if (!init()) return; const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
}
const SFX = {
  step: (surface) => surface === 'wood' ? noise(0.09, { freq: 500, q: 2, vol: 0.12 }) : surface === 'water' ? noise(0.2, { type: 'lowpass', freq: 900, vol: 0.12, slide: -500 }) : noise(0.11, { freq: 260 + Math.random() * 120, q: 0.8, vol: 0.09 }),
  jump: () => noise(0.12, { freq: 400, vol: 0.06 }),
  land: () => noise(0.18, { type: 'lowpass', freq: 300, vol: 0.2 }),
  chop: () => { noise(0.1, { freq: 1400, q: 3, vol: 0.35 }); tone(180, 0.12, { type: 'triangle', vol: 0.25, slide: -60 }); },
  creak: () => tone(110, 1.4, { type: 'sawtooth', vol: 0.05, slide: -40, attack: 0.3 }),
  thud: () => { noise(0.7, { type: 'lowpass', freq: 220, vol: 0.6, slide: -120 }); tone(55, 0.6, { vol: 0.35, slide: -20 }); },
  mine: () => { tone(1900 + Math.random() * 300, 0.18, { type: 'triangle', vol: 0.12, slide: -400 }); noise(0.08, { freq: 2600, q: 2, vol: 0.2 }); },
  hit: () => { noise(0.12, { type: 'lowpass', freq: 700, vol: 0.35 }); tone(120, 0.1, { type: 'square', vol: 0.06, slide: -40 }); },
  hurt: () => { noise(0.2, { freq: 500, q: 1.5, vol: 0.3 }); tone(220, 0.18, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  block: () => { tone(420, 0.15, { type: 'square', vol: 0.08, slide: -120 }); noise(0.1, { freq: 1200, q: 2, vol: 0.2 }); },
  parry: () => { tone(1200, 0.4, { type: 'triangle', vol: 0.15, slide: -300 }); noise(0.12, { freq: 3000, q: 4, vol: 0.2 }); },
  pick: () => { tone(660, 0.07, { type: 'triangle', vol: 0.08 }); tone(990, 0.08, { type: 'triangle', vol: 0.06, delay: 0.05 }); },
  craft: () => { noise(0.08, { freq: 900, q: 2, vol: 0.2 }); noise(0.08, { freq: 1200, q: 2, vol: 0.18, delay: 0.12 }); tone(520, 0.2, { type: 'triangle', vol: 0.06, delay: 0.22 }); },
  build: () => { noise(0.14, { type: 'lowpass', freq: 600, vol: 0.4 }); noise(0.1, { freq: 900, q: 2, vol: 0.2, delay: 0.1 }); },
  break: () => { noise(0.5, { type: 'lowpass', freq: 800, vol: 0.4, slide: -600 }); for (let i = 0; i < 4; i++) noise(0.06, { freq: 1500, q: 3, vol: 0.15, delay: 0.05 + i * 0.07 }); },
  repair: () => { tone(500, 0.1, { type: 'triangle', vol: 0.08 }); tone(750, 0.15, { type: 'triangle', vol: 0.08, delay: 0.1 }); },
  door: () => tone(160, 0.5, { type: 'sawtooth', vol: 0.04, slide: 80, attack: 0.1 }),
  chest: () => { noise(0.2, { type: 'lowpass', freq: 500, vol: 0.25 }); tone(240, 0.3, { type: 'sawtooth', vol: 0.03, slide: 60 }); },
  draw: () => noise(0.25, { freq: 2400, q: 6, vol: 0.06, slide: 800 }),
  sheathe: () => noise(0.2, { freq: 2000, q: 6, vol: 0.05, slide: -900 }),
  bow: () => { tone(140, 0.25, { type: 'triangle', vol: 0.18, slide: -40 }); noise(0.12, { freq: 1600, q: 1, vol: 0.12 }); },
  arrowHit: () => noise(0.1, { type: 'lowpass', freq: 600, vol: 0.3 }),
  arrowThud: () => noise(0.08, { freq: 400, q: 2, vol: 0.15 }),
  alert: () => noise(0.18, { freq: 700, q: 2, vol: 0.08, slide: 300 }),
  kill: () => tone(90, 0.5, { type: 'triangle', vol: 0.12, slide: -40 }),
  thunder: (k = 1) => { noise(2.6 * k, { type: 'lowpass', freq: 160, vol: 0.55 * k, slide: -100, attack: 0.02 }); noise(0.4, { type: 'lowpass', freq: 900, vol: 0.25 * k }); },
  roar: () => { tone(70, 1.4, { type: 'sawtooth', vol: 0.18, slide: -25, attack: 0.15 }); tone(105, 1.2, { type: 'square', vol: 0.06, slide: -40, attack: 0.15 }); noise(1.3, { type: 'lowpass', freq: 400, vol: 0.3, attack: 0.15, slide: -200 }); },
  summon: () => { tone(55, 3, { type: 'sawtooth', vol: 0.12, slide: 30, attack: 1 }); SFX.thunder(1.2); },
  reveal: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.6, { type: 'triangle', vol: 0.07, delay: i * 0.12 })),
  owl: () => { tone(420, 0.35, { vol: 0.12, slide: -40, attack: 0.05 }); tone(400, 0.6, { vol: 0.12, slide: -60, attack: 0.05, delay: 0.45 }); },
};
export function sound(name, ...a) { if (!ctx) return; try { SFX[name]?.(...a); } catch { /* audio is optional */ } }
// Ambient beds and occasional calls, from what's around the player
let birdT = 2, crickT = 1;
export function updateAmbience(dt, { wind = 0.3, rain = 0, night = 0, fire = 0, inside = 0 } = {}) {
  if (!ctx) return; const t = now(), k = 1 - inside * 0.6;
  amb.wind.g.gain.setTargetAtTime(amb.wind.gain * (0.35 + wind) * k, t, 0.8); amb.wind.f.frequency.setTargetAtTime(300 + wind * 500, t, 1);
  amb.rain.g.gain.setTargetAtTime(amb.rain.gain * rain * (inside ? 0.5 : 1), t, 0.8);
  amb.fire.g.gain.setTargetAtTime(0.14 * fire * (0.6 + Math.random() * 0.6), t, 0.05);
  if (fire > 0.1 && Math.random() < dt * 6 * fire) noise(0.03, { freq: 2500 + Math.random() * 2000, q: 4, vol: 0.12 * fire });
  birdT -= dt; crickT -= dt;
  if (birdT <= 0) { birdT = 1.5 + Math.random() * 5; if (night < 0.3 && rain < 0.3) { const f = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4); for (let i = 0; i < n; i++) tone(f * (1 + Math.random() * 0.15), 0.09, { vol: 0.025 * k, slide: Math.random() < 0.5 ? 600 : -500, delay: i * 0.13 }); } }
  if (crickT <= 0) { crickT = 0.4 + Math.random() * 0.8; if (night > 0.6 && rain < 0.3) for (let i = 0; i < 3; i++) tone(4200 + Math.random() * 300, 0.04, { type: 'square', vol: 0.006 * k, delay: i * 0.06 }); }
}
