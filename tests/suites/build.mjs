// Building: a full house goes up in either order, snapping is exact and steady, overlaps are refused, nothing
// snaps to furniture.
export default {
  name: 'Building',
  async run(t) {
    const house = (order) => `AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false);
      const x0 = 20 + (${order === 'gables' ? 30 : 0}), z0 = 10, y0 = AG.heightAt(x0, z0) + 0.05;   // (the floor rests on the ground at the middle corner all four tiles share; higher ground under it is pressed down)
  P.spawn(x0, z0 + 1);
      const out = []; const put = (id, x, y, z, r = 0) => { const def = B.piece(id), pos = new V(x0 + x, y0 + y, z0 + z); const why = B.invalid(def, pos, r, true, { terrain: false }); if (why) out.push(id + ': ' + why); else B.place(id, pos, r); };
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z);
      put('wall', -1.5, 0, -3); put('wall', 1.5, 0, -3); put('wall', -3, 0, -1.5, Math.PI / 2); put('wall', -3, 0, 1.5, Math.PI / 2); put('wall', 3, 0, -1.5, Math.PI / 2); put('wall', 3, 0, 1.5, Math.PI / 2); put('wall', -1.5, 0, 3); put('doorframe', 1.5, 0, 3); put('door', 0.8, 0, 3);
      const roofs = () => { put('roof63', -1.5, 3, -3, Math.PI); put('roof63', 1.5, 3, -3, Math.PI); put('roof63', -1.5, 3, 3, 0); put('roof63', 1.5, 3, 3, 0); }, gables = () => { put('end63', -3, 3, 0, Math.PI / 2); put('end63', 3, 3, 0, Math.PI / 2); };
      ${order === 'gables' ? 'gables(); roofs();' : 'roofs(); gables();'}
      put('workbench', 1.6, 0, -2.2); put('bed', -1.8, 0, -1.6, Math.PI / 2); put('campfire', 0, 0, 0); put('cookingStand', 0, 0, 0); put('chest', 2.2, 0, 1.5);
      window._h = { x0, z0, y0 }; return out.length === 0 || out.join('; ');`;
    await t.step('full house builds (roofs first)', house('roofs'));
    await t.step('full house builds (gable ends first)', house('gables'));
    const aim = `const { x0, z0, y0 } = window._h; g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer'));
      const look = (cx, cy, cz, tx, ty, tz) => { AG.camera.position.set(x0 + cx, y0 + cy, z0 + cz); AG.camera.lookAt(x0 + tx, y0 + ty, z0 + tz); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); };`;
    await t.step('gable end snaps onto the side walls', `${aim} for (const q of B.placed.filter((q) => q.id === 'end63')) B.remove(q, false); B.select('end63'); B.rot = 0.2; B.lastSnap = null; look(-9, 2.5, 0.3, -3, 2.9, 0.3); const r = B.placeGhost(); return (Math.abs(r.pos.x - (x0 - 3)) < 0.05 && Math.abs(r.pos.y - (y0 + 3)) < 0.05 && Math.abs(r.pos.z - z0) < 0.05) || 'ghost at ' + [r.pos.x - x0, r.pos.y - y0, r.pos.z - z0].map((v) => v.toFixed(2));`);
    await t.step('a duplicate roof panel is refused (already built)', `${aim} const why = B.invalid(B.piece('roof63'), new V(x0 - 1.5, y0 + 3, z0 + 3), 0, true, {}); return why === 'Already built here' || why;`);
    await t.step('a floor half over another floor is refused', `${aim} const why = B.invalid(B.piece('floor'), new V(x0 - 0.5, y0, z0 - 1.5), 0, true, {}); return why === 'Already built here' || why;`);
    await t.step('a floor next to the house is allowed', `${aim} const why = B.invalid(B.piece('floor'), new V(x0 + 4.5, y0, z0 - 1.5), 0, true, {}); return why === null || why;`);
    await t.step('nothing snaps to the workbench', `${aim} for (const q of [...B.placed]) B.remove(q, false); AG.S.freeBuild = true; const wx = x0 + 40, wz = z0, wy = AG.heightAt(wx, wz); const wb = B.place('workbench', new V(wx, wy, wz), 0); P.spawn(wx + 4, wz); B.select('beamV'); B.lastSnap = null; AG.camera.position.set(wx + 4, wy + 2, wz); AG.camera.lookAt(wx + 0.1, wy + 0.2, wz + 0.1); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); return (r && r.pos.distanceTo(wb.pos) > 0.05) || 'the beam snapped onto the workbench';`);
    await t.step('the ghost keeps its snap while the aim wobbles (no flicker)', `${aim} for (const q of [...B.placed]) B.remove(q, false); const h = window._h; const fy = AG.heightAt(h.x0, h.z0) + 0.05; B.place('floor', new V(h.x0, fy, h.z0), 0); P.spawn(h.x0 - 5, h.z0); B.select('floor'); B.lastSnap = null; const seen = new Set(); for (let i = 0; i < 24; i++) { const j = Math.sin(i * 1.7) * 0.35; AG.camera.position.set(h.x0 - 5, fy + 2.5, h.z0 + j); AG.camera.lookAt(h.x0 + 2.7 + j * 0.5, fy, h.z0 + 0.4 + j); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); seen.add(r.pos.x.toFixed(2) + ',' + r.pos.z.toFixed(2)); } return seen.size === 1 || 'switched between ' + [...seen].join(' | ');`);
    // tester feedback (11 Oct): a thatch panel wouldn't go in between two others. Aiming into the gap, the aim passes
    // through it and lands on the floor below, so snapping has to look along the line of aim, not just where it lands
    const wide = `AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false); const x0 = window._h.x0 - 25, z0 = window._h.z0, y0 = Math.max(...[[-5, -3], [5, -3], [-5, 3], [5, 3], [0, 0]].map(([a, c]) => AG.heightAt(x0 + a, z0 + c))) + 0.05;
      const put = (id, x, y, z, r = 0) => B.place(id, new V(x0 + x, y0 + y, z0 + z), r);
      for (const x of [-3, 0, 3]) for (const z of [-1.5, 1.5]) put('floor', x, 0, z);
      for (const x of [-3, 0, 3]) { put('wall', x, 0, -3); put('wall', x, 0, 3); } for (const z of [-1.5, 1.5]) { put('wall', -4.5, 0, z, Math.PI / 2); put('wall', 4.5, 0, z, Math.PI / 2); }
      put('roof63', -3, 3, -3, Math.PI); put('roof63', 3, 3, -3, Math.PI); window._w = { x0, z0, y0 };`;
    await t.step('a thatch panel snaps into the gap between two others', `${wide} P.spawn(x0, z0 - 5); g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); B.select('roof63'); B.rot = Math.PI; B.lastSnap = null;
      const res = []; for (const [cx, cy, tx, ty] of [[0.6, 6, 0, 4.2], [-0.5, 5, 0.3, 4.6], [1.2, 7, -0.4, 4.0]]) { AG.camera.position.set(x0 + cx, y0 + cy, z0 - 8); AG.camera.lookAt(x0 + tx, y0 + ty, z0 - 1.6); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); B.lastSnap = null; const r = B.placeGhost(); res.push(r && !r.why && Math.abs(r.pos.x - x0) < 0.05 && Math.abs(r.pos.y - (y0 + 3)) < 0.05 && Math.abs(r.pos.z - (z0 - 3)) < 0.05 ? 'ok' : r ? [r.pos.x - x0, r.pos.y - y0, r.pos.z - z0].map((v) => v.toFixed(2)).join(',') + ' ' + r.why : 'no ghost'); }
      return res.every((x) => x === 'ok') || res.join(' | ');`);
    // playtest (15 Oct): beside a floor laid at an angle, the next tile was refused as "Already built here": the check used
    // boxes squared to north and south, and a turned floor's box reaches into the tile next to it
    const turned = `AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false); const r = 30 * Math.PI / 180, x0 = window._h.x0 + 60, z0 = window._h.z0, y0 = AG.heightAt(x0, z0) + 0.03; P.spawn(x0 - 4, z0);
      const at = (dx, dz, dy = 0) => new V(x0 + dx * Math.cos(r) + dz * Math.sin(r), y0 + dy, z0 - dx * Math.sin(r) + dz * Math.cos(r)); B.place('floor', at(0, 0), r);`;
    await t.step('beside a floor laid at 30°, a tile fits on every side', `${turned} const bad = [[3, 0], [-3, 0], [0, 3], [0, -3]].map(([a, c]) => B.invalid(B.piece('floor'), at(a, c), r, true, {})).filter(Boolean); return bad.length === 0 || bad.join(', ');`);
    await t.step('…but not on the same spot, or half over it', `${turned} const why = [[0, 0], [1.5, 0], [0, -1.2]].map(([a, c]) => B.invalid(B.piece('floor'), at(a, c), r, true, {})); return why.every((w) => w === 'Already built here') || why.join(', ');`);
    await t.step('walls at 30°: side by side is fine, crossing one is refused', `${turned} B.place('wall', at(-1.5, -1.5), r); const ok = B.invalid(B.piece('wall'), at(1.5, -1.5), r, true, {}), cross = B.invalid(B.piece('wall'), at(-1.5, -1.5), r + Math.PI / 2, true, {}); return (ok === null && cross === 'Something is in the way') || 'beside: ' + ok + ', crossing: ' + cross;`);
    await t.step('aiming beside a floor laid at 30°, the ghost snaps there and is allowed', `${turned} g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); B.select('floor'); B.rot = r; B.lastSnap = null; const want = at(3, 0);
      AG.camera.position.set(x0 - 4, y0 + 4, z0 - 3); AG.camera.lookAt(want.x, want.y, want.z); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const g2 = B.placeGhost();
      return (g2 && !g2.why && g2.pos.distanceTo(want) < 0.05) || (g2 ? g2.why + ' at ' + g2.pos.distanceTo(want).toFixed(2) + ' m from the spot beside' : 'no ghost');`);
    // playtest (15 Oct): a roof panel aimed at the top of a wall kept going down onto the floor instead
    const walls = `AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false); const x0 = window._h.x0 + 90, z0 = window._h.z0, y0 = AG.heightAt(x0, z0) + 0.05;
      const put = (id, x, y, z, r = 0) => B.place(id, new V(x0 + x, y0 + y, z0 + z), r);
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z);
      put('wall', -1.5, 0, -3); put('wall', 1.5, 0, -3); put('wall', -1.5, 0, 3); put('wall', 1.5, 0, 3); for (const z of [-1.5, 1.5]) { put('wall', -3, 0, z, Math.PI / 2); put('wall', 3, 0, z, Math.PI / 2); }
      g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); B.select('roof63'); B.rot = Math.PI;
      const aim = (px, pz, cx, cy, cz, tx, ty, tz) => { P.spawn(x0 + px, z0 + pz); B.lastSnap = null; AG.camera.position.set(x0 + cx, y0 + cy, z0 + cz); AG.camera.lookAt(x0 + tx, y0 + ty, z0 + tz); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); return r ? { y: r.pos.y - y0, z: r.pos.z - z0, x: r.pos.x - x0, why: r.why } : null; };
      const onTop = (r) => r && !r.why && Math.abs(r.y - 3) < 0.05 && Math.abs(r.z + 3) < 0.05 ? 'ok' : r ? 'at ' + [r.x, r.y, r.z].map((v) => v.toFixed(2)).join(',') + (r.why ? ' (' + r.why + ')' : '') : 'no ghost';`;
    await t.step('from outside, a roof panel aimed at the top of a wall goes on the wall', `${walls} const res = [[-0.4, 2.9], [0.6, 3.0], [1.2, 2.7], [-1.6, 3.1]].map(([tx, ty]) => onTop(aim(tx, -7, tx + 0.5, 3.6, -13, tx, ty, -3))); return res.every((x) => x === 'ok') || res.join(' | ');`);
    await t.step('from inside, a roof panel aimed at the top of a wall goes on the wall', `${walls} const res = [[-0.6, 2.95], [0.8, 3.0], [1.3, 2.8]].map(([tx, ty]) => onTop(aim(0, 1.5, 0.3, 2.4, 2.5, tx, ty, -3))); return res.every((x) => x === 'ok') || res.join(' | ');`);
  },
};
