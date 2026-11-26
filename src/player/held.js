// Models for things held in the hand or slung on the back. Each comes out handle-down along +y with the grip at y=0,
// so the hero's grip pose fits them all. The crude bow is an imported model; the rest come from the team's packs
// (tools/assets: Greek warfare for the Cretan bow, shields, the lightstone spear and sword; the rustic kit and Synty for the tools;
// the team's own delivery for the stone spear and the hoe),
// with the carved ones below standing in while they load or if a pack file is missing.
import * as THREE from 'three';
import { loadFBX, loadPack, loadTex, fixMaterials, normalizeHandle } from '../assets.js';
import { pixelate, pixelateAuto, autoLook } from '../render/pixel.js';

const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }), darkWood = new THREE.MeshStandardMaterial({ color: 0x5e4128, roughness: 0.9 });
const stone = new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 0.9, flatShading: true }), light = new THREE.MeshStandardMaterial({ color: 0xe6e0cc, roughness: 0.55, flatShading: true });
const leather = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.8 }), cord = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.9 });
// Lightstone as worked into gear: the pale stone of the pickups (world/pickups.js), its faint glint kept
export const LIGHTSTONE = new THREE.MeshStandardMaterial({ color: 0xc8c2ae, roughness: 0.5, metalness: 0.1, emissive: 0x5a5a48, emissiveIntensity: 0.15, flatShading: true });
// Part of a pack model made of lightstone: each triangle whose painted colour (its texel in the model's palette, 0-255)
// and middle (in the model's frame as it is now) pass test takes LIGHTSTONE, the rest keep their own material. A sword's
// steel blade, an arrow's head, a shield's metal rim: the same model, worked in the island's stone
const PAINT = new WeakMap();
function texels0(map) {
  let d = PAINT.get(map); if (d) return d; const im = map?.image; if (!im?.width) return null;
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0);
  d = { W: im.width, H: im.height, px: x.getImageData(0, 0, im.width, im.height).data }; PAINT.set(map, d); return d;
}
export function inStone(o, test) {
  o.updateMatrixWorld(true); const v = new THREE.Vector3(), c = new THREE.Vector3();
  o.traverse((m) => {
    if (!m.isMesh || Array.isArray(m.material)) return; const T = texels0(m.material.map), g0 = m.geometry, pos = g0.attributes.position, uv = g0.attributes.uv;
    const idx = g0.index ? g0.index.array : [...Array(pos.count).keys()], keep = [], stone = [], rgb = [0, 0, 0];
    for (let i = 0; i < idx.length; i += 3) {
      c.set(0, 0, 0); let u = 0, w = 0; for (let k = 0; k < 3; k++) { c.add(v.fromBufferAttribute(pos, idx[i + k]).applyMatrix4(m.matrixWorld)); if (uv) { u += uv.getX(idx[i + k]) / 3; w += uv.getY(idx[i + k]) / 3; } }
      if (T) { const q = (Math.min(T.H - 1, Math.floor((((w % 1) + 1) % 1) * T.H)) * T.W + Math.min(T.W - 1, Math.floor((((u % 1) + 1) % 1) * T.W))) * 4; rgb[0] = T.px[q]; rgb[1] = T.px[q + 1]; rgb[2] = T.px[q + 2]; }
      (test(rgb, c.divideScalar(3)) ? stone : keep).push(idx[i], idx[i + 1], idx[i + 2]);
    }
    if (!stone.length) return; const g = g0.clone(); g.setIndex([...keep, ...stone]); g.clearGroups(); g.addGroup(0, keep.length, 0); g.addGroup(keep.length, stone.length, 1);
    m.geometry = g; m.material = [m.material, LIGHTSTONE];
  });
  return o;
}
// (a palette's greys: steel; its bright golds: bronze)
export const steel = ([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) < 40 && r + g + b > 240;
const bronze = ([r, g, b]) => r > 180 && r - b > 110;
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const grp = (...a) => { const g = new THREE.Group(); a.forEach((o) => g.add(o)); return g; };
const lash = (y, r) => M(new THREE.TorusGeometry(r, 0.012, 4, 10).rotateX(Math.PI / 2), cord, 0, y, 0);
// A torch's flame on its head at height y: it burns straight up however the torch is held, and flickers (a class of its
// own, so held models' clones keep it)
const _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
class Flame extends THREE.Mesh {
  onBeforeRender() {
    const t = performance.now() / 1000, h = this.geometry.parameters.height; this.matrixWorld.decompose(_p, _q, _s);
    const k = _s.x * (1 + Math.sin(t * 17 + h * 90) * 0.08 + Math.sin(t * 29) * 0.05); this.matrixWorld.compose(_p, _q.identity(), _s.set(k, k * (1 + Math.sin(t * 23 + h * 40) * 0.12), k));
  }
}
function flame(y) {
  const g = new THREE.Group(); g.position.y = y;
  for (const [r, h, c] of [[0.065, 0.24, 0xff9a30], [0.035, 0.15, 0xffe08a]]) g.add(new Flame(new THREE.ConeGeometry(r, h, 7).translate(0, h / 2 - 0.02, 0), new THREE.MeshBasicMaterial({ color: c })));
  return g;
}
const CARVED = {
  club: () => grp(M(new THREE.CylinderGeometry(0.03, 0.025, 0.4, 6).translate(0, 0.2, 0), darkWood), M(new THREE.CylinderGeometry(0.075, 0.035, 0.42, 7).translate(0, 0.6, 0), wood),
    ...[0, 1, 2, 3].map((i) => M(new THREE.ConeGeometry(0.02, 0.06, 4).rotateZ(Math.PI / 2).rotateY(i * 1.57).translate(Math.cos(i * 1.57) * 0.07, 0.68, -Math.sin(i * 1.57) * 0.07), stone))),
  dagger: (mat = stone) => grp(M(new THREE.CylinderGeometry(0.022, 0.022, 0.13, 6).translate(0, 0.07, 0), leather), M(new THREE.BoxGeometry(0.1, 0.02, 0.03).translate(0, 0.14, 0), darkWood),
    M(new THREE.ConeGeometry(0.035, 0.24, 4).scale(1, 1, 0.35).translate(0, 0.27, 0), mat)),
  hammer: () => grp(M(new THREE.CylinderGeometry(0.022, 0.026, 0.55, 6).translate(0, 0.27, 0), wood), M(new THREE.BoxGeometry(0.2, 0.09, 0.09).translate(0, 0.55, 0), darkWood), lash(0.5, 0.03)),
  pickaxe: () => grp(M(new THREE.CylinderGeometry(0.022, 0.026, 0.7, 6).translate(0, 0.35, 0), wood), M(new THREE.ConeGeometry(0.035, 0.24, 5).rotateZ(-Math.PI / 2).translate(0.13, 0.68, 0), stone),
    M(new THREE.ConeGeometry(0.035, 0.2, 5).rotateZ(Math.PI / 2).translate(-0.11, 0.68, 0), stone), lash(0.66, 0.035)),
  hoe: () => grp(M(new THREE.CylinderGeometry(0.02, 0.024, 0.9, 6).translate(0, 0.45, 0), wood), M(new THREE.BoxGeometry(0.16, 0.03, 0.12).translate(0.06, 0.86, 0.05), stone), lash(0.84, 0.03)),
  spear: (mat = stone) => grp(M(new THREE.CylinderGeometry(0.02, 0.024, 1.7, 6).translate(0, 0.55, 0), wood), M(new THREE.ConeGeometry(0.045, 0.24, 4).scale(1, 1, 0.4).translate(0, 1.5, 0), mat), lash(1.37, 0.026)),
  torch: () => { const g = grp(M(new THREE.CylinderGeometry(0.025, 0.03, 0.55, 6).translate(0, 0.27, 0), wood), M(new THREE.CylinderGeometry(0.05, 0.035, 0.12, 7).translate(0, 0.57, 0), leather));
    g.add(flame(0.62)); const L = new THREE.Object3D(); L.position.y = 0.8; g.add(L); g.userData.light = L; return g; },
  // (a leaf-bladed sword, its blade of lightstone; a crescent-cut shield, hide on a pale rim)
  sword: () => grp(M(new THREE.CylinderGeometry(0.02, 0.022, 0.12, 6).translate(0, 0.02, 0), leather), M(new THREE.BoxGeometry(0.16, 0.025, 0.04).translate(0, 0.09, 0), darkWood),
    M(new THREE.CylinderGeometry(0.02, 0.035, 0.52, 4).scale(1, 1, 0.3).translate(0, 0.36, 0), LIGHTSTONE), M(new THREE.ConeGeometry(0.02, 0.1, 4).scale(1, 1, 0.3).translate(0, 0.67, 0), LIGHTSTONE)),
  pelta: () => { const g = new THREE.Group(), r = 0.32, s = new THREE.Shape(); s.absarc(0, 0, r, 0.75, Math.PI * 2 - 0.75, false); s.absarc(r * 1.05, 0, r * 0.5, Math.PI + 1.1, Math.PI - 1.1, true);
    g.add(M(new THREE.ExtrudeGeometry(s, { depth: 0.04, bevelEnabled: false }).rotateZ(Math.PI / 2).translate(0, 0, -0.02), leather)); g.add(M(new THREE.TorusGeometry(r, 0.014, 4, 20, Math.PI * 2 - 1.5).rotateZ(Math.PI / 2 + 0.75), LIGHTSTONE)); return outward(g); },
  shield: (big) => { const g = new THREE.Group(); if (big) g.add(M(new THREE.BoxGeometry(0.6, 1.1, 0.05), wood)); else g.add(M(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14).rotateX(Math.PI / 2), wood));
    g.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03), stone)); g.add(M(new THREE.TorusGeometry(big ? 0.45 : 0.33, 0.012, 4, 20), leather)); return outward(g); },
};
// What each item looks like held
const LOOK = {
  crudeAxe: 'axe', lightstoneAxe: 'axeLight', crudeClub: 'club', crudeDagger: 'dagger', lightstoneDagger: 'daggerLight', hammer: 'hammer', pickaxe: 'pickaxe', hoe: 'hoe',
  crudeSpear: 'spear', lightstoneSpear: 'spearDoru', torch: 'torch', crudeBow: 'bow', cretanBow: 'cretanBow', crudeShield: 'shieldCretan', crudeTowerShield: 'shieldHoplon',
  peltaShield: 'pelta', lightstoneSword: 'swordLight', lightstoneArrow: 'arrowLight',   // (an arrow is never held: its model is for its icon, tools/assets/icons.mjs)
};
let axeP = null, bowP = null; const props = {};
const axeModel = () => (axeP ||= loadFBX('axe').then((o) => { const h = headAlong(normalizeHandle(fixMaterials(o), 0.85)); h.position.y = -0.09; return h; }));
const bowModel = () => (bowP ||= loadFBX('bow').then((o) => { const tex = loadTex('bow.jpg'), mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  o.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = true; } });
  const box = new THREE.Box3().setFromObject(o), s = 1.35 / box.getSize(new THREE.Vector3()).y; o.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -c.y, -c.z); return grp(o); }));
// A model from the pack, sized and turned by fit(model) the first time; null if it can't be had (the carved one stands in)
const prop = (name, fit) => (props[name] ||= loadPack(name).then((gl) => { gl.scene.traverse((m) => { if (m.isMesh) m.castShadow = true; }); return fit(gl.scene); }).catch(() => null));
const outward = (o) => { o.rotation.y = Math.PI; const g = grp(o); g.userData.strap = true; return g; };   // (and strapped on the forearm: hero.holdLeft)
// A bow put with its grip (the middle of the riser, where the most of its middle slice lies: not the string) at the origin
const byGrip = (o) => {
  const g = grp(o), xs = [], zs = [], v = new THREE.Vector3(); g.updateMatrixWorld(true);
  o.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (Math.abs(v.y) < 0.05) { xs.push(v.x); zs.push(v.z); } } });
  const mid = (a) => a.sort((p, q) => p - q)[a.length >> 1] ?? 0; o.position.x -= mid(xs); o.position.z -= mid(zs); return g;
};
const centred = (o, size, axis = 'y') => { const b = new THREE.Box3().setFromObject(o); o.scale.multiplyScalar(size / b.getSize(new THREE.Vector3())[axis]); const b2 = new THREE.Box3().setFromObject(o); o.position.sub(b2.getCenter(new THREE.Vector3())); return grp(o); };
const PACKED = {
  cretanBow: () => prop('cretanBow', (o) => byGrip(centred(o, 1.25))),   // (its limbs bow out along +x, its tips and string side to -x: as held, towards the archer)
  // shields: painted face out (the model's +z is the palm's side as held)
  shieldCretan: () => prop('shieldCretan', (o) => outward(centred(o, 0.7))),
  shieldHoplon: () => prop('shieldHoplon', (o) => outward(centred(o, 0.9))),
  spearDoru: () => prop('doru', (o) => { const h = normalizeHandle(o, 1.75); h.position.y = -0.35; return h; }),
  // the Greek warfare pack's peltast shield, the crescent cut away at the top as carried, its bronze rim and bands lightstone
  pelta: () => prop('pelta', (o) => { o.rotation.z = -Math.PI / 2; return outward(inStone(centred(o, 0.75), bronze)); }),
  // a xiphos, its leaf blade lightstone (the steel above the hilt; the bronze guard and the grip stay); slim at the head,
  // as the guard is wider than the blade
  arrowLight: () => prop('arrow', (o) => { const g = centred(o, 0.9), top = new THREE.Box3().setFromObject(g).max.y; return inStone(g, (c, p) => steel(c) && p.y > top - 0.2); }),
  swordLight: () => prop('xiphos', (o) => { const h = tool(o, 0.78, 0.05, false, true), b = new THREE.Box3().setFromObject(h); return inStone(h, (c, p) => steel(c) && p.y > b.min.y + (b.max.y - b.min.y) * 0.2); }),
  // tools: length, and how far below the grip the handle's end sits
  axe: () => prop('axeCrude', (o) => tool(o, 0.75, 0.09)), axeLight: () => prop('axeGood', (o) => tool(o, 0.85, 0.09)),
  club: () => prop('club', (o) => tool(o, 0.85, 0.08)), dagger: () => prop('knifeCrude', (o) => tool(o, 0.42, 0.02)), daggerLight: () => prop('knifeGood', (o) => tool(o, 0.38, 0.02, false, true)),   // (its guarded grip is wider than its blade: point the slim end out)
  hammer: () => prop('mallet', (o) => tool(o, 0.55, 0.06)), pickaxe: () => prop('pickaxe', (o) => tool(o, 0.8, 0.08)), hoe: () => prop('oldHoe', (o) => tool(o, 1.0, 0.15, true)),   // (the team's hoe: its blade wider than it is deep, so turned face on)
  spear: () => prop('oldSpear', (o) => tool(o, 1.8, 0.35)),   // (the team's stone spear, its painted look flattened: manifest flatColors)
  torch: () => prop('torch', (o) => { const g = tool(o, 0.8, 0.05), top = new THREE.Box3().setFromObject(g).max.y;   // our flame and light on its head
    g.add(flame(top - 0.04)); const L = new THREE.Object3D(); L.name = 'torchLight'; L.position.y = top + 0.12; g.add(L); return g; }),
};
function tool(o, len, below, flat, slim) { const h = headAlong(normalizeHandle(o, len, slim), flat); h.position.y = -below; return grp(h); }
// Each pack model comes out of normalizeHandle with its head pointing whichever way its maker turned it. The hand holds
// them all one way (hero.holdRight: +x to the knuckles, the way the hand strikes), so each is turned about its handle until
// its head (the top two fifths) lies widest along x, the longer side (an axe's blade, not its poll) to +x. flat: a blade
// that strikes with its face (a spade) turns a quarter more, its face to the knuckles
function headAlong(h, flat) {
  h.updateMatrixWorld(true); const box = new THREE.Box3().setFromObject(h), top = box.min.y + (box.max.y - box.min.y) * 0.6, v = new THREE.Vector3(), pts = [];
  h.traverse((m) => { if (!m.isMesh) return; const a = m.geometry.attributes.position; for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(m.matrixWorld); if (v.y > top) pts.push(v.x, v.z); } });
  let cx = 0, cz = 0, xx = 0, zz = 0, xz = 0; const n = pts.length / 2; if (!n) return h;
  for (let i = 0; i < pts.length; i += 2) { cx += pts[i] / n; cz += pts[i + 1] / n; }
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i] - cx, z = pts[i + 1] - cz; xx += x * x; zz += z * z; xz += x * z; }
  let a = 0.5 * Math.atan2(2 * xz, xx - zz), lo = 0, hi = 0;
  for (let i = 0; i < pts.length; i += 2) { const x = pts[i] * Math.cos(a) + pts[i + 1] * Math.sin(a); lo = Math.min(lo, x); hi = Math.max(hi, x); }
  if (-lo > hi * 1.15) a += Math.PI; if (flat) a += Math.PI / 2;   // (a near even head, a mallet's or a pick's, keeps the way it came)
  const g = grp(h); h.rotation.y = a; return g;
}
// A fresh model for an item (a promise: the imported ones stream in), in texels as the world is (render/pixel.js: in the
// tool's own frame, so they stay on it as it swings; twice as dense, as small things)
const texels = (o) => { o?.traverse((m) => { if (m.isMesh) for (const mt of [].concat(m.material)) { if (autoLook(mt) === 'flame') pixelateAuto(mt); else pixelate(mt, 'gear'); } }); return o; };   // (the flames their own, the rest as gear: small, so in the hero's denser texels)
export async function heldModel(id) { return texels(await heldModel0(id)); }
async function heldModel0(id) {
  const k = LOOK[id]; if (!k) return null;
  if (PACKED[k]) { const m = await PACKED[k](); if (m) { const c = m.clone(); c.userData.light = c.getObjectByName('torchLight'); return c; } }   // (a clone loses the light's handle)
  if (k === 'axe' || k === 'axeLight') { const m = (await axeModel()).clone(); if (k === 'axeLight') m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0xf4efe0); } }); return m; }
  if (k === 'bow' || k === 'cretanBow') { const b = (await bowModel()).clone(); b.rotation.y = Math.PI; return byGrip(b); }   // turned so the string faces the archer and the limbs curve away
  if (k === 'daggerLight') return CARVED.dagger(light);
  if (k === 'towerShield' || k === 'shieldHoplon') return CARVED.shield(true); if (k === 'shieldCretan') return CARVED.shield();
  if (k === 'spearDoru') return CARVED.spear(light);
  if (k === 'swordLight') return CARVED.sword(); if (k === 'pelta') return CARVED.pelta();
  return CARVED[k]?.() ?? null;
}
export const isLeftHanded = (id) => id === 'crudeBow' || id === 'cretanBow' || id === 'crudeShield' || id === 'crudeTowerShield' || id === 'peltaShield';
