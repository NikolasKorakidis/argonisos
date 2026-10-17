// Where the things lying about are: a pure layout from the world generator and each cell's trees, the same every time
// (saves refer to them by their place here). Shared by the game and the world workers, which lay out cells off the
// main thread.
import { biomeWeights, hash2, heightAt, isRock } from './gen.js';
import { siteClear } from './sites.js';
import { solidsAround, insideSolid, pediasWood } from './flora.js';

export const CELL = 64;
export const rnd = (a, b) => hash2(a * 13.37 + b * 0.71, b * 7.13 - a * 1.9);
// How many of each kind per cell, by biome (Pedias, Yleos)
function counts(w, x, z) {
  const tree = pediasWood(x, z).wood;   // (fallen branches lie mostly under the woods)
  return {
    stone: 3.5 * w.p + 4 * w.y, branch: (1.6 + tree * 4) * w.p + 6 * w.y,   // starter materials: easy to come by
    lightstone: 0.15 * w.p + 1.2 * w.y,
    dandelion: 3 * w.p, moonflower: 0.6 * w.y, feather: 0.4 * w.p + 0.3 * w.y, bones: 0.25 * w.y,
    bush: 2.2 * w.p + 1.6 * w.y,                // fiber for early rope; last, so the ids of the kinds above don't shift
  };
}
export function layoutPickups(cx, cz) {
  const out = [], x0 = cx * CELL, z0 = cz * CELL, w = biomeWeights(x0 + 32, z0 + 32, { p: 0, y: 0, v: 0, r: 0 });
  if (w.v > 0.4) return out;
  const C = counts(w, x0 + 32, z0 + 32), solid = solidsAround(cx, cz); let k = 0;
  for (const [kind, n] of Object.entries(C)) {
    const whole = Math.floor(n) + (rnd(cx * 31 + k, cz * 17 - k) < n % 1 ? 1 : 0);
    for (let i = 0; i < whole; i++, k++) {
      const x = x0 + rnd(cx + k * 3.1, cz - k) * CELL, z = z0 + rnd(cx - k * 1.7, cz + k * 2.3) * CELL, h = heightAt(x, z);
      if (h < 0.8 || siteClear(x, z) || insideSolid(solid, x, z, 0.35)) continue;   // never inside a rock or a trunk
      if (isRock(x, z) && kind !== 'stone' && kind !== 'lightstone') continue;   // on bare rock only stones (the shared slope rule)
      out.push({ id: `${cx},${cz},${k}`, kind, x, z, y: h, rot: rnd(k, cx + cz) * 6.28 });
    }
  }
  // loose stones on bare rock: a few small heaps here and there, never an even scatter
  for (let q = 0; q < 8; q++) {
    const x = x0 + rnd(cx * 101 + q * 17, cz * 37 + 911) * CELL, z = z0 + rnd(cz * 89 - q * 23, cx * 41 + 577) * CELL;
    if (!isRock(x, z) || rnd(cx * 7 + q * 131, cz * 13 + 3) > 0.5) continue;
    const n = 1 + Math.floor(rnd(q * 53 + cx, cz * 29 + 71) * 3);
    for (let m = 0; m < n; m++) {
      const sx = x + (rnd(m * 61 + q * 7 + cx, cz + 401) - 0.5) * 3.5, sz = z + (rnd(cz * 3 + m * 47, q * 11 + cx + 233) - 0.5) * 3.5;
      if (!isRock(sx, sz) || siteClear(sx, sz) || insideSolid(solid, sx, sz, 0.35)) continue;
      out.push({ id: `${cx},${cz},r${q}.${m}`, kind: 'stone', x: sx, z: sz, y: heightAt(sx, sz), rot: rnd(m * 19, q * 7 + cz) * 6.28 });
    }
  }
  return out;
}
