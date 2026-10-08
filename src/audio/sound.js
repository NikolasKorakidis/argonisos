// Sound, all synthesised with WebAudio (no files).
//   Mix: everything goes through a gentle compressor; a generated reverb gives space to thunder, birds, music and the
//   echo of strikes.
//   Ambience follows the world: layered rain (a far hiss, the heavy rumble of a downpour, droplets, drumming on the roof
//   above you and muffled when you're inside), wind that gusts and whistles, leaves in the forest, waves near the shore,
//   birdsong by day, crickets, owls and (in the marsh) frogs at night, fires that crackle and roar.
//   Music: a sparse lyre in an old Greek mode, a phrase now and then, with a soft drone at dawn and dusk.
let ctx = null, out = null, sfxBus = null, ambBus = null, musicBus = null, verb = null, noiseBuf = null, brownBuf = null;
let volume = 0.8, musicVol = 0.5;
export function setVolume(v) { volume = v; if (out) out.gain.value = v; }
export function setMusicVolume(v) { musicVol = v; if (musicBus) musicBus.gain.value = 0.55 * v; }
const amb = {};
const rnd = (a, b) => a + Math.random() * (b - a);

function makeNoise(seconds, brown) {
  const b = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else { p1 = 0.97 * p1 + 0.03 * w; p2 = 0.6 * p2 + 0.4 * w; d[i] = (w * 0.5 + p1 * 2 + p2 * 0.3) * 0.6; } } }
  return b;
}
function makeVerb(seconds = 2.8) {   // a soft hall: decaying noise, a little darker in the tail
  const n = ctx.sampleRate * seconds, b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.6 - k * 0.45); d[i] = lp * Math.pow(1 - k, 2.4) * (i < 200 ? i / 200 : 1); } }
  const c = ctx.createConvolver(); c.buffer = b; return c;
}
function init() {
  if (ctx) return true;
  try {
    ctx = new AudioContext();
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    out = ctx.createGain(); out.gain.value = volume; comp.connect(out).connect(ctx.destination);
    verb = makeVerb(); const verbOut = ctx.createGain(); verbOut.gain.value = 0.5; verb.connect(verbOut).connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = 0.85; ambBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55 * musicVol; musicBus.connect(comp); const mv = ctx.createGain(); mv.gain.value = 0.7; musicBus.connect(mv).connect(verb);
    noiseBuf = makeNoise(4, false); brownBuf = makeNoise(4, true);
    // looping beds: noise → filter(s) → gain, faded by updateAmbience()
    const bed = (buf, chain, gain = 0) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; let node = s; const fs = []; for (const [type, f, q] of chain) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; fs.push(b); } const g = ctx.createGain(); g.gain.value = gain; node.connect(g).connect(ambBus); s.start(0, Math.random() * 3); return { g, f: fs, s }; };
    amb.windLow = bed(brownBuf, [['lowpass', 380, 0.6]]);
    amb.windHigh = bed(noiseBuf, [['bandpass', 900, 0.8]]);
    amb.whistle = bed(noiseBuf, [['bandpass', 1500, 14]]);
    amb.leaves = bed(noiseBuf, [['highpass', 2500, 0.5], ['lowpass', 7000, 0.5]]);
    amb.rainHiss = bed(noiseBuf, [['highpass', 1500, 0.4], ['lowpass', 9000, 0.4]]);
    amb.rainBody = bed(brownBuf, [['lowpass', 700, 0.5]]);
    amb.roof = bed(noiseBuf, [['bandpass', 600, 0.9], ['lowpass', 1400, 0.6]]);
    amb.sea = bed(brownBuf, [['lowpass', 500, 0.5]]);
    amb.fire = bed(brownBuf, [['lowpass', 280, 0.7]]);
    return true;
  } catch { return false; }
}
addEventListener('pointerdown', () => { init(); ctx?.resume?.(); });
addEventListener('keydown', () => { init(); ctx?.resume?.(); });
const now = () => ctx.currentTime;
// One shot of filtered noise. wet: how much goes to the reverb; pan: -1 left … 1 right
function noise(dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.005, slide = 0, delay = 0, wet = 0.1, pan = 0, bus, brown } = {}) {
  if (!init()) return; const t = now() + delay, s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.playbackRate.value = 0.85 + Math.random() * 0.3;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan; s.connect(f).connect(g).connect(p); p.connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verb); }
  s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
}
function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, attack = 0.005, delay = 0, wet = 0.15, pan = 0, bus, release } = {}) {
  if (!init()) return; const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
  const p = ctx.createStereoPanner(); p.pan.value = pan; o.connect(g).connect(p); p.connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verb); }
  o.start(t); o.stop(t + (release ?? dur) + 0.05);
}
// a plucked string: a bright attack that darkens as it rings (the lyre)
function pluck(freq, { vol = 0.12, delay = 0, dur = 2.6, pan = 0 } = {}) {
  if (!init()) return; const t = now() + delay;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = freq; o2.frequency.value = freq * 1.002;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(freq * 9, t); f.frequency.exponentialRampToValueAtTime(freq * 1.3, t + dur * 0.6);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan; o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(p).connect(musicBus); o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}

const SFX = {
  step: (surface) => {
    if (surface === 'wood') { noise(0.1, { freq: 420, q: 3, vol: 0.13 }); tone(140, 0.08, { type: 'triangle', vol: 0.05, wet: 0.2 }); }
    else if (surface === 'water') { noise(0.28, { type: 'lowpass', freq: 1200, vol: 0.14, slide: -800 }); noise(0.12, { freq: 2500, q: 2, vol: 0.05, delay: 0.05 }); }
    else if (surface === 'stone') noise(0.07, { freq: 1800, q: 1.5, vol: 0.09 });
    else { noise(0.12, { type: 'lowpass', freq: 380, vol: 0.12, brown: true }); noise(0.16, { freq: 3200, q: 0.7, vol: 0.035 }); }   // a soft thud and the swish of grass
  },
  jump: () => noise(0.14, { freq: 500, vol: 0.06 }),
  land: () => { noise(0.22, { type: 'lowpass', freq: 260, vol: 0.28, brown: true }); noise(0.1, { freq: 2800, q: 0.8, vol: 0.05 }); },
  chop: () => { noise(0.09, { freq: 1500, q: 3, vol: 0.32, wet: 0.25 }); tone(170, 0.14, { type: 'triangle', vol: 0.22, slide: -60, wet: 0.3 }); noise(0.25, { type: 'lowpass', freq: 400, vol: 0.12, brown: true }); },
  creak: () => { tone(95, 1.6, { type: 'sawtooth', vol: 0.045, slide: -30, attack: 0.4, wet: 0.4 }); tone(140, 1.2, { type: 'sawtooth', vol: 0.025, slide: 40, attack: 0.3, delay: 0.5, wet: 0.4 }); },
  thud: () => { noise(0.9, { type: 'lowpass', freq: 200, vol: 0.7, slide: -120, brown: true, wet: 0.4 }); tone(48, 0.7, { vol: 0.4, slide: -18 }); for (let i = 0; i < 6; i++) noise(0.2, { freq: 2500 + Math.random() * 2000, q: 1, vol: 0.05, delay: 0.1 + Math.random() * 0.5 }); },
  mine: () => { tone(1800 + Math.random() * 400, 0.22, { type: 'triangle', vol: 0.12, slide: -400, wet: 0.35 }); noise(0.08, { freq: 2600, q: 2, vol: 0.2 }); noise(0.3, { type: 'lowpass', freq: 500, vol: 0.12, brown: true, delay: 0.03 }); },
  hit: () => { noise(0.14, { type: 'lowpass', freq: 650, vol: 0.38, brown: true, wet: 0.15 }); tone(110, 0.12, { type: 'square', vol: 0.05, slide: -40 }); noise(0.05, { freq: 2200, q: 1, vol: 0.08 }); },
  hurt: () => { noise(0.22, { freq: 480, q: 1.5, vol: 0.3 }); tone(210, 0.2, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  block: () => { tone(380, 0.18, { type: 'square', vol: 0.07, slide: -120, wet: 0.25 }); noise(0.12, { freq: 1100, q: 2, vol: 0.22 }); },
  parry: () => { tone(1250, 0.6, { type: 'triangle', vol: 0.14, slide: -300, wet: 0.5 }); tone(1870, 0.5, { type: 'sine', vol: 0.06, wet: 0.5 }); noise(0.12, { freq: 3200, q: 4, vol: 0.2 }); },
  pick: () => { noise(0.1, { freq: 1800, q: 0.8, vol: 0.06 }); tone(700, 0.08, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
  craft: () => { noise(0.08, { freq: 900, q: 2, vol: 0.2 }); noise(0.08, { freq: 1300, q: 2, vol: 0.17, delay: 0.13 }); tone(523, 0.3, { type: 'triangle', vol: 0.06, delay: 0.24, wet: 0.4 }); tone(784, 0.4, { type: 'triangle', vol: 0.05, delay: 0.32, wet: 0.4 }); },
  build: () => { noise(0.16, { type: 'lowpass', freq: 550, vol: 0.45, brown: true, wet: 0.25 }); noise(0.1, { freq: 900, q: 2, vol: 0.2, delay: 0.1 }); },
  break: () => { noise(0.6, { type: 'lowpass', freq: 800, vol: 0.45, slide: -600, wet: 0.3 }); for (let i = 0; i < 5; i++) noise(0.06, { freq: 1500, q: 3, vol: 0.15, delay: 0.05 + i * 0.07 }); },
  repair: () => { tone(500, 0.12, { type: 'triangle', vol: 0.08 }); tone(750, 0.18, { type: 'triangle', vol: 0.08, delay: 0.1, wet: 0.3 }); },
  door: () => { tone(150, 0.6, { type: 'sawtooth', vol: 0.035, slide: 90, attack: 0.12, wet: 0.3 }); noise(0.12, { type: 'lowpass', freq: 400, vol: 0.15, delay: 0.45, brown: true }); },
  chest: () => { noise(0.22, { type: 'lowpass', freq: 500, vol: 0.25, brown: true }); tone(230, 0.35, { type: 'sawtooth', vol: 0.03, slide: 60, wet: 0.3 }); },
  draw: () => noise(0.25, { freq: 2400, q: 6, vol: 0.06, slide: 800 }),
  sheathe: () => noise(0.2, { freq: 2000, q: 6, vol: 0.05, slide: -900 }),
  bow: () => { tone(130, 0.3, { type: 'triangle', vol: 0.2, slide: -40, wet: 0.25 }); noise(0.14, { freq: 1600, q: 1, vol: 0.12 }); noise(0.4, { freq: 900, q: 0.5, vol: 0.05, slide: -500, delay: 0.05 }); },
  arrowHit: () => { noise(0.1, { type: 'lowpass', freq: 600, vol: 0.32, brown: true }); noise(0.05, { freq: 2000, q: 2, vol: 0.08 }); },
  arrowThud: () => { noise(0.08, { freq: 420, q: 2, vol: 0.16 }); tone(240, 0.12, { type: 'triangle', vol: 0.04, slide: 40 }); },
  alert: () => noise(0.2, { freq: 650, q: 2.5, vol: 0.09, slide: 350 }),
  kill: () => tone(90, 0.5, { type: 'triangle', vol: 0.12, slide: -40, wet: 0.3 }),
  // thunder: a crack when it's close, then a long roll of rumbling bursts under the reverb
  thunder: (k = 1) => {
    const near = k > 0.9; if (near) { noise(0.25, { freq: 2200, q: 0.5, vol: 0.35 * k, wet: 0.6 }); noise(0.5, { type: 'lowpass', freq: 1200, vol: 0.4 * k, wet: 0.6, delay: 0.05 }); }
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) noise(rnd(1.2, 2.6), { type: 'lowpass', freq: rnd(120, 260), vol: rnd(0.25, 0.5) * k * (1 - i / (n + 2)), slide: -80, attack: rnd(0.05, 0.3), delay: (near ? 0.2 : 0.6) + i * rnd(0.25, 0.55), brown: true, wet: 0.7, pan: rnd(-0.6, 0.6), bus: ambBus });
  },
  roar: () => { tone(66, 1.5, { type: 'sawtooth', vol: 0.2, slide: -24, attack: 0.15, wet: 0.5 }); tone(99, 1.3, { type: 'square', vol: 0.06, slide: -38, attack: 0.15, wet: 0.5 }); noise(1.4, { type: 'lowpass', freq: 420, vol: 0.32, attack: 0.15, slide: -220, brown: true, wet: 0.5 }); },
  summon: () => { tone(55, 3.2, { type: 'sawtooth', vol: 0.12, slide: 30, attack: 1, wet: 0.6 }); SFX.thunder(1.2); },
  reveal: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, { vol: 0.1, delay: i * 0.14, pan: -0.3 + i * 0.2 })),
  owl: () => { tone(400, 0.4, { vol: 0.11, slide: -30, attack: 0.06, wet: 0.5 }); tone(380, 0.7, { vol: 0.11, slide: -50, attack: 0.06, delay: 0.5, wet: 0.5 }); },
};
export function sound(name, ...a) { if (!ctx) return; try { SFX[name]?.(...a); } catch { /* audio is optional */ } }

// ---- the world's ambience, called every frame with what's around the player
// { wind 0..1, rain 0..1, night 0..1, dusk 0..1, fire 0..1, inside 0/1, roof 0/1, forest 0..1, marsh 0..1, sea 0..1 }
let gust = 0, gustTo = 0.3, gustT = 0, birdT = 2, crickT = 1, owlT = 20, frogT = 3, dropT = 0, musicT = 25, droneOn = false, drone = null;
const MODE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0];   // D Dorian over two octaves
export function updateAmbience(dt, w = {}) {
  if (!ctx) return; const t = now(), A = amb, sh = (node, v, tc = 0.6) => node.g.gain.setTargetAtTime(v, t, tc);
  const { wind = 0.3, rain = 0, night = 0, dusk = 0, fire = 0, inside = 0, roof = 0, forest = 0, marsh = 0, sea = 0 } = w, open = 1 - inside * 0.7;
  // wind: a slow random walk of gusts
  gustT -= dt; if (gustT <= 0) { gustT = rnd(2, 7); gustTo = Math.min(1, Math.max(0, wind + rnd(-0.25, 0.4))); }
  gust += (gustTo - gust) * Math.min(1, dt * 0.6);
  sh(A.windLow, (0.05 + gust * 0.22) * open); A.windLow.f[0].frequency.setTargetAtTime(220 + gust * 420, t, 1);
  sh(A.windHigh, gust * gust * 0.08 * open); A.windHigh.f[0].frequency.setTargetAtTime(600 + gust * 900, t, 1);
  sh(A.whistle, Math.max(0, gust - 0.65) * 0.05 * open); A.whistle.f[0].frequency.setTargetAtTime(1200 + gust * 900 + Math.sin(t * 0.7) * 150, t, 0.5);
  sh(A.leaves, forest * (0.02 + gust * 0.07) * open);
  // rain: hiss, body and droplets outside; drumming and a muffled hush under a roof
  sh(A.rainHiss, rain * 0.2 * (1 - inside * 0.8) * (roof ? 0.6 : 1)); sh(A.rainBody, rain * rain * 0.3 * (1 - inside * 0.6));
  sh(A.roof, roof ? rain * 0.22 : 0, 0.4);
  dropT -= dt; if (rain > 0.15 && dropT <= 0) { dropT = rnd(0.01, 0.06) / rain;
    if (roof) noise(rnd(0.03, 0.07), { type: 'lowpass', freq: rnd(900, 1600), vol: rnd(0.03, 0.09) * rain, pan: rnd(-0.8, 0.8), bus: ambBus, wet: 0.05 });
    else noise(rnd(0.015, 0.04), { freq: rnd(2200, 6000), q: rnd(1, 4), vol: rnd(0.015, 0.05) * rain * open, pan: rnd(-0.9, 0.9), bus: ambBus, wet: 0 }); }
  // the sea, breathing in long swells near the shore
  sh(A.sea, sea * (0.1 + 0.08 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 0.31)) * open, 0.8); A.sea.f[0].frequency.setTargetAtTime(380 + 160 * Math.sin(t * 0.7), t, 0.8);
  // fire: a low roar and crackles
  sh(A.fire, fire * 0.16, 0.2);
  if (fire > 0.1 && Math.random() < dt * 9 * fire) noise(rnd(0.01, 0.04), { freq: rnd(1800, 5000), q: 3, vol: rnd(0.04, 0.12) * fire, pan: rnd(-0.3, 0.3), bus: ambBus, wet: 0.05 });
  // creatures: birds by day, crickets, owls and frogs by night; the forest and the marsh have their own
  const calm = (1 - rain * 0.85) * open;
  birdT -= dt; if (birdT <= 0) { birdT = rnd(1.5, 6) / (1 + forest * 0.6); if (night < 0.3 && calm > 0.2) bird(calm * (1 - night)); }
  crickT -= dt; if (crickT <= 0) { crickT = rnd(0.25, 0.7); if (night > 0.5 && rain < 0.3) { const f = rnd(4100, 4600), p = rnd(-0.8, 0.8); for (let i = 0; i < 3; i++) tone(f, 0.035, { type: 'square', vol: 0.005 * calm * night, delay: i * 0.055, pan: p, wet: 0.1, bus: ambBus }); } }
  owlT -= dt; if (owlT <= 0) { owlT = rnd(18, 45); if (night > 0.6 && rain < 0.4) { const p = rnd(-0.7, 0.7), f = rnd(330, 380); tone(f, 0.35, { vol: 0.03 * calm, slide: -25, attack: 0.05, pan: p, wet: 0.7, bus: ambBus }); tone(f * 0.97, 0.55, { vol: 0.03 * calm, slide: -35, attack: 0.05, delay: 0.55, pan: p, wet: 0.7, bus: ambBus }); } }
  frogT -= dt; if (frogT <= 0) { frogT = rnd(0.4, 1.6); if (marsh > 0.3 && (night > 0.3 || rain > 0.3)) { const p = rnd(-0.9, 0.9), f = rnd(110, 180); for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(f, 0.09, { type: 'sawtooth', vol: 0.02 * marsh, slide: -20, delay: i * 0.13, pan: p, wet: 0.3, bus: ambBus }); } }
  // music: a lyre phrase now and then; a drone that swells at dawn and dusk
  musicT -= dt; if (musicT <= 0) { musicT = rnd(40, 90); phrase(night); }
  const wantDrone = dusk > 0.4; if (wantDrone !== droneOn) { droneOn = wantDrone; droneOn ? startDrone() : stopDrone(); }
}
function bird(k) {
  const p = rnd(-0.9, 0.9), kind = Math.floor(Math.random() * 4), base = rnd(1900, 3600), o = { bus: ambBus, pan: p, wet: 0.35 };
  if (kind === 0) for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(base * rnd(0.95, 1.08), 0.09, { ...o, vol: 0.022 * k, slide: rnd(400, 900), delay: i * 0.12 });   // chirps
  else if (kind === 1) { const n = 6 + Math.floor(Math.random() * 6); for (let i = 0; i < n; i++) tone(base * (1 + 0.05 * Math.sin(i)), 0.04, { ...o, vol: 0.018 * k, delay: i * 0.045 }); }   // a trill
  else if (kind === 2) { tone(base * 0.8, 0.22, { ...o, vol: 0.022 * k, slide: -300 }); tone(base * 0.66, 0.3, { ...o, vol: 0.02 * k, slide: -200, delay: 0.3 }); }   // a two-note call
  else for (let i = 0; i < 5; i++) tone(base * rnd(0.85, 1.2), rnd(0.06, 0.12), { ...o, vol: 0.016 * k, slide: rnd(-600, 700), delay: i * rnd(0.08, 0.14) });   // a warble
}
function phrase(night) {
  // a few notes stepping through the mode, sometimes a fifth above; slower and an octave lower at night
  let i = Math.floor(rnd(2, 7)); const n = 4 + Math.floor(Math.random() * 5), gap = night > 0.5 ? 0.75 : 0.55, oct = night > 0.5 ? 0.5 : 1;
  for (let k = 0; k < n; k++) { pluck(MODE[i] * oct, { vol: 0.09, delay: k * gap * rnd(0.85, 1.25), pan: rnd(-0.35, 0.35) }); if (Math.random() < 0.25) pluck(MODE[i] * 1.5 * oct, { vol: 0.04, delay: k * gap + 0.02 }); i = Math.max(0, Math.min(MODE.length - 1, i + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)])); }
  pluck(MODE[0] * oct, { vol: 0.06, delay: n * gap + 0.4, dur: 4 });
}
function startDrone() {
  if (drone) return; const t = now(), g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 6);
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500; f.connect(g).connect(musicBus);
  const os = [73.42, 110, 146.83].map((fr, i) => { const o = ctx.createOscillator(); o.type = i === 1 ? 'triangle' : 'sawtooth'; o.frequency.value = fr; o.detune.value = rnd(-6, 6); const og = ctx.createGain(); og.gain.value = i === 1 ? 0.6 : 0.25; o.connect(og).connect(f); o.start(); return o; });
  drone = { g, os };
}
function stopDrone() { if (!drone) return; const t = now(), d = drone; drone = null; d.g.gain.setTargetAtTime(0.0001, t, 2.5); setTimeout(() => d.os.forEach((o) => o.stop()), 12000); }
