// Sound, synthesised with WebAudio, with recordings from the team's sound packs where there are some (footsteps on each
// ground, landings, doors, stone struck, the boss's growl and fire, close thunder; birdsong, crickets and rain as loops):
// a sound with recordings plays one of them, the rest are synthesised (and everything is, if the pack isn't there).
//   Mix: everything goes through a gentle compressor; a generated reverb gives space to thunder, birds, music and the
//   echo of strikes.
//   Ambience follows the world: layered rain (a far hiss, the heavy rumble of a downpour, droplets, drumming on the roof
//   above you and muffled when you're inside), wind that gusts and whistles, the wind in the leaves wherever trees stand
//   round you (day and night), waves near the shore, birdsong by day; crickets from dusk (a chorus in the meadows and
//   at the woods' edges, quieter deep in the trees, with a few singing close by), an owl now and then, a fox far off,
//   and (in the marsh) frogs at night; fires that crackle and roar.
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
    ambBus = ctx.createGain(); ambBus.gain.value = 1; ambBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55 * musicVol; musicBus.connect(comp); const mv = ctx.createGain(); mv.gain.value = 0.7; musicBus.connect(mv).connect(verb);
    noiseBuf = makeNoise(4, false); brownBuf = makeNoise(4, true);
    // looping beds: noise → filter(s) → gain, faded by updateAmbience()
    const bed = (buf, chain, gain = 0) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; let node = s; const fs = []; for (const [type, f, q] of chain) { const b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = q; node.connect(b); node = b; fs.push(b); } const g = ctx.createGain(); g.gain.value = gain; node.connect(g).connect(ambBus); s.start(0, Math.random() * 3); return { g, f: fs, s }; };
    amb.windLow = bed(brownBuf, [['lowpass', 380, 0.6]]);
    amb.windHigh = bed(noiseBuf, [['bandpass', 900, 0.8]]);
    amb.whistle = bed(noiseBuf, [['bandpass', 1500, 14]]);
    amb.leaves = bed(noiseBuf, [['highpass', 2500, 0.5], ['lowpass', 7000, 0.5]]);   // (the wind in the leaves: their hiss, and the softer rush under it)
    amb.leavesLo = bed(noiseBuf, [['bandpass', 1100, 0.6], ['lowpass', 2400, 0.5]]);
    amb.rainHiss = bed(noiseBuf, [['highpass', 1500, 0.4], ['lowpass', 9000, 0.4]]);
    amb.rainBody = bed(brownBuf, [['lowpass', 700, 0.5]]);
    amb.roof = bed(noiseBuf, [['bandpass', 600, 0.9], ['lowpass', 1400, 0.6]]);
    amb.sea = bed(brownBuf, [['lowpass', 500, 0.5]]);
    amb.fire = bed(brownBuf, [['lowpass', 280, 0.7]]);
    amb.roar = bed(brownBuf, [['lowpass', 120, 0.7]]);   // (the storm wall's deep, endless roar, near it)
    loadBank();
    return true;
  } catch { return false; }
}
addEventListener('pointerdown', () => { init(); ctx?.resume?.(); });
addEventListener('keydown', () => { init(); ctx?.resume?.(); });
// Opening the audio device takes the browser over a tenth of a second: do it while the world loads, so the first click
// or key only resumes it. (A context made before any click starts suspended and stays silent until then.)
(globalThis.requestIdleCallback || setTimeout)(() => init());
const now = () => ctx.currentTime;
// ---- recordings (tools/assets/sounds.mjs: assets/sounds/pack/<key>_<n>.mp3, index.json says how many of each)
const BANK = {}, LOOPS = {}, SND = new URL('../../assets/sounds/pack/', import.meta.url);
async function loadBank() {
  try {
    const index = await (await fetch(new URL('index.json', SND))).json();
    await Promise.all(Object.entries(index).map(async ([k, n]) => { BANK[k] = await Promise.all([...Array(n)].map(async (_, i) => ctx.decodeAudioData(await (await fetch(new URL(`${k}_${i}.mp3`, SND))).arrayBuffer()))); }));
    const loop = (k, name = k, rate = 1) => { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = BANK[k][0]; s.loop = true; s.playbackRate.value = rate; g.gain.value = 0; s.connect(g).connect(ambBus); s.start(0, Math.random() * s.buffer.duration); LOOPS[name] = g; };
    for (const k of ['loopBirds', 'loopRain', 'loopStorm']) if (BANK[k]) loop(k);
    // (the pack's crickets sing at 13-17 kHz, too high for many ears to hear at all, and thin on small speakers: played
    // slower they come down to where field crickets sing, 4-6 kHz, as two choruses at different pitches, each loop
    // three times as long, so it doesn't sound like a loop)
    if (BANK.loopCrickets) { loop('loopCrickets', 'loopCrickets', 0.32); loop('loopCrickets', 'crickets2', 0.47); }
  } catch { /* no pack: the synthesis plays */ }
}
// one of a sound's recordings, a little higher or lower each time; false if it has none
function sample(k, { vol = 0.5, pan = 0, wet = 0.05, rate = [0.94, 1.06], bus } = {}) {
  const list = BANK[k]; if (!list?.length) return false;
  const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = list[Math.floor(Math.random() * list.length)]; s.playbackRate.value = rnd(rate[0], rate[1]); g.gain.value = vol; p.pan.value = pan;
  s.connect(g).connect(p).connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verb); }
  s.start(); return true;
}
// one of a sound's recordings, as heard from far off: later (delay, seconds), through a low-pass (the air takes the
// highs out of a far sound) and slower or faster, from a point into it (from, seconds); false if it has none
function sampleFar(k, { vol = 0.5, pan = 0, wet = 0.3, rate = 1, delay = 0, lp = 20000, bus, from = 0 } = {}) {
  const list = BANK[k]; if (!list?.length) return false; const t = now() + delay;
  const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = list[Math.floor(Math.random() * list.length)]; s.playbackRate.value = rate;
  f.type = 'lowpass'; f.frequency.value = lp; f.Q.value = 0.5; g.gain.value = vol; p.pan.value = pan;
  s.connect(f).connect(g).connect(p).connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verb); }
  s.start(t, from); return true;
}
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

// the recordings for each ground the feet can be on (game.js: the boards of a building, water, paving or bare rock, the
// shore's sand, the forest's leaf litter; anything else is the meadows' grass and earth)
const STEPS = { wood: 'stepWood', water: 'stepWater', stone: 'stepRock', sand: 'stepSand', leaves: 'stepLeaves' }, LANDS = { wood: 'landWood', water: 'landWater', stone: 'landRock' };
const SFX = {
  step: (surface, k = 1) => {   // (k: how near the camera is, game.js: a close camera hears them at full, a far one at a quarter)
    if (sample(STEPS[surface] || (Math.random() < 0.6 ? 'stepGrass' : 'stepDirt'), { vol: 0.32 * k, wet: 0 })) return;
    if (surface === 'wood') { noise(0.1, { freq: 420, q: 3, vol: 0.13 * k }); tone(140, 0.08, { type: 'triangle', vol: 0.05 * k, wet: 0.2 }); }
    else if (surface === 'water') { noise(0.28, { type: 'lowpass', freq: 1200, vol: 0.14 * k, slide: -800 }); noise(0.12, { freq: 2500, q: 2, vol: 0.05 * k, delay: 0.05 }); }
    else if (surface === 'stone') noise(0.07, { freq: 1800, q: 1.5, vol: 0.09 * k });
    else { noise(0.12, { type: 'lowpass', freq: 380, vol: 0.12 * k, brown: true }); noise(0.16, { freq: 3200, q: 0.7, vol: 0.035 * k }); }   // a soft thud and the swish of grass
  },
  jump: () => noise(0.14, { freq: 500, vol: 0.06 }),
  land: (surface, k = 1) => { if (sample(LANDS[surface] || 'landGrass', { vol: 0.45 * k, wet: 0 })) return; noise(0.22, { type: 'lowpass', freq: 260, vol: 0.28 * k, brown: true }); noise(0.1, { freq: 2800, q: 0.8, vol: 0.05 * k }); },
  chop: () => { noise(0.09, { freq: 1500, q: 3, vol: 0.32, wet: 0.25 }); tone(170, 0.14, { type: 'triangle', vol: 0.22, slide: -60, wet: 0.3 }); noise(0.25, { type: 'lowpass', freq: 400, vol: 0.12, brown: true }); },
  creak: () => { tone(95, 1.6, { type: 'sawtooth', vol: 0.045, slide: -30, attack: 0.4, wet: 0.4 }); tone(140, 1.2, { type: 'sawtooth', vol: 0.025, slide: 40, attack: 0.3, delay: 0.5, wet: 0.4 }); },
  thud: () => { noise(0.9, { type: 'lowpass', freq: 200, vol: 0.7, slide: -120, brown: true, wet: 0.4 }); tone(48, 0.7, { vol: 0.4, slide: -18 }); for (let i = 0; i < 6; i++) noise(0.2, { freq: 2500 + Math.random() * 2000, q: 1, vol: 0.05, delay: 0.1 + Math.random() * 0.5 }); },
  mine: () => { if (sample('stoneHit', { vol: 0.5, wet: 0.2 })) return; tone(1800 + Math.random() * 400, 0.22, { type: 'triangle', vol: 0.12, slide: -400, wet: 0.35 }); noise(0.08, { freq: 2600, q: 2, vol: 0.2 }); noise(0.3, { type: 'lowpass', freq: 500, vol: 0.12, brown: true, delay: 0.03 }); },
  hit: () => { noise(0.14, { type: 'lowpass', freq: 650, vol: 0.38, brown: true, wet: 0.15 }); tone(110, 0.12, { type: 'square', vol: 0.05, slide: -40 }); noise(0.05, { freq: 2200, q: 1, vol: 0.08 }); },
  hurt: () => { noise(0.22, { freq: 480, q: 1.5, vol: 0.3 }); tone(210, 0.2, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  block: () => { tone(380, 0.18, { type: 'square', vol: 0.07, slide: -120, wet: 0.25 }); noise(0.12, { freq: 1100, q: 2, vol: 0.22 }); },
  parry: () => { tone(1250, 0.6, { type: 'triangle', vol: 0.14, slide: -300, wet: 0.5 }); tone(1870, 0.5, { type: 'sine', vol: 0.06, wet: 0.5 }); noise(0.12, { freq: 3200, q: 4, vol: 0.2 }); },
  pick: () => { noise(0.1, { freq: 1800, q: 0.8, vol: 0.06 }); tone(700, 0.08, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
  craft: () => { noise(0.08, { freq: 900, q: 2, vol: 0.2 }); noise(0.08, { freq: 1300, q: 2, vol: 0.17, delay: 0.13 }); tone(523, 0.3, { type: 'triangle', vol: 0.06, delay: 0.24, wet: 0.4 }); tone(784, 0.4, { type: 'triangle', vol: 0.05, delay: 0.32, wet: 0.4 }); },
  build: () => { noise(0.16, { type: 'lowpass', freq: 550, vol: 0.45, brown: true, wet: 0.25 }); noise(0.1, { freq: 900, q: 2, vol: 0.2, delay: 0.1 }); },
  break: () => { noise(0.6, { type: 'lowpass', freq: 800, vol: 0.45, slide: -600, wet: 0.3 }); for (let i = 0; i < 5; i++) noise(0.06, { freq: 1500, q: 3, vol: 0.15, delay: 0.05 + i * 0.07 }); },
  repair: () => { tone(500, 0.12, { type: 'triangle', vol: 0.08 }); tone(750, 0.18, { type: 'triangle', vol: 0.08, delay: 0.1, wet: 0.3 }); },
  door: () => { if (sample('door', { vol: 0.45, wet: 0.15 })) return; tone(150, 0.6, { type: 'sawtooth', vol: 0.035, slide: 90, attack: 0.12, wet: 0.3 }); noise(0.12, { type: 'lowpass', freq: 400, vol: 0.15, delay: 0.45, brown: true }); },
  chest: () => { if (sample('creak', { vol: 0.4, wet: 0.1 })) return; noise(0.22, { type: 'lowpass', freq: 500, vol: 0.25, brown: true }); tone(230, 0.35, { type: 'sawtooth', vol: 0.03, slide: 60, wet: 0.3 }); },
  draw: () => noise(0.25, { freq: 2400, q: 6, vol: 0.06, slide: 800 }),
  sheathe: () => noise(0.2, { freq: 2000, q: 6, vol: 0.05, slide: -900 }),
  bow: () => { tone(130, 0.3, { type: 'triangle', vol: 0.2, slide: -40, wet: 0.25 }); noise(0.14, { freq: 1600, q: 1, vol: 0.12 }); noise(0.4, { freq: 900, q: 0.5, vol: 0.05, slide: -500, delay: 0.05 }); },
  arrowHit: () => { noise(0.1, { type: 'lowpass', freq: 600, vol: 0.32, brown: true }); noise(0.05, { freq: 2000, q: 2, vol: 0.08 }); },
  arrowThud: () => { noise(0.08, { freq: 420, q: 2, vol: 0.16 }); tone(240, 0.12, { type: 'triangle', vol: 0.04, slide: 40 }); },
  alert: () => noise(0.2, { freq: 650, q: 2.5, vol: 0.09, slide: 350 }),
  douse: () => { noise(0.9, { freq: 3000, q: 0.6, vol: 0.18, slide: -2000, attack: 0.02 }); noise(0.5, { type: 'lowpass', freq: 400, vol: 0.12, brown: true }); },
  kill: () => tone(90, 0.5, { type: 'triangle', vol: 0.12, slide: -40, wet: 0.3 }),
  // the bosses: a ground-shaking slam, the Chimera's fire, a block of stone hurled through the air
  slam: () => { noise(0.7, { type: 'lowpass', freq: 220, vol: 0.6, brown: true, wet: 0.5 }); tone(55, 0.8, { type: 'sine', vol: 0.3, slide: -25, wet: 0.4 }); noise(0.15, { freq: 900, q: 1, vol: 0.18, delay: 0.02 }); },
  breath: () => { if (sample('fireBurst', { vol: 0.6, wet: 0.3, rate: [0.8, 0.9] })) return; noise(1.5, { type: 'lowpass', freq: 900, vol: 0.32, brown: true, attack: 0.15, wet: 0.4 }); noise(1.4, { freq: 1800, q: 0.7, vol: 0.12, attack: 0.2, slide: -600 }); },
  boulder: () => { noise(0.45, { freq: 500, q: 0.8, vol: 0.22, slide: 300, attack: 0.05 }); tone(80, 0.3, { type: 'triangle', vol: 0.1, slide: -30 }); },
  // thunder: a crack when it's close, then a long roll of rumbling bursts under the reverb
  thunder: (k = 1) => {
    const near = k > 0.9; if (near && sample('thunder', { vol: 0.7 * k, wet: 0.3, rate: [0.9, 1.05], bus: ambBus })) return;
    if (near) { noise(0.25, { freq: 2200, q: 0.5, vol: 0.35 * k, wet: 0.6 }); noise(0.5, { type: 'lowpass', freq: 1200, vol: 0.4 * k, wet: 0.6, delay: 0.05 }); }
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) noise(rnd(1.2, 2.6), { type: 'lowpass', freq: rnd(120, 260), vol: rnd(0.25, 0.5) * k * (1 - i / (n + 2)), slide: -80, attack: rnd(0.05, 0.3), delay: (near ? 0.2 : 0.6) + i * rnd(0.25, 0.55), brown: true, wet: 0.7, pan: rnd(-0.6, 0.6), bus: ambBus });
  },
  // thunder from the storm wall, heard from where it struck: it arrives at the speed of sound; the further off, the
  // quieter, the deeper (the air takes the highs out) and the longer it rolls (it comes from the whole length of the
  // bolt, kilometres of it); close by, a crack first
  stormThunder: ({ dist = 500, pan = 0, big = 1 } = {}) => {
    // (under a roof it comes muffled through the walls; the start is noted for the tests: THUNDER)
    const delay = dist / 343, k = big / (1 + dist / 380) * (1 - shut * 0.4), lp = (180 + 4200 * Math.exp(-dist / 450)) * (1 - shut * 0.7), o = { pan: pan * 0.8, bus: ambBus };
    THUNDER.at = now() + delay; THUNDER.n++; THUNDER.k = k;
    // (the recording's crack comes 1.4 s in, after rain: it starts from just before it, so it lands when the delay says)
    if (dist < 450) { if (!sampleFar('thunder', { ...o, vol: 0.9 * k, wet: 0.35, rate: rnd(0.92, 1.05), delay, lp: Math.max(lp, 2500), from: 1.36 })) { noise(0.25, { ...o, freq: 2200, q: 0.5, vol: 0.4 * k, wet: 0.6, delay }); noise(0.6, { ...o, type: 'lowpass', freq: 1400, vol: 0.45 * k, wet: 0.6, delay: delay + 0.04 }); } }
    else { const rate = rnd(0.62, 0.8); sampleFar('thunder', { ...o, vol: Math.min(0.8, 1.1 * k), wet: 0.6, rate, delay: delay + 0.1, lp, from: 1.36 }); }
    const n = 4 + Math.floor(Math.random() * 4) + Math.floor(Math.min(4, dist / 400)), spread = 0.3 + Math.min(1.1, dist / 1400);
    for (let i = 0; i < n; i++) noise(rnd(1.4, 3.2) * (1 + spread * 0.5), { ...o, type: 'lowpass', freq: rnd(70, 110) + lp * 0.05, vol: rnd(0.35, 0.6) * k * (1 - i / (n + 3)), slide: -30, attack: rnd(0.1, 0.5), delay: delay + 0.15 + i * rnd(0.3, 0.6) * spread * 1.6, brown: true, wet: 0.75, pan: pan * 0.6 + rnd(-0.3, 0.3) });
  },
  roar: () => { sample('growl', { vol: 0.7, wet: 0.4, rate: [0.7, 0.8] });   // (the growl over the synthesised rumble, which gives it its size)
    tone(66, 1.5, { type: 'sawtooth', vol: 0.2, slide: -24, attack: 0.15, wet: 0.5 }); tone(99, 1.3, { type: 'square', vol: 0.06, slide: -38, attack: 0.15, wet: 0.5 }); noise(1.4, { type: 'lowpass', freq: 420, vol: 0.32, attack: 0.15, slide: -220, brown: true, wet: 0.5 }); },
  summon: () => { tone(55, 3.2, { type: 'sawtooth', vol: 0.12, slide: 30, attack: 1, wet: 0.6 }); SFX.thunder(1.2); },
  reveal: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, { vol: 0.1, delay: i * 0.14, pan: -0.3 + i * 0.2 })),
  owl: () => { tone(400, 0.4, { vol: 0.11, slide: -30, attack: 0.06, wet: 0.5 }); tone(380, 0.7, { vol: 0.11, slide: -50, attack: 0.06, delay: 0.5, wet: 0.5 }); },
};
export function sound(name, ...a) { if (!ctx) return; try { SFX[name]?.(...a); } catch { /* audio is optional */ } }

// ---- the world's ambience, called every frame with what's around the player
// { wind 0..1, rain 0..1, night 0..1, dusk 0..1, fire 0..1, inside 0/1, roof 0/1, forest 0..1 (trees round you), deep 0..1
//   (trees just where you stand), marsh 0..1, sea 0..1 }
let gust = 0, gustTo = 0.3, gustT = 0, birdT = 2, crickT = 1, owlT = 20, foxT = 60, frogT = 3, dropT = 0, musicT = 25, droneOn = false, drone = null;
const MODE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0];   // D Dorian over two octaves
// how near the storm wall you are (0..1, stormwall.js): its roar and the gale blowing into it
let stormK = 0, shut = 0;
export function stormAmbience(k) { stormK = k; }
// when the last thunder was set to start, on the audio clock (the tests weigh it against the flash), and the clock itself
export const THUNDER = { at: 0, n: 0, k: 0, now: () => (ctx ? ctx.currentTime : 0), ctx: () => ctx, out: () => out };
export function updateAmbience(dt, w = {}) {
  if (!ctx) return; const t = now(), A = amb, sh = (node, v, tc = 0.6) => node.g.gain.setTargetAtTime(v, t, tc);
  const sk = stormK * stormK, wind = Math.max(w.wind ?? 0.3, sk);
  const { rain = 0, night = 0, dusk = 0, fire = 0, inside = 0, roof = 0, forest = 0, deep = 0, marsh = 0, sea = 0 } = w, open = 1 - inside * 0.7;
  shut = Math.max(inside, roof * 0.6);
  // wind: a slow random walk of gusts
  gustT -= dt; if (gustT <= 0) { gustT = rnd(2, 7); gustTo = Math.min(1, Math.max(0, wind + rnd(-0.25, 0.4))); }
  gust += (gustTo - gust) * Math.min(1, dt * 0.6);
  sh(A.windLow, (0.05 + gust * 0.22) * open); A.windLow.f[0].frequency.setTargetAtTime(220 + gust * 420, t, 1);
  sh(A.windHigh, gust * gust * 0.08 * open); A.windHigh.f[0].frequency.setTargetAtTime(600 + gust * 900, t, 1);
  sh(A.whistle, Math.max(0, gust - 0.65) * 0.05 * open); A.whistle.f[0].frequency.setTargetAtTime(1200 + gust * 900 + Math.sin(t * 0.7) * 150, t, 0.5);
  // the wind in the leaves, wherever trees stand round you, by day and by night: a soft bed that swells with the gusts
  const sway = 0.7 + 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1);
  sh(A.leaves, forest * (0.035 + gust * 0.09) * sway * open, 1.2); sh(A.leavesLo, forest * (0.05 + gust * 0.1) * sway * open, 1.2);
  A.leavesLo.f[0].frequency.setTargetAtTime(900 + gust * 500, t, 1.5);
  // rain: hiss, body and droplets outside; drumming and a muffled hush under a roof
  const rec = !!LOOPS.loopRain, L = (k, v) => LOOPS[k]?.gain.setTargetAtTime(v, t, 0.8);   // (recorded rain, birds and crickets when there are some)
  L('loopRain', rain * 0.45 * (1 - inside * 0.8) * (roof ? 0.6 : 1)); L('loopStorm', Math.max(rain - 0.6, sk * 0.7) * 1.2 * (1 - inside * 0.7));
  sh(A.roar, (stormK * 0.12 + sk * 0.3) * (1 - inside * 0.5), 1.5); A.roar.f[0].frequency.setTargetAtTime(90 + gust * 60, t, 1);
  sh(A.rainHiss, rain * 0.2 * (1 - inside * 0.8) * (roof ? 0.6 : 1) * (rec ? 0.3 : 1)); sh(A.rainBody, rain * rain * 0.3 * (1 - inside * 0.6));
  sh(A.roof, roof ? rain * 0.22 : 0, 0.4);
  dropT -= dt; if (rain > 0.15 && dropT <= 0) { dropT = rnd(0.01, 0.06) / rain;
    if (roof) noise(rnd(0.03, 0.07), { type: 'lowpass', freq: rnd(900, 1600), vol: rnd(0.03, 0.09) * rain, pan: rnd(-0.8, 0.8), bus: ambBus, wet: 0.05 });
    else noise(rnd(0.015, 0.04), { freq: rnd(2200, 6000), q: rnd(1, 4), vol: rnd(0.015, 0.05) * rain * open, pan: rnd(-0.9, 0.9), bus: ambBus, wet: 0 }); }
  // the sea, breathing in long swells near the shore
  sh(A.sea, sea * (0.1 + 0.08 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 0.31)) * open, 0.8); A.sea.f[0].frequency.setTargetAtTime(380 + 160 * Math.sin(t * 0.7), t, 0.8);
  // fire: a low roar and crackles
  sh(A.fire, fire * 0.16, 0.2);
  if (fire > 0.1 && Math.random() < dt * 9 * fire) noise(rnd(0.01, 0.04), { freq: rnd(1800, 5000), q: 3, vol: rnd(0.04, 0.12) * fire, pan: rnd(-0.3, 0.3), bus: ambBus, wet: 0.05 });
  // creatures: birds by day; crickets from dusk on, owls, a fox far off and frogs by night; the forest and the marsh have
  // their own. The crickets sing most in the open and at the woods' edges (deep: how wooded it is just where you stand),
  // swelling as the light goes and dying away at first light.
  const calm = (1 - rain * 0.85) * open, crick = Math.min(1, night * 1.2 + dusk * 0.6) * Math.max(0, 1 - rain / 0.3) * (1 - deep * 0.55);
  L('loopBirds', night < 0.3 ? calm * (1 - night) * 0.42 : 0);
  L('loopCrickets', calm * crick * 0.24); L('crickets2', calm * crick * 0.08);
  birdT -= dt; if (birdT <= 0) { birdT = rnd(1.5, 6) / (1 + forest * 0.6) * (LOOPS.loopBirds ? 2.5 : 1); if (night < 0.3 && calm > 0.2) bird(calm * (1 - night)); }   // (calls of their own over the recorded chorus too, now and then)
  // a cricket singing near you: a few chirps from one side, then quiet (bouts of them over the chorus, or on their own)
  crickT -= dt; if (crickT <= 0) { crickT = LOOPS.loopCrickets ? rnd(0.8, 3) : rnd(0.25, 0.7);
    if (crick > 0.2 && calm > 0.2) { const f = rnd(4200, 4900), p = rnd(-0.8, 0.8), n = 2 + Math.floor(Math.random() * 4), v = 0.016 * calm * crick;
      for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) tone(f, 0.022, { vol: v, attack: 0.004, delay: k * 0.33 + i * 0.045, pan: p, wet: 0.15, bus: ambBus }); } }
  // an owl now and then: a long hoot, a pause, then a soft wavering one (the tawny owl's call), off in the trees
  owlT -= dt; if (owlT <= 0) { owlT = rnd(25, 60); if (night > 0.5 && rain < 0.4) { const p = rnd(-0.7, 0.7), f = rnd(360, 400), v = 0.07 * calm, o = { type: 'sine', pan: p, wet: 0.75, bus: ambBus };
    tone(f, 0.6, { ...o, vol: v, slide: -18, attack: 0.07 }); tone(f * 0.94, 0.25, { ...o, vol: v * 0.6, attack: 0.05, delay: 1.5 });
    for (let i = 0; i < 4; i++) tone(f * (0.96 - i * 0.004), 0.16, { ...o, vol: v * 0.8, attack: 0.03, delay: 1.9 + i * 0.17 }); } }
  // a fox crying far off, rarely
  foxT -= dt; if (foxT <= 0) { foxT = rnd(70, 160); if (night > 0.6 && rain < 0.3) sample('foxCry', { vol: 0.16 * calm, pan: rnd(-0.8, 0.8), wet: 0.6, rate: [0.9, 1.05], bus: ambBus }); }
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
