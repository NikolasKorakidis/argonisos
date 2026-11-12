// Wildlife and monsters. Stats come from the data table (speeds converted from ft/s). Creatures spawn out of sight
// around the player by biome and time of day, never close to a workbench, and fade away when you leave them far
// behind. Levels 0-2 (shown as owls over the name) add 25% health, damage and drops each.
//   passive: wander and graze, bolt when you come close or hurt them
//   aggressive: attack when you come close (hogs) or as soon as they see you (dryads, giants, skeletons)
//   Most of them won't come near a fire.
//   Families: one hog spawn in four is a sow with one to three piglets, one deer in three a doe with her fawn. The young
//   keep to their mother's side, and the family acts as one: alarmed, fleeing or charging together.
import * as THREE from 'three';
import { heightAt, biomeWeights } from '../world/gen.js';
import { groundAt } from '../world/groundcut.js';
const QUAD = new Set(['deer', 'fox', 'rabbit', 'hog', 'chimera']);   // bodies that tilt with the ground
import { makeBody, preloadBodies } from './models.js';
import { burst, dust, addShake } from '../render/fx.js';
import { camera } from '../render/core.js';
import { stormWallDepth } from '../world/stormwall.js';
import { icon } from '../ui/icons.js';
import { rr } from '../util/math.js';

const FT = 0.3048, ri = (a, b) => Math.floor(rr(a, b + 1));
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// drops: [item, min, max, chance]
export const TYPES = {
  rabbit: { name: 'Rabbit', hp: [3, 5], speed: [3 * FT, 15 * FT], passive: true, flee: 10 * FT, r: 0.3, h: 0.6, hops: true, mob: [1, 3], drops: [['rawMeat', 1, 1, 1], ['leather', 1, 1, 0.5], ['sharpBone', 1, 1, 0.2]] },
  fox: { name: 'Fox', hp: [7, 9], speed: [8 * FT, 20 * FT], passive: true, flee: 15 * FT, r: 0.4, h: 0.6, mob: [1, 2], drops: [['rawMeat', 1, 2, 1], ['foxHide', 1, 2, 0.5], ['sharpBone', 1, 1, 0.2]] },
  deer: { name: 'Deer', hp: [10, 14], speed: [5 * FT, 25 * FT], passive: true, flee: 20 * FT, r: 0.6, h: 1.4, mob: [1, 2], drops: [['rawMeat', 3, 4, 1], ['leather', 4, 4, 1], ['sharpBone', 1, 2, 0.2], ['deerHide', 1, 2, 1]] },
  hog: { name: 'Hog', hp: [10, 14], speed: [8 * FT, 25 * FT], aggro: 10 * FT, retaliate: true, dmg: [8, 12, 'pierce'], reach: 1.6, fearFire: true, r: 0.6, h: 0.9, mob: [1, 3], drops: [['rawMeat', 1, 3, 1], ['leather', 3, 3, 1], ['sharpBone', 1, 1, 0.2]] },
  dryadling: { name: 'Dryadling', hp: [15, 25], speed: [3 * FT, 15 * FT], sight: 18, dmg: [4, 6, 'slash'], reach: 1.4, fearFire: true, r: 0.35, h: 1.1, mob: [1, 3], weak: ['fire'], resist: ['poison'], drops: [['resin', 1, 2, 1], ['wood', 2, 4, 0.5]], blood: 0x6a8a3a },
  dryad: { name: 'Dryad', hp: [36, 44], block: 14, speed: [5 * FT, 12 * FT], sight: 24, dmg: [6, 8, 'slash'], ranged: { dmg: [4, 6, 'pierce'], range: 16, every: 4.5 }, reach: 1.7, fearFire: true, r: 0.45, h: 2, mob: [2, 4], weak: ['fire'], resist: ['poison'], drops: [['resin', 1, 4, 1], ['wood', 2, 4, 1], ['dryadHeart', 1, 1, 0.2]], blood: 0x6a8a3a },
  giant: { name: 'Giant', hp: [550, 650], speed: [4 * FT, 18 * FT], sight: 30, dmg: [50, 70, 'blunt'], reach: 3.6, r: 1.2, h: 6, mob: [1, 1], weak: ['pierce'], resist: ['blunt'], heavy: true, drops: [['log', 1, 2, 1], ['stone', 2, 4, 1], ['giantHide', 1, 2, 1]], thunder: 'big' },
  skeleton: { name: 'Skeleton', hp: [35, 55], block: 20, speed: [6 * FT, 15 * FT], sight: 26, dmg: [20, 30, 'slash'], reach: 1.8, r: 0.4, h: 1.9, mob: [1, 3], weak: ['blunt'], resist: ['pierce', 'poison'], drops: [['sharpBone', 3, 5, 1]], blood: 0xd9cdb0 },
};
// what spawns where: [type, weight]
const TABLE = {
  pedias: { day: [['rabbit', 32], ['deer', 30], ['fox', 18], ['hog', 16], ['dryadling', 4]], night: [['hog', 30], ['fox', 20], ['deer', 15], ['dryadling', 25], ['rabbit', 10]] },
  yleos: { day: [['deer', 18], ['fox', 12], ['hog', 16], ['dryadling', 26], ['dryad', 22], ['giant', 4]], night: [['dryadling', 26], ['dryad', 30], ['hog', 14], ['giant', 12], ['deer', 6]] },
};
const CAP = { pedias: 9, yleos: 11 };
// A mother with her young: how often a spawn of that kind is one, and how many young she has
const FAMILY = { hog: { p: 0.25, young: [1, 3] }, deer: { p: 0.3, young: [1, 1] } };
// The young (a body made small, by family or by chance): their own name, a smaller body to hit and be hit by, a little
// slower, and (in spawn) weaker, gentler and with less on them
const YOUNG_NAME = { hog: 'Piglet', deer: 'Fawn', rabbit: 'Leveret', fox: 'Fox Cub' }, YOUNG_K = 0.4, youngT = {};
const youngOf = (type) => { const T = TYPES[type]; return (youngT[type] ||= { ...T, name: YOUNG_NAME[type] ?? T.name, r: T.r * 0.6, h: T.h * 0.6, reach: (T.reach ?? 1) * 0.7, speed: [T.speed[0], T.speed[1] * 0.85] }); };
const calm = (c) => c.state === 'idle' || c.state === 'wander' || c.state === 'graze';
const alive = (c) => c && !c.dead && !c.gone;

export class Creatures {
  constructor(g) { this.g = g; this.list = []; this.t = 0; this.plates = new Map(); preloadBodies(); this.box = document.createElement('div'); this.box.id = 'plates'; document.getElementById('hud').appendChild(this.box); }
  spawn(type, x, z, o = {}) {
    const T = TYPES[type], level = o.level ?? (Math.random() < 0.12 ? (Math.random() < 0.25 ? 2 : 1) : 0), k = 1 + 0.25 * level;
    const body = makeBody(type, level, x, z, o.young), y = Math.max(heightAt(x, z), -0.3), young = !!body.young, yk = young ? YOUNG_K : 1;
    body.obj.position.set(x, y, z); body.obj.rotation.order = 'YXZ'; this.g.scene.add(body.obj);
    const c = { type, T: young ? youngOf(type) : T, body, level, young, dropK: yk, hp: rr(...T.hp) * k * yk, max: 0, pos: body.obj.position, yaw: Math.random() * 6.28, speed: 0, state: 'idle', t: Math.random() * 4, target: null, home: new THREE.Vector3(x, y, z),
      atkCd: rr(0.5, 1.5), rangedCd: rr(2, 4), hitT: 0, flash: 0, aware: !!o.aware, dmgK: k * yk, deadT: 0, boss: o.boss, summoned: o.summoned, vy: 0, stuck: 0, lastP: new THREE.Vector3(x, y, z) };
    c.max = c.hp; this.list.push(c); return c;
  }
  // ---- the spawner
  biomeKey(x, z) { const w = biomeWeights(x, z); return w.v > 0.4 ? null : w.y > w.p ? 'yleos' : 'pedias'; }
  trySpawn() {
    const P = this.g.player.pos, key = this.biomeKey(P.x, P.z); if (!key) return;
    const near = this.list.filter((c) => !c.dead && !c.boss && c.pos.distanceTo(P) < 90).length; if (near >= CAP[key]) return;
    const night = this.g.S.time >= 0.72 || this.g.S.time < 0.02;
    for (let tries = 0; tries < 6; tries++) {
      const a = Math.random() * 6.283, d = rr(42, 75), x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, h = heightAt(x, z);
      if (h < 1.2 || stormWallDepth(x, z) > 0) continue;
      const bk = this.biomeKey(x, z); if (!bk) continue;
      if (this.g.build?.nearStation('workbench', new THREE.Vector3(x, h, z), 30)) continue;   // no spawns in the player's camp
      // out of sight: behind the camera, or far enough
      const toC = new THREE.Vector3(x - camera.position.x, 0, z - camera.position.z).normalize(), f = new THREE.Vector3(); camera.getWorldDirection(f); f.y = 0; f.normalize();
      if (toC.dot(f) > 0.55 && d < 60) continue;
      const tbl = TABLE[bk][night ? 'night' : 'day'], tot = tbl.reduce((s, [, w]) => s + w, 0); let pick = Math.random() * tot, type = tbl[0][0];
      for (const [t, w] of tbl) { pick -= w; if (pick <= 0) { type = t; break; } }
      const [m0, m1] = TYPES[type].mob, n = ri(m0, m1), F = FAMILY[type], lone = F ? false : undefined;   // (hogs and deer are young only with their mothers)
      if (F && Math.random() < F.p) { this.spawnFamily(type, x, z, night, Math.max(1, CAP[key] - near - 1)); return; }
      for (let i = 0; i < n; i++) { const xx = x + rr(-4, 4), zz = z + rr(-4, 4); if (heightAt(xx, zz) > 1) this.spawn(type, xx, zz, { level: night && Math.random() < 0.3 ? ri(1, 2) : undefined, young: lone }); }
      return;
    }
  }
  // A mother (grown; a doe, never a stag) and her young about her, facing the way she does, each with its own place at her
  // side to keep to (slot: the angle from her heading, slotR: how far)
  spawnFamily(type, x, z, night, room = 3) {
    const F = FAMILY[type]; let lv = night && Math.random() < 0.3 ? ri(1, 2) : Math.random() < 0.12 ? (Math.random() < 0.25 ? 2 : 1) : 0;
    if (type === 'deer') lv = Math.min(lv, 1);
    const M = this.spawn(type, x, z, { level: lv, young: false }), n = Math.min(ri(...F.young), room); M.brood = [];
    for (let i = 0; i < n; i++) {
      const slot = Math.PI + (n > 1 ? (i / (n - 1) - 0.5) * 1.8 : rr(-0.6, 0.6)) + rr(-0.15, 0.15), slotR = M.T.r + rr(0.7, 1.3), a = M.yaw + slot;
      const xx = x + Math.sin(a) * slotR, zz = z + Math.cos(a) * slotR; if (heightAt(xx, zz) <= 1) continue;
      const y = this.spawn(type, xx, zz, { level: 0, young: true }); Object.assign(y, { mother: M, slot, slotR, yaw: M.yaw }); M.brood.push(y);
    }
    return M;
  }
  // A mother and her young are one family: when one of them takes fright or turns on you, so do the others
  kin(c) { const M = alive(c.mother) ? c.mother : c; return (M.brood || []).concat(M).filter((k) => k !== c && alive(k)); }
  rouse(c, st = c.state === 'attack' ? 'chase' : c.state) {
    for (const k of this.kin(c)) {
      if (k.state === st || k.state === 'attack' || (st === 'alert' && !calm(k))) continue;
      k.aware = true; k.state = st;
      if (st === 'alert') { k.alertT = c.alertT + rr(0, 0.25); k.alertD = k.pos.distanceTo(this.g.player.pos); }
      else if (st === 'flee') k.t = c.t;
    }
  }
  // How far it notices you, as a share of its normal range: full in its field of view (about 220° in front), a third
  // behind where it can only hear you; less while grazing; half when you sneak; more when you sprint
  senseK(c, pp, P) {
    const toP = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z), off = Math.abs(Math.atan2(Math.sin(toP - c.yaw), Math.cos(toP - c.yaw)));
    let k = off < 1.9 ? 1 : 0.33;
    if (c.state === 'graze') k *= 0.7;
    if (P.sneaking) k *= 0.5; else if (P.sprinting) k *= off < 1.9 ? 1.2 : 2;
    return k;
  }
  // ---- damage dealt to a creature. Returns the damage done
  hurt(c, dmgList, from, opts = {}) {
    if (c.dead) return 0;
    let total = 0;
    for (const [n0, kind] of dmgList) { let n = n0; if (c.T.weak?.includes(kind)) n *= 1.5; if (c.T.resist?.includes?.(kind)) n *= 0.5; total += n; }
    total *= opts.k ?? 1;
    if (!c.aware && opts.backstab) { total *= opts.backstab; this.g.hud.toast('<b>Sneak attack!</b>'); }
    if (c.T.block && c.state === 'chase' && Math.random() < 0.25 && !opts.ranged) { total = Math.max(0, total - c.T.block); burst(c.pos.clone().setY(c.pos.y + c.T.h * 0.6), { color: 0xd8d0c0, n: 6, speed: 2 }); }
    c.hp -= total; c.flash = 1; c.hitT = 0.25; c.aware = true;
    const at = c.pos.clone().setY(c.pos.y + c.T.h * 0.6);
    burst(at, { color: c.T.blood ?? 0x8a1a10, n: 8 + Math.min(12, total), speed: 2.6, size: 0.06 });
    this.g.hud.damageNumber?.(at, total);
    if (opts.knock && from && Math.random() < opts.knock && !c.T.heavy) { const d = c.pos.clone().sub(from).setY(0).normalize(); c.pos.addScaledVector(d, 0.8); }
    if (c.T.passive) { c.state = 'flee'; c.t = rr(5, 8); }
    else if (c.state !== 'attack') { c.state = 'chase'; }
    this.rouse(c);   // (its family joins in)
    if (c.hp <= 0) this.kill(c);
    return total;
  }
  kill(c) {
    c.dead = true; c.state = 'dead'; c.deadT = 0; c.hp = 0; this.g.sound?.('kill');
    this.g.onKill?.(c);
  }
  // when a body has lain long enough: a small thunderclap, and it's gone, leaving its drops
  vanish(c) {
    const at = c.pos.clone().setY(c.pos.y + 0.5);
    dust(at, c.T.thunder === 'big' ? 30 : 14, 0xe8e8ff, c.T.thunder === 'big' ? 0.8 : 0.4); burst(at, { color: 0xbfd0ff, n: 16, speed: 4, size: 0.05, grav: -2 });
    if (c.pos.distanceTo(this.g.player.pos) < 25) { addShake(c.T.thunder === 'big' ? 0.5 : 0.15); this.g.flashSky?.(c.T.thunder === 'big' ? 0.5 : 0.18); }
    this.g.sound?.('thunder');
    // (what it leaves; the young less of each, but never none)
    if (!c.summoned) for (const [id, a, b, ch] of c.T.drops) if (Math.random() < ch) { const n0 = ri(a, b) * (1 + 0.25 * c.level), n = c.young ? Math.max(1, Math.round(n0 * c.dropK)) : Math.round(n0); if (n > 0) this.g.pickups.drop(id, n, c.pos.x + rr(-0.6, 0.6), c.pos.z + rr(-0.6, 0.6), { auto: true }, c.pos.y); }
    this.remove(c);
  }
  remove(c) { c.gone = true; this.g.scene.remove(c.body.obj); c.body.dispose(); this.list.splice(this.list.indexOf(c), 1); this.plates.get(c)?.remove(); this.plates.delete(c); }
  // ---- per frame
  update(dt) {
    const g = this.g, P = g.player, pp = P.pos;
    this.t -= dt; if (this.t <= 0) { this.t = 3; if (!g.S.peaceful) this.trySpawn(); }
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i], T = c.T;
      if (c.dead) { c.deadT += dt; c.body.animate('dead', 0, dt); c.flash = Math.max(0, c.flash - dt * 3); c.body.flash(c.flash); if (c.deadT > (T.heavy ? 3 : 2)) this.vanish(c); continue; }
      const d = c.pos.distanceTo(pp);
      if (d > 140 && !c.boss) { this.remove(c); continue; }
      c.t -= dt; c.atkCd -= dt; c.rangedCd -= dt; c.hitT -= dt; c.flash = Math.max(0, c.flash - dt * 4); c.body.flash(c.flash);
      const fire = T.fearFire ? g.build?.nearFire(c.pos, 7) : null;
      // decide
      if (P.dead && c.state === 'chase') c.state = 'idle';
      // noticing you: a field of view in front, only hearing behind; sneaking halves it, sprinting is heard further
      if (!P.dead && calm(c)) {
        const base = T.passive ? T.flee : (T.sight || T.aggro || 0), range = base * this.senseK(c, pp, P) * (g.S.time > 0.75 && !T.passive ? 0.75 : 1);
        if (d < range) {
          // a moment of alarm first: it freezes, lifts its head and turns to look at you, then bolts (or charges)
          if (c.boss) { c.state = 'chase'; c.aware = true; }
          else { c.state = 'alert'; c.alertT = T.alert ?? (T.passive ? 1.2 : 0.7); c.alertD = d; c.aware = true; g.sound?.('alert'); this.rouse(c); }
        }
      }
      if (c.state === 'alert') {
        c.alertT -= dt; const P2 = P.pos, close = d < c.alertD * 0.55 || d < 1.5;   // rushing it cuts the moment short
        if (P.dead) c.state = 'idle';
        else if (c.alertT <= 0 || close || (P.sprinting && d < (T.flee || 8) * 1.2)) { if (T.passive) { c.state = 'flee'; c.t = rr(4, 7); } else { c.state = 'chase'; if (T.heavy) g.sound?.('roar'); } this.rouse(c); }
        else if (d > (T.passive ? T.flee : (T.sight || T.aggro || 8)) * 1.6) { c.state = 'idle'; c.t = rr(2, 4); c.aware = false; }   // you backed off: it settles down
        void P2;
      }
      let want = 0, face = c.yaw, special = null;
      if (c.boss && !P.dead) special = g.trial?.bossThink(c, dt, d);
      const M = alive(c.mother) ? c.mother : null, brood = c.brood?.some(alive);
      if (c.state === 'flee') {
        // away from you, weaving (a hare jinks hard from side to side); the young after their mother, and she no faster than they can run
        let away = Math.atan2(c.pos.x - pp.x, c.pos.z - pp.z); if (M?.state === 'flee' && c.pos.distanceTo(M.pos) > 3) away = Math.atan2(M.pos.x - c.pos.x, M.pos.z - c.pos.z);
        face = away + (T.hops ? (Math.sin(c.t * 3.3) > 0 ? 0.6 : -0.6) : Math.sin(c.t * 2) * 0.4); want = T.speed[1] * (brood ? 0.85 : 1);
        if (c.t <= 0 && d > 25) { c.state = 'idle'; c.t = rr(2, 5); }
      } else if (c.state === 'chase' || c.state === 'attack') {
        const wp = g.structures?.navTarget?.(c.pos, pp) || pp;   // in the Labyrinth: round by the gaps in the rings
        face = Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z); want = T.speed[1] * (T.heavy ? 0.75 : 0.85);
        if (fire) { const away = Math.atan2(c.pos.x - fire.pos.x, c.pos.z - fire.pos.z); if (c.pos.distanceTo(fire.pos) < 6.5) { face = away; want = T.speed[0] * 1.5; } else if (d < 9) want = 0; }   // won't come into the firelight
        const stopAt = T.reach + T.r * 0.5; if (d < stopAt + (c.boss ? 0 : c.speed * 0.25)) want = 0;   // (easing off in time, not running on into you)
        if (d < stopAt) { want = 0; if (c.atkCd <= 0 && !c.move) { c.state = 'attack'; c.atkT = T.heavy ? 1.1 : 0.55; c.atkCd = T.heavy ? 3.2 : rr(1.4, 2.2); c.hitDone = false; } }
        if (T.ranged && d > 5 && d < T.ranged.range && c.rangedCd <= 0) { c.rangedCd = T.ranged.every + rr(-1, 1); this.throwThorn(c); }
        if (d > 60 || (c.t < -30 && d > 30)) { c.state = 'idle'; c.t = rr(2, 4); }
      } else if (c.state === 'alert') {
        face = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z); want = 0;   // freeze and stare
      } else if (M) {   // a young one beside its mother: it keeps to its place by her, trotting to catch up when she moves off
        if (c.t <= 0) { c.state = T.passive && Math.random() < 0.5 ? 'graze' : 'idle'; c.t = rr(2, 5); }
        const a = M.yaw + c.slot, tx = M.pos.x + Math.sin(a) * c.slotR, tz = M.pos.z + Math.cos(a) * c.slotR, dm = Math.hypot(tx - c.pos.x, tz - c.pos.z);
        c.follow = dm > (c.follow ? 0.35 : 1.1);
        if (c.follow) { face = Math.atan2(tx - c.pos.x, tz - c.pos.z); want = Math.min(T.speed[1] * 0.75, Math.max(T.speed[0] * 0.6, dm * 1.2, M.speed * 1.15)); if (c.state === 'graze') c.state = 'idle'; }
        c.home.copy(c.pos);   // (should she fall, it stays about where it lost her)
      } else {   // idle / wander / graze near home
        if (c.t <= 0) { const r = Math.random(); c.state = r < 0.4 ? 'idle' : r < 0.7 && T.passive ? 'graze' : 'wander'; c.t = rr(3, 8); c.wanderYaw = Math.random() * 6.28; if (c.pos.distanceTo(c.home) > 25) c.wanderYaw = Math.atan2(c.home.x - c.pos.x, c.home.z - c.pos.z); }
        if (c.state === 'wander') { face = c.wanderYaw; want = T.speed[0];
          // a hare goes by fits and starts: a few hops, a pause to sit up and look about, a few more a little to one side
          if (T.hops) { c.hopT = (c.hopT ?? 0) - dt; if (c.hopT < -(c.rest ?? 0)) { c.hopT = rr(0.5, 1.1); c.rest = rr(0.6, 1.8); c.wanderYaw += rr(-0.9, 0.9); } want = c.hopT > 0 ? T.speed[0] * 1.6 : 0; } }
      }
      if (c.state === 'attack') {
        c.atkT -= dt; want = 0; face = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z);
        if (!c.hitDone && c.atkT < (T.heavy ? 0.45 : 0.25)) { c.hitDone = true; if (d < T.reach + T.r + 0.6 && !P.dead) g.combat.hitPlayer(c, T.dmg); else if (T.heavy) { dust(c.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), 3), 18); addShake(0.3); } this.hitBuildings(c); }
        if (c.atkT <= 0) c.state = 'chase';
      }
      // a boss move in progress steers: its own speed and heading (snapped for a charge), or a leap through the air
      const ctl = c.ctl; if (ctl) { want = ctl.want; if (ctl.face !== undefined) face = ctl.face; if (ctl.snap) c.yaw = face; if (ctl.want === 0) c.speed *= 0.8; }
      // move: turn towards the wanted heading, accelerate, follow the ground, avoid deep water and the storm
      c.yaw += angDiff(face, c.yaw) * Math.min(1, dt * (T.heavy ? 2.5 : 6));
      c.speed += (want - c.speed) * Math.min(1, dt * (T.hops ? 9 : 4));   // (a hare is off, or stopped, at once)
      if (c.hitT > 0) c.speed *= 0.5;
      const nx = ctl?.at ? ctl.at.x : c.pos.x + Math.sin(c.yaw) * c.speed * dt, nz = ctl?.at ? ctl.at.z : c.pos.z + Math.cos(c.yaw) * c.speed * dt, nh = heightAt(nx, nz);
      if (nh > (T.heavy ? -1.2 : 0.2) && stormWallDepth(nx, nz) === 0) { c.pos.x = nx; c.pos.z = nz; } else { c.wanderYaw = c.yaw + Math.PI; c.speed *= 0.3; if (c.state === 'flee') c.yaw += 1; }
      // room for each: they don't stand in one another or in you (a family or a herd spreads round you rather than into one spot)
      if (!c.boss && !T.heavy) {
        for (const o of this.list) { if (o === c || o.dead) continue; const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z, need = (T.r + o.T.r) * 0.75, dd = dx * dx + dz * dz;
          if (dd < need * need && dd > 1e-6) { const q = (need / Math.sqrt(dd) - 1) * 0.5; c.pos.x += dx * q; c.pos.z += dz * q; } }
        const dx = c.pos.x - pp.x, dz = c.pos.z - pp.z, need = 0.4 + T.r * 0.7, dd = dx * dx + dz * dz;
        if (!P.dead && dd < need * need && dd > 1e-6 && Math.abs(c.pos.y - pp.y) < 1.5) { const q = need / Math.sqrt(dd) - 1; c.pos.x += dx * q; c.pos.z += dz * q; }
      }
      g.colliders.resolve(c.pos, T.r * 0.8, c.pos.y);
      const fl = Math.max(this.groundAt(c.pos.x, c.pos.z, c.pos.y), -0.4); if (ctl?.air !== undefined) c.pos.y = fl + ctl.air; else c.pos.y += (fl - c.pos.y) * Math.min(1, dt * 12);
      // stuck against a wall while chasing: hit it
      c.stuck = c.pos.distanceTo(c.lastP) < 0.05 * dt * 60 && want > 0.5 ? c.stuck + dt : 0; c.lastP.copy(c.pos);
      if (c.stuck > 1.2 && (c.state === 'chase') && c.atkCd <= 0) { c.state = 'attack'; c.atkT = 0.55; c.atkCd = 2; c.hitDone = false; c.stuck = 0; }
      c.body.obj.rotation.y = c.yaw;
      // four-footed creatures lie along the slope they stand on: nose up a hill, down it going down
      if (QUAD.has(c.type)) { const e = T.r * 1.3 + 0.3, fx = Math.sin(c.yaw) * e, fz = Math.cos(c.yaw) * e, rise = this.groundAt(c.pos.x + fx, c.pos.z + fz, c.pos.y) - this.groundAt(c.pos.x - fx, c.pos.z - fz, c.pos.y);
        c.pitch = (c.pitch || 0) + (-Math.atan2(rise, 2 * e) * (ctl?.air !== undefined ? 0 : 1) - (c.pitch || 0)) * Math.min(1, dt * 8); c.body.obj.rotation.x = c.pitch; }
      c.body.animate(special && special !== 'run' ? special : c.state === 'attack' ? 'attack' : c.hitT > 0 ? 'hit' : c.state, c.speed, dt);
      c.body.feet?.(dt, this.groundFn ||= (x, z, y) => this.groundAt(x, z, y), c.pos.y, ctl?.air === undefined && c.hitT <= 0);
    }
    this.updatePlates();
  }
  // what a creature stands on: the ground, or a floor or a site's steps within reach
  groundAt(x, z, y) { const g = this.g; return Math.max(groundAt(x, z), g.build?.floorAt(x, z, y) ?? -1e9, g.structures?.floorAt(x, z, y) ?? -1e9); }
  hitBuildings(c) {
    const B = this.g.build; if (!B) return; const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const hit = this.g.colliders.pick(c.pos.x, c.pos.z, f.x, f.z, c.T.reach + c.T.r, (k) => k.ref?.piece); if (hit) B.damage(hit.ref.piece, rr(c.T.dmg[0], c.T.dmg[1]) * c.dmgK * (c.T.heavy ? 2 : 1));
  }
  throwThorn(c) { this.g.combat?.throwAt(c, c.T.ranged.dmg); }
  // creatures in an arc in front of a point (for melee)
  inArc(from, yaw, reach, arc = 1.1) {
    const out = [];
    for (const c of this.list) { if (c.dead) continue; const dx = c.pos.x - from.x, dz = c.pos.z - from.z, d = Math.hypot(dx, dz) - c.T.r; if (d > reach) continue; if (Math.abs(angDiff(Math.atan2(dx, dz), yaw)) > arc && d > 0.5) continue; if (Math.abs(c.pos.y - from.y) > c.T.h + 1.5) continue; out.push(c); }
    return out;
  }
  // ---- health bars over creatures that are hurt or hunting you
  updatePlates() {
    const P = this.g.player.pos, v = new THREE.Vector3();
    const show = this.list.filter((c) => !c.dead && (c.hp < c.max || c.state === 'chase' || c.state === 'attack' || c.boss) && c.pos.distanceTo(P) < 30).slice(0, 8);
    for (const [c, el] of this.plates) if (!show.includes(c)) { el.remove(); this.plates.delete(c); }
    for (const c of show) {
      if (c.boss) continue;
      let el = this.plates.get(c);
      if (!el) { el = document.createElement('div'); el.className = 'plate'; el.innerHTML = `<b>${c.T.name}${`<i class="lvl" title="Level ${c.level}">${icon('owl')}</i>`.repeat(c.level)}</b><span><u></u></span>`; /* an owl for each level (same levels as before) */ this.box.appendChild(el); this.plates.set(c, el); }
      v.copy(c.pos); v.y += c.T.h + 0.5; v.project(camera);
      if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.transform = `translate(${(v.x * 0.5 + 0.5) * innerWidth}px, ${(-v.y * 0.5 + 0.5) * innerHeight}px) translate(-50%, -100%)`;
      el.querySelector('u').style.width = (c.hp / c.max) * 100 + '%';
    }
  }
  toJSON() { return []; }
}
