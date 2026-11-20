// Keeping the hero in view: whatever stands between the camera and the hero fades to see-through, and comes back when
// the view is clear. Only the obstructing things change, and shared materials are never touched:
//   building pieces: each piece already owns its materials, so those fade directly (and are restored exactly)
//   site buildings: their meshes share materials, so an obstructing mesh gets its own faded copy until it's clear
//   trees and rocks: drawn as instances of shared batches, so that one tree is hidden from its batch and a faded single
//                    copy stands in its place until the view is clear
import * as THREE from 'three';
import { camera } from './core.js';
import { STRIDE } from '../world/flora.js';

const ray = new THREE.Raycaster(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const FADE = 0.28, KEEP = 0.25;   // opacity when faded; seconds an object stays faded after it stops obstructing
// ...and closer to the camera than NEAR[1] metres it fades further, gone by NEAR[0]: a trunk the camera all but touches
// (a fir's, thirty centimetres off, with the camera ten metres back in a thick wood) filled half the picture as a flat,
// see-through slab
const NEAR = [0.6, 2.5], HUG = 1.5;   // (HUG: how near a trunk's round the camera must come for the tree to fade, see update)
// The faded copies of materials are kept for the next time rather than thrown away: a material disposed takes its shader
// program with it, and walking through the woods, with trunk after trunk between the camera and the hero, compiled the
// same program again and again, a hitch each time. Each copy is made like the source again when it is taken.
// A copy keeps its source's shader patches (a clone loses them: the wind, the wetness, the bands' fades, the leaves'
// cut-out) under a program key of its own shared by every copy of that source, so taking one compiles nothing new. Its
// cut-out is tested on the leaf's own alpha, before the fade: tested after it, as the plain alpha test is, every leaf
// fell under the threshold and a faded tree lost its crown.
const SPARE = new Map();   // source material → faded copies not in use
const FADE_TEST = `#ifdef USE_ALPHATEST
  if (diffuseColor.a < alphaTest * opacity) discard; diffuseColor.a = opacity;
#endif`;
function fadedCopy(src, coverage = true) {
  let c = SPARE.get(src)?.pop();
  if (!c) { c = src.clone(); const base = src.onBeforeCompile, key = 'faded|' + src.customProgramCacheKey();
    c.onBeforeCompile = (sh, r) => { sh.fragmentShader = sh.fragmentShader.replace('#include <alphatest_fragment>', FADE_TEST); base.call(src, sh, r); }; c.customProgramCacheKey = () => key; }
  c.copy(src); c.transparent = true; c.depthWrite = false; if (!coverage) c.alphaToCoverage = false;   // (coverage + blending would dither)
  c.needsUpdate = true; c.userData.fadeSrc = src; return c;
}
function spare(c) { const src = c.userData.fadeSrc; (SPARE.get(src) || SPARE.set(src, []).get(src)).push(c); }
// A faded copy of a tree's (or a site's: coverage kept) material made ahead, for the loading screen to compile (main.js warmUp), and kept for the
// first tree that comes between the camera and the hero
export function fadeAhead(src, coverage = false) { if (SPARE.get(src)?.length) return SPARE.get(src)[0]; const c = fadedCopy(src, coverage); spare(c); return c; }

export class Occlusion {
  constructor(g) { this.g = g; this.faded = new Map(); this.t = 0; }   // key → { kind, ..., seen }
  update(dt) {
    const g = this.g, P = g.player; if (!P || P.dead || g.S.fly) { this.clearAll(); return; }
    this.t -= dt; const now = performance.now() / 1000;
    if (this.t <= 0) {
      this.t = 0.08;
      const hits = new Map(), cand = this.candidates();
      for (const h of [1.65, 1.0]) {
        const target = _a.copy(P.pos); target.y += h; _d.copy(target).sub(camera.position); const len = _d.length(); if (len < 0.5) continue;
        ray.set(camera.position, _d.normalize()); ray.far = len - 0.3;
        for (const hit of ray.intersectObjects(cand, false)) { const key = this.keyOf(hit); if (key && !(hits.get(key)?.distance < hit.distance)) hits.set(key, hit); }
      }
      // and a tree or rock the camera stands in or right against, whether or not it hides the hero: a camera far back in a
      // thick wood ends up inside a trunk or among its lowest boughs, and the inside of the tree blacked out half the picture
      // (its distance taken from the trunk's round, so it fades right out: NEAR)
      const c = camera.position;
      for (const k of g.colliders.near(c.x, c.z, HUG)) { const r = k.ref; if (r?.cx === undefined || (k.h !== undefined && c.y > (k.y ?? 0) + k.h + 1)) continue;
        const d = Math.hypot(c.x - k.x, c.z - k.z) - k.r, cell = g.veg.near.get(r.cx + ',' + r.cz), key = `t:${r.cx},${r.cz},${r.i}`; if (d > HUG || !cell || (hits.get(key)?.distance < d)) continue;
        hits.set(key, { distance: Math.max(0, d), tree: { cell, i: r.i } }); }
      for (const [key, hit] of hits) { const e = this.faded.get(key) || this.fade(key, hit, now); if (e) { e.seen = now; e.near = hit.distance; } }
    }
    // ease opacity, and restore what has been clear for a moment
    for (const [key, e] of this.faded) {
      const clear = now - e.seen > KEEP, to = FADE * Math.min(1, Math.max(0, (e.near - NEAR[0]) / (NEAR[1] - NEAR[0]))); e.k += ((clear ? 1 : to) - e.k) * Math.min(1, dt * 10);
      this.apply(e, e.k);
      if (clear && e.k > 0.97) { this.restore(e); this.faded.delete(key); }
    }
  }
  // what can obstruct: building pieces near the camera, site buildings, nearby trees and rocks
  candidates() {
    const g = this.g, out = this.cand ||= [], c = camera.position; out.length = 0;   // (one list for both rays, kept)
    for (const p of g.build.near(c.x, c.z, 14)) for (const m of p.inner.children) out.push(m);
    for (const grp of g.structures.groups) if (grp.position.distanceTo(c) < 70) for (const m of grp.children) if (m.isMesh) out.push(m);
    for (const b of g.veg.batches.values()) if (b.meshes[0].count) for (const m of b.meshes) if (!m.userData.shade) out.push(m);   // (not the shadows' stand-ins: the ray's layer never meets them)
    // a faded tree is out of its batch: its stand-in copy has to keep catching the ray, or it would pop back and fade again
    for (const e of this.faded.values()) if (e.kind === 'tree') e.single.traverse((m) => { if (m.isMesh) out.push(m); });
    return out;
  }
  keyOf(hit) {
    const o = hit.object;
    if (o.userData.fadeKey) return o.userData.fadeKey;
    if (o.userData.piece) return 'p:' + o.userData.piece.uid;
    if (o.userData.batch && hit.instanceId !== undefined) { const t = this.g.veg.treeAt(o, hit.instanceId); hit.tree = t; return `t:${t.cell.cx},${t.cell.cz},${t.i}`; }
    if (o.parent && this.g.structures.groups.includes(o.parent)) return 's:' + o.uuid;
    return null;
  }
  fade(key, hit, now) {
    const o = hit.object, e = { key, seen: now, k: 1 };
    if (key[0] === 'p') { const p = o.userData.piece; e.kind = 'piece'; e.piece = p; e.orig = p.mats.map((m) => ({ m, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite })); }
    else if (key[0] === 's') { e.kind = 'site'; e.mesh = o; e.origMat = o.material; e.mat = [].concat(o.material).map((m) => fadedCopy(m)); o.material = Array.isArray(o.material) ? e.mat : e.mat[0]; }
    else {
      const { cell: c, i } = hit.tree, veg = this.g.veg, it = c.items, s = i * STRIDE;
      if (veg.removed.has(`${c.cx},${c.cz},${i}`)) return null;
      e.kind = 'tree'; e.cell = c; e.i = i;
      const single = veg.single(it[s], it[s + 1]); single.position.set(it[s + 2], it[s + 3], it[s + 4]); single.rotation.y = it[s + 5]; single.scale.setScalar(it[s + 6]);
      e.mats = []; single.traverse((m) => { if (m.isMesh) { const cm = fadedCopy(m.material, false); m.material = cm; m.castShadow = false; m.userData.fadeKey = key; e.mats.push(cm); } });
      this.g.scene.add(single); e.single = single;
      veg.hideTree(c, i, true);
    }
    this.faded.set(key, e); return e;
  }
  apply(e, k) {
    if (e.kind === 'piece') for (const m of e.piece.mats) { m.transparent = true; m.depthWrite = k > 0.95; m.opacity = k; }
    else if (e.kind === 'site') for (const m of e.mat) m.opacity = k;
    else if (e.kind === 'tree') for (const m of e.mats) m.opacity = k;
  }
  restore(e) {
    if (e.kind === 'piece') { for (const o of e.orig) { o.m.transparent = o.transparent; o.m.opacity = o.opacity; o.m.depthWrite = o.depthWrite; } }
    else if (e.kind === 'site') { e.mesh.material = e.origMat; for (const m of e.mat) spare(m); }
    else if (e.kind === 'tree') {
      this.g.veg.dropSingle(e.single); for (const m of e.mats) spare(m);
      // put the instance back, unless the tree was felled meanwhile or its cell was rebuilt
      const { cx, cz } = e.cell, live = this.g.veg.near.get(cx + ',' + cz) === e.cell;
      if (live) this.g.veg.hideTree(e.cell, e.i, false);
    }
  }
  clearAll() { for (const e of this.faded.values()) this.restore(e); this.faded.clear(); }
}
