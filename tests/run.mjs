// Runs the test suites in tests/suites, each in a fresh game.
//   node tests/run.mjs                  all suites
//   node tests/run.mjs loop build       only suites whose file name starts with one of these
//   --quick                             skip the slow ones (perf, visual, creatures)
//   --headed                            watch it play in a visible window
//   --update                            visual: accept the current screenshots as the new baseline
// Writes tests/reports/results.json; exits non-zero if anything failed.
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { serve, ROOT } from './lib/server.mjs';
import { launch, openGame, Run, REPORTS } from './lib/harness.mjs';

const args = process.argv.slice(2), flags = new Set(args.filter((a) => a.startsWith('--'))), names = args.filter((a) => !a.startsWith('--'));
const dir = path.join(ROOT, 'tests/suites');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mjs')).sort();
const suites = [];
for (const f of files) {
  const s = (await import(pathToFileURL(path.join(dir, f)))).default; s.file = f.replace('.mjs', '');
  if (names.length && !names.some((n) => s.file.startsWith(n))) continue;
  if (flags.has('--quick') && s.slow) continue;
  suites.push(s);
}
if (!suites.length) { console.log('No suites match', names.join(' ')); process.exit(1); }
fs.mkdirSync(REPORTS, { recursive: true });

const server = await serve(), browser = suites.some((s) => !s.node) ? await launch(flags.has('--headed')) : null, out = [], t0 = Date.now();
for (const s of suites) {
  console.log(`\n\x1b[1m${s.name}\x1b[0m`);
  const st = Date.now(); let res;
  if (s.node) {
    const t = new Run(s.name, null, []);
    try { await s.run(t, { flags }); } catch (e) { t.check('suite finished', false, e.stack?.split('\n').slice(0, 2).join(' ')); }
    res = { name: s.name, results: t.results, metrics: t.metrics, errors: [], ok: t.results.every((r) => r.ok) };
  } else {
    let g;
    try {
      g = await openGame(browser, server.url, s.viewport || {});
      const t = new Run(s.name, g.page, g.errors);
      try { await s.run(t, { flags, base: server.url }); } catch (e) { t.check('suite finished', false, e.message.split('\n')[0]); }
      res = t.finish();
    } catch (e) { res = { name: s.name, results: [{ name: 'game loads', ok: false, why: e.message.split('\n')[0] }], metrics: {}, errors: [], ok: false }; console.log('  \x1b[31m✗ game did not load:', e.message.split('\n')[0], '\x1b[0m'); }
    await g?.ctx.close();
  }
  res.file = s.file; res.secs = Math.round((Date.now() - st) / 1000); out.push(res);
}
await browser?.close(); server.close();

const pass = out.reduce((a, s) => a + s.results.filter((r) => r.ok).length, 0), fail = out.reduce((a, s) => a + s.results.filter((r) => !r.ok).length, 0);
fs.writeFileSync(path.join(REPORTS, 'results.json'), JSON.stringify({ when: new Date().toISOString(), secs: Math.round((Date.now() - t0) / 1000), pass, fail, suites: out }, null, 1));
console.log(`\n\x1b[1m${pass} passed, ${fail} failed\x1b[0m in ${Math.round((Date.now() - t0) / 1000)} s`);
for (const s of out) for (const r of s.results) if (!r.ok) console.log(`  \x1b[31m✗ ${s.name} › ${r.name}\x1b[0m → ${r.why}`);
process.exit(fail ? 1 : 0);
