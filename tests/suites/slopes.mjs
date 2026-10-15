// Steep ground (tester feedback, 15 Oct): one slope rule decides three things, which must never disagree. Above the limit
// (47% grade, about 25°) the ground is bare rock to look at, nothing grows on it (no grass, flowers, bushes or trees), and
// only stones lie on it. Sampled over the island: meadows, forest hills and the slopes of Olympos.
const PLANTS = ['olive', 'oak', 'cypress', 'pomegranate', 'fig', 'plane', 'qtree', 'qpine', 'fir', 'holm', 'qdead', 'dead', 'lavender', 'broom', 'myrtle', 'titan', 'fern', 'redbush'];
const CELLS = `const G = await import('/src/world/gen.js'), F = await import('/src/world/flora.js'), PK = await import('/src/world/pickups.js');
  const cells = []; for (const [ox, oz] of [[0, 0], [8, -6], [-9, 5], [12, 10], [-14, -11], [3, 15]]) for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) cells.push([ox + i, oz + j]);`;

export default {
  name: 'Slopes',
  async run(t) {
    await t.step('the limit is a grade of 47% (about 25°), measured across 8 m', `const G = await import('/src/world/gen.js'); return (G.ROCK_GRADE === 0.47 && Math.abs(Math.atan(G.ROCK_GRADE) * 180 / Math.PI - 25.2) < 0.2) || 'limit ' + G.ROCK_GRADE;`);
    await t.step('nothing grows on bare rock: no tree, bush, fern or flower bed', `${CELLS} const plants = new Set(${JSON.stringify(PLANTS)}); let n = 0, onRock = 0; const bad = [];
      for (const [cx, cz] of cells) { const it = F.layoutCell(cx, cz); for (let o = 0; o < it.length; o += 7) { const sp = F.SPECIES[it[o]]; if (!plants.has(sp.name) || !(it[o + 6] > 0)) continue; n++; if (G.isRock(it[o + 2], it[o + 4])) { onRock++; if (bad.length < 3) bad.push(sp.name + ' at ' + it[o + 2].toFixed(0) + ',' + it[o + 4].toFixed(0) + ' grade ' + G.slopeGrade(it[o + 2], it[o + 4]).toFixed(2)); } } }
      return (n > 500 && onRock === 0) || onRock + ' of ' + n + ' plants on rock: ' + bad.join(' | ');`);
    await t.step('on bare rock only stones lie about, in small heaps', `${CELLS} let rockStones = 0, other = 0; const bad = [];
      for (const [cx, cz] of cells) for (const p of PK.layoutPickups(cx, cz)) { if (!G.isRock(p.x, p.z)) continue; if (p.kind === 'stone' || p.kind === 'lightstone') rockStones++; else { other++; if (bad.length < 3) bad.push(p.kind); } }
      return (other === 0 && rockStones > 10) || other + ' non-stones on rock (' + bad.join(', ') + '), ' + rockStones + ' stones';`);
    await t.step('rock looks like rock, gentle meadow never does', `const G = await import('/src/world/gen.js'); let rock = 0, rockGrey = 0, meadow = 0, meadowGreen = 0;
      for (let x = -900; x < 900; x += 13) for (let z = -900; z < 900; z += 13) { const h = G.heightAt(x, z); if (h < 2) continue; const w = G.biomeWeights(x, z), gr = G.slopeGrade(x, z), c = G.groundColor(x, z, h, gr, w);
        if (gr > G.ROCK_GRADE) { rock++; if (Math.max(...c) - Math.min(...c) < 0.12) rockGrey++; } else if (gr < 0.25 && w.p > 0.9 && h < 80) { meadow++; if (Math.max(...c) - Math.min(...c) > 0.15) meadowGreen++; } }
      return (rock > 50 && rockGrey / rock > 0.9 && meadowGreen / meadow > 0.95) || JSON.stringify({ rock, rockGrey, meadow, meadowGreen });`);
    await t.step('no grass or flowers on bare rock (the ground texture the grass grows from)', `const G = await import('/src/world/gen.js');
      let spot = null; for (let r = 300; r < 1100 && !spot; r += 10) for (let a = 0; a < 6.28; a += 0.2) { const x = r * Math.cos(a), z = r * Math.sin(a); if (G.isRock(x, z) && G.biomeWeights(x, z).y > 0.8) { spot = [x, z]; break; } }
      if (!spot) return 'no rock found'; const N = 96, size = 60, x0 = spot[0] - size / 2, z0 = spot[1] - size / 2; const m = await AG.pool.post({ type: 'grassTex', N, x0, z0, size });
      let rock = 0, rockBare = 0, open = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const x = x0 + (i + 0.5) / N * size, z = z0 + (j + 0.5) / N * size, k = (j * N + i) * 4; if (G.isRock(x, z)) { rock++; if (m.data[k + 1] < 0 && m.data[k + 3] === 0) rockBare++; } else open++; }
      return (rock > 20 && rockBare === rock) || rockBare + ' of ' + rock + ' rock texels bare (' + open + ' open)';`);
    await t.step('how much is rock: a little of the meadows, the steep forest hillsides', `const G = await import('/src/world/gen.js'); const n = { p: 0, y: 0 }, r = { p: 0, y: 0 };
      for (let x = -1300; x < 1300; x += 11) for (let z = -1300; z < 1300; z += 11) { if (G.heightAt(x, z) < 1.6) continue; const w = G.biomeWeights(x, z), k = w.p > 0.7 ? 'p' : w.y > 0.7 ? 'y' : null; if (!k) continue; n[k]++; if (G.isRock(x, z)) r[k]++; }
      const p = (100 * r.p) / n.p, y = (100 * r.y) / n.y; return (p > 1 && p < 8 && y > 15 && y < 40) || 'Pedias ' + p.toFixed(1) + '%, Yleos ' + y.toFixed(1) + '%';`);
  },
};
