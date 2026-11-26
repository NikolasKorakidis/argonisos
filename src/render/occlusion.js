// Keeping the hero in view (Patch 25: the Greek reviewer, 23 Nov: "instead of the things in front of the camera disappearing
// when they block it, the camera itself should move closer to the player, like Valheim"). Two parts:
//   the camera's collision (castCamera, below): the follow camera is cast from the hero's head to where it wants to be
//     and stops in front of the first solid thing on the way (player.js updateCamera), so walls, rocks, trunks, roofs and
//     the ground no longer fade: they hold the camera off instead
//   foliage: Valheim lets the camera through leaves, and so does this; a tree whose crown comes between the camera and the
//     hero, or that the camera stands among, still fades (Occlusion). Trees are drawn as instances of shared batches, so
//     that one tree is hidden from its batch and a faded single copy stands in its place until the view is clear. (Building
//     pieces and the sites' buildings faded here too until Patch 25.)
import * as THREE from 'three';
import { camera } from './core.js';
import { STRIDE, SPECIES } from '../world/flora.js';
import { groundAt } from '../world/groundcut.js';

const ray = new THREE.Raycaster(), _a = new THREE.Vector3(), _d = new THREE.Vector3(), _m = new THREE.Matrix4();
const FADE = 0.28, KEEP = 0.25;   // opacity when faded; seconds an object stays faded after it stops obstructing
// ...and closer to the camera than NEAR[1] metres it fades further, gone by NEAR[0]: a trunk the camera all but touches
// (a fir's, thirty centimetres off, with the camera ten metres back in a thick wood) filled half the picture as a flat,
// see-through slab
const NEAR = [0.6, 2.5], HUG = 1.5, HEAD = [1.65], MIDDLE = [1.0];   // (HUG: how near a trunk's round the camera must come for the tree to fade, see update)
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
  constructor(g) { this.g = g; this.faded = new Map(); this.t = 0; g.player.camCast = (a, b, o) => castCamera(g, a, b, o); }   // key → { kind, ..., seen }
  update(dt) {
    const g = this.g, P = g.player; if (!P || P.dead || g.S.fly) { this.clearAll(); return; }
    this.t -= dt; const now = performance.now() / 1000;
    if (this.t <= 0) {
      // (the two rays, to the hero's head and to his middle, in turn, each every 80 ms as before: both at once, through the
      // crowns of the woods, made a frame 1.5-2 ms longer every fifth one)
      this.t = 0.04; this.ray = (this.ray || 0) ^ 1;
      const hits = new Map(), cand = this.candidates();
      for (const h of this.ray ? HEAD : MIDDLE) {
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
  // what can obstruct: nearby trees (and rocks: the camera is held off those, so only their tops ever come between)
  candidates() {
    const g = this.g, out = this.cand ||= []; out.length = 0;   // (one list for both rays, kept)
    for (const b of g.veg.batches.values()) if (b.meshes[0].count) for (const m of b.meshes) if (!m.userData.shade) out.push(m);   // (not the shadows' stand-ins: the ray's layer never meets them)
    // a faded tree is out of its batch: its stand-in copy has to keep catching the ray, or it would pop back and fade again
    for (const e of this.faded.values()) if (e.kind === 'tree') e.single.traverse((m) => { if (m.isMesh) out.push(m); });
    return out;
  }
  keyOf(hit) {
    const o = hit.object;
    if (o.userData.fadeKey) return o.userData.fadeKey;
    if (o.userData.batch && hit.instanceId !== undefined) { const t = this.g.veg.treeAt(o, hit.instanceId); hit.tree = t; return `t:${t.cell.cx},${t.cell.cz},${t.i}`; }
    return null;
  }
  fade(key, hit, now) {
    const e = { key, seen: now, k: 1, kind: 'tree' }, { cell: c, i } = hit.tree, veg = this.g.veg, it = c.items, s = i * STRIDE;
    if (veg.removed.has(`${c.cx},${c.cz},${i}`)) return null;
    e.cell = c; e.i = i;
    const single = veg.single(it[s], it[s + 1]); single.position.set(it[s + 2], it[s + 3], it[s + 4]); single.rotation.y = it[s + 5]; single.scale.setScalar(it[s + 6]);
    e.mats = []; single.traverse((m) => { if (m.isMesh) { const cm = fadedCopy(m.material, false); m.material = cm; m.castShadow = false; m.userData.fadeKey = key; e.mats.push(cm); } });
    this.g.scene.add(single); e.single = single;
    veg.hideTree(c, i, true);
    this.faded.set(key, e); return e;
  }
  apply(e, k) { for (const m of e.mats) m.opacity = k; }
  restore(e) {
    this.g.veg.dropSingle(e.single); for (const m of e.mats) spare(m);
    // put the instance back, unless the tree was felled meanwhile or its cell was rebuilt
    const { cx, cz } = e.cell, live = this.g.veg.near.get(cx + ',' + cz) === e.cell;
    if (live) this.g.veg.hideTree(e.cell, e.i, false);
  }
  clearAll() { for (const e of this.faded.values()) this.restore(e); this.faded.clear(); }
}

// ---- The camera's collision. A sphere of CAST.r metres swept from a (the hero's head, or the shoulder the camera looks
// over) to b (where the camera would be): how far it gets before it meets something solid, in metres (the whole way if
// nothing). What's solid, all of it from what the game already keeps for walking, never the meshes:
//   the collider grid (colliders.js: trunks, rocks and boulders, posts, the sites' walls and columns, logs, rubble), each a
//     standing cylinder; a tree's only up to where its crown begins (CAST.trunk, the giants' far higher), above which the
//     camera goes through the leaves
//   the pieces you built, by their solid boxes (and a gable's whole triangle, veil) and their surfaces (floors, stairs,
//     roof panels: pieces.js solids, veil, tops; an open door not), so a roof keeps the camera under it
//   the sites' roofs (from where the rooms' ceilings are to about the ridge) and floors and steps (a metre's depth under
//     them), and the rock of a cave you're in (structures.js rayBlock)
//   the ground (groundAt, with the buildings' cuts and banks), the sphere's middle kept o.over metres over it
// A shape the start is already inside is let be: the camera isn't held at the hero by a wall he leans on.
// o: { r, over, ground, flora } to change the sphere's radius or the ground's margin (the seated free camera comes down over
// the grass), or leave out the ground (ground: false) or the trees and rocks (flora: false): the point the free camera looks
// at, kept over the ground where it is, goes where you take it among the trees, only walls and roofs stopping it as before.
export const CAST = { r: 0.25, over: 0.35, trunk: 4.5, titan: 26, roofUp: 2.5, floorDown: 1, step: 0.35 };
const TRUNK = SPECIES.map((s) => (s.name === 'titan' ? CAST.titan : CAST.trunk));
let T0 = 0, T1 = 1;
// (narrow [T0, T1] to the part of the sweep where lo ≤ a + b·t ≤ hi; false once nothing is left)
const within = (a, b, lo, hi) => { if (Math.abs(b) < 1e-9) return a >= lo && a <= hi; let s = (lo - a) / b, e = (hi - a) / b; if (s > e) { const q = s; s = e; e = q; } if (s > T0) T0 = s; if (e < T1) T1 = e; return T0 <= T1; };
// (...and to where (ox, oz) + (dx, dz)·t lies within rr of (cx, cz))
const inCircle = (ox, oz, dx, dz, cx, cz, rr) => { const px = ox - cx, pz = oz - cz, A = dx * dx + dz * dz, B = 2 * (px * dx + pz * dz), C = px * px + pz * pz - rr * rr;
  if (A < 1e-12) return C <= 0; const D = B * B - 4 * A * C; if (D < 0) return false; const q = Math.sqrt(D); return within(0, 1, (-B - q) / (2 * A), (-B + q) / (2 * A)); };
// (a hit only if the sweep enters the shape after its start: entering at 0 means the start was inside)
const entered = (best) => T0 > 1e-6 && T0 < best;
const _ca = new THREE.Vector3();
export function castCamera(g, a, b, o = {}) {
  const R = o.r ?? CAST.r, dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z, len = Math.hypot(dx, dy, dz); if (len < 1e-4) return len;
  let best = 1;   // (the share of the way that's free)
  const mx = a.x + dx / 2, mz = a.z + dz / 2, half = Math.hypot(dx, dz) / 2;
  // the collider grid's cylinders
  for (const c of g.colliders.near(mx, mz, half + R + 1)) {
    if (o.flora === false && c.ref?.sp !== undefined) continue;
    const y0 = c.y ?? -1e9, y1 = c.h !== undefined ? y0 + c.h : c.ref?.sp !== undefined ? y0 + TRUNK[c.ref.sp] * (c.ref.s || 1) : 1e9;
    T0 = 0; T1 = best; if (inCircle(a.x, a.z, dx, dz, c.x, c.z, c.r + R) && within(a.y, dy, y0 - R, y1 + R) && entered(best)) best = T0;
  }
  // the pieces you built: each one's boxes and surfaces in its own frame (turned with it)
  for (const p of g.build.near(mx, mz, half + R + 2)) {
    const d = p.def; if (d.door && p.state?.open) continue;
    const cs = Math.cos(-p.rot), sn = Math.sin(-p.rot), lx = a.x - p.pos.x, lz = a.z - p.pos.z, ox = lx * cs + lz * sn, oz = -lx * sn + lz * cs, oy = a.y - p.pos.y, ux = dx * cs + dz * sn, uz = -dx * sn + dz * cs;
    for (const list of [d.solids, d.veil]) for (const q of list || []) { T0 = 0; T1 = best; if (within(ox, ux, q[0] - q[3] / 2 - R, q[0] + q[3] / 2 + R) && within(oz, uz, q[2] - q[5] / 2 - R, q[2] + q[5] / 2 + R) && within(oy, dy, q[1] - q[4] / 2 - R, q[1] + q[4] / 2 + R) && entered(best)) best = T0; }   // (veil: a gable's whole triangle, pieces.js)
    for (const q of d.tops || []) {
      // (a surface as a board: 0.25 m deep under it and a little over, the sphere's radius more each way, sloping with a
      // stair or a roof panel: k its rise along z)
      const ya = q.y ?? q.y0, k = q.y !== undefined || q.z1 === q.z0 ? 0 : (q.y1 - q.y0) / (q.z1 - q.z0), rv = R * Math.sqrt(1 + k * k);
      T0 = 0; T1 = best; if (within(ox, ux, Math.min(q.x0, q.x1) - R, Math.max(q.x0, q.x1) + R) && within(oz, uz, Math.min(q.z0, q.z1) - R, Math.max(q.z0, q.z1) + R) && within(oy - ya - k * (oz - q.z0), dy - k * uz, -0.25 - rv, 0.05 + rv) && entered(best)) best = T0;
    }
  }
  // the sites' roofs and floors, in each site's own frame
  const S = g.structures;
  if (S) for (const [list, lo, hi] of [[S.roofs, -R, CAST.roofUp + R], [S.tops, -CAST.floorDown - R, 0.05 + R]]) for (const t of list) {
    if (Math.abs(mx - t.ctx.s.x) > 80 || Math.abs(mz - t.ctx.s.z) > 80) continue;
    const [ox, oz] = S.local(t, a.x, a.z), [ex, ez] = S.local(t, b.x, b.z), y = t.ctx.s.y + t.y;
    T0 = 0; T1 = best; if (within(ox, ex - ox, t.x0 - R, t.x1 + R) && within(oz, ez - oz, t.z0 - R, t.z1 + R) && within(a.y, dy, y + lo, y + hi) && entered(best)) best = T0;
  }
  // a cave's rock (marched in its own field: a ray, the sphere's radius taken off where it meets)
  const rock = S?.rayBlock?.(a, b); if (rock !== null && rock !== undefined) best = Math.min(best, Math.max(0, (rock - R) / len));
  // the ground, sampled along the way (and halved down to where it meets), under the start allowed for: a hero lying low
  const over = Math.min(o.over ?? CAST.over, a.y - groundAt(a.x, a.z) - 0.05), n = o.ground === false ? 0 : Math.ceil((len * best) / CAST.step);
  for (let i = 1, prev = 0; i <= n; i++) {
    const t = (best * i) / n; _ca.set(a.x + dx * t, a.y + dy * t, a.z + dz * t); if (_ca.y >= groundAt(_ca.x, _ca.z) + over) { prev = t; continue; }
    let lo = prev, hi = t; for (let k = 0; k < 5; k++) { const m = (lo + hi) / 2; _ca.set(a.x + dx * m, a.y + dy * m, a.z + dz * m); if (_ca.y >= groundAt(_ca.x, _ca.z) + over) lo = m; else hi = m; }
    best = lo; break;
  }
  return best * len;
}
