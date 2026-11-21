// Enemies' blows land with their animations: the clips' impact moments (models.js BLOWS) are measured again from the
// clips themselves, every attacker's damage comes when its clip is at that moment (never at the start of the swing),
// stepping aside from a committed swing makes it miss, the bosses' moves keep time with theirs, and a dryad's thorn is
// thrown from her hand as her throw lets go, glows in her hand first and flies as a visible bolt you can react to.
// The team's balance sheet (docs/plans/balance.md): a grown hog takes four or five crude-axe blows, hogs keep clear of fire
// and your torch until hit, a dryadling backs off from your torch once, a dryad doesn't mind it, the Minotaur's charge
// gores for 42-46 and his dead come in waves on time.
// Screenshot sequences: a dryad's throw (wind-up, in flight, impact) and a hog's and a giant's blows at impact. All in
// the meadow's clearing (tests/lib/places.mjs), where no tree stands in the way of a swing, a thorn or the camera.
import { visit } from '../lib/places.mjs';

// in the page: wait for a condition frame by frame (true if it came), and put a creature at an angle off the camera's
// line of sight, d metres from the player
const H = `const until = async (f, ms) => { const t0 = performance.now(); while (!f() && performance.now() - t0 < ms) await new Promise((r) => requestAnimationFrame(r)); return !!f(); };
  const place = (k, d, turn = 0, o = {}) => { const f = new V(-Math.sin(P.camYaw), 0, -Math.cos(P.camYaw)).applyAxisAngle(new V(0, 1, 0), turn); const c = g.creatures.spawn(k, P.pos.x + f.x * d, P.pos.z + f.z * d, { level: 0, aware: true, young: false, ...o }); c.yaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z); c.state = 'chase'; c.atkCd = 99; c.rangedCd = 99; return c; };
  const clear = () => { for (const c of [...g.creatures.list]) g.creatures.remove(c); for (let i = g.combat.thorns.length - 1; i >= 0; i--) g.combat.drop(i); window._rec = null;
    P.hv.set(0, 0, 0); P.vel.set(0, 0, 0); if (window._home) { P.pos.x = window._home.x; P.pos.z = window._home.z; } };   // (a heavy blow knocks you back: each test starts still, where the first began)
  const ready = (c) => until(() => c.body.mixer && (c.body.ready ?? true) && (c.type !== 'dryad' || c.body.acts.throw), 20000);
  const off = (c) => { const m = c.body.move; return m ? (m.a.time - m.hit) / m.rate : NaN; };`;

// How each blow's moment is found in its clip: which bone strikes, and by what (stop: where it stops dead after its
// fastest; fwd: furthest forward; low: lowest; peak: fastest, a throw letting go). [kind, level, move, clip, bone, by]
const MEASURE = [
  ['hog', 1, 'attack', 'Attack', 'mouth_1', 'stop'],
  ['dryad', 0, 'attack', 'attack', 'mixamorigRightHand', 'stop'], ['dryad', 0, 'throw', 'throw', 'mixamorigRightHand', 'peak'],
  ['minotaur', 0, 'slam', 'Attack1', 'axe', 'stop'], ['minotaur', 0, 'attack', 'Attack2', 'axe', 'fwd'], ['minotaur', 0, 'attack', 'Attack3', 'axe', 'fwd'], ['minotaur', 0, 'roar', 'Taunt', 'Head', 'peak'],
  ['skeleton', 0, 'attack', 'Attack1', 'Base_HumanRPalm', 'stop'], ['skeleton', 0, 'attack', 'Attack2', 'Base_HumanRPalm', 'stop'], ['skeleton', 0, 'attack', 'Attack3', 'Base_HumanLPalm', 'stop'],
  ['chimera', 0, 'claw', 'Attack1', 'Leg_R_F5', 'low'], ['chimera', 0, 'sting', 'Attack2', 'tail11', 'fwd'], ['chimera', 0, 'breath', 'Roar', 'head', 'low'], ['chimera', 0, 'roar', 'Roar', 'head', 'peak'],
];

export default {
  name: 'Combat timing',
  slow: true,
  async run(t) {
    await visit(t, 'meadow'); await t.eval(`AG.S.still = false; AG.S.timeScale = 1; window._home = P.pos.clone(); return true;`);
    // ---- the table against the clips
    const m = await t.eval(`const M = await import('/src/creatures/models.js'), out = [], MEASURE = ${JSON.stringify(MEASURE)};
      for (const [k, lv, move, name, bone, by] of MEASURE) {
        const b = M.makeBody(k, lv, 5, 5, false); g.scene.add(b.obj); const t0 = performance.now();
        while (!(b.mixer && (b.ready ?? true) && b.acts[name]) && performance.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 100));
        const model = b.obj.children[0], bones = {}; model.traverse((o) => { if (o.isBone) bones[o.name] = o; });
        const clip = b.acts[name].getClip(), mx = new AG.THREE.AnimationMixer(model), a = mx.clipAction(clip), inv = new AG.THREE.Matrix4(), v = new V(), P2 = [], dt = 1 / 60; a.play();
        for (let s = 0; s <= clip.duration + 1e-6; s += dt) { a.time = s; mx.update(0); b.obj.updateMatrixWorld(true); inv.copy(b.obj.matrixWorld).invert(); P2.push(bones[bone].getWorldPosition(v).applyMatrix4(inv).clone()); }
        mx.stopAllAction(); mx.uncacheRoot(model); g.scene.remove(b.obj); b.dispose();
        const sp = P2.map((p, i) => (i ? p.distanceTo(P2[i - 1]) / dt : 0)); let pk = 0, i = 0; sp.forEach((s, j) => { if (s > sp[pk]) pk = j; });
        if (by === 'peak') i = pk; else if (by === 'stop') { i = pk; while (i < sp.length - 1 && sp[i] > sp[pk] * 0.25) i++; } else P2.forEach((p, j) => { if (by === 'fwd' ? p.z > P2[i].z : p.y < P2[i].y) i = j; });
        const want = M.BLOWS[['dryad', 'giant', 'dryadling'].includes(k) ? 'rig' : k][move].find(([n]) => n === name)[1].hit;
        out.push({ k, move, name, measured: +(i * dt).toFixed(3), table: want });
      }
      return out;`);
    for (const r of m) t.check(`${r.k} ${r.move} (${r.name}): the table's impact ${r.table} s matches the clip's ${r.measured} s`, Math.abs(r.measured - r.table) <= 0.1, `${r.measured} measured, ${r.table} in BLOWS`);

    // ---- every attacker's damage when its clip strikes
    await t.eval(`AG.S.peaceful = true; P.stats.damage = () => {}; const real = g.combat.hitPlayer.bind(g.combat); window._real = real;
      g.combat.hitPlayer = (c, dmg, o) => { const mv = c.body.move; window._rec = { c, e: c.atkE ?? c.move?.e, hitAt: c.hitAt ?? c.move?.hit, off: mv ? (mv.a.time - mv.hit) / mv.rate : NaN, clip: mv?.name, from: o?.from }; return real(c, dmg, o); }; return true;`);
    const kinds = ['hog', 'dryadling', 'dryad', 'giant', 'skeleton', 'minotaur', 'chimera'];
    for (const k of kinds) {
      const r = await t.eval(`${H} clear(); const T = (await import('/src/creatures/creatures.js')).TYPES['${k}'], c = place('${k}', T.reach + T.r * 0.5 - 0.3); if (!(await ready(c))) return 'body never came in';
        const res = [];
        for (let n = 0; n < 3; n++) {
          window._rec = null; c.atkCd = 0; c.state = 'chase'; c.yaw = Math.atan2(P.pos.x - c.pos.x, P.pos.z - c.pos.z);
          if (!(await until(() => window._rec, 15000))) return 'no blow landed (state ' + c.state + ', ' + c.pos.distanceTo(P.pos).toFixed(1) + ' m)';
          res.push(window._rec); c.atkCd = 99; await until(() => c.state !== 'attack', 5000); c.pos.copy(P.pos).addScaledVector(new V(Math.sin(c.yaw), 0, Math.cos(c.yaw)), -(T.reach + T.r * 0.5 - 0.3));
        }
        return res.map((q) => ({ clip: q.clip, e: +q.e.toFixed(3), hitAt: +q.hitAt.toFixed(3), off: +q.off.toFixed(3) }));`);
      if (typeof r === 'string') { t.check(`${k}: blows land`, false, r); continue; }
      t.metric(`${k} blows`, r);
      t.check(`${k}: each blow lands within 0.1 s of its clip's impact`, r.every((q) => Math.abs(q.off) <= 0.1), JSON.stringify(r));
      t.check(`${k}: …after a wind-up, not as the attack starts`, r.every((q) => q.e >= 0.4), JSON.stringify(r));
    }

    // ---- stepping aside from a committed swing makes it miss
    for (const k of ['hog', 'dryad', 'skeleton']) {
      await t.step(`${k}: step aside as it commits and the blow misses`, `${H} clear(); const T = (await import('/src/creatures/creatures.js')).TYPES['${k}'], c = place('${k}', T.reach + T.r * 0.5 - 0.3); if (!(await ready(c))) return 'body never came in';
        window._rec = null; c.atkCd = 0; if (!(await until(() => c.state === 'attack', 3000))) return 'did not attack';
        await until(() => c.atkE >= c.hitAt - 0.22, 3000); const s = new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); P.pos.addScaledVector(s, 2.4);
        await until(() => c.hitDone, 3000); const r = c.blowAt; c.atkCd = 99; P.spawn(P.pos.x, P.pos.z); return (r && !r.hit && !window._rec) || 'hit anyway: ' + JSON.stringify(r);`);
    }

    // ---- the bosses' moves keep time with their clips
    const moves = [['minotaur', 'slam', 3], ['minotaur', 'throw', 12], ['minotaur', 'roar', 4], ['chimera', 'claw', 4], ['chimera', 'sting', 4], ['chimera', 'breath', 7]];
    for (const [k, mv, d] of moves) {
      const r = await t.eval(`${H} clear(); const c = place('${k}', ${d}); if (!(await ready(c))) return 'body never came in'; c.boss = true; c.cd = { charge: 99, slam: 99, roar: 99, throw: 99, strike: 99, breath: 99, pounce: 99 };
        let at = null; const rt = g.combat.throwAt.bind(g.combat), rs = P.stats.add.bind(P.stats), note = () => { if (!at && c.move) at = { e: c.move.e, off: off(c) }; };
        g.combat.throwAt = (cc, dmg, o) => { note(); return rt(cc, dmg, o); }; P.stats.add = (n, s) => { if (n === 'stunned') note(); return rs(n, s); };
        window._rec = null; c.move = { k: '${mv}', ph: 0, ...g.trial.timed(c, '${mv}', 1) }; const want = c.move.hit;
        const mine = () => window._rec?.c === c && window._rec.e !== undefined, ok = await until(() => at || mine() || c.move?.ph === 1, 15000); if (!at && mine()) at = window._rec; if (!at && c.move?.ph === 1) at = { e: c.move.e, off: off(c) };
        const why = ok ? '' : JSON.stringify({ d: +c.pos.distanceTo(P.pos).toFixed(2), move: c.move && [c.move.k, +(c.move.e || 0).toFixed(2), c.move.hit], rec: window._rec && [window._rec.c === c, window._rec.e], dead: P.dead, state: c.state, list: g.creatures.list.length });
        g.combat.throwAt = rt; P.stats.add = rs; c.boss = false; c.move = null;
        return ok ? { e: +at.e.toFixed(3), want: +want.toFixed(3), off: +at.off.toFixed(3) } : 'the move never landed: ' + why;`);
      if (typeof r === 'string') { t.check(`${k} ${mv}: lands`, false, r); continue; }
      t.metric(`${k} ${mv}`, r);
      t.check(`${k} ${mv}: lands within 0.1 s of its clip's moment, after its wind-up`, Math.abs(r.off) <= 0.1 && r.e >= 0.4, JSON.stringify(r));
    }

    // ---- a dryad's thorn: a wind-up with a glow in her hand, the bolt from her hand, seen all the way, time to react
    const th = await t.eval(`${H} clear(); P.camPitch = -0.15; P.camDist = 7; const c = place('dryad', 12, 0.9); if (!(await ready(c))) return 'body never came in';
      const rt = g.combat.throwAt.bind(g.combat); let made = null; g.combat.throwAt = (cc, dmg, o) => { const h = cc.body.hand(); made = { t: performance.now(), hand: h && o.from ? o.from.distanceTo(h) : 99, hy: h ? h.y - cc.pos.y : 0, off: off(cc), e: cc.atkE, th: rt(cc, dmg, o) }; return made.th; };
      window._rec = null; let glow = 0, frames = 0, seen = 0, small = 1e9, castAt = null; c.rangedCd = 0;
      const ok = await until(() => { if (c.state === 'throw' && !castAt) castAt = performance.now(); if (g.combat.glows.has(c)) glow++;
        if (made && !window._rec) { const m = made.th.m; frames++; const v = m.position.clone().project(AG.camera), dist = m.position.distanceTo(AG.camera.position), px = 0.2 / (dist * Math.tan(AG.camera.fov * Math.PI / 360)) * innerHeight / 2;
          if (m.parent === g.scene && m.visible && made.th.th.core.visible && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 && v.z < 1) seen++; small = Math.min(small, px); }
        return window._rec; }, 8000);
      g.combat.throwAt = rt; if (!ok) return 'the thorn never hit (state ' + c.state + ', thrown ' + !!made + ', last seen ' + (made && made.th.m.position.clone().sub(P.pos).toArray().map((x) => x.toFixed(2))) + ' from the player, dodging ' + P.dodging + ')';
      return { glow, hand: +made.hand.toFixed(3), hy: +made.hy.toFixed(2), off: +made.off.toFixed(3), windup: +((made.t - castAt) / 1000).toFixed(2), flight: +((performance.now() - made.t) / 1000).toFixed(2), frames, seen, px: +small.toFixed(1), from: !!window._rec.from, dir: document.getElementById('hurtDir').style.background.includes('radial-gradient') };`);
    if (typeof th === 'string') t.check('a dryad throws a thorn that hits', false, th);
    else {
      t.metric('dryad thorn', th);
      t.check('dryad: a glow gathers in her hand through the wind-up', th.glow >= 10, `${th.glow} frames of glow`);
      t.check('dryad: the thorn leaves her hand, raised in the throw', th.hand < 0.05 && th.hy > 1, `${th.hand} m from her hand, ${th.hy} m up`);
      t.check('dryad: …as her throw lets go (within 0.1 s of the clip\'s release)', Math.abs(th.off) <= 0.1, `${th.off} s off`);
      t.check('dryad: …after a wind-up of at least 0.4 s', th.windup >= 0.4, `${th.windup} s`);
      t.check('dryad: it takes long enough to arrive to react to (12 m in at least 0.8 s)', th.flight >= 0.8, `${th.flight} s`);
      t.check('dryad: the thorn is a visible mesh on screen every frame of its flight', th.frames > 10 && th.seen === th.frames, `${th.seen} of ${th.frames} frames`);
      t.check('dryad: …big enough to see (its glow at least 3 px across)', th.px >= 1.5, `${th.px} px radius`);
      t.check('dryad: the hit shows which way it came from', th.from && th.dir, JSON.stringify(th));
    }
    await t.step('dryad: hitting her as she winds up breaks off the throw', `${H} clear(); const c = place('dryad', 12, 0.9); if (!(await ready(c))) return 'body never came in'; const n0 = g.combat.thorns.length; c.rangedCd = 0;
      if (!(await until(() => c.state === 'throw', 3000))) return 'no throw'; g.creatures.hurt(c, [[1, 'blunt']], P.pos); await until(() => false, 1200);
      return (g.combat.thorns.length === n0 && !g.combat.glows.has(c)) || 'thrown anyway';`);

    // ---- the balance sheet. A level-0 grown hog, at skill 1, aware (no sneak attack): four or five crude-axe blows, at
    // either end of its health and for a few rolled at random
    const hog = await t.eval(`${H} clear(); const S = P.stats.skills.axe, out = [];
      for (const hp of [50, 65, 0, 0, 0, 0, 0, 0]) {
        const c = place('hog', 1.2); if (hp) c.hp = c.max = hp; const h0 = c.hp; let hits = 0;
        if (c.young || c.level || h0 < 50 || h0 > 65) return 'not a grown level-0 hog of 50-65: ' + JSON.stringify({ young: c.young, level: c.level, hp: h0 });
        while (!c.dead && hits < 20) { S.level = 1; S.xp = 0; c.aware = true; c.pos.set(P.pos.x + Math.sin(P.yaw) * 1.2, c.pos.y, P.pos.z + Math.cos(P.yaw) * 1.2); if (!g.combat.strike(g.ITEMS.crudeAxe)) return 'the axe missed'; hits++; }
        out.push({ hp: +h0.toFixed(1), hits }); g.creatures.remove(c);
      }
      S.level = 1; S.xp = 0; return out;`);
    if (typeof hog === 'string') t.check('a hog takes four or five crude-axe blows', false, hog);
    else { t.metric('crude-axe blows to kill a level-0 hog', hog); t.check('a level-0 hog (50-65 health) takes four or five crude-axe blows at skill 1', hog.every((q) => q.hits >= 4 && q.hits <= 5), JSON.stringify(hog)); }
    // (the torch in the hand and out of it; how near a creature comes over a while, and whether its blow landed)
    const TORCH = `const torch = (on) => { const i = inv.slots.findIndex((s) => s?.id === 'torch'); if (on && i < 0) { g.give('torch', 1); return torch(on); } if (i >= 0 && !!inv.slots[i].worn !== on) g.equip(i); return g.torchLit() === on; };
      const watch = async (c, ms, from = 0, stop = false) => { let near = 99, blow = false; const t0 = performance.now(); window._rec = null; await until(() => { if (performance.now() - t0 > from) near = Math.min(near, c.pos.distanceTo(P.pos)); blow ||= window._rec?.c === c; return stop && blow; }, ms); return { near: +near.toFixed(2), blow }; };`;
    await t.step('a hog keeps out of a campfire\'s light while you stand by it, and away from the torch in your hand, until you hit it: then it attacks through the torch', `${H} ${TORCH} clear(); if (!torch(false)) return 'torch still lit';
      AG.S.freeBuild = true; const fx = P.pos.x + Math.sin(P.yaw + 1.6) * 1.2, fz = P.pos.z + Math.cos(P.yaw + 1.6) * 1.2, f = B.place('campfire', new V(fx, AG.heightAt(fx, fz), fz), 0); f.state.lit = true; f.state.fuel = 30;
      let c = place('hog', 4); c.atkCd = 0; const byFire = await watch(c, 3500, 1500); B.remove(f, false); f.state.lit = false; clear();
      if (byFire.blow || byFire.near < 4) return 'it came at you by the fire: ' + JSON.stringify(byFire);
      if (!torch(true)) return 'no lit torch'; c = place('hog', 4); c.atkCd = 0; const byTorch = await watch(c, 3500, 1500);
      if (byTorch.blow || byTorch.near < 4) { torch(false); return 'it came at your torch: ' + JSON.stringify(byTorch); }
      g.creatures.hurt(c, [[1, 'slash']], P.pos); c.atkCd = 0; const hit = await watch(c, 10000, 0, true); torch(false); window._hogT = { byFire, byTorch, hit };
      return (c.angered && hit.blow) || 'after the hit it never struck through the torch: ' + JSON.stringify({ angered: c.angered, ...hit });`);
    t.metric('a hog by a campfire, by your torch, and after you hit it (nearest it came in metres, whether it struck)', await t.eval(`return window._hogT || null;`));
    await t.step('…a hit on one of a family angers them all, and a hog that has lost you minds the fire again', `${H} clear(); const M = g.creatures.spawnFamily('hog', P.pos.x + 30, P.pos.z, false, 3); if (!M.brood.length) return 'no piglets';
      g.creatures.hurt(M.brood[0], [[1, 'slash']], P.pos); const all = [M, ...M.brood].every((k) => k.angered); M.state = 'idle'; g.paused = true; g.creatures.update(0.016); g.paused = false; const calmed = !M.angered; clear();
      return (all && calmed) || JSON.stringify({ all, calmed });`);
    await t.step('a dryadling backs off for about 2 s at its first sight of your torch, then comes on and strikes, and doesn\'t back off again', `${H} ${TORCH} clear(); if (!torch(true)) return 'no lit torch'; const c = place('dryadling', 9); c.atkCd = 0; if (!(await ready(c))) return 'body never came in';
      let t0 = null, t1 = null, again = false, blow = false; window._rec = null;
      await until(() => { const now = performance.now(); if (c.state === 'flee' && t0 === null) t0 = now; else if (t0 !== null && t1 === null && c.state !== 'flee') t1 = now; else if (t1 !== null && c.state === 'flee') again = true; blow ||= window._rec?.c === c; return t1 !== null && blow && now - t1 > 3000; }, 20000); torch(false);
      const back = t0 !== null && t1 !== null ? +((t1 - t0) / 1000).toFixed(2) : null; window._lingT = { back, again, blow };
      return (back >= 1.7 && back <= 2.4 && !again && blow && c.torchSeen) || JSON.stringify(window._lingT);`);
    t.metric('a dryadling at the sight of your torch (seconds backing off, backed off again, struck)', await t.eval(`return window._lingT || null;`));
    await t.step('a dryad fears no torch: she comes at you and strikes', `${H} ${TORCH} clear(); if (!torch(true)) return 'no lit torch'; const c = place('dryad', 6); c.atkCd = 0; if (!(await ready(c))) return 'body never came in';
      let fled = false; window._rec = null; const ok = await until(() => { fled ||= c.state === 'flee'; return window._rec?.c === c; }, 10000); torch(false); return (ok && !fled) || JSON.stringify({ ok, fled, d: +c.pos.distanceTo(P.pos).toFixed(1) });`);
    // the Minotaur's charge: what reaches you before armour (no armour worn, no guard, no roll: the blow as it is struck)
    const gore = await t.eval(`${H} clear(); if (g.armor() !== 0) return 'armour worn'; const out = [], sd = P.stats.damage; let got = null; P.stats.damage = (n) => { got = n; };
      for (let n = 0; n < 3; n++) {
        clear(); const c = place('minotaur', 22); if (!(await ready(c))) return 'body never came in'; c.boss = true; c.cd = { charge: 99, slam: 99, roar: 99, throw: 99 }; got = null; window._rec = null;
        c.move = { k: 'charge', ph: 0, dir: c.yaw, ...g.trial.timed(c, 'charge', 0.75) }; const ok = await until(() => got !== null, 12000); c.boss = false; c.move = null; c.ctl = null;
        if (!ok) { P.stats.damage = sd; return 'the charge never gored (' + c.pos.distanceTo(P.pos).toFixed(1) + ' m)'; } out.push({ dmg: +got.toFixed(2), dmgK: c.dmgK, enraged: !!c.enraged });
      }
      P.stats.damage = sd; clear(); return out;`);
    if (typeof gore === 'string') t.check('the Minotaur\'s charge gores', false, gore);
    else { t.metric('the Minotaur\'s charge before armour', gore); t.check('the Minotaur\'s charge gores for 42-46 pierce before armour', gore.every((q) => q.dmg >= 42 && q.dmg <= 46), JSON.stringify(gore)); }
    // his dead in waves: the fight's clock run by hand (the world paused, the trial stepped a tenth of a second at a time)
    // (Zeus's storm held off meanwhile: its bolts would fall on you with the world paused, and the staggers they leave play
    // out once it runs again, carrying you metres off for the tests after)
    const waves = await t.eval(`${H} clear(); g.paused = true; const Tr = g.trial, out = {}, storm = Tr.storm; Tr.storm = () => {};
      const fight = () => { for (const c of [...g.creatures.list]) g.creatures.remove(c); const a = new V(P.pos.x + 20, P.pos.y, P.pos.z), c = g.creatures.spawn('minotaur', a.x, a.z, { level: 0, boss: true, aware: true }); c.arena = a; Tr.begin(c, 'minotaur'); return c; };
      const run = (s) => { for (let i = 0, n = Math.round(s / 0.1); i < n; i++) Tr.update(0.1); }, at = (c) => ({ waves: Tr.waves, skeletons: g.creatures.list.filter((k) => k.summoned && k.type === 'skeleton').length, near: +Math.min(99, ...g.creatures.list.filter((k) => k.summoned).map((k) => k.pos.distanceTo(P.pos))).toFixed(1) });
      let c = fight(); c.hp = 301; run(29.8); out.by30 = at(c); run(0.4); out.at30 = at(c); run(29.6); out.by60 = at(c); run(0.4); out.at60 = at(c);
      c = fight(); run(10); out.by10 = at(c); c.hp = 300; run(0.1); out.at300 = at(c); run(29.7); out.by300and30 = at(c); run(0.4); out.at300and30 = at(c);
      c = fight(); run(29.9); out.before = at(c); c.hp = 300; Tr.update(Tr.helperT); out.both = at(c); run(29.8); out.bothAnd30 = at(c); run(0.4); out.bothAnd30b = at(c);
      for (const k of [...g.creatures.list]) g.creatures.remove(k); Tr.boss = null; Tr.storm = storm; Tr.calm(); g.paused = false; return out;`);
    t.metric('the Minotaur\'s waves of dead', waves);
    const W = (k) => waves[k]?.waves;
    t.check('Minotaur, health above 300: no wave before 30 s, one at 30 s (two skeletons, not beside you), the next 30 s later', W('by30') === 0 && W('at30') === 1 && waves.at30.skeletons === 2 && waves.at30.near > 6 && W('by60') === 1 && W('at60') === 2, JSON.stringify(waves));
    t.check('Minotaur brought to 300 health at 10 s: a wave at once, the next 30 s after it', W('by10') === 0 && W('at300') === 1 && W('by300and30') === 1 && W('at300and30') === 2, JSON.stringify(waves));
    t.check('Minotaur at 300 health just as 30 s come up: one wave, not two, and the next 30 s after it', W('before') === 0 && W('both') === 1 && waves.both.skeletons === 2 && W('bothAnd30') === 1 && W('bothAnd30b') === 2, JSON.stringify(waves));

    // ---- the Minotaur against a small hero (Patch 22). His moves made by hand, the hero standing still unless a step
    // says otherwise (damage still counted through hitPlayer, window._rec, but none taken: P.stats.damage is off)
    const MINO = `const mino = async (d, turn = 0) => { const c = place('minotaur', d, turn); if (!(await ready(c))) return null; c.boss = true; c.cd = { charge: 99, slam: 99, roar: 99, throw: 99, sweep: 99 }; c.spent = 99; c.fatigue = 0; return c; };
      const done = (c) => { c.boss = false; c.move = null; c.ctl = null; };`;
    // the roar: stunned for 2 s within its reach (and unable to strike), not outside it (the stun's length in the game's
    // seconds as it starts, and that it's over within 3 s of real time, whatever the frame rate)
    const roar = await t.eval(`${H} ${MINO} const out = {};
      for (const [k, d] of [['near', 10], ['far', 21]]) {
        clear(); P.stats.remove('stunned'); await until(() => false, 300); const c = await mino(d); if (!c) return 'body never came in'; window._rec = null;
        c.move = { k: 'roar', ph: 0, ...g.trial.timed(c, 'roar', 1.3) }; let t0 = null, t1 = null, strike = null; const s0 = performance.now();
        await until(() => { const on = P.stats.has('stunned'); if (on && t0 === null) { t0 = performance.now(); strike = P.strike('punch', 0); window._len = P.stats.cond.stunned; } if (!on && t0 !== null && t1 === null) t1 = performance.now(); return t1 !== null || (t0 === null && performance.now() - s0 > 4500); }, 9000);
        out[k] = { stunned: t0 !== null, len: t0 !== null ? +window._len.toFixed(2) : null, secs: t0 !== null && t1 !== null ? +((t1 - t0) / 1000).toFixed(2) : null, struck: strike }; done(c);
      }
      return out;`);
    if (typeof roar === 'string') t.check('the Minotaur\'s roar', false, roar);
    else {
      t.metric('the Minotaur\'s roar (near: 10 m, far: 21 m)', roar);
      t.check('the Minotaur\'s roar stuns you within its reach for 2 s (and you can\'t strike meanwhile)', roar.near.stunned && Math.abs(roar.near.len - 2) < 0.1 && roar.near.secs > 1.8 && roar.near.secs < 3 && roar.near.struck === false, JSON.stringify(roar));
      t.check('…and not from outside it', !roar.far.stunned, JSON.stringify(roar));
    }
    // the charge: a lead-in of pawing, a top speed a hero can step out of, and a step aside late in it makes him miss; then
    // he skids on and turns round
    const charge = await t.eval(`${H} ${MINO} clear(); const c = await mino(26); if (!c) return 'body never came in'; window._rec = null;
      c.move = { k: 'charge', ph: 0, dir: c.yaw, ...g.trial.timed(c, 'charge', 1.3) }; const s0 = performance.now(); let run = null, top = 0, side = null, skid = false;
      await until(() => { const m = c.move; if (m?.ph === 1 && run === null) run = performance.now(); top = Math.max(top, c.speed);
        if (side === null && m?.ph === 1 && c.pos.distanceTo(P.pos) < 10) { side = +c.speed.toFixed(1); const s = new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); P.pos.addScaledVector(s, 4.5); }
        skid ||= m?.ph === 3; return skid && performance.now() - s0 > 1000; }, 12000);
      const r = { paw: run && +((run - s0) / 1000).toFixed(2), top: +top.toFixed(1), stepAt: side, hit: window._rec?.c === c, skid }; done(c); return r;`);
    if (typeof charge === 'string') t.check('the Minotaur\'s charge', false, charge);
    else {
      t.metric('the Minotaur\'s charge (pawing s, top speed m/s, speed when you stepped aside, hit, skidded)', charge);
      t.check('the Minotaur paws the ground a second or more before he charges', charge.paw >= 1, JSON.stringify(charge));
      t.check('…charges no faster than 12.5 m/s (a giant\'s weight), and a step aside late in it makes him miss and skid on', charge.top <= 12.5 && charge.top >= 9 && !charge.hit && charge.skid, JSON.stringify(charge));
    }
    // ...into a wall (one put in his way): he reels, then is spent; spent, he takes blows half again as hard (each blow
    // struck while he isn't chasing, so his guard can't take any of it)
    const wall = await t.eval(`${H} ${MINO} clear(); const c = await mino(26); if (!c) return 'body never came in'; const f = new V(P.pos.x - c.pos.x, 0, P.pos.z - c.pos.z).normalize();
      g.colliders.addGroup('testWall', [-3, -1.5, 0, 1.5, 3].map((o) => ({ x: P.pos.x + f.x * 6 + f.z * o, z: P.pos.z + f.z * 6 - f.x * o, r: 1, h: 8 })));
      c.move = { k: 'charge', ph: 0, dir: c.yaw, ...g.trial.timed(c, 'charge', 1.3) }; let side = false, dazed = false;
      const ok = await until(() => { if (!side && c.move?.ph === 1 && c.pos.distanceTo(P.pos) < 10) { side = true; const s = new V(Math.cos(c.yaw), 0, -Math.sin(c.yaw)); P.pos.addScaledVector(s, 5); } dazed ||= c.move?.ph === 2; return c.move?.k === 'tired' && c.tired > 0; }, 12000);
      g.colliders.removeGroup('testWall'); if (!ok) { done(c); return 'never spent: ' + JSON.stringify({ move: c.move?.k, ph: c.move?.ph, dazed }); }
      c.state = 'idle'; const hp0 = c.hp; g.creatures.hurt(c, [[100, 'force']], P.pos); const tiredHit = hp0 - c.hp, glow = c.glow;
      c.move = null; c.tired = 0; c.glow = 0; c.state = 'idle'; const hp1 = c.hp; g.creatures.hurt(c, [[100, 'force']], P.pos); const fresh = hp1 - c.hp;
      c.fatigue = c.spent = 2; c.move = null; c.rest = 0; c.state = 'chase'; await until(() => c.move?.k === 'tired', 1500); const again = c.move?.k; done(c);
      return { dazed, tiredHit: +tiredHit.toFixed(1), fresh: +fresh.toFixed(1), glow: +glow.toFixed(2), afterMoves: again };`);
    if (typeof wall === 'string') t.check('the Minotaur into a wall', false, wall);
    else {
      t.metric('the Minotaur into a wall, and spent (a blow of 100 spent and not)', wall);
      t.check('the Minotaur charging into a wall reels, dazed, then is spent', wall.dazed, JSON.stringify(wall));
      t.check('…spent, he glows and takes blows half again as hard', Math.abs(wall.tiredHit / wall.fresh - 1.5) < 0.01 && wall.glow > 0.05, JSON.stringify(wall));
      t.check('…and after his run of big moves he is spent too', wall.afterMoves === 'tired', JSON.stringify(wall));
    }
    // his dead: they claw up out of the ground over about a second and a half, and no more than two come at you at once
    // while the others keep a few metres off; and they keep apart
    const dead = await t.eval(`${H} clear(); const sk = [0, 1, 2, 3].map((i) => { const a = i * 1.57 + 0.4, c = g.creatures.spawn('skeleton', P.pos.x + Math.cos(a) * 9, P.pos.z + Math.sin(a) * 9, { level: 0, summoned: true, aware: true }); c.state = 'chase'; return c; });
      let y0 = 0; const t0 = performance.now(); await until(() => { y0 = Math.min(y0, ...sk.map((c) => c.pos.y - AG.heightAt(c.pos.x, c.pos.z))); return sk.every((c) => !(c.rise > 0)); }, 4000); const risen = sk.every((c) => !(c.rise > 0)), took = +((performance.now() - t0) / 1000).toFixed(2);
      for (const c of sk) if (!(await ready(c))) return 'body never came in';
      let most = 0, gap = 99, blows = 0; const s0 = performance.now(); window._rec = null; let last = null;
      await until(() => { const atk = sk.filter((c) => c.state === 'attack').length; most = Math.max(most, atk); for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) gap = Math.min(gap, sk[i].pos.distanceTo(sk[j].pos));
        if (window._rec && window._rec !== last) { last = window._rec; blows++; } P.hv.set(0, 0, 0); return performance.now() - s0 > 12000; }, 13000);
      const far = sk.filter((c) => !c.engaged).map((c) => +c.pos.distanceTo(P.pos).toFixed(1)); clear(); return { sunk: +y0.toFixed(2), risen, took, most, gap: +gap.toFixed(2), blows, waiting: far };`);
    if (typeof dead === 'string') t.check('the Minotaur\'s dead', false, dead);
    else {
      t.metric('the Minotaur\'s dead (how deep they start, risen, most attacking at once, closest two, blows in 12 s, how far the waiting ones stand)', dead);
      t.check('his dead rise out of the ground, up within two seconds', dead.sunk < -0.5 && dead.risen && dead.took < 2, JSON.stringify(dead));
      t.check('…no more than two of them attack at once, the rest waiting a few metres off, and they keep apart', dead.most <= 2 && dead.blows >= 1 && dead.waiting.every((d) => d > 3) && dead.gap > 1.2, JSON.stringify(dead));
    }

    // ---- pictures: the throw (wind-up, in flight, impact), and a hog's and a giant's blows at impact
    const freeze = (cond) => t.eval(`${H} window._frozen = false; const ok = await until(() => ${cond}, 8000); if (ok) { g.paused = true; window._frozen = true; } return ok || 'never came';`);
    // (frozen the moment a blow lands: right after it, in the same frame)
    const freezeOnHit = `window._frozen = false; const r = g.combat.hitPlayer; g.combat.hitPlayer = (cc, d, o) => { const x = r(cc, d, o); g.paused = true; window._frozen = true; g.combat.hitPlayer = r; return x; };`;
    const frozen = () => t.eval(`const t0 = performance.now(); while (!window._frozen && performance.now() - t0 < 8000) await new Promise((r) => setTimeout(r, 16)); return window._frozen || 'it never landed';`);
    const snap = async (name, ok) => { if (ok !== true) return t.check(`picture ${name}`, false, ok); await t.wait(120); await t.shot(name); await t.eval(`g.paused = false; window._frozen = false; return true;`); };
    await t.eval(`${H} clear(); P.camPitch = -0.1; P.camDist = 6; window._c = place('dryad', 10, 0.7); await ready(window._c); window._c.rangedCd = 0; return true;`);
    await snap('throw-windup', await freeze(`window._c.state === 'throw' && window._c.atkE >= window._c.hitAt * 0.85`));
    await snap('throw-flight', await freeze(`g.combat.thorns.some((q) => q.e >= 0.45)`));
    await t.eval(freezeOnHit + ' return true;'); await snap('throw-impact', await frozen());
    for (const k of ['hog', 'giant']) {
      await t.eval(`${H} clear(); const T = (await import('/src/creatures/creatures.js')).TYPES['${k}'], c = place('${k}', T.reach + T.r * 0.5 - 0.3, 1.1); await ready(c); await until(() => false, 600); ${freezeOnHit} c.atkCd = 0; return true;`);
      await snap(`${k}-impact`, await frozen());
    }
    await t.eval(`g.combat.hitPlayer = window._real; for (const c of [...g.creatures.list]) g.creatures.remove(c); return true;`);

    // ---- The bow drawn and the guard up on the move (Patch 24: drawing, or letting go, while walking spun the hero's body
    // round, by up to 150° in a frame). In each of the eight directions: aiming, the hero faces the aim (the root within 3°
    // of it, not turning) and his chest holds still against his facing; drawing and letting go on the move, and raising
    // and dropping the guard, his chest never turns against his facing faster than a quick turn of the shoulders (as fast
    // as a frame goes: per second). (chest: the shoulders' line, seen from above)
    const AIMT = `const { input } = await import('/src/input.js'); const Bn = P.hero.bones, R = P.hero.root, w = (b) => b.getWorldPosition(new V()), ang = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b)), deg = (x) => Math.round(Math.abs(x) * 180 / Math.PI);
      const chest = () => { const v = w(Bn.mixamorigLeftShoulder).sub(w(Bn.mixamorigRightShoulder)); return Math.atan2(-v.z, v.x); }, aimYaw = () => Math.atan2(-Math.sin(P.camYaw), -Math.cos(P.camYaw));
      const kit = (...ids) => { for (const s of inv.slots) if (s?.worn) delete s.worn; for (const id of ids) { if (!inv.count(id)) g.give(id, 1); g.equip(inv.slots.findIndex((s) => s?.id === id && !s.worn)); } P.equip = null; };
      const DIRS = [['W'], ['W', 'D'], ['D'], ['S', 'D'], ['S'], ['S', 'A'], ['A'], ['W', 'A']], keys = (list, on) => { for (const k of list) input.keys['Key' + k] = on; };
      const home = async () => { P.spawn(window._home.x, window._home.z); P.camYaw = 2.2; P.yaw = 2.2 + Math.PI; P.stats.stamina = P.stats.maxStamina; await frames(30); };
      // n frames: the most the facing strays from the aim (from frame 'from' on), and the fastest the facing turns and the chest turns against it (°/s)
      const watch = async (n, from = 0) => { const s = { off: 0, turn: 0, chest: 0 }; let y0 = null, c0 = null, t0 = performance.now();
        for (let i = 0; i < n; i++) { await frames(1); const y = R.rotation.y, c = ang(chest(), y), now = performance.now(), dt = Math.max(now - t0, 8) / 1000; t0 = now;
          if (i >= from) { s.off = Math.max(s.off, Math.abs(ang(y, aimYaw()))); if (y0 !== null) { s.turn = Math.max(s.turn, Math.abs(ang(y, y0)) / dt); s.chest = Math.max(s.chest, Math.abs(ang(c, c0)) / dt); } } y0 = y; c0 = c; }
        return { off: deg(s.off), turn: deg(s.turn), chest: deg(s.chest) }; };`;
    const aim = await t.eval(`${AIMT} AG.S.peaceful = true; P.stats.god = true; kit('crudeBow'); g.give('crudeArrow', 20); await frames(20); const steady = {}, moving = {}, guard = {};
      for (const d of DIRS) { await home(); input.rmb = true; await until(() => P.bow?.st === 'aim', 3000); keys(d, true); steady[d.join('')] = await watch(60, 20); keys(d, false); input.rmb = false; await frames(20); }
      for (const d of DIRS) { await home(); keys(d, true); await frames(25); input.rmb = true; const a = await watch(80); input.rmb = false; const b = await watch(50); keys(d, false); moving[d.join('')] = Math.max(a.chest, b.chest); await frames(20); }
      kit('crudeAxe', 'crudeShield'); await frames(20);
      for (const d of DIRS) { await home(); keys(d, true); await frames(25); input.rmb = true; const a = await watch(50), s = await watch(30); input.rmb = false; const b = await watch(50); keys(d, false); guard[d.join('')] = { off: s.off, chest: Math.max(a.chest, b.chest) }; await frames(20); }
      kit(); P.stats.god = false; return { steady, moving, guard };`);
    t.metric('aiming on the move: steady (° off the aim, °/s the facing and the chest turn), drawing and letting go (chest °/s), the guard', aim);
    t.check('the bow drawn, walking in each of the 8 directions: the hero faces his aim (within 3°, turning under 30°/s), his chest still (under 150°/s)', Object.values(aim.steady).every((r) => r.off <= 3 && r.turn < 30 && r.chest < 150), JSON.stringify(aim.steady));
    t.check('…drawing and letting go on the move: the chest never wheels round against the facing (under 1000°/s; it spun at 2800)', Object.values(aim.moving).every((c) => c < 1000), JSON.stringify(aim.moving));
    t.check('the guard up on the move: facing the aim, and raising and dropping it never wheels the chest round (under 1300°/s; 2500 before)', Object.values(aim.guard).every((r) => r.off <= 3 && r.chest < 1300), JSON.stringify(aim.guard));
  },
};
