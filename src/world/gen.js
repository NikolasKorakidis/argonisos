// World generation for Argonisos: pure, deterministic functions with no three.js dependency, shared by the main thread
// (gameplay: ground height, biome under your feet) and the terrain worker (meshes, colours, vegetation placement).
//
// Layout of the continent (+x east, +z south), radius WORLD.R:
//   Pedias  — the fertile heart: rolling meadows, olive groves, golden fields, 2–30 m. Where every chosen one wakes up.
//   Yleos   — a ring of dark forested hills around it, 30–100 m, misty valleys and ridges.
//   Valtos  — a swamp sector in the south-west running down to the sea, mostly at water level. Sealed by Zeus.
//   Olympos — one great massif rising out of the far hills, rock above the trees and snow on its head, one path up (see PEAK).
//   The sea all around, with beaches and bays.
// Biome borders are domain-warped so they wander like real ones; heights blend across them so there are no seams.
import { lerp, smooth } from '../util/math.js';

export const WORLD = { R: 1450, SIZE: 4096, SEA: 0 };
export const BIOME = { PEDIAS: 0, YLEOS: 1, VALTOS: 2 };
export const BIOME_NAMES = ['Pedias', 'Yleos', 'Valtos'];
const VALTOS_ANG = 2.35;                 // direction of the swamp sector (south-west)

let SEED = 1337;
export function setSeed(s) { SEED = s | 0; }


// ---- Noise: gradient (Perlin) noise from an integer hash, quintic fade; fBm and ridged variants. Gradient noise has no
// grid-aligned blockiness, so ridges and borders wander naturally. Output is 0..1.
function ihash(ix, iz) {
  let h = Math.imul(ix, 374761393) + Math.imul(iz, 668265263) + Math.imul(SEED, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177); return h ^ (h >>> 16);
}
export function hash2(ix, iz) { return (ihash(ix, iz) >>> 0) / 4294967296; }
const GX = new Float32Array(16), GZ = new Float32Array(16);
for (let i = 0; i < 16; i++) { GX[i] = Math.cos(i / 16 * Math.PI * 2); GZ[i] = Math.sin(i / 16 * Math.PI * 2); }
const grad = (i, j, dx, dz) => { const k = ihash(i, j) & 15; return GX[k] * dx + GZ[k] * dz; };   // (outside noise: a closure made each call was garbage)
export function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const a = grad(xi, zi, xf, zf), b = grad(xi + 1, zi, xf - 1, zf), c = grad(xi, zi + 1, xf, zf - 1), d = grad(xi + 1, zi + 1, xf - 1, zf - 1);
  return 0.5 + (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.72;
}
export function fbm(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.3, z * f - i * 9.1); n += a; f *= 2.03; a *= 0.5; } return s / n; }
export function ridged(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(noise(x * f + i * 31.7, z * f + i * 5.3) * 2 - 1); s += a * r * r; n += a; f *= 2.07; a *= 0.5; } return s / n; }

// ---- Biomes: weights (sum to 1) from warped polar position. Without an `out` it returns a new object, so a caller
// may keep it; the hot paths below pass scratch objects of their own (one each, so a nested call never overwrites the
// weights its caller is still reading).
const _hw = { p: 1, y: 0, v: 0, r: 0 }, _mw = { p: 1, y: 0, v: 0, r: 0 }, _gw = { p: 1, y: 0, v: 0, r: 0 }, _aw = { p: 1, y: 0, v: 0, r: 0 };
export function biomeWeights(x, z, out = { p: 1, y: 0, v: 0, r: 0 }) {
  // two layers of domain warp: broad lobes and bays, then wiggles along the border
  let wx = x + (fbm(x * 0.0009 + 11, z * 0.0009, 3) - 0.5) * 1100, wz = z + (fbm(x * 0.0009, z * 0.0009 - 7, 3) - 0.5) * 1100;
  wx += (fbm(wx * 0.004 + 2, wz * 0.004, 2) - 0.5) * 160; wz += (fbm(wx * 0.004, wz * 0.004 + 9, 2) - 0.5) * 160;
  const r = Math.hypot(wx, wz) / WORLD.R, a = Math.atan2(wz, wx);
  let da = Math.abs(a - VALTOS_ANG); if (da > Math.PI) da = Math.PI * 2 - da;
  const v = smooth(0.9, 0.66, da) * smooth(0.5, 0.6, r);
  const p = (1 - v) * smooth(0.6, 0.5, r);
  out.p = p; out.v = v; out.y = Math.max(0, 1 - p - v); out.r = r;
  return out;
}
export function biomeAt(x, z) { const w = biomeWeights(x, z, _aw); return w.v > 0.5 ? BIOME.VALTOS : w.p >= w.y ? BIOME.PEDIAS : BIOME.YLEOS; }

// How far inland a point is: 1 well inland, 0 at the waterline, negative out at sea (bays and headlands from noise)
export function landness(x, z) {
  const r = Math.hypot(x, z) / WORLD.R, n = (fbm(x * 0.0012 + 3, z * 0.0012 - 5, 4) - 0.5) * 0.42 + (fbm(x * 0.006, z * 0.006, 2) - 0.5) * 0.08;
  return (1 + n - r) / 0.12;
}

// ---- The peak: Olympos, one great massif in the far hills of Yleos, its head above the treeline and white with snow.
// sites.js places it once the trial's sites are laid out (so none of them moves) and only then switches it on. Its
// ridges run down from the summit and fork as they go, deep gullies between them; crags stand out high up, and the
// slopes ease into foothills. Its upper slopes are too steep to walk (CLIMB below): one path goes up, laid out with it.
export const PEAK = { on: false, x: 0, z: 0, r: 540, h: 480, snow: 360, a: 0, base: 0, route: [], steps: [] };   // (a: the way the path faces)
export function setPeak(x, z) { PEAK.x = x; PEAK.z = z; PEAK.a = Math.atan2(-z, -x); PEAK.base = rawHeight(x, z); layTowers(); PEAK.on = true; BAND.on = false; layRoute(); BAND.on = true; }
// (under its upper half the hills it stands on are levelled to their height under the summit, so none of them rises
// higher than the top beside it)
const peakFlat = (x, z) => smooth(0.45, 0.12, Math.hypot(x - PEAK.x, z - PEAK.z) / PEAK.r);
export function peakHeight(x, z) {
  if (!PEAK.on) return 0;
  const dx = x - PEAK.x, dz = z - PEAK.z, d = Math.hypot(dx, dz) / PEAK.r; if (d >= 1) return 0;
  // the ridges: crests in noise sampled round a circle that widens with the distance out, so they wander and fork into
  // spurs lower down; the gullies between them cut up to 42% of the height away
  const a = Math.atan2(dz, dx), wa = a + (fbm(x * 0.004 + 7, z * 0.004 - 3, 2) - 0.5) * 0.9 * smooth(0, 0.3, d), s = 0.75 + d * 2.4, cx = Math.cos(wa) * s, cz = Math.sin(wa) * s;
  const r1 = 1 - Math.abs(noise(cx + 3.1, cz - 7.7) * 2 - 1), r2 = 1 - Math.abs(noise(cx * 2.3 - 5.2, cz * 2.3 + 1.9) * 2 - 1);
  const crest = Math.min(1, (r1 * r1 * 0.75 + r2 * r2 * 0.25) * 1.15), da = Math.abs(Math.atan2(Math.sin(a - PEAK.a), Math.cos(a - PEAK.a)));
  // (the face the path climbs, on the side towards the island's heart, is one broad slope without gullies, and under
  // the summit a narrow crest: the ground falls away into a gully either side of the path's line; the top is a rounded
  // dome, the profile measured from dd, a softened distance out)
  // (the upper face round the path's line, pf, smoother still, its gullies shallow and its crags low, so the last
  // zigzags under the crest can be laid across it)
  const lat = Math.abs(Math.sin(a - PEAK.a)) * d * PEAK.r, front = smooth(0.9, 0.5, da), pf = smooth(90, 40, lat) * smooth(0.46, 0.32, d) * front;
  const knife = 0.07 * smooth(3, 13, lat) * smooth(34, 22, lat) * smooth(0.11, 0.07, d) * smooth(0.025, 0.05, d) * front;
  // (and the far side, away from the path, falls away steeper: a great north face, so the massif isn't round)
  const side = smooth(0.5, 0.8, da), gully = (0.21 + 0.21 * smooth(0.22, 0.5, da) + 0.08 * side) * smooth(0.02, 0.2, d) * Math.pow(1 - crest, 1.3 - 0.2 * side) * (1 - 0.8 * pf), dd = peakDd(d) * (1 + 0.25 * smooth(1.6, 2.8, da));
  const prof = Math.pow(Math.max(0, 1 - dd), 1.55) * (1 - gully - knife);
  const crag = (ridged(x * 0.018, z * 0.018, 3) - 0.5) * (0.05 + 0.02 * side) * smooth(0.95, 0.25, d) * smooth(0.04, 0.16, d) * (1 - 0.75 * pf);
  let tw = 0; if (d < 0.36) for (const t of TOWERS) { const r = Math.hypot(x - t.x, z - t.z); if (r < t.r) tw = Math.max(tw, t.h * Math.pow(1 - r / t.r, 1.4)); }
  return PEAK.h * (prof + crag) + tw;
}
// Cliff bands and shoulders (the player, 21 Nov: a smooth, boring cone, and by the slope rule bare rock all over, so
// nothing grew on it and no snow lay): the mountain's height over its foot (y, in metres: its own shape and the hills it
// stands on, rawHeight) is stepped in bands some BAND.T metres high, each a gentle shoulder (where woods, turf and snow
// can lie) and over it a cliff of bare rock, as limestone weathers in its beds. A band wanders up and down round the
// mountain with the noise and is strong in places and all but gone in others; there are none on the summit's dome or
// round the foot. The stepping only ever rises, so the land still falls away from the top everywhere. (BAND.c and w:
// where in each band its cliff stands and how much of it the cliff takes.) A cliff goes straight up from its shoulder,
// with no easing in between: ground of a middling steepness, a little over what slides you back, could be hopped up
// jump by jump (the Olympos suite's steep face), so there is as little of it as the mesh allows.
// The path up is laid out before the bands are (setPeak), on the mountain as it was, and the bands give way round it
// (near: 1 on the path, 0 from BAND.r1 out), so it climbs through each cliff band at a break, as mule tracks do,
// rather than being cut into the cliffs: from afar its zigzags show as a smoother way up through them.
// The beds aren't level: they dip BAND.dip across the massif (towards BAND.dir from the way the path faces), so the bands
// climb round one flank and fall round the other, as tilted strata do, rather than ring it like a wedding cake.
const BAND = { on: false, T: 62, k: 0.86, c: 0.62, w: 0.17, dip: 0.13, dir: 1.3, r0: 11, r1: 15 };
function bands(y, x, z, d, near) {
  // (each band at full strength or none: a band half there, its shoulders still steep and its cliffs not yet sheer, left
  // long stretches of that middling ground)
  const k = BAND.k * (1 - near) * smooth(0.2, 0.235, d) * smooth(0.84, 0.8, d) * smooth(0.4, 0.46, noise(x * 0.0045 + 3.3, z * 0.0045 - 8.1)); if (k <= 0) return y;
  const D = BAND.dip * ((x - PEAK.x) * Math.cos(PEAK.a + BAND.dir) + (z - PEAK.z) * Math.sin(PEAK.a + BAND.dir));
  const T = BAND.T * (0.85 + 0.3 * noise(x * 0.0025 - 6.2, z * 0.0025 + 2.7)), ph = (noise(x * 0.0022 + 9.4, z * 0.0022 - 4.1) - 0.5) * 0.8, u = (y + D) / T + ph, f = Math.floor(u), t = u - f;
  return (f + (1 - k) * t + k * Math.max(0, Math.min(1, (t - BAND.c + BAND.w) / (2 * BAND.w))) - ph) * T - D;
}
const peakDd = (d) => (Math.hypot(d, 0.2) - 0.2) / (Math.hypot(1, 0.2) - 0.2);   // (the softened distance out: a dome on top)
// Crags and towers of rock standing up near the top, away from the path's side, and a second summit a little lower than
// the first behind it (as Olympos has Mytikas and Stefani): each { x, z, r, h }, never as high as the top
const TOWERS = [];
function layTowers() {
  TOWERS.length = 0; PEAK.towers = TOWERS; const P = PEAK, below = (d) => P.h * (1 - Math.pow(1 - peakDd(d), 1.55));
  const add = (a, d, r, h) => TOWERS.push({ x: P.x + Math.cos(a) * d * P.r, z: P.z + Math.sin(a) * d * P.r, r, h: Math.min(h, below(d) - 9) });
  add(P.a + Math.PI - 0.55, 0.12, 24, 99);
  for (let k = 0; k < 9; k++) add(P.a + Math.PI * (0.38 + 1.24 * hash2(k, 401)), 0.13 + 0.2 * hash2(k, 402), 9 + 5 * hash2(k, 403), 14 + 24 * hash2(k, 404));
}
// Climbing Olympos. Where the mountain itself stands more than a quarter of its height above the hills (climbable()),
// ground steeper than CLIMB.up (about 42°) can't be walked up and steeper than CLIMB.slip (about 46°) slides you back
// down (player.js); everywhere else on the island slopes only slow you. So the faces of the upper mountain are closed,
// and the way up is the path laid out below.
// On the path itself the limit is CLIMB.path (and a little more before you slide): its ground is only that steep on the
// inside of its tightest bends, and its rock steps are steeper still, to be jumped (climbLimit: the one to use where).
export const CLIMB = { up: 0.9, slip: 1.05, path: 1.35 };
export const climbLimit = (x, z, slip = false) => routeAt(x, z).k > 0.5 ? CLIMB.path + (slip ? 0.2 : 0) : slip ? CLIMB.slip : CLIMB.up;
export const climbable = (x, z) => PEAK.on && Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.r * 0.7 && peakHeight(x, z) > PEAK.h * 0.25;
// The way up: a mule track from the foot of the steep ground on the side facing the island's heart, climbing across the
// face at a steady grade in switchbacks (each leg follows the lie of the land, in and out of the gullies, turning back
// at the edge of its stretch of mountainside), then a short crest to the top with a few rock steps to jump. The path is
// cut into the slope, a bench a few metres wide with a wall on one side and a drop on the other, its bed a little worn in
// the middle and leaning out to shed the rain (routeAt); PEAK.route keeps its line ({ x, z, y, s } every 2 m: the
// cairns and the tests follow it), PEAK.turns where each leg turns back and PEAK.crest where the crest begins (indices
// into it), and PEAK.steps the rock steps ({ x, z, y, a }: the foot of each, and the way it faces).
// (The player, 21 Nov: the way up wasn't smooth. It climbed at whatever the land did, level and then 68%; now its grade
// changes gently, some 33% low down, 44% at the most on the open face and 62% in the last zigzags under the top, and
// its rock steps are a metre high, each one a single jump.)
const ROUTE = { on: false, pts: [], grid: new Map(), near: new Map(), crestFrom: 0, box: [0, 0, 0, 0], dn: null };
const RG = 16, PATH = { w: 2.6, b: 3.5, cw: 1.7, cb: 2.6, grade: 0.34, most: 0.44, top: 0.62, rise: 1.0, gap: 3.5, steps: 8, steep: 0.65, crest: 0.3, camber: 0.035, dish: 0.06 };
const TRIES = []; for (const wk of [1, 0.9, 1.1, 0.8, 1.25]) for (const g of [0, 0.02, -0.02, 0.04]) TRIES.push([PATH.grade + g, wk]);
function layRoute() {
  const P = PEAK; ROUTE.on = false; ROUTE.pts = []; ROUTE.grid.clear(); ROUTE.near.clear();
  const hAt = (x, z) => rawHeight(x, z), dOf = (x, z) => Math.hypot(x - P.x, z - P.z) / P.r, most = (d) => PATH.most + (PATH.top - PATH.most) * smooth(0.32, 0.22, d);   // (the last zigzags under the summit a little steeper)
  const ux = Math.cos(P.a), uz = Math.sin(P.a), top = hAt(P.x, P.z) - 1.5, tx = P.x + ux * 9, tz = P.z + uz * 9;
  // the trailhead: on the line out from the summit towards the island's heart, where the climbing rule is about to begin
  let d0 = 0.75; while (d0 > 0.3 && peakHeight(P.x + ux * d0 * P.r, P.z + uz * d0 * P.r) < P.h * 0.22) d0 -= 0.005;
  // (laid out for a few grades and widths of leg in turn, the first kept that never comes back within 9 m of itself, the
  // crest included: where the land's folds draw two legs together the bench of one would cut through the other)
  const trace = (grade, wide) => {
    let x = P.x + ux * d0 * P.r, z = P.z + uz * d0 * P.r, hx = -ux, hz = -uz, side = 1, leg = 0, lat0 = 0;
    const pts = [[x, z]], Z = [hAt(x, z)], turns = []; let done = false;
    for (let i = 0; i < 2000 && dOf(x, z) > 0.06; i++) {
      const e = 3, gx = (hAt(x + e, z) - hAt(x - e, z)) / (2 * e), gz = (hAt(x, z + e) - hAt(x, z - e)) / (2 * e), m = Math.hypot(gx, gz) || 1e-6, dd = dOf(x, z), gr = grade + (PATH.top - 0.04 - grade) * smooth(0.42, 0.22, dd);   // (steeper under the summit, in tighter zigzags)
      // (aiming lower across the land while the path lags under it, so the two meet again: on steep ground the bench
      // would otherwise sink into a trench)
      const lag = hAt(x, z) - Z.at(-1), gt = Math.max(-0.25, Math.min(gr + 0.08, gr - 0.04 * lag));
      let ax = gx / m, az = gz / m; if (m > gt) { const c = Math.max(-1, gt / m), sn = Math.sqrt(1 - c * c) * side; ax = gx / m * c - gz / m * sn; az = gz / m * c + gx / m * sn; }
      // (turning at most 30° each 2 m, so a hairpin bends round in a tight curve; always round by the uphill side, or it
      // could loop back down across itself)
      let turn = Math.atan2(hx * az - hz * ax, hx * ax + hz * az); if (Math.abs(turn) > 2.4) turn = Math.abs(turn) * Math.sign(hx * gz - hz * gx || 1);
      const t = Math.max(-0.52, Math.min(0.52, turn)), ch = Math.cos(t), sh = Math.sin(t);
      [hx, hz] = [hx * ch - hz * sh, hx * sh + hz * ch];
      x += hx * 2; z += hz * 2; leg += 2; pts.push([x, z]);
      // its height: the land's, but never falling and never climbing steeper than most() (cut in where the land is steeper)
      Z.push(Math.min(Z.at(-1) + most(dd) * 2, Math.max(Z.at(-1), hAt(x, z))));
      // how far to the side of the line: each leg turns back at the edge of a stretch that narrows towards the top, until
      // the path crosses the line under the summit high enough to finish up the crest with a few rock steps
      const lat = (x - P.x) * -uz + (z - P.z) * ux, edge = (44 + 46 * smooth(0.1, 0.6, dd)) * wide;
      // (and back sooner where it would come within 14 m of a stretch of itself further down: a heightfield can't carry
      // one path over another)
      const near = leg > 30 && pts.length > 40 && pts.slice(0, -30).some(([px, pz]) => (px - x) * (px - x) + (pz - z) * (pz - z) < 196);
      if (leg > 20 && ((Math.abs(lat) > edge && (lat - lat0) * lat > 0) || near)) { side = -side; leg = 0; turns.push(pts.length - 1); }
      if (dd < PATH.crest && lat * lat0 <= 0 && top - Z.at(-1) < Math.hypot(tx - x, tz - z) * PATH.steep * 0.95 + PATH.steps * PATH.rise * 0.8) { done = true; break; }
      lat0 = lat;
    }
    const all = pts.slice(), [cx, cz] = pts.at(-1), n = Math.ceil(Math.hypot(tx - cx, tz - cz) / 2); for (let i = 1; i <= n; i++) all.push([cx + (tx - cx) * i / n, cz + (tz - cz) * i / n]);
    let close = 1e9; for (let i = 0; i < all.length; i++) for (let j = i + 6; j < all.length; j++) { const q = Math.hypot(all[i][0] - all[j][0], all[i][1] - all[j][1]); close = Math.min(close, j - i < 26 ? q + 4 : q); }   // (a hairpin's legs may come 5 m apart)
    if (!done && top - Z.at(-1) < Math.hypot(tx - x, tz - z) * (PATH.steep + PATH.rise / PATH.gap)) done = true;   // (or it came out under the top close enough for the crest)
    return { pts, Z, turns, close: done ? close : -1 };   // (one that never came out onto the crest is no good at all)
  };
  let best = null;
  for (const [g, wk] of TRIES) { const r = trace(g, wk); if (!best || r.close > best.close) best = r; if (r.close >= 9) break; }
  const { pts, Z, turns } = best;
  ROUTE.crestFrom = pts.length - 1;
  // the crest: straight up the ridge from the last bend to the edge of the summit's flat top (sites.js levels it)
  const [cx, cz] = pts[pts.length - 1], n = Math.ceil(Math.hypot(tx - cx, tz - cz) / 2);
  for (let i = 1; i <= n; i++) pts.push([cx + (tx - cx) * i / n, cz + (tz - cz) * i / n]);
  let s = 0; const S = pts.map((p, i) => (i ? (s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0)), c0 = ROUTE.crestFrom;
  // up to the crest, evened out: a rise the land makes at once is spread back over the stretch before it, and the whole
  // smoothed over some 26 m, so the grade changes gently (never falling, never over most())
  const Y = Z.slice(0, c0 + 1), M = pts.map(([px, pz]) => most(dOf(px, pz)) * 2);
  for (let pass = 0; pass < 4; pass++) {
    for (let i = c0 - 1; i >= 0; i--) Y[i] = Math.max(Y[i], Y[i + 1] - M[i + 1]);
    const c = Y.slice(); for (let i = 1; i < c0; i++) { let a = 0, k = 0; for (let j = Math.max(0, i - 6); j <= Math.min(c0, i + 6); j++) { a += c[j]; k++; } Y[i] = a / k; }
    for (let i = 1; i <= c0; i++) Y[i] = Math.min(Y[i - 1] + M[i], Math.max(Y[i - 1], Y[i]));
  }
  // on the crest: the land's height along it, but climbing no steeper than PATH.steep, and wherever that leaves the path a
  // step's height under the land, a rock step of PATH.rise (PATH.gap apart at the least, a sharp face half a metre deep, so
  // it reads as a step and is jumped in one go); so it keeps to the top of the crest
  const sC = S[c0], L = S[S.length - 1] - sC, line = (q) => { const t = (q - sC) / L, k = Math.max(0, Math.min(1, t)); return hAt(cx + (tx - cx) * k, cz + (tz - cz) * k); };
  const n2 = Math.ceil(L / 0.5), B = new Float32Array(n2 + 1), steps = []; B[0] = Y[c0];
  for (let i = 1, y = Y[c0], last = -9; i <= n2; i++) {   // (B: the walking part, the steps added on top)
    const q = sC + i * 0.5, want = Math.max((line(q - 1.5) + line(q) + line(q + 1.5)) / 3, top - Math.max(0, sC + L - q - 11) * PATH.steep) - steps.length * PATH.rise;   // (level with the top by the flat top's edge)
    y += Math.max(0, Math.min(PATH.steep * 0.5, want - y)); B[i] = y;
    if (want - y > PATH.rise && q - last > PATH.gap && q < sC + L - 1) { steps.push(q); last = q; }
  }
  ROUTE.Hc = (q) => { const f = Math.max(0, Math.min(n2, (q - sC) / 0.5)), i = Math.min(n2 - 1, Math.floor(f)); let y = B[i] + (B[i + 1] - B[i]) * (f - i); for (const k of steps) y += PATH.rise * smooth(k, k + 0.5, q); return y; };
  ROUTE.pts = pts.map(([px, pz], i) => ({ x: px, z: pz, s: S[i], y: i > c0 ? ROUTE.Hc(S[i]) : Y[i] }));
  P.route = ROUTE.pts; P.turns = turns; P.crest = c0; P.steps = steps.map((q) => ({ x: cx + (tx - cx) * (q - sC) / L, z: cz + (tz - cz) * (q - sC) / L, y: ROUTE.Hc(q), a: Math.atan2(tx - cx, tz - cz) }));
  // which side of each stretch the land falls away to (+1 the right going up, -1 the left), for the bed's lean
  ROUTE.dn = new Int8Array(pts.length); for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1], l = Math.hypot(bx - ax, bz - az) || 1, nx = (bz - az) / l, nz = -(bx - ax) / l, mx = (ax + bx) / 2, mz = (az + bz) / 2; ROUTE.dn[i] = hAt(mx + nx * 7, mz + nz * 7) < hAt(mx - nx * 7, mz - nz * 7) ? 1 : -1; }
  const m = PATH.w + PATH.b; ROUTE.box = [Math.min(...pts.map((p) => p[0])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[1])) + m];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    for (let gx = Math.floor((Math.min(ax, bx) - m) / RG); gx <= Math.floor((Math.max(ax, bx) + m) / RG); gx++) for (let gz = Math.floor((Math.min(az, bz) - m) / RG); gz <= Math.floor((Math.max(az, bz) + m) / RG); gz++) {
      const key = gx + ',' + gz; (ROUTE.grid.get(key) || ROUTE.grid.set(key, []).get(key)).push(i);
    }
    for (let gx = Math.floor((Math.min(ax, bx) - BAND.r1) / NG); gx <= Math.floor((Math.max(ax, bx) + BAND.r1) / NG); gx++) for (let gz = Math.floor((Math.min(az, bz) - BAND.r1) / NG); gz <= Math.floor((Math.max(az, bz) + BAND.r1) / NG); gz++) {
      const key = padKey(gx, gz); (ROUTE.near.get(key) || ROUTE.near.set(key, []).get(key)).push(i);
    }
  }
  ROUTE.on = true;
}
// how near the path (x, z) lies, for the bands: 1 within BAND.r0 of its line, 0 from BAND.r1 out (a coarser grid of its
// stretches of its own, NG metres a cell, numbers for keys: rawHeight asks it everywhere on the mountain)
const NG = 32;
function routeNear(x, z) {
  if (!ROUTE.on) return 0; const list = ROUTE.near.get(padKey(Math.floor(x / NG), Math.floor(z / NG))); if (!list) return 0;
  const pts = ROUTE.pts; let bd = 1e9;
  for (let j = 0; j < list.length; j++) { const a = pts[list[j]], b = pts[list[j] + 1], ex = b.x - a.x, ez = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez))), dx = x - a.x - ex * t, dz = z - a.z - ez * t; bd = Math.min(bd, dx * dx + dz * dz); }
  return smooth(BAND.r1, BAND.r0, Math.sqrt(bd));
}
// The path at (x, z): { k, y, s }: k how much of the ground is the path's (1 on it, 0 beyond its banks), y its height
// and s how far along it
const _rt = { k: 0, y: 0, s: 0 };
export function routeAt(x, z, out = _rt) {
  out.k = 0; const B = ROUTE.box; if (!ROUTE.on || x < B[0] || x > B[1] || z < B[2] || z > B[3]) return out; const list = ROUTE.grid.get(Math.floor(x / RG) + ',' + Math.floor(z / RG)); if (!list) return out;
  const pts = ROUTE.pts, n = list.length, D = _rd.length < n ? (_rd = new Float64Array(n * 2)) : _rd, Q = _rq.length < n ? (_rq = new Float64Array(n * 2)) : _rq; let bd = 1e9, bs = 0, bi = 0;
  for (let j = 0; j < n; j++) {
    const i = list[j], a = pts[i], b = pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, t = Math.max(0, Math.min(1, ((x - a.x) * ex + (z - a.z) * ez) / (ex * ex + ez * ez)));
    D[j] = Math.hypot(x - a.x - ex * t, z - a.z - ez * t); Q[j] = a.s + (b.s - a.s) * t; if (D[j] < bd) { bd = D[j]; bi = i; bs = Q[j]; }
  }
  const crest = bi >= ROUTE.crestFrom, w = crest ? PATH.cw : PATH.w, b = crest ? PATH.cb : PATH.b; if (bd >= w + b) return out;
  // its height: along the nearest stretch, blended over the bends (where the nearest piece of the line changes, so the
  // ground doesn't step); where two legs of a switchback come close, the ground between them ramps from one to the other.
  // Below the crest its bed is worn a little lower in the middle and leans out towards the drop (bed()).
  let hy = 0, hw = 0, wy = 0, wk = 0; out.k = smooth(w + b, w, bd);
  for (let j = 0; j < n; j++) {
    if (Math.abs(Q[j] - bs) < 14) { const q = Math.exp((bd - D[j]) / 0.6); hy += (routeY(Q[j]) + (crest ? 0 : bed(list[j], x, z, D[j]))) * q; hw += q; continue; }
    const k = smooth(PATH.w + PATH.b, PATH.w, D[j]); if (k <= 0) continue;
    wy += routeY(Q[j]) * k / (D[j] * D[j] + 0.25); wk += k / (D[j] * D[j] + 0.25); out.k = Math.max(out.k, k);
  }
  const k0 = smooth(w + b, w, bd) / (bd * bd + 0.25); out.s = bs; out.y = (hy / hw * k0 + wy) / (k0 + wk); return out;
}
let _rd = new Float64Array(64), _rq = new Float64Array(64);
function bed(i, x, z, d) {   // (how much lower than the path's line its bed lies at (x, z), d from stretch i's line)
  const a = ROUTE.pts[i], b = ROUTE.pts[i + 1], ex = b.x - a.x, ez = b.z - a.z, side = ((x - a.x) * ez - (z - a.z) * ex) / (Math.hypot(ex, ez) || 1) * ROUTE.dn[i], u = Math.min(1, d / PATH.w);
  return -PATH.camber * Math.max(-PATH.w, Math.min(PATH.w, side)) - PATH.dish * (1 - u * u);
}
function routeY(s) {
  const pts = ROUTE.pts, c = pts[ROUTE.crestFrom]; if (s >= c.s) return ROUTE.Hc(s);
  let lo = 0, hi = ROUTE.crestFrom; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi]; return a.y + (b.y - a.y) * Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
}

// The lie of the land up close: bumps and dips of a few metres to a few tens of metres on top of the broad hills, so the
// ground is never smooth underfoot. Each biome has its own (the reviewer, 16 Nov: the biomes must feel different
// underfoot): the meadows gentle and open, long low swells with hardly a bump; the forest hills broken and rough,
// hummocks and hollows among the trees; the marsh all but flat. Switched on once the sites are laid out (sites.js), so
// it can't move them; their pads stay flat. Nothing finer than ~6 m: the nearest terrain is drawn with a vertex every
// 2 m, and the ground you walk on must match the ground you see.
export const DETAIL = { on: false };
export function setDetail(on) { DETAIL.on = on; }
function detail(x, z, w) {
  const big = noise(x * 0.04 + 31.7, z * 0.04 - 12.9) - 0.5, mid = noise(x * 0.09 - 5.3, z * 0.09 + 44.1) - 0.5, fine = noise(x * 0.16 + 70.2, z * 0.16 - 3.4) - 0.5;
  return w.p * (big * 2.6 + mid * 0.9 + fine * 0.25) + w.y * (big * 8 + mid * 2.8 + fine * 1.2) + w.v * (big * 0.8 + mid * 0.4);   // (the forest's no steeper overall: the slope rule already makes rock of some 40% of it, slopes suite)
}
const MEADOW_SMOOTH = 0.6;   // (how much of the meadows' smaller swells goes once the sites are laid out)

// ---- Height (metres above sea level)
export function rawHeight(x, z, w = biomeWeights(x, z, _hw)) {
  // (once the sites are laid out, DETAIL, the meadows' smaller swells are mostly smoothed away: open, gentle land)
  const hp = 2.2 + fbm(x * 0.0032, z * 0.0032, 4) * 24 + ((fbm(x * 0.017, z * 0.017, 2) - 0.5) * 3.5          // meadows,
    + (fbm(x * 0.06 + 13, z * 0.06 - 7, 2) - 0.5) * 0.7) * (DETAIL.on ? 1 - MEADOW_SMOOTH : 1);                       // with a gentle unevenness underfoot
  const rise = smooth(0.5, 0.78, w.r);                                                                         // foothills first, ridges deeper in
  const hy = 16 + rise * 18 + (ridged(x * 0.0027 + 4, z * 0.0027 - 2, 4) * 60 + fbm(x * 0.011, z * 0.011, 3) * 14) * (0.25 + 0.75 * rise);   // forest hills
  const hv = -0.15 + (fbm(x * 0.013 + 7, z * 0.013, 3) - 0.5) * 3.6 + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.8;    // marsh: islands and pools
  let h = w.p * hp + w.y * hy + w.v * hv;
  if (PEAK.on) { const k = peakFlat(x, z), d = Math.hypot(x - PEAK.x, z - PEAK.z) / PEAK.r; if (k > 0) h = lerp(h, PEAK.base, k); h += peakHeight(x, z) * (1 - w.v) * (1 - 0.75 * w.p * smooth(0.5, 0.85, d)); if (d < 0.9 && BAND.on) h = PEAK.base + bands(h - PEAK.base, x, z, d, routeNear(x, z)); }   // (its foothills die away into the meadows; its cliff bands)
  const L = landness(x, z);
  if (DETAIL.on) h += detail(x, z, w) * smooth(1.6, 3.2, L) * (PEAK.on ? 1 - 0.7 * smooth(0.95, 0.7, Math.hypot(x - PEAK.x, z - PEAK.z) / PEAK.r) : 1);   // (the beaches stay smooth; Olympos's own shape, its bands, is broken enough)
  if (ROUTE.on) { const r = routeAt(x, z); if (r.k > 0) h = lerp(h, r.y, r.k); }   // (the path up Olympos, cut into its slopes)
  const beach = 0.6 + fbm(x * 0.02, z * 0.02, 2) * 1.6;
  if (L < 1.6) h = lerp(lerp(-24, beach, smooth(-1.4, 0.15, L)), h, smooth(0.15, 1.6, L));   // shelf → beach → land
  return h;
}

// Flattened pads for sites (temples, ruins, the starting meadow): registered once, applied on top of the raw height
const PADS = [];   // { x, z, r0, r1, y }
const PAD_CELL = 256, PAD_GRID = new Map();
// (a cell's key as a number, not a string: heightAt is asked thousands of times a frame, and each string was garbage)
const padKey = (i, j) => (i + 4096) * 8192 + (j + 4096);
export function addPad(x, z, r0, r1, y = rawHeight(x, z)) {
  const pad = { x, z, r0, r1, y }; PADS.push(pad);
  for (let i = Math.floor((x - r1) / PAD_CELL); i <= Math.floor((x + r1) / PAD_CELL); i++) for (let j = Math.floor((z - r1) / PAD_CELL); j <= Math.floor((z + r1) / PAD_CELL); j++) {
    const k = padKey(i, j); (PAD_GRID.get(k) || PAD_GRID.set(k, []).get(k)).push(pad);
  }
  return pad;
}
export function heightAt(x, z) {
  let h = rawHeight(x, z);
  const cell = PAD_GRID.get(padKey(Math.floor(x / PAD_CELL), Math.floor(z / PAD_CELL)));
  if (cell) for (const p of cell) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r1) { const t = smooth(p.r0, p.r1, d); h = lerp(p.y, h, t); } }
  const cv = CAVE_GRID.get(padKey(Math.floor(x / PAD_CELL), Math.floor(z / PAD_CELL)));
  if (cv) for (const c of cv) h = caveGround(c, x, z, h);
  return RIVER_HOOK.h ? RIVER_HOOK.h(x, z, h) : h;   // (the river's channel and valley, cut last: river.js)
}
// The river (river.js) lays its course once the sites are placed and then carves its channel into the height and
// colours its banks through these, so the generator needn't import it (river.js reads the land from here)
export const RIVER_HOOK = { h: null, c: null };
export function setRiverHook(h, c) { RIVER_HOOK.h = h; RIVER_HOOK.c = c; }

// ---- The Giants' caves (sites.js places them, after everything else, so nothing moves): each in a hill of its own on a
// hillside, rounded and wooded, with a cliff on its downhill face and the cave's mouth at the cliff's foot. A heightfield
// can't hollow out a hill, so the ground is cut down to the cave's floor under the chamber, its mouth and the cliff over
// it, and the hill's rock over them is a mesh (structures.js cave(), cave.js) drawn in the terrain's own material, its
// top following the hill (caveHill) and coloured by groundColor, so nothing shows where it meets the ground round it.
// Everything is measured in a cave's own frame: u across, v out of the mouth, from the middle of the mouth's floor (the
// site's point), heights from its floor (the site's y).
//   VC the chamber's middle, RX and RZ its half widths at the floor, HC its height; MZ where the cliff stands over the
//   mouth, WM half the passage's width and HM its height; the hill's middle (HZ), radius (HR) and height (HH); how far
//   beyond the walls the ground is still cut down (MARGIN: past the mesh's walls even where the noise pushes them out, so
//   the 2 m terrain mesh never pokes into the chamber) and over how many metres it comes back up to the hill (RAMP).
export const CAVE_FORM = { VC: -8.5, RX: 7.2, RZ: 8.2, HC: 8.6, MZ: 2.6, WM: 3.9, HM: 7.4, HZ: -10, HR: 46, HH: 13.5, MARGIN: 3.8, RAMP: 1.6 };
export const CAVES = [];
export const CAVE = { cut: true };   // (off: the hill whole, as the mesh over the cave sees it and the grass grows on it)
const CAVE_GRID = new Map(), CF = CAVE_FORM;
export function addCave(x, z, y, rot, seed) {
  const c = { x, z, y, rot, cs: Math.cos(rot), sn: Math.sin(rot), seed, reach: -CF.HZ + CF.HR * 1.22 }; CAVES.push(c);
  for (let i = Math.floor((x - c.reach) / PAD_CELL); i <= Math.floor((x + c.reach) / PAD_CELL); i++) for (let j = Math.floor((z - c.reach) / PAD_CELL); j <= Math.floor((z + c.reach) / PAD_CELL); j++) {
    const k = padKey(i, j); (CAVE_GRID.get(k) || CAVE_GRID.set(k, []).get(k)).push(c);
  }
  return c;
}
// world → the cave's frame [u, v]; and back
export const caveLocal = (c, x, z) => { const dx = x - c.x, dz = z - c.z; return [dx * c.cs - dz * c.sn, dx * c.sn + dz * c.cs]; };
export const caveWorld = (c, u, v) => [c.x + u * c.cs + v * c.sn, c.z - u * c.sn + v * c.cs];
// how far out from the chamber's middle a point is, as a share of the chamber's floor outline there (1 on the wall at
// the floor); the outline wobbles with the noise, so no two caves are the same oval
export function caveRho(c, u, v) {
  const du = u / CF.RX, dv = (v - CF.VC) / CF.RZ, a = Math.atan2(dv, du);
  return Math.hypot(du, dv) / (1 + 0.24 * (noise(Math.cos(a) * 1.4 + c.seed, Math.sin(a) * 1.4 - c.seed) - 0.5));
}
// where the cliff's foot runs (v along u): out in front of the mouth, curving back on either side
export const caveCliff = (c, u) => CF.MZ + 0.4 - 0.03 * u * u + (noise(u * 0.11 + c.seed, 5.3) - 0.5) * 3.2 + (noise(u * 0.37 - c.seed, 8.1) - 0.5) * 1.1;
// signed distance (m, roughly) from the cut-down ground's edge: the chamber and passage grown by MARGIN, and a band
// across the cliff's face; negative inside
export function caveCut(c, u, v) {
  const ch = (caveRho(c, u, v) - 1) * CF.RX, pa = Math.max(Math.abs(u) - CF.WM, CF.VC - v, v - CF.MZ - 1), vc = caveCliff(c, u);
  return Math.min(Math.min(ch, pa) - CF.MARGIN, Math.max(Math.abs(u) - 12, vc - 4.5 - v, v - vc - 2.6));
}
// the cave's floor: rising a little towards the back, never quite level
export const caveFloor = (c, u, v) => c.y + 0.55 * smooth(CF.VC + 2, CF.VC - CF.RZ, v) + (noise(u * 0.3 + c.seed, v * 0.3) - 0.5) * 0.3;
// The hill: a rounded mound behind the mouth (its outline and top lumpy with noise) that merges with any higher ground
// round it (a soft maximum, so there's no crease), cut away in front by the cliff, which dies away to either side into
// the hill's flanks. base is the land as it was (with the site's levelled pad in front of the mouth).
export function caveHill(c, u, v, base) {
  const du = u, dv = v - CF.HZ, a = Math.atan2(dv, du), R = CF.HR * (1 + 0.36 * (noise(Math.cos(a) * 1.2 - c.seed, Math.sin(a) * 1.2 + c.seed) - 0.5));
  const q = Math.hypot(du, dv) / R; if (q >= 1) return base;
  const top = c.y + (CF.HH + (fbm(u * 0.045 + c.seed, v * 0.045 - c.seed, 3) - 0.5) * 6) * (1 - q * q) ** 2;
  const k = 5, hh = Math.max(k - Math.abs(top - base), 0) / k, hill = Math.max(top, base) + hh * hh * k * 0.25;
  const vc = caveCliff(c, u), cl = smooth(vc + 2.4, vc - 0.3, v), side = smooth(8, 17, Math.abs(u)), w = cl + (1 - cl) * side;
  return base + (hill - base) * w;
}
// the ground at (x, z) round cave c, from the land as it was (h): the hill, cut down to the floor in the cave
function caveGround(c, x, z, h) {
  const [u, v] = caveLocal(c, x, z); if (u * u + (v - CF.HZ) * (v - CF.HZ) > c.reach * c.reach) return h;
  const hill = caveHill(c, u, v, h); if (!CAVE.cut) return hill;
  const cd = caveCut(c, u, v); return cd >= CF.RAMP ? hill : lerp(caveFloor(c, u, v), hill, smooth(0, CF.RAMP, cd));
}
// how far into a cave (x, z) lies, for the colour of its floor: [inside (0 outside … 1 within the walls), depth (0 at the
// mouth … 1 at the back)], or null away from the caves
export function caveIn(x, z) {
  const cv = CAVE_GRID.get(padKey(Math.floor(x / PAD_CELL), Math.floor(z / PAD_CELL))); if (!cv) return null;
  for (const c of cv) {
    const [u, v] = caveLocal(c, x, z); if (Math.abs(u) > 16 || v < CF.VC - CF.RZ - 6 || v > CF.MZ + 31) continue;
    const ch = (caveRho(c, u, v) - 1) * CF.RX, pa = Math.max(Math.abs(u) - CF.WM, CF.VC - v, v - CF.MZ - 0.5), d = Math.min(ch, pa);
    // (the trodden earth runs out of the mouth and fades a few metres beyond it, and a path worn by his feet goes on down
    // the hill from there, wandering a little)
    const apron = smooth(CF.MZ + 9, CF.MZ + 2, v) * smooth(CF.WM + 3, CF.WM - 0.5, Math.abs(u)) * smooth(CF.VC, CF.MZ - 2, v);
    const path = smooth(1.5, 0.7, Math.abs(u - (noise(v * 0.08 + c.seed, 2.2) - 0.5) * 2.2)) * smooth(CF.MZ + 30, CF.MZ + 22, v) * smooth(CF.MZ + 4, CF.MZ + 8, v) * (0.75 + 0.25 * noise(u * 0.6, v * 0.6));
    return [Math.max(smooth(1.5, -1.0, d), apron * 0.75, path * 0.6), smooth(CF.MZ, CF.VC - CF.RZ * 0.7, v)];
  }
  return null;
}

// ---- Steepness: one measure for everything that depends on it (bare rock on steep ground, where plants may grow, what
// lies about), so they can never disagree. Grade is rise over run, measured across 8 m (4 m either side), so a hillside
// counts and a hummock doesn't. Above ROCK_GRADE (47%, about 25°) the ground is bare rock: no grass, flowers, bushes or
// trees grow there, and only stones lie on it. So that the rock's edge isn't a clean line along the slope, noise lowers
// the limit here and there (rockLimit, never above ROCK_GRADE): ragged tongues of rock reach a little way down onto
// gentler ground, while everything steeper than ROCK_GRADE is rock without exception (tester feedback, 15 and 16 Oct).
export const ROCK_GRADE = 0.47;
export function slopeGrade(x, z) { return Math.hypot(heightAt(x + 4, z) - heightAt(x - 4, z), heightAt(x, z + 4) - heightAt(x, z - 4)) / 8; }
export const rockLimit = (x, z) => ROCK_GRADE - 0.06 * smooth(0.42, 0.72, fbm(x * 0.07 + 13, z * 0.07 - 29, 2));
export const isRock = (x, z) => heightAt(x, z) > 0.3 && slopeGrade(x, z) > rockLimit(x, z);

// Worn paths across the meadows: thin winding lines of bare earth (where a warped noise crosses its middle), some 2-3 m
// wide, broken into stretches so they wander off and fade rather than net the whole plain; only on gentle ground in
// Pedias. 0 off a path, 1 on one. (The grass grows thin on them too: terrain-worker.js grassTex.)
export function meadowPath(x, z, w = biomeWeights(x, z, _mw)) {
  if (w.p < 0.3) return 0;
  const wx = x + (noise(x * 0.01 + 5, z * 0.01) - 0.5) * 60, wz = z + (noise(x * 0.01, z * 0.01 - 9) - 0.5) * 60;
  const n = Math.abs(noise(wx * 0.0045 + 17, wz * 0.0045 - 3) - 0.5), line = smooth(0.0085, 0.004, n);
  return line > 0 ? line * smooth(0.42, 0.55, noise(x * 0.006 - 30, z * 0.006 + 12)) * smooth(0.3, 0.6, w.p) : 0;
}
// ---- Ground colour (linear-ish RGB 0..1), from biome weights, height, slope and a few noise layers
const C = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const PAL = {
  meadow: C(0x5b8a32), meadow2: C(0x6f9a3a), golden: C(0xb0a24e), dry: C(0x8f8a42), sunlit: C(0x86a23c), path: C(0x8a7650),
  forest: C(0x2a2a1b), moss: C(0x2f4a24), needles: C(0x4f3520), humus: C(0x1f1b13), fern: C(0x34431f),
  mud: C(0x2f2a1d), marshMoss: C(0x3a4424), reedy: C(0x4f5833), pool: C(0x1d2018),
  soil: C(0x6b5a3f), sand: C(0xd9c48e), wetSand: C(0xb8a272), seabed: C(0x9c8c62), rock: C(0x7f786d), rock2: C(0x6a645b), snow: C(0xbcc4ce), scree: C(0x7d776d), track: C(0x6f6655),
  maquis: C(0x3f4d24), maquis2: C(0x55482c), lime: C(0x64635f), lime2: C(0x9a9890), ochre: C(0x7d6342), rust: C(0x6e4a36), darkRock: C(0x3c3a36), scree2: C(0x9d968a), alpine: C(0x6c6f45), pines: C(0x2f3b22), track2: C(0x877c64),   // (Olympos)   // (snow a little blue-grey: pure white burned out in the sun)
  caveEarth: C(0x3f3528), caveRock: C(0x4d4740),
};
// how much darker a cave's floor and walls are the deeper in they lie (0 at the mouth, 1 at the back): the light from
// the mouth falls off (the sky's light on everything else isn't shadowed, so the darkness has to be in the colour)
export const caveShade = (d) => 1 - 0.74 * d;
const mix3 = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; return o; };
export function groundColor(x, z, h, slope, w = biomeWeights(x, z, _gw), out = [0, 0, 0]) {
  // Each biome its own ground (the reviewer, 16 Nov: the biomes must look different underfoot; the terrain shader adds
  // each one's own texture over these, terrain.js floorGround).
  // Pedias: sunny green meadow with golden fields, brighter sunlit swards, dry patches and worn paths of bare earth
  const pc = PAL.meadow.slice(); mix3(pc, PAL.meadow2, fbm(x * 0.05, z * 0.05, 2)); mix3(pc, PAL.sunlit, smooth(0.55, 0.72, fbm(x * 0.011 - 21, z * 0.011 + 6, 2)) * 0.5);
  mix3(pc, PAL.golden, smooth(0.56, 0.66, fbm(x * 0.006 + 40, z * 0.006, 3)) * 0.85);
  mix3(pc, PAL.dry, smooth(0.5, 0.7, fbm(x * 0.02 - 9, z * 0.02, 2)) * 0.45);
  if (w.p > 0.05) mix3(pc, PAL.path, meadowPath(x, z) * 0.8);
  // Yleos: a dark loam of humus, deep green moss in patches, rusty needle litter under the conifers and the odd fern
  // bed, varied at two scales so the forest floor never reads as one colour
  const yc = PAL.forest.slice(); mix3(yc, PAL.humus, smooth(0.45, 0.7, fbm(x * 0.09 - 3, z * 0.09 + 11, 2)) * 0.7);
  mix3(yc, PAL.moss, smooth(0.42, 0.68, fbm(x * 0.04 + 5, z * 0.04, 2)) * 0.85); mix3(yc, PAL.needles, smooth(0.5, 0.68, fbm(x * 0.03, z * 0.03 + 8, 2)) * 0.75);
  mix3(yc, PAL.fern, smooth(0.6, 0.75, fbm(x * 0.018 + 70, z * 0.018 - 40, 2)) * 0.6);
  // Valtos: wet mud, dark green-brown, marsh moss and reedy tussocks, and darker sodden hollows where water stands
  const vc = PAL.mud.slice(); mix3(vc, PAL.marshMoss, fbm(x * 0.06, z * 0.06, 2)); mix3(vc, PAL.reedy, smooth(0.55, 0.7, fbm(x * 0.02 + 3, z * 0.02, 2)) * 0.5);
  mix3(vc, PAL.pool, smooth(0.55, 0.7, fbm(x * 0.035 - 13, z * 0.035 + 2, 2)) * 0.7);
  out[0] = pc[0] * w.p + yc[0] * w.y + vc[0] * w.v; out[1] = pc[1] * w.p + yc[1] * w.y + vc[1] * w.v; out[2] = pc[2] * w.p + yc[2] * w.y + vc[2] * w.v;
  // beaches and seabed (not in the swamp, which goes straight into the water)
  const sandy = (1 - w.v * 0.9) * smooth(2.6 + fbm(x * 0.03, z * 0.03, 2) * 1.2, 1.2, h);
  mix3(out, h < 0.3 ? PAL.wetSand : PAL.sand, sandy);
  if (h < -0.6) mix3(out, PAL.seabed, smooth(-0.6, -4, h));
  // bare rock on steep ground (the slope rule above): broken up by noise into patches of exposed rock of different
  // greys, with stony soil showing here and there, never one flat colour; just below the limit a fringe of bare earth,
  // patchy too, so the edge is ragged rather than a line
  // out[3] says how much of the rock surface the terrain shader lays over the colour (cracks, layers, relief)
  const gr = h > 0.3 ? slopeGrade(x, z) : 0, lim = rockLimit(x, z); out[3] = 0;
  if (gr > lim - 0.12) {
    const n = fbm(x * 0.09 + 17, z * 0.09 - 3, 3);
    if (gr > lim) { const rk = PAL.rock2.slice(); mix3(rk, PAL.rock, smooth(0.35, 0.65, n)); mix3(rk, PAL.scree, smooth(0.55, 0.8, fbm(x * 0.21 + 3, z * 0.21, 2)) * 0.6); mix3(rk, PAL.soil, smooth(0.42, 0.25, n) * 0.45); mix3(out, rk, 0.82 + 0.18 * smooth(lim, lim + 0.2, gr)); out[3] = 1; }
    else mix3(out, PAL.soil, smooth(lim - 0.12, lim, gr) * smooth(0.38, 0.62, n) * 0.7);
  }
  // on Olympos, the zones of a Greek massif: maquis, green and brown scrub, on its lower slopes between the trees; above
  // them grey limestone in patches of ochre and rust, lighter on the ridges and darker on the steep upper faces, with fans
  // of pale finer scree where the gullies run out; on top snow lying in patches, in the gullies and on gentle shelves,
  // never a cap. A ridge or a gully is told by how much higher or lower the ground stands than the ground 12 m round it.
  // (Patch 24, the player: a boring cone.) The shoulders between the cliff bands (bands above) carry the zones, the scrub
  // and the pines' floor low down and a thin stony turf higher up, snow on the highest; the cliffs show their beds, a
  // few metres thick and paler and darker by turns, and dark streaks where the water runs down them; under a cliff and
  // in a gully the ground lies darker, in the shade of it.
  if (PEAK.on && h > 90 && Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.r) {
    const n = fbm(x * 0.015 + 4, z * 0.015, 3), n2 = fbm(x * 0.045 - 7, z * 0.045 + 3, 2), rk = out[3], soft = Math.min(1 - rk * 0.6, smooth(lim + 0.3, lim - 0.05, gr)), hh = h + (n - 0.5) * 40;   // (soft: the gentle ground, fading out over the cliff's lip rather than at the slope rule's line, which the far ground's coarse mesh draws as teeth)
    const cv = h - (heightAt(x + 12, z) + heightAt(x - 12, z) + heightAt(x, z + 12) + heightAt(x, z - 12)) / 4;   // (+ on ridges, - in gullies)
    mix3(out, n2 > 0.5 ? PAL.maquis : PAL.maquis2, smooth(100, 140, h) * smooth(270, 210, hh) * (0.75 * soft + 0.7 * rk * smooth(0.38, 0.6, fbm(x * 0.03 + 9, z * 0.03, 2))));   // (in patches over the rock too)
    mix3(out, PAL.pines, soft * smooth(110, 150, h) * smooth(290, 240, hh) * 0.75);   // (the pines' dark floor: from afar, where no tree is drawn, it reads as the woods)
    mix3(out, PAL.alpine, soft * smooth(235, 275, hh) * smooth(390, 330, hh) * (0.65 + 0.3 * smooth(0.3, 0.6, n2)));   // (the turf)
    const ls = PAL.lime.slice(); mix3(ls, PAL.ochre, smooth(0.5, 0.68, n) * 0.65); mix3(ls, PAL.rust, smooth(0.58, 0.72, n2) * 0.5);
    mix3(ls, PAL.darkRock, smooth(1, 1.7, slope) * smooth(220, 330, h) * 0.8); mix3(ls, PAL.lime2, smooth(1, 6, cv) * 0.65);
    const bed = 0.5 + 0.5 * Math.sin((h + (n - 0.5) * 16 + (n2 - 0.5) * 6) * 0.6);   // (the beds, some 10 m apart)
    mix3(ls, PAL.lime2, smooth(0.6, 0.95, bed) * 0.35 * smooth(0.8, 1.4, slope)); mix3(ls, PAL.darkRock, smooth(0.3, 0.05, bed) * 0.3 * smooth(0.8, 1.4, slope));
    mix3(ls, PAL.darkRock, smooth(0.56, 0.74, noise(Math.atan2(z - PEAK.z, x - PEAK.x) * 70 + 5.1, h * 0.012 - 2.3)) * 0.45 * smooth(1, 2, slope));   // (the streaks: long down the faces, narrow across)
    mix3(out, ls, rk * smooth(120, 180, h));
    mix3(out, ls, soft * smooth(300, 360, hh) * 0.75); mix3(out, PAL.scree2, soft * smooth(280, 350, h) * smooth(0.4, 0.65, n2) * 0.5);   // (above the turf no green: stony ground)
    mix3(out, PAL.scree2, smooth(-1, -5, cv) * smooth(1.1, 0.6, slope) * smooth(180, 240, h) * smooth(0.38, 0.6, n2) * 0.7);
    const dark = 1 - 0.24 * smooth(-1, -8, cv) * smooth(110, 160, h); out[0] *= dark; out[1] *= dark; out[2] *= dark;
    // (and up high it clings in streaks and patches to the steeper rock too, lying in its beds, so the top shows white)
    const high = smooth(PEAK.snow - 40, PEAK.snow + 30, h + (n - 0.5) * 70), snow = high * Math.max(smooth(1.35, 0.6, slope) * smooth(0.32, 0.58, n2 + smooth(-1, -6, cv) * 0.5 - smooth(1, 5, cv) * 0.3), smooth(4.5, 1.6, slope) * smooth(0.42, 0.72, bed * 0.55 + n2 * 0.6 + smooth(-1, -6, cv) * 0.3) * smooth(PEAK.snow - 10, PEAK.snow + 70, h) * 0.9);
    mix3(out, PAL.snow, snow); out[3] *= 1 - snow;
  }
  // the path up it: a worn track of packed earth and small stones over its whole width (where the slope rule makes it
  // rock, the rock surface stays, as everywhere: one rule), the snow on it trodden thin, and a fainter band of dust either side, so it still shows from afar, where the
  // terrain's vertices lie further apart than it is wide, winding up the face
  if (ROUTE.on && routeAt(x, z).k + routeAt(x + 5, z).k + routeAt(x - 5, z).k + routeAt(x, z + 5).k + routeAt(x, z - 5).k > 0) {
    const k = routeAt(x, z).k, wide = Math.max(routeAt(x + 5, z).k, routeAt(x - 5, z).k, routeAt(x, z + 5).k, routeAt(x, z - 5).k, k), t = Math.max(smooth(0.5, 0.95, k) * 0.88, wide * 0.22);
    const tr = PAL.track.slice(); mix3(tr, PAL.track2, smooth(0.35, 0.65, fbm(x * 0.4 + 3, z * 0.4 - 8, 2)));
    mix3(out, tr, t);
  }
  // in a Giant's cave: bare earth and rock underfoot, darker the deeper in; out of its mouth the earth his feet have worn
  const cin = CAVES.length && CAVE.cut ? caveIn(x, z) : null;
  if (cin && cin[0] > 0) {
    const n = fbm(x * 0.21 + 7, z * 0.21 - 3, 2), e = PAL.caveEarth.slice(); mix3(e, PAL.caveRock, smooth(0.38, 0.68, n));
    mix3(out, e, cin[0]); const k = 1 - (1 - caveShade(cin[1])) * cin[0]; out[0] *= k; out[1] *= k; out[2] *= k; out[3] = Math.max(out[3], cin[0] * smooth(0.3, 0.75, n) * 0.8);
  }
  if (RIVER_HOOK.c) RIVER_HOOK.c(x, z, h, out);   // (the river's bed and banks: river.js)
  const j = 0.94 + hash2(Math.floor(x * 2), Math.floor(z * 2)) * 0.08;   // tiny per-vertex jitter breaks banding
  out[0] *= j; out[1] *= j; out[2] *= j;
  return out;
}
