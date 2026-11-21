// Gathering from the world. Trees take axe blows until they topple, crash down and leave a log; chop the log into wood.
// Bushes, and the stumps, fallen logs and driftwood lying about, are cut up for wood where they stand. Rocks and boulders
// give stone (and lightstone in the Yleos hills) to a pickaxe. Olive, pomegranate and oak trees can be picked for fruit
// once a day, and the meadows' tomato bushes for tomatoes, which grow back in a day. Every blow that lands is felt
// (Valheim's way, tester 14 Nov): the camera kicks by how hard it was (render/fx.js punch), heavy ones hold the swing a
// moment (player.hitStop), and chips, splinters, stone, sparks or leaves fly by what was struck; the wrong tool only clinks.
// A felled tree falls with its own weight and leaves a log that rolls down the slopes (Timber, below).
import * as THREE from 'three';
import { SPECIES, STRIDE, CELL } from '../world/flora.js';
import { biomeWeights, hash2, WORLD } from '../world/gen.js';
import { groundAt } from '../world/groundcut.js';
import { burst, dust, addShake, punch, impact, spark } from '../render/fx.js';
import { camera } from '../render/core.js';
import { THUNDER } from '../audio/sound.js';
import { SETTINGS } from '../ui/settings.js';
import { trunkMat } from '../world/trees.js';
import { clearGrass } from '../world/grass.js';
import { clamp, smooth } from '../util/math.js';
import { loadPack, bake } from '../assets.js';
import { wettable } from '../world/wetness.js';

// Tree toughness and what it gives, by species
const BIG = new Set(['oak', 'plane', 'holm']), SMALL = new Set(['pomegranate', 'fig', 'cypress']);
const TREE_DROPS = {
  olive: [['oliveSeed', 0.5, 1, 2]], oak: [['acornSeed', 0.5, 1, 2]], pomegranate: [['pomegranateSeed', 0.5, 1, 2]],
  qpine: [['resin', 0.8, 1, 2], ['pineCone', 0.5, 1, 1]], fir: [['resin', 0.8, 1, 2], ['firCone', 0.5, 1, 1]], cypress: [['resin', 0.5, 1, 1]],
  qtree: [['feather', 0.3, 1, 2]], plane: [['feather', 0.4, 1, 2]], holm: [['acornSeed', 0.3, 1, 1]],
};
const FRUIT = { olive: ['olive', 3, 5], pomegranate: ['pomegranate', 2, 3], oak: ['acorn', 2, 4] };
// How thick a felled tree's trunk really is: the solid model's points between 0.6 and 1.6 m above the ground (in its own
// units at this scale), their middle distance from the trunk's axis; the log it leaves and its stump take that girth
// (before, both came from the collider, about the same for every tree)
function trunkRadius(geo, s) {
  const p = geo.attributes.position, lo = 0.6 / s, hi = 1.6 / s, xs = [], zs = []; let cx = 0, cz = 0;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i); if (y > lo && y < hi) { xs.push(p.getX(i)); zs.push(p.getZ(i)); cx += p.getX(i); cz += p.getZ(i); } }
  if (xs.length < 6) return null;
  cx /= xs.length; cz /= xs.length; const d = xs.map((x, i) => Math.hypot(x - cx, zs[i] - cz)).sort((a, b) => a - b);
  return d[Math.floor(d.length / 2)] * s;
}
const treeHP = (name, s) => (name === 'titan' ? 420 : BIG.has(name) ? 110 : SMALL.has(name) ? 40 : 70) * s;   // (a giant of the old forest takes a long while)
const woodOf = (name, s) => Math.round((BIG.has(name) ? 9 : SMALL.has(name) ? 3 : 6) * s);
const rockHP = (name, s) => (name === 'boulder' ? 70 : 30) * s;
// Bushes and the woody things on the ground an axe cuts up for wood (tester, 14 Nov: "hit them a few times, then collect
// some wood"). A shrub takes blows by its height (under BUSH_H[0] two and one wood, under BUSH_H[1] three and two, taller
// four and three), the broom's whippy stems and the leafy bushes giving a little fiber too; the forest floor's stumps
// and fallen logs and the shore's driftwood are wood through and through, and a tomato bush's woody stems give a good
// armful (6 to 8, the design's numbers; Patch 20). The small plants (lavender, ferns, flowers, tall grass, moss, reeds)
// are left alone. Each is found by the blow among its near cell's items (most have no collider: you walk through bushes)
// and removed through the vegetation, so a save remembers it as it does a tree.
const WOODY = {
  bush: { leafy: true, extra: [['fiber', 0.35, 1, 1]] }, myrtle: { leafy: true }, broom: { leafy: true, extra: [['fiber', 0.6, 1, 2]] }, redbush: { leafy: true, extra: [['fiber', 0.25, 1, 1]] },
  stump: { hits: 4, wood: 2 }, log: { hits: 5, wood: 3 }, driftwood: { hits: 3, wood: 2 }, tomato: { leafy: true, hits: 3, wood: [6, 8] },
};
// A felled tree's stump: three blows of an axe, one or two wood
const STUMP = { hits: 3, wood: [1, 2] };
// A tomato bush picked bare grows its fruit back in a game day; picking gives 8 to 12 tomatoes and now and then a seed
const TOMATO = { regrow: 1, n: [8, 12], seed: 0.25 };
const WOODY_SP = SPECIES.map((s) => WOODY[s.name] || null), BUSH_H = [0.9, 1.6], SP_TOMATO = SPECIES.findIndex((s) => s.name === 'tomato');
// how far along a blow (from x, z the way dx, dz) a circle of radius r centred ox, oz from it is met, or null if it is missed
const along = (ox, oz, r, dx, dz) => { const t = ox * dx + oz * dz; if (t < -r) return null; const px = ox - dx * t, pz = oz - dz * t, d2 = px * px + pz * pz, rr = (r + 0.35) ** 2; return d2 > rr ? null : Math.max(0, t - Math.sqrt(rr - d2)); };
// The log a felled tree leaves: one of the packs' fallen trunks (tools/assets, pLog…), turned to lie along x and centred,
// then stretched to the log's own length and girth, so its colliders and the grass cleared round it stay as they were.
// Which one from a hash of where the tree stood; the carved cylinder stands in without the pack. (Only the two cut
// trunks: the others are fallen trees with their root plates, or pale swamp logs, which squashed to a log's girth came
// out as flat wedges and grey tangles.)
const LOGS = ['pLog2', 'pLog3'], LOOKS = [];
const logMat = wettable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { dark: 0.66, gloss: 0.3 });
LOGS.forEach((f, i) => loadPack(f).then((gl) => {
  const g = bake(gl.scene, true); g.computeBoundingBox(); let s = g.boundingBox.getSize(new THREE.Vector3()); if (s.z > s.x) g.rotateY(Math.PI / 2);
  g.computeBoundingBox(); const c = g.boundingBox.getCenter(new THREE.Vector3()); g.translate(-c.x, -c.y, -c.z); g.computeBoundingBox(); s = g.boundingBox.getSize(new THREE.Vector3());
  const col = g.attributes.color; for (let k = 0; k < col.array.length; k++) col.array[k] *= 0.82;   // (the packs' palettes come out pale in our light)
  LOOKS[i] = { g, s };
}).catch(() => {}));

// ---- Timber (tester, 20 Nov: "physics on the trees"). A felled tree turns on its stump's cut (CUT above the ground) the
// way the last blow sent it, as a pole falls from its foot: slow to start and quicker as it leans, gravity's pull the
// weaker the taller the tree, a little air drag on the crown (FALL). It stops where some part of it meets the ground
// (sampled along the trunk with groundAt), a rock, a wall or another tree (fallHit), jolting back a little off a hard
// landing; its trunk thickens into the crown towards the top (clear), so a crown lands in a neighbour's branches and not
// only the bare trunk against its bark. Meeting another tree it leans on it, unless it is the bigger of the two by a fifth
// in trunk (girth squared times height, size), when it breaks that one too and both come down; the second can never
// break a third (chain). Once still, the crown breaks up and the trunk is left as a log that rolls on from there.
const GRAV = 9.8, CUT = 0.35;
const FALL = { push: 0.3, k: 1.1, drag: 0.08, max: 2.2, step: 0.025, hold: 1, lean: 2, bigger: 1.2 };
const size = (t) => t.girth * t.girth * t.tall;
// A log is a rigid round trunk: its two ends are points held a length apart, each a radius off whatever it touches (the
// ground at points all along it, the round colliders of trunks, rocks, posts and walls, the stumps, the other logs),
// moved in substeps short enough that a fast log can't pass through a thin trunk (position-based, as games do it).
// Across its length it rolls: two thirds of gravity's pull down the slope (the rest goes into spinning it, as for any solid
// cylinder) against a little rolling resistance, so it stays put on gentle ground (under about 10°: roll) but once going
// rolls on down to about 6° (rolling) and gathers speed on steeper ground; along its length it slides only where the
// ground falls more steeply than its friction holds (about 31°). It bounces a little off a hard knock and glances off
// what it strikes at an angle (only the end that strikes is stopped); it floats where it reaches the sea. Still for a
// moment, it sleeps (no more work) and is the splittable log there.
const ROLL = { mu: 0.6, roll: 0.12, rolling: 0.07, bounce: 0.22, wall: 0.3, wallMu: 0.3, sleepV: 0.06, sleepT: 0.5, maxV: 16, maxStep: 0.1, iters: 3, life: 45, pop: 1.2, hurt: 2.2 };
const GROUND = { ground: true };   // (what fallHit returns for the ground)
const _a = new THREE.Vector3(), _c = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3(), _n = new THREE.Vector3(), _q = new THREE.Vector3(), _t = new THREE.Vector3(), _Q = new THREE.Quaternion(), X = new THREE.Vector3(1, 0, 0);
const shrink = (x, d) => (x > d ? x - d : x < -d ? x + d : 0);   // (friction: takes up to d off a speed, never past naught)
// the ground under x, z: its height and slope, into out (h, the height; sx, sz, how it rises per metre along x and z;
// water: true where the land lies under the sea, whose face, a little up the log, stands in: it floats)
function floorAt(x, z, R, out) {
  const h = groundAt(x, z), sea = WORLD.SEA - R * 0.6, e = 0.4; out.water = h < sea;
  if (out.water) { out.h = sea; out.sx = out.sz = 0; return out; }
  out.h = h; out.sx = (groundAt(x + e, z) - h) / e; out.sz = (groundAt(x, z + e) - h) / e; return out;
}
// push a log's ends a, b so its point u of the way along moves d along n (each end by its share: the nearer end more)
function push(a, b, u, n, d) { const wa = 1 - u, wb = u, s = d / (wa * wa + wb * wb); a.addScaledVector(n, wa * s); b.addScaledVector(n, wb * s); }
// How deep a log (ends a, b, radius R) sinks into an upright round thing (centre ox, oz, radius r, from y0 up to y1), the
// way out into n and the point along the log in HIT.u; -Infinity if it's clear. A low one (a stone, a stump) it can ride
// up and over, a tall one (a trunk, a wall) only push it aside
const HIT = { u: 0 };
function column(a, b, R, ox, oz, r, y0, y1, n) {
  const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz, u = l2 > 1e-6 ? clamp(((ox - a.x) * abx + (oz - a.z) * abz) / l2, 0, 1) : 0.5; HIT.u = u;
  const qx = a.x + abx * u, qy = a.y + (b.y - a.y) * u, qz = a.z + abz * u, dx = qx - ox, dz = qz - oz, d = Math.hypot(dx, dz);
  if (d > r + R) return -Infinity;
  if (qy >= y0 && qy <= y1) {
    const side = r + R - d, up = y1 + R - qy;
    if (up < side) { n.set(0, 1, 0); return up; }
    if (d > 1e-4) n.set(dx / d, 0, dz / d); else n.set(-abz, 0, abx).normalize();
    return side;
  }
  const k = d > r ? r / d : 1, py = qy > y1 ? y1 : y0; n.set(dx - dx * k, qy - py, dz - dz * k); const l = n.length();   // (above or below it: against its rim)
  if (l >= R) return -Infinity; if (l > 1e-5) n.divideScalar(l); else n.set(0, 1, 0);
  return R - l;
}
// the nearest points of two segments (p1-q1, p2-q2), as fractions along each, into SS (Ericson, Real-Time Collision Detection 5.1.9)
const SS = [0, 0], _d1 = new THREE.Vector3(), _d2 = new THREE.Vector3(), _r = new THREE.Vector3();
function segSeg(p1, q1, p2, q2) {
  _d1.subVectors(q1, p1); _d2.subVectors(q2, p2); _r.subVectors(p1, p2);
  const a = _d1.dot(_d1), e = _d2.dot(_d2), f = _d2.dot(_r); let s = 0, t = 0;
  if (a <= 1e-8 && e <= 1e-8) { SS[0] = SS[1] = 0; return; }
  if (a <= 1e-8) t = clamp(f / e, 0, 1);
  else { const c = _d1.dot(_r); if (e <= 1e-8) s = clamp(-c / a, 0, 1); else { const b = _d1.dot(_d2), dn = a * e - b * b; s = dn > 1e-8 ? clamp((b * f - c * e) / dn, 0, 1) : 0; t = (b * s + f) / e; if (t < 0) { t = 0; s = clamp(-c / a, 0, 1); } else if (t > 1) { t = 1; s = clamp((b - c) / a, 0, 1); } } }
  SS[0] = s; SS[1] = t;
}
// The logs' own sounds, made here (none of the recordings is a log rolling): a rumble of low brown noise for each log
// rolling, louder and brighter the faster it goes, and a deep wooden thud when it lands or strikes something. Placed as
// the game's other sounds are, by distance from the camera and to its side, under the effects slider.
const SND = { buf: null };
function audio() { const c = THUNDER.ctx(); return c && c.state === 'running' && THUNDER.out() ? c : null; }
function heard(at, near, far) {
  const p = camera.position, dx = at.x - p.x, dz = at.z - p.z, d = Math.hypot(dx, at.y - p.y, dz), h = Math.hypot(dx, dz) || 1, m = camera.matrixWorld.elements, rl = Math.hypot(m[0], m[2]) || 1;
  const k = clamp(1 - Math.max(0, d - near) / (far - near), 0, 1);
  return { k: k * k * (SETTINGS.sfx ?? 1), pan: clamp(((dx * m[0] + dz * m[2]) / rl / h) * Math.min(1, d / 2), -0.85, 0.85) };
}
function brown(c) {
  if (SND.buf?.sampleRate === c.sampleRate) return SND.buf;
  const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); let last = 0;
  for (let i = 0; i < n; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
  return (SND.buf = b);
}
function logThud(at, k) {
  const c = audio(); if (!c) return; const s = heard(at, 6, 80), v = Math.min(1.2, k) * s.k; if (v < 0.01) return;
    if (c.ref.stump) return this.hitStump(c.ref.stump, item, at, dir);
  const t = c.currentTime, p = c.createStereoPanner(); p.pan.value = s.pan; p.connect(THUNDER.out());
  const o = c.createOscillator(), og = c.createGain(); o.frequency.setValueAtTime(78, t); o.frequency.exponentialRampToValueAtTime(34, t + 0.4);
  og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.45 * v, t + 0.008); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.5); o.connect(og).connect(p); o.start(t); o.stop(t + 0.55);
  for (const [type, f, q, vol, dur] of [['lowpass', 300, 0.7, 0.55, 0.45], ['bandpass', 620, 2.2, 0.22, 0.09]]) {   // (the body of the blow, and the knock of wood in it)
    const n = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain(); n.buffer = brown(c); n.playbackRate.value = 0.9 + Math.random() * 0.2; fl.type = type; fl.frequency.value = f * (0.9 + Math.random() * 0.2); fl.Q.value = q;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * v, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); n.connect(fl).connect(g).connect(p); n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }
}
class Rumble {
  constructor(c) {
    this.c = c; this.src = c.createBufferSource(); this.src.buffer = brown(c); this.src.loop = true; this.f = c.createBiquadFilter(); this.f.type = 'lowpass'; this.f.Q.value = 0.8;
    this.g = c.createGain(); this.g.gain.value = 0; this.p = c.createStereoPanner(); this.src.connect(this.f).connect(this.g).connect(this.p).connect(THUNDER.out()); this.src.start(c.currentTime, Math.random());
  }
  // how loud (by how fast it rolls, k 0..1, and how big it is) and from where
  set(at, k, big) { const s = heard(at, 6, 70), t = this.c.currentTime; this.g.gain.setTargetAtTime(0.5 * k * big * s.k, t, 0.08); this.f.frequency.setTargetAtTime(90 + 260 * k, t, 0.1); this.p.pan.setTargetAtTime(s.pan, t, 0.05); }
  stop() { const t = this.c.currentTime; this.g.gain.setTargetAtTime(0, t, 0.12); this.src.stop(t + 0.8); }
}

export class Harvest {
  constructor(g) {
    this.g = g; this.hp = new Map(); this.picked = new Map(); this.falling = []; this.logs = []; this.seq = 0; this.stumps = []; this.trees = new Map(); this.dressT = 0;
    this.bare = new Map(); this.bareT = 0;   // (the tomato bushes picked: "cx,cz,i" → when, in days)
    this.stumpMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 1, 0.5, 9).translate(0, 0.15, 0), trunkMat, 512); this.stumpMesh.count = 0;
    this.stumpMesh.castShadow = this.stumpMesh.receiveShadow = true; this.stumpMesh.frustumCulled = false; g.scene.add(this.stumpMesh);
  }
  // A strike landed (from player.onStrike): find what's in front and hit it with the held item
  strike(item) {
    const P = this.g.player, dir = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    // (a tree, rock, log or stump: never one of the layout's empty slots, drawn at no size, review: felled from thin air)
    const c = this.g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, 2.3, (c) => c.ref && ((c.ref.sp !== undefined && !WOODY_SP[c.ref.sp] && c.ref.s > 0) || c.ref.log || c.ref.stump)), w = this.woodyAhead(P.pos, dir, 2.3);
    if (w && (!c || w.t <= (along(c.x - P.pos.x, c.z - P.pos.z, c.r, dir.x, dir.z) ?? Infinity))) return this.hitWoody(w, item, dir);   // (whichever the blow meets first)
    if (!c) return false;
    const at = new THREE.Vector3(c.x - dir.x * c.r * 0.9, P.pos.y + 1.1, c.z - dir.z * c.r * 0.9);
    if (c.ref.log) return this.hitLog(c, item, at);
    const sp = SPECIES[c.ref.sp];
    if (sp.res === 'tree') return this.hitTree(c, sp, item, at, dir);
    if (sp.res === 'rock') return this.hitRock(c, sp, item, at, dir);
    return false;
  }
  // (a toast for the wrong tool, once in a while; a blow with it only clinks, and the strike says so, 'clink', so the tool
  // isn't worn by it: game.js)
  warn(key, msg) { if (this[key]) return; this.g.hud.toast(msg); this[key] = true; setTimeout(() => (this[key] = false), 6000); }
  dmg(item, kind) { const d = item?.dmg?.find(([, k]) => k === kind)?.[0] ?? 0; return d; }
  hitTree(c, sp, item, at, dir) {
    const { player } = this.g, id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`;
    if (!item?.chop) { burst(at, { color: 0x7a5236, n: 3, speed: 1.5 }); punch(0.07, dir); this.g.sound?.('clink', true); this.warn('warned', 'You need an <b>axe</b> to fell trees'); return 'clink'; }
    const max = treeHP(sp.name, c.ref.s), hp = (this.hp.get(id) ?? max) - this.dmg(item, 'slash') * player.stats.damageK('axe');
    player.stats.train('axe', 12.5);
    // (a sapling's blow is a light one, a great trunk's a heavy one that holds the swing; it rings lower too)
    const size = Math.min(2, max / 70), k = clamp(0.16 + 0.1 * size, 0.18, 0.36);
    impact(at, 'wood', k); punch(k, dir); if (size > 1.2) player.hitStop(0.04);
    this.g.sound?.('chop', 1.25 - 0.15 * size);
    this.wobble(c, dir);
    if (hp > 0) { this.hp.set(id, hp); return true; }
    this.hp.delete(id); this.fell(c, sp, dir); return true;
  }
  // the tree shakes with every blow, its crown swaying away from you (vegetation.js shake)
  wobble(c, dir) { this.g.veg.shake(c.ref.cx, c.ref.cz, c.ref.i, dir.x, dir.z); }
  // The last blow: the tree comes away from its stump and falls (topple). o.chain: knocked down by another falling tree,
  // so it can't knock down another itself (and isn't the player's doing: no skill, no kick); o.w: how fast it starts to turn
  fell(c, sp, dir, o = {}) {
    const { veg, colliders, player } = this.g, r = c.ref;
    veg.remove(r.cx, r.cz, r.i); colliders.removeOne(c); this.hp.delete(`${r.cx},${r.cz},${r.i}`);
    const v = veg.near.get(r.cx + ',' + r.cz)?.items, k = r.i * STRIDE, T = this.treeSize(r);
    const obj = veg.single(r.sp, v ? v[k + 1] : 0); obj.rotation.y = v ? v[k + 5] : 0; obj.scale.setScalar(r.s); obj.position.y = -CUT;
    const pivot = new THREE.Group(); pivot.position.set(c.x, c.y + CUT, c.z); pivot.add(obj); this.g.scene.add(pivot);
    const l = Math.hypot(dir.x, dir.z) || 1, dx = dir.x / l, dz = dir.z / l;   // (away from the blow)
    const f = { pivot, obj, sp, s: r.s, th: 0, w: o.w ?? 0.18, dx, dz, axis: new THREE.Vector3(dz, 0, -dx), t: 0, state: 'fall', x: c.x, y: c.y, z: c.z, ...T, chain: !!o.chain, broke: false, met: new Set() };
    f.obs = this.fallObstacles(f); this.falling.push(f); this.addStump(c.x, c.y, c.z, T.girth);
    if (o.chain) return f;
    player.stats.train('gathering', 12.5); this.g.sound?.('creak'); punch(0.35, dir); player.hitStop(0.08);   // (the last blow goes through: a heavier kick)
    return f;
  }
  // The size of a standing tree (ref: its collider's) from its model as drawn: the trunk's girth, its height, how far its
  // crown reaches out and how deep it stands sunk into the ground (cached by species, look and scale)
  treeSize(ref) {
    const it = this.g.veg.near.get(ref.cx + ',' + ref.cz)?.items, v = it ? it[ref.i * STRIDE + 1] : 0, key = ref.sp * 16 + v + ':' + ref.s.toFixed(3);
    let z = this.trees.get(key); if (z) return z;
    const P = this.g.veg.geoFor(ref.sp, v), geo = P.geo, s = ref.s; if (!geo.boundingBox) geo.computeBoundingBox();
    const b = geo.boundingBox.clone(); if (P.cards) { if (!P.cards.boundingBox) P.cards.computeBoundingBox(); b.union(P.cards.boundingBox); }
    const S = b.getSize(new THREE.Vector3());
    z = { girth: clamp(trunkRadius(geo, s) ?? SPECIES[ref.sp].col * s * 0.55, 0.12, 1.5), tall: geo.boundingBox.max.y * s, crown: ((S.x + S.z) / 4) * s, sink: Math.max(0, -geo.boundingBox.min.y) * s };
    this.trees.set(key, z); return z;
  }
  // What a falling tree might meet: the colliders ahead of it within its height and near its line (other trees', rocks',
  // walls', logs') and the stumps, each as how far along the line it stands (t), how far to the side (e), how wide it is
  // and from what height to what height it stands
  fallObstacles(f) {
    const out = [], reach = f.tall + 1, side = f.girth + f.crown * 0.3;
    const add = (c, x, z, r, y0, y1, tree) => { const ox = x - f.x, oz = z - f.z, t = ox * f.dx + oz * f.dz, e = ox * f.dz - oz * f.dx; if (t > 0.3 && t < reach + r && Math.abs(e) < r + side) out.push({ c, t, e, r, y0, y1, tree }); };
    for (const c of this.g.colliders.near(f.x + (f.dx * reach) / 2, f.z + (f.dz * reach) / 2, reach / 2 + 2)) {
      const tree = c.ref?.cx !== undefined && SPECIES[c.ref.sp]?.res === 'tree';
      add(c, c.x, c.z, c.r, c.y ?? -1e9, c.h !== undefined ? (c.y ?? 0) + c.h : tree ? c.y + this.treeSize(c.ref).tall : 1e9, tree);
    }
    return out;
  }
  // how far out from its axis the falling tree f reaches s metres up it: its trunk, then into the crown (k: how much of
  // the crown counts; branches give, so only some)
  clear(f, s, k) { return f.girth + f.crown * k * smooth(0.4 * f.tall, f.tall, s); }
  // what the falling tree f, turned th from upright, would be into: the GROUND, one of its obstacles, or nothing (null)
  fallHit(f, th) {
    const sn = Math.sin(th), cs = Math.cos(th), L = f.tall * 0.92, y = f.y + CUT;
    for (let s = 1; s <= L; s += 0.7) if (y + s * cs - this.clear(f, s, 0.4) < groundAt(f.x + f.dx * s * sn, f.z + f.dz * s * sn)) return GROUND;
    for (const o of f.obs) {
      if (o.gone) continue; const tt = clamp(o.t, 0, L * sn), D = Math.hypot(o.t - tt, o.e), s = sn > 1e-3 ? Math.min(L, tt / sn) : 0, rho = this.clear(f, s, 0.25);
      if (D >= o.r + rho) continue; const h = y + s * cs; if (h - rho < o.y1 && h + rho > o.y0) return o;
    }
    return null;
  }
  // A felled tree on its way down, each frame: turning faster as it leans, in steps short enough not to pass through a
  // thin trunk, until something stops it (land: found to within a fraction of a degree); then lying, or leaning, a moment
  // before its crown breaks up and its trunk is left as a log. True when it's done
  topple(f, dt) {
    f.t += dt;
    if (f.state === 'fall') {
      const n = Math.max(1, Math.ceil((Math.abs(f.w) * dt) / FALL.step)), h = dt / n;
      for (let k = 0; k < n && f.state === 'fall'; k++) {
        f.w += (FALL.push + ((FALL.k * GRAV) / Math.max(5, f.tall)) * Math.sin(f.th) - FALL.drag * f.w * Math.abs(f.w)) * h;
        const th = clamp(f.th + f.w * h, 0, FALL.max);
        if (f.w <= 0) { f.th = th; continue; }   // (jolted back off what it struck: nothing in its way going up)
        const hit = this.fallHit(f, th); if (!hit) { f.th = th; if (th >= FALL.max) this.land(f, GROUND); continue; }
        let lo = f.th, hi = th, got = hit; for (let i = 0; i < 7; i++) { const m = (lo + hi) / 2, x = this.fallHit(f, m); if (x) { hi = m; got = x; } else lo = m; }
        f.th = lo; this.land(f, got);
      }
    } else if (f.state === 'lean' && f.on.c && !this.live(f.on.c)) { f.state = 'fall'; f.w = 0.2; f.on.gone = true; }   // (what it leant on is gone: on down)
    else if (f.t > (f.state === 'lean' ? FALL.lean : FALL.hold)) {
      f.pivot.scale.multiplyScalar(1 - dt * 3); f.pivot.position.y -= dt * 1.5;   // (the crown breaks up)
      if (f.t > (f.state === 'lean' ? FALL.lean : FALL.hold) + 0.5) {
        this.g.veg.dropSingle(f.pivot); this.spawnLog(f);   // (its instance buffers freed: vegetation.js)
        const sn = Math.sin(f.th), m = f.tall * 0.55; dust(new THREE.Vector3(f.x + f.dx * m * sn, f.y + 0.5 + Math.max(0, Math.cos(f.th)) * m, f.z + f.dz * m * sn), 18, 0x6f8a46, 0.45);
        return true;
      }
    }
    f.pivot.rotation.set(0, 0, 0); f.pivot.rotateOnWorldAxis(f.axis, f.th);
    // (a tree stands sunk into the ground to hide its roots, flora-pack.js, and its model reaches down below the cut:
    // falling, it slides out along its length until its foot is at the cut, so the buried part doesn't swing up behind)
    f.obj.position.y = -CUT + (f.sink + CUT) * smooth(0.3, 1.2, f.th);
    return false;
  }
  // The falling tree f has met the ground or the obstacle hit: a crash the first time (dust, the crash, a kick of the
  // view by how near you stand), then it jolts back off a hard knock or comes to rest, on the ground or leaning on it.
  // Another tree it breaks instead if it is the bigger by a fifth (FALL.bigger, size), and not itself knocked down
  land(f, hit) {
    const sn = Math.sin(f.th), cs = Math.cos(f.th), P = this.g.player.pos;
    if (hit !== GROUND && hit.tree && !f.chain && !f.broke && size(f) > FALL.bigger * size(this.treeSize(hit.c.ref))) { this.collapse(f, hit); return; }
    if (!f.met.has(hit)) {
      f.met.add(hit);
      const s = hit === GROUND ? f.tall * 0.6 : clamp(hit.t / Math.max(sn, 0.05), 1, f.tall), at = new THREE.Vector3(f.x + f.dx * s * sn, f.y + CUT + s * cs, f.z + f.dz * s * sn), big = clamp(f.s * (BIG.has(f.sp.name) || f.sp.name === 'titan' ? 1.2 : 1), 0.6, 1.6);
      if (hit === GROUND) { at.y = groundAt(at.x, at.z) + 0.3; dust(at, 22, 0xa89a78, 0.5); dust(new THREE.Vector3(f.x, f.y + 0.3, f.z), 10); this.g.sound?.('treeFall', { at, big }); }
      else {   // (into another tree's crown, or onto a rock or a wall)
        this.g.sound?.('treeFall', { at, big: big * 0.7 }); impact(at, hit.tree ? 'leaves' : 'wood', 0.8);
        if (hit.tree) this.g.veg.shake(hit.c.ref.cx, hit.c.ref.cz, hit.c.ref.i, f.dx, f.dz, 4); else dust(at, 10, 0x9b958c, 0.4);
      }
      const near = clamp(1 - Math.hypot(at.x - P.x, at.z - P.z) / 30, 0, 1) * Math.min(1.3, big) * (hit === GROUND ? 1 : 0.5); punch(0.6 * near, { x: f.dx, z: f.dz }); addShake(0.25 * near);
    }
    if (f.w > 0.7) { f.w *= hit === GROUND ? -0.14 : -0.18; return; }
    f.w = 0; f.state = hit === GROUND ? 'down' : 'lean'; f.on = hit; f.t = 0;
  }
  // The falling tree f, the bigger, breaks the tree o it fell on: that one comes down too, pushed the way f fell and away
  // from it, and f falls on through, slowed. Only the one: neither can break another (chain, broke)
  collapse(f, o) {
    o.gone = true; f.broke = true; const c = this.live(o.c);
    if (!c) return;
    const bx = c.x - f.x, bz = c.z - f.z, bl = Math.hypot(bx, bz) || 1, sn = Math.sin(f.th), at = new THREE.Vector3(c.x, f.y + CUT + clamp(o.t / Math.max(sn, 0.05), 1, f.tall) * Math.cos(f.th), c.z);
    this.fell(c, SPECIES[c.ref.sp], { x: f.dx + bx / bl, z: f.dz + bz / bl }, { chain: true, w: Math.max(0.5, f.w * 0.9) });
    f.w *= 0.55;
    impact(at, 'wood', 1); impact(at, 'leaves', 1); this.g.sound?.('chop', 0.6); this.g.sound?.('creak');   // (the crack of it going)
    const P = this.g.player.pos; punch(0.3 * clamp(1 - Math.hypot(c.x - P.x, c.z - P.z) / 30, 0, 1), { x: f.dx, z: f.dz });
  }
  // The collider c as it is now, or null if what it belonged to is gone (a tree felled, a log split, a wall pulled down):
  // a tree's or a log's is made again when its cell streams back in or the log moves, so they're known by what they are
  live(c) {
    const P = this.g.player.pos; if (this.stumps.length > 512 && (!this.drawnAt || Math.hypot(P.x - this.drawnAt.x, P.z - this.drawnAt.z) > 32)) this.drawStumps();   // (the nearest 512 again, once you've come a way)
    const r = c.ref, { colliders, veg } = this.g;
    if (r?.log) return this.logs.includes(r.log) ? c : null;
    if (r?.cx === undefined) return colliders.groups.has(c.key) ? c : null;
    if (veg.removed.has(`${r.cx},${r.cz},${r.i}`)) return null;
    if (colliders.groups.get(c.key)?.includes(c)) return c;
    for (const k of colliders.near(c.x, c.z, 0.5)) if (k.ref?.cx === r.cx && k.ref.cz === r.cz && k.ref.i === r.i) return k;
    return null;
  }
  // A felled tree's stump. It stands in your way (a collider of its own, which logs and falling trees meet too), takes a
  // few blows of an axe for a little wood (Valheim's), and goes from under anything built over it (clearStumps, from
  // build.js: review, Nov, one stood up through a floor). The 512 nearest you are drawn
  addStump(x, y, z, r) {
    const s = { x, y, z, r, id: 'stump' + this.seq++ }; s.col = { x, z, r: r * 1.05, trunk: r * 1.05, y: y - 1, h: 1 + CUT, ref: { stump: s } };
    this.stumps.push(s); this.g.colliders?.addGroup(s.id, [s.col]); this.drawStumps(); clearGrass('stump' + x.toFixed(1) + z.toFixed(1), { x, z, r: r + 0.4 });
  }
  removeStump(s) { const i = this.stumps.indexOf(s); if (i < 0) return; this.stumps.splice(i, 1); this.g.colliders?.removeGroup(s.id); clearGrass('stump' + s.x.toFixed(1) + s.z.toFixed(1), null); this.drawStumps(); }
  clearStumps(under) { for (const s of [...this.stumps]) if (under(s.x, s.z, s.y)) this.removeStump(s); }
  hitStump(s, item, at, dir) {
    const { player } = this.g; at.y = s.y + 0.2;
    if (!item?.chop) { impact(at, 'dull'); punch(0.07, dir); this.g.sound?.('clink', true); this.warn('warned', 'Cut up a stump with an <b>axe</b>'); return 'clink'; }
    impact(at, 'wood', 0.4); punch(0.22, dir); player.hitStop(0.03); this.g.sound?.('chop', 1.1); player.stats.train('axe', 6);
    if ((s.hp = (s.hp ?? STUMP.hits) - 1) > 0) return true;
    this.removeStump(s); dust(new THREE.Vector3(s.x, s.y + 0.2, s.z), 10, 0x6e5e46, 0.3); impact(at, 'wood', 0.8);
    this.g.give('wood', Math.max(1, Math.round((STUMP.wood[0] + Math.floor(Math.random() * (STUMP.wood[1] - STUMP.wood[0] + 1))) * player.stats.skillK('gathering')))); player.stats.train('gathering', 6);
    return true;
  }
  drawStumps() {
    const P = this.g.player?.pos, m = new THREE.Matrix4(), d = (s) => (s.x - P.x) ** 2 + (s.z - P.z) ** 2;
    const near = this.stumps.length > 512 && P ? [...this.stumps].sort((a, b) => d(a) - d(b)).slice(0, 512) : this.stumps.slice(-512); this.drawnAt = P ? { x: P.x, z: P.z } : null;
    near.forEach((s, i) => this.stumpMesh.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y - 0.05, s.z), new THREE.Quaternion(), new THREE.Vector3(s.r * 1.1, 1, s.r * 1.1))));
    this.stumpMesh.count = near.length; this.stumpMesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    this.growBack(dt); dt = Math.min(dt, 0.05); if (!(dt > 0)) return;
    for (const l of this.logs) if (l.kick !== undefined && l.asleep) { l.kick += dt; l.mesh.position.y = l.y0 + 0.05 * Math.sin(l.kick * 45) * Math.exp(-l.kick * 14); if (l.kick > 0.4) { l.mesh.position.y = l.y0; delete l.kick; } }
    for (let i = this.falling.length - 1; i >= 0; i--) if (this.topple(this.falling[i], dt)) this.falling.splice(i, 1);
    this.roll(dt);
    if ((this.dressT -= dt) <= 0) { this.dressT = 1; if (LOOKS.some(Boolean)) for (const l of this.logs) if (l.carved) this.dress(l); }   // (the packs' logs came in after these were made)
  }
  // The log a fallen tree leaves: its trunk, as thick as it was and as long as the bare trunk of a tree that tall (about
  // two fifths of it), lying where the trunk lay; one that came to rest leaning leaves it standing at its foot, leaning
  // the same way, to topple, slide or stay as it may
  spawnLog(f) { return this.addLog({ ...this.logOf(f), awake: true }); }
  logOf(f) {
    const len = clamp(f.tall * 0.4, 2.2, 9), R = f.girth, sn = Math.sin(f.th), u = new THREE.Vector3(f.dx * sn, Math.cos(f.th), f.dz * sn), off = f.girth * 1.1 + R + 0.05, up = f.state === 'lean' && f.th < 1.2;
    const a = up ? new THREE.Vector3(f.x + f.dx * off, 0, f.z + f.dz * off) : new THREE.Vector3(f.x, f.y + CUT, f.z).addScaledVector(u, off); if (up) a.y = groundAt(a.x, a.z) + R;
    return { a, b: a.clone().addScaledVector(u, len), R, L: len, sp: f.sp.name, s: f.s, look: Math.floor(hash2(f.x * 7.1 + 3.1, f.z * 5.3 - 7.7) * LOGS.length) % LOGS.length, hp: 30 * f.s, wood: woodOf(f.sp.name, f.s) };
  }
  // A log in the world (d: its ends a, b; radius R, length L; sp, s, look, hp, wood; q, how its model is turned, from a
  // save; awake: moving, so its physics runs). Its colliders follow it (low: you can hop over), so it can be split even
  // as it rolls
  addLog(d) {
    const V = () => new THREE.Vector3(), log = { id: 'log' + this.seq++, R: d.R, L: d.L, sp: d.sp, s: d.s, look: d.look ?? 0, hp: d.hp, wood: d.wood, P: [d.a, d.b], V: [V(), V()], old: [V(), V()], pre: [V(), V()],
      G: [{ w: 0, n: V(), water: false }, { w: 0, n: V(), water: false }], walls: [], at: d.a.clone(), e: V().subVectors(d.b, d.a).normalize(), spin: 0, turn: 0, bang: 0, asleep: !d.awake, still: 0, life: 0, cd: new Map(), mesh: new THREE.Group(), cols: [], fx: 0 };
    this.dress(log);
    if (d.q) log.mesh.quaternion.fromArray(d.q); else log.mesh.quaternion.setFromUnitVectors(X, log.e);
    log.mesh.position.lerpVectors(d.a, d.b, 0.5); this.g.scene.add(log.mesh); this.logs.push(log);
    if (d.awake) { const obs = this.logObstacles(log, 0); for (let i = 0; i < 6; i++) this.logStep(log, 1 / 240, obs); for (const v of log.V) v.set(0, 0, 0); log.spin = log.turn = 0; this.pose(log); }   // (put clear of the ground and what's round it before it moves)
    if (log.asleep) this.rest(log); else this.logCols(log);
    return log;
  }
  // the log's model: one of the packs' cut trunks (LOOKS) stretched to its length and girth, or the carved one without them
  dress(l) {
    for (const o of [...l.mesh.children]) { l.mesh.remove(o); o.traverse((m) => { if (!m.isMesh) return; m.geometry.dispose(); if (m.material !== trunkMat && m.material !== logMat) m.material.dispose(); }); }
    const L = LOOKS[l.look] || LOOKS.find(Boolean), len = l.L, rad = l.R; let m;
    if (L) m = new THREE.Mesh(L.g.clone().scale(len / L.s.x, (2 * rad) / L.s.y, (2 * rad) / L.s.z), logMat);
    else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.08, len, 10).rotateZ(Math.PI / 2), trunkMat);
      const ends = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.9 });
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.98, 10), ends); e.position.x = (sx * len) / 2 + sx * 0.005; e.rotation.y = (sx * Math.PI) / 2; m.add(e); }
    }
    m.castShadow = m.receiveShadow = true; l.mesh.add(m); l.carved = !L;
  }
  // colliders all along the log (low: you can hop over it), close enough that you can't slip between them
  logCols(l) {
    const [a, b] = l.P, n = clamp(Math.ceil(l.L / (l.R * 1.8)) + 1, 3, 24), u0 = Math.min(0.45, l.R / l.L); l.cols = [];
    for (let k = 0; k < n; k++) { _q.lerpVectors(a, b, u0 + (1 - 2 * u0) * (k / (n - 1))); l.cols.push({ x: _q.x, z: _q.z, r: l.R + 0.1, h: l.R * 2, y: _q.y - l.R, ref: { log: l } }); }
    this.g.colliders.addGroup(l.id, l.cols);
  }
  // Each frame, every log still moving takes its substeps (as many as its speed needs), then turns its model to match,
  // carries its colliders along, shoves (and at speed hurts) whoever it rolls into, rumbles and thuds, and sleeps once it
  // has lain still a moment. Logs at rest cost nothing
  roll(dt) {
    for (const l of this.logs) {
      if (l.asleep) continue;
      l.life += dt; l.touch = false; l.bang = 0; l.struck = null; l.knock = null;
      const obs = this.logObstacles(l, dt), n = clamp(Math.ceil((Math.max(l.V[0].length(), l.V[1].length()) * dt) / ROLL.maxStep), 2, 12);
      for (let k = 0; k < n; k++) this.logStep(l, dt / n, obs);
      this.pose(l); this.logCols(l); this.shove(l); this.logFx(l, dt);
      if (l.knock) this.wake(l.knock);   // (a log struck hard enough by another rolls on too)
      l.still = Math.max(l.V[0].length(), l.V[1].length()) < ROLL.sleepV && l.touch ? l.still + dt : 0;
      if (l.still > ROLL.sleepT || l.life > ROLL.life || l.P[0].y < -40) this.rest(l);
    }
  }
  // what a moving log might touch this frame: the colliders round it (all but logs'; a tree by its trunk, not the round
  // you walk round), the stumps, and the other logs (into l.near)
  logObstacles(l, dt) {
    const [a, b] = l.P, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, r = l.L / 2 + l.R + 1 + Math.max(l.V[0].length(), l.V[1].length()) * dt, obs = (l.obs ||= []), near = (l.near ||= []);
    obs.length = near.length = 0;
    for (const c of this.g.colliders.near(mx, mz, r)) {
      if (c.ref?.log || (c.x - mx) ** 2 + (c.z - mz) ** 2 > (r + c.r) ** 2) continue;
      c.trunk ??= c.ref?.cx !== undefined && SPECIES[c.ref.sp]?.res === 'tree' ? Math.min(c.r, this.treeSize(c.ref).girth + 0.05) : c.r; obs.push(c);
    }
    for (const m of this.logs) if (m !== l && Math.hypot(m.mesh.position.x - mx, m.mesh.position.z - mz) < r + m.L / 2 + m.R) near.push(m);
    return obs;
  }
  // One substep of a moving log (h seconds): gravity, then its ends put right against all it touches (a few passes), then
  // its speed from where they went, with friction, rolling resistance and bounce at each contact (ROLL)
  logStep(l, h, obs) {
    const [a, b] = l.P, R = l.R, N = Math.max(2, Math.ceil(l.L / 1.2)), G = l.G, W = l.walls, gs = (l.gs ||= []); W.length = 0; while (gs.length <= N) gs.push({ h: 0, sx: 0, sz: 0, x: 0, z: 0, water: false });
    for (let k = 0; k < 2; k++) { l.V[k].y -= GRAV * h; l.pre[k].copy(l.V[k]); l.old[k].copy(l.P[k]); l.P[k].addScaledVector(l.V[k], h); }
    for (let it = 0; it < ROLL.iters; it++) {
      const last = it === ROLL.iters - 1, near = last ? -0.02 : 0;   // (the last pass notes what it rests against, too)
      if (last) for (const g of G) { g.w = 0; g.n.set(0, 0, 0); g.water = false; }
      _d.subVectors(b, a); const len = _d.length(), dl = (len - l.L) / 2 / (len || 1); a.addScaledVector(_d, dl); b.addScaledVector(_d, -dl);   // (its length)
      for (let j = 0; j <= N; j++) {   // the ground all along it (looked up once a substep; the passes after go by its slope there)
        const u = j / N, f = gs[j]; _q.lerpVectors(a, b, u);
        if (it === 0) { floorAt(_q.x, _q.z, R, f); f.x = _q.x; f.z = _q.z; }
        const gap = _q.y - (f.h + f.sx * (_q.x - f.x) + f.sz * (_q.z - f.z)); if (gap > R * 1.5) continue;
        _n.set(-f.sx, 1, -f.sz).normalize(); const depth = R - gap * _n.y; if (depth < near) continue;
        if (depth > 0) push(a, b, u, _n, Math.min(depth, 0.3));
        if (last) { G[0].w += 1 - u; G[0].n.addScaledVector(_n, 1 - u); G[1].w += u; G[1].n.addScaledVector(_n, u); if (f.water) G[0].water = G[1].water = true; l.touch = true; l.at.copy(_q); }
      }
      for (const c of obs) {   // trunks, rocks, posts, walls, stumps
        const depth = column(a, b, R, c.x, c.z, c.trunk, c.y ?? -1e9, c.h !== undefined ? (c.y ?? 0) + c.h : 1e9, _n); if (depth < near) continue;
        if (depth > 0) push(a, b, HIT.u, _n, Math.min(depth, 0.3));
        if (last) { W.push({ u: HIT.u, n: _n.clone(), c }); l.touch = true; }
      }
      for (const m of l.near) {   // the other logs: one asleep stays put, one moving gives way by half
        segSeg(a, b, m.P[0], m.P[1]); const u = SS[0], w = SS[1]; _q.lerpVectors(a, b, u); _t.lerpVectors(m.P[0], m.P[1], w); _n.subVectors(_q, _t);
        const d = _n.length(), depth = R + m.R - d; if (depth < near) continue; if (d > 1e-4) _n.divideScalar(d); else _n.set(0, 1, 0);
        const k = m.asleep ? 1 : 0.5; if (depth > 0) { push(a, b, u, _n, Math.min(depth, 0.3) * k); if (!m.asleep) push(m.P[0], m.P[1], w, _n, -Math.min(depth, 0.3) * k); }
        if (last) { W.push({ u, n: _n.clone(), log: m }); l.touch = true; }
      }
    }
    for (let k = 0; k < 2; k++) l.V[k].subVectors(l.P[k], l.old[k]).divideScalar(h);
    _e.subVectors(b, a).normalize(); let spin = 0, ns = 0;
    for (let k = 0; k < 2; k++) {   // on the ground: it rolls across its length and drags along it
      const C = G[k]; if (C.w < 0.05) continue;
      const v = l.V[k], n = C.n.normalize(), w = Math.min(1, C.w), vp = l.pre[k].dot(n); let vn = v.dot(n);
      _t.copy(v).addScaledVector(n, -vn); _a.copy(_e).addScaledVector(n, -_e.dot(n)).normalize(); _c.crossVectors(n, _a);   // (its slide on the ground, along it and across it)
      let va = _t.dot(_a), vc = _t.dot(_c); const gN = GRAV * n.y * h * w;
      vc = shrink(vc + (GRAV * _c.y * h * w) / 3, (Math.abs(vc) < 0.05 ? ROLL.roll : ROLL.rolling) * gN); va = shrink(va, ROLL.mu * gN);   // (a third of gravity's pull down the slope goes into turning it)
      if (C.water) { const k2 = Math.max(0, 1 - 2.5 * h); va *= k2; vc *= k2; }
      if (vp < -2) { vn = Math.max(vn, -ROLL.bounce * vp); l.bang = Math.max(l.bang, -vp); }
      vn = Math.min(vn, Math.max(ROLL.pop, -ROLL.bounce * vp));   // (no more out of the ground than it came in with: no popping)
      v.copy(n).multiplyScalar(vn).addScaledVector(_a, va).addScaledVector(_c, vc);
      spin -= vc / R; ns++;
    }
    for (const c of W) {   // what it struck: it bounces off a little (the end that struck the more) and drags along it
      const u = c.u, wa = 1 - u, wb = u, s = 1 / (wa * wa + wb * wb), n = c.n;
      _t.lerpVectors(l.V[0], l.V[1], u); const vp = _q.lerpVectors(l.pre[0], l.pre[1], u).dot(n), vn = _t.dot(n); let want = vn;
      if (vp < -1) { want = Math.max(vn, -ROLL.wall * vp); if (-vp > l.bang) { l.bang = -vp; l.struck = c; } }
      want = Math.min(want, Math.max(ROLL.pop, -ROLL.wall * vp));
      _d.copy(n).multiplyScalar(want - vn); _t.addScaledVector(n, -vn); const tl = _t.length(), fr = Math.min(tl, ROLL.wallMu * Math.max(0, want - vp)); if (tl > 1e-5) _d.addScaledVector(_t, -fr / tl);
      l.V[0].addScaledVector(_d, wa * s); l.V[1].addScaledVector(_d, wb * s);
      if (c.log?.asleep && -vp > 2) l.knock = c.log;
    }
    for (const v of l.V) if (v.length() > ROLL.maxV) v.setLength(ROLL.maxV);
    l.spin = ns ? spin / ns : l.spin * (1 - 0.3 * h); l.turn += l.spin * h;   // (it turns about its own length by the way it rolls)
  }
  // the log's model to its ends and the way it has turned
  pose(l) {
    const [a, b] = l.P; _e.subVectors(b, a).normalize();
    l.mesh.quaternion.premultiply(_Q.setFromUnitVectors(l.e, _e)).premultiply(_Q.setFromAxisAngle(_e, l.turn)).normalize(); l.e.copy(_e); l.turn = 0;
    l.mesh.position.lerpVectors(a, b, 0.5);
  }
  // a log come to rest: no more work for it until something wakes it, its colliders where it lies, the grass under it gone
  rest(l) {
    l.asleep = true; l.still = 0; for (const v of l.V) v.set(0, 0, 0); l.rumble?.stop(); l.rumble = null; delete l.y0;
    const [a, b] = l.P; this.logCols(l); clearGrass(l.id, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, hw: l.L / 2 + 0.2, hd: l.R + 0.25, rot: Math.atan2(a.z - b.z, b.x - a.x) });
  }
  wake(l) { if (!l.asleep) return; l.asleep = false; l.life = l.still = 0; delete l.kick; delete l.y0; }
  // A moving log shoves aside whoever it reaches (the player, creatures) and, coming on fast enough, hurts them by how
  // fast and how heavy it is (Valheim's rolling logs) and knocks them back a little; a giant it can't shift stops it
  shove(l) {
    const [a, b] = l.P, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2, reach = l.L / 2 + l.R + 2, mass = Math.PI * l.R * l.R * l.L, { player, creatures, combat } = this.g;
    const meet = (pos, r, h) => {
      const abx = b.x - a.x, abz = b.z - a.z, l2 = abx * abx + abz * abz, u = l2 > 1e-6 ? clamp(((pos.x - a.x) * abx + (pos.z - a.z) * abz) / l2, 0, 1) : 0.5;
      const qx = a.x + abx * u, qy = a.y + (b.y - a.y) * u, qz = a.z + abz * u; if (qy + l.R < pos.y + 0.05 || qy - l.R > pos.y + h) return null;
      const dx = pos.x - qx, dz = pos.z - qz, d = Math.hypot(dx, dz), need = l.R + r, ll = Math.sqrt(l2) || 1; if (d >= need) return null;
      const ux = d > 1e-3 ? dx / d : -abz / ll, uz = d > 1e-3 ? dz / d : abx / ll; _t.lerpVectors(l.V[0], l.V[1], u);
      return { u, mx: ux, mz: uz, push: need - d, v: _t.x * ux + _t.z * uz, at: new THREE.Vector3(qx, qy, qz) };
    };
    const ready = (who) => { if (l.life - (l.cd.get(who) ?? -9) < 2.5) return false; l.cd.set(who, l.life); return true; }, under = (who) => l.life - (l.cd.get(who) ?? -9) < 0.9;   // (just struck down: it rolls on over them, not shoving them ahead of it to strike again)
    const dmg = (v) => clamp((v - ROLL.hurt) * (1 + 1.5 * mass), 0, 45);   // (a 5 m log at a run's pace: a few points; a great trunk coming fast: most of a fresh hero's health)
    const P = player.pos;
    if (!player.stats.dead && !under(player) && Math.hypot(P.x - mx, P.z - mz) < reach) {
      const m = meet(P, 0.38, 1.8);
      if (m) {
        P.x += m.mx * m.push; P.z += m.mz * m.push;
        if (m.v > ROLL.hurt && ready(player)) {
          const got = combat?.hitPlayer({ pos: m.at, dmgK: 1, T: {} }, [dmg(m.v), dmg(m.v), 'blunt']);
          if (got !== 'dodged') { const k = 2 + m.v * 0.5; player.hv.x += m.mx * k; player.hv.z += m.mz * k; player.vel.y = Math.max(player.vel.y, 3); player.onGround = false; this.slow(l, m, 0.15); }
        }
      }
    }
    for (const c of creatures?.list || []) {
      if (c.dead || under(c) || Math.hypot(c.pos.x - mx, c.pos.z - mz) > reach + c.T.r) continue;
      const m = meet(c.pos, c.T.r * 0.8, c.T.h); if (!m) continue;
      if (c.boss || c.T.heavy) { _n.set(-m.mx, 0, -m.mz); push(a, b, m.u, _n, m.push); this.slow(l, m, 1.3); continue; }   // (a giant stands his ground: the log stops against him)
      c.pos.x += m.mx * m.push; c.pos.z += m.mz * m.push;
      if (m.v > ROLL.hurt && ready(c)) { creatures.hurt(c, [[dmg(m.v), 'blunt']], m.at); c.pos.x += m.mx * 0.6; c.pos.z += m.mz * 0.6; this.slow(l, m, 0.25); }
    }
  }
  // take k of a log's speed into whoever it met (m: where along it, which way); more than 1, it bounces off them
  slow(l, m, k) { const wa = 1 - m.u, wb = m.u, s = 1 / (wa * wa + wb * wb), dv = Math.max(0, m.v) * k; for (const [v, w] of [[l.V[0], wa], [l.V[1], wb]]) { v.x -= m.mx * dv * w * s; v.z -= m.mz * dv * w * s; } }
  // A moving log's sounds and dust: its rumble as it rolls; a thud, dust and a shiver through the tree it struck (and the
  // view kicked, if you stand near) when it lands hard or strikes something; puffs of dust kicked up as it goes
  logFx(l, dt) {
    const rs = Math.abs(l.spin) * l.R, big = clamp(0.5 + l.R * l.L * 0.25, 0.5, 1.4), c = audio();
    if (rs > 0.6 && l.touch && c) { l.rumble ||= new Rumble(c); l.rumble.set(l.mesh.position, clamp(rs / 7, 0, 1), big); } else if (l.rumble) { l.rumble.stop(); l.rumble = null; }
    l.fx -= dt;
    if (l.bang > 2.5 && l.fx <= 0) {
      l.fx = 0.15; const k = clamp((l.bang - 1.5) / 6, 0.15, 1) * big, p = l.struck ? new THREE.Vector3().lerpVectors(l.P[0], l.P[1], l.struck.u) : l.at.clone(), w = l.struck?.c;
      logThud(p, k); dust(p, 6 + Math.round(10 * k), 0xa89a78, 0.35);
      if (w?.ref?.cx !== undefined && SPECIES[w.ref.sp]?.res === 'tree') this.g.veg.shake(w.ref.cx, w.ref.cz, w.ref.i, w.x - p.x, w.z - p.z, 2 * k); else if (w?.ref?.sp !== undefined) impact(p, 'stone', 0.3 * k);
      const P = this.g.player.pos, near = clamp(1 - Math.hypot(p.x - P.x, p.z - P.z) / 25, 0, 1) * k; if (near > 0.05) { punch(0.25 * near); addShake(0.12 * near); }
    } else if (rs > 1.5 && l.touch && (l.dustT = (l.dustT ?? 0) - dt) <= 0) { l.dustT = 0.3; dust(l.at.clone(), 3, 0xa89a78, 0.25); }
  }
  hitLog(c, item, at) {
    const log = c.ref.log, { player } = this.g;
    if (!item?.chop) { burst(at, { color: 0x7a5236, n: 3, speed: 1.5 }); punch(0.07); this.g.sound?.('clink', true); this.warn('warned', 'Split logs with an <b>axe</b>'); return 'clink'; }
    log.hp -= this.dmg(item, 'slash') * player.stats.damageK('axe'); player.stats.train('axe', 12.5);
    burst(at, { color: 0xd9b07a, n: 10, speed: 3, size: 0.06 }); impact(at, 'wood', 0.3); punch(0.26); player.hitStop(0.03); this.g.sound?.('chop', 0.95);
    if (log.asleep) { log.kick = 0; log.y0 ??= log.mesh.position.y; }   // (the log jumps under the blow, update; one rolling has other things to do)
    if (log.hp > 0) return true;
    this.g.scene.remove(log.mesh); log.mesh.traverse((o) => { if (!o.isMesh) return; o.geometry.dispose(); if (o.material !== trunkMat && o.material !== logMat) o.material.dispose(); }); log.rumble?.stop();
    this.g.colliders.removeGroup(log.id); this.logs.splice(this.logs.indexOf(log), 1); clearGrass(log.id, null);
    dust(log.mesh.position, 16, 0xc8a878, 0.4);
    const k = player.stats.skillK('gathering');
    this.g.give('wood', Math.round(log.wood * k));
    for (const [id, p, a, b] of TREE_DROPS[log.sp] || []) if (Math.random() < p) this.g.give(id, a + Math.floor(Math.random() * (b - a + 1)));
    player.stats.train('gathering', 12.5);
    return true;
  }
  hitRock(c, sp, item, at, dir) {
    const { player } = this.g, id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`;
    // (the wrong tool glances off: a dull clink, a chip or two and a spark, a little jolt)
    if (item?.tool !== 'mine') { impact(at, 'dull'); punch(0.08, dir); this.g.sound?.('clink'); this.warn('warnedR', 'You need a <b>pickaxe</b> to break rock'); return 'clink'; }
    const max = rockHP(sp.name, c.ref.s), hp = (this.hp.get(id) ?? max) - this.dmg(item, 'pierce') * 2.5 * player.stats.skillK('gathering');
    // (rock doesn't give: the hardest kick of all the gathering, and the swing held a few frames where the pick bites)
    const big = sp.name === 'boulder' || c.ref.s > 1.6; impact(at, 'stone', big ? 0.7 : 0.5); punch(big ? 0.48 : 0.42, dir); player.hitStop(0.06); this.g.sound?.('mine', big ? 0.9 : 1.05);
    if (Math.random() < 0.5) this.g.give('stone', 1);
    if (hp > 0) { this.hp.set(id, hp); return true; }
    this.hp.delete(id);
    this.g.veg.remove(c.ref.cx, c.ref.cz, c.ref.i); this.g.colliders.removeOne(c);
    dust(new THREE.Vector3(c.x, c.y + 0.5, c.z), 24, 0x9b958c, 0.55); burst(new THREE.Vector3(c.x, c.y + 0.6, c.z), { color: 0x8f887e, n: 22, speed: 4, size: 0.14 }); spark(at, 5); punch(0.55, dir); addShake(0.12);
    const w = biomeWeights(c.x, c.z), k = player.stats.skillK('gathering');
    this.g.give('stone', Math.round((2 + c.ref.s * 2) * k));
    if (w.y > 0.5 && (sp.name === 'boulder' || hash2(c.x, c.z) < 0.35)) this.g.give('lightstone', Math.round((1 + c.ref.s) * k));
    player.stats.train('gathering', 12.5);
    return true;
  }
  // The bush, stump, fallen log or driftwood a blow from pos the way dir meets first within reach, from the near cells' items:
  // { cx, cz, i, sp, v, s, x, y, z, r, t (how far along the blow) } or null
  woodyAhead(pos, dir, reach) {
    const veg = this.g.veg, R = reach + 1.5; let best = null;
    for (let cz = Math.floor((pos.z - R) / CELL); cz <= Math.floor((pos.z + R) / CELL); cz++) for (let cx = Math.floor((pos.x - R) / CELL); cx <= Math.floor((pos.x + R) / CELL); cx++) {
      const it = veg.near.get(cx + ',' + cz)?.items; if (!it) continue;
      for (let o = 0, i = 0; o < it.length; o += STRIDE, i++) {
        if (!WOODY_SP[it[o]] || !(it[o + 6] > 0)) continue;
        const ox = it[o + 2] - pos.x, oz = it[o + 4] - pos.z; if (ox * ox + oz * oz > R * R || Math.abs(it[o + 3] - pos.y) > 2.2 || veg.removed.has(`${cx},${cz},${i}`)) continue;
        const { r } = this.woodySize(it[o], it[o + 1], it[o + 6]), t = along(ox, oz, r, dir.x, dir.z);
        if (t !== null && t < reach && (!best || t < best.t)) best = { cx, cz, i, sp: it[o], v: it[o + 1], s: it[o + 6], x: it[o + 2], y: it[o + 3], z: it[o + 4], r, t };
      }
    }
    return best;
  }
  // how tall one stands and how wide it is round its foot (a stump's or log's collider, a bush's leafy bulk), in metres
  woodySize(sp, v, s) {
    const key = sp * 16 + v; let z = (this.sizes ||= new Map()).get(key);
    if (!z) { const P = this.g.veg.geoFor(sp, v), b = new THREE.Box3(); for (const g of [P.geo, P.cards]) if (g) { g.computeBoundingBox(); b.union(g.boundingBox); }
      const S = b.getSize(new THREE.Vector3()); z = { h: b.max.y, r: SPECIES[sp].col ?? Math.min(1.1, (S.x + S.z) / 4) * 0.8 }; this.sizes.set(key, z); }
    return { h: z.h * s, r: z.r * s };
  }
  // A blow on a bush or a piece of dead wood: it shakes and throws leaves and twigs (or chips), and on its last blow it is
  // gone and gives its wood. Without an axe a bush only rustles, and dead wood knocks
  hitWoody(b, item, dir) {
    const { player, veg } = this.g, w = WOODY_SP[b.sp], id = `${b.cx},${b.cz},${b.i}`, { h } = this.woodySize(b.sp, b.v, b.s);
    const at = new THREE.Vector3(b.x - dir.x * b.r * 0.6, b.y + clamp(h * 0.55, 0.25, 1.1), b.z - dir.z * b.r * 0.6);
    if (!item?.chop) {
      if (w.leafy) { veg.shake(b.cx, b.cz, b.i, dir.x, dir.z, 2); impact(at, 'leaves', 0.1); this.g.sound?.('rustle', 0.6); } else { impact(at, 'dull'); this.g.sound?.('clink', true); }
      punch(0.06, dir); this.warn('warnedB', `You need an <b>axe</b> to cut ${w.leafy ? 'bushes' : 'it'} for wood`); return 'clink';
    }
    const hits = w.hits ?? (h < BUSH_H[0] ? 2 : h < BUSH_H[1] ? 3 : 4), left = (this.hp.get(id) ?? hits) - 1;
    player.stats.train('axe', 6);
    if (w.leafy) { veg.shake(b.cx, b.cz, b.i, dir.x, dir.z, 5); impact(at, 'leaves', 0.5); this.g.sound?.('rustle'); }   // (the whole bush thrashes: vegetation.js shake)
    else { impact(at, 'wood', 0.4); this.g.sound?.('chop', 1.1); player.hitStop(0.03); }
    punch(w.leafy ? 0.12 : 0.22, dir);
    if (left > 0) { this.hp.set(id, left); return true; }
    this.hp.delete(id); veg.remove(b.cx, b.cz, b.i);
    for (const c of [...this.g.colliders.near(b.x, b.z, 1)]) if (c.ref?.i === b.i && c.ref.cx === b.cx && c.ref.cz === b.cz) this.g.colliders.removeOne(c);   // (a stump's or log's)
    const mid = new THREE.Vector3(b.x, b.y + clamp(h * 0.4, 0.2, 0.8), b.z);
    if (w.leafy) { impact(mid, 'leaves', 1); impact(mid.setY(mid.y + h * 0.3), 'leaves', 0.8); } else { impact(mid, 'wood', 0.8); dust(mid, 6, 0x6e5e46, 0.3); }
    punch(w.leafy ? 0.16 : 0.26, dir);
    const k = player.stats.skillK('gathering'), wood = Array.isArray(w.wood) ? w.wood[0] + Math.floor(Math.random() * (w.wood[1] - w.wood[0] + 1)) : w.wood ?? hits - 1;
    if (this.bare.delete(id)) veg.setBare(b.cx, b.cz, b.i, false);   // (a tomato bush cut down while bare: nothing left to grow back)
    this.g.give('wood', Math.max(1, Math.round(wood * k)));
    for (const [it, p, a, c] of w.extra || []) if (Math.random() < p) this.g.give(it, a + Math.floor(Math.random() * (c - a + 1)));
    player.stats.train('gathering', 6);
    return true;
  }
  // E on a fruit tree in reach: pick its fruit (once a day)
  fruitTree() {
    const P = this.g.player, dir = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    for (const c of this.g.colliders.near(P.pos.x, P.pos.z, 3)) {
      if (!c.ref || c.ref.sp === undefined) continue; const name = SPECIES[c.ref.sp].name; if (!FRUIT[name]) continue;
      const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z) - c.r; if (d > 1.6) continue;
      const fx = (c.x - P.pos.x) * dir.x + (c.z - P.pos.z) * dir.z; if (fx < -0.5) continue;
      const id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`, ready = this.picked.get(id) !== this.g.S.day;
      return { c, name, id, ready, fruit: FRUIT[name] };
    }
    return null;
  }
  pick(t) {
    if (!t.ready) { this.g.hud.toast('Nothing ripe left on this tree. Come back tomorrow.'); return; }
    this.picked.set(t.id, this.g.S.day); const [item, a, b] = t.fruit;
    this.g.give(item, a + Math.floor(Math.random() * (b - a + 1))); this.g.sound?.('pick');
    burst(new THREE.Vector3(t.c.x, t.c.y + 2.2, t.c.z), { color: 0x5d8a34, n: 8, speed: 1.2, size: 0.07, grav: 6 });
  }
  // E on a tomato bush within reach in front of you: { cx, cz, i, id, x, y, z, ready }, or null
  tomatoBush() {
    const P = this.g.player, veg = this.g.veg, sp = SP_TOMATO, fx = Math.sin(P.yaw), fz = Math.cos(P.yaw); let best = null;
    for (let cz = Math.floor((P.pos.z - 3) / CELL); cz <= Math.floor((P.pos.z + 3) / CELL); cz++) for (let cx = Math.floor((P.pos.x - 3) / CELL); cx <= Math.floor((P.pos.x + 3) / CELL); cx++) {
      const it = veg.near.get(cx + ',' + cz)?.items; if (!it) continue;
      for (let o = 0, i = 0; o < it.length; o += STRIDE, i++) {
        if (it[o] !== sp || !(it[o + 6] > 0)) continue;
        const ox = it[o + 2] - P.pos.x, oz = it[o + 4] - P.pos.z, d = Math.hypot(ox, oz) - 0.45 * it[o + 6]; if (d > 1.5 || ox * fx + oz * fz < -0.3 || Math.abs(it[o + 3] - P.pos.y) > 2) continue;
        const id = `${cx},${cz},${i}`; if (veg.removed.has(id) || (best && best.d < d)) continue;
        best = { cx, cz, i, id, x: it[o + 2], y: it[o + 3], z: it[o + 4], d, ready: !this.bare.has(id) };
      }
    }
    return best;
  }
  pickTomatoes(t) {
    if (!t.ready) { this.g.hud.toast('No ripe tomatoes on this bush. They grow back in a day.'); return; }
    const S = this.g.S, [a, b] = TOMATO.n; this.bare.set(t.id, S.day + S.time); this.g.veg.setBare(t.cx, t.cz, t.i, true);
    this.g.give('tomato', a + Math.floor(Math.random() * (b - a + 1))); if (Math.random() < TOMATO.seed) this.g.give('tomatoSeed', 1);
    this.g.sound?.('pick'); this.g.acts?.reach?.(); this.g.veg.shake(t.cx, t.cz, t.i, Math.sin(this.g.player.yaw), Math.cos(this.g.player.yaw), 1.5);
    burst(new THREE.Vector3(t.x, t.y + 0.6, t.z), { color: 0x5d8a34, n: 6, speed: 1, size: 0.05, grav: 6 });
  }
  // (once a second: bushes whose fruit has grown back are ripe again, and the ones still bare, after a load too, drawn so)
  growBack(dt) {
    if ((this.bareT -= dt) > 0 || !this.bare.size) return; this.bareT = 1; const S = this.g.S, now = S.day + S.time;
    for (const [id, t] of this.bare) { const [cx, cz, i] = id.split(',').map(Number); if (now - t >= TOMATO.regrow) this.bare.delete(id); this.g.veg.setBare(cx, cz, i, this.bare.has(id)); }
  }
  // (the logs where they lie, or where they had got to if still rolling, and those of trees still falling: they roll on
  // from there)
  toJSON() {
    const r = (v, k = 3) => v.map((x) => +x.toFixed(k));
    return { removed: [...this.g.veg.removed], hp: [...this.hp], picked: [...this.picked], bare: [...this.bare], stumps: this.stumps.map(({ x, y, z, r }) => ({ x, y, z, r })),
      logs: [...this.logs.map((l) => ({ a: r(l.P[0].toArray()), b: r(l.P[1].toArray()), q: r(l.mesh.quaternion.toArray(), 4), R: l.R, L: l.L, sp: l.sp, s: l.s, look: l.look, hp: l.hp, wood: l.wood, moving: !l.asleep })),
        ...this.falling.map((f) => { const d = this.logOf(f); return { ...d, a: r(d.a.toArray()), b: r(d.b.toArray()), moving: true }; })] };   // (a tree still coming down: the log it will leave)
  }
  loadLogs(list) { for (const d of list) this.addLog({ ...d, a: new THREE.Vector3().fromArray(d.a), b: new THREE.Vector3().fromArray(d.b), awake: d.moving }); }
}
