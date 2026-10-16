// Streaming terrain: a quadtree over the whole world. Patches near the camera are small and dense (2 m between
// vertices), far ones are large and coarse; every patch has the same 32×32 grid, so a few hundred draw calls cover
// 4 km. Patches are built in a small pool of workers and swapped in only when ready: while children are still being
// built the parent stays on screen, so the ground never has holes. Skirts hide the seams between detail levels.
import * as THREE from 'three';
import { WORLD } from './gen.js';

const RES = 32, MIN_SIZE = 64, ROOT = WORLD.SIZE, SPLIT = 1.35, MAX_INFLIGHT = 6, CACHE = 700;

// one shared index buffer: the grid plus the skirt quads
const INDEX = (() => {
  const n = RES + 1, idx = [];
  for (let j = 0; j < RES; j++) for (let i = 0; i < RES; i++) { const a = j * n + i, b = a + 1, c = a + n, d = c + 1; idx.push(a, c, b, b, c, d); }
  const ring = [];
  for (let i = 0; i < RES; i++) ring.push(i);
  for (let j = 0; j < RES; j++) ring.push(j * n + RES);
  for (let i = RES; i > 0; i--) ring.push(RES * n + i);
  for (let j = RES; j > 0; j--) ring.push(j * n);
  const s0 = n * n, L = ring.length;
  for (let k = 0; k < L; k++) { const a = ring[k], b = ring[(k + 1) % L], sa = s0 + k, sb = s0 + ((k + 1) % L); idx.push(a, sa, b, b, sa, sb); }
  return new THREE.BufferAttribute(new Uint32Array(idx), 1);
})();

export class Terrain {
  constructor(scene, material, pool) {
    this.scene = scene; this.material = material; this.pool = pool;
    this.group = new THREE.Group(); this.group.name = 'terrain'; scene.add(this.group);
    this.nodes = new Map();           // key -> { key, x0, z0, size, mesh, state: 'none'|'queued'|'pending'|'ready', lastUsed, empty }
    this.queue = []; this.inflight = 0; this.frame = 0;
    this.visible = new Set();
  }
  requestHeightTexture(N, extent) { return this.pool.post({ type: 'heightTex', N, extent }); }
  node(x0, z0, size) {
    const key = `${size}:${x0}:${z0}`; let nd = this.nodes.get(key);
    if (!nd) { nd = { key, x0, z0, size, mesh: null, state: 'none', lastUsed: 0, empty: false }; this.nodes.set(key, nd); }
    return nd;
  }
  want(nd, dist) { if (nd.state === 'none') { nd.state = 'queued'; nd.dist = dist; this.queue.push(nd); } else if (nd.state === 'queued') nd.dist = Math.min(nd.dist, dist); }
  receive(m) {
    this.inflight--;
    const nd = this.nodes.get(m.id); if (!nd) return;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(m.nor, 3));
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setAttribute('rock', new THREE.BufferAttribute(m.rock, 1)); g.setIndex(INDEX);
    g.boundingBox = new THREE.Box3(new THREE.Vector3(nd.x0, m.minH - 4, nd.z0), new THREE.Vector3(nd.x0 + nd.size, m.maxH, nd.z0 + nd.size));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const mesh = new THREE.Mesh(g, this.material); mesh.receiveShadow = true; mesh.matrixAutoUpdate = false; mesh.visible = false;
    nd.mesh = mesh; nd.state = 'ready'; nd.empty = m.maxH < -6;   // all deep sea: the ocean surface covers it, skip drawing
    this.group.add(mesh);
  }
  // Pick the patches to draw around point p (camera). Returns true if the ground near p is fully covered.
  select(nd, p, out) {
    const cx = nd.x0 + nd.size / 2, cz = nd.z0 + nd.size / 2, d = Math.max(0, Math.hypot(p.x - cx, p.z - cz) - nd.size * 0.5) + Math.max(0, p.y - 120) * 0.5;
    nd.lastUsed = this.frame;
    if (nd.size > MIN_SIZE && d < nd.size * SPLIT) {
      const h = nd.size / 2, kids = [this.node(nd.x0, nd.z0, h), this.node(nd.x0 + h, nd.z0, h), this.node(nd.x0, nd.z0 + h, h), this.node(nd.x0 + h, nd.z0 + h, h)];
      const sub = []; let all = true;
      for (const k of kids) if (!this.select(k, p, sub)) all = false;
      if (all) { out.push(...sub); return true; }
      this.want(nd, d);                                    // children not ready yet: draw this level meanwhile
      if (nd.state === 'ready') { out.push(nd); return true; }
      out.push(...sub); return false;
    }
    this.want(nd, d);
    if (nd.state === 'ready') { out.push(nd); return true; }
    return false;
  }
  update(camPos) {
    this.frame++;
    const sel = []; this.select(this.node(-ROOT / 2, -ROOT / 2, ROOT), camPos, sel);
    const now = new Set(sel);
    for (const nd of this.visible) if (!now.has(nd) && nd.mesh) nd.mesh.visible = false;
    for (const nd of sel) if (nd.mesh) nd.mesh.visible = !nd.empty;
    this.visible = now;
    // dispatch the nearest queued patches
    if (this.queue.length) {
      this.queue.sort((a, b) => a.dist - b.dist);
      while (this.inflight < MAX_INFLIGHT && this.queue.length) {
        const nd = this.queue.shift(); if (nd.state !== 'queued') continue;
        if (this.frame - nd.lastUsed > 3) { nd.state = 'none'; continue; }   // no longer wanted (the camera moved on)
        nd.state = 'pending'; this.inflight++;
        this.pool.post({ type: 'patch', id: nd.key, x0: nd.x0, z0: nd.z0, size: nd.size, res: RES }).then((m) => this.receive(m));
      }
    }
    // forget patches nobody has looked at for a while
    if (this.frame % 120 === 0 && this.nodes.size > CACHE) {
      const old = [...this.nodes.values()].filter((nd) => nd.state === 'ready' && this.frame - nd.lastUsed > 300).sort((a, b) => a.lastUsed - b.lastUsed);
      for (const nd of old.slice(0, this.nodes.size - CACHE)) { this.group.remove(nd.mesh); nd.mesh.geometry.dispose(); this.nodes.delete(nd.key); }
    }
  }
  get pending() { return this.inflight + this.queue.length; }
  get drawn() { let n = 0; for (const nd of this.visible) if (nd.mesh && nd.mesh.visible) n++; return n; }
}

// ---- Bare rock (tester feedback, 15 and 16 Oct): where the slope rule makes the ground rock (the 'rock' attribute the
// worker fills from groundColor), the terrain shader lays a rock surface over the colour: slabs split by dark cracks,
// each slab its own grey, fine grain, a few lichen specks, and layers that follow the contours (bands of equal height,
// like bedded stone). It is projected from three sides, so steep faces don't smear, and its relief catches the light.
// One tileable texture made here at start-up: R tone, G relief, B lichen, A broad variation.
const ROCK_TEX = (() => {
  const N = 256, C = 4, d = new Uint8Array(N * N * 4);
  let s = 91; const r = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const pts = Array.from({ length: C * C }, () => [r(), r(), r()]);   // a point in each cell of a C×C grid (and the slab's tone)
  const h21 = (x, z) => { const v = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return v - Math.floor(v); };
  const noise = (period, oct, seed) => { const f = new Float32Array(N * N);   // tileable value noise
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) { let a = 0.5, fr = 1, v = 0;
      for (let o = 0; o < oct; o++) { const P = period * fr, px = x / N * P, pz = y / N * P, xi = Math.floor(px), zi = Math.floor(pz), xf = px - xi, zf = pz - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
        const hh = (i, j) => h21(((i % P) + P) % P + o * 17 + seed, ((j % P) + P) % P + o * 31 - seed);
        v += a * ((hh(xi, zi) * (1 - u) + hh(xi + 1, zi) * u) * (1 - w) + (hh(xi, zi + 1) * (1 - u) + hh(xi + 1, zi + 1) * u) * w); a *= 0.5; fr *= 2; }
      f[y * N + x] = v; }
    return f; };
  const grain = noise(32, 3, 0), broad = noise(4, 3, 7), lichen = noise(12, 3, 3), wa = noise(6, 3, 11), wb = noise(6, 3, 19);
  // the cracks: the edges of a Voronoi pattern whose coordinates are warped by noise, so they wander and kink like real
  // fractures rather than run straight; big slabs (C across the tile) split again by finer cracks (3C)
  const cells = (u, v, C, P) => { const ci = Math.floor(u), cj = Math.floor(v); let f1 = 9, f2 = 9, id = 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      const i = ci + di, j = cj + dj, p = P[((j % C) + C) % C * C + ((i % C) + C) % C], dd = Math.hypot(i + p[0] - u, j + p[1] - v);
      if (dd < f1) { f2 = f1; f1 = dd; id = p[2]; } else if (dd < f2) f2 = dd;
    }
    return [f2 - f1, id]; };
  const fine = Array.from({ length: 9 * C * C }, () => [r(), r(), r()]);
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const k = y * N + x, g = grain[k], ox = (wa[k] - 0.5) * 0.9, oz = (wb[k] - 0.5) * 0.9;
    const [e1, id] = cells(x / N * C + ox, y / N * C + oz, C, pts), [e2, id2] = cells(x / N * 3 * C + ox * 2, y / N * 3 * C + oz * 2, 3 * C, fine);
    const w1 = 0.05 + wa[k] * 0.06, c1 = Math.min(1, e1 / w1), c2 = 1 - (1 - Math.min(1, e2 / 0.09)) * 0.55;   // (crack widths vary along their length)
    const relief = Math.min(1, e1 / 0.5) * 0.55 + Math.min(1, e2 / 0.3) * 0.15 + g * 0.3;   // slabs rounded off toward their cracks
    const tone = (0.48 + id * 0.42 + (id2 - 0.5) * 0.12 + (g - 0.5) * 0.4) * (0.25 + 0.75 * c1 * c1) * c2;
    d.set([Math.min(255, tone * 200), relief * 255, lichen[k] * 255, broad[k] * 255], k * 4);
  }
  const t = new THREE.DataTexture(d, N, N); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true; t.anisotropy = 8; t.needsUpdate = true; return t;
})();
export function rockGround(mat) {
  const base = mat.onBeforeCompile;
  mat.onBeforeCompile = (sh, r) => {
    base?.call(mat, sh, r);
    sh.uniforms.uRockTex = { value: ROCK_TEX };
    sh.vertexShader = 'attribute float rock; varying float vRock; varying vec3 vRockP, vRockN;\n' + sh.vertexShader.replace('#include <project_vertex>', `
      vRock = rock; vRockP = (modelMatrix * vec4(transformed, 1.0)).xyz; vRockN = normalize(mat3(modelMatrix) * objectNormal);
      #include <project_vertex>`);
    sh.fragmentShader = 'uniform sampler2D uRockTex; varying float vRock; varying vec3 vRockP, vRockN;\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      // (sampled everywhere, not only on rock: the relief's screen derivatives need every pixel of the quad)
      vec3 rbw = pow(abs(vRockN), vec3(4.0)); rbw /= rbw.x + rbw.y + rbw.z;
      vec3 rp = vRockP / 7.0;   // (a tile 7 m across: slabs of about 1.7 m)
      vec4 rk = texture2D(uRockTex, rp.zy) * rbw.x + texture2D(uRockTex, rp.xz) * rbw.y + texture2D(uRockTex, rp.xy + 0.37) * rbw.z;
      float rbroad = texture2D(uRockTex, vRockP.xz / 41.0 + 0.5).a;
      float rlayer = vRockP.y / 1.7 + (rbroad - 0.5) * 2.5, rbed = abs(fract(rlayer) - 0.5) * 2.0;   // bedding: thin dark seams along the contours
      float rtone = (0.4 + rk.r * 0.85) * mix(0.82, 1.1, step(0.5, fract(rlayer * 0.5))) * mix(0.62, 1.0, smoothstep(0.0, 0.12, rbed)) * (0.85 + rbroad * 0.3);
      vec3 rcol = diffuseColor.rgb * rtone;
      rcol = mix(rcol, rcol * vec3(0.85, 1.0, 0.62), smoothstep(0.72, 0.85, rk.b) * 0.6);   // lichen
      diffuseColor.rgb = mix(diffuseColor.rgb, rcol, vRock);
      float rockRelief = (rk.g + smoothstep(0.0, 0.12, rbed) * 0.35) * vRock * (1.0 - smoothstep(25.0, 70.0, length(vViewPosition)));`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      {   // the relief tilts the normal (bump mapping from screen-space derivatives)
        vec3 sx = dFdx(-vViewPosition), sy = dFdy(-vViewPosition), r1 = cross(sy, normal), r2 = cross(normal, sx);
        float det = dot(sx, r1) * faceDirection, hx = dFdx(rockRelief) * 0.25, hy = dFdy(rockRelief) * 0.25;
        normal = normalize(abs(det) * normal - sign(det) * (hx * r1 + hy * r2));
      }`);
  };
}
