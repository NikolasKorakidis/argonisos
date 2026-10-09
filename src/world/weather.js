// Weather and biome atmosphere.
// Mood: each biome has its own light and air, blended by where you stand. Pedias is bright and clear, Yleos dim under
// the canopy with mist in the valleys, Valtos dark, foggy and always drizzling.
// Weather: rolled per biome from its odds (clear, cloudy, light rain, heavy rain, thunderstorm, fog), each spell lasting
// a few minutes (rain at most ten, storms at most four), and eased in and out so nothing snaps.
import * as THREE from 'three';
import { scene, camera } from '../render/core.js';
import { biomeWeights, BIOME } from './gen.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const TYPES = {
  clear: { overcast: 0, rain: 0, fog: 0 },
  cloudy: { overcast: 0.55, rain: 0, fog: 0.1 },
  lightRain: { overcast: 0.75, rain: 0.45, fog: 0.25 },
  heavyRain: { overcast: 0.92, rain: 1, fog: 0.4 },
  thunder: { overcast: 1, rain: 1, fog: 0.35, storm: true },
  fog: { overcast: 0.35, rain: 0, fog: 1 },
};
const ODDS = [   // per biome: [type, chance %] (fog is rolled alongside, as the GDD lists it separately)
  [['clear', 70], ['cloudy', 10], ['lightRain', 10], ['heavyRain', 5], ['thunder', 5]],
  [['clear', 20], ['cloudy', 50], ['lightRain', 10], ['heavyRain', 10], ['thunder', 10]],
  [['lightRain', 90], ['heavyRain', 5], ['thunder', 5]],
];
const FOG_CHANCE = [0.1, 0.3, 0.5];
const MAX_MIN = { heavyRain: 10, lightRain: 10, thunder: 4 };
// biome mood: light multiplier, fog near/far (m) and fog tint
const MOOD = [
  { light: 1, near: 300, far: 2400, tint: null },   // the far meadows soften into haze
  { light: 0.42, near: 40, far: 520, tint: new THREE.Color(0x46604c) },
  { light: 0.32, near: 18, far: 260, tint: new THREE.Color(0x4c5236) },
];

export const WEATHER = { type: 'clear', biome: BIOME.PEDIAS, timer: 0, k: { overcast: 0, rain: 0, fog: 0 }, mood: { light: 1, near: 300, far: 2400 }, storm: 0, boltT: 8, flash: 0, forced: null };
let rnd = Math.random, first = true;
function roll(biome) {
  const list = ODDS[biome]; let t = 0; for (const [, w] of list) t += w; let a = rnd() * t, type = list[0][0];
  for (const [n, w] of list) { a -= w; if (a <= 0) { type = n; break; } }
  if (type === 'clear' && rnd() < FOG_CHANCE[biome]) type = 'fog';
  WEATHER.type = type; WEATHER.biome = biome;
  WEATHER.timer = Math.min((3 + rnd() * 7) * 60, (MAX_MIN[type] || 12) * 60);
}

// ---- rain streaks around the camera
const RAIN_N = 2200, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 6), rainSeed = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { rainSeed[i * 3] = Math.random() * 56 - 28; rainSeed[i * 3 + 1] = Math.random() * 26; rainSeed[i * 3 + 2] = Math.random() * 56 - 28; }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xb8c4d0, transparent: true, opacity: 0, depthWrite: false }));
rain.frustumCulled = false; rain.visible = false; scene.add(rain);
// lightning: a full-screen flash
const flashEl = document.createElement('div');
Object.assign(flashEl.style, { position: 'fixed', inset: '0', background: '#eef4ff', opacity: '0', pointerEvents: 'none', transition: 'opacity .08s', zIndex: 5 });
document.body.appendChild(flashEl);

const _w = { p: 1, y: 0, v: 0, r: 0 }, _tint = new THREE.Color();
export function updateWeather(dt, pos, light, onThunder) {
  const w = biomeWeights(pos.x, pos.z, _w), here = w.v > 0.5 ? BIOME.VALTOS : w.p >= w.y ? BIOME.PEDIAS : BIOME.YLEOS;
  WEATHER.timer -= dt;
  if (WEATHER.forced) { WEATHER.type = WEATHER.forced; }
  else if (here !== WEATHER.biome || WEATHER.timer <= 0) roll(here);
  // ease the weather amounts towards the current type
  const T = TYPES[WEATHER.type], e = first ? 1 : Math.min(1, dt * 0.08);
  for (const k of ['overcast', 'rain', 'fog']) WEATHER.k[k] = lerp(WEATHER.k[k], T[k], e);
  WEATHER.storm = lerp(WEATHER.storm, T.storm ? 1 : 0, e);
  // biome mood, blended by where you stand
  const m = WEATHER.mood;
  const tl = MOOD[0].light * w.p + MOOD[1].light * w.y + MOOD[2].light * w.v, tn = MOOD[0].near * w.p + MOOD[1].near * w.y + MOOD[2].near * w.v, tf = MOOD[0].far * w.p + MOOD[1].far * w.y + MOOD[2].far * w.v;
  const me = first ? 1 : Math.min(1, dt * 0.6); m.light = lerp(m.light, tl, me); m.near = lerp(m.near, tn, me); m.far = lerp(m.far, tf, me);
  first = false;
  // fog: biome mist, thicker at night, pulled in by weather
  const fogK = WEATHER.k.fog, night = light.night;
  scene.fog.near = lerp(m.near, 10, fogK * 0.85) * lerp(1, 0.6, night * (1 - w.p * 0.6));
  scene.fog.far = lerp(m.far, 140, fogK) * lerp(1, 0.55, WEATHER.k.rain * 0.6) * lerp(1, 0.7, night);
  _tint.setRGB(0, 0, 0);
  if (w.y > 0.01) _tint.add(MOOD[1].tint.clone().multiplyScalar(w.y)); if (w.v > 0.01) _tint.add(MOOD[2].tint.clone().multiplyScalar(w.v));
  if (w.y + w.v > 0.01) scene.fog.color.lerp(_tint.multiplyScalar(1 / (w.y + w.v)).multiplyScalar(0.35 + light.day * 0.65), clamp(w.y + w.v, 0, 1) * 0.7);
  scene.fog.color.lerp(_tint.setRGB(0.15, 0.175, 0.2).multiplyScalar(0.3 + light.day * 0.7), WEATHER.k.overcast * 0.85);
  // rain
  const rk = WEATHER.k.rain; rain.visible = rk > 0.02;
  if (rain.visible) {
    rain.material.opacity = 0.5 * rk; const cx = camera.position.x, cy = camera.position.y - 8, cz = camera.position.z, wx = 4 + WEATHER.storm * 6, fall = 24;
    const n = Math.floor(RAIN_N * (0.35 + rk * 0.65));
    for (let i = 0; i < RAIN_N; i++) {
      const j = i * 6;
      if (i >= n) { rainPos[j + 1] = rainPos[j + 4] = -9999; continue; }
      let y = rainSeed[i * 3 + 1] - dt * fall; if (y < 0) y += 26; rainSeed[i * 3 + 1] = y;
      let x = rainSeed[i * 3] + dt * wx; if (x > 28) x -= 56; rainSeed[i * 3] = x;
      const px = cx + x, py = cy + y, pz = cz + rainSeed[i * 3 + 2];
      rainPos[j] = px; rainPos[j + 1] = py; rainPos[j + 2] = pz; rainPos[j + 3] = px - wx * 0.045; rainPos[j + 4] = py + 1.1; rainPos[j + 5] = pz;
    }
    rainGeo.attributes.position.needsUpdate = true;
  }
  // lightning in storms
  WEATHER.boltT -= dt;
  if (WEATHER.storm > 0.6 && WEATHER.boltT <= 0) {
    WEATHER.boltT = 8 + rnd() * 18; flashEl.style.opacity = '0.45'; setTimeout(() => (flashEl.style.opacity = '0'), 90);
    setTimeout(() => { flashEl.style.opacity = '0.3'; setTimeout(() => (flashEl.style.opacity = '0'), 70); }, 180);
    onThunder?.(0.6 + rnd() * 2);
  }
  // what the sky and lights need: how overcast, and how much light the biome lets through
  return { overcast: Math.max(WEATHER.k.overcast, w.v * 0.6), dark: 1 - m.light };
}
export function setWeather(type) { WEATHER.forced = type || null; if (type) WEATHER.type = type; }
// After a teleport (respawn, fast travel): jump straight to the new place's air instead of easing into it
export function snapWeather() { first = true; WEATHER.timer = 0; }
// A brief white flash of the sky (thunder when a creature vanishes, lightning)
export function flashSky(k = 0.3) { flashEl.style.opacity = String(k); setTimeout(() => (flashEl.style.opacity = '0'), 90); }
