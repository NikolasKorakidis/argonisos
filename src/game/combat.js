// Fighting. Melee hits whatever is in the arc in front of you (reach depends on the weapon); hitting an unaware creature
// is a sneak attack and multiplies the damage. RMB with a weapon, a shield or the bow blocks: the block value soaks damage for
// stamina, and a block raised just before the hit is a parry that staggers the attacker (not a boss, and a giant only if
// the guard held most of the blow). Space with RMB held rolls, whatever is in your hands (player.js). The bow: hold LMB to draw (the
// camera coming in over the shoulder), let go to loose; the fuller the draw, the faster and harder the arrow (BOW). Armour softens
// what gets through (Valheim's curve: small hits shrug off, big ones still hurt). A blow taken shows on the side of the
// screen it came from (hud.hurtFrom). A dryad's thorn is a glowing bramble bolt you can see coming (THORN).
import * as THREE from 'three';
import { ITEMS } from './items.js';
import { heightAt } from '../world/gen.js';
import { camera, scene } from '../render/core.js';
import { input } from '../input.js';
import { burst, dust, addShake, punch, impact, spark } from '../render/fx.js';
import { BOW_DUR, CLIPS } from '../player/hero.js';
import { loadFBX, loadGLB, loadTex } from '../assets.js';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { clamp, rr } from '../util/math.js';

const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const REACH = { dagger: 1.8, spear: 2.8, axe: 2.3, mace: 2.3 };
const ARROW_V = [24, 70], ARROW_FLAT = [0.05, 0.6];
// The bow is drawn, not fired on a click (Patch 26, the reviewer's: Valheim's way). Holding LMB draws it, letting go looses
// the arrow, with all of the bow's damage only at a full draw: less the less it was drawn (minK of it from a bare tap),
// and slower and sooner dropping (ARROW_V, ARROW_FLAT). A full draw takes the bow's own seconds (items.js draw: the crude
// bow 1.5, the Cretan 1.25), up to a third (skill) less with the Bowman skill at 100. Drawn and held, the bow costs stamina
// (stam a second, less with the skill) and stamina doesn't come back meanwhile; run out and the draw is let down, the
// arrow kept, as raising the guard with RMB lets it down (Valheim's bow blocks). The first raise of the arms (raise s at most, or that share of a quicker draw) brings
// the bow up and nocks; the rest pulls the string (the clip's pull, PULL on, stretched over it). After the loose the
// arms follow through a moment (loose s) before they lower, or draw again at once if LMB is pressed again
const BOW = { minK: 0.25, skill: 1 / 3, stam: 4, raise: 0.5, share: 0.4, loose: 0.22 }, PULL = 0.62;
// How hard a blow you land feels (render/fx.js punch, the same scale as the gathering's: harvest.js): by the weapon's heft
// and the damage done, more for a killing blow. The heavy weapons' hits and every killing blow hold the swing a moment
// (player.hitStop). A swing that meets nothing is not felt at all.
const HEFT = { dagger: 0.1, spear: 0.15, axe: 0.22, mace: 0.26, unarmed: 0.1 }, HEAVY = new Set(['axe', 'mace']);
// How much of a heavy beast's blow a parry must hold for the beast to stagger (the guard's block over the blow)
const PARRY_FORCE = 0.6;
export const armorReduce = (dmg, armor) => (armor <= 0 ? dmg : armor < dmg / 2 ? dmg - armor : (dmg * dmg) / (armor * 4));

let arrowProto = null;
// the Cretan arrow from the team's pack (tools/assets; head up its +y like the old one), or the old model when the pack isn't there
loadGLB('pack/arrow').then((gl) => { const w = new THREE.Group(); w.add(gl.scene); return w; }).catch(() => loadFBX('arrow').then((o) => { const mat = new THREE.MeshStandardMaterial({ map: loadTex('arrow.jpg'), roughness: 0.8 }); o.traverse((m) => { if (m.isMesh) m.material = mat; }); return o; })).then((o) => {
  o.traverse((m) => { if (m.isMesh) m.castShadow = true; });
  const box = new THREE.Box3().setFromObject(o), s = 0.9 / box.getSize(new THREE.Vector3()).y; o.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(o); o.position.y -= (b2.min.y + b2.max.y) / 2;
  const g = new THREE.Group(); g.add(o); g.rotation.x = Math.PI / 2; const w = new THREE.Group(); w.add(g); arrowProto = w;   // w's head points along +z (lookAt aims it)
}).catch(() => {});
// ---- thrown things. A dryad's thorn: a bramble bolt as long as a forearm with spines along it, glowing green, trailing
// light and shedding leaves, slow enough to see coming and step aside from, block or roll under (v: m/s, a little drop,
// grav), from her hand as her throw lets go (creatures.js); her hand glows as she winds up (charge). The Minotaur's
// rubble: a block of masonry, slower and heavier, that bursts into dust where it lands and catches you within a metre
// (o.size: a giant's boulder, that much bigger, faster and harder to get out of the way of).
// Made once and kept (a pool), the first parked out of sight from the start so its shaders are compiled with the
// rest (main.js warmUp), never in the middle of a fight.
const THORN = { v: 11, grav: 2.5, r: 0.45, trail: 18, life: 3 }, ROCK = { v: 14, grav: 9 }, LEAF = [0x5d8a34, 0x7aa83e, 0x3f6a26, 0x9cc45a], GLOW = 0x9cff5a;
const PARK = new THREE.Vector3(0, -5000, 0);
const thornGeo = (() => {
  const core = new THREE.ConeGeometry(0.06, 0.62, 6).rotateX(Math.PI / 2), tail = new THREE.ConeGeometry(0.05, 0.22, 6).rotateX(-Math.PI / 2).translate(0, 0, -0.4), parts = [core, tail];
  for (let i = 0; i < 6; i++) { const a = i * 2.1, z = 0.12 - i * 0.07; parts.push(new THREE.ConeGeometry(0.018, 0.14, 4).rotateZ(-Math.PI / 2).rotateY(0.5).rotateZ(a).translate(Math.cos(a) * 0.07, Math.sin(a) * 0.07, z)); }
  return mergeGeometries(parts.map((g) => (g.index ? g.toNonIndexed() : g)));
})();
// (a dark thorn in a glow brighter than white, so it stands out against a sunlit meadow as well as in the woods' shade and
// blooms; the trail likewise, fading behind)
const thornMat = new THREE.MeshStandardMaterial({ color: 0x2e2414, emissive: GLOW, emissiveIntensity: 0.3, roughness: 0.7, flatShading: true });
const glowMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 2.6, 0.7), transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
const trailMat = new THREE.PointsMaterial({ size: 0.3, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
const glowGeo = new THREE.SphereGeometry(1, 10, 8), rockGeo = new THREE.DodecahedronGeometry(0.45, 0), rockMat = new THREE.MeshStandardMaterial({ color: 0x9a9080, roughness: 0.95, flatShading: true });
function makeThorn() {
  const g = new THREE.Group(), core = new THREE.Mesh(thornGeo, thornMat), halo = new THREE.Mesh(glowGeo, glowMat); halo.scale.set(0.15, 0.15, 0.5); g.add(core, halo);   // (the glow a sheath along the thorn, so its dark shape still shows inside)
  const n = THORN.trail, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  for (let i = 0; i < n; i++) { const k = (1 - i / n) ** 1.5; col[i * 3] = 1 * k; col[i * 3 + 1] = 2 * k; col[i * 3 + 2] = 0.5 * k; }   // (bright at the head, fading behind)
  const trail = new THREE.Points(geo, trailMat); trail.frustumCulled = false;
  g.userData.nearShadow = true; core.castShadow = true;
  return { g, core, halo, trail };
}
const fallbackArrow = () => { const g = new THREE.Group(); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.85, 5).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x8a6440 })); g.add(m); return g; };

export class Combat {
  constructor(g) {
    this.g = g; this.arrows = []; this.thorns = []; this.blockT = 0; this.spare = []; this.glows = new Map(); this.glowSpare = [];
    this.nock = new THREE.Group(); this.nock.visible = false; scene.add(this.nock);
    this.park(makeThorn());   // (out of sight, so warmUp compiles the thorn's shaders with the rest)
  }
  // ---- melee (called when a swing lands)
  strike(item) {
    const g = this.g, P = g.player, kind = item?.skill || 'unarmed', reach = REACH[kind] ?? (item ? 2.1 : 1.7);
    // (the nearest in the arc first: a swing meets the beast in front of you before the one behind it)
    const targets = g.creatures.inArc(P.pos, P.yaw, reach).sort((a, b) => a.pos.distanceTo(P.pos) - b.pos.distanceTo(P.pos)).slice(0, kind === 'axe' || kind === 'mace' ? 2 : 1);
    g.sound?.('swing', { kind: item && !item.skill ? 'tool' : kind });   // (the whoosh of every swing, a miss too: sound.js, by the weapon's weight)
    if (!targets.length) return false;
    const dmg = item?.dmg || (P.stats.has('claws') ? [[30, 'slash'], [10, 'poison']] : [[2, 'blunt']]), k = P.stats.damageK(kind) * this.blessK();
    let felt = 0, kill = false;
    for (const c of targets) { const n = g.creatures.hurt(c, dmg, P.pos, { k, backstab: item?.backstab || 2, knock: item?.knock ?? 0.1 }); felt = Math.max(felt, n); kill ||= c.dead;
      impact(c.pos.clone().setY(c.pos.y + c.T.h * 0.6).addScaledVector(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), -Math.min(0.5, c.T.r ?? 0.4)), 'hide', clamp(felt / 40, 0.2, 1)); }
    punch((HEFT[kind] ?? 0.15) + clamp(felt / 80, 0, 0.2) + (kill ? 0.12 : 0), { x: Math.sin(P.yaw), z: Math.cos(P.yaw) });
    if (kill || HEAVY.has(kind)) P.hitStop(kill ? 0.08 : 0.045);
    // (its sound: an axe's, a blade's (a dagger, a spear, the Chimera's claws), or a blunt one's (a club, a fist))
    P.stats.train(kind, 12.5); g.sound?.('hit', { at: targets[0].pos.clone().setY(targets[0].pos.y + targets[0].T.h * 0.6), kind: kind === 'axe' ? 'axe' : kind === 'dagger' || kind === 'spear' || (!item && P.stats.has('claws')) ? 'blade' : 'blunt', type: targets[0].type });
    return true;
  }
  // ---- a creature's blow lands on the player (from: where it came from, if not the creature: a thorn). Returns what
  // came of it: 'dodged', 'blocked' (all of it soaked), or the damage taken
  hitPlayer(c, [lo, hi, kind], { from } = {}) {
    const g = this.g, P = g.player, S = P.stats; let dmg = rr(lo, hi) * c.dmgK * (g.resists?.(kind) ? 0.5 : 1);   // (armour that resists the kind: half of it)
    if (P.dodging) return 'dodged';   // (rolled clear: player.js)
    const src = from || c.pos;
    // blocking: facing the attacker with a weapon or shield raised
    const facing = Math.abs(angDiff(Math.atan2(c.pos.x - P.pos.x, c.pos.z - P.pos.z), P.yaw)) < 1.2;
    if (P.blocking && facing) {
      // (a parry needs a weapon or shield that can parry: a tower shield only soaks; Zeus's Blessing hardens the guard)
      const bonus = this.parryBonus(), parry = this.blockT < 0.25 && bonus > 0, blk = this.blockValue() * S.damageK('blocking') * this.blessK() * (parry ? bonus : 1);
      const soaked = Math.min(dmg, blk), cost = 5 + soaked * 0.5;
      if (S.use(cost, 'blocking')) {
        const at = P.pos.clone().setY(P.pos.y + 1.3).addScaledVector(new THREE.Vector3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), 0.6), away = { x: P.pos.x - c.pos.x, z: P.pos.z - c.pos.z };
        dmg -= soaked; S.train('blocking', 12.5); burst(at, { color: 0xfff0c0, n: 10, speed: 3, size: 0.04, grav: 4 }); spark(at, parry ? 8 : 4); punch(parry ? 0.24 : 0.15, away);   // (a crisp jolt as the blow meets the guard)
        g.sound?.(parry ? 'parry' : 'block');
        // A parry staggers the one that struck, as in Valheim, but never a boss, nor a heavy beast (a giant) unless the
        // guard held at least PARRY_FORCE of its blow; a thrown thing, a shockwave or a bolt staggers no one (from)
        if (parry) { const stagger = !from && !c.boss && (!c.T.heavy || blk >= (dmg + soaked) * PARRY_FORCE); if (stagger) { c.hitT = 1.2; c.atkCd = 2.5; }
          g.hud.toast(stagger || from ? '<b>Parry!</b>' : '<b>Parried</b>, but it is too heavy to stagger'); }
        else this.g.owl?.hint?.('parry');   // (the first blow met on the guard: how to turn a block into a parry)
      } else { S.add('stunned', 1.2); g.hud.toast('Your guard breaks'); g.sound?.('guardBreak'); }
    }
    if (dmg <= 0.05) return 'blocked';
    const final = armorReduce(dmg, g.armor?.() ?? 0);
    // (a blow taken kicks the view away from whoever struck it, by how much it hurt; a big one rumbles on a little; and the
    // edge of the screen it came from glows red, as the camera sees it: ahead is the top, behind the bottom)
    // (a giant boss's blow lands harder still: a heavy impact under the cry, the view kicked hard and rumbling on)
    S.damage(final); g.hud.hurt(final / Math.max(10, S.maxHealth) * 2); punch(c.boss ? clamp(0.55 + final / 40, 0.6, 1) : clamp(final / 22, 0.2, 0.85), { x: P.pos.x - src.x, z: P.pos.z - src.z }); if (final > 20 || c.boss) addShake(c.boss ? clamp(0.35 + final / 60, 0.35, 0.8) : clamp((final - 20) / 60, 0, 0.3)); g.sound?.('hurt', { voice: g.heroVoice?.() ?? true });
    if (c.boss) g.sound?.('bossHit', { k: clamp(0.6 + final / 40, 0.6, 1.2) });
    if (c.type) g.owl?.want?.('fight');   // (the first blow a beast lands on you brings the Owl with her counsel on guarding and rolling)
    { const f = camera.getWorldDirection(new THREE.Vector3()), dx = src.x - P.pos.x, dz = src.z - P.pos.z, fl = Math.hypot(f.x, f.z) || 1; g.hud.hurtFrom?.((dx * -f.z + dz * f.x) / fl, (dx * f.x + dz * f.z) / fl, clamp(final / 25, 0.25, 1)); }
    if (!S.dead) P.hero.hurt(final, S.maxHealth);   // (a flinch, or a stagger back from a big blow)
    g.acts?.hurt(final);   // (a hard enough blow breaks off eating, praying, sitting)
    // (a heavy blow knocks you back; a giant boss's sends you flying, the harder the further)
    if (c.T.heavy) { const d = P.pos.clone().sub(c.pos).setY(0).normalize(); P.hv.addScaledVector(d, c.boss ? 13 + Math.min(9, final * 0.25) : 9); P.vel.y = c.boss ? 6.5 : 4; P.onGround = false; }
    // gear wears a little when you're hit
    for (const s of g.inv.slots) if (s?.worn && ITEMS[s.id].armor && s.dur !== undefined) s.dur = Math.max(0, s.dur - 0.5);
    return final;
  }
  blockValue() { const l = this.g.inv.slots.find((s) => s?.worn === 'left' && ITEMS[s.id].type === 'shield'); if (l) return ITEMS[l.id].block; const r = this.g.bow?.() || this.g.held(); return r?.block ?? 0; }
  // (what can't parry, a tower shield or a tool, has no parry bonus: 0, and the guard only soaks)
  parryBonus() { const l = this.g.inv.slots.find((s) => s?.worn === 'left' && ITEMS[s.id].type === 'shield'); return (l ? ITEMS[l.id].parry : (this.g.bow?.() || this.g.held())?.parry) ?? 0; }
  // Zeus's Blessing: +10% to the blows you strike, melee and arrows, and to your guard (stats.js CONDITIONS)
  blessK() { return this.g.player.stats.has('zeusBlessing') ? 1.1 : 1; }
  // ---- thrown things (THORN): from o.from (the thrower's hand) at where you stand as it leaves the hand, so moving dodges it
  throwAt(c, dmg, o = {}) {
    const from = o.from?.clone() || c.pos.clone().setY(c.pos.y + c.T.h * 0.75), to = this.g.player.pos.clone().setY(this.g.player.pos.y + 1.1), F = o.rock ? ROCK : THORN, size = o.size || 1;
    const t = from.distanceTo(to) / (F.v * (o.rock ? Math.sqrt(size) : 1)), v = to.clone().sub(from).divideScalar(t); v.y += 0.5 * F.grav * t;
    let th = null, m;
    if (o.rock) { m = new THREE.Mesh(rockGeo, rockMat); m.scale.setScalar(size); m.castShadow = true; m.userData.nearShadow = true; scene.add(m); }
    else { th = this.spare.pop() || makeThorn(); m = th.g; scene.add(m, th.trail); const p = th.trail.geometry.attributes.position; for (let i = 0; i < THORN.trail; i++) from.toArray(p.array, i * 3); p.needsUpdate = true;
      burst(from, { color: GLOW, n: 10, speed: 2.2, size: 0.06, grav: 1, life: 0.5, glow: true }); this.g.sound?.('thornThrow', this.g.creatures.near?.(c) ?? 1); }
    m.position.copy(from); m.lookAt(from.clone().add(v)); this.thorns.push({ m, th, v, c, dmg, life: THORN.life, rock: o.rock, size, grav: F.grav, leafT: 0, e: 0 });
    return this.thorns[this.thorns.length - 1];
  }
  park(th) { th.g.position.copy(PARK); th.trail.geometry.attributes.position.array.fill(-5000); th.trail.geometry.attributes.position.needsUpdate = true; scene.add(th.g, th.trail); this.spare.push(th); }
  // A dryad winding up a throw: the glow gathers in her hand (k: how far into the wind-up, 0 to 1). Called each frame of
  // it; a glow not asked for in a frame goes out (update).
  charge(c, k) {
    let h = this.glows.get(c); if (!h) { h = this.glowSpare.pop() || new THREE.Mesh(glowGeo, glowMat); this.glows.set(c, h); scene.add(h); }
    h.position.copy(c.body.hand?.() || c.pos.clone().setY(c.pos.y + c.T.h * 0.75)); h.scale.setScalar(0.06 + 0.2 * clamp(k, 0, 1) * (1 + 0.15 * Math.sin(k * 40))); h.userData.asked = true;
    if (Math.random() < 0.5) burst(h.position, { color: LEAF[Math.floor(Math.random() * LEAF.length)], n: 1, speed: 0.6, size: 0.04, grav: -0.6, life: 0.5, up: 0.4 });
  }
  // ---- the bow
  get bow() { return this.g.player.bow; }
  setBow(st, extra) { this.g.player.bow = { st, t: 0, ph: 0, ...extra }; if (st === 'draw') this.g.sound?.('bowDraw'); }   // (the string creaks as it's drawn)
  arrowsLeft() { return this.g.inv.count('crudeArrow'); }
  // seconds to a full draw with this bow, at the Bowman skill's level now
  drawTime(bow) { return (bow.draw ?? 1.5) * (1 - BOW.skill * (this.g.player.stats.skills.bow.level - 1) / 99); }
  // where the draw clip stands, f of the way to a full draw taking F seconds: the bow raised and nocked, then the string pulled
  drawPhase(f, F) { const r = Math.min(BOW.share, BOW.raise / F); return f < r ? (PULL * f) / r : PULL + ((1 - PULL) * (f - r)) / (1 - r); }
  // the pose the arms are in now, for the next state to blend from (hero.js poseBow)
  bowFrom(b) { return b.st === 'aim' ? { fromC: 'bowAim', fromT: Math.min(b.t / CLIPS.bowAim.dur, 1) } : b.st === 'draw' ? { fromC: 'bowDraw', fromT: Math.max(b.ph, b.from || 0) } : { fromC: b.fromC, fromT: b.fromT }; }
  // the draw let down without loosing (the guard raised, too tired, no longer free to): the arrow stays in the quiver
  letDown(why) { this.setBow('lower', this.bowFrom(this.bow)); if (why) this.say(why); }
  say(msg) { if (this.said === msg) return; this.g.hud.toast(msg); this.said = msg; clearTimeout(this.saidT); this.saidT = setTimeout(() => (this.said = null), 5000); }
  updateBow(dt) {
    const g = this.g, P = g.player, S = P.stats, bow = g.bow();
    if (!bow) { if (P.bow) P.bow = null; this.nock.visible = false; this.spent = false; g.hud.reticle?.(null); return; }
    if (!P.bow) this.setBow('ready');
    let b = P.bow; b.t += dt;
    // (free to draw: not in a menu, a roll or the water. The guard raised (RMB: the bow blocks, as in Valheim) lets the draw
    // down, and LMB must be let go and pressed again to draw, as after running out of arrows or breath; but RMB and Space
    // roll: the roll lets the draw down and, LMB still held, it's drawn again after, once RMB is let go)
    const free = !input.uiOpen && !P.dead && !P.swimming && !P.dodge && !P.seat, rmb = input.clicks.includes(2);
    if (!input.lmb || P.dodge) this.spent = false;
    const want = input.lmb && !this.spent && free && !input.rmb;
    if (b.st === 'draw' || b.st === 'aim') {
      if (rmb || b.bow !== bow) { this.letDown(); this.spent = true; }
      else if (!free) this.letDown();
      else if (!input.lmb) {   // loosed: as strong as it was drawn
        const f = b.f, from = this.bowFrom(b); this.shoot(f); this.setBow('loose', { ...from, f, bow });
      } else if (!S.use(BOW.stam * dt, 'bow')) { this.letDown('Too tired to hold the draw'); this.spent = true; }
      else { b.f = Math.min(1, b.f + dt / b.F); b.ph = this.drawPhase(b.f, b.F); if (b.st === 'draw' && b.f >= 1) { this.setBow('aim', { f: 1, ph: 1, F: b.F, bow }); } }
    } else if (want) {
      if (this.arrowsLeft() <= 0) { this.say('No arrows. Craft some at a workbench.'); this.spent = true; }
      else if (!S.god && S.stamina < 1) { this.say('Too tired to draw the bow'); this.spent = true; }
      // (straight after a loose the bow is up already: drawn again from there, the string the only thing to pull)
      else this.setBow('draw', { ...this.bowFrom(b), from: b.st === 'loose' ? 0.24 : 0, f: 0, F: this.drawTime(bow), bow });
    } else if (b.st === 'loose' && b.t >= BOW.loose) this.setBow('lower', { fromC: b.fromC, fromT: b.fromT, shot: true });
    else if (b.st === 'lower' && b.t >= BOW_DUR.lower) this.setBow('ready');
    b = P.bow;
    g.hud.reticle?.(b.st === 'draw' || b.st === 'aim' ? b.f : null);   // (the crosshair's ring closing in as the string comes back)
    if (P.aiming) P.aimPt = this.aimPoint(P.aimPt || new THREE.Vector3());
    // the arrow on the string
    const on = (b.st === 'draw' && Math.max(b.ph, b.from || 0) > 0.45) || b.st === 'aim', H = P.hero;
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
    const dmg = [[(bow.dmg[0][0] + ITEMS.crudeArrow.dmg[0][0]) * (BOW.minK + (1 - BOW.minK) * power), 'pierce']];
    // (an arrow grows with the Bowman skill as a blade does with its own, with Zeus's Blessing and with what the helmet
    // adds to bows (bowDmg); it takes the bow's own sneak-attack multiplier)
    let helm = 0; for (const s of g.inv.slots) if (s?.worn && ITEMS[s.id]?.bowDmg) helm += ITEMS[s.id].bowDmg;
    const k = P.stats.damageK('bow') * this.blessK() * (1 + helm);
    this.arrows.push({ m, v, life: 0, flat: ARROW_FLAT[0] + (ARROW_FLAT[1] - ARROW_FLAT[0]) * power, dmg, k, backstab: bow.backstab || 3, knock: bow.knock ?? 0.1, stuck: false });
    g.sound?.('bow'); P.stats.train('bow', 2);
  }
  update(dt) {
    const g = this.g, P = g.player;
    // blocking with RMB (the bow too, as in Valheim, poorly: its own block value; not with the hammer out, nor while
    // stunned: a broken guard stays open)
    const canBlock = !g.equippedTool('build') && !P.seat && (g.held() || g.inv.slots.some((s) => s?.worn === 'left'));
    const was = P.blocking; P.blocking = canBlock && input.rmb && !input.uiOpen && !P.dead && P.swing <= 0 && !P.swimming && !P.stats.has('stunned');
    // RMB held with anything at all (a weapon, a shield, the bow, bare hands; not the hammer, whose RMB is its
    // menu): Space then rolls (player.js), as in Valheim
    P.guardUp = input.rmb && !input.uiOpen && !P.dead && !P.swimming && !P.seat && !g.equippedTool('build');
    if (P.blocking && !was) P.stats.learn('blocking');   // (the first guard raised finds the skill, before any blow meets it)
    // a one-handed weapon and a shield: the hero stands on guard (hero.js)
    const r = g.held(); P.guard = !!r && r.type === 'weapon' && r.hands === 1 && g.inv.slots.some((s) => s?.worn === 'left' && ITEMS[s.id].type === 'shield');
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
      if (hitC) { g.creatures.hurt(hitC, a.dmg, prev, { ranged: true, k: a.k, backstab: a.backstab, knock: a.knock }); P.stats.train('bow', 12.5); scene.remove(a.m); this.arrows.splice(i, 1); g.sound?.('arrowHit', { at: p.clone() }); continue; }
      const gh = heightAt(p.x, p.z);
      let tree = null; for (const c of g.colliders.near(p.x, p.z, 1)) if (Math.hypot(c.x - p.x, c.z - p.z) < c.r && (c.h === undefined || p.y < (c.y ?? 0) + c.h)) { tree = c; break; }
      if (p.y < gh || tree || a.life > 6) { a.stuck = true; a.life = 0; if (p.y < gh) p.y = gh + 0.05; burst(p, { color: tree ? 0x8a6440 : 0x7a6a50, n: 4, speed: 1.5, size: 0.04 }); g.sound?.(tree ? 'arrowWood' : 'arrowThud', { at: p.clone() }); }   // (into a trunk, a log or a wall: wood)
    }
    // the glows in dryads' hands: out once not asked for
    for (const [c, h] of this.glows) { if (h.userData.asked) { h.userData.asked = false; continue; } scene.remove(h); this.glows.delete(c); this.glowSpare.push(h); }
    // thrown things: a thorn hits you if it passes within its reach of your body (from the knees to the head) on its way
    for (let i = this.thorns.length - 1; i >= 0; i--) {
      const t = this.thorns[i], p = t.m.position, prev = p.clone(); t.life -= dt; t.e += dt; t.v.y -= t.grav * dt; p.addScaledVector(t.v, dt);
      if (t.rock) t.m.rotation.x += dt * 6; else { t.m.lookAt(p.clone().add(t.v)); t.th.core.rotation.z += dt * 9; t.th.halo.scale.set(0.15, 0.15, 0.5).multiplyScalar(1 + 0.15 * Math.sin(t.e * 30));
        const a = t.th.trail.geometry.attributes.position; a.array.copyWithin(3, 0, (THORN.trail - 1) * 3); p.toArray(a.array, 0); a.needsUpdate = true;
        if ((t.leafT -= dt) <= 0) { t.leafT = 0.045; burst(p, { color: LEAF[Math.floor(Math.random() * LEAF.length)], n: 1, speed: 0.5, size: 0.07, grav: 2, life: 1, up: 0.2 }); } }
      let hit = false;
      if (!P.dead && !t.passed) for (let k = 1; k <= 3 && !hit; k++) { const q = prev.clone().lerp(p, k / 3), y = clamp(q.y, P.pos.y + 0.35, P.pos.y + 1.75); hit = Math.hypot(q.x - P.pos.x, q.z - P.pos.z) < (t.rock ? 0.65 + 0.45 * t.size : THORN.r) && Math.abs(q.y - y) < (t.rock ? 0.35 + 0.45 * t.size : 0.3); }
      if (hit) {
        const r = this.hitPlayer(t.c, t.dmg, { from: prev });
        if (r === 'dodged') { t.passed = true; continue; }   // (rolled under it: it flies on past)
        if (t.rock) dust(p.clone(), Math.round(14 * Math.sqrt(t.size)), 0x9a9080, 0.6 * Math.sqrt(t.size)); else this.thornBurst(p, r !== 'blocked', 1);
        this.drop(i); continue;
      }
      const landed = p.y < heightAt(p.x, p.z); let tree = false; if (!t.rock && !landed) for (const k of g.colliders.near(p.x, p.z, 1)) if (Math.hypot(k.x - p.x, k.z - p.z) < k.r && (k.h === undefined || p.y < (k.y ?? 0) + k.h)) { tree = true; break; }
      if (t.life <= 0 || landed || tree) { if (t.rock) { const k = Math.sqrt(t.size); dust(p.clone(), Math.round(16 * k), 0x9a9080, 0.6 * k); burst(p.clone(), { color: 0x8f8678, n: Math.round(8 * k), speed: 4 * k, size: 0.12 * k }); addShake(0.25 * k); g.sound?.('boulder', { at: p.clone(), land: true }); if (t.size > 1.5) g.sound?.('slam', { at: p.clone(), big: true }); } else if (t.life > 0) this.thornBurst(p, false, clamp(1 - P.pos.distanceTo(p) / 40, 0.2, 1)); this.drop(i); }
    }
  }
  // where a thorn lands or strikes: a burst of leaves and green sparks (more when it struck you), and its crack
  thornBurst(p, onYou, k) {
    burst(p, { color: LEAF[0], n: onYou ? 16 : 9, speed: 3, size: 0.07, grav: 5, life: 1.1, up: 2 }); burst(p, { color: LEAF[3], n: onYou ? 10 : 5, speed: 2.4, size: 0.05, grav: 4, life: 0.9, up: 1.5 });
    burst(p, { color: GLOW, n: onYou ? 12 : 6, speed: 4, size: 0.045, grav: 6, life: 0.35, up: 1.5, glow: true });
    this.g.sound?.('thornHit', k);
  }
  drop(i) { const t = this.thorns[i]; this.thorns.splice(i, 1); if (t.th) { scene.remove(t.th.trail); this.park(t.th); } else scene.remove(t.m); }
}
