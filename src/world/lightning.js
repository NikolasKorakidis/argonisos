// Lightning, for the weather's thunderstorms and Zeus's storm wall alike (weather.js, stormwall.js):
//   A strike flickers in two to four pulses (its return strokes), each a sharp rise and a quick fall. It may be a bolt,
//   forked, from the cloud to the ground (bright ribbons drawn after the scene, in the storm wall's pass), or only a
//   flash inside the cloud, lighting it from within (four lights at once, which the storm wall's cloud reads).
//   The world lights up with it: a cold blue-white over the sky's light and the sun's (or moon's), so wet stone, roofs and
//   leaves catch it; the sky and the clouds towards it flare; a strike close by all but blinds you. By night it shows
//   the land for a split second and plunges it back into the dark.
//   Thunder follows the light at the speed of sound (sound.js `stormThunder`: a crack then a long roll close by, a low,
//   soft rumble from far off), panned to where it struck.
//   Reduce flashing (the settings): the flashes are softer and slower, and nothing blinds.
import * as THREE from 'three';
import { camera, sun, hemi, renderer, scene } from '../render/core.js';
import { skyDome, clouds, stormClouds, LIGHT } from './sky.js';
import { heightAt } from './gen.js';
import { sound } from '../audio/sound.js';
import { addShake } from '../render/fx.js';

export const LIGHTNING = { soft: false, strikes: 0, last: null, glow: 0 };
const FLASH = Array.from({ length: 4 }, () => ({ p: new THREE.Vector3(), r: 200, k: 0, age: 9, pulses: [], light: 1, close: 0 }));
export const flashP = FLASH.map(() => new THREE.Vector4()), flashI = new Float32Array(4);
const BOLTS = 4, SEGS = 220;   // (bolts at once, and the segments one may have, its branches included)
export const BOLT_U = { boltI: { value: new Array(BOLTS).fill(0) }, boltCol: { value: new THREE.Color(0.8, 0.85, 1.0).multiplyScalar(6) } };
const boltLife = Array.from({ length: BOLTS }, () => ({ age: 9, pulses: [] }));
let boltSlot = 0;
// a stroke's brightness over time: a few pulses, each a sharp rise and a quick fall, then dark (slower and gentler when
// flashing is reduced)
function pulsesFor(n) {
  const p = [], soft = LIGHTNING.soft; let t = 0;
  for (let i = 0; i < n; i++) { p.push([t, (0.7 + Math.random() * 0.6) * (soft ? 0.35 : 1), (0.05 + Math.random() * 0.1) * (soft ? 3 : 1)]); t += (0.06 + Math.random() * 0.12) * (soft ? 2 : 1); }
  return p;
}
const pulseAt = (pulses, age) => { let k = 0; for (const [t0, a, len] of pulses) if (age >= t0) k = Math.max(k, a * (age - t0 < 0.012 ? (age - t0) / 0.012 : Math.exp(-(age - t0) / len))); return k; };

// ---- The bolts' ribbons: each segment two ends and a side, written into one buffer when a bolt strikes
export const boltGeo = new THREE.BufferGeometry();
const V = BOLTS * SEGS * 6, bA = new Float32Array(V * 3), bB = new Float32Array(V * 3), bS = new Float32Array(V * 2), bI = new Float32Array(V).fill(-1);
boltGeo.setAttribute('position', new THREE.BufferAttribute(bA, 3)); boltGeo.setAttribute('aB', new THREE.BufferAttribute(bB, 3));
boltGeo.setAttribute('aSide', new THREE.BufferAttribute(bS, 2)); boltGeo.setAttribute('aBolt', new THREE.BufferAttribute(bI, 1));
const _p = new THREE.Vector3(), _q = new THREE.Vector3(), _r = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color();
// A jagged path from a to b: halved again and again, each middle pushed aside by a share of the length (so it zigzags at
// every scale)
function jag(a, b, levels, rough) {
  let pts = [a.clone(), b.clone()];
  for (let l = 0; l < levels; l++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i - 1], q = pts[i], len = p.distanceTo(q);
      out.push(_p.addVectors(p, q).multiplyScalar(0.5).add(_q.set(Math.random() - 0.5, (Math.random() - 0.5) * 0.4, Math.random() - 0.5).multiplyScalar(len * rough)).clone(), q);
    }
    pts = out;
  }
  return pts;
}
function drawBolt(slot, top, ground) {
  const main = jag(top, ground, 6, 0.42), lines = [[main, 1]];
  for (let b = 0, n = 3 + Math.floor(Math.random() * 5); b < n; b++) {   // branches forking off the upper part, down and away
    const i = Math.floor(Math.random() * main.length * 0.6), s = main[i], left = s.distanceTo(ground);
    const end = _r.copy(ground).sub(s).normalize().add(_s.set(Math.random() - 0.5, -0.2, Math.random() - 0.5).multiplyScalar(1.4)).normalize().multiplyScalar(left * (0.2 + Math.random() * 0.35)).add(s);
    lines.push([jag(s, end, 4, 0.5), 0.45 + Math.random() * 0.2]);
  }
  let v = slot * SEGS * 6; const vEnd = v + SEGS * 6;
  for (const [pts, w] of lines) for (let i = 1; i < pts.length && v < vEnd; i++, v += 6) {
    const a = pts[i - 1], b = pts[i];
    [[-1, 0], [1, 0], [1, 1], [-1, 0], [1, 1], [-1, 1]].forEach(([s, e], k) => { bA.set([a.x, a.y, a.z], (v + k) * 3); bB.set([b.x, b.y, b.z], (v + k) * 3); bS.set([s * w, e], (v + k) * 2); bI[v + k] = slot; });
  }
  for (; v < vEnd; v++) bI[v] = -1;
  for (const k of ['position', 'aB', 'aSide', 'aBolt']) boltGeo.attributes[k].needsUpdate = true;
}

// A strike: `at` where the flash is (in the cloud, or the bolt's top), r how far its light reaches in the cloud; `ground`
// where a bolt strikes (none: a flash in the cloud only); light how much it lights the world (1 a strike in view a few
// hundred metres off); hear how loud its thunder may be (stormwall.js turns its own down far from the wall). Thunder
// follows from wherever it is nearest you.
export function strike({ at, r = 200, ground = null, light = 1, big = 1, hear = 1 }) {
  const L = FLASH.find((f) => f.k <= 0.01 && f.age > 0.3) || FLASH.reduce((a, b) => (a.age > b.age ? a : b));
  L.p.copy(at); L.r = r; L.age = 0; L.pulses = pulsesFor(ground ? 2 + Math.floor(Math.random() * 3) : 1 + Math.floor(Math.random() * 3)); L.k = 1;
  // (how near you the light is, from the nearest point of the bolt: a strike a few hundred metres off fills the sky)
  const cam = camera.position, near = ground ? _q.copy(ground).lerp(at, 0.3) : at, dist = Math.max(30, near.distanceTo(cam));
  L.light = light * Math.min(1.6, (600 / (dist + 150)) ** 2); L.close = Math.max(0, 1 - dist / 450) * (ground ? 1 : 0.3);   // (falling off fast: a far one only glimmers)
  if (ground) { const slot = boltSlot; boltSlot = (boltSlot + 1) % BOLTS; drawBolt(slot, at, ground); boltLife[slot].age = 0; boltLife[slot].pulses = L.pulses; BOLT_U.boltI.value[slot] = 1e-3; }   // (lit at once, so its pass is on this frame)
  LIGHTNING.strikes++; LIGHTNING.last = { at: at.clone(), ground: ground?.clone() || null, dist, time: performance.now(), delay: dist / 343 };
  // the thunder: how far (sound at 343 m/s), from which side, and how big
  _r.subVectors(near, cam).normalize(); camera.getWorldDirection(_s); const pan = Math.max(-1, Math.min(1, _r.x * -_s.z + _r.z * _s.x));
  if (hear > 0.005) sound('stormThunder', { dist, pan, big: (ground ? big : big * 0.7) * hear });   // (hear: how loud it may be where you are, 0 for none)
  if (ground && dist < 350) setTimeout(() => addShake(0.3 * (1 - dist / 350)), (dist / 343) * 1000);   // (the crack shakes the air)
  return L;
}

// A thunderstorm's strike somewhere round you (weather.js): mostly where you're looking; a few close and blinding, most
// far off, some only flashing inside the clouds. The cloud base is that of the storm's low clouds (sky.js).
export function skyStrike(night = 0, far = false) {
  const cam = camera.position; camera.getWorldDirection(_s); _s.y = 0; _s.normalize();
  const roll = far ? 1 : Math.random(), dist = roll < 0.14 ? 120 + Math.random() * 330 : roll < 0.65 ? 450 + Math.random() * 1400 : 1800 + Math.random() * 2400;
  const a = Math.atan2(_s.z, _s.x) + (Math.random() < 0.75 ? (Math.random() - 0.5) * 1.3 : Math.random() * Math.PI * 2);
  const x = cam.x + Math.cos(a) * dist, z = cam.z + Math.sin(a) * dist, g = Math.max(heightAt(x, z), -1);
  const base = Math.max(g + 110, 210 + Math.random() * 60), bolt = dist < 1800 ? Math.random() < 0.8 : Math.random() < 0.3;
  const at = new THREE.Vector3(x + (Math.random() - 0.5) * 120, bolt ? base : base + 40 + Math.random() * 120, z + (Math.random() - 0.5) * 120);
  return strike({ at, r: 300, ground: bolt ? new THREE.Vector3(x, g, z) : null, light: (bolt ? 1 : 0.6) * (0.8 + night * 0.4) });
}

// Per frame, after the sky (it is the sky's light that flashes): the strikes' pulses, and the world lit by them.
// still: the screenshot tests (nothing flashes).
const _d = new THREE.Vector3(), COLD = new THREE.Color(0.78, 0.84, 1.0);
export function updateLightning(dt, still) {
  if (still) { flashI.fill(0); BOLT_U.boltI.value.fill(0); FLASH.forEach((f) => (f.k = 0)); LIGHTNING.glow = 0; return; }
  let lit = 0, close = 0; _d.set(0, 0, 0);
  FLASH.forEach((f, i) => {
    f.age += dt; f.k = f.age > 2 ? 0 : pulseAt(f.pulses, f.age); flashP[i].set(f.p.x, f.p.y, f.p.z, f.r); flashI[i] = f.k * 2.2;
    if (f.k > 0.002) { const l = f.k * f.light; lit += l; close = Math.max(close, f.k * f.close); _d.addScaledVector(_r.subVectors(f.p, camera.position).normalize(), l); }
  });
  boltLife.forEach((b, i) => { b.age += dt; BOLT_U.boltI.value[i] = b.age > 1.5 ? 0 : pulseAt(b.pulses, b.age); });
  // (it rises at once and lingers a moment as it fades, as the eye holds it)
  lit = Math.min(lit, 2) * (LIGHTNING.soft ? 0.4 : 1); LIGHTNING.glow = lit = Math.max(lit, LIGHTNING.glow * Math.exp(-dt / 0.07));
  if (lit < 0.003) return;
  // the land: the sky's light and the sun's (or moon's) cold and bright for a moment, so the wet world glints with it
  hemi.intensity += lit * 1.5; hemi.color.lerp(COLD, Math.min(1, lit)); hemi.groundColor.lerp(_c.setRGB(0.25, 0.28, 0.35), Math.min(1, lit) * 0.5);
  sun.intensity += lit * 2.2; sun.color.lerp(COLD, Math.min(1, lit)); scene.environmentIntensity += lit * 0.8;
  // the sky and the air flare, most towards the strike; the clouds that way light up
  const U = skyDome.material.uniforms, k = Math.min(1, lit * 0.6); _c.copy(COLD).multiplyScalar(0.55);
  U.top.value.lerp(_c, k * 0.7); U.hor.value.lerp(_c, k); scene.fog.color.lerp(_c, k * 0.6);
  const dl = _d.length(); if (dl > 1e-4) _d.multiplyScalar(1 / dl);
  for (const c of [...clouds, ...stormClouds]) { if (!c.visible) continue; const f = Math.max(0, _r.subVectors(c.position, camera.position).normalize().dot(_d)); c.material.color.lerp(_c.setRGB(1.6, 1.7, 2.0), Math.min(1, lit * (0.25 + 0.75 * f ** 3))); }
  // the eye: by night the land leaps out of the dark for a moment; a strike close by all but blinds you
  renderer.toneMappingExposure *= 1 + lit * (0.25 + LIGHT.night * 1.1) + (LIGHTNING.soft ? 0 : close * 1.5);
}
