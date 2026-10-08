// Where the places of the trial stand. Found from the seed with the same pure functions in every thread (the terrain
// workers import this too), so the ground under each site is flattened identically everywhere and trees keep off it.
//   temple:   the Ancient Temple of Zeus, on a rise near where you wake: pray for his blessing, offer the bosses' heads
//   house:    an abandoned farmhouse in the meadows, worth searching
//   olives:   five ancient olive trees in Pedias with marks carved in their bark (three pieced together → the Labyrinth)
//   labyrinth: the Minotaur's ruined arena, deep in Pedias
//   caves:    four Giant caves in the Yleos hills, one carving in each (three together → the Chimera's shrine)
//   chimera:  the Chimera's shrine, deep in the Yleos forest
import { heightAt, biomeWeights, addPad, hash2, WORLD } from './gen.js';

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

export const SITES = { temple: null, house: null, olives: [], labyrinth: null, caves: [], chimera: null };
const clears = [];   // [x, z, r]: no trees or rocks inside
function pad(s, r0, r1, kind, y = s.y) { s.y = y; s.r = r1; s.kind = kind; addPad(s.x, s.z, r0, r1, y); clears.push([s.x, s.z, r1 * 0.95]); return s; }

{
  // the Ancient Temple: a gentle rise 60-110 m from where you wake, in Pedias
  const t = find({ r0: 60, r1: 110, score: (x, z, h, w, sl) => (w.p > 0.9 ? 0 : -99) + h * 0.15 - sl * 30 });
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
}
// Nothing grows here (flora and ground pickups ask)
export function siteClear(x, z) { for (const [cx, cz, r] of clears) if ((x - cx) * (x - cx) + (z - cz) * (z - cz) < r * r) return true; return false; }
export const ALL_SITES = () => [SITES.temple, SITES.house, SITES.labyrinth, SITES.chimera, ...SITES.olives, ...SITES.caves].filter(Boolean);
void WORLD;
