// The player's mist and what it hides (tester feedback, 15 and 16 Oct): clear for 60 m round the hero, 68% by 100 m (half
// grown at 80 m, where the grass ends), its ceiling
// a little over the tallest thing near, the sky above it clear; behind it only a share of each kind is drawn (half the
// trees, a tenth of the big rocks, none of the small stuff) and fewer far blocks are kept; and the focus blur leaves the
// middle of the screen sharp while the edges soften.
import { visit } from '../lib/places.mjs';
import { read, shrink } from '../lib/image.mjs';

// how much two pictures differ in a box of them (mean over the pixels and channels, 0-255)
function differ(a, b, x0, y0, x1, y1) {
  let s = 0, n = 0; const W = a.width;
  for (let y = Math.floor(y0 * a.height); y < y1 * a.height; y++) for (let x = Math.floor(x0 * W); x < x1 * W; x++) { const o = (y * W + x) * 4; s += Math.abs(a.data[o] - b.data[o]) + Math.abs(a.data[o + 1] - b.data[o + 1]) + Math.abs(a.data[o + 2] - b.data[o + 2]); n += 3; }
  return s / n;
}

export default {
  name: 'Mist',
  viewport: { w: 1280, h: 720 },
  async run(t) {
    await t.step('clear for 60 m round the hero, thickening to 68% by 100 m, half grown where the grass ends', `const { ATMO } = await import('/src/render/atmosphere.js'), { GRASS_R } = await import('/src/world/grass.js'); return (ATMO.mzR0.value === 60 && ATMO.mzR1.value === 100 && ATMO.mzAmt.value === 0.68 && GRASS_R === 80 && Math.abs((ATMO.mzR0.value + ATMO.mzR1.value) / 2 - GRASS_R) < 1) || JSON.stringify([ATMO.mzR0.value, ATMO.mzR1.value, ATMO.mzAmt.value]);`);
    await visit(t, 'meadow');
    const meadow = await t.eval(`const { ATMO } = await import('/src/render/atmosphere.js'); const g0 = AG.heightAt(P.pos.x, P.pos.z); return { top: ATMO.mzTop.value - g0, tallest: AG.veg.tallestNear(P.pos, 110) - g0 };`);
    await visit(t, 'giantwood');
    const giant = await t.eval(`const { ATMO } = await import('/src/render/atmosphere.js'); const g0 = AG.heightAt(P.pos.x, P.pos.z); return { top: ATMO.mzTop.value - g0, tallest: AG.veg.tallestNear(P.pos, 110) - g0 };`);
    t.metric('mist ceiling over the ground (meadow / giant forest)', `${meadow.top.toFixed(1)} m / ${giant.top.toFixed(1)} m`);
    t.check('its ceiling sits a little over the tallest thing near (at most 40 m up): low in the meadow, high under the giants', meadow.top > 7 && giant.top > meadow.top + 8 && Math.abs(giant.top - Math.min(40, Math.max(8, giant.tallest + 4))) < 3, JSON.stringify({ meadow, giant }));
    await visit(t, 'meadow');
    // the sky with the mist and without: the upper part of the picture the same, the band low over the horizon not
    const on = shrink(read(await t.page.screenshot()), 4);
    await t.eval(`(await import('/src/render/atmosphere.js')).ATMO.mzAmt.value = 0; return true;`); await t.wait(200);
    const off = shrink(read(await t.page.screenshot()), 4);
    await t.eval(`(await import('/src/render/atmosphere.js')).ATMO.mzAmt.value = 0.68; return true;`);
    const diff = (y0, y1) => { let s = 0, n = 0; for (let y = Math.floor(y0 * on.height); y < y1 * on.height; y++) for (let x = 0; x < on.width; x++) { const o = (y * on.width + x) * 4; s += Math.abs(on.data[o] - off.data[o]) + Math.abs(on.data[o + 1] - off.data[o + 1]) + Math.abs(on.data[o + 2] - off.data[o + 2]); n++; } return s / n / 3; };
    const sky = diff(0, 0.12), horizon = diff(0.25, 0.42);
    t.metric('change from the mist (top of the sky / the horizon band)', `${sky.toFixed(1)} / ${horizon.toFixed(1)}`);
    t.check('the sky above stays clear; the distance low over the horizon is misted', sky < 2 && horizon > 6, `sky ${sky.toFixed(1)}, horizon ${horizon.toFixed(1)}`);
    await t.step('behind the mist: half the trees, a tenth of the big rocks, none of the small things are drawn', `const F = await import('/src/world/flora.js'); const kind = (n) => ['rock', 'boulder'].includes(n) ? 'rock' : ['lavender', 'broom', 'myrtle', 'fern', 'redbush', 'amphorae', 'herm', 'reeds'].includes(n) ? 'small' : F.SPECIES[F.SP[n]].res === 'tree' ? 'tree' : null;
      const c = { tree: [0, 0], rock: [0, 0], small: [0, 0] };
      for (const b of AG.veg.mids.values()) for (let k = 0; k < b.n; k++) { const it = b.refs[k * 2].items, o = b.refs[k * 2 + 1] * 7, dx = it[o + 2] - P.pos.x, dz = it[o + 4] - P.pos.z, d2 = dx * dx + dz * dz; if (d2 < 180 * 180 || d2 > 250 * 250) continue; const kd = kind(F.SPECIES[it[o]].name); if (!kd) continue; c[kd][0]++; if (d2 <= b.keep[k]) c[kd][1]++; }
      const f = (a) => (a[0] ? a[1] / a[0] : NaN); const tr = f(c.tree), rk = f(c.rock), sm = f(c.small);
      return (Math.abs(tr - 0.5) < 0.08 && rk < 0.18 && (isNaN(sm) || sm === 0) && c.tree[0] > 100) || JSON.stringify({ tree: c.tree, rock: c.rock, small: c.small });`);
    await t.step('far tree cards end at 600 m, so far fewer far blocks are kept', `const n = AG.veg.far.size; return (n > 4 && n < 45) || n + ' far blocks (about 85 were kept with the old 1 km reach)';`);
    // the focus blur: sharp in the middle, softer at the edges
    await t.eval(`for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; return true;`);   // (the HUD isn't part of the picture)
    const sharp = read(await t.page.screenshot());
    await t.eval(`(await import('/src/render/atmosphere.js')).ATMO.focus.value = 0; return true;`); await t.wait(200);
    const flat = read(await t.page.screenshot());
    await t.eval(`(await import('/src/render/atmosphere.js')).ATMO.focus.value = 3; return true;`);
    const mid = differ(sharp, flat, 0.44, 0.44, 0.56, 0.56), edge = differ(sharp, flat, 0.02, 0.6, 0.14, 0.95);
    t.metric('change made by the focus blur (middle / edge of the screen, 0-255)', `${mid.toFixed(1)} / ${edge.toFixed(1)}`);
    t.check('the focus blur leaves the middle sharp and softens the edges', mid < 1 && edge > 6, `middle ${mid.toFixed(1)}, edge ${edge.toFixed(1)}`);
  },
};
