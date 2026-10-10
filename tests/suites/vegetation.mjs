// Trees and buildings that block the camera: a tree between the camera and the hero fades (just that one, swapped out
// of its batch for a faded copy) and comes back; felling takes a tree out of its batch; a site building fades on its own
// copy without touching the shared materials.
export default {
  name: 'Vegetation and occlusion',
  async run(t) {
    await t.page.waitForFunction(() => AG.veg.near.size > 4, null, { timeout: 60000 });
    await t.step('a tree between the camera and the hero fades', `let tr = null; for (const b of AG.veg.batches.values()) { if (!b.meshes[1] || !b.n) continue; for (let k = 0; k < b.n; k++) { const c = b.refs[k * 2], i = b.refs[k * 2 + 1], o = i * 7; if (c.items[o + 6] > 0.8 && Math.hypot(c.items[o + 2] - P.pos.x, c.items[o + 4] - P.pos.z) < 40) { tr = { c, i, x: c.items[o + 2], z: c.items[o + 4] }; break; } } if (tr) break; }
      if (!tr) return 'no tree'; window._t = tr; P.camBlock = () => null; P.spawn(tr.x, tr.z - 3.2); P.camYaw = 0; P.camPitch = -0.05; P.camDist = 7; return true;`);
    await t.wait(600);
    // the camera sits off the hero's shoulder: shift the hero so the line from the camera passes through the trunk
    await t.step('…(lined up so the camera looks through the trunk)', `const tr = window._t, c = AG.camera.position, x = c.x + ((tr.z - c.z) / (P.pos.z - c.z)) * (P.pos.x - c.x); P.spawn(P.pos.x + tr.x - x, P.pos.z); return true;`);
    await t.wait(1200);
    await t.step('…(hidden in its batch, a faded copy stands in)', `const e = [...g.occlusion.faded.values()].find((e) => e.kind === 'tree'); return (e && window._t.c.hidden?.has(window._t.i)) || 'faded: ' + [...g.occlusion.faded.keys()].join(',');`);
    await t.step('…turn the camera away', `P.camYaw = Math.PI; return true;`);
    await t.wait(1500);
    await t.step('…(restored, no faded copies left)', `return (!window._t.c.hidden?.has(window._t.i) && g.occlusion.faded.size === 0) || 'still hidden';`);
    await t.step('felling a tree takes it out of its batch', `const tr = window._t, n = () => [...AG.veg.batches.values()].reduce((a, b) => a + b.n, 0); const before = n(); AG.veg.remove(tr.c.cx, tr.c.cz, tr.i); AG.veg.cull(AG.camera, P.pos); const after = n(); return after === before - 1 || before + ' → ' + after;`);
    await t.step('a site building between the camera and the hero fades', `const H = AG.game.SITES.house; const grp = g.structures.groups.reduce((a, b) => (Math.hypot(b.position.x - H.x, b.position.z - H.z) < Math.hypot(a.position.x - H.x, a.position.z - H.z) ? b : a)); const box = new AG.THREE.Box3().setFromObject(grp), c = box.getCenter(new V()), sz = box.getSize(new V()); window._grp = grp; window._orig = grp.children.filter((m) => m.isMesh).map((m) => m.material); P.spawn(c.x, c.z - sz.z / 2 - 2); P.camYaw = 0; P.camDist = 7; return true;`);
    await t.wait(1500);
    await t.step('…(on its own faded copy; shared materials untouched)', `const sk = [...g.occlusion.faded.keys()].filter((k) => k[0] === 's'); const shared = window._orig.flat().every((m) => m.opacity === 1); return (sk.length > 0 && shared) || JSON.stringify({ keys: [...g.occlusion.faded.keys()], shared });`);
    await t.shot('house-faded');
    await t.step('…turn the camera away', `P.camYaw = Math.PI; return true;`);
    await t.wait(1500);
    await t.step('…(original materials back on every mesh)', `const now = window._grp.children.filter((m) => m.isMesh).map((m) => m.material); return (now.every((m, i) => m === window._orig[i]) && g.occlusion.faded.size === 0) || 'not restored: ' + g.occlusion.faded.size;`);
  },
};
