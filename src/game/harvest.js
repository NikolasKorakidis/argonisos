// Gathering from the world. Trees take axe blows until they topple, crash down and leave a log; chop the log into wood.
// Rocks and boulders give stone (and lightstone in the Yleos hills) to a pickaxe. Olive, pomegranate and oak trees can be
// picked for fruit once a day.
import * as THREE from 'three';
import { SPECIES } from '../world/flora.js';
import { heightAt, biomeWeights, hash2 } from '../world/gen.js';
import { burst, dust, addShake } from '../render/fx.js';
import { trunkMat } from '../world/trees.js';
import { clearGrass } from '../world/grass.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// Tree toughness and what it gives, by species
const BIG = new Set(['oak', 'plane', 'holm']), SMALL = new Set(['pomegranate', 'fig', 'cypress']);
const TREE_DROPS = {
  olive: [['oliveSeed', 0.5, 1, 2]], oak: [['acornSeed', 0.5, 1, 2]], pomegranate: [['pomegranateSeed', 0.5, 1, 2]],
  qpine: [['resin', 0.8, 1, 2], ['pineCone', 0.5, 1, 1]], fir: [['resin', 0.8, 1, 2], ['firCone', 0.5, 1, 1]], cypress: [['resin', 0.5, 1, 1]],
  qtree: [['feather', 0.3, 1, 2]], plane: [['feather', 0.4, 1, 2]], holm: [['acornSeed', 0.3, 1, 1]],
};
const FRUIT = { olive: ['olive', 3, 5], pomegranate: ['pomegranate', 2, 3], oak: ['acorn', 2, 4] };
const treeHP = (name, s) => (BIG.has(name) ? 110 : SMALL.has(name) ? 40 : 70) * s;
const woodOf = (name, s) => Math.round((BIG.has(name) ? 9 : SMALL.has(name) ? 3 : 6) * s);
const rockHP = (name, s) => (name === 'boulder' ? 70 : 30) * s;

export class Harvest {
  constructor(g) {
    this.g = g; this.hp = new Map(); this.picked = new Map(); this.falling = []; this.logs = []; this.seq = 0; this.stumps = [];
    this.stumpMesh = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.85, 1, 0.5, 9).translate(0, 0.15, 0), trunkMat, 512); this.stumpMesh.count = 0;
    this.stumpMesh.castShadow = this.stumpMesh.receiveShadow = true; this.stumpMesh.frustumCulled = false; g.scene.add(this.stumpMesh);
  }
  // A strike landed (from player.onStrike): find what's in front and hit it with the held item
  strike(item) {
    const P = this.g.player, dir = new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw));
    const c = this.g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, 2.3, (c) => c.ref && (c.ref.sp !== undefined || c.ref.log));
    if (!c) return false;
    const at = new THREE.Vector3(c.x - dir.x * c.r * 0.9, P.pos.y + 1.1, c.z - dir.z * c.r * 0.9);
    if (c.ref.log) return this.hitLog(c, item, at);
    const sp = SPECIES[c.ref.sp];
    if (sp.res === 'tree') return this.hitTree(c, sp, item, at, dir);
    if (sp.res === 'rock') return this.hitRock(c, sp, item, at);
    return false;
  }
  dmg(item, kind) { const d = item?.dmg?.find(([, k]) => k === kind)?.[0] ?? 0; return d; }
  hitTree(c, sp, item, at, dir) {
    const { player, hud } = this.g, id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`;
    if (!item?.chop) { burst(at, { color: 0x7a5236, n: 3, speed: 1.5 }); if (!this.warned) { hud.toast('You need an <b>axe</b> to fell trees'); this.warned = true; setTimeout(() => (this.warned = false), 6000); } return true; }
    const max = treeHP(sp.name, c.ref.s), hp = (this.hp.get(id) ?? max) - this.dmg(item, 'slash') * player.stats.damageK('axe');
    player.stats.train('axe', 12.5);
    burst(at, { color: 0x9a7650, n: 9, speed: 3.2, size: 0.06 }); burst(at, { color: 0xd8c09a, n: 4, speed: 2, size: 0.05 }); addShake(0.25);
    this.g.sound?.('chop');
    this.wobble(c, dir);
    if (hp > 0) { this.hp.set(id, hp); return true; }
    this.hp.delete(id); this.fell(c, sp, dir); return true;
  }
  wobble(c) { this.g.veg.shakeAt?.(c.ref.cx, c.ref.cz, c.ref.i); }
  fell(c, sp, dir) {
    const { veg, colliders, player } = this.g, r = c.ref;
    veg.remove(r.cx, r.cz, r.i); colliders.removeOne(c);
    const v = veg.near.get(r.cx + ',' + r.cz)?.items; const o = r.i * 7;
    const obj = veg.single(r.sp, v ? v[o + 1] : 0); obj.position.set(c.x, c.y, c.z); obj.rotation.y = v ? v[o + 5] : 0; obj.scale.setScalar(r.s);
    const pivot = new THREE.Group(); pivot.position.set(c.x, c.y, c.z); obj.position.set(0, 0, 0); pivot.add(obj); this.g.scene.add(pivot);
    const away = Math.atan2(dir.x, dir.z);           // falls away from the player
    this.falling.push({ pivot, obj, sp, s: r.s, th: 0, w: 0.15, away, t: 0, landed: false, x: c.x, z: c.z, y: c.y, r: c.r });
    this.addStump(c.x, c.y, c.z, c.r);
    player.stats.train('gathering', 12.5); this.g.sound?.('creak');
  }
  addStump(x, y, z, r) { this.stumps.push({ x, y, z, r }); this.drawStumps(); clearGrass('stump' + x.toFixed(1) + z.toFixed(1), { x, z, r: r + 0.4 }); }
  drawStumps() {
    const m = new THREE.Matrix4(), near = this.stumps.slice(-512);
    near.forEach((s, i) => this.stumpMesh.setMatrixAt(i, m.compose(new THREE.Vector3(s.x, s.y - 0.05, s.z), new THREE.Quaternion(), new THREE.Vector3(s.r * 0.9, 1, s.r * 0.9))));
    this.stumpMesh.count = near.length; this.stumpMesh.instanceMatrix.needsUpdate = true;
  }
  update(dt) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.t += dt;
      if (!f.landed) {
        f.w += (0.9 + 3.2 * Math.sin(f.th)) * dt; f.th += f.w * dt;
        if (f.th >= 1.45) { f.th = 1.45; f.landed = true; f.t = 0; f.w = 0;
          const L = (f.sp.name === 'cypress' ? 7 : 5) * f.s, tip = new THREE.Vector3(f.x + Math.sin(f.away) * L * 0.7, 0, f.z + Math.cos(f.away) * L * 0.7); tip.y = heightAt(tip.x, tip.z) + 0.3;
          dust(tip, 22, 0xa89a78, 0.5); dust(new THREE.Vector3(f.x, f.y + 0.3, f.z), 10); addShake(0.5); this.g.sound?.('thud');
        }
        f.pivot.rotation.set(0, 0, 0); f.pivot.rotateOnWorldAxis(new THREE.Vector3(Math.cos(f.away), 0, -Math.sin(f.away)), f.th);
      } else if (f.t > 1.2) {
        // the crown breaks up and the trunk is left as a log
        f.pivot.scale.multiplyScalar(1 - dt * 3); f.pivot.position.y -= dt * 1.5;
        if (f.t > 1.7) { this.g.scene.remove(f.pivot); this.falling.splice(i, 1); this.spawnLog(f); dust(new THREE.Vector3(f.x + Math.sin(f.away) * 3 * f.s, f.y + 0.5, f.z + Math.cos(f.away) * 3 * f.s), 18, 0x6f8a46, 0.45); }
      } else if (f.t < 0.3) { f.pivot.rotation.set(0, 0, 0); f.pivot.rotateOnWorldAxis(new THREE.Vector3(Math.cos(f.away), 0, -Math.sin(f.away)), 1.45 - Math.sin(f.t / 0.3 * Math.PI) * 0.06); }
    }
  }
  spawnLog(f) {
    const len = clamp((f.sp.name === 'cypress' ? 5 : 4) * f.s, 2.5, 6.5), rad = clamp(f.r * 0.55, 0.22, 0.6);
    const geo = new THREE.CylinderGeometry(rad, rad * 1.08, len, 10).rotateZ(Math.PI / 2);
    const m = new THREE.Mesh(geo, trunkMat); m.castShadow = m.receiveShadow = true;
    const ends = new THREE.MeshStandardMaterial({ color: 0xd9b07a, roughness: 0.9 });
    for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.CircleGeometry(rad * 0.98, 10), ends); e.position.x = (sx * len) / 2 + sx * 0.005; e.rotation.y = (sx * Math.PI) / 2; m.add(e); }
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
    if (!item?.chop) { if (!this.warned) { this.g.hud.toast('Split logs with an <b>axe</b>'); this.warned = true; setTimeout(() => (this.warned = false), 6000); } return true; }
    log.hp -= this.dmg(item, 'slash') * player.stats.damageK('axe'); player.stats.train('axe', 12.5);
    burst(at, { color: 0xd9b07a, n: 10, speed: 3, size: 0.06 }); addShake(0.2); this.g.sound?.('chop');
    if (log.hp > 0) return true;
    this.g.scene.remove(log.mesh); this.g.colliders.removeGroup(log.id); this.logs.splice(this.logs.indexOf(log), 1); clearGrass(log.id, null);
    dust(log.mesh.position, 16, 0xc8a878, 0.4);
    const k = player.stats.skillK('gathering');
    this.g.give('wood', Math.round(log.wood * k));
    for (const [id, p, a, b] of TREE_DROPS[log.sp] || []) if (Math.random() < p) this.g.give(id, a + Math.floor(Math.random() * (b - a + 1)));
    player.stats.train('gathering', 12.5);
    return true;
  }
  hitRock(c, sp, item, at) {
    const { player, hud } = this.g, id = `${c.ref.cx},${c.ref.cz},${c.ref.i}`;
    burst(at, { color: 0x9b958c, n: 6, speed: 3, size: 0.06 });
    if (item?.tool !== 'mine') { if (!this.warnedR) { hud.toast('You need a <b>pickaxe</b> to break rock'); this.warnedR = true; setTimeout(() => (this.warnedR = false), 6000); } return true; }
    const max = rockHP(sp.name, c.ref.s), hp = (this.hp.get(id) ?? max) - this.dmg(item, 'pierce') * 2.5 * player.stats.skillK('gathering');
    addShake(0.25); this.g.sound?.('mine');
    if (Math.random() < 0.5) this.g.give('stone', 1);
    if (hp > 0) { this.hp.set(id, hp); return true; }
    this.hp.delete(id);
    this.g.veg.remove(c.ref.cx, c.ref.cz, c.ref.i); this.g.colliders.removeOne(c);
    dust(new THREE.Vector3(c.x, c.y + 0.5, c.z), 24, 0x9b958c, 0.55); burst(new THREE.Vector3(c.x, c.y + 0.6, c.z), { color: 0x8f887e, n: 22, speed: 4, size: 0.14 });
    const w = biomeWeights(c.x, c.z), k = player.stats.skillK('gathering');
    this.g.give('stone', Math.round((2 + c.ref.s * 2) * k));
    if (w.y > 0.5 && (sp.name === 'boulder' || hash2(c.x, c.z) < 0.35)) this.g.give('lightstone', Math.round((1 + c.ref.s) * k));
    player.stats.train('gathering', 12.5);
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
