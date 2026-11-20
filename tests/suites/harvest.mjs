// Gathering by the blow (tester, 14 Nov): bushes are chopped for wood in a few blows and stay gone after a save; every
// blow that lands is felt (a camera punch, render/fx.js), a pickaxe on rock hardest, the wrong tool barely; melee blows on
// a creature punch too, and the Camera shake setting turns it all down or off. Small plants are left alone.
const WOODY = `const { SPECIES, STRIDE } = await import('/src/world/flora.js'); const fx = await import('/src/render/fx.js');`;
// (the nearest item of one of these species round the player, not yet removed)
const nearest = (names) => `${WOODY} const W = new Set(${JSON.stringify(names)}); let best = null;
  for (const c of AG.veg.near.values()) { const it = c.items; if (!it) continue; for (let o = 0, i = 0; o < it.length; o += STRIDE, i++) { const sp = SPECIES[it[o]]; if (!W.has(sp.name) || !(it[o + 6] > 0) || AG.veg.removed.has(c.cx + ',' + c.cz + ',' + i)) continue;
    const d = Math.hypot(it[o + 2] - P.pos.x, it[o + 4] - P.pos.z); if (d < 90 && (!best || d < best.d)) best = { cx: c.cx, cz: c.cz, i, x: it[o + 2], y: it[o + 3], z: it[o + 4], s: it[o + 6], d, name: sp.name }; } }`;
// stand a metre or so off it on a side where nothing else is in the way of the blow, facing it
const face = `const yawTo = (a) => { P.yaw = a; return { x: Math.sin(a), z: Math.cos(a) }; };
  const approach = (b, gap, ok) => { for (let k = 0; k < 16; k++) { const a = k * Math.PI / 8; P.spawn(b.x - Math.sin(a) * gap, b.z - Math.cos(a) * gap); const dir = yawTo(a); if (ok(dir)) return dir; } return null; };`;

// Timber (tester, 20 Nov): felled trees fall with their weight and their logs roll. A log dropped across a slope, on flat
// ground, or above a post; trees felled at a smaller and at a bigger neighbour
const TIMBER = `const F = await import('/src/world/flora.js'); const { groundAt } = await import('/src/world/groundcut.js'); const H = g.harvest;
  const grad = (x, z) => { const gx = (groundAt(x + 1, z) - groundAt(x - 1, z)) / 2, gz = (groundAt(x, z + 1) - groundAt(x, z - 1)) / 2; return { gx, gz, g: Math.hypot(gx, gz) }; };
  const free = (x, z, r) => { for (const c of g.colliders.near(x, z, r)) if (Math.hypot(c.x - x, c.z - z) < r + c.r) return false; return !H.stumps.some((s) => Math.hypot(s.x - x, s.z - z) < r + 1) && !H.logs.some((l) => Math.hypot(l.mesh.position.x - x, l.mesh.position.z - z) < r + l.L / 2 + 1); };
  const drop = (x, z, ax, az, L = 5, R = 0.3) => { const a = new V(x - ax * L / 2, 0, z - az * L / 2), b = new V(x + ax * L / 2, 0, z + az * L / 2); a.y = groundAt(a.x, a.z) + R + 0.02; b.y = groundAt(b.x, b.z) + R + 0.02; return H.addLog({ a, b, R, L, sp: 'oak', s: 1, look: 0, hp: 30, wood: 6, awake: true }); };
  const settle = async (ok, secs = 30) => { for (let i = 0; i < secs * 10 && !ok(); i++) await new Promise((r) => setTimeout(r, 100)); return ok(); };
  const rid = (l) => { g.scene.remove(l.mesh); g.colliders.removeGroup(l.id); H.logs.splice(H.logs.indexOf(l), 1); };
  const live = (x, z, R) => { const out = []; for (const c of g.colliders.near(x, z, R)) { const r = c.ref; if (r?.cx === undefined || Math.hypot(c.x - x, c.z - z) > R) continue; const sp = F.SPECIES[r.sp]; if (sp.res === 'tree' && sp.name !== 'titan') out.push({ c, x: c.x, z: c.z, y: c.y, ref: r, id: r.cx + ',' + r.cz + ',' + r.i, T: H.treeSize(r) }); } return out; };
  const vol = (T) => T.girth * T.girth * T.tall;
  const firstHit = (A, dx, dz) => { const f = { x: A.x, z: A.z, y: A.y, dx, dz, ...A.T }; f.obs = H.fallObstacles(f); for (let th = 0; th < 1.7; th += 0.01) { const h = H.fallHit(f, th); if (h) return h; } return null; };`;
// places to look: from the layout, far apart, trees (or open ground) on the ground wanted
const areas = (test) => `${TIMBER} const out = []; for (let r = 0; r < 900 && out.length < 6; r += 24) for (let a = 0; a < 6.28 && out.length < 6; a += 24 / Math.max(r, 24)) { const x = P.pos.x + Math.cos(a) * r, z = P.pos.z + Math.sin(a) * r; if (groundAt(x, z) < 3 || !(${test})(x, z) || out.some((o) => Math.hypot(o[0] - x, o[1] - z) < 150)) continue; out.push([x, z]); } return out;`;
async function goFind(t, name, where, find) {
  for (const [x, z] of await t.eval(areas(where))) {
    await t.eval(`P.spawn(${x}, ${z}); return true;`); await t.page.waitForFunction(() => AG.terrain.pending === 0 && [...AG.veg.near.values()].filter((c) => c.items).length > 8, null, { timeout: 90000 }); await t.wait(1500);
    if (await t.eval(`${TIMBER} window._at = (() => { ${find} })(); return !!window._at;`)) return true;
  }
  return t.check(name, false, 'found no place for it');
}

export default {
  name: 'Gathering by the blow',
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20 && [...AG.veg.near.values()].filter((c) => c.items).length > 8, null, { timeout: 60000 });
    await t.step('a bush is chopped down in 2 to 4 axe blows and gives 1 to 3 wood', `${nearest(['bush', 'myrtle', 'broom', 'redbush'])} ${face}
      if (!best) return 'no bush near'; const r = g.harvest.woodySize(SPECIES.findIndex((s) => s.name === best.name), 0, best.s).r;
      const dir = approach(best, r + 0.7, (dir) => { const w = g.harvest.woodyAhead(P.pos, dir, 2.3); return w && w.i === best.i && w.cx === best.cx && w.cz === best.cz && !g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, w.t + 0.1, (c) => c.ref && (SPECIES[c.ref.sp]?.res || c.ref.log)); });
      if (!dir) return 'no clear side to strike the ' + best.name + ' from';
      const id = best.cx + ',' + best.cz + ',' + best.i, w0 = inv.count('wood'), n0 = fx.shake.n; let hits = 0;
      while (!AG.veg.removed.has(id) && hits < 8) { if (!g.harvest.strike(g.ITEMS.crudeAxe)) return 'the axe missed the ' + best.name + ' after ' + hits + ' blows'; hits++; }
      const wood = inv.count('wood') - w0; window._bush = { id, x: P.pos.x, z: P.pos.z, yaw: P.yaw, name: best.name, hits, wood };
      return (AG.veg.removed.has(id) && hits >= 2 && hits <= 4 && wood >= 1 && wood <= 3 && fx.shake.n - n0 >= hits) || JSON.stringify(window._bush);`);
    await t.step('…the axe now meets nothing there', `const w = g.harvest.woodyAhead(P.pos, { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }, 2.3); return !w || w.cx + ',' + w.cz + ',' + w.i !== window._bush.id || 'still there';`);
    await t.step('without an axe a bush only rustles: nothing is cut and the punch is small', `${nearest(['bush', 'myrtle', 'broom', 'redbush'])} ${face} if (!best) return 'no bush';
      const dir = approach(best, 1.1, (dir) => { const w = g.harvest.woodyAhead(P.pos, dir, 2.3); return w && w.i === best.i && w.cx === best.cx; }); if (!dir) return 'no side';
      const id = best.cx + ',' + best.cz + ',' + best.i, w0 = inv.count('wood'); for (let k = 0; k < 6; k++) g.harvest.strike(g.ITEMS.crudeClub);
      return (!AG.veg.removed.has(id) && inv.count('wood') === w0 && fx.shake.last < 0.1) || 'cut ' + AG.veg.removed.has(id) + ' wood +' + (inv.count('wood') - w0) + ' punch ' + fx.shake.last;`);
    await t.step('small plants (flowers, lavender, ferns, tall grass) are not cut', `${nearest(['flowers', 'lavender', 'fern', 'tallgrass'])} ${face} if (!best) return 'no small plants near'; const id = best.cx + ',' + best.cz + ',' + best.i;
      approach(best, 0.6, () => true); for (let k = 0; k < 4; k++) g.harvest.strike(g.ITEMS.crudeAxe); return !AG.veg.removed.has(id) || 'the ' + best.name + ' was cut';`);
    await t.step('a pickaxe on rock punches the camera hard and holds the swing', `${WOODY} ${face}
      let rock = null; for (const c of g.colliders.near(P.pos.x, P.pos.z, 120)) if (c.ref && SPECIES[c.ref.sp]?.res === 'rock' && SPECIES[c.ref.sp].name === 'rock' && Math.abs(c.y - P.pos.y) < 30 && (!rock || Math.hypot(c.x - P.pos.x, c.z - P.pos.z) < Math.hypot(rock.x - P.pos.x, rock.z - P.pos.z))) rock = c;
      if (!rock) return 'no rock near'; const dir = approach(rock, rock.r + 0.8, (dir) => g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, 2.3, (c) => c.ref && (c.ref.sp !== undefined || c.ref.log)) === rock && !g.harvest.woodyAhead(P.pos, dir, 2.3)); if (!dir) return 'no side to strike the rock from';
      window._rock = { x: P.pos.x, z: P.pos.z, yaw: P.yaw }; const n0 = fx.shake.n; if (!g.harvest.strike(g.ITEMS.pickaxe)) return 'the pickaxe missed';
      const q = fx.shake.kicks.at(-1); return (fx.shake.n === n0 + 1 && fx.shake.last >= 0.4 && q && P.stopT > 0) || JSON.stringify({ n: fx.shake.n - n0, last: fx.shake.last, stop: P.stopT });`);
    await t.step('…and the view really turns, then settles within a third of a second', `const fx = await import('/src/render/fx.js'); const cam = AG.camera; fx.shake.kicks.length = 0; fx.shake.k = 0;
      const look = () => { const d = new V(); cam.getWorldDirection(d); return d; }, frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
      await new Promise((r) => setTimeout(r, 1500)); await frame(); const d0 = look(); fx.punch(0.45, { x: Math.sin(P.yaw), z: Math.cos(P.yaw) }); let most = 0; for (let k = 0; k < 6; k++) { await frame(); most = Math.max(most, look().angleTo(d0)); }
      await new Promise((r) => setTimeout(r, 400)); const after = look().angleTo(d0);
      return (most > 0.002 && after < most * 0.3 && !fx.shake.kicks.length) || 'turned ' + most.toFixed(4) + ' rad, then ' + after.toFixed(4);`);
    await t.step('an axe on rock only clinks: a small punch, no stone', `const fx = await import('/src/render/fx.js'); const { x, z, yaw } = window._rock; P.spawn(x, z); P.yaw = yaw; const s0 = inv.count('stone');
      if (!g.harvest.strike(g.ITEMS.crudeAxe)) return 'missed'; return (fx.shake.last < 0.12 && inv.count('stone') === s0) || 'punch ' + fx.shake.last + ' stone +' + (inv.count('stone') - s0);`);
    await t.step('a club blow on a deer punches harder than a dagger one, and a missed swing not at all', `const fx = await import('/src/render/fx.js'); P.spawn(P.pos.x + 20, P.pos.z + 20); P.yaw = 0;
      const blow = (item) => { for (const c of [...g.creatures.list]) g.creatures.remove(c); const d = g.creatures.spawn('deer', P.pos.x, P.pos.z + 1.4); d.hp = 9999; const n0 = fx.shake.n; const hit = g.combat.strike(g.ITEMS[item]); return { hit, n: fx.shake.n - n0, k: fx.shake.last }; };
      const club = blow('crudeClub'), dagger = blow('crudeDagger'); for (const c of [...g.creatures.list]) g.creatures.remove(c); const n0 = fx.shake.n, miss = g.combat.strike(g.ITEMS.crudeClub);
      return (club.hit && dagger.hit && club.n === 1 && dagger.n === 1 && club.k > dagger.k && !miss && fx.shake.n === n0) || JSON.stringify({ club, dagger, miss, missN: fx.shake.n - n0 });`);
    await t.step('Camera shake: Off holds the view still, Reduced turns it down, On is back', `const S = await import('/src/ui/settings.js'), fx = await import('/src/render/fx.js');
      S.setShake('off'); const off = fx.SHAKE.k; S.setShake('reduced'); const red = fx.SHAKE.k; S.setShake('on'); return (off === 0 && red > 0 && red < 1 && fx.SHAKE.k === 1) || [off, red, fx.SHAKE.k].join(' ');`);
    // Tomato bushes (Patch 20): E picks 8 to 12 tomatoes and leaves the bush bare until they grow back; an axe cuts one
    // down for 6 to 8 wood. Off to the nearest two first (they grow in the meadows, few and far between)
    await t.step('(to the nearest tomato bushes)', `const F = await import('/src/world/flora.js'); const pcx = Math.floor(P.pos.x / F.CELL), pcz = Math.floor(P.pos.z / F.CELL), found = [];
      for (let r = 0; r < 16 && found.length < 2; r++) for (let cx = pcx - r; cx <= pcx + r; cx++) for (let cz = pcz - r; cz <= pcz + r; cz++) { if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) !== r) continue;
        const it = F.layoutCell(cx, cz); for (let o = 0; o < it.length; o += 7) if (it[o] === F.SP.tomato && it[o + 6] > 0) found.push([it[o + 2], it[o + 4], cx + ',' + cz]); }
      if (!found.length) return 'no tomato bush within 16 cells'; P.spawn(found[0][0] + 3, found[0][1]); window._tomCell = found[0][2]; return true;`);
    await t.page.waitForFunction(() => AG.veg.near.get(window._tomCell)?.items, null, { timeout: 90000 }); await t.wait(500);   // (its cell streamed in)
    await t.step('E on a tomato bush picks 8 to 12 tomatoes and leaves it bare', `${nearest(['tomato'])} ${face} if (!best) return 'no tomato bush near'; const id = best.cx + ',' + best.cz + ',' + best.i;
      const dir = approach(best, 1.0, () => g.harvest.tomatoBush()?.id === id); if (!dir) return 'no side to pick it from'; const tb = g.harvest.tomatoBush(); if (!tb.ready) return 'not ripe to begin with';
      const n0 = inv.count('tomato'); g.harvest.pickTomatoes(tb); const got = inv.count('tomato') - n0, again = g.harvest.tomatoBush(); window._tom = { picked: id };
      return (got >= 8 && got <= 12 && AG.veg.bare.has(id) && again && !again.ready && g.ITEMS.tomato.type === 'food' && g.ITEMS.tomato.food.stamina === 23) || JSON.stringify({ got, bare: AG.veg.bare.has(id), again });`);
    await t.step('…it grows its fruit back after a day', `const id = window._tom.picked, t0 = g.harvest.bare.get(id), S0 = { day: g.S.day, time: g.S.time };
      g.S.day += 1; g.S.time = Math.min(0.99, g.S.time + 0.01); g.harvest.bareT = 0; g.harvest.growBack(0.1); const ripe = !AG.veg.bare.has(id) && !g.harvest.bare.has(id);
      Object.assign(g.S, S0); g.harvest.bare.set(id, t0); g.harvest.bareT = 0; g.harvest.growBack(0.1); return (ripe && AG.veg.bare.has(id)) || 'still bare a day later';`);
    await t.step('an axe cuts a tomato bush down for 6 to 8 wood', `${nearest(['tomato'])} ${face} const pickId = window._tom.picked; let b = best; if (!b) return 'no tomato bush';
      { let alt = null; for (const c of AG.veg.near.values()) { const it = c.items; if (!it) continue; for (let o = 0, i = 0; o < it.length; o += STRIDE, i++) { if (SPECIES[it[o]].name !== 'tomato' || !(it[o + 6] > 0) || c.cx + ',' + c.cz + ',' + i === pickId || AG.veg.removed.has(c.cx + ',' + c.cz + ',' + i)) continue; const d = Math.hypot(it[o + 2] - P.pos.x, it[o + 4] - P.pos.z); if (d < 90 && (!alt || d < alt.d)) alt = { cx: c.cx, cz: c.cz, i, x: it[o + 2], y: it[o + 3], z: it[o + 4], s: it[o + 6], d }; } } if (alt) b = alt; }   // (another bush than the one picked, if there is one: the picked one should stay bare through the save)
      const id = b.cx + ',' + b.cz + ',' + b.i, r = g.harvest.woodySize(SPECIES.findIndex((s) => s.name === 'tomato'), 0, b.s).r;
      const dir = approach(b, r + 0.7, (dir) => { const w = g.harvest.woodyAhead(P.pos, dir, 2.3); return w && w.cx + ',' + w.cz + ',' + w.i === id && !g.colliders.pick(P.pos.x, P.pos.z, dir.x, dir.z, w.t + 0.1, (c) => c.ref && (SPECIES[c.ref.sp]?.res || c.ref.log)); });
      if (!dir) return 'no clear side to strike it from'; const w0 = inv.count('wood'); let hits = 0;
      while (!AG.veg.removed.has(id) && hits < 8) { if (!g.harvest.strike(g.ITEMS.crudeAxe)) return 'the axe missed after ' + hits + ' blows'; hits++; }
      const wood = inv.count('wood') - w0; window._tom.chopped = id; return (AG.veg.removed.has(id) && wood >= 6 && wood <= 8) || JSON.stringify({ hits, wood, removed: AG.veg.removed.has(id) });`);

    // ---- Timber: logs roll down slopes, rest on the flat, stop at what's in their way; felled trees knock down smaller ones
    if (await goFind(t, 'a log on a slope rolls downhill and comes to rest', `(x, z) => { const q = grad(x, z); return q.g > 0.3 && q.g < 0.5; }`,
      `for (let gx = -40; gx <= 40; gx += 3) for (let gz = -40; gz <= 40; gz += 3) { const x = P.pos.x + gx, z = P.pos.z + gz, q = grad(x, z); if (q.g < 0.3 || q.g > 0.5) continue; const ux = -q.gx / q.g, uz = -q.gz / q.g; let ok = true;
        for (let s = -1; s <= 14 && ok; s += 1.5) { const px = x + ux * s, pz = z + uz * s; ok = free(px, pz, 3.5) && grad(px, pz).g > 0.2; } if (ok) return { x, z, ux, uz }; } return null;`)) {
      await t.step('a log on a slope rolls downhill and comes to rest', `${TIMBER} const s = window._at, l = drop(s.x, s.z, -s.uz, s.ux), y0 = l.mesh.position.y;
        if (!await settle(() => l.asleep)) return 'still rolling after 30 s'; const m = l.mesh.position, down = (m.x - s.x) * s.ux + (m.z - s.z) * s.uz, lift = m.y - groundAt(m.x, m.z); rid(l);
        return (down > 3 && m.y < y0 - 1 && lift > 0.15 && lift < 0.5) || JSON.stringify({ down, drop: y0 - m.y, lift });`);
      await t.step('a log stops at a trunk in its way, lying against it', `${TIMBER} const s = window._at, px = s.x + s.ux * 6, pz = s.z + s.uz * 6; g.colliders.addGroup('test:post', [{ x: px, z: pz, r: 0.35, y: groundAt(px, pz) - 1, ref: { test: true } }]);
        const l = drop(s.x, s.z, -s.uz, s.ux); const ok = await settle(() => l.asleep), m = l.mesh.position.clone(), gap = (px - m.x) * s.ux + (pz - m.z) * s.uz; window._post = { gap, ok }; rid(l); g.colliders.removeGroup('test:post');
        return (ok && gap > 0.3 && gap < 0.3 + 0.35 + 0.15) || JSON.stringify(window._post);`);
    }
    if (await goFind(t, 'a log on flat ground stays put', `(x, z) => grad(x, z).g < 0.03`,
      `for (let gx = -40; gx <= 40; gx += 3) for (let gz = -40; gz <= 40; gz += 3) { const x = P.pos.x + gx, z = P.pos.z + gz; let ok = free(x, z, 4); for (const [a, b] of [[0, 0], [3, 0], [-3, 0], [0, 3], [0, -3]]) ok = ok && grad(x + a, z + b).g < 0.04; if (ok) return { x, z }; } return null;`)) {
      await t.step('a log on flat ground stays put', `${TIMBER} const s = window._at, l = drop(s.x, s.z, 1, 0), p0 = l.mesh.position.clone(); const ok = await settle(() => l.asleep, 5);
        await new Promise((r) => setTimeout(r, 1000)); const moved = l.mesh.position.distanceTo(p0); rid(l); return (ok && moved < 0.08) || JSON.stringify({ ok, moved });`);
    }
    const pair = (bigger) => `for (const A of live(P.pos.x, P.pos.z, 60)) { if (grad(A.x, A.z).g > 0.2) continue; for (const B of live(A.x, A.z, 9)) { if (B.c === A.c) continue; const d = Math.hypot(B.x - A.x, B.z - A.z); if (d < 3 || A.T.tall < d + 2 || ${bigger ? 'vol(A.T) < 1.5 * vol(B.T)' : 'vol(B.T) < 1.1 * vol(A.T)'}) continue;
        const dx = (B.x - A.x) / d, dz = (B.z - A.z) / d; if (firstHit(A, dx, dz)?.c !== B.c) continue;
        const third = ${bigger ? `live(B.x, B.z, B.T.tall + 2).find((o) => o.c !== A.c && o.c !== B.c && (o.x - B.x) * dx + (o.z - B.z) * dz > 1 && Math.abs((o.x - B.x) * dz - (o.z - B.z) * dx) < 2)` : 'null'}; ${bigger ? 'if (!third) continue;' : ''} return { A: A.id, B: B.id, C: third?.id, dx, dz, a: A.c }; } } return null;`;
    const fellAt = `${TIMBER} const s = window._at, n0 = AG.veg.removed.size; H.fell(s.a, F.SPECIES[s.a.ref.sp], { x: s.dx, z: s.dz });
      const done = await settle(() => !H.falling.length && H.logs.every((l) => l.asleep), 40), gone = (id) => AG.veg.removed.has(id), f = H.falling[0];`;
    if (await goFind(t, 'a big tree falling on a smaller one brings it down too, and no third', `(x, z) => grad(x, z).g < 0.15`, pair(true))) {
      await t.step('a big tree falling on a smaller one brings it down too, and no third', `${fellAt} window._timber = { ids: [s.A, s.B] };
        return (done && gone(s.A) && gone(s.B) && !gone(s.C) && AG.veg.removed.size - n0 === 2) || JSON.stringify({ done, A: gone(s.A), B: gone(s.B), C: gone(s.C), n: AG.veg.removed.size - n0, f: f && [f.state, f.th] });`);
    }
    if (await goFind(t, 'a small tree falling on a bigger one leans on it and leaves it standing', `(x, z) => grad(x, z).g < 0.15`, pair(false))) {
      await t.step('a small tree falling on a bigger one leans on it and leaves it standing', `${fellAt} return (done && gone(s.A) && !gone(s.B) && AG.veg.removed.size - n0 === 1) || JSON.stringify({ done, A: gone(s.A), B: gone(s.B), n: AG.veg.removed.size - n0 });`);
    }
    // save, then reload the page as a player would: the bush stays cut
    const saved = await t.eval(`const { save } = await import('/src/game/save.js'); return save(g) ? { ...window._bush, tom: window._tom, timber: { ...window._timber, logs: g.harvest.logs.map((l) => [...l.P[0].toArray(), ...l.P[1].toArray()]) } } : null;`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    await t.page.waitForFunction((id) => { const [cx, cz] = id.split(','); return AG.veg.near.get(cx + ',' + cz)?.items; }, saved?.id ?? '0,0,0', { timeout: 60000 }).catch(() => {});
    const after = await t.eval(`const b = ${JSON.stringify(saved)}; if (!b) return 'save failed'; const removed = AG.veg.removed.has(b.id); const [cx, cz, i] = b.id.split(',').map(Number);
      const hit = g.harvest.woodyAhead({ x: b.x, y: AG.heightAt(b.x, b.z), z: b.z }, { x: Math.sin(b.yaw), z: Math.cos(b.yaw) }, 2.3); const back = hit && hit.cx === cx && hit.cz === cz && hit.i === i;
      const tom = b.tom || {}, picked = !tom.picked || tom.picked === tom.chopped || (g.harvest.bare.has(tom.picked) && AG.veg.bare.has(tom.picked)), chopped = !tom.chopped || AG.veg.removed.has(tom.chopped);
      g.save = () => false; localStorage.removeItem('argonisos.world.v1'); return removed && !back && picked && chopped ? true : JSON.stringify({ removed, back, picked, chopped });`);
    t.check('save, reload: the chopped bush and tomato bush stay gone, the picked tomato bush stays bare', after === true, String(after));
    const logs = await t.eval(`const T = ${JSON.stringify(saved?.timber ?? null)}; if (!T) return 'nothing saved'; const L = g.harvest.logs;
      const placed = T.logs.every((p) => L.some((l) => Math.hypot(l.P[0].x - p[0], l.P[0].y - p[1], l.P[0].z - p[2]) < 0.01 && Math.hypot(l.P[1].x - p[3], l.P[1].y - p[4], l.P[1].z - p[5]) < 0.01));
      const felled = (T.ids || []).every((id) => AG.veg.removed.has(id)); return (T.logs.length > 0 && L.length === T.logs.length && placed && felled) || JSON.stringify({ saved: T.logs.length, now: L.length, placed, felled });`);
    t.check('save, reload: the logs lie where they came to rest and both trees knocked down stay gone', logs === true, String(logs));
  },
};
