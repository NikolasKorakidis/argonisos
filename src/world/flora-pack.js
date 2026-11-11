// Trees, rocks, shrubs and ruins from the team's packs (tools/assets: low-poly nature and Ancient Empire, their atlas
// colours baked into the vertices so they share the carved species' one material, wind and impostors). Each takes its
// carved species' place, fitted to the carved one's size (the same height for a tree, the same bulk for the rest) and
// standing on its foot, so colliders, woods rules and the mist's reach stay as they were. Loaded before the vegetation
// starts (main.js); a species without one, or a missing pack, keeps its carved look.
import * as THREE from 'three';
import { loadPack, bake } from '../assets.js';
import { SPECIES } from './flora.js';

const LIST = {
  olive: ['fl_olive0',  'fl_olive1',  'fl_olive2'],
  oak: ['fl_oak0',  'fl_oak1',  'fl_oak2'],
  cypress: ['fl_cypress0',  'fl_cypress1'],
  pomegranate: ['fl_pomegranate0', 'fl_pomegranate1'],
  fig: ['fl_fig0',  'fl_fig1'],
  plane: ['fl_plane0',  'fl_plane1'],
  qtree: ['fl_qtree0',  'fl_qtree1'],
  qpine: ['fl_qpine0', 'fl_qpine1', 'fl_qpine2'],
  fir: ['fl_fir0', 'fl_fir1', 'fl_fir2'],
  holm: ['fl_holm0', 'fl_holm1', 'fl_holm2'],
  qdead: ['fl_qdead0', 'fl_qdead1', 'fl_qdead2'],
  dead: ['fl_dead0',  'fl_dead1'],
  rock: ['fl_rock0',  'fl_rock1'],
  boulder: ['fl_boulder0',  'fl_boulder1'],
  reeds: ['fl_reeds0'],
  myrtle: ['fl_myrtle0'],
  broom: ['fl_broom0'],
  redbush: ['fl_redbush0'],
  fern: ['fl_fern0'],
  colfall: ['fl_colfall0',  'fl_colfall1'],
  colstand: ['fl_colstand0'],
  wallruin: ['fl_wallruin0'],
  amphorae: ['fl_amphorae0'],
  // the ground between (Patch 12): these keep the pack's own sizes
  flowers: ['fl_flowers0', 'fl_flowers1', 'fl_flowers2', 'fl_flowers3', 'fl_flowers4', 'fl_flowers5', 'fl_flowers6'],
  tallgrass: ['fl_tallgrass0', 'fl_tallgrass1', 'fl_tallgrass2'],
  bush: ['fl_bush0', 'fl_bush1', 'fl_bush2', 'fl_bush3'],
  mushrooms: ['fl_mushrooms0', 'fl_mushrooms1'],
  pebbles: ['fl_pebbles0', 'fl_pebbles1', 'fl_pebbles2'],
  stump: ['fl_stump0', 'fl_stump1', 'fl_stump2', 'fl_stump3', 'fl_stump4'],
  log: ['fl_log0', 'fl_log1', 'fl_log2', 'fl_log3'],
  branch: ['fl_branch0', 'fl_branch1', 'fl_branch2'],
  roots: ['fl_roots0', 'fl_roots1', 'fl_roots2'],
  lilypads: ['fl_lilypads0', 'fl_lilypads1', 'fl_lilypads2'],
  swampgrass: ['fl_swampgrass0', 'fl_swampgrass1', 'fl_swampgrass2'],
  driftwood: ['fl_driftwood0', 'fl_driftwood1', 'fl_driftwood2'],
};
const NATURAL = new Set(SPECIES.filter((s) => s.natural).map((s) => s.name));
export const FLORA = {};   // species → [geometry per model]
export function loadFlora() {
  return Promise.all(Object.entries(LIST).map(([sp, files]) => Promise.all(files.map((f) => loadPack(f).then((gl) => bake(gl.scene, true)))).then((gs) => { FLORA[sp] = gs; }).catch(() => {})));
}
// variant v of a species, fitted into the carved one's place (box: the carved geometry's bounds), or at its own size
export function floraGeo(sp, v, box, tree) {
  const list = FLORA[sp]; if (!list) return null;
  const g = list[v % list.length].clone(); g.computeBoundingBox(); let b = g.boundingBox;
  const S = box.getSize(new THREE.Vector3()), s0 = b.getSize(new THREE.Vector3()), k = NATURAL.has(sp) ? 1 : tree ? S.y / s0.y : S.length() / s0.length(); g.scale(k, k, k);
  // its foot: the middle of what's near the ground (a trunk, the base of a rock)
  g.computeBoundingBox(); b = g.boundingBox; const p = g.attributes.position, lim = b.min.y + (b.max.y - b.min.y) * 0.06; let fx = 0, fz = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= lim) { fx += p.getX(i); fz += p.getZ(i); n++; }
  g.translate(-fx / Math.max(n, 1), (NATURAL.has(sp) ? 0 : box.min.y) - b.min.y, -fz / Math.max(n, 1));
  // (a touch darker: the packs' palettes come out pale in our light)
  const c = g.attributes.color; for (let i = 0; i < c.array.length; i++) c.array[i] *= 0.82;
  g.computeBoundingSphere(); return g;
}
