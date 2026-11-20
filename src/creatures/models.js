// Creature bodies. Deer, foxes, rabbits (hares) and hogs (boars) are the rigged low-poly pack (Idle / Walk / Gallop /
// Attack / Death...), young or grown by level, each in one of the pack's variations; the Minotaur, the skeletons and the
// Chimera are rigged characters with their own clips (KitBody). Dryads, dryadlings and giants are the packs' characters
// fitted onto the hero's Mixamo rig (so they share its run and strike clips), or the hero's own body dressed in bark or
// stone-grey hide without the packs. Every body exposes the same small interface: obj, animate(state, speed, dt),
// flash(k), dispose(), and cue(move) for the blows (BLOWS), point(bone) for where a part of it is in the world.
import * as THREE from 'three';
import { FootIK } from '../player/footik.js';
import { clone as cloneSkinned } from '../../vendor/three/jsm/utils/SkeletonUtils.js';
import { loadGLB, loadFBX, loadPack, normalizeHandle } from '../assets.js';
import { CLIPS, GRIP, loadMoves } from '../player/hero.js';
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

// ---- The blows: when each attack lands, in its clip's own seconds, measured from the clips (tests/suites/combat.mjs
// samples them again and fails if one drifts): the frame where the striking part (tusks, hand, labrys, paws, the tail's
// sting) stops dead at the end of its swing, at its furthest forward or lowest; a throw's, where the hand is fastest as it
// lets go. from: where the move starts (past a still lead-in), to: where it has settled enough to blend away, rate: how
// fast the game plays it (a rig's pace, DRESS, on top). Each move plays from its start, so the wind-up is always there
// to read, and the game lands the blow at that moment (cue: creatures.js, trial.js), not when the move begins.
//   (a rig is any body on the hero's Mixamo rig: the downward chop is the hero's own 'attack' clip, the throw is acts.glb's)
export const BLOWS = {
  hog: { attack: [['Attack', { hit: 0.6, to: 1.1 }]] },
  rig: { attack: [['attack', { hit: 0.85, to: 1.5 }]], throw: [['throw', { from: 0.2, hit: 0.87, to: 1.6 }]] },
  // (the Minotaur's sweep: the labrys drawn back and swung flat across in front of him, Attack2)
  minotaur: { attack: [['Attack2', { hit: 1.5, to: 2.45, rate: 1.1 }], ['Attack3', { hit: 0.62, to: 1.35, rate: 1.1 }]], slam: [['Attack1', { hit: 1.25, to: 2, rate: 1.15 }]], sweep: [['Attack2', { hit: 1.5, to: 2.45, rate: 1.1 }]],
    throw: [['Attack3', { hit: 0.62, to: 1.35, rate: 1.1 }]], roar: [['Taunt', { hit: 0.9, to: 2, rate: 1.2 }]] },
  skeleton: { attack: [['Attack1', { hit: 0.85, to: 1.45, rate: 1.1 }], ['Attack2', { hit: 0.88, to: 1.6, rate: 1.1 }], ['Attack3', { hit: 0.75, to: 1.9, rate: 1.1 }]] },
  // (breath: the lion's head drawn low, then held there while the fire pours out, hold)
  chimera: { attack: [['Attack1', { from: 0.45, hit: 1.1, to: 2.2, rate: 1.1 }]], claw: [['Attack1', { from: 0.45, hit: 1.1, to: 2.2, rate: 1.1 }]], sting: [['Attack2', { hit: 1.65, to: 2.5, rate: 1.3 }]],
    breath: [['Roar', { from: 0.3, hit: 0.95, to: 3.2, hold: true }]], roar: [['Roar', { hit: 1.3, to: 2.4, rate: 1.2 }]] },
};
// A move taken up (one of its clips at random): what the body will play once the state starts, and when, in the game's
// seconds from then, its blow lands (hit) and it's over (dur)
function cueMove(body, list, st, pace = 1) {
  if (!list) return null;
  const [name, b] = list[Math.floor(Math.random() * list.length)], from = b.from ?? 0, rate = (b.rate ?? 1) * pace;
  body.cued = { ...b, st, name, from, rate };
  return { hit: (b.hit - from) / rate, dur: (b.to - from) / rate };
}
const at = (bone) => (bone ? bone.getWorldPosition(new THREE.Vector3()) : null);

// ---- the rigged animal pack (PolyArt forest animals, converted by tools/assets: Idle / Walk / Gallop / Attack / Death...)
// len: nose to tail in metres (the young as much smaller as the pack draws them); walk and run: the speeds (m/s) its walk
// and gallop are drawn for; looks: the pack's variations of that animal (coats and builds, each a mesh of its own on the
// same skeleton), one picked for each creature; drop: the numbers of the pack's fantasy looks, painted with bright cyan or
// red markings, which have no place on a Greek island (and the black-and-white, blue-grey, purple-striped and red-striped
// coats of the does and the young, now that mothers and young go about together and are seen close). The pack's palette
// is bright in our light, so its colours are taken down a little (tint).
const PACK = { calf: { file: 'pack/calf', looks: 'pack/calfLooks', drop: [6, 8, 9, 10, 12], len: 0.94, walk: 0.95, run: 4.5 }, deer: { file: 'pack/doe', looks: 'pack/doeLooks', drop: [6, 8, 12], len: 1.6, walk: 1.6, run: 7.6 },
  stag: { file: 'pack/stag', looks: 'pack/stagLooks', len: 1.9, walk: 1.7, run: 7.6 },
  foxCub: { file: 'pack/foxCub', looks: 'pack/foxCubLooks', drop: [8, 9, 10], len: 0.55, walk: 0.7, run: 3.5 }, fox: { file: 'pack/fox', looks: 'pack/foxLooks', drop: [8, 9, 10], len: 0.95, walk: 1.2, run: 6 },
  // (hares: drawn a size up from life, or the meadow's grass swallows them, and in their brown, grey and sandy coats only,
  // without the pack's near-black, blue-grey and snow-white ones, and not darkened as much: they're meant to be spotted)
  rabbitCub: { file: 'pack/hareCub', looks: 'pack/hareCubLooks', drop: [2, 5, 6, 9, 10], len: 0.38, walk: 0.44, run: 3.5, tint: 0.92 }, rabbit: { file: 'pack/hare', looks: 'pack/hareLooks', drop: [2, 5, 6, 9, 10], len: 0.74, walk: 0.89, run: 6.8, tint: 0.92 },
  hogCub: { file: 'pack/boarCub', looks: 'pack/boarCubLooks', drop: [3, 6], len: 0.67, walk: 0.65, run: 3.8 }, hog: { file: 'pack/boar', looks: 'pack/boarLooks', drop: [9, 10], len: 1.35, walk: 1.3, run: 7.6 } };
// which body each level wears: the smallest the young, the middling and the big ones grown (a deer's big ones are stags);
// at level 0 only one in four is young (YOUNG), the rest grown
const AGES = { deer: ['calf', 'deer', 'stag'], fox: ['foxCub', 'fox', 'fox'], rabbit: ['rabbitCub', 'rabbit', 'rabbit'], hog: ['hogCub', 'hog', 'hog'] };
const TINT = 0.8;
const tpl = {};
function packTemplate(kind) {
  const A = PACK[kind];
  return (tpl[kind] ||= Promise.all([loadGLB(A.file), loadGLB(A.looks).catch(() => null)]).then(([gl, lk]) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); root.scale.multiplyScalar(A.len / Math.max(size.x, size.z));
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; for (const mt of [].concat(m.material)) mt.color.multiplyScalar(A.tint ?? TINT); } }); share(root);
    const clips = {}; for (const c of gl.animations) clips[c.name] = c;
    const looks = []; if (lk) { lk.scene.traverse((o) => { if (o.isSkinnedMesh && !A.drop?.includes(+o.name.match(/(\d+)$/)?.[1])) looks.push(o); }); share(lk.scene); }
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
    let want = 'Idle', rate = 1; const q = this.cued?.st === st ? this.cued : null;
    if (st === 'dead') want = 'Death'; else if (st === 'attack') { want = q?.name || 'Attack'; rate = this.move?.rate ?? 1; } else if (st === 'hit' && this.acts.Idle_HitReact1) want = 'Idle_HitReact1';
    else if (speed > this.speedRef * 0.45) { want = 'Gallop'; rate = clamp(speed / (this.speedRef * 0.8), 0.7, 1.8); }   // (the young scurry to keep up)
    else if (speed > 0.15) { want = 'Walk'; rate = clamp(speed / this.walkRef, 0.6, 1.8); }
    else if (st === 'graze') want = 'Eating';
    const a = this.acts[want] || this.acts.Idle; if (!a) return;
    // (a blow taken up starts its clip again from the top, even straight after the last one)
    if (this.cur !== want || q) { const prev = this.acts[this.cur]; a.reset().setEffectiveWeight(1).play(); if (prev !== a) { a.fadeIn(0.2); prev?.fadeOut(0.2); } this.cur = want;
      if (q) { this.cued = null; a.time = q.from; rate = q.rate; this.move = { a, ...q }; } }
    a.timeScale = rate; this.mixer.update(dt);
  }
  cue(st) { return cueMove(this, BLOWS.hog[st], st); }
  point(name) { let b = null; this.obj.traverse((o) => { if (!b && o.isBone && o.name === name) b = o; }); return at(b); }
  flash(k) { for (const m of this.mats) { m.emissive?.setRGB(k * 0.6, 0, 0); } }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

// Feet on the ground (see FootIK), after animate(), with the ground under the creature. The IK bends the legs it's
// given: put back first to the clip's pose, which the mixer skips re-applying when nothing changed, and to rest for a
// bone the clip doesn't move at all. Only the bindings a playing clip drives are put back: the others' buffers still
// hold the last pose some clip gave them long ago (a leg of the Minotaur's charge, held up off the ground in his idle).
function plantFeet(body, dt, ground, rootY, active, legs, k = 1, lock = false) {
  if (!body.ik) { body.ik = new FootIK(body.bones, ground, legs, k, lock); body.legRest = body.ik.legs.flatMap((L) => [L.up, L.knee, L.foot]).map((b) => [b, b.quaternion.clone()]); }
  for (const [b, q] of body.legRest) b.quaternion.copy(q);
  const M = body.mixer, off = M._accuIndex + 1; for (let i = 0; i < M._nActiveBindings; i++) { const b = M._bindings[i]; b.binding.setValue(b.buffer, off * b.valueSize); }
  const m = body.obj.children[0]; m.position.y = body.ik.plan(dt, rootY, active); body.obj.updateMatrixWorld(true); body.ik.solve(rootY, dt);
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
// dryad's staff, a thin dark crook taller than she is, held like a walking staff: its knob over her head, its foot on
// the ground, a little in front of her hand so her arm doesn't hide it; the dryadling's blade held as the hero holds a
// tool)
const held = {}, CLUB = { at: [0, 8, 3], turn: [0, 0, -1.9] };
const packHeld = ({ model, len }) => (held[model] ||= loadPack(model).then((gl) => { const h = normalizeHandle(gl.scene, len); h.position.y = -8; share(h); return h; }).catch(() => null));
const DRESS = {
  dryad: () => ({ file: 'pack/dryad', mat: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, color: 0xb8c49a }), scale: 1.05, pace: 1.1, crown: 0x5d8a34, eyes: 0xc8ff8a, hold: { model: 'witchStaff', len: 230, at: [0, -140, 6], turn: [0, 0, 0] } }),
  // a dryadling: a little one, the dryad's height brought down to its own (creatures.js h)
  dryadling: () => ({ file: 'pack/dryadling', mat: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, color: 0x9aa878 }), scale: 1.1 / 1.95, pace: 1.25, crown: 0x4d7a2c, eyes: 0xc8ff8a, hold: { model: 'evilGodWeapon', len: 80, at: GRIP.at, turn: [0, Math.PI * 1.5, GRIP.tilt, 'ZYX'] } }),
  giant: () => ({ file: 'pack/giant', mat: new THREE.MeshStandardMaterial({ map: TEX.hide, roughness: 0.9, color: 0x8a8f9a }), scale: 3.1, pace: 0.7, crown: null, eyes: 0xffd27a, club: true, hold: { model: 'mutantClub', len: 95, ...CLUB }, tint: 0.5 }),
};
class RigBody {
  constructor(kind, size = 1) {
    this.obj = new THREE.Group(); this.kind = kind; this.mats = []; this.mixer = null; this.acts = {}; this.t = 0; this.deadT = 0; this.one = null;
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
      // (the throw is in acts.glb, fetched for the dryads as their bodies come in)
      const go = () => { act(CLIPS.run, 'run'); act(CLIPS.attack, 'attack', true); act(CLIPS.punch, 'punch', true); loadMoves('acts').then(() => !this.gone && CLIPS.throw && act(CLIPS.throw, 'throw', true)); if (CLIPS.disarm.ready) { const a = this.mixer.clipAction(CLIPS.disarm.clip.clone()); a.time = CLIPS.disarm.dur * 0.97; a.paused = true; a.play(); this.acts.idle = a; } this.ready = true; };
      const wait = () => (CLIPS.run.ready && CLIPS.attack.ready && CLIPS.disarm.ready ? go() : setTimeout(wait, 300)); wait();
    }).catch((e) => console.warn(kind, 'rig failed', e));
  }
  animate(st, speed, dt) {
    if (!this.ready) return; this.t += dt;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.x = -Math.min(Math.PI / 2, this.deadT * 2.5 * this.deadT * 2); this.mixer.update(0); return; }
    const runV = (this.dress.scale) * 3.9, k = clamp(speed / (runV * 0.5), 0, 1);
    const A = this.acts, q = this.cued?.st === st ? this.cued : null;
    // a blow or a throw taken up: its clip from the top, over the run and the stance (which give way to it, so it's seen
    // whole, not half mixed with them), until it has settled or the creature does something else (a throw cut short)
    if (q) { this.cued = null; const a = A[q.name]; if (a) { if (this.one && this.one.a !== a) this.one.a.setEffectiveWeight(0); a.reset(); a.time = q.from; a.timeScale = q.rate; a.play(); this.one = { a, st, e: 0, t: (q.to - q.from) / q.rate }; this.move = { a, ...q }; } }
    let w = 0; const o = this.one;
    if (o) { if (st !== o.st) o.t = Math.min(o.t, 0.15); o.t -= dt; o.e += dt; w = clamp(Math.min(o.e / 0.08, o.t / 0.15), 0, 1); o.a.setEffectiveWeight(w); if (o.t <= 0) this.one = null; }
    A.run && (A.run.setEffectiveWeight(k * (1 - w)), A.run.timeScale = clamp(speed / runV, 0.4, 1.4)); A.idle && A.idle.setEffectiveWeight((1 - k) * (1 - w));
    this.mixer.update(dt);
  }
  cue(st) { return cueMove(this, BLOWS.rig[st], st, this.dress.pace); }
  point(name) { return at(this.bones?.[name]); }
  hand() { return this.point('mixamorigRightHand'); }
  feet(dt, ground, rootY, active) { if (this.ready && this.bones) plantFeet(this, dt, ground, rootY, active); }
  flash(k) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6, 0, 0); }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

// ---- characters with their own clips (converted by tools/assets from the team's packs)
// h: height in metres; walk and run: how fast (m/s, at that height) its walk and run clips are drawn, so the feet
// don't slide. A one-shot clip is [name, the moment in it that matters (a stagger's jolt, the charge's lunge, the paws
// landing)]: it's started early or played quicker to put that moment where the game wants it (WHEN). The blows, roars and
// the fire are BLOWS's, played whole.
// fix: clips whose body wanders off its place (a bone's travel across the ground, [bone, share kept, from the idle's
// place]): the Minotaur's pawing drew his hips back three of his own metres (ten in the game) and snapped them home, and
// his crash into a wall was posed five metres ahead of him, so he jumped forward as it began; the skeleton's walk carried
// it forward a stride and a half and back every cycle. Kept: a little of the pawing's rock back, the crash's stagger.
// walk, run: measured from the clips once they stand in place (the planted foot's speed back along the ground).
// tired: the breathing he stands in while spent (trial.js), its clip and how fast it plays
const KIT = {
  minotaur: { file: 'pack/minotaur', legs: (s) => [`${s}UpLeg`, `${s}Leg`, `${s}Foot`], feet: ['LeftFoot', 'RightFoot'], h: 3.2, walk: 1.32, run: 4.4, fix: { RamStart: ['Hips', 0.2], RamWall: ['Hips', 1, true] },
    clips: { idle: 'Idle', walk: 'Walk', run: 'RamRun', dead: 'Death', tired: 'Idle',
      attack: [['Attack2', 1.53], ['Attack3', 0.53]], slam: [['Attack1', 1.17]], sweep: [['Attack2', 1.53]], roar: [['Taunt', 0.93]], paw: [['RamStart', 1.3]], hit: [['GotHit', 0.2]], dazed: [['RamWall', 0.17]] } },
  skeleton: { file: 'pack/skeleton', legs: (s) => [`Base_Human${s[0]}Thigh1`, `Base_Human${s[0]}Calf`, `Base_Human${s[0]}Foot`], h: 1.9, walk: 1.02, run: 1.02, fix: { Walk: ['base_sk', 0, false, 'all'] },
    clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', dead: 'Death', attack: [['Attack1', 0.8], ['Attack2', 0.8], ['Attack3', 0.67]], roar: [['Taunt', 0.87]], rise: [['Taunt', 0.87]], hit: [['GotHit', 0.2]] } },
  // the Chimera: a great spined beast six metres long; its fire, claws and sting are the boss's moves (trial.js)
  chimera: { file: 'pack/chimera', len: 6, tall: 0.39, feet: ['Leg_L_F5', 'Leg_R_F5', 'Leg_L_B5', 'Leg_R_B5'], walk: 2.4, run: 2.4, clips: { idle: 'Idle', walk: 'Walk', run: 'Walk', dead: 'Death', tired: 'Idle',
    attack: [['Attack1', 1.1]], roar: [['Roar', 1.3]], crouch: [['Block', 0.4]], leap: [['Attack1', 1.02]], hit: [['GotHit', 0.2]] } },
};
// when in the clip the game's moment falls (s after the state starts) for each one-shot state (leap: the paws come down
// as the pounce lands, trial.js)
// (paw: the lunge into the charge as the pawing ends, trial.js MOVE.charge.paw)
const WHEN = { paw: 1.1, hit: 0.1, dazed: 0.1, crouch: 0.3, leap: 0.8, rise: 0.9 };
const kits = {};
function kitTemplate(kind) {
  const K = KIT[kind];
  return (kits[kind] ||= loadGLB(K.file).then((gl) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); root.scale.multiplyScalar(K.len ? K.len / Math.max(size.x, size.z) : K.h / size.y);
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } }); share(root);
    const clips = Object.fromEntries(gl.animations.map((c) => [c.name, c]));
    for (const [name, [bone, keep, home, axes]] of Object.entries(K.fix || {})) {   // (the clips put back in their place: K.fix)
      const tr = clips[name]?.tracks.find((t) => t.name === bone + '.position'), rest = home && clips[K.clips.idle].tracks.find((t) => t.name === bone + '.position'); if (!tr) continue;
      const v = tr.values, ax = axes === 'all' ? [0, 1, 2] : [0, 2];
      for (const k of ax) { const v0 = v[k], to = rest ? rest.values[k] : v0; for (let i = k; i < v.length; i += 3) v[i] = to + (v[i] - v0) * keep; }
    }
    return { root, clips };
  }));
}
// A boss is drawn giant (size: creatures.js TYPES), its walk and run as much faster as it is bigger so its feet keep to
// the ground, and its blows and roars played a little slower (pace) for their weight: the blows' moments in the game's
// seconds come out of cue() with the pace in them, so BLOWS holds as it is.
class KitBody {
  constructor(kind, scale = 1, pace = 1) {
    this.kind = kind; this.K = KIT[kind]; this.s = scale; this.pace = pace; this.obj = new THREE.Group(); this.mixer = null; this.acts = {}; this.mats = []; this.cur = null; this.once = null; this.onceT = 0;
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
    const moves = C[st], fresh = st !== this.prevSt, q = this.cued?.st === st ? this.cued : null; this.prevSt = st;
    if (q) {   // a blow (or a roar, the fire) from BLOWS: played whole, from its start
      this.cued = null; const a = this.play(q.name, 0.12); a.reset(); a.time = q.from; a.timeScale = q.rate;
      this.once = st; this.onceT = (q.to - q.from) / q.rate; this.move = { a, ...q };
    } else if (Array.isArray(moves) && fresh) {
      const [name, at] = moves[Math.floor(Math.random() * moves.length)], want = WHEN[st] ?? 0.3;
      const rate = clamp(at / Math.max(want, 0.05), 0.8, 1.4), a = this.play(name, 0.12); a.reset(); a.time = Math.max(0, at - want * rate); a.timeScale = rate;
      this.once = st; this.onceT = (a.getClip().duration - a.time) / rate - 0.15;
    }
    // (the fire: once the head is down, it stays there, barely moving, while the state lasts; then the clip plays out)
    const m = this.move; if (m?.hold && this.once === m.st) { if (st === m.st && m.a.time >= m.hit) { m.a.timeScale = 0.05; this.onceT = Math.max(this.onceT, 0.3); } else if (st !== m.st) { m.a.timeScale = m.rate; m.hold = false; } }
    if (this.once && (this.onceT -= dt) > 0) { this.mixer.update(dt); return; }
    this.once = null;
    // spent (trial.js): standing heaving for breath, the idle slowed and the chest and shoulders rising and falling over it
    this.heave = st === 'tired' && !!C.tired; if (this.heave) { this.play(C.tired, 0.4).timeScale = 0.55; this.mixer.update(dt); return; }
    // walking and running, drawn at the speed it's going (a giant's stride as long as it is big); turning where it stands
    // (turn: how fast it's turning, set by creatures.js) it steps round, its feet walking it about rather than sliding
    const v = Math.max(speed / this.s, Math.abs(this.turn || 0) * (this.K.h ?? 1) * 0.3);
    if (v > this.K.walk * 1.6 && C.run !== C.walk) this.play(C.run, 0.3).timeScale = clamp(v / this.K.run, 0.45, 1.5);
    else if (v > (this.cur === C.walk ? 0.08 : 0.16)) this.play(C.walk, 0.3).timeScale = clamp(v / this.K.walk, 0.4, C.run === C.walk ? 2.4 : 1.6);
    else this.play(C.idle, 0.35).timeScale = 1;
    this.mixer.update(dt);
  }
  // Heaving for breath, over the clip's pose (after the feet, which put every bone back to the clip first): the chest
  // swelling and the head and shoulders rising on each long breath in, sagging on the way out (a breath every second and
  // a half), its own time kept in breathT
  breathe(dt) {
    const B = this.bones; if (!B) return; this.breathT = (this.breathT || 0) + dt; const s = Math.sin(this.breathT * 4.2), k = 0.5 + 0.5 * s;
    if (B.Spine1) B.Spine1.rotation.x -= 0.07 * k; if (B.Spine2) B.Spine2.rotation.x -= 0.05 * k; if (B.Neck) B.Neck.rotation.x += 0.12 * k - 0.06;
    for (const n of ['LeftShoulder', 'RightShoulder']) if (B[n]) B[n].rotation.z += (n[0] === 'L' ? 1 : -1) * 0.06 * k;
    return s;
  }
  // (a giant's feet are held where they come down: FootIK lock)
  feet(dt, ground, rootY, active) { if (this.mixer) { plantFeet(this, dt, ground, rootY, active, this.K.legs, this.s, this.s > 2); if (this.heave) this.breathe(dt); } }
  // Its feet coming down (a boss's footsteps: creatures.js): each foot's height over the lowest it has lately been, a foot
  // that has lifted a little way (a thirtieth of its height) landing as it comes back to it. Returns where each foot that
  // landed since the last call is in the world. (K.tall: a long body's height for its length)
  footfalls(dt) {
    const F = this.K.feet; if (!F || !this.bones) return null;
    const h = (this.K.h ?? this.K.len * this.K.tall) * this.s, up = 0.03 * h, down = 0.01 * h, out = [];
    this.ff ||= F.map(() => ({ lo: Infinity, up: false }));
    F.forEach((n, i) => { const b = this.bones[n], f = this.ff[i]; if (!b) return; const p = b.getWorldPosition(new THREE.Vector3()), y = p.y - this.obj.position.y;
      f.lo = Math.min(f.lo + dt * up * 0.5, y); const lift = y - f.lo; if (lift > up) f.up = true; else if (f.up && lift < down) { f.up = false; out.push(p); } });
    return out;
  }
  cue(st) { return cueMove(this, BLOWS[this.kind]?.[st], st, this.pace); }
  point(name) { return at(this.bones?.[name]); }
  // (glow: a warm light over it, a boss spent and open to blows: trial.js)
  flash(k, glow = 0) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6 + glow * 0.42, glow * 0.26, glow * 0.05); }
  dispose() { this.gone = true; this.mixer?.stopAllAction(); free(this.obj); }
}

// A level-0 animal is young one time in four: picked by where it was born, as its looks are (with dice of its own),
// unless the spawner says (young: a sow's piglets and a doe's fawn are young, the mothers and lone hogs and deer grown).
// The body says which it is (body.young).
const YOUNG = 0.25;
export function makeBody(kind, level = 0, x = 0, z = 0, young, size = 1, pace = 1) {
  if (kind === 'chimera' || kind === 'minotaur' || kind === 'skeleton') return new KitBody(kind, size, pace);
  if (kind === 'dryadling') return new RigBody('dryadling', 1 + level * 0.1);
  if (kind === 'dryad' || kind === 'giant') return new RigBody(kind);
  const ages = AGES[kind] || AGES.rabbit, lv = clamp(level, 0, 2), small = young ?? (lv === 0 && hash21(Math.round(x * 10) + 0.5, Math.round(z * 10) - 0.5) < YOUNG);
  const b = new PackBody(ages[small ? 0 : Math.max(lv, 1)], lv === 2 && kind !== 'deer' && !small ? 1.12 : 1);   // (the biggest of the grown ones a little bigger still, but a stag is big enough)
  b.young = small; return b;
}
export function preloadBodies() { for (const k of ['calf', 'rabbitCub']) packTemplate(k); rigTemplate('dryad'); rigTemplate('dryadling'); }
