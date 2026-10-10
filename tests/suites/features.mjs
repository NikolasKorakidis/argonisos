// The polish-pass features, numbered as in that list: pickups, sorting, the hammer menu, repairs, cooking, putting
// fires out, the HUD (biome, minimap, compass, level owls) and buildings fading out of the camera's way.
export default {
  name: 'Features',
  viewport: { w: 1280, h: 760 },
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20, null, { timeout: 60000 });
    await t.step('7  a branch gives 2 wood when picked up', `const v = g.pickups.visible.find((v) => v.kind === 'branch'); P.spawn(v.x, v.z - 0.9); P.yaw = 0; const w0 = inv.count('wood'), b0 = inv.count('branch'); g.interact(); return (inv.count('wood') === w0 + 2 && inv.count('branch') === b0) || 'wood ' + w0 + '→' + inv.count('wood') + ' branch ' + inv.count('branch');`);
    await t.step('9  Sort Items merges and orders the pack (hotbar untouched)', `inv.slots.fill(null); inv.slots[0] = { id: 'hammer', n: 1, dur: 200 }; inv.slots[9] = { id: 'wood', n: 30 }; inv.slots[12] = { id: 'stone', n: 4 }; inv.slots[20] = { id: 'wood', n: 40 }; inv.slots[22] = { id: 'crudeAxe', n: 1, dur: 30 }; g.hud.toggle(true); document.getElementById('invSort').click(); const r = inv.slots.slice(8, 13).map((s) => (s ? s.id + ':' + s.n : '-')).join(' '); g.hud.toggle(false); return (inv.slots[0].id === 'hammer' && r === 'crudeAxe:1 stone:4 wood:50 wood:20 -') || r;`);
    await t.page.evaluate(() => { const g = AG.game; g.give('hammer'); g.give('wood', 60); g.give('stone', 30); g.give('rope', 20); g.give('leather', 5); g.give('resin', 3); for (const k of ['b:wall', 'b:floor', 'b:workbench', 'b:campfire', 'b:cookingStand', 'b:roof63']) g.crafting.known.add(k); g.useSlot(g.inv.slots.findIndex((s) => s?.id === 'hammer' && !s.worn)); });
    await t.step('12 the hammer menu opens with Crafting first', `g.buildMenu.toggle(true); const tabs = [...document.querySelectorAll('#buildMenu nav button')].map((b) => b.textContent); return (g.buildMenu.open && g.buildMenu.cat === 'Crafting' && tabs[0].startsWith('Crafting')) || tabs.join(' | ') + ' cat ' + g.buildMenu.cat;`);
    await t.page.keyboard.press('KeyE'); await t.wait(150);
    await t.step('12 E steps to the next category', `return g.buildMenu.cat === 'Walls' || g.buildMenu.cat;`);
    await t.shot('buildmenu');
    await t.page.click('#buildMenu .bmtile[data-id="wall"]'); await t.wait(150);
    await t.step('12 clicking a piece closes the menu and starts placing it', `return (!g.buildMenu.open && B.sel === 'wall' && !!B.ghost) || 'open ' + g.buildMenu.open + ' sel ' + B.sel;`);
    await t.step('13 repair at the workbench: costs from the recipe, paid only when possible', `AG.S.freeBuild = false; const x = P.pos.x + 25, z = P.pos.z; P.spawn(x - 2, z); B.place('workbench', new V(x, AG.heightAt(x, z), z), 0); inv.slots[30] = { id: 'crudeAxe', n: 1, dur: 20 }; const cost = C.repairCost(inv.slots[30]); const before = JSON.stringify(Object.keys(cost).map((m) => inv.count(m))); C.repair(30); const ok = inv.slots[30].dur === 100; const after = Object.entries(cost).every(([m, n]) => inv.count(m) === JSON.parse(before)[Object.keys(cost).indexOf(m)] - n);
      inv.slots[31] = { id: 'crudeSpear', n: 1, dur: 10 }; const ropeAll = inv.count('rope'); inv.take('rope', ropeAll); const c2 = C.repairCost(inv.slots[31]); const w = inv.count('wood'); C.repair(31); const untouched = inv.slots[31].dur === 10 && inv.count('wood') === w; inv.add('rope', ropeAll);
      return (ok && after && untouched) || JSON.stringify({ cost, ok, after, untouched, c2 });`);
    await t.step('13 "Repair Items" shows in the workbench menu', `g.hud.toggle(true); C.tab = 'craft'; C.sel = 'repair'; C.draw(); const has = !!document.querySelector('.rrow[data-id="repair"]') && !!document.querySelector('#craftDetail .repairList'); g.hud.toggle(false); return has || 'no repair row/list';`);
    await t.step('14 a stand over a fire takes all the meat at once, each cooks on its own timer', `const x = P.pos.x + 6, z = P.pos.z + 6, y = AG.heightAt(x, z); const f = B.place('campfire', new V(x, y, z), 0), st = B.place('cookingStand', new V(x, y, z), 0); window._fire = f; window._stand = st; inv.add('rawMeat', 2); inv.add('rawFish', 2); P.spawn(x - 1.2, z); P.yaw = Math.PI / 2; const t = B.interactable(P.pos, new V(1, 0, 0)); t.use(); const n = st.state.cook.length; for (let i = 0; i < 25; i++) B.update(1); const t2 = B.interactable(P.pos, new V(1, 0, 0)); const lbl = t2.label; t2.use(); return (n === 3 && inv.count('cookedFish') >= 1 && st.state.cook.length === 2) || JSON.stringify({ n, lbl, cook: st.state.cook, fish: inv.count('cookedFish') });`);
    await t.step('14 …the rest finish later and come off together', `const st = window._stand; for (let i = 0; i < 10; i++) B.update(1); const t = B.interactable(P.pos, new V(1, 0, 0)); t.use(); return (inv.count('cookedMeat') >= 2 && st.state.cook.length === 0) || JSON.stringify(st.state.cook);`);
    await t.step('15 a lit campfire offers F: Put out fire', `const f = window._fire; P.spawn(f.pos.x - 1.4, f.pos.z + 1.5); P.yaw = Math.atan2(f.pos.x - P.pos.x, f.pos.z - P.pos.z); inv.take('rawMeat', 99); inv.take('rawFish', 99); const t = B.interactable(P.pos, new V(Math.sin(P.yaw), 0, Math.cos(P.yaw))); return (t?.alt?.key === 'F' && t.alt.label === 'Put out fire') || JSON.stringify(t && { label: t.label, alt: t.alt });`);
    await t.page.evaluate(() => { const g = AG.game; g.trial.st.power = 'roar'; g.trial.st.powerCd = 0; });
    await t.wait(300); await t.page.keyboard.press('KeyF'); await t.wait(300);
    await t.step('15 F puts the fire out (and does not fire the boss power)', `const f = window._fire; return (!f.state.lit && !f.flame.visible && g.trial.st.powerCd === 0) || JSON.stringify({ lit: f.state.lit, cd: g.trial.st.powerCd });`);
    await t.step('15 …and it lights again normally, keeping its wood', `const f = window._fire, fuel = f.state.fuel; const t = B.interactable(P.pos, new V(Math.sin(P.yaw), 0, Math.cos(P.yaw))); t.use(); return (f.state.lit && f.flame.visible && Math.abs(f.state.fuel - Math.min(10, fuel + 1)) < 0.01) || JSON.stringify({ lit: f.state.lit, fuel, now: f.state.fuel });`);
    await t.step('16 the biome label shows the current biome', `const t = document.getElementById('biomeLabel').textContent; return /^Biome: (Pedias|Yleos|Valtos)$/.test(t) || t;`);
    await t.step('17 the minimap is drawn', `const c = document.querySelector('#minimap canvas'), d = c.getContext('2d').getImageData(88, 40, 1, 1).data; return (d[3] > 0) || 'blank';`);
    await t.step('20 the spawn point shows on the compass', `AG.S.bed = { x: P.pos.x - Math.sin(P.camYaw) * 60, z: P.pos.z - Math.cos(P.camYaw) * 60 }; return true;`);
    await t.wait(600);
    await t.step('20 …(compass marker present)', `return !!document.querySelector('#compassStrip .poi.spawn') || document.getElementById('compassStrip').innerHTML.slice(0, 200);`);
    await t.step('19 a level-2 creature shows two owl icons', `const c = g.creatures.spawn('hog', P.pos.x + 4, P.pos.z, { level: 2 }); c.state = 'chase'; return true;`);
    await t.wait(800);
    await t.step('19 …(owls on its plate, no stars)', `const pl = [...document.querySelectorAll('.plate')].find((e) => e.textContent.includes('Hog')); return (pl && pl.querySelectorAll('i.lvl svg').length === 2 && !pl.textContent.includes('★')) || (pl ? pl.innerHTML.slice(0, 160) : 'no plate');`);
    await t.step('18 a wall between the camera and the hero fades', `for (const c of [...g.creatures.list]) g.creatures.remove(c); const x = P.pos.x, z = P.pos.z; const cx = x, cz = z + 6; AG.S.freeBuild = true; const wall = B.place('wall', new V(x, AG.heightAt(x, z + 3), z + 3), 0); window._wall = wall; P.camYaw = 0; P.camPitch = -0.1; P.camDist = 7; P.camBlock = () => null; return true;`);
    await t.wait(1200);
    await t.step('18 …(it is see-through now, others are not)', `const w = window._wall; const op = w.mats.map((m) => m.opacity.toFixed(2)).join(','); const others = B.placed.filter((q) => q !== w).every((q) => q.mats.every((m) => m.opacity === 1)); return (w.mats.every((m) => m.opacity < 0.6) && others) || 'opacity ' + op + ' others ok ' + others;`);
    await t.step('18 …and returns to normal when the view is clear', `P.camYaw = Math.PI; return true;`);
    await t.wait(1500);
    await t.step('18 …(restored exactly)', `const w = window._wall; return w.mats.every((m) => m.opacity === 1 && m.transparent === false && m.depthWrite === true) || w.mats.map((m) => [m.opacity, m.transparent, m.depthWrite]).join(' ');`);
    await t.shot('hud');
  },
};
