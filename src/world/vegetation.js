// Streaming vegetation in three bands. Around the player, 64 m cells are drawn at full detail (branching trunks, leaf
// cards, shadows). Out to MID_R, 256 m blocks use the light far versions. Beyond that every tree is an impostor: one
// camera-facing card painted from an atlas rendered once at start-up, a single draw call per block. Shader cut-offs at
// NEAR_R and MID_R put each tree in exactly one band, so the hand-overs are seamless. Layout comes from the workers.
import * as THREE from 'three';
import { propGeo, propMat, leafMat, TREE_BUILDERS, mergeParts, rr, isLow as PROP_LOW, A2C_FRAG } from './trees.js';
import { SPECIES, STRIDE, CELL } from './flora.js';
import { renderer, sun, hemi } from '../render/core.js';

export const NEAR_R = 75;                     // full-detail radius
export const MID_R = 260;                     // light meshes out to here, impostors beyond
const NEAR_KEEP = NEAR_R + CELL * 1.5, FAR = 256, FAR_R = 1000;

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

// ---- ruins and shrubs of the old world (vertex-coloured like the trees; the far versions keep fewer pieces)
// (vertex colours are lit like the trees' and come out several times brighter: these read as marble and stone in the sun)
const MARBLE = 0x6f685b, MARBLE2 = 0x625b4f, STONE = 0x514a41, STONE2 = 0x5c5449, CLAY = 0x683321, GLAZE = 0x1a120d;
const drum = (r, h) => {   // a fluted column drum
  const lo = PROP_LOW(), g = new THREE.CylinderGeometry(r, r * 1.02, h, lo ? 10 : 32, 1);
  if (!lo) { const p = g.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), f = 1 - 0.06 * (0.5 + 0.5 * Math.cos(a * 16)); p.setX(i, p.getX(i) * f); p.setZ(i, p.getZ(i) * f); } g.computeVertexNormals(); }   // 16 flutes, shaded
  return g;
};
const pot = (s) => new THREE.LatheGeometry([[0, 0], [0.05, 0.02], [0.08, 0.12], [0.2, 0.32], [0.24, 0.5], [0.22, 0.66], [0.13, 0.78], [0.07, 0.84], [0.07, 1.02], [0.1, 1.05], [0, 1.06]].map(([r, y]) => new THREE.Vector2(r * s, y * s)), PROP_LOW() ? 6 : 12);
TREE_BUILDERS.colfall = (v) => {
  const P = [[new THREE.BoxGeometry(1.7, 0.35, 1.7).translate(0, 0.17, 0), STONE], [drum(0.42, 0.55).translate(0, 0.62, 0), MARBLE]];
  for (let k = 0; k < 3; k++) P.push([drum(0.42, 0.85).rotateZ(Math.PI / 2).rotateY(rr(-0.15, 0.15)).translate(1.25 + k * 0.92, 0.4, rr(-0.1, 0.1) + (v ? k * 0.15 : 0)), k % 2 ? MARBLE2 : MARBLE]);
  P.push([new THREE.CylinderGeometry(0.55, 0.42, 0.3, PROP_LOW() ? 8 : 20).rotateX(1.4).translate(-1.2, 0.42, 0.9), MARBLE], [new THREE.BoxGeometry(1.15, 0.22, 1.15).rotateX(1.4).translate(-1.45, 0.58, 0.9), MARBLE2]);
  return P;
};
TREE_BUILDERS.colstand = (v) => {
  const h = 2.4 + v * 0.9, P = [[new THREE.BoxGeometry(1.4, 0.3, 1.4).translate(0, 0.15, 0), STONE], [new THREE.BoxGeometry(1.1, 0.25, 1.1).translate(0, 0.42, 0), MARBLE2], [drum(0.38, h).translate(0, 0.55 + h / 2, 0), MARBLE]];
  if (v) P.push([new THREE.CylinderGeometry(0.52, 0.36, 0.3, PROP_LOW() ? 8 : 20).translate(0, 0.55 + h + 0.15, 0), MARBLE], [new THREE.BoxGeometry(1.1, 0.22, 1.1).translate(0, 0.55 + h + 0.41, 0), MARBLE2]);
  else P.push([drum(0.36, 0.5).rotateX(0.5).translate(0.05, 0.55 + h + 0.12, 0.08), MARBLE2], [drum(0.38, 0.8).rotateZ(Math.PI / 2).translate(1.1, 0.38, 0.6), MARBLE2]);
  return P;
};
TREE_BUILDERS.herm = (v) => {
  const P = [[new THREE.BoxGeometry(0.75, 0.18, 0.65).translate(0, 0.09, 0), STONE], [new THREE.BoxGeometry(0.38, 1.2, 0.32).translate(0, 0.78, 0), MARBLE], [new THREE.BoxGeometry(0.46, 0.12, 0.4).translate(0, 1.42, 0), MARBLE2],
    [new THREE.IcosahedronGeometry(0.19, 1).scale(0.9, 1.1, 1).translate(0, 1.66, 0), MARBLE], [new THREE.ConeGeometry(0.11, 0.22, 6).rotateX(Math.PI).translate(0, 1.5, 0.11), MARBLE2]];
  if (!PROP_LOW()) { P.push([new THREE.CylinderGeometry(0.16, 0.08, 0.08, 10).translate(0.32, 0.22, 0.35), CLAY]); for (let k = 0; k < 5; k++) P.push([new THREE.IcosahedronGeometry(0.04, 0).translate(0.25 + rr(-0.1, 0.1), 0.24, 0.35 + rr(-0.1, 0.1)), k % 2 ? 0xd8322a : 0xf2c230]); }
  if (v) P.push([new THREE.TorusGeometry(0.17, 0.035, 5, 12).rotateX(Math.PI / 2).translate(0, 1.47, 0), 0x4f6e2c]);   // a laurel wreath
  return P;
};
TREE_BUILDERS.amphorae = (v) => {
  const P = [];
  for (const [x, z, tilt, rot] of [[0, 0, 0.08, 0], [0.45, 0.25, 0.15, 1.2], [-0.3, 0.55, 1.45, 0.6 + v]]) { P.push([pot(1).rotateZ(tilt).rotateY(rot).translate(x, tilt > 1 ? 0.24 : 0, z), CLAY]); if (!PROP_LOW()) P.push([new THREE.CylinderGeometry(0.235, 0.24, 0.12, 12, 1, true).translate(0, 0.46, 0).rotateZ(tilt).rotateY(rot).translate(x, tilt > 1 ? 0.24 : 0, z), GLAZE]); }
  if (!PROP_LOW()) for (let k = 0; k < 6; k++) P.push([new THREE.BoxGeometry(rr(0.08, 0.18), 0.02, rr(0.06, 0.14)).rotateY(rr(0, 3)).translate(rr(-0.6, 0.8), 0.01, rr(-0.5, 0.9)), CLAY]);
  return P;
};
TREE_BUILDERS.wallruin = () => {
  const P = [];
  for (let j = 0; j < 3; j++) { let x = -1.15 + (j % 2) * 0.25; const end = 1.15 - j * rr(0.2, 0.5); while (x < end) { const w = rr(0.45, 0.75); if (j < 2 || rr(0, 1) < 0.7) P.push([new THREE.BoxGeometry(w - 0.03, 0.3, 0.62).translate(x + w / 2, 0.16 + j * 0.31, rr(-0.03, 0.03)), rr(0, 1) < 0.5 ? STONE : STONE2]); x += w; } }
  return P;
};
TREE_BUILDERS.lavender = () => {
  const P = [[new THREE.IcosahedronGeometry(0.36, 1).scale(1.3, 0.55, 1.3).translate(0, 0.16, 0), 0x6d7f4a]], n = PROP_LOW() ? 6 : 22;
  for (let k = 0; k < n; k++) { const a = rr(0, 6.28), d = rr(0, 0.42), h = rr(0.45, 0.75), lean = rr(-0.2, 0.2);
    if (!PROP_LOW()) P.push([new THREE.CylinderGeometry(0.008, 0.01, h, 3).translate(0, h / 2, 0).rotateZ(lean).rotateY(a).translate(Math.cos(a) * d, 0.1, Math.sin(a) * d), 0x6f8a4a]);
    P.push([new THREE.ConeGeometry(0.035, 0.2, 4).rotateX(Math.PI).translate(0, h + 0.02, 0).rotateZ(lean).rotateY(a).translate(Math.cos(a) * d, 0.1, Math.sin(a) * d), k % 3 ? 0x8a6ccf : 0x7457c0]); }
  return P;
};
TREE_BUILDERS.broom = () => {
  const P = [], n = PROP_LOW() ? 3 : 6;
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28, d = k ? 0.35 : 0; P.push([new THREE.IcosahedronGeometry(rr(0.32, 0.45), 1).scale(1, 1.2, 1).translate(Math.cos(a) * d, 0.42 + rr(0, 0.25), Math.sin(a) * d), k % 2 ? 0x5f7a2c : 0x6b8432]); }
  for (let k = 0; k < (PROP_LOW() ? 5 : 26); k++) { const a = rr(0, 6.28), e = rr(0.2, 1.2); P.push([new THREE.IcosahedronGeometry(rr(0.06, 0.1), 0).translate(Math.cos(a) * Math.cos(e) * 0.6, 0.55 + Math.sin(e) * 0.45, Math.sin(a) * Math.cos(e) * 0.6), k % 3 ? 0xe8c42a : 0xf2d84a]); }
  return P;
};
TREE_BUILDERS.myrtle = () => {
  const P = [], n = PROP_LOW() ? 3 : 6;
  for (let k = 0; k < n; k++) { const a = (k / n) * 6.28, d = k ? 0.4 : 0; P.push([new THREE.IcosahedronGeometry(rr(0.38, 0.55), 1).translate(Math.cos(a) * d, 0.55 + rr(0, 0.35), Math.sin(a) * d), k % 2 ? 0x3f5f2e : 0x46682f]); }
  if (!PROP_LOW()) for (let k = 0; k < 18; k++) { const a = rr(0, 6.28), e = rr(0.1, 1.2); P.push([new THREE.IcosahedronGeometry(0.045, 0).translate(Math.cos(a) * Math.cos(e) * 0.75, 0.7 + Math.sin(e) * 0.55, Math.sin(a) * Math.cos(e) * 0.75), 0xf2efe6]); }
  return P;
};

// ---- materials with the near/far cut-off (wind sway stays as in the base material)
const VEG_U = { uVegC: { value: new THREE.Vector2() }, uNearR: { value: NEAR_R }, uMidR: { value: MID_R }, uFarR: { value: FAR_R } };
const cutMats = new Map();
function cut(mat, far) {
  const key = mat.uuid + (far ? 'f' : 'n'); if (cutMats.has(key)) return cutMats.get(key);
  const m = mat.clone(), base = mat.onBeforeCompile;
  m.onBeforeCompile = (sh, r) => {
    base?.call(m, sh, r);
    Object.assign(sh.uniforms, VEG_U);
    sh.vertexShader = 'uniform vec2 uVegC; uniform float uNearR, uMidR;\n' + sh.vertexShader.replace('#include <project_vertex>',
      `{ vec2 ic = (modelMatrix * instanceMatrix[3]).xz; float dd = distance(ic, uVegC); if (${far ? 'dd < uNearR || dd >= uMidR' : 'dd >= uNearR'}) transformed *= 0.0; }
      #include <project_vertex>`);
  };
  m.customProgramCacheKey = () => key;
  cutMats.set(key, m); return m;
}

// ---- impostors: each species painted from the side into one atlas tile, shown as a card that turns to face you
const TILE = 256, COLS = 8, ATLAS = { tex: null, tiles: [] };
function buildAtlas() {
  const rows = Math.ceil(SPECIES.length / COLS), rt = ATLAS.rt ||= new THREE.WebGLRenderTarget(TILE * COLS, TILE * rows, { generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter, magFilter: THREE.LinearFilter, samples: 4 });
  const sc = new THREE.Scene(); sc.add(new THREE.AmbientLight(0xffffff, 1.1)); const dl = new THREE.DirectionalLight(0xfff2dc, 2.4); dl.position.set(0.4, 1, 1); sc.add(dl);
  const hl = new THREE.HemisphereLight(0xbfdcff, 0x3f6a5a, 0.8); sc.add(hl);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100), I = new THREE.Matrix4();
  const prev = { rt: renderer.getRenderTarget(), cc: renderer.getClearColor(new THREE.Color()), ca: renderer.getClearAlpha(), sc: renderer.getScissorTest() };
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.setScissorTest(true);
  SPECIES.forEach((sp, i) => {
    const P = propGeo(sp.name, 0), g = new THREE.Group(), a = new THREE.InstancedMesh(P.geo, propMat, 1); a.setMatrixAt(0, I); g.add(a);
    if (P.cards) { const l = new THREE.InstancedMesh(P.cards, P.cardMat || leafMat, 1); l.setMatrixAt(0, I); g.add(l); }
    const bb = new THREE.Box3().setFromBufferAttribute(P.geo.attributes.position); if (P.cards) bb.union(new THREE.Box3().setFromBufferAttribute(P.cards.attributes.position));
    const w = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z) * 1.04, h = (bb.max.y - bb.min.y) * 1.02, half = Math.max(w, h) / 2, cx = (bb.min.x + bb.max.x) / 2, cy = (bb.min.y + bb.max.y) / 2;
    cam.left = cx - half; cam.right = cx + half; cam.top = cy + half; cam.bottom = cy - half; cam.position.set(0, 0, 50); cam.lookAt(0, 0, 0); cam.position.x = 0; cam.updateProjectionMatrix();
    const col = i % COLS, row = Math.floor(i / COLS); renderer.setViewport(col * TILE, row * TILE, TILE, TILE); renderer.setScissor(col * TILE, row * TILE, TILE, TILE);
    sc.add(g); renderer.render(sc, cam); sc.remove(g);
    // where the tree sits in its square tile, in metres at scale 1
    ATLAS.tiles[i] = { u: col / COLS, v: row / rows, du: 1 / COLS, dv: 1 / rows, size: half * 2, x0: cx - half, y0: cy - half };
  });
  renderer.setScissorTest(prev.sc); renderer.setRenderTarget(prev.rt); renderer.setClearColor(prev.cc, prev.ca); renderer.setViewport(0, 0, renderer.domElement.width / renderer.getPixelRatio(), renderer.domElement.height / renderer.getPixelRatio());
  ATLAS.tex = rt.texture;
}
const impMat = new THREE.MeshBasicMaterial({ alphaTest: 0.5, side: THREE.DoubleSide, color: 0xffffff, alphaToCoverage: true });
impMat.onBeforeCompile = (sh) => {
  Object.assign(sh.uniforms, VEG_U);
  sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', A2C_FRAG);
  sh.vertexShader = 'uniform vec2 uVegC; uniform float uNearR, uMidR, uFarR; attribute vec4 aTile; attribute vec3 aSize;\n' + sh.vertexShader
    .replace('#include <uv_vertex>', '#include <uv_vertex>\n  vMapUv = aTile.xy + uv * aTile.zw;')
    .replace('#include <begin_vertex>', `
      vec3 c0 = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
      vec3 toC = cameraPosition - c0; toC.y = 0.0; vec3 rgt = normalize(vec3(toC.z, 0.0, -toC.x) + 1e-5);
      vec3 transformed = rgt * (position.x * aSize.x + aSize.z) + vec3(0.0, position.y * aSize.x + aSize.y, 0.0);
      float vd = distance(c0.xz, uVegC); if (vd < uMidR) transformed *= 0.0;
      transformed *= 1.0 - smoothstep(uFarR * 0.78, uFarR * 0.98, vd);   // the forest thins out gently at the edge of the drawn world`);
};
impMat.customProgramCacheKey = () => 'vegImpostor';
const quad = new THREE.PlaneGeometry(1, 1).translate(0.5, 0.5, 0);
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
    buildAtlas(); impMat.map = ATLAS.tex; impMat.needsUpdate = true;
    for (const t of [3000, 9000]) setTimeout(buildAtlas, t);   // again once the imported trees' leaf textures have loaded
  }
  geoFor(sp, v) { return propGeo(SPECIES[sp].name, v); }
  buildMeshes(items, far, cx, cz, ids) {
    const hidden = new Set(); if (far && ids) for (const [id, i] of ids) if (this.removed.has(id)) hidden.add(i);
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
      idx.forEach((i, k) => im.setMatrixAt(k, matrixOf(items, i, far ? hidden.has(i) : this.removed.has(`${cx},${cz},${i}`))));
      im.castShadow = !far; im.receiveShadow = true; im.computeBoundingSphere(); meshes.push(im); im.userData.idx = idx;
      if (P.cards && (!far || P.leafFar)) {
        const lm = new THREE.InstancedMesh(P.cards, cut(P.cardMat || leafMat, far), idx.length);
        idx.forEach((i, k) => lm.setMatrixAt(k, matrixOf(items, i, far ? hidden.has(i) : this.removed.has(`${cx},${cz},${i}`))));
        lm.castShadow = !far; lm.receiveShadow = true; lm.computeBoundingSphere(); meshes.push(lm); lm.userData.idx = idx;
      }
    }
    for (const m of meshes) this.group.add(m);
    return meshes;
  }
  // all of a block's trees as impostor cards: one instanced mesh
  buildImpostors(items, hidden) {
    const n = items.length / STRIDE, im = new THREE.InstancedMesh(quad, impMat, n), tile = new Float32Array(n * 4), size = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE, T = ATLAS.tiles[items[o]], s = items[o + 6];
      tile.set([T.u, T.v, T.du, T.dv], i * 4); size.set([T.size * s, T.y0 * s, T.x0 * s], i * 3);
      _m.makeTranslation(items[o + 2], items[o + 3], items[o + 4]); if (hidden.has(i)) _m.scale(_s.setScalar(0)); im.setMatrixAt(i, _m);
    }
    const g = quad.clone(); g.setAttribute('aTile', new THREE.InstancedBufferAttribute(tile, 4)); g.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3)); im.geometry = g;
    im.castShadow = false; im.receiveShadow = false; im.computeBoundingSphere(); im.boundingSphere.radius += 30; this.group.add(im); return im;
  }
  dropCell(map, key) { const c = map.get(key); if (!c) return; for (const m of c.meshes || []) { this.group.remove(m); m.dispose(); } if (c.imp) { this.group.remove(c.imp); c.imp.geometry.dispose(); c.imp.dispose(); } map.delete(key); if (map === this.near) this.onCell?.(key, null); }
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
        cell.items = m.items; cell.cx = cx; cell.cz = cz; cell.meshes = this.buildMeshes(m.items, false, cx, cz); for (const ms of cell.meshes) ms.userData.cell = cell; this.onCell?.(key, m.items, cx, cz);
      });
    }
    for (const [key, c] of this.near) { const [cx, cz] = key.split(',').map(Number); if (Math.hypot((cx + 0.5) * CELL - pos.x, (cz + 0.5) * CELL - pos.z) > NEAR_KEEP + CELL) this.dropCell(this.near, key); void c; }
    // far blocks
    const R = Math.ceil(FAR_R / FAR), fcx = Math.floor(pos.x / FAR), fcz = Math.floor(pos.z / FAR), per = FAR / CELL;
    for (let j = -R; j <= R; j++) for (let i = -R; i <= R; i++) {
      const bx = fcx + i, bz = fcz + j, key = bx + ',' + bz;
      if (this.far.has(key) || Math.hypot((bx + 0.5) * FAR - pos.x, (bz + 0.5) * FAR - pos.z) > FAR_R + FAR * 0.7) continue;
      const blk = { meshes: null }; this.far.set(key, blk);
      this.pool.post({ type: 'flora', cx: bx * per, cz: bz * per, n: per }).then((m) => {
        if (this.far.get(key) !== blk) return;
        // items come cell by cell, in order: recover each one's "cx,cz,i" id
        const ids = new Map(), cnt = new Map();
        for (let i = 0; i < m.items.length / STRIDE; i++) { const ck = Math.floor(m.items[i * STRIDE + 2] / CELL) + ',' + Math.floor(m.items[i * STRIDE + 4] / CELL), k = cnt.get(ck) || 0; cnt.set(ck, k + 1); ids.set(ck + ',' + k, i); }
        blk.items = m.items; blk.ids = ids; blk.bx = bx; blk.bz = bz;
        const hidden = new Set(); for (const [id, i] of ids) if (this.removed.has(id)) hidden.add(i); blk.imp = this.buildImpostors(m.items, hidden);
      });
    }
    for (const [key, blk] of this.far) {
      const [bx, bz] = key.split(',').map(Number), d = Math.hypot((bx + 0.5) * FAR - pos.x, (bz + 0.5) * FAR - pos.z);
      if (d > FAR_R + FAR * 1.4) { this.dropCell(this.far, key); continue; }
      if (!blk.items) continue;
      if (d < MID_R + FAR * 0.75 && !blk.meshes) blk.meshes = this.buildMeshes(blk.items, true, null, null, blk.ids);
      else if (d > MID_R + FAR * 1.1 && blk.meshes) { for (const m of blk.meshes) { this.group.remove(m); m.dispose(); } blk.meshes = null; }
    }
    // impostors take their light from the sky
    const k = Math.min(1.15, Math.max(0.06, (sun.intensity * 0.3 + hemi.intensity) / 1.55)); impMat.color.setScalar(k);
  }
  // Remove one tree/rock (felled or mined): hidden in its near cell and far block now, and remembered for when they are rebuilt
  remove(cx, cz, i) {
    const key = cx + ',' + cz; this.removed.add(`${cx},${cz},${i}`);
    const c = this.near.get(key);
    if (c?.meshes) for (const m of c.meshes) { const k = m.userData.idx.indexOf(i); if (k >= 0) { m.setMatrixAt(k, matrixOf(c.items, i, true)); m.instanceMatrix.needsUpdate = true; } }
    const per = FAR / CELL, bkey = Math.floor(cx / per) + ',' + Math.floor(cz / per), b = this.far.get(bkey);
    const fi = b?.ids?.get(`${cx},${cz},${i}`);
    if (fi !== undefined && b.meshes) for (const m of b.meshes) { const k = m.userData.idx.indexOf(fi); if (k >= 0) { m.setMatrixAt(k, matrixOf(b.items, fi, true)); m.instanceMatrix.needsUpdate = true; } }
    if (fi !== undefined && b.imp) { b.imp.setMatrixAt(fi, _m.makeScale(0, 0, 0)); b.imp.instanceMatrix.needsUpdate = true; }
  }
  // One tree or rock as its own little object (for felling animations): instanced meshes of count 1 in a group
  single(sp, v) {
    const P = this.geoFor(sp, v), g = new THREE.Group(), I = new THREE.Matrix4();
    const a = new THREE.InstancedMesh(P.geo, cut(propMat, false), 1); a.setMatrixAt(0, I); a.castShadow = a.receiveShadow = true; a.frustumCulled = false; g.add(a);
    if (P.cards) { const l = new THREE.InstancedMesh(P.cards, cut(P.cardMat || leafMat, false), 1); l.setMatrixAt(0, I); l.castShadow = true; l.frustumCulled = false; g.add(l); }
    return g;
  }
}
void mergeParts;
