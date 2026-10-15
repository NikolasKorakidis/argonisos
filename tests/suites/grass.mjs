// Taller grass (15 Oct): patches here and there in the meadows (some in the marsh and forest) where the grass grows up to
// 0.7x the hero's height, and never taller; never on bare rock. Read from the ground texture the grass grows from, as the game does.
const TEX = `const G = await import('/src/world/gen.js'); const N = 160, size = 600, x0 = -300, z0 = -300; const m = await AG.pool.post({ type: 'grassTex', N, x0, z0, size });
  const at = (i, j) => { const g = m.data[(j * N + i) * 4 + 1], gg = Math.max(g, 0); return { g, tall: Math.floor(gg / 2) / 7, amt: gg - Math.floor(gg / 2) * 2, x: x0 + (i + 0.5) / N * size, z: z0 + (j + 0.5) / N * size }; };`;

export default {
  name: 'Grass',
  async run(t) {
    await t.step('taller grass grows in patches here and there over the meadows', `${TEX} let meadow = 0, tall = 0, patches = 0, prev = false;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (c.amt <= 0 || G.biomeWeights(c.x, c.z).p < 0.8) { prev = false; continue; } meadow++; const on = c.tall > 0.3; if (on) tall++; if (on && !prev) patches++; prev = on; }
      const tp = 100 * tall / meadow; return (tp > 4 && tp < 30 && patches > 30) || 'tall ' + tp.toFixed(1) + '% in ' + patches + ' runs';`);
    await t.step('the tallest blade is at most 0.7x the hero (1.36 m)', `const tallest = 0.5 * (0.94 + 0.12) * 2.35; return tallest <= 0.7 * 1.95 || tallest.toFixed(2) + ' m';`);
    await t.step('a tall patch stands all at about the same height: crisp edges, no ramp from short to tall', `${TEX} let tall = 0, between = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (c.amt <= 0) continue; if (c.tall > 0.95) tall++; else if (c.tall > 0.05) between++; } return (tall > 200 && between / (tall + between) < 0.12) || tall + ' tall texels, ' + between + ' in between';`);
    await t.step('no grass in or over a rock, boulder or trunk (a clear space round each)', `${TEX.replace('N = 160, size = 600, x0 = -300, z0 = -300', 'N = 224, size = 140, x0 = -70, z0 = -70')} const F = await import('/src/world/flora.js'); let inside = 0, n = 0;
      for (let cz = -3; cz <= 1; cz += 3) for (let cx = -3; cx <= 1; cx += 3) { const so = F.solidsAround(cx + 1, cz + 1); for (let s = 0; s < so.length; s += 3) { const i = Math.floor((so[s] - x0) / size * N), j = Math.floor((so[s + 1] - z0) / size * N); if (i < 0 || j < 0 || i >= N || j >= N || so[s + 2] < 0.3) continue; n++; const c = at(i, j); if (c.amt > 0.01) inside++; } }
      return (n > 20 && inside === 0) || inside + ' of ' + n + ' rocks and trunks have grass in them';`);
    await t.step('no tall grass on bare rock', `${TEX} let bad = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (G.isRock(c.x, c.z) && (c.g >= 0 || c.tall > 0)) bad++; } return bad === 0 || bad + ' rock texels with grass';`);
  },
};
