// Small numeric helpers shared by the game, the workers and the tests. No imports and no state, so a worker can load
// it too. The world's own deterministic noise (noise, fbm, hash2) lives with the generator in world/gen.js.
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };   // smoothstep
export const rr = (a, b) => a + Math.random() * (b - a);   // (not for anything the world is built from: use a seeded generator there)
// A repeatable sequence of numbers in [0, 1) from a seed (Park-Miller), for things that must come out the same every time
export const seeded = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };
// A hash of a point to [0, 1): the classic sine hash used by the procedural textures
export const hash21 = (x, z) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
// Tileable value noise on a size×size grid: period cells across, octaves layers, each corner value from hash(i, j)
export function tileNoise(size, period, octaves, hash = hash21) {
  const f = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let a = 0.5, fr = 1, v = 0;
    for (let o = 0; o < octaves; o++) {
      const px = (x / size) * period * fr, pz = (y / size) * period * fr, P = period * fr;
      const xi = Math.floor(px), zi = Math.floor(pz), xf = px - xi, zf = pz - zi, u = xf * xf * (3 - 2 * xf), w = zf * zf * (3 - 2 * zf);
      const hh = (i, j) => hash(((i % P) + P) % P + o * 17, ((j % P) + P) % P + o * 31);
      v += a * ((hh(xi, zi) * (1 - u) + hh(xi + 1, zi) * u) * (1 - w) + (hh(xi, zi + 1) * (1 - u) + hh(xi + 1, zi + 1) * u) * w);
      a *= 0.5; fr *= 2;
    }
    f[y * size + x] = v;
  }
  return f;
}
