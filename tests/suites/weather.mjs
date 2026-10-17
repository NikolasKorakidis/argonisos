// The weather's look (graphics plan, phase 1): the world gets wet in the rain and dries in the sun; soaked ground is
// darker; a dry world looks exactly as it did before the wet look existed.
import { visit } from '../lib/places.mjs';
import { read, shrink } from '../lib/image.mjs';

const mean = (img, y0, y1) => { let s = 0, n = 0; for (let y = Math.floor(y0 * img.height); y < y1 * img.height; y++) for (let x = 0; x < img.width; x++) { const o = (y * img.width + x) * 4; s += img.data[o] + img.data[o + 1] + img.data[o + 2]; n += 3; } return s / n; };
const differ = (a, b) => { let s = 0; for (let i = 0; i < a.data.length; i += 4) s += Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2]); return s / (a.data.length / 4 * 3); };

export default {
  name: 'Weather',
  viewport: { w: 1280, h: 720 },
  async run(t) {
    await t.step('rain soaks the world in about a minute; it dries over minutes, faster in the sun', `const W = await import('/src/world/wetness.js'); const w0 = W.WET.value;
      W.WET.value = 0; for (let i = 0; i < 60; i++) W.updateWetness(1, 1, 1); const soaked = W.WET.value;
      for (let i = 0; i < 60; i++) W.updateWetness(1, 0, 1); const sunDried = W.WET.value; W.WET.value = soaked; for (let i = 0; i < 60; i++) W.updateWetness(1, 0, 0); const shadeDried = W.WET.value; W.WET.value = w0;
      return (soaked > 0.95 && sunDried > 0.6 && sunDried < 0.85 && shadeDried > sunDried) || JSON.stringify({ soaked, sunDried, shadeDried });`);
    await visit(t, 'meadow');
    await t.eval(`for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; P.camPitch = -0.6; P.camDist = 5; return true;`); await t.wait(800);
    const shot = async () => shrink(read(await t.page.screenshot()), 4);
    const dry = await shot();
    await t.eval(`(await import('/src/world/wetness.js')).WET.value = 1; return true;`); await t.wait(1200);
    const wet = await shot();
    await t.eval(`(await import('/src/world/wetness.js')).WET.value = 0; return true;`); await t.wait(600);
    const dryAgain = await shot();
    const a = mean(dry, 0.5, 1), b = mean(wet, 0.5, 1);
    t.metric('ground brightness, dry / soaked (0-255)', `${a.toFixed(1)} / ${b.toFixed(1)}`);
    t.check('soaked ground is darker', b < a * 0.93, `dry ${a.toFixed(1)}, soaked ${b.toFixed(1)}`);
    const d = differ(dry, dryAgain); t.metric('change once dry again (0-255)', d.toFixed(2));
    t.check('once dry, the world looks exactly as before', d < 0.6, `mean change ${d.toFixed(2)}`);
  },
};
