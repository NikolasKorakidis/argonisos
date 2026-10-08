// Streaming vegetation. Around the player, 64 m cells are drawn at full detail (branching trunks, leaf cards, shadows);
// out to the horizon, 256 m blocks use the light far versions. A shader cut-off at NEAR_R hides each tree in exactly one
// of the two, so the hand-over is seamless and nothing is drawn twice. Layout comes from the workers (flora.js).
import * as THREE from 'three';
import { propGeo, propMat, leafMat, TREE_BUILDERS, mergeParts, rr, isLow as PROP_LOW } from './trees.js';
import { SPECIES, STRIDE, CELL } from './flora.js';

export const NEAR_R = 120;                     // full-detail radius
const NEAR_KEEP = NEAR_R + CELL * 1.5, FAR = 256, FAR_R = 850;

// ---- extra species the new world needs
TREE_BUILDERS.pomegranate = (v) => {            // a small, bushy tree with glossy leaves and red fruit
  const P = TREE_BUILDERS.fig(v + 1).map(([g, c]) => [g, c === 0x9a958a ? 0x7a5e48 : new THREE.Color(c).lerp(new THREE.Color(0x3f6a2c), 0.55).getHex()]);
  for (let i = 0; i < 18; i++) P.push([new THREE.IcosahedronGeometry(rr(0.1, 0.14), 0).translate(rr(-1.6, 1.6), rr(1.6, 3), rr(-1.6, 1.6)), i % 3 ? 0xb3261e : 0xd4462a]);
  return P;
};
TREE_BUILDERS.boulder = (v) => TREE_BUILDERS.rock(v + 3);
TREE_BUILDERS.reeds = (v) => {                  // a clump of marsh reeds and bulrushes, standing in the shallows
  const P = [], n = PROP_LOW() ? 7 : 16 + v * 4;
  for (let i = 0; i < n; i++) {
    const a = rr(0, 6.283), d = rr(0, 0.9), h = rr(1.3, 2.6), lean = rr(-0.18, 0.18);
    const g = new THREE.ConeGeometry(rr(0.025, 0.045), h, 3, 1).translate(0, h / 2, 0).rotateZ(lean).rotateY(a).translate(Math.cos(a) * d, -0.3, Math.sin(a) * d);
    P.push([g, i % 4 ? 0x6b7a3a : 0x8a8a4a]);
    if (i % 3 === 0 && !PROP_LOW()) P.push([new THREE.CylinderGeometry(0.05, 0.05, 0.3, 6).translate(0, h * 0.86, 0).rotateZ(lean).rotateY(a).translate(Math.cos(a) * d, -0.3, Math.sin(a) * d), 0x5a3a22]);   // bulrush head
  }
  return P;
};

// ---- materials with the near/far cut-off (wind sway stays as in the base material)
const VEG_U = { uVegC: { value: new THREE.Vector2() }, uNearR: { value: NEAR_R } };
const cutMats = new Map();
function cut(mat, far) {
  const key = mat.uuid + (far ? 'f' : 'n'); if (cutMats.has(key)) return cutMats.get(key);
  const m = mat.clone(), base = mat.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base?.call(m, sh, r);
    Object.assign(sh.uniforms, VEG_U);
    sh.vertexShader = 'uniform vec2 uVegC; uniform float uNearR;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `{ vec2 ic = (modelMatrix * instanceMatrix[3]).xz; float dd = distance(ic, uVegC); if (dd ${far ? '<' : '>='} uNearR) transformed *= 0.0; }
      #include <project_vertex>`);
  };
  m.customProgramCacheKey = () => key;
  cutMats.set(key, m); return m;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function matrixOf(items, i, hidden) {
  const o = i * STRIDE; _e.set(0, items[o + 5], 0); _q.setFromEuler(_e); _p.set(items[o + 2], items[o + 3], items[o + 4]); _s.setScalar(hidden ? 0 : items[o + 6]);
  return _m.compose(_p, _q, _s);
}

export class Vegetation {
  constructor(scene, pool) {
    this.scene = scene; this.pool = pool; this.group = new THREE.Group(); this.group.name = 'vegetation'; scene.add(this.group);
    this.near = new Map(); this.far = new Map(); this.timer = 0; this.removed = new Set();   // removed: "cx,cz,i" of felled trees
    this.onCell = null;            // callback(cellKey, items, cx, cz, added) so gameplay can index harvestable things
  }
  // Build every species once up front (a second or two on the loading screen) so nothing hitches later
  prebuild(progress) {
    const names = [...new Set(SPECIES.map((s) => s.name))]; let n = 0;
    for (const nm of names) for (let v = 0; v < 3; v++) { propGeo(nm, v); progress?.(++n / (names.length * 3)); }
  }
  geoFor(sp, v) { return propGeo(SPECIES[sp].name, v); }
  buildMeshes(items, far, cx, cz) {
    const groups = new Map();
    for (let i = 0; i < items.length / STRIDE; i++) {
      const sp = items[i * STRIDE], v = items[i * STRIDE + 1];
      const P = this.geoFor(sp, v), key = far && !P.leafFar ? 'sp' + sp : sp + ':' + v;      // far: one draw per species (variants share the light mesh)
      (groups.get(key) || groups.set(key, { P, idx: [] }).get(key)).idx.push(i);
    }
    const meshes = [];
    for (const { P, idx } of groups.values()) {
      const geo = far ? P.lo : P.geo;
      const im = new THREE.InstancedMesh(geo, cut(propMat, far), idx.length);
      idx.forEach((i, k) => im.setMatrixAt(k, matrixOf(items, i, !far && this.removed.has(`${cx},${cz},${i}`))));
      im.castShadow = !far; im.receiveShadow = true; im.computeBoundingSphere(); meshes.push(im); im.userData.idx = idx;
      if (P.cards && (!far || P.leafFar)) {
        const lm = new THREE.InstancedMesh(P.cards, cut(P.cardMat || leafMat, far), idx.length);
        idx.forEach((i, k) => lm.setMatrixAt(k, matrixOf(items, i, !far && this.removed.has(`${cx},${cz},${i}`))));
        lm.castShadow = !far; lm.receiveShadow = true; lm.computeBoundingSphere(); meshes.push(lm); lm.userData.idx = idx;
      }
    }
    for (const m of meshes) this.group.add(m);
    return meshes;
  }
  dropCell(map, key) { const c = map.get(key); if (!c) return; for (const m of c.meshes || []) { this.group.remove(m); m.dispose(); } map.delete(key); if (map === this.near) this.onCell?.(key, null); }
  update(dt, pos) {
    VEG_U.uVegC.value.set(pos.x, pos.z);
    this.timer -= dt; if (this.timer > 0) return; this.timer = 0.25;
    // near cells
    const r = Math.ceil(NEAR_KEEP / CELL), pcx = Math.floor(pos.x / CELL), pcz = Math.floor(pos.z / CELL);
    for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
      const cx = pcx + i, cz = pcz + j, key = cx + ',' + cz, dx = Math.max(0, Math.abs((cx + 0.5) * CELL - pos.x) - CELL / 2), dz = Math.max(0, Math.abs((cz + 0.5) * CELL - pos.z) - CELL / 2);
      if (Math.hypot(dx, dz) > NEAR_R + 8 || this.near.has(key)) continue;
      const cell = { meshes: null }; this.near.set(key, cell);
      this.pool.post({ type: 'flora', cx, cz, n: 1 }).then((m) => {
        if (this.near.get(key) !== cell) return;
        cell.items = m.items; cell.meshes = this.buildMeshes(m.items, false, cx, cz); this.onCell?.(key, m.items, cx, cz);
      });
    }
    for (const [key, c] of this.near) { const [cx, cz] = key.split(',').map(Number); if (Math.hypot((cx + 0.5) * CELL - pos.x, (cz + 0.5) * CELL - pos.z) > NEAR_KEEP + CELL) this.dropCell(this.near, key); void c; }
    // far blocks
    const R = Math.ceil(FAR_R / FAR), fcx = Math.floor(pos.x / FAR), fcz = Math.floor(pos.z / FAR), per = FAR / CELL;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const bx = fcx + i, bz = fcz + j, key = bx + ',' + bz;
      if (this.far.has(key) || Math.hypot((bx + 0.5) * FAR - pos.x, (bz + 0.5) * FAR - pos.z) > FAR_R + FAR * 0.7) continue;
      const blk = { meshes: null }; this.far.set(key, blk);
      this.pool.post({ type: 'flora', cx: bx * per, cz: bz * per, n: per }).then((m) => { if (this.far.get(key) === blk) blk.meshes = this.buildMeshes(m.items, true); });
    }
    for (const key of this.far.keys()) { const [bx, bz] = key.split(',').map(Number); if (Math.hypot((bx + 0.5) * FAR - pos.x, (bz + 0.5) * FAR - pos.z) > FAR_R + FAR * 1.4) this.dropCell(this.far, key); }
  }
  // Remove one tree/rock (felled or mined): hidden in the near cell now and remembered for when cells are rebuilt
  remove(cx, cz, i) {
    const key = cx + ',' + cz; this.removed.add(`${cx},${cz},${i}`);
    const c = this.near.get(key); if (!c?.meshes) return;
    for (const m of c.meshes) { const k = m.userData.idx.indexOf(i); if (k >= 0) { m.setMatrixAt(k, matrixOf(c.items, i, true)); m.instanceMatrix.needsUpdate = true; } }
  }
}
void mergeParts;
