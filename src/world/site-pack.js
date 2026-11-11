// The sites' props from the team's Ancient Empire pack (tools/assets): pottery, tripods, firewood, columns and the
// votive statues, each taking its carved prop's place at the carved one's size. Loaded before the sites are built
// (main.js); the site builders keep their own solids, tops and footprints, so nothing about walking or collision changes.
// A prop without one, or a missing pack, keeps its carved look.
import * as THREE from 'three';
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
