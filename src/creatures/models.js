// Creature bodies. Deer and foxes are the rigged low-poly pack (Idle / Walk / Gallop / Attack / Death...). Rabbits,
// hogs and dryadlings are carved here with simple procedural motion. Dryads, giants and skeletons borrow the hero's
// Mixamo rig (so they share its run and strike clips) dressed in bark, stone-grey hide or bleached bone: stand-ins until
// their own models arrive. Every body exposes the same small interface: obj, animate(state, speed, dt), flash(k), dispose().
import * as THREE from 'three';
import { clone as cloneSkinned } from '../../jsm/utils/SkeletonUtils.js';
import { loadGLB, loadFBX } from '../assets.js';
import { CLIPS } from '../player/hero.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const flat = (c, o = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, flatShading: true, ...o });
const mesh = (g, m, x = 0, y = 0, z = 0, parent) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent?.add(o); return o; };
function canvasTex(draw, n = 256) { const c = document.createElement('canvas'); c.width = c.height = n; draw(c.getContext('2d'), n); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; return t; }
let sd = 11; const r = () => ((sd = (sd * 16807) % 2147483647) - 1) / 2147483646;
const TEX = {
  bark: canvasTex((g, n) => { g.fillStyle = '#5a4630'; g.fillRect(0, 0, n, n); for (let i = 0; i < 90; i++) { const x = r() * n; g.strokeStyle = `rgba(${30 + r() * 30},${22 + r() * 20},${12},${0.5 + r() * 0.4})`; g.lineWidth = 2 + r() * 4; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + r() * 20 - 10, n * 0.3, x + r() * 20 - 10, n * 0.7, x + r() * 10 - 5, n); g.stroke(); }
    for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${80 + r() * 40},${120 + r() * 40},${50},${0.35})`; g.beginPath(); g.ellipse(r() * n, r() * n, 6 + r() * 14, 4 + r() * 10, r() * 3, 0, 7); g.fill(); } }),
  hide: canvasTex((g, n) => { g.fillStyle = '#7a7266'; g.fillRect(0, 0, n, n); for (let i = 0; i < 400; i++) { const v = 90 + r() * 60; g.fillStyle = `rgba(${v},${v * 0.95},${v * 0.85},.35)`; g.beginPath(); g.arc(r() * n, r() * n, 2 + r() * 9, 0, 7); g.fill(); } for (let i = 0; i < 30; i++) { g.strokeStyle = 'rgba(40,34,28,.35)'; g.beginPath(); g.moveTo(r() * n, r() * n); g.lineTo(r() * n, r() * n); g.stroke(); } }),
  bone: canvasTex((g, n) => { g.fillStyle = '#d9cdb0'; g.fillRect(0, 0, n, n); for (let i = 0; i < 300; i++) { const v = 170 + r() * 60; g.fillStyle = `rgba(${v},${v * 0.92},${v * 0.75},.4)`; g.beginPath(); g.arc(r() * n, r() * n, 1 + r() * 6, 0, 7); g.fill(); } for (let i = 0; i < 25; i++) { g.strokeStyle = 'rgba(60,45,30,.5)'; g.lineWidth = 1; g.beginPath(); let x = r() * n, y = r() * n; g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += r() * 20 - 10; y += r() * 20 - 10; g.lineTo(x, y); } g.stroke(); } }),
};

// ---- the rigged animal pack
const PACK = { deer: { file: 'deer', len: 1.6 }, stag: { file: 'stag', len: 1.9 }, fox: { file: 'fox', len: 0.95 } };
const tpl = {};
function packTemplate(kind) {
  const A = PACK[kind];
  return (tpl[kind] ||= loadGLB(A.file).then((gl) => {
    const root = gl.scene; root.updateMatrixWorld(true);
    const size = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3()); root.scale.multiplyScalar(A.len / Math.max(size.x, size.z));
    root.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } });
    const clips = {}; for (const c of gl.animations) clips[c.name.replace('Attack_Headbutt', 'Attack')] = c;
    return { root, clips };
  }));
}
class PackBody {
  constructor(kind, scale = 1) {
    this.obj = new THREE.Group(); this.mixer = null; this.acts = {}; this.cur = null; this.mats = []; this.speedRef = kind === 'fox' ? 6 : 7.6;
    packTemplate(kind).then((T) => {
      if (this.gone) return; const m = cloneSkinned(T.root); m.scale.multiplyScalar(scale);
      m.traverse((o) => { if (o.isMesh) { o.material = [].concat(o.material).map((mt) => { const c = mt.clone(); this.mats.push(c); return c; }); if (o.material.length === 1) o.material = o.material[0]; } });
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
    else if (speed > 0.15) { want = 'Walk'; rate = clamp(speed / 1.6, 0.6, 1.8); }
    else if (st === 'graze') want = 'Eating';
    const a = this.acts[want] || this.acts.Idle; if (!a) return;
    if (this.cur !== want) { const prev = this.acts[this.cur]; a.reset().setEffectiveWeight(1).fadeIn(0.2).play(); prev?.fadeOut(0.2); this.cur = want; }
    a.timeScale = rate; this.mixer.update(dt);
  }
  flash(k) { for (const m of this.mats) { m.emissive?.setRGB(k * 0.6, 0, 0); } }
  dispose() { this.gone = true; }
}

// ---- carved bodies with procedural motion
class CarvedBody {
  constructor(build) { this.obj = new THREE.Group(); this.t = Math.random() * 10; this.parts = build(this.obj); this.mats = []; this.obj.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); this.mats.push(o.material); } }); this.deadT = 0; }
  flash(k) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6, 0, 0); }
  dispose() {}
}
class RabbitBody extends CarvedBody {
  constructor() {
    super((g) => {
      const fur = flat(0xa98258), belly = flat(0xd8c8a8), body = new THREE.Group(); g.add(body);
      const b = mesh(new THREE.IcosahedronGeometry(0.17, 1), fur, 0, 0.17, 0, body); b.scale.set(0.85, 0.85, 1.2);
      const head = new THREE.Group(); head.position.set(0, 0.3, 0.17); body.add(head);
      mesh(new THREE.IcosahedronGeometry(0.1, 1), fur, 0, 0, 0, head).scale.set(1, 0.95, 1.1);
      for (const s of [-1, 1]) { const e = mesh(new THREE.CapsuleGeometry(0.025, 0.14, 2, 5), fur, 0.04 * s, 0.14, -0.02, head); e.rotation.set(-0.3, 0, 0.15 * s); mesh(new THREE.SphereGeometry(0.016, 5, 4), flat(0x111111), 0.055 * s, 0.025, 0.07, head); }
      mesh(new THREE.SphereGeometry(0.05, 6, 4), belly, 0, 0.2, -0.2, body);
      return { body, head };
    });
  }
  animate(st, speed, dt) {
    this.t += dt; const { body, head } = this.parts;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.z = Math.min(Math.PI / 2, this.deadT * 6); return; }
    const hop = speed > 0.2 ? Math.abs(Math.sin(this.t * (6 + speed * 1.6))) : 0;
    body.position.y = hop * 0.18 * clamp(speed / 3, 0.4, 1); body.rotation.x = speed > 0.2 ? -0.25 + hop * 0.35 : 0;
    head.rotation.x = st === 'graze' ? 0.5 + Math.sin(this.t * 8) * 0.05 : 0;
  }
}
class HogBody extends CarvedBody {
  constructor(scale = 1) {
    super((g) => {
      const hide = flat(0x4e3a2c), dark = flat(0x2e221a), tusk = flat(0xf0e6d0), root = new THREE.Group(); root.scale.setScalar(scale); g.add(root);
      const b = mesh(new THREE.IcosahedronGeometry(0.42, 1), hide, 0, 0.55, 0, root); b.scale.set(0.85, 0.85, 1.45);
      const mane = mesh(new THREE.BoxGeometry(0.12, 0.18, 0.9), dark, 0, 0.92, 0.05, root); mane.rotation.x = -0.1;
      const head = new THREE.Group(); head.position.set(0, 0.62, 0.62); root.add(head);
      mesh(new THREE.IcosahedronGeometry(0.24, 1), hide, 0, 0, 0, head).scale.set(0.9, 0.95, 1.2);
      const sn = mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.22, 7), hide, 0, -0.06, 0.25, head); sn.rotation.x = Math.PI / 2; mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 7).rotateX(Math.PI / 2), flat(0x8a5a4a), 0, -0.06, 0.36, head);
      for (const s of [-1, 1]) { mesh(new THREE.ConeGeometry(0.06, 0.14, 4), dark, 0.15 * s, 0.2, -0.02, head).rotation.z = -0.4 * s; const t = mesh(new THREE.ConeGeometry(0.025, 0.14, 4), tusk, 0.09 * s, -0.08, 0.3, head); t.rotation.set(-0.9, 0, 0.3 * s); mesh(new THREE.SphereGeometry(0.025, 5, 4), flat(0x110a06), 0.11 * s, 0.07, 0.15, head); }
      const legs = [];
      for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Group(); l.position.set(0.2 * x, 0.42, 0.38 * z); root.add(l); mesh(new THREE.CylinderGeometry(0.07, 0.055, 0.42, 6), hide, 0, -0.21, 0, l); mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 6), dark, 0, -0.42, 0.01, l); legs.push(l); }
      const tail = mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2, 4), dark, 0, 0.7, -0.62, root); tail.rotation.x = -0.6;
      return { root, head, legs };
    });
  }
  animate(st, speed, dt) {
    this.t += dt; const { root, head, legs } = this.parts;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.z = Math.min(Math.PI / 2, this.deadT * 4); return; }
    const k = clamp(speed / 3, 0, 1), f = 4 + speed * 2;
    legs.forEach((l, i) => (l.rotation.x = Math.sin(this.t * f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.7 * k));
    root.position.y = Math.abs(Math.sin(this.t * f)) * 0.05 * k;
    head.rotation.x = st === 'attack' ? Math.sin(this.t * 14) * 0.4 + 0.2 : st === 'graze' ? 0.45 : Math.sin(this.t * 1.3) * 0.05;
  }
}
class DryadlingBody extends CarvedBody {
  constructor(scale = 1) {
    super((g) => {
      const bark = new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95 }), leaf = flat(0x4f7a2e), glow = new THREE.MeshStandardMaterial({ color: 0xc8ff8a, emissive: 0x9aff50, emissiveIntensity: 2 });
      const root = new THREE.Group(); root.scale.setScalar(scale); g.add(root);
      const body = new THREE.Group(); body.position.y = 0.55; root.add(body);
      const trunk = mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.55, 7), bark, 0, 0.1, 0, body); trunk.rotation.z = 0.05;
      const head = new THREE.Group(); head.position.y = 0.48; body.add(head);
      mesh(new THREE.IcosahedronGeometry(0.17, 0), bark, 0, 0, 0, head).scale.set(1, 1.15, 0.95);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; const l = mesh(new THREE.IcosahedronGeometry(0.12, 0), leaf, Math.cos(a) * 0.14, 0.17 + (i % 2) * 0.06, Math.sin(a) * 0.12, head); l.scale.set(1, 0.6, 1); }
      for (const s of [-1, 1]) mesh(new THREE.SphereGeometry(0.03, 6, 4), glow, 0.06 * s, 0.02, 0.15, head);
      const arms = [], legs = [];
      for (const s of [-1, 1]) {
        const a = new THREE.Group(); a.position.set(0.17 * s, 0.25, 0); body.add(a); const ar = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.42, 5), bark, 0, -0.2, 0, a); ar.rotation.z = 0.1 * s;
        for (let k = 0; k < 3; k++) { const f = mesh(new THREE.ConeGeometry(0.015, 0.12, 3), bark, (k - 1) * 0.025, -0.45, 0.02, a); f.rotation.x = Math.PI; } arms.push(a);
        const l = new THREE.Group(); l.position.set(0.08 * s, 0, 0); root.add(l); l.position.y = 0.55; mesh(new THREE.CylinderGeometry(0.05, 0.07, 0.55, 5), bark, 0, -0.27, 0, l); legs.push(l);
      }
      return { root, body, head, arms, legs };
    });
  }
  animate(st, speed, dt) {
    this.t += dt; const { body, head, arms, legs } = this.parts;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.x = -Math.min(Math.PI / 2, this.deadT * 4); return; }
    const k = clamp(speed / 2.5, 0, 1), f = 5 + speed * 2.4, s = Math.sin(this.t * f);
    legs[0].rotation.x = s * 0.8 * k; legs[1].rotation.x = -s * 0.8 * k;
    arms[0].rotation.x = -s * 0.6 * k + (st === 'attack' ? -1.8 + Math.sin(this.t * 16) * 0.9 : 0); arms[1].rotation.x = s * 0.6 * k + (st === 'attack' ? -1.8 + Math.cos(this.t * 16) * 0.9 : 0);
    body.rotation.z = Math.sin(this.t * f * 0.5) * 0.08 * k; body.position.y = 0.55 + Math.abs(s) * 0.05 * k; head.rotation.y = Math.sin(this.t * 0.9) * 0.3;
  }
}

// ---- humanoids on the hero's rig
const RIG = { s: 1, ready: null };
function rigTemplate() {
  return (RIG.ready ||= loadFBX('hero_rig').then((obj) => {
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3()); RIG.s = 1.95 / size.y; obj.scale.setScalar(RIG.s);
    obj.traverse((m) => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; } }); obj.animations = [];
    return obj;
  }));
}
const DRESS = {
  dryad: () => ({ mat: new THREE.MeshStandardMaterial({ map: TEX.bark, roughness: 0.95, color: 0xb8c49a }), scale: 1.05, crown: 0x5d8a34, eyes: 0xc8ff8a }),
  giant: () => ({ mat: new THREE.MeshStandardMaterial({ map: TEX.hide, roughness: 0.9, color: 0x8a8f9a }), scale: 3.1, crown: null, eyes: 0xffd27a, club: true }),
  skeleton: () => ({ mat: new THREE.MeshStandardMaterial({ map: TEX.bone, roughness: 0.8, emissive: 0x302618, emissiveIntensity: 0.4 }), scale: 0.98, crown: null, eyes: 0x8af0ff, sword: true }),
  minotaur: () => ({ mat: new THREE.MeshStandardMaterial({ map: TEX.hide, roughness: 0.85, color: 0x7a4a30 }), scale: 1.75, crown: null, eyes: 0xff5a30, bull: true, labrys: true }),
};
class RigBody {
  constructor(kind) {
    this.obj = new THREE.Group(); this.kind = kind; this.mats = []; this.mixer = null; this.acts = {}; this.t = 0; this.deadT = 0; this.atkT = 0;
    const D = DRESS[kind](); this.dress = D; this.mats.push(D.mat);
    rigTemplate().then((T) => {
      if (this.gone) return;
      const m = cloneSkinned(T); m.scale.setScalar(RIG.s * D.scale);
      const bones = {}; m.traverse((o) => { if (o.isBone) bones[o.name] = o; if (o.isMesh) o.material = D.mat; });
      this.obj.add(m); this.bones = bones; this.mixer = new THREE.AnimationMixer(m);
      const head = bones.mixamorigHead, inv = 1 / (RIG.s * D.scale) * D.scale;
      const eyeM = new THREE.MeshStandardMaterial({ color: D.eyes, emissive: D.eyes, emissiveIntensity: 2.5 });
      for (const s of [-1, 1]) { const e = mesh(new THREE.SphereGeometry(1.4, 6, 4), eyeM, 3.2 * s, 9, 9.5); e.castShadow = false; head?.add(e); }
      if (D.crown && head) { const lm = flat(D.crown); for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; const l = mesh(new THREE.IcosahedronGeometry(6, 0), lm, Math.cos(a) * 9, 18 + (i % 3) * 3, Math.sin(a) * 8); l.scale.set(1, 0.6, 1); head.add(l); } }
      const hand = bones.mixamorigRightHand;
      if (D.club && hand) { const club = new THREE.Group(); mesh(new THREE.CylinderGeometry(4, 7, 95, 8).translate(0, 40, 0), new THREE.MeshStandardMaterial({ color: 0x6e5238, roughness: 0.9 }), 0, 0, 0, club); club.position.set(0, 8, 3); club.rotation.set(0, 0, -1.9); hand.add(club); }
      if (D.sword && hand) { const sw = new THREE.Group(); mesh(new THREE.BoxGeometry(3, 70, 7).translate(0, 45, 0), new THREE.MeshStandardMaterial({ color: 0x8a8070, roughness: 0.4, metalness: 0.6 }), 0, 0, 0, sw); mesh(new THREE.BoxGeometry(16, 3, 4).translate(0, 10, 0), flat(0x5a4632), 0, 0, 0, sw); sw.position.set(0, 8, 3); sw.rotation.set(0, Math.PI * 1.5, -2.1, 'ZYX'); hand.add(sw); }
      if (D.bull && head) {   // a bull's head over the hero's: broad skull, muzzle, great horns
        const hide = new THREE.MeshStandardMaterial({ map: TEX.hide, color: 0x4a2c1c, roughness: 0.9 }), horn = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5 });
        const bh = new THREE.Group(); bh.position.set(0, 10, 2); head.add(bh);
        mesh(new THREE.IcosahedronGeometry(14, 1), hide, 0, 0, 0, bh).scale.set(1.15, 1, 1.25);
        mesh(new THREE.CylinderGeometry(8, 10, 14, 8).rotateX(Math.PI / 2), hide, 0, -5, 14, bh); mesh(new THREE.CylinderGeometry(8.2, 8.2, 1, 8).rotateX(Math.PI / 2), flat(0x2a1a12), 0, -5, 21.2, bh);
        for (const sx of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(14, 2.6, 6, 12, Math.PI * 0.62), horn, sx * 10, 8, 0, bh); h.rotation.set(0, sx > 0 ? 0 : Math.PI, sx > 0 ? -0.35 : 0.35); mesh(new THREE.SphereGeometry(2.2, 6, 4), eyeM, sx * 7, 3, 12, bh); mesh(new THREE.ConeGeometry(3, 8, 5).rotateZ(sx * 1.2), hide, sx * 14, 2, 0, bh); }
        mesh(new THREE.TorusGeometry(3, 0.7, 5, 10), SMATgold(), 0, -9, 21, bh);
      }
      if (D.labrys && hand) { const ax = new THREE.Group(); mesh(new THREE.CylinderGeometry(2.4, 2.8, 150, 7).translate(0, 55, 0), new THREE.MeshStandardMaterial({ color: 0x5e4128, roughness: 0.9 }), 0, 0, 0, ax);
        const blade = new THREE.Shape(); blade.moveTo(0, -18); blade.quadraticCurveTo(34, -30, 40, 0); blade.quadraticCurveTo(34, 30, 0, 18); blade.closePath();
        const bg = new THREE.ExtrudeGeometry(blade, { depth: 3, bevelEnabled: false }).translate(0, 0, -1.5), bm = new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.35, metalness: 0.7 });
        for (const sx of [-1, 1]) { const b = mesh(bg.clone().scale(sx, 1, 1), bm, sx * 2, 118, 0, ax); b.castShadow = true; }
        ax.position.set(0, 8, 3); ax.rotation.set(0, Math.PI * 1.5, -2.1, 'ZYX'); hand.add(ax); }
      void inv;
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
    const atk = st === 'attack' ? A.attack : null;
    if (atk && this.atkT <= 0) { atk.reset(); atk.setEffectiveWeight(1); atk.timeScale = this.kind === 'giant' ? 0.7 : 1.1; atk.play(); this.atkT = atk.getClip().duration / atk.timeScale; }
    if (this.atkT > 0) { this.atkT -= dt; if (this.atkT <= 0 && A.attack) A.attack.setEffectiveWeight(0); }
    this.mixer.update(dt);
  }
  flash(k) { for (const m of this.mats) m.emissive?.setRGB(k * 0.6 + (this.kind === 'skeleton' ? 0.19 : 0), this.kind === 'skeleton' ? 0.15 : 0, this.kind === 'skeleton' ? 0.09 : 0); }
  dispose() { this.gone = true; }
}

const SMATgold = () => new THREE.MeshStandardMaterial({ color: 0xc9973a, roughness: 0.35, metalness: 0.8 });
// ---- the Chimera: a lion's body the size of a cart, a goat's head rising from its back, a serpent for a tail
class ChimeraBody extends CarvedBody {
  constructor() {
    super((g) => {
      const fur = new THREE.MeshStandardMaterial({ map: TEX.hide, color: 0xb88a4a, roughness: 0.9 }), mane = flat(0x6a3a1a), goat = flat(0x8a8070), scale = new THREE.MeshStandardMaterial({ color: 0x3e5a2a, roughness: 0.6, flatShading: true }), claw = flat(0xe8dcc0), eye = new THREE.MeshStandardMaterial({ color: 0xffd040, emissive: 0xffa000, emissiveIntensity: 2.5 });
      const root = new THREE.Group(); root.scale.setScalar(1.25); g.add(root);
      const body = new THREE.Group(); body.position.y = 1.55; root.add(body);
      mesh(new THREE.IcosahedronGeometry(1, 2), fur, 0, 0, 0, body).scale.set(0.95, 0.85, 1.9);
      mesh(new THREE.IcosahedronGeometry(1.05, 1), mane, 0, 0.25, 1.35, body).scale.set(1.05, 1.15, 0.9);
      const head = new THREE.Group(); head.position.set(0, 0.45, 2.15); body.add(head);
      mesh(new THREE.IcosahedronGeometry(0.62, 1), fur, 0, 0, 0, head).scale.set(1, 0.9, 1.1);
      mesh(new THREE.BoxGeometry(0.62, 0.45, 0.6), fur, 0, -0.2, 0.55, head); const jaw = mesh(new THREE.BoxGeometry(0.56, 0.16, 0.55), fur, 0, -0.45, 0.45, head);
      for (const sx of [-1, 1]) { mesh(new THREE.SphereGeometry(0.08, 6, 4), eye, sx * 0.28, 0.12, 0.5, head); mesh(new THREE.ConeGeometry(0.05, 0.18, 4).rotateX(Math.PI), claw, sx * 0.18, -0.38, 0.78, head); }
      // the goat
      const gn = new THREE.Group(); gn.position.set(0, 0.8, -0.3); body.add(gn);
      mesh(new THREE.CylinderGeometry(0.22, 0.32, 1.1, 7), goat, 0, 0.5, 0, gn).rotation.x = -0.3;
      const gh = new THREE.Group(); gh.position.set(0, 1.1, 0.2); gn.add(gh); mesh(new THREE.IcosahedronGeometry(0.3, 1), goat, 0, 0, 0, gh).scale.set(0.8, 0.9, 1.3); mesh(new THREE.ConeGeometry(0.06, 0.3, 4), goat, 0, -0.25, 0.25, gh);
      for (const sx of [-1, 1]) { const h = mesh(new THREE.TorusGeometry(0.28, 0.06, 5, 10, Math.PI * 1.1), flat(0x3a3028), sx * 0.15, 0.25, -0.1, gh); h.rotation.y = Math.PI / 2; mesh(new THREE.SphereGeometry(0.05, 5, 4), eye, sx * 0.14, 0.05, 0.25, gh); }
      // the serpent tail
      const tail = []; let prev = body;
      for (let i = 0; i < 7; i++) { const t = new THREE.Group(); t.position.set(0, i === 0 ? 0.2 : 0, i === 0 ? -1.8 : -0.42); prev.add(t); mesh(new THREE.SphereGeometry(0.24 - i * 0.022, 7, 5), scale, 0, 0, 0, t).scale.set(1, 1, 1.6); tail.push(t); prev = t; }
      const sh = new THREE.Group(); sh.position.z = -0.35; prev.add(sh); mesh(new THREE.ConeGeometry(0.16, 0.5, 6).rotateX(-Math.PI / 2), scale, 0, 0, -0.2, sh); for (const sx of [-1, 1]) mesh(new THREE.SphereGeometry(0.04, 5, 4), eye, sx * 0.08, 0.06, -0.15, sh);
      const legs = [];
      for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) { const l = new THREE.Group(); l.position.set(0.55 * x, 1.4, 1.1 * z); root.add(l); mesh(new THREE.CylinderGeometry(0.24, 0.18, 1.4, 7), fur, 0, -0.7, 0, l); mesh(new THREE.IcosahedronGeometry(0.24, 0), fur, 0, -1.4, 0.08, l).scale.set(1, 0.6, 1.3);
        for (let k = -1; k <= 1; k++) mesh(new THREE.ConeGeometry(0.04, 0.16, 4).rotateX(Math.PI / 2), claw, k * 0.09, -1.45, 0.32, l); legs.push(l); }
      return { root, body, head, jaw, gn, tail, legs };
    });
  }
  animate(st, speed, dt) {
    this.t += dt; const { body, head, jaw, gn, tail, legs } = this.parts;
    if (st === 'dead') { this.deadT += dt; this.obj.rotation.z = Math.min(Math.PI / 2, this.deadT * 1.6); return; }
    const k = Math.min(1, speed / 4), f = 3 + speed * 0.9;
    legs.forEach((l, i) => (l.rotation.x = Math.sin(this.t * f + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.6 * k + (st === 'claw' && i < 2 ? -1.1 * Math.max(0, Math.sin(this.t * 10)) : 0)));
    body.position.y = 1.55 + Math.abs(Math.sin(this.t * f)) * 0.08 * k; body.rotation.x = st === 'bite' ? -0.15 : 0;
    head.rotation.x = st === 'bite' ? 0.3 : Math.sin(this.t * 1.1) * 0.05; jaw.rotation.x = st === 'bite' || st === 'attack' ? 0.4 + Math.sin(this.t * 18) * 0.2 : 0.05;
    gn.rotation.z = Math.sin(this.t * 0.9) * 0.15; gn.rotation.x = st === 'roar' ? -0.4 : 0;
    tail.forEach((s, i) => { s.rotation.y = Math.sin(this.t * 2.5 - i * 0.6) * 0.25; s.rotation.x = (st === 'sting' ? -0.55 : -0.12) + Math.sin(this.t * 1.8 - i) * 0.05; });
  }
}
export function makeBody(kind, level = 0) {
  if (kind === 'chimera') return new ChimeraBody();
  if (kind === 'minotaur') return new RigBody('minotaur');
  if (kind === 'deer') return new PackBody(level >= 2 ? 'stag' : 'deer');
  if (kind === 'fox') return new PackBody('fox');
  if (kind === 'rabbit') return new RabbitBody();
  if (kind === 'hog') return new HogBody(1 + level * 0.12);
  if (kind === 'dryadling') return new DryadlingBody(1 + level * 0.1);
  if (kind === 'dryad' || kind === 'giant' || kind === 'skeleton') return new RigBody(kind);
  return new RabbitBody();
}
export function preloadBodies() { packTemplate('deer'); packTemplate('fox'); rigTemplate(); }
