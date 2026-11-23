// Searching the props left about the places (game/loot.js, world/structures.js stash and empty): E at a woodpile takes
// its 20 wood and leaves it down to its bottom logs, an amphora gives what its table and its own dice say and is left
// tipped over, what was searched stays searched through a save and a reload, the farmhouse's old chest still opens as
// the guide expects, and the props that aren't stores (the shrines' offerings, a bench) offer nothing.
// The props are the packs' (the town, the scenes and the farmhouse are built from them), so this runs where they are.

// In the page: stand by store `id` facing it, on the first side of eight with no solid in the way, and wait for the
// prompt to show it (window._st: the store)
const GO = (id) => `const S = g.structures, st = S.stores.find((q) => q.id === ${JSON.stringify(id)}); if (!st) return 'no store ' + ${JSON.stringify(id)};
  const free = (x, z) => !S.solids.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 0.45 && c.y < st.at.y + 1.6 && c.y + c.h > st.at.y + 0.1) && g.loot.interactable(new V(x, st.at.y, z), new V(st.at.x - x, 0, st.at.z - z).normalize())?.st === st;
  let at = null; for (const d of [1.25, 1.5]) for (let k = 0; k < 16 && !at; k++) { const a = (k / 16) * Math.PI * 2, x = st.at.x + Math.sin(a) * d, z = st.at.z + Math.cos(a) * d; if (free(x, z)) at = [x, z]; }
  if (!at) return 'nowhere free to stand by ' + st.id; P.spawn(at[0], at[1]); P.yaw = Math.atan2(st.at.x - at[0], st.at.z - at[1]); P.camYaw = P.yaw + Math.PI + 0.7; P.camPitch = -0.45; P.camDist = 4.2; window._st = st;`;
const prompt = `document.getElementById('prompt').textContent`;
// the sum of a store's corners where they stand now, to see them move when it's emptied and stay so after a reload
const SUM = `const sum = (st) => { let s = 0; for (const { mesh, o, n } of st.ranges) { const p = mesh.geometry.attributes.position.array; for (let i = o * 3; i < (o + n) * 3; i++) s += p[i] * ((i % 3) + 1); } return Math.round(s * 100) / 100; };`;

// the land streamed in round where you now stand, and the grass's ground texture with it (for the pictures)
async function settle(t) {
  await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 });
  await t.eval(`const Gm = await import('/src/world/grass.js'); return await until(() => { const o = Gm.grassU.uOrigin.value, h = Gm.TEX_SIZE / 2; return Math.hypot(o.x + h - P.pos.x, o.y + h - P.pos.z) < 30; }, 30000);`);
}

export default {
  name: 'Searching props',
  viewport: { w: 1280, h: 760 },
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20, null, { timeout: 60000 });
    await t.eval(`AG.S.timeScale = 0; AG.S.still = true; AG.S.time = 0.3; AG.setWeather('clear'); AG.snapWeather(); for (const c of [...g.creatures.list]) g.creatures.remove(c); g.owl.update = () => {}; g.owl.o.g.visible = false; return true;`);
    const caves = await t.until("import('/src/world/sites.js').then((S) => S.SITES.caves.every((c, i) => g.colliders.groups.has('cave' + i)))", 60000);
    const info = await t.eval(`const { KINDS, lootOf } = await import('/src/game/loot.js'), L = g.structures.stores, ids = L.map((q) => q.id), by = {};
      for (const q of L) by[q.kind] = (by[q.kind] || 0) + 1; return { n: L.length, unique: new Set(ids).size === ids.length, known: L.every((q) => KINDS[q.kind] && q.ranges?.length), by,
        sacred: ids.filter((id) => /^(temple|olive|peak|mtn|labyrinth|chimera)/.test(id)), caves: ids.filter((id) => id.startsWith('cave')).length,
        loot: L.map((q) => lootOf(q)).flat().reduce((a, [id, n]) => ({ ...a, [id]: (a[id] || 0) + n }), {}) };`);
    t.metric('stores', info.by); t.metric('all there is to find', info.loot);
    t.check('the props worth searching are there, each with an id of its own and its triangles found', info.n > 40 && info.unique && info.known, JSON.stringify(info).slice(0, 300));
    t.check('none in the temple, the Labyrinth, the shrine, the olives or on Olympos (the gods\' things)', info.sacred.length === 0, info.sacred.join(' '));
    t.check('the Giants\' firewood is there in every cave', caves && info.caves === 4, `caves built ${!!caves}, stores ${info.caves}`);
    t.check('nothing from the hills or the bosses in any of it', Object.keys(info.loot).every((id) => !/lightstone|deer|Hide|cretan|corinthian|dryad|Head/.test(id)), Object.keys(info.loot).join(' '));

    // the farmhouse's woodpile: Take the wood (20), and it comes down to its bottom logs
    await t.step('the farmhouse woodpile: stand by it', `${GO('house:woodpile@-3.2,1.5')} return true;`);
    await settle(t);
    await t.step('…the prompt reads Take the wood (20)', `return await until(() => /Take the wood \\(20\\)/.test(${prompt})) || ${prompt};`);
    await t.wait(800); await t.shot('woodpile');
    await t.step('…E takes 20 wood and empties it: the prompt goes, its top logs are gone', `${SUM} const st = window._st, w0 = inv.count('wood'), s0 = sum(st); g.interact(); window._sums = { [st.id]: sum(st) };
      const gone = await until(() => !/Take the wood/.test(${prompt}), 3000);
      return (inv.count('wood') === w0 + 20 && st.emptied && gone && sum(st) !== s0 && g.trial.st.looted.includes(st.id)) || JSON.stringify({ wood: inv.count('wood') - w0, emptied: st.emptied, gone, moved: sum(st) !== s0 });`);
    await t.wait(800); await t.shot('woodpile-taken');

    // an amphora with something in it: Search the amphora, and it gives what its table holds
    const amph = await t.eval(`const { lootOf } = await import('/src/game/loot.js'); return g.structures.stores.find((q) => q.kind === 'amphora' && q.id.startsWith('town') && q.at.y - q.ctx.s.y < 0.1 && lootOf(q).length)?.id;`);
    await t.step('an amphora in the town: stand by it', `${GO(amph || 'none')} return true;`);
    await settle(t);
    await t.step('…the prompt reads Search the amphora', `return await until(() => /Search the amphora/.test(${prompt})) || ${prompt};`);
    await t.wait(800); await t.shot('amphora');
    await t.step('…E gives what is in it, from the amphora\'s table, and tips it over', `${SUM} const { lootOf, KINDS } = await import('/src/game/loot.js'), st = window._st, want = lootOf(st), had = want.map(([id]) => inv.count(id)), s0 = sum(st);
      g.interact(); window._sums[st.id] = sum(st); const got = want.every(([id, n], i) => inv.count(id) === had[i] + n), table = want.every(([id]) => KINDS.amphora.one.some((l) => l[0] === id));
      return (got && table && st.emptied && sum(st) !== s0) || JSON.stringify({ want, got, table, emptied: st.emptied });`);
    await t.wait(800); await t.shot('amphora-searched');
    await t.step('…and a second E there gives nothing more', `const n = inv.slots.reduce((a, s) => a + (s?.n || 0), 0); g.interact(); return inv.slots.reduce((a, s) => a + (s?.n || 0), 0) === n || 'it gave again';`);

    // a basket, a set of baskets, sacks, a heap of jars and a straw stack of the town: what they say, and how they're left
    for (const [kind, a, says] of [['basket', 'a basket', 'Search the basket'], ['baskets', 'baskets', 'Search the baskets'], ['sacks', 'sacks', 'Search the sacks'], ['jars', 'a heap of jars', 'Search the jars'], ['straw', 'a straw stack', 'Take the fiber \\(\\d\\)']]) {
      const id = await t.eval(`return g.structures.stores.find((q) => q.kind === '${kind}' && q.id.startsWith('town') && q.at.y - q.ctx.s.y < 0.1)?.id;`);
      if (!id) { t.check(`${a} in the town`, false, 'none'); continue; }
      await t.step(`${a} in the town: stand by it`, `${GO(id)} return true;`); await settle(t);
      await t.step(`…the prompt reads /${says}/`, `return await until(() => /${says}/.test(${prompt}), 8000) || ${prompt};`);
      await t.wait(800); await t.shot(kind);
      await t.step(`…searched, it's left emptied`, `${SUM} const st = window._st, s0 = sum(st); g.interact(); window._sums[st.id] = sum(st); return (st.emptied && sum(st) !== s0) || 'not emptied';`);
      await t.wait(800); await t.shot(kind + '-searched');
    }

    // the old chest in the farmhouse: as before, the guide's step reads it
    await t.step('the farmhouse\'s old chest still opens: Search the old chest, rope inside, kept as looted', `const u = g.structures.uses.find((q) => q.kind === 'loot' && q.id === 'houseChest'); P.spawn(u.at.x, u.at.z + 0.6); P.pos.y = u.at.y; P.yaw = Math.PI;
      const tr = g.trial.interactable(P.pos); if (!tr || !/Search the old chest/.test(tr.label)) return 'chest: ' + tr?.label; const r0 = inv.count('rope'); g.interact();
      return (inv.count('rope') >= r0 + 6 && g.trial.st.looted.includes('houseChest') && g.trial.interactable(P.pos)?.label === 'Empty') || 'rope ' + (inv.count('rope') - r0);`);

    // what isn't a store: the roadside shrine's offerings, a bench in the town
    await t.step('no prompt at the roadside shrine\'s jar (an offering) nor at a bench', `const s = g.SITES.spots.find((q) => q.v === 0); if (!s) return 'no shrine';
      const rot = ((s.x * 0.37 + s.z * 0.11) % 6.28 + 6.28) % 6.28, w = (x, z) => [s.x + x * Math.cos(rot) + z * Math.sin(rot), s.z - x * Math.sin(rot) + z * Math.cos(rot)];
      const out = [];
      for (const [x, z] of [[1.3, -1.4], [-1.4, -1.2]]) { const [jx, jz] = w(x, z); for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, p = new V(jx + Math.sin(a) * 1.2, s.y, jz + Math.cos(a) * 1.2), f = new V(jx - p.x, 0, jz - p.z).normalize(); const lt = g.loot.interactable(p, f); if (lt) out.push(lt.label); } }
      const T = g.SITES.town, tw = (x, z) => [T.x + x * Math.cos(0.35) + z * Math.sin(0.35), T.z - x * Math.sin(0.35) + z * Math.cos(0.35)], [bx, bz] = tw(3.4, 2.4);
      for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4, p = new V(bx + Math.sin(a) * 1.1, T.y, bz + Math.cos(a) * 1.1), lt = g.loot.interactable(p, new V(bx - p.x, 0, bz - p.z).normalize()); if (lt) out.push('bench: ' + lt.label); }
      return !out.length || out.join(', ');`);

    // save and reload as a player would: what was searched stays searched, shown emptied
    const saved = await t.eval(`const { save } = await import('/src/game/save.js'); return save(g) ? { looted: g.trial.st.looted.slice(), sums: window._sums } : null;`);
    t.check('the game saves', !!saved, 'save failed');
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 240000 });   // (slow on a busy machine)
    const after = await t.eval(`${SUM} const b = ${JSON.stringify(saved)}; g.save = () => false; localStorage.removeItem('argonisos.world.v1'); if (!b) return 'nothing saved';
      const L = g.structures.stores, mine = Object.keys(b.sums), bad = mine.filter((id) => { const st = L.find((q) => q.id === id); return !st?.emptied || sum(st) !== b.sums[id]; });
      const others = L.filter((q) => !b.looted.includes(q.id) && q.emptied).map((q) => q.id), chest = g.trial.st.looted.includes('houseChest');
      return (mine.length >= 3 && !bad.length && !others.length && chest) || JSON.stringify({ bad, others, chest });`);
    t.check('save, reload: the searched props are still searched and look it, the rest untouched, the chest still looted', after === true, String(after));
  },
};
