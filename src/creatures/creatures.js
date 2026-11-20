// Wildlife and monsters. Stats come from the data table (speeds converted from ft/s). Creatures spawn out of sight
// around the player by biome and time of day, never close to a workbench, and fade away when you leave them far
// behind. Levels 0-2 (shown as owls over the name) add 25% health, damage and drops each.
//   passive: wander and graze, bolt when you come close or hurt them
//   aggressive: attack when you come close (hogs) or as soon as they see you (dryads, giants, skeletons)
//   Hogs and dryadlings won't come near a fire, and a hog keeps clear of the torch in your hand too, until you hit it (or
//   one of its family): then it fights on through fire and torch until the fight is over. A dryadling backs away from
//   your torch the first time it sees it in a fight, then pays it no mind; a dryad isn't afraid of fire at all.
//   Every blow is the attacker's clip played whole: it lands when the clip's strike does (models.js BLOWS), and only if
//   you're still within reach and in front of it then; the last moments of a swing go where it was aimed, so stepping
//   aside, backing off or rolling out of a wind-up you've read works. A dryad's thorns likewise leave her hand as her throw
//   lets go (combat.js throwAt).
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
// how long before a blow lands the attacker stops turning after you (a heavy one a little sooner): long enough to see it
// coming and step out of the way
const COMMIT = 0.3;
// drops: [item, min, max, chance]. fearFire: keeps out of the firelight (a lit fire within 7 m, or your lit torch);
// fury: once you hurt it, or its family, it fights through fire until the fight is over (c.angered); torchShy: your torch
// is no fire to it, but at its first sight of it in a fight it backs off that many seconds (c.torchSeen)
export const TYPES = {
  rabbit: { name: 'Rabbit', hp: [3, 5], speed: [3 * FT, 15 * FT], passive: true, flee: 10 * FT, r: 0.3, h: 0.6, hops: true, mob: [1, 3], drops: [['rawMeat', 1, 1, 1], ['leather', 1, 1, 0.5], ['sharpBone', 1, 1, 0.2]] },
  fox: { name: 'Fox', hp: [7, 9], speed: [8 * FT, 20 * FT], passive: true, flee: 15 * FT, r: 0.4, h: 0.6, mob: [1, 2], drops: [['rawMeat', 1, 2, 1], ['foxHide', 1, 2, 0.5], ['sharpBone', 1, 1, 0.2]] },
  deer: { name: 'Deer', hp: [10, 14], speed: [5 * FT, 25 * FT], passive: true, flee: 20 * FT, r: 0.6, h: 1.4, mob: [1, 2], drops: [['rawMeat', 3, 4, 1], ['leather', 4, 4, 1], ['sharpBone', 1, 2, 0.2], ['deerHide', 1, 2, 1]] },
  hog: { name: 'Hog', hp: [50, 65], speed: [8 * FT, 25 * FT], aggro: 10 * FT, retaliate: true, dmg: [8, 12, 'pierce'], reach: 1.6, fearFire: true, fury: true, r: 0.6, h: 0.9, mob: [1, 3], drops: [['rawMeat', 1, 3, 1], ['leather', 3, 3, 1], ['sharpBone', 1, 1, 0.2]] },
  dryadling: { name: 'Dryadling', hp: [15, 25], speed: [3 * FT, 15 * FT], sight: 18, dmg: [4, 6, 'slash'], reach: 1.4, fearFire: true, torchShy: 2, r: 0.35, h: 1.1, mob: [1, 3], weak: ['fire'], resist: ['poison'], drops: [['resin', 1, 2, 1], ['wood', 2, 4, 0.5]], blood: 0x6a8a3a },
  dryad: { name: 'Dryad', hp: [36, 44], block: 14, speed: [5 * FT, 12 * FT], sight: 24, dmg: [6, 8, 'slash'], ranged: { dmg: [4, 6, 'pierce'], range: 16, every: 4.5 }, reach: 1.7, r: 0.45, h: 2, mob: [2, 4], weak: ['fire'], resist: ['poison'], drops: [['resin', 1, 4, 1], ['wood', 2, 4, 1], ['dryadHeart', 1, 1, 0.2]], blood: 0x6a8a3a },
  giant: { name: 'Giant', hp: [550, 650], speed: [4 * FT, 18 * FT], sight: 30, dmg: [50, 70, 'blunt'], reach: 3.6, r: 1.2, h: 6, mob: [1, 1], weak: ['pierce'], resist: ['blunt'], heavy: true, drops: [['log', 1, 2, 1], ['stone', 2, 4, 1], ['giantHide', 1, 2, 1]], thunder: 'big' },
  skeleton: { name: 'Skeleton', hp: [35, 55], block: 20, speed: [6 * FT, 15 * FT], sight: 26, dmg: [20, 30, 'slash'], reach: 1.8, r: 0.4, h: 1.9, mob: [1, 3], weak: ['blunt'], resist: ['pierce', 'poison'], drops: [['sharpBone', 3, 5, 1]], blood: 0xd9cdb0,
    risen: { hp: 0.8, dmg: 0.6, pace: [0.55, 0.75] } },
};
// The dead a boss calls up (risen: summoned ones of a kind that has it): the Labyrinth's long dead, frailer and slower than
// Valtos's (hp, dmg: shares of the kind's; pace: each one's own share of its pace, so they come on unevenly). They claw
// up out of the ground over RISE seconds; at most ENGAGE of them come at you at once while the rest circle you a few
// metres out (HOLD), waiting their turn, and none while the boss is charging; each waits a while between its blows (GAP).
const RISE = 1.5, ENGAGE = 2, HOLD = [4.5, 6.5], GAP = [1.1, 2.1];
// A giant boss's body: how fast it turns walking and standing (rad/s: TYPES turn, or these), how fast it gathers speed
// and sheds it (m/s²: acc), and how hard it must be hit inside a few seconds to be staggered (poise, a share of its health)
const GIANT = { turn: [0.7, 0.9], acc: [2.2, 6], poise: 0.12 };
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
// what stops a giant boss: walls, columns and buildings, not the rubble of a ruin (low) or the trees and rocks it tramples
const BIG = (k) => !k.low && k.ref?.sp === undefined;
// ...and when going round would take it far out of its way, the stub of a broken wall no higher than its knee, which it
// strides over (steer)
const STRIDE = (k) => BIG(k) && !(k.h !== undefined && k.h < 3.6);
const alive = (c) => c && !c.dead && !c.gone;

export class Creatures {
  constructor(g) { this.g = g; this.list = []; this.t = 0; this.plates = new Map(); preloadBodies(); this.box = document.createElement('div'); this.box.id = 'plates'; document.getElementById('hud').appendChild(this.box); }
  spawn(type, x, z, o = {}) {
    const T = TYPES[type], level = o.level ?? (Math.random() < 0.12 ? (Math.random() < 0.25 ? 2 : 1) : 0), k = 1 + 0.25 * level;
    const body = makeBody(type, level, x, z, o.young, T.size, T.pace), y = Math.max(heightAt(x, z), -0.3), young = !!body.young, yk = young ? YOUNG_K : 1;
    body.obj.position.set(x, y, z); body.obj.rotation.order = 'YXZ'; body.obj.userData.nearShadow = true; this.g.scene.add(body.obj);   // (it moves: it casts into the near shadow map only, render/core.js)
    const c = { type, T: young ? youngOf(type) : T, body, level, young, dropK: yk, hp: rr(...T.hp) * k * yk, max: 0, pos: body.obj.position, yaw: Math.random() * 6.28, speed: 0, state: 'idle', t: Math.random() * 4, target: null, home: new THREE.Vector3(x, y, z),
      atkCd: rr(0.5, 1.5), rangedCd: rr(2, 4), hitT: 0, flash: 0, aware: !!o.aware, dmgK: k * yk, deadT: 0, boss: o.boss, summoned: o.summoned, vy: 0, stuck: 0, lastP: new THREE.Vector3(x, y, z) };
    if (o.summoned && T.risen) { const R = T.risen; c.hp *= R.hp; c.dmgK *= R.dmg; c.pace = rr(...R.pace); c.rise = RISE; c.slot = Math.random() * 6.283; c.spin = Math.random() < 0.5 ? -1 : 1; c.rattleT = rr(1, 3); this.g.sound?.('boneRise', { at: c.pos }); }
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
  rouse(c, st = c.state === 'attack' || c.state === 'throw' ? 'chase' : c.state) {
    for (const k of this.kin(c)) {
      if (k.state === st || k.state === 'attack' || k.state === 'throw' || (st === 'alert' && !calm(k))) continue;
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
    if (c.tired > 0) total *= c.T.tiredK ?? 1.5;   // (a boss spent and heaving for breath takes blows harder: trial.js)
    if (!c.aware && opts.backstab) { total *= opts.backstab; this.g.hud.toast('<b>Sneak attack!</b>'); }
    if (c.T.block && c.state === 'chase' && Math.random() < 0.25 && !opts.ranged) { total = Math.max(0, total - c.T.block); burst(c.pos.clone().setY(c.pos.y + c.T.h * 0.6), { color: 0xd8d0c0, n: 6, speed: 2 }); }
    c.hp -= total; c.flash = 1; c.aware = true;
    // (a giant doesn't flinch at every blow: only enough of them inside a few seconds stagger it, its poise, and never in
    // the middle of a move)
    if (!c.boss) c.hitT = 0.25; else if ((c.poise = (c.poise || 0) + total) >= c.max * (c.T.poise ?? GIANT.poise) && !c.move) { c.poise = 0; c.hitT = 0.9; }
    const at = c.pos.clone().setY(c.pos.y + c.T.h * 0.6);
    burst(at, { color: c.T.blood ?? 0x8a1a10, n: 8 + Math.min(12, total), speed: 2.6, size: 0.06 });
    this.g.hud.damageNumber?.(at, total);
    if (opts.knock && from && Math.random() < opts.knock && !c.T.heavy) { const d = c.pos.clone().sub(from).setY(0).normalize(); c.pos.addScaledVector(d, 0.8); }
    if (c.T.passive) { c.state = 'flee'; c.t = rr(5, 8); }
    else if (c.state !== 'attack') { c.state = 'chase'; c.retreat = false; }
    if (c.T.fury) for (const k of [c, ...this.kin(c)]) k.angered = true;   // (hurt one and the whole family stops minding the fire)
    this.rouse(c);   // (its family joins in)
    if (c.hp <= 0) this.kill(c);
    return total;
  }
  kill(c) {
    c.dead = true; c.state = 'dead'; c.deadT = 0; c.hp = 0; this.g.sound?.('kill'); c.crumble = c.type === 'skeleton';
    this.g.onKill?.(c);
  }
  // when a body has lain long enough: a small thunderclap, and it's gone, leaving its drops
  vanish(c) {
    const at = c.pos.clone().setY(c.pos.y + 0.5);
    dust(at, c.T.thunder === 'big' ? 30 : 14, 0xe8e8ff, c.T.thunder === 'big' ? 0.8 : 0.4); burst(at, { color: 0xbfd0ff, n: 16, speed: 4, size: 0.05, grav: -2 });
    if (c.pos.distanceTo(this.g.player.pos) < 25) { addShake(c.T.thunder === 'big' ? 0.5 : 0.15); this.g.flashSky?.(c.T.thunder === 'big' ? 0.5 : 0.18); }
    this.g.sound?.('thunder', c.T.thunder === 'big' ? 1.2 : 0.6, { at });
    // (what it leaves; the young less of each, but never none)
    if (!c.summoned) for (const [id, a, b, ch] of c.T.drops) if (Math.random() < ch) { const n0 = ri(a, b) * (1 + 0.25 * c.level), n = c.young ? Math.max(1, Math.round(n0 * c.dropK)) : Math.round(n0); if (n > 0) this.g.pickups.drop(id, n, c.pos.x + rr(-0.6, 0.6), c.pos.z + rr(-0.6, 0.6), { auto: true }, c.pos.y); }
    this.remove(c);
  }
  remove(c) { c.gone = true; this.g.scene.remove(c.body.obj); c.body.dispose(); this.list.splice(this.list.indexOf(c), 1); this.plates.get(c)?.remove(); this.plates.delete(c); }
  // ---- per frame
  update(dt) {
    const g = this.g, P = g.player, pp = P.pos;
    this.t -= dt; if (this.t <= 0) { this.t = 3; if (!g.S.peaceful) this.trySpawn(); }
    this.engage(pp);
    for (let i = this.list.length - 1; i >= 0; i--) {
      const c = this.list[i], T = c.T;
      if (c.dead && c.crumble) {   // a skeleton falls apart where it stands: its bones clatter down and it's gone (crumble)
        c.deadT += dt; if (!c.fell && c.deadT > 0.1) { c.fell = true; this.crumble(c); } if (c.deadT > 1.3) { if (c.summoned) this.remove(c); else this.vanish(c); } continue; }
      if (c.dead) { c.deadT += dt; c.body.animate('dead', 0, dt); c.flash = Math.max(0, c.flash - dt * 3); c.body.flash(c.flash); if (c.deadT > (T.heavy ? 3 : 2)) this.vanish(c); continue; }
      const d = c.pos.distanceTo(pp);
      if (d > 140 && !c.boss) { this.remove(c); continue; }
      c.t -= dt; c.atkCd -= dt; c.rangedCd -= dt; c.hitT -= dt; if (c.poise) c.poise = Math.max(0, c.poise - dt * c.max * 0.03); c.flash = Math.max(0, c.flash - dt * 4); c.body.flash(c.flash, c.glow);
      // decide
      if (P.dead && c.state === 'chase') c.state = 'idle';
      if (P.dead || calm(c)) c.angered = c.torchSeen = false;   // (the fight is over: it calmed down or lost you)
      // the fire it keeps away from: a lit one near it, or the torch in your hand (no fire to a dryadling, torchShy), and
      // none once it's angered (fury)
      const lit = !!g.torchLit?.(), fire = T.fearFire && !c.angered ? g.build?.nearFire(c.pos, 7) || (lit && !T.torchShy && d < 7 ? { pos: pp } : null) : null;
      // noticing you: a field of view in front, only hearing behind; sneaking halves it, sprinting is heard further
      if (!P.dead && calm(c)) {
        const base = T.passive ? T.flee : (T.sight || T.aggro || 0), range = base * this.senseK(c, pp, P) * (g.S.time > 0.75 && !T.passive ? 0.75 : 1);
        if (d < range) {
          // a moment of alarm first: it freezes, lifts its head and turns to look at you, then bolts (or charges)
          if (c.boss) { c.state = 'chase'; c.aware = true; }
          else { c.state = 'alert'; c.alertT = T.alert ?? (T.passive ? 1.2 : 0.7); c.alertD = d; c.aware = true; g.sound?.('alert', { at: c.pos, hostile: !T.passive }); this.rouse(c); }   // (a hostile one cries out, an animal only starts: sound.js)
        }
      }
      if (c.state === 'alert') {
        c.alertT -= dt; const P2 = P.pos, close = d < c.alertD * 0.55 || d < 1.5;   // rushing it cuts the moment short
        if (P.dead) c.state = 'idle';
        else if (c.alertT <= 0 || close || (P.sprinting && d < (T.flee || 8) * 1.2)) { if (T.passive) { c.state = 'flee'; c.t = rr(4, 7); } else { c.state = 'chase'; if (T.heavy) g.sound?.('roar', { at: c.pos, giant: true }); } this.rouse(c); }
        else if (d > (T.passive ? T.flee : (T.sight || T.aggro || 8)) * 1.6) { c.state = 'idle'; c.t = rr(2, 4); c.aware = false; }   // you backed off: it settles down
        void P2;
      }
      // a dryadling's first sight of your torch in a fight: it backs off a moment (torchShy), then comes on regardless
      if (T.torchShy && lit && !c.torchSeen && (c.state === 'chase' || c.state === 'alert') && d < (T.sight || 8)) { c.torchSeen = true; c.state = 'flee'; c.t = T.torchShy; c.retreat = true; }
      let want = 0, face = c.yaw, special = null;
      if (c.boss && !P.dead) special = g.trial?.bossThink(c, dt, d);
      const M = alive(c.mother) ? c.mother : null, brood = c.brood?.some(alive);
      if (c.summoned && c.state === 'chase' && !(c.rise > 0) && c.speed > 0.6 && (c.rattleT -= dt) <= 0) { c.rattleT = rr(1.8, 4); g.sound?.('boneRattle', { at: c.pos }); }   // (its bones clacking as it comes)
      if (c.state === 'flee') {
        // away from you, weaving (a hare jinks hard from side to side); the young after their mother, and she no faster than they can run
        let away = Math.atan2(c.pos.x - pp.x, c.pos.z - pp.z); if (M?.state === 'flee' && c.pos.distanceTo(M.pos) > 3) away = Math.atan2(M.pos.x - c.pos.x, M.pos.z - c.pos.z);
        face = away + (T.hops ? (Math.sin(c.t * 3.3) > 0 ? 0.6 : -0.6) : Math.sin(c.t * 2) * 0.4); want = T.speed[1] * (brood ? 0.85 : 1);
        if (c.retreat) { if (c.t <= 0) { c.state = 'chase'; c.retreat = false; } }   // (only backing off from your torch: then back at you)
        else if (c.t <= 0 && d > 25) { c.state = 'idle'; c.t = rr(2, 5); }
      } else if (c.state === 'chase' || c.state === 'attack') {
        const wp = g.structures?.navTarget?.(c.pos, pp) || pp;   // in the Labyrinth: round by the gaps in the rings (until it's broken)
        face = Math.atan2(wp.x - c.pos.x, wp.z - c.pos.z); want = T.speed[1] * (T.heavy ? 0.75 : 0.85) * (c.pace ?? 1);
        if (c.boss) face = this.steer(c, face, d, dt);   // (round what still stands between it and you)
        const wait = c.summoned && !c.engaged ? this.circle(c, pp, dt) : null; if (wait) { face = wait.face; want = wait.want; }   // (not its turn: round you at a distance)
        // won't come into the firelight (backing out of it, and striking nothing on the way)
        let shy = false; if (fire) { const away = Math.atan2(c.pos.x - fire.pos.x, c.pos.z - fire.pos.z); if (c.pos.distanceTo(fire.pos) < 6.5) { face = away; want = T.speed[0] * 1.5; shy = true; } else if (d < 9) want = 0; }
        const stopAt = T.reach + T.r * 0.5; if (!shy && !wait && d < stopAt + (c.boss ? 0 : c.speed * 0.25)) want = 0;   // (easing off in time, not running on into you)
        if (d < stopAt && !shy) { want = 0; if (c.atkCd <= 0 && !c.move && !(T.moves && c.boss) && !wait && !(c.rise > 0)) this.strike(c); }   // (a boss with moves of its own makes them: trial.js)
        if (T.ranged && c.state === 'chase' && d > 5 && d < T.ranged.range && c.rangedCd <= 0 && !c.move) { c.rangedCd = T.ranged.every + rr(-1, 1); this.strike(c, 'throw'); }
        if (d > 60 || (c.t < -30 && d > 30)) { c.state = 'idle'; c.t = rr(2, 4); }
      } else if (c.state === 'alert' || c.state === 'throw') {
        face = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z); want = 0;   // freeze and stare (or stand and throw)
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
      if (c.state === 'attack' || c.state === 'throw') {
        // the swing (or the throw) as its clip goes: it turns after you through the wind-up, then is committed (COMMIT
        // before the blow); the blow lands as the clip's does, if you're still within reach and in front of it
        const toP = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z); c.atkE += dt; want = 0; face = c.atkE < c.hitAt - (c.state === 'throw' ? 0.1 : T.heavy ? COMMIT * 1.4 : COMMIT) ? toP : c.yaw;
        if (c.state === 'throw' && !c.hitDone) g.combat.charge?.(c, c.atkE / c.hitAt);   // (the glow gathering in her hand)
        if (!c.hitDone && c.atkE >= c.hitAt) { c.hitDone = true;
          if (c.state === 'throw') this.throwThorn(c);
          else { const front = Math.abs(angDiff(toP, c.yaw)) < (T.heavy ? 1 : 0.75); c.blowAt = { e: c.atkE, hit: front && d < T.reach + T.r + 0.6 && !P.dead };
            const fall = c.pos.clone().addScaledVector(new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), c.boss ? T.reach * 0.8 : 3);
            if (c.blowAt.hit) g.combat.hitPlayer(c, T.dmg); else if (T.heavy) { dust(fall, c.boss ? 12 : 18, undefined, c.boss ? 0.6 : 0.35); addShake(c.boss ? 0.7 * this.near(c) : 0.3); }
            if (T.heavy) g.sound?.('slam', { at: fall, big: c.boss });   // (a giant's or the Minotaur's blow comes down like a slam, hit or miss)
            this.hitBuildings(c); } }
        if (c.atkE >= c.atkT) c.state = 'chase';
      }
      // rising out of the ground (a boss's dead): sunk at first, clawing its way up over RISE seconds, the earth bursting
      if (c.rise > 0) { c.rise -= dt; const k = 1 - Math.max(0, c.rise) / RISE; c.ctl = c.rise > 0 ? { want: 0, face: Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z), air: -T.h * 1.05 * (1 - k) ** 1.6 } : null; special = c.rise > 0 ? 'rise' : null;
        if (Math.random() < dt * 10 * (1 - k * 0.6)) { const a = Math.random() * 6.283, p = c.pos.clone(); p.x += Math.cos(a) * 0.4; p.z += Math.sin(a) * 0.4; p.y = this.groundAt(p.x, p.z, p.y) + 0.1; burst(p, { color: 0x5e4c3a, n: 3, speed: 2, size: 0.09, up: 3.5 }); if (Math.random() < 0.4) dust(p, 2, 0x7a6a56, 0.3); } }
      // a boss move in progress steers: its own speed and heading (snapped for a leap), how fast it may turn and gather or
      // shed speed, or a leap through the air
      const ctl = c.ctl; if (ctl) { want = ctl.want; if (ctl.face !== undefined) face = ctl.face; if (ctl.snap) c.yaw = face; if (ctl.want === 0 && !c.boss) c.speed *= 0.8; }
      // (a boss that found itself stuck walks off the way that's open for a moment: unstick)
      else if (c.free?.t > 0) { c.free.t -= dt; face = c.free.dir; want = Math.max(want, T.speed[1] * 0.55); }
      // move: turn towards the wanted heading, accelerate, follow the ground, avoid deep water and the storm. A giant boss
      // turns slowly, its weight swinging round (no faster than T.turn, slower walking than standing), and turns in an arc
      // as it walks, slowing for a sharp turn rather than spinning on the spot; it gathers speed over a few strides and
      // takes a while to stop (T.acc). Its body is told how fast it turns, so its feet step it round (models.js)
      const off = angDiff(face, c.yaw); let turn = off * Math.min(1, dt * (T.heavy ? 2.5 : 6));
      if (c.boss && !ctl?.snap) { const [tw, ts] = T.turn || GIANT.turn, lim = (ctl?.turn ?? (c.speed > 1.5 ? tw : ts)) * dt; turn = Math.max(-lim, Math.min(lim, turn)); if (!ctl && Math.abs(off) > 0.7) want *= Math.max(0.3, Math.cos(off)); }
      c.yaw += turn; c.body.turn = dt > 0 ? turn / dt : 0;
      if (c.boss) { const [up, dn] = T.acc || GIANT.acc; c.speed += Math.max(-(ctl?.dec ?? dn) * dt, Math.min((ctl?.acc ?? up) * dt, want - c.speed)); }
      else c.speed += (want - c.speed) * Math.min(1, dt * (T.hops ? 9 : 4));   // (a hare is off, or stopped, at once)
      if (c.hitT > 0) c.speed *= c.boss ? 1 - Math.min(1, dt * 3) : 0.5;
      if (c.shove?.t > 0) { const k = Math.min(dt, c.shove.t) / c.shove.d; c.shove.t -= dt; c.pos.x += c.shove.x * k; c.pos.z += c.shove.z * k; }   // (unstick: shouldered free over a moment)
      const nx = ctl?.at ? ctl.at.x : c.pos.x + Math.sin(c.yaw) * c.speed * dt, nz = ctl?.at ? ctl.at.z : c.pos.z + Math.cos(c.yaw) * c.speed * dt, nh = heightAt(nx, nz);
      if (nh > (T.heavy ? -1.2 : 0.2) && stormWallDepth(nx, nz) === 0) { c.pos.x = nx; c.pos.z = nz; } else { c.wanderYaw = c.yaw + Math.PI; c.speed *= 0.3; if (c.state === 'flee') c.yaw += 1; }
      // room for each: they don't stand in one another or in you (a family or a herd spreads round you rather than into one spot)
      if (!c.boss && !T.heavy) {
        for (const o of this.list) { if (o === c || o.dead) continue; const dx = c.pos.x - o.pos.x, dz = c.pos.z - o.pos.z, need = (T.r + o.T.r) * (c.summoned && o.summoned ? 2.2 : 0.75), dd = dx * dx + dz * dz;   // (a boss's dead keep an arm's length apart)
          if (dd < need * need && dd > 1e-6) { const q = (need / Math.sqrt(dd) - 1) * 0.5; c.pos.x += dx * q; c.pos.z += dz * q; } }
        const dx = c.pos.x - pp.x, dz = c.pos.z - pp.z, need = 0.4 + T.r * 0.7, dd = dx * dx + dz * dz;
        if (!P.dead && dd < need * need && dd > 1e-6 && Math.abs(c.pos.y - pp.y) < 1.5) { const q = need / Math.sqrt(dd) - 1; c.pos.x += dx * q; c.pos.z += dz * q; }
      }
      g.colliders.resolve(c.pos, T.r * 0.8, c.pos.y, c.boss ? (c.stride ? STRIDE : BIG) : undefined);   // (a giant boss steps over rubble and through the undergrowth)
      if (c.boss && !P.dead) this.shoulder(c, pp);
      const fl = Math.max(this.groundAt(c.pos.x, c.pos.z, c.pos.y), -0.4); if (ctl?.air !== undefined) c.pos.y = fl + ctl.air; else c.pos.y += (fl - c.pos.y) * Math.min(1, dt * 12);
      // stuck against a wall while chasing: hit it (a boss works its way free instead: unstick)
      if (c.boss) this.unstick(c, want, dt);
      c.stuck = c.pos.distanceTo(c.lastP) < 0.05 * dt * 60 && want > 0.5 ? c.stuck + dt : 0; c.lastP.copy(c.pos);
      if (c.stuck > 1.2 && (c.state === 'chase') && c.atkCd <= 0 && !c.boss && (!c.summoned || c.engaged)) { this.strike(c); c.stuck = 0; }
      c.body.obj.rotation.y = c.yaw;
      // four-footed creatures lie along the slope they stand on: nose up a hill, down it going down
      if (QUAD.has(c.type)) { const e = T.r * 1.3 + 0.3, fx = Math.sin(c.yaw) * e, fz = Math.cos(c.yaw) * e, rise = this.groundAt(c.pos.x + fx, c.pos.z + fz, c.pos.y) - this.groundAt(c.pos.x - fx, c.pos.z - fz, c.pos.y);
        c.pitch = (c.pitch || 0) + (-Math.atan2(rise, 2 * e) * (ctl?.air !== undefined ? 0 : 1) - (c.pitch || 0)) * Math.min(1, dt * 8); c.body.obj.rotation.x = c.pitch; }
      c.body.animate(special && special !== 'run' ? special : c.state === 'attack' || c.state === 'throw' ? c.state : c.hitT > 0 ? 'hit' : c.state, c.speed, dt);
      c.body.feet?.(dt, this.groundFn ||= (x, z, y) => this.groundAt(x, z, y), c.pos.y, ctl?.air === undefined && c.hitT <= 0);
      if (c.boss && ctl?.air === undefined) for (const p of c.body.footfalls?.(dt) || []) this.stomp(c, p);
    }
    this.updatePlates();
  }
  // ---- a boss's dead: whose turn it is to come at you. Those already swinging keep it, then the nearest, up to ENGAGE;
  // none while the boss charges (they keep out of its way and leave you to dodge it)
  engage(pp) {
    const boss = this.g.trial?.boss, charging = boss && boss.move?.k === 'charge' && boss.move.ph >= 1, hs = this.list.filter((c) => c.summoned && !c.dead && !(c.rise > 0));
    hs.sort((a, b) => (b.state === 'attack') - (a.state === 'attack') || a.pos.distanceTo(pp) - b.pos.distanceTo(pp)); hs.forEach((c, i) => { c.engaged = !charging && i < ENGAGE; });
  }
  // ...the others circle you, each at its own place on a ring a few metres out (slot, drifting round its own way: spin,
  // the ring's radius breathing in and out a little), facing you once there; returns the heading and speed for it
  circle(c, pp, dt) {
    c.slot += c.spin * dt * 0.22; const R = HOLD[0] + (HOLD[1] - HOLD[0]) * (0.5 + 0.5 * Math.sin(c.slot * 1.7)), dx = pp.x + Math.sin(c.slot) * R - c.pos.x, dz = pp.z + Math.cos(c.slot) * R - c.pos.z, l = Math.hypot(dx, dz);
    const d = Math.hypot(c.pos.x - pp.x, c.pos.z - pp.z); if (d < HOLD[0] - 1) return { face: Math.atan2(c.pos.x - pp.x, c.pos.z - pp.z), want: c.T.speed[1] * 0.5 * (c.pace ?? 1) };   // (too close: backing off first)
    return l > 0.8 ? { face: Math.atan2(dx, dz), want: Math.min(c.T.speed[1] * 0.8 * (c.pace ?? 1), l * 1.2) } : { face: Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z), want: 0 };
  }
  // A skeleton's end: it falls apart, its bones and skull clattering down round where it stood, a puff of grave-dust
  crumble(c) {
    const at = c.pos.clone(); c.body.obj.visible = false;
    for (const [y, n, s] of [[1.5, 6, 0.13], [1.1, 10, 0.1], [0.6, 12, 0.09], [0.2, 8, 0.12]]) burst(at.clone().setY(at.y + y), { color: 0xd9cdb0, n, speed: 2.2, size: s, life: 1.6, grav: 16, up: 1.5, spread: 0.6 });
    burst(at.clone().setY(at.y + 1.7), { color: 0xe6dcc4, n: 1, speed: 1, size: 0.26, life: 1.8, grav: 14, up: 2 });   // (the skull)
    dust(at.clone().setY(at.y + 0.6), 10, 0xb8ab90, 0.4); this.g.sound?.('boneCrumble', { at });
  }
  // ---- a giant boss finding its way. Its body is a capsule along its heading (T.body: from how far behind its middle to
  // how far in front) as thick as T.r; gap() is how far a point is from the line down its middle, and the nearest point on it.
  gap(c, x, z) {
    const [b0, b1] = c.T.body || [0, 0], fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), t = Math.max(b0, Math.min(b1, (x - c.pos.x) * fx + (z - c.pos.z) * fz));
    const px = c.pos.x + fx * t, pz = c.pos.z + fz * t; return { d: Math.hypot(x - px, z - pz), x: px, z: pz };
  }
  // how far it could go along heading a before something solid stands in its way (three rays: its middle and its flanks)
  clearTo(c, a, look, filter = BIG) {
    const dx = Math.sin(a), dz = Math.cos(a), w = c.T.r * 0.6; let best = look;
    for (const o of [0, -w, w]) { const k = this.g.colliders.pick(c.pos.x + dz * o, c.pos.z - dx * o, dx, dz, look, filter); if (k) best = Math.min(best, Math.max(0, (k.x - c.pos.x) * dx + (k.z - c.pos.z) * dz - k.r)); }
    return best;
  }
  // Round what still stands between it and where it's going (a wall's stub, a column, the altar): the heading nearest the
  // one it wants whose way is open for a body's length, going round the same side as the last time for a couple of
  // seconds after (sideT), so it doesn't dither from one side of a stub to the other
  steer(c, face, d, dt) {
    c.sideT = Math.max(0, (c.sideT || 0) - dt); if (!c.sideT) c.side = 0; c.stride = false;
    const look = Math.min(d, c.T.r * 2 + 6), open = (a, f) => this.clearTo(c, a, look, f) >= look - 0.5; if (look < c.T.r + 1 || open(face)) return face;
    const sides = c.side ? [c.side, -c.side] : Math.random() < 0.5 ? [1, -1] : [-1, 1];
    for (const off of [0.35, 0.7, 1.05]) for (const s of sides) if (open(face + s * off)) { c.side = s; c.sideT = 2; return face + s * off; }
    if (open(face, STRIDE)) { c.stride = true; return face; }   // (rather than a long way round: over the wall's stub)
    for (const off of [1.4, 1.8, 2.3]) for (const s of sides) if (open(face + s * off)) { c.side = s; c.sideT = 2; return face + s * off; }
    c.stride = true; return face;
  }
  // Stuck: it wants to go but has hardly moved for half a second (c.jam): it walks off a moment the way that's most open,
  // leaning towards you; still stuck after a second and a half, it shoulders a couple of metres that way over half a
  // second (c.shove), so it is never pinned for longer than that. Against a building of yours it strikes it instead.
  unstick(c, want, dt) {
    const moved = Math.hypot(c.pos.x - c.lastP.x, c.pos.z - c.lastP.z), busy = c.ctl || c.state !== 'chase';
    c.jam = !busy && want > 1 && moved < Math.max(c.speed, 1) * dt * 0.3 ? (c.jam || 0) + dt : Math.max(0, (c.jam || 0) - dt * 2);
    if (c.jam < 0.5) return;
    const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw)), wall = this.g.colliders.pick(c.pos.x, c.pos.z, f.x, f.z, c.T.r + 1.5, (k) => k.ref?.piece);
    if (wall && c.atkCd <= 0) { this.strike(c); c.jam = 0; return; }
    const pp = this.g.player.pos, toP = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z); let best = toP, bs = -1e9;
    for (let i = 0; i < 16; i++) { const a = toP + (i / 16) * Math.PI * 2, sc = this.clearTo(c, a, 10) + 3 * Math.cos(angDiff(a, toP)); if (sc > bs) { bs = sc; best = a; } }
    if (!(c.free?.t > 0)) c.free = { dir: best, t: 1.1 };
    if (c.jam > 1.5) { c.shove = { x: Math.sin(best) * 2, z: Math.cos(best) * 2, t: 0.5, d: 0.5 }; c.jam = 0.5; }
  }
  // you don't stand inside a giant: it shoulders you aside
  shoulder(c, pp) {
    const T = c.T, q = this.gap(c, pp.x, pp.z), need = T.r * 0.75; if (q.d >= need || Math.abs(pp.y - c.pos.y) > T.h * 0.5) return;
    const dx = pp.x - q.x, dz = pp.z - q.z, l = Math.hypot(dx, dz);
    if (l > 1e-3) { pp.x = q.x + (dx / l) * need; pp.z = q.z + (dz / l) * need; } else { pp.x = q.x + Math.cos(c.yaw) * need; pp.z = q.z - Math.sin(c.yaw) * need; }
  }
  // A boss's foot coming down: a deep thud from where it lands, a puff of dust, and the ground trembling under you near it
  stomp(c, p) {
    const near = Math.max(0, 1 - c.pos.distanceTo(this.g.player.pos) / 50), k = c.T.size / 3.3;
    this.g.sound?.('giantStep', { at: p, k }); if (near > 0) addShake(0.42 * near * near * k);
    dust(p.setY(Math.max(p.y, c.pos.y) + 0.1), 2, 0x7a6c5c, 0.35 * k);
  }
  // what a creature stands on: the ground, or a floor or a site's steps within reach
  groundAt(x, z, y) { const g = this.g; return Math.max(groundAt(x, z), g.build?.floorAt(x, z, y) ?? -1e9, g.structures?.floorAt(x, z, y) ?? -1e9); }
  hitBuildings(c) {
    const B = this.g.build; if (!B) return; const f = new THREE.Vector3(Math.sin(c.yaw), 0, Math.cos(c.yaw));
    const hit = this.g.colliders.pick(c.pos.x, c.pos.z, f.x, f.z, c.T.reach + c.T.r, (k) => k.ref?.piece); if (hit) B.damage(hit.ref.piece, rr(c.T.dmg[0], c.T.dmg[1]) * c.dmgK * (c.T.heavy ? 2 : 1));
  }
  throwThorn(c) { this.g.combat?.throwAt(c, c.T.ranged.dmg, { from: c.body.hand?.() }); }
  // A blow (or a throw: kind) taken up: its timing from the body's clip (models.js cue), or a quick one while the body
  // isn't in yet. atkE counts up from the start; the blow lands at hitAt, the move is over at atkT, and the next can't
  // start until it is.
  strike(c, kind = 'attack') {
    const T = c.T, q = c.body.cue?.(kind) || { hit: T.heavy ? 0.65 : 0.3, dur: T.heavy ? 1.1 : 0.55 };
    c.state = kind; c.atkE = 0; c.hitAt = q.hit; c.atkT = q.dur; c.hitDone = false; c.blowAt = null;
    if (kind === 'attack') c.atkCd = q.dur + (T.heavy ? rr(1, 1.6) : rr(0.4, 1)) + (c.summoned && T.risen ? rr(...GAP) : 0); else this.g.sound?.('thornCast', this.near(c));
    return q;
  }
  // how loud something a creature does is where you stand (full within 6 m, gone by 40)
  near(c) { return Math.max(0, Math.min(1, 1 - (c.pos.distanceTo(this.g.player.pos) - 6) / 34)); }
  // creatures in an arc in front of a point (for melee)
  inArc(from, yaw, reach, arc = 1.1) {
    const out = [];
    for (const c of this.list) { if (c.dead) continue; const q = c.T.body ? this.gap(c, from.x, from.z) : c.pos, dx = q.x - from.x, dz = q.z - from.z, d = Math.hypot(dx, dz) - c.T.r; if (d > reach) continue; if (Math.abs(angDiff(Math.atan2(dx, dz), yaw)) > arc && d > 0.5) continue; if (Math.abs(c.pos.y - from.y) > c.T.h + 1.5) continue; out.push(c); }
    return out;
  }
  // ---- health bars over creatures that are hurt or hunting you
  updatePlates() {
    const P = this.g.player.pos, v = new THREE.Vector3();
    const show = this.list.filter((c) => !c.dead && (c.hp < c.max || c.state === 'chase' || c.state === 'attack' || c.state === 'throw' || c.boss) && c.pos.distanceTo(P) < 30).slice(0, 8);
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
