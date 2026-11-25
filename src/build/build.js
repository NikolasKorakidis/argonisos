// Building with the hammer, Valheim-style. Pick a piece from the Build tab (RMB with the hammer out), aim, and a ghost
// shows where it goes: it snaps to the corners and edges of what's already built, R or the mouse wheel turns it, LMB
// places it, MMB (or X) takes a piece down for a full refund. Structures need support: what stands on the ground is
// solid, and support weakens with each piece it passes through (more sideways than upwards). With the hammer out every
// piece is tinted by its support (blue on the ground, then green, yellow, red); pieces left without enough support
// collapse. Pieces have hit points: creatures and storms wear them down, the Repair tool mends them.
import * as THREE from 'three';
import { PIECES, PIECE } from './pieces.js';
import { loadKit } from './kit.js';
import { heightAt } from '../world/gen.js';
import { clearGrass } from '../world/grass.js';
import { setCut, SHAPE, groundAt } from '../world/groundcut.js';
import { waterAt } from '../world/river.js';
import { camera } from '../render/core.js';
import { input, hit } from '../input.js';
import { burst, dust, addShake } from '../render/fx.js';
import { ITEMS } from '../game/items.js';
import { icon } from '../ui/icons.js';
import { Inventory, COLS } from '../game/inventory.js';
import { askLight } from '../render/lights.js';
import { wetLike } from '../world/wetness.js';
import { pixelate, pixelLike } from '../render/pixel.js';
import { SPECIES, STRIDE, CELL } from '../world/flora.js';
import { clamp } from '../util/math.js';

const V_LOSS = 0.125, H_LOSS = 0.2, MIN_SUPPORT = 0.1, REACH = 12, G = 8;
const _v = new THREE.Vector3(), _ray = new THREE.Raycaster();
const proxyMat = new THREE.MeshBasicMaterial();   // (the invisible aiming shape's: never drawn)
const ghostMat = (color, emissive) => new THREE.MeshStandardMaterial({ color, transparent: true, opacity: 0.45, depthWrite: false, emissive, emissiveIntensity: 0.6 });
// The ghost is tinted by the support the piece would have, as the pieces already built are with the hammer out: green
// standing on the ground or held up well, yellow, then orange as it weakens; red where it can't go at all
const ghostOk = ghostMat(0x7fe08a, 0x2a8a3a), ghostMid = ghostMat(0xf0dc60, 0x8a7a1a), ghostWeak = ghostMat(0xffa050, 0x8a4a12), ghostBad = ghostMat(0xff6a5a, 0x8a2a1a);
const supportColor = (s, grounded) => (grounded ? 0x3a6cff : s > 0.7 ? 0x3fd060 : s > 0.4 ? 0xe8d040 : 0xff4a2a);
// How much of a piece's support reaches a piece it holds up (p, from q): an eighth is lost going up, a fifth sideways
// (Valheim's wood; a log less, def.loss), for every STEP metres between their middles, so it goes by how far a floor
// reaches out and not by how many pieces it takes (review, Nov: our 3 m pieces let a floor reach 30 m from one wall,
// half as far again as Valheim's; now about 20 m, and a tower of walls some 33 m); a door frame passes all of its own
// to its door
const STEP = 2;
const carry = (p, q) => (p.def.id === 'door' ? 1 : (1 - (p.pos.y - q.pos.y > 0.3 ? p.def.loss?.[0] ?? V_LOSS : p.def.loss?.[1] ?? H_LOSS)) ** (Math.max(1, p.mid.distanceTo(q.mid)) / STEP));
const midOf = (def, pos, rot) => toWorld(pos, rot, (def.centre ||= centreOf(def)));
// the meat on a cooking stand, and the ring over each piece showing how far it has cooked (a ring's arc in 24 steps)
const MEAT_GEO = new THREE.DodecahedronGeometry(0.11, 0).scale(1, 0.8, 1.3), BURN = 2, _cookC = new THREE.Color(), _cookQ = new THREE.Quaternion();
const RING = Array.from({ length: 25 }, (_, i) => new THREE.RingGeometry(0.055, 0.075, 24, 1, Math.PI / 2, -Math.max(0.001, (i / 24) * Math.PI * 2)));
const ringMat = new THREE.MeshBasicMaterial({ color: 0xf0c860, transparent: true, depthWrite: false, side: THREE.DoubleSide }), ringHot = new THREE.MeshBasicMaterial({ color: 0xff5a2a, transparent: true, depthWrite: false, side: THREE.DoubleSide }), ringBack = new THREE.MeshBasicMaterial({ color: 0x1a120c, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
const STEEP = 0.45;   // (the most the ground may rise across a bed's, a bench's or a chest's footprint)
const toLocal = (p, wx, wz) => { const dx = wx - p.pos.x, dz = wz - p.pos.z, c = Math.cos(-p.rot), s = Math.sin(-p.rot); return [dx * c + dz * s, -dx * s + dz * c]; };   // inverse of a yaw rotation
// How far along a ray it first meets a piece placed at pos, rot (its surfaces and solid parts), or null
const _lr = new THREE.Ray(), _p0 = new THREE.Vector3(), _p1 = new THREE.Vector3(), _p2 = new THREE.Vector3(), _p3 = new THREE.Vector3(), _hb = new THREE.Box3(), _hv = new THREE.Vector3();
function crossT(def, pos, rot, o, dir) {
  const c = Math.cos(-rot), s = Math.sin(-rot), lx = o.x - pos.x, lz = o.z - pos.z;   // the ray in the piece's own frame
  _lr.origin.set(lx * c + lz * s, o.y - pos.y, -lx * s + lz * c); _lr.direction.set(dir.x * c + dir.z * s, dir.y, -dir.x * s + dir.z * c);
  let best = null; const take = (h) => { if (h) { const t = h.distanceTo(_lr.origin); if (best === null || t < best) best = t; } };
  for (const t of def.tops || []) {
    const ya = t.y ?? t.y0, yb = t.y ?? t.y1; _p0.set(t.x0, ya, t.z0); _p1.set(t.x1, ya, t.z0); _p2.set(t.x1, yb, t.z1); _p3.set(t.x0, yb, t.z1);
    take(_lr.intersectTriangle(_p0, _p1, _p2, false, _hv)); take(_lr.intersectTriangle(_p0, _p2, _p3, false, _hv));
  }
  for (const b of def.solids || []) { _hb.setFromCenterAndSize(_p0.set(b[0], b[1], b[2]), _p1.set(b[3], b[4], b[5])); take(_lr.intersectBox(_hb, _hv)); }
  return best;
}
// A piece's surfaces ('top': [{x0,x1,z0,z1,y|y0,y1}]) or solid parts ('solid': [[cx,cy,cz,w,h,d]]) as rectangles turned
// with the piece (centre, half sizes along the piece's own axes, its angle) with a height range, shrunk by `inset`
function rects(list, pos, rot, inset, kind) {
  return (list || []).map((q) => {
    const top = kind === 'top', lx = top ? (q.x0 + q.x1) / 2 : q[0], lz = top ? (q.z0 + q.z1) / 2 : q[2], c = toWorld(pos, rot, [lx, 0, lz]);
    const hx = Math.max(0.02, (top ? Math.abs(q.x1 - q.x0) : q[3]) / 2 - inset), hz = Math.max(0.02, (top ? Math.abs(q.z1 - q.z0) : q[5]) / 2 - inset);   // (a thin wall stays a sliver, not nothing)
    const ya = top ? (q.y ?? q.y0) : q[1] - q[4] / 2 + inset, yb = top ? (q.y ?? q.y1) : q[1] + q[4] / 2 - inset;
    return { x: c.x, z: c.z, hx, hz, rot, y0: pos.y + Math.min(ya, yb) - (top ? 0.25 : 0), y1: pos.y + Math.max(ya, yb) + (top ? 0.05 : 0) };
  }).filter((r) => r.y1 > r.y0);
}
// Do two turned rectangles overlap (separating axes: each one's two sides), with their height ranges overlapping too?
function rectsMeet(a, b) {
  if (a.y1 <= b.y0 || b.y1 <= a.y0) return false;
  const dx = b.x - a.x, dz = b.z - a.z;
  for (const r of [a.rot, b.rot]) for (const [ux, uz] of [[Math.cos(r), -Math.sin(r)], [Math.sin(r), Math.cos(r)]]) {
    const ext = (q) => q.hx * Math.abs(Math.cos(q.rot) * ux - Math.sin(q.rot) * uz) + q.hz * Math.abs(Math.sin(q.rot) * ux + Math.cos(q.rot) * uz);
    if (Math.abs(dx * ux + dz * uz) >= ext(a) + ext(b)) return false;
  }
  return true;
}
// Is a point inside a turned rectangle (from rects)?
const inRect = (r, x, z) => { const dx = x - r.x, dz = z - r.z, c = Math.cos(r.rot), s = Math.sin(r.rot); return Math.abs(dx * c - dz * s) <= r.hx && Math.abs(dx * s + dz * c) <= r.hz; };
const CLEAR_M = 0.5, CLEAR_H = 2.2;   // (the room round a piece kept bare of what grows, and how high over the ground it still clears)
// How far a point is from a piece placed at pos, rot: for a flat piece (a floor, a beam laid level) from the nearest point
// of its surface, so aiming anywhere on or just past where a tile would lie counts; for anything else from its reference
// point (a wall's foot, a roof panel's lower edge), which is what you aim with
function flatReach(def, pos, rot, q) {
  if (def.aimAt) return Math.min(...def.aimAt.map((l) => toWorld(pos, rot, l).distanceTo(q)));   // (stairs: by either end)
  const t = def.tops?.length === 1 && def.tops[0].y !== undefined ? def.tops[0] : null; if (!t) return pos.distanceTo(q);
  const c = Math.cos(-rot), s = Math.sin(-rot), dx = q.x - pos.x, dz = q.z - pos.z, lx = dx * c + dz * s, lz = -dx * s + dz * c;
  const ex = Math.max(Math.min(t.x0, t.x1) - lx, 0, lx - Math.max(t.x0, t.x1)), ez = Math.max(Math.min(t.z0, t.z1) - lz, 0, lz - Math.max(t.z0, t.z1));
  return Math.hypot(ex, q.y - pos.y - t.y, ez) + 0.25 * Math.hypot(dx, dz);   // (of two tiles under the aim, the one centred nearer)
}
// The middle of a piece in its own frame (its surfaces and solid parts, else its snap points), for judging snap spots
function centreOf(def) {
  const pts = [];
  for (const t of def.tops || []) pts.push([(t.x0 + t.x1) / 2, ((t.y ?? t.y0) + (t.y ?? t.y1)) / 2, (t.z0 + t.z1) / 2]);
  for (const b of def.solids || []) pts.push([b[0], b[1], b[2]]);
  const src = pts.length ? pts : def.snaps; return [0, 1, 2].map((k) => src.reduce((a, p) => a + p[k], 0) / src.length);
}
// (the most ground a piece fills under itself; how near under a floor's footprint, somewhere, the land must come for the
// floor to count as laid on the ground and have it raised to it; a wall's width)
const FILL_MAX = 2.5, DECK = 0.7, WALL_W = 3;
const toWorld = (pos, rot, l, out = new THREE.Vector3()) => { const c = Math.cos(rot), s = Math.sin(rot); return out.set(pos.x + l[0] * c + l[2] * s, pos.y + l[1], pos.z - l[0] * s + l[2] * c); };

export class Build {
  constructor(g) {
    this.g = g; this.placed = []; this.grid = new Map(); this.seq = 0; this.sel = null; this.rot = 0; this.ghost = null; this.ghostDef = null;
    this.dirty = new Set(); this.moved = []; this.spilt = new Map(); this.version = 0;   // (support to settle again round these, recompute; what fell, to drop)
    this.pieces = [{ id: 'repair', name: 'Repair', cat: 'Tools', icon: 'repair', mats: {}, desc: 'Hit a damaged piece with the hammer to mend it.' }, ...PIECES];
    this.meshes = []; this.lights = [];
    loadKit(PIECES).then(() => { for (const p of this.placed) this.dress(p); if (this.ghost) { const keep = this.ghost.visible; this.g.scene.remove(this.ghost); this.makeGhost(this.ghostDef); this.ghost.visible = keep; } });   // (the kit's models replace the carved look)
    this.flameMat = pixelate(new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }), 'flame');   // (in squares of brighter and duller flame, render/pixel.js)
    this.flameMat2 = pixelate(new THREE.MeshBasicMaterial({ color: 0xffe080, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }), 'flame');
    this.tint = false; this.chest = null;
    this.buildChestPanel();
    // (a vegetation cell streaming in loses what grows under your buildings before its colliders are made: bareCell)
    const veg = g.veg, was = veg?.onCell; if (veg) veg.onCell = (key, items, cx, cz) => { if (items) this.bareCell(items, cx, cz, this.clearsNear(cx, cz)); was?.(key, items, cx, cz); };
    if (g.pickups) g.pickups.under = (x, z, y) => this.covers(x, z, y);
  }
  piece(id) { return id === 'repair' ? this.pieces[0] : PIECE[id]; }
  get active() { return !!this.sel && this.g.equippedTool('build'); }
  select(id) { this.sel = id; if (this.ghost) { this.g.scene.remove(this.ghost); this.ghost = null; } this.preview(null); if (id !== 'repair') this.makeGhost(PIECE[id]); this.g.hud.toast(`${this.piece(id).name}: <span class="kbd">LMB</span> place · <span class="kbd">R</span> turn · <span class="kbd">MMB</span> remove · <span class="kbd">RMB</span> menu`); }
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
  // Sheltered: under a roof you built or one of the island's old ones (a house in the town, the farmhouse, a cave's rock:
  // structures.js), which is what a bed, a workbench and a fire in the rain need (tester, 20 Nov: a workbench in the
  // abandoned house wouldn't work, as only roofs you'd built counted). An old roof's hole doesn't shelter until patched.
  sheltered(pos, above = 1.0) { return this.underRoof(pos, above) || !!this.g.structures?.underRoof(pos, above); }
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
    const def = this.ghostDef; let a = this.aim();
    // aiming at open sky (say, into the gap between two roof panels): structural pieces still snap along the line of aim
    if (!a) { if (def.equip) { this.ghost.visible = false; this.preview(null); return null; } a = { p: _ray.ray.origin.clone().addScaledVector(_ray.ray.direction, 9), d: 9, air: true }; }
    this.ghost.visible = true;
    let pos = a.p.clone();
    // a cooking stand goes right over a campfire: aim at the fire, or close to it, and it settles over it
    if (def.cook) {
      const fire = a.piece?.def.fire ? a.piece : [...this.near(pos.x, pos.z, 2)].find((p) => p.def.fire && Math.hypot(p.pos.x - pos.x, p.pos.z - pos.z) < 1.2);
      if (fire) {
        this.ghost.position.copy(fire.pos); this.ghost.rotation.y = fire.rot; this.lastSnap = null;
        const why = this.invalid(def, fire.pos, fire.rot, true, a); this.paint(why);
        return { pos: fire.pos.clone(), rot: fire.rot, why, snapped: true };
      }
    }
    // The line of aim, from about where the hero stands to where it lands. Snap spots are judged by how close the piece
    // would sit to this line, not to the point it lands on: aim into a gap and the line passes through the gap and lands
    // on whatever is behind, but the piece you want is still right on it.
    const o = _ray.ray.origin, dir = _ray.ray.direction, t0 = Math.max(0, _v.copy(this.g.player.pos).sub(o).dot(dir) - 1.5), t1 = Math.max(t0, a.d ?? o.distanceTo(a.p));
    const onLine = (q) => { const t = Math.min(t1, Math.max(t0, _v.copy(q).sub(o).dot(dir))); return { off: _v.copy(o).addScaledVector(dir, t).distanceTo(q), t }; };
    const centre = def.centre ||= centreOf(def), _c = new THREE.Vector3();
    // a door goes only into a door frame: aim at the frame (or through its opening) and it settles in, hinged on the side
    // your turn chooses; anywhere else it's refused, so it can never hang in the air off a corner
    if (def.door) {
      let frame = a.piece?.id === 'doorframe' ? a.piece : null, bd = 1.1;
      if (!frame) for (const p of this.near(this.g.player.pos.x, this.g.player.pos.z, REACH + 4)) if (p.id === 'doorframe') { const off = onLine(toWorld(p.pos, p.rot, [0, 1.15, 0])).off; if (off < bd) { bd = off; frame = p; } }
      let dpos = pos, drot = this.rot, why = 'Doors go in a door frame';
      if (frame) { const flip = Math.abs(Math.atan2(Math.sin(this.rot - frame.rot), Math.cos(this.rot - frame.rot))) > Math.PI / 2; drot = frame.rot + (flip ? Math.PI : 0); dpos = toWorld(frame.pos, frame.rot, [flip ? 0.7 : -0.7, 0, 0]); why = this.invalid(def, dpos, drot, true, a); }
      this.ghost.position.copy(dpos); this.ghost.rotation.y = drot; this.lastSnap = null; this.paint(why);
      return { pos: dpos.clone(), rot: drot, why, snapped: !!frame };
    }
    // Only structural pieces are snap anchors: never the workbench, campfire, bed, chest or other furniture. Equipment
    // itself doesn't snap at all; it goes where you aim.
    const structural = (p) => !p.def.equip, snapping = !def.equip;
    // near a structure, turn with its grid: the ghost takes the nearest quarter-turn to your chosen angle, relative to
    // the piece you're aiming at (or the nearest piece)
    let rot = this.rot, anchor = snapping && a.piece && structural(a.piece) ? a.piece : null;
    // (or the piece nearest the line of aim: aim at the ground just past a floor and you still mean to line up with it)
    if (snapping && !anchor) { let bd2 = 4; const P = this.g.player.pos; for (const p of this.near(P.x, P.z, REACH + 4)) { if (!structural(p)) continue; const d = Math.min(p.pos.distanceTo(pos), onLine(p.pos).off); if (d < bd2) { bd2 = d; anchor = p; } } }
    if (anchor) rot = anchor.rot + Math.round((this.rot - anchor.rot) / (Math.PI / 2)) * (Math.PI / 2);
    this.aligned = !!anchor;
    // (a roof patch near a hole in an old house's roof lies the way that roof's slope runs: the hole's edges, by the one nearest the aim)
    const holes = def.patch ? (this.g.structures?.anchorsNear(this.g.player.pos.x, this.g.player.pos.z, REACH + 4) || []).filter((s) => onLine(s).off < 6).sort((a, b) => onLine(a).off - onLine(b).off) : [];
    if (holes.length) { rot = holes[0].rot; this.aligned = true; }
    // snap: try putting each of the ghost's points on each point of what's built nearby, and score each placement by how
    // near its own reference point (a wall's foot, a roof panel's lower edge, a floor's middle) comes to where you aim,
    // lining up more points only breaking near-ties; then take the best one that's actually allowed
    const local = snapping ? def.snaps : [], targets = [], kin = new Set();   // (kin: points on pieces of this same kind)
    if (snapping) { const P = this.g.player.pos; for (const p of this.near(P.x, P.z, REACH + 4)) if (structural(p)) for (const s of p.snaps) if (onLine(s).off < 6) { targets.push(s); if (p.id === def.id) kin.add(s); } }
    for (const s of holes) { targets.push(s); kin.add(s); }   // (and snaps to their edges, as if into a gap between its own kind)
    // a flat piece aimed at the face of a wall or post (a floor laid off the top of a wall) comes out toward you, half a
    // tile back along your aim, rather than straddling the wall
    const flatAim = a.n && Math.abs(a.n.y) < 0.5 ? pos.clone().addScaledVector(_v.set(dir.x, 0, dir.z).normalize(), -0.75) : pos;
    const sloped = !def.aimAt && (def.tops || []).some((t) => t.y === undefined && t.y0 !== t.y1);   // (roof panels: see the gap rule below)
    // fences and stockades aimed at the ground follow the ground: they join the last one end to end across the ground,
    // whatever its height, and each stands on the ground where it is (so a fence line runs up a hill, not into it)
    const onGround = def.cat === 'Fences' && a.terrain;
    const cands = [];
    // (against a structure a quarter turn is tried too, but it only wins if it's clearly where you aim)
    for (const [r2, pen] of anchor ? [[rot, 0], [rot + Math.PI / 2, 2.5], [rot - Math.PI / 2, 2.5]] : [[rot, 0]]) {
      const c = Math.cos(r2), sn = Math.sin(r2);
      for (const s of targets) for (const l of local) {
        const cand = new THREE.Vector3(s.x - (l[0] * c + l[2] * sn), s.y - l[1], s.z - (-l[0] * sn + l[2] * c));
        if (cands.some((q) => q.pos.distanceTo(cand) < 0.02 && Math.abs(q.rot - r2) < 0.01)) continue;
        let match = 0, kins = 0; for (const m of local) { const wx = cand.x + m[0] * c + m[2] * sn, wy = cand.y + m[1], wz = cand.z - m[0] * sn + m[2] * c, at = (t) => Math.abs(t.x - wx) + Math.abs(t.y - wy) + Math.abs(t.z - wz) < 0.2; if (targets.some(at)) match++; for (const t of kin) if (at(t)) { kins++; break; } }
        // Filling a gap between roof panels (a sloped piece between two others, four points shared with them):
        // aim into the gap and the line passes through where the piece belongs and lands on whatever is behind, so if it
        // passes right through, well before it lands, that spot wins (nearest first)
        const x = kins >= 4 && sloped ? crossT(def, cand, r2, o, dir) : null, gap = x !== null && x > t0 && x < t1 - 0.6 && !this.blocked(def, cand, r2);
        // (aim just over the top of a wall and the line grazes it, then lands on the far wall: a reference point the line
        // passes close by, metres before it lands, counts as where you aimed; smoothly, so the ghost never jumps between
        // two spots as the aim moves a hair, and near where the line lands only the landing point counts)
        const L = onLine(cand); let d = onGround ? Math.hypot(cand.x - pos.x, cand.z - pos.z) : Math.min(flatReach(def, cand, r2, flatAim), 2 * L.off + Math.max(0, 3 - (t1 - L.t)));
        // (stairs aimed by their top end come down toward you from there; aimed by their foot, they climb away from you)
        if (def.aimAt) { const mid = toWorld(cand, r2, centre), away = (mid.x - pos.x) * dir.x + (mid.z - pos.z) * dir.z > 0, top = toWorld(cand, r2, def.aimAt[1]).distanceTo(pos) < cand.distanceTo(pos); if (top === away) d += 0.5; if (!top && cand.y - this.g.player.pos.y > 1.5) d += 0.8; }   // (and from below, stairs that bring you up to what you aim at, not ones starting up there)
        // (a wall sunk deep in the land, as a row going downhill snapped a storey lower, loses to one standing on it)
        if (def.cat === 'Walls' && !def.door) d += Math.max(0, heightAt(cand.x, cand.z) - cand.y - 0.6) * 1.5;
        if (!gap && d > 1.7) continue;
        cands.push({ pos: cand, rot: r2, score: (gap ? -100 + x : d) - 0.3 * (match - 1) + pen });
      }
    }
    cands.sort((x, y) => x.score - y.score);
    // keep the snap we had while it's still among the good ones, so the ghost doesn't flicker between near-equal spots
    const last = this.lastSnap, keep = last && cands.find((q) => q.pos.distanceTo(last.pos) < 0.02 && Math.abs(q.rot - last.rot) < 0.01 && q.score <= (cands[0]?.score ?? 0) + 0.6);
    let best = null;
    if (keep && !this.blocked(def, keep.pos, keep.rot)) best = keep;
    else for (const q of cands) if (!this.blocked(def, q.pos, q.rot)) { best = q; break; }   // (all of them: near a big house the first few can all be taken)
    if (!best && cands.length) best = cands[0];   // nothing free: show the best one (it will be red)
    this.lastSnap = best;
    if (best) { pos = best.pos.clone(); rot = best.rot; if (onGround) pos.y = Math.min(...def.snaps.map((l) => { const w = toWorld(pos, rot, l); return heightAt(w.x, w.z); })); }
    // a floor laid on the ground sits on its highest corner, so the ground doesn't poke up through it
    else if (a.terrain && def.cat === 'Floors' && def.tops) { const t = def.tops[0]; let top = -1e9; for (const [lx, lz] of [[t.x0, t.z0], [t.x1, t.z0], [t.x0, t.z1], [t.x1, t.z1], [0, 0]]) { const w = toWorld(pos, rot, [lx, 0, lz]); top = Math.max(top, heightAt(w.x, w.z)); } pos.y = top + 0.03; }
    this.ghost.position.copy(pos); this.ghost.rotation.y = rot;
    const why = this.invalid(def, pos, rot, !!best, a); this.paint(why);
    this.preview(def, pos, rot);
    return { pos, rot, why, snapped: !!best };
  }
  // Why this placement isn't allowed (null if it is)
  invalid(def, pos, rot, snapped, a) {
    const P = this.g.player; this.lastSup = null;
    if (pos.distanceTo(P.pos) > REACH) return 'Too far away';
    if (!this.g.inv.has(def.mats) && !this.g.S.freeBuild) return this.g.inv.need(def.mats);   // (what's short, and by how much)
    if (def.door && !this.doorFrameAt(pos, rot)) return 'Doors go in a door frame';
    if (def.equip && !snapped && !(a.terrain || (a.piece && a.piece.def.tops))) return 'Place it on the ground or a floor';
    // (the ground across the whole footprint, not just under the aim: a bed on a steep slope stood half in the air)
    if (def.equip && a.terrain && this.footRange(def, pos, rot) > STEEP) return 'Too steep here';
    // building pieces stand on the ground or snap onto what's built (sharing a point with it): never just leaning on the
    // side of something in mid-air
    if (!def.equip && !def.door && !this.grounded(def, pos, rot) && !this.snapsOf(def, pos, rot).some((m) => [...this.near(pos.x, pos.z, 8)].some((p) => p.snaps.some((q) => q.distanceTo(m) < 0.05)))) return 'Attach it to your building';
    const f = this.foot(def, pos, rot); if (f?.wall && this.gapUnder(f, rot).hi > FILL_MAX && !this.restsOn(def, pos, rot)) return 'Too high above the ground: build a wall under it first';
    const sup = this.lastSup = this.supportFor(def, pos, rot); if (sup.s < MIN_SUPPORT) return 'Nothing holds it up: build it nearer the ground or a wall';
    const tree = this.inTheWay(def, pos, rot); if (tree) return tree;
    if (this.overlaps(def, pos, rot)) return 'Something is in the way';
    if (this.duplicate(def, pos, rot)) return 'Already built here';
    if (this.throughFloor(def, pos, rot)) return 'Something is in the way';
    if (pos.y < waterAt(pos.x, pos.z) - 0.8) return 'Too deep in the water';   // (the sea's, the river's or the lake's: river.js)
    return null;
  }
  paint(why) { const s = this.lastSup, m = why ? ghostBad : !s || s.grounded || s.s > 0.7 ? ghostOk : s.s > 0.4 ? ghostMid : ghostWeak; for (const c of this.ghost.children) c.material = m; }
  // how far the ground rises and falls across a piece's footprint (its body's corners and middle, else a metre round it)
  footRange(def, pos, rot) {
    const b = def.solids?.[0] || [0, 0, 0, 1, 0, 1]; let lo = Infinity, hi = -Infinity;
    for (const [u, v] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 0]]) { const w = toWorld(pos, rot, [b[0] + (u * b[3]) / 2, 0, b[2] + (v * b[5]) / 2], _v), h = groundAt(w.x, w.z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
    return hi - lo;
  }
  // A tree's trunk or a rock where the piece's body would stand (walls, posts and furniture: floors and roofs, which have
  // no body, still go over them, and building round a tree stays your choice). Felled trees, and the slots the layout
  // left empty, have no collider
  inTheWay(def, pos, rot) {
    const A = rects(def.solids, pos, rot, 0.15, 'solid'); if (!A.length) return null;
    for (const c of this.g.colliders?.near(pos.x, pos.z, 6) || []) {
      const sp = c.ref?.cx !== undefined ? SPECIES[c.ref.sp] : null; if (!sp || (sp.res !== 'tree' && sp.res !== 'rock') || !(c.r > 0)) continue;
      const y0 = c.y ?? -1e9, y1 = c.h !== undefined ? y0 + c.h : 1e9;
      for (const r of A) {
        if (r.y1 <= y0 || r.y0 >= y1) continue;
        const dx = c.x - r.x, dz = c.z - r.z, cs = Math.cos(r.rot), sn = Math.sin(r.rot), u = Math.abs(dx * cs - dz * sn) - r.hx, v = Math.abs(dx * sn + dz * cs) - r.hz;
        if (Math.hypot(Math.max(u, 0), Math.max(v, 0)) < c.r) return sp.res === 'tree' ? 'A tree is in the way' : 'A rock is in the way';
      }
    }
    return null;
  }
  // the top of the tallest piece you've built within r of pos (for the mist's ceiling), or -Infinity
  tallestNear(pos, r) { let top = -Infinity; for (const p of this.near(pos.x, pos.z, r)) for (const b of p.boxes) top = Math.max(top, b.max.y); return top; }
  // the door frame whose opening a door at pos, rot fills (hinged at either side), if any
  doorFrameAt(pos, rot) {
    for (const p of this.near(pos.x, pos.z, 3)) { if (p.id !== 'doorframe') continue; for (const [side, turn] of [[-0.7, 0], [0.7, Math.PI]]) { const w = toWorld(p.pos, p.rot, [side, 0, 0]), dr = Math.atan2(Math.sin(rot - p.rot - turn), Math.cos(rot - p.rot - turn)); if (w.distanceTo(pos) < 0.05 && Math.abs(dr) < 0.05) return p; } }
    return null;
  }
  // While you aim a floor, the ground under the green tile already looks as it will once it's built (pressed down,
  // raised where it's low, the grass and flowers cleared), so the tile is never hidden in the grass; only for the eye
  // (look), so you don't walk on it, and redone only when the ghost moves to another spot. preview(null) puts it back.
  preview(def, pos, rot) {
    const f = def && this.ghost?.visible ? this.foot(def, pos, rot) : null, floor = f && !f.wall;
    const key = floor ? `${pos.x.toFixed(2)},${pos.y.toFixed(2)},${pos.z.toFixed(2)},${rot.toFixed(3)}` : null;
    if (key === this.previewKey) return; this.previewKey = key;
    if (!floor) { setCut('ghost', null); clearGrass('ghost', null); return; }
    setCut('ghost', { x: f.c.x, z: f.c.z, hw: f.hw, hd: f.hd, rot, y: f.y, fill: this.onGround(def, pos, rot), shape: SHAPE.floor, look: true });
    clearGrass('ghost', { x: f.c.x, z: f.c.z, hw: f.hw + 1.2, hd: f.hd + 1.2, rot });   // (a metre wider than the tile: the tall grass round it would lean over it)
  }
  // ---- Nothing grows through what you build (tester, 20 Nov: flowers poking up through new floors). The grass map is
  // cleared above; the flowers, tall grass, bushes, stumps, logs, pebbles and the rest of the ground cover (the vegetation's
  // own, flora.js groundCover) under a piece, with CLEAR_M round it, are taken away for good with veg.remove, as a felled
  // tree is, so the save keeps them gone. Only where the piece comes within CLEAR_H of the ground under each one: a floor
  // on stilts high over a meadow leaves it be. Trees and rocks stay (building over them is your choice); the pickups
  // under it are hidden while it stands (covers: pickups.js asks).
  clearsOf(p) { return (p.clears ||= [...rects(p.def.tops, p.pos, p.rot, -CLEAR_M, 'top'), ...rects(p.def.solids, p.pos, p.rot, -CLEAR_M, 'solid')]); }
  clearsNear(cx, cz) { const R = []; for (const p of this.near((cx + 0.5) * CELL, (cz + 0.5) * CELL, CELL * 0.75)) R.push(...this.clearsOf(p)); return R; }
  // whether a point (on the ground at y) lies under something built
  covers(x, z, y) { for (const p of this.near(x, z, 4)) for (const r of this.clearsOf(p)) if (r.y0 < y + CLEAR_H && inRect(r, x, z)) return true; return false; }
  bareUnder(p) {
    const veg = this.g.veg, R = this.clearsOf(p), cx = Math.floor(p.pos.x / CELL), cz = Math.floor(p.pos.z / CELL);
    this.g.harvest?.clearStumps((x, z, y) => R.some((r) => r.y0 < y + CLEAR_H && inRect(r, x, z)));   // (and a felled tree's stump: review, Nov, one stood up through a floor)
    if (!veg) return;
    for (let j = cz - 1; j <= cz + 1; j++) for (let i = cx - 1; i <= cx + 1; i++) { const c = veg.near.get(i + ',' + j); if (c?.items) this.bareCell(c.items, i, j, R, true); }
  }
  // (live: the cell's colliders are already made, so a stump's or log's goes with it)
  bareCell(items, cx, cz, R, live = false) {
    if (!R.length) return; const veg = this.g.veg, C = this.g.colliders;
    for (let i = 0; i < items.length / STRIDE; i++) {
      const o = i * STRIDE, res = SPECIES[items[o]].res; if (res === 'tree' || res === 'rock' || items[o + 6] <= 0) continue;
      const x = items[o + 2], y = items[o + 3], z = items[o + 4]; if (!R.some((r) => r.y0 < y + CLEAR_H && inRect(r, x, z)) || veg.removed.has(`${cx},${cz},${i}`)) continue;
      veg.remove(cx, cz, i); if (live && C) for (const c of [...C.near(x, z, 1)]) if (c.ref?.cx === cx && c.ref.cz === cz && c.ref.i === i) C.removeOne(c);
    }
  }
  // ---- Pieces on the ground (tester feedback, 19-20 Oct). A wall or flat floor that doesn't rest on another piece stands
  // on the ground: the earth is raised under it (and cut where it's higher: groundcut.js), so on a slope nothing hangs
  // in the air and it counts as grounded, however far along a row it is. Where the land falls more than FILL_MAX below
  // it, a wall can't go: build a wall under it first (a floor can still reach out, held up by what it's built onto).
  // footprint: the rectangle a piece stands on (centre, half sizes, level), for walls and flat floors only
  foot(def, pos, rot) {
    if (def.cat === 'Walls' && !def.door) return { c: pos, hw: (def.w ?? WALL_W) / 2, hd: 0.18, y: pos.y - 0.04, wall: true };
    const ft = def.cat === 'Floors' && def.tops?.length === 1 && def.tops[0].y !== undefined ? def.tops[0] : null;
    if (!ft) return null;
    return { c: toWorld(pos, rot, [(ft.x0 + ft.x1) / 2, 0, (ft.z0 + ft.z1) / 2]), hw: Math.abs(ft.x1 - ft.x0) / 2, hd: Math.abs(ft.z1 - ft.z0) / 2, y: pos.y + ft.y - 0.3, wall: false };
  }
  // the most and least the land lies below a footprint's level (sampled every ~0.75 m over it)
  gapUnder(f, rot) { const cs = Math.cos(rot), sn = Math.sin(rot), nu = Math.max(1, Math.ceil(f.hw / 0.75)), nv = Math.max(1, Math.ceil(f.hd / 0.75)); let hi = -Infinity, lo = Infinity;
    for (let i = -nu; i <= nu; i++) for (let j = -nv; j <= nv; j++) { const u = (i / nu) * f.hw, v = (j / nv) * f.hd, g = f.y - heightAt(f.c.x + u * cs + v * sn, f.c.z - u * sn + v * cs); hi = Math.max(hi, g); lo = Math.min(lo, g); }
    return { hi, lo }; }
  // whether a piece's footprint rests on another piece (a wall on a floor or on a wall below, a floor on walls)
  restsOn(def, pos, rot, self) {
    const f = this.foot(def, pos, rot); if (!f) return false;
    for (const p of this.near(pos.x, pos.z, 6)) { if (p === self) continue;
      for (const b of p.boxes) if (Math.abs(b.max.y - (f.y + 0.04)) < 0.35 || (!f.wall && Math.abs(b.max.y - (f.y + 0.3)) < 0.35)) {
        const cs = Math.cos(rot), sn = Math.sin(rot); for (let u = -f.hw + 0.15; u <= f.hw - 0.14; u += 0.3) for (const v of [-f.hd * 0.5, 0, f.hd * 0.5]) { const x = f.c.x + u * cs + v * sn, z = f.c.z - u * sn + v * cs; if (x > b.min.x && x < b.max.x && z > b.min.z && z < b.max.z) return true; } } }
    return false;
  }
  // a piece standing on the ground (the earth is shaped to it): not resting on another piece, never too high over the land;
  // and a floor only where the land comes up close under it somewhere (DECK), as it does under one laid on the ground: a
  // deck, porch or balcony held out on walls over falling ground stays on its walls and leaves the land alone (review,
  // Nov: four floors off two walls 2.2 m up turned into a grassy mound)
  fills(f, g) { return g.hi <= FILL_MAX && (f.wall || g.lo <= DECK); }
  onGround(def, pos, rot, self) { const f = this.foot(def, pos, rot); if (!f) return false; return this.fills(f, this.gapUnder(f, rot)) && !this.restsOn(def, pos, rot, self); }
  // (a door hangs in its frame and is held by nothing else: grounded never, so it comes down with its frame)
  lowSnap(def, pos, rot) { for (const s of def.snaps) { const w = toWorld(pos, rot, s, _v); if (w.y - heightAt(w.x, w.z) < 0.35) return true; } return false; }
  grounded(def, pos, rot, self) { if (def.id === 'door') return false; return this.lowSnap(def, pos, rot) || this.onSite(def, pos, rot) || this.onGround(def, pos, rot, self); }
  // The same for a piece that stands, from what was worked out once as it was placed (the land and the old houses don't
  // move: a snap point on the ground, a hole in an old roof it fills, land close enough under it to be raised to it); only
  // whether it rests on another piece is asked again
  baseOf(p) {
    if (!p.base) { const { def, pos, rot } = p, f = this.foot(def, pos, rot); p.base = def.id === 'door' ? { solid: false, fill: false } : { solid: this.lowSnap(def, pos, rot) || this.onSite(def, pos, rot), fill: !!f && this.fills(f, this.gapUnder(f, rot)) }; }
    return p.base;
  }
  standsUp(p) { const b = this.baseOf(p); return b.solid || (b.fill && !this.restsOn(p.def, p.pos, p.rot, p)); }
  // a roof patch in a hole of an old roof (two or more of its points on the hole's edges) is held up by that house's walls
  onSite(def, pos, rot) {
    if (!def.patch) return false; const A = this.g.structures?.anchorsNear(pos.x, pos.z, 4); if (!A?.length) return false;
    let n = 0; for (const s of def.snaps) { const w = toWorld(pos, rot, s); if (A.some((q) => q.distanceTo(w) < 0.05)) n++; } return n >= 2;
  }
  // neighbours: pieces sharing a snap point, or touching (the same both ways: recompute keeps each piece's list, and adds a
  // new piece to its neighbours' lists). A door's only neighbour is its frame
  neighbours(def, pos, rot, self) {
    if (def.id === 'door') { const fr = this.doorFrameAt(pos, rot); return fr && fr !== self ? [fr] : []; }
    const mine = this.snapsOf(def, pos, rot), out = [];
    for (const p of this.near(pos.x, pos.z, 8)) {
      if (p === self) continue;
      if (p.def.id === 'door') { if (self && this.doorFrameAt(p.pos, p.rot) === self) out.push(p); continue; }
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
  // (their real, turned outlines, grown by 6 cm: boxes squared to north and south would let a piece near a turned house
  // count as touching it while it hangs in the air)
  touch(def, pos, rot, p) {
    const A = [...rects(def.solids, pos, rot, -0.06, 'solid'), ...rects(def.tops, pos, rot, -0.06, 'top')], B = [...rects(p.def.solids, p.pos, p.rot, -0.06, 'solid'), ...rects(p.def.tops, p.pos, p.rot, -0.06, 'top')];
    for (const a of A) for (const b of B) if (rectsMeet(a, b)) return true; return false;
  }
  // Would this sit on (or half over) a piece of the same kind? Floors, roofs and beams have no body, so overlaps between
  // them are caught here: the same spot, or their surfaces overlapping by more than a sliver
  duplicate(def, pos, rot) {
    // (surfaces shrunk sideways by 0.2 m, so pieces meeting edge to edge don't count; turned with the piece, so a floor
    // at any angle leaves room for the next one beside it)
    const mine = this.snapsOf(def, pos, rot), A = rects(def.tops, pos, rot, 0.2, 'top');
    for (const p of this.near(pos.x, pos.z, 6)) {
      if (p.id !== def.id) continue;
      if (mine.every((m) => p.snaps.some((q) => q.distanceTo(m) < 0.15))) return true;
      const B = rects(p.def.tops, p.pos, p.rot, 0.2, 'top'); for (const a of A) for (const b of B) if (rectsMeet(a, b)) return true;
    }
    return false;
  }
  blocked(def, pos, rot) { return this.overlaps(def, pos, rot) || this.duplicate(def, pos, rot) || this.throughFloor(def, pos, rot); }
  // stairs mustn't pass through a floor (ending in the middle of one, coming up from beneath it): a floor or other
  // surface crossing the stairs anywhere between their two ends, which may rest on floors
  throughFloor(def, pos, rot) {
    if (!def.aimAt) return false;
    const rise = def.aimAt[1][1], A = rects(def.tops, pos, rot, 0.3, 'top').map((r) => ({ ...r, y0: pos.y + 0.15, y1: pos.y + rise - 0.05 }));
    for (const p of this.near(pos.x, pos.z, 6)) { if (p.def.aimAt) continue; for (const b of rects(p.def.tops, p.pos, p.rot, 0, 'top')) for (const a of A) if (rectsMeet(a, b)) return true; }
    return false;
  }
  // Only real bodies collide (walls, posts, furniture): the space under a sloped roof or over a floor doesn't count, so
  // gable ends, awnings and roofs can go in in any order
  solidBoxes(def, pos, rot) { return this.boxes({ solids: def.solids }, pos, rot); }
  overlaps(def, pos, rot) {
    if (def.door) return false;
    const A = rects(def.solids, pos, rot, 0.15, 'solid');   // (shrunk 0.15 m all round, and turned with each piece)
    for (const p of this.near(pos.x, pos.z, 8)) { if (p.def.door) continue; const B = rects(p.def.solids, p.pos, p.rot, 0.15, 'solid'); for (const a of A) for (const b of B) if (rectsMeet(a, b)) return true; }
    return false;
  }
  supportFor(def, pos, rot, self) {
    if (this.grounded(def, pos, rot)) return { s: 1, grounded: true };
    let s = 0; const me = { def, pos, mid: midOf(def, pos, rot) };
    for (const p of this.neighbours(def, pos, rot, self)) s = Math.max(s, p.support * carry(me, p));
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
  // a piece's meshes, from its look (the kit's model once loaded, the carved one until then); again when the look changes.
  // Aiming always meets the carved shape, so building works the same whatever the look: with the kit's model shown, the
  // carved shape stays as an invisible target.
  dress(p) {
    const depth = this.depthRank(p.def, p.rot);
    for (const m of [...p.inner.children]) if (m.userData.piece === p) { p.inner.remove(m); const i = this.meshes.indexOf(m); if (i >= 0) this.meshes.splice(i, 1); }
    p.mats.length = 0; const kit = p.def.build() !== p.def.carved();
    for (const { geo, mat } of p.def.build()) { const m2 = pixelLike(wetLike(mat.clone(), mat), mat); Object.assign(m2, depth); p.mats.push(m2); const m = new THREE.Mesh(geo, m2); m.castShadow = m.receiveShadow = true; m.userData.piece = p; p.inner.add(m); if (!kit) this.meshes.push(m); }
    if (kit) for (const { geo } of p.def.carved()) { const m = new THREE.Mesh(geo, proxyMat); m.visible = false; m.userData.piece = p; p.inner.add(m); this.meshes.push(m); }
  }
  place(id, pos, rot, opts = {}) {
    const def = PIECE[id]; if (!def) { console.warn('unknown piece', id); return null; }   // (a kind no longer built, in an old save)
    this.preview(null);
    const obj = new THREE.Group(); obj.position.copy(pos); obj.rotation.y = rot;
    const inner = new THREE.Group(); obj.add(inner);
    const p = { uid: opts.uid ?? 'pc' + this.seq++, id, def, obj, inner, pos: pos.clone(), rot, hp: opts.hp ?? def.hp, state: opts.state || {}, support: 1, grounded: false, mats: [], nb: [] };
    this.dress(p);
    this.g.scene.add(obj);
    p.snaps = this.snapsOf(def, pos, rot); p.boxes = this.boxes(def, pos, rot); p.mid = midOf(def, pos, rot);
    this.index(p, true); this.placed.push(p);
    this.addColliders(p);
    if (def.fire || def.torch) { p.state.fuel ??= def.fire ? 3 : 4; p.state.lit ??= true; this.addFlame(p); }
    if (def.chest) { p.inv = new Inventory(); p.inv.slots = new Array(def.chest[0] * def.chest[1]).fill(null); if (opts.state?.slots) p.inv.slots = opts.state.slots.map((s) => (s && ITEMS[s.id] ? s : null)); }
    if (def.cook) { p.state.cook = (p.state.cook || []).filter((c) => ITEMS[c.id]?.cook); if (p.state.cook.length) this.drawCook(p); }
    if (def.door && p.state.open) this.setDoor(p, true, true);
    if (opts.defer) return p;   // (a save loading: shaped and held up once everything stands, load)
    this.shape(p);
    // its support: it joins its neighbours (and they it), the ground round it is asked again, and it all settles
    p.grounded = this.standsUp(p); p.nb = this.neighbours(def, pos, rot, p); for (const q of p.nb) if (!q.nb.includes(p)) q.nb.push(p);
    this.dirty.add(p); this.moved.push(p.pos); this.recompute();
    if (def.station && this.g.inv?.seen && !this.g.inv.seen.has('@' + def.station)) { this.g.inv.seen.add('@' + def.station); this.g.crafting?.discover(); }   // (a bench built: its recipes are learnt)
    return p;
  }
  // The ground meets what's built on it (groundcut.js): under a floor it's always pressed down below the boards, and under
  // a floor or wall standing on the ground (onGround) it's also raised up to it. Flat floors only: stairs keep the slope
  shape(p) {
    const { def, pos, rot } = p, f = this.foot(def, pos, rot), on = f && this.onGround(def, pos, rot, p);
    if (f && (on || !f.wall)) setCut(p.uid, { x: f.c.x, z: f.c.z, hw: f.hw, hd: f.hd, rot, y: f.y, fill: on, shape: f.wall ? SHAPE.wall : SHAPE.floor });
    // grass doesn't grow through floors and furniture
    // (always under a floor or wall standing on the ground: the earth raised to it would otherwise grow grass through the boards)
    const bb = p.boxes.reduce((a, b) => a.union(b), new THREE.Box3()); if (bb.min.y < heightAt(pos.x, pos.z) + 1.2 || on) clearGrass(p.uid, { x: pos.x, z: pos.z, hw: (def.tops?.[0] ? Math.abs(def.tops[0].x1 - def.tops[0].x0) / 2 : (def.solids?.[0]?.[3] ?? 1) / 2) + 0.35, hd: (def.tops?.[0] ? Math.abs(def.tops[0].z1 - def.tops[0].z0) / 2 : (def.solids?.[0]?.[5] ?? 1) / 2) + 0.35, rot });
    this.bareUnder(p); if (this.g.pickups) this.g.pickups.dirty = true;   // (and the flowers, bushes, stumps and stones under it go)
  }
  addColliders(p) {
    const list = [];
    for (const b of p.def.solids || []) {
      const [cx, cy, cz, w, h, d] = b, alongX = w >= d, len = alongX ? w : d, r = Math.min(w, d) / 2 + 0.04, n = Math.max(1, Math.ceil(len / (r * 1.5)));
      for (let i = 0; i < n; i++) { const t = n === 1 ? 0 : (i / (n - 1) - 0.5) * (len - 2 * r); const l = alongX ? [cx + t, cy, cz] : [cx, cy, cz + t]; const wpos = toWorld(p.pos, p.rot, l); list.push({ x: wpos.x, z: wpos.z, r, y: wpos.y - h / 2, h, ref: { piece: p } }); }
    }
    this.g.colliders.addGroup(p.uid, list);
  }
  // Take a piece away. refund: taken down with the hammer, its cost back into the pack (and what a cooking stand holds);
  // else it fell or was broken, and what it was made of drops where it stood (spill). A chest's things drop either way.
  // Its neighbours lose it and their support is settled again at the next recompute
  remove(p, refund) {
    this.g.scene.remove(p.obj); this.meshes = this.meshes.filter((m) => m.userData.piece !== p); this.index(p, false); this.placed.splice(this.placed.indexOf(p), 1);
    this.g.colliders.removeGroup(p.uid); clearGrass(p.uid, null); setCut(p.uid, null); if (this.g.pickups) this.g.pickups.dirty = true;
    const back = (id, n) => (refund ? this.g.give(id, n) : this.spill(id, n, p.pos));
    for (const [id, n] of Object.entries(p.def.mats)) back(id, n);
    for (const c of p.state.cook || []) back(this.cookedAs(c), 1);   // (the meat on a stand, raw, cooked or burnt as it was)
    if (p.inv) for (const s of p.inv.slots) if (s) this.g.pickups.drop(s.id, s.n, p.pos.x + Math.random() - 0.5, p.pos.z + Math.random() - 0.5, s.dur !== undefined ? { dur: s.dur } : undefined, p.pos.y);
    if (p.flame) p.flame = null;
    if (this.chest === p) this.closeChest();
    p.gone = true; this.dirty.delete(p); this.moved.push(p.pos);
    for (const q of p.nb || []) { const i = q.nb?.indexOf(p) ?? -1; if (i >= 0) q.nb.splice(i, 1); q.held = false; this.dirty.add(q); }
  }
  // ---- Support. Pieces form a graph (each keeps its neighbours, p.nb, and whether it stands on the ground of itself,
  // p.grounded); support spreads from the ground through it, losing a share at each piece (carry), and what's left with too
  // little falls. Only what a change touches is worked out again: the pieces near it asked whether they still rest on
  // another or now stand on the ground, then support spread again through the pieces joined to what changed. A placement
  // or removal in a 400-piece base cost 120 ms when every piece was redone each time (review, Nov); the result is the same
  // (tests/suites/build.mjs compares it with o.full on random bases). o.full: everything from scratch, as a save loads.
  // o.hold: nothing that has a neighbour falls (a save loading, should a rule have changed since it was made: it stands,
  // shown red, until something next to it is taken away); what falls drops what it was made of, gathered into piles (spill)
  recompute(o = {}) {
    if (o.full) { this.moved.length = 0; for (const p of this.placed) { p.base = null; p.held = false; p.grounded = this.standsUp(p); p.nb = this.neighbours(p.def, p.pos, p.rot, p); this.dirty.add(p); } }
    for (let wave = 0, fx = 0; wave < 40; wave++) {
      this.reground();
      if (!this.dirty.size) break;
      const set = this.component(this.dirty); this.dirty.clear();
      for (const [p, s] of this.spread(set)) p.support = s;
      let falling = [...set].filter((p) => p.support < MIN_SUPPORT);
      if (o.hold) { for (const p of falling) if (p.nb.length) { p.held = true; p.support = MIN_SUPPORT; } falling = falling.filter((p) => !p.held); if (!falling.length) break; }
      if (!falling.length) break;
      for (const p of falling) this.breakPiece(p, false, fx++ < 24);   // (the dust and the crash of the first few: a whole house is one great fall)
    }
    this.flushSpill(); this.version++; this.updateTint();
  }
  // whether pieces round where something came or went still rest on another piece, or now stand on the ground of themselves
  // (a floor whose wall was taken from under it, with the land close under it)
  reground() {
    if (!this.moved.length) return; const seen = new Set();
    for (const m of this.moved) for (const q of this.near(m.x, m.z, 10)) {
      if (seen.has(q)) continue; seen.add(q); const b = this.baseOf(q); if (b.solid || !b.fill) continue;
      const gr = !this.restsOn(q.def, q.pos, q.rot, q); if (gr !== q.grounded) { q.grounded = gr; this.dirty.add(q); }
    }
    this.moved.length = 0;
  }
  // every piece joined to these (through neighbours), leaving out skip
  component(seeds, skip) { const out = new Set(), st = [...seeds]; while (st.length) { const p = st.pop(); if (p === skip || p.gone || out.has(p)) continue; out.add(p); for (const q of p.nb || []) if (!out.has(q)) st.push(q); } return out; }
  // Support through a set of joined pieces, from those standing on the ground, the strongest first (Dijkstra's way: each
  // piece gets the best any path from the ground leaves it, as the old sweeps over every piece did until nothing changed),
  // as a map; skip: left out, as if taken down
  spread(set, skip) {
    const s = new Map(), H = [];
    const up = (i) => { while (i > 0) { const j = (i - 1) >> 1; if (H[j][0] >= H[i][0]) break; [H[i], H[j]] = [H[j], H[i]]; i = j; } };
    const down = (i) => { for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < H.length && H[l][0] > H[m][0]) m = l; if (r < H.length && H[r][0] > H[m][0]) m = r; if (m === i) return; [H[i], H[m]] = [H[m], H[i]]; i = m; } };
    const push = (p, v) => { s.set(p, v); H.push([v, p]); up(H.length - 1); };
    for (const p of set) if (p !== skip) { if (p.grounded) push(p, 1); else if (p.held) push(p, MIN_SUPPORT); else s.set(p, 0); }
    while (H.length) {
      const [v, p] = H[0], last = H.pop(); if (H.length) { H[0] = last; down(0); }
      if (v < s.get(p)) continue;
      for (const q of p.nb) { if (q === skip || q.grounded || !s.has(q)) continue; const w = v * carry(q, p); if (w > s.get(q) + 1e-9) push(q, w); }
    }
    return s;
  }
  // what would come down if p were taken away (for the warning before it is: hold to take it down)
  wouldFall(p) {
    if (this.fallFor?.p === p && this.fallFor.v === this.version) return this.fallFor.list;
    const list = []; for (const [q, s] of this.spread(this.component(p.nb, p), p)) if (s < MIN_SUPPORT) list.push(q);
    this.fallFor = { p, v: this.version, list }; return list;
  }
  // ---- What falls drops what it was made of (Valheim's way: nothing built is simply lost), where it fell: in piles by kind,
  // one to every 6 m of ground and a stack each, so a house coming down leaves a few heaps rather than hundreds of bundles;
  // laid down once the collapse is over, on what still stands below or the ground (pickups.landAt)
  spill(id, n, at) {
    if (!n || !ITEMS[id]) return; const k = `${id}|${Math.round(at.x / 6)},${Math.round(at.z / 6)}`;
    const s = this.spilt.get(k) || this.spilt.set(k, { id, n: 0, x: 0, z: 0, y: Infinity }).get(k); s.x += at.x * n; s.z += at.z * n; s.n += n; s.y = Math.min(s.y, at.y);
  }
  flushSpill() {
    if (!this.g.pickups) { this.spilt.clear(); return; }
    for (const s of this.spilt.values()) { const st = ITEMS[s.id].stack, x = s.x / s.n, z = s.z / s.n; for (let n = s.n, i = 0; n > 0; n -= st, i++) this.g.pickups.drop(s.id, Math.min(n, st), x + (i ? Math.cos(i * 2.4) * 0.5 : 0), z + (i ? Math.sin(i * 2.4) * 0.5 : 0), undefined, s.y + 0.5); }
    this.spilt.clear();
  }
  breakPiece(p, recompute = true, fx = true) {
    const c = p.boxes[0] ? p.boxes[0].getCenter(new THREE.Vector3()) : p.pos;
    if (fx) { dust(c, 16, 0xa08060, 0.5); burst(c, { color: 0x8a6440, n: 14, speed: 3.5, size: 0.1 }); this.g.sound?.('break', { at: c }); }
    this.remove(p, false); if (recompute) this.recompute();
  }
  damage(p, n) { if (p.gone) return; p.hp -= n; burst(p.pos.clone().setY(p.pos.y + 1), { color: 0x8a6440, n: 5, speed: 2.5 }); if (p.hp > 0) this.g.sound?.('pieceHit', { at: p.pos }); if (p.hp <= 0) this.breakPiece(p); }
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
    // a cooking stand over a fire: E goes to the stand only when it has something to do (food to take off, or meat to put
    // on over a burning fire); otherwise to the fire, so you can always light it or feed it, meat in your pack or not
    const stand = best.def.cook ? best : best.def.fire ? [...this.near(best.pos.x, best.pos.z, 2)].find((q) => q.def.cook && q.pos.distanceTo(best.pos) < 1.5) : null;
    const hearth = stand && (best.def.fire ? best : [...this.near(stand.pos.x, stand.pos.z, 2)].find((q) => q.def.fire && q.pos.distanceTo(stand.pos) < 1.5));
    if (stand && hearth) {
      const st = stand.state.cook, ready = st.some((c) => c.t >= c.need), raw = this.g.inv.count('rawMeat') + this.g.inv.count('rawFish');
      best = ready || (hearth.state.lit && raw && st.length < stand.def.cook) ? stand : hearth;
    }
    const p = best, d = p.def, inv = this.g.inv;
    if (d.door) return { label: p.state.open ? 'Close' : 'Open', sub: d.name, use: () => { this.setDoor(p, !p.state.open); this.g.sound?.('door', { open: p.state.open, at: p.pos }); } };
    const full = d.hearth ? 20 : 10;   // (a stone hearth holds twice the wood)
    if (d.fire) return { label: p.state.lit ? `Add wood (${Math.ceil(p.state.fuel)}/${full})` : inv.count('wood') ? 'Light the fire' : 'Needs wood to light', sub: d.name, alt: this.douseAction(p), use: () => {
      if (!inv.count('wood')) { this.g.hud.toast('You have no wood'); return; } if (p.state.fuel >= full && p.state.lit) { this.g.hud.toast('The fire is full'); return; }
      if (!p.state.lit) this.g.sound?.('fireStart', { at: p.pos }); inv.take('wood', 1); p.state.fuel = Math.min(full, (p.state.lit || p.state.doused ? p.state.fuel : 0) + 1);   /* a fire you put out keeps its wood */ p.state.lit = true; p.state.doused = false; p.state.rainT = 0; p.flame.visible = true; burst(p.pos.clone().setY(p.pos.y + 0.4), { color: 0xffa040, n: 10, speed: 1.5, grav: -2 }); } };
    if (d.torch) return { label: p.state.lit ? 'Burning' : inv.count('resin') ? 'Light it (resin)' : 'Needs resin', sub: d.name, use: () => { if (!p.state.lit && inv.take('resin', 1)) { p.state.lit = true; p.state.fuel = 4; p.flame.visible = true; this.g.sound?.('fireStart', { at: p.pos }); } } };
    if (d.bed) return { label: 'Sleep', sub: 'Bed', use: () => this.sleep(p) };
    if (d.chest) return { label: 'Open', sub: 'Chest', use: () => this.openChest(p) };
    if (d.station) return { label: 'Craft', sub: d.name, use: () => { this.g.hud.toggle(true); this.g.crafting.open('craft'); } };
    if (d.cook) {
      // every piece cooks on its own timer; one press puts on all the raw meat that fits, or takes off all that's done
      const ready = p.state.cook.filter((c) => c.t >= c.need), free = d.cook - p.state.cook.length, raw = inv.count('rawMeat') + inv.count('rawFish');
      const fire = [...this.near(p.pos.x, p.pos.z, 2)].find((q) => q.def.fire && q.state.lit && q.pos.distanceTo(p.pos) < 1.5), alt = fire ? this.douseAction(fire) : null;
      if (ready.length) return { alt, label: `Take ${ready.length > 1 ? `${ready.length} off the stand` : ITEMS[this.cookedAs(ready[0])].name.toLowerCase()}`, sub: ready.some((c) => this.burnt(c)) ? 'Cooking Stand · left on too long, it burnt' : 'Cooking Stand', use: () => {
        for (const c of ready) { p.state.cook.splice(p.state.cook.indexOf(c), 1); this.g.give(this.cookedAs(c), 1); } this.drawCook(p); } };
      if (raw && free > 0) return { alt, label: `Cook ${Math.min(raw, free) > 1 ? `${Math.min(raw, free)} pieces of meat` : (inv.count('rawMeat') ? 'raw meat' : 'raw fish')}`, sub: `Cooking Stand · ${p.state.cook.length}/${d.cook}`, use: () => {
        for (const id of ['rawMeat', 'rawFish']) while (p.state.cook.length < d.cook && inv.take(id, 1)) p.state.cook.push({ id, t: 0, need: ITEMS[id].cook.time });
        this.drawCook(p); } };
      const left = Math.min(...p.state.cook.map((c) => c.need - c.t));
      return { alt, label: p.state.cook.length ? `Cooking… ${Math.max(1, Math.ceil(left))} s` : 'Needs raw meat', sub: p.state.cook.length ? `Cooking Stand · ${p.state.cook.length}/${d.cook}${fire ? '' : ' · the fire is out'}` : 'Cooking Stand', use: () => {} };
    }
    return null;
  }
  // F at a lit campfire puts it out (its remaining wood stays for when you light it again)
  douseAction(p) {
    if (!p.state.lit) return null;
    return { key: 'F', label: 'Put out fire', use: () => { p.state.lit = false; p.state.doused = true; p.state.rainT = 0; p.flame.visible = false; dust(p.pos.clone().setY(p.pos.y + 0.5), 14, 0x8a8a8a, 0.45); this.g.sound?.('douse', { at: p.pos }); } };
  }
  // ---- Cooking. Each piece on a stand cooks on its own timer over a lit fire; left on as long again once it's done, it burns
  // to coal (Valheim's way: take it off in time). Each piece turns from raw red to brown as it cooks, and black as it
  // burns, with a ring over it filling as it goes (BURN: how many times its cooking time it may hang there)
  burnt(c) { return c.t >= c.need * BURN; }
  cookedAs(c) { return this.burnt(c) ? 'coal' : c.t >= c.need ? ITEMS[c.id].cook.to : c.id; }
  drawCook(p) {
    if (!p.meat) { p.meat = new THREE.Group(); p.obj.add(p.meat); }
    p.meat.clear(); const mats = (p.meatMats ||= []);   // (each stand keeps its pieces' materials: made once, coloured as they cook)
    p.state.cook.forEach((c, i) => {
      const m = new THREE.Mesh(MEAT_GEO, (mats[i] ||= new THREE.MeshStandardMaterial({ roughness: 0.7 }))); m.position.set(-0.4 + i * 0.4, 0.92, 0); p.meat.add(m);
      const ring = new THREE.Group(), back = new THREE.Mesh(RING[RING.length - 1], ringBack), arc = new THREE.Mesh(RING[0], ringMat); arc.renderOrder = back.renderOrder = 6; ring.add(back, arc); ring.position.set(-0.4 + i * 0.4, 1.22, 0); ring.visible = false; p.meat.add(ring); m.userData.ring = ring;
    });
    this.tintCook(p, !!this.g.player && p.pos.distanceTo(this.g.player.pos) < 5);
  }
  // each piece's colour and ring by how far along it is (rings only for a stand you stand by: drawn every frame while it cooks)
  tintCook(p, show) {
    if (!p.meat) return; const meats = p.meat.children.filter((m) => m.userData.ring);
    p.state.cook.forEach((c, i) => {
      const m = meats[i]; if (!m) return; const k = Math.min(1, c.t / c.need), b = clamp((c.t - c.need) / (c.need * (BURN - 1)), 0, 1);
      m.material.color.setHex(0xb8443a).lerp(_cookC.setHex(0x7a4a24), k).lerp(_cookC.setHex(0x1e1712), b * b);
      const ring = m.userData.ring; ring.visible = show; if (!show) return; ring.quaternion.copy(camera.quaternion).premultiply(_cookQ.copy(p.obj.quaternion).invert());
      const f = k < 1 ? k : b, arc = ring.children[1]; arc.geometry = RING[Math.min(RING.length - 1, Math.floor(f * (RING.length - 1)))]; arc.material = k < 1 ? ringMat : ringHot;   // (amber while it cooks, red as it chars)
    });
  }
  sleep(p) {
    const g = this.g, S = g.S; S.bed = { x: p.pos.x + Math.sin(p.rot) * 1.4, z: p.pos.z + Math.cos(p.rot) * 1.4 };
    if (!this.sheltered(p.pos.clone().setY(p.pos.y + 0.3))) { g.hud.toast('Your spawn point is set. You need a roof over the bed to sleep.'); return; }
    if (S.time < 0.68) { g.hud.toast('Your spawn point is set. You can only sleep once evening comes.'); return; }
    const night = () => { S.time = 0.01; S.day++; g.player.stats.add('rested'); g.player.stats.heal(99); g.hud.toast(`You wake <b>rested</b>. Day ${S.day}.`); };
    if (g.acts) g.acts.sleep(p, night); else g.hud.sleep?.(night);   // (lying down on it, getting up again: game/acts.js)
  }
  // ---- chest window: click an item to move it between the chest and your pack
  buildChestPanel() {
    const p = document.createElement('div'); p.className = 'pnl hidden'; p.id = 'chestPanel';
    p.innerHTML = '<h2>Chest</h2><div class="pbody"><div class="grid" id="chestGrid"></div><div class="chestFoot"><button class="btn small" id="chestSort">Sort Items</button><button class="btn small" id="chestTake" title="Everything in the chest into your pack">Take All</button><button class="btn small" id="chestStore" title="Whatever the chest already holds some of, from your pack into it">Store Stacks</button><p class="hint">Click to move between the chest and your pack</p></div></div>';
    document.getElementById('invPanel').prepend(p); this.chestEl = p;
    p.addEventListener('click', (e) => {
      if (!this.chest) return; const C = this.chest.inv, I = this.g.inv;
      if (e.target.closest('#chestSort')) { C.sort(); this.drawChest(); return; }
      if (e.target.closest('#chestTake')) { C.slots.forEach((_, i) => this.takeOut(i)); I.onChange?.(); this.drawChest(); return; }
      // (Valheim's "place stacks": what the chest keeps some of goes to it from the pack, never what you wear or the hotbar)
      if (e.target.closest('#chestStore')) { const ids = new Set(C.slots.filter(Boolean).map((s) => s.id)); for (let i = COLS; i < I.slots.length; i++) { const it = I.slots[i]; if (!it || it.worn || !ids.has(it.id)) continue; const left = C.add(it.id, it.n, it.dur !== undefined ? { dur: it.dur } : {}); if (left) it.n = left; else I.slots[i] = null; } I.onChange?.(); this.drawChest(); return; }
      const s = e.target.closest('.slot'); if (!s) return; this.takeOut(+s.dataset.i); this.drawChest();
    });
    this.g.hud.onSlotClick = (i) => { if (!this.chest) return false; const it = this.g.inv.slots[i]; if (!it || it.worn) return true; const left = this.chest.inv.add(it.id, it.n, it.dur ? { dur: it.dur } : {}); if (left) it.n = left; else this.g.inv.slots[i] = null; this.g.inv.onChange?.(); this.drawChest(); return true; };
  }
  takeOut(i) { const C = this.chest.inv, it = C.slots[i]; if (!it) return; const left = this.g.inv.add(it.id, it.n, it.dur !== undefined ? { dur: it.dur } : {}); if (left) it.n = left; else C.slots[i] = null; }
  openChest(p) { this.chest = p; this.chestEl.classList.remove('hidden'); document.getElementById('craftPanel').classList.add('hidden'); this.g.hud.toggle(true); this.drawChest(); this.g.sound?.('chest'); }
  closeChest() { if (this.chest) this.g.sound?.('chest', false); this.chest = null; this.chestEl.classList.add('hidden'); document.getElementById('craftPanel').classList.remove('hidden'); }
  drawChest() { if (!this.chest) return; const [c] = this.chest.def.chest; const el = document.getElementById('chestGrid'); el.style.gridTemplateColumns = `repeat(${c}, 56px)`; el.innerHTML = this.chest.inv.slots.map((s, i) => (s ? `<div class="slot" data-i="${i}" title="${ITEMS[s.id].name}">${icon(ITEMS[s.id].icon)}${s.n > 1 ? `<em>${s.n}</em>` : ''}${ITEMS[s.id].dur ? `<div class="dur"><i style="width:${(s.dur / ITEMS[s.id].dur) * 100}%;${s.dur / ITEMS[s.id].dur < 0.25 ? 'background:#d65446' : ''}"></i></div>` : ''}</div>` : `<div class="slot empty" data-i="${i}"></div>`)).join(''); }
  // Taking a piece down (MMB or X): at once if nothing rests on it. One that holds others up (review: one stray click took a
  // whole storey down) first flashes red all that would fall with it, and comes down at a second press within a few
  // seconds, or with X held; a chest with things in it stays until it's emptied
  takeDown(tp, dt) {
    const g = this.g, now = performance.now(), press = !!tp && (input.clicks.includes(1) || hit('KeyX'));
    // (the warning lasts a few seconds, and a moment's aim off the piece doesn't end it)
    if (this.arm && (this.arm.p.gone || now - this.arm.t > 3500 || (this.arm.p !== tp ? (this.arm.off += dt) > 0.4 : (this.arm.off = 0)))) { this.arm = null; this.updateTint(); }
    const armed = !!tp && this.arm?.p === tp;
    if (armed) { this.flash(this.arm.fall, now); if (input.keys.KeyX && (this.arm.held += dt) > 0.6) { this.arm = null; this.takeOff(tp); return; } }
    if (!press) return;
    if (armed) { this.arm = null; this.takeOff(tp); return; }
    if (tp.inv?.slots.some(Boolean)) { g.hud.toast('Empty the chest before you take it down'); return; }
    const fall = this.wouldFall(tp);
    if (!fall.length) { this.takeOff(tp); return; }
    if (this.arm) this.updateTint();
    this.arm = { p: tp, fall, t: now, held: 0, off: 0 }; g.hud.toast(`It holds up ${fall.length} piece${fall.length > 1 ? 's' : ''}: press again, or hold <span class="kbd">X</span>, to take it down`);
  }
  takeOff(p) { this.remove(p, true); this.recompute(); this.g.sound?.('break', { at: p.pos }); }
  flash(list, now) { const k = 0.5 + 0.5 * Math.sin(now * 0.012); for (const p of list) for (const m of p.mats) { m.emissive.setHex(0xff2010); m.emissiveIntensity = 0.25 + 0.5 * k; } }
  // ---- per frame
  update(dt) {
    const g = this.g, hammer = g.equippedTool('build');
    if (hammer !== this.tint) this.updateTint();
    if (!hammer && this.ghost) { this.ghost.visible = false; this.preview(null); }
    if (hammer && !input.uiOpen && !g.player.dead) {
      if (input.clicks.includes(2)) { g.buildMenu.toggle(true); input.clicks.length = 0; return; }
      if (this.sel) {
        const step = this.aligned ? Math.PI / 2 : Math.PI / 8;   // quarter turns against a structure, finer on open ground
        if (hit('KeyR')) this.rot += step;
        if (input.wheel) { this.rot += input.wheel * step; input.wheel = 0; }
        if (hit('Escape')) { this.sel = null; if (this.ghost) this.g.scene.remove(this.ghost); this.ghost = null; this.preview(null); }
      }
      const target = this.aim(), tp = target?.piece;
      this.takeDown(tp, dt);   // (MMB or X)
      if (this.sel === 'repair') {
        g.hud.prompt(tp ? 'LMB' : null, tp ? `Repair ${tp.def.name}` : '', tp ? `${Math.ceil(tp.hp)} / ${tp.def.hp}` : '');
        if (tp && input.clicks.includes(0)) { if (tp.hp < tp.def.hp) { tp.hp = tp.def.hp; burst(target.p, { color: 0xffe0a0, n: 8, speed: 1.5, grav: -1 }); g.sound?.('repair'); } else g.hud.toast('Not damaged'); }
      } else if (this.sel && this.ghost) {
        const r = this.placeGhost();
        if (r) { const s = this.lastSup; g.hud.prompt('LMB', r.why || `Place ${this.ghostDef.name}`, r.why ? '' : Object.entries(this.ghostDef.mats).map(([m, n]) => `${n} ${ITEMS[m].name.toLowerCase()}`).join(', ') + (s && !s.grounded ? ` · held up ${Math.round(s.s * 100)}%` : '')); }
        if (r && !r.why && input.clicks.includes(0)) {
          if (!g.S.freeBuild) g.inv.takeMats(this.ghostDef.mats);
          const p = this.place(this.ghostDef.id, r.pos, r.rot); dust(p.pos.clone().setY(p.pos.y + 0.2), 8, 0xb8a684, 0.3); addShake(0.08); g.sound?.('build', { at: p.pos }); if (p.def.fire) g.sound?.('fireStart', { at: p.pos }); g.acts?.hammer(p.pos);   // (a campfire is lit as it's laid)
          if (!g.inv.has(this.ghostDef.mats) && !g.S.freeBuild) g.hud.toast(`Out of materials for ${this.ghostDef.name.toLowerCase()}`);
        }
      } else if (tp) { const n = this.wouldFall(tp).length; g.hud.prompt('MMB', this.arm?.p === tp ? `Again to take it down: ${n} more will fall` : `Remove ${tp.def.name}`, `${Math.ceil(tp.hp)} / ${tp.def.hp}${n ? ` · holds up ${n}` : ''}`); }
    }
    // doors swing, fires burn (and go out in the rain if nothing covers them), food cooks
    const lights = [], heated = new Set();   // cooking stands over a lit fire this frame (each cooks once, however many fires)
    for (const p of this.placed) {
      if (p.def.door && p.targetA !== undefined) p.inner.rotation.y += (p.targetA - p.inner.rotation.y) * Math.min(1, dt * 8);
      if ((p.def.fire || p.def.torch) && p.state.lit) {
        p.state.fuel -= dt / (p.def.hearth ? 360 : p.def.fire ? 240 : 600);   // (a hearth's banked fire burns each log a half longer, and the rain doesn't reach it)
        const wet = !p.def.hearth && g.weatherRain?.() > 0.3 && !this.sheltered(p.pos.clone().setY(p.pos.y + 0.5), 0.8);
        p.state.rainT = wet ? (p.state.rainT || 0) + dt : 0;
        if (p.state.fuel <= 0 || p.state.rainT > 8 + (p.uid.length % 5)) { p.state.lit = false; p.flame.visible = false; dust(p.pos.clone().setY(p.pos.y + 0.5), 10, 0x777777, 0.4); if (p.state.rainT > 8) { g.nearMsg?.(p.pos, 'The rain put the fire out'); g.sound?.('douse', { at: p.pos }); } }
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
    // (a piece done lets go a puff of steam, and the stand sizzles once however many came done together, sound.js cooked:
    // you hear it's ready from across the camp)
    // (and one left on as long again burns: dark smoke, and word of it if you're near)
    for (const q of heated) { let ch = false; q.state.cook.forEach((c, i) => { const was = c.t >= c.need, char = this.burnt(c); c.t += dt; const at = () => q.obj.localToWorld(new THREE.Vector3(-0.4 + i * 0.4, 1.02, 0)); if (!was && c.t >= c.need) { ch = true; dust(at(), 7, 0xe8e4dc, 0.22); } if (!char && this.burnt(c)) { dust(at(), 10, 0x2a2622, 0.3); g.nearMsg?.(q.pos, 'The meat on the stand has burnt'); } else if (c.t > c.need * 1.5 && !char && Math.random() < dt * 4) dust(at(), 1, 0x4a443e, 0.2); }); if (ch) g.sound?.('cooked', { at: q.obj.localToWorld(new THREE.Vector3(0, 0.95, 0)) }); }
    // the rings over the meat on a stand you stand by; the colours of all that cook
    const ringed = new Set(); for (const q of this.near(g.player.pos.x, g.player.pos.z, 5)) if (q.def.cook && q.state.cook.length && q.pos.distanceTo(g.player.pos) < 5) ringed.add(q);
    for (const q of new Set([...heated, ...ringed, ...(this.ringed || [])])) this.tintCook(q, ringed.has(q)); this.ringed = ringed;
    // light from the shared pool (the nearest fires get it, the nearest of all casting shadows: render/lights.js); a fire
    // bright close by and falling off fast (decay 2), so the camp round it is lit warm and the night beyond stays night
    for (const p of lights) { const fl = 1 + Math.sin(performance.now() * 0.013 + p.pos.x) * 0.1 + Math.random() * 0.06; askLight(p.lightPos ||= p.pos.clone().setY(p.pos.y + (p.def.fire ? 1 : 1.8)), (p.def.fire ? 80 : 9) * fl * Math.min(1, 0.4 + p.state.fuel / 3), p.def.fire ? 18 : 12, undefined, p.def.fire ? 2 : 1.6); }
    if (this.chest && !input.uiOpen) this.closeChest();
  }
  toJSON() { return this.placed.map((p) => ({ uid: p.uid, id: p.id, x: p.pos.x, y: p.pos.y, z: p.pos.z, rot: p.rot, hp: p.hp, state: { ...p.state, slots: p.inv?.slots } })); }
  // A save loading: every piece in first, then the ground shaped to them all and their support worked out once (placed one
  // by one, a piece saved before what now holds it up fell for good as it loaded, and each one redid the whole base: 4.7 s
  // for 400 pieces). Pieces of a kind no longer built are left out, and the ids go on from the highest in use, so a new
  // piece never takes the id (its colliders, its ground) of one that stands
  load(list) {
    const num = (u) => +String(u).replace(/^pc/, '') || 0, used = new Set(this.placed.map((p) => p.uid)), mine = [];
    this.seq = 1 + Math.max(this.seq - 1, ...list.map((o) => num(o.uid)), ...this.placed.map((p) => num(p.uid)));
    for (const o of list) { const uid = o.uid && !used.has(o.uid) ? o.uid : 'pc' + this.seq++; used.add(uid); const p = this.place(o.id, new THREE.Vector3(o.x, o.y, o.z), o.rot, { uid, hp: o.hp, state: o.state, defer: true }); if (p) mine.push(p); }
    for (const p of mine) this.shape(p);
    this.recompute({ full: true, hold: true });
  }
}
