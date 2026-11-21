// The river (Patch 24, river.js and river-water.js): its course runs unbroken from the spring on Olympos to the sea and
// never flows uphill, its falls are there and drawn, the hero swims across the deep reach and the lake and wades the
// shallows, the current carries a swimmer downstream (and not in the lake), no tree, rock or pickup stands in its water,
// the map shows it, and nothing on the way throws an error.
const RV = `const RM = await import('/src/world/river.js'), R = RM.RIVER, F = R.falls, L = R.lake, D = R.deep, key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));`;
// the hero set down in the water at sample i (u: across, -1..1 of that side's width), the camera along the river
const into = (i, u = 0) => `${RV} const i = ${i}, w = ${u} < 0 ? R.WL[i] : R.WR[i], x = R.X[i] - R.TZ[i] * w * ${u}, z = R.Z[i] + R.TX[i] * w * ${u};
  AG.teleport(x, z); P.camYaw = Math.atan2(-R.TX[i], -R.TZ[i]); await new Promise((r) => setTimeout(r, 1500));`;

export default {
  name: 'River',
  async run(t) {
    await t.eval(`AG.S.timeScale = 0; AG.S.time = 0.32; for (const c of [...g.creatures.list]) g.creatures.remove(c); g.owl.update = () => {}; return true;`);
    await t.step('the course is laid: from the spring high on Olympos, unbroken, to the sea', `${RV} let gap = 0; for (let i = 1; i < R.n; i++) gap = Math.max(gap, Math.hypot(R.X[i] - R.X[i - 1], R.Z[i] - R.Z[i - 1]));
      const top = R.W[0], end = R.W[R.n - 1], sea = AG.heightAt(R.X[R.n - 1], R.Z[R.n - 1]), pk = g.SITES.peak;
      return (R.on && R.n > 500 && gap < 2.5 && top > 200 && Math.hypot(R.X[0] - pk.x, R.Z[0] - pk.z) < 300 && end < 0.3 && sea < 0) || JSON.stringify({ n: R.n, gap, top, end, sea });`);
    await t.step('it never flows uphill: its surface falls or holds all the way down, the lake level', `${RV} let rise = 0, at = -1; for (let i = 1; i < R.n; i++) if (R.W[i] - R.W[i - 1] > rise) { rise = R.W[i] - R.W[i - 1]; at = i; }
      let lake = 0; for (let i = L.i0; i <= L.i1; i++) lake = Math.max(lake, Math.abs(R.W[i] - L.y)); return (rise < 1e-4 && lake < 0.05) || JSON.stringify({ rise, at, lake });`);
    await t.step('the water stands in its channel: the bed under the surface, the banks over it, along the whole course', `${RV} let wet = 0, dry = 0, bad = [];
      for (let i = 2; i < R.n - 30; i += 3) { if (R.FALL[i] >= 0) continue; const nx = -R.TZ[i], nz = R.TX[i], mid = AG.heightAt(R.X[i], R.Z[i]), bx = R.X[i] + nx * (R.WR[i] + 3), bz = R.Z[i] + nz * (R.WR[i] + 3), bank = AG.heightAt(bx, bz);
        if (mid < R.W[i] - 0.15) wet++; else bad.push(['bed', i, +(mid - R.W[i]).toFixed(2)]); if (bank > R.W[i]) dry++; else bad.push(['bank', i, +(bank - R.W[i]).toFixed(2)]); }
      return (bad.length < 4) || JSON.stringify({ wet, dry, bad: bad.slice(0, 6) });`);
    await t.step("falls come down the mountain's cliff bands, each drawn with its spray", `${RV} const W = await import('/src/world/river-water.js');
      return (F.length >= 3 && F.every((f) => f.h > 20) && W.RIVER_GFX.falls.length === F.length && W.RIVER_GFX.falls.every((q) => q.curtain && q.spray && q.mist)) || JSON.stringify(F.map((f) => +f.h.toFixed(0)));`);
    await t.step('there is a lake and a deep, wide reach, deeper than you can stand in', `${RV} return (L && D && L.depth > 4 && D.depth > 3 && L.w > 50 && D.w > 25) || JSON.stringify({ L, D });`);
    // swimming across the deep reach: in its middle, deeper than SWIM_DEPTH, the hero swims at the river's own level
    await t.step("in the deep reach the hero swims, at the river's level (not the sea's)", `${into('Math.round((D.i0 + D.i1) / 2)')} const wl = RM.waterAt(P.pos.x, P.pos.z);
      return (P.swimming && Math.abs(P.pos.y - (wl - 1.35)) < 0.2 && wl > 3) || JSON.stringify({ swim: P.swimming, y: P.pos.y, wl, ground: AG.heightAt(P.pos.x, P.pos.z) });`);
    await t.step('…and swims right across it, to the far bank', `${into('Math.round((D.i0 + D.i1) / 2)', -0.85)} const m = Math.round((D.i0 + D.i1) / 2), tx = R.X[m] - R.TZ[m] * R.WR[m] * 1.4, tz = R.Z[m] + R.TX[m] * R.WR[m] * 1.4;
      P.stats.stamina = P.stats.maxStamina; let swum = false; key('keydown', 'KeyW');
      for (let k = 0; k < 180 && Math.hypot(P.pos.x - tx, P.pos.z - tz) > 2.5; k++) { P.camYaw = Math.atan2(-(tx - P.pos.x), -(tz - P.pos.z)); swum ||= P.swimming; await new Promise((r) => setTimeout(r, 100)); }
      key('keyup', 'KeyW'); return (swum && !P.swimming && Math.hypot(P.pos.x - tx, P.pos.z - tz) < 4) || JSON.stringify({ swum, swim: P.swimming, left: +Math.hypot(P.pos.x - tx, P.pos.z - tz).toFixed(1) });`);
    await t.step('in the lake the hero swims', `${RV} let b = L.i0; for (let i = L.i0; i <= L.i1; i++) if (R.D[i] > R.D[b]) b = i; ${into('b').replace(RV, '')} return (P.swimming && Math.abs(P.pos.y - (L.y - 1.35)) < 0.2) || JSON.stringify({ swim: P.swimming, y: P.pos.y, lake: L.y });`);
    await t.step('…and there the water is still: no current carries a swimmer off', `const x0 = P.pos.x, z0 = P.pos.z; await new Promise((r) => setTimeout(r, 4000)); const d = Math.hypot(P.pos.x - x0, P.pos.z - z0); return (P.swimming && d < 0.8) || JSON.stringify({ moved: +d.toFixed(2) });`);
    // the current: a swimmer floating still in the meadow river is carried downstream
    await t.step('in the river the current carries a swimmer downstream', `${RV} let b = -1; for (let i = 300; i < D.i0 - 10; i++) if (R.D[i] > 1.7 && R.FALL[i] < 0 && (b < 0 || R.SP[i] > R.SP[b])) b = i; if (b < 0) return 'no swimming depth in the meadow river';
      ${into('b').replace(RV, '')} if (!P.swimming) return 'not swimming there: depth ' + (RM.waterAt(P.pos.x, P.pos.z) - AG.heightAt(P.pos.x, P.pos.z)).toFixed(2);
      const x0 = P.pos.x, z0 = P.pos.z, s0 = RM.riverAt(x0, z0).s; await new Promise((r) => setTimeout(r, 3000)); const q = RM.riverAt(P.pos.x, P.pos.z), along = q.s - s0;
      return (along > 0.6) || JSON.stringify({ along: +along.toFixed(2), speed: R.SP[b] });`);
    // wading: in the shallows the hero walks, slower, splashing
    await t.step('in the shallows the hero wades: on his feet, slower than on dry land', `${RV} let b = -1; for (let i = 320; i < R.n - 60; i++) { const d0 = R.W[i] - AG.heightAt(R.X[i], R.Z[i]); if (R.FALL[i] < 0 && d0 > 0.55 && d0 < 1.1) { b = i; break; } } if (b < 0) return 'no shallows found';
      ${into('b').replace(RV, '')} key('keydown', 'KeyW'); await new Promise((r) => setTimeout(r, 900)); const wade = P.wading, sp = P.speed, sw = P.swimming; key('keyup', 'KeyW');
      return (!sw && wade > 0.15 && sp > 0.5 && sp < 4.2) || JSON.stringify({ wade, sp, sw });`);
    // nothing stands in the water: the trees, rocks and plants of every cell along the course (the river's own reeds and
    // lilies apart), and the things lying about
    await t.step('no tree, rock or pickup stands in the water', `${RV} const FL = await import('/src/world/flora.js'), PK = await import('/src/world/pickup-layout.js'), cells = new Set(); for (let i = 0; i < R.n; i += 6) cells.add(Math.floor(R.X[i] / 64) + ',' + Math.floor(R.Z[i] / 64));
      const bad = []; let n = 0;
      for (const c of cells) { const [cx, cz] = c.split(',').map(Number), it = FL.layoutCell(cx, cz);
        for (let o = 0; o < it.length; o += FL.STRIDE) { const sp = FL.SPECIES[it[o]]; if (!(it[o + 6] > 0) || !(sp.res === 'tree' || sp.res === 'rock')) continue; n++; const x = it[o + 2], z = it[o + 4], q = RM.riverAt(x, z); if (q && q.out < -0.3) bad.push([sp.name, x | 0, z | 0, +q.out.toFixed(1)]); }
        for (const p of PK.layoutPickups(cx, cz)) { n++; const q = RM.riverAt(p.x, p.z); if (q && q.out < 0) bad.push([p.kind, p.x | 0, p.z | 0]); } }
      return (bad.length === 0 && n > 100) || JSON.stringify({ n, bad: bad.slice(0, 6) });`);
    await t.step('…nor does the grass grow under it', `${RV} const GR = await import('/src/world/grass.js'), U = GR.grassU, i = Math.round((D.i0 + D.i1) / 2); AG.teleport(R.X[i], R.Z[i]); await new Promise((r) => setTimeout(r, 5000));
      const tx = U.uHeight.value, o = U.uOrigin.value, N = tx.image.width, k = (x, z) => (Math.floor((z - o.y) / GR.TEX_SIZE * N) * N + Math.floor((x - o.x) / GR.TEX_SIZE * N)) * 4;
      let grown = 0, n = 0; for (let j = i - 20; j <= i + 20; j += 4) { const q = k(R.X[j], R.Z[j]); if (q < 0 || q >= tx.image.data.length) continue; n++; if (tx.image.data[q + 1] > 0) grown++; }
      return (n > 5 && grown === 0) || JSON.stringify({ n, grown, o: [o.x, o.y], N, at: [R.X[i], R.Z[i]], len: tx.image.data.length });`);
    await t.step('creatures keep out of its deep water', `${RV} const c = g.creatures.spawn('deer', R.X[D.i0 + 20] - R.TZ[D.i0 + 20] * (R.WR[D.i0 + 20] + 6), R.Z[D.i0 + 20] + R.TX[D.i0 + 20] * (R.WR[D.i0 + 20] + 6)); if (!c) return 'no deer';
      c.state = 'wander'; c.wanderYaw = Math.atan2(R.X[D.i0 + 20] - c.pos.x, R.Z[D.i0 + 20] - c.pos.z); let deepest = 0; for (let k = 0; k < 40; k++) { c.state = 'wander'; c.t = 5; c.wanderYaw = Math.atan2(R.X[D.i0 + 20] - c.pos.x, R.Z[D.i0 + 20] - c.pos.z); await new Promise((r) => setTimeout(r, 100)); deepest = Math.max(deepest, RM.waterAt(c.pos.x, c.pos.z) - AG.heightAt(c.pos.x, c.pos.z)); }
      g.creatures.remove(c); return deepest < 0.6 || 'waded in ' + deepest.toFixed(2) + ' m';`);
    await t.step("the map shows the river and the lake in the sea's ink", `${RV} await new Promise((r) => { const w = () => (g.map.img ? r() : setTimeout(w, 200)); w(); });
      const c = g.map.base.getContext('2d'), N = g.map.base.width, ext = 3200, px = (x, z) => c.getImageData(Math.floor((x + ext / 2) / ext * N), Math.floor((z + ext / 2) / ext * N), 1, 1).data;
      const blue = (d) => d[2] > d[0] + 40 && d[2] > d[1]; let n = 0, of = 0; for (let i = 300; i < R.n - 40; i += 25) { of++; if (blue(px(R.X[i], R.Z[i]))) n++; }
      return (blue(px(L.x, L.z)) && n > of * 0.7) || JSON.stringify({ lake: [...px(L.x, L.z)], n, of });`);
    await t.step("the water is drawn where you look at it (over the scene's copy, on this preset)", `${RV} const W = await import('/src/world/river-water.js'); const i = Math.round((D.i0 + D.i1) / 2); g.setFly(true); AG.fly.pos.set(R.X[i] + 20, R.W[i] + 6, R.Z[i] + 20); AG.fly.yaw = Math.atan2(20, 20); AG.fly.pitch = -0.3;
      await new Promise((r) => setTimeout(r, 1500)); const ok = W.RIVER_GFX.visible > 0; g.setFly(false); return ok || 'no river chunk drawn';`);
    await t.shot('river-deep-reach');
  },
};
