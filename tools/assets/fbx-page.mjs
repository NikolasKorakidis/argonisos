// The browser half of convert.mjs for models Blender reads wrongly (some Maya rigs: Blender's FBX import bends their arms
// out of shape once they move, three.js's FBXLoader reads them right). Loaded by fbx.html; convert(job) returns the .glb
// as base64. The same job as convert.py: the wanted parts made one skinned mesh on one material, the clips cut from the
// take (Unity's split points), the steady travel taken out of the clips that walk, and nothing else.
import * as THREE from 'three';
import { FBXLoader } from '../../vendor/three/jsm/loaders/FBXLoader.js';
import { mergeGeometries, mergeVertices } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';   // (the same three, from the dev dependency: the game ships no exporter)

const url = (p) => '/' + p.split('/').map(encodeURIComponent).join('/');

// Every skinned part as one mesh on one skeleton: the parts' vertices brought into the bind space they share, their bone
// indices moved onto the union of their bones
function mergeSkinned(root, parts, material) {
  const bones = [], inverses = [], at = new Map(), geos = [];
  for (const m of parts) {   // (bones by name: the loader gives parts their own copies, the clips move the first of each name)
    const map = m.skeleton.bones.map((b, i) => { if (!at.has(b.name)) { at.set(b.name, bones.length); bones.push(root.getObjectByName(b.name)); inverses.push(m.skeleton.boneInverses[i].clone()); } return at.get(b.name); });
    const g = m.geometry.clone(); g.applyMatrix4(m.bindMatrix); g.clearGroups();
    const si = g.attributes.skinIndex; for (let i = 0; i < si.count; i++) for (let k = 0; k < 4; k++) si.setComponent(i, k, map[si.getComponent(i, k)]);
    // the same attributes, of the same kinds, on every part (or they won't merge)
    const flat = g.index ? g.toNonIndexed() : g, out = new THREE.BufferGeometry(), n = flat.attributes.position.count;
    for (const [k, size, Arr] of [['position', 3, Float32Array], ['normal', 3, Float32Array], ['uv', 2, Float32Array], ['skinIndex', 4, Uint16Array], ['skinWeight', 4, Float32Array]]) {
      const src = flat.attributes[k], a = new Arr(n * size); if (src) for (let i = 0; i < n; i++) for (let c = 0; c < size; c++) a[i * size + c] = src.getComponent(i, c);
      out.setAttribute(k, new THREE.BufferAttribute(a, size));
    }
    geos.push(out);
  }
  const geo = mergeVertices(mergeGeometries(geos)), mesh = new THREE.SkinnedMesh(geo, material);
  mesh.bind(new THREE.Skeleton(bones, inverses), new THREE.Matrix4());
  return mesh;
}

// A track that never moves its bone from where it rests does nothing: left out
function still(track, root) {
  const [name, prop] = track.name.split('.'), o = root.getObjectByName(name); if (!o) return true;
  const rest = prop === 'quaternion' ? o.quaternion.toArray() : prop === 'position' ? o.position.toArray() : prop === 'scale' ? o.scale.toArray() : null; if (!rest) return false;
  const v = track.values, n = rest.length, eps = prop === 'position' ? 1e-3 : 1e-4;
  for (let i = 0; i < v.length; i += n) for (let k = 0; k < n; k++) if (Math.abs(v[i + k] - rest[k]) > eps && !(prop === 'quaternion' && Math.abs(v[i + k] + rest[k]) < eps)) return false;
  return true;
}

window.convert = async (job) => {
  const root = await new FBXLoader().loadAsync(url(job.srcRel)); root.updateMatrixWorld(true);
  const tex = job.textureRel ? await new THREE.TextureLoader().loadAsync(url(job.textureRel)) : null;
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; if (job.palette) tex.magFilter = tex.minFilter = THREE.NearestFilter; }
  const material = new THREE.MeshStandardMaterial({ name: job.name, map: tex, roughness: job.roughness ?? 0.85, metalness: 0 });
  const keep = job.meshes, drop = job.drop || [], parts = [];
  root.traverse((o) => { if (o.isSkinnedMesh && !(keep && !keep.some((k) => o.name.includes(k))) && !drop.some((k) => o.name.includes(k))) parts.push(o); });
  const gone = []; root.traverse((o) => { if (o.isMesh) gone.push(o); }); for (const o of gone) o.removeFromParent();
  const body = mergeSkinned(root, parts, material); body.name = job.name; root.add(body);
  // nothing else in the file: only the skeleton, the body and what holds them
  const need = new Set(); for (const o of [body, ...body.skeleton.bones]) for (let p = o; p; p = p.parent) need.add(p);
  const extra = []; root.traverse((o) => { if (!need.has(o) && need.has(o.parent)) extra.push(o); }); for (const o of extra) o.removeFromParent();
  // the clips, cut from the take at Unity's split points, or each from a file of its own (Model@Clip.fbx)
  const take = root.animations[0], fps = job.fps || 30, clips = [], loader = new FBXLoader();
  const sources = Object.entries(job.splits || {}).map(([ours, [first, last]]) => [ours, () => THREE.AnimationUtils.subclip(take, ours, first, last + 1, fps)]);
  for (const [ours, f] of Object.entries(job.clipFilesRel || {})) sources.push([ours, async () => { const c = (await loader.loadAsync(url(f))).animations[0]; c.name = ours; return c; }]);
  for (const [ours, make] of sources) {
    const c = await make();
    c.tracks = c.tracks.filter((t) => !still(t, root));
    if (job.inPlace?.clips.includes(ours)) for (const t of c.tracks) {
      if (t.name !== job.inPlace.bone + '.position') continue; const v = t.values, n = v.length / 3, T = t.times[n - 1] || 1;
      const d = [0, 1, 2].map((k) => v[(n - 1) * 3 + k] - v[k]); for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) v[i * 3 + k] -= d[k] * t.times[i] / T;
    }
    clips.push(c);
  }
  const glb = await new GLTFExporter().parseAsync(root, { binary: true, animations: clips, onlyVisible: false });
  let s = ''; const b = new Uint8Array(glb); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return { glb: btoa(s), parts: parts.length, bones: body.skeleton.bones.length, clips: clips.map((c) => `${c.name}:${c.tracks.length}`) };
};
window.ready = true;

// ---- a character from the packs fitted onto the game's Mixamo rig (manifest entries with "refit")
// The game's clips are Mixamo's and its code holds Mixamo bones by name, so rather than retarget every clip the new body
// is bound to that skeleton: the rig's bones keep the very rest rotations the clips were made on (only where they stand
// moves, to the body's own joints), the body is first posed so its limbs point the way the rig's do, and its skin
// weights follow by bone name. Done here rather than in Blender, whose import gives the bones rest rotations of its own.
const SIDE = { Clavicle: 'Shoulder', Schoulder: 'Arm', Shoulder: 'Arm', Elbow: 'ForeArm', Hand: 'Hand', UpperLeg: 'UpLeg', LowerLeg: 'Leg', Ankle: 'Foot', Ball: 'ToeBase' };
const FINGER = { Thumb_01: 'Thumb1', Thumb_02: 'Thumb2', Thumb_03: 'Thumb3', IndexFinger_01: 'Index1', IndexFinger_02: 'Index2', IndexFinger_03: 'Index3', Finger_01: 'Middle1', Finger_02: 'Middle2', Finger_03: 'Middle3' };
const CORE = { Hips: 'Hips', Spine_01: 'Spine', Spine_02: 'Spine1', Spine_03: 'Spine2', Neck: 'Neck', Head: 'Head' };
function mixamoName(b) {
  const n = b.name; if (CORE[n]) return 'mixamorig' + CORE[n];
  const m = n.match(/^(\w+)_([LR])$/); if (m && SIDE[m[1]]) return `mixamorig${m[2] === 'L' ? 'Left' : 'Right'}${SIDE[m[1]]}`;
  const f = n.match(/^(Thumb_0\d|IndexFinger_0\d|Finger_0\d)(\d{3}|_[LR])?$/); if (f && FINGER[f[1]]) {   // (the right hand's fingers share the left's names)
    let p = b.parent; while (p && !/^Hand_[LR]$/.test(p.name)) p = p.parent;
    return p ? `mixamorig${p.name.endsWith('_L') ? 'Left' : 'Right'}Hand${FINGER[f[1]]}` : null;
  }
  return null;
}
// the limbs turned to point as the rig's do (direction only: the body's own twist is kept)
const ALIGN = ['Shoulder', 'Arm', 'ForeArm', 'UpLeg', 'Leg'].flatMap((k) => ['Left', 'Right'].map((s) => 'mixamorig' + s + k));
const V = () => new THREE.Vector3(), wpos = (o) => o.getWorldPosition(V());

// The skinned vertices as the skeleton now holds them, in world space: { pos, nrm, uv, bones: [[bone, weight]...] } per vertex
// (pose: the bones of the same names to pose them with instead, from another character on the same skeleton)
function posed(m, pose) {
  const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, SI = g.attributes.skinIndex, SW = g.attributes.skinWeight;
  const mats = m.skeleton.bones.map((b, i) => new THREE.Matrix4().multiplyMatrices((pose?.get(b.name) ?? b).matrixWorld, m.skeleton.boneInverses[i]).multiply(m.bindMatrix));
  const out = [], M = new THREE.Matrix4(), nm = new THREE.Matrix3();
  for (let i = 0; i < P.count; i++) {
    M.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0); const bones = [];
    for (let k = 0; k < 4; k++) { const w = SW.getComponent(i, k); if (w <= 0) continue; const j = SI.getComponent(i, k); bones.push([m.skeleton.bones[j], w]); const e = mats[j].elements; for (let c = 0; c < 16; c++) M.elements[c] += e[c] * w; }
    out.push({ pos: V().fromBufferAttribute(P, i).applyMatrix4(M), nrm: N ? V().fromBufferAttribute(N, i).applyMatrix3(nm.getNormalMatrix(M)).normalize() : V(), uv: UV ? [UV.getX(i), UV.getY(i)] : [0, 0], bones });
  }
  return out;
}
// the part of the body a Mixamo bone moves
const REGION = (b) => (/Neck|Head$|HeadTop/.test(b) ? 'head' : /Hips|UpLeg|Leg$|Foot|Toe/.test(b) ? 'legs' : 'body');
// A plain mesh (hair) in world space, on the head
function rigid(m) {
  const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, UV = g.attributes.uv, nm = new THREE.Matrix3().getNormalMatrix(m.matrixWorld), out = [];
  for (let i = 0; i < P.count; i++) out.push({ pos: V().fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld), nrm: N ? V().fromBufferAttribute(N, i).applyMatrix3(nm).normalize() : V(), uv: UV ? [UV.getX(i), UV.getY(i)] : [0, 0], bones: [[null, 1]] });
  return out;
}

// Proportions changed (job.proportions: { UpLeg, Leg, Arm, ForeArm: how much longer each limb bone gets, Hand: how much
// bigger the hand, fingers and all }): an edit in world space for each of the body's bones, parents first. A limb
// bone is stretched along itself from its joint, a hand scaled about the wrist with its fingers, and every other bone
// carried along by where its joint went, so a foot keeps its shape below a longer shin.
const LIMB_END = { UpLeg: 'Leg', Leg: 'Foot', Arm: 'ForeArm', ForeArm: 'Hand' };
// a bone by its path from the root (the right hand's fingers can share the left's names; each part has its own copies)
const boneKey = (b) => { let k = ''; for (let p = b; p?.isBone; p = p.parent) k = p.name + '/' + k; return k; };
function proportions(root, S, prop) {
  const E = new Map(), whole = new Set(); if (!prop || !Object.keys(prop).length) return null;
  root.traverse((b) => {
    if (!b.isBone) return; const key = boneKey(b); if (E.has(key)) return;
    const pk = b.parent?.isBone ? boneKey(b.parent) : null, pe = pk && E.get(pk); if (pe && whole.has(pk)) { E.set(key, pe); whole.add(key); return; }
    const J = wpos(b), to = pe ? J.clone().applyMatrix4(pe) : J.clone(), m = new THREE.Matrix4().makeTranslation(to.x - J.x, to.y - J.y, to.z - J.z);
    const n = mixamoName(b), side = n?.match(/^mixamorig(Left|Right)(\w+)$/), f = side && prop[side[2]];
    if (f && side[2] === 'Hand') { m.multiply(new THREE.Matrix4().makeTranslation(J.x, J.y, J.z).multiply(new THREE.Matrix4().makeScale(f, f, f)).multiply(new THREE.Matrix4().makeTranslation(-J.x, -J.y, -J.z))); whole.add(key); }
    else if (f && LIMB_END[side[2]] && S['mixamorig' + side[1] + LIMB_END[side[2]]]) {
      const d = wpos(S['mixamorig' + side[1] + LIMB_END[side[2]]]).sub(J).normalize(), k = f - 1;   // (I + k·d·dᵀ about the joint)
      const st = new THREE.Matrix4().set(1 + k * d.x * d.x, k * d.x * d.y, k * d.x * d.z, 0, k * d.y * d.x, 1 + k * d.y * d.y, k * d.y * d.z, 0, k * d.z * d.x, k * d.z * d.y, 1 + k * d.z * d.z, 0, 0, 0, 0, 1);
      m.multiply(new THREE.Matrix4().makeTranslation(J.x, J.y, J.z).multiply(st).multiply(new THREE.Matrix4().makeTranslation(-J.x, -J.y, -J.z)));
    }
    E.set(key, m);
  });
  return E;
}
// A posed vertex moved by the edits of the bones that hold it (blended by weight, as skinning blends)
function reshape(E, v, head) {
  if (!E) return; const M = new THREE.Matrix4().set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
  for (const [b, w] of v.bones) { const e = E.get(boneKey(b || head)) || new THREE.Matrix4(); for (let c = 0; c < 16; c++) M.elements[c] += e.elements[c] * w; }
  v.pos.applyMatrix4(M); v.nrm.applyMatrix3(new THREE.Matrix3().getNormalMatrix(M)).normalize();
}

window.refit = async (job) => {
  const loader = new FBXLoader(), load = (f) => loader.loadAsync(url(f));
  const rig = await load(job.mixamoRel), src = await load(job.srcRel); rig.updateMatrixWorld(true); src.updateMatrixWorld(true);
  const tex = job.textureRel ? await new THREE.TextureLoader().loadAsync(url(job.textureRel)) : null;
  if (tex) { tex.colorSpace = THREE.SRGBColorSpace; if (job.palette) tex.magFilter = tex.minFilter = THREE.NearestFilter; }
  const material = new THREE.MeshStandardMaterial({ name: job.name, map: tex, roughness: 0.8, metalness: 0 });
  const R = {}; rig.traverse((o) => { if (o.isBone) R[o.name] = o; });
  const rigMeshes = []; rig.traverse((o) => { if (o.isMesh) rigMeshes.push(o); });
  const rigFloor = Math.min(...rigMeshes.map((m) => Math.min(...posed(m).map((v) => v.pos.y))));
  const keep = job.meshes, drop = job.drop || [], parts = [];
  src.traverse((o) => { if (o.isSkinnedMesh && !(keep && !keep.some((k) => o.name === k)) && !drop.some((k) => o.name.includes(k))) parts.push(o); });
  if (!parts.length) throw new Error('no body in ' + job.srcRel);
  // the body's bones by the Mixamo name they stand for (those of its first part: the loader gives each part its own copies)
  const S = {}; for (const b of parts[0].skeleton.bones) { const n = mixamoName(b); if (n && !S[n]) S[n] = b; }
  const map = (b) => { for (let p = b; p; p = p.parent) { const n = mixamoName(p); if (n) return n; } return 'mixamorigHips'; };
  // pose: each limb turned (in world space, parents first) so it points from its joint to its child's as the rig's does
  const childOf = (n) => Object.keys(S).find((k) => R[k]?.parent === R[n]);
  for (const n of ALIGN) {
    const c = childOf(n); if (!S[n] || !c) continue;
    for (const part of parts) {   // (every part's copy of the bone)
      const b = part.skeleton.bones.find((x) => x.name === S[n].name), bc = part.skeleton.bones.find((x) => x.name === S[c].name); if (!b || !bc) continue;
      const have = wpos(bc).sub(wpos(b)).normalize(), want = wpos(R[c]).sub(wpos(R[n])).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(have, want), pw = b.parent.getWorldQuaternion(new THREE.Quaternion()), bw = b.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(pw.invert().multiply(q).multiply(bw)); b.updateMatrixWorld(true);
    }
  }
  const E = proportions(src, S, job.proportions), head = S.mixamorigHead;
  const verts = parts.map((p) => ({ name: job.wear ? 'base' : p.name, v: posed(p) })); for (const part of verts) for (const v of part.v) reshape(E, v, head);
  const floor = Math.min(...verts[0].v.map((v) => v.pos.y));
  // sized so its hips stand as high as the rig's, standing where the rig stands
  const hipS = wpos(S.mixamorigHips), hipR = wpos(R.mixamorigHips), k = (hipR.y - rigFloor) / (hipS.y - floor);
  const place = (p) => p.sub(new THREE.Vector3(hipS.x, floor, hipS.z)).multiplyScalar(k).add(new THREE.Vector3(hipR.x, rigFloor, hipR.z));
  for (const part of verts) for (const v of part.v) place(v.pos);
  // pieces modelled in place on the body (hair): on the head
  for (const f of job.attachRel || []) { const a = await load(f); a.updateMatrixWorld(true); a.traverse((o) => { if (o.isMesh && !o.isSkinnedMesh) { const v = rigid(o); for (const x of v) { reshape(E, x, head); place(x.pos); } verts.push({ name: job.wear ? 'hair' : o.name, v }); } }); }
  // clothes and armour from the pack's other characters (on this very skeleton): each posed as the body is, cut to the
  // part of the body it covers, and named wear_<item> for the game to show when that item is worn
  const files = {}, pose = new Map(parts[0].skeleton.bones.map((b) => [b.name, b]));
  for (const [item, w] of Object.entries(job.wear || {})) {
    const o = files[w.src] ||= await load(w.srcRel); o.updateMatrixWorld(true);
    let m = null; o.traverse((x) => { if (x.isSkinnedMesh && x.name === w.mesh) m = x; }); if (!m) throw new Error(`no ${w.mesh} in ${w.src}`);
    const v = posed(m, pose); for (const x of v) { reshape(E, x, head); place(x.pos); } verts.push({ name: 'wear_' + item, v, region: w.region });
  }
  if (job.wear) { const base = verts.shift(); for (const r of ['head', 'body', 'legs']) verts.unshift({ name: 'base_' + r, v: base.v, region: r }); }
  // the rig's bones moved onto the body's joints (parents first: each keeps its rest rotation; unmatched ones ride along)
  const joints = Object.fromEntries(Object.entries(S).map(([n, b]) => [n, place(E?.has(boneKey(b)) ? wpos(b).applyMatrix4(E.get(boneKey(b))) : wpos(b))]));
  rig.traverse((o) => { if (o.isBone && joints[o.name]) { o.parent.updateMatrixWorld(true); o.position.copy(o.parent.worldToLocal(joints[o.name].clone())); o.updateMatrixWorld(true); } });
  // one skinned mesh per part, on the rig's skeleton
  for (const m of rigMeshes) m.removeFromParent();
  const bones = Object.values(R), index = new Map(bones.map((b, i) => [b.name, i])), inv = new THREE.Matrix4().copy(rig.matrixWorld).invert();
  const skeleton = new THREE.Skeleton(bones), out = [];
  for (const part of verts) {
    // each vertex's weights on the rig's bones (bones with no match, like the eyes, give theirs to their parent's match)
    const ws = part.v.map((v) => { const w = new Map(); for (const [b, x] of v.bones) { const t = b ? map(b) : 'mixamorigHead'; w.set(t, (w.get(t) || 0) + x); } return w; });
    // a region keeps the triangles that move mostly with it (armour for the body reaches a little lower, over the waist of
    // whatever is worn on the legs, so no gap opens between two characters' pieces)
    let tris = [...Array(part.v.length / 3).keys()];
    const reach = part.name.startsWith('wear_') && part.region === 'body' ? 0.3 : null;
    if (part.region) tris = tris.filter((t) => { const sum = { head: 0, body: 0, legs: 0 }; for (let c = 0; c < 3; c++) for (const [b, x] of ws[t * 3 + c]) sum[REGION(b)] += x;
      const all = sum.head + sum.body + sum.legs; return Object.entries(sum).sort((a, b) => b[1] - a[1])[0][0] === part.region || (reach && sum.body / all >= reach && sum.head < sum.body); });
    const n = tris.length * 3, pos = new Float32Array(n * 3), nrm = new Float32Array(n * 3), uv = new Float32Array(n * 2), si = new Uint16Array(n * 4), sw = new Float32Array(n * 4);
    tris.flatMap((t) => [t * 3, t * 3 + 1, t * 3 + 2]).forEach((j, i) => {
      const v = part.v[j]; v.pos.clone().applyMatrix4(inv).toArray(pos, i * 3); v.nrm.clone().transformDirection(inv).toArray(nrm, i * 3); uv.set(v.uv, i * 2);
      const top = [...ws[j]].sort((a, b) => b[1] - a[1]).slice(0, 4), sum = top.reduce((s, x) => s + x[1], 0);
      top.forEach(([t, x], c) => { si[i * 4 + c] = index.get(t); sw[i * 4 + c] = x / sum; });
    });
    if (!n) throw new Error(`${part.name}: nothing in its region`);
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3)); g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    g.setAttribute('skinIndex', new THREE.BufferAttribute(si, 4)); g.setAttribute('skinWeight', new THREE.BufferAttribute(sw, 4));
    const mesh = new THREE.SkinnedMesh(mergeVertices(g), material); mesh.name = part.name; rig.add(mesh); mesh.updateMatrixWorld(true); mesh.bind(skeleton, mesh.matrixWorld);
    out.push(`${part.name}:${tris.length}`);
  }
  rig.animations = [];
  const glb = await new GLTFExporter().parseAsync(rig, { binary: true, onlyVisible: false });
  let s = ''; const b = new Uint8Array(glb); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return { glb: btoa(s), parts: out, joints: Object.keys(joints).length, scale: +k.toFixed(3) };
};
