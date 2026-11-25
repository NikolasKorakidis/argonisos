// Sound: the team's recordings where there are some (tools/assets/sounds.mjs: footsteps on each ground, every blow, cut
// and knock of the fighting, gathering and building, the fire, the bosses, thunder, and the world's beds of rain, wind,
// leaves, birds, crickets, frogs and waves), and WebAudio synthesis for the rest (and for everything, if the pack isn't
// there). A sound with recordings plays one of them at random, never the same one twice running, a little higher or
// lower and louder or softer each time.
//   Where things are: a sound from a place in the world (at) comes from its side and falls away with distance, the air
//   taking its highs first, a little more of them from behind you (the listener is the camera: listen()); a long one
//   (a roar, a tree falling) follows its source and your turning while it lasts. Indoors and in caves the world outside
//   comes muffled (a lowpass on the ambience) and the room rings: a stone hall's reverb blended in by place (PLACE, from
//   music.js: the Giants' caves, the labyrinth, inside a house), the open air's soft one outside.
//   Mix: effects, ambience and music each on a bus of their own (the settings' sliders). Only the effects are glued by a
//   gentle compressor (the music and the beds don't pump under the blows), its own makeup gain divided out; then one
//   level for everything (LEVEL) and a true brickwall limiter at -1 dBFS on the master, a lookahead peak limiter in an
//   AudioWorklet (Chrome's compressor as one, its makeup divided out, until it loads or where there are no worklets). The
//   music (music.js) dips under loud thunder and the bosses' big warnings (duck).
//   Ambience follows the world (updateAmbience): rain in layers (droplets in a light rain, a downpour in a heavy one, the
//   drumming on a roof over you and the hush through the walls indoors), the wind by its strength with gusts on the wind's
//   own gusts, quieter in fog and stronger high on Olympos, the wind in the meadow's grass and in the woods' leaves, waves
//   near the shore, birdsong by day with a dawn chorus at sunrise (none in the rain), each land's crickets by night,
//   frogs by the marsh, an owl now and then and a fox far off; each lit fire near you crackles where it burns (fires()),
//   and meat sizzles on a cooking stand over one. The beds load when first wanted, run as two copies a little apart (a short recording's loop
//   isn't heard), and are let go of once they've long been silent; the synthesised ones likewise.
//   Music: the team's tracks (music.js); a sparse lyre in an old Greek mode stands in for them without the pack.
//   A boss fight (setFight, from music.js while a boss's track plays): its music comes up over the storm, the loudest of
//   the music and level with the blows, and dips less under thunder; the world's ambience goes down under it; the giants'
//   roars, steps, slams and fire are layered with a deep synthesised boom (sub) you feel more than hear.
let ctx = null, out = null, mix = null, sfxSend = null, ambSend = null, level = null, comp = null, compT = null, lim = null, limT = null, stunF = null, sfxBus = null, ambBus = null, ambW = null, musicBus = null, recBus = null, duckG = null, fightG = null, verb = null, airOut = null, hallOut = null, noiseBuf = null, brownBuf = null;
let volume = 0.8, musicVol = 0.5, sfxVol = 1, ambVol = 1, fightK = 0;
// (one gain for the whole mix before the limiter: what the old shared compressors' hidden makeup gain gave everything,
// about +6.8 dB, now in sight, so the world, the effects and the music are as loud as they were outside a fight)
const LEVEL = 2.2;
// (in a boss fight: the music's gain, the ambience's, the effects', and how much of its usual dip under thunder the
// music keeps. Patch 23: the boss's heavy track loud and clear over its storm, a few LU over the world and level with
// the blows, the whole fight about -15 LUFS (it was -10.6), the music hardly dipping under the bolts falling all round)
const FIGHT = { music: 1.6, amb: 0.22, sfx: 0.36, duck: 0.15 };
const REC_MUSIC = 0.9;   // (the recorded music's level under the slider: music.js tracks are mastered louder than the beds)
// Patch 25, by a reviewer's ear: the hero's footsteps at half their loudness (-6 dB) on every ground and at every gait,
// the camera's distance still taking its share; the wind's beds (the grass's too) and its gusts 30% under (-3 dB), not
// the storm wall's roar. Kept apart here so the tests can weigh the mix with and without them.
export const MIX = { step: 0.5, wind: 0.7 };
export function setVolume(v) { volume = v; if (out) out.gain.value = v; }
export function setMusicVolume(v) { musicVol = v; if (musicBus) { musicBus.gain.value = 0.55 * v; recBus.gain.value = REC_MUSIC * v; } }
export function setSfxVolume(v) { sfxVol = v; if (sfxBus) sfxBus.gain.value = sfxSend.gain.value = 0.9 * v * (1 - (1 - FIGHT.sfx) * fightK); }
export function setAmbienceVolume(v) { ambVol = v; if (ambBus) ambBus.gain.value = ambSend.gain.value = v * (1 - (1 - FIGHT.amb) * fightK); }
// a boss fight on (1) or off (0): eased over a second or two
export function setFight(k) {
  if (k === fightK || !ctx) { fightK = k; return; } fightK = k; const t = now();
  fightG.gain.setTargetAtTime(1 + (FIGHT.music - 1) * k, t, k ? 0.6 : 1.5); for (const n of [ambBus, ambSend]) n.gain.setTargetAtTime(ambVol * (1 - (1 - FIGHT.amb) * k), t, 0.8); for (const n of [sfxBus, sfxSend]) n.gain.setTargetAtTime(0.9 * sfxVol * (1 - (1 - FIGHT.sfx) * k), t, 0.8);
}
// Where the listener is, from music.js each frame (it watches the world for the music): in a cave (0..1), in a stone hall
// (the labyrinth's walls round you), indoors in a house, how high (m), how thick the fog, the morning or the evening, on
// Olympos's snow, in the marsh, the player's place, and the cooking stands sizzling near ([{ id, x, y, z, k }])
export const PLACE = { cave: 0, hall: 0, house: 0, alt: 0, fog: 0, morning: true, snow: false, marsh: 0, x: 0, z: 0, cook: [] };
// how the hero moves, from player.js: the footsteps' loudness by gait (sneaking, walking, sprinting), how fast the last
// fall came down (m/s, for the landing)
export const GAIT = { k: 1, fall: 8 };
const amb = {};
const rnd = (a, b) => a + Math.random() * (b - a), sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

function makeNoise(seconds, brown) {
  const b = ctx.createBuffer(2, ctx.sampleRate * seconds, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let l = 0, p1 = 0, p2 = 0;
    for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else { p1 = 0.97 * p1 + 0.03 * w; p2 = 0.6 * p2 + 0.4 * w; d[i] = (w * 0.5 + p1 * 2 + p2 * 0.3) * 0.6; } } }
  return b;
}
// a generated reverb: decaying noise, darker in the tail (dark: how fast the highs go), with a few early reflections off
// near walls for a stone room (early: how strong)
function makeVerb(seconds = 2.8, { dark = 0.45, early = 0, pow = 2.4 } = {}) {
  const sr = ctx.sampleRate, n = sr * seconds, b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); let lp = 0; for (let i = 0; i < n; i++) { const k = i / n; lp += (Math.random() * 2 - 1 - lp) * (0.6 - k * dark); d[i] = lp * Math.pow(1 - k, pow) * (i < 200 ? i / 200 : 1); }
    if (early) for (let j = 0; j < 9; j++) { const at = Math.floor(sr * (0.007 + j * rnd(0.006, 0.011) + ch * 0.0023)); if (at < n) d[at] += early * (1 - j / 10) * (Math.random() < 0.5 ? -1 : 1); } }
  const c = ctx.createConvolver(); c.buffer = b; return c;
}
// Chrome's compressor adds a makeup gain of its own that can't be turned off: measured once (a quiet constant through a
// copy of it, offline) and divided out after it
function makeupOf(set) {
  try { const o = new OfflineAudioContext(1, 4096, 44100), s = o.createConstantSource(), c = o.createDynamicsCompressor(); s.offset.value = 0.001; set(c); s.connect(c).connect(o.destination); s.start();
    return o.startRendering().then((b) => { const d = b.getChannelData(0); return Math.max(0.5, d[d.length - 1] / 0.001); }).catch(() => 1); } catch { return Promise.resolve(1); }
}
const glue = (c) => { c.threshold.value = -20; c.knee.value = 8; c.ratio.value = 2.5; c.attack.value = 0.006; c.release.value = 0.18; };
const asLimiter = (c) => { c.threshold.value = -2; c.knee.value = 0; c.ratio.value = 20; c.attack.value = 0.001; c.release.value = 0.12; };
// The master's brickwall: each sample's peak (both channels) sets the gain it needs to stay under the ceiling (-1 dBFS);
// that is held for the lookahead (5 ms) and averaged over it, and the sound delayed by as much, so the gain is already down
// when the peak arrives (no sample over, no click); it lets go over about 120 ms. A last clamp catches the rounding.
const LIMITER = `class L extends AudioWorkletProcessor {
  constructor() { super(); this.n = Math.max(8, Math.round(sampleRate * 0.005)); this.c = Math.pow(10, -1 / 20); this.rel = 1 - Math.exp(-1 / (sampleRate * 0.12)); this.dl = [new Float32Array(this.n), new Float32Array(this.n)]; this.gs = new Float32Array(this.n).fill(1); this.i = 0; this.hold = 1; this.ht = 0; }
  process(ins, outs) { const x = ins[0], y = outs[0]; if (!x || !x.length) return true; const L0 = x[0], R0 = x[1] || x[0], oL = y[0], oR = y[1] || y[0], n = this.n, c = this.c; let sum = 0; for (let j = 0; j < n; j++) sum += this.gs[j];
    for (let k = 0; k < L0.length; k++) { const pk = Math.max(Math.abs(L0[k]), Math.abs(R0[k])), req = pk > c ? c / pk : 1;
      if (req <= this.hold) { this.hold = req; this.ht = n; } else if (this.ht > 0) this.ht--; else this.hold = Math.min(req, this.hold + (1 - this.hold) * this.rel);
      const i = this.i; sum += this.hold - this.gs[i]; this.gs[i] = this.hold; const g = sum / n, a = this.dl[0][i], b = this.dl[1][i]; this.dl[0][i] = L0[k]; this.dl[1][i] = R0[k]; this.i = (i + 1) % n;
      oL[k] = Math.max(-c, Math.min(c, a * g)); if (oR !== oL) oR[k] = Math.max(-c, Math.min(c, b * g)); }
    return true; } }
registerProcessor('ag-limiter', L);`;
function loadLimiter() {
  if (!ctx.audioWorklet) return; const url = URL.createObjectURL(new Blob([LIMITER], { type: 'application/javascript' }));
  ctx.audioWorklet.addModule(url).then(() => { const w = new AudioWorkletNode(ctx, 'ag-limiter', { outputChannelCount: [2] }); level.disconnect(); level.connect(w).connect(out); lim.disconnect(); limT.disconnect(); AUDIO.limiter = 'worklet'; }).catch(() => {}).finally(() => URL.revokeObjectURL(url));
}
function init() {
  if (ctx) return true;
  try {
    ctx = new AudioContext();
    // the master: every bus into one mix, the stun's muffle (open until a roar stuns you, daze()), the level, the limiter
    mix = ctx.createGain(); stunF = ctx.createBiquadFilter(); stunF.type = 'lowpass'; stunF.frequency.value = 22000; stunF.Q.value = 0.5; level = ctx.createGain(); level.gain.value = LEVEL;
    lim = ctx.createDynamicsCompressor(); asLimiter(lim); limT = ctx.createGain(); limT.gain.value = 0.9; makeupOf(asLimiter).then((m) => { limT.gain.value = 1 / m; });
    out = ctx.createGain(); out.gain.value = volume; mix.connect(stunF).connect(level).connect(lim).connect(limT).connect(out).connect(ctx.destination); loadLimiter();
    // the reverbs (verb is their send): the open air's soft hall, and a stone hall's, brighter and ringing with early
    // reflections, blended by place (room())
    verb = ctx.createGain(); const air = makeVerb(), hall = makeVerb(3.4, { dark: 0.3, early: 0.5, pow: 1.9 }); airOut = ctx.createGain(); airOut.gain.value = 0.5; hallOut = ctx.createGain(); hallOut.gain.value = 0;
    verb.connect(air).connect(airOut).connect(mix); verb.connect(hall).connect(hallOut).connect(mix);
    // (the effects' and the ambience's sends to them under their own bus's gain, so the sliders and the fight's mix
    // turn their echo down with them)
    sfxSend = ctx.createGain(); sfxSend.gain.value = 0.9 * sfxVol; sfxSend.connect(verb); ambSend = ctx.createGain(); ambSend.gain.value = ambVol; ambSend.connect(verb);
    // (the effects glued by their own compressor, its makeup divided out)
    comp = ctx.createDynamicsCompressor(); glue(comp); compT = ctx.createGain(); compT.gain.value = 0.6; makeupOf(glue).then((m) => { compT.gain.value = 1 / m; });
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9 * sfxVol; sfxBus.connect(comp).connect(compT).connect(mix);
    // (the ambience: the world's beds through ambW, muffled indoors, then the slider; the fires near you straight in)
    ambBus = ctx.createGain(); ambBus.gain.value = ambVol; ambBus.connect(mix); ambW = ctx.createBiquadFilter(); ambW.type = 'lowpass'; ambW.frequency.value = 20000; ambW.Q.value = 0.5; ambW.connect(ambBus);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55 * musicVol; musicBus.connect(mix); const mv = ctx.createGain(); mv.gain.value = 0.7; musicBus.connect(mv).connect(verb);
    // (the recorded music, dry, under the slider and the duck that lowers it under loud thunder)
    recBus = ctx.createGain(); recBus.gain.value = REC_MUSIC * musicVol; duckG = ctx.createGain(); fightG = ctx.createGain(); fightG.gain.value = 1 + (FIGHT.music - 1) * fightK; recBus.connect(duckG).connect(fightG).connect(mix);
    noiseBuf = makeNoise(4, false); brownBuf = makeNoise(4, true);
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
// (a gain or a filter eased to v, only when it's to change by more than 1%: most beds hold still most frames)
const ease = (prm, v, tc, t = now()) => { if (prm._to === undefined || Math.abs(prm._to - v) > Math.max(1e-4, Math.abs(v) * 0.01)) { prm.setTargetAtTime(v, t, tc); prm._to = v; } };

// ---- recordings (tools/assets/sounds.mjs: assets/sounds/pack/<key>_<n>.mp3; sounds.json says how many of each, which
// are beds, where each one-shot's sound starts in earnest, and what music there is)
const META = {}, BUF = {}, LOADING = {}, LAST = {}, STARTED = {}, SND = new URL('../../assets/sounds/pack/', import.meta.url);
// The first packs' sounds that the team's replace (never played while those are there: not loaded), and the long one-shots
// loaded the first time they're wanted rather than at start (a moment late the first time, if at all)
const REPLACED = { door: 'doorOpen', foliage: 'hitPlant', thunder: 'thunderNear', creak: 'chestOpen' }, LAZY = new Set(['revealChime', 'windGust', 'bossRoarLong', 'thunderFar']);
// For the tests and the mix: log (an array, when set) gets every recording started ({ k, i, t, vol, bus }, beds and fires
// too), calls every sound asked for ({ k: its name, t }, recorded or synthesised); meters() hangs analysers on the buses
// and the output and returns how loud each is now (LUFS, near enough, and the peak, dBFS)
export const AUDIO = { log: null, calls: null, ready: false, limiter: 'compressor', music: {}, META, PLACE, has: (k) => !!BUF[k]?.some(Boolean), ctx: () => ctx, musicOut: () => (ctx ? { ctx, bus: recBus } : null), meters: null };
async function loadBank() {
  let meta;
  try { meta = await (await fetch(new URL('sounds.json', SND))).json(); }
  catch { try { const idx = await (await fetch(new URL('index.json', SND))).json(); meta = { sfx: Object.fromEntries(Object.entries(idx).map(([k, n]) => [k, { n, loop: k.startsWith('loop') }])), music: {} }; } catch { return; } }   // (an older pack: index.json only)
  Object.assign(META, meta.sfx); Object.assign(AUDIO.music, meta.music || {});
  // the one-shots now (they're short, and a blow mustn't wait for its sound); the beds when first wanted (bed())
  await Promise.all(Object.entries(META).filter(([k, m]) => !m.loop && !LAZY.has(k) && !META[REPLACED[k]]).map(([k, m]) => loadKey(k, m)));
  AUDIO.ready = true;
}
const fetchOne = (k, i) => (LOADING[k + '_' + i] ||= fetch(new URL(`${k}_${i}.mp3`, SND)).then((r) => r.arrayBuffer()).then((b) => ctx.decodeAudioData(b)).then((d) => { (BUF[k] ||= [])[i] = d; return d; }).catch(() => null));
const loadKey = (k, m = META[k]) => Promise.all([...Array(m?.n || 0)].map((_, i) => fetchOne(k, i)));
const unload = (k, i) => { if (BUF[k]) BUF[k][i] = null; delete LOADING[k + '_' + i]; };
// which recording of a sound to play: any but the last one played
function variant(k) {
  const list = BUF[k]; if (!list) return -1; const ok = []; for (let i = 0; i < list.length; i++) if (list[i]) ok.push(i);
  if (!ok.length) return -1; let i = ok[Math.floor(Math.random() * ok.length)]; if (ok.length > 1) while (i === LAST[k]) i = ok[Math.floor(Math.random() * ok.length)];
  LAST[k] = i; return i;
}
// ---- the listener (the camera) and where a sound comes from: its share of loudness (k: full within near, falling to
// none by far), its side (pan) and how much of its highs the air has taken (lp: more from behind you); indoors (shut)
// what's outside is muffled
const L = { x: 0, y: 0, z: 0, fx: 0, fz: -1 };
export function listen(p, f) { L.x = p.x; L.y = p.y; L.z = p.z; const n = Math.hypot(f.x, f.z) || 1; L.fx = f.x / n; L.fz = f.z / n; }
function spatial(at, near = 3, far = 50) {
  const dx = at.x - L.x, dy = (at.y ?? L.y) - L.y, dz = at.z - L.z, d = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dz) || 1, k = Math.max(0, 1 - Math.max(0, d - near) / (far - near));
  const behind = Math.max(0, -(dx * L.fx + dz * L.fz) / h) * Math.min(1, d / 4);
  return { d, k: k * k, pan: Math.max(-0.85, Math.min(0.85, (dx * -L.fz + dz * L.fx) / h * Math.min(1, d / 2))), lp: Math.max(900, 20000 * Math.exp(-d / 70)) * (d > 5 ? 1 - shut * 0.6 : 1) * (1 - 0.25 * behind) };
}
// the room's ring (0 out of doors, 1 in a cave): every send a little wetter, and even the dry ones (the steps) a little
let roomK = 0;
const wetOf = (wet, bus) => (bus === ambBus || bus === ambW ? wet : wet * (1 + roomK) + roomK * 0.12), sendOf = (bus) => (bus === ambBus || bus === ambW ? ambSend : bus === sfxBus ? sfxSend : verb);
// the long sounds playing from a place: they follow it (at may be a moving creature's position) and your turning
const LIVE = new Set();
function follow() {
  const t = now(); for (const o of LIVE) { if (t > o.end) { LIVE.delete(o); continue; } const s = spatial(o.at, o.near, o.far);
    if (!o.fade) o.g.gain.setTargetAtTime(o.v * s.k, t, 0.12); o.p.pan.setTargetAtTime(s.pan, t, 0.12); o.f.frequency.setTargetAtTime(Math.min(o.cut, s.lp), t, 0.15); }
}
// One of a sound's recordings (false if it has none, so the synthesis plays instead). vol: its loudness, a tenth more
// or less each time; rate: [low, high] (or one rate); at: where in the world it comes from (near, far: how it falls
// away); from: a point into it (seconds, or 'onset': just before its sound starts in earnest, so a far one lands when
// its delay says); gap: the same sound started again within this many seconds is let be (one blow, one sound); dur: cut
// short after so long (faded); fade: let die away over its length (a dying roar).
function play(k, o = {}) {
  const { vol = 0.5, rate = [0.95, 1.05], at, near, far, wet = 0.05, bus, delay = 0, from = 0, lp = 0, gap = 0.05, out, dur, fade } = o; let pan = o.pan || 0;
  if (!ctx) return false;
  if (!BUF[k]?.some(Boolean)) {   // (a long one not loaded yet: loaded now and played when it's in, if that's soon enough)
    if (!META[k] || META[k].loop || (!LAZY.has(k) && !META[REPLACED[k]])) return false; const t0 = now() + delay;
    loadKey(k).then(() => { const late = now() - t0; if (late < 0.6 && BUF[k]?.some(Boolean)) play(k, { ...o, delay: Math.max(0, -late) }); }); return true;
  }
  const t = now() + delay; if (Math.abs(t - (STARTED[k] ?? -9)) < gap) return true;
  let v = vol * rnd(0.9, 1.1), cut = lp || 22000, sp = null;
  if (at) { sp = spatial(at, near, far); if (sp.k < 0.002) return true; pan = sp.pan; cut = Math.min(cut, sp.lp); }
  const i = variant(k); if (i < 0) return false; STARTED[k] = t;
  const s = ctx.createBufferSource(), g = ctx.createGain(), p = ctx.createStereoPanner(), r = Array.isArray(rate) ? rnd(rate[0], rate[1]) : rate; s.buffer = BUF[k][i]; s.playbackRate.value = r;
  g.gain.value = v * (sp ? sp.k : 1); p.pan.value = pan; let n = s, f = null;
  if (cut < 20000 || at) { f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.min(cut, 22000); f.Q.value = 0.5; n = n.connect(f); }
  const dest = bus === ambBus ? ambW : bus || sfxBus, w0 = wetOf(wet, dest);
  n.connect(g).connect(p).connect(dest); if (w0) { const w = ctx.createGain(); w.gain.value = w0; p.connect(w).connect(sendOf(dest)); }
  const off = from === 'onset' ? Math.max(0, (META[k]?.onset?.[i] ?? 0.05) - 0.05) : from, len = (s.buffer.duration - off) / r;
  s.start(t, Math.min(off, Math.max(0, s.buffer.duration - 0.05))); if (out) out.s = s;
  if (fade) { g.gain.setValueAtTime(g.gain.value, t + 0.2); g.gain.exponentialRampToValueAtTime(0.0001, t + Math.min(len, dur || 1e9)); }
  else if (dur && dur < len) { g.gain.setValueAtTime(g.gain.value, t + dur - 0.12); g.gain.linearRampToValueAtTime(0, t + dur); }
  if (dur && dur < len) s.stop(t + dur + 0.02);
  if (at && len > 2) LIVE.add({ at, near, far, v, g, p, f, cut: lp || 22000, fade, end: t + Math.min(len, dur || 1e9) });
  AUDIO.log?.push({ k, i, t, vol: +(v * (sp ? sp.k : 1)).toFixed(3), bus: bus === ambBus ? 'amb' : bus === musicBus ? 'music' : 'sfx' });
  return true;
}
// the old helpers (the first packs' sounds), now through play()
const sample = (k, { vol = 0.5, pan = 0, wet = 0.05, rate = [0.94, 1.06], bus, at, near, far, gap } = {}) => play(k, { vol, pan, wet, rate, bus, at, near, far, gap });
const sampleFar = (k, { vol = 0.5, pan = 0, wet = 0.3, rate = 1, delay = 0, lp = 20000, bus, from = 0 } = {}) => play(k, { vol, pan, wet, rate, delay, lp, bus, from, gap: 0 });
// One shot of filtered noise. wet: how much goes to the reverb; pan: -1 left … 1 right
function noise(dur, { type = 'bandpass', freq = 1000, q = 1, vol = 0.3, attack = 0.005, slide = 0, delay = 0, wet = 0.1, pan = 0, bus, brown } = {}) {
  if (!init()) return; const t = now() + delay, s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.playbackRate.value = 0.85 + Math.random() * 0.3;
  const f = ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (slide) f.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur); f.Q.value = q;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const dest = bus === ambBus ? ambW : bus || sfxBus, w0 = wetOf(wet, dest), p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); s.connect(f).connect(g).connect(p); p.connect(dest); if (w0) { const w = ctx.createGain(); w.gain.value = w0; p.connect(w).connect(sendOf(dest)); }
  s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
}
function tone(freq, dur, { type = 'sine', vol = 0.2, slide = 0, attack = 0.005, delay = 0, wet = 0.15, pan = 0, bus, release } = {}) {
  if (!init()) return; const t = now() + delay, o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + (release ?? dur));
  const dest = bus === ambBus ? ambW : bus || sfxBus, w0 = wetOf(wet, dest), p = ctx.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, pan)); o.connect(g).connect(p); p.connect(dest); if (w0) { const w = ctx.createGain(); w.gain.value = w0; p.connect(w).connect(sendOf(dest)); }
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
// a plucked string: a bright attack that darkens as it rings (the lyre on the music bus; bus: another, the guide's chime
// on the effects', so it's heard with the music turned off)
function pluck(freq, { vol = 0.12, delay = 0, dur = 2.6, pan = 0, bus = musicBus } = {}) {
  if (!init()) return; const t = now() + delay;
  const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(); o1.type = 'triangle'; o2.type = 'sawtooth'; o1.frequency.value = freq; o2.frequency.value = freq * 1.002;
  const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 2; f.frequency.setValueAtTime(freq * 9, t); f.frequency.exponentialRampToValueAtTime(freq * 1.3, t + dur * 0.6);
  const g = ctx.createGain(), g2 = ctx.createGain(); g2.gain.value = 0.25; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  const p = ctx.createStereoPanner(); p.pan.value = pan; o1.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(p).connect(bus); if (bus !== musicBus) { const w = ctx.createGain(); w.gain.value = 0.3; p.connect(w).connect(sendOf(bus)); }
  o1.start(t); o1.stop(t + dur + 0.1); o2.start(t); o2.stop(t + dur + 0.1);
}
// Stunned (a boss's roar): for secs everything comes muffled, as through stopped ears, with a thin ringing over it,
// opening out again over the last of it
export function daze(secs = 2) {
  if (!stunF) return; const t = now(); stunF.frequency.cancelScheduledValues(t); stunF.frequency.setValueAtTime(stunF.frequency.value, t); stunF.frequency.exponentialRampToValueAtTime(420, t + 0.12);
  stunF.frequency.setValueAtTime(420, t + secs * 0.6); stunF.frequency.exponentialRampToValueAtTime(22000, t + secs + 0.4);
  tone(3150, secs + 0.6, { type: 'sine', vol: 0.022, attack: 0.15, wet: 0.2, release: secs + 0.6 }); tone(3190, secs * 0.8, { type: 'sine', vol: 0.012, attack: 0.3, wet: 0.2 });
}
// The music dips under loud thunder (k: how loud, 0..1; at: seconds from now, a far strike's delay) and comes back over a
// few seconds (in a boss fight it hardly dips, unless it's a boss's own warning: warn, dipping it some 3 dB for hold
// seconds). Every dip asked for is kept (DIPS) and the gain scheduled afresh from them, each moment the deepest of those
// under way, so a near strike asked for after a far one doesn't wipe out the far one's dip.
const DIPS = [];
export function duck(k, at = 0, { hold = 1.2, warn = false } = {}) {
  if (!duckG || k < 0.05) return; const t0 = now(), a = t0 + at, d = warn ? 1 - Math.min(0.5, k * 0.3) : 1 - Math.min(0.55, k * 0.6) * (1 - (1 - FIGHT.duck) * fightK);
  for (let i = DIPS.length - 1; i >= 0; i--) if (DIPS[i].b + 4 < t0) DIPS.splice(i, 1); DIPS.push({ a, b: a + hold, d });
  const P = duckG.gain; P.cancelScheduledValues(t0); P.setValueAtTime(P.value, t0);
  const at_ = (x) => DIPS.reduce((m, q) => (q.a <= x && x < q.b ? Math.min(m, q.d) : m), 1);
  for (const x of [...new Set(DIPS.flatMap((q) => [q.a, q.b]))].filter((x) => x >= t0).sort((p, q) => p - q)) { const v = at_(x); P.setTargetAtTime(v, x, v < 1 ? 0.08 : 1.4); }
  if (at_(t0) < 1) P.setTargetAtTime(at_(t0), t0, 0.08);
}

// the recordings for each ground the feet can be on (game.js: the boards of a building, water, paving or bare rock, the
// shore's sand, the forest's leaf litter; anything else is the meadows' grass and earth, the marsh's mud, Olympos's snow)
const STEPS = { wood: 'stepWood', water: 'stepWater', stone: 'stepRock', sand: 'stepSand', leaves: 'stepLeaves', snow: 'stepSnow', mud: 'stepMud' }, LANDS = { wood: 'landWood', water: 'landWater', stone: 'landRock', sand: 'landSand', snow: 'landSnow', mud: 'landMud' };
// (the ground under the feet: the snow on Olympos's head, the marsh's mud; the meadows' earth grass or bare by patches
// of some metres, not at random each step)
const ground = (s) => (PLACE.snow && (s === 'ground' || s === 'stone' || s === 'leaves') ? 'snow' : s === 'ground' && PLACE.marsh > 0.5 ? 'mud' : s === 'ground' ? (hashStr(`${Math.floor(PLACE.x / 7)},${Math.floor(PLACE.z / 7)}`) % 10 < 6 ? 'grass' : 'dirt') : s);
// Each creature's voice and what its body is made of (the blows land on flesh, bone or wood): a cry as it notices you,
// from the team's or the first packs' recordings at its own pitch, until it has recordings of its own
const VOICE = {
  hog: { cry: ['growl', [1.45, 1.6], 0.5], mat: 'flesh' }, giant: { cry: ['giantCall', [0.62, 0.7], 0.75], mat: 'flesh', big: true },
  dryad: { cry: ['enemyAlert', [1.12, 1.2], 0.5], mat: 'wood' }, dryadling: { cry: ['enemyAlert', [1.3, 1.4], 0.4], mat: 'wood' },
  skeleton: { cry: ['enemyAlert', [0.82, 0.88], 0.45], mat: 'bone', rattle: true },
  deer: { mat: 'flesh' }, fox: { mat: 'flesh' }, rabbit: { mat: 'flesh', small: true }, minotaur: { mat: 'flesh', big: true }, chimera: { mat: 'flesh', big: true },
};
// a weapon's swing, by how heavy it is: the whoosh's pace and loudness (fists and daggers quick and light, maces slow)
const SWING = { unarmed: [1.35, 0.22], dagger: [1.25, 0.3], spear: [1.05, 0.34], sword: [1.05, 0.34], axe: [0.92, 0.38], mace: [0.78, 0.42], club: [0.8, 0.4], tool: [0.95, 0.32], bow: [1.1, 0.2] };
let alertAt = -99;
const note = (k, v = 1) => AUDIO.log?.push({ k, i: -1, t: now(), vol: +(+v).toFixed(3), bus: 'sfx' });   // (a synthesised sound, noted for the tests)
const SFX = {
  // a footstep (k: how near the camera is, game.js: a close camera hears them at full, a far one at a quarter; louder
  // sprinting, softer sneaking: GAIT; all of it under MIX.step)
  step: (surface, k = 1) => {
    k *= MIX.step; const s = ground(surface), v = 0.32 * k * GAIT.k, wet = s === 'wood' || s === 'stone' ? 0.04 : 0;
    if (sample(STEPS[s] || (s === 'dirt' ? 'stepDirt' : 'stepGrass'), { vol: v, wet, rate: GAIT.k > 1.1 ? [0.97, 1.1] : [0.94, 1.06] })) return;
    if (s === 'wood') { noise(0.1, { freq: 420, q: 3, vol: 0.13 * k }); tone(140, 0.08, { type: 'triangle', vol: 0.05 * k, wet: 0.2 }); }
    else if (s === 'water' || s === 'mud') { noise(0.28, { type: 'lowpass', freq: 1200, vol: 0.14 * k, slide: -800 }); noise(0.12, { freq: 2500, q: 2, vol: 0.05 * k, delay: 0.05 }); }
    else if (s === 'stone') noise(0.07, { freq: 1800, q: 1.5, vol: 0.09 * k });
    else { noise(0.12, { type: 'lowpass', freq: 380, vol: 0.12 * k, brown: true }); noise(0.16, { freq: 3200, q: 0.7, vol: 0.035 * k }); }   // a soft thud and the swish of grass
  },
  jump: () => noise(0.14, { freq: 500, vol: 0.06 }),
  // landing, by how hard the fall came down (GAIT.fall: m/s; a hop softly, a long drop heavily, lower and with a thud)
  land: (surface, k = 1) => { const s = ground(surface), h = Math.min(1.6, Math.max(0.6, GAIT.fall / 8));
    if (sample(LANDS[s] || 'landGrass', { vol: 0.42 * k * h, wet: 0.02, rate: [1.02 - h * 0.1, 1.08 - h * 0.1] })) { if (h > 1.15) noise(0.3, { type: 'lowpass', freq: 220, vol: 0.3 * (h - 1) * k, brown: true, wet: 0.1 }); return; }
    noise(0.22, { type: 'lowpass', freq: 260, vol: 0.28 * k * h, brown: true }); noise(0.1, { freq: 2800, q: 0.8, vol: 0.05 * k }); },
  // the dodge roll: the body and cloth going over in the grass, the shoulder and then the feet coming down
  roll: (surface, k = 1) => { const s = ground(surface || 'ground'); note('roll', k);
    if (!play('roll', { vol: 0.42 * k, wet: 0.03, rate: [1.1, 1.25], dur: 0.7 })) noise(0.45, { freq: 1600, q: 0.6, vol: 0.12 * k, attack: 0.05, slide: -900 });
    sample(LANDS[s] || 'landGrass', { vol: 0.2 * k, rate: [1.1, 1.2], wet: 0, gap: 0 }); play(STEPS[s] || 'stepGrass', { vol: 0.24 * k, delay: 0.36, rate: [0.95, 1.05], gap: 0 }); },
  // a stroke swimming: water parted by the arms, slowed and soft
  swim: (_s, k = 1) => { note('swim', k); if (!play('swimStroke', { vol: 0.6 * k, wet: 0.05, rate: [0.62, 0.74], gap: 0.3 })) noise(0.5, { type: 'lowpass', freq: 900, vol: 0.12 * k, attack: 0.08, slide: -500 }); },
  // a swing through the air (kind: the weapon's skill or 'tool', 'unarmed'; at: a creature's, delay: when its blow comes)
  swing: ({ kind = 'unarmed', at, delay = 0, heavy } = {}) => { const [r, v] = heavy ? [0.55, 0.6] : SWING[kind] || SWING.tool; note('swing', v);
    if (play('whoosh', { vol: v, at, near: heavy ? 8 : 3, far: heavy ? 70 : 25, delay, wet: 0.04, rate: [r * 0.94, r * 1.06], gap: 0.08 })) return;
    noise(0.22 / r, { freq: 900 * r, q: 0.9, vol: v * 0.35, attack: 0.08 / r, slide: 1200 * r, delay, wet: 0.04 }); },
  // an axe in wood (p: pitch, about 1; a thin trunk or a stump rings higher, a great trunk lower; every blow a little different)
  chop: (p = 1) => { if (play('hitTree', { vol: 0.75, wet: 0.2, rate: [0.93 * p, 1.05 * p] })) return;
    p *= 0.93 + Math.random() * 0.14; noise(0.09, { freq: 1500 * p, q: 3, vol: 0.32, wet: 0.25 }); tone(170 * p, 0.14, { type: 'triangle', vol: 0.22, slide: -60 * p, wet: 0.3 }); noise(0.25, { type: 'lowpass', freq: 400 * p, vol: 0.12, brown: true }); },
  creak: () => { tone(95, 1.6, { type: 'sawtooth', vol: 0.045, slide: -30, attack: 0.4, wet: 0.4 }); tone(140, 1.2, { type: 'sawtooth', vol: 0.025, slide: 40, attack: 0.3, delay: 0.5, wet: 0.4 }); },
  thud: () => { noise(0.9, { type: 'lowpass', freq: 200, vol: 0.7, slide: -120, brown: true, wet: 0.4 }); tone(48, 0.7, { vol: 0.4, slide: -18 }); for (let i = 0; i < 6; i++) noise(0.2, { freq: 2500 + Math.random() * 2000, q: 1, vol: 0.05, delay: 0.1 + Math.random() * 0.5 }); },
  // a felled tree hitting the ground (at: where its crown lands; big: how big a tree), from just before the crash
  treeFall: ({ at, big = 1 } = {}) => { if (play('fallingTree', { vol: 0.75 * Math.min(1.2, big), at, near: 8, far: 90, wet: 0.3, rate: [0.9 / Math.sqrt(big), 1 / Math.sqrt(big)], from: 'onset' })) return; SFX.thud(); },
  // a log landing or striking something (at; k: how hard): a deep wooden thud, and from a hard one the crack of the wood
  logThud: ({ at, k = 1 } = {}) => { const s = place(at, 6, 80), v = Math.min(1.2, k) * s.k; if (v < 0.01) return; note('logThud', v);
    tone(78, 0.5, { vol: 0.22 * v, slide: -44, attack: 0.008, wet: 0.15, pan: s.pan }); noise(0.45, { type: 'lowpass', freq: rnd(270, 330), q: 0.7, vol: 0.28 * v, attack: 0.006, brown: true, wet: 0.2, pan: s.pan }); noise(0.09, { freq: rnd(560, 680), q: 2.2, vol: 0.11 * v, attack: 0.006, brown: true, pan: s.pan });
    if (k > 0.55) play('hitTree', { vol: 0.32 * Math.min(1, k), at, near: 6, far: 70, rate: [0.55, 0.65], lp: 2600, wet: 0.2, gap: 0.12 }); },
  mine: (p = 1) => { if (play('mineHit', { vol: 1.5, wet: 0.2, rate: [0.9 * p, 1.08 * p] })) return; if (sample('stoneHit', { vol: 0.5, wet: 0.2, rate: [0.88 * p, 1.1 * p] })) return;
    tone((1800 + Math.random() * 400) * p, 0.22, { type: 'triangle', vol: 0.12, slide: -400, wet: 0.35 }); noise(0.08, { freq: 2600, q: 2, vol: 0.2 }); noise(0.3, { type: 'lowpass', freq: 500, vol: 0.12, brown: true, delay: 0.03 }); },
  // the wrong tool: a dull clink off rock (the first pack's brick, high and short), or a dead knock off wood (the axe's
  // blow slowed and darkened) that does nothing
  clink: (wood) => { if (wood ? play('hitTree', { vol: 0.42, rate: [0.58, 0.66], lp: 1300, wet: 0.08, dur: 0.3 }) : play('stoneHit', { vol: 0.75, rate: [1.35, 1.5], wet: 0.12, dur: 0.35 })) return;
    if (wood) { noise(0.07, { type: 'lowpass', freq: 520, vol: 0.22, brown: true }); tone(120, 0.08, { type: 'triangle', vol: 0.08, slide: -30 }); return; }
    tone(900 + Math.random() * 200, 0.09, { type: 'triangle', vol: 0.07, slide: -250, wet: 0.15 }); noise(0.05, { freq: 1400, q: 2, vol: 0.12 }); noise(0.1, { type: 'lowpass', freq: 380, vol: 0.1, brown: true }); },
  // a bush struck: its leaves thrash (k: how hard; the team's recording, the first pack's foliage, or a burst of shaped noise)
  rustle: (k = 1) => { if (play('hitPlant', { vol: 0.62 * k, wet: 0.1, rate: [0.92, 1.1] })) return; if (sample('foliage', { vol: 0.42 * k, wet: 0.1, rate: [0.9, 1.15] })) return; noise(0.35, { freq: 3400, q: 0.6, vol: 0.14 * k, attack: 0.02, slide: -1200 }); noise(0.25, { freq: 1200, q: 0.8, vol: 0.07 * k, delay: 0.04 }); },
  // a blow landing on a creature (at: where; kind: 'axe', 'blade', or a blunt one: a club, a mace, a fist, a kick; type:
  // the creature, whose body says what's struck: flesh, or a skeleton's bones, a dryad's wood). Blunt blows have no
  // recording of their own yet: the block's wood-on-wood knock, slowed and darkened, over a thud of the body.
  hit: ({ at, kind, type } = {}) => { const mat = VOICE[type]?.mat || 'flesh', o = { at, near: 6, far: 40 };
    if (mat === 'bone') { play('blockHit', { ...o, vol: 0.5, rate: [1.25, 1.4], wet: 0.12, lp: 6000 }); SFX.boneCrumble({ at, k: 0.35, short: true }); if (kind !== 'blunt') play(kind === 'axe' ? 'axeHit' : 'swordHit', { ...o, vol: 0.28, wet: 0.08 }); return; }
    if (mat === 'wood') { play('hitTree', { ...o, vol: 0.5, rate: [1.05, 1.18], wet: 0.12 }); play('hitPlant', { ...o, vol: 0.22, rate: [1.1, 1.25], wet: 0.05, gap: 0 }); if (kind !== 'blunt') play(kind === 'axe' ? 'axeHit' : 'swordHit', { ...o, vol: 0.3, wet: 0.08 }); return; }
    const k = kind === 'axe' ? 'axeHit' : kind === 'blade' ? 'swordHit' : null; if (k && play(k, { ...o, vol: 0.6, wet: 0.12 })) return;
    const s = place(at, 6, 40); if (!k && play('blockHit', { ...o, vol: 0.55, rate: [0.74, 0.84], lp: 2400, wet: 0.1 })) { noise(0.16, { type: 'lowpass', freq: 520, vol: 0.5 * s.k, brown: true, wet: 0.1, pan: s.pan }); return; }
    noise(0.14, { type: 'lowpass', freq: 650, vol: 0.38 * s.k, brown: true, wet: 0.15, pan: s.pan }); tone(110, 0.12, { type: 'square', vol: 0.05 * s.k, slide: -40, pan: s.pan }); noise(0.05, { freq: 2200, q: 1, vol: 0.08 * s.k, pan: s.pan }); },
  // the hero hurt (voice: false for a woman: the team's cries are a man's, so she takes the blow without one)
  hurt: ({ voice = true } = {}) => { if (voice && play('hurtMale', { vol: 0.5, wet: 0.08, rate: [0.96, 1.04], gap: 0.4 })) return;
    if (!voice && AUDIO.has('hurtMale')) { noise(0.16, { type: 'lowpass', freq: 520, vol: 0.3, brown: true, wet: 0.1 }); return; }
    noise(0.22, { freq: 480, q: 1.5, vol: 0.3 }); tone(210, 0.2, { type: 'sawtooth', vol: 0.06, slide: -90 }); },
  death: ({ voice = true } = {}) => { if (voice && play('deathMale', { vol: 0.6, wet: 0.2, rate: [0.97, 1.02] })) return; tone(90, 0.8, { type: 'triangle', vol: 0.1, slide: -40, wet: 0.4 }); },
  block: () => { if (play('blockHit', { vol: 0.6, wet: 0.15 })) return; tone(380, 0.18, { type: 'square', vol: 0.07, slide: -120, wet: 0.25 }); noise(0.12, { freq: 1100, q: 2, vol: 0.22 }); },
  parry: () => { if (play('parryHit', { vol: 0.62, wet: 0.35 })) return; tone(1250, 0.6, { type: 'triangle', vol: 0.14, slide: -300, wet: 0.5 }); tone(1870, 0.5, { type: 'sine', vol: 0.06, wet: 0.5 }); noise(0.12, { freq: 3200, q: 4, vol: 0.2 }); },
  // the guard broken by a blow too heavy for it: the parry's ring cracked and low, a jolt under it
  guardBreak: () => { note('guardBreak'); if (!play('parryHit', { vol: 0.48, wet: 0.3, rate: [0.66, 0.74], gap: 0 })) noise(0.2, { freq: 900, q: 1.5, vol: 0.25 }); play('blockHit', { vol: 0.45, rate: [0.8, 0.9], gap: 0 }); sub(0.5, { f0: 70, f1: 36, k: 0.45, attack: 0.004, rumble: 0.3 }); },
  pick: () => { if (play('pickupItem', { vol: 0.42, wet: 0.03, rate: [0.94, 1.08], gap: 0.12, from: rnd(0, 0.02) })) return; SFX.ui(); },
  // the pack, the map and the build menu opening and closing (kind; open), and the creator's choices (neither): a
  // leather flap for the pack, parchment for the map, a wooden knock for the build menu, all soft
  ui: ({ open, kind } = {}) => { note('ui'); const k = (open === false ? 0.7 : 1) * (kind ? 1.8 : 1);
    if (kind === 'pack') { noise(0.12, { type: 'lowpass', freq: 1300, vol: 0.14 * k, attack: 0.012, brown: true, wet: 0.02 }); noise(0.09, { freq: 2600, q: 0.8, vol: 0.05 * k, attack: 0.01, delay: 0.05 }); noise(0.07, { type: 'lowpass', freq: 700, vol: 0.1 * k, brown: true, delay: open === false ? 0.02 : 0.11 }); return; }
    if (kind === 'map') { for (let i = 0; i < 7; i++) noise(rnd(0.02, 0.05), { type: 'highpass', freq: rnd(2500, 4500), q: 0.7, vol: rnd(0.03, 0.06) * k, attack: 0.004, delay: i * rnd(0.025, 0.05) }); noise(0.3, { freq: 3200, q: 0.5, vol: 0.035 * k, attack: 0.06, slide: open === false ? -1200 : 800 }); return; }
    if (kind === 'build') { if (play('hitTree', { vol: 0.16 * k, rate: [1.5, 1.7], lp: 3500, wet: 0.04, dur: 0.18, gap: 0.1 })) return; }
    noise(0.1, { freq: 1800, q: 0.8, vol: 0.06 }); tone(700, 0.08, { type: 'triangle', vol: 0.05, delay: 0.02 }); },
  // eating: bites and a chew (food: the item's food, as items.js gives it: fruit crunches, meat is softer and longer)
  eat: ({ food } = {}) => { note('eat'); const soft = !!food && (food.hp ?? food.health ?? 0) > (food.st ?? food.stamina ?? 0);
    for (let b = 0; b < 3; b++) { const t0 = b * rnd(0.32, 0.42); noise(soft ? 0.12 : 0.07, { freq: soft ? rnd(700, 1000) : rnd(1800, 2600), q: 1.2, vol: (soft ? 0.12 : 0.16) * (1 - b * 0.15), attack: 0.004, delay: t0 });
      for (let i = 0; i < (soft ? 2 : 4); i++) noise(rnd(0.015, 0.04), { freq: soft ? rnd(500, 900) : rnd(2500, 4500), q: rnd(1.5, 3), vol: rnd(0.04, 0.08), attack: 0.002, delay: t0 + 0.03 + i * rnd(0.02, 0.05) });
      noise(0.1, { type: 'lowpass', freq: 400, vol: 0.06, brown: true, delay: t0 + 0.02 }); } },
  craft: () => { if (play('craftItem', { vol: 0.5, wet: 0.1, rate: [0.93, 1.07] })) return; noise(0.08, { freq: 900, q: 2, vol: 0.2 }); noise(0.08, { freq: 1300, q: 2, vol: 0.17, delay: 0.13 }); tone(523, 0.3, { type: 'triangle', vol: 0.06, delay: 0.24, wet: 0.4 }); tone(784, 0.4, { type: 'triangle', vol: 0.05, delay: 0.32, wet: 0.4 }); },
  build: ({ at } = {}) => { if (play('buildPiece', { vol: 0.85, at, near: 6, wet: 0.15 })) return; noise(0.16, { type: 'lowpass', freq: 550, vol: 0.45, brown: true, wet: 0.25 }); noise(0.1, { freq: 900, q: 2, vol: 0.2, delay: 0.1 }); },
  break: ({ at } = {}) => { if (play('breakPiece', { vol: 0.62, at, near: 6, far: 60, wet: 0.2, rate: [0.9, 1.08] })) return; noise(0.6, { type: 'lowpass', freq: 800, vol: 0.45, slide: -600, wet: 0.3 }); for (let i = 0; i < 5; i++) noise(0.06, { freq: 1500, q: 3, vol: 0.15, delay: 0.05 + i * 0.07 }); },
  // a piece struck by a creature (at): the timber knocked and splintering, short of breaking
  pieceHit: ({ at } = {}) => { note('pieceHit'); if (play('hitTree', { vol: 0.48, at, near: 5, far: 50, rate: [0.72, 0.82], wet: 0.15, gap: 0.12 })) { play('breakPiece', { vol: 0.16, at, near: 5, far: 40, rate: [1.2, 1.35], dur: 0.35, gap: 0.12 }); return; } noise(0.12, { type: 'lowpass', freq: 600, vol: 0.3, brown: true }); },
  repair: () => { if (play('repairPiece', { vol: 0.45, wet: 0.1, rate: [0.93, 1.07] })) return; tone(500, 0.12, { type: 'triangle', vol: 0.08 }); tone(750, 0.18, { type: 'triangle', vol: 0.08, delay: 0.1, wet: 0.3 }); },
  door: ({ open = true, at } = {}) => { if (play(open ? 'doorOpen' : 'doorClose', { vol: 0.5, at, near: 4, wet: 0.15, rate: [0.94, 1.06] })) return; if (sample('door', { vol: 0.45, wet: 0.15, at })) return; tone(150, 0.6, { type: 'sawtooth', vol: 0.035, slide: 90, attack: 0.12, wet: 0.3 }); noise(0.12, { type: 'lowpass', freq: 400, vol: 0.15, delay: 0.45, brown: true }); },
  chest: (open = true) => { if (play(open ? 'chestOpen' : 'chestClose', { vol: 0.5, wet: 0.1, rate: [0.94, 1.06] })) return; if (!open) return; if (sample('creak', { vol: 0.4, wet: 0.1 })) return; noise(0.22, { type: 'lowpass', freq: 500, vol: 0.25, brown: true }); tone(230, 0.35, { type: 'sawtooth', vol: 0.03, slide: 60, wet: 0.3 }); },
  // drawing a weapon or tool, and putting it away (the draw, lower and softer, for want of a sheathing)
  draw: () => { if (play('drawWeapon', { vol: 0.4, wet: 0.05, rate: [0.93, 1.07] })) return; noise(0.25, { freq: 2400, q: 6, vol: 0.06, slide: 800 }); },
  sheathe: () => { if (play('drawWeapon', { vol: 0.26, wet: 0.05, rate: [0.78, 0.84] })) return; noise(0.2, { freq: 2000, q: 6, vol: 0.05, slide: -900 }); },
  // the bow: the string drawn, then the arrow loosed and away
  bowDraw: () => play('bowStretch', { vol: 0.62, wet: 0.03, rate: [0.95, 1.03], gap: 0.3 }),
  bow: () => { if (play('arrowRelease', { vol: 0.55, wet: 0.1 })) { play('arrowFly', { vol: 0.31, delay: 0.06, wet: 0.15, rate: [1, 1.15] }); return; }
    tone(130, 0.3, { type: 'triangle', vol: 0.2, slide: -40, wet: 0.25 }); noise(0.14, { freq: 1600, q: 1, vol: 0.12 }); noise(0.4, { freq: 900, q: 0.5, vol: 0.05, slide: -500, delay: 0.05 }); },
  arrowHit: ({ at } = {}) => { if (play('arrowFlesh', { vol: 0.85, at, near: 5, far: 70, wet: 0.1 })) return; noise(0.1, { type: 'lowpass', freq: 600, vol: 0.32, brown: true }); noise(0.05, { freq: 2000, q: 2, vol: 0.08 }); },
  arrowWood: ({ at } = {}) => { if (play('arrowWood', { vol: 0.55, at, near: 5, far: 70, wet: 0.15 })) return; SFX.arrowThud({ at }); },
  // an arrow into the ground: its thunk into a trunk, deadened by the earth, and a little earth thrown up
  arrowThud: ({ at } = {}) => { if (play('arrowWood', { vol: 0.42, at, near: 5, far: 50, rate: [0.78, 0.88], lp: 1600, wet: 0.05 })) { play('stepDirt', { vol: 0.25, at, near: 5, far: 40, rate: [1.2, 1.4], gap: 0 }); return; }
    const s = place(at, 5, 50); noise(0.08, { freq: 420, q: 2, vol: 0.3 * s.k, pan: s.pan }); tone(240, 0.12, { type: 'triangle', vol: 0.08 * s.k, slide: 40, pan: s.pan }); },
  // a creature noticing you (at: where it stands; type: what it is, for its cry; hostile: one that will come for you,
  // which gives its cry, at most one every few seconds; an animal only starts)
  alert: ({ at, hostile, type } = {}) => { const V = VOICE[type]?.cry || ['enemyAlert', [0.95, 1.05], 0.55];
    if (hostile && now() - alertAt > 4 && play(V[0], { vol: V[2], at, near: 8, far: 60, wet: 0.25, rate: V[1], dur: V[0] === 'enemyAlert' ? 3.2 : undefined })) { alertAt = now(); if (VOICE[type]?.rattle) SFX.boneRattle({ at, k: 0.8, delay: 0.3 }); return; }
    if (!hostile) { const s = place(at, 4, 40); noise(0.2, { freq: VOICE[type]?.small ? 1100 : 650, q: 2.5, vol: 0.2 * s.k, slide: 350, pan: s.pan }); } },
  fireStart: ({ at } = {}) => play('fireStart', { vol: 0.8, at, near: 4, wet: 0.1 }),
  douse: ({ at } = {}) => { if (play('fireDouse', { vol: 1, at, near: 4, far: 40, wet: 0.1 })) return; noise(0.9, { freq: 3000, q: 0.6, vol: 0.18, slide: -2000, attack: 0.02 }); noise(0.5, { type: 'lowpass', freq: 400, vol: 0.12, brown: true }); },
  // a creature killed (at; type; boss: one of the giant bosses, which has a death of its own): its body falling where
  // it stood, heavier for a bigger beast (a skeleton's bones have their own fall: boneCrumble)
  kill: ({ at, type, boss } = {}) => { if (boss) { SFX.bossDeath({ at }); return; } const V = VOICE[type] || {}; if (V.mat === 'bone') return; note('kill');
    const big = V.big ? 1.6 : V.small ? 0.5 : 1; if (play('landGrass', { vol: 0.45 * Math.min(1.2, big), at, near: 5, far: 60, rate: [0.62 / Math.sqrt(big), 0.72 / Math.sqrt(big)], wet: 0.1, delay: 0.25, gap: 0 })) { if (big > 1) sub(0.6, { f0: 60, f1: 30, k: 0.5, at, near: 10, far: 90, delay: 0.25 }); return; }
    const s = place(at, 5, 60); noise(0.3, { type: 'lowpass', freq: 300, vol: 0.3 * s.k * big, brown: true, delay: 0.25, pan: s.pan }); },
  // a boss dying: its long roar slowed and dying away, then the great body coming down, the ground shaking under it, the
  // music hushed for it
  bossDeath: ({ at } = {}) => { note('bossDeath'); duck(1, 0, { hold: 3, warn: true });
    if (!play('bossRoarLong', { vol: 0.8, at, near: 30, far: 260, wet: 0.5, rate: [0.66, 0.72], fade: true, dur: 6 })) SFX.roar({ at, boss: true });
    sub(3, { f0: 50, f1: 24, k: 0.7, at, near: 30, far: 260, attack: 0.4 });
    setTimeout(() => { if (!ctx) return; SFX.collapse({ at, k: 1.4 }); sub(2.4, { f0: 62, f1: 22, k: 1, at, near: 30, far: 300, attack: 0.005, rumble: 1 }); rattle(14, 2.2, { at, near: 30, far: 220, delay: 0.3 }); }, 2400); },
  // a boss's end (trial.js presence): Zeus's bolt into its body, the loudest crack of all over the deepest boom, the
  // thunder rolling on round the island (the bolt's own, lightning.js, comes with it), stones pattering down, and the
  // ash rushing away on the wind; the music hushed under it
  bossEnd: ({ at } = {}) => { note('bossEnd'); duck(1, 0, { hold: 4, warn: true }); const s = place(at, 30, 320);
    play('thunderClap', { vol: 1, at, near: 40, far: 400, rate: [0.7, 0.76], wet: 0.55 }); play('slamHit', { vol: 0.85, at, near: 40, far: 400, rate: [0.45, 0.5], wet: 0.6, gap: 0 });
    sub(4.5, { f0: 72, f1: 18, k: 1.2, at, near: 40, far: 400, attack: 0.004, rumble: 1 }); SFX.thunder(1.5);
    noise(3.2, { freq: 700, q: 0.5, vol: 0.2 * s.k, attack: 0.7, slide: -450, wet: 0.6, delay: 0.3, pan: s.pan * 0.5 }); rattle(18, 2.8, { at, near: 30, far: 260, delay: 0.5 }); },
  // the bosses: a ground-shaking slam, the Chimera's fire, a block of stone torn up and hurled, and landing
  // (big: a giant boss's: the recording slowed over a boom and the rubble it shakes loose; Patch 23: some 4 dB under
  // what they were, the sub boom carrying the weight)
  slam: ({ at, big } = {}) => {
    if (big) { play('slamHit', { vol: 0.7, at, near: 18, far: 200, wet: 0.5, rate: [0.7, 0.78] }); sub(1.7, { f0: 56, f1: 24, k: 0.8, at, near: 18, far: 200, attack: 0.006 }); rattle(8, 1.2, { at, near: 18, far: 160 }); return; }
    if (play('slamHit', { vol: 0.62, at, near: 8, far: 80, wet: 0.35, rate: [0.9, 1] })) return; noise(0.7, { type: 'lowpass', freq: 220, vol: 0.6, brown: true, wet: 0.5 }); tone(55, 0.8, { type: 'sine', vol: 0.3, slide: -25, wet: 0.4 }); noise(0.15, { freq: 900, q: 1, vol: 0.18, delay: 0.02 }); },
  // the Chimera's fire: the burst slowed and loud, the lion's roar in it, and the fire's own roar all the while it pours
  breath: ({ at } = {}) => {
    const s = place(at, 20, 180); play('fireBurst', { vol: 0.8, at, near: 20, far: 180, wet: 0.35, rate: [0.6, 0.68] }); play('bossRoar', { vol: 0.4, at, near: 20, far: 180, wet: 0.45, rate: [0.9, 0.96], gap: 0.3 });
    noise(1.9, { type: 'lowpass', freq: 750, vol: 0.36 * s.k, brown: true, attack: 0.18, wet: 0.4, slide: -320, pan: s.pan * 0.5 }); noise(1.8, { freq: 1500, q: 0.6, vol: 0.13 * s.k, attack: 0.25, slide: -600, pan: s.pan * 0.5 });
    sub(1.9, { f0: 50, f1: 30, k: 0.5, at, near: 20, far: 180, attack: 0.3 }); },
  // a giant boss's foot coming down (k: how big): a slowed landing on rock over a short deep thud
  giantStep: ({ at, k = 1 } = {}) => { play('landRock', { vol: 0.4 * k, at, near: 12, far: 150, rate: [0.4, 0.48], wet: 0.25, gap: 0.08 }); sub(0.55, { f0: 50, f1: 28, k: 0.35 * k, at, near: 12, far: 150, attack: 0.006, rumble: 0.7 }); },
  // a boss's blow landing on you: a heavy, close impact over the hurt
  bossHit: ({ k = 1 } = {}) => { play('slamHit', { vol: 0.48 * k, wet: 0.2, rate: [1.05, 1.15], gap: 0.1 }); sub(0.8, { f0: 80, f1: 34, k: 0.6 * k, attack: 0.004, rumble: 0.5 }); noise(0.14, { type: 'lowpass', freq: 900, vol: 0.26 * k, brown: true }); },
  // as a boss comes: the ground rumbling deeper and louder for dur seconds, grit falling, until the blast (at: where)
  quake: ({ dur = 3, at } = {}) => { const s = place(at, 30, 400), pan = s.pan * 0.4, v = at ? Math.max(0.4, s.k) : 1; noise(dur, { type: 'lowpass', freq: 110, q: 0.8, vol: 0.45 * v, attack: dur * 0.85, brown: true, wet: 0.4, pan }); tone(31, dur, { type: 'sine', vol: 0.24 * v, attack: dur * 0.85, slide: 7, wet: 0.1, pan }); rattle(14, dur * 0.9, { k: 0.7 * v, delay: 0.3 }); },
  // the blast as a boss lands: a slowed thunderclap and slam over the deepest boom of all, its rumble rolling on, stones
  // raining down after it; the music hardly dips (setFight)
  blast: ({ at } = {}) => {
    const s = place(at, 30, 320); play('thunderClap', { vol: 0.75, at, near: 30, far: 320, rate: [0.6, 0.68], wet: 0.5 }); play('slamHit', { vol: 0.8, at, near: 30, far: 320, rate: [0.52, 0.6], wet: 0.6, gap: 0 });
    sub(3.4, { f0: 66, f1: 21, k: 1, at, near: 30, far: 320, attack: 0.005, rumble: 1 }); noise(2.8, { type: 'lowpass', freq: 400, vol: 0.4 * s.k, slide: -320, brown: true, wet: 0.7, pan: s.pan * 0.5 });
    rattle(16, 2.6, { at, near: 30, far: 260, delay: 0.4 }); duck(0.4); },
  // a length of wall or a column falling (k: how big), from where it lands
  collapse: ({ at, k = 1 } = {}) => { play('boulder', { vol: 0.8 * k, at, near: 10, far: 140, wet: 0.4, rate: [0.58, 0.72], gap: 0.06 }); const s = place(at, 10, 140);
    noise(1, { type: 'lowpass', freq: 520, vol: 0.4 * k * s.k, slide: -320, brown: true, wet: 0.45, pan: s.pan * 0.6 }); sub(0.9, { f0: 68, f1: 32, k: 0.5 * k, at, near: 10, far: 140 }); rattle(5, 0.9, { k, at, near: 10, far: 120 }); },
  // a dryad's thorn (k: how near): the rustle and rising shimmer as the glow gathers in her hand, the whoosh as it leaves
  // it, the crack and scatter of leaves where it strikes (Patch 23: some 10 dB up, so a thorn coming is heard)
  thornCast: (k = 1) => { if (k <= 0) return; note('thornCast', k); noise(0.6, { freq: 2600, q: 0.7, vol: 0.3 * k, attack: 0.3, slide: 1400, wet: 0.3 }); tone(520, 0.6, { type: 'sine', vol: 0.12 * k, slide: 380, attack: 0.35, wet: 0.5 }); tone(780, 0.5, { type: 'triangle', vol: 0.06 * k, slide: 500, attack: 0.3, delay: 0.1, wet: 0.5 }); },
  thornThrow: (k = 1) => { if (k <= 0) return; note('thornThrow', k); noise(0.35, { freq: 1300, q: 0.9, vol: 0.7 * k, slide: -700, attack: 0.02, wet: 0.2 }); noise(0.25, { freq: 3600, q: 0.7, vol: 0.25 * k, slide: -1500 }); tone(900, 0.25, { type: 'sine', vol: 0.1 * k, slide: -500, wet: 0.4 });
    play('whoosh', { vol: 0.35 * k, rate: [1.15, 1.3], wet: 0.1, gap: 0 }); },
  thornHit: (k = 1) => { note('thornHit', k); noise(0.06, { freq: 1900, q: 2, vol: 0.7 * k }); tone(260, 0.1, { type: 'triangle', vol: 0.25 * k, slide: -120 }); noise(0.4, { freq: 3800, q: 0.6, vol: 0.3 * k, attack: 0.01, slide: -1800, delay: 0.03 }); play('hitPlant', { vol: 0.35 * k, rate: [1.1, 1.25], wet: 0.05, gap: 0 }); },
  boulder: ({ at, land } = {}) => { if (play('boulder', { vol: land ? 0.6 : 0.42, at, near: 6, far: 70, wet: 0.3, rate: land ? [0.85, 0.95] : [1, 1.1], gap: 0.2 })) return;
    if (land) { SFX.thud(); return; } noise(0.45, { freq: 500, q: 0.8, vol: 0.22, slide: 300, attack: 0.05 }); tone(80, 0.3, { type: 'triangle', vol: 0.1, slide: -30 }); },
  // thunder near at hand (k: how big; at: where, for a creature's small thunderclap as its body goes, on the effects:
  // it's the fight's, not the weather's): a crack when it's close, then a long roll of rumbling bursts under the reverb
  thunder: (k = 1, { at } = {}) => {
    const near = k > 0.9; if (at ? play('thunderClap', { vol: 0.4 * k, at, near: 6, far: 80, wet: 0.4 }) : play('thunderNear', { vol: 0.62 * k, wet: 0.35, rate: [0.92, 1.04], bus: ambBus, from: 'onset' })) { duck(k * 0.6); return; }
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
    else rec = sampleFar('thunderFar', { ...o, vol: Math.min(0.9, 1.35 * k), wet: 0.6, rate: rnd(0.75, 0.95), delay: delay + 0.1, lp: Math.max(lp, 300), from: 'onset' });
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
  // (a boss's own: slowed for the giant it comes from, louder and further heard, over a long boom, the music dipping a
  // little under it: it's a warning)
  roar: ({ at, boss, long, giant } = {}) => {
    if (!giant && boss && play(long ? 'bossRoarLong' : 'bossRoar', { vol: 0.72, at, near: 30, far: 240, wet: 0.5, rate: [0.78, 0.85] })) { sub(long ? 3.4 : 2.1, { f0: 64, f1: 30, k: 0.7, at, near: 30, far: 240, attack: 0.22 }); duck(1, 0, { hold: long ? 2.5 : 1.2, warn: true }); return; }
    if (!giant && play(long ? 'bossRoarLong' : 'bossRoar', { vol: 0.75, at, near: 10, far: 120, wet: 0.4, rate: [1.05, 1.12] })) { duck(0.4); return; }
    if (giant && play('giantCall', { vol: 0.7, at, near: 10, far: 120, wet: 0.35, rate: [0.5, 0.56] })) { sample('growl', { vol: 0.45, wet: 0.4, rate: [0.7, 0.8], at, near: 10, far: 120 }); sub(1.2, { f0: 60, f1: 32, k: 0.4, at, near: 10, far: 120, attack: 0.15 }); return; }
    sample('growl', { vol: 0.7, wet: 0.4, rate: [0.7, 0.8], at });   // (the growl over the synthesised rumble, which gives it its size)
    tone(66, 1.5, { type: 'sawtooth', vol: 0.2, slide: -24, attack: 0.15, wet: 0.5 }); tone(99, 1.3, { type: 'square', vol: 0.06, slide: -38, attack: 0.15, wet: 0.5 }); noise(1.4, { type: 'lowpass', freq: 420, vol: 0.32, attack: 0.15, slide: -220, brown: true, wet: 0.5 }); },
  summon: () => { loadKey('bossRoarLong'); if (play('bossSummon', { vol: 0.8, wet: 0.45 })) { duck(0.5); return; } tone(55, 3.2, { type: 'sawtooth', vol: 0.12, slide: 30, attack: 1, wet: 0.6 }); SFX.thunder(1.2); },
  // something revealed: a clue's map, the Olympos altar, a head offered (the team's chime), and a small step done (chime:
  // the lyre's rising notes, on the effects so they're heard with the music off)
  reveal: () => { if (play('revealChime', { vol: 0.55, wet: 0.3, rate: [0.99, 1.01], gap: 1 })) return; SFX.chime(); },
  chime: () => { note('chime'); [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => pluck(f, { vol: 0.1, delay: i * 0.14, pan: -0.3 + i * 0.2, bus: sfxBus })); },
  // a skill found or up a level (hud.js): a small bell, soft and a little to the right where its banner shows; two notes
  // rising for a level, three for a skill found: the first pack's hand bell (a high C) pitched to each, or each a sine
  // struck with a breath of noise and its bell's quiet, inharmonic partials
  skill: ({ learned } = {}) => { note('skill'); (learned ? [659.25, 783.99, 1046.5] : [783.99, 1046.5]).forEach((f, i) => {
    if (play('bell', { vol: 0.22, rate: f / 1046.5, delay: i * 0.13, pan: 0.25, wet: 0.3, gap: 0, dur: 2.2 })) return;
    noise(0.03, { freq: f * 3, q: 1.5, vol: 0.012, attack: 0.002, delay: i * 0.12, pan: 0.25, wet: 0.3 }); tone(f, 1.3, { vol: 0.055, attack: 0.004, delay: i * 0.12, wet: 0.35, pan: 0.25 }); tone(f * 2.76, 0.45, { vol: 0.011, attack: 0.002, delay: i * 0.12, wet: 0.35, pan: 0.25 }); tone(f * 5.4, 0.25, { vol: 0.005, attack: 0.002, delay: i * 0.12, wet: 0.35, pan: 0.25 }); }); },
  // food done on a cooking stand (at: where it hangs): fat spitting on the coals, crackling up for half a second over a
  // hot sizzle, then the soft "pss" of steam let go as it settles, heard across the camp. The team has no recording for it
  // (docs/plans/audio.md); synthesised from filtered noise, no tones, so it stays a natural sound
  cooked: ({ at } = {}) => {
    const s = place(at, 4, 45), k = s.k * 2, pan = s.pan; if (k < 0.02) return;
    noise(1.0, { type: 'highpass', freq: 3800, q: 0.5, vol: 0.22 * k, attack: 0.32, slide: 900, wet: 0.04, pan });   // (the sizzle, rising)
    noise(0.8, { type: 'bandpass', freq: 1700, q: 0.8, vol: 0.09 * k, attack: 0.25, wet: 0.03, pan });
    for (let i = 0; i < 14; i++) { const d = 0.7 * Math.sqrt(Math.random());   // (the crackle: grains thickening as it heats)
      noise(rnd(0.008, 0.026), { freq: rnd(2200, 7000), q: rnd(1.2, 3), vol: rnd(0.18, 0.45) * k * (0.5 + d), attack: 0.001, delay: d, wet: 0.03, pan: pan + rnd(-0.15, 0.15) }); }
    noise(0.05, { type: 'lowpass', freq: 700, vol: 0.15 * k, attack: 0.003, delay: 0.45, brown: true, pan });   // (a fat drop popping)
    noise(1.1, { type: 'bandpass', freq: 3300, q: 0.7, vol: 0.19 * k, attack: 0.07, slide: -1500, delay: 0.62, wet: 0.08, pan });   // (pss: steam let go, falling away)
    noise(0.9, { type: 'highpass', freq: 5200, q: 0.4, vol: 0.075 * k, attack: 0.05, slide: -1800, delay: 0.66, wet: 0.06, pan });
    note('cooked', k);
  },
  // ---- the Minotaur fight (trial.js)
  // his breath when he's spent: a long, deep, rough breath in through the nostrils and a heavier one out, a growl in it (k:
  // how hard; the next breath is the caller's: one each time it's asked)
  pant: ({ at, k = 1 } = {}) => { const s = place(at, 15, 120), v = k * s.k; if (v < 0.01) return; note('pant', v); const o = { brown: true, wet: 0.3, pan: s.pan * 0.5 };
    noise(0.65, { ...o, type: 'bandpass', freq: 380, q: 1.4, vol: 0.32 * v, attack: 0.35, slide: 160 }); noise(0.5, { freq: 1300, q: 1, vol: 0.06 * v, attack: 0.3, slide: 300, pan: s.pan * 0.5, wet: 0.2 });
    noise(0.9, { ...o, type: 'bandpass', freq: 300, q: 1.2, vol: 0.42 * v, attack: 0.06, slide: -170, delay: 0.72 }); tone(62, 0.8, { type: 'sawtooth', vol: 0.05 * v, slide: -14, attack: 0.08, delay: 0.72, wet: 0.3, pan: s.pan * 0.5 });
    sub(0.7, { f0: 44, f1: 30, k: 0.35 * k, at, near: 15, far: 120, delay: 0.72, attack: 0.1, rumble: 0.3 }); },
  // the snort and the scrape of a hoof as he lowers his horns to charge: the warning, so it's heard over the fight (some
  // 15 dB up, with the first pack's growl slowed in it for the bull's chest), the music dipping under it
  snort: ({ at } = {}) => { const s = place(at, 15, 160); if (s.k < 0.01) return; note('snort', s.k); duck(1, 0, { hold: 1, warn: true }); const v = 4.5 * s.k;
    noise(0.35, { type: 'bandpass', freq: 520, q: 0.8, vol: 0.5 * v, attack: 0.02, slide: -260, brown: true, wet: 0.35, pan: s.pan * 0.5 }); noise(0.3, { freq: 1500, q: 0.6, vol: 0.14 * v, attack: 0.01, slide: -700, wet: 0.2, pan: s.pan * 0.5 });
    noise(0.5, { type: 'bandpass', freq: 900, q: 0.6, vol: 0.2 * v, attack: 0.05, slide: -500, delay: 0.25, wet: 0.2, pan: s.pan * 0.5 });
    play('growl', { vol: 0.55, at, near: 15, far: 160, rate: [0.5, 0.58], wet: 0.3, dur: 0.9, gap: 0.3 }); play('slamHit', { vol: 0.3, at, near: 15, far: 120, rate: [1.4, 1.55], lp: 3000, delay: 0.45, wet: 0.2, gap: 0.3, dur: 0.4 }); },
  // the charge under way: a rumble that grows with his speed for dur seconds (his hooves are his footfalls: giantStep)
  charge: ({ at, dur = 2 } = {}) => { const s = place(at, 20, 220); if (s.k < 0.01) return; note('charge', s.k); noise(dur, { type: 'lowpass', freq: 160, q: 0.8, vol: 0.55 * s.k, attack: dur * 0.7, slide: 60, brown: true, wet: 0.3, pan: s.pan * 0.4 }); sub(dur, { f0: 34, f1: 48, k: 0.5, at, near: 20, far: 220, attack: dur * 0.7, rumble: 0.4 }); },
  // (the bosses' blows that had no sound of their own, trial.js: Patch 26)
  // a giant's weapon or claws swept through the air (at): a slowed whoosh over a low rush of air
  bossSwing: ({ at, k = 1 } = {}) => { const s = place(at, 12, 140); if (s.k < 0.02) return; note('bossSwing', s.k); play('whoosh', { vol: 0.75 * k, at, near: 12, far: 140, wet: 0.2, rate: [0.42, 0.5], gap: 0.1 });
    noise(0.7, { type: 'lowpass', freq: 600, vol: 0.32 * s.k * k, attack: 0.25, slide: -350, brown: true, wet: 0.2, pan: s.pan * 0.6 }); },
  // the serpent's sting (at): a dry hiss rising and the whip of the tail
  sting: ({ at } = {}) => { const s = place(at, 10, 100); if (s.k < 0.02) return; note('sting', s.k); noise(0.55, { type: 'highpass', freq: 3500, q: 0.7, vol: 0.2 * s.k, attack: 0.4, slide: 1500, wet: 0.2, pan: s.pan });
    play('whoosh', { vol: 0.6, at, near: 10, far: 100, wet: 0.1, rate: [0.8, 0.9], delay: 0.35, gap: 0.05 }); },
  // the goat head's spell (at): a low drone swelling under a shimmer of high tones, glassy and unearthly
  goatSpell: ({ at } = {}) => { const s = place(at, 20, 200); if (s.k < 0.02) return; note('goatSpell', s.k); tone(73.4, 2.6, { type: 'sawtooth', vol: 0.09 * s.k, attack: 1.2, slide: -12, wet: 0.7, pan: s.pan * 0.5 });
    [880, 1174.7, 1318.5, 1760].forEach((f, i) => tone(f, 1.8, { type: 'sine', vol: 0.035 * s.k, attack: 0.5, delay: 0.15 * i, slide: f * 0.03, wet: 0.85, pan: s.pan * 0.5 + (i % 2 ? 0.3 : -0.3) })); },
  // a bolt striking the ground near you (at): the crackle and sizzle of the burnt ground after the crack
  boltHit: ({ at } = {}) => { const s = place(at, 8, 90); if (s.k < 0.02) return; note('boltHit', s.k); for (let i = 0; i < 24; i++) noise(rnd(0.004, 0.02), { freq: rnd(1500, 7000), q: 1.5, vol: rnd(0.1, 0.3) * s.k, attack: 0.001, delay: 0.05 + Math.random() ** 2 * 1.6, wet: 0.15, pan: s.pan });
    noise(2.2, { freq: 4200, q: 0.5, vol: 0.07 * s.k, attack: 0.05, slide: -2400, wet: 0.2, pan: s.pan }); },
  // a lightning bolt gathering where it will fall (the ground glowing): a fizz and crackle rising for a second (at)
  zap: ({ at, dur = 1 } = {}) => { const s = place(at, 6, 80); if (s.k < 0.02) return; note('zap', s.k); noise(dur, { type: 'highpass', freq: 2500, q: 0.6, vol: 0.18 * s.k, attack: dur * 0.9, slide: 2500, wet: 0.2, pan: s.pan });
    for (let i = 0; i < 18; i++) { const d = dur * Math.sqrt(Math.random()); noise(rnd(0.004, 0.015), { freq: rnd(2500, 8000), q: 2, vol: rnd(0.12, 0.3) * s.k * (0.3 + d / dur), attack: 0.001, delay: d, wet: 0.1, pan: s.pan }); } },
  // a skeleton clawing out of the ground: earth breaking, then its bones knocking together as it pulls free
  boneRise: ({ at } = {}) => { const s = place(at, 5, 60); if (s.k < 0.02) return; note('boneRise', s.k); noise(1.2, { type: 'lowpass', freq: 380, vol: 0.6 * s.k, attack: 0.1, slide: -150, brown: true, wet: 0.25, pan: s.pan }); rattle(6, 1, { k: 0.8, at, near: 5, far: 60, delay: 0.1 }); SFX.boneRattle({ at, k: 0.8, delay: 0.7 }); },
  // its bones clacking as it walks (k: how loud; delay): dry knocks, broad (Patch 23: some 20 dB up, so they're heard
  // coming)
  boneRattle: ({ at, k = 1, delay = 0 } = {}) => { const s = place(at, 4, 40); if (s.k * k < 0.02) return; note('boneRattle', s.k * k); const n = 4 + Math.floor(Math.random() * 4), f = rnd(800, 1300);
    for (let i = 0; i < n; i++) noise(rnd(0.02, 0.05), { freq: f * rnd(0.8, 1.3), q: rnd(2, 3), vol: rnd(1.6, 2.8) * k * s.k, attack: 0.001, delay: delay + i * rnd(0.05, 0.11), wet: 0.15, pan: s.pan });
    play('blockHit', { vol: 0.3 * k, at, near: 4, far: 40, rate: [1.7, 1.9], dur: 0.15, delay, gap: 0.1 }); },
  // a skeleton falling apart: a dry crack, then its bones clattering down and rolling, a hollow knock for the skull (k:
  // how much; short: only the crack and a few, as a blow lands on its bones)
  boneCrumble: ({ at, k = 1, short } = {}) => { const s = place(at, 5, 60), v = 3 * k * s.k; if (v < 0.02) return; note('boneCrumble', v); noise(0.08, { freq: 1600, q: 1.5, vol: 0.4 * v, attack: 0.002, wet: 0.2, pan: s.pan });
    for (let i = 0; i < (short ? 4 : 16); i++) { const d = 0.05 + (short ? 0.15 : 0.7) * Math.random() ** 1.5; noise(rnd(0.02, 0.06), { freq: rnd(600, 1500), q: rnd(2, 4), vol: rnd(0.07, 0.18) * v * (1 - d * 0.6), attack: 0.001, delay: d, wet: 0.2, pan: s.pan + rnd(-0.2, 0.2) }); }
    if (short) return; tone(330, 0.12, { type: 'triangle', vol: 0.08 * v, slide: -60, delay: 0.42, wet: 0.2, pan: s.pan }); tone(300, 0.1, { type: 'triangle', vol: 0.05 * v, slide: -50, delay: 0.6, wet: 0.2, pan: s.pan }); },
  owl: ({ at } = {}) => { if (play('owlHoot', { vol: 0.5, at, near: 6, far: 70, wet: 0.35, rate: [0.97, 1.03] })) return; tone(400, 0.4, { vol: 0.11, slide: -30, attack: 0.06, wet: 0.5 }); tone(380, 0.7, { vol: 0.11, slide: -50, attack: 0.06, delay: 0.5, wet: 0.5 }); },
};
export function sound(name, ...a) { if (!ctx) return; AUDIO.calls?.push({ k: name, t: now() }); try { SFX[name]?.(...a); } catch { /* audio is optional */ } }

// ---- a live voice: a looping sound from a place that its caller keeps going and moves (a log rolling: its rumble, by
// how fast it rolls), on the effects bus. set(at, k, big): where it is now and how loud (k 0..1 by its speed, big by its
// size); stop(): it fades and goes. Noted in AUDIO.log as it starts.
const VOICES = {
  logRumble: () => { const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(); s.buffer = brownBuf; s.loop = true; f.type = 'lowpass'; f.Q.value = 0.8; s.connect(f); return { s, out: f, set: (k, t) => ease(f.frequency, 90 + 260 * k, 0.1, t), gain: (k, big) => 0.24 * k * big, near: 6, far: 70 }; },
};
export function voice(name) {
  if (!ctx || ctx.state !== 'running' || !VOICES[name]) return null; const v = VOICES[name](), g = ctx.createGain(), p = ctx.createStereoPanner(); g.gain.value = 0; v.out.connect(g).connect(p).connect(sfxBus); v.s.start(now(), Math.random() * 3);
  AUDIO.log?.push({ k: name, i: -1, t: now(), voice: true, bus: 'sfx' });
  return { set(at, k = 1, big = 1) { const s = spatial(at, v.near, v.far), t = now(); ease(g.gain, v.gain(k, big) * s.k, 0.08, t); ease(p.pan, s.pan, 0.05, t); v.set(k, t); },
    stop() { const t = now(); g.gain.cancelScheduledValues(t); g.gain.setTargetAtTime(0, t, 0.12); v.s.stop(t + 0.8); setTimeout(() => { g.disconnect(); p.disconnect(); }, 1200); } };
}

// ---- beds: a recording looped (its seam made in sounds.mjs), faded to the level asked each frame; loaded the first time
// it's wanted, one of its recordings (not the last one) each time it starts, and let go of after a while silent. A short
// one (under 30 s: the leaves, the winds, the frogs) plays as two copies, its other recording where it has one, at
// different places in it and a little apart in pace, so the loop's return never lines up and isn't heard
const BEDS = {};
function loopOf(buf, rate, dest) { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = rate; s.connect(dest); s.start(0, Math.random() * buf.duration); return s; }
function bed(k, v, dt, { tc = 1.2, bus = ambW, rate = 1 } = {}) {
  if (!META[k]) return false; let b = BEDS[k]; if (AUDIO.solo && AUDIO.solo !== k) v = 0;   // (solo: checking the mix, one bed alone)
  if (!b) { if (v < 0.002) return true; b = BEDS[k] = { g: ctx.createGain(), s: [], i: -1, j: -1, quiet: 0 }; b.g.gain.value = 0; b.g.connect(bus); }
  ease(b.g.gain, v, tc);
  if (v >= 0.002) { b.quiet = 0;
    if (!b.s.length && !b.loading) { const n = META[k].n; let i = Math.floor(Math.random() * n); if (n > 1 && i === b.i) i = (i + 1) % n; b.loading = true;
      fetchOne(k, i).then(async (buf) => { if (!buf || b.s.length) { b.loading = false; return; } const j = buf.duration < 30 ? (n > 1 ? (i + 1) % n : i) : -1, buf2 = j >= 0 ? (j === i ? buf : await fetchOne(k, j)) : null; b.loading = false; if (b.s.length) return;
        if (buf2) { const ga = ctx.createGain(), gb = ctx.createGain(); ga.gain.value = gb.gain.value = Math.SQRT1_2; ga.connect(b.g); gb.connect(b.g); b.s = [loopOf(buf, rate * 0.97, ga), loopOf(buf2, rate * 1.03, gb)]; b.g2 = [ga, gb]; }
        else b.s = [loopOf(buf, rate, b.g)];
        b.i = i; b.j = j; AUDIO.log?.push({ k, i, t: now(), bed: true, bus: bus === musicBus ? 'music' : 'amb' }); }); } }
  else if (b.s.length && (b.quiet += dt) > 25) { for (const s of b.s) { s.stop(); s.disconnect(); } b.g2?.forEach((g) => g.disconnect()); b.s = []; b.g2 = null; unload(k, b.i); if (b.j >= 0 && b.j !== b.i) unload(k, b.j); }   // (silent a while: stop it and free its sound)
  return true;
}
// The synthesised beds (noise through filters), for what has no recording: made the first time one is wanted, stopped
// and let go of once it has been silent ten seconds (none runs for nothing)
const SYNTH = {
  windLow: [true, [['lowpass', 380, 0.6]]], windHigh: [false, [['bandpass', 900, 0.8]]], whistle: [false, [['bandpass', 1500, 14]]],
  leaves: [false, [['highpass', 2500, 0.5], ['lowpass', 7000, 0.5]]], leavesLo: [false, [['bandpass', 1100, 0.6], ['lowpass', 2400, 0.5]]],   // (the wind in the leaves: their hiss, and the softer rush under it)
  rainHiss: [false, [['highpass', 1500, 0.4], ['lowpass', 9000, 0.4]]], rainBody: [true, [['lowpass', 700, 0.5]]], roof: [false, [['bandpass', 600, 0.9], ['lowpass', 1400, 0.6]]],
  sea: [true, [['lowpass', 500, 0.5]]], fire: [true, [['lowpass', 280, 0.7]]], roar: [true, [['lowpass', 120, 0.7]]],   // (roar: the storm wall's deep, endless roar, near it)
};
function synth(name, v, tc = 0.6, freq, dt = 1 / 60) {
  if (AUDIO.solo && AUDIO.solo !== 'synth') v = 0; let b = amb[name];
  if (!b) { if (v < 0.002) return; const [brown, chain] = SYNTH[name], s = ctx.createBufferSource(); s.buffer = brown ? brownBuf : noiseBuf; s.loop = true; let node = s; const fs = [];
    for (const [type, f, q] of chain) { const bq = ctx.createBiquadFilter(); bq.type = type; bq.frequency.value = f; bq.Q.value = q; node.connect(bq); node = bq; fs.push(bq); }
    const g = ctx.createGain(); g.gain.value = 0; node.connect(g).connect(ambW); s.start(0, Math.random() * 3); b = amb[name] = { g, f: fs, s, quiet: 0 }; }
  ease(b.g.gain, v, tc); if (freq !== undefined) ease(b.f[0].frequency, freq, 1);
  if (v >= 0.002) b.quiet = 0; else if ((b.quiet += dt) > 10) { b.s.stop(); b.s.disconnect(); b.g.disconnect(); delete amb[name]; }
}
// (for the tests and the mix: each bed's level now, and the synthesised beds')
AUDIO.buses = () => ({ sfx: sfxBus, amb: ambBus, music: recBus });
AUDIO.levels = () => ({ beds: Object.fromEntries(Object.entries(BEDS).filter(([, b]) => b.s.length).map(([k, b]) => [k, +b.g.gain.value.toFixed(3)])), synth: Object.fromEntries(Object.entries(amb).map(([k, b]) => [k, +b.g.gain.value.toFixed(3)])) });

// ---- the fires burning near you (game.js: the nearest few lit within 25 m, { id, x, y, z, k: how big it burns }): each
// crackles and roars where it stands, its own loop (which of the recordings by its id, so the temple's and the caves'
// differ), faded in as it's lit and out as it dies; a short recording as two copies, as the beds are
const FIRES = new Map();
export function fires(list) {
  if (!ctx || !META.bedFire) return false; const t = now(), seen = new Set();
  for (const f of list) {
    seen.add(f.id); let s = FIRES.get(f.id);
    if (!s) { const i = hashStr(String(f.id)) % META.bedFire.n; s = { g: ctx.createGain(), p: ctx.createStereoPanner(), lp: ctx.createBiquadFilter(), i, src: [] }; s.g.gain.value = 0; s.lp.type = 'lowpass'; s.lp.connect(s.g).connect(s.p).connect(ambBus); FIRES.set(f.id, s);
      fetchOne('bedFire', i).then((buf) => { if (!buf || s.gone) return; const r = rnd(0.95, 1.05);
        if (buf.duration < 20) { const ga = ctx.createGain(), gb = ctx.createGain(); ga.gain.value = gb.gain.value = Math.SQRT1_2; ga.connect(s.lp); gb.connect(s.lp); s.src = [loopOf(buf, r * 0.97, ga), loopOf(buf, r * 1.03, gb)]; } else s.src = [loopOf(buf, r, s.lp)];
        AUDIO.log?.push({ k: 'bedFire', i, t: now(), fire: f.id, bus: 'amb' }); }); }
    const sp = spatial(f, 2, 30); ease(s.g.gain, 0.75 * Math.min(1, f.k) * sp.k, 0.25, t); ease(s.p.pan, sp.pan, 0.1, t); ease(s.lp.frequency, Math.min(16000, sp.lp), 0.2, t);
  }
  for (const [id, s] of FIRES) if (!seen.has(id)) { s.gone = true; s.g.gain.setTargetAtTime(0, t, 0.4); FIRES.delete(id); setTimeout(() => { s.src.forEach((x) => x.stop()); s.g.disconnect(); }, 2500); }
  return true;
}
// ---- the river (Patch 24, river.js riverSounds): the water near you, each from where it is, { id, kind, x, y, z, k: how
// loud it runs }. A stream: the babble of bubbles bursting as the water tumbles over the stones (made here once: Minnaert
// bubbles, each a little tone rising as it shrinks and dying in a few hundredths of a second, scattered at random over a
// soft rush) under the recorded flow where there is one, louder over the riffles. A fall: a deep roar (the rush of
// brown noise, low, swelling slowly) and its hiss, the recorded flow slowed under them for its churn, heard from far
// off and filling everything near the pool. The lake: water lapping at the shore (the waves' bed, slowed and dulled).
// Each runs at its own pace and swells on its own clock, its loops started at their own places, so the falls, stacked
// within a few hundred metres of one another and heard together from far off, never play one recording in step (two
// copies of one loop in step comb each other and double the level); each is logged as its own sound.
const WATERS = new Map(); let babbleBuf = null;
function makeBabble(seconds) {
  const sr = ctx.sampleRate, n = Math.floor(sr * seconds), b = ctx.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let lo = 0, hi = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; lo += (w - lo) * 0.08; hi += (lo - hi) * 0.004; d[i] = (lo - hi) * 0.5; }   // (the rush under it: a band of noise round a few hundred hertz)
    for (let t = Math.random() * 0.02; t < seconds - 0.08; t += -Math.log(1 - Math.random()) / 55) {
      const r = Math.random(), f0 = 380 + 2400 * r * r, dur = 0.012 + 0.05 * (1 - r) * Math.random(), a = (0.08 + 0.18 * Math.random()) * (1.2 - r * 0.6), i0 = Math.floor(t * sr), m = Math.floor(dur * sr);
      let ph = 0; for (let j = 0; j < m; j++) { const u = j / m; ph += 6.2832 * f0 * (1 + 0.9 * u * u) / sr; d[i0 + j] += Math.sin(ph) * a * Math.exp(-u * 4.5) * Math.min(1, j / 30); }
    }
    const x = Math.floor(sr * 0.4); for (let j = 0; j < x; j++) { const u = j / x; d[j] = d[j] * Math.sqrt(u) + d[n - x + j] * Math.sqrt(1 - u); }   // (its end run into its start: a seamless loop)
  }
  return b;
}
export function waters(list) {
  if (!ctx) return; const t = now(), seen = new Set();
  for (const w of list) {
    seen.add(w.id); let s = WATERS.get(w.id);
    if (!s) {
      s = { g: ctx.createGain(), p: ctx.createStereoPanner(), lp: ctx.createBiquadFilter(), src: [], kind: w.kind, r: rnd(0.94, 1.06), ph: rnd(0, 6.28) }; s.g.gain.value = 0; s.lp.type = 'lowpass'; s.lp.Q.value = 0.5; s.lp.connect(s.g).connect(s.p).connect(ambW); WATERS.set(w.id, s);
      const loop = (buf, rate, vol, filt) => { const g = ctx.createGain(); g.gain.value = vol; let n = g; if (filt) { const f = ctx.createBiquadFilter(); [f.type, f.frequency.value, f.Q.value] = filt; g.connect(f); n = f; } n.connect(s.lp); s.src.push(loopOf(buf, rate * s.r, g)); };
      const rec = (k, rates, vol, filt) => { if (!META[k]) return; fetchOne(k, 0).then((buf) => { if (buf && !s.gone) for (const r of rates) loop(buf, r, vol, filt); }); };
      if (w.kind === 'stream') { babbleBuf ||= makeBabble(9); loop(babbleBuf, 1, 0.55); loop(babbleBuf, 0.83, 0.35, ['highpass', 500, 0.5]); rec('bedStream', [0.97, 1.03], 0.5); }
      else if (w.kind === 'fall') { loop(brownBuf, 0.9, 1.1, ['lowpass', 420, 0.6]); loop(noiseBuf, 1, 0.22, ['bandpass', 1300, 0.5]); babbleBuf ||= makeBabble(9); loop(babbleBuf, 0.55, 0.5, ['lowpass', 1600, 0.5]); rec('bedStream', [0.52, 0.61], 0.6); }
      else { rec('bedWaves', [0.85], 0.8, ['lowpass', 1300, 0.5]); if (!META.bedWaves) loop(brownBuf, 0.7, 0.5, ['lowpass', 350, 0.5]); }
      AUDIO.log?.push({ k: 'water:' + w.id, i: -1, t, water: w.kind, bus: 'amb' });
    }
    // (a fall carries a long way, swelling slowly as the spray gusts; a stream only some tens of metres)
    const sp = w.kind === 'fall' ? spatial(w, 18, 420) : w.kind === 'stream' ? spatial(w, 4, 55) : spatial(w, 6, 45), swell = w.kind === 'fall' ? 0.85 + 0.15 * Math.sin(t * 0.6 + s.ph) * Math.sin(t * 0.23 + s.ph * 1.7) : 1;
    ease(s.g.gain, (w.kind === 'fall' ? 0.95 : w.kind === 'stream' ? 0.42 : 0.3) * Math.min(1.3, w.k) * sp.k * swell, 0.3, t); ease(s.p.pan, sp.pan, 0.12, t); ease(s.lp.frequency, Math.min(16000, sp.lp), 0.2, t);
  }
  for (const [id, s] of WATERS) if (!seen.has(id)) { s.gone = true; s.g.gain.setTargetAtTime(0, t, 0.5); WATERS.delete(id); setTimeout(() => { s.src.forEach((x) => x.stop()); s.g.disconnect(); }, 3000); }
}
// ---- meat sizzling on a cooking stand over a fire (PLACE.cook): a hot, fluttering hiss from where it hangs, a fat
// drop spitting now and then
const SIZZLE = new Map();
function sizzles(dt) {
  const t = now(), seen = new Set();
  for (const c of PLACE.cook || []) {
    seen.add(c.id); let s = SIZZLE.get(c.id);
    if (!s) { const src = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), bp = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner(); src.buffer = noiseBuf; src.loop = true; hp.type = 'highpass'; hp.frequency.value = 3200; hp.Q.value = 0.6; bp.type = 'peaking'; bp.frequency.value = 6000; bp.gain.value = 5; bp.Q.value = 0.8; g.gain.value = 0;
      src.connect(hp).connect(bp).connect(g).connect(p).connect(ambBus); src.start(0, Math.random() * 3); s = { src, g, p }; SIZZLE.set(c.id, s); AUDIO.log?.push({ k: 'sizzle', i: -1, t, fire: c.id, bus: 'amb' }); }
    const sp = spatial(c, 2, 18); ease(s.g.gain, 0.3 * c.k * sp.k * (0.75 + 0.25 * Math.sin(t * 7.3 + Math.sin(t * 2.1) * 2)), 0.08, t); ease(s.p.pan, sp.pan, 0.1, t);
    if (sp.k > 0.05 && Math.random() < dt * 5 * c.k) noise(rnd(0.006, 0.02), { freq: rnd(2500, 6500), q: 2, vol: rnd(0.08, 0.2) * sp.k * c.k, attack: 0.001, wet: 0.02, pan: sp.pan, bus: ambBus });
  }
  for (const [id, s] of SIZZLE) if (!seen.has(id)) { SIZZLE.delete(id); s.g.gain.setTargetAtTime(0, t, 0.3); setTimeout(() => { s.src.stop(); s.g.disconnect(); }, 1500); }
}

// ---- the world's ambience, called every frame with what's around the player
// { wind 0..1, gust 0..1, windDir {x, z}, rain 0..1, night 0..1, dusk 0..1, fire 0..1, inside 0/1 (walls round you), roof
//   0/1, forest 0..1 (trees round you), deep 0..1 (trees just where you stand), marsh 0..1, sea 0..1, pedias, yleos 0..1
//   (how much each land it is where you stand) }, and PLACE (music.js: caves, halls, height, fog, the morning)
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
  if (!ctx) return; const t = now(), sh = (name, v, tc, freq) => synth(name, v, tc, freq, dt);
  follow(); sizzles(dt);
  const sk = stormK * stormK, wind = Math.max(w.wind ?? 0.3, sk);
  const { rain = 0, night = 0, dusk = 0, fire = 0, inside = 0, roof = 0, forest = 0, deep = 0, marsh = 0, sea = 0, pedias = 1 - (w.yleos ?? 0), yleos = 0 } = w, open = 1 - inside * 0.75;
  shut = Math.max(inside, roof * 0.6);
  // the room: the world outside muffled through walls (much) or under a roof (a little), and the stone hall's ring by
  // place (a cave, the labyrinth's walls, a house's room a little)
  ease(ambW.frequency, inside ? 1200 : roof ? 2500 : 20000, 0.4, t);
  roomK = Math.min(1, Math.max(PLACE.cave, PLACE.hall * 0.85, PLACE.house * 0.4)); ease(airOut.gain, 0.5 * (1 - roomK * 0.7), 0.5, t); ease(hallOut.gain, 0.6 * roomK, 0.5, t);
  // high on Olympos (hi): no meadow under you, the wind thin and strong; in fog the wind falls quieter and the birds hush
  const hi = sstep(200, 330, PLACE.alt), fog = PLACE.fog || 0, still = 1 - 0.5 * fog;
  // wind: a slow random walk of gusts, or the wind's own (wind.js); its recorded beds by its strength, a soft breeze, a
  // steady wind and a gale, each swelling with the gusts; a gust of its own on each strong gust, from upwind (all of it
  // under MIX.wind, the beds as swell does)
  if (w.gust !== undefined) gust += (Math.min(1, wind * 0.6 + w.gust * 0.8) - gust) * Math.min(1, dt * 1.5);
  else { gustT -= dt; if (gustT <= 0) { gustT = rnd(2, 7); gustTo = Math.min(1, Math.max(0, wind + rnd(-0.25, 0.4))); } gust += (gustTo - gust) * Math.min(1, dt * 0.6); }
  const swell = (0.75 + 0.5 * gust) * MIX.wind, recWind = bed('bedWindSoft', 0.25 * (1 - sstep(0.35, 0.8, wind)) * swell * open * still * (1 - hi * 0.5), dt);
  bed('bedWindMid', (0.38 * sstep(0.1, 0.5, wind) * (1 - 0.6 * sstep(0.6, 1, wind)) * still + 0.15 * hi) * swell * open, dt); bed('bedWindStrong', Math.max(0.5 * sstep(0.45, 0.95, wind), 0.32 * hi) * swell * open, dt);
  const ww = recWind ? 0.25 : 1;   // (the synthesised wind under the recordings: only its low rumble and whistle in a gale)
  sh('windLow', (0.05 + gust * 0.22) * open * ww * still * MIX.wind, 0.6, 220 + gust * 420); sh('windHigh', gust * gust * 0.08 * open * ww * still * MIX.wind, 0.6, 600 + gust * 900);
  sh('whistle', Math.max(Math.max(0, gust - 0.65) * 0.05, hi * 0.012 * (0.5 + gust)) * open * ww * MIX.wind, 0.6, 1200 + gust * 900 + Math.sin(t * 0.7) * 150);
  const g1 = w.gust ?? gust; if (g1 > 0.32 && gustWas <= 0.32 && t - gustAt > 7 && open > 0.5) { gustAt = t; const d = w.windDir, pn = d ? Math.max(-0.8, Math.min(0.8, -(d.x * -L.fz + d.z * L.fx))) : rnd(-0.6, 0.6);
    play('windGust', { vol: (0.25 + 0.4 * wind) * open * still * MIX.wind, pan: pn, wet: 0.2, bus: ambBus, rate: [0.9, 1.05] }); if (forest > 0.3) play('leafRustle', { vol: 0.35 * forest, pan: -pn * 0.5, wet: 0.2, bus: ambBus, delay: 0.4 }); }
  gustWas = g1;
  // the wind in the leaves, wherever trees stand round you, by day and by night: a soft bed that swells with the gusts;
  // and in the open meadow the wind through the grass (none above the meadows, on Olympos's bare head)
  const sway = 0.7 + 0.3 * Math.sin(t * 0.37) * Math.sin(t * 0.23 + 1), recLeaves = bed('bedLeaves', forest * (0.2 + gust * 0.35) * sway * open * (1 - hi), dt);
  bed('bedGrass', pedias * (1 - forest) * (0.12 + gust * 0.18) * open * (1 - rain * 0.5) * (1 - hi) * MIX.wind, dt);
  const lw = recLeaves ? 0.35 : 1;
  sh('leaves', forest * (0.035 + gust * 0.09) * sway * open * lw * (1 - hi), 1.2); sh('leavesLo', forest * (0.05 + gust * 0.1) * sway * open * lw * (1 - hi), 1.2, 900 + gust * 500);
  // rain: droplets in a light rain, the rush of a downpour in a heavy one (2 dB under the other beds: a downpour is a bed,
  // not a roar); under a roof the drumming on it, and inside (walls round you too) only a muffled hush through them
  const out1 = (1 - inside * 0.92) * (roof && !inside ? 0.55 : 1), recRain = bed('bedDrops', sstep(0.02, 0.3, rain) * (1 - 0.5 * sstep(0.6, 1, rain)) * 0.6 * out1, dt);
  bed('bedRain', sstep(0.45, 1, rain) * 0.48 * out1, dt); bed('bedRoof', roof ? rain * 0.6 * (1 - inside * 0.5) : 0, dt, { tc: 0.4, bus: ambBus }); bed('bedMuffled', inside ? rain * 0.75 : 0, dt, { bus: ambBus });
  const L1 = (k, v) => bed(k, v, dt, { tc: 0.8, rate: k === 'loopCrickets' ? 0.32 : 1 });   // (the first pack's loops, where there's no recording of the team's)
  if (!recRain) L1('loopRain', rain * 0.45 * (1 - inside * 0.8) * (roof ? 0.6 : 1));
  L1('loopStorm', Math.max(recRain ? 0 : rain - 0.6, sk * 0.7) * 1.2 * (1 - inside * 0.7));   // (the storm wall's own)
  sh('roar', (stormK * 0.12 + sk * 0.3) * (1 - inside * 0.5), 1.5, 90 + gust * 60);
  const rr = recRain ? 0.15 : 1;
  sh('rainHiss', rain * 0.2 * (1 - inside * 0.8) * (roof ? 0.6 : 1) * (META.loopRain ? 0.3 : 1) * rr); sh('rainBody', rain * rain * 0.3 * (1 - inside * 0.6) * rr);
  sh('roof', roof ? rain * 0.22 * rr : 0, 0.4);
  dropT -= dt; if (rain > 0.15 && dropT <= 0 && !recRain) { dropT = rnd(0.01, 0.06) / rain;
    if (roof) noise(rnd(0.03, 0.07), { type: 'lowpass', freq: rnd(900, 1600), vol: rnd(0.03, 0.09) * rain, pan: rnd(-0.8, 0.8), bus: ambBus, wet: 0.05 });
    else noise(rnd(0.015, 0.04), { freq: rnd(2200, 6000), q: rnd(1, 4), vol: rnd(0.015, 0.05) * rain * open, pan: rnd(-0.9, 0.9), bus: ambBus, wet: 0 }); }
  // the sea: waves on the shore near it (sea: how much of the land round you is sea), breathing in long swells
  const recSea = bed('bedWaves', sea * 0.5 * open, dt, { tc: 1.5 });
  sh('sea', sea * (0.1 + 0.08 * Math.sin(t * 0.7) + 0.05 * Math.sin(t * 0.31)) * open * (recSea ? 0.2 : 1), 0.8, 380 + 160 * Math.sin(t * 0.7));
  // fire: a low roar and crackles (only where the fires have no recording of their own: fires())
  const fk = META.bedFire ? 0 : fire; sh('fire', fk * 0.16, 0.2);
  if (fk > 0.1 && Math.random() < dt * 9 * fk) noise(rnd(0.01, 0.04), { freq: rnd(1800, 5000), q: 3, vol: rnd(0.04, 0.12) * fk, pan: rnd(-0.3, 0.3), bus: ambBus, wet: 0.05 });
  // creatures: birds by day, rising with the light and loudest at sunrise (the first pack's dawn chorus over them, the
  // first hour or so); crickets from dusk on (not at dawn), owls, a fox far off and frogs by night; the forest and the
  // marsh have their own. The crickets sing most in the open and at the woods' edges (deep: how wooded it is just where
  // you stand), swelling as the light goes and dying away at first light; the meadows' and the forest's each their own.
  // Fog hushes the birds; high on Olympos there are none, nor crickets. In the rain no bird sings (dry: Patch 25, they
  // went on at a sixth under a downpour): they fall silent as it starts, gone by a drizzle's first minutes, and sing
  // again as it stops; nor do the owls call.
  const calm = (1 - rain * 0.85) * open, low = 1 - hi, dry = 1 - sstep(0.02, 0.15, rain), dawn = PLACE.morning ? sstep(0.05, 0.5, dusk) * (1 - night) : 0;
  const crick = Math.min(1, night * 1.2 + (PLACE.morning ? 0 : dusk * 0.6)) * Math.max(0, 1 - rain / 0.3) * (1 - deep * 0.55) * low, light = sstep(0.1, 0.6, 1 - night);
  const birds = calm * dry * light * 0.42 * (1 - marsh * 0.6) * (1 + 0.4 * dawn) * (1 - 0.6 * fog) * (1 - hi * 0.9);
  const recBirds = bed('bedBirds', birds, dt, { tc: 2 }); bed('loopBirds', recBirds ? dawn * calm * dry * 0.32 * (1 - 0.6 * fog) * low : birds, dt, { tc: recBirds ? 3 : 0.8 });   // (the dawn chorus, or the old chorus all day without the team's)
  const recCrick = bed('bedCricketsP', calm * crick * 0.38 * Math.min(1, pedias * 1.4), dt, { tc: 2 }); bed('bedCricketsY', calm * crick * 0.42 * Math.min(1, yleos * 1.4), dt, { tc: 2 });
  if (!recCrick) L1('loopCrickets', calm * crick * 0.24);
  birdT -= dt; if (birdT <= 0) { birdT = rnd(1.5, 6) / (1 + forest * 0.6) * (recBirds || META.loopBirds ? 3 : 1); if (light > 0.5 && calm > 0.2 && dry > 0.5 && !recBirds) bird(calm * dry * light * low); }   // (calls of their own over the first pack's chorus too, now and then)
  // a cricket singing near you: a few chirps from one side, then quiet (bouts of them over the old chorus, or on their own)
  crickT -= dt; if (crickT <= 0 && !recCrick) { crickT = META.loopCrickets ? rnd(0.8, 3) : rnd(0.25, 0.7);
    if (crick > 0.2 && calm > 0.2) { const f = rnd(4200, 4900), p = rnd(-0.8, 0.8), n = 2 + Math.floor(Math.random() * 4), v = 0.016 * calm * crick;
      for (let k = 0; k < n; k++) for (let i = 0; i < 3; i++) tone(f, 0.022, { vol: v, attack: 0.004, delay: k * 0.33 + i * 0.045, pan: p, wet: 0.15, bus: ambBus }); } }
  // an owl now and then, off in the trees: the team's hoots, or a long hoot, a pause, then a soft wavering one (the
  // tawny owl's call)
  owlT -= dt; if (owlT <= 0) { owlT = rnd(25, 60); if (night > 0.5 && dry > 0.5 && low > 0.5) { const p = rnd(-0.7, 0.7);
    if (!play('owlHoot', { vol: 0.16 * calm * (0.4 + forest * 0.6), pan: p, wet: 0.7, bus: ambBus, lp: 3500, rate: [0.94, 1.02] })) { const f = rnd(360, 400), v = 0.07 * calm, o = { type: 'sine', pan: p, wet: 0.75, bus: ambBus };
      tone(f, 0.6, { ...o, vol: v, slide: -18, attack: 0.07 }); tone(f * 0.94, 0.25, { ...o, vol: v * 0.6, attack: 0.05, delay: 1.5 });
      for (let i = 0; i < 4; i++) tone(f * (0.96 - i * 0.004), 0.16, { ...o, vol: v * 0.8, attack: 0.03, delay: 1.9 + i * 0.17 }); } } }
  // a fox crying far off, rarely
  foxT -= dt; if (foxT <= 0) { foxT = rnd(70, 160); if (night > 0.6 && rain < 0.3 && low > 0.5) sample('foxCry', { vol: 0.16 * calm, pan: rnd(-0.8, 0.8), wet: 0.6, rate: [0.9, 1.05], bus: ambBus }); }
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
  if (!AUDIO._m) { AUDIO._m = {}; for (const [k, n] of [['sfx', compT], ['amb', ambBus], ['music', fightG], ['lyre', musicBus], ['out', out]]) {
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
