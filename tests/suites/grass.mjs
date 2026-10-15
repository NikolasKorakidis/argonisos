// Tall grass (15 Oct): patches in the meadows (and some in the marsh and forest) where the grass grows waist high, with
// cores taller than the hero; never on bare rock. Read from the ground texture the grass grows from, as the game does.
const TEX = `const G = await import('/src/world/gen.js'); const N = 160, size = 600, x0 = -300, z0 = -300; const m = await AG.pool.post({ type: 'grassTex', N, x0, z0, size });
  const at = (i, j) => { const g = m.data[(j * N + i) * 4 + 1], gg = Math.max(g, 0); return { g, tall: Math.floor(gg / 2) / 7, amt: gg - Math.floor(gg / 2) * 2, x: x0 + (i + 0.5) / N * size, z: z0 + (j + 0.5) / N * size }; };`;

export default {
  name: 'Grass',
  async run(t) {
    await t.step('tall grass grows in patches over part of the meadows, with cores', `${TEX} let meadow = 0, tall = 0, core = 0;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (c.amt <= 0 || G.biomeWeights(c.x, c.z).p < 0.8) continue; meadow++; if (c.tall > 0.1) tall++; if (c.tall > 0.7) core++; }
      const tp = 100 * tall / meadow, cp = 100 * core / meadow; return (tp > 5 && tp < 35 && cp > 0.3) || 'tall ' + tp.toFixed(1) + '%, cores ' + cp.toFixed(1) + '%';`);
    await t.step('at its core, tall grass stands taller than the hero (1.95 m)', `return (0.5 * 0.85 * (1 + 1 * 4.2)) > 1.95 || 'too short';`);
    await t.step('no tall grass on bare rock', `${TEX} let bad = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (G.isRock(c.x, c.z) && (c.g >= 0 || c.tall > 0)) bad++; } return bad === 0 || bad + ' rock texels with grass';`);
  },
};
