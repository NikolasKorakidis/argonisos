// The woods of Pedias (tester feedback, 15 Oct): trees grow in woods of every size with wide open meadow between, never
// alone or in pairs out in the open; and every tree has a clear trunk, its crown starting above 1.5× the hero's height.
const LAYOUT = `const G = await import('/src/world/gen.js'), F = await import('/src/world/flora.js'); const w = { p: 0, y: 0, v: 0, r: 0 }; const all = [];
  for (let cx = -13; cx < 13; cx++) for (let cz = -13; cz < 13; cz++) { const it = F.layoutCell(cx, cz); for (let o = 0; o < it.length; o += 7) if (F.SPECIES[it[o]].res === 'tree' && it[o + 6] > 0) all.push([it[o + 2], it[o + 4], F.SPECIES[it[o]].name]); }
  const grid = new Map(), cell = (x, z) => Math.floor(x / 12) + ',' + Math.floor(z / 12); for (const t of all) (grid.get(cell(t[0], t[1])) || grid.set(cell(t[0], t[1]), []).get(cell(t[0], t[1]))).push(t);
  const around = (x, z, r) => { const out = []; const k = Math.ceil(r / 12); for (let i = -k; i <= k; i++) for (let j = -k; j <= k; j++) for (const u of grid.get((Math.floor(x / 12) + i) + ',' + (Math.floor(z / 12) + j)) || []) if (Math.hypot(u[0] - x, u[1] - z) < r) out.push(u); return out; };
  const meadow = (x, z) => G.biomeWeights(x, z, w).p > 0.8 && Math.abs(x) < 760 && Math.abs(z) < 760;`;   // (meadow, well inside the sampled square)

export default {
  name: 'Woods',
  async run(t) {
    await t.step('out in the meadows no tree stands alone or in a pair (trees within 11 m make a group; the giants, 22 m)', `${LAYOUT}
      const seen = new Set(), bad = []; let groups = 0;
      for (const t of all) { if (seen.has(t) || !meadow(t[0], t[1])) continue; const g = [t]; seen.add(t); for (let q = 0; q < g.length; q++) for (const u of around(g[q][0], g[q][1], g[q][2] === 'titan' ? 22 : 11)) if (!seen.has(u)) { seen.add(u); g.push(u); } groups++; if (g.length <= 2) bad.push(g.length + ' at ' + t[0].toFixed(0) + ',' + t[1].toFixed(0)); }
      return (groups > 50 && bad.length === 0) || bad.length + ' of ' + groups + ' groups are 1-2 trees: ' + bad.slice(0, 4).join(' | ');`);
    await t.step('wide open meadow between the woods: about a fifth wooded, over half open', `${LAYOUT} let land = 0, wooded = 0, open = 0;
      for (let x = -740; x < 740; x += 9) for (let z = -740; z < 740; z += 9) { if (G.heightAt(x, z) < 1.6 || !meadow(x, z)) continue; land++; if (around(x, z, 8).length) wooded++; if (!around(x, z, 30).length) open++; }
      const wp = 100 * wooded / land, op = 100 * open / land; return (wp > 10 && wp < 30 && op > 45) || 'wooded ' + wp.toFixed(0) + '%, open ' + op.toFixed(0) + '%';`);
    await t.step('woods of every size: small islands and great masses', `${LAYOUT} const seen = new Set(), sizes = [];
      for (const t of all) { if (seen.has(t) || !meadow(t[0], t[1])) continue; const g = [t]; seen.add(t); for (let q = 0; q < g.length; q++) for (const u of around(g[q][0], g[q][1], 11)) if (!seen.has(u)) { seen.add(u); g.push(u); } sizes.push(g.length); }
      sizes.sort((a, b) => a - b); const small = sizes.filter((n) => n < 15).length, big = sizes.filter((n) => n > 200).length; return (small > 20 && big >= 3) || JSON.stringify({ small, big, n: sizes.length });`);
    await t.step('olives and pomegranates for the tributes grow near the start', `${LAYOUT} const n = { olive: 0, pomegranate: 0 }; for (const t of around(6, 4, 400)) if (n[t[2]] !== undefined) n[t[2]]++; return (n.olive >= 40 && n.pomegranate >= 10) || JSON.stringify(n);`);
    await t.step('every meadow tree has a clear trunk: the crown starts above 2.9 m (1.5× the hero) even at its smallest', `const F = await import('/src/world/flora.js'); const low = [];
      for (const name of ['olive', 'oak', 'cypress', 'pomegranate', 'fig', 'plane', 'qtree', 'holm']) { const sp = F.SP[name], S = F.SPECIES[sp].s; let min = 1e9; for (let v = 0; v < 3; v++) { const o = AG.veg.single(sp, v); o.updateMatrixWorld(true); if (o.children[1]) min = Math.min(min, new AG.THREE.Box3().setFromObject(o.children[1]).min.y); } if (min * S[0] < 2.9) low.push(name + ' ' + (min * S[0]).toFixed(2) + ' m'); }
      return low.length === 0 || 'too low: ' + low.join(', ');`);
  },
};
