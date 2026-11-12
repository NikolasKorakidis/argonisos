// Trees, rocks, shrubs and ruins from the team's packs (tools/assets: low-poly nature and Ancient Empire, their atlas
// colours baked into the vertices so they share the carved species' one material, wind and impostors). Each takes its
// carved species' place, fitted to the carved one's size (the same height for a tree, the same bulk for the rest) and
// standing on its foot, so colliders, woods rules and the mist's reach stay as they were. Loaded before the vegetation
// starts (main.js); a species without one, or a missing pack, keeps its carved look.
import * as THREE from 'three';
import { loadPack, bake } from '../assets.js';
import { SPECIES } from './flora.js';

const LIST = {
  olive: ['fl_olive0'],
  oak: ['fl_oak0', 'fl_oak1'],
  cypress: ['fl_cypress0', 'fl_cypress1'],
  pomegranate: ['fl_pomegranate0', 'fl_pomegranate1'],
  fig: ['fl_fig0', 'fl_fig1'],
  plane: ['fl_plane0', 'fl_plane1'],
  qtree: ['fl_qtree0', 'fl_qtree1'],
  qpine: ['fl_qpine0', 'fl_qpine1', 'fl_qpine2'],
  fir: ['fl_fir0'],
  holm: ['fl_holm0'],
  qdead: ['fl_qdead0'],
  dead: ['fl_dead0'],
  rock: ['fl_rock0', 'fl_rock1', 'fl_rock2', 'fl_rock3'],
  boulder: ['fl_boulder0', 'fl_boulder1', 'fl_boulder2', 'fl_boulder3'],
  reeds: ['fl_reeds0', 'fl_reeds1', 'fl_reeds2', 'fl_reeds3', 'fl_reeds4', 'fl_reeds5'],
  myrtle: ['fl_myrtle0'],
  broom: ['fl_broom0'],
  redbush: ['fl_redbush0'],
  fern: ['fl_fern0', 'fl_fern1'],
  colfall: ['fl_colfall0', 'fl_colfall1', 'fl_colfall2'],
  colstand: ['fl_colstand0'],
  wallruin: ['fl_wallruin0', 'fl_wallruin1', 'fl_wallruin2', 'fl_wallruin3', 'fl_wallruin4'],
  amphorae: ['fl_amphorae0'],
  herm: ['fl_herm0', 'fl_herm1', 'fl_herm2'],
  lavender: ['fl_lavender0', 'fl_lavender1', 'fl_lavender2'],
  // the ground between (Patch 12): these keep the pack's own sizes
  flowers: ['fl_flowers0', 'fl_flowers1', 'fl_flowers2', 'fl_flowers3', 'fl_flowers4', 'fl_flowers5', 'fl_flowers6', 'fl_flowers7'],
  tallgrass: ['fl_tallgrass0', 'fl_tallgrass1', 'fl_tallgrass2'],
  bush: ['fl_bush0', 'fl_bush1', 'fl_bush2', 'fl_bush3'],
  mushrooms: ['fl_mushrooms0', 'fl_mushrooms1', 'fl_mushrooms2', 'fl_mushrooms3', 'fl_mushrooms4'],
  pebbles: ['fl_pebbles0', 'fl_pebbles1'],
  stump: ['fl_stump0', 'fl_stump1', 'fl_stump2', 'fl_stump3', 'fl_stump4'],
  log: ['fl_log0', 'fl_log1', 'fl_log2', 'fl_log3'],
  branch: ['fl_branch0', 'fl_branch1', 'fl_branch2'],
  roots: ['fl_roots0', 'fl_roots1', 'fl_roots2'],
  lilypads: ['fl_lilypads0', 'fl_lilypads1', 'fl_lilypads2'],
  swampgrass: ['fl_swampgrass0', 'fl_swampgrass1', 'fl_swampgrass2'],
  driftwood: ['fl_driftwood0', 'fl_driftwood1', 'fl_driftwood2'],
  moss: ['fl_moss0', 'fl_moss1', 'fl_moss2'],
};
// (the species converted with lighter versions too: fl_…_mid and fl_…_far, tools/assets manifest "mid" and "far")
const FAR = new Set(['olive', 'oak', 'cypress', 'pomegranate', 'fig', 'holm', 'plane', 'qtree', 'qpine', 'fir', 'dead', 'qdead', 'myrtle', 'broom', 'redbush', 'fern']);
const NATURAL = new Set(SPECIES.filter((s) => s.natural).map((s) => s.name));
// species → per model: its solid parts, vertex-coloured (geo), and the see-through ones that keep their texture (cards:
// leaf cards, fronds; drawn cut out on map, trees.js), each converted from the catalogue's export (tools/assets, "plant")
export const FLORA = {};
const isCard = (m) => m.material.name.startsWith('tex:');
const parts = (gl) => {
  let card = null; gl.scene.traverse((m) => { if (m.isMesh && isCard(m)) card ||= m.material; });
  return { geo: bake(gl.scene, true, (m) => !isCard(m)), cards: card && bake(gl.scene, false, (m) => m.material === card), map: card?.map };
};
// (and the trees' and shrubs' lighter versions: <file>_mid, the near band's further half (leaves thinned), and <file>_far,
// the mid band's, a few hundred triangles where the near one has thousands)
export function loadFlora() {
  const opt = (f) => loadPack(f).catch(() => null);
  return Promise.all(Object.entries(LIST).map(([sp, files]) => Promise.all(files.map((f) => Promise.all([loadPack(f), ...(FAR.has(sp) ? [opt(f + '_mid'), opt(f + '_far')] : [])]).then(([gl, mid, far]) => {
    const p = parts(gl);
    if (mid) { const q = parts(mid); p.mid = q.geo; p.midCards = q.cards; }
    if (far) { const q = parts(far); p.lo = q.geo; p.loCards = q.cards; }
    return p;
  }))).then((gs) => { FLORA[sp] = gs; }).catch(() => {})));
}
// Leaf patches whose lowest corner is under y taken out (cards come as loose triangles: a patch is the triangles that
// share corners)
function prune(g, y) {
  const P = g.attributes.position, n = P.count / 3, up = new Int32Array(n).map((_, i) => i), at = new Map();
  const find = (i) => { while (up[i] !== i) i = up[i] = up[up[i]]; return i; };
  for (let t = 0; t < n; t++) for (let k = 0; k < 3; k++) { const v = t * 3 + k, key = `${Math.round(P.getX(v) * 500)},${Math.round(P.getY(v) * 500)},${Math.round(P.getZ(v) * 500)}`, o = at.get(key);
    if (o === undefined) at.set(key, t); else up[find(t)] = find(o); }
  const low = new Float32Array(n).fill(Infinity);
  for (let t = 0; t < n; t++) { const r = find(t); for (let k = 0; k < 3; k++) low[r] = Math.min(low[r], P.getY(t * 3 + k)); }
  const keep = []; for (let t = 0; t < n; t++) if (low[find(t)] >= y) keep.push(t);
  if (keep.length === n) return g;
  const out = new THREE.BufferGeometry();
  for (const [name, a] of Object.entries(g.attributes)) { const w = a.itemSize, arr = new Float32Array(keep.length * 3 * w);
    keep.forEach((t, j) => arr.set(a.array.subarray(t * 3 * w, t * 3 * w + 3 * w), j * 3 * w)); out.setAttribute(name, new THREE.BufferAttribute(arr, w)); }
  return out;
}
// How high a pack tree's roots reach above its lowest point (in the model's own units). The packs' trees stand on roots
// splayed out like legs (tester, 12 Nov: "it's very disturbing"), and their trunks spread a long way down into them.
// Cut across in 1% slices of the height, a slice through the roots is a few thin legs far apart: little area for how far
// it reaches. Going up they close into one round trunk; the first slice whose area fills at least 0.36 of the circle
// round its widest point (the trunk's own girth, a little flared) is where the ground should meet it.
function rootTop(g, b, fx, fz) {
  const P = g.attributes.position, ix = g.index?.array, H = b.max.y - b.min.y, N = 30, r = new Float32Array(N), A = new Float32Array(N);
  const at = (t, k) => (ix ? ix[t * 3 + k] : t * 3 + k), v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()], e1 = new THREE.Vector3(), e2 = new THREE.Vector3(), nn = new THREE.Vector3(), pts = [];
  for (let t = 0, tc = (ix ? ix.length : P.count) / 3; t < tc; t++) {
    for (let k = 0; k < 3; k++) v[k].fromBufferAttribute(P, at(t, k));
    const lo = Math.min(v[0].y, v[1].y, v[2].y), hi = Math.max(v[0].y, v[1].y, v[2].y), s0 = Math.max(0, Math.ceil((lo - b.min.y) / (0.01 * H) - 0.5)); if (s0 >= N) continue;
    nn.crossVectors(e1.subVectors(v[1], v[0]), e2.subVectors(v[2], v[0]));
    for (let s = s0; s < N; s++) {
      const h = b.min.y + (s + 0.5) * 0.01 * H; if (h > hi) break; pts.length = 0;
      for (const [a, c] of [[0, 1], [1, 2], [2, 0]]) { const ya = v[a].y, yc = v[c].y; if ((ya - h) * (yc - h) > 0 || ya === yc) continue; const f = (h - ya) / (yc - ya); pts.push(v[a].x + (v[c].x - v[a].x) * f - fx, v[a].z + (v[c].z - v[a].z) * f - fz); }
      if (pts.length < 4) continue;
      r[s] = Math.max(r[s], Math.hypot(pts[0], pts[1]), Math.hypot(pts[2], pts[3]));
      // (the slice's area, by the divergence theorem: each cut edge adds ½ · length · its distance out along the face's normal)
      const dx = pts[2] - pts[0], dz = pts[3] - pts[1], L = Math.hypot(dx, dz); if (!L) continue; let nx = dz / L, nz = -dx / L; if (nx * nn.x + nz * nn.z < 0) { nx = -nx; nz = -nz; }
      A[s] += 0.5 * L * ((pts[0] + pts[2]) / 2 * nx + (pts[1] + pts[3]) / 2 * nz);
    }
  }
  for (let s = 0; s < N; s++) if (r[s] > 0 && A[s] >= 0.36 * Math.PI * r[s] * r[s]) return (s + 0.5) * 0.01 * H;
  return 0;
}
// variant v of a species, fitted into the carved one's place (box: the carved geometry's bounds), or at its own size:
// { geo, cards, map, mid, midCards, lo, loCards }
export function floraGeo(sp, v, box, tree) {
  const list = FLORA[sp]; if (!list) return null;
  const src = list[v % list.length], g = src.geo.clone(), parts = [g]; let c = src.cards?.clone(); if (c) parts.push(c);
  let mid = src.mid?.clone(), mc = src.midCards?.clone(), lo = src.lo?.clone(), lc = src.loCards?.clone();
  const others = () => [mid, mc, lo, lc].filter((q) => q && q.attributes.position.count);
  const b = new THREE.Box3(); for (const p of parts) { p.computeBoundingBox(); if (p.attributes.position.count) b.union(p.boundingBox); }
  const S = box.getSize(new THREE.Vector3()), s0 = b.getSize(new THREE.Vector3()); let k = NATURAL.has(sp) ? 1 : tree ? S.y / s0.y : S.length() / s0.length();
  // its foot: the middle of what's near the ground (a trunk, the base of a rock)
  const foot = g.attributes.position.count ? g : c, p = foot.attributes.position, lim = b.min.y + (b.max.y - b.min.y) * 0.06; let fx = 0, fz = 0, n = 0;
  for (let i = 0; i < p.count; i++) if (p.getY(i) <= lim) { fx += p.getX(i); fz += p.getZ(i); n++; }
  fx /= Math.max(n, 1); fz /= Math.max(n, 1);
  // A tree stands sunk into the ground up to where its roots close into the trunk (rootTop; at least as deep as the carved
  // one's roots went), the same for every version of it, so no band shows the legs; on a slope it sinks further (matrixOf)
  const roots = tree && g.attributes.position.count ? (src.roots ??= rootTop(src.geo, b, fx, fz)) : 0;
  const footY = (q) => (roots ? Math.min(box.min.y, -roots * q) : box.min.y);
  // A tree's crown starts above 1.5× the hero even at its smallest (Patch 4; tests/suites/woods.mjs), sunk as it stands.
  // The packs' trees branch low: such a one grows a little (up to a third), and the leaf patches still hanging under that
  // height go, as a tree's lowest boughs do (its branches stay; nothing is stretched, so trunks and roots keep their shapes).
  let need = -Infinity;
  if (tree && c) {
    const cc = c.boundingBox.min.y - b.min.y; need = 3 / SPECIES.find((s) => s.name === sp).s[0];
    // (the crown's foot, cc·k + footY(k), is the lower of two lines in k: both must clear the height)
    if (cc * k > 0.05 && cc > roots) k = Math.min(k * 1.33, Math.max(k, (need - box.min.y) / cc, need / (cc - roots)));
  }
  for (const q of [...parts, ...others()]) { q.translate(-fx, -b.min.y, -fz); q.scale(k, k, k); q.translate(0, NATURAL.has(sp) ? 0 : footY(k), 0); }   // (the lighter versions moved with it: the same pivot)
  if (need > -Infinity) { c = prune(c, need); if (mc) mc = prune(mc, need); if (lc) lc = prune(lc, need); }
  if (!g.attributes.position.count) { g.setAttribute('position', new THREE.Float32BufferAttribute(9, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(9, 3)); }   // (all cards: an empty trunk)
  // (a touch darker: the packs' palettes come out pale in our light)
  for (const q of [g, mid, lo].filter(Boolean)) { const col = q.attributes.color; if (col) for (let i = 0; i < col.array.length; i++) col.array[i] *= 0.82; }
  const has = (q) => (q?.attributes.position.count ? q : null);
  for (const q of [g, c, mid, mc, lo, lc].filter(has)) { q.computeBoundingBox(); q.computeBoundingSphere(); }
  return { geo: g, cards: has(c), map: src.map, mid: has(mid), midCards: has(mc), lo: has(lo), loCards: has(lc) };
}
