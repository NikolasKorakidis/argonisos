// Steady frames where the player on Ultra (RTX 5080, 21 Nov) felt the game drop and stutter: by a fire and in the water.
// Counts, not timings, so they hold on any machine: shader programs linked while walking up to a fire, standing by it,
// turning between two fires, leaving, holding a torch, and swimming into the river and out (each link a freeze of tens of
// milliseconds on Windows); how often the fire's shadow is drawn again and from how many casters; buffers made on the
// card while playing (textures and render buffers: vertex buffers come and go as the world streams in); and two
// rounds of the same walk, the second of which must leave the programs, the card's memory and the scene where the first
// left them. On Ultra by default (PERF_GFX=high for High), at the size the perf suite uses.
const GFX = process.env.PERF_GFX || 'ultra';
const key = (type) => `dispatchEvent(new KeyboardEvent('${type}', { code: 'KeyW' }));`;
const steer = (x, z) => `P.camYaw = Math.atan2(-((${x}) - P.pos.x), -((${z}) - P.pos.z));`;
// (walk for ms with W held, running body each frame; the stamina kept up so a long swim doesn't drown the hero)
const walk = (ms, body = '') => `{ ${key('keydown')} const t0 = performance.now(); await until(() => { P.stats.stamina = P.stats.maxStamina; ${body} return performance.now() - t0 > ${ms}; }, ${ms + 5000}); ${key('keyup')} }`;
const counts = `const R = await import('/src/render/core.js'), PF = await import('/src/ui/perf.js'), L = await import('/src/render/lights.js'); let objs = 0; AG.scene.traverse(() => objs++);
  return { links: window._links, progs: AG.renderer.info.programs.length, allocs: PF.VRAM.allocs, vram: Math.round((PF.VRAM.tex + PF.VRAM.rb + PF.VRAM.buf) / 1048576), geo: AG.renderer.info.memory.geometries, objs, fire: L.FIRE_SHADOW.updates, casters: L.FIRE_SHADOW.casters, frame: window._frames, w: AG.renderer.domElement.width, h: AG.renderer.domElement.height };`;

export default {
  name: 'Steady frames (fires, water, memory)',
  slow: true,
  order: 1,
  viewport: { w: 1280, h: 720 },
  async run(t, { base }) {
    if (GFX !== 'high') {   // (the preset is read once as the game loads: open it again on Ultra, set up as the harness does)
      await t.page.goto(`${base}/?play&gfx=${GFX}`); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
      await t.eval(`localStorage.removeItem('argonisos.world.v1'); g.save = () => false; AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; return true;`);
    }
    await t.eval(`AG.S.timeScale = 0; AG.S.time = 0.8; AG.snapWeather(); for (const c of [...g.creatures.list]) g.creatures.remove(c); g.owl.update = () => {}; g.owl.o.g.visible = false; AG.S.freeBuild = true;
      const R = await import('/src/render/core.js'); R.ADAPT.on = false; if (R.ADAPT.k !== 1) { R.ADAPT.k = 1; R.setScale(); }
      window._frames = 0; const tick = () => { window._frames++; requestAnimationFrame(tick); }; requestAnimationFrame(tick);
      window._links = 0; const P0 = WebGL2RenderingContext.prototype, link = P0.linkProgram; P0.linkProgram = function (p) { window._links++; return link.call(this, p); };
      AG.teleport(40, -30, 0, -0.1); await sleep(5000); const x = P.pos.x, z = P.pos.z - 70; window._fA = B.place('campfire', new V(x, AG.heightAt(x, z), z), 0); window._fB = B.place('campfire', new V(x + 9, AG.heightAt(x + 9, z), z), 0);
      return !!(window._fA && window._fB) || 'no fires';`);
    await t.eval(`const f = window._fA.pos; AG.teleport(f.x, f.z + 34, 0, -0.1); await sleep(4000); return true;`);
    const c0 = await t.eval(counts);
    // up to the fire, by it with the camera turning, between the two, and away
    await t.eval(`${walk(8000, `const f = window._fA.pos; ${steer('f.x', 'f.z')} if (Math.hypot(f.x - P.pos.x, f.z - P.pos.z) < 2.5) return true;`)} return true;`);
    await t.eval(`for (let k = 0; k < 120; k++) { P.camYaw += 0.03; await frames(1); } return true;`);
    await t.eval(`const f = window._fA.pos; AG.teleport(f.x + 4.5, f.z + 3, 0, -0.1); await sleep(2500); for (let k = 0; k < 360; k++) { P.camYaw = Math.floor(k / 60) % 2 ? Math.PI / 2 : -Math.PI / 2; await frames(1); } return true;`);
    await t.eval(`${walk(8000, `const f = window._fA.pos; ${steer('f.x', 'f.z + 80')}`)} return true;`);
    const c1 = await t.eval(counts);
    t.metric('fires: walking up, standing by, between two, leaving', `${c1.links - c0.links} programs linked · fire shadow drawn ${c1.fire - c0.fire} times in ${c1.frame - c0.frame} frames · ${c1.allocs - c0.allocs} buffers made`);
    t.check('walking up to a fire, standing by it, turning between two and leaving links no shader program', c1.links === c0.links, `${c1.links - c0.links} linked`);
    t.check('…and the fire\'s shadow is drawn again at most every other frame', c1.fire - c0.fire <= (c1.frame - c0.frame) * 0.55 + 4, `${c1.fire - c0.fire} in ${c1.frame - c0.frame} frames`);
    // a torch in the hand by the fires: it moves, so it never takes the fire's shadow (which it drew every frame)
    await t.eval(`g.give('torch'); g.useSlot(inv.slots.findIndex((s) => s?.id === 'torch')); await sleep(1500); const f = window._fA.pos; AG.teleport(f.x + 3, f.z + 5, 0, -0.1); await sleep(2500); return true;`);
    const c2 = await t.eval(counts);
    await t.eval(`${walk(5000, 'P.camYaw += 0.01;')} return true;`);
    const c3 = await t.eval(counts);
    t.metric('a torch in hand by the fires', `fire shadow drawn ${c3.fire - c2.fire} times in ${c3.frame - c2.frame} frames, from ${c3.casters} casters · ${c3.links - c2.links} programs linked`);
    t.check('with a torch in hand the fire\'s shadow is not drawn every frame', c3.fire - c2.fire <= (c3.frame - c2.frame) * 0.55 + 4, `${c3.fire - c2.fire} in ${c3.frame - c2.frame} frames`);
    t.check('…and its six faces draw only what stands by the fire', c3.casters > 0 && c3.casters < 60, `${c3.casters} casters`);
    // into the river's deep reach, swimming, and back out
    await t.eval(`AG.S.time = 0.3; g.useSlot(inv.slots.findIndex((s) => s?.id === 'torch')); const RM = await import('/src/world/river.js'), R = RM.RIVER, D = R.deep, m = Math.round((D.i0 + D.i1) / 2);
      window._sw = { x: R.X[m] + R.TZ[m] * R.WL[m] * 1.6, z: R.Z[m] - R.TX[m] * R.WL[m] * 1.6, tx: R.X[m] - R.TZ[m] * R.WR[m] * 1.6, tz: R.Z[m] + R.TX[m] * R.WR[m] * 1.6 }; AG.teleport(window._sw.x, window._sw.z); await sleep(5000); return true;`);
    const c4 = await t.eval(counts);
    const swum = await t.eval(`let n = 0; ${walk(10000, `const w = window._sw; ${steer('w.tx', 'w.tz')} if (P.swimming) n++;`)} ${walk(10000, `const w = window._sw; ${steer('w.x', 'w.z')} if (P.swimming) n++;`)} return n;`);
    const c5 = await t.eval(counts);
    t.metric('into the river and out', `${swum} frames swimming · ${c5.links - c4.links} programs linked · ${c5.allocs - c4.allocs} buffers made`);
    t.check('swimming into the river and out again links no shader program', swum > 30 && c5.links === c4.links, `${c5.links - c4.links} linked, ${swum} frames swimming`);
    // no texture or render buffer made over and over while playing (fires and river together): a few, once, as things
    // are first seen (the sky's two kept bakes, a torch's), never one a frame or one a bake
    t.check('no texture or render buffer is made frame after frame while playing', c5.allocs - c0.allocs <= 16, `${c5.allocs - c0.allocs} made over ${c5.frame - c0.frame} frames`);
    // two rounds of the same walk: the second leaves everything where the first did
    const round = `AG.S.time = 0.3; for (let r = 150; r < 1200; r += 10) { const x = r * 0.7, z = r * 0.7; if (AG.biomeWeights(x, z).y > 0.9) { AG.teleport(x, z, 0.9, 0.05); break; } } await sleep(2500); ${walk(6000, 'P.camYaw += 0.01;')}
      AG.S.time = 0.8; const f = window._fA.pos; AG.teleport(f.x + 3, f.z + 5, 0, -0.1); await sleep(2500); ${walk(3000, 'P.camYaw += 0.03;')}
      AG.S.time = 0.3; const RM = await import('/src/world/river.js'), L = RM.RIVER.lake; AG.teleport(L.x, L.z); await sleep(2500); ${walk(4000, 'P.camYaw += 0.02;')}
      AG.teleport(40, -30, 0, -0.1); await until(() => AG.terrain.pending === 0, 30000); await sleep(5000); for (const c of [...g.creatures.list]) g.creatures.remove(c); await frames(2); return true;`;   // (each round ends at the same place, settled and with no animals about, so what is there is the same)
    await t.eval(round); const r1 = await t.eval(counts); await t.eval(round); const r2 = await t.eval(counts);
    t.metric('two rounds of woods, fire and lake', `programs ${r1.progs} → ${r2.progs} · card ${r1.vram} → ${r2.vram} MB · geometries ${r1.geo} → ${r2.geo} · objects ${r1.objs} → ${r2.objs}`);
    t.check('a second round of the same walk adds no programs, memory on the card or objects', r2.progs === r1.progs && r2.vram - r1.vram <= 8 && r2.objs - r1.objs <= 12 && r2.geo - r1.geo <= 24, JSON.stringify({ progs: r2.progs - r1.progs, vram: r2.vram - r1.vram, objs: r2.objs - r1.objs, geo: r2.geo - r1.geo }));
  },
};
