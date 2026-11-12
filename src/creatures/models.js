// Creature bodies. Deer, foxes, rabbits (hares) and hogs (boars) are the rigged low-poly pack (Idle / Walk / Gallop /
// Attack / Death...), young or grown by level, each in one of the pack's variations; the Minotaur, the skeletons and the
// Chimera are rigged characters with their own clips (KitBody). Dryads, dryadlings and giants are the packs' characters
// fitted onto the hero's Mixamo rig (so they share its run and strike clips), or the hero's own body dressed in bark or
// stone-grey hide without the packs. Every body exposes the same small interface: obj, animate(state, speed, dt),
// flash(k), dispose().
import * as THREE from 'three';
import { FootIK } from '../player/footik.js';
import { clone as cloneSkinned } from '../../vendor/three/jsm/utils/SkeletonUtils.js';
import { loadGLB, loadFBX, loadPack, normalizeHandle } from '../assets.js';
import { CLIPS, GRIP } from '../player/hero.js';
import { clamp, hash21 } from '../util/math.js';

const flat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
// When a creature goes, free what its body put on the GPU: the geometry built for it, its own materials and its
// skeleton's bone texture. The loaded models' geometry and materials are shared by every body made from them (marked
// shared) and stay; textures belong to the shared TEX set and stay too.
const share = (root) => root.traverse((o) => { if (o.geometry) o.geometry.userData.shared = true; for (const m of [].concat(o.material || [])) m.userData.shared = true; });
function free(obj) {
  obj.traverse((o) => {
    if (o.isSkinnedMesh) o.skeleton.dispose();
    if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose();
    for (const m of [].concat(o.material || [])) if (!m.userData.shared) m.dispose();
  });
}
const mesh = (g, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent?.add(o); return o; };
function canvasTex(draw, n = 256) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
const TEX = {
  bark: canvasTex((g, n) => { g.fillStyle = '#5a4630'; g.fillRect(0, 0, n, n); for (let i = 0; i < 90; i++) { const x = r() * n; g.strokeStyle = `rgba(${30 + r() * 30},${22 + r() * 20},${12},${0.5 + r() * 0.4})`; g.lineWidth = 2 + r() * 4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 20 - 10, n * 0.3, x + r() * 20 - 10, n * 0.7, x + r() * 10 - 5, n); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${80 + r() * 40},${120 + r() * 40},${50},${0.35})`; g.beginPath(); g.ellipse(r() * n, r() * n, 6 + r() * 14, 4 + r() * 10, r() * 3, 0, 7); g.fill(); } }),
  hide: canvasTex((g, n) => { g.fillStyle = '#7a7266'; g.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { const v = 90 + r() * 60; g.fillStyle = `rgba(${v},${v * 0.95},${v * 0.85},.35)`; g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 9, 0, 7); g.fill(); } for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(40,34,28,.35)'; g.beginPath(); g.moveTo(r() * n, r() * n); g.lineTo(r() * n, r() * n); g.stroke(); } }),
};

// ---- the rigged animal pack (PolyArt forest animals, converted by tools/assets: Idle / Walk / Gallop / Attack / Death...)
// len: nose to tail in metres (the young as much smaller as the pack draws them); walk and run: the speeds (m/s) its walk
// and gallop are drawn for; looks: the pack's variations of that animal (coats and builds, each a mesh of its own on the
// same skeleton), one picked for each creature. The pack's palette is bright in our light, so its colours are taken down
// a little (tint).
const PACK = { calf: { file: 'pack/calf', looks: 'pack/calfLooks', len: 0.94, walk: 0.95, run: 4.5 }, deer: { file: 'pack/doe', looks: 'pack/doeLooks', len: 1.6, walk: 1.6, run: 7.6 },
  stag: { file: 'pack/stag', looks: 'pack/stagLooks', len: 1.9, walk: 1.7, run: 7.6 },
  foxCub: { file: 'pack/foxCub', looks: 'pack/foxCubLooks', len: 0.55, walk: 0.7, run: 3.5 }, fox: { file: 'pack/fox', looks: 'pack/foxLooks', len: 0.95, walk: 1.2, run: 6 },
  rabbitCub: { file: 'pack/hareCub', looks: 'pack/hareCubLooks', len: 0.26, walk: 0.3, run: 2.4 }, rabbit: { file: 'pack/hare', looks: 'pack/hareLooks', len: 0.5, walk: 0.6, run: 4.6 },
  hogCub: { file: 'pack/boarCub', looks: 'pack/boarCubLooks', len: 0.67, walk: 0.65, run: 3.8 }, hog: { file: 'pack/boar', looks: 'pack/boarLooks', len: 1.35, walk: 1.3, run: 7.6 } };
// which body each level wears: the smallest the young, the middling and the big ones grown (a deer's big ones are stags)
const AGES = { deer: ['calf', 'deer', 'stag'], fox: ['foxCub', 'fox', 'fox'], rabbit: ['rabbitCub', 'rabbit', 'rabbit'], hog: ['hogCub', 'hog', 'hog'] };
const TINT = 0.8;
const tpl = {};
function packTemplate(kind) {
  const A = PACK[kind];
  return (tpl[kind] ||= Promise.all([loadGLB(A.file), loadGLB(A.looks).catch(() => null)]).then(([gl, lk]) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); root.scale.multiplyScalar(A.len / Math.max(size.x, size.z));
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; for (const mt of [].concat(m.material)) mt.color.multiplyScalar(TINT); } }); share(root);
    const clips = {}; for (const c of gl.animations) clips[c.name] = c;
    const looks = []; if (lk) { lk.scene.traverse((o) => { if (o.isSkinnedMesh) looks.push(o); }); share(lk.scene); }
    return { root, clips, looks };
  }));
}
// One of the variations put on a body in place of the mesh its clips came with: bound to the body's own bones by name
// (the same skeleton, at the same rest, so the bind it was exported with still holds), on the body's material
function wear(m, look) {
  const own = [], bones = {}; m.traverse((o) => { if (o.isSkinnedMesh) own.push(o); if (o.isBone) bones[o.name] = o; });
  if (!own.length || look.skeleton.bones.some((b) => !bones[b.name])) return;
  const v = new THREE.SkinnedMesh(look.geometry, own[0].material); v.name = look.name; v.castShadow = v.receiveShadow = true; v.frustumCulled = false;
  v.bind(new THREE.Skeleton(look.skeleton.bones.map((b) => bones[b.name]), look.skeleton.boneInverses), look.bindMatrix);
  own[0].parent.add(v); for (const o of own) o.removeFromParent();
}
class PackBody {
  constructor(kind, scale = 1) {
    this.obj = new THREE.Group(); this.mixer = null; this.acts = {}; this.cur = null; this.mats = []; this.speedRef = PACK[kind].run; this.walkRef = PACK[kind].walk;
    packTemplate(kind).then((T) => {
      if (this.gone) return; const m = cloneSkinned(T.root); m.scale.multiplyScalar(scale);
      // (which one goes by where it was born: the spawner has put the body there by the time its model is in)
      if (T.looks.length) wear(m, T.looks[Math.floor(hash21(Math.round(this.obj.position.x * 10), Math.round(this.obj.position.z * 10)) * T.looks.length)]);
      m.traverse((o) => { if (o.isMesh) { o.material = [].concat(o.material).map((mt) => { const c = mt.clone(); c.userData.shared = false; this.mats.push(c); return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
      this.obj.add(m); this.mixer = new THREE.AnimationMixer(m);
      for (const [k, clip] of Object.entries(T.clips)) this.acts[k] = this.mixer.clipAction(clip);
      for (const k of ['Death', 'Attack', 'Idle_HitReact1']) if (this.acts[k]) { this.acts[k].setLoop(THREE.LoopOnce); this.acts[k].clampWhenFinished = true; }
      this.mixer.update(Math.random() * 2);
    }).catch((e) => console.warn(kind, 'model failed', e));
  }
  animate(st, speed, dt) {
    if (!this.mixer) return;
    let want = 'Idle', rate = 1;
    if (st === 'dead') want = 'Death'; else if (st === 'attack') want = 'Attack'; else if (st === 'hit' && this.acts.Idle_HitReact1) want = 'Idle_HitReact1';
    else if (speed > this.speedRef * 0.45) { want = 'Gallop'; rate = clamp(speed / (this.speedRef * 0.8), 0.7, 1.5); }
    else if (speed > 0.15) { want = 'Walk'; rate = clamp(speed / this.walkRef, 0.6, 1.8); }
    else if (st === 'graze') want = 'Eating';
    const a = this.acts[want] || this.acts.Idle; if (!a) return;
    if (this.cur !== want) { const prev = this.acts[this.cur]; a.reset().setEffectiveWeight(1).fadeIn(0.2).play(); prev?.fadeOut(0.2); this.cur = want; }
    a.timeScale = rate; this.mixer.update(dt);
  }
  flash(k) { for (const m of this.mats) { m.emissive?.setRGB(k * 0.6, 0, 0); } }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

// Feet on the ground (see FootIK), after animate(), with the ground under the creature. The IK bends the legs it's
// given: put back first to the clip's pose, which the mixer skips re-applying when nothing changed, and to rest for a
// bone the clip doesn't move at all.
function plantFeet(body, dt, ground, rootY, active, legs) {
  if (!body.ik) { body.ik = new FootIK(body.bones, ground, legs); body.legRest = body.ik.legs.flatMap((L) => [L.up, L.knee, L.foot]).map((b) => [b, b.quaternion.clone()]); }
  for (const [b, q] of body.legRest) b.quaternion.copy(q);
  const off = body.mixer._accuIndex + 1; for (const b of body.mixer._bindings) b.binding.setValue(b.buffer, off * b.valueSize);
  const m = body.obj.children[0]; m.position.y = body.ik.plan(dt, rootY, active); body.obj.updateMatrixWorld(true); body.ik.solve(rootY);
}

// ---- humanoids on the hero's rig: each kind's own body from the team's packs fitted onto it (tools/assets/fbx-page.mjs
// refit: the same Mixamo bones, so they share the hero's run and strike clips), or the hero's own body dressed in bark or stone-grey
// hide when the pack isn't there
const rigs = {};
function rigTemplate(kind) {
  const D = DRESS[kind]();
  return (rigs[kind] ||= loadGLB(D.file).then((gl) => ({ obj: gl.scene, packed: true })).catch(() => loadFBX('hero_rig').then((obj) => ({ obj, packed: false }))).then(({ obj, packed }) => {
    obj.updateMatrixWorld(true); const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()), s = 1.95 / size.y; obj.scale.multiplyScalar(s);
    obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    obj.animations = []; share(obj); return { obj, packed, s };
  }));
}
// what each carries in its right hand, from the pack: { model, len: its length in the hand's bone units, at, turn: how
// it sits in the hand } (the giant's club as long as the carved one it falls back to, swung from over the shoulder; the
// dryad's staff stood upright beside her; the dryadling's blade held as the hero holds a tool)
const held = {}, CLUB = { at: [0, 8, 3], turn: [0, 0, -1.9] };
const packHeld = ({ model, len }) => (held[model] ||= loadPack(model).then((gl) => { const h = normalizeHandle(gl.scene, len); h.position.y = -8; share(h); return h; }).catch(() => null));
const DRESS = {
  dryad: () => ({ file: 'pack/dryad', mat: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, color: 0xb8c49a }), scale: 1.05, crown: 0x5d8a34, eyes: 0xc8ff8a, hold: { model: 'witchStaff', len: 150, at: [0, 9, 2], turn: [0, 0, Math.PI] } }),
  // a dryadling: a little one, the dryad's height brought down to its own (creatures.js h)
  dryadling: () => ({ file: 'pack/dryadling', mat: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, color: 0x9aa878 }), scale: 1.1 / 1.95, crown: 0x4d7a2c, eyes: 0xc8ff8a, hold: { model: 'evilGodWeapon', len: 80, at: GRIP.at, turn: [0, Math.PI * 1.5, GRIP.tilt, 'ZYX'] } }),
  giant: () => ({ file: 'pack/giant', mat: new THREE.MeshStandardMaterial({ map: TEX.hide, roughness: 0.9, color: 0x8a8f9a }), scale: 3.1, crown: null, eyes: 0xffd27a, club: true, hold: { model: 'mutantClub', len: 95, ...CLUB }, tint: 0.5 }),
};
class RigBody {
  constructor(kind, size = 1) {
    this.obj = new THREE.Group(); this.kind = kind; this.mats = []; this.mixer = null; this.acts = {}; this.t = 0; this.deadT = 0; this.atkT = 0;
    const D = DRESS[kind](); D.scale *= size; this.dress = D;
    rigTemplate(kind).then((T) => {
      if (this.gone) return;
      const m = cloneSkinned(T.obj); m.scale.multiplyScalar(D.scale);
      const bones = {}; m.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh) { o.material = T.packed ? o.material.clone() : D.mat; this.mats.push(o.material); } });
      if (T.packed) for (const mt of this.mats) mt.color.setScalar(D.tint ?? 0.78);   // (the pack's palette is pale in our light)
      this.obj.add(m); this.bones = bones; this.mixer = new THREE.AnimationMixer(m);
      const head = bones.mixamorigHead;
      const eyeM = new THREE.MeshStandardMaterial({ color: D.eyes, emissive: D.eyes, emissiveIntensity: 2.5 });
      if (!T.packed) for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(1.4, 6, 4), eyeM, 3.2 * s, 9, 9.5); e.castShadow = false; head?.add(e); }
      if (D.crown && head && !T.packed) { const lm = flat(D.crown); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const l = mesh(new THREE.IcosahedronGeometry(6, 0), lm, Math.cos(a) * 9, 18 + (i % 3) * 3, Math.sin(a) * 8); l.scale.set(1, 0.6, 1); head.add(l); } }
      const hand = bones.mixamorigRightHand;
      if (D.hold && hand) packHeld(D.hold).then((pc) => { if (this.gone) return; const H = pc ? D.hold : CLUB, w = pc ? pc.clone() : D.club ? new THREE.Group() : null; if (!w) return;
        if (!pc) mesh(new THREE.CylinderGeometry(4, 7, 95, 8).translate(0, 40, 0), new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.9 }), 0, 0, 0, w);   // (the carved club, without the pack)
        w.position.fromArray(H.at); w.rotation.set(...H.turn); hand.add(w); });
      const act = (C, key, once) => { if (!C.ready) return; const a = this.mixer.clipAction(C.clip.clone()); if (once) { a.setLoop(THREE.LoopOnce); a.clampWhenFinished = true; } a.setEffectiveWeight(0); a.play(); this.acts[key] = a; };
      const go = () => { act(CLIPS.run, 'run'); act(CLIPS.attack, 'attack', true); act(CLIPS.punch, 'punch', true); if (CLIPS.disarm.ready) { const a = this.mixer.clipAction(CLIPS.disarm.clip.clone()); a.time = CLIPS.disarm.dur * 0.97; a.paused = true; a.play(); this.acts.idle = a; } this.ready = true; };
      const wait = () => (CLIPS.run.ready && CLIPS.attack.ready && CLIPS.disarm.ready ? go() : setTimeout(wait, 300)); wait();
    }).catch((e) => console.warn(kind, 'rig failed', e));
  }
  animate(st, speed, dt) {
    if (!this.ready) return; this.t += dt;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.x = -Math.min(Math.PI / 2, this.deadT * 2.5 * this.deadT * 2); this.mixer.update(0); return; }
    const runV = (this.dress.scale) * 3.9, k = clamp(speed / (runV * 0.5), 0, 1);
    const A = this.acts; A.run && (A.run.setEffectiveWeight(k), A.run.timeScale = clamp(speed / runV, 0.4, 1.4)); A.idle && A.idle.setEffectiveWeight(1 - k);
    const atk = st === 'attack' || st === 'slam' ? A.attack : null;   // (slam: the same blow, slow and heavy)
    if (atk && this.atkT <= 0) { atk.reset(); atk.setEffectiveWeight(1); atk.timeScale = st === 'slam' ? 0.62 : this.kind === 'giant' ? 0.7 : 1.1; atk.play(); this.atkT = atk.getClip().duration / atk.timeScale; }
    if (this.atkT > 0) { this.atkT -= dt; if (this.atkT <= 0 && A.attack) A.attack.setEffectiveWeight(0); }
    this.mixer.update(dt);
  }
  feet(dt, ground, rootY, active) { if (this.ready && this.bones) plantFeet(this, dt, ground, rootY, active); }
  flash(k) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6, 0, 0); }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

// ---- characters with their own clips (converted by tools/assets from the team's packs)
// h: height in metres; walk and run: how fast (m/s, at that height) its walk and run clips are drawn, so the feet
// don't slide; blow: how long after an attack starts the game lands it. A one-shot clip is [name, the
// moment in it that matters (the blow lands, the roar peaks)]: it's started early or played quicker to put that moment
// where the game wants it.
const KIT = {
  minotaur: { file: 'pack/minotaur', legs: (s) => [`${s}UpLeg`, `${s}Leg`, `${s}Foot`], h: 3.2, walk: 1.85, run: 5.75, blow: 0.65, clips: { idle: 'Idle', walk: 'Walk', run: 'RamRun', dead: 'Death',
    attack: [['Attack2', 1.53], ['Attack3', 0.53]], slam: [['Attack1', 1.17]], roar: [['Taunt', 0.93]], paw: [['RamStart', 1.3]], hit: [['GotHit', 0.2]], dazed: [['RamWall', 0.17]] } },
  skeleton: { file: 'pack/skeleton', legs: (s) => [`Base Human${s[0]}Thigh1`, `Base Human${s[0]}Calf`, `Base Human${s[0]}Foot`], h: 1.9, walk: 1.1, run: 1.1, blow: 0.3, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', dead: 'Death',
    attack: [['Attack1', 0.8], ['Attack2', 0.8], ['Attack3', 0.67]], roar: [['Taunt', 0.87]], hit: [['GotHit', 0.2]] } },
  // the Chimera: a great spined beast six metres long; its fire, claws and sting are the boss's moves (trial.js)
  chimera: { file: 'pack/chimera', len: 6, walk: 2.4, run: 2.4, blow: 0.35, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', dead: 'Death',
    attack: [['Attack1', 1.1]], claw: [['Attack1', 1.1]], sting: [['Attack2', 1.3]], breath: [['Roar', 0.9]], roar: [['Roar', 0.9]], crouch: [['Block', 0.4]], leap: [['Attack1', 0.6]], hit: [['GotHit', 0.2]] } },
};
// when in the clip the game's moment falls (s after the state starts) for each one-shot state
const WHEN = { slam: 0.95, paw: 0.75, roar: 0.1, hit: 0.1, dazed: 0.1, claw: 0.35, sting: 0.45, breath: 0.6, crouch: 0.3, leap: 0.3 };
const kits = {};
function kitTemplate(kind) {
  const K = KIT[kind];
  return (kits[kind] ||= loadGLB(K.file).then((gl) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); root.scale.multiplyScalar(K.len ? K.len / Math.max(size.x, size.z) : K.h / size.y);
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } }); share(root);
    return { root, clips: Object.fromEntries(gl.animations.map((c) => [c.name, c])) };
  }));
}
class KitBody {
  constructor(kind, scale = 1) {
    this.K = KIT[kind]; this.obj = new THREE.Group(); this.mixer = null; this.acts = {}; this.mats = []; this.cur = null; this.once = null; this.onceT = 0;
    kitTemplate(kind).then((T) => {
      if (this.gone) return; const m = cloneSkinned(T.root); m.scale.multiplyScalar(scale);
      this.bones = {}; m.traverse((o) => { if (o.isBone) this.bones[o.name] = o; if (o.isMesh) { o.material = o.material.clone(); o.material.userData.shared = false; this.mats.push(o.material); } });
      this.obj.add(m); this.mixer = new THREE.AnimationMixer(m);
      for (const [k, c] of Object.entries(T.clips)) this.acts[k] = this.mixer.clipAction(c);
      for (const k of [this.K.clips.dead, ...Object.values(this.K.clips).filter(Array.isArray).flatMap((l) => l.map((x) => x[0]))]) { this.acts[k].setLoop(THREE.LoopOnce); this.acts[k].clampWhenFinished = true; }
      this.mixer.update(Math.random() * 2);
    }).catch((e) => console.warn(kind, 'model failed', e));
  }
  play(name, fade = 0.2) {
    const a = this.acts[name]; if (this.cur === name) return a;
    a.reset().setEffectiveWeight(1).fadeIn(fade).play(); this.acts[this.cur]?.fadeOut(fade); this.cur = name; return a;
  }
  animate(st, speed, dt) {
    if (!this.mixer) return; const C = this.K.clips;
    if (st === 'dead') { if (this.cur !== C.dead) { this.play(C.dead, 0.15).timeScale = 1; this.once = null; } this.mixer.update(dt); return; }
    // a one-shot move (a blow, the roar, a stagger) starts as the creature takes it up and plays through, unless another
    // cuts in (the game passes through chase between blows, so each blow starts its own)
    const moves = C[st], fresh = st !== this.prevSt; this.prevSt = st;
    if (Array.isArray(moves) && fresh) {
      const [name, at] = moves[Math.floor(Math.random() * moves.length)], want = st === 'attack' ? this.K.blow : WHEN[st];
      const rate = clamp(at / Math.max(want ?? 0.3, 0.05), 0.8, 1.4), a = this.play(name, 0.12); a.reset(); a.time = Math.max(0, at - want * rate); a.timeScale = rate;
      this.once = st; this.onceT = (a.getClip().duration - a.time) / rate - 0.15;
    }
    if (this.once && (this.onceT -= dt) > 0) { this.mixer.update(dt); return; }
    this.once = null;
    // walking and running, drawn at the speed it's going
    const v = speed;
    if (v > this.K.walk * 1.6 && C.run !== C.walk) this.play(C.run).timeScale = clamp(v / this.K.run, 0.6, 1.5);
    else if (v > 0.12) this.play(C.walk).timeScale = clamp(v / this.K.walk, 0.5, C.run === C.walk ? 2.4 : 1.6);
    else this.play(C.idle).timeScale = 1;
    this.mixer.update(dt);
  }
  feet(dt, ground, rootY, active) { if (this.mixer) plantFeet(this, dt, ground, rootY, active, this.K.legs); }
  flash(k) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6, 0, 0); }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

export function makeBody(kind, level = 0) {
  if (kind === 'chimera') return new KitBody('chimera');
  if (kind === 'minotaur' || kind === 'skeleton') return new KitBody(kind);
  if (kind === 'dryadling') return new RigBody('dryadling', 1 + level * 0.1);
  if (kind === 'dryad' || kind === 'giant') return new RigBody(kind);
  const ages = AGES[kind] || AGES.rabbit, lv = clamp(level, 0, 2);   // (the biggest of the grown ones a little bigger still, but a stag is big enough)
  return new PackBody(ages[lv], lv === 2 && kind !== 'deer' ? 1.12 : 1);
}
export function preloadBodies() { for (const k of ['calf', 'rabbitCub']) packTemplate(k); rigTemplate('dryad'); rigTemplate('dryadling'); }
