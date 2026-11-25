// Creatures and bosses: the giant Minotaur comes down out of the sky and breaks the Labyrinth open, stands on his own
// feet, and chases you anywhere across the ruin without getting stuck, using his moves on the way; the Chimera comes and
// fights at its broken shrine; a broken site stays broken through a save and a reload; animals tilt with the slope they
// stand on.
const SETUP = `localStorage.removeItem('argonisos.world.v1'); g.save = () => false; AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; return true;`;
export default {
  name: 'Creatures and bosses',
  slow: true,
  async run(t) {
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
    await t.step('…his coming broke the Labyrinth: about half its walls are down in rubble, their colliders gone, the rubble\'s in, the way open (no more routing by the gaps), and it is kept in the trial\'s state', `const R = g.structures.ruins.labyrinth, Co = g.colliders;
      if (!R.broken || !g.trial.st.broken?.labyrinth) return 'not broken: ' + JSON.stringify({ broken: R.broken, st: g.trial.st.broken }); if (Co.groups.has('ruin:labyrinth') || !Co.groups.get('rubble:labyrinth')?.length) return 'colliders not swapped';
      if (R.falls.length || !R.fallenG.visible || !R.debrisG.visible) return 'the collapse never settled: ' + R.falls.length + ' falling';
      const L = g.structures.lab, a = new V(L.c.x + 20, 0, L.c.z), b2 = new V(L.c.x + 3, 0, L.c.z); return g.structures.navTarget(a, b2) === null || 'still routing through the gaps';`);
    // the chase: the player held at points about the arena, each in turn; how long he takes to reach each (within the
    // reach of his slam: he walks at a giant's 4.5 m/s and stops for his moves and when he's spent, so up to 25 s), and the
    // longest he stood stuck while chasing (wanting to come on, no move under way, but not moving)
    const chase = await t.eval(`const c = g.trial.boss, u = window._u, L = g.structures.lab, out = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (!c) return 'boss gone';
      let worst = 0, stuck = 0, last = c.pos.clone(); const iv = setInterval(() => { const d = c.pos.distanceTo(P.pos), moved = Math.hypot(c.pos.x - last.x, c.pos.z - last.z); last.copy(c.pos);
        if (c.state === 'chase' && !c.move && !(c.intro > 0) && c.fall === undefined && d > c.T.reach + c.T.r + 1 && moved < 0.05) stuck += 0.1; else stuck = 0; worst = Math.max(worst, stuck); }, 100);
      for (const [r, a] of [[19, 0.4], [12, 2.2], [17, 3.6], [6, 5.0], [20, 1.3]]) {
        const x = L.c.x + Math.cos(a) * r, z = L.c.z + Math.sin(a) * r, pin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
        const t0 = performance.now(); let got = false; while (performance.now() - t0 < 25000) { if (c.pos.distanceTo(P.pos) < c.T.reach + c.T.r + 3.5) { got = true; break; } await wait(100); }
        clearInterval(pin); out.push({ r, a, s: +((performance.now() - t0) / 1000).toFixed(1), got });
      }
      clearInterval(iv); return { out, worst: +worst.toFixed(1) };`);
    if (typeof chase === 'string') t.check('the chase', false, chase);
    else {
      t.metric('the chase across the broken Labyrinth (each point: seconds to reach it)', chase);
      t.check('after the collapse he reaches you anywhere in the arena, within 25 s each time', chase.out.every((q) => q.got), JSON.stringify(chase.out));
      t.check('…and is never stuck for more than 2 s', chase.worst <= 2, `${chase.worst} s stuck`);
    }
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
    await t.step('leaving the arena: the fight goes on, he goes back to it and heals 5% a second, no help rises, his music goes quiet', `const c = g.trial.boss; if (!c) return 'no boss'; const a = c.arena, up = g.trial.update, storm = g.trial.storm; let T = 0;
      g.trial.update = function (dt) { T += dt; return up.call(this, dt); }; g.trial.storm = () => {};   // (no bolt to strike him while it's measured)
      c.hp = c.max * 0.6; const x = a.x + 125, z = a.z; P.spawn(x, z); const pin = setInterval(() => { P.pos.x = x; P.pos.z = z; P.hv.set(0, 0, 0); P.stats.health = 99; }, 50);
      const went = await until(() => g.trial.away, 4000), h0 = c.hp, T0 = T, w0 = g.trial.waves, d0 = Math.hypot(c.pos.x - a.x, c.pos.z - a.z); await sleep(3500);
      const r = { went, boss: g.trial.boss === c, fight: g.trial.st.fight, rate: +((c.hp - h0) / c.max / Math.max(1e-3, T - T0)).toFixed(4), secs: +(T - T0).toFixed(2), waves: g.trial.waves - w0, d0: +d0.toFixed(1), d1: +Math.hypot(c.pos.x - a.x, c.pos.z - a.z).toFixed(1),
        bar: g.trial.bar.querySelector('.bn').textContent, shown: !g.trial.bar.classList.contains('hidden'), track: AG.MUSIC.playing.find((p) => !p.out)?.key || null, fighting: g.trial.fighting };
      g.trial.update = up; await until(() => Math.hypot(c.pos.x - a.x, c.pos.z - a.z) < 12, 15000); r.home = +Math.hypot(c.pos.x - a.x, c.pos.z - a.z).toFixed(1); r.full = c.hp === c.max;   // (and he walks back towards his arena's middle, or stays if he's there: the altar and what walls still stand may hold him off it)
      clearInterval(pin); g.trial.storm = storm; window._away = r;
      return (r.went && r.boss && r.fight === 'minotaur' && Math.abs(r.rate - 0.05) < 0.004 && r.secs > 1 && !r.waves && r.home <= Math.min(r.d0, 20) + 1 && /regaining/.test(r.bar) && r.shown && r.track !== 'bossMinotaur' && !r.fighting) || JSON.stringify(r);`);
    await t.step('…and coming back in, the fight simply goes on: he comes for you again', `const c = g.trial.boss; if (!c) return 'no boss'; const a = c.arena; P.spawn(a.x + 16, a.z);
      const back = await until(() => !g.trial.away && c.state === 'chase', 8000); return (back && g.trial.boss === c && g.trial.bar.querySelector('.bn').textContent === c.T.name && g.trial.fighting) || JSON.stringify({ back, away: g.trial.away, state: c.state, bar: g.trial.bar.querySelector('.bn').textContent });`);
    // his aura: dark dust round his hooves, embers rising round him (render/bossfx.js), seen from 18 m off
    const aim = (who, r) => `const c = ${who}; if (!c) return 'none'; const a = 0.7, x = c.pos.x + Math.sin(a) * ${r}, z = c.pos.z + Math.cos(a) * ${r}; P.spawn(x, z); window._pin = setInterval(() => { P.pos.x = x; P.pos.z = z; P.hv.set(0, 0, 0); P.stats.health = 99; }, 50);
      P.camYaw = Math.atan2(x - c.pos.x, z - c.pos.z); P.camPitch = -0.12; await frames(40); const { BOSSFX } = await import('/src/render/bossfx.js'); return BOSSFX.aura === c.type || 'aura on ' + BOSSFX.aura;`;
    await t.step('his aura is on him (dust and embers)', aim('g.trial.boss', 18));
    await t.shot('minotaur');
    // his end (the reviewer, 24 Nov): the killing blow shakes the view; once he has lain a moment Zeus's bolt strikes him,
    // a great boom and thunder, the view shaken hard, and his body breaks into embers and ash that blow away; what he
    // leaves drops where he lay
    await t.step('the Minotaur falls: a jolt; then Zeus\'s bolt, a boom and thunder, a hard shake, and his body blows away in embers', `const c = g.trial.boss; if (!c) return 'no boss'; AG.AUDIO.calls = []; const { shake } = await import('/src/render/fx.js'), { LIGHTNING } = await import('/src/world/lightning.js'), { BOSSFX } = await import('/src/render/bossfx.js');
      const n0 = shake.n, s0 = LIGHTNING.strikes, d0 = BOSSFX.dissolves; let most = 0; const iv = setInterval(() => { most = Math.max(most, shake.k); }, 30);
      window._cam = P.camDist; P.camDist = 13; P.camPitch = -0.42; P.camYaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);   // (looking down over the walls at where he'll lie)
      g.creatures.hurt(c, [[99999, 'force']], P); const jolt = shake.n - n0; const went = await until(() => BOSSFX.dissolves > d0, 9000); await frames(20); window._end = { c, jolt, n0, s0, d0, iv, most: () => most }; return !!went || 'no dissolve';`);
    await t.shot('minotaur-death');
    await t.step('…(the bolt struck, the sounds played, the shake was hard, the body went into thousands of bits and is gone)', `const E = window._end, { shake } = await import('/src/render/fx.js'), { LIGHTNING } = await import('/src/world/lightning.js'), { BOSSFX } = await import('/src/render/bossfx.js');
      await until(() => E.c.gone, 3000); clearInterval(E.iv); P.camDist = window._cam; const calls = (AG.AUDIO.calls || []).map((q) => q.k);
      const r = { jolt: E.jolt, punches: shake.n - E.n0, most: +E.most().toFixed(2), strikes: LIGHTNING.strikes - E.s0, bits: BOSSFX.bits, gone: E.c.gone, kill: calls.includes('kill'), end: calls.includes('bossEnd'), owlHeld: g.owl.state !== 'escort' };
      return (r.jolt >= 1 && r.punches >= 2 && r.most > 0.6 && r.strikes >= 1 && r.bits > 1000 && r.gone && r.kill && r.end && r.owlHeld) || JSON.stringify(r);`);
    await t.eval(`clearInterval(window._pin); return true;`);
    await t.step('…and once his ashes have blown away the owl comes with what she held, the altar\'s counsel dropped (it no longer applies)', `const { dissolving } = await import('/src/render/bossfx.js'); await until(() => !dissolving() && !g.trial.fighting, 12000);
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
    await t.step('the Chimera falls, and Zeus\'s bolt turns it to embers and ash on the wind', `const c = g.trial.boss; if (!c) return 'no chimera'; AG.AUDIO.calls = []; const { BOSSFX } = await import('/src/render/bossfx.js'); const d0 = BOSSFX.dissolves;
      g.creatures.hurt(c, [[99999, 'force']], P); const went = await until(() => BOSSFX.dissolves > d0, 9000); await frames(20); return (went && (AG.AUDIO.calls || []).some((q) => q.k === 'bossEnd')) || 'no dissolve';`);
    await t.shot('chimera-death');
    await t.step('…(its body gone, its head dropped, the trial on to its next step)', `const { dissolving } = await import('/src/render/bossfx.js'); await until(() => !dissolving(), 12000); clearInterval(window._pin);
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
