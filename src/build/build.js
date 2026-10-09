// Building with the hammer, Valheim-style. Pick a piece from the Build tab (RMB with the hammer out), aim, and a ghost
// shows where it goes: it snaps to the corners and edges of what's already built, R or the mouse wheel turns it, LMB
// places it, MMB (or X) takes a piece down for a full refund. Structures need support: what stands on the ground is
// solid, and support weakens with each piece it passes through (more sideways than upwards). With the hammer out every
// piece is tinted by its support (blue on the ground, then green, yellow, red); pieces left without enough support
// collapse. Pieces have hit points: creatures and storms wear them down, the Repair tool mends them.
import * as THREE from 'three';
import { PIECES, PIECE } from './pieces.js';
import { heightAt } from '../world/gen.js';
import { clearGrass } from '../world/grass.js';
import { setCut } from '../world/groundcut.js';
import { camera } from '../render/core.js';
import { input, hit } from '../input.js';
import { burst, dust, addShake } from '../render/fx.js';
import { ITEMS } from '../game/items.js';
import { icon } from '../ui/icons.js';
import { Inventory } from '../game/inventory.js';
import { askLight } from '../render/lights.js';

const V_LOSS = 0.125, H_LOSS = 0.2, MIN_SUPPORT = 0.1, REACH = 12, G = 8;
const _v = new THREE.Vector3(), _ray = new THREE.Raycaster();
const ghostOk = new THREE.MeshStandardMaterial({ color: 0x7fe08a, transparent: true, opacity: 0.45, depthWrite: false, emissive: 0x2a8a3a, emissiveIntensity: 0.6 });
const ghostBad = new THREE.MeshStandardMaterial({ color: 0xff6a5a, transparent: true, opacity: 0.45, depthWrite: false, emissive: 0x8a2a1a, emissiveIntensity: 0.6 });
const supportColor = (s, grounded) => (grounded ? 0x3a6cff : s > 0.7 ? 0x3fd060 : s > 0.4 ? 0xe8d040 : 0xff4a2a);
const toLocal = (p, wx, wz) => { const dx = wx - p.pos.x, dz = wz - p.pos.z, c = Math.cos(-p.rot), s = Math.sin(-p.rot); return [dx * c + dz * s, -dx * s + dz * c]; };   // inverse of a yaw rotation
const toWorld = (pos, rot, l, out = new THREE.Vector3()) => { const c = Math.cos(rot), s = Math.sin(rot); return out.set(pos.x + l[0] * c + l[2] * s, pos.y + l[1], pos.z - l[0] * s + l[2] * c); };

export class Build {
  constructor(g) {
    this.g = g; this.placed = []; this.grid = new Map(); this.seq = 0; this.sel = null; this.rot = 0; this.ghost = null; this.ghostDef = null;
    this.pieces = [{ id: 'repair', name: 'Repair', cat: 'Tools', icon: 'repair', mats: {}, desc: 'Hit a damaged piece with the hammer to mend it.' }, ...PIECES];
    this.meshes = []; this.lights = [];
    this.flameMat = new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    this.flameMat2 = new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false });
    this.tint = false; this.chest = null;
    this.buildChestPanel();
  }
  piece(id) { return id === 'repair' ? this.pieces[0] : PIECE[id]; }
  get active() { return !!this.sel && this.g.equippedTool('build'); }
  select(id) { this.sel = id; if (this.ghost) { this.g.scene.remove(this.ghost); this.ghost = null; } if (id !== 'repair') this.makeGhost(PIECE[id]); this.g.hud.toast(`${this.piece(id).name}: <span class="kbd">LMB</span> place · <span class="kbd">R</span> turn · <span class="kbd">MMB</span> remove · <span class="kbd">RMB</span> menu`); }
  makeGhost(def) {
    const grp = new THREE.Group(); for (const { geo } of def.build()) { const m = new THREE.Mesh(geo, ghostOk); m.renderOrder = 5; grp.add(m); }
    this.ghost = grp; this.ghostDef = def; this.g.scene.add(grp);
  }
  // ---- spatial index of placed pieces (8 m cells)
  index(p, add) { const k = Math.floor(p.pos.x / G) + ',' + Math.floor(p.pos.z / G); if (add) (this.grid.get(k) || this.grid.set(k, []).get(k)).push(p); else { const a = this.grid.get(k); if (a) a.splice(a.indexOf(p), 1); } }
  *near(x, z, r) { const x0 = Math.floor((x - r - 5) / G), x1 = Math.floor((x + r + 5) / G), z0 = Math.floor((z - r - 5) / G), z1 = Math.floor((z + r + 5) / G); for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const a = this.grid.get(i + ',' + j); if (a) yield* a; } }
  // ---- surfaces: the highest top under (x, z) no higher than y + step; used to stand on floors, stairs and roofs
  topY(p, t, lx, lz) {
    if (lx < Math.min(t.x0, t.x1) || lx > Math.max(t.x0, t.x1) || lz < Math.min(t.z0, t.z1) || lz > Math.max(t.z0, t.z1)) return null;
    const y = t.y !== undefined ? t.y : t.y0 + ((lz - t.z0) / (t.z1 - t.z0)) * (t.y1 - t.y0); return p.pos.y + y;
  }
  floorAt(x, z, y, step = 0.6) {
    let best = -Infinity;
    for (const p of this.near(x, z, 6)) { if (!p.def.tops) continue; const [lx, lz] = toLocal(p, x, z); for (const t of p.def.tops) { const ty = this.topY(p, t, lx, lz); if (ty !== null && ty <= y + step && ty > best) best = ty; } }
    return best;
  }
  underRoof(pos, above = 1.0) {
    for (const p of this.near(pos.x, pos.z, 8)) { if (!p.def.roof) continue; const [lx, lz] = toLocal(p, pos.x, pos.z); for (const t of p.def.tops) { const ty = this.topY(p, t, lx, lz); if (ty !== null && ty > pos.y + above) return true; } }
    return false;
  }
  nearStation(type, pos, r) { let best = null, bd = r; for (const p of this.near(pos.x, pos.z, r)) if (p.def.station === type) { const d = p.pos.distanceTo(pos); if (d < bd) { bd = d; best = p; } } return best; }
  nearFire(pos, r = 6) { for (const p of this.near(pos.x, pos.z, r)) if ((p.def.fire || p.def.torch) && p.state.lit && p.pos.distanceTo(pos) < (p.def.fire ? r : 3)) return p; return null; }
  // Distance from a to b to the first building surface in between (null if clear): keeps the camera inside rooms
  rayBlock(a, b) {
    if (!this.placed.length) return null;
    const d = b.clone().sub(a), len = d.length(); _ray.set(a, d.normalize()); _ray.far = len;
    const near = []; for (const p of this.near(a.x, a.z, len + 4)) for (const m of p.inner.children) near.push(m);
    const h = near.length ? _ray.intersectObjects(near, false) : []; return h.length ? h[0].distance : null;
  }
  // ---- placing
  aim() {
    _ray.setFromCamera({ x: 0, y: 0 }, camera); _ray.far = 30;
    const hits = _ray.intersectObjects(this.meshes, false); let best = hits[0] ? { p: hits[0].point.clone(), n: hits[0].face?.normal.clone().transformDirection(hits[0].object.matrixWorld), piece: hits[0].object.userData.piece, d: hits[0].distance } : null;
    // terrain: march the ray
    const o = _ray.ray.origin, dir = _ray.ray.direction; let prev = 0;
    for (let t = 0.5; t < (best ? best.d : 30); t += 0.25) { _v.copy(o).addScaledVector(dir, t); if (_v.y < heightAt(_v.x, _v.z)) { let a = prev, b = t; for (let k = 0; k < 6; k++) { const m = (a + b) / 2; _v.copy(o).addScaledVector(dir, m); if (_v.y < heightAt(_v.x, _v.z)) b = m; else a = m; } _v.copy(o).addScaledVector(dir, b); best = { p: _v.clone(), n: new THREE.Vector3(0, 1, 0), terrain: true, d: b }; _v.y = heightAt(_v.x, _v.z); best.p.y = _v.y; break; } prev = t; }
    return best;
  }
  snapsOf(def, pos, rot) { return def.snaps.map((s) => toWorld(pos, rot, s)); }
  placeGhost() {
    const def = this.ghostDef, a = this.aim(); if (!a) { this.ghost.visible = false; return null; }
    this.ghost.visible = true;
    let pos = a.p.clone();
    // Only structural pieces are snap anchors: never the workbench, campfire, bed, chest or other furniture. Equipment
    // itself doesn't snap at all; it goes where you aim.
    const structural = (p) => !p.def.equip, snapping = !def.equip;
    // near a structure, turn with its grid: the ghost takes the nearest quarter-turn to your chosen angle, relative to
    // the piece you're aiming at (or the nearest piece)
    let rot = this.rot, anchor = snapping && a.piece && structural(a.piece) ? a.piece : null;
    if (snapping && !anchor) { let bd2 = 4; for (const p of this.near(pos.x, pos.z, 4)) { if (!structural(p)) continue; const d = p.pos.distanceTo(pos); if (d < bd2) { bd2 = d; anchor = p; } } }
    if (anchor) rot = anchor.rot + Math.round((this.rot - anchor.rot) / (Math.PI / 2)) * (Math.PI / 2);
    this.aligned = !!anchor;
    // snap: try putting each of the ghost's points on each point of what's built nearby, score each placement (the most
    // points lined up first, then nearest where you aim), and take the best one that's actually allowed
    const local = snapping ? def.snaps : [], targets = [];
    if (snapping) for (const p of this.near(pos.x, pos.z, 9)) if (structural(p)) for (const s of p.snaps) if (s.distanceTo(pos) < 5) targets.push(s);
    const cands = [];
    // (against a structure a quarter turn is tried too, but it only wins if it lines up clearly more points)
    for (const [r2, pen] of anchor ? [[rot, 0], [rot + Math.PI / 2, 2.5], [rot - Math.PI / 2, 2.5]] : [[rot, 0]]) {
      const c = Math.cos(r2), sn = Math.sin(r2);
      for (const s of targets) for (const l of local) {
        const cand = new THREE.Vector3(s.x - (l[0] * c + l[2] * sn), s.y - l[1], s.z - (-l[0] * sn + l[2] * c)), d = cand.distanceTo(pos); if (d > 1.7) continue;
        let match = 0; for (const m of local) { const wx = cand.x + m[0] * c + m[2] * sn, wy = cand.y + m[1], wz = cand.z - m[0] * sn + m[2] * c; if (targets.some((t) => Math.abs(t.x - wx) + Math.abs(t.y - wy) + Math.abs(t.z - wz) < 0.2)) match++; }
        if (cands.some((q) => q.pos.distanceTo(cand) < 0.02 && Math.abs(q.rot - r2) < 0.01)) continue;
        cands.push({ pos: cand, rot: r2, score: d - 1.6 * (match - 1) + pen });
      }
    }
    cands.sort((x, y) => x.score - y.score);
    // keep the snap we had while it's still among the good ones, so the ghost doesn't flicker between near-equal spots
    const last = this.lastSnap, keep = last && cands.find((q) => q.pos.distanceTo(last.pos) < 0.02 && Math.abs(q.rot - last.rot) < 0.01 && q.score <= (cands[0]?.score ?? 0) + 0.6);
    let best = null;
    if (keep && !this.blocked(def, keep.pos, keep.rot)) best = keep;
    else for (const q of cands.slice(0, 8)) if (!this.blocked(def, q.pos, q.rot)) { best = q; break; }
    if (!best && cands.length) best = cands[0];   // nothing free: show the best one (it will be red)
    this.lastSnap = best;
    if (best) { pos = best.pos.clone(); rot = best.rot; }
    // a floor laid on the ground sits on its highest corner, so the ground doesn't poke up through it
    else if (a.terrain && def.cat === 'Floors' && def.tops) { const t = def.tops[0]; let top = -1e9; for (const [lx, lz] of [[t.x0, t.z0], [t.x1, t.z0], [t.x0, t.z1], [t.x1, t.z1], [0, 0]]) { const w = toWorld(pos, rot, [lx, 0, lz]); top = Math.max(top, heightAt(w.x, w.z)); } pos.y = top + 0.03; }
    this.ghost.position.copy(pos); this.ghost.rotation.y = rot;
    const why = this.invalid(def, pos, rot, !!best, a);
    for (const m of this.ghost.children) m.material = why ? ghostBad : ghostOk;
    return { pos, rot, why, snapped: !!best };
  }
  // Why this placement isn't allowed (null if it is)
  invalid(def, pos, rot, snapped, a) {
    const P = this.g.player;
    if (pos.distanceTo(P.pos) > REACH) return 'Too far away';
    if (!this.g.inv.has(def.mats) && !this.g.S.freeBuild) return 'Missing materials';
    if (def.equip && !snapped && !(a.terrain || (a.piece && a.piece.def.tops))) return 'Place it on the ground or a floor';
    if (def.equip && a.terrain && Math.abs(heightAt(pos.x, pos.z) - pos.y) > 0.4) return 'Too steep here';
    const sup = this.supportFor(def, pos, rot); if (sup.s < MIN_SUPPORT) return 'Nothing holds it up';
    if (this.overlaps(def, pos, rot)) return 'Something is in the way';
    if (this.duplicate(def, pos, rot)) return 'Already built here';
    if (pos.y < -0.8) return 'Too deep in the water';
    return null;
  }
  grounded(def, pos, rot) { for (const s of def.snaps) { const w = toWorld(pos, rot, s, _v); if (w.y - heightAt(w.x, w.z) < 0.35) return true; } return false; }
  // neighbours: pieces sharing a snap point, or touching
  neighbours(def, pos, rot, self) {
    const mine = this.snapsOf(def, pos, rot), out = [];
    for (const p of this.near(pos.x, pos.z, 8)) {
      if (p === self) continue;
      if (p.snaps.some((s) => mine.some((m) => m.distanceTo(s) < 0.2))) { out.push(p); continue; }
      if (this.touch(def, pos, rot, p)) out.push(p);
    }
    return out;
  }
  boxes(def, pos, rot) {   // world AABBs of the solids and tops (rough, for touching and overlap tests)
    const out = [];
    for (const b of def.solids || []) { const c = toWorld(pos, rot, [b[0], b[1], b[2]]), ex = Math.abs(Math.cos(rot)) * b[3] / 2 + Math.abs(Math.sin(rot)) * b[5] / 2, ez = Math.abs(Math.sin(rot)) * b[3] / 2 + Math.abs(Math.cos(rot)) * b[5] / 2; out.push(new THREE.Box3(new THREE.Vector3(c.x - ex, c.y - b[4] / 2, c.z - ez), new THREE.Vector3(c.x + ex, c.y + b[4] / 2, c.z + ez))); }
    for (const t of def.tops || []) { const pts = [[t.x0, t.y ?? t.y0, t.z0], [t.x1, t.y ?? t.y1, t.z1], [t.x0, t.y ?? t.y1, t.z1], [t.x1, t.y ?? t.y0, t.z0]].map((l) => toWorld(pos, rot, l)); const bb = new THREE.Box3().setFromPoints(pts); bb.min.y -= 0.2; out.push(bb); }
    return out;
  }
  touch(def, pos, rot, p) { const A = this.boxes(def, pos, rot), B = p.boxes; for (const a of A) for (const b of B) if (a.clone().expandByScalar(0.06).intersectsBox(b)) return true; return false; }
  // Would this sit on (or half over) a piece of the same kind? Floors, roofs and beams have no body, so overlaps between
  // them are caught here: the same spot, or their surfaces overlapping by more than a sliver
  duplicate(def, pos, rot) {
    const inset = (b) => { b.min.x += 0.2; b.max.x -= 0.2; b.min.z += 0.2; b.max.z -= 0.2; b.min.y -= 0.05; b.max.y += 0.05; return b; };   // shrink sideways only: a floor's surface is thin
    const mine = this.snapsOf(def, pos, rot), A = this.boxes({ tops: def.tops }, pos, rot).map(inset);
    for (const p of this.near(pos.x, pos.z, 6)) {
      if (p.id !== def.id) continue;
      if (mine.every((m) => p.snaps.some((q) => q.distanceTo(m) < 0.15))) return true;
      for (const b of this.boxes({ tops: p.def.tops }, p.pos, p.rot)) { const bb = inset(b); for (const a of A) if (!a.isEmpty() && !bb.isEmpty() && a.intersectsBox(bb)) return true; }
    }
    return false;
  }
  blocked(def, pos, rot) { return this.overlaps(def, pos, rot) || this.duplicate(def, pos, rot); }
  // Only real bodies collide (walls, posts, furniture): the space under a sloped roof or over a floor doesn't count, so
  // gable ends, awnings and roofs can go in in any order
  solidBoxes(def, pos, rot) { return this.boxes({ solids: def.solids }, pos, rot); }
  overlaps(def, pos, rot) {
    if (def.door) return false;
    const A = this.solidBoxes(def, pos, rot).map((b) => b.clone().expandByScalar(-0.15));
    for (const p of this.near(pos.x, pos.z, 8)) { if (p.def.door) continue; for (const b of this.solidBoxes(p.def, p.pos, p.rot)) { const bb = b.clone().expandByScalar(-0.15); for (const a of A) if (!a.isEmpty() && !bb.isEmpty() && a.intersectsBox(bb)) return true; } }
    return false;
  }
  supportFor(def, pos, rot, self) {
    if (this.grounded(def, pos, rot)) return { s: 1, grounded: true };
    let s = 0;
    for (const p of this.neighbours(def, pos, rot, self)) { const up = pos.y - p.pos.y > 0.3 ? V_LOSS : H_LOSS; s = Math.max(s, p.support * (1 - up)); }
    return { s, grounded: false };
  }
  // Where two pieces share a surface (wall tops at a corner, a panel's overhang on the one below) the depth buffer can't
  // tell them apart and they flicker. Each piece gets a small, fixed depth priority instead, so one always wins: roofs over
  // gable ends over walls over beams over floors over furniture, and pieces of one kind at right angles (walls meeting at
  // a corner) alternate.
  depthRank(def, rot) {
    const rank = { Floors: 1, Beams: 2, Fences: 2, Walls: 3 }[def.cat] ?? (def.cat === 'Roofs' ? (def.roof ? 5 : 4) : 0);
    const alt = ((Math.round(rot / (Math.PI / 2)) % 2) + 2) % 2, k = rank * 2 + alt;
    return { polygonOffset: k > 0, polygonOffsetFactor: -0.12 * k, polygonOffsetUnits: -k };
  }
  place(id, pos, rot, opts = {}) {
    const def = PIECE[id], obj = new THREE.Group(); obj.position.copy(pos); obj.rotation.y = rot;
    const inner = new THREE.Group(); obj.add(inner);
    const p = { uid: opts.uid ?? 'pc' + this.seq++, id, def, obj, inner, pos: pos.clone(), rot, hp: opts.hp ?? def.hp, state: opts.state || {}, support: 1, grounded: false, mats: [] };
    const depth = this.depthRank(def, rot);
    for (const { geo, mat } of def.build()) { const m2 = mat.clone(); Object.assign(m2, depth); p.mats.push(m2); const m = new THREE.Mesh(geo, m2); m.castShadow = m.receiveShadow = true; m.userData.piece = p; inner.add(m); this.meshes.push(m); }
    this.g.scene.add(obj);
    p.snaps = this.snapsOf(def, pos, rot); p.boxes = this.boxes(def, pos, rot);
    this.index(p, true); this.placed.push(p);
    this.addColliders(p);
    // a floor near the ground presses it down under its boards (flat floors only: stairs keep the slope)
    const ft = def.cat === 'Floors' && def.tops?.length === 1 && def.tops[0].y !== undefined ? def.tops[0] : null;
    if (ft) { const c = toWorld(pos, rot, [(ft.x0 + ft.x1) / 2, 0, (ft.z0 + ft.z1) / 2]); setCut(p.uid, { x: c.x, z: c.z, hw: Math.abs(ft.x1 - ft.x0) / 2, hd: Math.abs(ft.z1 - ft.z0) / 2, rot, y: pos.y + ft.y - 0.3 }); }
    // grass doesn't grow through floors and furniture
    const bb = p.boxes.reduce((a, b) => a.union(b), new THREE.Box3()); if (bb.min.y < heightAt(pos.x, pos.z) + 1.2) clearGrass(p.uid, { x: pos.x, z: pos.z, hw: (def.tops?.[0] ? Math.abs(def.tops[0].x1 - def.tops[0].x0) / 2 : (def.solids?.[0]?.[3] ?? 1) / 2) + 0.35, hd: (def.tops?.[0] ? Math.abs(def.tops[0].z1 - def.tops[0].z0) / 2 : (def.solids?.[0]?.[5] ?? 1) / 2) + 0.35, rot });
    if (def.fire || def.torch) { p.state.fuel ??= def.fire ? 3 : 4; p.state.lit ??= true; this.addFlame(p); }
    if (def.chest) { p.inv = new Inventory(); p.inv.slots = new Array(def.chest[0] * def.chest[1]).fill(null); if (opts.state?.slots) p.inv.slots = opts.state.slots; }
    if (def.cook) p.state.cook ??= [];
    if (def.door && p.state.open) this.setDoor(p, true, true);
    this.recompute();
    return p;
  }
  addColliders(p) {
    const list = [];
    for (const b of p.def.solids || []) {
      const [cx, cy, cz, w, h, d] = b, alongX = w >= d, len = alongX ? w : d, r = Math.min(w, d) / 2 + 0.04, n = Math.max(1, Math.ceil(len / (r * 1.5)));
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (len - 2 * r); const l = alongX ? [cx + t, cy, cz] : [cx, cy, cz + t]; const wpos = toWorld(p.pos, p.rot, l); list.push({ x: wpos.x, z: wpos.z, r, y: wpos.y - h / 2, h, ref: { piece: p } }); }
    }
    this.g.colliders.addGroup(p.uid, list);
  }
  remove(p, refund) {
    this.g.scene.remove(p.obj); this.meshes = this.meshes.filter((m) => m.userData.piece !== p); this.index(p, false); this.placed.splice(this.placed.indexOf(p), 1);
    this.g.colliders.removeGroup(p.uid); clearGrass(p.uid, null); setCut(p.uid, null);
    if (refund) for (const [id, n] of Object.entries(p.def.mats)) this.g.give(id, n);
    if (p.inv) for (const s of p.inv.slots) if (s) this.g.pickups.drop(s.id, s.n, p.pos.x + Math.random() - 0.5, p.pos.z + Math.random() - 0.5, s.dur ? { dur: s.dur } : undefined, p.pos.y);
    if (p.flame) p.flame = null;
    if (this.chest === p) this.closeChest();
  }
  // Recompute support everywhere (pieces form one graph); anything too weak falls
  recompute() {
    for (const p of this.placed) { const gr = this.grounded(p.def, p.pos, p.rot); p.grounded = gr; p.support = gr ? 1 : 0; p.nb = this.neighbours(p.def, p.pos, p.rot, p); }
    for (let it = 0, changed = true; changed && it < 60; it++) {
      changed = false;
      for (const p of this.placed) { if (p.grounded) continue; let s = 0; for (const q of p.nb) { const up = p.pos.y - q.pos.y > 0.3 ? V_LOSS : H_LOSS; s = Math.max(s, q.support * (1 - up)); } if (Math.abs(s - p.support) > 1e-4) { p.support = s; changed = true; } }
    }
    const falling = this.placed.filter((p) => p.support < MIN_SUPPORT);
    if (falling.length) { for (const p of falling) this.breakPiece(p, false); this.recompute(); return; }
    this.updateTint();
  }
  breakPiece(p, recompute = true) {
    const c = p.boxes[0] ? p.boxes[0].getCenter(new THREE.Vector3()) : p.pos;
    dust(c, 16, 0xa08060, 0.5); burst(c, { color: 0x8a6440, n: 14, speed: 3.5, size: 0.1 }); this.g.sound?.('break');
    this.remove(p, false); if (recompute) this.recompute();
  }
  damage(p, n) { p.hp -= n; burst(p.pos.clone().setY(p.pos.y + 1), { color: 0x8a6440, n: 5, speed: 2.5 }); if (p.hp <= 0) this.breakPiece(p); }
  updateTint() {
    const on = this.g.equippedTool('build');
    for (const p of this.placed) for (const m of p.mats) { m.emissive.setHex(on ? supportColor(p.support, p.grounded) : 0); m.emissiveIntensity = on ? 0.2 : 0; }
    this.tint = on;
  }
  // ---- doors, fires, beds, chests, stations
  setDoor(p, open, instant) { p.state.open = open; p.targetA = open ? -Math.PI / 2 * 0.95 : 0; if (instant) p.inner.rotation.y = p.targetA; if (open) this.g.colliders.removeGroup(p.uid); else this.addColliders(p); }
  addFlame(p) {
    const g = new THREE.Group(), big = p.def.fire;
    const f1 = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.32 : 0.09, big ? 0.9 : 0.28, 8, 1, true).translate(0, big ? 0.45 : 0.14, 0), this.flameMat);
    const f2 = new THREE.Mesh(new THREE.ConeGeometry(big ? 0.18 : 0.05, big ? 0.6 : 0.18, 8, 1, true).translate(0, big ? 0.3 : 0.09, 0), this.flameMat2);
    g.add(f1, f2); g.position.y = big ? 0.1 : 1.62; p.obj.add(g); p.flame = g; g.visible = !!p.state.lit;
  }
  interactable(pos, fwd) {
    let best = null, bd = 2.6;
    for (const p of this.near(pos.x, pos.z, 4)) {
      const d = p.def; if (!(d.door || d.fire || d.torch || d.bed || d.chest || d.station || d.cook)) continue;
      const c = p.boxes[0] ? p.boxes[0].getCenter(new THREE.Vector3()) : p.pos, dist = Math.hypot(c.x - pos.x, c.z - pos.z) - 0.4;
      if ((c.x - pos.x) * fwd.x + (c.z - pos.z) * fwd.z < -0.3) continue;
      if (dist < bd) { bd = dist; best = p; }
    }
    if (!best) return null;
    // a cooking stand over a fire: E goes to the stand when there's meat to put on or food to take off
    if (best.def.fire) { const st = [...this.near(best.pos.x, best.pos.z, 2)].find((q) => q.def.cook && q.pos.distanceTo(best.pos) < 1.5); if (st && (st.state.cook.length || this.g.inv.count('rawMeat') || this.g.inv.count('rawFish'))) best = st; }
    const p = best, d = p.def, inv = this.g.inv;
    if (d.door) return { label: p.state.open ? 'Close' : 'Open', sub: d.name, use: () => { this.setDoor(p, !p.state.open); this.g.sound?.('door'); } };
    if (d.fire) return { label: p.state.lit ? `Add wood (${Math.ceil(p.state.fuel)}/10)` : inv.count('wood') ? 'Light the fire' : 'Needs wood to light', sub: 'Campfire', alt: this.douseAction(p), use: () => {
      if (!inv.count('wood')) { this.g.hud.toast('You have no wood'); return; } if (p.state.fuel >= 10 && p.state.lit) { this.g.hud.toast('The fire is full'); return; }
      inv.take('wood', 1); p.state.fuel = Math.min(10, (p.state.lit || p.state.doused ? p.state.fuel : 0) + 1);   /* a fire you put out keeps its wood */ p.state.lit = true; p.state.doused = false; p.state.rainT = 0; p.flame.visible = true; burst(p.pos.clone().setY(p.pos.y + 0.4), { color: 0xffa040, n: 10, speed: 1.5, grav: -2 }); } };
    if (d.torch) return { label: p.state.lit ? 'Burning' : inv.count('resin') ? 'Light it (resin)' : 'Needs resin', sub: d.name, use: () => { if (!p.state.lit && inv.take('resin', 1)) { p.state.lit = true; p.state.fuel = 4; p.flame.visible = true; } } };
    if (d.bed) return { label: 'Sleep', sub: 'Bed', use: () => this.sleep(p) };
    if (d.chest) return { label: 'Open', sub: 'Chest', use: () => this.openChest(p) };
    if (d.station) return { label: 'Craft', sub: d.name, use: () => { this.g.hud.toggle(true); this.g.crafting.open('craft'); } };
    if (d.cook) {
      // every piece cooks on its own timer; one press puts on all the raw meat that fits, or takes off all that's done
      const ready = p.state.cook.filter((c) => c.t >= c.need), free = d.cook - p.state.cook.length, raw = inv.count('rawMeat') + inv.count('rawFish');
      const fire = [...this.near(p.pos.x, p.pos.z, 2)].find((q) => q.def.fire && q.state.lit && q.pos.distanceTo(p.pos) < 1.5), alt = fire ? this.douseAction(fire) : null;
      if (ready.length) return { alt, label: `Take ${ready.length > 1 ? `${ready.length} cooked` : ITEMS[ITEMS[ready[0].id].cook.to].name.toLowerCase()}`, sub: 'Cooking Stand', use: () => {
        for (const c of ready) { p.state.cook.splice(p.state.cook.indexOf(c), 1); this.g.give(ITEMS[c.id].cook.to, 1); } this.drawCook(p); } };
      if (raw && free > 0) return { alt, label: `Cook ${Math.min(raw, free) > 1 ? `${Math.min(raw, free)} pieces of meat` : (inv.count('rawMeat') ? 'raw meat' : 'raw fish')}`, sub: `Cooking Stand · ${p.state.cook.length}/${d.cook}`, use: () => {
        for (const id of ['rawMeat', 'rawFish']) while (p.state.cook.length < d.cook && inv.take(id, 1)) p.state.cook.push({ id, t: 0, need: ITEMS[id].cook.time });
        this.drawCook(p); } };
      return { alt, label: p.state.cook.length ? `Cooking… ${p.state.cook.length}/${d.cook}` : 'Needs raw meat', sub: 'Cooking Stand', use: () => {} };
    }
    return null;
  }
  // F at a lit campfire puts it out (its remaining wood stays for when you light it again)
  douseAction(p) {
    if (!p.state.lit) return null;
    return { key: 'F', label: 'Put out fire', use: () => { p.state.lit = false; p.state.doused = true; p.state.rainT = 0; p.flame.visible = false; dust(p.pos.clone().setY(p.pos.y + 0.5), 14, 0x8a8a8a, 0.45); this.g.sound?.('douse'); } };
  }
  drawCook(p) {
    if (!p.meat) { p.meat = new THREE.Group(); p.obj.add(p.meat); } p.meat.clear();
    p.state.cook.forEach((c, i) => { const done = c.t >= c.need, m = new THREE.Mesh(new THREE.DodecahedronGeometry(0.11, 0).scale(1, 0.8, 1.3), new THREE.MeshStandardMaterial({ color: done ? 0x7a4a24 : 0xb8443a, roughness: 0.7 })); m.position.set(-0.4 + i * 0.4, 0.92, 0); p.meat.add(m); });
  }
  sleep(p) {
    const g = this.g, S = g.S; S.bed = { x: p.pos.x + Math.sin(p.rot) * 1.4, z: p.pos.z + Math.cos(p.rot) * 1.4 };
    if (!this.underRoof(p.pos.clone().setY(p.pos.y + 0.3))) { g.hud.toast('Your spawn point is set. You need a roof over the bed to sleep.'); return; }
    if (S.time < 0.68) { g.hud.toast('Your spawn point is set. You can only sleep once evening comes.'); return; }
    g.hud.sleep?.(() => { S.time = 0.01; S.day++; g.player.stats.add('rested'); g.player.stats.heal(99); g.hud.toast(`You wake <b>rested</b>. Day ${S.day}.`); });
  }
  // ---- chest window: click an item to move it between the chest and your pack
  buildChestPanel() {
    const p = document.createElement('div'); p.className = 'pnl hidden'; p.id = 'chestPanel';
    p.innerHTML = '<h2>Chest</h2><div class="pbody"><div class="grid" id="chestGrid"></div><div class="chestFoot"><button class="btn small" id="chestSort">Sort Items</button><p class="hint">Click to move between the chest and your pack</p></div></div>';
    document.getElementById('invPanel').prepend(p); this.chestEl = p;
    p.addEventListener('click', (e) => { if (e.target.closest('#chestSort') && this.chest) { this.chest.inv.sort(); this.drawChest(); return; } const s = e.target.closest('.slot'); if (!s || !this.chest) return; const i = +s.dataset.i, it = this.chest.inv.slots[i]; if (!it) return; const left = this.g.inv.add(it.id, it.n, it.dur ? { dur: it.dur } : {}); if (left) it.n = left; else this.chest.inv.slots[i] = null; this.drawChest(); });
    this.g.hud.onSlotClick = (i) => { if (!this.chest) return false; const it = this.g.inv.slots[i]; if (!it || it.worn) return true; const left = this.chest.inv.add(it.id, it.n, it.dur ? { dur: it.dur } : {}); if (left) it.n = left; else this.g.inv.slots[i] = null; this.g.inv.onChange?.(); this.drawChest(); return true; };
  }
  openChest(p) { this.chest = p; this.chestEl.classList.remove('hidden'); document.getElementById('craftPanel').classList.add('hidden'); this.g.hud.toggle(true); this.drawChest(); this.g.sound?.('chest'); }
  closeChest() { this.chest = null; this.chestEl.classList.add('hidden'); document.getElementById('craftPanel').classList.remove('hidden'); }
  drawChest() { if (!this.chest) return; const [c] = this.chest.def.chest; const el = document.getElementById('chestGrid'); el.style.gridTemplateColumns = `repeat(${c}, 56px)`; el.innerHTML = this.chest.inv.slots.map((s, i) => (s ? `<div class="slot" data-i="${i}" title="${ITEMS[s.id].name}">${icon(ITEMS[s.id].icon)}${s.n > 1 ? `<em>${s.n}</em>` : ''}</div>` : `<div class="slot empty" data-i="${i}"></div>`)).join(''); }
  // ---- per frame
  update(dt) {
    const g = this.g, hammer = g.equippedTool('build');
    if (hammer !== this.tint) this.updateTint();
    if (!hammer && this.ghost) { this.ghost.visible = false; }
    if (hammer && !input.uiOpen && !g.player.dead) {
      if (input.clicks.includes(2)) { g.buildMenu.toggle(true); input.clicks.length = 0; return; }
      if (this.sel) {
        const step = this.aligned ? Math.PI / 2 : Math.PI / 8;   // quarter turns against a structure, finer on open ground
        if (hit('KeyR')) this.rot += step;
        if (input.wheel) { this.rot += input.wheel * step; input.wheel = 0; }
        if (hit('Escape')) { this.sel = null; if (this.ghost) this.g.scene.remove(this.ghost); this.ghost = null; }
      }
      const target = this.aim(), tp = target?.piece;
      // remove with MMB / X
      if (tp && (input.clicks.includes(1) || hit('KeyX'))) { this.remove(tp, true); this.recompute(); g.sound?.('break'); }
      if (this.sel === 'repair') {
        g.hud.prompt(tp ? 'LMB' : null, tp ? `Repair ${tp.def.name}` : '', tp ? `${Math.ceil(tp.hp)} / ${tp.def.hp}` : '');
        if (tp && input.clicks.includes(0)) { if (tp.hp < tp.def.hp) { tp.hp = tp.def.hp; burst(target.p, { color: 0xffe0a0, n: 8, speed: 1.5, grav: -1 }); g.sound?.('repair'); } else g.hud.toast('Not damaged'); }
      } else if (this.sel && this.ghost) {
        const r = this.placeGhost();
        if (r) g.hud.prompt('LMB', r.why || `Place ${this.ghostDef.name}`, r.why ? '' : Object.entries(this.ghostDef.mats).map(([m, n]) => `${n} ${ITEMS[m].name.toLowerCase()}`).join(', '));
        if (r && !r.why && input.clicks.includes(0)) {
          if (!g.S.freeBuild) g.inv.takeMats(this.ghostDef.mats);
          const p = this.place(this.ghostDef.id, r.pos, r.rot); dust(p.pos.clone().setY(p.pos.y + 0.2), 8, 0xb8a684, 0.3); addShake(0.08); g.sound?.('build');
          if (!g.inv.has(this.ghostDef.mats) && !g.S.freeBuild) g.hud.toast(`Out of materials for ${this.ghostDef.name.toLowerCase()}`);
        }
      } else if (tp) g.hud.prompt('MMB', `Remove ${tp.def.name}`, `${Math.ceil(tp.hp)} / ${tp.def.hp}`);
    }
    // doors swing, fires burn (and go out in the rain if nothing covers them), food cooks
    const lights = [], heated = new Set();   // cooking stands over a lit fire this frame (each cooks once, however many fires)
    for (const p of this.placed) {
      if (p.def.door && p.targetA !== undefined) p.inner.rotation.y += (p.targetA - p.inner.rotation.y) * Math.min(1, dt * 8);
      if ((p.def.fire || p.def.torch) && p.state.lit) {
        p.state.fuel -= dt / (p.def.fire ? 240 : 600);
        const wet = g.weatherRain?.() > 0.3 && !this.underRoof(p.pos.clone().setY(p.pos.y + 0.5), 0.8);
        p.state.rainT = wet ? (p.state.rainT || 0) + dt : 0;
        if (p.state.fuel <= 0 || p.state.rainT > 8 + (p.uid.length % 5)) { p.state.lit = false; p.flame.visible = false; dust(p.pos.clone().setY(p.pos.y + 0.5), 10, 0x777777, 0.4); if (p.state.rainT > 8) g.nearMsg?.(p.pos, 'The rain put the fire out'); }
        const t = performance.now() * 0.001, k = 1 + Math.sin(t * 13 + p.pos.x) * 0.08 + Math.sin(t * 7.3) * 0.06;
        if (p.flame) { p.flame.scale.set(1, k * (0.6 + Math.min(1, p.state.fuel / 3) * 0.4), 1); p.flame.rotation.y = t * 0.7; }
        if (p.def.fire && Math.random() < dt * 3) dust(p.pos.clone().setY(p.pos.y + 0.9), 1, 0x8a8a8a, 0.25);
        lights.push(p);
        // standing in the fire burns
        if (p.def.fire && g.player.pos.distanceTo(p.pos) < 0.7) g.player.stats.damage(3 * dt);
        // cooking over it
        for (const q of this.near(p.pos.x, p.pos.z, 1.5)) if (q.def.cook && q.state.cook.length) heated.add(q);
      }
    }
    for (const q of heated) { let ch = false; for (const c of q.state.cook) { const was = c.t >= c.need; c.t += dt; if (!was && c.t >= c.need) ch = true; } if (ch) this.drawCook(q); }
    // light from the shared pool (the nearest fires get it)
    for (const p of lights) { const fl = 1 + Math.sin(performance.now() * 0.013 + p.pos.x) * 0.1 + Math.random() * 0.06; askLight(p.lightPos ||= p.pos.clone().setY(p.pos.y + (p.def.fire ? 1 : 1.8)), (p.def.fire ? 26 : 9) * fl * Math.min(1, 0.4 + p.state.fuel / 3), p.def.fire ? 22 : 12); }
    if (this.chest && !input.uiOpen) this.closeChest();
  }
  toJSON() { return this.placed.map((p) => ({ uid: p.uid, id: p.id, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot, hp: p.hp, state: { ...p.state, slots: p.inv?.slots } })); }
  load(list) { for (const o of list) this.place(o.id, new THREE.Vector3(o.x, o.y, o.z), o.rot, { uid: o.uid, hp: o.hp, state: o.state }); this.seq = this.placed.length + 1; }
}
