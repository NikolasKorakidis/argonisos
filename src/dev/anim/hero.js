// The hero as a subject of the animation viewer: the game's own Hero (player/hero.js), dressed as the character creator
// and the inventory dress him, every clip he has (the old ones in CLIPS and everything in moves.glb and acts.glb, as
// tools/assets/moves.mjs makes them), and a walk through the real hero.update with a small copy of the player's controls
// (player/player.js, game/combat.js: speeds, momentum, the jump, sneaking, the guard, the block, the bow, the strikes).
import * as THREE from 'three';
import { Hero, CLIPS, BODIES, SKINS, HAIRS, HAIR_COLOURS, BEARDS, EYES, CLOTHS, WREATHS, randomLook, normLook, loadMoves, strikeOf, strikeKind, BOW_DUR, GRIP } from '../../player/hero.js';
import { heldModel } from '../../player/held.js';
import { RUN, SPRINT, SNEAK, AIM, BLOCK_K, GRAV, JUMP_V } from '../../player/speeds.js';
import { fpsOf } from './pose.js';

// The clips from before the moves library: [name in CLIPS, its file in assets/models]
const OLD = { run: 'run', sprint: 'sprint', jump: 'jump', attack: 'attack', punch: 'punch', equip: 'equip', disarm: 'disarm', bowEquip: 'bow_equip', bowDraw: 'bow_draw', bowAim: 'bow_aim', bowDisarm: 'bow_disarm' };
const OLD_LOOPS = new Set(['run', 'sprint']);
// How the list groups them; a clip added to moves.mjs later and not named here goes under Other
const GROUPS = [
  ['Locomotion', ['walk', 'walkBack', 'walkLeft', 'walkRight', 'run', 'runBack', 'jogLeft', 'jogRight', 'sprint']],
  ['Sneak', ['crouch', 'crouchReady', 'crouchWalk', 'crouchBack', 'crouchLeft', 'crouchRight', 'crouchDown', 'crouchUp']],
  ['Combat', ['guard', 'block', 'slash', 'slash2', 'chop', 'sweep', 'stab', 'kick', 'attack', 'punch', 'throw', 'roll', 'equip', 'disarm', 'bowEquip', 'bowDraw', 'bowAim', 'bowDisarm']],
  ['Hits and deaths', ['hitSmall', 'hitLarge', 'deathBack', 'deathLeft']],
  ['Water and air', ['swim', 'tread', 'jump', 'fall', 'land']],
  ['Actions', ['pickUp', 'drink', 'sit', 'sleep', 'getUp', 'pray', 'wave', 'victory']],
  ['Idles', ['breathe', 'look']],
];
// What can be held: [item id, name, weapon skill (hero.js strikeKind), one-handed weapon]
const RIGHT = [['', 'Nothing'], ['crudeAxe', 'Crude axe', 'axe', 1], ['lightstoneAxe', 'Lightstone axe', 'axe', 1], ['crudeClub', 'Club', 'mace', 1], ['crudeDagger', 'Crude dagger', 'dagger', 1],
  ['lightstoneDagger', 'Lightstone dagger', 'dagger', 1], ['crudeSpear', 'Crude spear', 'spear'], ['lightstoneSpear', 'Lightstone spear', 'spear'], ['torch', 'Torch'], ['hammer', 'Hammer'], ['pickaxe', 'Pickaxe'], ['hoe', 'Hoe']];
const LEFT = [['', 'Nothing'], ['crudeShield', 'Shield'], ['crudeTowerShield', 'Tower shield'], ['crudeBow', 'Crude bow'], ['cretanBow', 'Cretan bow']];
const ARMOUR = [['', 'None'], ['thrower', 'Thrower set'], ['cretan', 'Cretan set']];
const isBow = (id) => /Bow$/.test(id), isShield = (id) => /Shield$/.test(id);
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const END = /_End$|HeadTop|Hand[A-Za-z]+4$/;

// The look last chosen in the game on this computer (ui/settings.js keeps it; that module builds the game's renderer
// and sound when it loads, so it's read here straight from storage)
function savedLook() {
  try { const s = JSON.parse(localStorage.getItem('argonisos.settings.v1') || '{}'); return s.look || (s.hero && { body: s.hero }) || null; } catch { return null; }
}
const waitFor = (test, ms) => new Promise((ok) => { const t0 = performance.now(), tick = () => (test() || performance.now() - t0 > ms ? ok(test()) : setTimeout(tick, 100)); tick(); });

export class HeroSubject {
  constructor(scene) {
    this.id = 'hero'; this.name = 'Hero'; this.scene = scene; this.samplers = new Map(); this.cache = {}; this.clips = []; this.problems = [];
    this.gear = { right: '', left: '', armour: '', cape: false }; this.onRebind = () => {}; this.onFootfall = () => {};
    this.w = { hv: new THREE.Vector3(), vel: new THREE.Vector3(), yaw: 0, onGround: true, jumped: false, jumpBuf: 0, sneaking: false, sprinting: false, blocking: false, guard: false,
      swing: 0, swingKind: 'punch', strikeMove: null, combo: 0, comboT: 0, equip: null, bow: null, dodge: null, lean: 0, bank: 0, lastYaw: 0, speed: 0, aimPt: new THREE.Vector3() };
  }
  async load(status = () => {}) {
    status('Loading the hero…');
    const H = this.hero = new Hero(this.scene, savedLook());
    H.onFootfall = (side) => this.onFootfall(side);
    await H.ready; this.bind();
    if (!H.mat) this.problems.push('assets/models/pack/hero.glb is missing: showing the old carved model (the creator\'s looks, armour and some clips need the pack)');
    status('Loading the clips…');
    const [moves, acts] = await Promise.all([loadMoves('moves'), loadMoves('acts')]);
    if (!moves.length) this.problems.push('assets/models/moves.glb is missing or broken: run node tools/assets/moves.mjs');
    if (!acts.length) this.problems.push('assets/models/acts.glb is missing or broken: run node tools/assets/moves.mjs');
    await waitFor(() => Object.keys(OLD).every((n) => CLIPS[n].ready), 15000);
    for (const n of Object.keys(OLD)) if (!CLIPS[n].ready) this.problems.push(`assets/models/${OLD[n]}.fbx didn't load`);
    const all = [...Object.keys(OLD).map((n) => [n, OLD[n] + '.fbx']), ...moves.map((n) => [n, 'moves.glb']), ...acts.map((n) => [n, 'acts.glb'])];
    const group = (n) => GROUPS.find((g) => g[1].includes(n))?.[0] || 'Other', order = (n) => { const g = GROUPS.find((x) => x[1].includes(n)); return g ? g[1].indexOf(n) : 999; };
    this.clips = all.filter(([n]) => CLIPS[n]?.ready).map(([name, file]) => { const C = CLIPS[name]; return { name, file, C, group: group(name), loop: C.loop ?? OLD_LOOPS.has(name), mixamo: C.extras?.from || '', fps: fpsOf(C), root: !!C.root || (OLD_LOOPS.has(name) && C.rootSpeed > 0) }; });
    this.groups = [...GROUPS.map((g) => g[0]), 'Other'].map((g) => [g, this.clips.filter((E) => E.group === g).sort((a, b) => order(a.name) - order(b.name))]).filter((g) => g[1].length);
  }
  // The model's bones and how they rest (taken while the body stands as loaded, before any clip has touched it)
  bind() {
    const H = this.hero; this.model = H.model; this.root = H.root; this.wrap = H.wrap; this.bones = H.bones; this.s = H.s; this.hips = this.bones.mixamorigHips;
    this.rest = new Map(); for (const b of Object.values(this.bones)) this.rest.set(b, { q: b.quaternion.clone(), p: b.position.clone() });
    this.animated = Object.values(this.bones).filter((b) => !END.test(b.name));
    const B = this.bones; this.feet = { Left: { heel: B.mixamorigLeftFoot, ball: B.mixamorigLeftToeBase || B.mixamorigLeftFoot }, Right: { heel: B.mixamorigRightFoot, ball: B.mixamorigRightToeBase || B.mixamorigRightFoot } };
    this.hands = { Left: B.mixamorigLeftHand, Right: B.mixamorigRightHand };
    this.samplers.clear(); this.cache = {};
    // the heels' and balls' heights standing at rest, from where the body stands
    const R = this.root, rp = R.position.clone(), rr = R.rotation.clone(), wy = this.wrap.position.y; R.position.set(0, 0, 0); R.rotation.set(0, 0, 0); this.wrap.position.y = 0; R.updateMatrixWorld(true);
    const v = new THREE.Vector3(); this.restFeet = {}; for (const s of ['Left', 'Right']) this.restFeet[s] = { heel: this.feet[s].heel.getWorldPosition(v).y, ball: this.feet[s].ball.getWorldPosition(v).y };
    R.position.copy(rp); R.rotation.copy(rr); this.wrap.position.y = wy; R.updateMatrixWorld(true);
  }
  // the parts of the body drawn now (for the checks' lowest points)
  meshes() { const out = []; this.model.traverseVisible((m) => { if (m.isSkinnedMesh) out.push(m); }); return out; }

  // ---- the look and the gear: a panel of choices
  panel(el) {
    const H = this.hero, L = { ...H.look }, opt = (list, v) => list.map(([id, name]) => `<option value="${id}"${id === v ? ' selected' : ''}>${name}</option>`).join('');
    const field = (k, label, list) => `<label>${label}<select data-look="${k}">${opt(list, L[k])}</select></label>`;
    el.innerHTML = `<div class="grid2">
      <label>Body<select data-look="body">${opt(Object.entries(BODIES).map(([k, b]) => [k, b.name]), L.body)}</select></label>${field('skin', 'Skin', SKINS)}
      ${field('hair', 'Hair', HAIRS)}${field('hairColour', 'Hair colour', HAIR_COLOURS)}${field('beard', 'Beard', BEARDS)}${field('eyes', 'Eyes', EYES)}
      ${field('cloth', 'Cloth', CLOTHS)}${field('wreath', 'Wreath', WREATHS)}
      <label>Armour<select data-gear="armour">${opt(ARMOUR, this.gear.armour)}</select></label><label class="chk"><input type="checkbox" data-gear="cape"${this.gear.cape ? ' checked' : ''}> Cape</label>
      <label>Right hand<select data-gear="right">${opt(RIGHT, this.gear.right)}</select></label><label>Left hand<select data-gear="left">${opt(LEFT, this.gear.left)}</select></label>
    </div><div class="acts"><button data-act="random" title="A random look for this body">Random look</button><button data-act="otherBody">Random, other body</button></div>`;
    el.onchange = async (e) => {
      const t = e.target;
      if (t.dataset.look) await this.setLook({ ...this.hero.look, [t.dataset.look]: t.value });
      if (t.dataset.gear) { this.gear[t.dataset.gear] = t.type === 'checkbox' ? t.checked : t.value; await this.dress(t.dataset.gear); }
    };
    el.onclick = async (e) => {
      const a = e.target.dataset.act; if (!a) return;
      await this.setLook(randomLook(a === 'otherBody' ? (this.hero.look.body === 'man' ? 'woman' : 'man') : this.hero.look.body)); this.panel(el);
    };
  }
  async setLook(look) {
    const H = this.hero, was = H.model; await H.setLook(normLook(look));
    if (H.model !== was) { this.bind(); this.onRebind('body'); } else this.onRebind('look');
  }
  // put on what's chosen (what: the choice that changed)
  async dress(what) {
    const H = this.hero, G = this.gear;
    if (what === 'armour' || what === 'cape') { const s = G.armour; H.wear(s ? { head: s + 'Helmet', body: s + 'Armor', legs: s + 'Legs', ...(G.cape ? { cape: 'cretanCape' } : {}) } : G.cape ? { cape: 'cretanCape' } : {}); }
    if (what === 'right') H.holdRight(G.right ? await heldModel(G.right) : null);
    if (what === 'left') H.holdLeft(G.left ? await heldModel(G.left) : null);
    if ((what === 'right' || what === 'left') && this.walking) {
      // (drawn in the hand as the game does: the equip clip, or the bow's own)
      if (what === 'left' && isBow(G.left)) this.w.bow = { st: 'equip', t: 0, ph: 0 }; else this.w.equip = { kind: 'equip', t: 0 };
    }
    this.onRebind('gear');
  }
  // what the clips leave out, as hero.update does it: a fist round whatever is held, and the cape after the body
  afterPose(dt) {
    const H = this.hero, B = this.bones;
    for (const [side, on] of [['Right', H.gripR], ['Left', H.gripL]]) if (on) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) { const b = B[`mixamorig${side}Hand${f}${k}`]; if (b) b.rotation.x += GRIP.curl; }
    if (H.cape) { this.root.updateMatrixWorld(true); H.cape.update(dt); }
  }

  // ---- walking: the player's controls, cut down to what moves the body (no stamina, no colliders but the stage's)
  walkBegin() { const W = this.w; this.walking = true; W.yaw = this.root.rotation.y; W.lastYaw = W.yaw; W.hv.set(0, 0, 0); W.vel.set(0, 0, 0); W.onGround = true; W.jumped = false; this.hero.stopActions(0); }
  walkEnd() { this.walking = false; this.hero.stopActions(0); this.w.bow = null; this.w.equip = null; this.w.swing = 0; this.w.dodge = null; this.root.rotation.set(0, this.w.yaw, 0); }
  // I: { down(code), hit(code) (pressed since the last frame), rmb, click (a left click since the last frame) }; camYaw: the
  // camera's turn (forward is -sin, -cos); aim: where the camera looks (the bow's target); stage: { groundAt, topAt, STEP_UP }
  walk(dt, I, camYaw, aim, stage) {
    const H = this.hero, W = this.w, G = this.gear, pos = this.root.position, held = H.moveK;
    const right = RIGHT.find((r) => r[0] === G.right), bow = isBow(G.left), shield = isShield(G.left);
    const ix = (I.down('KeyD') ? 1 : 0) - (I.down('KeyA') ? 1 : 0), iz = (I.down('KeyW') ? 1 : 0) - (I.down('KeyS') ? 1 : 0);
    if (I.hit('ControlLeft') || I.hit('ControlRight') || I.hit('KeyC')) W.sneaking = !W.sneaking;
    // the guard and the block (combat.js), and the bow
    W.guard = !!right?.[3] && shield; W.blocking = !bow && (!!G.right || shield) && I.rmb && W.swing <= 0;
    this.bowStep(dt, I.rmb && !!bow);
    const aiming = !!W.bow && (W.bow.st === 'draw' || W.bow.st === 'aim');
    if (I.click) {
      if (bow) { const b = W.bow; if (b && (b.st === 'aim' || (b.st === 'draw' && b.ph > 0.62))) { const fromC = b.st === 'aim' ? 'bowAim' : 'bowDraw', fromT = b.st === 'aim' ? Math.min(b.t / CLIPS.bowAim.dur, 1) : b.ph; W.bow = I.rmb ? { st: 'draw', t: 0, ph: 0.24, from: 0.24, fromC, fromT } : { st: 'lower', t: 0, ph: 0, fromC, fromT }; } }
      else if (W.swing <= 0 && !W.equip && held >= 0.5) {
        const kind = strikeKind(right?.[2] ? { skill: right[2] } : G.right ? {} : null);
        W.combo = W.comboT > 0 && W.swingKind === kind ? W.combo + 1 : 0; W.strikeMove = strikeOf(kind, W.combo); W.swing = 1; W.swingKind = kind;
        W.yaw = Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw));
      }
    }
    // movement: momentum into the speed wanted, facing the way you go (or the camera's way while striking, aiming, blocking)
    const want = new THREE.Vector3(); W.sprinting = false;
    if (ix || iz) {
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), l = Math.hypot(ix, iz); want.set((fx * iz - fz * ix) / l, 0, (fz * iz + fx * ix) / l);
      const shift = I.down('ShiftLeft') || I.down('ShiftRight'); W.sprinting = shift && !aiming && W.swing <= 0 && !W.blocking; if (W.sprinting) W.sneaking = false;
      want.multiplyScalar((W.sprinting ? SPRINT : W.sneaking ? SNEAK : aiming ? AIM : RUN) * (W.blocking ? BLOCK_K : 1) * held);
    }
    const acc = !W.onGround ? 2.5 : want.lengthSq() ? 11 : 14;
    W.hv.x += (want.x - W.hv.x) * Math.min(1, acc * dt); W.hv.z += (want.z - W.hv.z) * Math.min(1, acc * dt);
    let speed = Math.hypot(W.hv.x, W.hv.z); if (speed < 0.05) { speed = 0; W.hv.set(0, 0, 0); } W.speed = speed;
    // (the stage's walls: a step higher than a foot reaches stops you, one axis at a time so you slide along it)
    const nx = pos.x + W.hv.x * dt + H.step.x, nz = pos.z + W.hv.z * dt + H.step.z; H.step.set(0, 0, 0);
    if (stage.topAt(nx, pos.z) <= pos.y + stage.STEP_UP) pos.x = nx; else W.hv.x = 0;
    if (stage.topAt(pos.x, nz) <= pos.y + stage.STEP_UP) pos.z = nz; else W.hv.z = 0;
    if (W.dodge) W.yaw += angDiff(W.dodge.yaw, W.yaw) * Math.min(1, dt * 20);
    else if (aiming || W.blocking || W.swing > 0) W.yaw += angDiff(Math.atan2(-Math.sin(camYaw), -Math.cos(camYaw)), W.yaw) * Math.min(1, dt * 14);
    else if (speed > 0.3 && want.lengthSq()) W.yaw += angDiff(Math.atan2(want.x, want.z), W.yaw) * Math.min(1, dt * (W.onGround ? 10 : 4));
    // the jump, or with the guard up a dodge roll; gravity onto the stage
    if (I.hit('Space')) W.jumpBuf = 0.15; if (W.jumpBuf > 0) W.jumpBuf -= dt;
    if (W.jumpBuf > 0 && W.blocking && W.onGround && !W.dodge && held > 0.9 && H.has('roll')) {
      W.jumpBuf = 0; const yaw = want.lengthSq() ? Math.atan2(want.x, want.z) : W.yaw + Math.PI;
      H.action('roll', { upper: false, rate: 1.6, blend: 0.08, fade: 0.25, root: 'move', lock: true, feet: false, onDone: () => (W.dodge = null) }); W.dodge = { t: 0, yaw }; W.hv.set(0, 0, 0);
    }
    if (W.dodge && (W.dodge.t += dt) > 2) W.dodge = null;
    if (W.jumpBuf > 0 && W.onGround && W.swing <= 0 && held > 0.9) { W.jumpBuf = 0; W.vel.y = JUMP_V; W.onGround = false; W.jumped = true; }
    const wasAir = !W.onGround && W.vel.y < -6, fl = stage.groundAt(pos.x, pos.z, pos.y);
    W.vel.y -= GRAV * dt; pos.y += W.vel.y * dt;
    if (W.onGround && W.vel.y <= 0 && pos.y - fl < 0.35 + speed * dt * 1.5) pos.y = fl;
    if (pos.y <= fl) { if (wasAir) H.landed(-W.vel.y); pos.y = fl; W.vel.y = 0; W.onGround = true; W.jumped = false; } else if (pos.y > fl + 0.05) W.onGround = false;
    // the strike, the equip
    if (W.swing > 0) { W.swing -= dt / (W.strikeMove?.time || 0.7); if (W.swing <= 0) { W.swing = 0; W.comboT = 0.45; } } else if (W.comboT > 0) W.comboT -= dt;
    if (W.equip && (W.equip.t += dt / 0.9) >= 1) W.equip = null;
    // the lean into a run and the bank into a turn
    const yawRate = angDiff(W.yaw, W.lastYaw) / Math.max(dt, 1e-3); W.lastYaw = W.yaw;
    W.lean = lerp(W.lean, W.onGround ? clamp(speed / 8, 0, 1) * 0.09 : 0, Math.min(1, dt * 6)); W.bank = lerp(W.bank, clamp(-yawRate * 0.03 * clamp(speed / 5, 0, 1), -0.12, 0.12), Math.min(1, dt * 6));
    this.root.rotation.set(W.lean, W.yaw, W.bank);
    let moveRel = 0; if ((aiming || W.blocking) && speed > 0.3) moveRel = angDiff(Math.atan2(W.hv.x, W.hv.z), W.yaw);
    W.aimPt.copy(aim);
    H.update(dt, { baseY: W.sneaking && !H.crouches ? -0.12 : 0, speed, sprinting: W.sprinting, onGround: W.onGround, jumped: W.jumped, vy: W.vel.y, moving: !!(ix || iz) || W.jumpBuf > 0, swimming: false, water: 0, moveRel,
      sneaking: W.sneaking, guard: W.guard, blocking: W.blocking && !W.dodge, swing: W.swing, swingKind: W.swingKind, strike: W.strikeMove, equip: W.equip, bow: W.bow, aimPt: W.aimPt,
      ground: this.groundFn ||= (x, z, y) => stage.groundAt(x, z, y), rootY: pos.y });
  }
  // the bow's states, as combat.js updateBow, with arrows that never run out
  bowStep(dt, rmb) {
    const W = this.w; if (!isBow(this.gear.left)) { W.bow = null; return; }
    W.bow ||= { st: 'ready', t: 0, ph: 0 }; const b = W.bow; b.t += dt; const set = (st, x) => (W.bow = { st, t: 0, ph: 0, ...x });
    if (b.st === 'equip') { if (b.t >= BOW_DUR.equip) set('ready'); }
    else if (b.st === 'ready' || (b.st === 'lower' && b.t > 0.1)) { if (rmb) set('draw', b.st === 'lower' ? { fromC: b.fromC, fromT: b.fromT } : {}); else if (b.st === 'lower' && b.t >= BOW_DUR.lower) set('ready'); }
    else if (b.st === 'draw') { b.ph = Math.min(1, (b.from || 0) + b.t / BOW_DUR.draw); if (!rmb) set('lower', { fromC: 'bowDraw', fromT: b.ph }); else if (b.ph >= 1) set('aim'); }
    else if (b.st === 'aim' && !rmb) set('lower', { fromC: 'bowAim', fromT: Math.min(b.t / CLIPS.bowAim.dur, 1) });
  }
  // when the game hears each foot come down in a cycle (hero.footfalls: fractions of the clip)
  footfalls(E) { return E.loop && this.hero.mixer ? this.hero.footfalls(E.C)?.fwd || [] : []; }
  // a clip played as the game plays any action, over the walk (hero.action)
  action(E, o) { return this.hero.action(E.name, o); }
  // what the walk is made of this frame: the base layer's weights, the actions over it, the blends
  live() {
    const H = this.hero, W = this.w, w = H.weights || {}, sum = Object.values(w).reduce((a, b) => a + b, 0) || 1;
    return { speed: W.speed, sprint: W.sprinting, sneak: W.sneaking, ground: W.onGround, block: W.blocking, guard: W.guard, bow: W.bow?.st || '', swing: W.swing > 0 ? W.strikeMove?.clip : '',
      weights: Object.entries(w).map(([n, x]) => [n, x / sum]).sort((a, b) => b[1] - a[1]),
      actions: H.actions.map((h) => [h.name, h.w, h.time]),
      blends: { crouch: H.crouchK, guard: H.guardK, block: H.blockK, fall: H.fallK, sprint: H.sprintW, upper: H.upperK }, pelvis: H.ik?.pelvis || 0, moveK: H.moveK };
  }
  // a line for the notes: who and how dressed
  setup() { const L = this.hero.look, G = this.gear; return [L.body, G.armour && G.armour + ' armour', G.cape && 'cape', G.right, G.left].filter(Boolean).join(', '); }
}
