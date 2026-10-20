// Building on a hillside (tester feedback, 19-20 Oct), the way a player does it: a row of walls aimed one after another
// down a real slope. Every wall stands on the ground (the earth raised under it, no gap left, full support however long
// the row); continuing the row level over falling ground goes on until the drop is too big, then the game says to build
// a wall under it first; once there is one, the row carries on along its top.
const ROW = `const G = await import('/src/world/gen.js'), GC = await import('/src/world/groundcut.js'); AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false);
  // a slope going steadily down for 24 m (grade between lo and hi)
  const slope = (lo, hi) => { for (let r = 20; r < 1100; r += 6) for (let a = 0; a < 6.28; a += 0.25) { const x = r * Math.cos(a), z = r * Math.sin(a);
      const gx = G.heightAt(x + 1, z) - G.heightAt(x - 1, z), gz = G.heightAt(x, z + 1) - G.heightAt(x, z - 1), l = Math.hypot(gx, gz) / 2; if (l < lo || l > hi || G.heightAt(x, z) < 3) continue;
      const dx = -gx / (2 * l), dz = -gz / (2 * l); let ok = true; for (let s = 0; s <= 24; s += 3) { const h0 = G.heightAt(x + dx * s, z + dz * s), h1 = G.heightAt(x + dx * (s + 3), z + dz * (s + 3)); if (h1 > h0 - 0.12 || G.isRock(x + dx * s, z + dz * s) || h1 < 1) ok = false; }
      if (ok) return { x, z, dx, dz, sx: -dz, sz: dx, rot: Math.atan2(-dz, dx) }; } return null; };
  const clear = (s) => { for (const q of [...g.colliders.near(s.x + s.dx * 15, s.z + s.dz * 15, 30)]) if (q.ref) { AG.veg.remove(q.ref.cx, q.ref.cz, q.ref.i); g.colliders.removeOne(q); } };
  const end = (p) => new V(p.pos.x + Math.cos(p.rot) * 1.5, p.pos.y, p.pos.z - Math.sin(p.rot) * 1.5);
  const gapUnder = (p) => { let gp = 0; for (let u = -1.4; u <= 1.41; u += 0.35) gp = Math.max(gp, p.pos.y - GC.groundAt(p.pos.x + Math.cos(p.rot) * u, p.pos.z - Math.sin(p.rot) * u)); return gp; };
  // aim at target (a Vector3) from the side, standing 5 m off, as a player would; returns the ghost
  const aimAt = (s, tgt) => { const st = [tgt.x + s.sx * 5, tgt.z + s.sz * 5]; P.spawn(st[0], st[1]); B.select('wall'); B.rot = s.rot; B.lastSnap = null;
    AG.camera.position.set(st[0], G.heightAt(st[0], st[1]) + 2.2, st[1]); AG.camera.lookAt(tgt); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); return B.placeGhost(); };
  const first = (s) => { const y = Math.max(G.heightAt(s.x - s.dx * 1.5, s.z - s.dz * 1.5), G.heightAt(s.x + s.dx * 1.5, s.z + s.dz * 1.5)) + 0.02; P.spawn(s.x + s.sx * 4, s.z + s.sz * 4); const p = B.place('wall', new V(s.x, y, s.z), s.rot); B.recompute(); return p; };
  const done = () => { B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; };`;

export default {
  name: 'Building on a hillside',
  async run(t) {
    await t.step('a row of ten walls down a slope, aimed at the ground ahead: every one placed, standing on the ground, full support, no gap under it', `${ROW}
      const s = slope(0.12, 0.4); if (!s) return 'no slope found'; clear(s); let prev = first(s); const bad = [];
      for (let n = 1; n <= 10; n++) { const e = end(prev), tgt = new V(e.x + s.dx * 1.5, G.heightAt(e.x + s.dx * 1.5, e.z + s.dz * 1.5) + 0.3, e.z + s.dz * 1.5), r = aimAt(s, tgt);
        if (!r || r.why) { bad.push(n + ': ' + (r ? r.why : 'no ghost')); break; } const p = B.place('wall', r.pos, r.rot); B.recompute();
        if (!B.placed.includes(p)) { bad.push(n + ': fell'); break; } if (p.support < 0.99 || !p.grounded) bad.push(n + ': support ' + p.support.toFixed(2)); const gp = gapUnder(p); if (gp > 0.1) bad.push(n + ': gap ' + gp.toFixed(2)); prev = p; }
      done(); return bad.length === 0 || bad.join(' | ');`);
    await t.step('a row kept level over a steep drop: walls go on while the ground can be raised to them, then the game asks for a wall under it, and with one there the row carries on', `${ROW}
      const s = slope(0.3, 0.6); if (!s) return 'no steep slope found'; clear(s); let prev = first(s), placed = 0, why = null;
      for (let n = 1; n <= 10 && !why; n++) { const e = end(prev), tgt = e.clone().add(new V(s.dx * 1.5, 0, s.dz * 1.5)), r = aimAt(s, tgt);   // (aimed where its foot should go, level with the row)
        if (!r) return n + ': no ghost'; if (Math.abs(r.pos.y - prev.pos.y) > 0.05) return n + ': the ghost left the row (' + (r.pos.y - prev.pos.y).toFixed(2) + ' m)';
        if (r.why) { why = r.why; break; } const p = B.place('wall', r.pos, r.rot); B.recompute(); if (gapUnder(p) > 0.1) return n + ': gap ' + gapUnder(p).toFixed(2); placed++; prev = p; }
      if (!why || !/build a wall under it/.test(why)) return 'never refused (' + placed + ' placed, last: ' + why + ')';
      // the wall it refused, and a wall under that spot
      const e = end(prev), at = new V(e.x + s.dx * 1.5, prev.pos.y, e.z + s.dz * 1.5), under = new V(at.x, at.y - 3, at.z);
      const ok = !B.invalid(B.piece('wall'), under, s.rot, true, {}); if (!ok) return 'the wall under it was refused: ' + B.invalid(B.piece('wall'), under, s.rot, true, {});
      B.place('wall', under, s.rot); B.recompute(); const top = B.invalid(B.piece('wall'), at, s.rot, true, {});
      done(); return (placed >= 2 && !top) || JSON.stringify({ placed, top });`);
    await t.step('aiming a floor clears the grass and shapes the ground under the green tile (for the eye only), and puts it back when you stop', `${ROW}
      const s = slope(0.1, 0.3); if (!s) return 'no slope found'; clear(s); const GM = await import('/src/world/grass.js'); P.spawn(s.x - 3, s.z - 3);
      const tgt = new V(s.x, G.heightAt(s.x, s.z), s.z); B.select('floor'); B.rot = 0; AG.camera.position.set(s.x - 4, tgt.y + 3, s.z - 4); AG.camera.lookAt(tgt); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
      const r = B.placeGhost(); if (!r) return 'no ghost'; const look = [...GC.cutList()].filter((c) => c.look).length, walk = GC.groundAt(r.pos.x, r.pos.z) - G.heightAt(r.pos.x, r.pos.z);
      const up = B.update; B.update = () => {}; await new Promise((q) => setTimeout(q, 300)); B.update = up;   // (the build tool isn't in hand: its own update would put the ghost away)
      const t0 = GM.grassU.uHeight.value, o = GM.grassU.uOrigin.value, N = t0.image.width, k = GM.TEX_SIZE / N, gi = Math.floor((r.pos.x - o.x) / k), gj = Math.floor((r.pos.z - o.y) / k), grass = t0.image.data[(gj * N + gi) * 4 + 1];
      done(); B.preview(null); const after = [...GC.cutList()].filter((c) => c.look).length;
      return (look === 1 && Math.abs(walk) < 0.01 && grass <= 0 && after === 0) || JSON.stringify({ look, walk, grass, after });`);
    await t.step('no grass or flowers grow through a floor built on a slope (the earth raised under it is bare)', `${ROW}
      const s = slope(0.15, 0.35); if (!s) return 'no slope found'; clear(s); const GM = await import('/src/world/grass.js'); P.spawn(s.x - 4, s.z - 4);
      const top = Math.max(...[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]].map(([u, v]) => G.heightAt(s.x + u, s.z + v))) + 0.03, f = B.place('floor', new V(s.x, top, s.z), 0); B.recompute();
      await new Promise((q) => setTimeout(q, 300)); const t0 = GM.grassU.uHeight.value, o = GM.grassU.uOrigin.value, N = t0.image.width, k = GM.TEX_SIZE / N; let bad = 0;
      for (let u = -1.4; u <= 1.4; u += 0.35) for (let v = -1.4; v <= 1.4; v += 0.35) { const i = Math.floor((s.x + u - o.x) / k), j = Math.floor((s.z + v - o.y) / k), q = (j * N + i) * 4; if (t0.image.data[q + 1] > 0 || t0.image.data[q + 3] > 0) bad++; }
      B.remove(f, false); return bad === 0 || bad + ' spots under the floor still grow grass or flowers';`);
    await t.step('a wall on a wall, and a floor on walls, leave the ground alone (they rest on what is built)', `${ROW}
      const s = slope(0.05, 0.4); if (!s) return 'no slope found'; clear(s); const p = first(s), up = B.place('wall', p.pos.clone().add(new V(0, 3, 0)), s.rot); B.recompute();
      const f = B.foot(up.def, up.pos, up.rot), rests = B.restsOn(up.def, up.pos, up.rot, up), onGround = B.onGround(up.def, up.pos, up.rot, up); done();
      return (f && rests && !onGround) || JSON.stringify({ rests, onGround });`);
  },
};
