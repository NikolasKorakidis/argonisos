// Sound: the team's recordings where there are some (tools/assets/sounds.mjs: footsteps on each ground, every blow, cut
// and knock of the fighting, gathering and building, the fire, the bosses, thunder, and the world's beds of rain, wind,
// leaves, birds, crickets, frogs and waves), and WebAudio synthesis for the rest (and for everything, if the pack isn't
// there). A sound with recordings plays one of them at random, never the same one twice running, a little higher or
// lower and louder or softer each time.
//   Where things are: a sound from a place in the world (at) comes from its side and falls away with distance, the air
//   taking its highs first (the listener is the camera: listen()); muffled when you're indoors.
//   Mix: effects, ambience and music each on a bus of their own (the settings' sliders), through a gentle compressor; a
//   generated reverb gives space to thunder, birds and the echo of strikes. The music (music.js) dips under loud thunder.
//   Ambience follows the world (updateAmbience): rain in layers (droplets in a light rain, a downpour in a heavy one, the
//   drumming on a roof over you and the hush through the walls indoors), the wind by its strength with gusts on the wind's
//   own gusts, the wind in the meadow's grass and in the woods' leaves, waves near the shore, birdsong by day, each land's
//   crickets by night, frogs by the marsh, an owl now and then and a fox far off; each lit fire near you crackles where it
//   burns (fires()). The beds load when first wanted and are let go of once they've long been silent.
//   Music: the team's tracks (music.js); a sparse lyre in an old Greek mode stands in for them without the pack.
//   A boss fight (setFight, from music.js while a boss's track plays): its music comes up nearly 6 dB and dips less under
//   thunder, the world's ambience goes down a little under it, and the giants' roars, steps, slams and fire are layered
//   with a deep synthesised boom (sub) you feel more than hear; a limiter after the compressor keeps the loudest of it
//   from clipping.
let ctx = null, out = null, comp = null, lim = null, stunF = null, sfxBus = null, ambBus = null, musicBus = null, recBus = null, duckG = null, fightG = null, verb = null, noiseBuf = null, brownBuf = null;
let volume = 0.8, musicVol = 0.5, sfxVol = 1, ambVol = 1, fightK = 0;
// (in a boss fight: the music's gain, the ambience's, and how much of its usual dip under thunder the music keeps.
// Patch 22: the boss's heavy track loud and clear over its storm, about as loud as the blows, the storm's rain and wind a
// bed under it, the music hardly dipping under the bolts falling all round)
const FIGHT = { music: 3.6, amb: 0.5, duck: 0.15 };
const REC_MUSIC = 0.9;   // (the recorded music's level under the slider: music.js tracks are mastered louder than the beds)
export function setVolume(v) { volume = v; if (out) out.gain.value = v; }
export function setMusicVolume(v) { musicVol = v; if (musicBus) { musicBus.gain.value = 0.55 * v; recBus.gain.value = REC_MUSIC * v; } }
export function setSfxVolume(v) { sfxVol = v; if (sfxBus) sfxBus.gain.value = 0.9 * v; }
export function setAmbienceVolume(v) { ambVol = v; if (ambBus) ambBus.gain.value = v * (1 - (1 - FIGHT.amb) * fightK); }
// a boss fight on (1) or off (0): eased over a second or two
export function setFight(k) {
  if (k === fightK || !ctx) { fightK = k; return; } fightK = k; const t = now();
  fightG.gain.setTargetAtTime(1 + (FIGHT.music - 1) * k, t, k ? 0.6 : 1.5); ambBus.gain.setTargetAtTime(ambVol * (1 - (1 - FIGHT.amb) * k), t, 0.8);
}
const amb = {};
const rnd = (a, b) => a + Math.random() * (b - a), sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

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
    comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    // (and a limiter after it: nothing it lets through reaches 0 dBFS, however many booms land at once)
    lim = ctx.createDynamicsCompressor(); lim.threshold.value = -5; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.002; lim.release.value = 0.15;
    // (and between them the stun's muffle: open until a roar stuns you, daze())
    stunF = ctx.createBiquadFilter(); stunF.type = 'lowpass'; stunF.frequency.value = 22000; stunF.Q.value = 0.5;
    out = ctx.createGain(); out.gain.value = volume; comp.connect(stunF).connect(lim).connect(out).connect(ctx.destination);
    verb = makeVerb(); const verbOut = ctx.createGain(); verbOut.gain.value = 0.5; verb.connect(verbOut).connect(comp);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9 * sfxVol; sfxBus.connect(comp);
    ambBus = ctx.createGain(); ambBus.gain.value = ambVol; ambBus.connect(comp);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55 * musicVol; musicBus.connect(comp); const mv = ctx.createGain(); mv.gain.value = 0.7; musicBus.connect(mv).connect(verb);
    // (the recorded music, dry, under the slider and the duck that lowers it under loud thunder)
    recBus = ctx.createGain(); recBus.gain.value = REC_MUSIC * musicVol; duckG = ctx.createGain(); fightG = ctx.createGain(); fightG.gain.value = 1 + (FIGHT.music - 1) * fightK; recBus.connect(duckG).connect(fightG).connect(comp);
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

// ---- recordings (tools/assets/sounds.mjs: assets/sounds/pack/<key>_<n>.mp3; sounds.json says how many of each, which
// are beds, where each one-shot's sound starts in earnest, and what music there is)
const META = {}, BUF = {}, LOADING = {}, LAST = {}, STARTED = {}, SND = new URL('../../assets/sounds/pack/', import.meta.url);
// For the tests and the mix: log (an array, when set) gets every recording started ({ k, i, t, vol, bus }, beds and fires
// too); meters() hangs analysers on the buses and the output and returns how loud each is now (dBFS, RMS)
export const AUDIO = { log: null, ready: false, music: {}, META, has: (k) => !!BUF[k]?.some(Boolean), ctx: () => ctx, musicOut: () => (ctx ? { ctx, bus: recBus } : null), meters: null };
async function loadBank() {
  let meta;
  try { meta = await (await fetch(new URL('sounds.json', SND))).json(); }
  catch { try { const idx = await (await fetch(new URL('index.json', SND))).json(); meta = { sfx: Object.fromEntries(Object.entries(idx).map(([k, n]) => [k, { n, loop: k.startsWith('loop') }])), music: {} }; } catch { return; } }   // (an older pack: index.json only)
  Object.assign(META, meta.sfx); Object.assign(AUDIO.music, meta.music || {});
  // the one-shots now (they're short, and a blow mustn't wait for its sound); the beds when first wanted (bed())
  await Promise.all(Object.entries(META).filter(([, m]) => !m.loop).map(([k, m]) => Promise.all([...Array(m.n)].map((_, i) => fetchOne(k, i)))));
  AUDIO.ready = true;
}
const fetchOne = (k, i) => (LOADING[k + '_' + i] ||= fetch(new URL(`${k}_${i}.mp3`, SND)).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((d) => { (BUF[k] ||= [])[i] = d; return d; }).catch(() => null));
const unload = (k, i) => { if (BUF[k]) BUF[k][i] = null; delete LOADING[k + '_' + i]; };
// which recording of a sound to play: any but the last one played
function variant(k) {
  const list = BUF[k]; if (!list) return -1; const ok = []; for (let i = 0; i < list.length; i++) if (list[i]) ok.push(i);
  if (!ok.length) return -1; let i = ok[Math.floor(Math.random() * ok.length)]; if (ok.length > 1) while (i === LAST[k]) i = ok[Math.floor(Math.random() * ok.length)];
  LAST[k] = i; return i;
}
// ---- the listener (the camera) and where a sound comes from: its share of loudness (k: full within near, falling to
// none by far), its side (pan) and how much of its highs the air has taken (lp); indoors (shut) what's outside is muffled
const L = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
export function listen(p, f) { L.x = p.x; L.y = p.y; L.z = p.z; const n = Math.hypot(f.x, f.z) || 1; L.fx = f.x / n; L.fz = f.z / n; }
function spatial(at, near = 3, far = 50) {
  const dx = at.x - L.x, dy = (at.y ?? L.y) - L.y, dz = at.z - L.z, d = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dz) || 1, k = Math.max(0, 1 - Math.max(0, d - near) / (far - near));
  return { d, k: k * k, pan: Math.max(-0.85, Math.min(0.85, (dx * -L.fz + dz * L.fx) / h * Math.min(1, d / 2))), lp: Math.max(900, 20000 * Math.exp(-d / 70)) * (d > 5 ? 1 - shut * 0.6 : 1) };
}
// One of a sound's recordings (false if it has none, so the synthesis plays instead). vol: its loudness, a tenth more
// or less each time; rate: [low, high] (or one rate); at: where in the world it comes from (near, far: how it falls
// away); from: a point into it (seconds, or 'onset': just before its sound starts in earnest, so a far one lands when
// its delay says); gap: the same sound started again within this many seconds is let be (one blow, one sound).
function play(k, { vol = 0.5, rate = [0.95, 1.05], at, near, far, wet = 0.05, bus, delay = 0, from = 0, lp = 0, pan = 0, gap = 0.05, out } = {}) {
  if (!ctx) return false; const i = variant(k); if (i < 0) return false;
  const t = now() + delay; if (Math.abs(t - (STARTED[k] ?? -9)) < gap) return true; STARTED[k] = t;
  let v = vol * rnd(0.9, 1.1), cut = lp || 22000;
  if (at) { const s = spatial(at, near, far); if (s.k < 0.002) return true; v *= s.k; pan = s.pan; cut = Math.min(cut, s.lp); }
  const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(); s.buffer = BUF[k][i]; s.playbackRate.value = Array.isArray(rate) ? rnd(rate[0], rate[1]) : rate;
  g.gain.value = v; p.pan.value = pan; let n = s;
  if (cut < 20000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = 0.5; n = n.connect(f); }
  n.connect(g).connect(p).connect(bus || sfxBus); if (wet) { const w = ctx.createGain(); w.gain.value = wet; p.connect(w).connect(verb); }
  const off = from === 'onset' ? Math.max(0, (META[k]?.onset?.[i] ?? 0.05) - 0.05) : from;
  s.start(t, Math.min(off, Math.max(0, s.buffer.duration - 0.05))); if (out) out.s = s;
  AUDIO.log?.push({ k, i, t, vol: +v.toFixed(3), bus: bus === ambBus ? 'amb' : 'sfx' });
  return true;
}
// the old helpers (the first packs' sounds), now through play()
const sample = (k, { vol = 0.5, pan = 0, wet = 0.05, rate = [0.94, 1.06], bus, at } = {}) => play(k, { vol, pan, wet, rate, bus, at });
const sampleFar = (k, { vol = 0.5, pan = 0, wet = 0.3, rate = 1, delay = 0, lp = 20000, bus, from = 0 } = {}) => play(k, { vol, pan, wet, rate, delay, lp, bus, from, gap: 0 });
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
// how loud and to which side a synthesised sound from at is (all of it, ahead, without at)
const place = (at, near, far) => (at ? spatial(at, near, far) : { k: 1, pan: 0 });
// A deep boom under a giant's sounds, more felt than heard: a sine falling from f0 to f1 over dur with a soft or a hard
// attack, and a low rumble of brown noise with it (k: how loud; at, near, far: where, and how it falls away)
function sub(dur, { f0 = 58, f1 = 26, k = 1, at, near = 15, far = 160, delay = 0, attack = 0.012, rumble = 0.6 } = {}) {
  if (!init()) return; const s = place(at, near, far), v = k * s.k; if (v < 0.01) return;
  tone(f0, dur, { type: 'sine', vol: 0.5 * v, slide: f1 - f0, attack, delay, wet: 0.12, pan: s.pan * 0.5 });
  if (rumble) noise(dur * 1.15, { type: 'lowpass', freq: 150, q: 0.7, vol: 0.42 * v * rumble, attack: attack + 0.03, slide: -90, delay, brown: true, wet: 0.3, pan: s.pan * 0.5 });
}
// a giant's debris: stones and grit pattering down a while after a crash (n of them over dur)
function rattle(n, dur, { k = 1, at, near = 12, far = 120, delay = 0.15 } = {}) {
  const s = place(at, near, far); if (s.k * k < 0.02) return;
  for (let i = 0; i < n; i++) noise(rnd(0.05, 0.18), { freq: rnd(1400, 3600), q: rnd(0.8, 2), vol: rnd(0.05, 0.13) * k * s.k, delay: delay + Math.random() * dur, pan: s.pan * 0.6 + rnd(-0.3, 0.3), wet: 0.25 });
}
// a plucked string: a bright attack that darkens as it rings (the lyre)
function pluck(freq, { vol = 0.12, delay = 0, dur = 2.6, pan = 0 } = {}) {
  if (!init()) return; const t = now() + delay;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = freq; o2.frequency.value = freq * 1.002;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(freq * 9, t); f.frequency.exponentialRampToValueAtTime(freq * 1.3, t + dur * 0.6);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan; o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(p).connect(musicBus); o1.start(t); o2.start(t); o1.stop(t + dur + 0.1); o2.stop(t + dur + 0.1);
}
// The music dips under loud thunder (k: how loud, 0..1) and comes back over a few seconds (in a boss fight it hardly dips)
// Stunned (a boss's roar): for secs everything comes muffled, as through stopped ears, with a thin ringing over it,
// opening out again over the last of it
export function daze(secs = 2) {
  if (!stunF) return; const t = now(); stunF.frequency.cancelScheduledValues(t); stunF.frequency.setValueAtTime(stunF.frequency.value, t); stunF.frequency.exponentialRampToValueAtTime(420, t + 0.12);
  stunF.frequency.setValueAtTime(420, t + secs * 0.6); stunF.frequency.exponentialRampToValueAtTime(22000, t + secs + 0.4);
  tone(3150, secs + 0.6, { type: 'sine', vol: 0.022, attack: 0.15, wet: 0.2, release: secs + 0.6 }); tone(3190, secs * 0.8, { type: 'sine', vol: 0.012, attack: 0.3, wet: 0.2 });
}
export function duck(k, at = 0) { if (!duckG || k < 0.05) return; const t = now() + at, d = 1 - Math.min(0.55, k * 0.6) * (1 - (1 - FIGHT.duck) * fightK); duckG.gain.cancelScheduledValues(t); duckG.gain.setTargetAtTime(d, t, 0.08); duckG.gain.setTargetAtTime(1, t + 1.2, 1.4); }

// the recordings for each ground the feet can be on (game.js: the boards of a building, water, paving or bare rock, the
// shore's sand, the forest's leaf litter; anything else is the meadows' grass and earth)
const STEPS = { wood: 'stepWood', water: 'stepWater', stone: 'stepRock', sand: 'stepSand', leaves: 'stepLeaves' }, LANDS = { wood: 'landWood', water: 'landWater', stone: 'landRock' };
let alertAt = -99;
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
  // an axe in wood (p: pitch, about 1; a thin trunk or a stump rings higher, a great trunk lower; every blow a little different)
  chop: (p = 1) => { if (play('hitTree', { vol: 0.6, wet: 0.2, rate: [0.93 * p, 1.05 * p] })) return;
    p *= 0.93 + Math.random() * 0.14; noise(0.09, { freq: 1500 * p, q: 3, vol: 0.32, wet: 0.25 }); tone(170 * p, 0.14, { type: 'triangle', vol: 0.22, slide: -60 * p, wet: 0.3 }); noise(0.25, { type: 'lowpass', freq: 400 * p, vol: 0.12, brown: true }); },
  creak: () => { tone(95, 1.6, { type: 'sawtooth', vol: 0.045, slide: -30, attack: 0.4, wet: 0.4 }); tone(140, 1.2, { type: 'sawtooth', vol: 0.025, slide: 40, attack: 0.3, delay: 0.5, wet: 0.4 }); },
  thud: () => { noise(0.9, { type: 'lowpass', freq: 200, vol: 0.7, slide: -120, brown: true, wet: 0.4 }); tone(48, 0.7, { vol: 0.4, slide: -18 }); for (let i = 0; i < 6; i++) noise(0.2, { freq: 2500 + Math.random() * 2000, q: 1, vol: 0.05, delay: 0.1 + Math.random() * 0.5 }); },
  // a felled tree hitting the ground (at: where its crown lands; big: how big a tree), from just before the crash
  treeFall: ({ at, big = 1 } = {}) => { if (play('fallingTree', { vol: 0.75 * Math.min(1.2, big), at, near: 8, far: 90, wet: 0.3, rate: [0.9 / Math.sqrt(big), 1 / Math.sqrt(big)], from: 'onset' })) return; SFX.thud(); },
  mine: (p = 1) => { if (play('mineHit', { vol: 0.62, wet: 0.2, rate: [0.9 * p, 1.08 * p] })) return; if (sample('stoneHit', { vol: 0.5, wet: 0.2, rate: [0.88 * p, 1.1 * p] })) return;
    tone((1800 + Math.random() * 400) * p, 0.22, { type: 'triangle', vol: 0.12, slide: -400, wet: 0.35 }); noise(0.08, { freq: 2600, q: 2, vol: 0.2 }); noise(0.3, { type: 'lowpass', freq: 500, vol: 0.12, brown: true, delay: 0.03 }); },
  // the wrong tool: a dull clink off rock (or a dead knock off wood) that does nothing
  clink: (wood) => { if (wood) { noise(0.07, { type: 'lowpass', freq: 520, vol: 0.22, brown: true }); tone(120, 0.08, { type: 'triangle', vol: 0.08, slide: -30 }); return; }
    tone(900 + Math.random() * 200, 0.09, { type: 'triangle', vol: 0.07, slide: -250, wet: 0.15 }); noise(0.05, { freq: 1400, q: 2, vol: 0.12 }); noise(0.1, { type: 'lowpass', freq: 380, vol: 0.1, brown: true }); },
  // a bush struck: its leaves thrash (k: how hard; the team's recording, the first pack's foliage, or a burst of shaped noise)
  rustle: (k = 1) => { if (play('hitPlant', { vol: 0.55 * k, wet: 0.1, rate: [0.92, 1.1] })) return; if (sample('foliage', { vol: 0.42 * k, wet: 0.1, rate: [0.9, 1.15] })) return; noise(0.35, { freq: 3400, q: 0.6, vol: 0.14 * k, attack: 0.02, slide: -1200 }); noise(0.25, { freq: 1200, q: 0.8, vol: 0.07 * k, delay: 0.04 }); },
  // a blow landing on a creature (at: where; kind: 'axe', 'blade', or a blunt one: a club, a fist, a kick, for which there's
  // no recording yet)
  hit: ({ at, kind } = {}) => { const k = kind === 'axe' ? 'axeHit' : kind === 'blade' ? 'swordHit' : null; if (k && play(k, { vol: 0.6, at, near: 6, far: 40, wet: 0.12 })) return;
    noise(0.14, { type: 'lowpass', freq: 650, vol: 0.38, brown: true, wet: 0.15 }); tone(110, 0.12, { type: 'square', vol: 0.05, slide: -40 }); noise(0.05, { freq: 2200, q: 1, vol: 0.08 }); },
  // the hero hurt (voice: false for a woman: the team's cries are a man's, so she takes the blow without one)
  hurt: ({ voice = true } = {}) => { if (voice && play('hurtMale', { vol: 0.5, wet: 0.08, rate: [0.96, 1.04], gap: 0.4 })) return;
    if (!voice && AUDIO.has('hurtMale')) { noise(0.16, { type: 'lowpass', freq: 520, vol: 0.3, brown: true, wet: 0.1 }); return; }
    noise(0.22, { freq: 480, q: 1.5, vol: 0.3 }); tone(210, 0.2, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  death: ({ voice = true } = {}) => { if (voice && play('deathMale', { vol: 0.6, wet: 0.2, rate: [0.97, 1.02] })) return; tone(90, 0.8, { type: 'triangle', vol: 0.1, slide: -40, wet: 0.4 }); },
  block: () => { if (play('blockHit', { vol: 0.6, wet: 0.15 })) return; tone(380, 0.18, { type: 'square', vol: 0.07, slide: -120, wet: 0.25 }); noise(0.12, { freq: 1100, q: 2, vol: 0.22 }); },
  parry: () => { if (play('parryHit', { vol: 0.62, wet: 0.35 })) return; tone(1250, 0.6, { type: 'triangle', vol: 0.14, slide: -300, wet: 0.5 }); tone(1870, 0.5, { type: 'sine', vol: 0.06, wet: 0.5 }); noise(0.12, { freq: 3200, q: 4, vol: 0.2 }); },
  pick: () => { if (play('pickupItem', { vol: 0.42, wet: 0.03, rate: [0.97, 1.05], gap: 0.12 })) return; SFX.ui(); },
  ui: () => { noise(0.1, { freq: 1800, q: 0.8, vol: 0.06 }); tone(700, 0.08, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
  craft: () => { if (play('craftItem', { vol: 0.5, wet: 0.1 })) return; noise(0.08, { freq: 900, q: 2, vol: 0.2 }); noise(0.08, { freq: 1300, q: 2, vol: 0.17, delay: 0.13 }); tone(523, 0.3, { type: 'triangle', vol: 0.06, delay: 0.24, wet: 0.4 }); tone(784, 0.4, { type: 'triangle', vol: 0.05, delay: 0.32, wet: 0.4 }); },
  build: ({ at } = {}) => { if (play('buildPiece', { vol: 0.6, at, near: 6, wet: 0.15 })) return; noise(0.16, { type: 'lowpass', freq: 550, vol: 0.45, brown: true, wet: 0.25 }); noise(0.1, { freq: 900, q: 2, vol: 0.2, delay: 0.1 }); },
  break: ({ at } = {}) => { if (play('breakPiece', { vol: 0.62, at, near: 6, far: 60, wet: 0.2 })) return; noise(0.6, { type: 'lowpass', freq: 800, vol: 0.45, slide: -600, wet: 0.3 }); for (let i = 0; i < 5; i++) noise(0.06, { freq: 1500, q: 3, vol: 0.15, delay: 0.05 + i * 0.07 }); },
  repair: () => { if (play('repairPiece', { vol: 0.45, wet: 0.1 })) return; tone(500, 0.12, { type: 'triangle', vol: 0.08 }); tone(750, 0.18, { type: 'triangle', vol: 0.08, delay: 0.1, wet: 0.3 }); },
  door: ({ open = true, at } = {}) => { if (play(open ? 'doorOpen' : 'doorClose', { vol: 0.5, at, near: 4, wet: 0.15 })) return; if (sample('door', { vol: 0.45, wet: 0.15, at })) return; tone(150, 0.6, { type: 'sawtooth', vol: 0.035, slide: 90, attack: 0.12, wet: 0.3 }); noise(0.12, { type: 'lowpass', freq: 400, vol: 0.15, delay: 0.45, brown: true }); },
  chest: (open = true) => { if (play(open ? 'chestOpen' : 'chestClose', { vol: 0.5, wet: 0.1 })) return; if (!open) return; if (sample('creak', { vol: 0.4, wet: 0.1 })) return; noise(0.22, { type: 'lowpass', freq: 500, vol: 0.25, brown: true }); tone(230, 0.35, { type: 'sawtooth', vol: 0.03, slide: 60, wet: 0.3 }); },
  // drawing a weapon or tool, and putting it away (the draw, lower and softer, for want of a sheathing)
  draw: () => { if (play('drawWeapon', { vol: 0.4, wet: 0.05 })) return; noise(0.25, { freq: 2400, q: 6, vol: 0.06, slide: 800 }); },
  sheathe: () => { if (play('drawWeapon', { vol: 0.26, wet: 0.05, rate: [0.78, 0.84] })) return; noise(0.2, { freq: 2000, q: 6, vol: 0.05, slide: -900 }); },
  // the bow: the string drawn, then the arrow loosed and away
  bowDraw: () => play('bowStretch', { vol: 0.42, wet: 0.03, rate: [0.95, 1.03], gap: 0.3 }),
  bow: () => { if (play('arrowRelease', { vol: 0.55, wet: 0.1 })) { play('arrowFly', { vol: 0.28, delay: 0.06, wet: 0.15, rate: [1, 1.15] }); return; }
    tone(130, 0.3, { type: 'triangle', vol: 0.2, slide: -40, wet: 0.25 }); noise(0.14, { freq: 1600, q: 1, vol: 0.12 }); noise(0.4, { freq: 900, q: 0.5, vol: 0.05, slide: -500, delay: 0.05 }); },
  arrowHit: ({ at } = {}) => { if (play('arrowFlesh', { vol: 0.6, at, near: 5, far: 70, wet: 0.1 })) return; noise(0.1, { type: 'lowpass', freq: 600, vol: 0.32, brown: true }); noise(0.05, { freq: 2000, q: 2, vol: 0.08 }); },
  arrowWood: ({ at } = {}) => { if (play('arrowWood', { vol: 0.55, at, near: 5, far: 70, wet: 0.15 })) return; SFX.arrowThud(); },
  arrowThud: () => { noise(0.08, { freq: 420, q: 2, vol: 0.16 }); tone(240, 0.12, { type: 'triangle', vol: 0.04, slide: 40 }); },
  // a creature noticing you (at: where it stands; hostile: one that will come for you, which gives its cry, at most one
  // every few seconds; an animal only starts)
  alert: ({ at, hostile } = {}) => { if (hostile && now() - alertAt > 4 && play('enemyAlert', { vol: 0.55, at, near: 8, far: 60, wet: 0.25 })) { alertAt = now(); return; } if (!hostile) noise(0.2, { freq: 650, q: 2.5, vol: 0.09, slide: 350 }); },
  fireStart: ({ at } = {}) => play('fireStart', { vol: 0.5, at, near: 4, wet: 0.1 }),
  douse: ({ at } = {}) => { if (play('fireDouse', { vol: 0.5, at, near: 4, far: 40, wet: 0.1 })) return; noise(0.9, { freq: 3000, q: 0.6, vol: 0.18, slide: -2000, attack: 0.02 }); noise(0.5, { type: 'lowpass', freq: 400, vol: 0.12, brown: true }); },
  kill: () => tone(90, 0.5, { type: 'triangle', vol: 0.12, slide: -40, wet: 0.3 }),
  // the bosses: a ground-shaking slam, the Chimera's fire, a block of stone torn up and hurled, and landing
  // (big: a giant boss's: the recording slowed and louder over a boom and the rubble it shakes loose)
  slam: ({ at, big } = {}) => {
    if (big) { play('slamHit', { vol: 1.1, at, near: 18, far: 200, wet: 0.5, rate: [0.7, 0.78] }); sub(1.7, { f0: 56, f1: 24, k: 1.15, at, near: 18, far: 200, attack: 0.006 }); rattle(8, 1.2, { at, near: 18, far: 160 }); return; }
    if (play('slamHit', { vol: 0.75, at, near: 8, far: 80, wet: 0.35, rate: [0.9, 1] })) return; noise(0.7, { type: 'lowpass', freq: 220, vol: 0.6, brown: true, wet: 0.5 }); tone(55, 0.8, { type: 'sine', vol: 0.3, slide: -25, wet: 0.4 }); noise(0.15, { freq: 900, q: 1, vol: 0.18, delay: 0.02 }); },
  // the Chimera's fire: the burst slowed and loud, the lion's roar in it, and the fire's own roar all the while it pours
  breath: ({ at } = {}) => {
    const s = place(at, 20, 180); play('fireBurst', { vol: 1.25, at, near: 20, far: 180, wet: 0.35, rate: [0.6, 0.68] }); play('bossRoar', { vol: 0.6, at, near: 20, far: 180, wet: 0.45, rate: [0.9, 0.96], gap: 0.3 });
    noise(1.9, { type: 'lowpass', freq: 750, vol: 0.55 * s.k, brown: true, attack: 0.18, wet: 0.4, slide: -320, pan: s.pan * 0.5 }); noise(1.8, { freq: 1500, q: 0.6, vol: 0.2 * s.k, attack: 0.25, slide: -600, pan: s.pan * 0.5 });
    sub(1.9, { f0: 50, f1: 30, k: 0.7, at, near: 20, far: 180, attack: 0.3 }); },
  // a giant boss's foot coming down (k: how big): a slowed landing on rock over a short deep thud
  giantStep: ({ at, k = 1 } = {}) => { play('landRock', { vol: 0.7 * k, at, near: 12, far: 150, rate: [0.4, 0.48], wet: 0.25, gap: 0.08 }); sub(0.55, { f0: 50, f1: 28, k: 0.6 * k, at, near: 12, far: 150, attack: 0.006, rumble: 0.7 }); },
  // a boss's blow landing on you: a heavy, close impact over the hurt
  bossHit: ({ k = 1 } = {}) => { play('slamHit', { vol: 0.75 * k, wet: 0.2, rate: [1.05, 1.15], gap: 0.1 }); sub(0.8, { f0: 80, f1: 34, k: 0.95 * k, attack: 0.004, rumble: 0.5 }); noise(0.14, { type: 'lowpass', freq: 900, vol: 0.4 * k, brown: true }); },
  // as a boss comes: the ground rumbling deeper and louder for dur seconds, grit falling, until the blast
  quake: ({ dur = 3 } = {}) => { noise(dur, { type: 'lowpass', freq: 110, q: 0.8, vol: 0.6, attack: dur * 0.85, brown: true, wet: 0.4 }); tone(31, dur, { type: 'sine', vol: 0.32, attack: dur * 0.85, slide: 7, wet: 0.1 }); rattle(14, dur * 0.9, { k: 0.8, delay: 0.3 }); },
  // the blast as a boss lands: a slowed thunderclap and slam over the deepest boom of all, its rumble rolling on, stones
  // raining down after it; the music hardly dips (setFight)
  blast: ({ at } = {}) => {
    const s = place(at, 30, 320); play('thunderClap', { vol: 1.15, at, near: 30, far: 320, rate: [0.6, 0.68], wet: 0.5 }); play('slamHit', { vol: 1.25, at, near: 30, far: 320, rate: [0.52, 0.6], wet: 0.6, gap: 0 });
    sub(3.4, { f0: 66, f1: 21, k: 1.5, at, near: 30, far: 320, attack: 0.005, rumble: 1 }); noise(2.8, { type: 'lowpass', freq: 400, vol: 0.6 * s.k, slide: -320, brown: true, wet: 0.7, pan: s.pan * 0.5 });
    rattle(16, 2.6, { at, near: 30, far: 260, delay: 0.4 }); duck(0.4); },
  // a length of wall or a column falling (k: how big), from where it lands
  collapse: ({ at, k = 1 } = {}) => { play('boulder', { vol: 0.9 * k, at, near: 10, far: 140, wet: 0.4, rate: [0.58, 0.72], gap: 0.06 }); const s = place(at, 10, 140);
    noise(1, { type: 'lowpass', freq: 520, vol: 0.45 * k * s.k, slide: -320, brown: true, wet: 0.45, pan: s.pan * 0.6 }); sub(0.9, { f0: 68, f1: 32, k: 0.6 * k, at, near: 10, far: 140 }); rattle(5, 0.9, { k, at, near: 10, far: 120 }); },
  // a dryad's thorn (k: how near): the rustle and rising shimmer as the glow gathers in her hand, the whoosh as it leaves
  // it, the crack and scatter of leaves where it strikes
  thornCast: (k = 1) => { if (k <= 0) return; noise(0.6, { freq: 2600, q: 0.7, vol: 0.12 * k, attack: 0.3, slide: 1400, wet: 0.3 }); tone(520, 0.6, { type: 'sine', vol: 0.05 * k, slide: 380, attack: 0.35, wet: 0.5 }); tone(780, 0.5, { type: 'triangle', vol: 0.025 * k, slide: 500, attack: 0.3, delay: 0.1, wet: 0.5 }); },
  thornThrow: (k = 1) => { if (k <= 0) return; noise(0.35, { freq: 1300, q: 1.2, vol: 0.22 * k, slide: -700, attack: 0.02, wet: 0.2 }); noise(0.25, { freq: 3600, q: 0.8, vol: 0.08 * k, slide: -1500 }); tone(900, 0.25, { type: 'sine', vol: 0.04 * k, slide: -500, wet: 0.4 }); },
  thornHit: (k = 1) => { noise(0.06, { freq: 1900, q: 2.5, vol: 0.3 * k }); tone(260, 0.1, { type: 'triangle', vol: 0.1 * k, slide: -120 }); noise(0.4, { freq: 3800, q: 0.6, vol: 0.12 * k, attack: 0.01, slide: -1800, delay: 0.03 }); },
  boulder: ({ at, land } = {}) => { if (play('boulder', { vol: land ? 0.75 : 0.5, at, near: 6, far: 70, wet: 0.3, rate: land ? [0.85, 0.95] : [1, 1.1], gap: 0.2 })) return;
    if (land) { SFX.thud(); return; } noise(0.45, { freq: 500, q: 0.8, vol: 0.22, slide: 300, attack: 0.05 }); tone(80, 0.3, { type: 'triangle', vol: 0.1, slide: -30 }); },
  // thunder near at hand (k: how big; at: where, for a creature's small thunderclap as its body goes): a crack when it's
  // close, then a long roll of rumbling bursts under the reverb
  thunder: (k = 1, { at } = {}) => {
    const near = k > 0.9; if (at ? play('thunderClap', { vol: 0.4 * k, at, near: 6, far: 80, wet: 0.4, bus: ambBus }) : play('thunderNear', { vol: 0.62 * k, wet: 0.35, rate: [0.92, 1.04], bus: ambBus, from: 'onset' })) { duck(k * 0.6); return; }
    if (near && sample('thunder', { vol: 0.7 * k, wet: 0.3, rate: [0.9, 1.05], bus: ambBus })) return;
    if (near) { noise(0.25, { freq: 2200, q: 0.5, vol: 0.35 * k, wet: 0.6 }); noise(0.5, { type: 'lowpass', freq: 1200, vol: 0.4 * k, wet: 0.6, delay: 0.05 }); }
    const n = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) noise(rnd(1.2, 2.6), { type: 'lowpass', freq: rnd(120, 260), vol: rnd(0.25, 0.5) * k * (1 - i / (n + 2)), slide: -80, attack: rnd(0.05, 0.3), delay: (near ? 0.2 : 0.6) + i * rnd(0.25, 0.55), brown: true, wet: 0.7, pan: rnd(-0.6, 0.6), bus: ambBus });
  },
  // thunder from a strike, heard from where it struck: it arrives at the speed of sound; the further off, the quieter, the
  // deeper (the air takes the highs out) and the longer it rolls (it comes from the whole length of the bolt, kilometres
  // of it). Close by the crack and burst of a strike right overhead, then a near peal; a few hundred metres off a peal;
  // far off a low roll. Each recording starts from just before its sound, so it lands when the delay says.
  stormThunder: ({ dist = 500, pan = 0, big = 1 } = {}) => {
    // (under a roof it comes muffled through the walls; the start is noted for the tests: THUNDER)
    const delay = dist / 343, k = big / (1 + dist / 380) * (1 - shut * 0.4), lp = (180 + 4200 * Math.exp(-dist / 450)) * (1 - shut * 0.7), o = { pan: pan * 0.8, bus: ambBus };
    THUNDER.at = now() + delay; THUNDER.n++; THUNDER.k = k; duck(Math.min(1, k * 1.6), delay);
    let rec;
    if (dist < 260) { rec = sampleFar('thunderClap', { ...o, vol: 0.95 * k, wet: 0.3, rate: rnd(0.95, 1.05), delay, lp: Math.max(lp, 6000), from: 'onset' }); sampleFar('thunderNear', { ...o, vol: 0.6 * k, wet: 0.45, rate: rnd(0.9, 1), delay: delay + 0.35, lp: Math.max(lp, 2500), from: 'onset' }); }
    else if (dist < 900) rec = sampleFar('thunderNear', { ...o, vol: Math.min(0.8, 1.05 * k), wet: 0.5, rate: rnd(0.85, 1), delay, lp: Math.max(lp, 900), from: 'onset' });
    else rec = sampleFar('thunderFar', { ...o, vol: Math.min(0.7, 1.05 * k), wet: 0.6, rate: rnd(0.75, 0.95), delay: delay + 0.1, lp: Math.max(lp, 300), from: 'onset' });
    if (!rec) {   // (the first pack's thunder, its crack 1.4 s in, after rain)
      if (dist < 450) { if (!sampleFar('thunder', { ...o, vol: 0.9 * k, wet: 0.35, rate: rnd(0.92, 1.05), delay, lp: Math.max(lp, 2500), from: 1.36 })) { noise(0.25, { ...o, freq: 2200, q: 0.5, vol: 0.4 * k, wet: 0.6, delay }); noise(0.6, { ...o, type: 'lowpass', freq: 1400, vol: 0.45 * k, wet: 0.6, delay: delay + 0.04 }); } }
      else sampleFar('thunder', { ...o, vol: Math.min(0.8, 1.1 * k), wet: 0.6, rate: rnd(0.62, 0.8), delay: delay + 0.1, lp, from: 1.36 });
    }
    // (the long roll under it, from along the bolt: softer under a recording, which has a roll of its own)
    const n = 4 + Math.floor(Math.random() * 4) + Math.floor(Math.min(4, dist / 400)), spread = 0.3 + Math.min(1.1, dist / 1400), rk = rec ? 0.35 : 1;
    for (let i = 0; i < n; i++) noise(rnd(1.4, 3.2) * (1 + spread * 0.5), { ...o, type: 'lowpass', freq: rnd(70, 110) + lp * 0.05, vol: rnd(0.35, 0.6) * k * rk * (1 - i / (n + 3)), slide: -30, attack: rnd(0.1, 0.5), delay: delay + 0.15 + i * rnd(0.3, 0.6) * spread * 1.6, brown: true, wet: 0.75, pan: pan * 0.6 + rnd(-0.3, 0.3) });
  },
  // a roar (boss: the Minotaur's war cry, the Chimera's, long: the full one as a boss comes or is enraged; giant: a
  // giant's growl; neither: the Minotaur's roar the hero was given)
  // (a boss's own: slowed for the giant it comes from, louder and further heard, over a long boom)
  roar: ({ at, boss, long, giant } = {}) => {
    if (!giant && boss && play(long ? 'bossRoarLong' : 'bossRoar', { vol: 1.15, at, near: 30, far: 240, wet: 0.5, rate: [0.78, 0.85] })) { sub(long ? 3.4 : 2.1, { f0: 64, f1: 30, k: 1.1, at, near: 30, far: 240, attack: 0.22 }); duck(0.4); return; }
    if (!giant && play(long ? 'bossRoarLong' : 'bossRoar', { vol: 0.75, at, near: 10, far: 120, wet: 0.4, rate: [1.05, 1.12] })) { duck(0.4); return; }
    sample('growl', { vol: 0.7, wet: 0.4, rate: [0.7, 0.8], at });   // (the growl over the synthesised rumble, which gives it its size)
    tone(66, 1.5, { type: 'sawtooth', vol: 0.2, slide: -24, attack: 0.15, wet: 0.5 }); tone(99, 1.3, { type: 'square', vol: 0.06, slide: -38, attack: 0.15, wet: 0.5 }); noise(1.4, { type: 'lowpass', freq: 420, vol: 0.32, attack: 0.15, slide: -220, brown: true, wet: 0.5 }); },
  summon: () => { if (play('bossSummon', { vol: 0.8, wet: 0.45 })) { duck(0.5); return; } tone(55, 3.2, { type: 'sawtooth', vol: 0.12, slide: 30, attack: 1, wet: 0.6 }); SFX.thunder(1.2); },
  // something revealed: a clue's map, the Olympos altar, a head offered (the team's chime), and a small step done (chime:
  // the lyre's rising notes)
  reveal: () => { if (play('revealChime', { vol: 0.55, wet: 0.3, rate: [0.99, 1.01], gap: 1 })) return; SFX.chime(); },
  chime: () => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, { vol: 0.1, delay: i * 0.14, pan: -0.3 + i * 0.2 })),
  // a skill found or up a level (hud.js): a small bell, soft and a little to the right where its banner shows; two notes
  // rising for a level, three for a skill found (each a sine and its bell's quiet, inharmonic partial). No recording yet
  skill: ({ learned } = {}) => (learned ? [659.25, 783.99, 1046.5] : [783.99, 1046.5]).forEach((f, i) => {
    tone(f, 1.3, { vol: 0.055, attack: 0.004, delay: i * 0.12, wet: 0.35, pan: 0.25 }); tone(f * 2.76, 0.45, { vol: 0.011, attack: 0.002, delay: i * 0.12, wet: 0.35, pan: 0.25 }); }),
  // food done on a cooking stand (at: where it hangs): fat spitting on the coals, crackling up for half a second over a
  // hot sizzle, then the soft "pss" of steam let go as it settles. The team has no recording for it (docs/plans/audio.md);
  // synthesised from filtered noise, no tones, so it stays a natural sound
  cooked: ({ at } = {}) => {
    const s = place(at, 3, 30), k = s.k, pan = s.pan; if (k < 0.01) return;
    noise(1.0, { type: 'highpass', freq: 3800, q: 0.5, vol: 0.22 * k, attack: 0.32, slide: 900, wet: 0.04, pan });   // (the sizzle, rising)
    noise(0.8, { type: 'bandpass', freq: 1700, q: 0.8, vol: 0.09 * k, attack: 0.25, wet: 0.03, pan });
    for (let i = 0; i < 34; i++) { const d = 0.7 * Math.sqrt(Math.random());   // (the crackle: grains thickening as it heats)
      noise(rnd(0.006, 0.022), { freq: rnd(2200, 7000), q: rnd(1.2, 4), vol: rnd(0.12, 0.36) * k * (0.5 + d), attack: 0.001, delay: d, wet: 0.03, pan: pan + rnd(-0.15, 0.15) }); }
    noise(0.05, { type: 'lowpass', freq: 700, vol: 0.15 * k, attack: 0.003, delay: 0.45, brown: true, pan });   // (a fat drop popping)
    noise(1.1, { type: 'bandpass', freq: 3300, q: 0.7, vol: 0.19 * k, attack: 0.07, slide: -1500, delay: 0.62, wet: 0.08, pan });   // (pss: steam let go, falling away)
    noise(0.9, { type: 'highpass', freq: 5200, q: 0.4, vol: 0.075 * k, attack: 0.05, slide: -1800, delay: 0.66, wet: 0.06, pan });
    AUDIO.log?.push({ k: 'cooked', i: -1, t: now(), vol: +k.toFixed(3), bus: 'sfx' });   // (synthesised: noted for the tests all the same)
  },
  // ---- the Minotaur fight (trial.js)
  // his breath when he's spent: a long, deep, rough breath in through the nostrils and a heavier one out, a growl in it (k:
  // how hard; the next breath is the caller's: one each time it's asked)
  pant: ({ at, k = 1 } = {}) => { const s = place(at, 15, 120), v = k * s.k; if (v < 0.01) return; const o = { brown: true, wet: 0.3, pan: s.pan * 0.5 };
    noise(0.65, { ...o, type: 'bandpass', freq: 380, q: 1.4, vol: 0.32 * v, attack: 0.35, slide: 160 }); noise(0.5, { freq: 1300, q: 1, vol: 0.06 * v, attack: 0.3, slide: 300, pan: s.pan * 0.5, wet: 0.2 });
    noise(0.9, { ...o, type: 'bandpass', freq: 300, q: 1.2, vol: 0.42 * v, attack: 0.06, slide: -170, delay: 0.72 }); tone(62, 0.8, { type: 'sawtooth', vol: 0.05 * v, slide: -14, attack: 0.08, delay: 0.72, wet: 0.3, pan: s.pan * 0.5 });
    sub(0.7, { f0: 44, f1: 30, k: 0.35 * k, at, near: 15, far: 120, delay: 0.72, attack: 0.1, rumble: 0.3 }); },
  // the snort and the scrape of a hoof as he lowers his horns to charge
  snort: ({ at } = {}) => { const s = place(at, 15, 160); if (s.k < 0.01) return; noise(0.35, { type: 'bandpass', freq: 520, q: 1.1, vol: 0.5 * s.k, attack: 0.02, slide: -260, brown: true, wet: 0.35, pan: s.pan * 0.5 }); noise(0.25, { freq: 1700, q: 0.8, vol: 0.12 * s.k, attack: 0.01, slide: -700, wet: 0.2, pan: s.pan * 0.5 });
    noise(0.5, { type: 'bandpass', freq: 900, q: 0.7, vol: 0.18 * s.k, attack: 0.05, slide: -500, delay: 0.25, wet: 0.2, pan: s.pan * 0.5 }); },
  // the charge under way: a rumble that grows with his speed for dur seconds (his hooves are his footfalls: giantStep)
  charge: ({ at, dur = 2 } = {}) => { const s = place(at, 20, 220); if (s.k < 0.01) return; noise(dur, { type: 'lowpass', freq: 160, q: 0.8, vol: 0.55 * s.k, attack: dur * 0.7, slide: 60, brown: true, wet: 0.3, pan: s.pan * 0.4 }); sub(dur, { f0: 34, f1: 48, k: 0.5, at, near: 20, far: 220, attack: dur * 0.7, rumble: 0.4 }); },
  // a lightning bolt gathering where it will fall (the ground glowing): a fizz and crackle rising for a second (at)
  zap: ({ at, dur = 1 } = {}) => { const s = place(at, 6, 80); if (s.k < 0.02) return; noise(dur, { type: 'highpass', freq: 2500, q: 0.6, vol: 0.12 * s.k, attack: dur * 0.9, slide: 2500, wet: 0.2, pan: s.pan });
    for (let i = 0; i < 18; i++) { const d = dur * Math.sqrt(Math.random()); noise(rnd(0.004, 0.015), { freq: rnd(2500, 8000), q: 2, vol: rnd(0.08, 0.2) * s.k * (0.3 + d / dur), attack: 0.001, delay: d, wet: 0.1, pan: s.pan }); } },
  // a skeleton clawing out of the ground: earth breaking, then its bones knocking together as it pulls free
  boneRise: ({ at } = {}) => { const s = place(at, 5, 60); if (s.k < 0.02) return; noise(1.2, { type: 'lowpass', freq: 380, vol: 0.4 * s.k, attack: 0.1, slide: -150, brown: true, wet: 0.25, pan: s.pan }); rattle(6, 1, { k: 0.8, at, near: 5, far: 60, delay: 0.1 }); SFX.boneRattle({ at, k: 0.8, delay: 0.7 }); },
  // its bones clacking as it walks (k: how loud; delay)
  boneRattle: ({ at, k = 1, delay = 0 } = {}) => { const s = place(at, 4, 40); if (s.k * k < 0.02) return; const n = 3 + Math.floor(Math.random() * 4), f = rnd(700, 1100);
    for (let i = 0; i < n; i++) { noise(rnd(0.02, 0.05), { freq: f * rnd(0.8, 1.3), q: rnd(5, 10), vol: rnd(0.08, 0.16) * k * s.k, attack: 0.001, delay: delay + i * rnd(0.05, 0.11), wet: 0.15, pan: s.pan }); } },
  // a skeleton falling apart: a dry crack, then its bones clattering down and rolling, a hollow knock for the skull
  boneCrumble: ({ at } = {}) => { const s = place(at, 5, 60); if (s.k < 0.02) return; noise(0.08, { freq: 1600, q: 2, vol: 0.4 * s.k, attack: 0.002, wet: 0.2, pan: s.pan });
    for (let i = 0; i < 16; i++) { const d = 0.05 + 0.7 * Math.random() ** 1.5; noise(rnd(0.02, 0.06), { freq: rnd(600, 1500), q: rnd(4, 9), vol: rnd(0.07, 0.18) * s.k * (1 - d * 0.6), attack: 0.001, delay: d, wet: 0.2, pan: s.pan + rnd(-0.2, 0.2) }); }
    tone(330, 0.12, { type: 'triangle', vol: 0.08 * s.k, slide: -60, delay: 0.42, wet: 0.2, pan: s.pan }); tone(300, 0.1, { type: 'triangle', vol: 0.05 * s.k, slide: -50, delay: 0.6, wet: 0.2, pan: s.pan }); },
  owl: ({ at } = {}) => { if (play('owlHoot', { vol: 0.5, at, near: 6, far: 70, wet: 0.35, rate: [0.97, 1.03] })) return; tone(400, 0.4, { vol: 0.11, slide: -30, attack: 0.06, wet: 0.5 }); tone(380, 0.7, { vol: 0.11, slide: -50, attack: 0.06, delay: 0.5, wet: 0.5 }); },
};
export function sound(name, ...a) { if (!ctx) return; try { SFX[name]?.(...a); } catch { /* audio is optional */ } }

// ---- beds: a recording looped (its seam made in sounds.mjs), faded to the level asked each frame; loaded the first time
// it's wanted, one of its recordings (not the last one) each time it starts, and let go of after a while silent
const BEDS = {};
function bed(k, v, dt, { tc = 1.2, bus = ambBus, rate = 1 } = {}) {
  if (!META[k]) return false; let b = BEDS[k]; if (AUDIO.solo && AUDIO.solo !== k) v = 0;   // (solo: checking the mix, one bed alone)
  if (!b) { if (v < 0.002) return true; b = BEDS[k] = { g: ctx.createGain(), s: null, i: -1, quiet: 0 }; b.g.gain.value = 0; b.g.connect(bus); }
  b.g.gain.setTargetAtTime(v, now(), tc);
  if (v >= 0.002) { b.quiet = 0;
    if (!b.s && !b.loading) { const n = META[k].n; let i = Math.floor(Math.random() * n); if (n > 1 && i === b.i) i = (i + 1) % n; b.loading = true;
      fetchOne(k, i).then((buf) => { b.loading = false; if (!buf || b.s) return; const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.connect(b.g); s.start(0, Math.random() * buf.duration); b.s = s; b.i = i; AUDIO.log?.push({ k, i, t: now(), bed: true, bus: bus === ambBus ? 'amb' : 'sfx' }); }); } }
  else if (b.s && (b.quiet += dt) > 25) { b.s.stop(); b.s.disconnect(); b.s = null; unload(k, b.i); }   // (silent a while: stop it and free its sound)
  return true;
}
// (for the tests and the mix: each bed's level now, and the synthesised beds')
AUDIO.buses = () => ({ sfx: sfxBus, amb: ambBus, music: recBus });
AUDIO.levels = () => ({ beds: Object.fromEntries(Object.entries(BEDS).filter(([, b]) => b.s).map(([k, b]) => [k, +b.g.gain.value.toFixed(3)])), synth: Object.fromEntries(Object.entries(amb).map(([k, b]) => [k, +b.g.gain.value.toFixed(3)])) });

// ---- the fires burning near you (game.js: the nearest few lit within 25 m, { id, x, y, z, k: how big it burns }): each
// crackles and roars where it stands, its own loop, faded in as it's lit and out as it dies
const FIRES = new Map();
export function fires(list) {
  if (!ctx || !META.bedFire) return false; const t = now(), seen = new Set();
  for (const f of list) {
    seen.add(f.id); let s = FIRES.get(f.id);
    if (!s) { const i = f.id.length % META.bedFire.n; s = { g: ctx.createGain(), p: ctx.createStereoPanner(), lp: ctx.createBiquadFilter(), i, src: null }; s.g.gain.value = 0; s.lp.type = 'lowpass'; s.lp.connect(s.g).connect(s.p).connect(ambBus); FIRES.set(f.id, s);
      fetchOne('bedFire', i).then((buf) => { if (!buf || s.gone) return; const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.playbackRate.value = rnd(0.95, 1.05); src.connect(s.lp); src.start(0, Math.random() * buf.duration); s.src = src; AUDIO.log?.push({ k: 'bedFire', i, t: now(), fire: f.id, bus: 'amb' }); }); }
    const sp = spatial(f, 1.5, 25); s.g.gain.setTargetAtTime(0.7 * Math.min(1, f.k) * sp.k, t, 0.25); s.p.pan.setTargetAtTime(sp.pan, t, 0.1); s.lp.frequency.setTargetAtTime(Math.min(16000, sp.lp), t, 0.2);
  }
  for (const [id, s] of FIRES) if (!seen.has(id)) { s.gone = true; s.g.gain.setTargetAtTime(0, t, 0.4); FIRES.delete(id); setTimeout(() => { s.src?.stop(); s.g.disconnect(); }, 2500); }
  return true;
}

// ---- the world's ambience, called every frame with what's around the player
// { wind 0..1, gust 0..1, windDir {x, z}, rain 0..1, night 0..1, dusk 0..1, fire 0..1, inside 0/1 (walls round you), roof
//   0/1, forest 0..1 (trees round you), deep 0..1 (trees just where you stand), marsh 0..1, sea 0..1, pedias, yleos 0..1
//   (how much each land it is where you stand) }
let gust = 0, gustTo = 0.3, gustT = 0, gustWas = 0, gustAt = -99, birdT = 2, crickT = 1, owlT = 20, foxT = 60, frogT = 3, dropT = 0, musicT = 25, droneOn = false, drone = null;
const MODE = [146.83, 164.81, 174.61, 196.0, 220.0, 246.94, 261.63, 293.66, 329.63, 349.23, 392.0, 440.0];   // D Dorian over two octaves
// how near the storm wall you are (0..1, stormwall.js): its roar and the gale blowing into it
let stormK = 0, shut = 0;
export function stormAmbience(k) { stormK = k; }
// when the last thunder was set to start, on the audio clock (the tests weigh it against the flash), and the clock itself
export const THUNDER = { at: 0, n: 0, k: 0, now: () => (ctx ? ctx.currentTime : 0), ctx: () => ctx, out: () => out };
// the recorded music is playing (music.js): the lyre keeps quiet
export const LYRE = { off: false };
export function updateAmbience(dt, w = {}) {
  if (!ctx) return; const t = now(), A = amb, sh = (node, v, tc = 0.6) => node.g.gain.setTargetAtTime(AUDIO.solo && AUDIO.solo !== 'synth' ? 0 : v, t, tc);
  const sk = stormK * stormK, wind = Math.max(w.wind ?? 0.3, sk);
  const { rain = 0, night = 0, dusk = 0, fire = 0, inside = 0, roof = 0, forest = 0, deep = 0, marsh = 0, sea = 0, pedias = 1 - (w.yleos ?? 0), yleos = 0 } = w, open = 1 - inside * 0.75;
  shut = Math.max(inside, roof * 0.6);
  // wind: a slow random walk of gusts, or the wind's own (wind.js); its recorded beds by its strength, a soft breeze, a
  // steady wind and a gale, each swelling with the gusts; a gust of its own on each strong gust, from upwind
  if (w.gust !== undefined) gust += (Math.min(1, wind * 0.6 + w.gust * 0.8) - gust) * Math.min(1, dt * 1.5);
  else { gustT -= dt; if (gustT <= 0) { gustT = rnd(2, 7); gustTo = Math.min(1, Math.max(0, wind + rnd(-0.25, 0.4))); } gust += (gustTo - gust) * Math.min(1, dt * 0.6); }
  const swell = 0.75 + 0.5 * gust, recWind = bed('bedWindSoft', 0.25 * (1 - sstep(0.35, 0.8, wind)) * swell * open, dt);
  bed('bedWindMid', 0.38 * sstep(0.1, 0.5, wind) * (1 - 0.6 * sstep(0.6, 1, wind)) * swell * open, dt); bed('bedWindStrong', 0.5 * sstep(0.45, 0.95, wind) * swell * open, dt);
  const ww = recWind ? 0.25 : 1;   // (the synthesised wind under the recordings: only its low rumble and whistle in a gale)
  sh(A.windLow, (0.05 + gust * 0.22) * open * ww); A.windLow.f[0].frequency.setTargetAtTime(220 + gust * 420, t, 1);
  sh(A.windHigh, gust * gust * 0.08 * open * ww); A.windHigh.f[0].frequency.setTargetAtTime(600 + gust * 900, t, 1);
  sh(A.whistle, Math.max(0, gust - 0.65) * 0.05 * open * ww); A.whistle.f[0].frequency.setTargetAtTime(1200 + gust * 900 + Math.sin(t * 0.7) * 150, t, 0.5);
  const g1 = w.gust ?? gust; if (g1 > 0.32 && gustWas <= 0.32 && t - gustAt > 7 && open > 0.5) { gustAt = t; const d = w.windDir, pn = d ? Math.max(-0.8, Math.min(0.8, -(d.x * -L.fz + d.z * L.fx))) : rnd(-0.6, 0.6);
    play('windGust', { vol: (0.25 + 0.4 * wind) * open, pan: pn, wet: 0.2, bus: ambBus, rate: [0.9, 1.05] }); if (forest > 0.3) play('leafRustle', { vol: 0.35 * forest, pan: -pn * 0.5, wet: 0.2, bus: ambBus, delay: 0.4 }); }
  gustWas = g1;
  // the wind in the leaves, wherever trees stand round you, by day and by night: a soft bed that swells with the gusts;
  // and in the open meadow the wind through the grass
  const sway = 0.7 + 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1), recLeaves = bed('bedLeaves', forest * (0.2 + gust * 0.35) * sway * open, dt);
  bed('bedGrass', pedias * (1 - forest) * (0.12 + gust * 0.18) * open * (1 - rain * 0.5), dt);
  const lw = recLeaves ? 0.35 : 1;
  sh(A.leaves, forest * (0.035 + gust * 0.09) * sway * open * lw, 1.2); sh(A.leavesLo, forest * (0.05 + gust * 0.1) * sway * open * lw, 1.2);
  A.leavesLo.f[0].frequency.setTargetAtTime(900 + gust * 500, t, 1.5);
  // rain: droplets in a light rain, the rush of a downpour in a heavy one (2 dB under the other beds: a downpour is a bed,
  // not a roar); under a roof the drumming on it, and inside (walls round you too) only a muffled hush through them
  const out1 = (1 - inside * 0.92) * (roof && !inside ? 0.55 : 1), recRain = bed('bedDrops', sstep(0.02, 0.3, rain) * (1 - 0.5 * sstep(0.6, 1, rain)) * 0.6 * out1, dt);
  bed('bedRain', sstep(0.45, 1, rain) * 0.48 * out1, dt); bed('bedRoof', roof ? rain * 0.6 * (1 - inside * 0.5) : 0, dt, { tc: 0.4 }); bed('bedMuffled', inside ? rain * 0.75 : 0, dt);
  const L1 = (k, v) => bed(k, v, dt, { tc: 0.8, rate: k === 'loopCrickets' ? 0.32 : 1 });   // (the first pack's loops, where there's no recording of the team's)
  if (!recRain) L1('loopRain', rain * 0.45 * (1 - inside * 0.8) * (roof ? 0.6 : 1));
  L1('loopStorm', Math.max(recRain ? 0 : rain - 0.6, sk * 0.7) * 1.2 * (1 - inside * 0.7));   // (the storm wall's own)
  sh(A.roar, (stormK * 0.12 + sk * 0.3) * (1 - inside * 0.5), 1.5); A.roar.f[0].frequency.setTargetAtTime(90 + gust * 60, t, 1);
  const rr = recRain ? 0.15 : 1;
  sh(A.rainHiss, rain * 0.2 * (1 - inside * 0.8) * (roof ? 0.6 : 1) * (META.loopRain ? 0.3 : 1) * rr); sh(A.rainBody, rain * rain * 0.3 * (1 - inside * 0.6) * rr);
  sh(A.roof, roof ? rain * 0.22 * rr : 0, 0.4);
  dropT -= dt; if (rain > 0.15 && dropT <= 0 && !recRain) { dropT = rnd(0.01, 0.06) / rain;
    if (roof) noise(rnd(0.03, 0.07), { type: 'lowpass', freq: rnd(900, 1600), vol: rnd(0.03, 0.09) * rain, pan: rnd(-0.8, 0.8), bus: ambBus, wet: 0.05 });
    else noise(rnd(0.015, 0.04), { freq: rnd(2200, 6000), q: rnd(1, 4), vol: rnd(0.015, 0.05) * rain * open, pan: rnd(-0.9, 0.9), bus: ambBus, wet: 0 }); }
  // the sea: waves on the shore near it (sea: how much of the land round you is sea), breathing in long swells
  const recSea = bed('bedWaves', sea * 0.5 * open, dt, { tc: 1.5 });
  sh(A.sea, sea * (0.1 + 0.08 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 0.31)) * open * (recSea ? 0.2 : 1), 0.8); A.sea.f[0].frequency.setTargetAtTime(380 + 160 * Math.sin(t * 0.7), t, 0.8);
  // fire: a low roar and crackles (only where the fires have no recording of their own: fires())
  const fk = META.bedFire ? 0 : fire; sh(A.fire, fk * 0.16, 0.2);
  if (fk > 0.1 && Math.random() < dt * 9 * fk) noise(rnd(0.01, 0.04), { freq: rnd(1800, 5000), q: 3, vol: rnd(0.04, 0.12) * fk, pan: rnd(-0.3, 0.3), bus: ambBus, wet: 0.05 });
  // creatures: birds by day; crickets from dusk on, owls, a fox far off and frogs by night; the forest and the marsh have
  // their own. The crickets sing most in the open and at the woods' edges (deep: how wooded it is just where you stand),
  // swelling as the light goes and dying away at first light; the meadows' and the forest's each their own.
  const calm = (1 - rain * 0.85) * open, crick = Math.min(1, night * 1.2 + dusk * 0.6) * Math.max(0, 1 - rain / 0.3) * (1 - deep * 0.55);
  const recBirds = bed('bedBirds', night < 0.3 ? calm * (1 - night) * 0.42 * (1 - marsh * 0.6) : 0, dt, { tc: 2 });
  if (!recBirds) L1('loopBirds', night < 0.3 ? calm * (1 - night) * 0.42 : 0);
  const recCrick = bed('bedCricketsP', calm * crick * 0.38 * Math.min(1, pedias * 1.4), dt, { tc: 2 }); bed('bedCricketsY', calm * crick * 0.42 * Math.min(1, yleos * 1.4), dt, { tc: 2 });
  if (!recCrick) L1('loopCrickets', calm * crick * 0.24);
  birdT -= dt; if (birdT <= 0) { birdT = rnd(1.5, 6) / (1 + forest * 0.6) * (recBirds || META.loopBirds ? 3 : 1); if (night < 0.3 && calm > 0.2 && !recBirds) bird(calm * (1 - night)); }   // (calls of their own over the first pack's chorus too, now and then)
  // a cricket singing near you: a few chirps from one side, then quiet (bouts of them over the old chorus, or on their own)
  crickT -= dt; if (crickT <= 0 && !recCrick) { crickT = META.loopCrickets ? rnd(0.8, 3) : rnd(0.25, 0.7);
    if (crick > 0.2 && calm > 0.2) { const f = rnd(4200, 4900), p = rnd(-0.8, 0.8), n = 2 + Math.floor(Math.random() * 4), v = 0.016 * calm * crick;
      for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) tone(f, 0.022, { vol: v, attack: 0.004, delay: k * 0.33 + i * 0.045, pan: p, wet: 0.15, bus: ambBus }); } }
  // an owl now and then, off in the trees: the team's hoots, or a long hoot, a pause, then a soft wavering one (the
  // tawny owl's call)
  owlT -= dt; if (owlT <= 0) { owlT = rnd(25, 60); if (night > 0.5 && rain < 0.4) { const p = rnd(-0.7, 0.7);
    if (!play('owlHoot', { vol: 0.16 * calm * (0.4 + forest * 0.6), pan: p, wet: 0.7, bus: ambBus, lp: 3500, rate: [0.94, 1.02] })) { const f = rnd(360, 400), v = 0.07 * calm, o = { type: 'sine', pan: p, wet: 0.75, bus: ambBus };
      tone(f, 0.6, { ...o, vol: v, slide: -18, attack: 0.07 }); tone(f * 0.94, 0.25, { ...o, vol: v * 0.6, attack: 0.05, delay: 1.5 });
      for (let i = 0; i < 4; i++) tone(f * (0.96 - i * 0.004), 0.16, { ...o, vol: v * 0.8, attack: 0.03, delay: 1.9 + i * 0.17 }); } } }
  // a fox crying far off, rarely
  foxT -= dt; if (foxT <= 0) { foxT = rnd(70, 160); if (night > 0.6 && rain < 0.3) sample('foxCry', { vol: 0.16 * calm, pan: rnd(-0.8, 0.8), wet: 0.6, rate: [0.9, 1.05], bus: ambBus }); }
  // frogs in the marsh: a chorus by day, louder by night and in the rain
  const recFrogs = bed('bedFrogs', sstep(0.12, 0.55, marsh) * (night > 0.3 || rain > 0.3 ? 0.6 : 0.3) * open, dt, { tc: 2 });
  frogT -= dt; if (frogT <= 0 && !recFrogs) { frogT = rnd(0.4, 1.6); if (marsh > 0.3 && (night > 0.3 || rain > 0.3)) { const p = rnd(-0.9, 0.9), f = rnd(110, 180); for (let i = 0; i < 2 + Math.floor(Math.random() * 3); i++) tone(f, 0.09, { type: 'sawtooth', vol: 0.02 * marsh, slide: -20, delay: i * 0.13, pan: p, wet: 0.3, bus: ambBus }); } }
  // music, without the team's: a lyre phrase now and then; a drone that swells at dawn and dusk
  if (LYRE.off) { if (droneOn) { droneOn = false; stopDrone(); } return; }
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

// ---- metering (the tests, and checking the mix): on the effects, the ambience, the music and the output, how loud each
// is now, as EBU R128 hears it (lufs: the K-weighting, a shelf up over the highs and a cut under the deep lows, over the
// last third of a second or so, both channels summed: near enough its momentary loudness) and its peak (dBFS)
AUDIO.meters = () => {
  if (!ctx) return null; const N = 16384;
  if (!AUDIO._m) { AUDIO._m = {}; for (const [k, n] of [['sfx', sfxBus], ['amb', ambBus], ['music', fightG], ['lyre', musicBus], ['out', out]]) {
    const sh = ctx.createBiquadFilter(), hp = ctx.createBiquadFilter(), sp = ctx.createChannelSplitter(2); sh.type = 'highshelf'; sh.frequency.value = 1681; sh.gain.value = 4; hp.type = 'highpass'; hp.frequency.value = 38; hp.Q.value = 0.5;
    const raw = ctx.createAnalyser(), ch = [ctx.createAnalyser(), ctx.createAnalyser()]; raw.fftSize = N; n.connect(raw); n.connect(sh).connect(hp).connect(sp); ch.forEach((a, i) => { a.fftSize = N; sp.connect(a, i); }); AUDIO._m[k] = { raw, ch }; } }
  const r = {}, buf = new Float32Array(N);
  for (const [k, { raw, ch }] of Object.entries(AUDIO._m)) {
    let ms = 0; for (const a of ch) { a.getFloatTimeDomainData(buf); let s = 0; for (const x of buf) s += x * x; ms += s / N; }
    raw.getFloatTimeDomainData(buf); let pk = 0; for (const x of buf) pk = Math.max(pk, Math.abs(x));
    r[k] = { lufs: +(-0.691 + 10 * Math.log10(ms + 1e-12)).toFixed(1), peak: +(20 * Math.log10(pk + 1e-9)).toFixed(1) };
  }
  return r;
};
