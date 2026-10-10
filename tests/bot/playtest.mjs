// The playtester: plays the game on its own for a while, the way a restless player would (wandering, travelling,
// visiting the sites, gathering, fighting, building, crafting, opening every menu, fast-forwarding through day and night
// and weather, swimming, flying, dying, calling bosses, saving and reloading), and reports what went wrong: page
// errors, falling through the world, getting stuck, hitches and slow places, memory that keeps growing, a save that
// doesn't come back the same. Its choices come from a seed, so a run can be repeated.
//   node tests/bot/playtest.mjs [--minutes 10] [--seed 7] [--headed]
// Writes tests/reports/playtest/<time>/report.md (with screenshots of each incident) and report.json.
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from '../lib/server.mjs';
import { launch, openGame, Run, REPORTS } from '../lib/harness.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const MINUTES = Number(arg('minutes', 10)), SEED = Number(arg('seed', Date.now() % 100000)), HEADED = process.argv.includes('--headed');
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19), OUT = path.join(REPORTS, 'playtest', stamp), SHOTS = path.join(OUT, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MONITOR = fs.readFileSync(path.join(ROOT, 'tests/bot/monitor.js'), 'utf8');

// seeded choices
let seed = SEED || 1; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = (a) => a[Math.floor(rnd() * a.length)], between = (a, b) => a + rnd() * (b - a);

const server = await serve(), browser = await launch(HEADED, ['--enable-precise-memory-info']);
const { page, errors } = await openGame(browser, server.url, { w: 1280, h: 720, setup: false });
const t = new Run('Playtest', page, errors, { quiet: true });
const log = [], incidents = [], botErrors = [], t0 = Date.now(), secs = () => Math.round((Date.now() - t0) / 1000);
const say = (m) => { const line = `${String(secs()).padStart(5)} s  ${m}`; log.push(line); console.log(line); };
const ev = (code) => t.eval(code);
const wait = (ms) => page.waitForTimeout(ms);

// The game as a player gets it, minus what would stall an unattended run: the owl's talks are already heard (her
// dialogue pauses the world) and nothing is saved over a real save; weather, night and creatures are left as they are
async function setup() {
  await ev(`localStorage.removeItem('argonisos.world.v1'); g.save = () => false; g.owl.st.done.push('intro', 'night', 'house', 'temple', 'yleos'); g.owl.st.queue = []; g.owl.st.met = true;
    const I = (await import('/src/input.js')).input; I.locked = true;   // (headless Chrome won't lock the pointer; clicks only count when it is)
    g.give('crudeSpear'); g.give('crudeAxe'); g.give('hammer'); g.give('cookedMeat', 10); g.give('wood', 50); g.give('stone', 30); g.give('rope', 20);
    g.equip(inv.slots.findIndex((s) => s?.id === 'crudeSpear')); return true;`);
  await page.evaluate(MONITOR);
}
await setup();
const act = (name) => ev(`window.__mon.act = ${JSON.stringify(name)}; if (g.paused) g.pause(false); return true;`);

// ---- moving the hero with real keys: face a direction (the camera leads, the hero follows) and walk
const keys = new Set();
const hold = async (k, on) => { if (on && !keys.has(k)) { keys.add(k); await page.keyboard.down(k); } else if (!on && keys.has(k)) { keys.delete(k); await page.keyboard.up(k); } };
const release = async () => { for (const k of [...keys]) await hold(k, false); };
const face = (x, z) => ev(`P.camYaw = Math.atan2(-(${x} - P.pos.x), -(${z} - P.pos.z)); return true;`);
const pos = () => ev('return { x: P.pos.x, y: P.pos.y, z: P.pos.z, swim: P.swimming, dead: P.dead, fly: AG.S.fly };');
let nShot = 0;
async function shoot(name) { const f = path.join(SHOTS, `${String(++nShot).padStart(3, '0')}-${name}.png`); await page.screenshot({ path: f }).catch(() => {}); return path.relative(OUT, f); }

// walking with a stuck check: if four seconds of holding W moved the hero less than half a metre (and nothing explains
// it), that's a stuck spot; try jumping and turning, and if that fails, note it and move on
async function walkFor(ms, { target = null, sprint = false, turn = true } = {}) {
  const end = Date.now() + ms; let ref = await pos(), refT = Date.now(), tries = 0, blocked = false;
  await hold('KeyW', true); await hold('ShiftLeft', sprint);
  while (Date.now() < end) {
    if (target) { await face(target.x, target.z); const p = await pos(); if (Math.hypot(p.x - target.x, p.z - target.z) < (target.r || 1.6)) break; }
    else if (turn && rnd() < 0.25) await ev(`P.camYaw += ${between(-0.9, 0.9)}; return true;`);
    if (rnd() < 0.08) await page.keyboard.press('Space');
    await wait(between(250, 700));
    if (Date.now() - refT > 4000) {
      const p = await pos(), moved = Math.hypot(p.x - ref.x, p.z - ref.z);
      if (moved < 0.5 && !p.dead && !p.fly && !(await ev('return g.paused || g.hud.open || g.map.open;'))) {
        tries++;
        if (tries >= 3 && target) { blocked = true; break; }   // (the bot walks in straight lines: walls and cliffs between it and a target are no bug)
        if (tries >= 3) { const shot = await shoot('stuck'); incidents.push({ kind: 'stuck', detail: 'held W for 12 s without getting anywhere', at: { x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1) }, act: await ev('return window.__mon.act;'), t: secs(), shot }); say(`stuck at ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`); break; }
        await page.keyboard.press('Space'); await ev(`P.camYaw += ${between(1.5, 3)}; return true;`);
      } else tries = 0;
      ref = p; refT = Date.now();
    }
  }
  await release(); return !blocked;
}
const landPoint = (rMin, rMax) => ev(`for (let k = 0; k < 200; k++) { const r = ${rMin} + Math.random() * ${rMax - rMin}, a = Math.random() * 6.283, x = r * Math.cos(a), z = r * Math.sin(a); if (AG.heightAt(x, z) > 1.5) return { x, z }; } return { x: 6, z: 4 };`);
const teleport = async (x, z) => { await ev(`AG.teleport(${x}, ${z}); return true;`); await page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 60000 }).catch(() => {}); await wait(800); };

// ---- what a player does
const skip = new Set();   // pickups the bot couldn't reach: don't keep walking at them
const ACTIVITIES = {
  async wander() { await walkFor(between(8000, 25000), { sprint: rnd() < 0.4 }); },
  async travel() { const p = await landPoint(50, 1300); say(`travel to ${p.x.toFixed(0)}, ${p.z.toFixed(0)}`); await teleport(p.x, p.z); await walkFor(between(6000, 15000)); },
  async site() {
    const s = await ev(`const all = [...g.map.sites(), g.SITES.peak].filter(Boolean); const s = all[Math.floor(Math.random() * all.length)]; return { x: s.x, z: s.z, kind: s.kind };`);
    say(`visit the ${s.kind}`); const a = rnd() * 6.28; await teleport(s.x + Math.cos(a) * 35, s.z + Math.sin(a) * 35); await walkFor(20000, { target: { ...s, r: 6 } }); await walkFor(between(4000, 10000));
  },
  async gather() {
    for (let k = 0; k < 4; k++) {
      const v = await ev(`const skip = new Set(${JSON.stringify([...skip])}); const v = g.pickups.visible.filter((v) => v.kind !== 'drop' && !skip.has(v.id)).sort((a, b) => Math.hypot(a.x - P.pos.x, a.z - P.pos.z) - Math.hypot(b.x - P.pos.x, b.z - P.pos.z))[0]; return v && Math.hypot(v.x - P.pos.x, v.z - P.pos.z) < 40 ? { x: v.x, z: v.z, kind: v.kind, id: v.id } : null;`);
      if (!v) { await walkFor(5000); continue; }
      if (!(await walkFor(15000, { target: { ...v, r: 1.2 } }))) { skip.add(v.id); continue; }
      const d = await ev(`return Math.hypot(${v.x} - P.pos.x, ${v.z} - P.pos.z);`); if (d > 1.6) { skip.add(v.id); continue; }
      await ev(`P.yaw = Math.atan2(${v.x} - P.pos.x, ${v.z} - P.pos.z); return true;`); const n0 = await ev('return inv.slots.reduce((a, s) => a + (s?.n || 0), 0);');
      await page.keyboard.press('KeyE'); await wait(400);
      // (E takes whatever lies nearest in front, which may be another stone than the one aimed at: judge by the pack)
      const got = (await ev('return inv.slots.reduce((a, s) => a + (s?.n || 0), 0);')) > n0;
      if (!got) { skip.add(v.id); await ev(`window.__mon.note('pickup', 'pressed E facing a ${v.kind} ' + ${d.toFixed(2)} + ' m away and it stayed'); return true;`); }
    }
  },
  async fight() {
    const type = pick(['rabbit', 'fox', 'deer', 'hog', 'hog', 'dryadling', 'dryad', 'skeleton']);
    say(`fight a ${type}`);
    await ev(`AG.S.peaceful = false; const i = inv.slots.findIndex((s) => s?.id === 'crudeSpear' || s?.id === 'crudeAxe'); if (i >= 0 && !inv.slots[i].worn) g.equip(i); window._foe = g.creatures.spawn('${type}', P.pos.x - Math.sin(P.camYaw) * 6, P.pos.z - Math.cos(P.camYaw) * 6); return true;`);
    const end = Date.now() + between(10000, 25000);
    while (Date.now() < end) {
      const f = await ev(`const c = window._foe; return c && g.creatures.list.includes(c) && !c.dead ? { x: c.pos.x, z: c.pos.z, d: c.pos.distanceTo(P.pos) } : null;`);
      if (!f) break;
      await face(f.x, f.z); await ev('P.yaw = P.camYaw + Math.PI; return true;');
      if (f.d > 2.2) { await hold('KeyW', true); await wait(300); await hold('KeyW', false); }
      else if (rnd() < 0.2) { await page.mouse.down({ button: 'right' }); await wait(400); await page.mouse.up({ button: 'right' }); }
      else { await page.mouse.click(640, 360); await wait(between(250, 600)); }
    }
    await release();
  },
  async build() {
    say('build');
    await ev(`AG.S.freeBuild = true; const x0 = P.pos.x + 5, z0 = P.pos.z + 5, y0 = Math.max(...[[-3, -3], [3, -3], [-3, 3], [3, 3], [0, 0]].map(([a, c]) => AG.heightAt(x0 + a, z0 + c))) + 0.05;
      const put = (id, x, y, z, r = 0) => { const pos = new V(x0 + x, y0 + y, z0 + z); if (!B.invalid(B.piece(id), pos, r, true, {})) B.place(id, pos, r); };
      const parts = [() => { for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z); }, () => { put('wall', -1.5, 0, -3); put('wall', 1.5, 0, -3); }, () => { put('wall', -3, 0, -1.5, Math.PI / 2); put('wall', -3, 0, 1.5, Math.PI / 2); }, () => { put('wall', 3, 0, -1.5, Math.PI / 2); put('doorframe', 3, 0, 1.5, Math.PI / 2); },
        () => { put('roof63', -1.5, 3, -3, Math.PI); put('roof63', 1.5, 3, -3, Math.PI); put('roof63', -1.5, 3, 3, 0); put('roof63', 1.5, 3, 3, 0); }, () => { put('end63', -3, 3, 0, Math.PI / 2); put('end63', 3, 3, 0, Math.PI / 2); }, () => put('campfire', 0, 0, 0), () => put('workbench', 1.6, 0, -2.2), () => put('chest', -2, 0, 2)];
      for (const f of parts) if (Math.random() < 0.8) f();
      // and a few pieces wherever, valid or not: placement has to refuse the bad ones
      const ids = B.pieces.filter((p) => p.id !== 'repair').map((p) => p.id); for (let k = 0; k < 6; k++) { const id = ids[Math.floor(Math.random() * ids.length)], pos = new V(x0 + Math.random() * 16 - 8, y0 + Math.random() * 4 - 1, z0 + Math.random() * 16 - 8); if (!B.invalid(B.piece(id), pos, Math.random() * 6.28, true, {})) B.place(id, pos, Math.random() * 6.28); }
      window._built = B.placed.length; return true;`);
    await walkFor(6000);
    if (rnd() < 0.5) await ev(`for (const p of B.placed.filter(() => Math.random() < 0.3)) B.remove(p, true); B.recompute(); return true;`);
    await ev('AG.S.freeBuild = false; return true;');
  },
  async craft() {
    await ev(`for (const m of ['wood', 'stone', 'rope', 'leather', 'feather', 'resin', 'fiber']) g.give(m, 10); C.discover(true); const ok = C.list().filter((r) => r.kind === 'item' && C.known.has(r.key) && !C.blocker(r)); for (let k = 0; k < 3 && ok.length; k++) C.make(ok[Math.floor(Math.random() * ok.length)].key); return true;`);
    await page.keyboard.press('KeyC'); await wait(800); await page.keyboard.press('Escape'); await wait(400);
  },
  async menus() {
    const check = async (what) => { const s = await ev('return { ui: (await import("/src/input.js")).input.uiOpen, hud: g.hud.open, map: g.map.open, bm: g.buildMenu.open, paused: g.paused };'); if (s.ui || s.hud || s.map || s.bm || s.paused) await ev(`window.__mon.note('ui', ${JSON.stringify(what)} + ' left something open: ' + ${JSON.stringify(JSON.stringify(s))}); g.hud.open && g.hud.toggle(false); g.map.open && g.map.toggle(false); g.buildMenu.open && g.buildMenu.toggle(false); g.paused && g.pause(false); (await import('/src/input.js')).input.uiOpen = false; return true;`); };
    await page.keyboard.press('Tab'); await wait(700); await page.keyboard.press('Tab'); await wait(400); await check('Tab twice (inventory)');
    await page.keyboard.press('KeyM'); await wait(700); await page.keyboard.press('KeyM'); await wait(400); await check('M twice (map)');
    await ev('window.__mon.allowPause = true; return true;'); await page.keyboard.press('KeyP'); await wait(600); await page.keyboard.press('KeyP'); await wait(400); await ev('window.__mon.allowPause = false; return true;'); await check('P twice (pause)');
    await ev(`const i = inv.slots.findIndex((s) => s?.id === 'hammer'); if (i >= 0) g.useSlot(i); return true;`); await wait(300);
    await ev('window.__mon.allowPause = true; return true;');   // (a second Escape, with the menu already shut, pauses: that's the game working)
    await page.mouse.click(640, 360, { button: 'right' }); await wait(700); await page.keyboard.press('Escape'); await wait(400); await page.keyboard.press('Escape'); await wait(300);
    await ev(`const i = inv.slots.findIndex((s) => s?.id === 'crudeSpear'); if (i >= 0) g.equip(i); B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; return true;`); await ev('window.__mon.allowPause = false; return true;'); await check('the hammer menu');
  },
  async timewarp() {
    const w = pick(['clear', 'cloudy', 'lightRain', 'heavyRain', 'thunder', 'fog', null]);
    say(`time ×60${w ? ', weather ' + w : ''}`); await ev(`AG.S.timeScale = 60; ${w ? `AG.setWeather('${w}');` : 'AG.setWeather(null);'} return true;`);
    await walkFor(between(10000, 20000)); await ev('AG.S.timeScale = 1; AG.setWeather(null); return true;');
  },
  async swim() {
    const p = await ev(`for (let k = 0; k < 400; k++) { const a = Math.random() * 6.283; for (let r = 700; r < 1500; r += 10) { const x = r * Math.cos(a), z = r * Math.sin(a); if (AG.heightAt(x, z) < -2.5) return { x, z }; } } return null;`);
    if (!p) return; say('swim'); await teleport(p.x, p.z); await walkFor(between(6000, 12000));
    // (a jump lifts you out of the water for a moment: only a hero who stays out of it in deep water is a problem)
    let out = 0; for (let k = 0; k < 3; k++) { if (await ev('return !P.swimming && !P.dead && AG.heightAt(P.pos.x, P.pos.z) < -2;')) out++; await wait(500); }
    if (out === 3) await ev(`window.__mon.note('swim', 'in deep water but not swimming (y ' + P.pos.y.toFixed(2) + ', sea floor ' + AG.heightAt(P.pos.x, P.pos.z).toFixed(1) + ')'); return true;`);
  },
  async fly() {
    say('fly'); await ev('g.setFly(true); return true;'); await hold('KeyW', true); await hold('Space', true); await wait(1500); await hold('Space', false); await wait(between(2000, 5000)); await release();
    await ev('g.setFly(false); return true;'); await wait(1500);
    const p = await ev(`return { y: P.pos.y, g: P.groundHere(P.pos.x, P.pos.z, P.pos.y), swim: P.swimming };`);
    if (!p.swim && Math.abs(p.y - p.g) > 1.5) await ev(`window.__mon.note('landing', 'landed ${(p.y - p.g).toFixed(1)} m off the ground'); return true;`);
  },
  async die() {
    say('die'); await ev('P.stats.damage(9999); return true;'); await wait(9000);
    if (await ev('return P.dead;')) { const shot = await shoot('not-revived'); incidents.push({ kind: 'respawn', detail: 'still dead 9 s after dying', t: secs(), shot }); await wait(5000); }
  },
  async boss() {
    const which = pick(['minotaur', 'chimera']); say(`call the ${which}`);
    const ok = await ev(`AG.S.peaceful = false; g.give(${which === 'minotaur' ? "'deerHide', 5); g.give('olive', 10" : "'dryadHeart', 3); g.give('pomegranate', 10"}); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === '${which}'); if (!u || g.trial.boss) return false; P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); P.stats.health = P.stats.maxHealth; return true;`);
    if (!ok) return;
    await wait(3500); const end = Date.now() + between(15000, 30000);
    while (Date.now() < end) {
      const b = await ev(`const c = g.trial.boss; return c ? { x: c.pos.x, z: c.pos.z, d: c.pos.distanceTo(P.pos) } : null;`); if (!b) break;
      await face(b.x, b.z); await ev('P.yaw = P.camYaw + Math.PI; if (P.stats.health < 40) P.stats.health = P.stats.maxHealth; return true;');
      if (b.d > 3) { await hold('KeyW', true); await wait(400); await hold('KeyW', false); } else { await page.mouse.click(640, 360); await wait(300); }
      if (rnd() < 0.15) { await hold('KeyA', true); await page.keyboard.press('Space'); await wait(300); await hold('KeyA', false); }
    }
    await release();
    await ev(`if (g.trial.boss) g.creatures.hurt(g.trial.boss, [[99999, 'force']], P); return true;`); await wait(3000);
    const left = await ev('for (const c of [...g.creatures.list]) g.creatures.remove(c); AG.S.peaceful = false; return !!g.trial.boss;');
    if (left) { const shot = await shoot('boss-stays'); incidents.push({ kind: 'boss', detail: `the ${which} is still the boss after it fell`, t: secs(), shot }); }
  },
  async saveReload() {
    say('save and reload');
    const snap = `return { inv: JSON.stringify(inv.toJSON()), trial: JSON.stringify(g.trial.st), build: g.build.toJSON().length, bed: JSON.stringify(AG.S.bed), day: AG.S.day, at: [Math.round(P.pos.x), Math.round(P.pos.z)] };`;
    const before = await ev(`const { save } = await import('/src/game/save.js'); if (P.dead || !save(g)) return null; ${snap}`);
    if (!before) { say('(no save: ' + (await ev('return P.dead ? "the hero is dead" : "save() failed";')) + ')'); return; }
    await collect(); carry(await ev('return { samples: window.__mon.samples, hitches: window.__mon.hitches };')); seenInc = 0; life++;
    await page.reload(); await page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    const after = await ev(snap);
    await setup();
    const diff = Object.keys(before).filter((k) => k !== 'at' && before[k] !== after[k]);
    if (Math.hypot(before.at[0] - after.at[0], before.at[1] - after.at[1]) > 3) diff.push('position');
    if (diff.length) { const shot = await shoot('save-mismatch'); incidents.push({ kind: 'save', detail: 'after reloading, different: ' + diff.map((k) => `${k} (${String(before[k]).slice(0, 80)} → ${String(after[k]).slice(0, 80)})`).join('; '), t: secs(), shot }); }
  },
};
// how often each comes up
const WEIGHTS = { wander: 14, travel: 10, site: 10, gather: 10, fight: 10, build: 7, craft: 5, menus: 5, timewarp: 7, swim: 4, fly: 4, die: 2, boss: 3, saveReload: 3 };
const bag = Object.entries(WEIGHTS).flatMap(([k, n]) => Array(n).fill(k));

// what the page noted, carried over page reloads; its incidents photographed as they're collected
const carried = { samples: [], hitches: [] }, pageInc = [];
let life = 0;   // page loads: memory is followed within each, since a reload starts it afresh
let seenInc = 0;
async function collect() {
  const inc = await ev('return window.__mon.incidents;');
  for (const x of inc.slice(seenInc)) { x.shot = await shoot(x.kind.replace(/\W+/g, '-')); pageInc.push(x); say(`incident: ${x.kind}: ${x.detail}`); }
  seenInc = inc.length;
}
function carry(m) { for (const s of m.samples || []) s.life = life; for (const k of Object.keys(carried)) carried[k].push(...(m[k] || [])); }

const counts = {};
say(`playtest: ${MINUTES} min, seed ${SEED}`);
while (Date.now() - t0 < MINUTES * 60000) {
  const name = bag[Math.floor(rnd() * bag.length)]; counts[name] = (counts[name] || 0) + 1;
  try { await act(name); await ACTIVITIES[name](); }
  catch (e) { await release().catch(() => {}); botErrors.push({ act: name, t: secs(), error: e.message.split('\n')[0] }); say(`(bot trouble in ${name}: ${e.message.split('\n')[0]})`); await wait(1000); }
  // photograph whatever the page noted since last time
  try { await collect(); } catch { /* page reloading */ }
}
await release();
await collect(); carry(await ev('return { samples: window.__mon.samples, hitches: window.__mon.hitches };'));
await browser.close(); server.close();

// ---- the report
const all = [...incidents, ...pageInc].sort((a, b) => a.t - b.t);
const errs = new Map(); for (const e of errors) errs.set(e, (errs.get(e) || 0) + 1);
const S = carried.samples, H = carried.hitches, byAct = {};
for (const s of S) { const a = (byAct[s.act] ||= { n: 0, fps: 0, min: 999 }); a.n++; a.fps += s.fps; a.min = Math.min(a.min, s.fps); }
// memory over the longest stretch without a reload (a reload starts it afresh)
const lives = {}; for (const s of S) (lives[s.life] ||= []).push(s);
const longest = Object.values(lives).sort((a, b) => b.length - a.length)[0] || [];
const heap = longest.filter((s) => s.heap), objs = longest.filter((s) => s.objects);
const slope = (arr, k) => { if (arr.length < 3) return 0; const n = arr.length, mx = arr.reduce((a, s) => a + s.t, 0) / n, my = arr.reduce((a, s) => a + s[k], 0) / n; let num = 0, den = 0; for (const s of arr) { num += (s.t - mx) * (s[k] - my); den += (s.t - mx) ** 2; } return den ? (num / den) * 60 : 0; };
const slow = S.filter((s) => s.fps < 45 && s.act !== 'saveReload'), slowSpots = new Map();
for (const s of slow) { const k = `${Math.round(s.x / 50) * 50}, ${Math.round(s.z / 50) * 50}`; slowSpots.set(k, (slowSpots.get(k) || 0) + 1); }
const severe = all.filter((x) => ['nan', 'underground', 'out of the world', 'respawn', 'save', 'boss', 'ui', 'paused'].includes(x.kind)).length + errs.size;
const result = { seed: SEED, minutes: MINUTES, ran: counts, errors: [...errs].map(([e, n]) => ({ e, n })), incidents: all, botErrors, hitches: { n: H.length, worst: H.sort((a, b) => b.ms - a.ms).slice(0, 10) }, fps: byAct,
  memory: { minutes: +((longest.at(-1)?.t - longest[0]?.t) / 60 || 0).toFixed(1), heapStart: heap[0]?.heap, heapEnd: heap.at(-1)?.heap, heapMBperMin: +slope(heap, 'heap').toFixed(2), objectsStart: objs[0]?.objects, objectsEnd: objs.at(-1)?.objects, objectsPerMin: +slope(objs, 'objects').toFixed(1), geometries: [objs[0]?.geometries, objs.at(-1)?.geometries], textures: [objs[0]?.textures, objs.at(-1)?.textures] }, slowSpots: [...slowSpots] };
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(result, null, 1));
fs.writeFileSync(path.join(OUT, 'log.txt'), log.join('\n'));
const md = `# Playtest · ${new Date().toLocaleString()}

${MINUTES} minutes, seed ${SEED} (repeat with \`npm run playtest -- --minutes ${MINUTES} --seed ${SEED}\`).
**${errs.size} distinct page errors, ${all.length} incidents (${severe} serious), ${H.length} hitches over 50 ms.**

## What it did
${Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(' · ')}

## Page errors
${errs.size ? [...errs].map(([e, n]) => `- (${n}×) \`${e.slice(0, 300)}\``).join('\n') : 'None.'}

## Incidents
${all.length ? all.map((x) => `- **${x.kind}** at ${x.t} s during *${x.act || '?'}*${x.at ? ` (${x.at.x}, ${x.at.y}, ${x.at.z})` : ''}: ${x.detail}${x.shot ? ` · [screenshot](${x.shot})` : ''}`).join('\n') : 'None.'}

## Frame rate by activity
| Activity | Samples | Average fps | Lowest |
|---|---|---|---|
${Object.entries(byAct).map(([k, a]) => `| ${k} | ${a.n} | ${(a.fps / a.n).toFixed(0)} | ${a.min} |`).join('\n')}

${slowSpots.size ? `Places under 45 fps (50 m grid, seconds spent): ${[...slowSpots].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => `(${k}) ${n} s`).join(' · ')}` : 'Never under 45 fps.'}

## Hitches (frames over 50 ms)
${H.length ? `${H.length} in all. Worst: ${result.hitches.worst.map((h) => `${h.ms} ms (${h.act}, ${h.t} s)`).join(' · ')}` : 'None.'}

## Memory
Over the longest stretch without a reload (${result.memory.minutes} min): JS heap ${result.memory.heapStart} → ${result.memory.heapEnd} MB (trend ${result.memory.heapMBperMin} MB/min) · scene objects ${result.memory.objectsStart} → ${result.memory.objectsEnd} (trend ${result.memory.objectsPerMin}/min) · GPU geometries ${result.memory.geometries.join(' → ')} · textures ${result.memory.textures.join(' → ')}

${botErrors.length ? `## The bot's own trouble\n${botErrors.map((b) => `- ${b.act} at ${b.t} s: ${b.error}`).join('\n')}` : ''}
`;
fs.writeFileSync(path.join(OUT, 'report.md'), md);
console.log(`\n${errs.size} page errors, ${all.length} incidents (${severe} serious), ${H.length} hitches · report: ${path.relative(ROOT, path.join(OUT, 'report.md'))}`);
process.exit(severe ? 1 : 0);
