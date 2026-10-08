// Round colliders (tree trunks, rocks, posts, creatures' bodies) in an 8 m spatial hash. Sources add and remove whole
// groups by key, so a vegetation cell or a building can come and go in one call.
const G = 8;
export class Colliders {
  constructor() { this.grid = new Map(); this.groups = new Map(); }
  addGroup(key, list) {        // list: [{ x, z, r, h?, y?, ref? }] (h: height above y, the base; default tall)
    this.removeGroup(key);
    for (const c of list) { const k = Math.floor(c.x / G) + ',' + Math.floor(c.z / G); (this.grid.get(k) || this.grid.set(k, []).get(k)).push(c); c.key = key; }
    this.groups.set(key, list);
  }
  removeGroup(key) {
    const list = this.groups.get(key); if (!list) return;
    for (const c of list) { const k = Math.floor(c.x / G) + ',' + Math.floor(c.z / G), a = this.grid.get(k); if (!a) continue; const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); if (!a.length) this.grid.delete(k); }
    this.groups.delete(key);
  }
  removeOne(c) { const k = Math.floor(c.x / G) + ',' + Math.floor(c.z / G), a = this.grid.get(k); if (a) { const i = a.indexOf(c); if (i >= 0) a.splice(i, 1); } const g = this.groups.get(c.key); if (g) { const i = g.indexOf(c); if (i >= 0) g.splice(i, 1); } }
  *near(x, z, r) {
    const x0 = Math.floor((x - r - 4) / G), x1 = Math.floor((x + r + 4) / G), z0 = Math.floor((z - r - 4) / G), z1 = Math.floor((z + r + 4) / G);
    for (let j = z0; j <= z1; j++) for (let i = x0; i <= x1; i++) { const a = this.grid.get(i + ',' + j); if (a) yield* a; }
  }
  // Push a circle (radius r, feet at y) out of everything it overlaps. Returns true if it hit something
  resolve(p, r, y = p.y) {
    let hit = false;
    for (const c of this.near(p.x, p.z, r)) {
      if (c.h !== undefined && (y > (c.y ?? -1e9) + c.h - 0.3 || y + 1.7 < (c.y ?? -1e9))) continue;     // stepped over it, or under it
      const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz), m = r + c.r;
      if (d < m && d > 1e-4) { p.x = c.x + (dx / d) * m; p.z = c.z + (dz / d) * m; hit = true; }
    }
    return hit;
  }
  // The nearest collider whose circle a ray from (x,z) in direction (dx,dz) passes within reach of
  pick(x, z, dx, dz, reach, filter) {
    let best = null, bt = reach;
    for (const c of this.near(x + dx * reach * 0.5, z + dz * reach * 0.5, reach)) {
      if (filter && !filter(c)) continue;
      const ox = c.x - x, oz = c.z - z, t = ox * dx + oz * dz; if (t < -c.r) continue;
      const px = ox - dx * t, pz = oz - dz * t, d2 = px * px + pz * pz, rr = (c.r + 0.35) ** 2; if (d2 > rr) continue;
      const tt = Math.max(0, t - Math.sqrt(rr - d2)); if (tt < bt) { bt = tt; best = c; }
    }
    return best;
  }
}
export const colliders = new Colliders();
