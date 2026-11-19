// The music: the team's tracks, Valheim's way, now and then rather than all the time (the player's choice).
//   A land's track plays once you've been in it a little while after coming into it, and at dawn and at dusk; then it
//   ends and leaves a few minutes (QUIET) to the world's own sounds before another may play. The same track never plays
//   twice running unless a long while has gone by (Main-Menu and Yleos are one recording, and count as one).
//   Inside-Base plays when you've settled at home a short while: sitting or standing by your own lit fire, or under your
//   own roof; it fades as you leave.
//   Main-Menu loops on the title screen and in the character creator; Story-Telling plays as a new trial begins (there is
//   no opening scene: you wake on the shore) and for the owl's first talk.
//   A boss's track starts when the tribute calls it and loops through the fight, fading out when the beast dies or you
//   flee its arena.
//   Each track streams from its own <audio> element through the music bus (sound.js: the settings' music slider, and a
//   dip under loud thunder), fetched only when it first plays; tracks crossfade over a few seconds, and a looped one
//   crossfades into a fresh start of itself near its end.
import { AUDIO, LYRE } from './sound.js';
import { biomeWeights, biomeAt } from '../world/gen.js';
import { LIGHT } from '../world/sky.js';

const DIR = new URL('../../assets/sounds/pack/music/', import.meta.url);
const QUIET = [180, 360], SETTLE = 20, HOME = 8, FADE = 3;
const LAND = ['pedias', 'yleos', 'swamp'];
const rnd = (a, b) => a + Math.random() * (b - a);
// what plays and what has: the tracks sounding now (the last one is the current one, the others fading out), when each
// last ended, and the director's state; log (an array, for the tests) gets every track started ({ key, t })
export const MUSIC = { playing: [], log: null, ended: {}, quiet: 60, last: null, t: 0, D: { land: -1, landT: 0, landNew: false, dawn: 0, homeT: 0, awayT: 0, begun: false, owl: false } };
const same = (a, b) => !!a && !!b && (AUDIO.music[a]?.same || a) === (AUDIO.music[b]?.same || b);
const current = () => MUSIC.playing.find((p) => !p.out) || null;

function start(key, { loop = false, fade = FADE } = {}) {
  const o = AUDIO.musicOut(), meta = AUDIO.music[key]; if (!o || !meta || meta.play === false) return false;
  for (const p of MUSIC.playing) stop(p, fade);
  const el = new Audio(new URL(`${key}.mp3`, DIR).href); el.preload = 'auto';
  const src = o.ctx.createMediaElementSource(el), g = o.ctx.createGain(); g.gain.value = 0.0001; src.connect(g).connect(o.bus);
  g.gain.setTargetAtTime(1, o.ctx.currentTime, fade / 3);
  const p = { key, el, src, g, loop, t: 0, ctx: o.ctx }; MUSIC.playing.push(p); MUSIC.last = key; LYRE.off = true;
  el.addEventListener('ended', () => { if (!p.out) end(p); });
  el.play().catch(() => {}); MUSIC.log?.push({ key, t: MUSIC.t });
  return true;
}
function stop(p, fade = FADE) { if (p.out) return; p.out = fade * 2; p.g.gain.setTargetAtTime(0.0001, p.ctx.currentTime, fade / 3); if (!p.loop) MUSIC.ended[p.key] = MUSIC.t; }
function end(p) { p.out = 0.01; MUSIC.ended[p.key] = MUSIC.t; if (!p.loop) MUSIC.quiet = rnd(...QUIET); }
function release(p) { p.el.pause(); p.el.removeAttribute('src'); p.el.load(); p.src.disconnect(); p.g.disconnect(); MUSIC.playing.splice(MUSIC.playing.indexOf(p), 1); }

// a track now (key; loop: round and round), or all of them faded out (the director picks up again from there)
export const playTrack = (key, o) => start(key, o);
export function stopMusic(fade = FADE) { for (const p of MUSIC.playing) stop(p, fade); }

// the land's track, if it may play now: nothing playing, the quiet over, and not the one just heard (unless it was long ago)
function mayPlay(key) { return !current() && MUSIC.quiet <= 0 && AUDIO.music[key] && (!same(key, MUSIC.last) || MUSIC.t - (MUSIC.ended[MUSIC.last] ?? -1e9) > 600); }

// Called every frame (main.js) with the game
export function updateMusic(dt, g) {
  MUSIC.t += dt; const D = MUSIC.D;
  for (const p of [...MUSIC.playing]) {
    p.t += dt;
    if (p.out) { if ((p.out -= dt) <= 0) release(p); continue; }
    if (p.loop && p.el.duration > 8 && p.el.currentTime > p.el.duration - FADE - 0.5) start(p.key, { loop: true });   // (a loop runs on into a fresh start of itself)
  }
  if (!current()) { MUSIC.quiet -= dt; if (!MUSIC.playing.length && !Object.keys(AUDIO.music).length) LYRE.off = false; }
  const o = AUDIO.musicOut(); if (!o || o.ctx.state !== 'running' || !Object.keys(AUDIO.music).length) return;   // (nothing until the first click lets sound play, and the pack is read)
  const cur = current();
  // the title screen and the character creator
  if (!g.started) { if (cur?.key !== 'menu') start('menu', { loop: true }); return; }
  if (cur?.key === 'menu') stop(cur);
  // a boss fight
  const boss = g.trial?.boss, kind = boss && !boss.dead ? g.trial.bossKind : g.trial?.calling, bk = kind ? (kind === 'chimera' ? 'bossChimera' : 'bossMinotaur') : null;
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
  // the lands: coming into one (after a little while in it), and dawn and dusk (LIGHT.dusk rising: the sun at the horizon)
  const w = biomeWeights(P.pos.x, P.pos.z), b = biomeAt(P.pos.x, P.pos.z);
  if ([w.p, w.y, w.v][b] > 0.75 && b !== D.land) { D.land = b; D.landT = 0; D.landNew = true; }
  D.landT += dt; if (D.landNew && D.landT > SETTLE + 120) D.landNew = false;   // (too long waiting for the quiet to end: let it go)
  if (LIGHT.dusk > 0.5 && !D.duskWas) D.dawn = 60; D.duskWas = LIGHT.dusk > 0.5; D.dawn -= dt;
  const key = LAND[D.land >= 0 ? D.land : b];
  if (((D.landNew && D.landT > SETTLE) || D.dawn > 0) && !P.dead && mayPlay(key)) { D.landNew = false; D.dawn = 0; start(key); }
}
