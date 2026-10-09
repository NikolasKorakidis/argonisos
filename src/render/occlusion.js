// Keeping the hero in view: whatever stands between the camera and the hero fades to see-through, and comes back when
// the view is clear. Only the obstructing things change, and shared materials are never touched:
//   building pieces: each piece already owns its materials, so those fade directly (and are restored exactly)
//   site buildings: their meshes share materials, so an obstructing mesh gets its own faded copy until it's clear
//   trees and rocks: drawn as instances of shared meshes, so that one instance is hidden and a faded single copy stands
//                    in its place until the view is clear
import * as THREE from 'three';
import { camera } from './core.js';
import { STRIDE } from '../world/flora.js';

const ray = new THREE.Raycaster(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const FADE = 0.28, KEEP = 0.25;   // opacity when faded; seconds an object stays faded after it stops obstructing

export class Occlusion {
  constructor(g) { this.g = g; this.faded = new Map(); this.t = 0; }   // key → { kind, ..., seen }
  update(dt) {
    const g = this.g, P = g.player; if (!P || P.dead || g.S.fly) { this.clearAll(); return; }
    this.t -= dt; const now = performance.now() / 1000;
    if (this.t <= 0) {
      this.t = 0.08;
      const hits = new Map();
      for (const h of [1.65, 1.0]) {
        const target = _a.copy(P.pos); target.y += h; _d.copy(target).sub(camera.position); const len = _d.length(); if (len < 0.5) continue;
        ray.set(camera.position, _d.normalize()); ray.far = len - 0.3;
        for (const hit of ray.intersectObjects(this.candidates(), false)) { const key = this.keyOf(hit); if (key) hits.set(key, hit); }
      }
      for (const [key, hit] of hits) { const e = this.faded.get(key); if (e) e.seen = now; else this.fade(key, hit, now); }
    }
    // ease opacity, and restore what has been clear for a moment
    for (const [key, e] of this.faded) {
      const clear = now - e.seen > KEEP; e.k += ((clear ? 1 : FADE) - e.k) * Math.min(1, dt * 10);
      this.apply(e, e.k);
      if (clear && e.k > 0.97) { this.restore(e); this.faded.delete(key); }
    }
  }
  // what can obstruct: building pieces near the camera, site buildings, nearby trees and rocks
  candidates() {
    const g = this.g, out = [], c = camera.position;
    for (const p of g.build.near(c.x, c.z, 14)) for (const m of p.inner.children) out.push(m);
    for (const grp of g.structures.groups) if (grp.position.distanceTo(c) < 70) for (const m of grp.children) if (m.isMesh) out.push(m);
    for (const cell of g.veg.near.values()) for (const m of cell.meshes || []) out.push(m);
    return out;
  }
  keyOf(hit) {
    const o = hit.object;
    if (o.userData.piece) return 'p:' + o.userData.piece.uid;
    if (o.isInstancedMesh && o.userData.cell && hit.instanceId !== undefined) { const i = o.userData.idx[hit.instanceId], c = o.userData.cell; return `t:${c.cx},${c.cz},${i}`; }
    if (o.parent && this.g.structures.groups.includes(o.parent)) return 's:' + o.uuid;
    return null;
  }
  fade(key, hit, now) {
    const o = hit.object, e = { key, seen: now, k: 1 };
    if (key[0] === 'p') { const p = o.userData.piece; e.kind = 'piece'; e.piece = p; e.orig = p.mats.map((m) => ({ m, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite })); }
    else if (key[0] === 's') { e.kind = 'site'; e.mesh = o; e.origMat = o.material; e.mat = [].concat(o.material).map((m) => { const c = m.clone(); c.transparent = true; c.depthWrite = false; return c; }); o.material = Array.isArray(o.material) ? e.mat : e.mat[0]; }
    else {
      const c = o.userData.cell, i = o.userData.idx[hit.instanceId], veg = this.g.veg, it = c.items, s = i * STRIDE;
      if (veg.removed.has(`${c.cx},${c.cz},${i}`)) return;
      e.kind = 'tree'; e.cell = c; e.i = i;
      const single = veg.single(it[s], it[s + 1]); single.position.set(it[s + 2], it[s + 3], it[s + 4]); single.rotation.y = it[s + 5]; single.scale.setScalar(it[s + 6]);
      e.mats = []; single.traverse((m) => { if (m.isMesh) { const cm = m.material.clone(); cm.transparent = true; cm.depthWrite = false; m.material = cm; m.castShadow = false; e.mats.push(cm); } });
      this.g.scene.add(single); e.single = single;
      e.meshes = c.meshes.filter((m) => m.userData.idx.includes(i)); for (const m of e.meshes) { const k = m.userData.idx.indexOf(i); m.getMatrixAt(k, _m); e.mtx = e.mtx || []; e.mtx.push(_m.clone()); m.setMatrixAt(k, _m.makeScale(0, 0, 0)); m.instanceMatrix.needsUpdate = true; }
    }
    this.faded.set(key, e);
  }
  apply(e, k) {
    if (e.kind === 'piece') for (const m of e.piece.mats) { m.transparent = true; m.depthWrite = k > 0.95; m.opacity = k; }
    else if (e.kind === 'site') for (const m of e.mat) m.opacity = k;
    else if (e.kind === 'tree') for (const m of e.mats) m.opacity = k;
  }
  restore(e) {
    if (e.kind === 'piece') { for (const o of e.orig) { o.m.transparent = o.transparent; o.m.opacity = o.opacity; o.m.depthWrite = o.depthWrite; } }
    else if (e.kind === 'site') { e.mesh.material = e.origMat; for (const m of e.mat) m.dispose(); }
    else if (e.kind === 'tree') {
      this.g.scene.remove(e.single); for (const m of e.mats) m.dispose();
      // put the instance back, unless the tree was felled meanwhile or its cell was rebuilt
      const { cx, cz } = e.cell, live = this.g.veg.near.get(cx + ',' + cz) === e.cell;
      if (live && !this.g.veg.removed.has(`${cx},${cz},${e.i}`)) e.meshes.forEach((m, j) => { const k = m.userData.idx.indexOf(e.i); if (k >= 0) { m.setMatrixAt(k, e.mtx[j]); m.instanceMatrix.needsUpdate = true; } });
    }
  }
  clearAll() { for (const e of this.faded.values()) this.restore(e); this.faded.clear(); }
}
