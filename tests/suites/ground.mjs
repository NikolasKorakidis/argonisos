// The ground and what stands on it: nothing grows or lies inside a rock or a trunk, floors press the ground down under
// them (and let it back up when they go), you stand on the boards, and things dropped indoors land on the floor.
export default {
  name: 'Ground and floors',
  async run(t) {
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 20 && AG.veg.near.size > 4, null, { timeout: 60000 });
    const solids = `const { SPECIES, SP } = await import('/src/world/flora.js'); const rocks = [], trunks = [];
      for (const c of AG.veg.near.values()) if (c.items) for (let o = 0; o < c.items.length; o += 7) { const sp = SPECIES[c.items[o]], s = c.items[o + 6]; if (!(s > 0) || !sp.col) continue; const e = [c.items[o + 2], c.items[o + 4], sp.col * s, sp.name]; if (sp.res === 'rock' || c.items[o] === SP.titan) rocks.push(e); else if (sp.res === 'tree') trunks.push(e); }`;
    await t.step('no pickup lies inside a rock or a tree trunk', `${solids} const bad = g.pickups.visible.filter((v) => v.kind !== 'drop' && [...rocks, ...trunks].some(([x, z, r]) => Math.hypot(v.x - x, v.z - z) < r)); return bad.length === 0 || bad.length + ' inside, e.g. a ' + bad[0].kind + ' at ' + bad[0].x.toFixed(1) + ',' + bad[0].z.toFixed(1);`);
    await t.step('no tree grows inside a rock or a giant', `${solids} const bad = trunks.filter(([x, z, r, n]) => n !== 'titan' && rocks.some(([a, b, R, m]) => m !== n && Math.hypot(x - a, z - b) < R * 0.8)); return bad.length === 0 || bad.length + ' of ' + trunks.length + ', e.g. a ' + bad[0][3] + ' at ' + bad[0][0].toFixed(1) + ',' + bad[0][1].toFixed(1);`);
    await t.step('a floor presses the ground down, and taking it away lets it back up', `AG.S.freeBuild = true; const x = P.pos.x + 9, z = P.pos.z + 3, h = AG.heightAt(x, z); const f = B.place('floor', new V(x, h - 0.6, z), 0); const under = g.pickups.landAt(x, z) < h - 0.6 - 0.1; B.remove(f, false); const back = Math.abs(g.pickups.landAt(x, z) - h) < 0.01; return (under && back) || JSON.stringify({ under, back });`);
    await t.step('an item dropped indoors lands on the floor, not the ground under it', `const x = P.pos.x - 8, z = P.pos.z, y = AG.heightAt(x, z) + 0.3; const f = B.place('floor', new V(x, y, z), 0); P.spawn(x, z); P.pos.y = y; const d = g.pickups.drop('stone', 1, x + 0.5, z, undefined, y); const ok = Math.abs(d.y - y) < 0.05; B.remove(f, false); g.pickups.drops.splice(g.pickups.drops.indexOf(d), 1); return ok || 'landed at ' + (d.y - y).toFixed(2);`);
    await t.step('find a slope and lay a level 2×2 floor at its low side', `let best = null;
      for (let r = 20; r < 200 && !best; r += 6) for (let a = 0; a < 6.28; a += 0.5) { const x = r * Math.cos(a), z = r * Math.sin(a), hs = [[-3, -3], [3, -3], [-3, 3], [3, 3]].map(([u, v]) => AG.heightAt(x + u, z + v)); const lo = Math.min(...hs), hi = Math.max(...hs); if (hi - lo > 0.9 && hi - lo < 1.6 && lo > 1.5) { best = { x, z, lo, hi }; break; } }
      if (!best) return 'no slope'; const y = best.lo + 0.1; window._f = { ...best, y }; P.spawn(best.x, best.z);
      for (const [u, v] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) B.place('floor', new V(best.x + u, y, best.z + v), 0);
      return true;`);
    await t.wait(2500);
    await t.step('…the ground under it is pressed below the boards', `const { x, z, y } = window._f; let worst = -9; for (let u = -2.9; u <= 2.9; u += 0.5) for (let v = -2.9; v <= 2.9; v += 0.5) worst = Math.max(worst, g.pickups.landAt(x + u, z + v) - y); return worst < -0.15 || 'ground pokes ' + worst.toFixed(2) + ' m above the boards';`);
    await t.step('…standing where the slope was highest', `const { x, z } = window._f; const c = [[-2, -2], [2, -2], [-2, 2], [2, 2]], hs = c.map(([u, v]) => AG.heightAt(x + u, z + v)); const [u, v] = c[hs.indexOf(Math.max(...hs))]; P.spawn(x + u, z + v); return true;`);
    await t.wait(800);
    await t.step('…the player stands on the boards, not on the old ground', `const { y } = window._f; return Math.abs(P.pos.y - y) < 0.05 || 'player ' + (P.pos.y - y).toFixed(2) + ' m from the floor top';`);
    await t.shot('floor-on-slope', { hud: false });
  },
};
