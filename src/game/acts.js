// The hero's doings that take a moment: eating, praying at Zeus's altar, kneeling with a tribute or a head, sitting on
// the ground (by a fire it rests you), lying down in bed and getting up again, the gestures (wave, cheer), the kick,
// bending to pick something up, tossing something away, the hammer's blow as a piece goes up. Each is one of the hero's
// actions (player/hero.js action) with the game's side of it: what it costs, when its effect lands, what breaks it off.
// Nothing here can leave the player stuck: every pose ends by itself, on a move, on a hard blow, at death or a
// teleport (the seat goes: player.spawn), and nothing is used up or granted before its moment, so a save at any point
// keeps the game whole.
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { input, hit } from '../input.js';
import { burst, addShake } from '../render/fx.js';
import { smooth } from '../util/math.js';

// Eating: a slice of the drinking clip (the hand comes up, stays at the mouth, goes down), upper body only, walking at
// half speed; the food counts once it's done. A strike, the guard raised or a blow this hard breaks it off, the food kept
const EAT = { time: 2.4, from: 2.0, to: 5.6, lock: 0.5, hurt: 8 };
// Praying at the altar: kneeling this long before Zeus answers (then a moment more before getting up)
const PRAY = { time: 3.6, after: 0.9 };
// Sitting: this long by a burning fire rests you (Rested for rest seconds, half a night in bed)
const SIT = { rest: 20, rested: 600 };
// The kick: stamina, the clip's speed, when in it the foot lands (s), how far it reaches, the blow, how far a small
// creature is shoved back (m) and over how long (s)
const KICK = { cost: 10, rate: 1.25, at: 0.36, reach: 1.9, dmg: [[4, 'blunt']], shove: 1.6, shoveT: 0.25 };
// Bending to pick something up (a stretch of the clip, played fast), the toss (the moment the hand lets go, s, and how
// far ahead the thing lands, m), the hammer's blow (a stretch of the axe's chop)
const PICK = { from: 1.0, to: 4.4, rate: 4.2 };
const TOSS = { from: 0.1, to: 1.75, rate: 1.35, at: (0.88 - 0.1) / 1.35, far: 2.0 };
const HAMMER = { from: 0.25, to: 1.25, rate: 1.6 };
// The bed (build/pieces.js: 1.1 × 2.1, the pillow at its -z end): how high the body lies on it (when its top can't be
// found: bedTop), where the head goes
// along it, and the sleeping clip's way of lying: curled on the side, the head off to the right and a little ahead of
// the body's root, this far from it. Getting up, the hero sits up facing the bed's side and steps off it, this much
// further out than the clip's own travel takes him
const BED = { top: 0.5, pillow: -0.72, head: Math.atan2(-0.64, 0.36), len: 0.73, off: 0.45 };

export class Acts {
  constructor(g) { this.g = g; this.pose = null; this.eating = null; this.later = []; this.shoves = []; }
  get P() { return this.g.player; }
  get H() { return this.g.player.hero; }
  // free to start something: alive, standing on something, not swimming, rolling or already posed
  free() { const P = this.P; return !P.dead && !P.swimming && P.onGround && !P.dodge && !this.pose; }
  // Hold the hero in a seat (player.js), posed by an action; the seat lets go when the pose ends
  seatIn(kind, act, o, seat) {
    const P = this.P; this.endPose();
    const s = { x: P.pos.x, z: P.pos.z, yaw: P.yaw, ...seat, leave: (why) => this.leave(why) };
    P.seat = s; return (this.pose = { kind, h: this.H.action(act, o), seat: s, t: 0 });
  }
  // End whatever pose is held, at once (another takes its place, death, a teleport)
  endPose(fade = 0.3) {
    const p = this.pose; if (!p) return; this.pose = null;
    p.h?.stop(fade); p.wake?.stop(fade); if (this.P.seat === p.seat) this.P.seat = null;
    if (p.kind === 'pray') this.g.hud.progress(null);
  }
  // Trying to move or jump while posed: stand up from sitting, give up a prayer, rise from kneeling (asleep and getting
  // up, the move waits)
  leave(why) {
    const p = this.pose; if (!p) return;
    if (p.kind === 'sit') this.stand();
    else if (p.kind === 'pray') { p.onCancel?.(why); this.rise(); }
    else if (p.kind === 'kneel') this.rise();
  }
  rise() { this.endPose(0.6); }
  // A blow landed on you (combat.hitPlayer): a hard one breaks off eating, praying or sitting
  hurt(dmg) {
    if (dmg < Math.min(EAT.hurt, this.P.stats.maxHealth * 0.15)) return;
    if (this.eating) this.stopEat('hit');
    const p = this.pose; if (p?.kind === 'sit') this.stand(); else if (p?.kind === 'pray' || p?.kind === 'kneel') this.leave('hit');
  }
  reset() { this.endPose(0); if (this.eating) this.stopEat(); }

  // ---- eating (the hotbar, or right click in the pack): checked first, eaten when it's done
  eat(i) {
    const g = this.g, P = this.P, s = g.inv.slots[i], d = s && ITEMS[s.id]; if (!d?.food || P.dead) return;
    if (this.eating) return;   // (one mouthful at a time)
    const why = P.stats.canEat(s.id, d.food); if (why) { g.hud.toast(`${d.name}: ${why}`); return; }
    this.eating = { id: s.id, def: d, t: 0, h: this.H.action('drink', { upper: true, layer: true, from: EAT.from, to: EAT.to, rate: (EAT.to - EAT.from) / EAT.time, lock: EAT.lock, blend: 0.25, fade: 0.35, quiet: true }) };
  }
  stopEat(why) {
    const e = this.eating; if (!e) return; this.eating = null; e.h.stop(0.3); this.g.hud.progress(null);
    if (why === 'hit' || why === 'strike') this.g.hud.toast(`You stop eating. The ${e.def.name.toLowerCase()} is still in your pack.`);
  }
  eatStep(dt) {
    const e = this.eating, g = this.g, P = this.P; if (!e) return;
    if (P.swing > 0 || P.blocking) { this.stopEat('strike'); return; }
    if (P.swimming || !g.inv.count(e.id)) { this.stopEat(); return; }   // (in the water, or the food left the pack meanwhile)
    e.t += dt; g.hud.progress(e.t / EAT.time, `Eating ${e.def.name.toLowerCase()}`, e.def.icon);
    if (e.t < EAT.time) return;
    this.stopEat();
    const d = e.def, why = P.stats.eat(e.id, d.food); if (why) { g.hud.toast(`${d.name}: ${why}`); return; }
    g.inv.take(e.id, 1); g.hud.toast(d.food.health < 0 ? `That ${d.name.toLowerCase()} made you sick` : `Ate ${d.name.toLowerCase()}`);
  }

  // ---- praying and kneeling, facing at (a Vector3). pray: kneel time seconds, the ring filling and a glow rising off
  // the altar, then onDone (Zeus answers); moving first calls onCancel. kneel: the same pose for a while, nothing hangs on
  // it (a tribute laid, a head offered); time undefined: until rise()
  pray(at, { time = PRAY.time, onDone, onCancel } = {}) {
    if (this.P.dead || this.P.swimming) return false;
    if (this.eating) this.stopEat();
    const p = this.kneelPose(at, 'pray'); Object.assign(p, { at, time, onDone, onCancel, glowT: 0 }); return true;
  }
  kneel(at, time) { if (this.P.dead || this.P.swimming) return; const p = this.kneelPose(at, 'kneel'); p.end = time; }
  kneelPose(at, kind) {
    const P = this.P, yaw = Math.atan2(at.x - P.pos.x, at.z - P.pos.z);
    return this.seatIn(kind, 'pray', { upper: false, loop: true, lock: true, feet: false, blend: 0.7, fade: 0.6 }, { yaw, ease: 5 });
  }
  prayStep(p, dt) {
    const k = Math.min(1, p.t / p.time);
    this.g.hud.progress(k, 'Praying to Zeus', 'zeus');
    // a glow gathering over the altar as the prayer goes on
    if ((p.glowT -= dt) <= 0) { p.glowT = 0.3; burst(p.at.clone().setY(p.at.y + 1.2), { color: 0xffe08a, n: 2 + Math.round(k * 8), speed: 0.5 + k, size: 0.05 + k * 0.03, grav: -1.5 - k * 2, life: 1.3, up: 1 }); }
    if (k < 1) return;
    this.g.hud.progress(null); p.kind = 'kneel'; p.end = p.t + PRAY.after; p.onDone?.();
  }

  // ---- sitting on the ground (Z), facing a fire if one burns close by; any move stands you up
  sit() {
    const g = this.g, P = this.P; if (!this.free() || P.speed > 3 || !this.H.has('sit')) return;
    const f = g.build.nearFire(P.pos, 4), yaw = f ? Math.atan2(f.pos.x - P.pos.x, f.pos.z - P.pos.z) : P.yaw;
    const p = this.seatIn('sit', 'sit', { upper: false, loop: true, lock: true, feet: false, blend: 0.6, fade: 0.3 }, { yaw }); p.rest = 0;
  }
  // from sitting to your feet: the second half of getting up off the ground, carried along by its own travel
  stand() {
    const p = this.pose; if (p?.kind !== 'sit') return;
    p.kind = 'stand'; p.seat.ease = 20; p.h.stop(0.3);
    p.h = this.H.action('getUp', { upper: 'auto', layer: true, from: 4.05, to: 7.0, rate: 1.9, root: 'move', feet: false, lock: true, lockFor: 0.8, blend: 0.3, fade: 0.35 });
  }
  // sitting by a burning fire a while rests you, as a night in bed does (for less long)
  sitStep(p, dt) {
    const S = this.P.stats; if (!S.has('nearFire') || p.rested) return;
    if ((p.rest += dt) < SIT.rest) return;
    p.rested = true; if ((S.cond.rested || 0) < SIT.rested) { S.add('rested', SIT.rested); this.g.hud.toast('Resting by the fire, you feel <b>rested</b>'); }
  }

  // ---- sleeping (build.js sleep): lie down on the bed, the night passes (night()), then get up off its side
  sleep(bed, night) {
    const g = this.g, P = this.P; this.endPose(0);
    if (P.dead || P.swimming || !this.H.has('sleep') || !this.H.has('getUp')) { g.hud.sleep(night); return; }
    const r = bed.rot, ax = new THREE.Vector3(Math.sin(r), 0, Math.cos(r)), head = bed.pos.clone().addScaledVector(ax, BED.pillow), root = head.addScaledVector(ax, BED.len);
    // (the head lies toward the pillow: the bed's -z, which is the way rot + π points)
    const top = this.bedTop(bed, root);
    const p = this.seatIn('sleep', 'sleep', { upper: false, loop: true, lock: true, feet: false, blend: 0.9, fade: 0.6 }, { x: root.x, z: root.z, yaw: r + Math.PI - BED.head, lift: top, ease: 4, liftEase: 3 });
    p.top = top;
    g.hud.sleep(() => { night(); if (this.pose === p) this.wake(p); });
  }
  // How high the bed's top lies at (a point on it) over its foot: straight down onto what's drawn of it (the pack's low
  // pallet, or the carved bed: the carved shape stays for aiming, unseen, under the pack's), a little sunk into it
  bedTop(bed, at) {
    const list = []; bed.obj.traverse((m) => { if (!m.isMesh) return; for (let o = m; o; o = o.parent) if (!o.visible) return; list.push(m); });
    const hitAt = new THREE.Raycaster(new THREE.Vector3(at.x, bed.pos.y + 3, at.z), new THREE.Vector3(0, -1, 0), 0, 4).intersectObjects(list, false)[0];
    return hitAt ? Math.max(0, hitAt.point.y - bed.pos.y - 0.03) : BED.top;
  }
  // From lying curled on the side to sitting up facing the bed's side (the legs swung over it), then onto your feet:
  // the getting-up clip blended in over the sleeping one, which stays until it's fully in
  wake(p) {
    p.kind = 'wake'; p.seat.ease = 20; p.t = 0;
    p.wake = this.H.action('getUp', { upper: false, layer: true, from: 3.9, to: 7.2, rate: 1.15, root: 'move', feet: false, lock: true, blend: 1.0, fade: 0.4 });
    p.out = 0;
  }
  wakeStep(p) {
    const h = p.wake, s = p.seat;
    if (p.t > 1.05 && p.h && !p.h.end) p.h.stop(0);   // (the sleeping pose goes once the getting up is fully in)
    if (!h.C.ready && p.t > 4.5) { this.endPose(); return; }   // (the clip never came)
    // down off the mattress as the hips rise, a step further out than the clip's own travel
    const k = smooth(4.5, 5.9, h.time); s.lift = p.top * (1 - k); s.liftNow = s.lift;
    const out = BED.off * k - p.out; p.out += out; s.x += Math.sin(s.yaw) * out; s.z += Math.cos(s.yaw) * out;
    if (h.time >= 6.2 || h.done) { if (this.P.seat === s) this.P.seat = null; this.pose = null; }   // (on your feet: the rest of the clip plays out)
  }

  // ---- gestures: a wave (G; the owl's farewell), a cheer (H; a boss down)
  wave() {
    const P = this.P, p = this.pose; if (P.dead || P.swimming || (p && p.kind !== 'sit') || !this.H.has('wave')) return;
    const h = this.H.action('wave', { upper: p ? true : 'auto', layer: !!p, loop: true, blend: 0.3, fade: 0.4, quiet: true });
    this.later.push({ t: 2.1, fn: () => h.stop() });
  }
  cheer() {
    if (!this.free() || !this.H.has('victory')) return;
    this.H.action('victory', { upper: 'auto', from: 0.3, to: 4.2, rate: 1.15, blend: 0.3, fade: 0.5, quiet: true });
  }

  // ---- the kick (Q): a shove with the foot. Little damage, but a small creature is pushed back and staggered
  kick() {
    const g = this.g, P = this.P, H = this.H;
    if (!this.free() || P.swing > 0 || H.moveK < 0.9 || P.aiming || P.blocking || !H.has('kick')) return;
    if (!P.stats.use(KICK.cost, 'unarmed')) { g.hud.toast('Too tired to kick'); return; }
    P.yaw = Math.atan2(-Math.sin(P.camYaw), -Math.cos(P.camYaw));
    H.action('kick', { upper: false, root: 'keep', rate: KICK.rate, blend: 0.08, fade: 0.25, lock: true, lockFor: 0.75 });
    g.sound?.('jump');
    this.later.push({ t: KICK.at, fn: () => {
      if (P.dead) return; const c = g.creatures.inArc(P.pos, P.yaw, KICK.reach, 0.8)[0]; if (!c) return;
      g.creatures.hurt(c, KICK.dmg, P.pos, { k: P.stats.damageK('unarmed') }); P.stats.train('unarmed', 6); addShake(0.2); g.sound?.('hit');
      if (!c.T.heavy && !c.boss && c.T.r <= 0.9 && !c.dead) { c.hitT = 0.7; const d = c.pos.clone().sub(P.pos).setY(0).normalize(); this.shoves.push({ c, d, left: KICK.shoveT }); }
    } });
  }

  // ---- small things: bending to pick something up (E on a pickup), tossing something out of the pack (it leaves your
  // hand at the throw's release: release() takes it out of the pack then), the hammer's blow as a piece goes up
  reach() {
    const P = this.P; if (P.speed > 2.5 || !P.onGround || P.swimming || this.pose || P.swing > 0 || !this.H.has('pickUp')) return;
    this.H.action('pickUp', { upper: 'auto', layer: true, from: PICK.from, to: PICK.to, rate: PICK.rate, blend: 0.12, fade: 0.22, lock: 0.6, lockFor: 0.45, quiet: true });
  }
  toss(release) {
    const P = this.P; if (P.dead || P.swimming || this.pose || !this.H.has('throw')) { release(TOSS.far * 0.6); return; }
    this.H.action('throw', { upper: 'auto', layer: true, from: TOSS.from, to: TOSS.to, rate: TOSS.rate, blend: 0.15, fade: 0.3, quiet: true });
    this.later.push({ t: TOSS.at, fn: () => release(TOSS.far) });
  }
  hammer(at) {
    const P = this.P; if (P.dead || P.swimming || this.pose || !this.H.has('chop')) return;
    if (P.speed < 0.3 && at) P.yaw = Math.atan2(at.x - P.pos.x, at.z - P.pos.z);
    this.H.action('chop', { upper: true, layer: true, from: HAMMER.from, to: HAMMER.to, rate: HAMMER.rate, blend: 0.08, fade: 0.2, quiet: true });
  }

  // ---- per frame (game.update, first: it runs with the pack open too)
  update(dt) {
    const g = this.g, P = this.P;
    // things timed off an action (a toss's release, a kick landing), and creatures being shoved back
    for (const l of [...this.later]) if ((l.t -= dt) <= 0) { this.later.splice(this.later.indexOf(l), 1); l.fn(); }
    for (const s of [...this.shoves]) { const k = Math.min(dt, s.left); s.left -= dt; s.c.pos.addScaledVector(s.d, (KICK.shove / KICK.shoveT) * k); if (s.left <= 0 || s.c.dead) this.shoves.splice(this.shoves.indexOf(s), 1); }
    if (P.dead) { this.reset(); return; }
    const p = this.pose;
    if (p && P.seat !== p.seat) this.endPose();   // (the seat went: a teleport, a respawn)
    else if (p) {
      p.t += dt;
      if (p.kind === 'pray') this.prayStep(p, dt);
      else if (p.kind === 'kneel' && p.end !== undefined && p.t >= p.end) this.rise();
      else if (p.kind === 'sit') this.sitStep(p, dt);
      else if (p.kind === 'stand' && (p.h.time >= 5.7 || p.h.done)) { if (P.seat === p.seat) P.seat = null; this.pose = null; }
      else if (p.kind === 'wake') this.wakeStep(p);
      else if (p.kind === 'sleep' && p.t > 15) this.wake(p);   // (the night should have passed long since)
    }
    this.eatStep(dt);
    // the keys: Z sit or stand, G wave, H cheer, Q kick
    if (input.uiOpen || g.owl?.open) return;
    if (hit('KeyZ')) { if (this.pose?.kind === 'sit') this.stand(); else if (!this.pose) this.sit(); }
    if (hit('KeyG')) this.wave();
    if (hit('KeyH')) this.cheer();
    if (hit('KeyQ')) this.kick();
  }
}
