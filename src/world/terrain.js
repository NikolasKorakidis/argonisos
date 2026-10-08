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
    g.setAttribute('color', new THREE.BufferAttribute(m.col, 3)); g.setAttribute('uv', new THREE.BufferAttribute(m.uv, 2)); g.setIndex(INDEX);
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
