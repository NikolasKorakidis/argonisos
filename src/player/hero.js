// The hero: the Mixamo-rigged character and its clips. A base layer (idle / run / sprint) plays on an AnimationMixer at
// a rate matched to ground speed; one-shots (jump, strike, punch, draw / sheathe, the bow) are sampled straight from
// their tracks and blended over it: whole body when standing, upper body only while moving.
import * as THREE from 'three';
import { FootIK } from './footik.js';
import { loadFBX, loadGLB, loadTex } from '../assets.js';
import { clamp, lerp } from '../util/math.js';
import { SETTINGS, onHeroChange } from '../ui/settings.js';

const ss = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const UPPER = /Spine|Neck|Head|Shoulder|Arm|Hand/, UPV = new THREE.Vector3(0, 1, 0);
// The bodies to choose from (Settings): Synty's plain man and woman in their underwear, fitted onto the Mixamo rig
// (tools/assets/fbx-page.mjs refit: same bones, same clips), each this tall; the tint takes the palette's glare off in our light
export const BODIES = { man: { file: 'hero', height: 1.95, tint: 0xb4aeb4 }, woman: { file: 'heroWoman', height: 1.86, tint: 0xb4aeb4 } };
// How the right hand holds a handle, in the hand bone's space (+x thumb side, +y fingers, +z palm; units of the rig, ~0.8 cm):
// where the handle's grip point sits, how far the handle tips from across the palm, and how far each finger joint curls
export const GRIP = { at: [0, 10.6, 4.1], tilt: -1.8, curl: 1.0 };
// A shield is strapped to the left forearm (bone space: +y elbow to wrist, the body's side +z): its middle this far down
// the forearm, its back this far out from the bone, on the outside of the arm, so the arm never passes through it
export const STRAP = { along: 15, out: 5 };

// A clip from an animation-only FBX, with its root motion flattened (we move the player ourselves)
function loadClip(name) {
  const C = { ready: false, clip: null, dur: 1, rootSpeed: 0 };
  loadFBX(name).then((obj) => {
    const clip = obj.animations[0]; if (!clip) throw new Error(`no animation in ${name}.fbx`);
    for (const t of clip.tracks) if (/Hips\.position/.test(t.name)) {
      const v = t.values, x0 = v[0], z0 = v[2], n = v.length; C.rootSpeed = Math.hypot(v[n - 3] - x0, v[n - 1] - z0) / clip.duration;
      for (let i = 0; i < v.length; i += 3) { v[i] = x0; v[i + 2] = z0; }
    }
    C.clip = clip; C.dur = clip.duration; C.ready = true;
  }).catch((e) => console.warn(`${name} animation failed to load`, e));
  return C;
}
export const CLIPS = {
  run: loadClip('run'), sprint: loadClip('sprint'), jump: loadClip('jump'), attack: loadClip('attack'), punch: loadClip('punch'),
  equip: loadClip('equip'), disarm: loadClip('disarm'),
  bowEquip: loadClip('bow_equip'), bowDraw: loadClip('bow_draw'), bowAim: loadClip('bow_aim'), bowDisarm: loadClip('bow_disarm'),
};
export const BOW_DUR = { equip: 0.88, draw: 0.8, lower: 0.3, disarm: 1.0, blend: 0.14 };

const _hq = new THREE.Quaternion(), _ab = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];

export class Hero {
  constructor(scene) {
    this.root = new THREE.Group(); this.root.rotation.order = 'YXZ'; scene.add(this.root);
    this.wrap = new THREE.Group(); this.root.add(this.wrap);
    this.mixer = null; this.model = null; this.bones = {}; this.acts = {}; this.samplers = {}; this.s = 1; this.t = 0;
    this.sprintW = 0; this.upperK = 0; this.strafeA = 0; this.airT = 0; this.landT = 0;
    // attachment points, filled once the rig loads: right hand (tools and weapons), left hand (bow, shield), back
    this.handR = new THREE.Group(); this.handL = new THREE.Group(); this.armL = new THREE.Group(); this.back = new THREE.Group(); this.backBow = new THREE.Group();
    this.placeholder = this.makePlaceholder(); this.wrap.add(this.placeholder);
    this.ready = this.load();
    onHeroChange(() => { this.ready = this.ready.then(() => this.load()); });
  }
  makePlaceholder() {      // a simple figure while the model streams in
    const g = new THREE.Group(), m = new THREE.MeshStandardMaterial({ color: 0xe9e0cc, roughness: 0.8 });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 1.0, 4, 10), m); body.position.y = 0.95; body.castShadow = true; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 8), new THREE.MeshStandardMaterial({ color: 0xc89a78 })); head.position.y = 1.72; head.castShadow = true; g.add(head);
    return g;
  }
  async load() {
    // the chosen body, the armour to dress it in (pack/heroArmour: the Greek warriors' pieces, converted on a body of
    // their own and moved onto this one's bones), or the old model when the pack isn't there
    const kind = BODIES[SETTINGS.hero] || BODIES.man;
    const [gl, dress] = await Promise.all([loadGLB('pack/' + kind.file).catch(() => null), loadGLB('pack/heroArmour').catch(() => null)]);
    let obj = gl?.scene, mat;
    if (obj) { obj.updateMatrixWorld(true); let map = null; obj.traverse((m) => { if (m.isMesh && !map) map = m.material.map; }); mat = new THREE.MeshStandardMaterial({ map, color: kind.tint, roughness: 0.8, metalness: 0 }); }
    else { obj = await loadFBX('hero_rig'); mat = new THREE.MeshStandardMaterial({ map: loadTex('hero_diffuse.jpg'), normalMap: loadTex('hero_normal.jpg', false), roughness: 0.8, metalness: 0 }); }
    const size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
    const bones = {};
    obj.traverse((m) => {
      if (m.isBone) bones[m.name] = m;
      if (!m.isMesh) return;
      m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;   // skinned bounds don't follow the pose
      m.material = mat;
    });
    if (gl && dress) this.dress(obj, dress.scene, bones);
    this.s = (gl ? kind.height : 1.95) / size.y; obj.scale.multiplyScalar(this.s);
    obj.animations = [];
    // (a body swapped in the settings: the old one goes, with what it held, the clips bound to it and its feet)
    const held = [this.handR, this.handL, this.armL, this.back, this.backBow];
    if (this.model) { this.wrap.remove(this.model); this.mixer.stopAllAction(); this.acts = {}; this.samplers = {}; this.ik = null; }
    this.bones = bones; this.parts = {}; obj.traverse((m) => { if (m.isMesh) this.parts[m.name] = m; }); this.wear(this.wearing);
    this.wrap.remove(this.placeholder); this.wrap.add(obj); this.model = obj;
    this.mixer = new THREE.AnimationMixer(obj);
    // Bones are in centimetres: attachment points sit in bone space, the objects on them undo the model scale
    const B = this.bones;
    B.mixamorigRightHand.add(this.handR); B.mixamorigLeftHand.add(this.handL); B.mixamorigLeftForeArm.add(this.armL);
    for (const g of [this.back, this.backBow]) B.mixamorigSpine2.add(g);
    for (const g of held) for (const o of g.children) o.scale.setScalar(1 / this.s);
    this.back.position.set(2, 8, -16); this.backBow.position.set(-2, 2, -17); this.backBow.rotation.set(0, 0, 0.6);
    return this;
  }
  // The armour's pieces (wear_<item>) and the hair from their own file onto this body: each keeps its bind (where it
  // sat on the warrior it came from) and follows the bones of the same name here, so every piece goes where its joints
  // went. Helmets and hair are fitted to this head first (the warrior's was smaller): moved and scaled from his head's
  // box onto this one's, less the head bone's own move, which the bones then make. Both bodies stand in their rest pose here.
  dress(obj, src, bones) {
    src.updateMatrixWorld(true); obj.updateMatrixWorld(true);
    let host = null; obj.traverse((m) => { if (m.isSkinnedMesh && !host) host = m.parent; });
    let map = null, headA = null; const wear = [];
    src.traverse((m) => { if (!m.isSkinnedMesh) return; if (m.name === 'base_head') headA = m; if (m.name.startsWith('wear_') || m.name === 'hair') { wear.push(m); map ||= m.material.map; } });
    const headB = host?.children.find((m) => m.name === 'base_head');
    const box = (m) => m.geometry.boundingBox.clone().applyMatrix4(m.bindMatrix), Ba = headA && headB && box(headA), Bb = Ba && box(headB);
    const mat = new THREE.MeshStandardMaterial({ map, color: 0xc4c4c4, roughness: 0.8, metalness: 0 });
    const ca = new THREE.Vector3(), cb = new THREE.Vector3(), ja = new THREE.Vector3(), jb = new THREE.Vector3(), v = new THREE.Vector3(), inv = new THREE.Matrix4();
    for (const m of wear) {
      const list = m.skeleton.bones.map((b) => bones[b.name]); if (!host || list.some((b) => !b)) continue;
      const hi = m.skeleton.bones.findIndex((b) => b.name === 'mixamorigHead');
      if (Bb && hi >= 0 && /Helmet$|^hair$/.test(m.name)) {
        const k = (Bb.max.x - Bb.min.x) / (Ba.max.x - Ba.min.x); Ba.getCenter(ca); Bb.getCenter(cb);
        ja.setFromMatrixPosition(inv.copy(m.skeleton.boneInverses[hi]).invert()); jb.setFromMatrixPosition(bones.mixamorigHead.matrixWorld);
        const P = m.geometry.attributes.position; inv.copy(m.bindMatrix).invert();
        for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m.bindMatrix).sub(ca).multiplyScalar(k).add(cb).sub(jb).add(ja).applyMatrix4(inv); P.setXYZ(i, v.x, v.y, v.z); }
        P.needsUpdate = true; m.geometry.computeBoundingBox();
      }
      host.add(m); m.bind(new THREE.Skeleton(list, m.skeleton.boneInverses), m.bindMatrix);
      m.material = mat; m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
    }
  }
  // Show the armour worn ({ head, body, legs }: item ids). The pack's hero carries each piece as a part of its own
  // (wear_<id>, from dress) and its own body in three (base_head, base_body, base_legs): armour takes the place of the
  // body under it, and a helmet the hair's. The old model has none: nothing changes on it.
  wear(ids = {}) {
    this.wearing = ids; const P = this.parts; if (!P) return;
    const on = (slot) => !!(ids[slot] && P['wear_' + ids[slot]]);
    for (const [n, m] of Object.entries(P)) if (n.startsWith('wear_')) m.visible = Object.values(ids).includes(n.slice(5));
    if (P.base_body) P.base_body.visible = !on('body'); if (P.base_legs) P.base_legs.visible = !on('legs'); if (P.hair) P.hair.visible = !on('head');
  }
  // Hold an object in the right hand. A long-handled tool (axe, club, spear...) runs across the palm and is gripped near its
  // end, head up and forward over the thumb (bone +X thumb side, +Y fingers, +Z palm)
  holdRight(obj) { this.handR.clear(); if (obj) { this.handR.add(obj); obj.scale.setScalar(1 / this.s); obj.position.fromArray(GRIP.at); obj.rotation.set(0, Math.PI * 1.5, GRIP.tilt, 'ZYX'); } this.gripR = !!obj; }
  // Sling something across the back (scaled out of bone space like the hand items)
  sling(obj, slot = this.back) { slot.clear(); if (obj) { slot.add(obj); obj.scale.setScalar(1 / this.s); } }
  // Hold something in the left hand (the bow), or strap it on the forearm (a shield: userData.strap, its face along -z)
  holdLeft(obj) {
    this.handL.clear(); this.armL.clear(); this.gripL = !!obj; if (!obj) return;
    obj.scale.setScalar(1 / this.s);
    if (!obj.userData.strap) { this.handL.add(obj); obj.position.fromArray(GRIP.at); obj.rotation.set(0, 0, Math.PI / 2); return; }   // (the bow, by its grip, in the fist)
    obj.rotation.set(0, 0, Math.PI); const back = new THREE.Box3().setFromObject(obj).max.z;   // (turned upright as the arm hangs; how deep its back is, in bone units)
    this.armL.add(obj); obj.position.set(0, STRAP.along, -STRAP.out - back);
  }
  act(key, C, idleAt) {
    if (this.acts[key] || !C.ready || !this.mixer) return this.acts[key];
    const a = this.mixer.clipAction(C.clip.clone());
    if (idleAt !== undefined) { a.time = C.dur * idleAt; a.paused = true; }   // a held frame used as the idle pose
    a.setEffectiveWeight(0); a.play(); return (this.acts[key] = a);
  }
  sampler(C) {
    if (!C.ready || !this.mixer) return null;
    let S = this.samplers[C.clip.uuid]; if (S) return S;
    S = [];
    for (const tr of C.clip.tracks) {
      if (!tr.name.endsWith('.quaternion')) continue;
      const bone = this.bones[tr.name.slice(0, -11)]; if (!bone) continue;
      S.push({ bone, upper: UPPER.test(bone.name), interp: tr.createInterpolant() });
    }
    const hp = C.clip.tracks.find((tr) => tr.name === 'mixamorigHips.position');
    if (hp && this.bones.mixamorigHips) S.hips = { bone: this.bones.mixamorigHips, interp: hp.createInterpolant() };
    return (this.samplers[C.clip.uuid] = S);
  }
  // Blend clip C at normalised time t over the current pose with weight w. upper: true = upper body only, false = whole
  // body, or 0..1 to fade the legs out. hipsY: take the clip's hip height too (crouched stances)
  overlay(C, t, w, upper, hipsY) {
    const S = this.sampler(C); if (!S || w <= 0.001) return;
    const time = clamp(t, 0, 0.999) * C.dur, lw = w * (upper === true ? 0 : upper ? 1 - upper : 1);
    for (const s of S) { const ww = s.upper ? w : lw; if (ww <= 0.001) continue; _hq.fromArray(s.interp.evaluate(time)); s.bone.quaternion.slerp(_hq, ww); }
    if (hipsY && lw > 0.001 && S.hips) S.hips.bone.position.y = lerp(S.hips.bone.position.y, S.hips.interp.evaluate(time)[1], lw);
  }
  // Drive the rig every frame. st: { speed, sprinting, onGround, jumped, moveRel (walk direction relative to facing while
  // aiming), swing (1 → 0 while striking), swingKind ('punch' | 'tool'), equip ({ kind: 'equip'|'disarm', t }), bow, aimPt, swimming,
  // ground (x, z, y → the surface height there) and rootY (where the body stands), for setting the feet on the ground }
  update(dt, st) {
    if (!this.mixer) return;
    const C = CLIPS, idle = this.act('idle', C.disarm, 0.97), run = this.act('run', C.run), sprint = this.act('sprint', C.sprint);
    const speed = st.speed, moveW = clamp(speed / 2.2, 0, 1);
    this.sprintW = lerp(this.sprintW, st.sprinting && sprint ? 1 : 0, Math.min(1, dt * 6));
    const runV = C.run.rootSpeed > 50 ? C.run.rootSpeed * this.s : 3.9, sprV = C.sprint.rootSpeed > 50 ? C.sprint.rootSpeed * this.s : 7.2;
    // walking while aiming: face the target, legs go where you walk; backing up plays the run in reverse
    const rel = st.moveRel || 0, back = Math.abs(rel) > 1.95;
    this.strafeA = lerp(this.strafeA, clamp(back ? Math.atan2(Math.sin(rel - Math.PI), Math.cos(rel - Math.PI)) : rel, -1.35, 1.35), Math.min(1, dt * 10));
    if (run) { run.setEffectiveWeight(moveW * (1 - this.sprintW)); run.timeScale = (back ? -1 : 1) * clamp(speed / runV, 0.55, 1.5); }
    if (sprint) { sprint.setEffectiveWeight(moveW * this.sprintW); sprint.timeScale = clamp(speed / sprV, 0.7, 1.4); if (run) sprint.time = (run.time / C.run.dur) * C.sprint.dur; }
    if (idle) idle.setEffectiveWeight(Math.max(1 - moveW, run ? 0 : 1));
    this.mixer.update(dt);
    // The mixer only writes a bone when its value changed; the idle is a held frame, so re-apply every binding or the
    // overlays below would pile up frame after frame
    const off = this.mixer._accuIndex + 1;
    for (const b of this.mixer._bindings) b.binding.setValue(b.buffer, off * b.valueSize);
    this.t += dt;
    const B = this.bones;
    if (B.mixamorigSpine2) B.mixamorigSpine2.rotateX(Math.sin(this.t * 1.9) * 0.02 * (1 - moveW));     // breathing
    this.upperK = lerp(this.upperK, speed > 0.5 || !st.onGround ? 1 : 0, Math.min(1, dt * 8));
    if (Math.abs(this.strafeA) > 0.01 && B.mixamorigHips) B.mixamorigHips.rotateOnWorldAxis(UPV, this.strafeA);
    // jump: skip the wind-up, map airtime onto the rise and fall, then a short landing settle
    if (!st.onGround && !st.swimming) this.airT += dt; else { if (this.airT > 0.3) this.landT = 0.25; this.airT = 0; }
    const jumpT = st.jumped || this.airT > 0.25 ? this.airT : 0;
    if (this.landT > 0) this.landT -= dt;
    if (jumpT > 0) this.overlay(C.jump, 0.28 + jumpT / 0.7 * 0.5, Math.min(1, jumpT * 8), false);
    else if (this.landT > 0) this.overlay(C.jump, 0.8 + (0.25 - this.landT) * 0.6, this.landT / 0.25, false);
    if (st.equip) { const E = st.equip.kind === 'equip' ? C.equip : C.disarm, w = Math.min(1, Math.sin(Math.min(st.equip.t, 1) * Math.PI) * 2.5); this.overlay(E, st.equip.t, w, this.upperK); }
    if (st.swing > 0) this.overlay(st.swingKind === 'punch' ? C.punch : C.attack, 1 - st.swing, Math.min(1, st.swing * 6, (1 - st.swing) * 8 + 0.2), this.upperK);
    if (st.bow) this.poseBow(st.bow, st.aimPt, st.sprinting);
    // swimming: lean forward into a crawl-ish stroke on top of the run
    if (st.swimming && B.mixamorigHips) B.mixamorigHips.rotateX(0.9);
    // a closed fist round a held handle, the bow or the shield's grip (the clips leave the hands open)
    for (const [side, on] of [['Right', this.gripR], ['Left', this.gripL]]) if (on) for (const f of ['Index', 'Middle', 'Ring', 'Pinky']) for (let k = 1; k <= 3; k++) { const b = B[`mixamorig${side}Hand${f}${k}`]; if (b) b.rotation.x += GRIP.curl; }
    // feet on the real ground: the hips drop for the lower foot, the legs bend, planted feet follow the slope
    if (st.ground) {
      this.ik ||= new FootIK(B, st.ground);
      this.wrap.position.y += this.ik.plan(dt, st.rootY, st.onGround && !st.swimming && jumpT === 0);
      this.root.updateMatrixWorld(true); this.ik.solve(st.rootY);
    }
  }
  // Bow states: equip → ready → draw (hold RMB) → aim (full draw) → lower → ready → disarm
  poseBow(b, aimPt, sprinting) {
    if (b.t < 0) return;
    const C = CLIPS, up = this.upperK, aimPh = (t) => Math.min(t / C.bowAim.dur, 1);
    if (b.st === 'equip') this.overlay(C.bowEquip, b.t / BOW_DUR.equip, Math.min(1, b.t * 6), up, true);
    else if (b.st === 'disarm') this.overlay(C.bowDisarm, b.t / BOW_DUR.disarm, Math.min(1, (BOW_DUR.disarm - b.t) * 5), up, true);
    else if (b.st === 'ready') this.overlay(C.bowDraw, 0, lerp(1, sprinting ? 0.15 : 0.3, up), up, true);
    else if (b.st === 'draw') this.overlay(C.bowDraw, Math.max(b.ph, b.from || 0), 1, up, true);
    else if (b.st === 'aim') this.overlay(C.bowAim, aimPh(b.t), 1, up, true);
    else if (b.st === 'lower') this.overlay(C.bowDraw, 0, 1, up, true);
    const fade = b.st === 'lower' ? 1 - ss(b.t / BOW_DUR.lower) : b.st === 'draw' ? 1 - ss(b.t / BOW_DUR.blend) : 0;
    if (b.fromC && fade > 0) this.overlay(C[b.fromC], b.fromT, fade, up, true);
    const aimW = b.st === 'aim' ? 1 : b.st === 'draw' ? ss((b.ph - 0.6) / 0.3) : b.st === 'lower' && b.fromC ? fade * (b.fromC === 'bowAim' ? 1 : ss((b.fromT - 0.6) / 0.3)) : 0;
    if (aimW > 0.01 && aimPt) this.aimUpperBody(aimPt, aimW);
  }
  // Turn the spine (split over two joints) so the line string hand → bow hand points at the target
  aimUpperBody(target, w) {
    const Bn = this.bones, R = Bn.mixamorigRightHand, L = Bn.mixamorigLeftHand; if (!R || !L) return;
    for (const [bone, part] of [[Bn.mixamorigSpine1, 0.5], [Bn.mixamorigSpine2, 1]]) {
      const r = R.getWorldPosition(_ab[0]), cur = L.getWorldPosition(_ab[1]).sub(r).normalize(), want = _ab[2].copy(target).sub(r).normalize();
      const d = _ab[3].identity().slerp(_ab[4].setFromUnitVectors(cur, want), w * part);
      const pq = bone.parent.getWorldQuaternion(_ab[5]).invert(), wq = bone.getWorldQuaternion(_ab[4]);
      bone.quaternion.copy(pq.multiply(d.multiply(wq)));
    }
  }
}

