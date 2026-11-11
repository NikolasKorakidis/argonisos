// Small effects: bursts of chips, splinters and dust, and a camera shake. Two instanced meshes do it all: chips that fall
// (rock shards from the team's particle pack, tools/assets) and dust that floats (soft puffs); little cubes until they load.
import * as THREE from 'three';
import { scene } from './core.js';
import { loadPack, bake } from '../assets.js';

const N = 600, mat = new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true });
const make = () => { const m = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), mat, N); m.count = 0; m.frustumCulled = false; m.castShadow = false; m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3); scene.add(m); return m; };
const chips = make(), puffs = make();
// (a model's shape, a unit across, in place of the cube)
for (const [m, f] of [[chips, 'fxShard'], [puffs, 'fxPuff']]) loadPack(f).then((gl) => { const g = bake(gl.scene); g.computeBoundingBox(); const b = g.boundingBox, s = 1 / Math.max(...b.getSize(new THREE.Vector3()).toArray()), c = b.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z).scale(s, s, s); m.geometry.dispose(); m.geometry = g; }).catch(() => {});
const P = [];   // { p, v, s, life, t, c }
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _c = new THREE.Color();
// A burst of n bits at pos: colour, speed, size, how long they last, gravity (dust floats, chips fall)
export function burst(pos, { color = 0x8a6a48, n = 10, speed = 3, size = 0.07, life = 0.9, grav = 14, up = 2.5, spread = 1 } = {}) {
  for (let i = 0; i < n; i++) {
    if (P.length >= N) P.shift();
    const a = Math.random() * 6.283, sp = speed * (0.4 + Math.random() * 0.8);
    P.push({ p: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3 * spread, Math.random() * 0.3, (Math.random() - 0.5) * 0.3 * spread)),
      v: new THREE.Vector3(Math.cos(a) * sp * spread, up * (0.5 + Math.random()), Math.sin(a) * sp * spread), s: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), t: 0,
      c: _c.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.12).getHex(), rot: Math.random() * 6, grav });
  }
}
export function dust(pos, n = 14, color = 0xb8a684, size = 0.35) { burst(pos, { color, n, speed: 1.6, size, life: 1.4, grav: -0.6, up: 0.7, spread: 1.6 }); }
export const shake = { k: 0 };
export function addShake(k) { shake.k = Math.min(1, shake.k + k); }
export function updateFx(dt, camera) {
  const n = [0, 0];
  for (let i = P.length - 1; i >= 0; i--) {
    const b = P[i]; b.t += dt; if (b.t >= b.life) { P.splice(i, 1); continue; }
    b.v.y -= b.grav * dt; b.v.multiplyScalar(1 - dt * (b.grav < 0 ? 2.5 : 0.6)); b.p.addScaledVector(b.v, dt); b.rot += dt * 6;
    const k = 1 - Math.max(0, (b.t - b.life * 0.6) / (b.life * 0.4));
    _e.set(b.rot, b.rot * 0.7, 0); _q.setFromEuler(_e); _s.setScalar(b.s * k);
    const k2 = b.grav < 0 ? 1 : 0, mesh = k2 ? puffs : chips; mesh.setMatrixAt(n[k2], _m.compose(b.p, _q, _s)); mesh.setColorAt(n[k2], _c.set(b.c)); n[k2]++;
  }
  for (const [k2, mesh] of [chips, puffs].entries()) { mesh.count = n[k2]; mesh.instanceMatrix.needsUpdate = true; mesh.instanceColor.needsUpdate = true; }
  if (shake.k > 0.001) { const s = shake.k * shake.k * 0.12; camera.position.x += (Math.random() - 0.5) * s; camera.position.y += (Math.random() - 0.5) * s; shake.k = Math.max(0, shake.k - dt * 2.5); }
}
