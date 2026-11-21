// The whole game end to end, along the guided-gameplay steps: every step of the guide must complete, in order, from the
// first stone picked up to the Chimera's head on its stand. Shortcuts (giving items, killing bosses outright) stand in
// for the slow parts; the real code paths run for everything else (picking up, crafting, building, felling, praying,
// copying olives, summoning, offering), and the guide itself decides whether each step is done.
const at = (kind, extra = '') => `const u = g.structures.uses.find((u) => u.kind === '${kind}'${extra}); if (!u) return 'no ${kind} site'; P.spawn(u.at.x, u.at.z + 0.6); P.pos.y = u.at.y; const t = g.trial.interactable(P.pos); if (!t) return 'nothing to use at ${kind}'; t.use();`;
const kill = (who) => `g.creatures.hurt(${who}, [[99999, 'force']], P);`;
const pick = (kind) => `const v = g.pickups.visible.filter((v) => v.kind === '${kind}').sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; if (!v) return 'no ${kind} nearby'; P.spawn(v.x, v.z - 0.9); P.yaw = 0; g.interact();`;
const guide = (n) => `g.guide.update(1); return g.guide.cur >= ${n} || 'guide at step ' + (g.guide.cur + 1) + ': ' + g.guide.steps[g.guide.cur]?.t;`;

export default {
  name: 'Core loop',
  slow: false,
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20, null, { timeout: 60000 });
    await t.step('the guide starts at its first step', `g.guide.set(true); g.guide.update(1); return g.guide.cur === 0 || g.guide.cur;`);
    await t.step('1 pick up a stone', `${pick('stone')} ${guide(2)}`);
    await t.step('3 pick up a branch: wood', `${pick('branch')} ${guide(3)}`);
    await t.step('4 make a weapon by hand', `g.give('wood', 10); g.give('stone', 4); C.discover(true); C.make('crudeDagger'); ${guide(4)}`);
    await t.step('5 search the abandoned house (rope inside)', `${at('loot')} g.guide.update(1); return (g.guide.cur >= 5 && inv.count('rope') >= 6) || 'step ' + g.guide.cur + ' rope ' + inv.count('rope');`);
    await t.step('6 make a hammer', `g.give('wood', 60); C.discover(true); C.make('hammer'); ${guide(6)}`);
    await t.step('7 build a workbench', `const x = P.pos.x + 12, z = P.pos.z + 12; B.place('workbench', new V(x, AG.heightAt(x, z), z), 0); window._wb = { x, z }; ${guide(7)}`);
    await t.step('8 hunt a deer', `const deer = g.creatures.spawn('deer', P.pos.x + 3, P.pos.z); ${kill('deer')} return true;`);
    await t.wait(800);
    await t.step('8 …pick up what it dropped (a hide)', `for (const v of g.pickups.visible.filter((v) => Math.hypot(v.x - P.pos.x, v.z - P.pos.z) < 8 && v.item)) { P.spawn(v.x, v.z - 0.9); P.yaw = 0; g.interact(); } if (!inv.count('deerHide')) g.give('deerHide'); ${guide(8)}`);
    await t.step('9 make a crude axe at the bench', `P.spawn(window._wb.x - 2, window._wb.z); g.give('stone', 10); C.discover(true); C.make('crudeAxe'); g.guide.update(1); return g.guide.cur >= 9 || 'axe ' + inv.count('crudeAxe') + ': ' + C.blocker(C.list().find((r) => r.key === 'crudeAxe'));`);
    await t.step('10 fell a tree with the axe, then split the log', `
      const { SPECIES } = await import('/src/world/flora.js');
      let tree; for (const c of AG.veg.near.values()) { if (!c.items) continue; for (let o = 0, i = 0; o < c.items.length; o += 7, i++) { const sp = SPECIES[c.items[o]]; if (sp.res === 'tree' && sp.name !== 'titan' && c.items[o + 6] > 0.8 && !AG.veg.removed.has(c.cx + ',' + c.cz + ',' + i) && Math.hypot(c.items[o + 2] - P.pos.x, c.items[o + 4] - P.pos.z) < 60) { tree = { x: c.items[o + 2], z: c.items[o + 4], r: sp.col * c.items[o + 6] }; break; } } if (tree) break; }
      if (!tree) return 'no tree near'; P.spawn(tree.x, tree.z - tree.r - 0.8); P.yaw = 0;
      const axe = g.ITEMS.crudeAxe, n0 = g.harvest.stumps.length; let hits = 0; while (g.harvest.stumps.length === n0 && hits < 60) { if (!g.harvest.strike(axe)) return 'the axe hit nothing (' + hits + ' hits)'; hits++; }
      window._hits = hits; ${guide(10)}`);
    await t.wait(4000);   // (the tree topples and lands as a log)
    await t.step('10 …the log splits into wood', `const w0 = inv.count('wood'); let hits = 0; if (!g.harvest.logs.length) return 'no log on the ground';
      while (g.harvest.logs.length && hits < 80) { const c = g.harvest.logs[0].cols[0]; P.spawn(c.x, c.z - c.r - 0.8); P.yaw = 0; if (!g.harvest.strike(g.ITEMS.crudeAxe)) return 'the axe missed the log'; hits++; }
      return (inv.count('wood') > w0 && !g.harvest.logs.length) || 'wood ' + w0 + ' → ' + inv.count('wood') + ' after ' + hits + ' hits';`);
    await t.step('11 build a campfire', `const { x, z } = window._wb; B.place('campfire', new V(x + 5, AG.heightAt(x + 5, z), z), 0); ${guide(11)}`);
    await t.step('12 a house round the workbench (floors, walls, thatch, gables)', `const { x: x0, z: z0 } = window._wb, y0 = Math.max(...[[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]].map(([a, c]) => AG.heightAt(x0 + a, z0 + c))) + 0.05;
      const put = (id, x, y, z, r = 0) => B.place(id, new V(x0 + x, y0 + y, z0 + z), r);
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z);
      put('wall', -1.5, 0, -3); put('wall', 1.5, 0, -3); put('wall', -3, 0, -1.5, Math.PI / 2); put('wall', -3, 0, 1.5, Math.PI / 2); put('wall', 3, 0, -1.5, Math.PI / 2); put('wall', 3, 0, 1.5, Math.PI / 2); put('wall', -1.5, 0, 3); put('doorframe', 1.5, 0, 3);
      put('roof63', -1.5, 3, -3, Math.PI); put('roof63', 1.5, 3, -3, Math.PI); put('roof63', -1.5, 3, 3, 0); put('roof63', 1.5, 3, 3, 0); put('end63', -3, 3, 0, Math.PI / 2); put('end63', 3, 3, 0, Math.PI / 2);
      ${guide(12)}`);
    await t.step('13 a bed sets the spawn point', `AG.S.bed = { x: window._wb.x, z: window._wb.z }; ${guide(13)}`);
    await t.step('14 a bow and arrows at the roofed bench', `P.spawn(window._wb.x - 2, window._wb.z); g.give('wood', 20); g.give('rope', 6); g.give('leather', 2); g.give('feather', 2); C.discover(true); C.make('crudeBow'); C.make('crudeArrowx10'); g.guide.update(1); return g.guide.cur >= 14 || 'bow ' + inv.count('crudeBow') + ' arrows ' + inv.count('crudeArrow') + ': ' + C.blocker(C.list().find((r) => r.key === 'crudeBow'));`);
    // (praying takes a few seconds on your knees before Zeus answers, in the game's time, slower than the clock's when
    // frames come slowly: game/acts.js)
    await t.step('15 pray at the temple altar', `${at('altar')} const t0 = performance.now(); while (g.trial.st.prayDay < 1 && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 200)); ${guide(15)}`);
    // (the first prayer shows the way on: the nearest marked olive on the map and compass, Patch 23)
    await t.step('15 …and Zeus shows you a marked olive', `const t0 = performance.now(); while (!g.SITES.olives.some((s) => g.map.isKnown(s)) && performance.now() - t0 < 15000) await new Promise((r) => setTimeout(r, 200)); return (g.trial.st.shown && g.SITES.olives.some((s) => g.map.isKnown(s))) || 'no olive shown';`);
    await t.step('16 copy the marks of three olives', `for (let i = 0; i < 3; i++) { ${at('scrap', " && !g.trial.st.scraps.includes(u.id)")} } g.guide.update(1); return g.guide.cur >= 16 || 'copied ' + g.trial.st.scraps.join(',');`);
    await t.step('17 the Minotaur’s tribute', `g.give('deerHide', 5); g.give('olive', 10); ${guide(17)}`);
    // a fight left without the kill (fled) keeps the tribute on the altar: the beast is called again for nothing (Patch 23)
    await t.step('17 lay the tribute at the Labyrinth', `window._hides = inv.count('deerHide'); ${at('summon', " && u.boss === 'minotaur'")} window._u = u; return (g.trial.st.fight === 'minotaur' && inv.count('deerHide') === window._hides - 5) || JSON.stringify({ fight: g.trial.st.fight, hides: inv.count('deerHide') });`);
    await t.page.waitForFunction(() => AG.game.trial.boss && !AG.game.trial.arrival, null, { timeout: 20000 }).catch(() => {});
    await t.step('17 …flee: the beast goes, the tribute stays on the altar', `const c = g.trial.boss; if (!c) return 'no boss came'; P.spawn(c.arena.x + 90, c.arena.z); g.trial.update(0.016); const u = window._u; P.spawn(u.at.x, u.at.z + 0.6); P.pos.y = u.at.y; const lbl = g.trial.interactable(P.pos)?.label;
      return (!g.trial.boss && g.trial.st.paid?.minotaur && !g.trial.st.fight && inv.count('deerHide') === window._hides - 5 && /again/.test(lbl)) || JSON.stringify({ boss: !!g.trial.boss, paid: g.trial.st.paid, lbl, hides: inv.count('deerHide') });`);
    await t.step('18 call the Minotaur at the Labyrinth', `${at('summon', " && u.boss === 'minotaur'")} return true;`);
    await t.page.waitForFunction(() => AG.game.trial.boss && !AG.game.trial.arrival?.c?.fall, null, { timeout: 15000 }).catch(() => {});   // (the beast down out of the sky: its coming keeps the game's time, slower than the clock's when frames come slowly)
    await t.step('19 defeat the Minotaur', `if (!g.trial.boss) return 'no boss came'; ${kill('g.trial.boss')} ${guide(19)}`);
    await t.step('20 offer his head: the Roar is yours', `if (!inv.count('minotaurHead')) g.give('minotaurHead'); ${at('offering', " && u.boss === 'minotaur'")} g.guide.update(1); return (g.guide.cur >= 20 && g.trial.st.power === 'roar' && AG.S.tier >= 1) || 'step ' + g.guide.cur + ' power ' + g.trial.st.power + ' tier ' + AG.S.tier;`);
    await t.step('21 enter Yleos', `g.owl.st.done.push('yleos'); ${guide(21)}`);
    await t.step('22 rubbings in three giant caves', `for (let i = 0; i < 3; i++) { ${at('carving', " && !g.trial.st.carvings.includes(u.id)")} } g.guide.update(1); return g.guide.cur >= 22 || 'carvings ' + g.trial.st.carvings.join(',');`);
    await t.step('23 the Chimera’s tribute', `g.give('dryadHeart', 3); g.give('pomegranate', 10); ${guide(23)}`);
    await t.step('24 call the Chimera at its shrine', `for (const c of [...g.creatures.list]) g.creatures.remove(c); ${at('summon', " && u.boss === 'chimera'")} return true;`);
    await t.page.waitForFunction(() => AG.game.trial.boss && !AG.game.trial.arrival?.c?.fall, null, { timeout: 15000 }).catch(() => {});   // (the beast down out of the sky: its coming keeps the game's time, slower than the clock's when frames come slowly)
    await t.step('25 defeat the Chimera', `if (!g.trial.boss) return 'no boss came'; ${kill('g.trial.boss')} ${guide(25)}`);
    await t.step('26 offer its head: the trial is complete', `if (!inv.count('chimeraHead')) g.give('chimeraHead'); ${at('offering', " && u.boss === 'chimera'")} g.guide.update(1); return (g.guide.cur === g.guide.steps.length && AG.S.tier >= 2) || 'step ' + g.guide.cur + ' tier ' + AG.S.tier;`);
    // save, then reload the page as a player would: the new game loads the save at start-up
    const snap = `return { inv: JSON.stringify(inv.toJSON()), trial: JSON.stringify(g.trial.st), build: g.build.toJSON().length, bed: JSON.stringify(AG.S.bed), stumps: g.harvest.stumps.length, day: AG.S.day };`;
    const before = await t.eval(`inv.slots[30] = { id: 'crudeAxe', n: 1, dur: 17 }; const { save } = await import('/src/game/save.js'); if (!save(g)) return null; ${snap}`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    const after = await t.eval(`const r = { loaded: g.loaded, ...(() => { ${snap} })() }; g.save = () => false; localStorage.removeItem('argonisos.world.v1'); return r;`);
    const diff = before ? Object.keys(before).filter((k) => before[k] !== after[k]) : ['(save failed)'];
    t.check('save, reload: the pack (with durability), the trial, the buildings, stumps and spawn point come back', after.loaded && !diff.length, `loaded ${after.loaded}; ` + diff.map((k) => { const x = String(before?.[k]), y = String(after[k]); let i = 0; while (i < x.length && x[i] === y[i]) i++; i = Math.max(0, i - 60); return `${k}: …${x.slice(i, i + 150)} → …${y.slice(i, i + 150)}`; }).join(' ; '));
    // an older save (from before the woods and bare rock, 15 Oct) keeps the pack, but its felled trees and gathered
    // pickups pointed at a land that has changed: they come back
    const old = await t.eval(`const { save } = await import('/src/game/save.js'); g.save = () => false; save(g); const d = JSON.parse(localStorage.getItem('argonisos.world.v1')); d.world = undefined; d.harvest.removed = ['0,0,3']; d.pickups.taken = [['0,0,1', 1]]; localStorage.setItem('argonisos.world.v1', JSON.stringify(d)); return JSON.stringify(inv.toJSON());`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    const later = await t.eval(`const r = { inv: JSON.stringify(inv.toJSON()), removed: AG.veg.removed.size, taken: g.pickups.taken.size }; g.save = () => false; localStorage.removeItem('argonisos.world.v1'); return r;`);
    t.check('an older save keeps the pack, while its felled trees and gathered pickups come back', later.inv === old && later.removed === 0 && later.taken === 0, JSON.stringify({ sameInv: later.inv === old, removed: later.removed, taken: later.taken }));
    // an old save holding what this version no longer knows (an item gone from the game, in the pack, worn, in a chest, a
    // grave, on the ground and eaten; a skill added since; a fight on as it was saved) loads, leaving those out (Patch 23)
    await t.eval(`const { save } = await import('/src/game/save.js'); g.save = () => false; inv.slots.fill(null); inv.slots[5] = { id: 'crudeAxe', n: 1, dur: 50 }; save(g); const d = JSON.parse(localStorage.getItem('argonisos.world.v1'));
      d.inv.slots[6] = { id: 'goldenFleece', n: 1, worn: 'cape' }; d.inv.slots[7] = { id: 'stone', n: 3, worn: 'hand' }; d.inv.seen.push('goldenFleece'); delete d.player.stats.skills.sneaking;
      d.player.stats.food = [{ id: 'nectar', t: 1000 }, { id: 'cookedMeat', t: 1000 }]; d.graves = [{ x: P.pos.x + 5, y: P.pos.y, z: P.pos.z, slots: [{ id: 'goldenFleece', n: 1 }, { id: 'wood', n: 2 }] }];
      d.pickups.drops.push({ id: 'dx', kind: 'drop', item: 'goldenFleece', n: 1, x: P.pos.x + 0.8, y: P.pos.y, z: P.pos.z, rot: 0 }); d.S.trial.fight = 'chimera';
      d.build.push({ uid: 'pc900', id: 'chest', x: P.pos.x + 9, y: AG.heightAt(P.pos.x + 9, P.pos.z), z: P.pos.z, rot: 0, hp: 200, state: { slots: [{ id: 'goldenFleece', n: 1 }, { id: 'wood', n: 4 }, null, null, null, null, null, null, null, null] } });
      localStorage.setItem('argonisos.world.v1', JSON.stringify(d)); return true;`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    const odd = await t.eval(`const f0 = AG.renderer.info.render.frame; await new Promise((r) => setTimeout(r, 600)); const chest = g.build.placed.find((p) => p.uid === 'pc900' || p.id === 'chest');
      const r = { loaded: g.loaded, inv: inv.slots.filter(Boolean).map((s) => s.id + (s.worn ? ':' + s.worn : '')), sneak: P.stats.skills.sneaking, food: P.stats.food.map((f) => f.id), grave: g.graves.list.at(-1)?.slots.map((s) => s.id), drops: g.pickups.drops.filter((q) => q.item === 'goldenFleece').length,
        chest: chest?.inv?.slots.filter(Boolean).map((s) => s.id), paid: g.trial.st.paid?.chimera, fight: g.trial.st.fight, frames: AG.renderer.info.render.frame !== f0 };
      g.save = () => false; localStorage.removeItem('argonisos.world.v1'); return r;`);
    t.check('an old save with an item gone from the game and a skill added since loads: the unknown left out, the skill at level 1, the game running', odd.loaded && odd.inv.join() === 'crudeAxe,stone' && odd.sneak?.level === 1 && odd.food.join() === 'cookedMeat' && odd.grave?.join() === 'wood' && !odd.drops && (!odd.chest || odd.chest.join() === 'wood') && odd.frames, JSON.stringify(odd));
    t.check('…and a fight that was on when it was saved leaves its tribute on the altar', odd.paid && !odd.fight, JSON.stringify(odd));
    // a save that can't be read at all is kept beside it (.bak), and the game starts a new trial and says so (one that
    // may have saved itself meanwhile)
    await t.eval(`g.save = () => false; localStorage.setItem('argonisos.world.v1', '{"v":1,"S":{"day":3},"player":'); return true;`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.game.saveLost && AG.player.hero.model && AG.terrain.pending === 0, null, { timeout: 150000 }).catch(() => {});
    const lost = await t.eval(`const r = { lost: !!g.saveLost, loaded: g.loaded, bak: localStorage.getItem('argonisos.world.v1.bak'), saveDay: JSON.parse(localStorage.getItem('argonisos.world.v1') || 'null')?.S?.day ?? null, day: AG.S.day }; g.save = () => false; localStorage.removeItem('argonisos.world.v1.bak'); localStorage.removeItem('argonisos.world.v1'); return r;`);
    t.check('a save that can\'t be read is kept as a backup, and a new trial starts, saying so', lost.lost && !lost.loaded && lost.bak === '{"v":1,"S":{"day":3},"player":' && (lost.saveDay === null || lost.saveDay === 1) && lost.day === 1, JSON.stringify(lost));
  },
};
