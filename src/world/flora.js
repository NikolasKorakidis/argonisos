// Where every tree and boulder stands. Pure and deterministic (seeded per 64 m cell), so the worker can lay out cells
// and the main thread always agrees on what is where: a tree chopped down is remembered by its cell and index.
//
// Pedias: open meadows with woods and orchards of broad, round-crowned trees (olive, oak, holm oak, pomegranate, fig, the
//         odd great plane tree): no cypresses or firs, whose tall, slim shapes belong to the hills (reviewer, Patch 20).
// Yleos:  dense dark forest of firs and cypresses, with figs among them, and clearings.
// Valtos: dead and drowned trees, cypresses, sparse.
import { heightAt, biomeWeights, fbm, hash2, slopeGrade, isRock, rockLimit, ROCK_GRADE, PEAK, routeAt } from './gen.js';
import { smooth } from '../util/math.js';
import { siteClear, ALL_SITES } from './sites.js';
import { RIVER, riverAt } from './river.js';

export const CELL = 64;
// species: name for the builder, scale range, collision radius (and height) per unit of scale; 'res' marks things you can harvest (trees give logs, rocks stone)
export const SPECIES = [
  { name: 'olive', s: [0.95, 1.25], res: 'tree', col: 0.5 },
  { name: 'oak', s: [0.95, 1.3], res: 'tree', col: 0.6 },
  { name: 'cypress', s: [0.85, 1.2], res: 'tree', col: 0.4 },
  { name: 'pomegranate', s: [0.9, 1.15], res: 'tree', col: 0.25 },
  { name: 'fig', s: [0.95, 1.2], res: 'tree', col: 0.3 },
  { name: 'plane', s: [1.0, 1.25], res: 'tree', col: 0.8 },
  { name: 'qtree', s: [0.95, 1.35], res: 'tree', col: 0.45 },
  { name: 'qpine', s: [0.9, 1.4], res: 'tree', col: 0.4 },
  { name: 'fir', s: [0.9, 1.35], res: 'tree', col: 0.4 },
  { name: 'holm', s: [0.95, 1.3], res: 'tree', col: 0.5 },
  { name: 'qdead', s: [0.85, 1.2], res: 'tree', col: 0.4 },
  { name: 'dead', s: [0.9, 1.2], res: 'tree', col: 0.4 },
  { name: 'rock', s: [0.5, 2.4], res: 'rock', col: 0.95, h: 0.85 },
  { name: 'boulder', s: [2.2, 4.5], res: 'rock', col: 0.95, h: 0.8 },
  { name: 'reeds', s: [0.8, 1.3], res: 'reed' },
  // (added later, at the end so the species numbers above never change) the old world between the trees: ruins you can
  // break up for stone, and the shrubs of a Greek hillside
  { name: 'colfall', s: [0.9, 1.15], res: 'rock', col: 1.0, h: 0.7 },
  { name: 'colstand', s: [0.85, 1.15], res: 'rock', col: 0.55, h: 3.2 },
  { name: 'herm', s: [0.95, 1.05], res: 'rock', col: 0.45, h: 1.7 },
  { name: 'amphorae', s: [0.9, 1.1], noShadow: true },
  { name: 'wallruin', s: [0.9, 1.15], res: 'rock', col: 1.1, h: 1.0 },
  { name: 'lavender', s: [0.8, 1.25], noShadow: true },
  { name: 'broom', s: [0.8, 1.25], noShadow: true },
  { name: 'myrtle', s: [0.8, 1.3], noShadow: true },
  // the giant forest: trunks like columns, a canopy thirty metres up, ferns beneath; and red-leaved bushes in the hills
  { name: 'titan', s: [0.9, 1.15], res: 'tree', col: 1.25 },
  { name: 'fern', s: [0.7, 1.05], noShadow: true },
  { name: 'redbush', s: [0.8, 1.2], noShadow: true },
  // (Patch 12, at the end again) what lies and grows between the trees: drifts of wildflowers and tall grass in the
  // meadows, leafy bushes along the woods' edges, the forest floor's stumps, fallen logs, branches, roots and mushrooms,
  // pebbles everywhere (on bare rock too), lily pads and sedge in the marsh, driftwood along the shore. n: how many
  // looks each has; natural: the pack's model keeps its own size (flora-pack.js)
  { name: 'flowers', s: [1.0, 1.5], noShadow: true, natural: true, n: 8 },
  { name: 'tallgrass', s: [0.8, 1.25], noShadow: true, natural: true, n: 3 },
  { name: 'bush', s: [0.65, 1.0], natural: true, n: 4 },
  { name: 'mushrooms', s: [0.8, 1.4], noShadow: true, natural: true, n: 5 },   // (no longer laid out, Patch 20: kept so the species after it keep their numbers)
  { name: 'pebbles', s: [0.8, 1.7], noShadow: true, natural: true, n: 2 },
  { name: 'stump', s: [0.8, 1.2], col: 0.4, h: 0.7, natural: true, n: 5 },
  { name: 'log', s: [0.7, 1.0], col: 0.5, h: 0.9, natural: true, n: 4 },
  { name: 'branch', s: [0.8, 1.3], noShadow: true, natural: true, n: 3 },
  { name: 'roots', s: [0.7, 1.1], noShadow: true, natural: true, n: 3 },
  { name: 'lilypads', s: [0.7, 1.2], noShadow: true, natural: true, n: 3 },
  { name: 'swampgrass', s: [0.6, 1.0], noShadow: true, natural: true, n: 3 },
  { name: 'driftwood', s: [0.8, 1.2], natural: true, n: 3 },
  // (Patch 13) moss mounds in the forest's shade and on the marsh's banks
  { name: 'moss', s: [0.7, 1.2], noShadow: true, natural: true, n: 3 },
  // (Patch 20) tomato bushes in the meadows: picked for tomatoes (harvest.js), when variant 1, the same bush without its
  // fruit, stands in its place until they have grown back
  { name: 'tomato', s: [0.85, 1.15], natural: true, n: 1 },
];
export const SP = Object.fromEntries(SPECIES.map((s, i) => [s.name, i]));
// (reviewer, Patch 20: the meadows' cypresses gave way to the broad trees about them, and the hills keep only firs,
// cypresses and figs. The weights alone changed: each tree's dice are as before, so the woods stand where they stood)
const MIX = {
  grove: [['olive', 46], ['pomegranate', 32], ['fig', 13], ['oak', 9]],                                        // orchard islands
  wood: [['oak', 38], ['plane', 18], ['olive', 14], ['holm', 15], ['qtree', 12], ['pomegranate', 3]],           // the woods of the meadows
  forest: [['fir', 52], ['cypress', 30], ['fig', 18]],
  swamp: [['dead', 45], ['qdead', 30], ['cypress', 25]],
  // (Patch 24) Olympos's own, by height: holm oaks, olives and cypresses on its lower slopes, then the pines and firs
  mtnLow: [['holm', 32], ['olive', 20], ['cypress', 22], ['qpine', 14], ['fir', 12]],
  mtnPine: [['qpine', 58], ['fir', 42]],
};
// How much of Olympos a point is (1 on the mountain, 0 off it): its own trees, shrubs, rocks and scree (mountainCover)
export const mtnK = (x, z) => (PEAK.on ? smooth(PEAK.r * 0.92, PEAK.r * 0.72, Math.hypot(x - PEAK.x, z - PEAK.z)) : 0);
const WOOD_THIN = 0.18;   // (with the lone trees and pairs that then go as well, a fifth fewer in all)
const pick = (mix, r) => { let t = 0; for (const [, w] of mix) t += w; let a = r * t; for (const [n, w] of mix) { a -= w; if (a <= 0) return SP[n]; } return SP[mix[0][0]]; };

// Trees per square metre at a point (0 where nothing can grow)
// Where the giant forest stands: long stretches of the belt where the meadows give way to the forested hills
const _tw = { p: 0, y: 0, v: 0, r: 0 };
export function titanBand(x, z, w = biomeWeights(x, z, _tw)) {
  const edge = smooth(0.1, 0.32, w.y) * smooth(0.86, 0.62, w.y) * (1 - w.v);
  return edge * smooth(0.44, 0.58, fbm(x * 0.0016 + 77, z * 0.0016 - 31, 3));
}
// The woods of Pedias (tester feedback, 15 and 16 Oct): trees grow in woods, never scattered over the meadows, and the
// woods cover about 70% of the plain, so there is more wood than clearing. Ragged edges everywhere (noise whose
// coordinates are warped by other noise): wide woods thicker along the hillsides, open clearings of every size between
// them, and in the clearings small islands 25-55 m across (orchards: olive, pomegranate, fig).
// The trial's places stand in glades of their own (a ragged ring GLADE m past their pad), so they can be seen from the
// edge of the wood. Returns { wood: 0..1 (how deep in a wood), orchard: whether a small island }.
const _pw = { wood: 0, orchard: false }, GLADE = { temple: 45, house: 30, labyrinth: 50, chimera: 40, olive: 14 };
let glades = null;
function glade(x, z) {
  glades ||= ALL_SITES().filter((s) => GLADE[s.kind]).map((s) => [s.x, s.z, s.r + GLADE[s.kind]]);
  let k = 1; for (const [gx, gz, r] of glades) { const d = Math.hypot(x - gx, z - gz) - r; if (d < 30) k = Math.min(k, smooth(-10, 25, d + (fbm(x * 0.03 + 5, z * 0.03, 2) - 0.5) * 24)); }
  return k;
}
export function pediasWood(x, z, out = _pw) {
  const wx = x + (fbm(x * 0.004 + 11, z * 0.004 - 7, 2) - 0.5) * 160, wz = z + (fbm(x * 0.004 - 23, z * 0.004 + 5, 2) - 0.5) * 160;
  const g = slopeGrade(x, z), hill = smooth(0.1, 0.3, g) * smooth(ROCK_GRADE, ROCK_GRADE - 0.1, g);
  const big = smooth(0.43, 0.5, fbm(wx * 0.0042 + 3, wz * 0.0042 - 9, 3) + hill * 0.08), small = smooth(0.7, 0.75, fbm(wx * 0.019 - 41, wz * 0.019 + 13, 2)) * 0.9;
  const gl = glade(x, z); out.wood = Math.max(big, small) * gl; out.orchard = small > big; return out;
}
export function treeDensity(x, z, h, w) {
  if (h < 1.6 && w.v < 0.5) return 0;
  if (h > 150) { const m = mtnK(x, z); return smooth(205 + 95 * m, 150, h) * (1 - 0.3 * m) * treeDensity(x, z, 140, w); }   // the treeline on Olympos (on its shoulders the pines go higher, thinning out)
  // in a wood the crowns stand close enough to read as one mass from afar, a little thinner and more varied at the edges
  const pw = w.p > 0.05 ? pediasWood(x, z).wood : 0, pedias = pw * (1 / 34) * (0.75 + 0.5 * fbm(x * 0.05 + 7, z * 0.05 - 2, 2));
  const clearing = smooth(0.38, 0.28, fbm(x * 0.01 - 3, z * 0.01 + 6, 3));      // forest glades
  const yleos = (1 / 38) * (1 - clearing * 0.9);
  const valtos = 1 / 160;
  return w.p * pedias + w.y * yleos + w.v * valtos;
}
// Lay out one cell: returns a flat Float32Array of [species, variant, x, y, z, rotY, scale] per item. Trees are kept out of
// rocks and boulders (their own cell's and the neighbours'): one standing in a rock is moved just clear of it, staying in
// its cell and keeping its place in the list (felled trees are remembered by index); if it can't, it isn't drawn.
// In the meadows no tree stands alone, nor in a pair: first a tree with fewer than four others within 11 m goes, then
// (counting only the trees that are left) one with fewer than two. Trees that go keep their place in the list, so felled
// trees stay remembered by index.
const isMeadowTree = (it, o, w) => SPECIES[it[o]].res === 'tree' && biomeWeights(it[o + 2], it[o + 4], w).p >= 0.5;
const reach2 = (it, o) => (it[o] === SP.titan ? 484 : 121);   // (the giants stand ~13 m apart: their neighbours within 22 m)
const KEPT = new Map(), _lw = { p: 0, y: 0, v: 0, r: 0 };
function count(list, x, z, upTo, r2 = 121) { let n = 0; for (let k = 0; k < list.length && n < upTo; k += 2) { const dx = list[k] - x, dz = list[k + 1] - z; if (dx * dx + dz * dz < r2) n++; } return n; }
function treesOf(cx, cz, pass, others) {   // [x, z, ...] of the trees around a cell: as first laid out (pass 0), those the first pass keeps (pass 1), or those once moved clear of the rocks (pass 2); others: only the neighbours'
  const out = []; for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { if (others && !i && !j) continue; const it = pass === 2 ? pushed(cx + i, cz + j) : pass ? kept1(cx + i, cz + j) : rawCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) if (SPECIES[it[o]].res === 'tree' && it[o + 6] > 0 && (pass || !isRock(it[o + 2], it[o + 4]))) out.push(it[o + 2], it[o + 4]); }   // (a tree on bare rock won't stand: it doesn't count)
  return out;
}
function kept1(cx, cz) {
  const k = cx + ',' + cz; let r = KEPT.get(k); if (r) return r;
  r = rawCell(cx, cz).slice(); const near = treesOf(cx, cz, 0);
  for (let o = 0; o < r.length; o += STRIDE) if (isMeadowTree(r, o, _lw) && (isRock(r[o + 2], r[o + 4]) || count(near, r[o + 2], r[o + 4], 5, reach2(r, o)) < 5)) r[o + 6] = 0;   // (itself and four)
  KEPT.set(k, r); if (KEPT.size > 160) KEPT.delete(KEPT.keys().next().value); return r;
}
export function layoutCell(cx, cz) {
  const it = pushed(cx, cz).slice(), near = treesOf(cx, cz, 2, true);
  // (itself and two. Counted again until none goes: a tree that goes can leave another alone, which in thinner woods, a
  // fifth fewer since Patch 20, left the odd tree standing on its own. Counted once the trees have been moved out of the
  // rocks, and those that couldn't be have gone, its neighbours' too: counted before, a tree that then went for a rock
  // could leave a pair, Patch 24)
  for (let again = true; again;) { again = false; const own = []; for (let o = 0; o < it.length; o += STRIDE) if (SPECIES[it[o]].res === 'tree' && it[o + 6] > 0) own.push(it[o + 2], it[o + 4]);
    for (let o = 0; o < it.length; o += STRIDE) if (it[o + 6] > 0 && isMeadowTree(it, o, _lw) && count(near, it[o + 2], it[o + 4], 3, reach2(it, o)) + count(own, it[o + 2], it[o + 4], 3, reach2(it, o)) < 3) { it[o + 6] = 0; again = true; } }
  return it;
}
// a cell's trees after the first pass, moved just clear of the rocks (and gone where they can't be, or under the giants)
const PUSHED = new Map();
function pushed(cx, cz) {
  const key = cx + ',' + cz; let r = PUSHED.get(key); if (r) return r;
  const it = kept1(cx, cz).slice(), rocks = rocksAround(cx, cz), x0 = cx * CELL, z0 = cz * CELL;
  for (let i = 0; i < it.length; i += STRIDE) {
    const sp = SPECIES[it[i]]; if (sp.res !== 'tree' || it[i] === SP.titan) continue;
    if (titanBand(it[i + 2], it[i + 4]) > 0.35 && hash2(cx * 131 + i, cz * 977 - i) < 0.75) { it[i + 6] = 0; continue; }   // the giants' shade: the understory thins out
    const tr = sp.col * it[i + 6];
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (let k = 0; k < rocks.length; k += 3) {
        const dx = it[i + 2] - rocks[k], dz = it[i + 4] - rocks[k + 1], d = Math.hypot(dx, dz), need = rocks[k + 2] + tr + 0.3;
        if (d >= need) continue;
        const a = d > 1e-3 ? Math.atan2(dz, dx) : hash2(i, k) * 6.283;
        it[i + 2] = Math.min(x0 + CELL - 0.05, Math.max(x0 + 0.05, rocks[k] + Math.cos(a) * need));
        it[i + 4] = Math.min(z0 + CELL - 0.05, Math.max(z0 + 0.05, rocks[k + 1] + Math.sin(a) * need)); moved = true;
      }
      if (!moved) break;
    }
    if (obstructed(rocks, it[i + 2], it[i + 4], tr) || isRock(it[i + 2], it[i + 4])) it[i + 6] = 0;   // nowhere to go in its cell (or pushed onto bare rock)
    else it[i + 3] = heightAt(it[i + 2], it[i + 4]) - 0.05;
  }
  PUSHED.set(key, it); if (PUSHED.size > 160) PUSHED.delete(PUSHED.keys().next().value); return it;
}
const obstructed = (list, x, z, r) => { for (let k = 0; k < list.length; k += 3) if (Math.hypot(x - list[k], z - list[k + 1]) < list[k + 2] + r + 0.25) return true; return false; };
// raw layouts, cached (neighbouring cells are asked for again and again)
const RAW = new Map();
function rawCell(cx, cz) {
  const k = cx + ',' + cz; let r = RAW.get(k);
  if (!r) { r = layoutRaw(cx, cz); RAW.set(k, r); if (RAW.size > 160) RAW.delete(RAW.keys().next().value); }
  return r;
}
// rocks and boulders in a cell and its eight neighbours, as a flat [x, z, radius, ...]
function rocksAround(cx, cz) {
  const out = [];
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const it = rawCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]]; if (sp.res === 'rock' || it[o] === SP.titan) out.push(it[o + 2], it[o + 4], sp.col * it[o + 6] + (it[o] === SP.titan ? 1.2 : 0)); } }
  return out;
}
// everything solid around a cell (rocks and tree trunks where they finally stand), for things laid out on the ground
const SOLID = new Map();
export function solidsAround(cx, cz) {
  const k = cx + ',' + cz; let out = SOLID.get(k); if (out) return out;
  out = rocksAround(cx, cz);
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const it = layoutCell(cx + i, cz + j); for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]]; if (sp.res === 'tree' && it[o + 6] > 0) out.push(it[o + 2], it[o + 4], sp.col * it[o + 6]); } }
  SOLID.set(k, out); if (SOLID.size > 80) SOLID.delete(SOLID.keys().next().value);
  return out;
}
export const insideSolid = (list, x, z, r) => obstructed(list, x, z, r);
// What shades the ground in a rectangle (for the terrain and grass to bake in): [x, z, radius, strength, ...] for every
// tree (a canopy-sized pool of shade), giant (a wide, deep one), rock and ruin (a tight one at its foot)
export function shadeAround(x0, z0, x1, z1) {
  const out = [];
  for (let cz = Math.floor((z0 - 12) / CELL); cz <= Math.floor((z1 + 12) / CELL); cz++) for (let cx = Math.floor((x0 - 12) / CELL); cx <= Math.floor((x1 + 12) / CELL); cx++) {
    const it = layoutCell(cx, cz);
    for (let o = 0; o < it.length; o += STRIDE) { const sp = SPECIES[it[o]], s = it[o + 6]; if (s <= 0 || !sp.res) continue;
      if (it[o] === SP.titan) out.push(it[o + 2], it[o + 4], 10 * s, 0.45);
      else if (sp.res === 'tree') out.push(it[o + 2], it[o + 4], 1.6 + sp.col * s * 3.4, 0.3);
      else if (sp.res === 'rock') out.push(it[o + 2], it[o + 4], 0.6 + sp.col * s * 1.25, 0.32); }
  }
  return out;
}
// add up the shade from such a list over a grid (x0, z0, cell size k, nx × nz), into occ[]
export function bakeShade(list, x0, z0, k, nx, nz, occ) {
  for (let t = 0; t < list.length; t += 4) {
    const x = list[t], z = list[t + 1], R = list[t + 2], S = list[t + 3];
    const i0 = Math.max(0, Math.floor((x - R - x0) / k)), i1 = Math.min(nx - 1, Math.ceil((x + R - x0) / k)), j0 = Math.max(0, Math.floor((z - R - z0) / k)), j1 = Math.min(nz - 1, Math.ceil((z + R - z0) / k));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = x0 + i * k - x, dz = z0 + j * k - z, q = (dx * dx + dz * dz) / (R * R); if (q < 1) occ[j * nx + i] += S * (1 - q) * (1 - q); }
  }
}
function layoutRaw(cx, cz) {
  const out = [], x0 = cx * CELL, z0 = cz * CELL, STEP = 4, w = { p: 0, y: 0, v: 0, r: 0 };
  let k = 0;
  const rnd = () => hash2(cx * 7919 + (k++), cz * 104729 - k * 31);
  for (let j = 0; j < CELL / STEP; j++) for (let i = 0; i < CELL / STEP; i++) {
    const x = x0 + (i + rnd()) * STEP, z = z0 + (j + rnd()) * STEP, h = heightAt(x, z), r1 = rnd(), r2 = rnd(), r3 = rnd(), r4 = rnd();
    if (siteClear(x, z)) continue;
    biomeWeights(x, z, w);
    // reeds fringe the marsh pools and the low shores
    if (h > -0.5 && h < 1.4 && r1 < w.v * 0.09 * STEP * STEP / 4) { out.push(SP.reeds, Math.floor(r4 * 3), x, h, z, r3 * 6.283, 0.8 + r2 * 0.5); continue; }
    if (h < (w.v > 0.5 ? -0.25 : 0.6)) continue;
    const slope = slopeGrade(x, z);
    // boulders and rocks: more on slopes and in the hills (not on Olympos, whose own lie where its rock falls, laid out in
    // mountainCover: the scatter's dice are still thrown there, so nothing after them moves)
    if (r1 < (1 / 1100 + slope * 0.006 + w.y * 0.0012) * STEP * STEP) {
      const big = r2 < 0.12 + w.y * 0.1, sp = big ? SP.boulder : SP.rock, S = SPECIES[sp].s, sc = S[0] + (S[1] - S[0]) * rnd();
      if (mtnK(x, z) * 2 < r4) out.push(sp, Math.floor(r3 * 3), x, h, z, r4 * 6.283, sc); continue;
    }
    if (slope > rockLimit(x, z)) continue;   // bare rock: nothing grows (the shared slope rule, see gen.js)
    const d = treeDensity(x, z, h, w); if (r2 >= d * STEP * STEP) continue;
    const mix = w.v > 0.5 ? MIX.swamp : mtnK(x, z) > 0.5 ? (h + (hash2(cx * 16 + i + 911, cz * 16 + j - 577) - 0.5) * 40 < 140 ? MIX.mtnLow : MIX.mtnPine) : w.y > w.p ? MIX.forest : pediasWood(x, z).orchard ? MIX.grove : MIX.wood;
    const sp = pick(mix, r3), S = SPECIES[sp].s, rot = rnd() * 6.283, sc = S[0] + (S[1] - S[0]) * rnd();
    // (a fifth fewer trees in the meadows' woods and orchards, reviewer, Patch 20: each goes by a die of its own, thrown
    // for its place on the grid, after the shared dice have all been drawn, so every other tree keeps its place and look)
    if ((mix === MIX.wood || mix === MIX.grove) && hash2(cx * 16 + i + 40503, cz * 16 + j - 27011) < WOOD_THIN) continue;
    out.push(sp, Math.floor(r4 * 3), x, h - 0.05, z, rot, sc);
  }
  // the old world between the trees: Mediterranean shrubs, and here and there a ruin (a fallen column, a herm by the way,
  // a stub of wall, a cache of jars). Laid out last, with dice of their own, so nothing laid out before them moves.
  { const cw = biomeWeights(x0 + 32, z0 + 32, { p: 0, y: 0, v: 0, r: 0 }), h2 = (k) => hash2(cx * 7907 + Math.round(k * 1000), cz * 104723 + Math.round(k * 7919) + 3);   // (the hash takes whole numbers)
    const place = (k) => { const x = x0 + h2(k) * CELL, z = z0 + h2(k + 0.5) * CELL, h = heightAt(x, z); if (h < 1.6 || siteClear(x, z)) return null; return isRock(x, z) ? null : { x, z, h }; };   // (nothing on bare rock)
    if (cw.v < 0.4) {
      const n = Math.round(cw.p * 16 + cw.y * 5);
      for (let k = 0; k < n; k++) { const q = place(k * 2 + 1); if (!q) continue; const r = h2(k * 2 + 1.3), mt = mtnK(q.x, q.z) > 0.5; if (mt && q.h > 300) continue;   // (on Olympos myrtle low down, broom higher, nothing over the turf)
        const sp = mt ? (q.h > 190 || r < 0.35 ? SP.broom : SP.myrtle) : cw.p > cw.y ? (r < 0.42 ? SP.lavender : r < 0.58 ? SP.broom : SP.myrtle) : SP.myrtle, S = SPECIES[sp].s;
        out.push(sp, 0, q.x, q.h - 0.05, q.z, h2(k + 7) * 6.283, S[0] + (S[1] - S[0]) * h2(k + 9)); }
      if (h2(99) < cw.p * 0.4 + cw.y * 0.12) { const q = place(101); if (q) { const r = h2(103), sp = cw.y > cw.p ? (r < 0.6 ? SP.colfall : SP.wallruin) : r < 0.28 ? SP.colfall : r < 0.46 ? SP.colstand : r < 0.66 ? SP.herm : r < 0.82 ? SP.amphorae : SP.wallruin, S = SPECIES[sp].s;
        out.push(sp, Math.floor(h2(105) * 2), q.x, q.h - 0.04, q.z, h2(107) * 6.283, S[0] + (S[1] - S[0]) * h2(109)); } }
    }
    // the giant forest: one great tree in every 13 m square where the band is strong, ferns underneath
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const k = 200 + j * 5 + i, x = x0 + (i + 0.2 + h2(k) * 0.6) * 12.8, z = z0 + (j + 0.2 + h2(k + 0.5) * 0.6) * 12.8, b = titanBand(x, z);
      if (b < 0.15 || h2(k + 0.25) > b * 1.1) continue; const h = heightAt(x, z); if (h < 2 || h > 140 || siteClear(x, z) || isRock(x, z)) continue;
      const S = SPECIES[SP.titan].s; out.push(SP.titan, Math.floor(h2(k + 0.75) * 3), x, h - 0.3, z, h2(k + 0.6) * 6.283, S[0] + (S[1] - S[0]) * h2(k + 0.7));
    }
    const bc = titanBand(x0 + 32, z0 + 32), nf = Math.round(bc * 26 + cw.y * (1 - bc) * 6);
    for (let k = 0; k < nf; k++) { const q = place(400 + k * 2); if (!q || q.h > 160) continue; const S = SPECIES[SP.fern].s; out.push(SP.fern, 0, q.x, q.h - 0.05, q.z, h2(401 + k * 2) * 6.283, S[0] + (S[1] - S[0]) * h2(402 + k * 2)); }
    if (cw.y > 0.3 && cw.v < 0.3) for (let k = 0; k < 3; k++) { if (h2(500 + k) > cw.y * 0.5) continue; const q = place(510 + k * 2); if (!q || q.h > 160) continue; const S = SPECIES[SP.redbush].s; out.push(SP.redbush, 0, q.x, q.h - 0.05, q.z, h2(511 + k) * 6.283, S[0] + (S[1] - S[0]) * h2(512 + k)); }
    groundCover(out, x0, z0, cw, bc, h2);
    if (PEAK.on && Math.hypot(x0 + 32 - PEAK.x, z0 + 32 - PEAK.z) < PEAK.r * 0.92 + 46) mountainCover(out, x0, z0, h2);
    if (RIVER.on && x0 + CELL > RIVER.box[0] && x0 < RIVER.box[1] && z0 + CELL > RIVER.box[2] && z0 < RIVER.box[3]) riverCover(out, x0, z0, h2);
  }
  return new Float32Array(out);
}
// The ground between (Patch 12, made to fit each place in Patch 13), laid out after everything else in the cell with dice
// of its own (k from 1000), so nothing laid out before it moves. Each thing goes by the land where it stands (its own
// biome, how deep in a wood), not its cell's, and each land has its own: the meadows' wildflowers in drifts of one kind,
// a stretch of a few hundred metres having its own (poppies here, lavender or anemones there), with tussocks of tall grass
// and round bushes along the woods' edges, and now and then a tomato bush; the forest's leafy undergrowth, stumps, fallen
// logs, branches, roots and moss at the feet of the trees (the mushrooms that grew there went in Patch 20); the marsh's
// water lilies on the pools, moss on the banks and drowned logs; driftwood on the shore; pebbles everywhere, and scree on
// bare rock (only stones lie on rock). Big pieces keep clear of the rocks and trunks laid out before them.
const FLOWER_KINDS = [[0, 1], [2, 3], [4, 5], [6], [7]];   // (flowers' looks by kind: red and gold, anemones, lavender, crown daisies, poppies)
const BUSH = { meadow: [0, 1, 0, 1, 2, 3], forest: [2, 3] };
function groundCover(out, x0, z0, cw, bc, h2) {
  const lay = (sp, k, x, y, z, v) => { const S = SPECIES[sp].s; out.push(sp, v ?? Math.floor(h2(k + 0.11) * SPECIES[sp].n), x, y, z, h2(k + 0.37) * 6.283, S[0] + (S[1] - S[0]) * h2(k + 0.53)); };
  const at = (k, R, cx, cz) => { const a = h2(k) * 6.283, d = R * Math.sqrt(h2(k + 0.5)); return [cx + Math.cos(a) * d, cz + Math.sin(a) * d]; };   // (somewhere within R of a point)
  const spot = (k) => [x0 + h2(k) * CELL, z0 + h2(k + 0.5) * CELL];
  const dry = (x, z, rockOK) => { if (x < x0 || x >= x0 + CELL || z < z0 || z >= z0 + CELL) return null; const h = heightAt(x, z); return h < 1.6 || h > 175 || siteClear(x, z) || (!rockOK && isRock(x, z)) ? null : h; };
  const clear = (x, z, r) => { for (let o = 0; o < out.length; o += STRIDE) { const sp = SPECIES[out[o]]; if ((sp.res === 'rock' || sp.res === 'tree') && Math.hypot(out[o + 2] - x, out[o + 4] - z) < sp.col * out[o + 6] + r) return false; } return true; };
  const bw = { p: 0, y: 0, v: 0, r: 0 }, land = (x, z) => biomeWeights(x, z, bw), wood = (x, z) => pediasWood(x, z).wood;
  const meadow = (x, z, h) => h < 120 && land(x, z).p > 0.6 && bw.v < 0.2, forest = (x, z) => land(x, z).y > 0.45 && bw.v < 0.3;
  const one = (list, r) => list[Math.min(list.length - 1, Math.floor(r * list.length))];
  if (cw.p > 0.2 && cw.v < 0.4) {
    // which flower a stretch of meadow is full of: one die per ragged patch of ~150 m
    const kindAt = (x, z) => FLOWER_KINDS[Math.floor(hash2(Math.floor((x + (fbm(x * 0.006, z * 0.006 + 9, 2) - 0.5) * 120) / 150) + 811, Math.floor((z + (fbm(x * 0.006 - 4, z * 0.006, 2) - 0.5) * 120) / 150) - 307) * FLOWER_KINDS.length)];
    for (let d = 0; d < Math.round(cw.p * 5); d++) {   // flower drifts: out in the open, or in a clearing
      const k = 1000 + d * 40, [cx, cz] = spot(k), kind = kindAt(cx, cz), h0 = dry(cx, cz);
      if (h0 === null || !meadow(cx, cz, h0) || wood(cx, cz) > 0.5) continue;
      for (let f = 0; f < 10 + Math.floor(h2(k + 2) * 14); f++) { const [x, z] = at(k + 3 + f * 0.7, 8, cx, cz), h = dry(x, z); if (h !== null && meadow(x, z, h)) lay(SP.flowers, k + 3 + f * 0.7 + 0.2, x, h - 0.04, z, h2(k + 3.45 + f * 0.7) < 0.8 ? one(kind, h2(k + 3.9 + f * 0.7)) : undefined); }
    }
    for (let f = 0; f < Math.round(cw.p * 14); f++) { const k = 1260 + f, [x, z] = spot(k), h = dry(x, z); if (h !== null && meadow(x, z, h) && wood(x, z) < 0.6) lay(SP.flowers, k, x, h - 0.04, z, h2(k + 0.7) < 0.7 ? one(kindAt(x, z), h2(k + 0.8)) : undefined); }   // and here and there one on its own
    for (let g = 0; g < Math.round(cw.p * 5); g++) {   // tussocks of tall grass, thicker towards the woods
      const k = 1200 + g * 10, [cx, cz] = spot(k), h0 = dry(cx, cz); if (h0 === null || !meadow(cx, cz, h0) || wood(cx, cz) > 0.85) continue;
      for (let t = 0; t < 3 + Math.floor(h2(k + 1) * 5 + wood(cx, cz) * 3); t++) { const [x, z] = at(k + 2 + t * 0.9, 2.6, cx, cz), h = dry(x, z); if (h !== null) lay(SP.tallgrass, k + 2.3 + t * 0.9, x, h - 0.04, z); }
    }
    for (let b = 0; b < Math.round(cw.p * 9); b++) { const k = 1300 + b, [x, z] = spot(k), h = dry(x, z); if (h === null || !meadow(x, z, h)) continue; const w = wood(x, z);   // (the woods' edges)
      if (w > 0.2 && w < 0.7 && clear(x, z, 1.6)) lay(SP.bush, k, x, h - 0.08, z, one(BUSH.meadow, h2(k + 0.2))); }
  }
  if (cw.y > 0.25 && cw.v < 0.4) {
    const n = (a, b2) => Math.round(cw.y * a + bc * b2);
    const trees = []; for (let o = 0; o < out.length; o += STRIDE) if (SPECIES[out[o]].res === 'tree') trees.push(out[o + 2], out[o + 4]);
    const byTree = (k, R) => { if (!trees.length) return [NaN, NaN]; const t = Math.floor(h2(k + 0.9) * trees.length / 2) * 2; return at(k, R, trees[t], trees[t + 1]); };
    for (let b = 0; b < n(7, 3); b++) { const k = 1400 + b, [x, z] = h2(k + 0.3) < 0.6 ? byTree(k, 4) : spot(k), h = dry(x, z); if (h !== null && h < 150 && forest(x, z) && clear(x, z, 0.8)) lay(SP.bush, k + 0.1, x, h - 0.06, z, one(BUSH.forest, h2(k + 0.2))); }   // the undergrowth
    for (let i = 0; i < n(4, 2); i++) { const k = 1500 + i, [x, z] = spot(k), h = dry(x, z); if (h !== null && forest(x, z) && clear(x, z, 0.6)) lay(SP.stump, k, x, h - 0.06, z); }
    for (let i = 0; i < n(2.2, 2); i++) { const k = 1550 + i, [x, z] = spot(k), h = dry(x, z); if (h !== null && h < 150 && forest(x, z) && clear(x, z, 3)) lay(SP.log, k, x, h - 0.12, z); }
    for (let i = 0; i < n(9, 4); i++) { const k = 1600 + i, [x, z] = spot(k), h = dry(x, z); if (h !== null && forest(x, z)) lay(SP.branch, k, x, h - 0.03, z); }
    for (let i = 0; i < n(3, 6); i++) { const k = 1650 + i, [x, z] = byTree(k, 2.5), h = dry(x, z); if (h !== null && forest(x, z)) lay(SP.roots, k, x, h - 0.05, z); }
    for (let i = 0; i < n(4, 3); i++) { const k = 1680 + i, [x, z] = byTree(k, 3.5), h = dry(x, z); if (h !== null && h < 150 && forest(x, z)) lay(SP.moss, k, x, h - 0.12, z); }   // (moss in the trees' shade)
  }
  if (cw.p > 0.2 && cw.y < 0.25) { const k = 1560, [x, z] = spot(k), h = dry(x, z); if (h !== null && wood(x, z) > 0.5 && clear(x, z, 0.6)) lay(SP.stump, k, x, h - 0.06, z); }   // (now and then a stump in the meadows' woods)
  for (let i = 0; i < 3 + (cw.y > 0.3 ? 2 : 0); i++) { const k = 1800 + i, [x, z] = spot(k), h = dry(x, z, true); if (h !== null) lay(SP.pebbles, k, x, h - 0.03, z); }
  for (let i = 0; i < 6; i++) { const k = 1820 + i, [x, z] = spot(k); if (!isRock(x, z)) continue; const h = dry(x, z, true); if (h !== null) lay(SP.pebbles, k, x, h - 0.03, z); }   // (scree on the rocky slopes)
  if (cw.v > 0.3) {
    for (let i = 0; i < Math.round(cw.v * 10); i++) { const k = 1900 + i, [x, z] = spot(k), h = heightAt(x, z); if (h > -1.4 && h < -0.25 && land(x, z).v > 0.4 && !siteClear(x, z)) lay(SP.lilypads, k, x, 0.03, z); }   // (afloat on the pools)
    for (let i = 0; i < Math.round(cw.v * 16); i++) { const k = 1950 + i, [x, z] = spot(k), h = heightAt(x, z); if (h > -0.4 && h < 1.5 && land(x, z).v > 0.3 && !siteClear(x, z)) lay(SP.swampgrass, k, x, h - 0.1, z); }
    for (let i = 0; i < Math.round(cw.v * 6); i++) { const k = 1970 + i, [x, z] = spot(k), h = heightAt(x, z); if (h > 0.1 && h < 2.5 && land(x, z).v > 0.4 && !siteClear(x, z) && !isRock(x, z)) lay(SP.moss, k, x, h - 0.12, z); }   // (moss on the banks)
    for (let i = 0; i < 2; i++) { const k = 1990 + i, [x, z] = spot(k), h = heightAt(x, z); if (h > -0.6 && h < 1.2 && !siteClear(x, z) && clear(x, z, 3)) lay(SP.log, k, x, Math.max(h, -0.35) - 0.15, z); }   // (half drowned)
  } else for (let i = 0; i < 3; i++) { const k = 2000 + i, [x, z] = spot(k), h = heightAt(x, z); if (h > 0.1 && h < 1.2 && !siteClear(x, z) && !isRock(x, z)) lay(SP.driftwood, k, x, h - 0.05, z); }   // (the shore)
  // (Patch 20) tomato bushes, few and far between, out in the meadows and along the woods' edges, never deep in a wood:
  // dice of their own (k from 2100), last in the cell, so nothing laid out before them moves
  if (cw.p > 0.2 && cw.v < 0.4) for (let b = 0; b < Math.round(cw.p * 2); b++) { const k = 2100 + b, [x, z] = spot(k), h = dry(x, z);
    if (h !== null && h2(k + 0.3) < 0.6 && meadow(x, z, h) && wood(x, z) < 0.6 && clear(x, z, 1)) lay(SP.tomato, k, x, h - 0.05, z, 0); }
}
// (Patch 24) Olympos's rocks and its high ground, laid out after everything else in the cell with dice of their own (k
// from 3000), so nothing laid out before them moves. The player found its boulders scattered anyhow, floating and out
// of place: now rock lies where the mountain sheds it. Fans of fallen blocks at the foot of a cliff, big and small
// together, spreading downhill; stones washed into the gullies, rounder; outcrops standing out of the ridges; now and
// then a few stones fallen from the cut along the path's uphill side (never on it). Each sits on the lowest ground under
// it and sunk a third of its height into it, so none floats on a slope. Up high a thin turf of tussocks and broom on the
// shoulders, and scree on the bare rock.
function mountainCover(out, x0, z0, h2) {
  const inCell = (x, z) => x >= x0 && x < x0 + CELL && z >= z0 && z < z0 + CELL;
  const offPath = (x, z, r) => { if (routeAt(x, z).k > 0) return false; for (let a = 0; a < 6; a++) if (routeAt(x + Math.cos(a * 1.047) * (r + 1), z + Math.sin(a * 1.047) * (r + 1)).k > 0) return false; return true; };
  const clear = (x, z, r) => { for (let o = 0; o < out.length; o += STRIDE) { const sp = SPECIES[out[o]], q = Math.hypot(out[o + 2] - x, out[o + 4] - z); if (sp.res === 'tree' && q < sp.col * out[o + 6] + r) return false; if (sp.res === 'rock' && q < (sp.col * out[o + 6] + r) * 0.7) return false; } return true; };
  // a stone at (x, z) of species sp, variant v, scale sc: on the lowest ground under it, a third of its height sunk in
  const stone = (k, sp, v, x, z, sc) => {
    if (!inCell(x, z) || siteClear(x, z) || mtnK(x, z) < 0.5 || slopeGrade(x, z) > (v === 3 ? 1.8 : 1.4)) return false; const S = SPECIES[sp], r = S.col * sc;   // (none rests on a cliff: only an outcrop stands out of one)
    if (!offPath(x, z, r) || !clear(x, z, r)) return false;
    let y = heightAt(x, z); for (let a = 0; a < 6; a++) y = Math.min(y, heightAt(x + Math.cos(a * 1.047 + 0.3) * r * 0.85, z + Math.sin(a * 1.047 + 0.3) * r * 0.85));
    out.push(sp, v, x, y - S.h * sc * 0.33, z, h2(k + 0.37) * 6.283, sc); return true;
  };
  const down = (x, z) => { const gx = heightAt(x + 3, z) - heightAt(x - 3, z), gz = heightAt(x, z + 3) - heightAt(x, z - 3), l = Math.hypot(gx, gz) || 1; return [-gx / l, -gz / l]; };
  for (let c = 0; c < 7; c++) {
    const k = 3000 + c * 40, x = x0 + h2(k) * CELL, z = z0 + h2(k + 0.5) * CELL, h = heightAt(x, z); if (h < 70 || mtnK(x, z) < 0.5 || siteClear(x, z)) continue;
    const g = slopeGrade(x, z), [dx, dz] = down(x, z), above = slopeGrade(x - dx * 10, z - dz * 10), cv = h - (heightAt(x + 10, z) + heightAt(x - 10, z) + heightAt(x, z + 10) + heightAt(x, z - 10)) / 4;
    const talus = g < 0.9 && above > 1.2, gully = cv < -3 && g < 1.4, ridge = cv > 3 && g > 0.7;
    if (h2(k + 0.9) > (talus ? 0.8 : gully ? 0.5 : ridge ? 0.35 : 0.06)) continue;
    const n = talus ? 4 + Math.floor(h2(k + 1.1) * 5) : gully ? 3 + Math.floor(h2(k + 1.1) * 4) : ridge ? 3 : 1 + Math.floor(h2(k + 1.1) * 2);
    for (let i = 0; i < n; i++) {
      const q = k + 2 + i * 1.7, along = talus ? h2(q) * 14 : (h2(q) - 0.5) * (gully ? 20 : 8), across = (h2(q + 0.2) - 0.5) * (talus ? 4 + along : gully ? 5 : 8);
      const px = x + dx * along - dz * across, pz = z + dz * along + dx * across, big = talus ? h2(q + 0.4) < 0.45 - along * 0.02 : ridge ? i === 0 : h2(q + 0.4) < 0.12;
      if (big) stone(q, SP.boulder, ridge ? 3 : Math.floor(h2(q + 0.6) * 3), px, pz, 1.2 + h2(q + 0.8) * (talus ? 1.9 - along * 0.07 : 1.4));
      else stone(q, SP.rock, gully ? (h2(q + 0.6) < 0.6 ? 3 : 0) : Math.floor(h2(q + 0.6) * 4), px, pz, 0.5 + h2(q + 0.8) * 1.1);
    }
  }
  // stones fallen from the cut along the path's uphill side, a few metres off its edge
  const R = PEAK.route;
  for (let i = 5; i < R.length - 1; i += 11) {
    const p = R[i]; if (!inCell(p.x, p.z) || h2(3400 + i) > 0.42) continue;
    const a = R[i - 1], b = R[i + 1], l = Math.hypot(b.x - a.x, b.z - a.z) || 1, nx = (b.z - a.z) / l, nz = -(b.x - a.x) / l, up = heightAt(p.x + nx * 9, p.z + nz * 9) > heightAt(p.x - nx * 9, p.z - nz * 9) ? 1 : -1;
    for (let j = 0; j < 2 + Math.floor(h2(3401 + i) * 3); j++) { const q = 3402 + i + j * 0.13, off = 7.2 + h2(q) * 3, t = (h2(q + 0.05) - 0.5) * 6; stone(q, SP.rock, Math.floor(h2(q + 0.07) * 4), p.x + nx * off * up + (b.x - a.x) / l * t, p.z + nz * off * up + (b.z - a.z) / l * t, 0.45 + h2(q + 0.09) * 0.8); }
  }
  // the high ground: tussocks in clumps and broom on the shoulders over the trees, scree on the bare rock
  const lay = (sp, k, x, y, z, v) => { const S = SPECIES[sp]; out.push(sp, v ?? Math.floor(h2(k + 0.11) * (S.n || 1)), x, y, z, h2(k + 0.37) * 6.283, S.s[0] + (S.s[1] - S.s[0]) * h2(k + 0.53)); };
  const soft = (x, z) => { if (!inCell(x, z) || siteClear(x, z) || mtnK(x, z) < 0.5 || isRock(x, z)) return null; return heightAt(x, z); };
  for (let c = 0; c < 5; c++) {
    const k = 3600 + c * 20, cx = x0 + h2(k) * CELL, cz = z0 + h2(k + 0.5) * CELL, h = soft(cx, cz); if (h === null || h < 200 || h > 380) continue;
    for (let t = 0; t < 3 + Math.floor(h2(k + 1) * 5); t++) { const q = k + 2 + t * 0.9, x = cx + (h2(q) - 0.5) * 7, z = cz + (h2(q + 0.3) - 0.5) * 7, y = soft(x, z); if (y !== null) lay(SP.tallgrass, q + 0.2, x, y - 0.05, z); }
  }
  for (let c = 0; c < 3; c++) { const k = 3700 + c, x = x0 + h2(k) * CELL, z = z0 + h2(k + 0.5) * CELL, y = soft(x, z); if (y !== null && y > 170 && y < 320 && clear(x, z, 0.8)) lay(SP.broom, k, x, y - 0.05, z, 0); }
  for (let c = 0; c < 6; c++) { const k = 3750 + c, x = x0 + h2(k) * CELL, z = z0 + h2(k + 0.5) * CELL; if (!inCell(x, z) || siteClear(x, z) || mtnK(x, z) < 0.5 || !isRock(x, z)) continue; const y = heightAt(x, z); if (y > 220) lay(SP.pebbles, k, x, y - 0.03, z); }
}
// (Patch 24) The river's banks (river.js), laid out after everything else in the cell with dice of their own (k from
// 5000), so nothing laid out before them moves: beds of reeds standing in the slow water's edge and on its wet margin,
// sedge along the banks, water lilies afloat over the lake's and the deep reach's shallows, plane trees in threes and
// fours along the meadow river (the Greek river's tree; never one on its own, the meadows' rule), shrubs on the banks,
// and ferns and moss in the falls' spray.
function riverCover(out, x0, z0, h2) {
  const inCell = (x, z) => x >= x0 && x < x0 + CELL && z >= z0 && z < z0 + CELL, spot = (k) => [x0 + h2(k) * CELL, z0 + h2(k + 0.5) * CELL];
  const lay = (sp, k, x, y, z, v) => { const S = SPECIES[sp]; out.push(sp, v ?? Math.floor(h2(k + 0.11) * (S.n || 3)), x, y, z, h2(k + 0.37) * 6.283, S.s[0] + (S.s[1] - S.s[0]) * h2(k + 0.53)); };
  const r = {}, at = (x, z) => (inCell(x, z) && !siteClear(x, z, false) ? riverAt(x, z, r) : null), slow = (q) => q.kind === 'P' || q.kind === 'D' || q.kind === 'K' || q.kind === 'E';
  if (!at(x0 + 32, z0 + 32) && ![[8, 8], [56, 8], [8, 56], [56, 56]].some(([u, v]) => riverAt(x0 + u, z0 + v, r))) return;   // (no water near this cell)
  // reeds: clumps of five to ten round a spot at the slow water's edge, standing in it up to half a metre deep
  for (let c = 0; c < 6; c++) {
    const k = 5000 + c * 20, [cx, cz] = spot(k), q = at(cx, cz); if (!q || !slow(q) || q.out < -2.5 || q.out > 1.5 || h2(k + 0.9) > 0.75) continue;
    for (let i = 0; i < 5 + Math.floor(h2(k + 1) * 6); i++) { const kk = k + 2 + i * 0.7, x = cx + (h2(kk) - 0.5) * 4.5, z = cz + (h2(kk + 0.2) - 0.5) * 4.5, p = at(x, z); if (!p || p.out < -2.5 || p.depth > 0.55 || p.out > 2) continue; lay(SP.reeds, kk, x, heightAt(x, z) - 0.05, z); }
  }
  // sedge along the banks, just over the water
  for (let i = 0; i < 14; i++) { const k = 5200 + i, [x, z] = spot(k), q = at(x, z); if (!q || q.out < 0 || q.out > 4 || q.fall >= 0 || isRock(x, z)) continue; lay(SP.swampgrass, k, x, heightAt(x, z) - 0.08, z); }
  // water lilies over the still water's shallows, afloat on its face, in rafts
  for (let c = 0; c < 4; c++) {
    const k = 5300 + c * 12, [cx, cz] = spot(k), q = at(cx, cz); if (!q || (q.kind !== 'K' && q.kind !== 'D') || q.depth < 0.5 || q.depth > 2.8 || q.out > -1.5) continue;
    for (let i = 0; i < 4 + Math.floor(h2(k + 1) * 6); i++) { const kk = k + 2 + i * 0.9, x = cx + (h2(kk) - 0.5) * 6, z = cz + (h2(kk + 0.2) - 0.5) * 6, p = at(x, z); if (p && p.depth > 0.4 && p.depth < 3 && p.out < -1) lay(SP.lilypads, kk, x, p.W + 0.03, z); }
  }
  // plane trees in threes and fours on the meadow river's banks, and shrubs between them
  for (let c = 0; c < 2; c++) {
    const k = 5400 + c * 30, [cx, cz] = spot(k), q = at(cx, cz); if (!q || !slow(q) || q.out < 3 || q.out > 9 || h2(k + 0.9) > 0.55 || isRock(cx, cz)) continue;
    for (let i = 0; i < 3 + Math.floor(h2(k + 1) * 2); i++) { const kk = k + 2 + i * 1.3, x = cx + (h2(kk) - 0.5) * 16, z = cz + (h2(kk + 0.2) - 0.5) * 16, p = at(x, z); if (!p || p.out < 3 || p.out > 12 || isRock(x, z)) continue; const S = SPECIES[SP.plane].s; out.push(SP.plane, Math.floor(h2(kk + 0.4) * 3), x, heightAt(x, z) - 0.05, z, h2(kk + 0.6) * 6.283, S[0] + (S[1] - S[0]) * h2(kk + 0.8)); }
  }
  for (let i = 0; i < 4; i++) { const k = 5500 + i, [x, z] = spot(k), q = at(x, z); if (!q || q.out < 1.5 || q.out > 7 || q.fall >= 0 || isRock(x, z)) continue; lay(i % 2 ? SP.myrtle : SP.bush, k, x, heightAt(x, z) - 0.06, z, i % 2 ? 0 : [0, 1, 2, 3][Math.floor(h2(k + 0.2) * 4)]); }
  // ferns and moss in the falls' spray, on the wet ledges and the rock round the pools
  for (let i = 0; i < 18; i++) { const k = 5600 + i, [x, z] = spot(k), q = at(x, z); if (!q || q.fall < 0 || q.out < 0.3 || q.out > 14) continue; const f = RIVER.falls[q.fall]; if (Math.hypot(x - f.px, z - f.pz) > 34) continue;
    lay(isRock(x, z) || i % 3 === 0 ? SP.moss : SP.fern, k, x, heightAt(x, z) - 0.08, z, isRock(x, z) || i % 3 === 0 ? undefined : 0); }
}
export const STRIDE = 7;
