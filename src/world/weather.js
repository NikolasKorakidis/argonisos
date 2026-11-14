// Weather and biome atmosphere.
// Mood: each biome has its own light and air, blended by where you stand. Pedias is bright and clear, Yleos dim under
// the canopy with mist in the valleys, Valtos dark, foggy and always drizzling.
// Weather: rolled per biome from its odds (clear, cloudy, light rain, heavy rain, thunderstorm, fog), each spell lasting
// a few minutes (rain at most ten, storms at most four), and eased in and out so nothing snaps.
// Fog comes in three levels: a fog (you see some 30 m), a thick fog (half that) and a dense one (about 10 m, the world
// past it gone), the thicker ones rarer, likelier in the forest and the marsh and the dense one mostly by night and in
// the early morning. A fog rolls in and out over a minute or so, and from one level to the next as slowly.
import * as THREE from 'three';
import { scene } from '../render/core.js';
import { biomeWeights, BIOME } from './gen.js';
import { clamp, lerp } from '../util/math.js';
import { updateWetness } from './wetness.js';
import { updateRain } from './rain.js';
import { WIND, updateWind } from './wind.js';
import { skyStrike, LIGHTNING } from './lightning.js';
import { LENS } from '../render/lensdirt.js';

const TYPES = {
  clear: { overcast: 0, rain: 0, fog: 0 },
  cloudy: { overcast: 0.55, rain: 0, fog: 0.1 },
  lightRain: { overcast: 0.75, rain: 0.45, fog: 0.25 },
  heavyRain: { overcast: 0.92, rain: 1, fog: 0.4 },
  thunder: { overcast: 1, rain: 1, fog: 0.35, storm: true },
  fog: { overcast: 0.45, rain: 0, fog: 1 },   // (the sun only a pale disc through it: the light is dimmed below, the fog itself pale)
  thickFog: { overcast: 0.45, rain: 0, fog: 1, close: 1 },   // (close: the fog's level, 0 a fog, 1 thick, 2 dense: FOG_FAR)
  denseFog: { overcast: 0.45, rain: 0, fog: 1, close: 2 },
};
const ODDS = [   // per biome: [type, chance %] (fog is rolled alongside, as the GDD lists it separately)
  [['clear', 70], ['cloudy', 10], ['lightRain', 10], ['heavyRain', 5], ['thunder', 5]],
  [['clear', 20], ['cloudy', 50], ['lightRain', 10], ['heavyRain', 10], ['thunder', 10]],
  [['lightRain', 90], ['heavyRain', 5], ['thunder', 5]],
];
// Fog: the chance a dry spell (a drizzle in the marsh, where it is never dry) is foggy instead, per biome, a third more
// by night and in the early morning; then which level, by weight [fog, thick, dense], the dense one's weight from a
// third by day to four times by night and at first light. Per level, how far you see in it (the far edge, from the
// camera, some 5 m behind the hero) and where it starts (a fog's near edge comes from the biome's mood, as before).
const FOG_CHANCE = [0.12, 0.3, 0.4], FOG_LEVELS = [[75, 20, 5], [55, 30, 15], [45, 33, 22]];
const FOG_FAR = [32, 18, 12], FOG_NEAR = [null, 3, 3.5];
const MAX_MIN = { heavyRain: 10, lightRain: 10, thunder: 4, denseFog: 7 };
// biome mood: light multiplier, fog near/far (m) and fog tint
const MOOD = [
  { light: 1, near: 300, far: 2400, tint: null },   // the far meadows soften into haze
  { light: 0.42, near: 40, far: 520, tint: new THREE.Color(0x46604c) },
  { light: 0.32, near: 18, far: 260, tint: new THREE.Color(0x4c5236) },
];

export const WEATHER = { type: 'clear', biome: BIOME.PEDIAS, timer: 0, k: { overcast: 0, rain: 0, fog: 0, close: 0 }, mood: { light: 1, near: 300, far: 2400 }, storm: 0, boltT: 8, flash: 0, forced: null, stormRain: 0 };
let rnd = Math.random, first = true;
function roll(biome, light) {
  const list = ODDS[biome]; let t = 0; for (const [, w] of list) t += w; let a = rnd() * t, type = list[0][0];
  for (const [n, w] of list) { a -= w; if (a <= 0) { type = n; break; } }
  const early = clamp(light.night + light.mist, 0, 1);   // (by night and at first light, when the morning mist lies thick: sky.js)
  if ((biome === BIOME.VALTOS ? type === 'lightRain' : type === 'clear' || type === 'cloudy') && rnd() < FOG_CHANCE[biome] * (1 + early / 3)) {
    const [f, th, d] = FOG_LEVELS[biome], wt = th * lerp(0.8, 1.5, early), wd = d * lerp(0.3, 4, early), r = rnd() * (f + wt + wd);
    type = r < f ? 'fog' : r < f + wt ? 'thickFog' : 'denseFog';
  }
  WEATHER.type = type; WEATHER.biome = biome;
  WEATHER.timer = Math.min((3 + rnd() * 7) * 60, (MAX_MIN[type] || 12) * 60);
}

// a full-screen flash (a creature vanishing, an offering taken)
const flashEl = document.createElement('div');
Object.assign(flashEl.style, { position: 'fixed', inset: '0', background: '#eef4ff', opacity: '0', pointerEvents: 'none', transition: 'opacity .08s', zIndex: 5 });
document.body.appendChild(flashEl);

const _w = { p: 1, y: 0, v: 0, r: 0 }, _tint = new THREE.Color(), _tint2 = new THREE.Color(), _wind = new THREE.Vector2();
export function updateWeather(dt, pos, light, { still = false } = {}) {
  const w = biomeWeights(pos.x, pos.z, _w), here = w.v > 0.5 ? BIOME.VALTOS : w.p >= w.y ? BIOME.PEDIAS : BIOME.YLEOS;
  WEATHER.timer -= dt;
  if (WEATHER.forced) { WEATHER.type = WEATHER.forced; }
  else if (here !== WEATHER.biome || WEATHER.timer <= 0) roll(here, light);
  // ease the weather amounts towards the current type; the fog at an even pace, rolling in or lifting over some fifty
  // seconds and closing or opening a level in thirty (as far as you see shrinks by the same share every second: the
  // far edge comes in geometrically, below)
  const T = TYPES[WEATHER.type], e = first ? 1 : Math.min(1, dt * 0.08), toward = (k, to, rate) => (first ? to : k + clamp(to - k, -rate * dt, rate * dt));
  for (const k of ['overcast', 'rain']) WEATHER.k[k] = lerp(WEATHER.k[k], T[k], e);
  WEATHER.k.fog = toward(WEATHER.k.fog, T.fog, 1 / 50); WEATHER.k.close = toward(WEATHER.k.close, T.close || 0, 1 / 30);
  WEATHER.storm = lerp(WEATHER.storm, T.storm ? 1 : 0, e);
  // biome mood, blended by where you stand
  const m = WEATHER.mood;
  const tl = MOOD[0].light * w.p + MOOD[1].light * w.y + MOOD[2].light * w.v, tn = MOOD[0].near * w.p + MOOD[1].near * w.y + MOOD[2].near * w.v, tf = MOOD[0].far * w.p + MOOD[1].far * w.y + MOOD[2].far * w.v;
  const me = first ? 1 : Math.min(1, dt * 0.6); m.light = lerp(m.light, tl, me); m.near = lerp(m.near, tn, me); m.far = lerp(m.far, tf, me);
  first = false;
  // fog: biome mist, thicker at night, pulled in by weather. A real fog (fogK 1) closes to some 30 m, its near edge almost
  // at your feet; the far edge comes in geometrically, so a fog rolling in thickens all the way rather than at the end.
  // A thick or dense fog (its level, close) closes further, to FOG_FAR, its near edge a few metres from the camera so the
  // hero stays clear in it; the night and the rain don't pull those in any further (keep), or you'd lose the hero too
  const fogK = WEATHER.k.fog, night = light.night, lv = WEATHER.k.close, i = Math.min(1, Math.floor(lv)), f = lv - i;
  const nearFull = lerp(FOG_NEAR[i] ?? lerp(m.near, 1, 0.95), FOG_NEAR[i + 1], f), farFull = lerp(FOG_FAR[i], FOG_FAR[i + 1], f), keep = 1 - fogK * Math.min(1, lv) * 0.85;
  // (a fog's near edge comes in evenly, as before; a thick one's geometrically, as the far edge does, so it doesn't rush in
  // at the end; and never past half the far edge on the way)
  scene.fog.near = lerp(lerp(m.near, nearFull, fogK), m.near * Math.pow(nearFull / m.near, fogK), Math.min(1, lv)) * lerp(1, 0.6, night * (1 - w.p * 0.6) * keep);
  scene.fog.far = m.far * Math.pow(Math.min(1, farFull / m.far), fogK) * lerp(1, lerp(1, 0.55, WEATHER.k.rain * 0.6) * lerp(1, 0.7, night), keep);
  scene.fog.near = Math.min(scene.fog.near, scene.fog.far * 0.5);
  _tint.setRGB(0, 0, 0);
  if (w.y > 0.01) _tint.add(MOOD[1].tint.clone().multiplyScalar(w.y)); if (w.v > 0.01) _tint.add(MOOD[2].tint.clone().multiplyScalar(w.v));
  if (w.y + w.v > 0.01) scene.fog.color.lerp(_tint.multiplyScalar(1 / (w.y + w.v)).multiplyScalar(0.35 + light.day * 0.65), clamp(w.y + w.v, 0, 1) * 0.7);
  scene.fog.color.lerp(_tint.setRGB(0.15, 0.175, 0.2).multiplyScalar(0.3 + light.day * 0.7), WEATHER.k.overcast * 0.85);
  // (a fog by day is pale and bright, not slate, the thicker the paler; in the marsh a green grey)
  scene.fog.color.lerp(_tint.setRGB(0.7, 0.73, 0.76).lerp(_tint2.setRGB(0.5, 0.58, 0.46), w.v * 0.8).multiplyScalar(0.25 + light.day * 0.75), fogK * lerp(0.55, 0.75, Math.min(1, lv)) * (1 - night * 0.8));
  // by night the air is moonlit blue everywhere, the forest's too (it fell to a near-black green), less so under cloud;
  // a fog by night a dark blue
  scene.fog.color.lerp(_tint.setHex(0x14214a), night * (w.y + w.v) * 0.75 * (1 - WEATHER.k.overcast * 0.5));
  scene.fog.color.lerp(_tint.setRGB(0.05, 0.075, 0.14).lerp(_tint2.setRGB(0.05, 0.07, 0.06), w.v * 0.5), fogK * night * 0.6);
  // the light on the lens (lensdirt.js): the sun up, and how veiled it is by the fog, the morning mist or a forest's haze
  LENS.day = light.day * clamp(light.elev / 0.08, 0, 1); LENS.veil = clamp(Math.max(fogK * (1 + Math.min(1, lv) * 0.3), light.mist * 0.6, (w.y + w.v) * 0.3), 0, 1.3) * (1 - WEATHER.k.rain * 0.8); LENS.calm = LIGHTNING.soft;
  // the world gets wet in the rain and dries in the sun (and it always rains at the foot of the storm wall: stormwall.js)
  const rainK = Math.max(WEATHER.k.rain, WEATHER.stormRain || 0);
  updateWetness(dt, rainK, light.day * (1 - WEATHER.k.overcast * 0.6));
  // the wind, by the weather; the rain slants with it, as bright as the air
  updateWind(dt, { rain: rainK, storm: Math.max(WEATHER.storm, WEATHER.stormRain || 0), overcast: WEATHER.k.overcast });
  _wind.copy(WIND.dir).multiplyScalar(WIND.speed * (0.7 + WIND.gust * 0.3));
  updateRain(dt, rainK, _wind, 0.22 + light.day * 0.78);
  // lightning (lightning.js): in a thunderstorm a strike every few seconds, more often in a big one and by night, a
  // gust after each; in a downpour now and then a far one, more heard than seen. (still: the screenshot tests, none.)
  WEATHER.boltT -= dt;
  if (!still && WEATHER.boltT <= 0 && (WEATHER.storm > 0.3 || WEATHER.k.rain > 0.85)) {
    const big = WEATHER.storm > 0.3; WEATHER.boltT = big ? (1.2 + rnd() * 6) / (WEATHER.storm * (1 + light.night * 0.6)) : 20 + rnd() * 40;
    if (big) { skyStrike(light.night); WIND.gust = Math.min(1, WIND.gust + 0.3); } else skyStrike(light.night, true);
  }
  // what the sky and lights need: how overcast (a thick fog scatters the sun as a heavy sky does: soft light, faint
  // shadows), and how much light the biome lets through
  return { overcast: Math.max(WEATHER.k.overcast, w.v * 0.6, WEATHER.k.fog * 0.85), dark: (1 - m.light) * (1 - night * 0.55) };   // (by night the woods shut out a little less: the moonlight is all there is)
}
export function setWeather(type) { WEATHER.forced = type || null; if (type) WEATHER.type = type; }
// After a teleport (respawn, fast travel): jump straight to the new place's air instead of easing into it
export function snapWeather() { first = true; WEATHER.timer = 0; }
// A brief white flash of the sky (thunder when a creature vanishes, lightning)
export function flashSky(k = 0.3) { flashEl.style.opacity = String(LIGHTNING.soft ? k * 0.3 : k); setTimeout(() => (flashEl.style.opacity = '0'), 90); }
