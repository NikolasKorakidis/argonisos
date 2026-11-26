// Creatures and bosses: the giant Minotaur comes down out of the sky and breaks the Labyrinth open, stands on his own
// feet, and chases you anywhere across the ruin without getting stuck, using his moves on the way; the Chimera comes and
// fights at its broken shrine; a broken site stays broken through a save and a reload; animals tilt with the slope they
// stand on.
const SETUP = `localStorage.removeItem('argonisos.world.v1'); g.save = () => false; AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; return true;`;
// Each boss move forced in turn (k, its wind-up t, ready: when its effect is showing, extra: the move's own fields,
// wait: frames after that for the picture): its effect's particles born (emit.js), and a picture of it, the game held
// still. For each, the hero is set R metres in front of the beast and the free camera (main.js fly) put off to its side,
// D metres out and up, looking at the ground between them, so the blow and what follows it are in view.
const STAGE = (D) => `const c = g.trial.boss; if (!c) return 'no boss'; const f = new V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), sd = new V(f.z, 0, -f.x), R = c.T.r + 16;
  const px = c.pos.x + f.x * R, pz = c.pos.z + f.z * R; clearInterval(window._pin); P.spawn(px, pz); window._pin = setInterval(() => { P.pos.x = px; P.pos.z = pz; P.hv.set(0, 0, 0); P.stats.health = 99; }, 50);
  const Q = c.pos.clone().addScaledVector(f, R * 0.4).setY(c.pos.y + c.T.h * 0.3); window._Q = Q; ${VIEW(D)}`;
// the free camera D metres off to the side of the boss and up, looking down at it (for its death)
const FLY = (D) => `{ const c = g.trial.boss, f = new V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), sd = new V(f.z, 0, -f.x), Q = c.pos.clone().setY(c.pos.y + c.T.h * 0.3); ${VIEW(D)} }`;
// (the camera put D metres from Q (and sd, f: the boss's side and heading), at the first of a few bearings round it, off its
// side first, from which the land doesn't stand between it and Q (the Chimera's shrine is among hills))
const VIEW = (D) => `let F = null, best = -1e9; for (const a of [0, 0.6, -0.6, 1.2, -1.2, 2, -2, 3.14]) { const dir = sd.clone().multiplyScalar(Math.cos(a)).addScaledVector(f, Math.sin(a) - 0.3).normalize(), Fc = Q.clone().addScaledVector(dir, ${D}).setY(Q.y + ${D} * 0.38);
    Fc.y = Math.max(Fc.y, AG.heightAt(Fc.x, Fc.z) + 6); let clear = 1e9; for (let i = 1; i < 12; i++) { const p = Fc.clone().lerp(Q, i / 12); clear = Math.min(clear, p.y - AG.heightAt(p.x, p.z)); } if (clear > best + 0.5) { best = clear; F = Fc; } if (clear > 3) break; }
  g.setFly(true); AG.fly.pos.copy(F); AG.fly.yaw = Math.atan2(F.x - Q.x, F.z - Q.z); AG.fly.pitch = -Math.atan2(F.y - Q.y, Math.hypot(F.x - Q.x, F.z - Q.z));`;
async function fxTour(t, moves, D) {
  for (const [k, w, ready, extra = '', n = 4] of moves) {
    await t.step(`effect ${k}: particles born as the blow lands`, `const c0 = g.trial.boss; if (!c0) return 'no boss'; await until(() => !c0.move || c0.move.k === 'tired', 6000); ${STAGE(D)} const { EMIT } = await import('/src/render/emit.js'); await frames(3);
      c.move = null; c.fatigue = 0; c.rest = 0; c.hitT = 0; c.intro = 0; const b0 = EMIT.born; c.move = { k: '${k}', ph: 0, ${extra} ...g.trial.timed(c, '${k}', ${w}) };
      const ok = await until(() => { const m = c.move; return ${ready}; }, 8000); await frames(${n}); g.paused = true; await frames(2); return (ok && EMIT.born > b0) || JSON.stringify({ ok, born: EMIT.born - b0, move: c.move?.k, ph: c.move?.ph });`);
    await t.shot(`fx-${k}`, { hud: false }); await t.eval('g.paused = false; return true;');
  }
}
export default {
  name: 'Creatures and bosses',
  slow: true,
  async run(t) {
    // (a camera held over a point, for the pictures of the arena: window._over([x, y, z, at x, y, z]) or null for the game's)
    const OVER = `window._over ||= (q) => { if (!window._overUp) { const up = P.update.bind(P); window._overUp = up; P.update = function (dt) { const r = up(dt), o = window._overAt; if (o) { AG.camera.position.set(o[0], o[1], o[2]); AG.camera.lookAt(o[3], o[4], o[5]); } return r; }; } window._overAt = q; };`;
    await t.step('the Labyrinth before he comes: its maze whole, seven great boulders round it', `${OVER} const L = g.structures.lab.c; P.spawn(L.x + 30, L.z + 30); window._over([L.x, L.y + 60, L.z + 26, L.x, L.y, L.z]); await sleep(4000); return true;`);
    await t.shot('arena-before', { hud: false }); await t.eval('window._over(null); return true;');
    await t.step('summon the Minotaur in the Labyrinth', `window._s0 = g.trial.struck || 0; AG.AUDIO.ctx()?.resume?.(); AG.S.peaceful = false; g.give('deerHide', 5); g.give('olive', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'minotaur'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); window._u = u; let taken = 0; P.stats.damage = (n) => { taken += n; }; window._taken = () => taken; return true;`);
    await t.wait(3500);
    await t.step('…he is a giant, five to six times the hero\'s height, and stands on his own feet (legs posed, nothing broken)', `const c = g.trial.boss; if (!c) return 'no boss'; const b = c.body; for (let i = 0; i < 60 && !b.ik; i++) await new Promise((r) => setTimeout(r, 100)); if (!b.ik || b.ik.legs.length !== 2) return 'no foot placement on the boss';
      b.obj.updateMatrixWorld(true); const box = new AG.THREE.Box3().setFromObject(b.obj), h = box.max.y - box.min.y; if (h < 1.9 * 5 || h > 1.9 * 6.3) return 'he is ' + h.toFixed(1) + ' m tall';
      const v = new V(), ys = b.ik.legs.map((L) => L.foot.getWorldPosition(v).y - c.pos.y); if (!ys.every(Number.isFinite) || Math.min(...ys.map(Math.abs)) > c.T.h * 0.15 || Math.max(...ys.map(Math.abs)) > c.T.h * 0.35) return 'feet at ' + ys.map((y) => y.toFixed(2)) + ' m'; return true;`);
    // Patch 25 (the Greek reviewer: "Minotaur: HP ×5, and the camera perspective should not change"): 4500 health, his dead
    // called at 1500 (a third, as before), and the follow camera kept all through his coming and the fight: no drawing
    // back, no lift, no wider view (player.js BOSS_CAM, the Chimera's alone now)
    await t.step('…his health is five times what it was (4500), his dead come at 1500, and the camera stays the follow camera', `const c = g.trial.boss; if (!c) return 'no boss'; let worst = 0;
      for (let i = 0; i < 90; i++) { await frames(1); worst = Math.max(worst, P.bossK, P.bossCam ? 1 : 0, Math.abs(AG.camera.fov - 60) / 8); }
      return (c.max === 4500 && c.hp <= 4500 && c.T.helpAt === 1500 && worst < 0.01 && P.camD <= P.camDist + 0.01) || JSON.stringify({ max: c.max, helpAt: c.T.helpAt, worst, fov: AG.camera.fov, camD: P.camD, camDist: P.camDist });`);
    await t.wait(5000);
    await t.step('…his coming broke the Labyrinth: nearly all its walls are down in rubble, their colliders gone, the rubble\'s in, the way open (no more routing by the gaps), and it is kept in the trial\'s state', `const R = g.structures.ruins.labyrinth, Co = g.colliders;
      if (!R.broken || !g.trial.st.broken?.labyrinth) return 'not broken: ' + JSON.stringify({ broken: R.broken, st: g.trial.st.broken }); if (Co.groups.has('ruin:labyrinth') || !Co.groups.get('rubble:labyrinth')?.length) return 'colliders not swapped';
      if (R.falls.length || !R.fallenG.visible || !R.debrisG.visible) return 'the collapse never settled: ' + R.falls.length + ' falling';
      const L = g.structures.lab, a = new V(L.c.x + 20, 0, L.c.z), b2 = new V(L.c.x + 3, 0, L.c.z); return g.structures.navTarget(a, b2) === null || 'still routing through the gaps';`);
    // the chase: the player held at points about the arena, each in turn; how long he takes to reach each (within the
    // reach of his slam), and the longest he stood stuck while chasing (wanting to come on, no move under way, but not
    // moving). He walks at a giant's 4.5 m/s, but his moves are the fight's own pace: held somewhere new, you find him
    // mid-charge, then spent for 4-5 s and bellowing 2 s, maybe a war cry or a throw on the way (over 15 s of a point's
    // time, measured, 26 Nov), so a point may take up to 35 s; the time he was free to come (no move under way: free)
    // is what the way he finds decides, and that must stay under 15 s. (A charge set off against a brazier crashed at once
    // and spent him, over and over: that's what kept a point past 25 s. trial.js runMove)
    const chase = await t.eval(`const c = g.trial.boss, u = window._u, L = g.structures.lab, out = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (!c) return 'boss gone';
      let worst = 0, stuck = 0, last = c.pos.clone(); const iv = setInterval(() => { const d = c.pos.distanceTo(P.pos), moved = Math.hypot(c.pos.x - last.x, c.pos.z - last.z); last.copy(c.pos);
        if (c.state === 'chase' && !c.move && !(c.intro > 0) && c.fall === undefined && d > c.T.reach + c.T.r + 1 && moved < 0.05) stuck += 0.1; else stuck = 0; worst = Math.max(worst, stuck); }, 100);
      for (const [r, a] of [[19, 0.4], [12, 2.2], [17, 3.6], [6, 5.0], [20, 1.3]]) {
        const x = L.c.x + Math.cos(a) * r, z = L.c.z + Math.sin(a) * r, pin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
        const t0 = performance.now(); let got = false, free = 0, crashes = 0, was = null; while (performance.now() - t0 < 35000) { if (c.pos.distanceTo(P.pos) < c.T.reach + c.T.r + 3.5) { got = true; break; } if (!c.move && c.state === 'chase') free += 0.1;
          if (c.move?.k === 'charge' && c.move.ph === 2 && was !== c.move) { was = c.move; crashes++; } await wait(100); }
        clearInterval(pin); out.push({ r, a, s: +((performance.now() - t0) / 1000).toFixed(1), free: +free.toFixed(1), crashes, got });
      }
      clearInterval(iv); return { out, worst: +worst.toFixed(1) };`);
    if (typeof chase === 'string') t.check('the chase', false, chase);
    else {
      t.metric('the chase across the broken Labyrinth (each point: seconds to reach it)', chase);
      t.check('after the collapse he reaches you anywhere in the arena, within 35 s each time and under 15 s of it free to come', chase.out.every((q) => q.got && q.free <= 15), JSON.stringify(chase.out));
      t.check('…and is never stuck for more than 2 s', chase.worst <= 2, `${chase.worst} s stuck`);
    }
    // The arena he leaves (the user, 25 Nov: half fallen, the maze pinned him and his dead in its corridors and the fight
    // was a farce): a few lengths of wall standing alone, the gate, a couple of columns, and the boulders round it
    await t.step('…the maze is gone: a few lengths of wall stand alone, and the seven boulders are cover, each taller than you and too tall for him to stride over', `const L = g.structures.lab.c, S = g.colliders.groups.get('sites'), walls = S.filter((k) => k.wall && Math.hypot(k.x - L.x, k.z - L.z) < 23), big = S.filter((k) => k.r > 1.8 && Math.hypot(k.x - L.x, k.z - L.z) > 24 && Math.hypot(k.x - L.x, k.z - L.z) < 40);
      ${OVER} window._over([L.x, L.y + 60, L.z + 26, L.x, L.y, L.z]); await sleep(1500);
      return (walls.length < 100 && big.length === 7 && big.every((k) => k.h > 3.6 && k.r > 2)) || JSON.stringify({ walls: walls.length, boulders: big.map((k) => [+k.r.toFixed(2), +k.h.toFixed(1)]) });`);
    await t.shot('arena-after', { hud: false }); await t.eval('window._over(null); return true;');
    // Hiding behind each boulder in turn (held on the far side of it from him): he comes round it to you the short way
    // rather than pushing into it (creatures/nav.js), until he stands within reach with nothing between (or on your side
    // of it); and in all his chasing he hardly ever has to shoulder himself free (unstick, the last resort)
    const hide = await t.eval(`const c = g.trial.boss, L = g.structures.lab.c, out = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (!c) return 'boss gone'; const storm = g.trial.storm; g.trial.storm = () => {};
      const bs = g.colliders.groups.get('sites').filter((k) => k.r > 1.8 && Math.hypot(k.x - L.x, k.z - L.z) > 24 && Math.hypot(k.x - L.x, k.z - L.z) < 40);
      for (const b of bs) {
        const ax = b.x - c.pos.x, az = b.z - c.pos.z, l = Math.hypot(ax, az), x = b.x + (ax / l) * (b.r + 1), z = b.z + (az / l) * (b.r + 1), d0 = Math.hypot(c.pos.x - x, c.pos.z - z);
        const pin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
        const t0 = performance.now(); let got = false; while (performance.now() - t0 < 35000) { const d = c.pos.distanceTo(P.pos), side = (c.pos.x - b.x) * (x - b.x) + (c.pos.z - b.z) * (z - b.z) > 0; if (d < c.T.reach + c.T.r + 1 && (side || g.trial.clearLine(c, d))) { got = true; break; } await wait(100); }
        clearInterval(pin); out.push({ at: [+(b.x - L.x).toFixed(0), +(b.z - L.z).toFixed(0)], d0: +d0.toFixed(0), s: +((performance.now() - t0) / 1000).toFixed(1), got });
      }
      g.trial.storm = storm; const N = g.creatures.nav.stats; return { out, unsticks: g.creatures.unsticks, nav: { flows: N.flows, flowMs: +(N.flowMs / N.flows).toFixed(2), flowMax: +N.flowMax.toFixed(1), builds: N.builds, buildMs: +(N.buildMs / N.builds).toFixed(2), buildMax: +N.buildMax.toFixed(1), wayMs: +(N.wayMs / N.ways).toFixed(3) } };`);
    if (typeof hide === 'string') t.check('hiding behind the boulders', false, hide);
    else {
      t.metric('hiding behind each boulder (seconds till he reaches you round it)', hide.out); t.metric('the ways (creatures/nav.js: flows, builds and ways, ms each)', hide.nav);
      t.check('hiding behind any boulder, he comes round it and reaches you within 35 s', hide.out.every((q) => q.got), JSON.stringify(hide.out));
      t.check('…and in all his chasing he had to shoulder himself free (unstick) at most twice', hide.unsticks <= 2, `${hide.unsticks} times`);
      t.check('…and the ways cost little: a flow under 4 ms on average, a grid under 6', hide.nav.flowMs < 4 && hide.nav.buildMs < 6, JSON.stringify(hide.nav));
    }
    // His dead, risen in what is left of the maze (behind its standing walls, by the altar), find their way out of it and
    // round the boulder you're behind to you (him held still meanwhile, his help and the storm's bolts kept off)
    const dead = await t.eval(`const c = g.trial.boss, L = g.structures.lab.c, wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (!c) return 'boss gone'; const storm = g.trial.storm, think = g.trial.bossThink, help = g.trial.helperT; g.trial.storm = () => {}; g.trial.helperT = 999;
      g.trial.bossThink = (b) => { b.ctl = { want: 0 }; return null; }; c.pos.set(L.x + 25, c.pos.y, L.z + 12);
      const b = g.colliders.groups.get('sites').filter((k) => k.r > 1.8 && Math.hypot(k.x - L.x, k.z - L.z) > 24 && Math.hypot(k.x - L.x, k.z - L.z) < 40).sort((p, q) => Math.hypot(q.x - c.pos.x, q.z - c.pos.z) - Math.hypot(p.x - c.pos.x, p.z - c.pos.z))[0];
      const ax = b.x - L.x, az = b.z - L.z, l = Math.hypot(ax, az), x = b.x + (ax / l) * (b.r + 1), z = b.z + (az / l) * (b.r + 1), u0 = g.creatures.unsticks;
      const pin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
      const sks = [[13, 3.81], [19.5, 4.24], [11, 1.0], [20.5, 1.41], [5, 3.0]].map(([r, a]) => { const k = g.creatures.spawn('skeleton', L.x + Math.cos(a) * r, L.z + Math.sin(a) * r, { summoned: true, aware: true, level: 0 }); k.state = 'chase'; return k; });
      const t0 = performance.now(), at = sks.map(() => null); while (performance.now() - t0 < 45000 && at.some((q) => q === null)) { sks.forEach((k, i) => { const d = k.pos.distanceTo(P.pos); if (at[i] === null && !k.dead && d < 8.5 && !g.creatures.walled(k, P.pos, d)) at[i] = +((performance.now() - t0) / 1000).toFixed(1); }); await wait(100); }
      clearInterval(pin); const where = sks.map((k) => [+(k.pos.x - L.x).toFixed(1), +(k.pos.z - L.z).toFixed(1)]); for (const k of sks) if (!k.dead) g.creatures.remove(k); g.trial.bossThink = think; g.trial.storm = storm; g.trial.helperT = help;
      return { at, where, unsticks: g.creatures.unsticks - u0 };`);
    if (typeof dead === 'string') t.check('his dead in the old maze', false, dead);
    else { t.metric('his dead, risen in the old maze (seconds till each reaches you)', dead.at); t.check('his dead, risen in what is left of the maze, find their way out and round the boulder to you within 45 s', dead.at.every((s) => s !== null), JSON.stringify(dead)); }
    // and a picture of him coming round a boulder after you, from above
    await t.step('he comes round a boulder after you (a picture from above)', `const c = g.trial.boss, L = g.structures.lab.c; if (!c) return 'boss gone'; const b = g.colliders.groups.get('sites').filter((k) => k.r > 1.8 && Math.hypot(k.x - L.x, k.z - L.z) > 24 && Math.hypot(k.x - L.x, k.z - L.z) < 40).sort((p, q) => Math.hypot(p.x - c.pos.x, p.z - c.pos.z) - Math.hypot(q.x - c.pos.x, q.z - c.pos.z))[0];
      const ax = b.x - c.pos.x, az = b.z - c.pos.z, l = Math.hypot(ax, az), x = b.x + (ax / l) * (b.r + 1), z = b.z + (az / l) * (b.r + 1); window._hidePin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
      ${OVER} await sleep(2500); window._over([b.x - 6, b.y + 26, b.z + 12, b.x, b.y, b.z]); await frames(3); return true;`);
    await t.shot('boulder-chase', { hud: false }); await t.eval('clearInterval(window._hidePin); window._over(null); return true;');
    await t.step('…and used his moves on the way (charge, throw, slam, roar)', `return window._taken() > 0 || 'no damage taken';`);
    // Zeus's storm over the fight: bolts falling about the arena (trial.js counts them) all through it, and the boss's
    // heavy track loud over the storm's rain and thunder (sound.js meters: the music's bus above the ambience's)
    const storm = await t.eval(`const A = AG.AUDIO, S = {}; for (let i = 0; i < 40; i++) { const m = A.meters(); if (m) for (const k of ['music', 'amb', 'sfx']) { S[k] = (S[k] || 0) + 10 ** (m[k].lufs / 10); } await new Promise((r) => setTimeout(r, 100)); }
      const lu = (k) => +(10 * Math.log10((S[k] || 0) / 40 + 1e-12)).toFixed(1); return { strikes: (g.trial.struck || 0) - window._s0, weather: AG.WEATHER.type, music: lu('music'), amb: lu('amb'), sfx: lu('sfx'), track: AG.MUSIC.playing.find((p) => !p.out)?.key || null };`);
    t.metric('the fight\'s storm and mix (strikes since the summons, weather, LUFS)', storm);
    t.check('a thunderstorm over the fight: bolts falling about the arena', storm.weather === 'thunder' && storm.strikes >= 5, JSON.stringify(storm));
    t.check('…and the boss\'s track plays loud over it (the music above the ambience)', storm.track === 'bossMinotaur' && storm.music > storm.amb, JSON.stringify(storm));
    // the owl keeps quiet through a boss fight (the reviewer, 24 Nov): what she has to say waits; she neither comes nor
    // talks, and her one-time hints wait for the next time they're earned
    await t.step('the owl keeps quiet through the fight: she has news, but doesn\'t come, can\'t be talked to, and holds her hints', `if (!g.trial.boss) return 'no boss'; g.owl.st.queue.push('cave'); const hinted = (g.owl.st.hints || []).includes('parry'); g.owl.hint('parry');
      await frames(60); const r = { fighting: g.trial.fighting, news: g.owl.hasNews, state: g.owl.state, talk: !!g.owl.interactable(g.owl.pos.clone().setY(g.owl.pos.y - 1.5)), hint: !hinted && (g.owl.st.hints || []).includes('parry') };
      return (r.fighting && r.news && r.state !== 'escort' && !r.talk && !r.hint) || JSON.stringify(r);`);
    // Running from the fight no longer ends it (the reviewer, 24 Nov): out of the arena's reach (105 m from its middle)
    // the fight waits, he walks back to it and heals 5% of his health a second (counted in the game's own time), no help
    // rises and his track goes quiet; back within it, he comes for you again
    await t.step('leaving the arena: the fight goes on, he goes back to it and heals 5% a second, no help rises, his music goes quiet, the owl still holds her tongue', `const c = g.trial.boss; if (!c) return 'no boss'; const a = c.arena, up = g.trial.update, storm = g.trial.storm; let T = 0;
      g.trial.update = function (dt) { T += dt; return up.call(this, dt); }; g.trial.storm = () => {};   // (no bolt to strike him while it's measured)
      c.hp = c.max * 0.6; const x = a.x + 125, z = a.z; P.spawn(x, z); const pin = setInterval(() => { P.pos.x = x; P.pos.z = z; P.hv.set(0, 0, 0); P.stats.health = 99; }, 50);
      const went = await until(() => g.trial.away, 4000), h0 = c.hp, T0 = T, w0 = g.trial.waves, d0 = Math.hypot(c.pos.x - a.x, c.pos.z - a.z); await sleep(3500);
      const r = { went, boss: g.trial.boss === c, fight: g.trial.st.fight, rate: +((c.hp - h0) / c.max / Math.max(1e-3, T - T0)).toFixed(4), secs: +(T - T0).toFixed(2), waves: g.trial.waves - w0, d0: +d0.toFixed(1), d1: +Math.hypot(c.pos.x - a.x, c.pos.z - a.z).toFixed(1),
        bar: g.trial.bar.querySelector('.bn').textContent, shown: !g.trial.bar.classList.contains('hidden'), track: AG.MUSIC.playing.find((p) => !p.out)?.key || null, fighting: g.trial.fighting };
      g.trial.update = up; await until(() => Math.hypot(c.pos.x - a.x, c.pos.z - a.z) < 12, 15000); r.home = +Math.hypot(c.pos.x - a.x, c.pos.z - a.z).toFixed(1); r.full = c.hp === c.max;   // (and he walks back towards his arena's middle, or stays if he's there: the altar and what walls still stand may hold him off it)
      clearInterval(pin); g.trial.storm = storm; window._away = r;
      return (r.went && r.boss && r.fight === 'minotaur' && Math.abs(r.rate - 0.05) < 0.004 && r.secs > 1 && !r.waves && r.home <= Math.min(r.d0, 20) + 1 && /regaining/.test(r.bar) && r.shown && r.track !== 'bossMinotaur' && r.fighting) || JSON.stringify(r);`);
    await t.step('…and coming back in, the fight simply goes on: he comes for you again', `const c = g.trial.boss; if (!c) return 'no boss'; const a = c.arena; P.spawn(a.x + 16, a.z);
      const back = await until(() => !g.trial.away && c.state === 'chase', 8000); return (back && g.trial.boss === c && g.trial.bar.querySelector('.bn').textContent === c.T.name && g.trial.fighting) || JSON.stringify({ back, away: g.trial.away, state: c.state, bar: g.trial.bar.querySelector('.bn').textContent });`);
    // his aura: dark dust round his hooves, embers rising round him (render/bossfx.js), seen from 18 m off
    const aim = (who, r) => `const c = ${who}; if (!c) return 'none'; const a = 0.7, x = c.pos.x + Math.sin(a) * ${r}, z = c.pos.z + Math.cos(a) * ${r}; P.spawn(x, z); window._pin = setInterval(() => { P.pos.x = x; P.pos.z = z; P.hv.set(0, 0, 0); P.stats.health = 99; }, 50);
      P.camYaw = Math.atan2(x - c.pos.x, z - c.pos.z); P.camPitch = -0.12; await frames(40); const { BOSSFX } = await import('/src/render/bossfx.js'); return BOSSFX.aura === c.type || 'aura on ' + BOSSFX.aura;`;
    await t.step('his aura is on him (dust and embers)', aim('g.trial.boss', 18));
    await t.shot('minotaur');
    // every move has its effect, timed to the blow (the user, 25 Nov: "every attack gets a special effect that follows
    // it"): each forced in turn, the effect's particles born as the blow lands, and a picture of it
    await fxTour(t, [['roar', 1.3, 'm?.done'], ['slam', 0.95, 'm?.hit0'], ['sweep', 1, 'm?.arc && m.e >= m.hit'], ['throw', 0.65, 'm?.hit0', '', 14], ['charge', 1.3, 'm?.ph === 1 && m.run > 0.7', 'dir: c.yaw,']], 30);
    await t.step('Zeus\'s bolt: the ground blasted and scorched, embers and smoke, a jolt near you', `const { EMIT } = await import('/src/render/emit.js'), { shake } = await import('/src/render/fx.js'); const b0 = EMIT.born, n0 = shake.n, A = AG.AUDIO; A.calls = [];
      g.trial.bolt(window._Q.clone().lerp(P.pos, 0.5), { warn: 0 }); const ok = await until(() => !g.trial.bolts.length, 3000); await frames(3); g.paused = true; await frames(2);
      return (ok && EMIT.born - b0 > 100 && shake.n > n0 && (A.calls || []).some((q) => q.k === 'boltHit')) || JSON.stringify({ ok, born: EMIT.born - b0, punches: shake.n - n0 });`);
    await t.shot('fx-bolt', { hud: false }); await t.eval('g.paused = false; await new Promise((r) => setTimeout(r, 1800)); g.paused = true; await frames(2); return true;'); await t.shot('fx-bolt-after', { hud: false });
    await t.eval('g.paused = false; g.setFly(false); return true;');
    // his end (the reviewer, 24 Nov): the killing blow shakes the view; once he has lain a moment Zeus's bolt strikes him,
    // a great boom and thunder, the view shaken hard, and his body breaks into embers and ash that blow away; what he
    // leaves drops where he lay
    await t.step('the Minotaur falls: a jolt; then Zeus\'s bolt, a boom and thunder, a hard shake, and his body blows away in embers', `const c = g.trial.boss; if (!c) return 'no boss'; AG.AUDIO.calls = []; const { shake } = await import('/src/render/fx.js'), { LIGHTNING } = await import('/src/world/lightning.js'), { BOSSFX } = await import('/src/render/bossfx.js');
      const n0 = shake.n, s0 = LIGHTNING.strikes, d0 = BOSSFX.dissolves; let most = 0; const iv = setInterval(() => { most = Math.max(most, shake.k); }, 30);
      ${FLY(36)}   // (the free camera off to his side, looking down over the walls at where he'll lie)
      g.creatures.hurt(c, [[99999, 'force']], P); const jolt = shake.n - n0; const went = await until(() => BOSSFX.dissolves > d0, 9000); await frames(20); window._end = { c, jolt, n0, s0, d0, iv, most: () => most }; return !!went || 'no dissolve';`);
    await t.shot('minotaur-death', { hud: false });
    // (the dissolve goes on some eight seconds, glowing through six and fading out to nine: the user, 25 Nov)
    // (each picture taken at its moment in the game's time, the game held still for it: a picture takes a while to grab)
    for (const k of [2, 4, 6, 8]) { await t.eval(`const { BOSSFX } = await import('/src/render/bossfx.js'); await until(() => BOSSFX.t >= ${k}, 15000); g.paused = true; await frames(2); return true;`); await t.shot(`minotaur-death-${k}s`, { hud: false }); await t.eval('g.paused = false; return true;'); }
    await t.step('…the body still blowing away eight seconds on (the owl still waiting), its ashes gone by about eleven', `const { dissolving } = await import('/src/render/bossfx.js'); const on = dissolving(), owl = g.owl.state !== 'escort'; const gone = await until(() => !dissolving(), 6000); return (on && owl && gone) || JSON.stringify({ on, owl, gone });`);
    await t.step('…(the bolt struck, the sounds played, the shake was hard, the body went into thousands of bits and is gone)', `const E = window._end, { shake } = await import('/src/render/fx.js'), { LIGHTNING } = await import('/src/world/lightning.js'), { BOSSFX } = await import('/src/render/bossfx.js');
      await until(() => E.c.gone, 3000); clearInterval(E.iv); g.setFly(false); const calls = (AG.AUDIO.calls || []).map((q) => q.k);
      const r = { jolt: E.jolt, punches: shake.n - E.n0, most: +E.most().toFixed(2), strikes: LIGHTNING.strikes - E.s0, bits: BOSSFX.bits, gone: E.c.gone, kill: calls.includes('kill'), end: calls.includes('bossEnd') };
      return (r.jolt >= 1 && r.punches >= 2 && r.most > 0.6 && r.strikes >= 1 && r.bits > 1000 && r.gone && r.kill && r.end) || JSON.stringify(r);`);
    await t.eval(`clearInterval(window._pin); return true;`);
    await t.step('…and once his ashes have blown away the owl comes with what she held, the altar\'s counsel dropped (it no longer applies)', `const { dissolving } = await import('/src/render/bossfx.js'); await until(() => !dissolving() && !g.trial.fighting, 16000);
      const came = await until(() => g.owl.state === 'escort', 6000), q = [...g.owl.st.queue]; g.owl.st.queue = []; return (came && !q.includes('labyrinthAltar')) || JSON.stringify({ came, q, fighting: g.trial.fighting });`);
    await t.step('…(his head lies on the ground; the Labyrinth stays in ruins)', `return (g.pickups.drops.some((d) => d.item === 'minotaurHead') || g.trial.st.down.minotaur) && g.structures.ruins.labyrinth.broken || 'no head, ' + JSON.stringify(g.trial.st.down);`);
    await t.step('…and the storm breaks: no more bolts, the sky clearing', `const s0 = g.trial.struck || 0; await new Promise((r) => setTimeout(r, 6000)); const n = (g.trial.struck || 0) - s0;
      return (n === 0 && !g.trial.bolts.length && AG.WEATHER.type === 'clear' && AG.WEATHER.k.rain < 0.5) || JSON.stringify({ strikes: n, bolts: g.trial.bolts.length, weather: AG.WEATHER.type, rain: AG.WEATHER.k.rain });`);
    await t.step('summon the Chimera at its shrine', `for (const c of [...g.creatures.list]) g.creatures.remove(c); g.give('dryadHeart', 3); g.give('pomegranate', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'chimera'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); return true;`);
    await t.wait(9000);
    await t.step('…the Chimera, a giant too, fights (it has hurt the player) and its shrine is broken', `const c = g.trial.boss; if (!c || c.type !== 'chimera') return 'no chimera'; const v = new V(); for (const [k, b] of Object.entries(c.body.bones || {})) { b.getWorldPosition(v); if (!Number.isFinite(v.x + v.y + v.z)) return 'bone ' + k + ' not finite'; }
      c.body.obj.updateMatrixWorld(true); const s = new AG.THREE.Box3().setFromObject(c.body.obj).getSize(new V()); if (Math.max(s.x, s.z) < 18 || s.y < 7) return 'only ' + s.toArray().map((x) => x.toFixed(1)) + ' m';
      if (!g.structures.ruins.chimera.broken) return 'shrine not broken'; return window._taken() > 0 || 'no damage taken';`);
    await t.step('…and its fight still draws the camera back to take it in (the Chimera keeps the boss camera)', `return (P.bossCam && P.bossK > 0.3) || JSON.stringify({ bossCam: P.bossCam, bossK: P.bossK });`);
    await t.step('its aura is on it (smoke, fiery flecks, sparks at its jaws)', aim('g.trial.boss', 34));
    await t.shot('chimera');
    await fxTour(t, [['claw', 0.7, 'm?.hit0'], ['sting', 0.8, 'm?.hit0'], ['breath', 0.8, 'm?.ph === 1 && m.t < 0.9'], ['pounce', 0.75, 'm?.ph === 2']], 42);
    await t.step('effect goat-spell: the goat head calls the forest, its signs on the ground and its light streaming to where they rise', `const c = g.trial.boss; if (!c) return 'no chimera'; const { EMIT } = await import('/src/render/emit.js'); const b0 = EMIT.born; AG.AUDIO.calls = []; g.trial.help(c); await frames(25); g.paused = true; await frames(2);
      return (EMIT.born - b0 > 100 && (AG.AUDIO.calls || []).some((q) => q.k === 'goatSpell')) || JSON.stringify({ born: EMIT.born - b0 });`);
    await t.shot('fx-goat-spell', { hud: false }); await t.eval('g.paused = false; g.setFly(false); return true;');
    await t.step('the Chimera falls, and Zeus\'s bolt turns it to embers and ash on the wind', `const c = g.trial.boss; if (!c) return 'no chimera'; AG.AUDIO.calls = []; ${FLY(48)} const { BOSSFX } = await import('/src/render/bossfx.js'); const d0 = BOSSFX.dissolves;
      g.creatures.hurt(c, [[99999, 'force']], P); const went = await until(() => BOSSFX.dissolves > d0, 9000); await frames(20); return (went && (AG.AUDIO.calls || []).some((q) => q.k === 'bossEnd')) || 'no dissolve';`);
    await t.shot('chimera-death', { hud: false });
    for (const k of [2, 4, 6, 8]) { await t.eval(`const { BOSSFX } = await import('/src/render/bossfx.js'); await until(() => BOSSFX.t >= ${k}, 15000); g.paused = true; await frames(2); return true;`); await t.shot(`chimera-death-${k}s`, { hud: false }); await t.eval('g.paused = false; return true;'); }
    await t.step('…(its body gone, its head dropped, the trial on to its next step)', `const { dissolving } = await import('/src/render/bossfx.js'); await until(() => !dissolving(), 16000); clearInterval(window._pin); g.setFly(false);
      return (g.trial.st.down.chimera && !g.trial.boss && !g.creatures.list.some((k) => k.type === 'chimera') && (g.pickups.drops.some((d) => d.item === 'chimeraHead') || inv.count('chimeraHead') > 0)) || JSON.stringify({ down: g.trial.st.down, drops: g.pickups.drops.map((d) => d.item) });`);
    // creatures come and go all game long: whatever a body put on the GPU must go with it (a leak shows as ~9 geometries
    // per creature, over 200 a round; a few may still come from the land streaming in nearby)
    await t.step('spawning and removing creatures leaves nothing behind on the GPU', `AG.S.peaceful = true; g.trial.boss = null; const kinds = ['deer', 'hog', 'fox', 'rabbit', 'dryadling', 'dryad', 'skeleton', 'giant'];
      const round = async () => { const cs = kinds.flatMap((k) => [0, 1, 2].map((i) => g.creatures.spawn(k, P.pos.x + 12 + i * 3, P.pos.z + kinds.indexOf(k) * 3))); await new Promise((r) => setTimeout(r, 2500)); for (const c of cs) g.creatures.remove(c); while (AG.terrain.pending > 0) await new Promise((r) => setTimeout(r, 200)); await new Promise((r) => setTimeout(r, 300)); const m = AG.renderer.info.memory; return [m.geometries, m.textures]; };
      await round(); const a = await round(), b = await round(); return (b[0] - a[0] <= 12 && b[1] - a[1] <= 2) || 'geometries ' + a[0] + ' → ' + b[0] + ', textures ' + a[1] + ' → ' + b[1] + ' after another 24 creatures came and went';`);
    await t.step('a deer on a hillside tilts with the slope', `AG.S.peaceful = true; g.trial.boss = null; for (const c of [...g.creatures.list]) g.creatures.remove(c); let at; for (let r = 400; r < 1400 && !at; r += 5) for (let a = 0; a < 6.28; a += 0.2) { const x = r * Math.cos(a), z = r * Math.sin(a), gx = AG.heightAt(x + 1, z) - AG.heightAt(x - 1, z), gz = AG.heightAt(x, z + 1) - AG.heightAt(x, z - 1); if (Math.hypot(gx, gz) / 2 > 0.3 && AG.heightAt(x, z) > 2) { at = { x, z, yaw: Math.atan2(gx, gz) }; break; } }
      P.spawn(at.x + 45, at.z + 45); const d = g.creatures.spawn('deer', at.x, at.z, { level: 0 }); d.state = 'idle'; d.t = 99; d.yaw = at.yaw; window._d = d; return true;`);
    await t.wait(1500);
    await t.step('…(its body follows the slope it faces)', `const d = window._d, e = d.T.r * 1.3 + 0.3, rise = AG.heightAt(d.pos.x + Math.sin(d.yaw) * e, d.pos.z + Math.cos(d.yaw) * e) - AG.heightAt(d.pos.x - Math.sin(d.yaw) * e, d.pos.z - Math.cos(d.yaw) * e), exp = -Math.atan2(rise, 2 * e); return (Math.abs(d.pitch - exp) < 0.03 && Math.abs(exp) > 0.04) || 'pitch ' + d.pitch.toFixed(3) + ' expected ' + exp.toFixed(3);`);
    // last, as it reloads the page: the broken sites saved, and broken again as the save loads (and the fight retried
    // at a broken site doesn't break it twice)
    await t.step('a save keeps the broken Labyrinth and shrine', `const Sv = await import('/src/game/save.js'); for (const c of [...g.creatures.list]) g.creatures.remove(c); return Sv.save(g) && JSON.parse(localStorage.getItem('argonisos.world.v1')).S.trial.broken.labyrinth === true || 'not in the save';`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    await t.step('…and after a reload they are still in ruins (walls gone, rubble in, fallen pieces lying), and calling the Minotaur again breaks nothing twice', `const ok = ['labyrinth', 'chimera'].map((k) => { const R = g.structures.ruins[k]; return R.broken && R.fallenG.visible && R.debrisG.visible && !R.falls.length && !g.colliders.groups.has('ruin:' + k) && g.colliders.groups.has('rubble:' + k); });
      ${SETUP.replace('return true;', '')} const again = g.structures.ruin('labyrinth', { live: true });
      return (ok.every(Boolean) && g.trial.st.broken.labyrinth && again === false) || JSON.stringify({ ok, again, st: g.trial.st.broken });`);
  },
};
