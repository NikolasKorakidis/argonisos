// The island's old houses as shelter (tester, 20 Nov): inside the abandoned farmhouse and the town's roofed houses you can
// build a fire, a bed and a workbench and use them, as under a roof of your own; each has a hole in its roof where the
// rain comes in until a roof patch closes it. And nothing grows up through a floor (the same day: flowers poking through
// new floors): everything on the ground under it goes, and stays gone through a save and a load.
export default {
  name: 'Old houses',
  async run(t) {
    // the farmhouse's own frame (structures.js farmhouse: site-local metres, the front +z), and a piece put there by aiming
    // at the floor through the camera, as a player does
    const FARM = `const H = g.SITES.house, F = { s: H, rot: 0.4 }, at = (x, z, y = 0) => g.structures.w(F, x, z, y);
      AG.S.freeBuild = true; if (!g.equippedTool('build')) { g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); }
      const aimPut = (id, x, z, rot = 0) => { const q = at(x, z), o = at(x + 1.3, z); P.spawn(o.x, o.z); B.select(id); B.rot = 0.4 + rot; B.lastSnap = null; const c = at(x, z + 1.8, 1.7); AG.camera.position.copy(c); AG.camera.lookAt(q); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
        const r = B.placeGhost(); if (!r || r.why) return [null, r ? r.why : 'no ghost']; if (r.pos.distanceTo(new V(q.x, r.pos.y, q.z)) > 0.3) return [null, 'landed ' + r.pos.distanceTo(q).toFixed(2) + ' m off']; const p = B.place(id, r.pos, r.rot); B.sel = null; AG.scene.remove(B.ghost); B.ghost = null; return [p, null]; };`;
    await t.step('the farmhouse shelters, but not under the hole in its roof', `${FARM}
      const under = (x, z) => g.build.sheltered(at(x, z, 0.3)), want = { room: [0, -2, true], porch: [0, 1.7, true], hole: [2.5, -0.75, false], yard: [0, 6, false], storeroom: [-5, 3, false] };
      const bad = Object.entries(want).filter(([, [x, z, w]]) => under(x, z) !== w).map(([k]) => k); return bad.length === 0 || 'wrong at ' + bad.join(', ');`);
    await t.step('a workbench goes in inside the farmhouse, and crafts', `${FARM} AG.S.freeBuild = false; g.give('wood', 10); const [wb, why] = aimPut('workbench', 0.3, -3.25); if (!wb) return 'not placed: ' + why;
      P.spawn(at(0.3, -2.2).x, at(0.3, -2.2).z); const r = C.list().find((q) => q.id === 'crudeBow'); g.give('wood', 10); g.give('rope', 4); g.give('leather', 1); C.discover(true);
      const block = C.blocker(r); if (block) return 'blocked: ' + block; const n = inv.count('crudeBow'); C.make(r.key); return inv.count('crudeBow') === n + 1 || 'no bow made';`);
    await t.step('a fire lit on the old hearth stays lit in the rain', `${FARM} const [f, why] = aimPut('campfire', -0.5, -2.1); if (!f) return 'not placed: ' + why;
      const [f2] = aimPut('campfire', 2.5, -0.75); if (!f2) return 'not placed under the hole'; g.weatherRain = () => 1; for (let i = 0; i < 14; i++) B.update(1); g.weatherRain = () => 0;
      const ok = f.state.lit, out = !f2.state.lit; B.remove(f2, false); return (ok && out) || (ok ? 'the fire under the hole stayed lit in the rain' : 'the hearth fire went out');`);
    await t.step('sleeping in a bed inside the farmhouse works', `${FARM} const [bed, why] = aimPut('bed', -2.3, -1.3); if (!bed) return 'not placed: ' + why;
      const toasts = []; const t0 = g.hud.toast; g.hud.toast = (m) => toasts.push(m); g.hud.sleep = (cb) => cb(); AG.S.time = 0.8; const day = AG.S.day;
      B.sleep(bed); g.hud.toast = t0; return (AG.S.day === day + 1 && !!AG.S.bed) || 'day ' + AG.S.day + ' (was ' + day + '): ' + toasts.join(' | ');`);
    // the patch: aim into the hole from the yard and from under it; the ghost must land on the hole's edges, allowed
    await t.step('a roof patch snaps into the hole', `${FARM} const A = g.structures.anchorsNear(at(2.5, 0).x, at(2.5, 0).z, 6); if (A.length < 6) return A.length + ' anchors';
      const mid = at(2.5, 0.5, 3), res = [];
      for (const [cx, cy, cz, tx, ty, tz] of [[2.5, 5.5, 7, 2.4, 3.3, -0.6], [1.0, 1.7, -3.5, 2.6, 3.2, -0.5], [3.4, 6.5, 5, 2.2, 3.4, -1.0]]) {
        P.spawn(at(cx, cz).x, at(cx, cz).z); B.select('roofPatch'); B.rot = 0; B.lastSnap = null; AG.camera.position.copy(at(cx, cz, cy)); AG.camera.lookAt(at(tx, tz, ty)); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
        const r = B.placeGhost(); res.push(!r ? 'no ghost' : r.why ? r.why : r.pos.distanceTo(new V(mid.x, H.y + 3, mid.z)) > 0.05 ? 'at ' + r.pos.distanceTo(new V(mid.x, H.y + 3, mid.z)).toFixed(2) + ' m off' : 'ok'); }
      B.sel = null; AG.scene.remove(B.ghost); B.ghost = null; return res.every((x) => x === 'ok') || res.join(' | ');`);
    await t.step('patched, the spot under the hole is sheltered and a fire there stays lit', `${FARM} AG.S.freeBuild = false; g.give('wood', 3); const mid = at(2.5, 0.5, 3), I = (await import('/src/input.js')).input;   // (imported before the camera is set: a frame may pass while it comes)
      P.spawn(at(2.5, 5.5).x, at(2.5, 5.5).z); B.select('roofPatch'); B.lastSnap = null; AG.camera.position.copy(at(2.5, 7, 5.5)); AG.camera.lookAt(at(2.4, -0.6, 3.3)); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
      const n = B.placed.length; I.clicks.length = 0; const g0 = B.placeGhost(); I.clicks.push(0); B.update(0.016); I.clicks.length = 0; B.sel = null; AG.scene.remove(B.ghost); B.ghost = null;
      const p = B.placed.find((q) => q.id === 'roofPatch'); if (!p || B.placed.length !== n + 1) return 'the click placed nothing: ' + JSON.stringify({ dead: P.dead, hp: P.stats.health, eq: g.equippedTool('build'), ui: I.uiOpen, sel: B.sel, wood: inv.count('wood'), why: g0?.why, at: g0?.pos.distanceTo(new V(mid.x, H.y + 3, mid.z)) }); B.recompute(); if (!B.placed.includes(p)) return 'the patch fell down';
      if (p.pos.distanceTo(new V(mid.x, H.y + 3, mid.z)) > 0.05) return 'placed ' + p.pos.distanceTo(new V(mid.x, H.y + 3, mid.z)).toFixed(2) + ' m off'; if (!B.sheltered(at(2.5, -0.75, 0.3))) return 'still open to the sky'; AG.S.freeBuild = true; const [f] = aimPut('campfire', 2.5, -0.75); g.weatherRain = () => 1; for (let i = 0; i < 14; i++) B.update(1); g.weatherRain = () => 0; return f?.state.lit || 'the fire went out';`);
    await t.step('the patch is kept in the save', `const d = JSON.parse(JSON.stringify(B.toJSON())); return d.some((q) => q.id === 'roofPatch') || 'not saved';`);
    // the town: the roofed house with the chest at its west end (town.js: twHouseA at -26, 5.6 facing south, its hole over its east bay)
    const TOWN = `const T = g.SITES.town, F = { s: T, rot: 0.35 }, R = Math.PI, hs = (lx, lz, y = 0) => { const x = -26 + lx * Math.cos(R) + lz * Math.sin(R), z = 5.6 - lx * Math.sin(R) + lz * Math.cos(R); return g.structures.w(F, x, z, y); };
      AG.S.freeBuild = true; if (!g.equippedTool('build')) { g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); }`;
    await t.step('a town house shelters a workbench, a bed and a fire, but not under its hole', `${TOWN} for (const q of [...B.placed]) B.remove(q, false);
      const put = (id, lx, lz, r = 0) => { const q = hs(lx, lz); q.y = AG.heightAt(q.x, q.z); return B.place(id, q, 0.35 + R + r); };
      const wb = put('workbench', -1.5, -1.6), bed = put('bed', -3, 0.2, Math.PI / 2), fire = put('campfire', 0.3, 0);
      const sh = [wb, bed, fire].map((p) => B.sheltered(p.pos.clone().setY(p.pos.y + 0.3), 1.2)), hole = B.sheltered(hs(2.5, 1.25, 0.3).setY(AG.heightAt(hs(2.5, 1.25).x, hs(2.5, 1.25).z) + 0.3));
      const A = g.structures.anchorsNear(hs(2.5, 2.5).x, hs(2.5, 2.5).z, 5).length;
      g.weatherRain = () => 1; for (let i = 0; i < 14; i++) B.update(1); g.weatherRain = () => 0;
      return (sh.every(Boolean) && !hole && A >= 6 && fire.state.lit) || JSON.stringify({ sh, hole, anchors: A, lit: fire.state.lit });`);
    // floors: on the thickest patch of flowers near the start, nothing of the ground cover left inside the floor's footprint
    const FLOWERS = `const { SPECIES, STRIDE, CELL } = await import('/src/world/flora.js'), veg = AG.veg;
      const keep = (sp) => ['tree', 'rock'].includes(SPECIES[sp].res), flower = SPECIES.findIndex((s) => s.name === 'flowers');
      const inside = (p, x, z, m = 0) => { const dx = x - p.pos.x, dz = z - p.pos.z, c = Math.cos(p.rot), s = Math.sin(p.rot); return Math.abs(dx * c - dz * s) <= 1.5 + m && Math.abs(dx * s + dz * c) <= 1.5 + m; };
      const left = (p) => { const out = []; for (const cell of veg.near.values()) { const it = cell.items; if (!it) continue; for (let i = 0; i < it.length / STRIDE; i++) { const o = i * STRIDE; if (keep(it[o]) || it[o + 6] <= 0 || veg.removed.has(cell.cx + ',' + cell.cz + ',' + i)) continue; if (inside(p, it[o + 2], it[o + 4])) out.push(SPECIES[it[o]].name); } } return out; };`;
    await t.step('a floor on a flowery meadow leaves nothing growing through it', `${FLOWERS} for (const q of [...B.placed]) B.remove(q, false);
      let best = null; for (const cell of veg.near.values()) { const it = cell.items; if (!it) continue; for (let i = 0; i < it.length / STRIDE; i++) { const o = i * STRIDE; if (it[o] !== flower) continue; let n = 0; for (let k = 0; k < it.length / STRIDE; k++) { const q = k * STRIDE; if (!keep(it[q]) && Math.hypot(it[q + 2] - it[o + 2], it[q + 4] - it[o + 4]) < 1.6) n++; } if (!best || n > best.n) best = { n, x: it[o + 2], z: it[o + 4] }; } }
      if (!best) { P.spawn(40, 60); await new Promise((r) => setTimeout(r, 4000)); return 'no flowers near the start'; }
      P.spawn(best.x + 3, best.z); await new Promise((r) => setTimeout(r, 300)); const y = Math.max(...[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, 0]].map(([a, c]) => AG.heightAt(best.x + a, best.z + c))) + 0.03;
      const before = (() => { const p = { pos: new V(best.x, y, best.z), rot: 0.3 }; return left(p).length; })();
      const f = B.place('floor', new V(best.x, y, best.z), 0.3); window._floor = { x: best.x, y, z: best.z }; const after = left(f);
      return (before > 0 && after.length === 0) || 'before ' + before + ', after: ' + (after.join(', ') || 'none');`);
    await t.step('…and the pickups under it are hidden while it stands', `const f = B.placed.find((q) => q.id === 'floor'); g.pickups.dirty = true; g.pickups.update(P.pos, AG.S.day); await new Promise((r) => setTimeout(r, 200));
      const under = g.pickups.visible.filter((v) => v.kind !== 'drop' && Math.hypot(v.x - f.pos.x, v.z - f.pos.z) < 1.4); return under.length === 0 || under.map((v) => v.kind).join(', ');`);
    await t.step('…and it stays bare after a save and a load', `${FLOWERS} const S = await import('/src/game/save.js'); const f0 = B.placed.find((q) => q.id === 'floor'); if (!f0) return 'no floor';
      if (!S.save(g)) return 'save failed';
      for (const q of [...B.placed]) B.remove(q, false); veg.removed.clear(); for (const k of [...veg.near.keys()]) veg.dropCell(veg.near, k);
      S.load(g); P.spawn(window._floor.x + 3, window._floor.z);
      for (let i = 0; i < 80 && veg.near.size < 4; i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 1500));
      const f = B.placed.find((q) => q.id === 'floor'); localStorage.removeItem('argonisos.world.v1'); if (!f) return 'the floor did not come back';
      const after = left(f); return after.length === 0 || 'grew back: ' + after.join(', ');`);
    // the same with nothing in the save to say so: a cell that streams in under a floor loses its ground cover as it comes
    await t.step('…even as the ground cover streams back in under it', `${FLOWERS} const f = B.placed.find((q) => q.id === 'floor'); veg.removed.clear(); for (const k of [...veg.near.keys()]) veg.dropCell(veg.near, k);
      for (let i = 0; i < 80 && veg.near.size < 4; i++) await new Promise((r) => setTimeout(r, 100)); await new Promise((r) => setTimeout(r, 1500));
      const after = left(f); return after.length === 0 || 'grew back: ' + after.join(', ');`);
  },
};
