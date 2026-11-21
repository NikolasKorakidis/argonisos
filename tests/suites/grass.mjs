// Taller grass (15 Oct): patches here and there in the meadows (some in the marsh and forest) where the grass grows up to
// 0.7x the hero's height, and never taller; never on bare rock. Read from the ground texture the grass grows from, as the game does.
// And the grass reaches 80 m round the player (16 Oct), where the mist lies over its edge.
import { visit } from '../lib/places.mjs';
import { read, shrink } from '../lib/image.mjs';
const TEX = `const G = await import('/src/world/gen.js'); const N = 160, size = 600, x0 = -300, z0 = -300; const m = await AG.pool.post({ type: 'grassTex', N, x0, z0, size });
  const at = (i, j) => { const g = m.data[(j * N + i) * 4 + 1], gg = Math.max(g, 0); return { g, tall: Math.floor(gg / 2) / 7, amt: gg - Math.floor(gg / 2) * 2, x: x0 + (i + 0.5) / N * size, z: z0 + (j + 0.5) / N * size }; };`;

export default {
  name: 'Grass',
  viewport: { w: 1280, h: 720 },
  async run(t) {
    await t.step('the grass reaches 80 m round the player and thins away by 95 m, inside the mist', `const Gm = await import('/src/world/grass.js'), VG = await import('/src/world/reach.js');
      const tile = Gm.GRASS.far?.material && Gm.GRASS.far.count, reach = Gm.TEX_SIZE / 2 - 25;   // (the ground texture is re-centred every 25 m)
      return (VG.GRASS_R >= 80 && VG.GRASS_END > VG.GRASS_R && reach >= VG.GRASS_END && tile > 50000 && VG.MIST_R0 < VG.GRASS_R && VG.MIST_R1 > VG.GRASS_END) || JSON.stringify({ R: VG.GRASS_R, end: VG.GRASS_END, reach, tile, mist: [VG.MIST_R0, VG.MIST_R1] });`);
    await visit(t, 'meadow');
    const shot = async () => shrink(read(await t.page.screenshot()), 4);
    await t.eval(`for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; return true;`);
    const on = await shot(); await t.eval(`(await import('/src/world/grass.js')).GRASS.far.visible = false; return true;`); await t.wait(200);
    const off = await shot(); await t.eval(`(await import('/src/world/grass.js')).GRASS.far.visible = true; for (const e of document.querySelectorAll('body > *')) e.style.visibility = ''; return true;`);
    const band = (y0, y1) => { let s = 0, n = 0; for (let y = Math.floor(y0 * on.height); y < y1 * on.height; y++) for (let x = 0; x < on.width; x++) { const o = (y * on.width + x) * 4; s += Math.abs(on.data[o] - off.data[o]) + Math.abs(on.data[o + 1] - off.data[o + 1]) + Math.abs(on.data[o + 2] - off.data[o + 2]); n += 3; } return s / n; };
    const far = band(0.36, 0.5), near = band(0.85, 1);
    t.metric('change from the far grass (distant ground / at your feet, 0-255)', `${far.toFixed(1)} / ${near.toFixed(1)}`);
    t.check('out in the clearing the far grass covers the ground beyond the near carpet', far > 3 && near < 1, `distant ${far.toFixed(1)}, near ${near.toFixed(1)}`);
    await t.step('taller grass grows in patches here and there over the meadows', `${TEX} let meadow = 0, tall = 0, patches = 0, prev = false;
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (c.amt <= 0 || G.biomeWeights(c.x, c.z).p < 0.8) { prev = false; continue; } meadow++; const on = c.tall > 0.3; if (on) tall++; if (on && !prev) patches++; prev = on; }
      const tp = 100 * tall / meadow; return (tp > 4 && tp < 30 && patches > 30) || 'tall ' + tp.toFixed(1) + '% in ' + patches + ' runs';`);
    await t.step('the tallest blade is at most 0.7x the hero (1.36 m)', `const tallest = 0.5 * (0.94 + 0.12) * 2.35; return tallest <= 0.7 * 1.95 || tallest.toFixed(2) + ' m';`);
    await t.step('a tall patch stands all at about the same height: crisp edges, no ramp from short to tall', `${TEX} let tall = 0, between = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (c.amt <= 0) continue; if (c.tall > 0.95) tall++; else if (c.tall > 0.05) between++; } return (tall > 200 && between / (tall + between) < 0.12) || tall + ' tall texels, ' + between + ' in between';`);
    await t.step('no grass in or over a rock, boulder or trunk (a clear space round each)', `${TEX.replace('N = 160, size = 600, x0 = -300, z0 = -300', 'N = 224, size = 140, x0 = -70, z0 = -70')} const F = await import('/src/world/flora.js'); let inside = 0, n = 0;
      for (let cz = -3; cz <= 1; cz += 3) for (let cx = -3; cx <= 1; cx += 3) { const so = F.solidsAround(cx + 1, cz + 1); for (let s = 0; s < so.length; s += 3) { const i = Math.floor((so[s] - x0) / size * N), j = Math.floor((so[s + 1] - z0) / size * N); if (i < 0 || j < 0 || i >= N || j >= N || so[s + 2] < 0.3) continue; n++; const c = at(i, j); if (c.amt > 0.01) inside++; } }
      return (n > 20 && inside === 0) || inside + ' of ' + n + ' rocks and trunks have grass in them';`);
    // (graphics review, 21 Nov: after a jump the carpet was drawn round the new place on the old place's ground texture,
    // clamped at its edge: blades at the old place's height, green streaks across the sky.) From a high meadow down to
    // a low one, and the grass alone drawn at once, before the new texture is in: none
    // of it may stand more than 5 m over the ground
    const jump = await t.eval(`const Gm = await import('/src/world/grass.js'), G = await import('/src/world/gen.js'); let hx = 0, hz = 0, best = -1;   // (a high, grassy meadow: the highest found)
      for (let x = -1400; x <= 1400; x += 40) for (let z = -1400; z <= 1400; z += 40) { const h = AG.heightAt(x, z); if (h > best && h < 140 && G.biomeWeights(x, z).p > 0.9 && !G.isRock(x, z)) { best = h; hx = x; hz = z; } }
      AG.teleport(hx, hz); for (let i = 0; i < 300; i++) { const o = Gm.grassU.uOrigin.value, h = Gm.TEX_SIZE / 2; if (Math.hypot(o.x + h - P.pos.x, o.y + h - P.pos.z) < 30) break; await new Promise((r) => setTimeout(r, 100)); }
      // (then down to where the old texture, clamped at its edge, would stand the blades highest over the ground)
      const t1 = Gm.grassU.uHeight.value, N1 = t1.image.width, O1 = Gm.grassU.uOrigin.value.clone(), S1 = Gm.grassU.uSize.value; let tx = -220, tz = 360, lift = -1e9;
      for (let x = -1400; x <= 1400; x += 50) for (let z = -1400; z <= 1400; z += 50) { if (Math.hypot(x - P.pos.x, z - P.pos.z) < 400 || G.biomeWeights(x, z).p < 0.6 || AG.heightAt(x, z) < 2) continue;
        const i = Math.max(0, Math.min(N1 - 1, Math.floor((x - O1.x) / S1 * N1))), j = Math.max(0, Math.min(N1 - 1, Math.floor((z - O1.y) / S1 * N1))), o = (j * N1 + i) * 4, l = t1.image.data[o] - AG.heightAt(x, z); if (l > lift && t1.image.data[o + 1] > 0.3) { lift = l; tx = x; tz = z; } }   // (and grass growing there)
      const high = P.pos.y; AG.teleport(tx, tz); for (let k = 0; k < 2; k++) await new Promise((r) => requestAnimationFrame(r));
      const o = Gm.grassU.uOrigin.value, stale = Math.hypot(o.x + Gm.TEX_SIZE / 2 - P.pos.x, o.y + Gm.TEX_SIZE / 2 - P.pos.z) > Gm.TEX_SIZE / 2;
      // (looked at from straight above, the camera's far end 5 m over the highest ground within the grass's reach: any blade drawn stands higher than that)
      let top = -1e9; for (let x = -110; x <= 110; x += 5) for (let z = -110; z <= 110; z += 5) top = Math.max(top, AG.heightAt(P.pos.x + x, P.pos.z + z));
      const T = AG.THREE, R = AG.renderer, rt = new T.WebGLRenderTarget(320, 320), cam = new T.OrthographicCamera(-110, 110, 110, -110, 1, 1000 - top - 5), keep = new Set([Gm.GRASS.mesh, Gm.GRASS.far, ...Gm.GRASS.flowers]), was = [];
      cam.position.set(P.pos.x, 1000, P.pos.z); cam.up.set(0, 0, -1); cam.lookAt(P.pos.x, 0, P.pos.z); cam.updateMatrixWorld();
      for (const c of AG.scene.children) if (!keep.has(c) && !c.isLight) { was.push([c, c.visible]); c.visible = false; } const bg = AG.scene.background; AG.scene.background = null;
      const prev = R.getRenderTarget(), cc = R.getClearAlpha(); R.setRenderTarget(rt); R.setClearColor(0x000000, 0); R.clear(); R.render(AG.scene, cam); const px = new Uint8Array(320 * 320 * 4); R.readRenderTargetPixels(rt, 0, 0, 320, 320, px);
      R.setRenderTarget(prev); R.setClearAlpha(cc); AG.scene.background = bg; for (const [c, v] of was) c.visible = v; rt.dispose();
      let sky = 0; for (let i = 3; i < px.length; i += 4) if (px[i] > 0) sky++;
      return { sky, high: Math.round(high), low: Math.round(P.pos.y), lift: Math.round(lift), stale };`);
    t.metric("just after the jump (from / to, m up; how far the old ground texture's edge stands over the new ground; still in place)", `${jump.high} / ${jump.low}; ${jump.lift} m; ${jump.stale}`);
    t.check('just after a long jump down from a height no grass hangs in the sky', jump.sky === 0, jump.sky + ' grass pixels more than 5 m over the ground');
    await t.step('no tall grass on bare rock', `${TEX} let bad = 0; for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const c = at(i, j); if (G.isRock(c.x, c.z) && (c.g >= 0 || c.tall > 0)) bad++; } return bad === 0 || bad + ' rock texels with grass';`);
  },
};
