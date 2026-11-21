// The river (Patch 24): it rises from a spring under a cliff on Olympos's south-west face, just below the snows, and
// comes down the mountain's cliff bands in four falls of some 30 to 65 metres, plunge pools at their feet and cascades
// between; out on the meadows it winds south-west, between the Ancient Temple and the western Giants' cave, slows into a
// deep, wide reach you have to swim across, turns north into a small lake under the hills, and leaves it through a
// ravine it has cut in the forest hills, down rapids to the sea on the north-west coast. Pure and deterministic, with
// no three.js, like gen.js: the game, the workers and the tests share it (river-water.js draws it).
//
// It is laid out (layRiver) once every site is placed (sites.js), so nothing moves: its course is a line through fixed
// points (COURSE), sampled every STEP metres, and its surface is worked out from the land along that line, never rising
// (the water's level: where the land rises across its way it cuts a valley; where the land falls away over a cliff band
// it falls). Then it carves its channel into the height (gen.js heightAt, through setRiverHook): across the water a bed
// from the bank down to the deepest line (the thalweg, out towards the outside of each bend, with gravel bars on the
// inside), and beyond the water's edge a bank that rises gently and then as a valley side, taking the land down
// wherever it stood higher. So every bank stands at or above the water and every bed below it, and the water's surface
// (waterAt) is the same function the ground was carved by.
import { heightAt, noise, fbm, setRiverHook, meadowPath, isRock } from './gen.js';
import { clamp, lerp, smooth } from '../util/math.js';

// The course, from the spring to the sea: [x, z, half width (m), depth at the deepest (m), valley side's slope, width of
// the flat beside the water before it (m), kind]. Kinds: M the mountain stream, F a fall's lip (the land falls away
// past it), P the meadow river, with pools and riffles, D the deep reach, K the lake, G the ravine, E the estuary.
// (The mountain's points follow the way water runs off the face, from a trace down its slope; the falls are where it
// crosses the cliff bands of gen.js bands())
const COURSE = [
  [188, -917, 3.0, 1.6, 1.3, 0.6, 'M'],    // the spring: a round pool at the foot of a crag, where the snowmelt comes out of the limestone
  [180, -913, 1.6, 0.6, 1.3, 0.8, 'M'], [172, -911, 2.0, 0.7, 1.3, 0.8, 'M'],
  [164, -911, 4.2, 0.8, 1.3, 0.8, 'F'],    // the first fall, some 60 m
  [150, -910, 2.4, 0.8, 1.3, 0.8, 'M'], [140, -904, 2.4, 0.7, 1.3, 0.8, 'M'], [131, -895, 2.4, 0.7, 1.3, 0.8, 'M'],
  [122, -885, 4.6, 0.8, 1.3, 0.8, 'F'],    // the second, some 60 m
  [113, -872, 2.6, 0.8, 1.2, 0.8, 'M'], [104, -866, 2.6, 0.8, 1.2, 0.8, 'M'], [90, -861, 2.7, 0.7, 1.2, 0.8, 'M'], [78, -859, 2.8, 0.8, 1.2, 0.8, 'M'],
  [70, -857, 5.2, 0.8, 1.2, 0.8, 'F'],     // the third and highest, some 65 m
  [59, -849, 3.0, 0.9, 1.1, 1.0, 'M'], [46, -845, 3.0, 0.8, 1.1, 1.0, 'M'], [29, -843, 3.1, 0.8, 1.1, 1.0, 'M'], [12, -846, 3.2, 0.9, 1.1, 1.0, 'M'], [-5, -846, 3.2, 0.9, 1.1, 1.0, 'M'], [-17, -840, 3.3, 0.9, 1.1, 1.0, 'M'], [-24, -831, 3.3, 0.9, 1.1, 1.0, 'M'],
  [-27, -823, 5.0, 0.9, 1.1, 1.0, 'F'],    // the last, some 30 m, out onto the foothills
  [-30, -807, 3.6, 1.0, 1.4, 1.2, 'M'], [-30, -796, 3.8, 1.0, 1.4, 1.5, 'M'], [-22, -787, 4.0, 1.1, 1.2, 2, 'M'], [-12, -774, 4.4, 1.2, 0.8, 3, 'P'],
  // out on the meadows, winding south-west
  [-14, -752, 5.0, 1.4, 0.4, 5, 'P'], [-38, -726, 5.2, 1.5, 0.38, 6, 'P'], [-80, -702, 5.4, 1.5, 0.36, 6, 'P'], [-118, -664, 5.6, 1.6, 0.35, 6, 'P'],
  [-136, -612, 5.8, 1.7, 0.35, 6, 'P'], [-146, -560, 6.0, 1.7, 0.35, 6, 'P'], [-166, -505, 6.0, 1.8, 0.35, 6, 'P'], [-205, -458, 6.2, 1.8, 0.35, 7, 'P'],
  [-262, -424, 6.4, 1.9, 0.35, 7, 'P'], [-330, -405, 6.8, 2.0, 0.35, 7, 'P'], [-392, -394, 8.5, 2.6, 0.35, 7, 'P'],
  // the deep reach: slow, dark and wide, a swim across
  [-445, -390, 14, 4.4, 0.4, 6, 'D'], [-500, -398, 16, 4.8, 0.4, 6, 'D'], [-548, -418, 15, 4.6, 0.4, 6, 'D'], [-582, -452, 11, 3.6, 0.4, 6, 'D'],
  [-604, -492, 7.0, 2.2, 0.36, 6, 'P'], [-618, -540, 6.6, 2.0, 0.36, 6, 'P'], [-626, -590, 8, 2.4, 0.36, 6, 'P'],
  // the lake, under the hills
  [-622, -628, 22, 4.5, 0.7, 3, 'K'], [-622, -665, 40, 7.0, 0.7, 3, 'K'], [-630, -700, 36, 6.5, 0.7, 3, 'K'], [-645, -733, 18, 4.0, 0.7, 3, 'K'],
  // out of it through a ravine in the forest hills, down rapids to the sea
  [-656, -765, 6.0, 1.4, 0.8, 3, 'G'], [-662, -800, 5.5, 1.3, 0.85, 2.5, 'G'], [-674, -842, 5.5, 1.3, 0.85, 2.5, 'G'], [-698, -888, 5.5, 1.4, 0.85, 2.5, 'G'],
  [-732, -945, 6.0, 1.4, 0.85, 2.5, 'G'], [-768, -995, 6.5, 1.5, 0.75, 3, 'G'], [-803, -1038, 8, 1.7, 0.6, 4, 'E'], [-838, -1074, 12, 2.2, 0.5, 5, 'E'],
  [-868, -1106, 18, 2.8, 0.45, 6, 'E'], [-892, -1134, 24, 3.4, 0.4, 6, 'E'],
];
export const STEP = 2;                 // metres between the course's samples
const EDGE = 3;                        // how far past the water's edge its surface is drawn and counts (the banks hide it)
const FLOW = 9;                        // how much water comes down it (m³/s): the current from the channel's size
const KINDS = 'MFPDKGE';
// what the land must lie above the water by, before a valley is cut (m), and the least it falls each metre, by kind
const DROP = { M: 0.35, F: 0.35, P: 0.8, D: 1.0, K: 0.7, G: 1.0, E: 0.6 }, GRADE = { M: 0.01, F: 0.01, P: 0.0006, D: 0.0002, K: 0, G: 0.004, E: 0.002 };

// The river's samples (typed arrays, n of them): position, tangent, distance along, the surface, half widths left and
// right, depth, the thalweg's offset (-1..1 across), valley slope and flat, the current's speed, how far its banks reach,
// which fall a sample belongs to (-1 none), its kind (index into KINDS)
export const RIVER = { on: false, n: 0, X: null, Z: null, TX: null, TZ: null, S: null, W: null, WL: null, WR: null, D: null, C: null, V: null, F: null, SP: null, R: null, FALL: null, K: null,
  falls: [], lake: null, deep: null, box: [0, 0, 0, 0], length: 0 };
const GRID = new Map(), GC = 16, gkey = (i, j) => (i + 4096) * 8192 + (j + 4096);

// a centripetal Catmull-Rom through the course, sampled finely, then evened out to STEP metres apart
function centreline() {
  const P = COURSE, fine = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    const d = (a, b) => Math.max(1e-3, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1]))), t1 = d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
    for (let k = 0; k < 40; k++) {
      const t = t1 + (t2 - t1) * (k / 40), L = (a, b, ta, tb) => [0, 1].map((c) => (tb === ta ? a[c] : ((tb - t) * a[c] + (t - ta) * b[c]) / (tb - ta)));
      const A1 = L(p0, p1, 0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, 0, t2), B2 = L(A2, A3, t1, t3), C = L(B1, B2, t1, t2);
      fine.push([C[0], C[1], i + k / 40]);
    }
  }
  fine.push([P.at(-1)[0], P.at(-1)[1], P.length - 1]);
  // the meanders: the line swung from side to side out on the meadows and a little in the ravine, some 60-110 m from one
  // bend to the next and more or less as the noise has it, never in the lake, the deep reach or down the mountain (so
  // the course still passes through every point it was given there)
  { let s = 0; const wig = fine.map((p, i) => { if (i) s += Math.hypot(p[0] - fine[i - 1][0], p[1] - fine[i - 1][1]); const c = COURSE[Math.min(COURSE.length - 1, Math.round(p[2]))], k = c[6] === 'P' ? 3.2 : c[6] === 'G' ? 0.7 : 0;
      return k * c[2] * (Math.sin(s / 130 * 6.283 + 2.0 * noise(s * 0.006, 3.3)) * 0.75 + (noise(s * 0.02, 8.1) - 0.5) * 1.1); });
    const sm = wig.map((_, i) => { let a = 0, m = 0; for (let j = -16; j <= 16; j += 2) { const q = clamp(i + j, 0, wig.length - 1); a += wig[q]; m++; } return a / m; });   // (eased in and out where the kind changes)
    const base = fine.map((p) => p.slice());
    for (let i = 1; i < fine.length - 1; i++) { const a = base[i - 1], b = base[i + 1], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1; fine[i] = [fine[i][0] - (b[1] - a[1]) / l * sm[i], fine[i][1] + (b[0] - a[0]) / l * sm[i], fine[i][2]]; } }
  const out = [fine[0]]; let acc = 0;
  for (let i = 1; i < fine.length; i++) {
    const a = fine[i - 1], b = fine[i], l = Math.hypot(b[0] - a[0], b[1] - a[1]); let r = l;
    while (acc + r >= STEP) { const f = (l - r + (STEP - acc)) / l; out.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]); r -= STEP - acc; acc = 0; }
    acc += r;
  }
  return out;
}

// keep: the places already laid out ([x, z, r]: sites.js), whose ground the valley's sides must leave as it is
export function layRiver(keep = []) {
  const pts = centreline(), n = pts.length, R = RIVER; R.n = n;
  for (const k of ['X', 'Z', 'TX', 'TZ', 'S', 'W', 'WL', 'WR', 'D', 'C', 'V', 'F', 'SP', 'R', 'EL', 'ER']) R[k] = new Float32Array(n);
  R.FALL = new Int16Array(n).fill(-1); R.K = new Uint8Array(n);
  const { X, Z, TX, TZ, S, W, WL, WR, D, C, V, F, SP } = R;
  // the course's own values along it, eased from one point to the next
  const at = (f, c) => { const i = Math.min(COURSE.length - 2, Math.floor(f)), t = smooth(0, 1, f - i); return lerp(COURSE[i][c], COURSE[i + 1][c], t); };
  const kindAt = (f) => COURSE[Math.min(COURSE.length - 1, Math.round(f))][6];
  for (let i = 0; i < n; i++) {
    const [x, z, f] = pts[i]; X[i] = x; Z[i] = z; S[i] = i * STEP;
    const half = at(f, 2), k = kindAt(f); R.K[i] = KINDS.indexOf(k);
    // (the lake's shores wander, each side its own way: never an oval)
    const lk = k === 'K' ? 1 : 0, wob = (s) => 1 + lk * 0.5 * (noise(i * STEP * 0.014 + s, 4.2 + s) - 0.5) * 2 + 0.1 * (noise(i * STEP * 0.05 - s, 1.3) - 0.5);
    WL[i] = half * wob(0); WR[i] = half * wob(7.7); D[i] = at(f, 3); V[i] = at(f, 4); F[i] = at(f, 5);
  }
  for (let i = 0; i < n; i++) { const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1), l = Math.hypot(X[b] - X[a], Z[b] - Z[a]) || 1; TX[i] = (X[b] - X[a]) / l; TZ[i] = (Z[b] - Z[a]) / l; }
  R.length = S[n - 1];
  // the land along the line (the lowest across the middle of the channel: it runs in the hollow), and the surface: the
  // land less DROP, never rising downstream; the lake's flat at the level it is entered at
  const land = new Float32Array(n);
  for (let i = 0; i < n; i++) { const nx = -TZ[i], nz = TX[i], h = Math.min(WL[i], WR[i]) * 0.5; land[i] = Math.min(heightAt(X[i], Z[i]), heightAt(X[i] + nx * h, Z[i] + nz * h), heightAt(X[i] - nx * h, Z[i] - nz * h)); }
  const kd = (i) => KINDS[R.K[i]];
  W[0] = land[0] - DROP.M;
  for (let i = 1; i < n; i++) { const k = kd(i); W[i] = k === 'K' && kd(i - 1) === 'K' ? W[i - 1] : Math.min(W[i - 1] - GRADE[k] * STEP, land[i] - DROP[k]); }
  // eased where it runs, a few times over (each time kept from rising again), but not over the falls' faces
  const steep = (i) => i > 0 && i < n - 1 && (W[i - 1] - W[i + 1]) / (2 * STEP) > 0.9;
  for (let pass = 0; pass < 3; pass++) {
    const c = W.slice();
    for (let i = 1; i < n - 1; i++) { if (kd(i) === 'K' || steep(i)) continue; let a = 0, m = 0; for (let j = -4; j <= 4; j++) { const q = clamp(i + j, 0, n - 1); if (steep(q)) continue; a += c[q]; m++; } W[i] = Math.min(c[i], a / m); }
    for (let i = 1; i < n; i++) W[i] = Math.min(W[i], W[i - 1] - (kd(i) === 'K' ? 0 : GRADE[kd(i)] * STEP * 0.5));
  }
  // from the lake down to the sea the fall is shared out evenly down the ravine's rapids (cutting it deeper), rather than
  // kept for one drop where the land meets the beach
  { let i1 = -1; for (let i = 0; i < n; i++) if (kd(i) === 'K') i1 = i; let ic = n - 1; for (let i = i1 + 1; i < n; i++) if (land[i] < 0.6) { ic = i; break; }
    if (i1 > 0) for (let i = i1 + 1; i < n; i++) W[i] = Math.min(W[i], W[i1] * Math.pow(Math.max(0, 1 - (i - i1) / (ic - i1)), 0.85)); }
  for (let i = 0; i < n; i++) W[i] = Math.max(W[i], 0.02);
  // the falls: where the surface drops more than 8 m, steeper than 3 in 5 from the cliff's lip (the first sample where
  // it steepens) to its foot
  R.falls = [];
  for (let i = 1; i < n - 2; i++) {
    if (W[i] - W[i + 1] < 0.6 * STEP) continue;
    const a = i; let b = i + 1; while (b < n - 1 && W[b] - W[b + 1] > 0.3 * STEP) b++;
    const top = W[a], foot = W[b], H = top - foot, k = R.falls.length; if (H < 8) { i = b; continue; }
    // the water sheets down the cliff's face as it stands (its bed only a shallow groove in the rock), and the pool lies
    // at the face's foot, deepest just under it and wider than the stream
    const pool = Math.min(n - 1, b + 2);
    for (let j = a; j <= b; j++) { R.FALL[j] = k; D[j] = 0.3; V[j] = 2.2; F[j] = 0.3; }
    for (let j = Math.max(b, pool - 4); j <= Math.min(n - 1, pool + 9); j++) { const g = Math.exp(-(((j - pool) * STEP) ** 2) / 50); R.FALL[j] = k; D[j] += (1.4 + H * 0.03) * g; WL[j] *= 1 + 0.8 * g; WR[j] *= 1 + 0.8 * g; }
    R.falls.push({ i: a, b, pool, x: X[a], z: Z[a], top, foot, h: H, w: (WL[a] + WR[a]) * 0.5, dx: TX[a], dz: TZ[a], px: X[pool], pz: Z[pool], r0: (WL[pool] + WR[pool]) * 0.5 });
    i = b;
  }
  // pools and riffles down the meadow reaches, some six widths apart (shallower and quicker over the riffles), and the
  // thalweg out towards the outside of each bend, with a gravel bar on the inside narrowing the water there
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 3), b = Math.min(n - 1, i + 3), k = ((TX[b] - TX[a]) * -TZ[i] + (TZ[b] - TZ[a]) * TX[i]) / ((b - a) * STEP || 1), w = (WL[i] + WR[i]) * 0.5;
    C[i] = clamp(-k * w * 5, -0.6, 0.6) * (kd(i) === 'K' ? 0.2 : 1);
    const bar = smooth(0.06, 0.2, Math.abs(k * w)) * (kd(i) === 'P' || kd(i) === 'G' ? 1 : 0); if (k > 0) WR[i] *= 1 - 0.3 * bar; else WL[i] *= 1 - 0.3 * bar;
    if (kd(i) === 'P' || kd(i) === 'G') D[i] *= 0.78 + 0.36 * Math.sin(S[i] / (12 * w) * 6.283 + 1.3);
  }
  // the current: the water that comes down over the channel's section, quicker down a steep bed
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - 5), b = Math.min(n - 1, i + 5), g = Math.max(0, (W[a] - W[b]) / ((b - a) * STEP || 1)), w = WL[i] + WR[i];
    SP[i] = kd(i) === 'K' ? 0.03 : clamp(FLOW / (0.6 * w * Math.max(0.4, D[i])), 0.05, 2.4) * (1 + Math.min(1.2, Math.sqrt(g) * 4)) * 0.6;
  }
  // how far each sample's banks reach: past the flat, as far as the valley side must run to come up to the highest land
  // round it (sampled out to 150 m either side, every fourth sample, the rest from those)
  // How much the valley takes off the land either side: what the land stood above the bank's flat at its far edge (EL,
  // ER, eased along). The valley's side is then the land itself lowered by that, less and less further out, so its
  // hills keep their own lie (a cut down to a slope at the valley side's grade left great smooth faces where the river
  // ran under a hill); its reach is as far as that lowering goes
  for (let i = 0; i < n; i++) for (const [E, sg, WS] of [[R.EL, -1, WL], [R.ER, 1, WR]]) { const o = (WS[i] + F[i]) * sg, nx = -TZ[i], nz = TX[i]; E[i] = Math.max(0, heightAt(X[i] + nx * o, Z[i] + nz * o) - W[i] - bankRise(WS[i] + F[i] - WS[i], V[i], F[i]) - 0.4); }
  for (const E of [R.EL, R.ER]) { const c = E.slice(); for (let i = 0; i < n; i++) { let a = 0, m = 0; for (let j = -6; j <= 6; j++) { const q = clamp(i + j, 0, n - 1); a += c[q]; m++; } E[i] = Math.max(c[i] * 0.6, a / m); } }
  for (let i = 0; i < n; i++) R.R[i] = Math.max(WL[i], WR[i]) + F[i] + EDGE + 6 + cutReach(Math.max(R.EL[i], R.ER[i]), V[i]);
  for (let i = 0; i < n; i++) { let m = R.R[i]; for (let j = Math.max(0, i - 8); j <= Math.min(n - 1, i + 8); j++) m = Math.max(m, R.R[j] - Math.abs(j - i) * STEP * 0.5); R.R[i] = Math.min(m, 160); }   // (eased, so the reach doesn't step)
  // the lake's and the deep reach's middles (for the sound, the map and the tests)
  const mid = (k) => { let x = 0, z = 0, c = 0, w = 0, d = 0, i0 = -1; for (let i = 0; i < n; i++) if (kd(i) === k) { x += X[i]; z += Z[i]; c++; w = Math.max(w, WL[i] + WR[i]); d = Math.max(d, D[i]); if (i0 < 0) i0 = i; } return c ? { x: x / c, z: z / c, y: W[i0], w, depth: d, i0, i1: i0 + c - 1 } : null; };
  R.lake = mid('K'); R.deep = mid('D');
  // the lookup grid: each stretch between two samples listed in every GC-metre cell its banks reach
  GRID.clear(); let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let i = 0; i < n - 1; i++) {
    const r = Math.max(R.R[i], R.R[i + 1]);
    for (let gx = Math.floor((Math.min(X[i], X[i + 1]) - r) / GC); gx <= Math.floor((Math.max(X[i], X[i + 1]) + r) / GC); gx++) for (let gz = Math.floor((Math.min(Z[i], Z[i + 1]) - r) / GC); gz <= Math.floor((Math.max(Z[i], Z[i + 1]) + r) / GC); gz++) {
      // (only the cells the reach really touches: the nearest point of the cell within r of the stretch)
      const cx = clamp((X[i] + X[i + 1]) / 2, gx * GC, gx * GC + GC), cz = clamp((Z[i] + Z[i + 1]) / 2, gz * GC, gz * GC + GC); if (Math.hypot(cx - (X[i] + X[i + 1]) / 2, cz - (Z[i] + Z[i + 1]) / 2) > r + STEP) continue;
      const key = gkey(gx, gz); (GRID.get(key) || GRID.set(key, []).get(key)).push(i);
    }
    x0 = Math.min(x0, X[i] - r); x1 = Math.max(x1, X[i] + r); z0 = Math.min(z0, Z[i] - r); z1 = Math.max(z1, Z[i] + r);
  }
  for (const [k, v] of GRID) GRID.set(k, Int32Array.from(v));
  R.box = [x0, x1, z0, z1]; R.keep = keep.filter(([x, z, r]) => x + r + 20 > x0 && x - r - 20 < x1 && z + r + 20 > z0 && z - r - 20 < z1); R.on = true;
  setRiverHook(carve, colour);
  R.bridge = layBridge();
}
// A footbridge of planks over the meadow river (structures.js bridge), where a worn path comes down to it if one does:
// on a straight stretch, its banks firm and a metre or two over the water on both sides, as short a span as can be.
// { x, z, y: the deck's height, rot: the way it runs across (radians), len: its length }
function layBridge() {
  const R = RIVER; let best = null, bs = Infinity;
  for (let i = 380; i < (R.deep ? R.deep.i0 - 12 : R.n - 40); i += 3) {
    if (KINDS[R.K[i]] !== 'P' || Math.abs(R.C[i]) > 0.15) continue;
    const nx = -R.TZ[i], nz = R.TX[i], y = R.W[i] + 1.1, ends = [];
    for (const sg of [-1, 1]) { let o = (sg < 0 ? R.WL[i] : R.WR[i]) + 1; while (o < 16 && heightAt(R.X[i] + nx * o * sg, R.Z[i] + nz * o * sg) < y - 0.5) o += 0.5; ends.push(o); }
    if (Math.max(...ends) >= 16) continue;
    const ex = (sg, o) => [R.X[i] + nx * o * sg, R.Z[i] + nz * o * sg], [ax, az] = ex(-1, ends[0] + 1.5), [bx, bz] = ex(1, ends[1] + 1.5);
    if (isRock(ax, az) || isRock(bx, bz) || Math.abs(heightAt(ax, az) - y) > 0.9 || Math.abs(heightAt(bx, bz) - y) > 0.9) continue;
    const sc = ends[0] + ends[1] - 7 * Math.max(meadowPath(ax, az), meadowPath(bx, bz), meadowPath(R.X[i], R.Z[i]));
    if (sc < bs) { bs = sc; const mid = (ends[1] - ends[0]) / 2; best = { x: R.X[i] + nx * mid, z: R.Z[i] + nz * mid, y, rot: Math.atan2(nx, nz), len: ends[0] + ends[1] + 1, i }; }
  }
  return best;
}

// ---- Where a point lies by the river: the nearest stretch, how far along (s, and the sample i and t between it and
// the next), how far across (d: signed, + to the right going downstream; u: d over that side's half width, so ±1 at the
// water's edge), and the river's values there. null away from it.
const _q = { i: 0, t: 0, s: 0, d: 0, u: 0, W: 0, w: 0, D: 0, C: 0, V: 0, F: 0, SP: 0, R: 0, tx: 0, tz: 0, fall: -1, k: 0, out: 0 };
function nearest(x, z, out = _q) {
  const R = RIVER, B = R.box; if (!R.on || x < B[0] || x > B[1] || z < B[2] || z > B[3]) return null;
  const list = GRID.get(gkey(Math.floor(x / GC), Math.floor(z / GC))); if (!list) return null;
  const { X, Z } = R; let bd = 1e18, bi = -1, bt = 0;
  for (let j = 0; j < list.length; j++) {
    const i = list[j], ex = X[i + 1] - X[i], ez = Z[i + 1] - Z[i], t = clamp(((x - X[i]) * ex + (z - Z[i]) * ez) / (ex * ex + ez * ez), 0, 1), dx = x - X[i] - ex * t, dz = z - Z[i] - ez * t, dd = dx * dx + dz * dz;
    if (dd < bd) { bd = dd; bi = i; bt = t; }
  }
  return bi < 0 ? null : fill(bi, bt, x, z, out);
}
function fill(i, t, x, z, o) {
  const R = RIVER, j = i + 1, L = (A) => A[i] + (A[j] - A[i]) * t;
  o.i = i; o.t = t; o.s = L(R.S); o.tx = L(R.TX); o.tz = L(R.TZ); const tl = Math.hypot(o.tx, o.tz) || 1; o.tx /= tl; o.tz /= tl;
  const px = R.X[i] + (R.X[j] - R.X[i]) * t, pz = R.Z[i] + (R.Z[j] - R.Z[i]) * t, dx = x - px, dz = z - pz;
  o.d = dx * -o.tz + dz * o.tx; if (t === 0 || t === 1) { const r = Math.hypot(dx, dz); o.d = r * (o.d < 0 ? -1 : 1); }   // (past either end: round)
  o.W = L(R.W);
  o.w = o.d < 0 ? L(R.WL) : L(R.WR); o.D = L(R.D); o.C = L(R.C); o.V = L(R.V); o.F = L(R.F); o.SP = L(R.SP); o.R = L(R.R); o.fall = R.FALL[t < 0.5 ? i : j]; o.k = R.K[t < 0.5 ? i : j];
  o.u = o.d / Math.max(0.3, o.w); o.out = Math.abs(o.d) - o.w;
  return o;
}
// how high the bank stands over the water dd metres past its edge: a lip, a gently rising flat, then the valley side
// (steepening as it goes, so a valley's side meets the land it is cut into within some 30-40 m rather than planing off
// every hill in sight)
function bankRise(dd, V, F) { const e = dd - F; return 0.35 * smooth(0, 2.2, dd) + 0.05 * dd + V * (e <= 0 ? 0 : e < 2 ? e * e / 4 : e - 1 + (e - 2) * (e - 2) / 50); }
// the bed across the water (u -1..1), from the thalweg's depth up to the water's edge; rocky in the mountain stream
function bedAt(q, x, z) {
  const c = q.C, u = clamp(q.u, -1, 1), r = u >= c ? (u - c) / (1 - c) : (c - u) / (1 + c), prof = 1 - Math.pow(Math.min(1, r), 1.7);
  const rough = q.k <= 1 || q.k === 5 ? 0.45 : 0.12;   // (boulders in the mountain stream and the ravine)
  return q.W - q.D * prof - (q.k === 4 ? 0 : (noise(x * 0.31 + 7.3, z * 0.31 - 2.1) - 0.5) * rough * Math.min(1, q.D) * (1 - r * r));
}
// how far out the valley's lowering of the land goes, for a lowering of E at the bank, on a side of grade V
const cutReach = (E, V) => 2 + E * Math.min(4.5, 1.8 / Math.max(0.3, V));
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

const L2 = (A, i, t) => A[i] + (A[i + 1] - A[i]) * t;
let _cd = new Float64Array(64), _ct = new Float64Array(64);
// The ground with the river's channel cut into it (gen.js heightAt asks, given the land h as it was)
const _c = { ...(_q) };
function carve(x, z, h) {
  const R = RIVER, B = R.box; if (x < B[0] || x > B[1] || z < B[2] || z > B[3]) return h;
  const list = GRID.get(gkey(Math.floor(x / GC), Math.floor(z / GC))); if (!list) return h;
  const { X, Z } = R, n = list.length, D2 = _cd.length < n ? (_cd = new Float64Array(n * 2)) : _cd, T = _ct.length < n ? (_ct = new Float64Array(n * 2)) : _ct; let out = h, bd = 1e18, bi = -1, bt = 0;
  for (let j = 0; j < n; j++) {
    const i = list[j], ex = X[i + 1] - X[i], ez = Z[i + 1] - Z[i], t = clamp(((x - X[i]) * ex + (z - Z[i]) * ez) / (ex * ex + ez * ez), 0, 1), dx = x - X[i] - ex * t, dz = z - Z[i] - ez * t;
    D2[j] = dx * dx + dz * dz; T[j] = t; if (D2[j] < bd) { bd = D2[j]; bi = i; bt = t; }
  }
  // the nearest stretch of each reach that comes near (two loops of a bend, a fall's face and the reach above it: each
  // the nearest of a run of stretches one after another) may take the land down; the nearest of all decides the bed
  // and the low bank (those much further off would only lower it less)
  const lim = (Math.sqrt(bd) + 8) ** 2;
  for (let j = 0; j < n; j++) {
    if (D2[j] > lim) continue; const i = list[j], r = R.R[i]; if (D2[j] > r * r) continue;
    if ((j > 0 && list[j - 1] === i - 1 && D2[j - 1] < D2[j]) || (j < n - 1 && list[j + 1] === i + 1 && D2[j + 1] <= D2[j])) continue;
    const t = T[j];
    const q = fill(i, t, x, z, _c); if (q.out <= 0) continue;
    // the bank's lip and flat by the water, then the valley side: the land lowered, by all of E at the flat's edge and
    // less and less beyond it (never below the flat's own height)
    const e = q.out - q.F, E = q.d < 0 ? L2(R.EL, i, t) : L2(R.ER, i, t);
    out = smin(out, e <= 0 ? q.W + bankRise(q.out, q.V, q.F) : Math.max(h - E * (1 - smooth(0, cutReach(E, q.V), e)) ** 1.5, q.W + bankRise(q.F, q.V, q.F) + 0.05 * e), 1.2);
  }
  if (bi < 0) return h;
  for (const [kx, kz, kr] of R.keep) { const d = Math.hypot(x - kx, z - kz); if (d < kr + 14) out = h + (out - h) * smooth(kr, kr + 14, d); }   // (a place's ground left as it was laid out)
  const q = fill(bi, bt, x, z, _c);
  if (q.out < 0) return Math.min(out, bedAt(q, x, z));
  // (a hollow beside the water is filled up to a low bank over its first few metres, so the water never spills out of
  // the channel: every bank stands above the river's surface)
  const lev = q.W + 0.2 + 0.05 * q.out; if (out < lev) out = lerp(lev, out, smooth(3.5, 11, q.out));
  return out;
}

// ---- The water at (x, z): its surface where the river (or the lake) is, else the sea's level (0); and more about it
export function waterAt(x, z) { const q = nearest(x, z); return q && q.out < EDGE ? q.W : 0; }
// { W surface, depth to the bed (the carved ground), s along, u across, speed (m/s), fx, fz the way it flows, fall (the
// fall it belongs to, -1), kind ('M'…'E'), out (m past the edge, negative in the water), wet (1 in the water) }, or null
const _r = { W: 0, depth: 0, s: 0, u: 0, speed: 0, fx: 0, fz: 0, fall: -1, kind: 'P', out: 0, i: 0 };
export function riverAt(x, z, out = _r) {
  const q = nearest(x, z); if (!q || q.out > EDGE + 6) return null;
  out.W = q.W; out.depth = q.W - heightAt(x, z); out.s = q.s; out.u = q.u; out.out = q.out; out.fall = q.fall; out.kind = KINDS[q.k]; out.i = q.i;
  // (the current slackens towards the banks)
  const across = 1 - Math.pow(Math.min(1, Math.abs(q.u)), 4); out.speed = q.out < 0 ? q.SP * (0.25 + 0.75 * across) : 0; out.fx = q.tx; out.fz = q.tz;
  return out;
}
// how near the river's water (x, z) is, for flora and pickups: true in the water and on its wet margin (the first metre
// of the bank), and close round a fall, in its spray
export function riverWet(x, z, margin = 1) { const q = nearest(x, z); return !!q && (q.out < margin || (q.fall >= 0 && q.out < 4)); }

// ---- Colours: the bed and the banks (gen.js groundColor asks, after everything else has coloured the ground)
const C3 = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const PAL = { gravel: C3(0x8c8068), gravel2: C3(0x6e6452), sand: C3(0xb09a72), silt: C3(0x5a4c38), wet: C3(0x3a3224), moss: C3(0x34462a), stone: C3(0x5e5a52), pebble: C3(0xa09684) };
const mix3 = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; };
const _k = { ...(_q) };
function colour(x, z, h, out) {
  const q = nearest(x, z, _k); if (!q || q.out > 14) return;
  const kind = KINDS[q.k], n1 = fbm(x * 0.21 + 3.7, z * 0.21 - 1.9, 2), n2 = noise(x * 0.9 + 11, z * 0.9 - 5), above = h - q.W;
  if (q.out < 0.4) {
    // the bed: gravel and pebbles, pale over the bars and the riffles, silt in the deep reach and the lake's middle, the
    // bare rock of the mountain stream showing through (the terrain's stone surface, out[3])
    const deep = smooth(0.6, 3.5, q.W - h), b = PAL.gravel.slice(); mix3(b, PAL.gravel2, smooth(0.35, 0.65, n1)); mix3(b, PAL.pebble, smooth(0.55, 0.8, n2) * 0.5);
    mix3(b, PAL.silt, deep * (kind === 'K' || kind === 'D' ? 0.85 : 0.35)); if (kind === 'K') mix3(b, PAL.sand, (1 - deep) * 0.6);
    mix3(out, b, 0.9); if (kind === 'M' || kind === 'F' || kind === 'G') out[3] = Math.max(out[3], 0.55 * smooth(0.3, 0.6, n1) + (q.fall >= 0 ? 0.4 : 0));
    return;
  }
  // the banks: a wet dark line just over the water, a beach of sand and pebbles round the lake, gravel bars, and dark,
  // mossy stone by the falls in their spray
  const wetK = smooth(1.1, 0.1, above) * smooth(3.5, 0.4, q.out);
  if (kind === 'K' || kind === 'D' || kind === 'E') mix3(out, PAL.sand, smooth(5, 1, q.out) * smooth(1.6, 0.3, above) * 0.75 * (0.6 + 0.4 * n1));
  else mix3(out, n2 > 0.5 ? PAL.pebble : PAL.gravel, smooth(4, 0.5, q.out) * smooth(1.2, 0.2, above) * 0.7);
  mix3(out, PAL.wet, wetK * 0.65);
  if (q.fall >= 0 || kind === 'M') { const sp = q.fall >= 0 ? smooth(14, 2, q.out) : smooth(4, 0.5, q.out) * 0.6; mix3(out, PAL.moss, sp * (0.55 + 0.35 * n1)); out[0] *= 1 - 0.25 * sp; out[1] *= 1 - 0.2 * sp; out[2] *= 1 - 0.25 * sp; }
}
// ---- What of the river you hear from p (sound.js waters): the water nearest you, from where it runs (louder where it
// runs quick and shallow), each fall within earshot from its pool, and the lake's shore when you are by it
const _snd = [];
export function riverSounds(p) {
  const R = RIVER; _snd.length = 0; if (!R.on || !Number.isFinite(p.x + p.z)) return _snd; let bd = 1e18, bi = -1;
  for (let i = 0; i < R.n; i += 2) { const d = (R.X[i] - p.x) ** 2 + (R.Z[i] - p.z) ** 2; if (d < bd) { bd = d; bi = i; } }
  if (bi >= 0 && bd < 140 * 140) {
    const k = KINDS[R.K[bi]], w = (R.WL[bi] + R.WR[bi]) * 0.5, d = Math.sqrt(bd), e = Math.min(1, Math.max(0, (d - w * 0.6) / Math.max(d, 1e-3)));
    // (from the near edge of the water, along the line to you, so a wide river isn't heard from its middle)
    const x = R.X[bi] + (p.x - R.X[bi]) * (1 - e), z = R.Z[bi] + (p.z - R.Z[bi]) * (1 - e), loud = Math.max(0, Math.min(1.3, 0.25 + R.SP[bi] * 0.55));
    if (k === 'K') _snd.push({ id: 'lake', kind: 'lake', x, y: R.W[bi], z, k: 1 }); else _snd.push({ id: 'stream', kind: 'stream', x, y: R.W[bi], z, k: loud });
  }
  R.falls.forEach((f, i) => { if ((f.px - p.x) ** 2 + (f.pz - p.z) ** 2 < 460 * 460) _snd.push({ id: 'fall' + i, kind: 'fall', x: f.px, y: f.foot + Math.min(20, f.h * 0.3), z: f.pz, k: 0.55 + f.h / 140 }); });
  return _snd;
}
