// The game in headless Chrome on the real GPU (Metal through ANGLE: the default software renderer runs the world at
// under 1 fps, which makes every timing and streaming check meaningless), opened with ?play so the title screen is
// skipped, and set up to be calm and repeatable: no saving, no random rain putting fires out, the owl's talks already
// heard (her dialogue pauses the world), creatures peaceful until a test asks otherwise.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './server.mjs';

export const REPORTS = path.join(ROOT, 'tests/reports');
export const GPU_ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'];
export const launch = (headed = false, extra = []) => chromium.launch({ headless: !headed, args: [...GPU_ARGS, ...extra] });

// Errors the page may print that say nothing about the game (a missing favicon)
const NOISE = [/favicon/i];

// The snippet prelude every step runs with: short names for what tests touch most
const H = 'const g = AG.game, P = g.player, B = g.build, V = AG.THREE.Vector3, inv = g.inv, C = g.crafting;';

export async function openGame(browser, base, { w = 1100, h = 620, setup = true, query = 'play' } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage(); page.setDefaultTimeout(120000);
  const errors = [];
  page.on('pageerror', (e) => errors.push(`${e.message} ${(e.stack || '').split('\n')[1]?.trim() || ''}`));
  page.on('console', (m) => { if (m.type() === 'error' && !NOISE.some((r) => r.test(m.text()))) errors.push(m.text().slice(0, 300)); });
  await page.goto(`${base}/?${query}`);
  await page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
  if (setup) await page.evaluate(() => {
    localStorage.removeItem('argonisos.world.v1'); const g = AG.game;
    g.save = () => false; AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0;
    g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true;
  });
  return { ctx, page, errors };
}

// One suite's run: steps are snippets evaluated in the page that return true (pass) or anything else (the reason it failed)
export class Run {
  constructor(name, page, errors, { quiet = false } = {}) {
    this.name = name; this.page = page; this.errors = errors; this.results = []; this.metrics = {}; this.quiet = quiet;
    this.dir = path.join(REPORTS, 'shots'); fs.mkdirSync(this.dir, { recursive: true });
  }
  record(name, ok, why, ms = 0) {
    this.results.push({ name, ok, why: ok ? undefined : String(why), ms });
    if (!this.quiet) console.log(`  ${ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'} ${name}${ok ? '' : `\x1b[31m → ${why}\x1b[0m`}`);
    return ok;
  }
  async step(name, code) {
    const t0 = Date.now();
    try { const r = await this.page.evaluate(`(async () => { ${H} ${code} })()`); return this.record(name, r === true, r, Date.now() - t0); }
    catch (e) { return this.record(name, false, 'threw: ' + e.message.split('\n')[0], Date.now() - t0); }
  }
  // a check decided on the Node side (e.g. from numbers a page snippet returned)
  check(name, ok, why) { return this.record(name, !!ok, why); }
  eval(code) { return this.page.evaluate(`(async () => { ${H} ${code} })()`); }
  wait(ms) { return this.page.waitForTimeout(ms); }
  metric(key, value) { this.metrics[key] = value; if (!this.quiet) console.log(`  · ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`); }
  async shot(name, { hud = true } = {}) {
    if (!hud) await this.page.evaluate(() => { for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.dataset.vis = e.style.visibility, e.style.visibility = 'hidden'; });
    const file = path.join(this.dir, `${this.slug}-${name}.png`); await this.page.screenshot({ path: file });
    if (!hud) await this.page.evaluate(() => { for (const e of document.querySelectorAll('body > *')) if (e.tagName !== 'CANVAS') e.style.visibility = e.dataset.vis || ''; });
    return file;
  }
  get slug() { return this.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'); }
  // after the suite: anything the page threw or logged as an error is a failure too
  finish() {
    const errs = this.errors.filter((e, i, a) => a.indexOf(e) === i);
    this.record('no errors in the page', errs.length === 0, `${errs.length}: ${errs.slice(0, 3).join(' | ')}`);
    return { name: this.name, results: this.results, metrics: this.metrics, errors: errs, ok: this.results.every((r) => r.ok) };
  }
}
