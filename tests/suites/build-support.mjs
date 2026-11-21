// Building's support and what comes of it (review, Nov): a save loads every piece before working out what holds what (a
// floor whose first wall was rebuilt survived no load before), quickly, with no id used twice; the support worked out
// only round a change is the same as worked out from scratch; what falls drops what it was made of, in a few piles; a door
// comes down with its frame; decks off the ground leave the land alone; furniture isn't set on steep ground, nor walls in
// trees; and the smaller things round building: stumps, the cooking stand, the pack, recipes, tools.
const FLAT = `const flat = (x0, z0) => { for (let r = 0; r < 400; r += 7) for (let a = 0; a < 6.28; a += 0.5) { const x = x0 + r * Math.cos(a), z = z0 + r * Math.sin(a), h = AG.heightAt(x, z); let ok = h > 2; for (const [u, v] of [[-8, -8], [8, -8], [-8, 8], [8, 8], [0, 0]]) if (Math.abs(AG.heightAt(x + u, z + v) - h) > 0.6) ok = false; if (ok) return { x, z, y: h }; } return null; };
  const clearAround = (x, z, r) => { for (const q of [...g.colliders.near(x, z, r)]) if (q.ref?.cx !== undefined) { AG.veg.remove(q.ref.cx, q.ref.cz, q.ref.i); g.colliders.removeOne(q); } };
  const wipe = () => { for (const q of [...B.placed]) B.remove(q, false); B.recompute(); g.pickups.drops.length = 0; g.pickups.dirty = true; };
  AG.S.freeBuild = true;`;

export default {
  name: 'Building support',
  async run(t) {
    await t.step('find flat open ground', `${FLAT} const f = flat(60, 40); if (!f) return 'no flat ground'; clearAround(f.x, f.z, 40); P.spawn(f.x - 6, f.z - 6); window._f = f; return true;`);
    const AT = `${FLAT} const { x: X, z: Z } = window._f, Y = AG.heightAt(X, Z) + 0.02;`;

    // ---- saves
    await t.step('a floor whose first wall was taken down and built again elsewhere survives a save and load', `${AT} wipe();
      const w1 = B.place('wall', new V(X, Y, Z), 0); B.place('floor', new V(X, Y + 3, Z + 1.5), 0); B.place('wall', new V(X, Y, Z + 3), 0); B.remove(w1, true); B.recompute();
      const saved = B.toJSON(), n0 = B.placed.length; for (const q of [...B.placed]) B.remove(q, false); B.load(saved);
      return (n0 === 2 && B.placed.length === 2 && saved[0].id === 'floor') || JSON.stringify({ order: saved.map((o) => o.id), before: n0, after: B.placed.map((p) => p.id) });`);
    const BASE = `wipe(); for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) { const x = X - 15 + i * 3, z = Z - 15 + j * 3, y = AG.heightAt(x, z) + 0.5; B.place('floor', new V(x, y, z), 0); B.place('beamV', new V(x - 1.5, y, z - 1.5), 0); B.place('floor', new V(x, y + 3, z), 0); B.place('beamV', new V(x - 1.5, y + 3, z - 1.5), 0); }`;
    const load = await t.eval(`${AT} ${BASE} const saved = B.toJSON(); for (const q of [...B.placed]) B.remove(q, false); const t0 = performance.now(); B.load(saved); const ms = performance.now() - t0;
      // (and the hammer in a base that size: one piece placed, then taken down)
      const a = performance.now(); const q = B.place('floor', new V(X + 16.5, AG.heightAt(X + 16.5, Z) + 0.5, Z), 0); const b = performance.now(); B.remove(q, true); B.recompute(); const c = performance.now();
      return { n: saved.length, after: B.placed.length, ms: Math.round(ms), place: +(b - a).toFixed(1), remove: +(c - b).toFixed(1) };`);
    t.metric('400-piece load', load);
    t.check('a 400-piece base loads whole in well under a second', load.n === 400 && load.after === 400 && load.ms < 700, JSON.stringify(load));
    t.check('…and a piece placed or taken down in it costs a few milliseconds', load.place < 25 && load.remove < 25, JSON.stringify(load));
    await t.step('no id is used twice after pieces are taken down, the game saved and loaded', `${AT} wipe(); const ps = [0, 1, 2, 3, 4].map((k) => B.place('floor', new V(X + k * 3, Y, Z), 0)); B.remove(ps[0], true); B.remove(ps[1], true); B.recompute();
      const saved = B.toJSON(); for (const q of [...B.placed]) B.remove(q, false); B.seq = 0; B.load(saved); const n = B.place('floor', new V(X, Y, Z + 3), 0), ids = B.placed.map((p) => p.uid);
      return new Set(ids).size === ids.length || 'ids: ' + ids.join(' ');`);
    await t.step('a piece of a kind no longer built is left out of a load, and the rest stand', `${AT} wipe(); B.place('floor', new V(X, Y, Z), 0); const saved = B.toJSON(); saved.push({ uid: 'pc999', id: 'oldPiece', x: X, y: Y, z: Z + 3, rot: 0, hp: 10, state: {} }); for (const q of [...B.placed]) B.remove(q, false);
      B.load(saved); return (B.placed.length === 1 && B.seq >= 1000) || JSON.stringify({ n: B.placed.length, seq: B.seq });`);

    // ---- the support worked out round a change matches the whole worked out again
    await t.step('random bases: support settled round each change is the same as from scratch', `${AT} let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; const bad = []; let stood = 0;
      for (let base = 0; base < 4; base++) { wipe();
        for (let k = 0; k < 140; k++) { const i = Math.floor(rnd() * 6) - 3, j = Math.floor(rnd() * 6) - 3, lv = Math.floor(rnd() * 3), y = Y + lv * 3, x = X + i * 3, z = Z + j * 3, r = rnd();
          if (r < 0.35) B.place('floor', new V(x, y, z), 0); else if (r < 0.6) B.place('wall', new V(x + 1.5, y, z), Math.PI / 2); else if (r < 0.85) B.place('wall', new V(x, y, z + 1.5), 0); else B.place('beamV', new V(x + 1.5, y, z + 1.5), 0);
          if (rnd() < 0.25 && B.placed.length) { B.remove(B.placed[Math.floor(rnd() * B.placed.length)], true); B.recompute(); } }
        const mine = new Map(B.placed.map((p) => [p, p.support])), n = B.placed.length; B.recompute({ full: true });
        if (B.placed.length !== n) bad.push('base ' + base + ': ' + (n - B.placed.length) + ' fell when worked out from scratch');
        let worst = 0; for (const [p, s] of mine) if (!p.gone) worst = Math.max(worst, Math.abs(p.support - s)); if (worst > 1e-3) bad.push('base ' + base + ': support differs by ' + worst.toFixed(3));
        stood += n; }
      wipe(); if (stood < 80) bad.push('only ' + stood + ' pieces stood in all'); return bad.length === 0 || bad.join(' | ');`);

    // ---- collapses
    await t.step('a tower brought down drops what all its pieces were made of, in a few piles', `${AT} wipe(); const w = B.place('wall', new V(X, Y, Z), 0); B.place('wall', new V(X, Y + 3, Z), 0); for (let k = 0; k < 4; k++) B.place('floor', new V(X, Y + 6, Z + 1.5 + k * 3), 0);
      const n = B.placed.length; if (n !== 6) return 'built ' + n; const before = { wood: inv.count('wood'), rope: inv.count('rope') }; B.remove(w, true); B.recompute();
      const drops = g.pickups.drops, got = (id) => drops.filter((d) => d.item === id).reduce((a, d) => a + d.n, 0) + inv.count(id) - before[id];
      return (B.placed.length === 0 && got('wood') === 24 && got('rope') === 12 && drops.length <= 6) || JSON.stringify({ left: B.placed.length, wood: got('wood'), rope: got('rope'), piles: drops.length });`);
    await t.step('a piece that holds others up shows what would fall, and comes down only when asked again', `${AT} wipe(); const w = B.place('wall', new V(X, Y, Z), 0), f = B.place('floor', new V(X, Y + 3, Z + 1.5), 0); const list = B.wouldFall(w);
      return (list.length === 1 && list[0] === f && B.wouldFall(f).length === 0) || 'would fall: ' + list.map((p) => p.id);`);
    await t.step("a chest with things in it can't be taken down", `${AT} wipe(); g.give('hammer'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer')); const c = B.place('chest', new V(X, Y, Z), 0); c.inv.add('stone', 3); const I = (await import('/src/input.js')).input;
      I.clicks.push(1); B.takeDown(c, 0.016); I.clicks.length = 0; return B.placed.includes(c) || 'taken down';`);
    await t.step('a door comes down with its frame (and drops what it was made of)', `${AT} wipe(); const fr = B.place('doorframe', new V(X, Y, Z), 0), d = B.place('door', new V(X - 0.7, Y, Z), 0); if (!B.placed.includes(d)) return 'the door fell at once';
      B.remove(fr, true); B.recompute(); return (!B.placed.includes(d) && g.pickups.drops.some((q) => q.item === 'wood')) || 'the door stands: ' + d.support;`);

    // ---- the ground
    await t.step('a deck off a wall over the ground leaves the land alone; a floor laid on the ground has it raised to it', `${AT} wipe(); const GC = await import('/src/world/groundcut.js');
      const w = B.place('wall', new V(X, Y - 0.8, Z), 0), f = B.place('floor', new V(X, Y + 2.2, Z + 1.5), 0), f2 = B.place('floor', new V(X, Y + 2.2, Z + 4.5), 0); const low = B.place('floor', new V(X + 9, Y + 0.05, Z), 0);
      const fill = (p) => [...GC.cutList()].find((c) => Math.abs(c.x - B.foot(p.def, p.pos, p.rot).c.x) < 0.01 && Math.abs(c.z - B.foot(p.def, p.pos, p.rot).c.z) < 0.01)?.fill;
      return (B.placed.includes(f2) && !B.onGround(f2.def, f2.pos, f2.rot, f2) && !fill(f2) && fill(low) && low.grounded) || JSON.stringify({ stands: B.placed.includes(f2), on: B.onGround(f2.def, f2.pos, f2.rot, f2), fill: fill(f2), low: fill(low) });`);
    await t.step('a bed on a steep slope is refused; on level ground it goes', `${AT} wipe(); const G = await import('/src/world/gen.js'); let s = null;
      for (let r = 20; r < 900 && !s; r += 5) for (let a = 0; a < 6.28 && !s; a += 0.2) { const x = X + r * Math.cos(a), z = Z + r * Math.sin(a), gx = (G.heightAt(x + 1, z) - G.heightAt(x - 1, z)) / 2, gz = (G.heightAt(x, z + 1) - G.heightAt(x, z - 1)) / 2; if (Math.hypot(gx, gz) > 0.38 && Math.hypot(gx, gz) < 0.46 && G.heightAt(x, z) > 2) s = { x, z, rot: Math.atan2(gx, gz) }; }
      if (!s) return 'no slope'; P.spawn(s.x - 2, s.z - 2); const bed = B.piece('bed'), steep = B.invalid(bed, new V(s.x, G.heightAt(s.x, s.z), s.z), s.rot, false, { terrain: true });
      P.spawn(X - 2, Z - 2); const level = B.invalid(bed, new V(X, AG.heightAt(X, Z), Z), 0, false, { terrain: true }); return (steep === 'Too steep here' && level === null) || JSON.stringify({ steep, level });`);
    await t.step('a wall or a bench where a tree stands is refused (a floor may go over it)', `${AT} wipe(); let c = null; for (const q of g.colliders.near(P.pos.x, P.pos.z, 90)) if (q.ref?.cx !== undefined && AG.SPECIES?.[q.ref.sp]?.res !== 'rock' && q.r > 0.3 && q.ref.s > 0) { const { SPECIES } = await import('/src/world/flora.js'); if (SPECIES[q.ref.sp].res === 'tree') { c = q; break; } }
      if (!c) return 'no tree near'; P.spawn(c.x - 3, c.z); const at = new V(c.x, AG.heightAt(c.x, c.z), c.z), wall = B.invalid(B.piece('wall'), at, 0, true, { terrain: true }), bench = B.invalid(B.piece('workbench'), at, 0, true, { terrain: true });
      return (wall === 'A tree is in the way' && bench === 'A tree is in the way') || JSON.stringify({ wall, bench });`);
    await t.step('no vegetation collider stands for a slot the layout left empty (nothing to fell in thin air)', `let n = 0, z = 0; for (const [k, list] of g.colliders.groups) if (k[0] === 'v') for (const c of list) { n++; if (!(c.r > 0) || !(c.ref.s > 0)) z++; } return (n > 50 && z === 0) || n + ' colliders, ' + z + ' at no size';`);
    await t.step("a felled tree's stump blocks the way, goes from under a floor built over it, and an axe cuts it up for wood", `${AT} wipe(); const H = g.harvest; H.addStump(X + 3, Y, Z, 0.4); H.addStump(X + 9, Y, Z, 0.4); const s1 = H.stumps.at(-2), s2 = H.stumps.at(-1);
      const blocks = !!g.colliders.groups.get(s1.id)?.length; B.place('floor', new V(X + 3, Y + 0.05, Z), 0); const cleared = !H.stumps.includes(s1);
      g.give('crudeAxe'); const w0 = inv.count('wood'); for (let k = 0; k < 3; k++) H.hitStump(s2, AG.ITEMS?.crudeAxe || (await import('/src/game/items.js')).ITEMS.crudeAxe, new V(s2.x, Y, s2.z), new V(1, 0, 0));
      return (blocks && cleared && !H.stumps.includes(s2) && inv.count('wood') > w0) || JSON.stringify({ blocks, cleared, cut: !H.stumps.includes(s2), wood: inv.count('wood') - w0 });`);

    // ---- cooking, the pack, recipes, tools
    await t.step('a cooking stand taken down gives back the meat on it, raw or cooked', `${AT} wipe(); const st = B.place('cookingStand', new V(X, Y, Z), 0); st.state.cook.push({ id: 'rawMeat', t: 0, need: 30 }, { id: 'rawMeat', t: 31, need: 30 }); const r0 = inv.count('rawMeat'), c0 = inv.count('cookedMeat');
      B.remove(st, true); B.recompute(); return (inv.count('rawMeat') === r0 + 1 && inv.count('cookedMeat') === c0 + 1) || JSON.stringify({ raw: inv.count('rawMeat') - r0, cooked: inv.count('cookedMeat') - c0 });`);
    await t.step('meat left on the stand as long again burns to coal', `const st = { state: { cook: [{ id: 'rawMeat', t: 61, need: 30 }] } }; return B.cookedAs(st.state.cook[0]) === 'coal' && B.cookedAs({ id: 'rawMeat', t: 45, need: 30 }) === 'cookedMeat' || 'not burnt';`);
    await t.step('the pack: a pile dragged onto the same kind tops it up, onto a full pile or another tool it swaps; a split pile goes into the pack, not the hotbar', `const { Inventory } = await import('/src/game/inventory.js'); const I = new Inventory();
      I.slots[8] = { id: 'wood', n: 30 }; I.slots[9] = { id: 'wood', n: 30 }; I.move(8, 9); const merged = I.slots[9].n === 50 && I.slots[8].n === 10;
      I.slots[10] = { id: 'crudeAxe', n: 1, dur: 50 }; I.slots[11] = { id: 'crudeAxe', n: 1, dur: 100 }; I.move(10, 11); const swapped = I.slots[10].dur === 100 && I.slots[11].dur === 50;
      I.slots[12] = { id: 'stone', n: 50 }; I.slots[13] = { id: 'stone', n: 50 }; I.move(12, 13); const full = I.slots[12].n === 50 && I.slots[13].n === 50;
      I.split(12); const split = I.slots.findIndex((s, i) => i !== 12 && s?.id === 'stone' && s.n === 25); return (merged && swapped && full && split >= 8) || JSON.stringify({ merged, swapped, full, split });`);
    await t.step('materials short are named: "Need 1 more wood, 2 more rope"', `const { Inventory } = await import('/src/game/inventory.js'); const I = new Inventory(); I.add('wood', 3); const n = I.need({ wood: 4, rope: 2 }); return n === 'Need 1 more wood, 2 more rope' || n;`);
    await t.step('the first rope reveals only what you hold everything for, with no boss gear, in one toast', `C.known.clear(); inv.seen.clear(); const was = inv.slots.map((s) => s && { ...s }); inv.slots.fill(null); const toasts = []; const tt = g.hud.toast; g.hud.toast = (m) => { toasts.push(m); tt.call(g.hud, m); };
      inv.add('rope', 1); await sleep(400); const after1 = C.known.size; toasts.length = 0; inv.add('wood', 1); inv.add('stone', 1); inv.add('leather', 1); await sleep(400); g.hud.toast = tt; const tier = C.list().filter((r) => r.tier && C.known.has(r.key)).length; const recipeToasts = toasts.filter((m) => /recipe/.test(m)).length;
      inv.slots.splice(0, inv.slots.length, ...was); return (after1 <= 3 && tier === 0 && C.known.has('crudeAxe') && recipeToasts === 1) || JSON.stringify({ after1, tier, axe: C.known.has('crudeAxe'), recipeToasts });`);
    await t.step("a tool worn to naught breaks but stays in the pack, and is mended at a workbench; a wrong tool's clink wears nothing", `${AT} wipe(); inv.slots.fill(null); g.give('crudeAxe'); const i = inv.slots.findIndex((s) => s?.id === 'crudeAxe'); g.useSlot(i); const s = inv.slots[i]; s.dur = 1;
      const rock = [...g.colliders.near(P.pos.x, P.pos.z, 300)].find((c) => c.ref?.cx !== undefined && c.ref.s > 0); const hs = g.harvest.strike; g.harvest.strike = () => 'clink'; P.onStrike(); const clinked = s.dur === 1;
      g.harvest.strike = () => true; P.onStrike(); g.harvest.strike = hs; const kept = inv.slots[i] === s && s.dur === 0 && !s.worn; void rock;
      B.place('workbench', new V(P.pos.x + 2, AG.heightAt(P.pos.x + 2, P.pos.z), P.pos.z), 0); C.repair(i); return (clinked && kept && s.dur === 100) || JSON.stringify({ clinked, kept, dur: s.dur });`);
    await t.step('clean up', `${AT} wipe(); return true;`);
  },
};
