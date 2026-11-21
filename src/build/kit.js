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
import { clamp } from '../util/math.js';

// (a wall's logs end rounded, short of the corner: drawn half the wall's thickness longer at each end, so they reach the
// outer face of the wall across the corner and overlap their neighbours in a row, and 4 cm down into the floor, so no
// daylight shows through the corners, the joints or under the bottom log; the door frame only 2 cm, or its opening
// would grow wider than the door)
const wall = (h, w = 1.65) => [-w, w, -0.04, h, -0.15, 0.15];
const roof = (run, rise) => ({ box: [-1.5, 1.5, -0.45 * rise / run, rise + 0.3, -run - 0.05, 0.45], slope: true });
// a gable end: the triangle of logs, and over its sloping edges the thatch's end cap (the kit's "roof end"), sized like the
// roof panels it closes (out to their eaves, up to their top) and centred on the gable, so it caps the panels' cut ends
const end = (file, trim, run, rise) => ({ file, box: [-run, run, 0, rise, -0.15, 0.15], trim: { file: trim, box: [-run - 0.45, run + 0.45, -0.45 * rise / run, rise + 0.3, -0.4, 0.4] } });
const KIT = {
  wall: { file: 'kWall', box: wall(3) }, wallHalf: { file: 'kWallLow', box: wall(1) }, doorframe: { file: 'kDoorWall', box: wall(3, 1.52) },
  door: { file: 'kDoor', box: [0, 1.36, 0, 2.28, -0.05, 0.05] },   // (the carved door's box, then made to the frame's opening: hang)
  beamV: { file: 'kBeam', box: [-0.13, 0.13, 0, 3, -0.13, 0.13] },
  beamH: { file: 'kBeamH', box: [-1.5, 1.5, -0.13, 0.13, -0.13, 0.13] },   // (a squared beam, lying as it comes)
  beamD: { file: 'kBeamD', lay: 'd', box: [-1.06, 1.06, 0, 2.12, -0.13, 0.13] },   // (the 4 m post: tilted, it keeps a slimmer section than the 3 m one)
  floor: { file: 'kFloor', box: [-1.5, 1.5, -0.1, 0, -1.5, 1.5] },
  roof63: { file: 'kRoof63', ...roof(3, 3) }, roof65: { file: 'kRoof65', ...roof(3, 5) }, roof94: { file: 'kRoof94', ...roof(4.5, 4) },
  end63: end('kEnd63', 'kTrim63', 3, 3), end65: end('kEnd65', 'kTrim65', 3, 5), end94: end('kEnd94', 'kTrim94', 4.5, 4),
  stairs: { file: 'kStairsShort', box: [-1, 1, 0, 1.5, -2, 0], slope: true }, stairsLong: { file: 'kStairs', box: [-1, 1, 0, 3, -4, 0], slope: true },
  fence: { file: 'kFence', box: [-1, 1, 0, 1.2, -0.12, 0.12] }, stockade: { file: 'kStockade', box: [-2, 2, 0, 4.1, -0.22, 0.22] },
  awning: { file: 'kAwning', box: [-1.5, 1.5, 0, 0.67, -1.5, 0.1], slope: true },
  gateL: { file: 'kGateL', box: [0, 2, 0, 2.4, -0.08, 0.08] }, gateR: { file: 'kGateR', box: [-2, 0, 0, 2.4, -0.08, 0.08] },
  workbench: { file: 'kWorkbench', box: [-1, 1, 0, 0.98, -0.45, 0.45] }, campfire: { file: 'kCampfire', box: [-0.7, 0.7, 0, 0.5, -0.7, 0.7], uniform: true },
  bed: { file: 'kBed', box: [-0.55, 0.55, 0, 0.6, -1.05, 1.05], uniform: true },   // (a low pallet bed: in proportion it's lower than the bed you lie on)
  cookingStand: { file: 'kCookStand', box: [-0.85, 0.85, 0, 1.12, -0.45, 0.45], uniform: true },   // (the fish rack at half its size, its bar where the meat hangs)
  chest: { file: 'kChest', box: [-0.5, 0.5, 0, 0.7, -0.3, 0.3], uniform: true }, torchStand: { file: 'kTorchStand', box: [-0.15, 0.15, 0, 1.62, -0.15, 0.15], uniform: true },
  // (the pieces added in Patch 23: the kit's window wall, narrow wall and half gable, the thatch panel and gable end laid
  // to a low pitch, and the packs' cut logs as log beams and posts, in their own vertex colours: vc)
  wallWindow: { file: 'all/rpgpp-ag/rpgpp-ag-wall-01-3x3-window-a', box: wall(3) }, wallNarrow: { file: 'all/rpgpp-ag/rpgpp-ag-wall-01-1-5x3-a', box: wall(3, 0.9) },
  wallTri: { file: 'all/rpgpp-ag/rpgpp-ag-roof-end-01-6x3-wall-half-a', box: [-1.5, 1.65, 0, 3, -0.15, 0.15] },
  roof615: { file: 'kRoof63', ...roof(3, 1.5) }, end615: end('kEnd63', 'kTrim63', 3, 1.5),
  beamLog: { file: 'pLog2', vc: true, lay: 'x', box: [-1.5, 1.5, -0.2, 0.2, -0.2, 0.2] }, postLog: { file: 'pLog2', vc: true, lay: 'y', box: [-0.24, 0.24, 0, 3, -0.24, 0.24] },
};

const size = (g) => { g.computeBoundingBox(); return g.boundingBox.getSize(new THREE.Vector3()); };
// mean height of the vertices on the -z and +z halves (which way a slope rises)
function rises(g) { g.computeBoundingBox(); const mid = (g.boundingBox.min.z + g.boundingBox.max.z) / 2, p = g.attributes.position; let a = 0, na = 0, b = 0, nb = 0; for (let i = 0; i < p.count; i++) if (p.getZ(i) < mid) { a += p.getY(i); na++; } else { b += p.getY(i); nb++; } return a / Math.max(na, 1) - b / Math.max(nb, 1); }
function fit(geo, K) {
  const [x0, x1, y0, y1, z0, z1] = K.box, W = x1 - x0, H = y1 - y0, D = z1 - z0;
  if (K.lay) { const s = size(geo); if (s.y >= s.x && s.y >= s.z) geo.rotateZ(Math.PI / 2); else if (s.z >= s.x) geo.rotateY(Math.PI / 2); if (K.lay === 'd') geo.rotateZ(Math.PI / 4); if (K.lay === 'y') geo.rotateZ(Math.PI / 2); }   // (a post laid along x, rising on the diagonal, or a log stood up)
  let s = size(geo); if (!K.lay && Math.abs(W - D) > 0.05 && (s.x > s.z) !== (W > D)) geo.rotateY(Math.PI / 2);
  if (K.slope && rises(geo) < 0) geo.rotateY(Math.PI);
  if (K.lay === 'd') { s = size(geo); const k = Math.hypot(W, H) / Math.hypot(s.x, s.y); geo.scale(k, k, D / s.z); }   // (keep the diagonal's angle)
  else if (K.uniform) { s = size(geo); const k = Math.min(W / s.x, H / s.y, D / s.z); geo.scale(k, k, k); }
  else { s = size(geo); geo.scale(W / s.x, H / s.y, D / s.z); }
  geo.computeBoundingBox(); const b = geo.boundingBox;
  geo.translate((x0 + x1) / 2 - (b.min.x + b.max.x) / 2, y0 - b.min.y, (z0 + z1) / 2 - (b.min.z + b.max.z) / 2);
  geo.computeVertexNormals(); geo.computeBoundingSphere(); return geo;
}

// The door made to its frame's opening. The kit's door is narrower than the frame's (a gap of a hand's width each side)
// and square, where the opening is arched over the top and its sill curves up into the posts. So the opening is
// measured off the fitted frame itself (rays out from its middle, in the door's plane), the door is stretched across it
// and its plank ends are bent to follow the arch and the sill, leaving clear only gap (m) all round: a snug, even fit
// however the frame's model changes. Only the top and bottom ends bend (bend m of each), so the straps and the planks
// between stay straight. hinge: where the door hangs in the frame (pieces.js: the door's own x 0)
const DOOR = { gap: 0.012, bend: 0.3 };
function hang(door, frame, hinge) {
  const m = new THREE.Mesh(frame, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), rc = new THREE.Raycaster(), o = new THREE.Vector3(), dir = new THREE.Vector3();
  const cast = (x, y, dx, dy) => { rc.set(o.set(x, y, 0), dir.set(dx, dy, 0)); return rc.intersectObject(m, false)[0]?.distance ?? NaN; };
  let L = -Infinity, R = Infinity; for (let y = 0.6; y < 2; y += 0.1) { L = Math.max(L, -cast(0, y, -1, 0)); R = Math.min(R, cast(0, y, 1, 0)); }   // (the posts, at their nearest)
  const N = 32, top = [], bot = [], c = DOOR.gap;
  for (let i = 0; i <= N; i++) { const x = L + 0.004 + ((R - L - 0.008) * i) / N; top.push(1.2 + cast(x, 1.2, 0, 1)); bot.push(1.2 - cast(x, 1.2, 0, -1)); }
  if (![L, R, ...top, ...bot].every(Number.isFinite) || R - L < 0.8) return;   // (not a frame we can measure: the door stays as fitted)
  const at = (a, x) => { const f = clamp(((x - L) / (R - L)) * N, 0, N), i = Math.min(N - 1, Math.floor(f)); return a[i] + (a[i + 1] - a[i]) * (f - i); };
  const B = Math.min(...bot) + c, T = Math.max(...top) - c, yb = B + DOOR.bend, yt = T - DOOR.bend;
  // (across, the planks are fitted, not the hinges' ends standing out past them: those reach into the post)
  door.computeBoundingBox(); const b = door.boundingBox, p = door.attributes.position; let x0 = Infinity, x1 = -Infinity;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > b.max.y - 0.03) { x0 = Math.min(x0, p.getX(i)); x1 = Math.max(x1, p.getX(i)); }
  for (let i = 0; i < p.count; i++) {
    const x = L + c + ((p.getX(i) - x0) / (x1 - x0)) * (R - L - 2 * c); let y = B + ((p.getY(i) - b.min.y) / (b.max.y - b.min.y)) * (T - B);
    const lo = Math.min(at(bot, x) + c, yb - 0.05), hi = Math.max(at(top, x) - c, yt + 0.05);
    if (y < yb) y = lo + ((y - B) * (yb - lo)) / (yb - B); else if (y > yt) y = yt + ((y - yt) * (hi - yt)) / (T - yt);
    p.setXY(i, x - hinge, y);
  }
  p.needsUpdate = true; door.computeVertexNormals(); door.computeBoundingBox(); door.computeBoundingSphere();
}

// Load every piece's model and give the piece its look ({ geo, mat } like the carved ones); resolves when all are in
export function loadKit(pieces) {
  const mats = new Map(); let vcMat = null;   // (one material per atlas, made wettable like the carved planks)
  // (the kit's paint is pale in our light: taken down a little)
  const matFor = (src) => { const key = src.map?.uuid ?? src.uuid; if (!mats.has(key)) mats.set(key, wettable(new THREE.MeshStandardMaterial({ map: src.map, color: 0xa8a8a8, roughness: 0.9 }), { dark: 0.62, gloss: 0.32 })); return mats.get(key); };
  const look = (K) => loadPack(K.file).then((gl) => {
    if (K.vc) { const geo = fit(bake(gl.scene, true), K), c = geo.attributes.color; for (let k = 0; k < c.array.length; k++) c.array[k] *= 0.82; return { geo, mat: (vcMat ||= wettable(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { dark: 0.66, gloss: 0.3 })) }; }   // (a palette pale in our light, as the logs in harvest.js)
    let src = null; gl.scene.traverse((m) => { if (m.isMesh && !src) src = m.material; }); return { geo: fit(bake(gl.scene), K), mat: matFor(src) };
  });
  return Promise.all(pieces.filter((p) => KIT[p.id]).map((p) => Promise.all([KIT[p.id], KIT[p.id].trim].filter(Boolean).map(look)).then((m) => { p.meshes = m; }).catch(() => {})))
    .then(() => { const d = pieces.find((p) => p.id === 'door'), f = pieces.find((p) => p.id === 'doorframe'); if (d?.meshes && f?.meshes) hang(d.meshes[0].geo, f.meshes[0].geo, d.door.hinge); });
}
