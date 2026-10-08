// Models for things held in the hand or slung on the back. Each comes out handle-down along +y with the grip at y=0,
// so the hero's grip pose fits them all. The axe and the bow are the imported models; the rest are carved here.
import * as THREE from 'three';
import { loadFBX, loadTex, fixMaterials, normalizeHandle } from '../assets.js';

const wood = new THREE.MeshStandardMaterial({ color: 0x8a6440, roughness: 0.85 }), darkWood = new THREE.MeshStandardMaterial({ color: 0x5e4128, roughness: 0.9 });
const stone = new THREE.MeshStandardMaterial({ color: 0x8f887e, roughness: 0.9, flatShading: true }), light = new THREE.MeshStandardMaterial({ color: 0xe6e0cc, roughness: 0.55, flatShading: true });
const leather = new THREE.MeshStandardMaterial({ color: 0x6e4a2e, roughness: 0.8 }), cord = new THREE.MeshStandardMaterial({ color: 0xc9b48a, roughness: 0.9 });
const M = (g, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(g, m); o.position.set(x, y, z); o.castShadow = true; return o; };
const grp = (...a) => { const g = new THREE.Group(); a.forEach((o) => g.add(o)); return g; };
const lash = (y, r) => M(new THREE.TorusGeometry(r, 0.012, 4, 10).rotateX(Math.PI / 2), cord, 0, y, 0);

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
    const fl = M(new THREE.ConeGeometry(0.06, 0.22, 7).translate(0, 0.72, 0), new THREE.MeshBasicMaterial({ color: 0xffb040 })); fl.castShadow = false; fl.userData.flame = true; g.add(fl);
    const L = new THREE.Object3D(); L.position.y = 0.8; g.add(L); g.userData.light = L; return g; },
  shield: (big) => { const g = new THREE.Group(); if (big) g.add(M(new THREE.BoxGeometry(0.6, 1.1, 0.05), wood)); else g.add(M(new THREE.CylinderGeometry(0.34, 0.34, 0.05, 14).rotateX(Math.PI / 2), wood));
    g.add(M(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 10).rotateX(Math.PI / 2).translate(0, 0, 0.03), stone)); g.add(M(new THREE.TorusGeometry(big ? 0.45 : 0.33, 0.012, 4, 20), leather)); return g; },
};
// What each item looks like held
const LOOK = {
  crudeAxe: 'axe', lightstoneAxe: 'axeLight', crudeClub: 'club', crudeDagger: 'dagger', lightstoneDagger: 'daggerLight', hammer: 'hammer', pickaxe: 'pickaxe', hoe: 'hoe',
  crudeSpear: 'spear', lightstoneSpear: 'spearLight', torch: 'torch', crudeBow: 'bow', cretanBow: 'bow', crudeShield: 'shield', crudeTowerShield: 'towerShield',
};
let axeP = null, bowP = null;
const axeModel = () => (axeP ||= loadFBX('axe').then((o) => { const h = normalizeHandle(fixMaterials(o), 0.85); h.position.y = -0.09; return h; }));
const bowModel = () => (bowP ||= loadFBX('bow').then((o) => { const tex = loadTex('bow.jpg'), mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85 });
  o.traverse((m) => { if (m.isMesh) { m.material = mat; m.castShadow = true; } });
  const box = new THREE.Box3().setFromObject(o), s = 1.35 / box.getSize(new THREE.Vector3()).y; o.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(o), c = b2.getCenter(new THREE.Vector3()); o.position.set(-c.x, -c.y, -c.z); return grp(o); }));
// A fresh model for an item (a promise: the imported ones stream in)
export async function heldModel(id) {
  const k = LOOK[id]; if (!k) return null;
  if (k === 'axe' || k === 'axeLight') { const m = (await axeModel()).clone(); if (k === 'axeLight') m.traverse((o) => { if (o.isMesh) { o.material = o.material.clone(); o.material.color = new THREE.Color(0xf4efe0); } }); return m; }
  if (k === 'bow') { const b = (await bowModel()).clone(); b.rotation.y = Math.PI; const w = new THREE.Group(); w.add(b); return w; }   // turned so the string faces the archer and the limbs curve away
  if (k === 'daggerLight') return CARVED.dagger(light); if (k === 'spearLight') return CARVED.spear(light);
  if (k === 'towerShield') return CARVED.shield(true);
  return CARVED[k]?.() ?? null;
}
export const isLeftHanded = (id) => id === 'crudeBow' || id === 'cretanBow' || id === 'crudeShield' || id === 'crudeTowerShield';
