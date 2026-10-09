// The player: third-person movement with momentum, sprinting and jumping that cost stamina, swimming, collisions with
// trees, rocks and buildings, the storm wall's push-back, and the orbit camera.
import * as THREE from 'three';
import { camera } from '../render/core.js';
import { heightAt } from '../world/gen.js';
import { groundAt } from '../world/groundcut.js';
import { colliders } from '../world/colliders.js';
import { stormWallDepth, stormWallOut } from '../world/stormwall.js';
import { input, down, hit } from '../input.js';
import { Hero } from './hero.js';
import { Stats } from './stats.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), lerp = (a, b, t) => a + (b - a) * t;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
// Data-table speeds (ft → m): sprint 25 ft/s, swim 8 ft/s, jump 6 ft up
const RUN = 4.6, SPRINT = 7.6, SWIM = 2.4, SNEAK = 2.0, GRAV = 20, JUMP_V = Math.sqrt(2 * GRAV * 1.83);
const SWIM_DEPTH = 1.35, RADIUS = 0.38;

export class Player {
  constructor(scene) {
    this.hero = new Hero(scene); this.root = this.hero.root;
    this.pos = this.root.position; this.vel = new THREE.Vector3(); this.hv = new THREE.Vector3();
    this.yaw = 0; this.camYaw = 0; this.camPitch = -0.25; this.camDist = 5.5; this.camT = new THREE.Vector3(); this.camInit = false;
    this.onGround = true; this.swimming = false; this.sprinting = false; this.sneaking = false; this.jumped = false; this.jumpBuf = 0;
    this.speed = 0; this.winded = false; this.swing = 0; this.swingKind = 'punch'; this.swingHit = false; this.equip = null; this.bow = null;
    this.stats = new Stats(); this.dead = false; this.deadT = 0; this.lean = 0; this.bank = 0; this.lastYaw = 0; this.stepD = 0; this.swimD = 0; this.sprintD = 0;
    this.speedMod = 0;            // from equipment (-0.05 per heavy item etc.)
    this.overweight = false; this.frozen = false;  // frozen: no control (menus, cutscenes)
    this.onStrike = null; this.onStep = null; this.onToast = null;
    this.stats.onDeath = () => this.die();
  }
  spawn(x, z) { this.pos.set(x, Math.max(groundAt(x, z), -SWIM_DEPTH), z); this.vel.set(0, 0, 0); this.hv.set(0, 0, 0); this.camInit = false; }
  get camForward() { return new THREE.Vector3(-Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), -Math.cos(this.camYaw) * Math.cos(this.camPitch)); }
  // Start a strike (LMB). Costs stamina; the hit lands partway through the swing (onStrike)
  strike(kind, cost) {
    if (this.swing > 0 || this.dead || this.swimming || this.equip) return false;
    if (!this.stats.use(cost, kind === 'punch' ? 'unarmed' : null)) { this.onToast?.('Too tired'); return false; }
    this.swing = 1; this.swingKind = kind; this.swingHit = false; this.yaw = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw));
    return true;
  }
  die() { if (this.dead) return; this.dead = true; this.deadT = 0; this.swing = 0; this.bow = null; }
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
    // ---- movement intent
    const ctl = !this.frozen && !S.has('stunned');
    const ix = ctl ? (down('KeyD') ? 1 : 0) - (down('KeyA') ? 1 : 0) : 0, iz = ctl ? (down('KeyW') ? 1 : 0) - (down('KeyS') ? 1 : 0) : 0;
    const want = new THREE.Vector3();
    this.sprinting = false;
    if (ctl && hit('ControlLeft')) this.sneaking = !this.sneaking;
    if (ix || iz) {
      const fx = -Math.sin(this.camYaw), fz = -Math.cos(this.camYaw), l = Math.hypot(ix, iz);
      want.set((fx * iz - fz * ix) / l, 0, (fz * iz + fx * ix) / l);
      if (S.stamina <= 0.5) this.winded = true; else if (S.stamina > 12) this.winded = false;
      const aiming = this.aiming, shift = down('ShiftLeft') || down('ShiftRight');
      const canSprint = shift && !this.winded && !this.swimming && !aiming && !this.overweight && this.swing <= 0 && !this.blocking;
      if (shift && this.overweight && !this.warnedW) { this.onToast?.('Carrying too much to run'); this.warnedW = true; setTimeout(() => (this.warnedW = false), 4000); }
      if (canSprint) this.sneaking = false;
      this.sprinting = canSprint;
      const base = this.swimming ? SWIM * S.skillK('swimming') : canSprint ? SPRINT * S.skillK('sprinting') : this.sneaking ? SNEAK : aiming ? 2.2 : RUN;
      want.multiplyScalar(base * S.speedK * (1 + this.speedMod) * (this.overweight && !this.swimming ? 0.6 : 1) * (this.blocking ? 0.5 : 1));
    }
    // momentum: accelerate into a run, ease to a stop, little air control
    const acc = !this.onGround && !this.swimming ? 2.5 : want.lengthSq() ? 11 : 14;
    this.hv.x += (want.x - this.hv.x) * Math.min(1, acc * dt); this.hv.z += (want.z - this.hv.z) * Math.min(1, acc * dt);
    let speed = Math.hypot(this.hv.x, this.hv.z); if (speed < 0.05) { speed = 0; this.hv.set(0, 0, 0); }
    this.speed = speed;
    // stamina for sprinting and swimming, skill XP by distance (12.5 xp per 10 ft sprinted / 5 ft swum)
    if (this.sprinting && speed > 3) { S.drain(5, dt, 'sprinting'); this.sprintD += speed * dt; if (this.sprintD > 3.05) { this.sprintD = 0; S.train('sprinting', 12.5); } }
    if (this.swimming && speed > 0.3) { S.drain(5, dt, 'swimming'); this.swimD += speed * dt; if (this.swimD > 1.52) { this.swimD = 0; S.train('swimming', 12.5); } }
    if (this.sneaking && speed > 0.3) { S.drain(5, dt, 'sneaking'); this.sneakD = (this.sneakD || 0) + speed * dt; if (this.sneakD > 3.05) { this.sneakD = 0; S.train('sneaking', 12.5); } }
    if (this.sneaking && S.stamina <= 0.5) this.sneaking = false;
    if (this.swimming) { S.add('wet'); if (S.stamina <= 0.5 && speed > 0.3) S.damage(5 * dt); }
    this.pos.x += this.hv.x * dt; this.pos.z += this.hv.z * dt;
    // facing: where you move, or where the camera looks while striking or aiming
    if (this.aiming || this.swing > 0) { const ty = Math.atan2(-Math.sin(this.camYaw), -Math.cos(this.camYaw)); this.yaw += angDiff(ty, this.yaw) * Math.min(1, dt * 14); }
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
    if (this.jumpBuf > 0 && this.onGround && !this.swimming && this.swing <= 0) {
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
        if (wasAir) { this.onStep?.('land'); const fall = -this.vel.y; if (fall > 13) S.damage((fall - 13) * 2); }
        this.pos.y = fl; this.vel.y = 0; this.onGround = true; this.jumped = false;
      } else if (this.pos.y > fl + 0.05) this.onGround = false;
    }
    if (speed > 0 && this.onGround) { this.stepD += speed * dt; if (this.stepD > (this.sprinting ? 2.3 : 1.6)) { this.stepD = 0; this.onStep?.('step'); } }
    // ---- strikes
    if (this.swing > 0) {
      this.swing -= dt * (this.swingKind === 'punch' ? 2.2 : 1.35);
      if (!this.swingHit && this.swing < 0.55) { this.swingHit = true; this.onStrike?.(this.swingKind); }
      if (this.swing < 0) this.swing = 0;
    }
    if (this.equip) { this.equip.t += dt / 0.9; if (this.equip.t >= 1) { this.equip.done?.(); this.equip = null; } }
    // ---- body lean and bank into turns
    const yawRate = angDiff(this.yaw, this.lastYaw) / Math.max(dt, 1e-3); this.lastYaw = this.yaw;
    this.lean = lerp(this.lean, this.onGround ? clamp(speed / 8, 0, 1) * 0.09 : 0, Math.min(1, dt * 6));
    this.bank = lerp(this.bank, clamp(-yawRate * 0.03 * clamp(speed / 5, 0, 1), -0.12, 0.12), Math.min(1, dt * 6));
    this.root.rotation.set(this.lean, this.yaw, this.bank);
    this.hero.wrap.position.y = this.sneaking ? -0.12 : 0;
    // ---- animation
    let moveRel = 0; if (this.aiming && speed > 0.3) moveRel = angDiff(Math.atan2(this.hv.x, this.hv.z), this.yaw);
    this.hero.update(dt, { speed, sprinting: this.sprinting, onGround: this.onGround || this.swimming, jumped: this.jumped, swimming: this.swimming, moveRel,
      swing: this.swing, swingKind: this.swingKind, equip: this.equip, bow: this.bow, aimPt: this.aimPt });
    this.updateCamera(dt);
  }
  get aiming() { return !!this.bow && (this.bow.st === 'draw' || this.bow.st === 'aim'); }
  updateDead(dt) {
    this.deadT += dt;
    this.root.rotation.z = lerp(this.root.rotation.z, Math.PI / 2, Math.min(1, dt * 4));
    this.vel.y -= GRAV * dt; this.pos.y = Math.max(this.pos.y + this.vel.y * dt, Math.max(groundAt(this.pos.x, this.pos.z), -SWIM_DEPTH) + 0.3);
    this.hero.update(dt, { speed: 0, onGround: true });
  }
  revive(x, z) { this.dead = false; this.root.rotation.set(0, this.yaw, 0); this.stats.revive(); this.spawn(x, z); }
  // ---- orbit camera over the right shoulder; pulls in close while aiming; never dips into the ground
  updateCamera(dt) {
    const raw = this.pos.clone(); raw.y += this.swimming ? 1.2 : this.sneaking ? 1.45 : 1.65;
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
