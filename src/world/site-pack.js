// The sites' props from the team's Ancient Empire pack (tools/assets): pottery, tripods, firewood, columns and the
// votive statues, each taking its carved prop's place at the carved one's size. Loaded before the sites are built
// (main.js); the site builders keep their own solids, tops and footprints, so nothing about walking or collision changes.
// A prop without one, or a missing pack, keeps its carved look.
import * as THREE from 'three';
import { mergeGeometries } from '../../vendor/three/jsm/utils/BufferGeometryUtils.js';
import { loadPack, bake } from '../assets.js';
import { wettable } from './wetness.js';

const LIST = { amphora: 'sAmphora', pithos: 'sPithos', bowl: 'sBowl', jug: 'sJug', tripod: 'sTripod', firewood: 'sFirewood', column: 'sColumn',
  // the statues (structures.js): the robed elder who is Zeus in the temple, the hoplite and the soldier guarding the sacred
  // way, the water-bearer by the old olives, the lions at the temple's gate, and the broken ones lying about the ruins
  zeus: 'sStatueB', hoplite: 'sStatue01', soldier: 'sStatue07', bearer: 'sStatue04', lion: 'sLion',
  broken1: 'sBroken1', broken2: 'sBroken2', broken3: 'sBroken3', broken4: 'sBroken4', broken5: 'sBroken5', broken6: 'sBroken6', broken7: 'sBroken7', broken8: 'sBroken8' };
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
// a copy of prop k at k times its own size (the broken statues: each piece as big as the figure it came from), or null
export function sitePropAt(k, sc = 1) { const S = SITE[k]; return S ? [S.geo.clone().scale(sc, sc, sc), S.mat] : null; }

// The abandoned town's buildings and the props of the island's small scenes (tools/assets: put together from the Ancient
// Empire pieces, each material keeping its own texture: plaster, roof tiles, marble, the atlas). Each comes as a list of
// { geo, mat }, one per material, standing on the ground and centred; a missing pack leaves the list empty and the
// places stand bare.
const PIECES = {}, OWN = {};   // (OWN: where each one's own origin went when it was centred)
export const PIECE_NAMES = ['twHouseA', 'twHouseB', 'twHouseC', 'twHouseD', 'twHouseE', 'twHouseF', 'twShed', 'twShell', 'twStoa', 'twTempleRuin', 'twFountain', 'twWell', 'twAwning', 'twTable',
  'twBench', 'twCart', 'twCartB', 'twBaskets', 'twBasket', 'twSack', 'twSacks', 'twVases', 'twJars', 'twVase', 'twJar', 'twStatue', 'twStatueBroken', 'twMarblePile', 'twDrum', 'twRubbleA',
  'twRubbleB', 'twRubbleC', 'twStack', 'twColumn', 'twColumnBase', 'twBrazier', 'twStraw', 'twStrawBundle', 'twFence', 'twBanner', 'twAnvil', 'twForge', 'twKiln', 'twPlinth', 'twRoad', 'twGrind',
  'twFirepit', 'twCenser', 'twBowl', 'twLogs', 'twPergola',
  // the trial's places (structures.js), whole or in parts: the temple out of the pack's demo scene; the Labyrinth's ashlar
  // walls and posts, its gate, columns, braziers and the stepped altar; the farmhouse and its furniture; the shrine's steps,
  // the reliefs of the Chimera and the Minotaur, the summit's altar and fire bowl; the bones of the beasts' meals (other
  // packs' own models)
  'plTemple', 'plWall', 'plWallPost', 'plGatePost', 'plBeam', 'plBrazier', 'plColumn', 'plColumnHalf', 'plPile', 'plBlock', 'plDais',
  'plFarmhouse', 'plLoom', 'plBed', 'plTable', 'plStool', 'plSteps', 'plSymChimera', 'plSymMinotaur', 'plBomos', 'plFireBowl',
  // (and the offerings at the summit's altar, the broken column its bronze eagle stands on, the eagle itself)
  ...['sm-prop-goblet-01', 'sm-prop-goblet-02', 'sm-prop-plate-01', 'sm-chr-attach-crown-leaf-01', 'sm-bld-pillar-monument-01-damaged-01'].map((k) => 'all/polygonancientempire/' + k), 'all/polygongeneric/sm-gen-prop-coin-pile-01', 'all/pnb-alpine-mountain/fx-hawk-01',
  'all/pnb-swamp-marshland/sm-prop-bone-pile-01', 'all/pnb-swamp-marshland/sm-prop-bone-pile-02', 'all/pnb-swamp-marshland/sm-prop-bone-ribcage-01', 'all/pnb-swamp-marshland/sm-prop-bone-skull-01',
  // the temple's furnishings: its rugs, offering tables, banners, braziers and heaped jars
  ...['rug-01', 'rug-03', 'table-02', 'table-08', 'banner-01-a', 'banner-large-01', 'brazier-03', 'vase-pile-01', 'vase-pile-02'].map((k) => 'all/polygonancientempire/sm-prop-' + k),
  // the Giants' caves: the giant's fire, the bones of the big beasts he ate and the skulls of the men
  'all/polygonnature/sm-prop-campfire-01', 'all/pnb-arid-desert/sm-prop-bones-01', 'all/pnb-arid-desert/sm-prop-bones-04', 'all/polygonnature/sm-prop-skull-01', 'all/polygongeneric/sm-gen-prop-skull-01'];
export function loadPieces() {
  const mats = new Map();   // (one material per texture or colour, wet in the rain; pale palettes taken down as above)
  const matFor = (src) => { const key = src.map ? src.map.uuid : src.color.getHexString(); if (!mats.has(key)) mats.set(key, wettable(new THREE.MeshStandardMaterial({ map: src.map, color: src.map ? 0xb4b4b4 : src.color.clone().multiplyScalar(0.8), roughness: 0.85 }), { dark: 0.68, gloss: 0.3 })); return mats.get(key); };
  return Promise.all(PIECE_NAMES.map((k) => loadPack(k).then((gl) => {
    gl.scene.updateMatrixWorld(true); const by = new Map();
    gl.scene.traverse((m) => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); for (const a of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(a)) g.deleteAttribute(a); if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); const mt = matFor(m.material); (by.get(mt) || by.set(mt, []).get(mt)).push(g.index ? g.toNonIndexed() : g); });
    const all = new THREE.Box3(); for (const gs of by.values()) for (const g of gs) { g.computeBoundingBox(); all.union(g.boundingBox); }
    const c = all.getCenter(new THREE.Vector3());
    PIECES[k] = [...by].map(([mat, gs]) => ({ geo: mergeGeometries(gs).translate(-c.x, -all.min.y, -c.z), mat })); OWN[k] = [c.x, all.min.y, c.z];
  }).catch(() => {})).concat(loadChest(matFor)));
}
// The old wooden chest of the farmhouse and the abandoned town (polygonnature's), its lid apart so it can open: { body,
// lid } as lists of [geo, mat], the chest standing on the ground and centred, the lid's own frame on its hinge, which is
// at hinge [y, z] (the back of its lower edge); null without the pack
let CHEST = null;
export const chestParts = () => CHEST;
function loadChest(matFor) {
  return loadPack('all/polygonnature/sm-prop-chest-wood-01').then((gl) => {
    gl.scene.updateMatrixWorld(true); const parts = [], all = new THREE.Box3(), lb = new THREE.Box3();
    gl.scene.traverse((m) => { if (!m.isMesh) return; const g = m.geometry.clone().applyMatrix4(m.matrixWorld); g.computeBoundingBox(); all.union(g.boundingBox); if (/lid/i.test(m.name)) lb.union(g.boundingBox); parts.push([g, matFor(m.material), /lid/i.test(m.name)]); });
    const c = all.getCenter(new THREE.Vector3()), hy = lb.min.y - all.min.y, hz = lb.min.z - c.z;
    for (const [g] of parts) g.translate(-c.x, -all.min.y, -c.z);
    CHEST = { body: parts.filter((p) => !p[2]).map(([g, m]) => [g, m]), lid: parts.filter((p) => p[2]).map(([g, m]) => [g.translate(0, -hy, -hz), m]), hinge: [hy, hz] };
  }).catch(() => {});
}
// A piece placed for a site's merged parts: [[geo, mat]...] at (x, y, z), turned rot about y and scaled s (or [sx, sy, sz]
// along its own axes) (empty without the pack)
export function piece(k, x, y, z, rot = 0, s = 1, cut = null) { const [a, b, c] = Array.isArray(s) ? s : [s, s, s]; return (PIECES[k] || []).map(({ geo, mat }) => [(cut ? without(geo, OWN[k], cut) : geo.clone()).scale(a, b, c).rotateY(rot).translate(x, y, z), mat]); }
// The same, with the model's own origin (not the middle of its foot) at x, y, z: for the places put together from the demo
// scene, whose floors, walls and steps the site builders know by where they stand from that origin. cut: boxes
// [x0, x1, y0, y1, z0, z1] in that frame (at the model's own size) whose triangles are left out (a doorway opened up)
export function pieceAt(k, x, y, z, rot = 0, s = 1, cut = null) { const o = OWN[k]; if (!o) return []; const c = Math.cos(rot), sn = Math.sin(rot); return piece(k, x + s * (o[0] * c + o[2] * sn), y + s * o[1], z + s * (-o[0] * sn + o[2] * c), rot, s, cut); }
// a copy of a piece's (unindexed) geometry without the triangles whose middle lies in one of the boxes (o: where its own origin went)
function without(geo, o, boxes) {
  const p = geo.attributes.position, keep = [];
  for (let i = 0; i < p.count; i += 3) {
    const x = (p.getX(i) + p.getX(i + 1) + p.getX(i + 2)) / 3 + o[0], y = (p.getY(i) + p.getY(i + 1) + p.getY(i + 2)) / 3 + o[1], z = (p.getZ(i) + p.getZ(i + 1) + p.getZ(i + 2)) / 3 + o[2];
    if (!boxes.some((b) => x > b[0] && x < b[1] && y > b[2] && y < b[3] && z > b[4] && z < b[5])) keep.push(i);
  }
  const out = new THREE.BufferGeometry();
  for (const [k, a] of Object.entries(geo.attributes)) { const n = a.itemSize, arr = new Float32Array(keep.length * 3 * n); keep.forEach((i, j) => arr.set(a.array.subarray(i * n, (i + 3) * n), j * 3 * n)); out.setAttribute(k, new THREE.BufferAttribute(arr, n)); }
  return out;
}
export const hasPiece = (k) => !!PIECES[k];
