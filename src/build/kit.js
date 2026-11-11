// The building pieces' models: the team's rustic village kit (tools/assets), on the same 3 m grid as our pieces. Each
// model is fitted into its piece's own box, so the piece keeps the snap points, solids, tops and roof it always had and
// building works exactly as before; only the look changes. Until the models have loaded (or if the pack is missing) the
// carved pieces in pieces.js stand in.
//
// box: [x0, x1, y0, y1, z0, z1] in the piece's frame (walls along x, floors' tops at y 0, roofs rising towards -z);
// the model is turned a quarter if it lies the other way, half round if a slope rises the wrong way, and stretched to
// the box (uniform: kept in proportion, set on the floor at the middle of the box instead).
import * as THREE from 'three';
import { loadPack, bake } from '../assets.js';
import { wettable } from '../world/wetness.js';

const wall = (h) => [-1.5, 1.5, 0, h, -0.15, 0.15];
const roof = (run, rise) => ({ box: [-1.5, 1.5, -0.45 * rise / run, rise + 0.3, -run - 0.05, 0.45], slope: true });
const KIT = {
  wall: { file: 'kWall', box: wall(3) }, wallHalf: { file: 'kWallLow', box: wall(1) }, doorframe: { file: 'kDoorWall', box: wall(3) },
  door: { file: 'kDoor', box: [0, 1.36, 0, 2.28, -0.05, 0.05] },
  beamV: { file: 'kBeam', box: [-0.13, 0.13, 0, 3, -0.13, 0.13] },
  beamH: { file: 'kBeam', lay: 'x', box: [-1.5, 1.5, -0.13, 0.13, -0.13, 0.13] },
  beamD: { file: 'kBeam', lay: 'd', box: [-1.06, 1.06, 0, 2.12, -0.13, 0.13] },
  floor: { file: 'kFloor', box: [-1.5, 1.5, -0.1, 0, -1.5, 1.5] },
  roof63: { file: 'kRoof63', ...roof(3, 3) }, roof65: { file: 'kRoof65', ...roof(3, 5) }, roof94: { file: 'kRoof94', ...roof(4.5, 4) },
  end63: { file: 'kEnd63', box: [-3, 3, 0, 3, -0.15, 0.15] }, end65: { file: 'kEnd65', box: [-3, 3, 0, 5, -0.15, 0.15] }, end94: { file: 'kEnd94', box: [-4.5, 4.5, 0, 4, -0.15, 0.15] },
  stairs: { file: 'kStairs', box: [-1, 1, 0, 1.5, -2, 0], slope: true }, stairsLong: { file: 'kStairs', box: [-1, 1, 0, 3, -4, 0], slope: true },
  fence: { file: 'kFence', box: [-1, 1, 0, 1.2, -0.12, 0.12] }, stockade: { file: 'kStockade', box: [-2, 2, 0, 4.1, -0.22, 0.22] },
  awning: { file: 'kAwning', box: [-1.5, 1.5, 0, 0.67, -1.5, 0.1], slope: true },
  gateL: { file: 'kGateL', box: [0, 2, 0, 2.4, -0.08, 0.08] }, gateR: { file: 'kGateR', box: [-2, 0, 0, 2.4, -0.08, 0.08] },
  workbench: { file: 'kWorkbench', box: [-1, 1, 0, 0.98, -0.45, 0.45] }, campfire: { file: 'kCampfire', box: [-0.7, 0.7, 0, 0.5, -0.7, 0.7], uniform: true },
  cookingStand: { file: 'kCookStand', box: [-0.85, 0.85, 0, 1.12, -0.25, 0.25] }, bed: { file: 'kBed', box: [-0.55, 0.55, 0, 0.6, -1.05, 1.05] },
  chest: { file: 'kChest', box: [-0.5, 0.5, 0, 0.7, -0.3, 0.3], uniform: true }, torchStand: { file: 'kTorchStand', box: [-0.15, 0.15, 0, 1.62, -0.15, 0.15], uniform: true },
};

const size = (g) => { g.computeBoundingBox(); return g.boundingBox.getSize(new THREE.Vector3()); };
// mean height of the vertices on the -z and +z halves (which way a slope rises)
function rises(g) { g.computeBoundingBox(); const mid = (g.boundingBox.min.z + g.boundingBox.max.z) / 2, p = g.attributes.position; let a = 0, na = 0, b = 0, nb = 0; for (let i = 0; i < p.count; i++) if (p.getZ(i) < mid) { a += p.getY(i); na++; } else { b += p.getY(i); nb++; } return a / Math.max(na, 1) - b / Math.max(nb, 1); }
function fit(geo, K) {
  const [x0, x1, y0, y1, z0, z1] = K.box, W = x1 - x0, H = y1 - y0, D = z1 - z0;
  if (K.lay) { const s = size(geo); if (s.y >= s.x && s.y >= s.z) geo.rotateZ(Math.PI / 2); else if (s.z >= s.x) geo.rotateY(Math.PI / 2); if (K.lay === 'd') geo.rotateZ(Math.PI / 4); }   // (a post laid along x, or rising on the diagonal)
  let s = size(geo); if (!K.lay && Math.abs(W - D) > 0.05 && (s.x > s.z) !== (W > D)) geo.rotateY(Math.PI / 2);
  if (K.slope && rises(geo) < 0) geo.rotateY(Math.PI);
  if (K.lay === 'd') { s = size(geo); const k = Math.hypot(W, H) / Math.hypot(s.x, s.y); geo.scale(k, k, D / s.z); }   // (keep the diagonal's angle)
  else if (K.uniform) { s = size(geo); const k = Math.min(W / s.x, H / s.y, D / s.z); geo.scale(k, k, k); }
  else { s = size(geo); geo.scale(W / s.x, H / s.y, D / s.z); }
  geo.computeBoundingBox(); const b = geo.boundingBox;
  geo.translate((x0 + x1) / 2 - (b.min.x + b.max.x) / 2, y0 - b.min.y, (z0 + z1) / 2 - (b.min.z + b.max.z) / 2);
  geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}

// Load every piece's model and give the piece its look ({ geo, mat } like the carved ones); resolves when all are in
export function loadKit(pieces) {
  const mats = new Map();   // (one material per atlas, made wettable like the carved planks)
  // (the kit's paint is pale in our light: taken down a little)
  const matFor = (src) => { const key = src.map?.uuid ?? src.uuid; if (!mats.has(key)) mats.set(key, wettable(new THREE.MeshStandardMaterial({ map: src.map, color: 0xa8a8a8, roughness: 0.9 }), { dark: 0.62, gloss: 0.32 })); return mats.get(key); };
  return Promise.all(pieces.filter((p) => KIT[p.id]).map((p) => loadPack(KIT[p.id].file).then((gl) => {
    let src = null; gl.scene.traverse((m) => { if (m.isMesh && !src) src = m.material; });
    p.meshes = [{ geo: fit(bake(gl.scene), KIT[p.id]), mat: matFor(src) }];
  }).catch(() => {})));
}
