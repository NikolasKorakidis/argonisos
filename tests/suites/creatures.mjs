// Creatures and bosses: the giant Minotaur comes down out of the sky and breaks the Labyrinth open, stands on his own
// feet, and chases you anywhere across the ruin without getting stuck, using his moves on the way; the Chimera comes and
// fights at its broken shrine; a broken site stays broken through a save and a reload; animals tilt with the slope they
// stand on.
const SETUP = `localStorage.removeItem('argonisos.world.v1'); g.save = () => false; AG.S.peaceful = true; AG.setWeather('clear'); g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; return true;`;
export default {
  name: 'Creatures and bosses',
  slow: true,
  async run(t) {
    await t.step('summon the Minotaur in the Labyrinth', `AG.S.peaceful = false; g.give('deerHide', 5); g.give('olive', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'minotaur'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); window._u = u; let taken = 0; P.stats.damage = (n) => { taken += n; }; window._taken = () => taken; return true;`);
    await t.wait(3500);
    await t.step('…he is a giant, five to six times the hero\'s height, and stands on his own feet (legs posed, nothing broken)', `const c = g.trial.boss; if (!c) return 'no boss'; const b = c.body; if (!b.ik || b.ik.legs.length !== 2) return 'no foot placement on the boss';
      b.obj.updateMatrixWorld(true); const box = new AG.THREE.Box3().setFromObject(b.obj), h = box.max.y - box.min.y; if (h < 1.9 * 5 || h > 1.9 * 6.3) return 'he is ' + h.toFixed(1) + ' m tall';
      const v = new V(), ys = b.ik.legs.map((L) => L.foot.getWorldPosition(v).y - c.pos.y); if (!ys.every(Number.isFinite) || Math.min(...ys.map(Math.abs)) > c.T.h * 0.15 || Math.max(...ys.map(Math.abs)) > c.T.h * 0.35) return 'feet at ' + ys.map((y) => y.toFixed(2)) + ' m'; return true;`);
    await t.wait(5000);
    await t.step('…his coming broke the Labyrinth: about half its walls are down in rubble, their colliders gone, the rubble\'s in, the way open (no more routing by the gaps), and it is kept in the trial\'s state', `const R = g.structures.ruins.labyrinth, Co = g.colliders;
      if (!R.broken || !g.trial.st.broken?.labyrinth) return 'not broken: ' + JSON.stringify({ broken: R.broken, st: g.trial.st.broken }); if (Co.groups.has('ruin:labyrinth') || !Co.groups.get('rubble:labyrinth')?.length) return 'colliders not swapped';
      if (R.falls.length || !R.fallenG.visible || !R.debrisG.visible) return 'the collapse never settled: ' + R.falls.length + ' falling';
      const L = g.structures.lab, a = new V(L.c.x + 20, 0, L.c.z), b2 = new V(L.c.x + 3, 0, L.c.z); return g.structures.navTarget(a, b2) === null || 'still routing through the gaps';`);
    // the chase: the player held at points about the arena, each in turn; how long he takes to reach each (within the
    // reach of his slam), and the
    // longest he stood stuck while chasing (wanting to come on, no move under way, but not moving)
    const chase = await t.eval(`const c = g.trial.boss, u = window._u, L = g.structures.lab, out = [], wait = (ms) => new Promise((r) => setTimeout(r, ms)); if (!c) return 'boss gone';
      let worst = 0, stuck = 0, last = c.pos.clone(); const iv = setInterval(() => { const d = c.pos.distanceTo(P.pos), moved = Math.hypot(c.pos.x - last.x, c.pos.z - last.z); last.copy(c.pos);
        if (c.state === 'chase' && !c.move && !(c.intro > 0) && c.fall === undefined && d > c.T.reach + c.T.r + 1 && moved < 0.05) stuck += 0.1; else stuck = 0; worst = Math.max(worst, stuck); }, 100);
      for (const [r, a] of [[19, 0.4], [12, 2.2], [17, 3.6], [6, 5.0], [20, 1.3]]) {
        const x = L.c.x + Math.cos(a) * r, z = L.c.z + Math.sin(a) * r, pin = setInterval(() => { P.pos.set(x, P.pos.y, z); P.hv.set(0, 0, 0); P.stats.health = 99; }, 50); P.spawn(x, z);
        const t0 = performance.now(); let got = false; while (performance.now() - t0 < 15000) { if (c.pos.distanceTo(P.pos) < c.T.reach + c.T.r + 3.5) { got = true; break; } await wait(100); }
        clearInterval(pin); out.push({ r, a, s: +((performance.now() - t0) / 1000).toFixed(1), got });
      }
      clearInterval(iv); return { out, worst: +worst.toFixed(1) };`);
    if (typeof chase === 'string') t.check('the chase', false, chase);
    else {
      t.metric('the chase across the broken Labyrinth (each point: seconds to reach it)', chase);
      t.check('after the collapse he reaches you anywhere in the arena, within 15 s each time', chase.out.every((q) => q.got), JSON.stringify(chase.out));
      t.check('…and is never stuck for more than 2 s', chase.worst <= 2, `${chase.worst} s stuck`);
    }
    await t.step('…and used his moves on the way (charge, throw, slam, roar)', `return window._taken() > 0 || 'no damage taken';`);
    await t.shot('minotaur');
    await t.step('the Minotaur falls and drops his head', `g.creatures.hurt(g.trial.boss, [[99999, 'force']], P); return true;`);
    await t.wait(1500);
    await t.step('…(his head lies on the ground; the Labyrinth stays in ruins)', `return (g.pickups.drops.some((d) => d.item === 'minotaurHead') || g.trial.st.down.minotaur) && g.structures.ruins.labyrinth.broken || 'no head, ' + JSON.stringify(g.trial.st.down);`);
    await t.step('summon the Chimera at its shrine', `for (const c of [...g.creatures.list]) g.creatures.remove(c); g.give('dryadHeart', 3); g.give('pomegranate', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'chimera'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); return true;`);
    await t.wait(9000);
    await t.step('…the Chimera, a giant too, fights (it has hurt the player) and its shrine is broken', `const c = g.trial.boss; if (!c || c.type !== 'chimera') return 'no chimera'; const v = new V(); for (const [k, b] of Object.entries(c.body.bones || {})) { b.getWorldPosition(v); if (!Number.isFinite(v.x + v.y + v.z)) return 'bone ' + k + ' not finite'; }
      c.body.obj.updateMatrixWorld(true); const s = new AG.THREE.Box3().setFromObject(c.body.obj).getSize(new V()); if (Math.max(s.x, s.z) < 18 || s.y < 7) return 'only ' + s.toArray().map((x) => x.toFixed(1)) + ' m';
      if (!g.structures.ruins.chimera.broken) return 'shrine not broken'; return window._taken() > 0 || 'no damage taken';`);
    await t.shot('chimera');
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
