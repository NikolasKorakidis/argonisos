// The music: the team's tracks, Valheim's way, now and then rather than all the time (the player's choice).
//   A place's track plays once you've been in it a little while after coming into it, and at dawn and at dusk; then it
//   ends and leaves a few minutes (QUIET) to the world's own sounds before another may play. The places: each land
//   (Pedias, Yleos, Valtos behind the storm), the climb up Olympos (Oros), the Giants' caves (Erebos, which is also a
//   land's track when you come into it by night), and the shore at dawn and dusk (Nisia and Siren Reef in turn). The same
//   track never plays twice running unless a long while has gone by (Main-Menu and Yleos are one recording, and count as
//   one; so are Story-Telling and the Swamp's).
//   Inside-Base plays when you've settled at home a short while: sitting or standing by your own lit fire, or under your
//   own roof; it fades as you leave.
//   Main-Menu loops on the title screen and in the character creator; Story-Telling plays as a new trial begins (there is
//   no opening scene: you wake on the shore) and for the owl's first talk.
//   A boss's track starts when the tribute calls it and loops through the fight, fading out when the beast dies or you
//   flee its arena, and through the fight it plays louder over a quieter world (sound.js setFight).
//   A track streams from its own <audio> element through the music bus (sound.js: the settings' music slider, and a dip
//   under loud thunder), fetched only when it first plays; tracks crossfade over a few seconds. A looped one (the title's,
//   the bosses') is decoded whole when it starts and looped to the sample between the loop points sounds.mjs found in it
//   (sounds.json loop): its intro plays once and its outro never; without them it crossfades into a fresh start of itself.
//   It also tells sound.js where the listener is (PLACE: a cave, the labyrinth's hall, a house, how high, the fog, the
//   morning, the snow, the marsh, the cooking stands sizzling), since it watches the world for the music anyway.
import { AUDIO, LYRE, setFight, PLACE } from './sound.js';
import { biomeWeights, biomeAt, PEAK } from '../world/gen.js';
import { LIGHT } from '../world/sky.js';
import { WEATHER } from '../world/weather.js';

const DIR = new URL('../../assets/sounds/pack/music/', import.meta.url);
const QUIET = [180, 360], SETTLE = 20, HOME = 8, FADE = 3;
const LAND = ['pedias', 'yleos', 'swamp'], SHORE = ['nisia', 'sirenReef'];
const rnd = (a, b) => a + Math.random() * (b - a);
// what plays and what has: the tracks sounding now (the last one is the current one, the others fading out), when each
// last ended, and the director's state; log (an array, for the tests) gets every track started ({ key, t })
export const MUSIC = { playing: [], log: null, ended: {}, quiet: 60, last: null, t: 0, D: { land: -1, landT: 0, landNew: false, dawn: 0, homeT: 0, awayT: 0, begun: false, owl: false, shore: 0, placeT: 0, elev: 0 } };
const same = (a, b) => !!a && !!b && (AUDIO.music[a]?.same || a) === (AUDIO.music[b]?.same || b);
const current = () => MUSIC.playing.find((p) => !p.out) || null;

function start(key, { loop = false, fade = FADE } = {}) {
  const o = AUDIO.musicOut(), meta = AUDIO.music[key]; if (!o || !meta || meta.play === false) return false;
  for (const p of MUSIC.playing) stop(p, fade);
  const g = o.ctx.createGain(); g.gain.value = 0.0001; g.connect(o.bus);
  const p = { key, g, loop, t: 0, ctx: o.ctx }; MUSIC.playing.push(p); MUSIC.last = key; LYRE.off = true; MUSIC.log?.push({ key, t: MUSIC.t });
  if (loop && meta.loop) {   // (decoded and looped between its loop points, faded in once it's in)
    fetch(new URL(`${key}.mp3`, DIR)).then((r) => r.arrayBuffer()).then((b) => o.ctx.decodeAudioData(b)).then((buf) => {
      if (p.out) return; const s = o.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = meta.loop[0]; s.loopEnd = Math.min(meta.loop[1], buf.duration); s.connect(g); s.start(); p.buf = s; g.gain.setTargetAtTime(1, o.ctx.currentTime, fade / 3);
    }).catch(() => {});
    return true;
  }
  const el = new Audio(new URL(`${key}.mp3`, DIR).href); el.preload = 'auto'; p.el = el; p.src = o.ctx.createMediaElementSource(el); p.src.connect(g);
  g.gain.setTargetAtTime(1, o.ctx.currentTime, fade / 3);
  el.addEventListener('ended', () => { if (!p.out) end(p); });
  el.play().catch(() => {});
  return true;
}
function stop(p, fade = FADE) { if (p.out) return; p.out = fade * 2; p.g.gain.setTargetAtTime(0.0001, p.ctx.currentTime, fade / 3); if (!p.loop) MUSIC.ended[p.key] = MUSIC.t; }
function end(p) { p.out = 0.01; MUSIC.ended[p.key] = MUSIC.t; if (!p.loop) MUSIC.quiet = rnd(...QUIET); }
function release(p) {
  if (p.el) { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); p.src.disconnect(); }
  if (p.buf) { try { p.buf.stop(); } catch { /* not started */ } p.buf.disconnect(); p.buf = null; }   // (and its decoded sound let go)
  p.out = p.out || 0.01; p.g.disconnect(); MUSIC.playing.splice(MUSIC.playing.indexOf(p), 1);
}

// a track now (key; loop: round and round), or all of them faded out (the director picks up again from there)
export const playTrack = (key, o) => start(key, o);
export function stopMusic(fade = FADE) { for (const p of MUSIC.playing) stop(p, fade); }

// the place's track, if it may play now: nothing playing, the quiet over, and not the one just heard (unless it was long ago)
function mayPlay(key) { return !current() && MUSIC.quiet <= 0 && AUDIO.music[key] && AUDIO.music[key].play !== false && (!same(key, MUSIC.last) || MUSIC.t - (MUSIC.ended[MUSIC.last] ?? -1e9) > 600); }

// Where the listener is, for sound.js (twice a second): a cave, the labyrinth's walls round you, a house, the height,
// the fog, the morning (the sun climbing), Olympos's snow, the marsh, and the cooking stands with meat over a lit fire
function sense(g, D) {
  const P = g.player.pos, s = g.structures, lab = g.SITES?.labyrinth, e = LIGHT.elev ?? 0;
  if (Math.abs(e - D.elev) > 1e-4) { PLACE.morning = e > D.elev; D.elev = e; }
  PLACE.cave = s?.inCave?.(P) ? 1 : 0; PLACE.hall = lab && Math.hypot(P.x - lab.x, P.z - lab.z) < 24 ? 1 : 0; PLACE.house = g.player.stats?.has?.('underRoof') && g.amb?.walled ? 1 : 0;
  PLACE.alt = P.y; PLACE.fog = WEATHER.k.fog * (1 - WEATHER.k.rain * 0.5); PLACE.snow = PEAK.on && P.y > PEAK.snow - 15 && Math.hypot(P.x - PEAK.x, P.z - PEAK.z) < PEAK.r; PLACE.marsh = biomeWeights(P.x, P.z).v; PLACE.x = P.x; PLACE.z = P.z;
  const cook = []; for (const q of g.build?.placed || []) if (q.def?.cook && q.state?.cook?.some((c) => c.t < c.need * 1.6) && q.pos.distanceTo(P) < 20 && g.build.placed.some((f) => f.def?.fire && f.state?.lit && f.pos.distanceTo(q.pos) < 1.6)) cook.push({ id: q.uid, x: q.pos.x, y: q.pos.y + 1, z: q.pos.z, k: Math.min(1, 0.5 + 0.25 * q.state.cook.length) });
  PLACE.cook = cook;
}

// Called every frame (main.js) with the game
export function updateMusic(dt, g) {
  MUSIC.t += dt; const D = MUSIC.D;
  for (const p of [...MUSIC.playing]) {
    p.t += dt;
    if (p.out) { if ((p.out -= dt) <= 0) release(p); continue; }
    if (p.loop && p.el && p.el.duration > 8 && p.el.currentTime > p.el.duration - FADE - 0.5) start(p.key, { loop: true });   // (a loop without loop points runs on into a fresh start of itself)
  }
  if (!current()) { MUSIC.quiet -= dt; if (!MUSIC.playing.length && !Object.keys(AUDIO.music).length) LYRE.off = false; }
  if (g.started && g.player && (D.placeT -= dt) <= 0) { D.placeT = 0.5; sense(g, D); }
  const o = AUDIO.musicOut(); if (!o || o.ctx.state !== 'running' || !Object.keys(AUDIO.music).length) return;   // (nothing until the first click lets sound play, and the pack is read)
  const cur = current();
  // the title screen and the character creator
  if (!g.started) { if (cur?.key !== 'menu') start('menu', { loop: true }); return; }
  if (cur?.key === 'menu') stop(cur);
  // a boss fight
  const boss = g.trial?.boss, kind = boss && !boss.dead ? g.trial.bossKind : g.trial?.calling, bk = kind ? (kind === 'chimera' ? 'bossChimera' : 'bossMinotaur') : null;
  setFight(bk ? 1 : 0);
  if (bk) { if (cur?.key !== bk) start(bk, { loop: true, fade: 2 }); return; }
  if (cur?.key.startsWith('boss')) { stop(cur, 4); MUSIC.quiet = rnd(...QUIET); return; }
  // the story: a new trial begins; the owl's first talk
  if (!D.begun) { D.begun = true; if (!g.loaded) { start('story'); return; } MUSIC.quiet = 90; }
  if (!D.owl && g.owl?.open && g.owl.talked?.includes('intro')) { D.owl = true; if (cur?.key !== 'story' && MUSIC.t - (MUSIC.ended.story ?? -1e9) > 20) { start('story'); return; } }
  // home: by your own lit fire (sitting or standing), or under your own roof
  const P = g.player, home = !P.dead && (!!g.build?.nearFire(P.pos, 5) || !!g.build?.underRoof(P.pos));
  D.homeT = home ? D.homeT + dt : 0; D.awayT = home ? 0 : D.awayT + dt;
  if (cur?.key === 'base' && D.awayT > 6) { stop(cur, 4); MUSIC.quiet = rnd(60, 120); }
  if (D.homeT > HOME && !cur && MUSIC.t - (MUSIC.ended.base ?? -1e9) > 240 && MUSIC.t - Math.max(0, ...Object.values(MUSIC.ended)) > 45) { start('base'); return; }
  // the places: coming into one (after a little while in it), and dawn and dusk (LIGHT.dusk rising: the sun at the horizon).
  // A place is a land (0..2) well inside it, the Giants' caves ('cave'), or the climb up Olympos ('oros': high on its flanks)
  const w = biomeWeights(P.pos.x, P.pos.z), b = biomeAt(P.pos.x, P.pos.z), oros = PEAK.on && P.pos.y > 150 && Math.hypot(P.pos.x - PEAK.x, P.pos.z - PEAK.z) < PEAK.r * 0.8;
  const zone = PLACE.cave ? 'cave' : oros ? 'oros' : [w.p, w.y, w.v][b] > 0.75 || typeof D.land !== 'number' ? b : D.land;   // (out of a cave or off the mountain: the land you're in)
  if (zone !== D.land) { D.land = zone; D.landT = 0; D.landNew = true; D.night = LIGHT.night > 0.6; }
  D.landT += dt; if (D.landNew && D.landT > SETTLE + 120) D.landNew = false;   // (too long waiting for the quiet to end: let it go)
  if (LIGHT.dusk > 0.5 && !D.duskWas) D.dawn = 60; D.duskWas = LIGHT.dusk > 0.5; D.dawn -= dt;
  // (the track: the cave's, the mountain's, the shore's at dawn and dusk, Erebos for a land come into by night, else the land's)
  const shore = (g.amb?.sea ?? 0) > 0.3 && D.dawn > 0 && typeof zone === 'number', key = zone === 'cave' ? 'erebos' : zone === 'oros' ? 'oros' : shore ? SHORE[D.shore % 2] : D.landNew && D.night ? 'erebos' : LAND[zone >= 0 ? zone : b];
  const settle = zone === 'cave' ? 8 : SETTLE;
  if (((D.landNew && D.landT > settle) || D.dawn > 0) && !P.dead && mayPlay(key)) { D.landNew = false; D.dawn = 0; if (shore) D.shore++; start(key); }
}
