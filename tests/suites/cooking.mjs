// The campfire and the cooking stand over it, as the tester found them (11 Oct): the stand has to go right over the
// fire, and the fire under it must stay usable whatever is in your pack.
const face = `const f = window._fire; P.spawn(f.pos.x - 1.3, f.pos.z); P.yaw = Math.PI / 2; const fwd = new V(1, 0, 0); const it = () => B.interactable(P.pos, fwd);`;

export default {
  name: 'Campfire and cooking',
  async run(t) {
    await t.step('build a campfire', `AG.S.freeBuild = true; g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); const x = P.pos.x + 6, z = P.pos.z + 4; window._fire = B.place('campfire', new V(x, AG.heightAt(x, z), z), 0); return !!window._fire;`);
    await t.step('aiming at the fire with the cooking stand, it settles right over the fire', `${face} B.select('cookingStand'); B.lastSnap = null; const res = [];
      for (const [dx, dz] of [[0, 0], [0.5, 0.3], [-0.4, -0.5]]) { AG.camera.position.set(f.pos.x - 4, f.pos.y + 3, f.pos.z + 0.5); AG.camera.lookAt(f.pos.x + dx, f.pos.y + 0.2, f.pos.z + dz); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true); const r = B.placeGhost(); res.push(r && !r.why && r.pos.distanceTo(f.pos) < 0.01 ? 'ok' : r ? r.why + ' at ' + r.pos.distanceTo(f.pos).toFixed(2) + ' m' : 'no ghost'); }
      if (!res.every((x) => x === 'ok')) return res.join(' | '); window._stand = B.place('cookingStand', f.pos.clone(), f.rot); B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; return true;`);
    await t.step('with raw meat in the pack and the fire out, E lights the fire', `${face} B.douseAction(f)?.use(); inv.add('rawMeat', 4); g.give('wood', 10); const a = it(); if (a?.label !== 'Light the fire') return 'E offers: ' + a?.label; a.use(); return f.state.lit || 'not lit';`);
    await t.step('…once it burns, E puts the meat on the stand', `${face} const a = it(); if (!/^Cook/.test(a?.label || '')) return 'E offers: ' + a?.label; a.use(); return window._stand.state.cook.length === 3 || 'on the stand: ' + window._stand.state.cook.length;`);
    await t.step('…with the stand full and cooking, E feeds the fire', `${face} const a = it(); return /^Add wood/.test(a?.label || '') || 'E offers: ' + a?.label;`);
    await t.step('…and F still puts the fire out', `${face} const a = it(); return a?.alt?.label === 'Put out fire' || 'F offers: ' + a?.alt?.label;`);
    await t.step('…when the meat is done, E takes it off', `${face} for (let i = 0; i < 40; i++) B.update(1); f.state.fuel = 10; const a = it(); if (!/^Take/.test(a?.label || '')) return 'E offers: ' + a?.label; const n = inv.count('cookedMeat'); a.use(); return inv.count('cookedMeat') === n + 3 || 'cooked meat ' + n + ' → ' + inv.count('cookedMeat');`);
  },
};
