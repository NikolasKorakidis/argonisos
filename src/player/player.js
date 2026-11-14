// The player: third-person movement with momentum, sprinting and jumping that cost stamina, swimming, collisions with
// trees, rocks and buildings, the storm wall's push-back, and the orbit camera.
import * as THREE from 'three';
import { camera } from '../render/core.js';
import { groundAt } from '../world/groundcut.js';
import { colliders } from '../world/colliders.js';
import { stormWallDepth, stormWallOut } from '../world/stormwall.js';
import { climbable, climbLimit } from '../world/gen.js';
import { input, down, hit } from '../input.js';
import { Hero, strikeOf } from './hero.js';
import { RUN, SPRINT, SWIM, SNEAK, AIM, BLOCK_K, GRAV, JUMP_V } from './speeds.js';
import { SETTINGS } from '../ui/settings.js';
import { Stats } from './stats.js';
import { clamp, lerp } from '../util/math.js';

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const SWIM_DEPTH = 1.35, RADIUS = 0.38;
// The dodge roll (Space with the guard up, as in Valheim): its stamina, and the stretch of it no blow lands (seconds in)
const DODGE = { cost: 12, safe: [0.05, 0.55] };

export class Player {
  constructor(scene) {
    // (the look last chosen on this computer, until a saved game or the creator gives another)
    this.hero = new Hero(scene, SETTINGS.look || (SETTINGS.hero && { body: SETTINGS.hero })); this.root = this.hero.root;
    this.pos = this.root.position; this.vel = new THREE.Vector3(); this.hv = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0; this.camPitch = -0.25; this.camDist = 5.5; this.camT = new THREE.Vector3(); this.camInit = false;
    this.onGround = true; this.swimming = false; this.sprinting = false; this.sneaking = false; this.jumped = false; this.jumpBuf = 0;
    this.speed = 0; this.winded = false; this.swing = 0; this.swingKind = 'punch'; this.swingHit = false; this.equip = null; this.bow = null;
    this.strikeMove = null; this.combo = 0; this.comboT = 0; this.dodge = null;
    this.stats = new Stats(); this.dead = false; this.deadT = 0; this.lean = 0; this.bank = 0; this.lastYaw = 0; this.swimD = 0; this.sprintD = 0;
    this.speedMod = 0;            // from equipment (-0.05 per heavy item etc.)
    this.overweight = false; this.frozen = false;  // frozen: no control (menus, cutscenes)
    this.onStrike = null; this.onStep = null; this.onToast = null;
    // a seat: the hero held in one place by what he's doing (sitting, kneeling, lying in bed: game/acts.js), not walking.
    // { x, z } where the body goes (eased there; an action's own travel moves it), yaw the way it faces, lift how far over
    // the floor it lies (a bed), ease how quickly it gets there, leave(why) called when you try to move or jump ('move' |
    // 'jump': stand up, stop praying...)
    this.seat = null;
    this.stats.onDeath = () => this.die();
    // a footstep each time a foot comes down in the stride the legs are playing (hero.update), on the ground
    this.hero.onFootfall = () => { if (this.onGround && !this.swimming) this.onStep?.('step'); };
  }
  spawn(x, z) { this.seat = null; this.pos.set(x, Math.max(groundAt(x, z), -SWIM_DEPTH), z); this.vel.set(0, 0, 0); this.hv.set(0, 0, 0); this.camInit = false; }
  get camForward() { return new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch)); }
  // Start a strike (LMB). kind: hero.js strikeKind ('punch', 'tool' or a weapon's skill). Costs stamina; the hit lands
  // partway through the swing (onStrike), where the move's weapon meets what's in front; blows that follow each other
  // closely go through the weapon's moves in turn (a combo)
  strike(kind, cost) {
    if (this.swing > 0 || this.dead || this.swimming || this.equip || this.hero.moveK < 0.5) return false;
    if (!this.stats.use(cost, kind === 'punch' ? 'unarmed' : null)) { this.onToast?.('Too tired'); return false; }
    this.combo = this.comboT > 0 && this.swingKind === kind ? this.combo + 1 : 0; this.strikeMove = strikeOf(kind, this.combo);
    this.swing = 1; this.swingKind = kind; this.swingHit = false; this.stopT = 0; this.yaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    return true;
  }
  // A blow that lands hard holds the swing for a moment where the weapon meets what it hit (Valheim's freeze frame): t
  // seconds, 0.03 to 0.08 (two to five frames), the swing going on at a tenth of its pace meanwhile
  hitStop(t) { this.stopT = Math.max(this.stopT || 0, t); }
  die() { if (this.dead) return; this.seat = null; this.dead = true; this.deadT = 0; this.swing = 0; this.bow = null; this.dodge = null; this.fell = this.hero.die(); }
  // no blow lands in the heart of a dodge roll
  get dodging() { return !!this.dodge && this.dodge.t > DODGE.safe[0] && this.dodge.t < DODGE.safe[1]; }
  update(dt) {
    const S = this.stats;
    // ---- camera input
    if (input.locked && !input.uiOpen) {
      this.camYaw -= input.dx * 0.0022 * input.sens; this.camPitch = clamp(this.camPitch - input.dy * 0.0022 * input.sens, -1.25, 1.0);
      this.camDist = clamp(this.camDist + input.wheel * 0.6, 1.8, 11);
    }
    const ground = groundAt(this.pos.x, this.pos.z);
    this.swimming = ground < -SWIM_DEPTH && this.pos.y <= -SWIM_DEPTH + 0.15;
    if (this.dead) { this.updateDead(dt); this.updateCamera(dt); return; }
    if (this.seat) { this.updateSeat(dt); this.updateCamera(dt); return; }
    // ---- movement intent
    const ctl = !this.frozen && !S.has('stunned');
    const ix = ctl ? (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0) : 0, iz = ctl ? (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0) : 0;
    const want = new THREE.Vector3();
    this.sprinting = false;
    if (ctl && hit('ControlLeft')) this.sneaking = !this.sneaking;
    const H = this.hero, held = H.moveK;   // (an action may hold the player still or slow them: a hard landing, a stagger, a roll)
    if (ix || iz) {
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), l = Math.hypot(ix, iz);
      want.set((fx * iz - fz * ix) / l, 0, (fz * iz + fx * ix) / l);
      if (S.stamina <= 0.5) this.winded = true; else if (S.stamina > 12) this.winded = false;
      const aiming = this.aiming, shift = down('ShiftLeft') || down('ShiftRight');
      const canSprint = shift && !this.winded && !this.swimming && !aiming && !this.overweight && this.swing <= 0 && !this.blocking;
      if (shift && this.overweight && !this.warnedW) { this.onToast?.('Carrying too much to run'); this.warnedW = true; setTimeout(() => (this.warnedW = false), 4000); }
      if (canSprint) this.sneaking = false;
      this.sprinting = canSprint;
      const base = this.swimming ? SWIM * S.skillK('swimming') : canSprint ? SPRINT * S.skillK('sprinting') : this.sneaking ? SNEAK : aiming ? AIM : RUN;
      want.multiplyScalar(base * S.speedK * (1 + this.speedMod) * (this.overweight && !this.swimming ? 0.6 : 1) * (this.blocking ? BLOCK_K : 1) * held);
      // the lie of the land: slower and leaning in up a slope, a little quicker leaning back down one
      if (this.onGround && !this.swimming) { const d = want.clone().normalize(), e = 0.7; this.slope = clamp((this.groundHere(this.pos.x + d.x * e, this.pos.z + d.z * e) - this.groundHere(this.pos.x - d.x * e, this.pos.z - d.z * e)) / (2 * e), -1, 1);
        want.multiplyScalar(this.slope > 0 ? 1 - 0.35 * Math.min(this.slope, 0.8) : 1 + 0.12 * Math.min(-this.slope, 0.6)); }
    } else this.slope = 0;
    // Olympos is climbed, not walked (gen.js CLIMB): on its upper slopes, ground steeper than CLIMB.slip under your feet
    // (off the path) slides you back down it, whatever you do (moves below refuse what's too steep to walk up)
    const steep = climbable(this.pos.x, this.pos.z); this.sliding = false;
    if (steep && this.onGround && !this.swimming) {
      const e = 0.7, gx = (this.groundHere(this.pos.x + e, this.pos.z) - this.groundHere(this.pos.x - e, this.pos.z)) / (2 * e), gz = (this.groundHere(this.pos.x, this.pos.z + e) - this.groundHere(this.pos.x, this.pos.z - e)) / (2 * e), gr = Math.hypot(gx, gz);
      if (gr > climbLimit(this.pos.x, this.pos.z, true)) { const k = 3 + 6 * Math.min(1, (gr - 1) * 2); want.multiplyScalar(0.25); want.x -= (gx / gr) * k; want.z -= (gz / gr) * k; this.sliding = true; this.sprinting = false; }
    }
    // momentum: accelerate into a run, ease to a stop, little air control
    const acc = !this.onGround && !this.swimming ? 2.5 : want.lengthSq() ? 11 : 14;
    this.hv.x += (want.x - this.hv.x) * Math.min(1, acc * dt); this.hv.z += (want.z - this.hv.z) * Math.min(1, acc * dt);
    let speed = Math.hypot(this.hv.x, this.hv.z); if (speed < 0.05) { speed = 0; this.hv.set(0, 0, 0); }
    this.speed = speed;
    // stamina for sprinting and swimming, skill XP by distance (12.5 xp per 10 ft sprinted / 5 ft swum)
    if (this.sprinting && speed > 3) { S.drain(5 * (1 + clamp(this.slope || 0, 0, 0.8)), dt, 'sprinting'); this.sprintD += speed * dt; if (this.sprintD > 3.05) { this.sprintD = 0; S.train('sprinting', 12.5); } }
    if (this.swimming && speed > 0.3) { S.drain(5, dt, 'swimming'); this.swimD += speed * dt; if (this.swimD > 1.52) { this.swimD = 0; S.train('swimming', 12.5); } }
    if (this.sneaking && speed > 0.3) { S.drain(5, dt, 'sneaking'); this.sneakD = (this.sneakD || 0) + speed * dt; if (this.sneakD > 3.05) { this.sneakD = 0; S.train('sneaking', 12.5); } }
    if (this.sneaking && S.stamina <= 0.5) this.sneaking = false;
    if (this.swimming) { S.add('wet'); if (S.stamina <= 0.5 && speed > 0.3) S.damage(5 * dt); }
    let mx = this.hv.x * dt, mz = this.hv.z * dt;
    // ...and a move that would take you up onto ground steeper than CLIMB.up (off the path) is refused (the part of it
    // across the slope still goes), on foot or in the air, unless you're already above where it lands: so a rock step can
    // be jumped onto, but a face can't be hopped up (the speed you were going at is kept, as against a wall, for the jump)
    if (steep && (mx || mz)) {
      const too = (dx, dz) => { const l = Math.hypot(dx, dz), g1 = this.groundHere(this.pos.x + dx, this.pos.z + dz); return l > 1e-5 && g1 > this.pos.y + 0.02 && (g1 - Math.min(this.pos.y, this.groundHere(this.pos.x, this.pos.z))) / l > climbLimit(this.pos.x + dx, this.pos.z + dz); };
      if (too(mx, mz)) {
        const e = 0.3, gx = this.groundHere(this.pos.x + e, this.pos.z) - this.groundHere(this.pos.x - e, this.pos.z), gz = this.groundHere(this.pos.x, this.pos.z + e) - this.groundHere(this.pos.x, this.pos.z - e), gl = Math.hypot(gx, gz) || 1, up = (mx * gx + mz * gz) / gl;
        if (up > 0) { mx -= (gx / gl) * up; mz -= (gz / gl) * up; } if (too(mx, mz)) mx = mz = 0;
      }
    }
    this.pos.x += mx; this.pos.z += mz;
    // the travel an action asks for (a roll, a stagger back), from the hero's last frame
    this.pos.x += H.step.x; this.pos.z += H.step.z; H.step.set(0, 0, 0);
    // facing: where you move, or where the camera looks while striking, aiming or blocking (then the legs walk the way
    // you go: hero.js plays the backing-up and sideways clips)
    if (this.dodge) this.yaw += angDiff(this.dodge.yaw, this.yaw) * Math.min(1, dt * 20);
    else if (this.aiming || this.blocking || this.swing > 0) { const ty = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw)); this.yaw += angDiff(ty, this.yaw) * Math.min(1, dt * 14); }
    else if (speed > 0.3 && want.lengthSq()) { const ty = Math.atan2(want.x, want.z); this.yaw += angDiff(ty, this.yaw) * Math.min(1, dt * (this.onGround ? 10 : 4)); }
    // ---- collisions: trees, rocks, buildings
    colliders.resolve(this.pos, RADIUS, this.pos.y);
    // ---- Zeus's storm wall: the wind throws you back out
    const sw = stormWallDepth(this.pos.x, this.pos.z);
    if (sw > 0) {
      const o = stormWallOut(this.pos.x, this.pos.z); this.pos.x += o.x * dt * (4 + sw * 14); this.pos.z += o.y * dt * (4 + sw * 14);
      this.hv.x = o.x * 5; this.hv.z = o.y * 5;
      if (!this.warnedS) { this.onToast?.('The storm of Zeus will not let you pass. Valtos is closed to you for now.'); this.warnedS = true; setTimeout(() => (this.warnedS = false), 8000); }
    }
    // ---- jump and gravity
    if (ctl && hit('Space')) this.jumpBuf = 0.15;
    if (this.jumpBuf > 0) this.jumpBuf -= dt;
    // ...or, with the guard up, a dodge roll the way you're going (straight back with no direction held)
    if (this.jumpBuf > 0 && this.blocking && this.onGround && !this.swimming && !this.dodge && held > 0.9 && H.has('roll')) {
      this.jumpBuf = 0;
      const yaw = want.lengthSq() ? Math.atan2(want.x, want.z) : this.yaw + Math.PI;
      if (!S.use(DODGE.cost, 'jumping')) this.onToast?.('Too tired to roll');
      else { H.action('roll', { upper: false, rate: 1.6, blend: 0.08, fade: 0.25, root: 'move', lock: true, feet: false, onDone: () => (this.dodge = null) }); this.dodge = { t: 0, yaw }; this.hv.set(0, 0, 0); this.onStep?.('jump'); }
    }
    if (this.dodge) { this.dodge.t += dt; if (this.dodge.t > 2) this.dodge = null; }
    if (this.jumpBuf > 0 && this.onGround && !this.swimming && this.swing <= 0 && held > 0.9) {
      this.jumpBuf = 0;
      if (S.use(5, 'jumping')) { this.vel.y = JUMP_V * Math.sqrt(S.skillK('jumping')); this.onGround = false; this.jumped = true; S.train('jumping', 2.5); this.onStep?.('jump'); }
      else this.onToast?.('Too tired to jump');
    }
    const wasAir = !this.onGround && this.vel.y < -6;
    const g2 = groundAt(this.pos.x, this.pos.z), floor = Math.max(g2, -SWIM_DEPTH), fl = Math.max(floor, this.floorAt ? this.floorAt(this.pos) : -1e9);
    if (this.swimming && g2 < -SWIM_DEPTH) { this.pos.y = lerp(this.pos.y, -SWIM_DEPTH, Math.min(1, dt * 6)); this.vel.y = 0; this.onGround = false; }
    else {
      this.vel.y -= GRAV * dt; this.pos.y += this.vel.y * dt;
      // walk down slopes without bouncing: snap to the ground if it's just below
      if (this.onGround && this.vel.y <= 0 && this.pos.y - fl < 0.35 + speed * dt * 1.5) this.pos.y = fl;
      if (this.pos.y <= fl) {
        if (wasAir) { this.onStep?.('land'); const fall = -this.vel.y; if (fall > 13) S.damage((fall - 13) * 2); H.landed(fall); }
        this.pos.y = fl; this.vel.y = 0; this.onGround = true; this.jumped = false;
      } else if (this.pos.y > fl + 0.05) this.onGround = false;
    }
    // ---- strikes
    if (this.swing > 0) {
      const m = this.strikeMove || strikeOf(this.swingKind), held = this.stopT > 0; this.swing -= (dt / m.time) * (held ? 0.1 : 1); if (held) this.stopT -= dt;
      if (!this.swingHit && this.swing < 1 - m.at) { this.swingHit = true; this.onStrike?.(this.swingKind); }
      if (this.swing <= 0) { this.swing = 0; this.comboT = 0.45; }
    } else if (this.comboT > 0) this.comboT -= dt;
    if (this.equip) { this.equip.t += dt / 0.9; if (this.equip.t >= 1) { this.equip.done?.(); this.equip = null; } }
    // ---- body lean and bank into turns
    const yawRate = angDiff(this.yaw, this.lastYaw) / Math.max(dt, 1e-3); this.lastYaw = this.yaw;
    this.lean = lerp(this.lean, this.onGround ? clamp(speed / 8, 0, 1) * 0.09 + clamp(this.slope || 0, -0.6, 0.6) * 0.22 * clamp(speed / 3, 0, 1) : 0, Math.min(1, dt * 6));
    this.bank = lerp(this.bank, clamp(-yawRate * 0.03 * clamp(speed / 5, 0, 1), -0.12, 0.12), Math.min(1, dt * 6));
    this.root.rotation.set(this.lean, this.yaw, this.bank);
    // ---- animation
    let moveRel = 0; if ((this.aiming || this.blocking) && speed > 0.3) moveRel = angDiff(Math.atan2(this.hv.x, this.hv.z), this.yaw);
    H.update(dt, { baseY: this.sneaking && !H.crouches ? -0.12 : 0, speed, sprinting: this.sprinting, onGround: this.onGround || this.swimming, jumped: this.jumped, vy: this.vel.y, moving: !!(ix || iz) || this.jumpBuf > 0, swimming: this.swimming, water: 0, moveRel,
      sneaking: this.sneaking && !this.swimming, guard: this.guard, blocking: this.blocking && !this.dodge, swing: this.swing, swingKind: this.swingKind, strike: this.strikeMove,
      equip: this.equip, bow: this.bow, aimPt: this.aimPt, ground: this.groundFn ||= (x, z, y) => this.groundHere(x, z, y), rootY: this.pos.y });
    this.updateCamera(dt);
  }
  // what you'd stand on at (x, z): the ground (pressed down under floors), or a floor, step or stair within reach of y
  groundHere(x, z, y = this.pos.y) { return Math.max(groundAt(x, z), -SWIM_DEPTH, this.floorAt ? this.floorAt({ x, z, y }) : -1e9); }
  get aiming() { return !!this.bow && (this.bow.st === 'draw' || this.bow.st === 'aim'); }
  // Dead: the hero falls (one of the deaths, hero.die, held on the ground; or, before those clips are in, the body tipped
  // over) and lies there until revived
  updateDead(dt) {
    this.deadT += dt;
    if (!this.fell) this.root.rotation.z = lerp(this.root.rotation.z, Math.PI / 2, Math.min(1, dt * 4));
    else this.root.rotation.set(0, this.yaw, 0);
    this.vel.y -= GRAV * dt; this.pos.y = Math.max(this.pos.y + this.vel.y * dt, Math.max(groundAt(this.pos.x, this.pos.z), -SWIM_DEPTH) + (this.fell ? 0 : 0.3));
    this.hero.step.set(0, 0, 0); this.hero.update(dt, { speed: 0, onGround: true, ...(this.fell ? { ground: this.groundFn ||= (x, z, y) => this.groundHere(x, z, y), rootY: this.pos.y } : {}) });
  }
  // Lifted up again where you wake: the hero gets up off the ground (lying on his back at first, the screen still dark),
  // held still until he's on his feet
  revive(x, z) {
    this.dead = false; this.fell = false; this.hero.revive(); this.root.rotation.set(0, this.yaw, 0); this.stats.revive(); this.spawn(x, z);
    if (this.hero.has('getUp')) this.hero.action('getUp', { upper: false, from: 2.4, to: 7.2, rate: 1.3, root: 'move', feet: false, lock: true, lockFor: 2.6, blend: 0.01, fade: 0.4 });
  }
  // Held in a seat: no walking, no falling; the body eased onto its place, facing its way, the hero posed by the action
  // that put him there. Trying to move or jump asks the seat to let go (seat.leave)
  updateSeat(dt) {
    const s = this.seat, H = this.hero, k = Math.min(1, dt * (s.ease ?? 6)), ctl = !this.frozen && !this.stats.has('stunned');
    const moving = ctl && ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(down), jump = ctl && hit('Space');
    s.x += H.step.x; s.z += H.step.z; H.step.set(0, 0, 0);   // (the travel an action asks for: getting up)
    this.pos.x += (s.x - this.pos.x) * k; this.pos.z += (s.z - this.pos.z) * k;
    const fl = this.groundHere(this.pos.x, this.pos.z, this.pos.y + 0.3); this.pos.y += (fl - this.pos.y) * Math.min(1, dt * 12);
    if (s.yaw !== undefined) this.yaw += angDiff(s.yaw, this.yaw) * k;
    this.hv.set(0, 0, 0); this.vel.set(0, 0, 0); this.speed = 0; this.onGround = true; this.jumped = false; this.jumpBuf = 0; this.sprinting = false; this.sneaking = false; this.slope = 0;
    this.lean = 0; this.bank = 0; this.lastYaw = this.yaw; this.root.rotation.set(0, this.yaw, 0);
    if (this.equip) { this.equip.t += dt / 0.9; if (this.equip.t >= 1) { this.equip.done?.(); this.equip = null; } }
    s.liftNow = lerp(s.liftNow ?? 0, s.lift ?? 0, Math.min(1, dt * (s.liftEase ?? 4)));
    H.update(dt, { baseY: s.liftNow, speed: 0, onGround: true, moving: moving || jump, equip: this.equip, ground: this.groundFn ||= (x, z, y) => this.groundHere(x, z, y), rootY: this.pos.y + s.liftNow, floorY: s.lift ? this.pos.y + s.liftNow : undefined });
    if ((moving || jump) && this.seat === s) s.leave?.(moving ? 'move' : 'jump');
  }
  // ---- orbit camera over the right shoulder; pulls in close while aiming; never dips into the ground
  updateCamera(dt) {
    const raw = this.pos.clone(); raw.y += this.swimming ? 1.2 : this.sneaking ? (this.hero.crouches ? 1.35 : 1.45) : 1.65;
    if (!this.camInit || this.camT.distanceTo(raw) > 8) { this.camT.copy(raw); this.camInit = true; }
    this.camT.x += (raw.x - this.camT.x) * Math.min(1, dt * 16); this.camT.z += (raw.z - this.camT.z) * Math.min(1, dt * 16); this.camT.y += (raw.y - this.camT.y) * Math.min(1, dt * 8);
    this.aimK = lerp(this.aimK || 0, this.aiming ? 1 : 0, Math.min(1, dt * 8));
    const k = this.aimK, dist = lerp(this.camDist, 2.3, k), pitch = this.camPitch;
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const target = this.camT.clone().addScaledVector(right, 0.45 + 0.35 * k); target.y -= 0.15 * k;
    const fov = lerp(60, 50, k); if (Math.abs(camera.fov - fov) > 0.01) { camera.fov = fov; camera.updateProjectionMatrix(); }
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(pitch), -Math.sin(pitch), Math.cos(this.camYaw) * Math.cos(pitch)).multiplyScalar(dist);
    const want = target.clone().add(off);
    // keep the camera out of hills between it and the player
    for (let i = 1; i <= 6; i++) { const p = target.clone().lerp(want, i / 6), g = groundAt(p.x, p.z) + 0.4; if (p.y < g) { want.y += g - p.y; } }
    want.y = Math.max(want.y, groundAt(want.x, want.z) + 0.5, -0.6);
    // ...and out of walls and roofs: pull in to just in front of whatever is between
    const block = this.camBlock?.(target, want); if (block !== undefined && block !== null) { const dir = want.clone().sub(target); want.copy(target).add(dir.setLength(Math.max(0.6, block - 0.25))); }
    camera.position.lerp(want, Math.min(1, dt * (14 + k * 10))); camera.lookAt(target);
  }
}
