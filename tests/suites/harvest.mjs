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
    // save, then reload the page as a player would: the bush stays cut
    const saved = await t.eval(`const { save } = await import('/src/game/save.js'); return save(g) ? window._bush : null;`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    await t.page.waitForFunction((id) => { const [cx, cz] = id.split(','); return AG.veg.near.get(cx + ',' + cz)?.items; }, saved?.id ?? '0,0,0', { timeout: 60000 }).catch(() => {});
    const after = await t.eval(`const b = ${JSON.stringify(saved)}; if (!b) return 'save failed'; const removed = AG.veg.removed.has(b.id); const [cx, cz, i] = b.id.split(',').map(Number);
      const hit = g.harvest.woodyAhead({ x: b.x, y: AG.heightAt(b.x, b.z), z: b.z }, { x: Math.sin(b.yaw), z: Math.cos(b.yaw) }, 2.3); const back = hit && hit.cx === cx && hit.cz === cz && hit.i === i;
      g.save = () => false; localStorage.removeItem('argonisos.world.v1'); return removed && !back ? true : JSON.stringify({ removed, back });`);
    t.check('save, reload: the chopped bush stays gone', after === true, String(after));
  },
};
