// The sites' props from the team's Ancient Empire pack (tools/assets): pottery, tripods, firewood, columns and the
// votive statues, each taking its carved prop's place at the carved one's size. Loaded before the sites are built
// (main.js); the site builders keep their own solids, tops and footprints, so nothing about walking or collision changes.
// A prop without one, or a missing pack, keeps its carved look.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { loadPack, bake } from '../assets.js';
import { wettable } from './wetness.js';

const LIST = { amphora: 'sAmphora', pithos: 'sPithos', bowl: 'sBowl', jug: 'sJug', tripod: 'sTripod', firewood: 'sFirewood', column: 'sColumn', statueA: 'sStatueA', statueB: 'sStatueB', statueC: 'sStatueC' };
const SITE = {};   // name → { geo (standing on the ground, centred), mat }
export function loadSiteProps() {
  const mats = new Map();   // (one material per atlas, wet in the rain like the carved stone; the packs' palettes are pale in our light)
  const matFor = (map) => { if (!mats.has(map)) mats.set(map, wettable(new THREE.MeshStandardMaterial({ map, color: 0xb4b4b4, roughness: 0.8 }), { dark: 0.68, gloss: 0.3 })); return mats.get(map); };
  return Promise.all(Object.entries(LIST).map(([k, f]) => loadPack(f).then((gl) => {
    let map = null; gl.scene.traverse((m) => { if (m.isMesh && !map) map = m.material.map; });
    const geo = bake(gl.scene); geo.computeBoundingBox(); const b = geo.boundingBox; geo.translate(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2);
    SITE[k] = { geo, mat: matFor(map) };
  }).catch(() => {})));
}
// a copy of prop k, h metres tall (and w across, if given: columns are fitted to the carved ones' girth), or null
export function siteProp(k, h, w) {
  const S = SITE[k]; if (!S) return null; const g = S.geo.clone(); g.computeBoundingBox(); const s = g.boundingBox.getSize(new THREE.Vector3());
  const ky = h / s.y, kx = w ? w / Math.max(s.x, s.z) : ky; g.scale(kx, ky, kx); return [g, S.mat];
}

// The abandoned town's buildings and the props of the island's small scenes (tools/assets: put together from the Ancient
// Empire pieces, each material keeping its own texture: plaster, roof tiles, marble, the atlas). Each comes as a list of
// { geo, mat }, one per material, standing on the ground and centred; a missing pack leaves the list empty and the
// places stand bare.
const PIECES = {};
export const PIECE_NAMES = ['twHouseA', 'twHouseB', 'twHouseC', 'twHouseD', 'twHouseE', 'twHouseF', 'twShed', 'twShell', 'twStoa', 'twTempleRuin', 'twFountain', 'twWell', 'twAwning', 'twTable',
  'twBench', 'twCart', 'twCartB', 'twBaskets', 'twBasket', 'twSack', 'twSacks', 'twVases', 'twJars', 'twVase', 'twJar', 'twStatue', 'twStatueBroken', 'twMarblePile', 'twDrum', 'twRubbleA',
  'twRubbleB', 'twRubbleC', 'twStack', 'twColumn', 'twColumnBase', 'twBrazier', 'twStraw', 'twStrawBundle', 'twFence', 'twBanner', 'twAnvil', 'twForge', 'twKiln', 'twPlinth', 'twRoad', 'twGrind',
  'twFirepit', 'twCenser', 'twBowl', 'twLogs', 'twPergola'];
export function loadPieces() {
  const mats = new Map();   // (one material per texture or colour, wet in the rain; pale palettes taken down as above)
  const matFor = (src) => { const key = src.map ? src.map.uuid : src.color.getHexString(); if (!mats.has(key)) mats.set(key, wettable(new THREE.MeshStandardMaterial({ map: src.map, color: src.map ? 0xb4b4b4 : src.color.clone().multiplyScalar(0.8), roughness: 0.85 }), { dark: 0.68, gloss: 0.3 })); return mats.get(key); };
  return Promise.all(PIECE_NAMES.map((k) => loadPack(k).then((gl) => {
    gl.scene.updateMatrixWorld(true); const by = new Map();
    gl.scene.traverse((m) => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); const mt = matFor(m.material); (by.get(mt) || by.set(mt, []).get(mt)).push(g.index ? g.toNonIndexed() : g); });
    const all = new THREE.Box3(); for (const gs of by.values()) for (const g of gs) { g.computeBoundingBox(); all.union(g.boundingBox); }
    const c = all.getCenter(new THREE.Vector3());
    PIECES[k] = [...by].map(([mat, gs]) => ({ geo: mergeGeometries(gs).translate(-c.x, -all.min.y, -c.z), mat }));
  }).catch(() => {})));
}
// A piece placed for a site's merged parts: [[geo, mat]...] at (x, y, z), turned rot about y and scaled s (empty without the pack)
export function piece(k, x, y, z, rot = 0, s = 1) { return (PIECES[k] || []).map(({ geo, mat }) => [geo.clone().scale(s, s, s).rotateY(rot).translate(x, y, z), mat]); }
