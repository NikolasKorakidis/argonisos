// The hero's moves from Mixamo: node tools/assets/moves.mjs
// Reads the clips downloaded from Mixamo (Y Bot, FBX, 30 fps, root motion left in) from "incoming assets/mixamo/" and
// writes two animation-only .glb files the hero loads (hero.js): assets/models/moves.glb, what the hero needs at once
// (walking, sneaking, strafing, swimming, falling, the guard, the strikes, being hit), and assets/models/acts.glb, the
// rest (drinking, sitting, waving...), fetched only when first wanted. Each holds tracks only, on nodes named as the
// game's rig names its bones.
// - Retargeted: Y Bot's bones don't rest turned as our rig's do (its shoulders, feet and toes by up to a quarter turn), so
//   each frame's pose is carried over in world space: how far each bone has turned from Y Bot's T-pose is applied to our
//   rig's T-pose (the one the old clips in assets/models/run.fbx were made on), and turned back into our bones' frames.
// - The hips' travel is taken out (we move the player ourselves) and kept on a track of its own, root.position: for a
//   cycle only its steady travel (its sway stays), for anything else all of it, so the game can move the player along it
//   or keep it in the pose (a fall backwards). Hip heights are scaled from Y Bot's hips to ours.
// - Fingers: a still finger keeps one key (in the clip's extras, as hands: three's loader leaves those to the game), a
//   moving one 10 keys a second; the rest keep all 30. Rotations are stored as
//   normalised 16-bit numbers (glTF allows it; three's loader reads them).
import fs from 'node:fs';
import path from 'node:path';
import * as THREE from 'three';
import { FBXLoader } from '../../vendor/three/jsm/loaders/FBXLoader.js';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const SRC = path.join(ROOT, 'incoming assets/mixamo'), OUT = path.join(ROOT, 'assets/models');
// [our name, Mixamo's file, options]: loop (a cycle: only its steady travel taken out), cut ([from, to] seconds), rate
// (played this much faster in the file itself)
const LIB = {
  moves: [
    ['breathe', 'Breathing Idle', { loop: true }], ['look', 'Looking Around'],
    ['walk', 'Walking', { loop: true }], ['walkBack', 'Walking Backwards', { loop: true }], ['walkLeft', 'Left Strafe Walking', { loop: true }], ['walkRight', 'Right Strafe Walking', { loop: true }],
    ['runBack', 'Running Backward', { loop: true }], ['jogLeft', 'Left Strafe', { loop: true }], ['jogRight', 'Right Strafe', { loop: true }],
    // (Crouching Idle, not Crouch Idle: the clips that crouch down and stand up begin and end in its very pose)
    ['crouch', 'Crouching Idle', { loop: true }], ['crouchWalk', 'Crouched Walking', { loop: true }], ['crouchBack', 'Crouch Walk Back', { loop: true }],
    ['crouchLeft', 'Crouched Sneaking Left', { loop: true }], ['crouchRight', 'Crouched Sneaking Right', { loop: true }],
    ['crouchDown', 'Standing To Crouched'], ['crouchUp', 'Crouched To Standing'],
    ['swim', 'Swimming', { loop: true }], ['tread', 'Treading Water', { loop: true }], ['fall', 'Falling Idle', { loop: true }], ['land', 'Hard Landing', { cut: [0.73, 2.45] }],   // (from the moment the feet take the weight: before it the hips still drop 15 cm a frame)
    ['guard', 'Sword And Shield Idle', { loop: true }], ['block', 'Sword And Shield Block Idle', { loop: true }],
    ['slash', 'Sword And Shield Slash'], ['slash2', 'Sword And Shield Slash (1)'], ['chop', 'Standing Melee Attack Downward'], ['sweep', 'Standing Melee Attack Horizontal'], ['stab', 'Stabbing'],
    ['hitSmall', 'Standing React Small From Front'], ['hitLarge', 'Standing React Large From Front'], ['deathBack', 'Standing React Death Backward'], ['deathLeft', 'Standing React Death Left'],
    ['roll', 'Stand To Roll', { cut: [0.3, 2.1] }],
  ],
  acts: [
    ['kick', 'Sword And Shield Kick'], ['pickUp', 'Picking Up'], ['drink', 'Drinking'], ['sit', 'Sitting Idle', { loop: true }], ['sleep', 'Sleeping Idle', { loop: true }], ['getUp', 'Getting Up'],
    ['pray', 'Praying', { loop: true }], ['throw', 'Throw'], ['wave', 'Waving'], ['victory', 'Victory'], ['crouchReady', 'Crouch Idle', { loop: true }],
  ],
};
const FPS = 30, FINGER = /Hand(Thumb|Index|Middle|Ring|Pinky)/, END = /_End$|HeadTop|Hand[A-Za-z]+4$/;   // (the fingertips' bones are ends too)

const load = (file) => { const b = fs.readFileSync(file); return new FBXLoader().parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.length), ''); };
const bonesOf = (o) => { const B = {}; o.traverse((b) => { if (b.isBone) B[b.name] = b; }); return B; };
// every bone's world rotation with each bone's local rotation taken from get(bone) (parents first: the traversal's order)
function worlds(root, get) {
  const W = new Map(), q = new THREE.Quaternion();
  root.updateMatrixWorld(true);
  root.traverse((b) => { if (!b.isBone) return; const p = b.parent.isBone ? W.get(b.parent) : b.parent.getWorldQuaternion(new THREE.Quaternion()); W.set(b, p.clone().multiply(q.copy(get(b)))); });
  return W;
}

// Our rig's T-pose: the bones of the old run clip's file, which rest in it (the rig itself rests with its arms a little down)
const hero = load(path.join(OUT, 'run.fbx')), HB = bonesOf(hero), heroT = worlds(hero, (b) => b.quaternion), heroHips = bonesOf(load(path.join(OUT, 'hero_rig.fbx'))).mixamorigHips.position.y;
const KEEP = Object.keys(HB).filter((n) => !END.test(n));

function convert(name, file, o = {}) {
  const src = load(path.join(SRC, file + '.fbx')), clip = src.animations[0], SB = bonesOf(src), srcT = worlds(src, (b) => b.quaternion);
  const k = heroHips / SB.mixamorigHips.position.y;   // (Y Bot's hips stand lower than ours)
  const interp = {}; for (const t of clip.tracks) interp[t.name] = t.createInterpolant();
  const [t0, t1] = o.cut || [0, clip.duration], n = Math.round((t1 - t0) * FPS) + 1, times = Float32Array.from({ length: n }, (_, i) => i / FPS);
  const rot = Object.fromEntries(KEEP.map((b) => [b, new Float32Array(n * 4)])), hips = new Float32Array(n * 3), q = new THREE.Quaternion(), inv = new THREE.Quaternion();
  for (let i = 0; i < n; i++) {
    const at = t0 + times[i];
    const S = worlds(src, (b) => { const f = interp[b.name + '.quaternion']; return f ? q.fromArray(f.evaluate(at)) : b.quaternion; });
    // our bone's world rotation: its T-pose turned as far as Y Bot's has turned from its own, then made local to its parent
    const T = new Map();
    hero.traverse((b) => {
      if (!b.isBone) return; const s = SB[b.name];
      const w = s ? S.get(s).clone().multiply(inv.copy(srcT.get(s)).invert()).multiply(heroT.get(b)) : (b.parent.isBone ? T.get(b.parent).clone().multiply(b.quaternion) : heroT.get(b).clone());
      T.set(b, w); if (!rot[b.name]) return;
      const p = b.parent.isBone ? T.get(b.parent) : b.parent.getWorldQuaternion(new THREE.Quaternion()), l = inv.copy(p).invert().multiply(w).normalize(), a = rot[b.name];
      if (i && l.x * a[i * 4 - 4] + l.y * a[i * 4 - 3] + l.z * a[i * 4 - 2] + l.w * a[i * 4 - 1] < 0) l.set(-l.x, -l.y, -l.z, -l.w);   // (one hemisphere: no flips between keys)
      l.toArray(a, i * 4);
    });
    const hp = interp['mixamorigHips.position'].evaluate(at); for (let c = 0; c < 3; c++) hips[i * 3 + c] = hp[c] * k;
  }
  // the hips' travel: a cycle's steady travel (start to end) or, for anything else, all of it from the first frame
  const root = new Float32Array(n * 3), dx = hips[(n - 1) * 3] - hips[0], dz = hips[(n - 1) * 3 + 2] - hips[2], x0 = hips[0], z0 = hips[2];
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1), rx = o.loop ? dx * f : hips[i * 3] - x0, rz = o.loop ? dz * f : hips[i * 3 + 2] - z0;
    hips[i * 3] -= rx; hips[i * 3 + 2] -= rz; root[i * 3] = rx; root[i * 3 + 2] = rz;
  }
  const moved = Math.hypot(dx, dz) > 1 || root.some((v) => Math.abs(v) > 2);
  return { name, file, times, rot, hips, root: moved ? root : null, loop: !!o.loop, dur: times[n - 1], speed: o.loop ? Math.hypot(dx, dz) / times[n - 1] : 0 };
}

// ---- a minimal glTF binary: nodes named as the bones, one animation per clip (its data in one buffer view), nothing else
function glb(clips) {
  const nodes = [...KEEP, 'root'], idx = Object.fromEntries(nodes.map((n, i) => [n, i])), chunks = [], views = [], accessors = [];
  let off = 0, part = [], len = 0;
  const put = (bytes) => { const at = len, pad = (4 - (bytes.byteLength % 4)) % 4; part.push(Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), Buffer.alloc(pad)); len += bytes.byteLength + pad; return at; };
  const accessor = (bytes, a) => (accessors.push({ bufferView: views.length, byteOffset: put(bytes), ...a }), accessors.length - 1);
  const timesAcc = (t) => accessor(t, { componentType: 5126, count: t.length, type: 'SCALAR', min: [t[0]], max: [t[t.length - 1]] });
  const vec3 = (v) => accessor(v, { componentType: 5126, count: v.length / 3, type: 'VEC3' });
  const quat = (v) => accessor(Int16Array.from(v, (x) => Math.round(THREE.MathUtils.clamp(x, -1, 1) * 32767)), { componentType: 5122, normalized: true, count: v.length / 4, type: 'VEC4' });
  const animations = clips.map((c) => {
    const n = c.times.length, every = Math.max(1, Math.round(FPS / 10)), samplers = [], channels = [], hands = {};
    const all = timesAcc(c.times), sparse = Float32Array.from({ length: Math.ceil(n / every) }, (_, i) => c.times[Math.min(n - 1, i * every)]);
    let few = null;
    const add = (node, p, input, output) => { samplers.push({ input, output }); channels.push({ sampler: samplers.length - 1, target: { node: idx[node], path: p } }); };
    for (const [b, v] of Object.entries(c.rot)) {
      if (!FINGER.test(b)) { add(b, 'rotation', all, quat(v)); continue; }
      // (a finger that never turns more than 3° from its first key is kept as that one key, in the clip's extras;
      // a moving one gets a key every tenth of a second)
      const q0 = new THREE.Quaternion().fromArray(v, 0), q = new THREE.Quaternion(); let most = 0; for (let i = 1; i < n; i++) most = Math.max(most, q0.angleTo(q.fromArray(v, i * 4)));
      if (most < 0.05) { hands[b] = [...v.slice(0, 4)].map((x) => +x.toFixed(4)); continue; }
      few ??= timesAcc(sparse); const s = new Float32Array(sparse.length * 4); for (let i = 0; i < sparse.length; i++) s.set(v.subarray(Math.min(n - 1, i * every) * 4, Math.min(n - 1, i * every) * 4 + 4), i * 4);
      add(b, 'rotation', few, quat(s));
    }
    add('mixamorigHips', 'translation', all, vec3(c.hips));
    if (c.root) add('root', 'translation', c.loop ? timesAcc(new Float32Array([0, c.dur])) : all, vec3(c.loop ? new Float32Array([0, 0, 0, c.root[(n - 1) * 3], 0, c.root[(n - 1) * 3 + 2]]) : c.root));
    views.push({ buffer: 0, byteOffset: off, byteLength: len }); chunks.push(...part); off += len; part = []; len = 0;
    return { name: c.name, channels, samplers, extras: { loop: c.loop, speed: +c.speed.toFixed(2), from: c.file, hands } };
  });
  const bin = Buffer.concat(chunks);
  const json = { asset: { version: '2.0', generator: 'Argonisos tools/assets/moves.mjs' }, scene: 0, scenes: [{ nodes: nodes.map((_, i) => i) }], nodes: nodes.map((name) => ({ name })),
    animations, accessors, bufferViews: views, buffers: [{ byteLength: bin.length }] };
  let js = Buffer.from(JSON.stringify(json)); js = Buffer.concat([js, Buffer.alloc((4 - (js.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(12); head.writeUInt32LE(0x46546c67, 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(12 + 8 + js.length + 8 + bin.length, 8);
  const ch = (n, type) => { const b = Buffer.alloc(8); b.writeUInt32LE(n, 0); b.writeUInt32LE(type, 4); return b; };
  return Buffer.concat([head, ch(js.length, 0x4e4f534a), js, ch(bin.length, 0x004e4942), bin]);
}

const only = process.argv.slice(2);
for (const [file, list] of Object.entries(LIB)) {
  if (only.length && !only.includes(file)) continue;
  const clips = list.map(([name, src, o]) => convert(name, src, o)), out = path.join(OUT, file + '.glb'), data = glb(clips);
  fs.writeFileSync(out, data);
  // (and the base64 module copy, for static hosting that won't serve .glb: assets.js falls back to it)
  fs.writeFileSync(out + '.js', `export default "${data.toString('base64')}";\n`);
  console.log(`${file}.glb`, (data.length / 1024).toFixed(0), 'KB');
  for (const c of clips) console.log('  ', c.name.padEnd(12), c.dur.toFixed(2) + 's', c.loop ? `loop ${(c.speed / 100).toFixed(2)} m/s` : '', c.root && !c.loop ? 'root path' : '');
}
