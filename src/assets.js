// Model loading shared by the hero, tools and creatures. Raw .fbx/.glb from assets/models/ when served locally, with the base64
// module copies as a fallback (static hosting that refuses those types).
import * as THREE from 'three';
import { FBXLoader } from '../vendor/three/jsm/loaders/FBXLoader.js';
import { GLTFLoader } from '../vendor/three/jsm/loaders/GLTFLoader.js';

const ROOT = new URL('../assets/models/', import.meta.url);
export async function loadModelBuffer(file) {
  try { const r = await fetch(new URL(file, ROOT)); if (r.ok) return await r.arrayBuffer(); } catch { /* fall through */ }
  const b64 = (await import(new URL(file + '.js', ROOT).href)).default;
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)).buffer;
}
// The file is fetched once; every call parses its own copy, so one user can rescale or re-dress it without touching
// another's (the hero and the creatures built on its rig both load hero_rig)
const buffers = new Map();
const buffer = (file) => { if (!buffers.has(file)) buffers.set(file, loadModelBuffer(file)); return buffers.get(file); };
export function loadFBX(name) { return buffer(name + '.fbx').then((buf) => new FBXLoader().parse(buf, '')); }
export function loadGLB(name) { return buffer(name + '.glb').then((buf) => new Promise((res, rej) => new GLTFLoader().parse(buf, '', res, rej))); }
const texLoader = new THREE.TextureLoader();
// A model converted from the team's packs (tools/assets). Most share one atlas per pack, kept once in pack/tex/ and put
// here on every material named "tex:<key>" (glTF's UVs want the image unflipped)
const atlases = {};
const atlas = (key) => (atlases[key] ||= (() => { const t = texLoader.load(new URL(`pack/tex/${key}.webp`, ROOT).href); t.colorSpace = THREE.SRGBColorSpace; t.flipY = false; t.anisotropy = 4; t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })());   // (repeat: tiling ones, like the marble, run past the edge)
export function loadPack(name) {
  return loadGLB('pack/' + name).then((gl) => {
    gl.scene.traverse((m) => { for (const mt of [].concat(m.material || [])) if (mt.name.startsWith('tex:')) { mt.map = atlas(mt.name.slice(4)); mt.needsUpdate = true; } });
    return gl;
  });
}
export function loadTex(file, srgb = true) {
  const t = texLoader.load(new URL(file, ROOT).href); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
// One geometry from all of a loaded model's meshes (positions, normals, UVs), in the model's own frame
// (or, with colours, positions, normals and vertex colours as plain RGB floats)
export function bake(root, colours = false) {
  root.updateMatrixWorld(true); const geos = [], want = colours ? [['position', 3], ['normal', 3], ['color', 3]] : [['position', 3], ['normal', 3], ['uv', 2]];
  root.traverse((m) => { if (m.isMesh) { const g = m.geometry.clone().applyMatrix4(m.matrixWorld); geos.push(g.index ? g.toNonIndexed() : g); } });
  const n = geos.reduce((s, g) => s + g.attributes.position.count, 0), out = new THREE.BufferGeometry();
  for (const [k, size] of want) {
    const a = new Float32Array(n * size); let o = 0;
    for (const g of geos) { const src = g.attributes[k]; if (src) for (let i = 0; i < src.count; i++) for (let c = 0; c < size; c++) a[o + i * size + c] = src.getComponent(i, c); else if (k === 'color') a.fill(1, o, o + g.attributes.position.count * size); o += g.attributes.position.count * size; }
    out.setAttribute(k, new THREE.BufferAttribute(a, size));
  }
  return out;
}
// Swap imported materials for standard ones that sit well in our lighting
export function fixMaterials(obj, roughness = 0.7) {
  obj.traverse((m) => {
    if (!m.isMesh) return;
    m.castShadow = true; m.receiveShadow = true;
    const mats = [].concat(m.material).map((o) => new THREE.MeshStandardMaterial({ map: o.map || null, normalMap: o.normalMap || null, color: o.map ? 0xffffff : o.color, roughness, metalness: 0 }));
    mats.forEach((mt) => { if (mt.map) mt.map.colorSpace = THREE.SRGBColorSpace; });
    m.material = mats.length === 1 ? mats[0] : mats;
  });
  return obj;
}
// Re-orient a held prop so its longest axis is +y, the heavy end (head) on top, the grip end at y=0, length L
export function normalizeHandle(model, L) {
  const wrap = new THREE.Group(), obj = new THREE.Group(); obj.add(model); wrap.add(obj);
  obj.updateMatrixWorld(true);
  let size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  if (size.x >= size.y && size.x >= size.z) obj.rotation.z = Math.PI / 2; else if (size.z >= size.y) obj.rotation.x = Math.PI / 2;
  obj.updateMatrixWorld(true); size = new THREE.Box3().setFromObject(obj).getSize(new THREE.Vector3());
  obj.scale.multiplyScalar(L / size.y); obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj), mid = (box.min.y + box.max.y) / 2;
  let top = 0, bot = 0; const v = new THREE.Vector3();
  obj.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i += 3) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); const w = Math.hypot(v.x, v.z); if (v.y > mid) top = Math.max(top, w); else bot = Math.max(bot, w); } });
  if (bot > top) { obj.rotation.x += Math.PI; obj.updateMatrixWorld(true); }
  // centred on the handle (its lower third), not the whole box: a head sticking out to one side would put the handle
  // beside the hand
  const b2 = new THREE.Box3().setFromObject(obj), low = b2.min.y + (b2.max.y - b2.min.y) * 0.3, hb = new THREE.Box3();
  obj.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (v.y < low) hb.expandByPoint(v); } });
  const c = (hb.isEmpty() ? b2 : hb).getCenter(new THREE.Vector3());
  obj.position.x -= c.x; obj.position.z -= c.z; obj.position.y -= b2.min.y;
  return wrap;
}
