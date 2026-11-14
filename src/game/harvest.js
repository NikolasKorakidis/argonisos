// Gathering from the world. Trees take axe blows until they topple, crash down and leave a log; chop the log into wood.
// Bushes, and the stumps, fallen logs and driftwood lying about, are cut up for wood where they stand. Rocks and boulders
// give stone (and lightstone in the Yleos hills) to a pickaxe. Olive, pomegranate and oak trees can be picked for fruit
// once a day. Every blow that lands is felt (Valheim's way, tester 14 Nov): the camera kicks by how hard it was
// (render/fx.js punch), heavy ones hold the swing a moment (player.hitStop), and chips, splinters, stone, sparks or
// leaves fly by what was struck; the wrong tool only clinks.
import * as THREE from 'three';
import { SPECIES, STRIDE, CELL } from '../world/flora.js';
import { heightAt, biomeWeights, hash2 } from '../world/gen.js';
import { burst, dust, addShake, punch, impact, spark } from '../render/fx.js';
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
// and fallen logs and the shore's driftwood are wood through and through. The small plants (lavender, ferns, flowers,
// tall grass, moss, reeds, mushrooms) are left alone. Each is found by the blow among its near cell's items (most have
// no collider: you walk through bushes) and removed through the vegetation, so a save remembers it as it does a tree.
const WOODY = {
  bush: { leafy: true, extra: [['fiber', 0.35, 1, 1]] }, myrtle: { leafy: true }, broom: { leafy: true, extra: [['fiber', 0.6, 1, 2]] }, redbush: { leafy: true, extra: [['fiber', 0.25, 1, 1]] },
  stump: { hits: 4, wood: 2 }, log: { hits: 5, wood: 3 }, driftwood: { hits: 3, wood: 2 },
};
const WOODY_SP = SPECIES.map((s) => WOODY[s.name] || null), BUSH_H = [0.9, 1.6];
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

export class Harvest {
  constructor(g) {
    this.g = g; this.hp = new Map(); this.picked = new Map(); this.falling = []; this.logs = []; this.seq = 0; this.stumps = [];
    this.stumpMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 1, 0.5, 9).translate(0, 0.15, 0), trunkMat, 512); this.stumpMesh.count = 0;
    this.stumpMesh.castShadow = this.stumpMesh.receiveShadow = true; this.stumpMesh.frustumCulled = false; g.scene.add(this.stumpMesh);
  }
  // A strike landed (from player.onStrike): find what's in front and hit it with the held item
  strike(item) {
    const P = this.g.player, dir = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const c = this.g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, 2.3, (c) => c.ref && ((c.ref.sp !== undefined && !WOODY_SP[c.ref.sp]) || c.ref.log)), w = this.woodyAhead(P.pos, dir, 2.3);
    if (w && (!c || w.t <= (along(c.x - P.pos.x, c.z - P.pos.z, c.r, dir.x, dir.z) ?? Infinity))) return this.hitWoody(w, item, dir);   // (whichever the blow meets first)
    if (!c) return false;
    const at = new THREE.Vector3(c.x - dir.x * c.r * 0.9, P.pos.y + 1.1, c.z - dir.z * c.r * 0.9);
    if (c.ref.log) return this.hitLog(c, item, at);
    const sp = SPECIES[c.ref.sp];
    if (sp.res === 'tree') return this.hitTree(c, sp, item, at, dir);
    if (sp.res === 'rock') return this.hitRock(c, sp, item, at, dir);
    return false;
  }
  // (a toast for the wrong tool, once in a while)
  warn(key, msg) { if (this[key]) return; this.g.hud.toast(msg); this[key] = true; setTimeout(() => (this[key] = false), 6000); }
  dmg(item, kind) { const d = item?.dmg?.find(([, k]) => k === kind)?.[0] ?? 0; return d; }
  hitTree(c, sp, item, at, dir) {
    const { player } = this.g, id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`;
    if (!item?.chop) { burst(at, { color: 0x7a5236, n: 3, speed: 1.5 }); punch(0.07, dir); this.g.sound?.('clink', true); this.warn('warned', 'You need an <b>axe</b> to fell trees'); return true; }
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
  fell(c, sp, dir) {
    const { veg, colliders, player } = this.g, r = c.ref;
    veg.remove(r.cx, r.cz, r.i); colliders.removeOne(c);
    const v = veg.near.get(r.cx + ',' + r.cz)?.items; const o = r.i * 7;
    const obj = veg.single(r.sp, v ? v[o + 1] : 0); obj.position.set(c.x, c.y, c.z); obj.rotation.y = v ? v[o + 5] : 0; obj.scale.setScalar(r.s);
    const pivot = new THREE.Group(); pivot.position.set(c.x, c.y, c.z); obj.position.set(0, 0, 0); pivot.add(obj); this.g.scene.add(pivot);
    const away = Math.atan2(dir.x, dir.z);           // falls away from the player
    // (a tree stands sunk into the ground to hide its roots, flora-pack.js: falling, it slides out along its length, so the
    // buried part doesn't swing up out of the stump behind it)
    const geo = obj.children[0].geometry; if (!geo.boundingBox) geo.computeBoundingBox(); const sink = Math.max(0, -geo.boundingBox.min.y) * r.s;
    const girth = clamp(trunkRadius(geo, r.s) ?? c.r * 0.55, 0.12, 1.5), tall = geo.boundingBox.max.y * r.s;
    this.falling.push({ pivot, obj, sp, s: r.s, th: 0, w: 0.15, away, t: 0, landed: false, x: c.x, z: c.z, y: c.y, r: c.r, sink, girth, tall });
    this.addStump(c.x, c.y, c.z, girth);
    player.stats.train('gathering', 12.5); this.g.sound?.('creak'); punch(0.35, dir); player.hitStop(0.08);   // (the last blow goes through: a heavier kick)
  }
  addStump(x, y, z, r) { this.stumps.push({ x, y, z, r }); this.drawStumps(); clearGrass('stump' + x.toFixed(1) + z.toFixed(1), { x, z, r: r + 0.4 }); }
  drawStumps() {
    const m = new THREE.Matrix4(), near = this.stumps.slice(-512);
    near.forEach((s, i) => this.stumpMesh.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y - 0.05, s.z), new THREE.Quaternion(), new THREE.Vector3(s.r * 1.1, 1, s.r * 1.1))));
    this.stumpMesh.count = near.length; this.stumpMesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    for (const l of this.logs) if (l.kick !== undefined) { l.kick += dt; l.mesh.position.y = l.y0 + 0.05 * Math.sin(l.kick * 45) * Math.exp(-l.kick * 14); if (l.kick > 0.4) { l.mesh.position.y = l.y0; delete l.kick; } }
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt;
      if (!f.landed) {
        f.w += (0.9 + 3.2 * Math.sin(f.th)) * dt; f.th += f.w * dt;
        if (f.th >= 1.45) { f.th = 1.45; f.landed = true; f.t = 0; f.w = 0;
          const L = (f.sp.name === 'cypress' ? 7 : 5) * f.s, tip = new THREE.Vector3(f.x + Math.sin(f.away) * L * 0.7, 0, f.z + Math.cos(f.away) * L * 0.7); tip.y = heightAt(tip.x, tip.z) + 0.3;
          dust(tip, 22, 0xa89a78, 0.5); dust(new THREE.Vector3(f.x, f.y + 0.3, f.z), 10); this.g.sound?.('thud');
          // (the ground takes it: a kick and a short rumble, less the further off you stand)
          const P = this.g.player.pos, near = clamp(1 - Math.hypot(tip.x - P.x, tip.z - P.z) / 30, 0, 1) * Math.min(1.3, f.s * (BIG.has(f.sp.name) || f.sp.name === 'titan' ? 1.2 : 1)); punch(0.6 * near, { x: Math.sin(f.away), z: Math.cos(f.away) }); addShake(0.25 * near);
        }
        f.pivot.rotation.set(0, 0, 0); f.pivot.rotateOnWorldAxis(new THREE.Vector3(Math.cos(f.away), 0, -Math.sin(f.away)), f.th);
        f.obj.position.y = f.sink * smooth(0.7, 1.45, f.th);
      } else if (f.t > 1.2) {
        // the crown breaks up and the trunk is left as a log
        f.pivot.scale.multiplyScalar(1 - dt * 3); f.pivot.position.y -= dt * 1.5;
        if (f.t > 1.7) { this.g.scene.remove(f.pivot); this.falling.splice(i, 1); this.spawnLog(f); dust(new THREE.Vector3(f.x + Math.sin(f.away) * 3 * f.s, f.y + 0.5, f.z + Math.cos(f.away) * 3 * f.s), 18, 0x6f8a46, 0.45); }
      } else if (f.t < 0.3) { f.pivot.rotation.set(0, 0, 0); f.pivot.rotateOnWorldAxis(new THREE.Vector3(Math.cos(f.away), 0, -Math.sin(f.away)), 1.45 - Math.sin(f.t / 0.3 * Math.PI) * 0.06); }
    }
  }
  spawnLog(f) {
    // (as thick as the trunk it was, and as long as the bare trunk of a tree that tall: about two fifths of it)
    const len = f.tall ? clamp(f.tall * 0.4, 2.2, 9) : clamp((f.sp.name === 'cypress' ? 5 : 4) * f.s, 2.5, 6.5), rad = f.girth ?? clamp(f.r * 0.55, 0.22, 0.6), looks = LOOKS.filter(Boolean);
    let m;
    if (looks.length) { const L = looks[Math.floor(hash2(f.x * 7.1 + 3.1, f.z * 5.3 - 7.7) * looks.length) % looks.length]; m = new THREE.Mesh(L.g.clone().scale(len / L.s.x, (2 * rad) / L.s.y, (2 * rad) / L.s.z), logMat); }
    else {
      m = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad * 1.08, len, 10).rotateZ(Math.PI / 2), trunkMat);
      const ends = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.9 });
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.98, 10), ends); e.position.x = (sx * len) / 2 + sx * 0.005; e.rotation.y = (sx * Math.PI) / 2; m.add(e); }
    }
    m.castShadow = m.receiveShadow = true;
    const cx = f.x + Math.sin(f.away) * (len / 2 + 0.8), cz = f.z + Math.cos(f.away) * (len / 2 + 0.8), y = Math.max(heightAt(cx, cz), -1) + rad * 0.9;
    m.position.set(cx, y, cz); m.rotation.y = f.away + Math.PI / 2;
    // tilt to follow the slope along the log
    const h0 = heightAt(cx - Math.sin(f.away) * len / 2, cz - Math.cos(f.away) * len / 2), h1 = heightAt(cx + Math.sin(f.away) * len / 2, cz + Math.cos(f.away) * len / 2);
    m.rotateZ(Math.atan2(h0 - h1, len));
    this.g.scene.add(m);
    const log = { id: 'log' + this.seq++, mesh: m, hp: 30 * f.s, wood: woodOf(f.sp.name, f.s), sp: f.sp.name, cols: [] };
    // colliders along the log so you can't walk through it (low: you can hop over)
    for (let k = -1; k <= 1; k++) { const c = { x: cx + Math.sin(f.away) * k * len / 3, z: cz + Math.cos(f.away) * k * len / 3, r: rad + 0.1, h: rad * 2, y: y - rad, ref: { log } }; log.cols.push(c); }
    this.g.colliders.addGroup(log.id, log.cols); this.logs.push(log);
    clearGrass(log.id, { x: cx, z: cz, hw: len / 2 + 0.2, hd: rad + 0.25, rot: f.away + Math.PI / 2 });
  }
  hitLog(c, item, at) {
    const log = c.ref.log, { player } = this.g;
    if (!item?.chop) { burst(at, { color: 0x7a5236, n: 3, speed: 1.5 }); punch(0.07); this.g.sound?.('clink', true); this.warn('warned', 'Split logs with an <b>axe</b>'); return true; }
    log.hp -= this.dmg(item, 'slash') * player.stats.damageK('axe'); player.stats.train('axe', 12.5);
    burst(at, { color: 0xd9b07a, n: 10, speed: 3, size: 0.06 }); impact(at, 'wood', 0.3); punch(0.26); player.hitStop(0.03); this.g.sound?.('chop', 0.95);
    log.kick = 0; log.y0 ??= log.mesh.position.y;   // (the log jumps under the blow: update)
    if (log.hp > 0) return true;
    this.g.scene.remove(log.mesh); log.mesh.traverse((o) => { o.geometry.dispose(); if (o.material !== trunkMat && o.material !== logMat) o.material.dispose(); }); this.g.colliders.removeGroup(log.id); this.logs.splice(this.logs.indexOf(log), 1); clearGrass(log.id, null);
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
    if (item?.tool !== 'mine') { impact(at, 'dull'); punch(0.08, dir); this.g.sound?.('clink'); this.warn('warnedR', 'You need a <b>pickaxe</b> to break rock'); return true; }
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
      punch(0.06, dir); this.warn('warnedB', `You need an <b>axe</b> to cut ${w.leafy ? 'bushes' : 'it'} for wood`); return true;
    }
    const hits = w.hits ?? (h < BUSH_H[0] ? 2 : h < BUSH_H[1] ? 3 : 4), left = (this.hp.get(id) ?? hits) - 1;
    player.stats.train('axe', 6);
    if (w.leafy) { veg.shake(b.cx, b.cz, b.i, dir.x, dir.z, 5); impact(at, 'leaves', 0.5); this.g.sound?.('rustle'); this.g.sound?.('chop', 1.4); }   // (the whole bush thrashes: vegetation.js shake)
    else { impact(at, 'wood', 0.4); this.g.sound?.('chop', 1.1); player.hitStop(0.03); }
    punch(w.leafy ? 0.12 : 0.22, dir);
    if (left > 0) { this.hp.set(id, left); return true; }
    this.hp.delete(id); veg.remove(b.cx, b.cz, b.i);
    for (const c of [...this.g.colliders.near(b.x, b.z, 1)]) if (c.ref?.i === b.i && c.ref.cx === b.cx && c.ref.cz === b.cz) this.g.colliders.removeOne(c);   // (a stump's or log's)
    const mid = new THREE.Vector3(b.x, b.y + clamp(h * 0.4, 0.2, 0.8), b.z);
    if (w.leafy) { impact(mid, 'leaves', 1); impact(mid.setY(mid.y + h * 0.3), 'leaves', 0.8); } else { impact(mid, 'wood', 0.8); dust(mid, 6, 0x6e5e46, 0.3); }
    punch(w.leafy ? 0.16 : 0.26, dir);
    const k = player.stats.skillK('gathering');
    this.g.give('wood', Math.max(1, Math.round((w.wood ?? hits - 1) * k)));
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
  toJSON() { return { removed: [...this.g.veg.removed], hp: [...this.hp], picked: [...this.picked], stumps: this.stumps }; }
}
