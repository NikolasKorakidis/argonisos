// Where the places of the trial stand. Found from the seed with the same pure functions in every thread (the terrain
// workers import this too), so the ground under each site is flattened identically everywhere and trees keep off it.
//   temple:   the Ancient Temple of Zeus, on a hill of its own out in the meadows: pray for his blessing, offer the bosses' heads
//   house:    an abandoned farmhouse in the meadows, worth searching
//   olives:   five ancient olive trees in Pedias with marks carved in their bark (three pieced together → the Labyrinth)
//   labyrinth: the Minotaur's ruined arena, deep in Pedias
//   caves:    four Giant caves in the Yleos hills, one carving in each (three together → the Chimera's shrine)
//   chimera:  the Chimera's shrine, deep in the Yleos forest
//   peak:     Olympos, one great snowy mountain in the far hills, kept clear of all the places above
//   town:     an abandoned little town on level meadow, its streets, square and houses from the team's packs
//   spots:    small scenes about the island (a roadside shrine, a lost cart, a shepherd's camp, a well...)
import { heightAt, biomeWeights, addPad, hash2, WORLD, setPeak, routeAt, landness, setDetail, addCave, caveWorld, caveLocal, caveCut, CAVE_FORM } from './gen.js';

const slopeAt = (x, z) => Math.hypot(heightAt(x + 2, z) - heightAt(x - 2, z), heightAt(x, z + 2) - heightAt(x, z - 2)) / 4;
const _w = { p: 0, y: 0, v: 0, r: 0 };
// Best spot on a ring segment by a score; deterministic (fixed sample pattern)
function find({ r0, r1, a0 = 0, a1 = Math.PI * 2, n = 260, score, salt = 0 }) {
  let best = null, bs = -Infinity;
  for (let i = 0; i < n; i++) {
    const a = a0 + (a1 - a0) * hash2(i * 1.37 + salt, 3.1 + salt), r = r0 + (r1 - r0) * hash2(i * 2.11 - salt, 7.7 + salt);
    const x = Math.cos(a) * r, z = Math.sin(a) * r, h = heightAt(x, z); if (h < 2) continue;
    const s = score(x, z, h, biomeWeights(x, z, _w), slopeAt(x, z)); if (s > bs) { bs = s; best = { x, z, y: h }; }
  }
  return best;
}
const far = (list, x, z, d) => list.every((s) => Math.hypot(s.x - x, s.z - z) > d);

export const SITES = { temple: null, house: null, olives: [], labyrinth: null, caves: [], chimera: null, peak: null, town: null, spots: [] };
const clears = [];   // [x, z, r]: no trees or rocks inside
// The temple's hill (below): how far its middle stands in front of the temple's (along the way it faces), the radius of
// its flat top and of its foot, how much higher its top is than the temple's old pad, and how wide a strip the sacred
// way down its front keeps clear (structures.js paves the top and the way by these)
export const HILL = { z: 5, r0: 54, r1: 98, rise: 6, way: 5 };
function pad(s, r0, r1, kind, y = s.y) { s.y = y; s.r = r1; s.kind = kind; addPad(s.x, s.z, r0, r1, y); clears.push([s.x, s.z, r1 * 0.95]); return s; }

{
  // the Ancient Temple: a gentle rise 230-320 m from where you wake, in Pedias, to be found by exploring
  const t = find({ r0: 230, r1: 320, score: (x, z, h, w, sl) => (w.p > 0.9 ? 0 : -99) + h * 0.15 - sl * 30 });
  SITES.temple = pad(t, 18, 30, 'temple', t.y + 0.3);
  // an abandoned farmhouse, 160-260 m out, on flat meadow
  const hs = find({ r0: 160, r1: 260, salt: 2, score: (x, z, h, w, sl) => (w.p > 0.9 ? 0 : -99) - sl * 40 + (far([SITES.temple], x, z, 120) ? 0 : -99) });
  SITES.house = pad(hs, 12, 22, 'house');
  // the Labyrinth: 380-560 m, on the side of the island away from Valtos
  const L = find({ r0: 380, r1: 560, a0: -1.9, a1: 0.4, salt: 3, score: (x, z, h, w, sl) => (w.p > 0.85 ? 0 : -99) - sl * 40 });
  SITES.labyrinth = pad(L, 24, 40, 'labyrinth');
  // five marked olive trees across Pedias
  for (let k = 0; k < 5; k++) {
    const o = find({ r0: 110, r1: 420, a0: k * 1.2566, a1: (k + 1) * 1.2566, salt: 10 + k, n: 120, score: (x, z, h, w, sl) => (w.p > 0.85 ? 0 : -99) - sl * 25 + (far([SITES.temple, SITES.house, SITES.labyrinth], x, z, 60) ? 0 : -99) });
    if (o) SITES.olives.push(pad(o, 4, 9, 'olive'));
  }
  // four Giant caves in the Yleos hills, spread around the ring, on hillsides
  for (let k = 0; k < 4; k++) {
    const c = find({ r0: 600, r1: 1150, a0: k * 1.5708 - 0.6, a1: k * 1.5708 + 0.6, salt: 20 + k, n: 200, score: (x, z, h, w, sl) => (w.y > 0.85 ? 0 : -99) + Math.min(sl, 0.5) * 10 + h * 0.03 });
    if (c) SITES.caves.push(pad(c, 7, 13, 'cave'));
  }
  // the Chimera's shrine: deep in the forest, on fairly level ground
  const C = find({ r0: 750, r1: 1150, salt: 30, score: (x, z, h, w, sl) => (w.y > 0.92 ? 0 : -99) - sl * 30 + (far(SITES.caves, x, z, 200) ? 0 : -99) });
  SITES.chimera = pad(C, 22, 36, 'chimera');
  // Olympos: deep in the hills, inland, as far as it can stand from every other site; switched on only now, so the
  // ground under the sites above was measured without it and nothing moved. ROOM is the room kept round it, its radius
  // when it was first laid out: the massif has grown since (PEAK.r), but measuring by ROOM keeps it, the town and the
  // small scenes where they were, and the nearest of them still stands clear of its foot.
  const ROOM = 420; let pk = null, best = -1;
  for (let i = 0; i < 2400; i++) {
    const a = (Math.floor(i / 6) / 400) * Math.PI * 2, r = [1150, 1080, 1010, 950, 900, 850][i % 6], x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (biomeWeights(x, z, _w).y < 0.85 || landness(x, z) < 2.2) continue;
    const d = Math.min(...[SITES.temple, SITES.house, SITES.labyrinth, SITES.chimera, ...SITES.olives, ...SITES.caves].filter(Boolean).map((s) => Math.hypot(s.x - x, s.z - z)));
    if (d > ROOM + 60 && d > best) { best = d; pk = { x, z }; }
  }
  // the abandoned town and the small scenes: placed now, by the land as it is before the mountain rises (and kept off
  // its slopes), so the places above and Olympos itself stay just where they were
  const trial = [SITES.temple, SITES.house, SITES.labyrinth, SITES.chimera, ...SITES.olives, ...SITES.caves].filter(Boolean);
  const clearOf = (x, z, d) => far(trial, x, z, d) && (!pk || Math.hypot(pk.x - x, pk.z - z) > ROOM + 80);
  // (how uneven the ground is round a spot: the most it rises or falls within r)
  const rough = (x, z, r) => { const h = heightAt(x, z); let m = 0; for (let i = 0; i < 8; i++) m = Math.max(m, Math.abs(heightAt(x + Math.cos(i * 0.785) * r, z + Math.sin(i * 0.785) * r) - h)); return m; };
  const T = find({ r0: 380, r1: 760, salt: 40, n: 320, score: (x, z, h, w, sl) => (w.p > 0.8 ? 0 : -99) - rough(x, z, 30) * 3 - sl * 20 + (clearOf(x, z, 160) ? 0 : -99) });
  if (T && T.y > 3) SITES.town = pad(T, 38, 52, 'town');
  for (let k = 0; k < 12; k++) {
    const placed = [...trial, SITES.town, ...SITES.spots].filter(Boolean);
    const o = find({ r0: 120, r1: 1050, a0: k * 0.5236, a1: (k + 1) * 0.5236, salt: 50 + k, n: 90, score: (x, z, h, w, sl) => -rough(x, z, 7) * 4 - sl * 20 + (clearOf(x, z, 70) && far(placed, x, z, 90) ? 0 : -99) });
    if (o && o.y > 2.5) SITES.spots.push(Object.assign(pad(o, 5, 11, 'spot'), { v: k % 8 }));
  }
  // The temple's hill: its pad raised HILL.rise metres into a broad hill, flat on top for the temple and its marble
  // precinct (structures.js lays both out on it), sloping gently down all round. Raised only now, when every place above
  // has been chosen (none of them by this height: the nearest, the farmhouse, stands well beyond its foot), so nothing
  // moves; nothing grows on its top or on the sacred way down its front, and the woods keep back to its foot (its
  // radius sets its glade, flora.js), so the hill stands clear in the meadow.
  { const T = SITES.temple, sn = Math.sin(Math.atan2(-T.x, -T.z)), cs = Math.cos(Math.atan2(-T.x, -T.z)), at = (z) => [T.x + z * sn, T.z + z * cs];
    T.y += HILL.rise; T.r = HILL.r1; const [hx, hz] = at(HILL.z); addPad(hx, hz, HILL.r0, HILL.r1, T.y); clears.push([hx, hz, HILL.r0 + 2]);
    for (let z = HILL.z + HILL.r0; z < HILL.z + HILL.r1 + 8; z += 5) clears.push([...at(z), HILL.way]); }
  // The Giants' caves: each in a hill of its own (gen.js addCave), its mouth looking down the hillside the cave was found
  // on (the way the land falls, measured on a ring round it) and the hill rising behind. Raised only now, like the
  // temple's, so nothing above moves (the nearest place to any of them stands well beyond its hill). Nothing grows in the
  // cave, in front of its mouth or on the path worn down from it; the hill's slopes keep the forest.
  SITES.caves.forEach((c, i) => {
    let gx = 0, gz = 0; for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2, h = heightAt(c.x + Math.cos(a) * 24, c.z + Math.sin(a) * 24); gx -= Math.cos(a) * h; gz -= Math.sin(a) * h; }
    c.rot = Math.atan2(gx, gz); c.form = addCave(c.x, c.z, c.y, c.rot, 11 + i * 37.1); const at = (u, v) => caveWorld(c.form, u, v), F = CAVE_FORM;
    const [dx, dz] = at(0, F.VC + 2.5); c.den = { x: dx, z: dz };
    clears.push([...at(0, F.VC), 14], [...at(0, F.MZ + 6), 13]); for (let v = F.MZ + 8; v < F.MZ + 30; v += 4) clears.push([...at(0, v), 2.8]);
  });
  // (a small flat top for the altar and its ring of stones, the very top of the dome levelled; setPeak lays the path up
  // too, ending there: gen.js layRoute)
  if (pk) { setPeak(pk.x, pk.z); const y = heightAt(pk.x, pk.z) - 1.5; addPad(pk.x, pk.z, 8.5, 20, y); SITES.peak = { x: pk.x, z: pk.z, y, kind: 'peak', r: 12 }; clears.push([pk.x, pk.z, 22]); }
  setDetail(true);   // the ground's small bumps, now that nothing will be placed by its height (see detail() in gen.js)
}
// Nothing grows here (flora and ground pickups ask): the sites, and the path up Olympos (no boulder blocks it)
export function siteClear(x, z) {
  if (routeAt(x, z).k > 0) return true;
  for (const [cx, cz, r] of clears) if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true;
  for (const c of SITES.caves) { if (!c.form || Math.abs(x - c.x) > 32 || Math.abs(z - c.z) > 32) continue; const [u, v] = caveLocal(c.form, x, z); if (caveCut(c.form, u, v) < CAVE_FORM.RAMP + 1) return true; }   // (wherever a cave's ground is cut down: the rock's over it)
  return false;
}
export const ALL_SITES = () => [SITES.temple, SITES.house, SITES.labyrinth, SITES.chimera, ...SITES.olives, ...SITES.caves].filter(Boolean);
void WORLD;
