// Building: a full house goes up in either order, snapping is exact and steady, overlaps are refused, nothing
// snaps to furniture.
export default {
  name: 'Building',
  async run(t) {
    const house = (order) => `AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false);
      const x0 = 20 + (${order === 'gables' ? 30 : 0}), z0 = 10, y0 = Math.max(...[[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]].map(([a, c]) => AG.heightAt(x0 + a, z0 + c))) + 0.05; P.spawn(x0, z0 + 1);
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
    await t.step('gable end snaps onto the side walls', `${aim} B.select('end63'); B.rot = 0.2; B.lastSnap = null; look(-9, 2.5, 0.3, -3, 2.9, 1); const r = B.placeGhost(); return (Math.abs(r.pos.x - (x0 - 3)) < 0.05 && Math.abs(r.pos.y - (y0 + 3)) < 0.05 && Math.abs(r.pos.z - z0) < 0.05) || 'ghost at ' + [r.pos.x - x0, r.pos.y - y0, r.pos.z - z0].map((v) => v.toFixed(2));`);
    await t.step('a duplicate roof panel is refused (already built)', `${aim} const why = B.invalid(B.piece('roof63'), new V(x0 - 1.5, y0 + 3, z0 + 3), 0, true, {}); return why === 'Already built here' || why;`);
    await t.step('a floor half over another floor is refused', `${aim} const why = B.invalid(B.piece('floor'), new V(x0 - 0.5, y0, z0 - 1.5), 0, true, {}); return why === 'Already built here' || why;`);
    await t.step('a floor next to the house is allowed', `${aim} const why = B.invalid(B.piece('floor'), new V(x0 + 4.5, y0, z0 - 1.5), 0, true, {}); return why === null || why;`);
    await t.step('nothing snaps to the workbench', `${aim} for (const q of [...B.placed]) B.remove(q, false); AG.S.freeBuild = true; const wx = x0 + 40, wz = z0, wy = AG.heightAt(wx, wz); const wb = B.place('workbench', new V(wx, wy, wz), 0); P.spawn(wx + 4, wz); B.select('beamV'); B.lastSnap = null; AG.camera.position.set(wx + 4, wy + 2, wz); AG.camera.lookAt(wx + 0.1, wy + 0.2, wz + 0.1); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); return (r && r.pos.distanceTo(wb.pos) > 0.05) || 'the beam snapped onto the workbench';`);
    await t.step('the ghost keeps its snap while the aim wobbles (no flicker)', `${aim} for (const q of [...B.placed]) B.remove(q, false); const h = window._h; const fy = AG.heightAt(h.x0, h.z0) + 0.05; B.place('floor', new V(h.x0, fy, h.z0), 0); P.spawn(h.x0 - 5, h.z0); B.select('floor'); B.lastSnap = null; const seen = new Set(); for (let i = 0; i < 24; i++) { const j = Math.sin(i * 1.7) * 0.35; AG.camera.position.set(h.x0 - 5, fy + 2.5, h.z0 + j); AG.camera.lookAt(h.x0 + 2.7 + j * 0.5, fy, h.z0 + 0.4 + j); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); seen.add(r.pos.x.toFixed(2) + ',' + r.pos.z.toFixed(2)); } return seen.size === 1 || 'switched between ' + [...seen].join(' | ');`);
  },
};
