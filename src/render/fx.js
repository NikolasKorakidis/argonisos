// Small effects: bursts of chips, splinters and dust, and the camera's shake. Three instanced meshes do it all: chips that
// fall (rock shards from the team's particle pack, tools/assets), dust that floats (soft puffs), and sparks, unlit and
// bright enough for the bloom to catch; little cubes until the pack's shapes load.
import * as THREE from 'three';
import { scene } from './core.js';
import { loadPack, bake } from '../assets.js';

const N = 600, mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
const make = (mt = mat) => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mt, N); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); scene.add(m); return m; };
const chips = make(), puffs = make(), glints = make(new THREE.MeshBasicMaterial({ toneMapped: false })), MESHES = [chips, puffs, glints];
// (a model's shape, a unit across, in place of the cube)
for (const [m, f] of [[chips, 'fxShard'], [puffs, 'fxPuff']]) loadPack(f).then((gl) => { const g = bake(gl.scene); g.computeBoundingBox(); const b = g.boundingBox, s = 1 / Math.max(...b.getSize(new THREE.Vector3()).toArray()), c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z).scale(s, s, s); m.geometry.dispose(); m.geometry = g; }).catch(() => {});
const P = [];   // { p, v, s, life, t, c }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();
// A burst of n bits at pos: colour, speed, size, how long they last, gravity (dust floats, chips fall)
// (glow: a spark, drawn unlit at several times its colour)
export function burst(pos, { color = 0x8a6a48, n = 10, speed = 3, size = 0.07, life = 0.9, grav = 14, up = 2.5, spread = 1, glow = false } = {}) {
  for (let i = 0; i < n; i++) {
    if (P.length >= N) P.shift();
    const a = Math.random() * 6.283, sp = speed * (0.4 + Math.random() * 0.8);
    P.push({ p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3 * spread, Math.random() * 0.3, (Math.random() - 0.5) * 0.3 * spread)),
      v: new THREE.Vector3(Math.cos(a) * sp * spread, up * (0.5 + Math.random()), Math.sin(a) * sp * spread), s: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), t: 0,
      c: _c.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12).getHex(), rot: Math.random() * 6, grav, glow });
  }
}
export function dust(pos, n = 14, color = 0xb8a684, size = 0.35) { burst(pos, { color, n, speed: 1.6, size, life: 1.4, grav: -0.6, up: 0.7, spread: 1.6 }); }
// ---- The camera's shake (tester, 14 Nov: "like Valheim"). Two kinds, both turning the camera a little after it has been
// placed (player.js), so nothing carries over into the next frame's follow and the view never drifts or wobbles:
// - punch(k, dir): an impact, a blow landing or taken. A quick kick that peaks within PUNCH_T0 and is gone by about a
//   quarter of a second, nodding the view along the blow (dir, across the ground) with a short rattle over it. k from 0 to 1:
//   about 0.1 for a twig, 0.3 for an axe in a trunk, 0.45 for a pickaxe on rock, 0.6 for a tree crashing down beside you.
// - addShake(k): a rumble that dies away over a second or so (a boss's slam, thunder, the storm wall's buffeting).
// SHAKE.k is the setting (On 1, Reduced 0.4, Off 0: settings.js); every shake goes through it.
export const SHAKE = { k: 1 };
export const shake = { k: 0, kicks: [], n: 0, last: 0 };   // (n, last: how many punches so far and the last one's strength, for the tests)
const PUNCH_T0 = 0.035, PUNCH_END = 0.28, PUNCH_A = 0.045, RUMBLE_A = 0.02;   // (seconds; radians at full strength: 2.6° and 1.1°)
export function addShake(k) { shake.k = Math.min(1, shake.k + k); }
export function punch(k, dir) {
  k = Math.min(1, k); if (!(k > 0)) return; shake.n++; shake.last = k;
  if (shake.kicks.length > 6) shake.kicks.shift();
  const l = dir ? Math.hypot(dir.x, dir.z) : 0;
  shake.kicks.push({ k, t: 0, dx: l ? dir.x / l : 0, dz: l ? dir.z / l : 0, side: Math.random() < 0.5 ? -1 : 1, ph: Math.random() * 6.283 });
}
const _f = new THREE.Vector3();
function applyShake(dt, camera) {
  let pitch = 0, yaw = 0, roll = 0;
  if (shake.kicks.length) camera.getWorldDirection(_f);
  const fx = _f.x, fz = _f.z, fl = Math.hypot(fx, fz) || 1;
  for (let i = shake.kicks.length - 1; i >= 0; i--) {
    const q = shake.kicks[i]; q.t += dt; if (q.t > PUNCH_END) { shake.kicks.splice(i, 1); continue; }
    const u = q.t / PUNCH_T0, env = u * Math.exp(1 - u), rattle = Math.sin(q.t * 70 + q.ph) * Math.exp(-q.t * 22), A = q.k * PUNCH_A;
    // (a blow going away from the camera nods the view down, one across it turns it a touch; always a little roll)
    const along = q.dx || q.dz ? (q.dx * fx + q.dz * fz) / fl : 1, across = q.dx || q.dz ? (q.dx * -fz + q.dz * fx) / fl : 0;
    pitch -= A * (0.55 * along * env + 0.3 * rattle); yaw -= A * (0.45 * across * env + 0.15 * q.side * rattle); roll += A * q.side * (0.35 * env + 0.25 * rattle);
  }
  if (shake.k > 0.001) {
    const t = performance.now() / 1000, a = shake.k * shake.k * RUMBLE_A;
    pitch += a * (Math.sin(t * 37) * 0.6 + Math.sin(t * 61 + 1.3) * 0.4); yaw += a * (Math.sin(t * 43 + 2.1) * 0.6 + Math.sin(t * 71 + 0.4) * 0.4); roll += a * 0.5 * Math.sin(t * 29 + 4);
    shake.k = Math.max(0, shake.k - dt * 2.5);
  }
  const k = SHAKE.k; if (!k || !(pitch || yaw || roll)) return;
  camera.rotateY(yaw * k); camera.rotateX(pitch * k); camera.rotateZ(roll * k);
}
// What a blow throws up, by what it struck: wood chips and pale splinters off a trunk or log, stone chips, dust and a
// spark off rock, leaves and twigs off a bush, a puff and a few sparks off a creature's hide. k: how hard (0 to 1)
export function impact(at, kind, k = 0.5) {
  const n = (a) => Math.max(1, Math.round(a * (0.6 + k)));
  if (kind === 'wood') { burst(at, { color: 0x9a7650, n: n(10), speed: 3.2, size: 0.09 }); burst(at, { color: 0xd8c09a, n: n(6), speed: 2.6, size: 0.06 }); burst(at, { color: 0x4e3a28, n: n(4), speed: 2, size: 0.11, life: 1.2 }); dust(at, n(2), 0x6e5e46, 0.14); }   // (chips, splinters, bark, a puff of sawdust: dust shows far paler in the sun than its colour)
  else if (kind === 'stone') { burst(at, { color: 0x8f897f, n: n(9), speed: 3.6, size: 0.08 }); dust(at, n(3), 0x645f57, 0.18); spark(at, n(4)); }
  else if (kind === 'leaves') { burst(at, { color: 0x4f6e2c, n: n(12), speed: 2, size: 0.1, grav: 3.5, life: 1.6, up: 2, spread: 1.4 }); burst(at, { color: 0x7a9a44, n: n(5), speed: 1.5, size: 0.07, grav: 3, life: 1.7, spread: 1.4 }); burst(at, { color: 0x6a4a30, n: n(4), speed: 2.4, size: 0.07 }); }   // (leaves drift down, twigs drop)
  else if (kind === 'hide') { dust(at, n(3), 0xc8b8a0, 0.2); spark(at, n(2)); }
  else if (kind === 'dull') { burst(at, { color: 0x9b958c, n: 3, speed: 1.6, size: 0.04 }); spark(at, 1); }
}
// a few hot, quick sparks (they fly fast, fall and burn out within a third of a second)
export function spark(at, n = 3) { burst(at, { color: 0xffc070, n, speed: 4.5, size: 0.045, grav: 9, life: 0.3, up: 2, glow: true }); }
export function updateFx(dt, camera) {
  const n = [0, 0, 0];
  for (let i = P.length - 1; i >= 0; i--) {
    const b = P[i]; b.t += dt; if (b.t >= b.life) { P.splice(i, 1); continue; }
    b.v.y -= b.grav * dt; b.v.multiplyScalar(1 - dt * (b.grav < 0 ? 2.5 : 0.6)); b.p.addScaledVector(b.v, dt); b.rot += dt * 6;
    const k = 1 - Math.max(0, (b.t - b.life * 0.6) / (b.life * 0.4));
    _e.set(b.rot, b.rot * 0.7, 0); _q.setFromEuler(_e); _s.setScalar(b.s * k);
    const k2 = b.glow ? 2 : b.grav < 0 ? 1 : 0, mesh = MESHES[k2]; mesh.setMatrixAt(n[k2], _m.compose(b.p, _q, _s)); _c.set(b.c); if (b.glow) _c.multiplyScalar(4 * k); mesh.setColorAt(n[k2], _c); n[k2]++;
  }
  for (const [k2, mesh] of MESHES.entries()) { mesh.count = n[k2]; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  applyShake(dt, camera);
}
