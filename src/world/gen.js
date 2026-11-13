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
export function noise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * xf * (xf * (xf * 6 - 15) + 10), v = zf * zf * zf * (zf * (zf * 6 - 15) + 10);
  const g = (i, j, dx, dz) => { const k = ihash(i, j) & 15; return GX[k] * dx + GZ[k] * dz; };
  const a = g(xi, zi, xf, zf), b = g(xi + 1, zi, xf - 1, zf), c = g(xi, zi + 1, xf, zf - 1), d = g(xi + 1, zi + 1, xf - 1, zf - 1);
  return 0.5 + (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 0.72;
}
export function fbm(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { s += a * noise(x * f + i * 17.3, z * f - i * 9.1); n += a; f *= 2.03; a *= 0.5; } return s / n; }
export function ridged(x, z, oct = 4) { let a = 0.5, f = 1, s = 0, n = 0; for (let i = 0; i < oct; i++) { const r = 1 - Math.abs(noise(x * f + i * 31.7, z * f + i * 5.3) * 2 - 1); s += a * r * r; n += a; f *= 2.07; a *= 0.5; } return s / n; }

// ---- Biomes: weights (sum to 1) from warped polar position
const _w = { p: 1, y: 0, v: 0 };
export function biomeWeights(x, z, out = _w) {
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
export function biomeAt(x, z) { const w = biomeWeights(x, z); return w.v > 0.5 ? BIOME.VALTOS : w.p >= w.y ? BIOME.PEDIAS : BIOME.YLEOS; }

// How far inland a point is: 1 well inland, 0 at the waterline, negative out at sea (bays and headlands from noise)
export function landness(x, z) {
  const r = Math.hypot(x, z) / WORLD.R, n = (fbm(x * 0.0012 + 3, z * 0.0012 - 5, 4) - 0.5) * 0.42 + (fbm(x * 0.006, z * 0.006, 2) - 0.5) * 0.08;
  return (1 + n - r) / 0.12;
}

// ---- The peak: Olympos, one great massif in the far hills of Yleos, its head above the treeline and white with snow.
// sites.js places it once the trial's sites are laid out (so none of them moves) and only then switches it on. Its
// ridges run down from the summit and fork as they go, deep gullies between them; crags stand out high up, and the
// slopes ease into foothills. Its upper slopes are too steep to walk (CLIMB below): one path goes up, laid out with it.
export const PEAK = { on: false, x: 0, z: 0, r: 540, h: 480, snow: 372, a: 0, base: 0, route: [], steps: [] };   // (a: the way the path faces)
export function setPeak(x, z) { PEAK.x = x; PEAK.z = z; PEAK.a = Math.atan2(-z, -x); PEAK.base = rawHeight(x, z); layTowers(); PEAK.on = true; layRoute(); }
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
  const lat = Math.abs(Math.sin(a - PEAK.a)) * d * PEAK.r, knife = 0.07 * smooth(3, 13, lat) * smooth(34, 22, lat) * smooth(0.2, 0.15, d) * smooth(0.025, 0.05, d) * smooth(0.9, 0.5, da);
  // (and the far side, away from the path, falls away steeper: a great north face, so the massif isn't round)
  const side = smooth(0.5, 0.8, da), gully = (0.21 + 0.21 * smooth(0.22, 0.5, da) + 0.08 * side) * smooth(0.02, 0.2, d) * Math.pow(1 - crest, 1.3 - 0.2 * side), dd = peakDd(d) * (1 + 0.25 * smooth(1.6, 2.8, da));
  const prof = Math.pow(Math.max(0, 1 - dd), 1.55) * (1 - gully - knife);
  const crag = (ridged(x * 0.018, z * 0.018, 3) - 0.5) * (0.05 + 0.02 * side) * smooth(0.95, 0.25, d) * smooth(0.04, 0.16, d);
  let tw = 0; if (d < 0.36) for (const t of TOWERS) { const r = Math.hypot(x - t.x, z - t.z); if (r < t.r) tw = Math.max(tw, t.h * Math.pow(1 - r / t.r, 1.4)); }
  return PEAK.h * (prof + crag) + tw;
}
const peakDd = (d) => (Math.hypot(d, 0.2) - 0.2) / (Math.hypot(1, 0.2) - 0.2);   // (the softened distance out: a dome on top)
// Crags and towers of rock standing up near the top, away from the path's side, and a second summit a little lower than
// the first behind it (as Olympos has Mytikas and Stefani): each { x, z, r, h }, never as high as the top
const TOWERS = [];
function layTowers() {
  TOWERS.length = 0; const P = PEAK, below = (d) => P.h * (1 - Math.pow(1 - peakDd(d), 1.55));
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
// at the edge of its stretch of mountainside), then a narrow crest to the top with rock steps to jump. The path is cut
// level across into the slope, a bench a few metres wide with a wall on one side and a drop on the other (routeAt);
// PEAK.route keeps its line ({ x, z, y, s } every 2 m: the cairns and the tests follow it) and PEAK.steps the rock
// steps ({ x, z, y, a }: the foot of each, and the way it faces).
const ROUTE = { on: false, pts: [], grid: new Map(), crestFrom: 0, box: [0, 0, 0, 0] };
const RG = 16, PATH = { w: 2.6, b: 3.5, cw: 1.7, cb: 2.6, grade: 0.42, most: 0.68, rise: 1.35, steep: 0.8, steps: 7, top: 0.3 };
function layRoute() {
  const P = PEAK; ROUTE.on = false; ROUTE.pts = []; ROUTE.grid.clear();
  const hAt = (x, z) => rawHeight(x, z), dOf = (x, z) => Math.hypot(x - P.x, z - P.z) / P.r;
  const ux = Math.cos(P.a), uz = Math.sin(P.a), top = hAt(P.x, P.z) - 1.5, tx = P.x + ux * 9, tz = P.z + uz * 9;
  // the trailhead: on the line out from the summit towards the island's heart, where the climbing rule is about to begin
  let d0 = 0.75; while (d0 > 0.3 && peakHeight(P.x + ux * d0 * P.r, P.z + uz * d0 * P.r) < P.h * 0.22) d0 -= 0.005;
  let x = P.x + ux * d0 * P.r, z = P.z + uz * d0 * P.r, hx = -ux, hz = -uz, side = 1, leg = 0, lat0 = 0;
  const pts = [[x, z]], Z = [hAt(x, z)];
  for (let i = 0; i < 2000 && dOf(x, z) > 0.06; i++) {
    const e = 3, gx = (hAt(x + e, z) - hAt(x - e, z)) / (2 * e), gz = (hAt(x, z + e) - hAt(x, z - e)) / (2 * e), m = Math.hypot(gx, gz) || 1e-6;
    let ax = gx / m, az = gz / m; if (m > PATH.grade) { const c = PATH.grade / m, sn = Math.sqrt(1 - c * c) * side; ax = gx / m * c - gz / m * sn; az = gz / m * c + gx / m * sn; }
    // (turning at most 30° each 2 m, so a hairpin bends round in a tight curve)
    const turn = Math.atan2(hx * az - hz * ax, hx * ax + hz * az), t = Math.max(-0.52, Math.min(0.52, turn)), ch = Math.cos(t), sh = Math.sin(t);
    [hx, hz] = [hx * ch - hz * sh, hx * sh + hz * ch];
    x += hx * 2; z += hz * 2; leg += 2; pts.push([x, z]);
    // its height: the land's, but never falling and never climbing steeper than PATH.most (cut in where the land is steeper)
    Z.push(Math.min(Z.at(-1) + PATH.most * 2, Math.max(Z.at(-1), hAt(x, z))));
    // how far to the side of the line: each leg turns back at the edge of a stretch that narrows towards the top, until
    // the path crosses the line under the summit high enough to finish up the crest with a few rock steps
    const lat = (x - P.x) * -uz + (z - P.z) * ux, edge = 30 + 60 * smooth(0.1, 0.6, dOf(x, z));
    // (and back sooner where it would come within 14 m of a stretch of itself further down: a heightfield can't carry
    // one path over another)
    const near = leg > 20 && pts.length > 30 && pts.slice(0, -25).some(([px, pz]) => (px - x) * (px - x) + (pz - z) * (pz - z) < 196);
    if (leg > 20 && ((Math.abs(lat) > edge && (lat - lat0) * lat > 0) || near)) { side = -side; leg = 0; }
    if (dOf(x, z) < PATH.top && lat * lat0 <= 0 && top - Z.at(-1) < Math.hypot(tx - x, tz - z) * PATH.steep + PATH.steps * PATH.rise) break;
    lat0 = lat;
  }
  ROUTE.crestFrom = pts.length - 1;
  // the crest: straight up the ridge from the last bend to the edge of the summit's flat top (sites.js levels it)
  const [cx, cz] = pts[pts.length - 1], n = Math.ceil(Math.hypot(tx - cx, tz - cz) / 2);
  for (let i = 1; i <= n; i++) pts.push([cx + (tx - cx) * i / n, cz + (tz - cz) * i / n]);
  let s = 0; const S = pts.map((p, i) => (i ? (s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])) : 0)), c0 = ROUTE.crestFrom;
  const Y = Z.map((_, i) => { let a = 0, k = 0; for (let j = Math.max(0, i - 3); j <= Math.min(c0, i + 3); j++) { a += Z[j]; k++; } return a / k; });   // (smoothed)
  // on the crest: the land's height along it, but climbing no steeper than PATH.steep, and wherever that leaves the path a
  // step's height under the land, a rock step of PATH.rise (at least 4 m apart); so it keeps to the top of the crest
  const sC = S[c0], L = S[S.length - 1] - sC, line = (q) => { const t = (q - sC) / L, k = Math.max(0, Math.min(1, t)); return hAt(cx + (tx - cx) * k, cz + (tz - cz) * k); };
  const n2 = Math.ceil(L / 0.5), B = new Float32Array(n2 + 1), steps = []; B[0] = Y[c0];
  for (let i = 1, y = Y[c0], last = -9; i <= n2; i++) {   // (B: the walking part, the steps added on top)
    const q = sC + i * 0.5, want = Math.max((line(q - 1.5) + line(q) + line(q + 1.5)) / 3, top - Math.max(0, sC + L - q - 11) * PATH.steep) - steps.length * PATH.rise;   // (level with the top by the flat top's edge)
    y += Math.max(0, Math.min(PATH.steep * 0.5, want - y)); B[i] = y;
    if (want - y > PATH.rise && q - last > 4 && q < sC + L - 1) { steps.push(q); last = q; }
  }
  ROUTE.Hc = (q) => { const f = Math.max(0, Math.min(n2, (q - sC) / 0.5)), i = Math.min(n2 - 1, Math.floor(f)); let y = B[i] + (B[i + 1] - B[i]) * (f - i); for (const k of steps) y += PATH.rise * smooth(k, k + 1, q); return y; };
  ROUTE.pts = pts.map(([px, pz], i) => ({ x: px, z: pz, s: S[i], y: i > c0 ? ROUTE.Hc(S[i]) : Y[i] }));
  P.route = ROUTE.pts; P.steps = steps.map((q) => ({ x: cx + (tx - cx) * (q - sC) / L, z: cz + (tz - cz) * (q - sC) / L, y: ROUTE.Hc(q), a: Math.atan2(tx - cx, tz - cz) }));
  const m = PATH.w + PATH.b; ROUTE.box = [Math.min(...pts.map((p) => p[0])) - m, Math.max(...pts.map((p) => p[0])) + m, Math.min(...pts.map((p) => p[1])) - m, Math.max(...pts.map((p) => p[1])) + m];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    for (let gx = Math.floor((Math.min(ax, bx) - m) / RG); gx <= Math.floor((Math.max(ax, bx) + m) / RG); gx++) for (let gz = Math.floor((Math.min(az, bz) - m) / RG); gz <= Math.floor((Math.max(az, bz) + m) / RG); gz++) {
      const key = gx + ',' + gz; (ROUTE.grid.get(key) || ROUTE.grid.set(key, []).get(key)).push(i);
    }
  }
  ROUTE.on = true;
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
  // ground doesn't step); where two legs of a switchback come close, the ground between them ramps from one to the other
  let hy = 0, hw = 0, wy = 0, wk = 0; out.k = smooth(w + b, w, bd);
  for (let j = 0; j < n; j++) {
    if (Math.abs(Q[j] - bs) < 14) { const q = Math.exp((bd - D[j]) / 0.6); hy += routeY(Q[j]) * q; hw += q; continue; }
    const k = smooth(PATH.w + PATH.b, PATH.w, D[j]); if (k <= 0) continue;
    wy += routeY(Q[j]) * k / (D[j] * D[j] + 0.25); wk += k / (D[j] * D[j] + 0.25); out.k = Math.max(out.k, k);
  }
  const k0 = smooth(w + b, w, bd) / (bd * bd + 0.25); out.s = bs; out.y = (hy / hw * k0 + wy) / (k0 + wk); return out;
}
let _rd = new Float64Array(64), _rq = new Float64Array(64);
function routeY(s) {
  const pts = ROUTE.pts, c = pts[ROUTE.crestFrom]; if (s >= c.s) return ROUTE.Hc(s);
  let lo = 0, hi = ROUTE.crestFrom; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (pts[m].s <= s) lo = m; else hi = m; }
  const a = pts[lo], b = pts[hi]; return a.y + (b.y - a.y) * Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
}

// The lie of the land up close: bumps and dips of a few metres to a few tens of metres on top of the broad hills, so the
// ground is never smooth underfoot (stronger in the forest hills, gentler in the meadows, faint in the marsh). Switched
// on once the sites are laid out (sites.js), so it can't move them; their pads stay flat. Nothing finer than ~6 m: the
// nearest terrain is drawn with a vertex every 2 m, and the ground you walk on must match the ground you see.
export const DETAIL = { on: false };
export function setDetail(on) { DETAIL.on = on; }
function detail(x, z, w) {
  const big = noise(x * 0.04 + 31.7, z * 0.04 - 12.9) - 0.5, mid = noise(x * 0.09 - 5.3, z * 0.09 + 44.1) - 0.5, fine = noise(x * 0.16 + 70.2, z * 0.16 - 3.4) - 0.5;
  return w.p * (big * 5 + mid * 2 + fine * 0.6) + w.y * (big * 8 + mid * 2.8 + fine * 0.8) + w.v * (big * 0.8 + mid * 0.4);
}

// ---- Height (metres above sea level)
export function rawHeight(x, z, w = biomeWeights(x, z)) {
  const hp = 2.2 + fbm(x * 0.0032, z * 0.0032, 4) * 24 + (fbm(x * 0.017, z * 0.017, 2) - 0.5) * 3.5          // meadows,
    + (fbm(x * 0.06 + 13, z * 0.06 - 7, 2) - 0.5) * 0.7;                                                     // with a gentle unevenness underfoot
  const rise = smooth(0.5, 0.78, w.r);                                                                         // foothills first, ridges deeper in
  const hy = 16 + rise * 18 + (ridged(x * 0.0027 + 4, z * 0.0027 - 2, 4) * 60 + fbm(x * 0.011, z * 0.011, 3) * 14) * (0.25 + 0.75 * rise);   // forest hills
  const hv = -0.15 + (fbm(x * 0.013 + 7, z * 0.013, 3) - 0.5) * 3.6 + (fbm(x * 0.05, z * 0.05, 2) - 0.5) * 0.8;    // marsh: islands and pools
  let h = w.p * hp + w.y * hy + w.v * hv;
  if (PEAK.on) { const k = peakFlat(x, z); if (k > 0) h = lerp(h, PEAK.base, k); h += peakHeight(x, z) * (1 - w.v) * (1 - 0.75 * w.p * smooth(0.5, 0.85, Math.hypot(x - PEAK.x, z - PEAK.z) / PEAK.r)); }   // (its foothills die away into the meadows)
  const L = landness(x, z);
  if (DETAIL.on) h += detail(x, z, w) * smooth(1.6, 3.2, L);   // (the beaches stay smooth)
  if (ROUTE.on) { const r = routeAt(x, z); if (r.k > 0) h = lerp(h, r.y, r.k); }   // (the path up Olympos, cut into its slopes)
  const beach = 0.6 + fbm(x * 0.02, z * 0.02, 2) * 1.6;
  if (L < 1.6) h = lerp(lerp(-24, beach, smooth(-1.4, 0.15, L)), h, smooth(0.15, 1.6, L));   // shelf → beach → land
  return h;
}

// Flattened pads for sites (temples, ruins, the starting meadow): registered once, applied on top of the raw height
const PADS = [];   // { x, z, r0, r1, y }
const PAD_CELL = 256, PAD_GRID = new Map();
export function addPad(x, z, r0, r1, y = rawHeight(x, z)) {
  const pad = { x, z, r0, r1, y }; PADS.push(pad);
  for (let i = Math.floor((x - r1) / PAD_CELL); i <= Math.floor((x + r1) / PAD_CELL); i++) for (let j = Math.floor((z - r1) / PAD_CELL); j <= Math.floor((z + r1) / PAD_CELL); j++) {
    const k = i + ',' + j; (PAD_GRID.get(k) || PAD_GRID.set(k, []).get(k)).push(pad);
  }
  return pad;
}
export function heightAt(x, z) {
  let h = rawHeight(x, z);
  const cell = PAD_GRID.get(Math.floor(x / PAD_CELL) + ',' + Math.floor(z / PAD_CELL));
  if (cell) for (const p of cell) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r1) { const t = smooth(p.r0, p.r1, d); h = lerp(p.y, h, t); } }
  const cv = CAVE_GRID.get(Math.floor(x / PAD_CELL) + ',' + Math.floor(z / PAD_CELL));
  if (cv) for (const c of cv) h = caveGround(c, x, z, h);
  return h;
}

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
    const k = i + ',' + j; (CAVE_GRID.get(k) || CAVE_GRID.set(k, []).get(k)).push(c);
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
  const cv = CAVE_GRID.get(Math.floor(x / PAD_CELL) + ',' + Math.floor(z / PAD_CELL)); if (!cv) return null;
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

// ---- Ground colour (linear-ish RGB 0..1), from biome weights, height, slope and a few noise layers
const C = (hex) => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];
const PAL = {
  meadow: C(0x5b8a32), meadow2: C(0x6f9a3a), golden: C(0xb0a24e), dry: C(0x8f8a42),
  forest: C(0x2c4223), moss: C(0x3a5527), needles: C(0x4a3b29),
  mud: C(0x3e3826), marshMoss: C(0x4b5530), reedy: C(0x5d6a36),
  soil: C(0x6b5a3f), sand: C(0xd9c48e), wetSand: C(0xb8a272), seabed: C(0x9c8c62), rock: C(0x7f786d), rock2: C(0x6a645b), snow: C(0xbcc4ce), scree: C(0x7d776d), track: C(0x74674f),
  maquis: C(0x3f4d24), maquis2: C(0x55482c), lime: C(0x67635b), lime2: C(0x928d81), ochre: C(0x7d6342), rust: C(0x6e4a36), darkRock: C(0x3c3a36), scree2: C(0x9d968a),   // (Olympos)   // (snow a little blue-grey: pure white burned out in the sun)
  caveEarth: C(0x3f3528), caveRock: C(0x4d4740),
};
// how much darker a cave's floor and walls are the deeper in they lie (0 at the mouth, 1 at the back): the light from
// the mouth falls off (the sky's light on everything else isn't shadowed, so the darkness has to be in the colour)
export const caveShade = (d) => 1 - 0.74 * d;
const mix3 = (o, a, t) => { o[0] += (a[0] - o[0]) * t; o[1] += (a[1] - o[1]) * t; o[2] += (a[2] - o[2]) * t; return o; };
export function groundColor(x, z, h, slope, w = biomeWeights(x, z), out = [0, 0, 0]) {
  // Pedias: green meadow with golden fields and dry patches
  const pc = PAL.meadow.slice(); mix3(pc, PAL.meadow2, fbm(x * 0.05, z * 0.05, 2));
  mix3(pc, PAL.golden, smooth(0.56, 0.66, fbm(x * 0.006 + 40, z * 0.006, 3)) * 0.85);
  mix3(pc, PAL.dry, smooth(0.5, 0.7, fbm(x * 0.02 - 9, z * 0.02, 2)) * 0.35);
  // Yleos: dark forest floor, moss and needle litter
  const yc = PAL.forest.slice(); mix3(yc, PAL.moss, fbm(x * 0.04 + 5, z * 0.04, 2)); mix3(yc, PAL.needles, smooth(0.5, 0.7, fbm(x * 0.03, z * 0.03 + 8, 2)) * 0.6);
  // Valtos: mud and marsh moss
  const vc = PAL.mud.slice(); mix3(vc, PAL.marshMoss, fbm(x * 0.06, z * 0.06, 2)); mix3(vc, PAL.reedy, smooth(0.55, 0.7, fbm(x * 0.02 + 3, z * 0.02, 2)) * 0.5);
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
  if (PEAK.on && h > 110 && Math.hypot(x - PEAK.x, z - PEAK.z) < PEAK.r) {
    const n = fbm(x * 0.015 + 4, z * 0.015, 3), n2 = fbm(x * 0.045 - 7, z * 0.045 + 3, 2), rk = out[3];
    const cv = h - (heightAt(x + 12, z) + heightAt(x - 12, z) + heightAt(x, z + 12) + heightAt(x, z - 12)) / 4;   // (+ on ridges, - in gullies)
    mix3(out, n2 > 0.5 ? PAL.maquis : PAL.maquis2, smooth(110, 150, h) * smooth(280, 200, h + n * 40) * (0.75 * (1 - rk) + 0.7 * rk * smooth(0.38, 0.6, fbm(x * 0.03 + 9, z * 0.03, 2))));   // (in patches over the rock too)
    const ls = PAL.lime.slice(); mix3(ls, PAL.ochre, smooth(0.5, 0.68, n) * 0.65); mix3(ls, PAL.rust, smooth(0.58, 0.72, n2) * 0.5);
    mix3(ls, PAL.darkRock, smooth(1, 1.7, slope) * smooth(220, 330, h) * 0.8); mix3(ls, PAL.lime2, smooth(1, 6, cv) * 0.65);
    mix3(out, ls, rk * smooth(140, 200, h));
    mix3(out, ls, (1 - rk) * smooth(240, 300, h + n * 40) * 0.85); mix3(out, PAL.scree2, (1 - rk) * smooth(260, 340, h) * smooth(0.4, 0.65, n2) * 0.5);   // (above the scrub no green: stony ground)
    mix3(out, PAL.scree2, smooth(-1, -5, cv) * smooth(1.1, 0.6, slope) * smooth(180, 240, h) * smooth(0.38, 0.6, n2) * 0.7);
    const snow = smooth(PEAK.snow - 40, PEAK.snow + 30, h + (n - 0.5) * 70) * smooth(1.35, 0.6, slope) * smooth(0.32, 0.58, n2 + smooth(-1, -6, cv) * 0.5 - smooth(1, 5, cv) * 0.3);
    mix3(out, PAL.snow, snow); out[3] *= 1 - snow;
  }
  // the path up it: a worn track of dust and small stones (where the slope rule makes it rock, the rock surface stays),
  // the snow on it trodden thin, and a fainter band of dust either side, so it still shows from afar, where the terrain's
  // vertices lie further apart than it is wide, winding up the face
  if (ROUTE.on && routeAt(x, z).k + routeAt(x + 5, z).k + routeAt(x - 5, z).k + routeAt(x, z + 5).k + routeAt(x, z - 5).k > 0) {
    const k = routeAt(x, z).k, wide = Math.max(routeAt(x + 5, z).k, routeAt(x - 5, z).k, routeAt(x, z + 5).k, routeAt(x, z - 5).k, k), t = Math.max(smooth(0.25, 0.9, k) * 0.75, wide * 0.3);
    mix3(out, PAL.track, t);
  }
  // in a Giant's cave: bare earth and rock underfoot, darker the deeper in; out of its mouth the earth his feet have worn
  const cin = CAVES.length && CAVE.cut ? caveIn(x, z) : null;
  if (cin && cin[0] > 0) {
    const n = fbm(x * 0.21 + 7, z * 0.21 - 3, 2), e = PAL.caveEarth.slice(); mix3(e, PAL.caveRock, smooth(0.38, 0.68, n));
    mix3(out, e, cin[0]); const k = 1 - (1 - caveShade(cin[1])) * cin[0]; out[0] *= k; out[1] *= k; out[2] *= k; out[3] = Math.max(out[3], cin[0] * smooth(0.3, 0.75, n) * 0.8);
  }
  const j = 0.94 + hash2(Math.floor(x * 2), Math.floor(z * 2)) * 0.08;   // tiny per-vertex jitter breaks banding
  out[0] *= j; out[1] *= j; out[2] *= j;
  return out;
}
