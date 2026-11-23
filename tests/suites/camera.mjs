// The camera held off what's solid (Patch 25, the Greek reviewer: "instead of the things in front of the camera
// disappearing when they block it, the camera itself should move closer to the player, like Valheim"; player.js
// updateCamera, occlusion.js castCamera). Swept round the hero frame by frame inside a house of your own and under its
// ceiling, among the trunks of a wood (standing and walking), against a cliff, against a boulder and under the
// farmhouse's low roof: never inside a collider, a piece, a site's roof or the ground, no pumping in and out; it comes
// back out once the way is clear; very close, the hero is hidden from it. The casts stay cheap. Frame sequences of each.
import { visit } from '../lib/places.mjs';
import { LIB } from '../lib/building.mjs';

// in the page: why the camera's spot p is inside something solid (null if it isn't): the ground, a collider's cylinder (a
// tree's up to where its crown begins), a built piece's box, a site's roof
const PROBE = `const { CAST } = await import('/src/render/occlusion.js'), { SPECIES } = await import('/src/world/flora.js'), { groundAt } = await import('/src/world/groundcut.js');
  const top = (c) => (c.h !== undefined ? (c.y ?? -1e9) + c.h : c.ref?.sp !== undefined ? (c.y ?? 0) + (SPECIES[c.ref.sp].name === 'titan' ? CAST.titan : CAST.trunk) * (c.ref.s || 1) : 1e9);
  const inside = (p) => { const gy = groundAt(p.x, p.z); if (p.y < gy + 0.05) return 'under the ground by ' + (gy - p.y + 0.05).toFixed(2);
    for (const c of g.colliders.near(p.x, p.z, 1)) if (Math.hypot(p.x - c.x, p.z - c.z) < c.r && p.y > (c.y ?? -1e9) && p.y < top(c)) return 'in ' + (c.ref?.sp !== undefined ? 'a ' + SPECIES[c.ref.sp].name : c.ref?.piece ? 'a ' + c.ref.piece.def.id : c.ref?.site ? 'a site wall' : 'a collider');
    for (const q of B.near(p.x, p.z, 4)) { if (q.def.door && q.state?.open) continue; const cs = Math.cos(-q.rot), sn = Math.sin(-q.rot), lx = p.x - q.pos.x, lz = p.z - q.pos.z, x = lx * cs + lz * sn, z = -lx * sn + lz * cs, y = p.y - q.pos.y;
      for (const b of q.def.solids || []) if (Math.abs(x - b[0]) < b[3] / 2 && Math.abs(y - b[1]) < b[4] / 2 && Math.abs(z - b[2]) < b[5] / 2) return 'in a ' + q.def.id;
      for (const s of q.def.tops || []) if (x > Math.min(s.x0, s.x1) && x < Math.max(s.x0, s.x1) && z > Math.min(s.z0, s.z1) && z < Math.max(s.z0, s.z1)) { const ys = s.y ?? s.y0 + ((z - s.z0) / (s.z1 - s.z0)) * (s.y1 - s.y0); if (y > ys - 0.2 && y < ys + 0.05) return 'in a ' + q.def.id + "'s boards"; } }
    for (const t of g.structures.roofs) { if (Math.abs(p.x - t.ctx.s.x) > 80 || Math.abs(p.z - t.ctx.s.z) > 80) continue; const [x, z] = g.structures.local(t, p.x, p.z), y = t.ctx.s.y + t.y; if (x > t.x0 && x < t.x1 && z > t.z0 && z < t.z1 && p.y > y && p.y < y + CAST.roofUp) return 'in a site roof'; }
    return null; };
  // n frames, each(i) run before each: what went wrong where, the closest the camera came, the hero hidden, the biggest step
  // back out in a frame, and pumps (in, out and in again within ten frames: jitter)
  const rec = async (n, each) => { const o = { frames: n, bad: 0, why: [], minD: 99, hidden: 0, stepOut: 0, pumps: 0 }, steps = []; let last = null;
    for (let i = 0; i < n; i++) { each?.(i); await frames(1); const why = inside(AG.camera.position); if (why) { o.bad++; if (o.why.length < 4) o.why.push(i + ': ' + why); }
      if (P.heroHidden) o.hidden++; const d = P.camD; o.minD = Math.min(o.minD, d);
      if (last !== null) { const s = d - last; if (s > 0) o.stepOut = Math.max(o.stepOut, s); if (Math.abs(s) > 0.05) { steps.push([i, Math.sign(s)]); const k = steps.length; if (k >= 3 && steps[k - 1][1] < 0 && steps[k - 2][1] > 0 && steps[k - 3][1] < 0 && i - steps[k - 3][0] <= 10) o.pumps++; } }
      last = d; }
    o.minD = +o.minD.toFixed(2); o.stepOut = +o.stepOut.toFixed(3); return o; };`;

export default {
  name: 'Camera collision',
  async run(t) {
    await visit(t, 'meadow');
    await t.eval(`AG.S.still = false; AG.S.timeScale = 0; for (const c of [...g.creatures.list]) g.creatures.remove(c); return true;`);
    const sweep = (label, n, each) => t.eval(`${PROBE} const r = await rec(${n}, ${each}); return r;`).then((r) => { t.metric(label, r); return r; });
    const ok = (name, r, extra = true) => t.check(name, r && r.bad === 0 && r.pumps <= 2 && extra, JSON.stringify(r));

    // ---- a house of your own on the meadow: walls round, a floor over at 3 m for a low ceiling
    await t.eval(`const x = P.pos.x, z = P.pos.z; window._H = { x, z, y: AG.heightAt(x, z) + 0.05, R: 0.3 }; ${LIB} floors(); walls(); for (const [a, b] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', a, 3, b);
      B.sel = null; P.spawn(W(0.6, 0, 0.4).x, W(0.6, 0, 0.4).z); P.camDist = 7; P.camPitch = -0.3; P.camYaw = 0.3; return true;`);
    await t.until('P.onGround', 3000); await t.wait(400);
    const house = await sweep('in the house, the camera swung round the hero (7 m out, 6 s)', 360, `(i) => { P.camYaw = 0.3 + (i / 360) * Math.PI * 2; P.camPitch = -0.3 + 0.25 * Math.sin(i / 30); }`);
    ok('in a house: never inside a wall or the ceiling, held in the room, no pumping', house, house.minD < 3.5);
    await t.step('…the camera stays in the room and under the ceiling', `const H = window._H, c = AG.camera.position, dx = c.x - H.x, dz = c.z - H.z, R = H.R, x = dx * Math.cos(R) - dz * Math.sin(R), z = dx * Math.sin(R) + dz * Math.cos(R); return (Math.abs(x) < 3 && Math.abs(z) < 3 && c.y < H.y + 3) || JSON.stringify({ x, z, y: c.y - H.y });`);
    for (const [k, a] of [[1, 0.3], [2, 1.4], [3, 2.6]]) { await t.eval(`P.camYaw = ${a}; P.camPitch = -0.35; await frames(45); return true;`); await t.shot(`house-${k}`); }
    // backed into the corner: the camera right up against the hero, so he is hidden from it
    await t.eval(`const H = window._H, R = H.R, c = Math.cos(R), s = Math.sin(R), x = H.x + 2.45 * c + 2.45 * s, z = H.z - 2.45 * s + 2.45 * c; P.spawn(x, z); P.camYaw = Math.atan2(x - H.x, z - H.z) + Math.PI; P.camPitch = -0.1; await frames(60); return true;`);
    const corner = await sweep('backed into a corner of the house', 60, `(i) => { P.camYaw = Math.atan2(P.pos.x - window._H.x, P.pos.z - window._H.z) + 0.6 * Math.sin(i / 10); }`);
    ok('in a corner: still never in the walls', corner);
    await t.shot('house-corner');

    // ---- it comes back out once the way clears: the house taken down round the hero
    await t.eval(`P.spawn(window._H.x, window._H.z); P.camYaw = 0.3; P.camPitch = -0.25; await frames(60); return true;`);
    const back = await t.eval(`const d0 = P.camD; for (const q of [...B.placed]) B.remove(q, false); const t0 = performance.now(), ds = []; for (let i = 0; i < 150; i++) { await frames(1); if (i % 15 === 0) ds.push(+P.camD.toFixed(2)); }
      return { in: +d0.toFixed(2), after: +P.camD.toFixed(2), full: +P.camFree.toFixed(2), secs: +((performance.now() - t0) / 1000).toFixed(1), ds };`);
    t.metric('the walls taken away: the camera eases back out (m)', back);
    t.check('…the camera distance recovers to the full distance after the obstruction clears, eased out (not in one jump)', back.in < 3.5 && back.after > 6.5 && back.ds[0] < back.after - 1, JSON.stringify(back));

    // ---- one wall behind the hero on open ground: in at once, out eased
    const wall = await t.eval(`AG.S.freeBuild = true; const f = new V(Math.sin(P.camYaw), 0, Math.cos(P.camYaw)), x = P.pos.x + f.x * 3, z = P.pos.z + f.z * 3; const d0 = P.camD; const w = B.place('wall', new V(x, AG.heightAt(x, z), z), P.camYaw); await frames(1); const d1 = P.camD;
      B.remove(w, false); await frames(1); const d2 = P.camD; await frames(20); const d3 = P.camD; return { before: +d0.toFixed(2), next: +d1.toFixed(2), cleared: +d2.toFixed(2), later: +d3.toFixed(2) };`);
    t.metric('a wall put up 3 m behind the hero, then taken away (camera distance, m)', wall);
    t.check('…a wall coming between pulls the camera in front of it the same frame, and it eases (not jumps) back out', wall.next < 2.8 && wall.cleared < wall.before - 2 && wall.later > wall.cleared + 1, JSON.stringify(wall));

    // ---- the farmhouse's low roof (a site's: its walls in the collider grid, its roof from structures.js)
    await t.eval(`const H = g.SITES.house, F = { s: H, rot: 0.4 }, p = g.structures.w(F, 0, -2, 0); P.spawn(p.x, p.z); P.camDist = 8; P.camPitch = -0.4; return true;`);
    await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 60000 }); await t.until('P.onGround', 3000); await t.wait(1500);
    const farm = await sweep('under the farmhouse roof, swung round (8 m out, pitched down)', 360, `(i) => { P.camYaw = (i / 360) * Math.PI * 2; P.camPitch = -0.45 + 0.2 * Math.sin(i / 25); }`);
    ok('under a low roof: never in its walls or its roof', farm);
    for (const [k, a] of [[1, 0.5], [2, 2.2], [3, 4]]) { await t.eval(`P.camYaw = ${a}; P.camPitch = -0.45; await frames(45); return true;`); await t.shot(`farmhouse-${k}`); }

    // ---- a boulder: the hero beside it, the camera swung round through it
    const rock = await t.eval(`const F = await import('/src/world/flora.js'), cx0 = Math.floor(P.pos.x / F.CELL), cz0 = Math.floor(P.pos.z / F.CELL); let at = null;   // (the nearest big boulder in the layout, then waited for as a collider)
      for (let r = 0; r < 30 && !at; r++) for (let cx = cx0 - r; cx <= cx0 + r && !at; cx++) for (let cz = cz0 - r; cz <= cz0 + r && !at; cz++) { if (Math.max(Math.abs(cx - cx0), Math.abs(cz - cz0)) !== r) continue; const it = F.layoutCell(cx, cz); for (let o = 0; o < it.length; o += F.STRIDE) if (it[o] === F.SP.boulder && it[o + 6] > 2.9) { at = { x: it[o + 2], z: it[o + 4] }; break; } }
      if (!at) return 'no boulder in the layout'; P.spawn(at.x + 8, at.z); const best = await until(() => [...g.colliders.near(at.x, at.z, 1)].find((c) => c.ref?.sp === F.SP.boulder && Math.hypot(c.x - at.x, c.z - at.z) < 0.1), 40000); if (!best) return 'its collider never came';
      const x = best.x + best.r + 1.3, z = best.z; P.spawn(x, z); await until(() => AG.terrain.pending === 0, 20000); await sleep(800); P.camDist = 9; P.camPitch = -0.15; P.camYaw = Math.atan2(best.x - x, best.z - z) + Math.PI; window._rock = best; return { r: +best.r.toFixed(1) };`);
    if (typeof rock === 'string') t.check('a boulder to swing the camera round', false, rock);
    else {
      const rk = await sweep('beside a boulder, the camera swung through it', 240, `(i) => { const b = window._rock; P.camYaw = Math.atan2(P.pos.x - b.x, P.pos.z - b.z) + Math.PI + 1.2 * Math.sin(i / 38); P.camPitch = -0.15 + 0.3 * Math.sin(i / 50); }`);
      ok('against a boulder: never inside it, no pumping', rk, rk.minD < 6);
      for (const [k, a] of [[1, -0.5], [2, 0], [3, 0.5]]) { await t.eval(`const b = window._rock; P.camYaw = Math.atan2(P.pos.x - b.x, P.pos.z - b.z) + Math.PI + ${a}; P.camPitch = -0.15; await frames(45); return true;`); await t.shot(`rock-${k}`); }
    }

    // ---- a cliff: the hero at its foot facing out, the camera behind him up the face
    const cliff = await t.eval(`const { isRock } = await import('/src/world/gen.js'); let at = null; for (let r = 200; r < 1500 && !at; r += 6) for (let a = 0; a < 6.28 && !at; a += 0.05) { const x = r * Math.cos(a), z = r * Math.sin(a), h = AG.heightAt(x, z); if (h < 3) continue;
        const gx = AG.heightAt(x + 1, z) - AG.heightAt(x - 1, z), gz = AG.heightAt(x, z + 1) - AG.heightAt(x, z - 1), gl = Math.hypot(gx, gz); if (gl < 0.05) continue; const ux = gx / gl, uz = gz / gl;
        if (AG.heightAt(x + ux * 3, z + uz * 3) > h + 4.5 && AG.heightAt(x + ux * 8, z + uz * 8) > h + 8 && AG.heightAt(x - ux * 2, z - uz * 2) > h - 1.2 && isRock(x + ux * 3, z + uz * 3)) at = { x: x - ux * 1.5, z: z - uz * 1.5, ux, uz }; }
      if (!at) return 'no cliff'; P.spawn(at.x, at.z); await until(() => AG.terrain.pending === 0, 30000); await sleep(1500); P.camDist = 9; P.camPitch = -0.1; P.camYaw = Math.atan2(at.ux, at.uz); window._cliff = at; return { x: Math.round(at.x), z: Math.round(at.z) };`);
    if (typeof cliff === 'string') t.check('a cliff to back the camera into', false, cliff);
    else {
      const cl = await sweep('at the foot of a cliff, the camera swung into the face', 240, `(i) => { const c = window._cliff; P.camYaw = Math.atan2(c.ux, c.uz) + 0.9 * Math.sin(i / 38); P.camPitch = -0.1 + 0.45 * Math.sin(i / 47); }`);
      ok('against a cliff: never under the ground, no pumping (pulled in, or riding up over the slope)', cl);
      for (const [k, p] of [[1, -0.3], [2, 0], [3, 0.35]]) { await t.eval(`const c = window._cliff; P.camYaw = Math.atan2(c.ux, c.uz); P.camPitch = ${p}; await frames(45); return true;`); await t.shot(`cliff-${k}`); }
    }

    // ---- the woods: swung round among the trunks, then walking through them
    await visit(t, 'forest');
    await t.eval(`AG.S.still = false; for (const c of [...g.creatures.list]) g.creatures.remove(c); P.camDist = 9; P.camPitch = -0.15; return true;`);
    const woods = await sweep('in a wood, the camera swung round (9 m out, 6 s)', 360, `(i) => { P.camYaw = (i / 360) * Math.PI * 2; }`);
    ok('among trunks: never inside one, no pumping', woods);
    for (let k = 1; k <= 4; k++) { await t.eval(`P.camYaw = ${k} * 0.35; await frames(20); return true;`); await t.shot(`woods-${k}`); }
    await t.page.keyboard.down('KeyW');
    const walk = await sweep('walking through the wood (5 s), the camera trailing', 300, `(i) => { P.camYaw += 0.004 * Math.sin(i / 40); }`);
    await t.page.keyboard.up('KeyW');
    ok('walking through the woods: never inside a trunk, no pumping', walk);
    // and the casts stay cheap: a few hundred microseconds a frame at most, there with every trunk round
    const cost = await t.eval(`const target = P.camT.clone(), w = P.camW.clone(), N = 400, t0 = performance.now(); for (let i = 0; i < N; i++) P.cast(target, w); return +(((performance.now() - t0) / N) * 1000).toFixed(1);`);
    t.metric('one camera cast in the woods (µs; two a frame)', cost);
    t.check('…the camera\'s casts cost little (under 150 µs each)', cost < 150, cost + ' µs');
  },
};
