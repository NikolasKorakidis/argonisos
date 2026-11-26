// Finding the way in a boss's arena (the user, 25 Nov: the Minotaur and his dead walked into what stood of the Labyrinth
// and stuck there). Valheim's way: each size of body has its own map of where it fits (Unity's navmesh agent types, a
// troll's not a greyling's), and a creature follows a path over it round what stands, straight at you once nothing does.
// Here a grid of CELL-metre cells over a square N cells across, centred on the arena, one per size of body (NavGrid): a
// cell is blocked where that body's middle can't go (within its radius of a collider), and marked near within a margin
// past that (a path keeps a little off what it goes round). A few times a second a flow is spread out from where you
// stand (Dijkstra, every cell's cost of the way to you), stopping a little after it has reached every hunter; each hunter
// then follows it downhill and makes for the furthest point on that path it can see in a straight line (any-angle: no
// zig-zag along the cells). Everything is allocated once; a flow over the whole grid is about a millisecond.
const N = 128, CELL = 1, HALF = (N * CELL) / 2;
// what a step costs: through a blocked cell (taken only to get out of one: a hunter pressed against a rock, or you, hiding
// right up against it, where its body can't be) and beside something (within the margin)
const SOFT = 30, NEAR = 1.6, DIAG = Math.SQRT2, ESCAPE = 1.5;
const DI = [1, -1, 0, 0, 1, 1, -1, -1], DJ = [0, 0, 1, -1, 1, -1, 1, -1];

export class NavGrid {
  // r: how far the body's middle keeps from a collider's edge; filter: which colliders stop it; margin: the band beside them
  constructor(r, filter, margin) {
    this.r = r; this.filter = filter; this.margin = margin; this.ok = false; this.flows = 0; this.ox = 0; this.oz = 0;
    const n = N * N; this.block = new Uint8Array(n); this.dist = new Float32Array(n); this.seen = new Uint32Array(n); this.done = new Uint32Array(n); this.want = new Uint32Array(n);
    this.heap = new Int32Array(n); this.at = new Int32Array(n); this.size = 0; this.gen = 0;
  }
  // which cell a point is in, or -1 off the grid
  cell(x, z) { const i = Math.floor((x - this.ox) / CELL), j = Math.floor((z - this.oz) / CELL); return i < 0 || j < 0 || i >= N || j >= N ? -1 : j * N + i; }
  cx(c) { return this.ox + ((c % N) + 0.5) * CELL; }
  cz(c) { return this.oz + (Math.floor(c / N) + 0.5) * CELL; }
  // the grid over the colliders round (x, z): blocked within r of each that stops it, near within the margin past that
  build(colliders, x, z) {
    this.ox = Math.round(x / CELL) * CELL - HALF; this.oz = Math.round(z / CELL) * CELL - HALF; const B = this.block; B.fill(0);
    for (const k of colliders.near(x, z, HALF + 4)) {
      if (this.filter && !this.filter(k)) continue;
      const R = k.r + this.r, R2 = R * R, M = R + this.margin, M2 = M * M, i0 = Math.max(0, Math.floor((k.x - M - this.ox) / CELL)), i1 = Math.min(N - 1, Math.floor((k.x + M - this.ox) / CELL));
      const j0 = Math.max(0, Math.floor((k.z - M - this.oz) / CELL)), j1 = Math.min(N - 1, Math.floor((k.z + M - this.oz) / CELL));
      for (let j = j0; j <= j1; j++) { const dz = this.oz + (j + 0.5) * CELL - k.z; for (let i = i0; i <= i1; i++) { const dx = this.ox + (i + 0.5) * CELL - k.x, d2 = dx * dx + dz * dz, c = j * N + i;
        if (d2 < R2) B[c] = 2; else if (d2 < M2 && !B[c]) B[c] = 1; } }
    }
    this.ok = true; this.gen++;   // (a flow over the old grid is stale)
  }
  // ---- the flow: every cell's cost of the way to (tx, tz), out as far as a little past the furthest of the cells in
  // hunters (a list of cell indices, n of them). False if (tx, tz) is off the grid.
  flow(tx, tz, hunters, n) {
    const s = this.cell(tx, tz); if (s < 0 || !this.ok) return false;
    const G = ++this.gen, D = this.dist, B = this.block, seen = this.seen, done = this.done, W = this.want; let left = 0, stop = Infinity;
    for (let k = 0; k < n; k++) { const c = hunters[k]; if (c >= 0 && W[c] !== G) { W[c] = G; left++; } }
    this.size = 0; D[s] = 0; seen[s] = G; this.push(s);
    while (this.size) {
      const u = this.pop(), du = D[u]; if (du > stop) break; done[u] = G;
      if (W[u] === G && --left === 0) stop = du + 10;   // (every hunter reached: a little further, for the way they'll go next)
      const ui = u % N, uj = (u - ui) / N, out = B[u] === 2;
      for (let q = 0; q < 8; q++) {
        const i = ui + DI[q], j = uj + DJ[q]; if (i < 0 || j < 0 || i >= N || j >= N) continue; const v = j * N + i; if (done[v] === G) continue;
        // (no cutting a corner past something blocked, unless it's getting out of a blocked place)
        if (q >= 4 && !out && (B[uj * N + i] === 2 || B[j * N + ui] === 2)) continue;
        const b = B[v], nd = du + (q >= 4 ? DIAG : 1) * (b === 2 ? SOFT : b === 1 ? NEAR : 1);
        if (seen[v] !== G) { seen[v] = G; D[v] = nd; this.push(v); } else if (nd < D[v]) { D[v] = nd; this.up(this.at[v]); }
      }
    }
    this.flows++; return true;
  }
  // ---- the way from (x, z) to (tx, tz) over the last flow: writes the point to make for into out ({x, z}) and returns 2
  // if that's (tx, tz) itself (nothing in the way), 1 for a point on the path, 0 if there's no path from here (off the
  // grid, or not reached: then the hunter goes as it always did)
  way(x, z, tx, tz, out, clear, who) {
    const G = this.gen, D = this.dist, B = this.block, done = this.done; let c = this.cell(x, z); if (c < 0 || done[c] !== G) return 0;
    if (D[c] === 0) { out.x = tx; out.z = tz; return 2; }   // (in your cell)
    let best = -1, first = -1, zone = false;
    for (let k = 0; k < 96 && D[c] > 0; k++) {
      // downhill: the neighbour nearest the target by the flow
      const ci = c % N, cj = (c - ci) / N; let nx = -1, nd = D[c];
      for (let q = 0; q < 8; q++) { const i = ci + DI[q], j = cj + DJ[q]; if (i < 0 || j < 0 || i >= N || j >= N) continue; const v = j * N + i; if (done[v] === G && D[v] < nd) { nd = D[v]; nx = v; } }
      if (nx < 0) break; c = nx; if (first < 0) first = c;
      if (B[c] === 2 && best >= 0) { zone = true; break; }   // (into the blocked ring round where you stand, hugging a rock: as far as it can go)
      if (k % 2 === 0 || D[c] === 0) { if (this.sees(x, z, c)) best = c; else break; }
    }
    // straight at you: the path's end in sight, or as near as its body fits with nothing solid between (clear)
    if ((best >= 0 && D[best] === 0) || (zone && clear(who))) { out.x = tx; out.z = tz; return 2; }
    const w = best >= 0 ? best : first; if (w < 0) return 0;
    out.x = this.cx(w); out.z = this.cz(w); return 1;
  }
  // a straight line from (x, z) to cell c's middle over free cells (the blocked cells it starts in, if it does, don't count,
  // for its first ESCAPE metres: a giant brushing a brazier stands in its blocked ring, and that ring ran on unbroken into
  // a column's beside it, so a line through the gap between them, too narrow for him, passed as open and he pressed into
  // it until he had to be shouldered free, again and again: the chase test, 26 Nov)
  sees(x, z, c) {
    const B = this.block, ex = this.cx(c), ez = this.cz(c), dx = ex - x, dz = ez - z, steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (CELL * 0.5)), far = ESCAPE / (CELL * 0.5); let start = true;
    for (let s = 1; s <= steps; s++) { const k = this.cell(x + (dx * s) / steps, z + (dz * s) / steps); if (k < 0) return false; if (B[k] === 2) { if (!start || s > far) return false; } else start = false; }
    return true;
  }
  // (an indexed binary heap of cells by their cost so far)
  push(c) { const h = this.heap, i = this.size++; h[i] = c; this.at[c] = i; this.up(i); }
  pop() {
    const h = this.heap, top = h[0], last = h[--this.size]; if (this.size) { h[0] = last; this.at[last] = 0; this.down(0); } return top;
  }
  up(i) {
    const h = this.heap, D = this.dist, at = this.at, c = h[i], d = D[c];
    while (i > 0) { const p = (i - 1) >> 1, pc = h[p]; if (D[pc] <= d) break; h[i] = pc; at[pc] = i; i = p; }
    h[i] = c; at[c] = i;
  }
  down(i) {
    const h = this.heap, D = this.dist, at = this.at, n = this.size, c = h[i], d = D[c];
    for (;;) { let m = 2 * i + 1; if (m >= n) break; if (m + 1 < n && D[h[m + 1]] < D[h[m]]) m++; if (D[h[m]] >= d) break; h[i] = h[m]; at[h[i]] = i; i = m; }
    h[i] = c; at[c] = i;
  }
}

// The hunters' ways in an arena: a grid for the boss's body and one for a man's (its dead, the dryads), built from the
// colliders when the fight starts, again when they change (a wall falling, what you build) and every REBUILD seconds
// regardless, and a flow over each
// every FLOW seconds, in turn, while something of that size hunts you there. Each hunter asks for its way (toward) and
// keeps it for a fifth of a second or so. stats: what it has cost.
const REBUILD = 2, FLOW = 0.25, MAN = 0.7;
export class Nav {
  // (clear(c): nothing solid on the straight line from c to you)
  constructor(colliders, bigFilter, clear) {
    this.C = colliders; this.clear = clear; this.big = new NavGrid(1.9, bigFilter, 1.2); this.man = new NavGrid(0.4, null, 0.5);
    this.on = false; this.t = 0; this.buildT = 0; this.flowT = 0; this.turn = 0; this.cells = new Int32Array(32);
    this.stats = { flows: 0, flowMs: 0, flowMax: 0, builds: 0, buildMs: 0, buildMax: 0, ways: 0, wayMs: 0 };
  }
  // the grid a creature finds its way by (null: none for it)
  grid(c) { return c.boss ? this.big : c.T.r <= MAN ? this.man : null; }
  // each frame: arena (a Vector3: the middle of a boss's arena while it fights) or null; list: the creatures; pp: you
  update(dt, arena, list, pp) {
    this.t += dt; if (!arena) { this.on = false; this.big.ok = this.man.ok = false; return; }
    const S = this.stats; let boss = null; for (const c of list) if (c.boss && !c.dead) boss = c;
    if (boss && Math.abs(this.big.r - boss.T.r * 0.8) > 0.01) { this.big.r = boss.T.r * 0.8; this.big.ok = false; }   // (its body's own radius, as it's pushed out of things: creatures.js)
    // (again once what blocks has changed, a wall falling or something you built, though not more than twice a second)
    this.buildT -= dt; if (!this.on || this.buildT <= 0 || (this.C.v !== this.v && this.buildT < REBUILD - 0.5) || !this.big.ok || !this.man.ok) {
      this.on = true; this.buildT = REBUILD; this.v = this.C.v; const t0 = performance.now(); this.big.build(this.C, arena.x, arena.z); this.man.build(this.C, arena.x, arena.z);
      const ms = performance.now() - t0; S.builds++; S.buildMs += ms; S.buildMax = Math.max(S.buildMax, ms); this.flowT = 0;
    }
    if ((this.flowT -= dt) > 0) return; this.flowT = FLOW / 2; this.turn ^= 1;   // (the two grids' flows in turn, so a frame has one at most)
    const G = this.turn ? this.big : this.man; let n = 0;
    for (const c of list) if (!c.dead && (c.state === 'chase' || c.state === 'attack') && this.grid(c) === G && n < this.cells.length) this.cells[n++] = G.cell(c.pos.x, c.pos.z);
    if (!n) return; const t0 = performance.now(); G.flow(pp.x, pp.z, this.cells, n); const ms = performance.now() - t0; S.flows++; S.flowMs += ms; S.flowMax = Math.max(S.flowMax, ms);
  }
  // whether c's body fits at (x, z) by its grid (true where there's none to say)
  fits(c, x, z) { const G = this.on && this.grid(c); if (!G?.ok) return true; const k = G.cell(x, z); return k < 0 || G.block[k] !== 2; }
  // Where c should make for to reach you (pp): c.nav (a point, made once per creature) and c.navDirect (nothing in the
  // way); null where there's no way to be had (no arena, off the grid), and it goes as before
  toward(c, pp) {
    const G = this.on && this.grid(c); if (!G?.ok) return null;
    const P = (c.nav ||= { x: 0, z: 0, at: -1, gen: -1, ok: 0 });
    if (P.at > this.t && P.gen === G.gen && Math.hypot(P.x - c.pos.x, P.z - c.pos.z) > 1.2) return P.ok ? P : null;
    const t0 = performance.now(); P.ok = G.way(c.pos.x, c.pos.z, pp.x, pp.z, P, this.clear, c); P.gen = G.gen; P.at = this.t + 0.15 + Math.random() * 0.1;
    this.stats.ways++; this.stats.wayMs += performance.now() - t0; c.navDirect = P.ok === 2; return P.ok ? P : null;
  }
}
