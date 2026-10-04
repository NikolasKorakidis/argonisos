// Argonisos audio: everything is synthesised with WebAudio at runtime, no sound files.
//   - SFX: footsteps per surface, swings, hits on wood / stone / flesh, pickups, crafting, bow, UI, quest stingers
//   - Ambience: wind (stronger with altitude), surf by the shore, waterfall, birds by day, crickets at night,
//     cave drips with reverb, fire crackle, the odd wolf howl
//   - Music: a generative lyre + drone score in D Dorian that follows the mood (title, explore, night, cave, cinematic)

let ctx = null, master, musicBus, sfxBus, ambBus, verb, verbSend, noiseBuf;
export const VOL = { master: 0.8, music: 0.45, sfx: 0.9 };
const now = () => ctx.currentTime;
const rnd = (a, b) => a + Math.random() * (b - a);

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  try { ctx = new AudioContext(); } catch { return; }
  master = ctx.createGain(); master.gain.value = VOL.master;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 3;
  master.connect(comp).connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = VOL.music; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = VOL.sfx; sfxBus.connect(master);
  ambBus = ctx.createGain(); ambBus.gain.value = 0.9; ambBus.connect(master);
  // Reverb: a generated impulse (decaying stereo noise). The send level rises inside the cave.
  verb = ctx.createConvolver();
  const len = ctx.sampleRate * 2.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
  verb.buffer = ir; verbSend = ctx.createGain(); verbSend.gain.value = 0.18; verbSend.connect(verb); verb.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  { const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  buildAmbience(); scheduleMusic();
}
export function setVolume(k, v) { VOL[k] = v; if (!ctx) return; ({ master, music: musicBus, sfx: sfxBus })[k].gain.setTargetAtTime(v, now(), 0.05); }

// ---------- building blocks ----------
function out(dest, pan = 0, send = 0) {
  const g = ctx.createGain(); let n = g;
  if (pan) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); n = p; }
  n.connect(dest); if (send) { const s = ctx.createGain(); s.gain.value = send; n.connect(s).connect(verbSend); }
  return g;
}
function noise({ dur = 0.2, type = 'bandpass', f = 1000, f2 = 0, q = 1, vol = 0.2, att = 0.004, dest = sfxBus, pan = 0, send = 0, t = 0 }) {
  if (!ctx) return; const t0 = now() + t, s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t0); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = out(dest, pan, send); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl).connect(g); s.start(t0, Math.random() * 1.5); s.stop(t0 + dur + 0.05);
}
function tone({ f = 440, f2 = 0, dur = 0.3, type = 'sine', vol = 0.1, att = 0.005, dest = sfxBus, pan = 0, send = 0, t = 0, lp = 0 }) {
  if (!ctx) return; const t0 = now() + t, o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t0); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
  const g = out(dest, pan, send); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(vol, t0 + att); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  if (lp) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; o.connect(fl).connect(g); } else o.connect(g);
  o.start(t0); o.stop(t0 + dur + 0.05);
}
// Lyre-ish pluck: triangle + octave sine, fast attack, long decay, filter closing
function pluck(f, t0, vel = 1, dest = musicBus, dur = 2.6) {
  const g = out(dest, rnd(-0.4, 0.4), 0.35), fl = ctx.createBiquadFilter(); fl.type = 'lowpass';
  fl.frequency.setValueAtTime(4200, t0); fl.frequency.exponentialRampToValueAtTime(900, t0 + 0.6); fl.connect(g);
  for (const [m, typ, a] of [[1, 'triangle', 0.16], [2, 'sine', 0.06], [3.01, 'sine', 0.02]]) { const o = ctx.createOscillator(); o.type = typ; o.frequency.value = f * m; o.detune.value = rnd(-4, 4);
    const og = ctx.createGain(); og.gain.setValueAtTime(0.0001, t0); og.gain.exponentialRampToValueAtTime(a * vel, t0 + 0.006); og.gain.exponentialRampToValueAtTime(0.0001, t0 + dur / m);
    o.connect(og).connect(fl); o.start(t0); o.stop(t0 + dur + 0.1); }
}

// ---------- sound effects ----------
let lastStep = 0;
export const snd = {
  step(surface = 'grass', sprint = false) {
    if (!ctx) return; const v = sprint ? 1.25 : 1, p = rnd(-0.15, 0.15);
    if (surface === 'stone') { noise({ f: rnd(2400, 3200), q: 1.2, dur: 0.07, vol: 0.09 * v, pan: p, send: 0.1 }); tone({ f: rnd(140, 180), dur: 0.06, vol: 0.05 * v, pan: p }); }
    else if (surface === 'sand') noise({ type: 'lowpass', f: rnd(900, 1300), dur: 0.14, vol: 0.12 * v, att: 0.02, pan: p });
    else if (surface === 'dirt') { noise({ f: rnd(700, 1000), q: 0.8, dur: 0.1, vol: 0.12 * v, pan: p }); tone({ f: 90, dur: 0.07, vol: 0.05 * v }); }
    else if (surface === 'water') noise({ f: rnd(900, 1400), f2: 400, q: 0.6, dur: 0.25, vol: 0.14 * v, att: 0.01, pan: p });
    else if (surface === 'cave') { noise({ f: rnd(1600, 2200), q: 1.5, dur: 0.08, vol: 0.08 * v, pan: p, send: 0.9 }); }
    else { noise({ f: rnd(2600, 3600), q: 0.6, dur: 0.12, vol: 0.06 * v, att: 0.01, pan: p }); noise({ type: 'lowpass', f: 400, dur: 0.08, vol: 0.06 * v }); }   // grass rustle + thump
  },
  jump() { noise({ f: 900, f2: 1800, q: 0.7, dur: 0.18, vol: 0.06, att: 0.03 }); },
  land() { noise({ type: 'lowpass', f: 320, dur: 0.16, vol: 0.18 }); tone({ f: 70, f2: 45, dur: 0.12, vol: 0.1 }); },
  swing(heavy = false) { noise({ f: heavy ? 500 : 900, f2: heavy ? 1600 : 2600, q: 2.2, dur: heavy ? 0.28 : 0.2, vol: 0.14, att: 0.06 }); },
  hitWood() { tone({ f: rnd(170, 200), f2: 110, dur: 0.22, vol: 0.28, type: 'triangle' }); noise({ f: 1200, q: 1, dur: 0.08, vol: 0.2 }); noise({ type: 'lowpass', f: 300, dur: 0.2, vol: 0.2 }); },
  hitStone() { tone({ f: rnd(1500, 1900), dur: 0.35, vol: 0.06, type: 'sine', send: 0.2 }); tone({ f: rnd(2300, 2700), dur: 0.2, vol: 0.03 }); noise({ f: 3500, q: 1.5, dur: 0.06, vol: 0.22 }); },
  hitFlesh() { noise({ type: 'lowpass', f: 700, dur: 0.14, vol: 0.28 }); tone({ f: 110, f2: 60, dur: 0.14, vol: 0.18, type: 'triangle' }); },
  punch() { noise({ type: 'lowpass', f: 900, dur: 0.1, vol: 0.2 }); tone({ f: 130, f2: 70, dur: 0.1, vol: 0.12 }); },
  bones() { for (let i = 0; i < 5; i++) { tone({ f: rnd(900, 1500), dur: 0.05, vol: 0.06, type: 'square', lp: 2500, t: i * rnd(0.03, 0.07) }); } },
  hurt() { tone({ f: 190, f2: 120, dur: 0.25, vol: 0.12, type: 'sawtooth', lp: 900 }); noise({ type: 'lowpass', f: 500, dur: 0.15, vol: 0.2 }); },
  pickup(big = false) { const b = big ? [659, 880, 1175] : [880, 1320]; b.forEach((f, i) => tone({ f, dur: 0.35, vol: 0.07, type: 'triangle', t: i * 0.06, send: 0.3 })); noise({ f: 5000, q: 2, dur: 0.1, vol: 0.03 }); },
  craft() { for (let i = 0; i < 3; i++) { tone({ f: rnd(420, 520), f2: 300, dur: 0.12, vol: 0.14, type: 'triangle', t: i * 0.16 }); noise({ f: 2500, q: 2, dur: 0.05, vol: 0.12, t: i * 0.16 }); } tone({ f: 988, dur: 0.6, vol: 0.06, type: 'triangle', t: 0.55, send: 0.3 }); },
  eat() { for (let i = 0; i < 3; i++) noise({ f: rnd(1400, 2200), q: 3, dur: 0.07, vol: 0.12, t: i * 0.13 }); },
  sizzle() { noise({ type: 'highpass', f: 3000, dur: 1.4, vol: 0.08, att: 0.1 }); },
  bow() { tone({ f: 220, f2: 180, dur: 0.25, vol: 0.12, type: 'triangle' }); noise({ f: 1800, f2: 800, q: 2, dur: 0.18, vol: 0.1 }); },
  arrowHit() { noise({ f: 900, q: 2, dur: 0.06, vol: 0.2 }); tone({ f: 260, f2: 120, dur: 0.15, vol: 0.1, type: 'triangle' }); },
  chest() { tone({ f: 120, f2: 90, dur: 0.6, vol: 0.12, type: 'sawtooth', lp: 500 }); [523, 659, 784, 1047].forEach((f, i) => tone({ f, dur: 0.7, vol: 0.06, type: 'triangle', t: 0.4 + i * 0.09, send: 0.4 })); },
  ui() { tone({ f: 1400, dur: 0.05, vol: 0.04, type: 'triangle' }); },
  page() { noise({ f: 3000, f2: 1500, q: 0.8, dur: 0.18, vol: 0.05, att: 0.03 }); tone({ f: 660, dur: 0.25, vol: 0.03, type: 'triangle', send: 0.3 }); },
  questNew() { if (!ctx) return; const t0 = now(); [293.7, 440, 587.3].forEach((f, i) => pluck(f, t0 + i * 0.12, 1.3, sfxBus, 2.2)); },
  questDone() { if (!ctx) return; const t0 = now(); [293.7, 370, 440, 587.3, 740].forEach((f, i) => pluck(f, t0 + i * 0.09, 1.4, sfxBus, 2.5)); tone({ f: 146.8, dur: 2, vol: 0.06, type: 'triangle', att: 0.05 }); },
  blessing() { if (!ctx) return; const t0 = now(); [587.3, 740, 880, 1175, 1480].forEach((f, i) => pluck(f, t0 + i * 0.18, 1.2, sfxBus, 4)); [146.8, 220, 293.7].forEach((f) => tone({ f, dur: 5, vol: 0.05, type: 'sine', att: 1.2, send: 0.6 })); noise({ type: 'highpass', f: 6000, dur: 4, vol: 0.03, att: 1.5, send: 0.8 }); },
  thunder() { noise({ type: 'lowpass', f: 1800, f2: 120, dur: 3.2, vol: 0.5, att: 0.01, send: 0.6 }); noise({ type: 'lowpass', f: 90, dur: 4, vol: 0.4, att: 0.3 }); },
  whoosh() { noise({ f: 300, f2: 1400, q: 0.8, dur: 2.2, vol: 0.12, att: 1.2 }); },
  splash() { noise({ f: 1200, f2: 300, q: 0.5, dur: 0.6, vol: 0.2, att: 0.01 }); },
  howl(pan = 0) { if (!ctx) return; const t0 = now(), o = ctx.createOscillator(), g = out(ambBus, pan, 0.8), lf = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(330, t0); o.frequency.linearRampToValueAtTime(590, t0 + 0.9); o.frequency.linearRampToValueAtTime(520, t0 + 2.4); o.frequency.linearRampToValueAtTime(380, t0 + 3.2);
    lf.frequency.value = 5.5; lg.gain.value = 9; lf.connect(lg).connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.05, t0 + 0.5); g.gain.setValueAtTime(0.05, t0 + 2.4); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 3.4);
    o.connect(g); o.start(t0); lf.start(t0); o.stop(t0 + 3.5); lf.stop(t0 + 3.5); },
  grunt() { tone({ f: 95, f2: 70, dur: 0.35, vol: 0.12, type: 'sawtooth', lp: 500 }); },
};

// ---------- ambience ----------
const amb = {};
function loopNoise(type, f, q) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(ambBus); s.start(0, Math.random()); return { fl, g }; }
function buildAmbience() {
  amb.wind = loopNoise('bandpass', 500, 0.6);
  { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.07; lg.gain.value = 260; l.connect(lg).connect(amb.wind.fl.frequency); l.start(); }
  amb.surf = loopNoise('lowpass', 650, 0.5);
  { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 0.11; lg.gain.value = 0.5; const sg = ctx.createGain(); sg.gain.value = 0.5; amb.surf.g.disconnect(); amb.surf.g.connect(sg).connect(ambBus); l.connect(lg).connect(sg.gain); l.start(); }
  amb.stream = loopNoise('bandpass', 1400, 0.4);
  amb.fire = loopNoise('lowpass', 260, 0.7);
  amb.cave = loopNoise('lowpass', 140, 0.7);
  amb.rain = loopNoise('highpass', 1600, 0.3);                       // the storm after the summit: hiss of rain
}
let ambT = 0, birdT = 2, cricketT = 0, dripT = 0, crackT = 0, howlT = 25, thunderT = 8;
// env: { day 0..1, alt 0..1, shore 0..1, water 0..1, fire 0..1, cave bool, forest 0..1, wolves bool, title bool, storm 0..1 }
export function updateAmbience(env, dt) {
  if (!ctx) return;
  ambT -= dt;
  if (ambT <= 0) { ambT = 0.2; const T = now() + 0.05, k = 0.6;
    const st = env.storm || 0;
    amb.wind.g.gain.setTargetAtTime(env.cave ? 0.005 + st * 0.02 : 0.025 + env.alt * 0.12 + st * 0.2, T, k);
    amb.rain.g.gain.setTargetAtTime(st * (env.cave ? 0.025 : 0.13), T, k);
    amb.surf.g.gain.setTargetAtTime(env.cave ? 0 : env.shore * 0.22, T, k);
    amb.stream.g.gain.setTargetAtTime(env.water * 0.12, T, k);
    amb.fire.g.gain.setTargetAtTime(env.fire * 0.1, T, k);
    amb.cave.g.gain.setTargetAtTime(env.cave ? 0.09 : 0, T, k);
    verbSend.gain.setTargetAtTime(env.cave ? 0.9 : 0.18, T, 0.4);
    setMood(env.title ? 'title' : env.cine ? 'cine' : env.cave ? 'cave' : env.day < 0.3 ? 'night' : 'explore');
  }
  if ((env.storm || 0) > 0.5) { thunderT -= dt; if (thunderT <= 0) { thunderT = rnd(14, 34); snd.thunder(); } }
  // birds by day, away from the peak and the cave (they shelter in a storm)
  birdT -= dt;
  if (birdT <= 0) { birdT = rnd(1.5, 5) / (0.4 + env.forest);
    if (env.day > 0.5 && !env.cave && env.alt < 0.6 && !(env.storm > 0.3)) bird(); }
  cricketT -= dt;
  if (cricketT <= 0) { cricketT = rnd(0.3, 0.9); if (env.day < 0.3 && !env.cave && env.alt < 0.5) for (let i = 0; i < 3; i++) tone({ f: rnd(4200, 4700), dur: 0.035, vol: 0.012, dest: ambBus, pan: rnd(-0.8, 0.8), t: i * 0.06 }); }
  dripT -= dt;
  if (dripT <= 0) { dripT = rnd(0.8, 3); if (env.cave) tone({ f: rnd(1100, 2300), f2: rnd(600, 900), dur: 0.12, vol: 0.05, dest: ambBus, pan: rnd(-0.7, 0.7), send: 1 }); }
  crackT -= dt;
  if (crackT <= 0) { crackT = rnd(0.05, 0.3); if (env.fire > 0.05) noise({ f: rnd(1500, 4000), q: 4, dur: 0.03, vol: 0.07 * env.fire, dest: ambBus, pan: rnd(-0.3, 0.3) }); }
  howlT -= dt;
  if (howlT <= 0) { howlT = rnd(25, 60); if (env.day < 0.3 && env.wolves) snd.howl(rnd(-0.7, 0.7)); }
}
function bird() {
  const kind = Math.floor(Math.random() * 3), pan = rnd(-0.9, 0.9), base = rnd(2200, 3600), n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    if (kind === 0) tone({ f: base, f2: base * rnd(1.2, 1.5), dur: 0.08, vol: 0.02, dest: ambBus, pan, t: i * 0.11 });
    else if (kind === 1) tone({ f: base * 1.3, f2: base * 0.8, dur: 0.14, vol: 0.018, dest: ambBus, pan, t: i * 0.2 });
    else { tone({ f: base, dur: 0.05, vol: 0.02, dest: ambBus, pan, t: i * 0.07 }); tone({ f: base * 1.19, dur: 0.05, vol: 0.02, dest: ambBus, pan, t: i * 0.07 + 0.035 }); }
  }
}

// ---------- music: generative lyre + drone in D Dorian ----------
const D = 146.83, ST = (n) => D * Math.pow(2, n / 12);
const CHORDS = [[0, 7, 12, 15], [-2, 5, 10, 14], [5, 12, 17, 21], [0, 7, 12, 15], [3, 10, 15, 19], [-2, 5, 10, 14], [-5, 2, 7, 10], [0, 7, 12, 15]];   // Dm C G Dm F C Am Dm
const MEL = [0, 3, 5, 7, 10, 12, 14, 15, 17, 19];                                                                                 // D Dorian pentatonic-ish
let mood = 'title', moodW = { pad: 0.5, dens: 0.8, oct: 1, tempo: 64 }, bar = 0, nextT = 0, pad = null, lastNote = 5;
const MOODS = { title: { pad: 0.9, dens: 0.9, oct: 1, tempo: 60 }, cine: { pad: 1, dens: 0.75, oct: 1, tempo: 56 }, explore: { pad: 0.45, dens: 0.42, oct: 1, tempo: 66 },
  night: { pad: 0.55, dens: 0.22, oct: 0.5, tempo: 50 }, cave: { pad: 0.7, dens: 0.12, oct: 0.5, tempo: 44 } };
export function setMood(m) { if (m === mood || !MOODS[m]) return; mood = m; moodW = MOODS[m]; }
function makePad() {
  const g = ctx.createGain(); g.gain.value = 0; const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; fl.Q.value = 0.4; fl.connect(g); g.connect(musicBus);
  const sg = ctx.createGain(); sg.gain.value = 0.5; g.connect(sg).connect(verbSend);
  const oscs = []; for (let i = 0; i < 6; i++) { const o = ctx.createOscillator(); o.type = i % 2 ? 'sawtooth' : 'triangle'; o.detune.value = rnd(-8, 8); const og = ctx.createGain(); og.gain.value = i % 2 ? 0.05 : 0.09; o.connect(og).connect(fl); o.start(); oscs.push(o); }
  return { g, fl, oscs };
}
function scheduleMusic() {
  if (!ctx) return;
  if (!pad) pad = makePad();
  if (nextT < now()) nextT = now() + 0.1;
  while (nextT < now() + 1.2) {
    const beat = 60 / moodW.tempo, ch = CHORDS[bar % CHORDS.length], t0 = nextT;
    // pad: retune on each bar, gentle swell
    ch.slice(0, 3).forEach((n, i) => { pad.oscs[i * 2].frequency.setTargetAtTime(ST(n - 12) * (i === 0 ? 1 : 1), t0, 0.4); pad.oscs[i * 2 + 1].frequency.setTargetAtTime(ST(n - 12) * 1.002, t0, 0.4); });
    pad.g.gain.setTargetAtTime(0.12 * moodW.pad, t0, 1.5);
    pad.fl.frequency.setTargetAtTime(mood === 'cave' ? 380 : 600 + Math.sin(bar * 0.7) * 200, t0, 1.5);
    // lyre: arpeggio on the chord, then a short melodic phrase over it
    for (let b = 0; b < 8; b++) {
      if (Math.random() < moodW.dens * (b % 2 ? 0.55 : 0.9)) pluck(ST(ch[b % 4]) * moodW.oct, t0 + b * beat / 2 + rnd(0, 0.015), (b === 0 ? 1 : 0.65) * (mood === 'cave' ? 0.6 : 1));
      if (Math.random() < moodW.dens * 0.45) { lastNote = Math.max(0, Math.min(MEL.length - 1, lastNote + Math.round(rnd(-2.4, 2.4)))); pluck(ST(MEL[lastNote] + 12) * moodW.oct, t0 + b * beat / 2 + beat / 4, 0.55); }
    }
    if (bar % 4 === 0) tone({ f: ST(ch[0] - 24) * 2, dur: beat * 6, vol: 0.05 * moodW.pad, type: 'sine', att: 0.4, dest: musicBus, t: t0 - now() });   // bass
    nextT += beat * 4; bar++;
  }
  setTimeout(scheduleMusic, 300);
}
