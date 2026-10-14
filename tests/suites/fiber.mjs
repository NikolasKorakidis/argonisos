// Fiber bushes: they grow near the start, gathering gives fiber, and fiber twists into rope by hand.
export default {
  name: 'Fiber and rope',
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20, null, { timeout: 60000 });
    await t.step('fiber bushes grow near the start (and other kinds keep their ids)', `const b = g.pickups.visible.filter((v) => v.kind === 'bush'); const st = g.pickups.visible.filter((v) => v.kind === 'stone').length; return (b.length >= 5 && st > 5) || 'bushes ' + b.length + ' stones ' + st;`);
    await t.step('walk up to the nearest bush', `const v = g.pickups.visible.filter((v) => v.kind === 'bush').sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; window._b = v; P.spawn(v.x, v.z - 0.9); P.yaw = 0; P.camYaw = Math.PI; P.camPitch = -0.35; return true;`);
    await t.wait(700);
    await t.step('…(the prompt reads Gather Fiber Bush, +3 fiber)', `const t = document.getElementById('prompt').textContent; return /Gather Fiber Bush/.test(t) && /\\+3 fiber/.test(t) || t;`);
    await t.shot('bush');
    await t.step('gathering gives 3 fiber and the bush is gone', `const f0 = inv.count('fiber'); g.interact(); await new Promise((r) => setTimeout(r, 300)); const gone = !g.pickups.visible.some((v) => v.id === window._b.id); return (inv.count('fiber') === f0 + 3 && gone) || 'fiber ' + f0 + ' → ' + inv.count('fiber') + ', bush gone ' + gone;`);
    await t.step('the Rope ×2 recipe is learnt and made by hand: 3 fiber → 2 rope', `const r = C.list().find((r) => r.key === 'ropex2'); const known = C.known.has('ropex2'); const r0 = inv.count('rope'); C.make('ropex2'); return (known && !r.at && inv.count('rope') === r0 + 2 && inv.count('fiber') === 0) || JSON.stringify({ known, rope: inv.count('rope'), fiber: inv.count('fiber') });`);
    await t.step('the leather recipe is still there', `return !!C.list().find((r) => r.key === 'ropex10' && r.at === 'workbench') || 'missing';`);
  },
};
