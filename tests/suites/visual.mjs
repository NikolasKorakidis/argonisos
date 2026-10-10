// How the island looks: a fixed tour (meadows, a grove, the forest, the giant forest, the temple, the Labyrinth, the
// summit of Olympos, golden hour, night), each shot compared with its baseline in tests/visual/baseline. A shot fails
// when too much of it changed; tests/reports/visual.html then shows baseline, now and the difference side by side.
// After a change that is meant to alter the look, accept the new pictures with: npm run test:update
import fs from 'node:fs';
import path from 'node:path';
import { PLACES, visit } from '../lib/places.mjs';
import { REPORTS } from '../lib/harness.mjs';
import { ROOT } from '../lib/server.mjs';
import { read, write, shrink, compare } from '../lib/image.mjs';

const BASE = path.join(ROOT, 'tests/visual/baseline'), OUT = path.join(REPORTS, 'visual');
// shrink 1280×720 to 320×180; fail past 2% changed pixels or a mean shift of 4/255 (between two runs of the same build
// the giant forest, the noisiest, changes 0.3% with a mean of 1.8: its dust and light shafts drift on their own)
const K = 4, MAX_CHANGED = 0.02, MAX_MEAN = 4;

export default {
  name: 'Visual',
  slow: true,
  viewport: { w: 1280, h: 720 },
  async run(t, { flags }) {
    const update = flags.has('--update'), rows = [];
    fs.mkdirSync(BASE, { recursive: true }); fs.mkdirSync(OUT, { recursive: true });
    await t.eval(`for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; return true;`);
    for (const name of Object.keys(PLACES)) {
      await visit(t, name);
      const full = await t.page.screenshot(); fs.writeFileSync(path.join(OUT, `${name}.png`), full);
      const now = shrink(read(full), K), base = path.join(BASE, `${name}.png`);
      fs.writeFileSync(path.join(OUT, `${name}-small.png`), write(now));
      if (update || !fs.existsSync(base)) { fs.writeFileSync(base, write(now)); t.check(`${name}: baseline ${update ? 'updated' : 'created'}`, true); rows.push({ name, fresh: true }); continue; }
      const c = compare(read(fs.readFileSync(base)), now);
      if (c.diff) fs.writeFileSync(path.join(OUT, `${name}-diff.png`), write(c.diff));
      const ok = c.changed <= MAX_CHANGED && c.mean <= MAX_MEAN; t.metrics[name] = { changed: +(c.changed * 100).toFixed(2), mean: +c.mean.toFixed(2) };
      t.check(`${name} looks as before`, ok, `${(c.changed * 100).toFixed(1)}% of pixels changed, mean shift ${c.mean.toFixed(1)}`);
      rows.push({ name, ok, changed: c.changed, mean: c.mean });
    }
    // a page to look at the differences
    const rel = (f) => path.relative(REPORTS, f);
    fs.writeFileSync(path.join(REPORTS, 'visual.html'), `<!doctype html><meta charset="utf-8"><title>Visual comparison</title>
<style>body{font:14px system-ui;background:#1c1b19;color:#eee;margin:16px}h2{font-size:15px;margin:20px 0 6px}.bad{color:#ff7a6a}.ok{color:#8fd18a}.row{display:flex;gap:8px;flex-wrap:wrap}figure{margin:0}img{width:320px;height:180px;image-rendering:pixelated;border:1px solid #444}figcaption{font-size:12px;color:#aaa}</style>
<h1>Visual comparison · ${new Date().toLocaleString()}</h1>
${rows.map((r) => `<h2 class="${r.fresh ? '' : r.ok ? 'ok' : 'bad'}">${r.name} — ${r.fresh ? 'new baseline' : `${(r.changed * 100).toFixed(1)}% changed, mean ${r.mean.toFixed(1)}`}</h2>
<div class="row">${r.fresh ? '' : `<figure><img src="${path.relative(REPORTS, path.join(BASE, r.name + '.png'))}"><figcaption>baseline</figcaption></figure>`}<figure><img src="${rel(path.join(OUT, r.name + '-small.png'))}"><figcaption>now</figcaption></figure>${r.fresh ? '' : `<figure><img src="${rel(path.join(OUT, r.name + '-diff.png'))}"><figcaption>changed (red)</figcaption></figure>`}<figure><a href="${rel(path.join(OUT, r.name + '.png'))}"><img src="${rel(path.join(OUT, r.name + '.png'))}"></a><figcaption>now, full size</figcaption></figure></div>`).join('\n')}`);
  },
};
