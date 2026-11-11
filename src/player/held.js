// Models for things held in the hand or slung on the back. Each comes out handle-down along +y with the grip at y=0,
// so the hero's grip pose fits them all. The crude bow is an imported model; the rest come from the team's packs
// (tools/assets: Greek warfare for the Cretan bow, shields and lightstone spear; the rustic kit and Synty for the tools),
// with the carved ones below standing in while they load or if a pack file is missing.
import * as THREE from 'three';
import { loadFBX, loadPack, loadTex, fixMaterials, normalizeHandle } from '../assets.js';

const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }), darkWood = new THREE.MeshStandardMaterial({ color: 0x5e4128, roughness: 0.9 });
const stone = new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 0.9, flatShading: true }), light = new THREE.MeshStandardMaterial({ color: 0xe6e0cc, roughness: 0.55, flatShading: true });
const leather = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.8 }), cord = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.9 });
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
  shield: (big) => { const g = new THREE.Group(); if (big) g.add(M(new THREE.BoxGeometry(0.6, 1.1, 0.05), wood)); else g.add(M(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14).rotateX(Math.PI / 2), wood));
    g.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03), stone)); g.add(M(new THREE.TorusGeometry(big ? 0.45 : 0.33, 0.012, 4, 20), leather)); return outward(g); },
};
// What each item looks like held
const LOOK = {
  crudeAxe: 'axe', lightstoneAxe: 'axeLight', crudeClub: 'club', crudeDagger: 'dagger', lightstoneDagger: 'daggerLight', hammer: 'hammer', pickaxe: 'pickaxe', hoe: 'hoe',
  crudeSpear: 'spear', lightstoneSpear: 'spearDoru', torch: 'torch', crudeBow: 'bow', cretanBow: 'cretanBow', crudeShield: 'shieldCretan', crudeTowerShield: 'shieldHoplon',
};
let axeP = null, bowP = null; const props = {};
const axeModel = () => (axeP ||= loadFBX('axe').then((o) => { const h = normalizeHandle(fixMaterials(o), 0.85); h.position.y = -0.09; return h; }));
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
  // tools: length, and how far below the grip the handle's end sits
  axe: () => prop('axeCrude', (o) => tool(o, 0.75, 0.09)), axeLight: () => prop('axeGood', (o) => tool(o, 0.85, 0.09)),
  club: () => prop('club', (o) => tool(o, 0.85, 0.08)), dagger: () => prop('knifeCrude', (o) => tool(o, 0.42, 0.02)), daggerLight: () => prop('knifeGood', (o) => tool(o, 0.38, 0.02)),
  hammer: () => prop('mallet', (o) => tool(o, 0.55, 0.06)), pickaxe: () => prop('pickaxe', (o) => tool(o, 0.8, 0.08)), hoe: () => prop('spade', (o) => tool(o, 1.0, 0.15)),
  spear: () => prop('stake', (o) => { const g = tool(o, 1.8, 0.35); g.scale.set(0.3, 1, 0.3); return grp(g); }),   // (a stake for a palisade, thinned to a shaft; the hand sets the outer group's scale)
  torch: () => prop('torch', (o) => { const g = tool(o, 0.8, 0.05), top = new THREE.Box3().setFromObject(g).max.y;   // our flame and light on its head
    g.add(flame(top - 0.04)); const L = new THREE.Object3D(); L.name = 'torchLight'; L.position.y = top + 0.12; g.add(L); return g; }),
};
function tool(o, len, below) { const h = normalizeHandle(o, len); h.position.y = -below; return grp(h); }
// A fresh model for an item (a promise: the imported ones stream in)
export async function heldModel(id) {
  const k = LOOK[id]; if (!k) return null;
  if (PACKED[k]) { const m = await PACKED[k](); if (m) { const c = m.clone(); c.userData.light = c.getObjectByName('torchLight'); return c; } }   // (a clone loses the light's handle)
  if (k === 'axe' || k === 'axeLight') { const m = (await axeModel()).clone(); if (k === 'axeLight') m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0xf4efe0); } }); return m; }
  if (k === 'bow' || k === 'cretanBow') { const b = (await bowModel()).clone(); b.rotation.y = Math.PI; return byGrip(b); }   // turned so the string faces the archer and the limbs curve away
  if (k === 'daggerLight') return CARVED.dagger(light);
  if (k === 'towerShield' || k === 'shieldHoplon') return CARVED.shield(true); if (k === 'shieldCretan') return CARVED.shield();
  if (k === 'spearDoru') return CARVED.spear(light);
  return CARVED[k]?.() ?? null;
}
export const isLeftHanded = (id) => id === 'crudeBow' || id === 'cretanBow' || id === 'crudeShield' || id === 'crudeTowerShield';
