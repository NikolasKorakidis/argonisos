// Fighting. Melee hits whatever is in the arc in front of you (reach depends on the weapon); hitting an unaware creature
// is a sneak attack and multiplies the damage. RMB with a weapon or shield blocks: the block value soaks damage for
// stamina, and a block raised just before the hit is a parry that staggers the attacker. The bow: hold RMB to nock and
// draw (aiming over the shoulder), LMB to loose; the fuller the draw, the faster and harder the arrow. Armour softens
// what gets through (Valheim's curve: small hits shrug off, big ones still hurt).
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { heightAt } from '../world/gen.js';
import { camera, scene } from '../render/core.js';
import { input } from '../input.js';
import { burst, addShake } from '../render/fx.js';
import { BOW_DUR, CLIPS } from '../player/hero.js';
import { loadFBX, loadTex } from '../assets.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), rr = (a, b) => a + Math.random() * (b - a);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const REACH = { dagger: 1.8, spear: 2.8, axe: 2.3, mace: 2.3 };
const ARROW_V = [24, 70], ARROW_FLAT = [0.05, 0.6];
export const armorReduce = (dmg, armor) => (armor <= 0 ? dmg : armor < dmg / 2 ? dmg - armor : (dmg * dmg) / (armor * 4));

let arrowProto = null;
loadFBX('arrow').then((o) => {
  const mat = new THREE.MeshStandardMaterial({ map: loadTex('arrow.jpg'), roughness: 0.8 }); o.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = true; } });
  const box = new THREE.Box3().setFromObject(o), s = 0.9 / box.getSize(new THREE.Vector3()).y; o.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(o); o.position.y -= (b2.min.y + b2.max.y) / 2;
  const g = new THREE.Group(); g.add(o); g.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(g); arrowProto = w;   // w points along +z
}).catch(() => {});
const fallbackArrow = () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6440 })); g.add(m); return g; };

export class Combat {
  constructor(g) {
    this.g = g; this.arrows = []; this.thorns = []; this.blockT = 0;
    this.nock = new THREE.Group(); this.nock.visible = false; scene.add(this.nock);
  }
  // ---- melee (called when a swing lands)
  strike(item) {
    const g = this.g, P = g.player, kind = item?.skill || 'unarmed', reach = REACH[kind] ?? (item ? 2.1 : 1.7);
    const targets = g.creatures.inArc(P.pos, P.yaw, reach).slice(0, kind === 'axe' || kind === 'mace' ? 2 : 1);
    if (!targets.length) return false;
    const dmg = item?.dmg || (P.stats.has('claws') ? [[30, 'slash'], [10, 'poison']] : [[2, 'blunt']]), k = P.stats.damageK(kind) * (P.stats.has('zeusBlessing') ? 1.1 : 1);
    for (const c of targets) g.creatures.hurt(c, dmg, P.pos, { k, backstab: item?.backstab || 2, knock: item?.knock ?? 0.1 });
    P.stats.train(kind, 12.5); addShake(0.18); g.sound?.('hit');
    return true;
  }
  // ---- a creature's blow lands on the player
  hitPlayer(c, [lo, hi, kind]) {
    const g = this.g, P = g.player, S = P.stats; let dmg = rr(lo, hi) * c.dmgK;
    // blocking: facing the attacker with a weapon or shield raised
    const facing = Math.abs(angDiff(Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z), P.yaw)) < 1.2;
    if (P.blocking && facing) {
      const parry = this.blockT < 0.25, blk = this.blockValue() * S.damageK('blocking') * (parry ? this.parryBonus() : 1);
      const soaked = Math.min(dmg, blk), cost = 5 + soaked * 0.5;
      if (S.use(cost, 'blocking')) {
        dmg -= soaked; S.train('blocking', 12.5); burst(P.pos.clone().setY(P.pos.y + 1.3).addScaledVector(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), 0.6), { color: 0xfff0c0, n: 10, speed: 3, size: 0.04, grav: 4 });
        g.sound?.(parry ? 'parry' : 'block');
        if (parry) { c.hitT = 1.2; c.atkCd = 2.5; g.hud.toast('<b>Parry!</b>'); }
      } else { S.add('stunned', 1.2); g.hud.toast('Your guard breaks'); }
    }
    if (dmg <= 0.05) return;
    const final = armorReduce(dmg, g.armor?.() ?? 0);
    S.damage(final); g.hud.hurt(final / Math.max(10, S.maxHealth) * 2); addShake(clamp(final / 20, 0.2, 0.9)); g.sound?.('hurt');
    if (c.T.heavy) { const d = P.pos.clone().sub(c.pos).setY(0).normalize(); P.hv.addScaledVector(d, 9); P.vel.y = 4; P.onGround = false; }
    // gear wears a little when you're hit
    for (const s of g.inv.slots) if (s?.worn && ITEMS[s.id].armor && s.dur !== undefined) s.dur = Math.max(0, s.dur - 0.5);
  }
  blockValue() { const l = this.g.inv.slots.find((s) => s?.worn === 'left' && ITEMS[s.id].type === 'shield'); if (l) return ITEMS[l.id].block; const r = this.g.held(); return r?.block ?? 0; }
  parryBonus() { const l = this.g.inv.slots.find((s) => s?.worn === 'left' && ITEMS[s.id].type === 'shield'); return (l ? ITEMS[l.id].parry : this.g.held()?.parry) || 1.5; }
  // ---- dryad thorns and other thrown things
  throwAt(c, dmg) {
    const m = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.4, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x5d7a34, roughness: 0.7 }));
    const from = c.pos.clone().setY(c.pos.y + c.T.h * 0.75), to = this.g.player.pos.clone().setY(this.g.player.pos.y + 1.2);
    const t = from.distanceTo(to) / 20, v = to.clone().sub(from).divideScalar(t); v.y += 0.5 * 9 * t;
    m.position.copy(from); scene.add(m); this.thorns.push({ m, v, c, dmg, life: 3 });
  }
  // ---- the bow
  get bow() { return this.g.player.bow; }
  setBow(st, extra) { this.g.player.bow = { st, t: 0, ph: 0, ...extra }; }
  bowDrawn() { const b = this.bow; return !!b && (b.st === 'aim' || (b.st === 'draw' && b.ph > 0.62)); }
  bowPower() { const b = this.bow; return !b ? 0 : b.st === 'aim' ? 0.8 + 0.2 * Math.min(1, b.t / 0.45) : b.st === 'draw' ? clamp((b.ph - 0.62) / 0.38, 0, 1) * 0.8 : 0; }
  arrowsLeft() { return this.g.inv.count('crudeArrow'); }
  bowClick() {
    if (this.bowDrawn()) {
      const b = this.bow, fromC = b.st === 'aim' ? 'bowAim' : 'bowDraw', fromT = b.st === 'aim' ? Math.min(b.t / CLIPS.bowAim.dur, 1) : b.ph;
      this.shoot(this.bowPower());
      if (input.rmb && this.arrowsLeft() > 0) this.setBow('draw', { from: 0.24, ph: 0.24, fromC, fromT }); else this.setBow('lower', { fromC, fromT });
    } else if (!input.rmb && !this.hinted) { this.g.hud.toast('Hold <b>RMB</b> to draw and aim, then <b>LMB</b> to loose'); this.hinted = true; setTimeout(() => (this.hinted = false), 6000); }
  }
  updateBow(dt) {
    const g = this.g, P = g.player, has = !!g.bow();
    if (!has) { if (P.bow) P.bow = null; this.nock.visible = false; return; }
    if (!P.bow) this.setBow('ready');
    const b = P.bow; b.t += dt;
    const want = input.rmb && !input.uiOpen && !P.dead && !P.swimming;
    if (b.st === 'ready' || (b.st === 'lower' && b.t > 0.1)) {
      if (want && this.arrowsLeft() > 0) this.setBow('draw', b.st === 'lower' ? { fromC: b.fromC, fromT: b.fromT } : {});
      else if (b.st === 'lower' && b.t >= BOW_DUR.lower) this.setBow('ready');
      if (want && this.arrowsLeft() <= 0 && !this.noArrows) { g.hud.toast('No arrows. Craft some at a workbench.'); this.noArrows = true; setTimeout(() => (this.noArrows = false), 5000); }
    } else if (b.st === 'draw') { b.ph = Math.min(1, (b.from || 0) + b.t / BOW_DUR.draw); if (!want) this.setBow('lower', { fromC: 'bowDraw', fromT: b.ph }); else if (b.ph >= 1) this.setBow('aim'); }
    else if (b.st === 'aim' && !want) this.setBow('lower', { fromC: 'bowAim', fromT: Math.min(b.t / CLIPS.bowAim.dur, 1) });
    if (P.aiming) P.aimPt = this.aimPoint(P.aimPt || new THREE.Vector3());
    // the arrow on the string
    const on = (b.st === 'draw' && b.ph > 0.45) || b.st === 'aim', H = P.hero;
    if (on && arrowProto && !this.nock.children.length) this.nock.add(arrowProto.clone());
    this.nock.visible = on && !!H.bones.mixamorigRightHand;
    if (this.nock.visible) { const r = H.bones.mixamorigRightHand.getWorldPosition(new THREE.Vector3()), d = H.bones.mixamorigLeftHand.getWorldPosition(new THREE.Vector3()).sub(r).normalize(); this.nock.position.copy(r).addScaledVector(d, 0.4); this.nock.lookAt(this.nock.position.clone().add(d)); }
  }
  aimPoint(out) {
    const o = camera.position, d = new THREE.Vector3(); camera.getWorldDirection(d);
    for (let t = 2; t < 120; t += 1) { out.copy(o).addScaledVector(d, t); if (out.y < heightAt(out.x, out.z)) return out; for (const c of this.g.creatures.list) if (!c.dead && out.distanceTo(c.pos.clone().setY(c.pos.y + c.T.h * 0.5)) < c.T.r + 0.4) return out; }
    return out.copy(o).addScaledVector(d, 120);
  }
  shoot(power) {
    const g = this.g, P = g.player; if (!g.inv.take('crudeArrow', 1)) return;
    const bow = g.bow(), dir = new THREE.Vector3(); camera.getWorldDirection(dir);
    const H = P.hero, start = H.bones.mixamorigLeftHand ? H.bones.mixamorigLeftHand.getWorldPosition(new THREE.Vector3()) : P.pos.clone().setY(P.pos.y + 1.5);
    const target = this.aimPoint(new THREE.Vector3()), v = target.sub(start).normalize().multiplyScalar(ARROW_V[0] + (ARROW_V[1] - ARROW_V[0]) * power);
    // accuracy: an untrained archer's arrows wander a little
    const spread = 0.02 * (1 - (P.stats.skills.bow.level - 1) * 0.003) * (1.2 - power); v.x += rr(-1, 1) * spread * v.length(); v.y += rr(-1, 1) * spread * v.length();
    const m = arrowProto ? arrowProto.clone() : fallbackArrow(); m.position.copy(start); scene.add(m);
    const dmg = [[(bow.dmg[0][0] + ITEMS.crudeArrow.dmg[0][0]) * (0.25 + 0.75 * power), 'pierce']];
    this.arrows.push({ m, v, life: 0, flat: ARROW_FLAT[0] + (ARROW_FLAT[1] - ARROW_FLAT[0]) * power, dmg, stuck: false });
    P.stats.drain(0, 0); g.sound?.('bow'); P.stats.train('bow', 2);
  }
  update(dt) {
    const g = this.g, P = g.player;
    // blocking with RMB (not with the bow or the hammer out)
    const canBlock = !g.bow() && !g.equippedTool('build') && (g.held() || g.inv.slots.some((s) => s?.worn === 'left'));
    const was = P.blocking; P.blocking = canBlock && input.rmb && !input.uiOpen && !P.dead && P.swing <= 0 && !P.swimming;
    this.blockT = P.blocking ? (was ? this.blockT + dt : 0) : 0;
    this.updateBow(dt);
    // arrows: fly flat for a moment, then drop; stick where they land
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i]; a.life += dt;
      if (a.stuck) { if (a.life > 25) { scene.remove(a.m); this.arrows.splice(i, 1); } continue; }
      if (a.life > a.flat) a.v.y -= 9.8 * dt;
      const prev = a.m.position.clone(); a.m.position.addScaledVector(a.v, dt); a.m.lookAt(a.m.position.clone().add(a.v));
      const p = a.m.position;
      let hitC = null; for (const c of g.creatures.list) { if (c.dead) continue; const cc = c.pos.clone().setY(c.pos.y + c.T.h * 0.55); const seg = new THREE.Line3(prev, p), q = seg.closestPointToPoint(cc, true, new THREE.Vector3()); if (q.distanceTo(cc) < c.T.r + c.T.h * 0.25) { hitC = c; break; } }
      if (hitC) { g.creatures.hurt(hitC, a.dmg, prev, { ranged: true, backstab: 3, knock: 0.1 }); P.stats.train('bow', 12.5); scene.remove(a.m); this.arrows.splice(i, 1); g.sound?.('arrowHit'); continue; }
      const gh = heightAt(p.x, p.z);
      let tree = null; for (const c of g.colliders.near(p.x, p.z, 1)) if (Math.hypot(c.x - p.x, c.z - p.z) < c.r && (c.h === undefined || p.y < (c.y ?? 0) + c.h)) { tree = c; break; }
      if (p.y < gh || tree || a.life > 6) { a.stuck = true; a.life = 0; if (p.y < gh) p.y = gh + 0.05; burst(p, { color: tree ? 0x8a6440 : 0x7a6a50, n: 4, speed: 1.5, size: 0.04 }); g.sound?.('arrowThud'); }
    }
    // thorns
    for (let i = this.thorns.length - 1; i >= 0; i--) {
      const t = this.thorns[i]; t.life -= dt; t.v.y -= 9 * dt; t.m.position.addScaledVector(t.v, dt); t.m.lookAt(t.m.position.clone().add(t.v));
      const pp = P.pos.clone().setY(P.pos.y + 1.1);
      if (t.m.position.distanceTo(pp) < 0.6 && !P.dead) { this.hitPlayer(t.c, t.dmg); scene.remove(t.m); this.thorns.splice(i, 1); continue; }
      if (t.life <= 0 || t.m.position.y < heightAt(t.m.position.x, t.m.position.z)) { scene.remove(t.m); this.thorns.splice(i, 1); }
    }
  }
}
