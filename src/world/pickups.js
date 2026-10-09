// Things lying on the ground to pick up with E: stones, fallen branches, fiber bushes, lightstone, flowers, feathers, bone piles, and
// anything the player drops. Natural ones are laid out per 64 m cell from the seed (stable ids "cx,cz,i") and grow back
// a few days after they are taken. Each kind is one instanced mesh holding every visible copy near the player.
import * as THREE from 'three';
import { heightAt, biomeWeights, hash2, fbm } from './gen.js';
import { clearGrass } from './grass.js';
import { siteClear } from './sites.js';
import { solidsAround, insideSolid } from './flora.js';
import { cutLimit, onCutsChanged } from './groundcut.js';

const CELL = 64, RANGE = 110, REGROW_DAYS = 3;
const rnd = (a, b) => hash2(a * 13.37 + b * 0.71, b * 7.13 - a * 1.9);

// ---- models (small, merged, origin on the ground)
const merge = (list) => {     // [[geo, colorHex]] → one geometry with vertex colours
  const out = [], col = [], nor = []; for (const [g0, c] of list) { const g = g0.index ? g0.toNonIndexed() : g0; g.computeVertexNormals(); const cl = new THREE.Color(c);
    out.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); for (let i = 0; i < g.attributes.position.count; i++) col.push(cl.r, cl.g, cl.b); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); return g;
};
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, ...o });
// show: how much bigger than life they're drawn (so they read in the grass), patch: radius of the bare ground around them
const SHOW = { stone: [1.7, 0.85], branch: [1.3, 1.15], lightstone: [1.5, 0.8], dandelion: [1.3, 0.55], moonflower: [1.3, 0.6], feather: [1.6, 0.55], bones: [1.4, 0.9], bush: [1.7, 1.25], drop: [1, 0.7] };
export const KINDS = {
  stone: { item: 'stone', n: [1, 1], model: () => ({ geo: merge([[new THREE.DodecahedronGeometry(0.2, 0).scale(1.2, 0.7, 1).translate(0, 0.1, 0), 0xb3ab9c], [new THREE.DodecahedronGeometry(0.12, 0).translate(0.22, 0.06, 0.1), 0x9a9286]]), mat: vc() }) },
  branch: { item: 'wood', n: [2, 2], label: 'Branch', model: () => ({ geo: merge([[new THREE.CylinderGeometry(0.035, 0.055, 1.4, 5).rotateZ(Math.PI / 2).translate(0, 0.06, 0), 0x6e5238], [new THREE.CylinderGeometry(0.02, 0.03, 0.5, 4).rotateZ(Math.PI / 2 - 0.7).translate(0.25, 0.12, 0.08), 0x6e5238], [new THREE.CylinderGeometry(0.018, 0.025, 0.4, 4).rotateZ(Math.PI / 2 + 0.6).rotateY(0.8).translate(-0.3, 0.1, -0.05), 0x6e5238], [new THREE.IcosahedronGeometry(0.09, 0).translate(0.45, 0.16, 0.1), 0x5d7a34]]), mat: vc() }) },
  lightstone: { item: 'lightstone', n: [1, 2], model: () => ({ geo: merge([[new THREE.OctahedronGeometry(0.22, 0).scale(1, 1.3, 0.9).translate(0, 0.16, 0), 0xe8e2d0], [new THREE.OctahedronGeometry(0.13, 0).translate(0.2, 0.08, -0.12), 0xd9d2bc]]), mat: vc({ emissive: 0x6a6450, emissiveIntensity: 0.35, roughness: 0.5 }) }) },
  dandelion: { item: 'dandelion', n: [1, 2], model: () => ({ geo: merge([[new THREE.CylinderGeometry(0.012, 0.015, 0.35, 4).translate(0, 0.17, 0), 0x5d8a34], [new THREE.SphereGeometry(0.07, 6, 4).scale(1, 0.6, 1).translate(0, 0.36, 0), 0xf2d040], [new THREE.ConeGeometry(0.1, 0.06, 5).rotateX(Math.PI).translate(0, 0.03, 0), 0x4a7a2a]]), mat: vc() }) },
  moonflower: { item: 'moonflower', n: [1, 1], model: () => ({ geo: merge([[new THREE.CylinderGeometry(0.012, 0.015, 0.45, 4).translate(0, 0.22, 0), 0x4a6a4a], [new THREE.ConeGeometry(0.11, 0.14, 6, 1, true).rotateX(Math.PI).translate(0, 0.48, 0), 0xcfe0ff]]), mat: vc({ emissive: 0x6080c0, emissiveIntensity: 0.6, side: THREE.DoubleSide }) }) },
  feather: { item: 'feather', n: [1, 2], model: () => ({ geo: merge([[new THREE.PlaneGeometry(0.08, 0.32).rotateX(-Math.PI / 2 + 0.15).translate(0, 0.03, 0), 0xf0ece0], [new THREE.PlaneGeometry(0.05, 0.2).rotateX(-Math.PI / 2 + 0.2).rotateY(0.5).translate(0.1, 0.03, 0.05), 0x8a6a4a]]), mat: vc({ side: THREE.DoubleSide }) }) },
  bones: { item: 'sharpBone', n: [2, 3], model: () => { const P = []; for (let i = 0; i < 6; i++) P.push([new THREE.CylinderGeometry(0.03, 0.025, 0.45, 5).rotateZ(Math.PI / 2).rotateY(i * 1.1).translate(Math.cos(i) * 0.15, 0.04 + (i % 3) * 0.03, Math.sin(i * 2) * 0.12), 0xe6dcc4]); P.push([new THREE.SphereGeometry(0.11, 7, 5).scale(1, 0.9, 1.2).translate(0.05, 0.12, 0), 0xefe6d0]); return { geo: merge(P), mat: vc() }; } },
  // a low clump of leaves with pale fibrous stalks: gathered whole for fiber
  bush: { item: 'fiber', n: [3, 3], label: 'Fiber Bush', verb: 'Gather', model: () => { const P = [];
    for (let i = 0; i < 5; i++) { const a = i * 1.26, r = i ? 0.2 : 0; P.push([new THREE.IcosahedronGeometry(0.2 + (i % 2) * 0.05, 0).scale(1, 0.75, 1).translate(Math.cos(a) * r, 0.17 + (i ? 0 : 0.08), Math.sin(a) * r), i % 2 ? 0x8aa63e : 0x739233]); }
    for (let i = 0; i < 11; i++) { const a = i * 0.57 + 0.3; P.push([new THREE.CylinderGeometry(0.01, 0.018, 0.75, 3).translate(0, 0.37, 0).rotateZ(0.35).rotateY(a).translate(Math.cos(a) * 0.12, 0.05, Math.sin(a) * 0.12), 0xe6d9a2]); }
    return { geo: merge(P), mat: vc() }; } },
  drop: { item: null, model: () => ({ geo: merge([[new THREE.BoxGeometry(0.34, 0.24, 0.3).translate(0, 0.12, 0), 0xa9824e], [new THREE.BoxGeometry(0.36, 0.04, 0.32).translate(0, 0.25, 0), 0x6e5238]]), mat: vc() }) },   // a little bundle for dropped items
};
// How many of each kind per cell, by biome (Pedias, Yleos)
function counts(w, x, z) {
  const tree = fbm(x * 0.0075 + 21, z * 0.0075 - 4, 3);
  return {
    stone: 3.5 * w.p + 4 * w.y, branch: (1.6 + tree * 4) * w.p + 6 * w.y,   // starter materials: easy to come by lightstone: 0.15 * w.p + 1.2 * w.y,
    dandelion: 3 * w.p, moonflower: 0.6 * w.y, feather: 0.4 * w.p + 0.3 * w.y, bones: 0.25 * w.y,
    bush: 2.2 * w.p + 1.6 * w.y,                // fiber for early rope; last, so the ids of the kinds above don't shift
  };
}
export function layoutPickups(cx, cz) {
  const out = [], x0 = cx * CELL, z0 = cz * CELL, w = biomeWeights(x0 + 32, z0 + 32, { p: 0, y: 0, v: 0, r: 0 });
  if (w.v > 0.4) return out;
  const C = counts(w, x0 + 32, z0 + 32), solid = solidsAround(cx, cz); let k = 0;
  for (const [kind, n] of Object.entries(C)) {
    const whole = Math.floor(n) + (rnd(cx * 31 + k, cz * 17 - k) < n % 1 ? 1 : 0);
    for (let i = 0; i < whole; i++, k++) {
      const x = x0 + rnd(cx + k * 3.1, cz - k) * CELL, z = z0 + rnd(cx - k * 1.7, cz + k * 2.3) * CELL, h = heightAt(x, z);
      if (h < 0.8 || siteClear(x, z) || insideSolid(solid, x, z, 0.35)) continue;   // never inside a rock or a trunk
      const s = Math.hypot(heightAt(x + 1, z) - h, heightAt(x, z + 1) - h); if (s > 0.8) continue;
      out.push({ id: `${cx},${cz},${k}`, kind, x, z, y: h, rot: rnd(k, cx + cz) * 6.28 });
    }
  }
  return out;
}

export class Pickups {
  constructor(scene) {
    this.scene = scene; this.cells = new Map(); this.taken = new Map();   // id → day taken
    this.drops = [];                                                     // { id, item, n, x, y, z, extra }
    this.meshes = {}; this.dirty = true; this.day = 1; this.seq = 0;
    for (const [k, K] of Object.entries(KINDS)) { const { geo, mat } = K.model(); const m = new THREE.InstancedMesh(geo, mat, 1024); m.count = 0; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); this.meshes[k] = m; }
    this.visible = []; onCutsChanged.add(() => { this.dirty = true; });
    // a patch of bare earth and pebbles under each one, tilted to the slope
    const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
    const gr = x.createRadialGradient(64, 64, 4, 64, 64, 62); gr.addColorStop(0, 'rgba(112,92,64,0.95)'); gr.addColorStop(0.55, 'rgba(104,86,58,0.75)'); gr.addColorStop(1, 'rgba(96,80,54,0)'); x.fillStyle = gr; x.fillRect(0, 0, 128, 128);
    let sd = 5; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < 70; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 44, v = 120 + r() * 70; x.fillStyle = `rgba(${v},${v * 0.95},${v * 0.85},${0.5 + r() * 0.4})`; x.beginPath(); x.ellipse(64 + Math.cos(a) * d, 64 + Math.sin(a) * d, 1 + r() * 2.5, 1 + r() * 2, r() * 3, 0, 7); x.fill(); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    this.patch = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 2048);
    this.patch.count = 0; this.patch.receiveShadow = true; this.patch.frustumCulled = false; this.patch.renderOrder = -1; scene.add(this.patch);
  }
  isTaken(id) { const d = this.taken.get(id); return d !== undefined && this.day - d < REGROW_DAYS; }
  update(pos, day) {
    if (day !== this.day) { this.day = day; this.dirty = true; }
    const r = Math.ceil(RANGE / CELL), pcx = Math.floor(pos.x / CELL), pcz = Math.floor(pos.z / CELL), want = new Set();
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const cx = pcx + i, cz = pcz + j, key = cx + ',' + cz; want.add(key);
      if (!this.cells.has(key)) { this.cells.set(key, layoutPickups(cx, cz)); this.dirty = true; }
    }
    for (const key of this.cells.keys()) if (!want.has(key)) { this.cells.delete(key); this.dirty = true; }
    if (!this.dirty) return; this.dirty = false;
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), s = new THREE.Vector3(1, 1, 1), n = {};
    for (const k in this.meshes) n[k] = 0;
    this.visible = [];
    let np = 0; const up = new THREE.Vector3(0, 1, 0), nrm = new THREE.Vector3(), qq = new THREE.Quaternion(), ss = new THREE.Vector3();
    const put = (kind, p) => {
      const mesh = this.meshes[kind]; if (n[kind] >= 1024) return; const [k, rad] = SHOW[kind];
      e.set(0, p.rot, 0); q.setFromEuler(e); v.set(p.x, p.y, p.z); mesh.setMatrixAt(n[kind]++, m4.compose(v, q, ss.setScalar(k))); this.visible.push(p);
      if (np < 2048) { nrm.set(heightAt(p.x - 0.5, p.z) - heightAt(p.x + 0.5, p.z), 1, heightAt(p.x, p.z - 0.5) - heightAt(p.x, p.z + 0.5)).normalize(); qq.setFromUnitVectors(up, nrm).multiply(q);
        v.set(p.x, p.y + 0.03, p.z); this.patch.setMatrixAt(np++, m4.compose(v, qq, ss.setScalar(rad))); }
    };
    // (natural ones under a floor you've built stay hidden: the ground there is pressed down below the boards)
    for (const list of this.cells.values()) for (const p of list) if (!this.isTaken(p.id) && cutLimit(p.x, p.z) > p.y - 0.05) put(p.kind, p);
    for (const d of this.drops) put('drop', d);
    // keep the grass short round everything lying about, so it can be found
    const keep = new Set(this.visible.map((p) => 'pk' + p.id));
    for (const k of this.cleared || []) if (!keep.has(k)) clearGrass(k, null);
    for (const p of this.visible) if (!this.cleared?.has('pk' + p.id)) clearGrass('pk' + p.id, { x: p.x, z: p.z, r: SHOW[p.kind][1] * 1.05 });
    this.cleared = keep;
    for (const k in this.meshes) { this.meshes[k].count = n[k]; this.meshes[k].instanceMatrix.needsUpdate = true; }
    this.patch.count = np; this.patch.instanceMatrix.needsUpdate = true;
  }
  // The nearest thing to pick up within reach of a point
  nearest(p, reach = 2.4) {
    let best = null, bd = reach;
    for (const v of this.visible) { const d = Math.hypot(v.x - p.x, v.z - p.z); if (d < bd && Math.abs(v.y - p.y) < 2.5) { bd = d; best = v; } }
    return best;
  }
  // Take it: returns [itemId, count]
  take(v) {
    this.dirty = true;
    if (v.kind === 'drop') { this.drops.splice(this.drops.indexOf(v), 1); return [v.item, v.n, v.extra]; }
    this.taken.set(v.id, this.day); const K = KINDS[v.kind]; return [K.item, K.n[0] + Math.floor(rnd(v.x, v.z) * (K.n[1] - K.n[0] + 1))];
  }
  // fromY: the height it falls from (the player, a creature, a chest), so it lands on a floor rather than the ground below it
  drop(item, n, x, z, extra, fromY) { const y = this.landAt ? this.landAt(x, z, fromY) : Math.max(heightAt(x, z), -1.2); const d = { id: 'd' + this.seq++, kind: 'drop', item, n, x, y, z, rot: Math.random() * 6.28, extra }; this.drops.push(d); this.dirty = true; return d; }
  toJSON() { return { taken: [...this.taken], drops: this.drops }; }
  load(o) { this.taken = new Map(o.taken); this.drops = o.drops || []; this.dirty = true; }
}
