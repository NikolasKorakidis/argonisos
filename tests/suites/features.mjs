// The polish-pass features, numbered as in that list: pickups, sorting, the hammer menu, repairs, cooking, putting
// fires out, the HUD (biome, minimap, compass, level owls) and buildings fading out of the camera's way.
export default {
  name: 'Features',
  viewport: { w: 1280, h: 760 },
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20, null, { timeout: 60000 });
    await t.step('7  a branch gives 2 wood when picked up', `const v = g.pickups.visible.find((v) => v.kind === 'branch'); P.spawn(v.x, v.z - 0.9); P.yaw = 0; const w0 = inv.count('wood'), b0 = inv.count('branch'); g.interact(); return (inv.count('wood') === w0 + 2 && inv.count('branch') === b0) || 'wood ' + w0 + '→' + inv.count('wood') + ' branch ' + inv.count('branch');`);
    await t.step('9  Sort Items merges and orders the pack (hotbar untouched)', `inv.slots.fill(null); inv.slots[0] = { id: 'hammer', n: 1, dur: 200 }; inv.slots[11] = { id: 'wood', n: 30 }; inv.slots[14] = { id: 'stone', n: 4 }; inv.slots[22] = { id: 'wood', n: 40 }; inv.slots[24] = { id: 'crudeAxe', n: 1, dur: 30 }; g.hud.toggle(true); document.getElementById('invSort').click(); const r = inv.slots.slice(10, 15).map((s) => (s ? s.id + ':' + s.n : '-')).join(' '); g.hud.toggle(false); return (inv.slots[0].id === 'hammer' && r === 'crudeAxe:1 stone:4 wood:50 wood:20 -') || r;`);
    await t.page.evaluate(() => { const g = AG.game; g.give('hammer'); g.give('wood', 60); g.give('stone', 30); g.give('rope', 20); g.give('leather', 5); g.give('resin', 3); for (const k of ['b:wall', 'b:floor', 'b:workbench', 'b:campfire', 'b:cookingStand', 'b:roof63']) g.crafting.known.add(k); g.useSlot(g.inv.slots.findIndex((s) => s?.id === 'hammer' && !s.worn)); });
    await t.step('12 the hammer menu opens with Crafting first', `g.buildMenu.toggle(true); const tabs = [...document.querySelectorAll('#buildMenu nav button')].map((b) => b.textContent); return (g.buildMenu.open && g.buildMenu.cat === 'Crafting' && tabs[0].startsWith('Crafting')) || tabs.join(' | ') + ' cat ' + g.buildMenu.cat;`);
    await t.page.keyboard.press('KeyE'); await t.wait(150);
    await t.step('12 E steps to the next category', `return g.buildMenu.cat === 'Walls' || g.buildMenu.cat;`);
    await t.shot('buildmenu');
    await t.page.click('#buildMenu .bmtile[data-id="wall"]'); await t.wait(150);
    await t.step('12 clicking a piece closes the menu and starts placing it', `return (!g.buildMenu.open && B.sel === 'wall' && !!B.ghost) || 'open ' + g.buildMenu.open + ' sel ' + B.sel;`);
    await t.step('13 repair at the workbench is free: durability back in full, no materials taken, only at a bench', `const { ITEMS } = await import('/src/game/items.js'); AG.S.freeBuild = false; const x = P.pos.x + 25, z = P.pos.z; P.spawn(x - 2, z); const wb = B.place('workbench', new V(x, AG.heightAt(x, z), z), 0); inv.slots[30] = { id: 'crudeAxe', n: 1, dur: 20 }; inv.slots[31] = { id: 'crudeSpear', n: 1, dur: 10 };
      const ropeAll = inv.count('rope'); inv.take('rope', ropeAll); const before = JSON.stringify(inv.slots.filter((s) => s && !ITEMS[s.id].dur)); C.repair(30); C.repair(31); const same = JSON.stringify(inv.slots.filter((s) => s && !ITEMS[s.id].dur)) === before; inv.add('rope', ropeAll);
      const full = inv.slots[30].dur === ITEMS.crudeAxe.dur && inv.slots[31].dur === ITEMS.crudeSpear.dur;
      inv.slots[31].dur = 5; P.spawn(x - 30, z); C.repair(31); const away = inv.slots[31].dur === 5; P.spawn(x - 2, z); C.repair(31);
      return (full && same && away && inv.slots[31].dur === ITEMS.crudeSpear.dur) || JSON.stringify({ full, same, away });`);
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
    // the interface's colours are defined and its words aren't black on dark (a broken stylesheet once turned every menu's
    // text black: tools/check-css.mjs guards the file, this the page)
    await t.step('17b the interface reads: its palette is defined and no title, label or button text is black', `const cs = getComputedStyle(document.documentElement); if (!cs.getPropertyValue('--cream').trim()) return 'the palette (--cream) is undefined';
      const dark = [...document.querySelectorAll('#hud *, .pnl > h2, .btn, #clock, #biomeLabel, #compassStrip span')].filter((e) => e.offsetParent && e.textContent.trim() && !e.children.length).filter((e) => { const m = getComputedStyle(e).color.match(/\\d+/g).map(Number); return m[0] + m[1] + m[2] < 60; });
      return !dark.length || 'black text: ' + dark.slice(0, 4).map((e) => (e.id || e.className || e.tagName) + ' "' + e.textContent.trim().slice(0, 20) + '"').join(', ');`);
    await t.step('20 the spawn point shows on the compass', `AG.S.bed = { x: P.pos.x - Math.sin(P.camYaw) * 60, z: P.pos.z - Math.cos(P.camYaw) * 60 }; return true;`);
    await t.wait(600);
    await t.step('20 …(compass marker present)', `return !!document.querySelector('#compassStrip .poi.spawn') || document.getElementById('compassStrip').innerHTML.slice(0, 200);`);
    await t.step('19 a level-2 creature shows two owl icons', `const c = g.creatures.spawn('hog', P.pos.x + 4, P.pos.z, { level: 2 }); c.state = 'chase'; return true;`);
    await t.wait(800);
    await t.step('19 …(owls on its plate, no stars)', `const pl = [...document.querySelectorAll('.plate')].find((e) => e.textContent.includes('Hog')); return (pl && pl.querySelectorAll('i.lvl svg').length === 2 && !pl.textContent.includes('★')) || (pl ? pl.innerHTML.slice(0, 160) : 'no plate');`);
    // (since Patch 25 a wall between doesn't fade: the camera comes in front of it, like Valheim, and goes back out after)
    await t.step('18 a wall between the camera and the hero holds the camera in front of it', `for (const c of [...g.creatures.list]) g.creatures.remove(c); const x = P.pos.x, z = P.pos.z; AG.S.freeBuild = true; P.camYaw = 0; P.camPitch = -0.1; P.camDist = 7; await frames(30); const wall = B.place('wall', new V(x, AG.heightAt(x, z + 3), z + 3), 0); window._wall = wall; return true;`);
    await t.wait(600);
    await t.step('18 …(in front of the wall, the wall still solid)', `const w = window._wall, c = AG.camera.position; return (c.z < w.pos.z - 0.1 && P.camD < 3.4 && w.mats.every((m) => m.opacity === 1)) || JSON.stringify({ camZ: c.z - w.pos.z, camD: P.camD, op: w.mats.map((m) => m.opacity) });`);
    await t.step('18 …and back out when the view is clear', `P.camYaw = Math.PI; return true;`);
    // (it eases back out over a second or so of frames: waited for, however slow the frames come)
    await t.step('18 …(the full distance again)', `await until(() => P.camD > 6.5, 6000); return P.camD > 6.5 || 'camera at ' + P.camD.toFixed(2) + ' m';`);
    await t.shot('hud');

    // ---- Patch 23, fights and survival: each fix of the gameplay review with its own check
    const F = `const { input } = await import('/src/input.js'); const frames = (n) => new Promise((r) => { let i = 0; const f = () => (++i >= n ? r() : requestAnimationFrame(f)); requestAnimationFrame(f); });
      const until = async (f, ms) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await new Promise((r) => requestAnimationFrame(r)); return !!f(); };
      const wear = (...ids) => { for (const s of inv.slots) if (s?.worn) delete s.worn; for (const id of ids) { if (!inv.count(id)) g.give(id, 1); g.equip(inv.slots.findIndex((s) => s?.id === id && !s.worn)); } P.equip = null; };
      const ahead = (d) => new V(P.pos.x + Math.sin(P.yaw) * d, P.pos.y, P.pos.z + Math.cos(P.yaw) * d);
      const fake = (o) => ({ pos: ahead(1.5), yaw: P.yaw + Math.PI, dmgK: 1, hitT: 0, atkCd: 0, body: {}, ...o });`;
    await t.eval(`for (const c of [...g.creatures.list]) g.creatures.remove(c); B.remove(window._wall, false); P.spawn(P.pos.x + 40, P.pos.z); return true;`);
    await t.step('23 the roll works without a guard: with bare hands and with the bow drawn (LMB held; RMB, Space), for its stamina', `${F} const out = {};
      for (const kit of [[], ['crudeBow']]) { wear(...kit); P.dodge = null; if (kit.length) { g.give('crudeArrow', 10); input.lmb = true; await frames(40); } const drawn = P.aiming; P.stats.stamina = 50; input.rmb = true; input.clicks.push(2); await frames(3);
        input.pressed.add('Space'); await frames(4); const k = kit[0] || 'hands'; out[k] = { rolled: !!P.dodge, cost: +(50 - P.stats.stamina).toFixed(1), drawn, lowered: !P.aiming };
        await until(() => !P.dodge, 3000); input.rmb = false; input.lmb = false; await frames(3); }
      wear(); return (out.hands.rolled && out.hands.cost > 10 && out.crudeBow.rolled && out.crudeBow.drawn && out.crudeBow.lowered) || JSON.stringify(out);`);
    await t.step('23 a parry staggers a hog, never a boss, and a giant only when the guard holds most of its blow; a tower shield soaks but cannot parry', `${F} const { TYPES } = await import('/src/creatures/creatures.js'); wear('crudeAxe', 'crudeShield'); P.stats.god = true; const out = {};
      const parry = (c, dmg) => { P.blocking = true; g.combat.blockT = 0; P.stats.stamina = 50; g.combat.hitPlayer(c, dmg); return c.hitT > 0; };
      out.hog = parry(fake({ T: TYPES.hog, type: 'hog' }), [10, 10, 'pierce']); out.boss = parry(fake({ T: TYPES.minotaur, type: 'minotaur', boss: true }), [30, 30, 'slash']);
      out.giantHard = parry(fake({ T: TYPES.giant, type: 'giant' }), [60, 60, 'blunt']); out.giantSoft = parry(fake({ T: TYPES.giant, type: 'giant' }), [40, 40, 'blunt']);
      wear('crudeAxe', 'crudeTowerShield'); out.tower = g.combat.parryBonus(); out.towerHog = parry(fake({ T: TYPES.hog, type: 'hog' }), [10, 10, 'pierce']);
      P.blocking = false; P.stats.god = false; wear(); return (out.hog && !out.boss && !out.giantHard && out.giantSoft && out.tower === 0 && !out.towerHog) || JSON.stringify(out);`);
    await t.step('23 a beast outside a wall can\'t strike you inside it: its blow goes into the wall', `${F} AG.S.freeBuild = true; const f = new V(Math.sin(P.yaw), 0, Math.cos(P.yaw)), w = ahead(1.2); w.y = AG.heightAt(w.x, w.z);
      const wall = B.place('wall', w, P.yaw), c = g.creatures.spawn('hog', P.pos.x + f.x * 2.6, P.pos.z + f.z * 2.6, { level: 0, aware: true, young: false }); c.yaw = Math.atan2(-f.x, -f.z);
      const through = g.creatures.walled(c, P.pos, c.pos.distanceTo(P.pos)); B.remove(wall, false); const open = g.creatures.walled(c, P.pos, c.pos.distanceTo(P.pos)); g.creatures.remove(c);
      return (through && !open) || JSON.stringify({ through, open });`);
    await t.step('23 the Chimera\'s sting poisons only when it lands: not rolled clear of, not blocked', `${F} const { TYPES } = await import('/src/creatures/creatures.js'); P.stats.god = true; const c = fake({ T: TYPES.chimera, type: 'chimera', boss: true, pos: ahead(5) }); const out = {};
      const sting = () => { P.stats.remove('poisoned'); g.trial.runMove(c, { k: 'sting', ph: 0, t: 0, hit: 0, dur: 1 }, 0.016, 5, P.yaw); return P.stats.has('poisoned'); };
      P.dodge = { t: 0.2, yaw: P.yaw }; out.rolled = sting(); P.dodge = null; out.hit = sting(); P.stats.remove('poisoned'); P.stats.god = false; return (!out.rolled && out.hit) || JSON.stringify(out);`);
    await t.step('23 arrows grow with the Bowman skill, Zeus\'s Blessing and the Cretan helmet, take the bow\'s own backstab, and a full set\'s bonus counts', `${F} wear('cretanBow', 'cretanHelmet', 'cretanArmor', 'cretanLegs', 'cretanCape'); g.give('crudeArrow', 10); const S = P.stats, sk = S.skills.bow, lv = sk.level;
      sk.level = 21; S.add('zeusBlessing'); g.combat.shoot(1); const a = g.combat.arrows.at(-1), want = S.damageK('bow') * 1.1 * 1.05; sk.level = lv; S.remove('zeusBlessing');
      const { SET_BONUS } = await import('/src/game/items.js'), armour = g.armor(); wear();
      return (Math.abs(a.k - want) < 1e-6 && a.backstab === 4 && armour === Math.round(36 * SET_BONUS)) || JSON.stringify({ k: a.k, want, backstab: a.backstab, armour });`);
    await t.step('23 the worn cape shows on a held frame too (S.still: no NaN in its rope)', `${F} AG.S.still = true; wear('cretanCape'); await frames(20); const K = P.hero.cape; if (!K) { AG.S.still = false; wear(); return true; }
      const ok = K.group.visible && K.bones.every((b) => Number.isFinite(b.getWorldPosition(new V()).y)); AG.S.still = false; await frames(20); const moving = K.pts?.every((p) => Number.isFinite(p.y)); wear();
      return (ok && moving !== false) || JSON.stringify({ ok, moving });`);
    await t.step('23 a deer bolts from 18 m, and the better you sneak (and with a hunting bow) the closer you get', `${F} const { TYPES } = await import('/src/creatures/creatures.js'); const c = { pos: ahead(10), yaw: P.yaw + Math.PI, state: 'idle' }, sk = P.stats.skills.sneaking, lv = sk.level;
      P.sneaking = true; sk.level = 1; const k1 = g.creatures.senseK(c, P.pos, P); sk.level = 100; const k100 = g.creatures.senseK(c, P.pos, P); wear('cretanBow'); const kBow = g.creatures.senseK(c, P.pos, P); wear(); sk.level = lv; P.sneaking = false;
      return (TYPES.deer.flee >= 18 && k1 === 0.5 && k100 < 0.32 && kBow < k100) || JSON.stringify({ flee: TYPES.deer.flee, k1, k100, kBow });`);
    await t.step('23 a beast that lost you can be sneak-attacked again', `const c = g.creatures.spawn('hog', P.pos.x + 70, P.pos.z, { level: 0, aware: true }); c.state = 'chase'; g.creatures.update(0.016); const calm = c.state === 'idle' && !c.aware; g.creatures.remove(c); return calm || JSON.stringify({ state: c.state, aware: c.aware });`);
    await t.step('23 death takes 5% of each used skill (a level can go), leaves the unused alone, and the skill bars stay in their frames', `const { xpForLevel } = await import('/src/player/stats.js'); const S = P.stats, keep = JSON.stringify(S.skills);
      S.skills.axe = { level: 10, xp: xpForLevel(10) + 10, seen: true }; S.skills.swimming = { level: 1, xp: 0 }; const lost = S.deathPenalty(), axe = S.skills.axe;
      S.skills.mace = { level: 5, xp: 0 }; g.hud.toggle(true); const widths = [...document.querySelectorAll('#charBody .skill u')].map((u) => parseFloat(u.style.width)); g.hud.toggle(false); S.skills = JSON.parse(keep);
      return (axe.level === 9 && lost.some(([n]) => n === 'Axeman') && !lost.some(([n]) => n === 'Swimming') && widths.every((w) => w >= 0 && w <= 100)) || JSON.stringify({ axe, lost, widths });`);
    await t.step('23 dying saves at once: the grave, your waking at the bed, and the pack in the grave (a tab closed on the death screen loses nothing)', `const { save } = await import('/src/game/save.js'); const fake = g.save; g.save = () => save(g); AG.S.bed = { x: P.pos.x + 30, z: P.pos.z };
      g.give('stone', 7); P.stats.damage(9999); const d = JSON.parse(localStorage.getItem('argonisos.world.v1') || 'null'); g.save = fake; localStorage.removeItem('argonisos.world.v1');
      const gr = d?.graves?.at(-1); window._grave = g.graves.list.at(-1);
      return (gr && gr.slots.some((s) => s.id === 'stone') && !d.inv.slots.some(Boolean) && Math.abs(d.player.x - AG.S.bed.x) < 0.01 && d.player.stats.health > 0) || JSON.stringify({ graves: d?.graves?.length, player: d?.player && [d.player.x, d.player.stats.health] });`);
    await t.page.waitForFunction(() => !AG.player.dead, null, { timeout: 15000 });
    await t.eval(`const q = window._grave; P.camYaw = Math.atan2(q.x - P.pos.x, q.z - P.pos.z) - Math.PI; return true;`); await t.wait(800);
    await t.step('23 …your grave is on the compass when you wake at your bed', `return !!document.querySelector('#compassStrip .poi.grave') || document.getElementById('compassStrip').innerHTML.slice(0, 200);`);
    await t.step('23 …and is gone from them once emptied', `g.graves.recover(window._grave); await new Promise((r) => setTimeout(r, 700)); return !document.querySelector('#compassStrip .poi.grave') || 'still marked';`);
    await t.step('23 the Owl reads again what she has told you (pause menu), and no longer says dryads fear fire', `const { TOPICS } = await import('/src/game/owl.js'); g.owl.st.done = ['intro', 'fight', 'temple']; g.owl.counsel(() => (window._back = true));
      const list = [...document.querySelectorAll('#owlCounsel [data-t]')].map((b) => b.dataset.t); document.querySelector('#owlCounsel [data-t="fight"]').click(); const shown = document.querySelector('#owlTalk h3').textContent;
      g.owl.next(); const back = !document.querySelector('#owlCounsel').classList.contains('hidden'); document.getElementById('counselX').click(); g.owl.st.done = ['intro', 'fight', 'night', 'house', 'temple', 'death']; g.owl.st.queue = [];
      return (list.join() === 'intro,fight,temple' && shown === 'Guard and Roll' && back && window._back && !/fear fire/.test(TOPICS.yleos[0].body)) || JSON.stringify({ list, shown, back, closed: window._back });`);
    await t.step('23 the clock\'s figures are Cinzel\'s, not Stoix\'s slashed zero', `const f = getComputedStyle(document.querySelector('#clock span')).fontFamily; return /^"?Cinzel/.test(f) || f;`);
    // ---- Patch 25, the pack: a ten-slot hotbar, a pack panel that keeps its size, breaking crafted things down, and Esc
    // in fullscreen (which headless Chrome can't enter: its leaving and the mouse's release are sent as the browser would)
    const K = `const key = async (code) => { dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); await frames(2); dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); await frames(1); };
      const rclick = (i, shiftKey) => document.querySelector('#invGrid .slot[data-i="' + i + '"]').dispatchEvent(new PointerEvent('pointerdown', { button: 2, shiftKey, bubbles: true }));
      const asked = () => !document.getElementById('dropAsk')?.classList.contains('hidden') && !!document.getElementById('dropAsk');`;
    await t.step('25 the hotbar has ten slots, numbered 1 to 9 and 0', `const { COLS } = await import('/src/game/inventory.js'); inv.slots.fill(null); inv.onChange(); await frames(15); const b = [...document.querySelectorAll('#hotbar .slot b')].map((e) => e.textContent).join('');
      return (COLS === 10 && inv.slots.length === 40 && b === '1234567890') || JSON.stringify({ COLS, n: inv.slots.length, b });`);
    await t.step('25 keys 1 to 9 and 0 take up the ten hotbar slots, each its own', `${K} for (const s of inv.slots) if (s) delete s.worn; inv.slots.fill(null);
      const ids = ['crudeAxe', 'crudeClub', 'crudeDagger', 'hammer', 'pickaxe', 'lightstoneAxe', 'lightstoneDagger', 'torch', 'crudeSpear', 'lightstoneSpear']; ids.forEach((id, i) => { inv.slots[i] = { id, n: 1, dur: g.ITEMS[id].dur }; }); inv.onChange();
      if (g.hud.open) g.hud.toggle(false); const got = [];
      for (let k = 0; k < 10; k++) { await key('Digit' + ((k + 1) % 10)); got.push(inv.slots[k].worn === 'hand' && inv.slots.filter((s) => s?.worn).length === 1 ? 'ok' : 'slot ' + k + ': ' + inv.slots.map((s) => s?.worn || '-').join(' ')); }
      for (const s of inv.slots) if (s) delete s.worn; inv.onChange(); return got.every((x) => x === 'ok') || got.filter((x) => x !== 'ok').join('; ');`);
    await t.step('25 the pack panel keeps its size, whatever the description (a long one scrolls in its box)', `const { ITEMS } = await import('/src/game/items.js'); inv.slots.fill(null); g.hud.toggle(true); await frames(2); const pn = document.getElementById('packPnl'), box = document.getElementById('invInfo'), sizes = new Set(); let scrolls = false;
      const keep = ITEMS.wood.note; ITEMS.wood.note = 'A very long description that goes on and on, '.repeat(16) + 'Unbroken' + 'x'.repeat(120);
      for (const id of Object.keys(ITEMS)) { inv.slots[10] = { id, n: 1, ...(ITEMS[id].dur ? { dur: ITEMS[id].dur } : {}) }; g.hud.info(10); sizes.add(pn.offsetWidth + 'x' + pn.offsetHeight); if (id === 'wood') scrolls = box.scrollHeight > box.clientHeight; }
      inv.slots[10] = null; g.hud.info(10); sizes.add(pn.offsetWidth + 'x' + pn.offsetHeight); ITEMS.wood.note = keep; g.hud.toggle(false);
      return (sizes.size === 1 && scrolls) || JSON.stringify({ sizes: [...sizes], scrolls });`);
    await t.step('25 Shift + right-click breaks a crafted thing down for half its materials, asked first; a plain right-click still uses it', `${K} for (const s of inv.slots) if (s) delete s.worn; inv.slots.fill(null); inv.slots[12] = { id: 'crudeAxe', n: 1, dur: 40 }; inv.onChange(); g.hud.toggle(true); await frames(2); const out = {};
      rclick(12, true); await frames(2); out.asked = asked() && inv.slots[12]?.id === 'crudeAxe'; document.getElementById('dropNo').click(); out.kept = !asked() && inv.slots[12]?.id === 'crudeAxe';
      rclick(12, true); await frames(2); document.getElementById('dropYes').click(); await frames(2); out.gone = !inv.slots.some((s) => s?.id === 'crudeAxe'); out.back = ['wood', 'stone', 'rope'].map((m) => inv.count(m)).join();
      inv.slots.fill(null); inv.slots[13] = { id: 'crudeArrow', n: 25 }; inv.slots[14] = { id: 'crudeDagger', n: 1, dur: 30 }; inv.slots[15] = { id: 'stone', n: 10 }; inv.onChange(); await frames(1);
      rclick(13, true); await frames(2); document.getElementById('dropYes').click(); await frames(2); out.arrows = inv.count('crudeArrow') + ':' + inv.count('wood') + ',' + inv.count('feather');
      rclick(15, true); await frames(2); out.stone = !asked() && inv.count('stone') === 10;
      rclick(14, false); await frames(2); out.used = inv.slots[14]?.worn === 'hand' && !asked(); rclick(14, true); await frames(2); out.wornRefused = !asked() && inv.slots[14]?.id === 'crudeDagger';
      g.hud.toggle(false); for (const s of inv.slots) if (s) delete s.worn; inv.slots.fill(null); inv.onChange();
      return (out.asked && out.kept && out.gone && out.back === '2,2,1' && out.arrows === '15:2,1' && out.stone && out.used && out.wornRefused) || JSON.stringify(out);`);
    await t.step('25 leaving fullscreen mid-game opens the pause menu, the pack closed first', `const { input } = await import('/src/input.js'); const menu = () => !document.getElementById('pause').classList.contains('hidden'); const out = {};
      document.dispatchEvent(new Event('fullscreenchange')); await frames(2); out.plain = g.paused && menu(); g.pause(false); await frames(2);
      g.hud.toggle(true); document.dispatchEvent(new Event('fullscreenchange')); await frames(2); out.pack = g.paused && menu() && !g.hud.open; g.pause(false); await frames(2);
      input.uiOpen = false; document.dispatchEvent(new Event('pointerlockchange')); await frames(2); out.mouse = g.paused && menu(); g.pause(false); await frames(2);
      return (out.plain && out.pack && out.mouse && !g.paused) || JSON.stringify(out);`);
  },
};
