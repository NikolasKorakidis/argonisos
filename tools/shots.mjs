// Screenshots of the game for checking a change by eye: node tools/shots.mjs <out-dir> <shots.json>
// Each shot is { name, go, time?, settle?, after? }: go and after are page snippets (the test names g, P, B… are set),
// time is the hour (0..1), settle how long to wait (ms) before the picture. The HUD is hidden in the pictures.
import fs from 'node:fs';
import path from 'node:path';
import { serve } from '../tests/lib/server.mjs';
import { launch, openGame, Run } from '../tests/lib/harness.mjs';

const [out, spec] = process.argv.slice(2);
const shots = JSON.parse(fs.readFileSync(spec, 'utf8'));
const server = await serve(), browser = await launch(false), gm = await openGame(browser, server.url, { w: 1280, h: 720 });
const t = new Run('shots', gm.page, gm.errors, { quiet: true });
fs.mkdirSync(out, { recursive: true });
for (const s of shots) {
  await t.eval(`AG.S.timeScale = 0; AG.S.time = ${s.time ?? 0.3}; AG.setWeather('clear'); AG.snapWeather(); for (const c of [...g.creatures.list]) g.creatures.remove(c); g.owl.update = () => {}; g.owl.o.g.visible = false; return true;`);
  const info = await t.eval(s.go);
  await gm.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 });
  await t.wait(s.settle ?? 5000);
  if (s.after) console.log(s.name, 'after', JSON.stringify(await t.eval(s.after)));
  await gm.page.evaluate(() => { for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = 'hidden'; });
  await gm.page.screenshot({ path: path.join(out, s.name + '.png') });
  await gm.page.evaluate(() => { for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = ''; });
  console.log(s.name, JSON.stringify(info));
}
if (gm.errors.length) console.log('errors', gm.errors.slice(0, 3));
await browser.close(); server.close();
