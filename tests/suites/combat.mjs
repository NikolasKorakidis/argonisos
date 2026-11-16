// Enemies' blows land with their animations: the clips' impact moments (models.js BLOWS) are measured again from the
// clips themselves, every attacker's damage comes when its clip is at that moment (never at the start of the swing),
// stepping aside from a committed swing makes it miss, the bosses' moves keep time with theirs, and a dryad's thorn is
// thrown from her hand as her throw lets go, glows in her hand first and flies as a visible bolt you can react to.
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
  },
};
