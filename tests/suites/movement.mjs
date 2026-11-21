// Moving about: sprinting and jumping, swimming, dying and coming back, and the feet finding the ground on slopes and
// the temple steps (planted feet never sink, nothing breaks, foot placement stays cheap).
const feetOk = `const HB = P.hero.bones, v = new V(); for (const s of ['Left', 'Right']) { HB['mixamorig' + s + 'Foot'].getWorldPosition(v); if (!Number.isFinite(v.y) || Math.abs(v.y - P.pos.y) > 2.5) return 'foot ' + s + ' at ' + (v.y - P.pos.y); } return true;`;
const temple = `const s = g.map.sites().find((q) => q.kind === 'temple'), r = Math.atan2(-s.x, -s.z), lz = 12.66 * 2.25 + 4; AG.teleport(s.x + lz * Math.sin(r) + 0.6 * Math.cos(r), s.z + lz * Math.cos(r) - 0.6 * Math.sin(r), r, -0.2); return true;`;
const hill = `for (let r = 400; r < 1400; r += 5) for (let a = 0; a < 6.28; a += 0.2) { const x = r * Math.cos(a), z = r * Math.sin(a), gx = AG.heightAt(x + 1, z) - AG.heightAt(x - 1, z), gz = AG.heightAt(x, z + 1) - AG.heightAt(x, z - 1), s = Math.hypot(gx, gz) / 2; if (s > 0.25 && s < 0.7 && AG.heightAt(x, z) > 2 && AG.heightAt(x + gx * 4, z + gz * 4) > AG.heightAt(x, z) + 1 && AG.heightAt(x + gx * 8 / Math.hypot(gx, gz), z + gz * 8 / Math.hypot(gx, gz)) > AG.heightAt(x, z) + 3) { AG.teleport(x, z, Math.atan2(gx, gz) + Math.PI, -0.2); window._hy = AG.heightAt(x, z); return true; } } return 'no hillside found';`;

// (a spy on the HUD's skill banners: each asked for, with its time; each shown, with its text; the most on screen at once)
const spy = `window._pops = []; window._shown = []; window._maxPops = 0; const H = g.hud, ask = H.skill.bind(H), next = H.nextSkill.bind(H);
  H.skill = (s, L, learned) => { window._pops.push({ s, L, learned: !!learned, t: performance.now() }); ask(s, L, learned); };
  H.nextSkill = () => { const box = document.getElementById('skillPops'), n = box.children.length; next(); if (box.children.length > n) { const e = box.lastElementChild; window._shown.push({ s: e.dataset.s, text: e.textContent, svg: !!e.querySelector('svg') }); } window._maxPops = Math.max(window._maxPops, box.children.length); };
  return true;`;

// walk forward for a while, sampling how far each foot is above its own ground
async function walk(t, setup, secs) {
  await t.eval(setup); await t.until('AG.terrain.pending === 0 && P.onGround', 6000); await t.wait(300);
  await t.eval(`window._w = { sink: 0, bad: 0, frames: 0, deep: 0, at: null }; const HB = P.hero.bones, v = new V(); window._iv = setInterval(() => { for (const s of ['Left', 'Right']) { HB['mixamorig' + s + 'Foot'].getWorldPosition(v); if (!Number.isFinite(v.y)) window._w.bad++; const d = v.y - P.groundHere(v.x, v.z); if (d < -0.03) window._w.deep++; if (d < window._w.sink) { window._w.sink = d; window._w.at = [s, +(v.x - P.pos.x).toFixed(2), +(v.z - P.pos.z).toFixed(2), +P.groundHere(v.x, v.z).toFixed(2), +P.pos.y.toFixed(2)]; } } window._w.frames++; }, 30); return true;`);
  await t.page.keyboard.down('KeyW'); await t.wait(secs * 1000); await t.page.keyboard.up('KeyW'); await t.eval('await frames(10); return true;');
  return t.eval(`clearInterval(window._iv); return { ...window._w, y: P.pos.y };`);
}

export default {
  name: 'Movement and feet',
  async run(t) {
    // (every skill banner the HUD is asked for, with when: hud.js skill, from stats.js onLearn and onLevel)
    await t.eval(spy);
    await t.eval(`g.owl.o.g.visible = false; window._ts = performance.now(); return true;`);
    await t.page.keyboard.down('KeyW'); await t.page.keyboard.down('ShiftLeft'); await t.wait(2500);
    await t.eval(`window._tj = performance.now(); return true;`);
    for (let i = 0; i < 3; i++) { await t.page.keyboard.press('Space'); if (!i) { await t.wait(500); await t.shot('skill-learned'); } await t.until('!P.onGround', 500); await t.until('P.onGround', 1500); }
    await t.step('the stamina bar shows its number while you run', `const e = document.querySelector('#stam > u'), st = document.getElementById('stam'); return (/^\\d+ \\/ \\d+$/.test(e?.textContent || '') && !st.classList.contains('full') && getComputedStyle(e).display !== 'none') || 'stamina reads "' + e?.textContent + '", full ' + st.classList.contains('full');`);
    await t.page.keyboard.up('ShiftLeft'); await t.page.keyboard.up('KeyW');
    await t.step('sprinting and jumping: legs fine, the feet let go in the air', feetOk);
    // Skills found at once (Patch 22): the first sprint and the first jump each show "Skill learned" as they happen
    await t.step('the first sprint shows "Skill learned: Sprinting, level 1" at once', `const p = window._pops.find((q) => q.s === 'sprinting'); return (p && p.learned && p.L === 1 && p.t - window._ts < 600) || JSON.stringify(p || window._pops);`);
    await t.step('the first jump shows "Skill learned: Jumping, level 1" as you leave the ground', `const p = window._pops.find((q) => q.s === 'jumping'); return (p && p.learned && p.L === 1 && p.t - window._tj < 250) || JSON.stringify(p || window._pops);`);
    await t.step('…each shown once, a banner with the skill\'s glyph, name and level', `const n = window._pops.filter((q) => q.learned && (q.s === 'jumping' || q.s === 'sprinting')).length; return (n === 2 && window._shown.some((x) => x.s === 'jumping' && x.svg && /Skill learned/.test(x.text) && /Jumping, level 1/.test(x.text))) || JSON.stringify({ n, shown: window._shown });`);
    await t.step('the first swing of an axe shows "Skill learned: Axeman" before the blow lands', `g.give('crudeAxe'); g.equip(inv.slots.findIndex((s) => s?.id === 'crudeAxe')); await new Promise((r) => { const w = () => (!P.equip && P.swing <= 0 && P.hero.moveK > 0.9 && P.stats.stamina >= 10 ? r() : setTimeout(w, 50)); w(); });   // (with breath back after the sprint)
      if (window._pops.some((q) => q.s === 'axe')) return 'found before the swing'; const ok = P.strike('axe', 5), p = window._pops.find((q) => q.s === 'axe'); return (ok && p?.learned && P.swingHit === false) || JSON.stringify({ ok, p, hit: P.swingHit });`);
    await t.step('a level-up shows "Jumping, level 2"', `await until(() => !g.hud.skillQ.length && document.getElementById('skillPops').children.length < 3, 8000); P.stats.train('jumping', 300); const p = window._pops.find((q) => q.s === 'jumping' && !q.learned);
      const e = await until(() => [...document.querySelectorAll('.skillPop[data-s="jumping"]')].find((x) => /Skill improved/.test(x.textContent)), 3000); return (p?.L === 2 && e && /Skill improved/.test(e.textContent) && /Jumping, level 2/.test(e.textContent)) || JSON.stringify({ p, text: e?.textContent });`);
    await t.shot('skill-level');
    await t.step('several at once queue: never more than three banners on screen, none on another', `for (const s of ['sneaking', 'swimming', 'mace', 'spear', 'dagger']) P.stats.learn(s); await until(() => document.querySelectorAll('.skillPop').length >= 3, 3000); await frames(5); const r = [...document.querySelectorAll('.skillPop')].map((e) => e.getBoundingClientRect());
      const over = r.some((a, i) => r.some((b, j) => i < j && a.bottom > b.top + 1 && b.bottom > a.top + 1)); await until(() => window._shown.filter((x) => ['sneaking', 'swimming', 'mace', 'spear', 'dagger'].includes(x.s)).length === 5, 10000); const later = window._shown.filter((x) => ['sneaking', 'swimming', 'mace', 'spear', 'dagger'].includes(x.s)).length;
      return (r.length <= 3 && !over && window._maxPops <= 3 && later === 5) || JSON.stringify({ n: r.length, over, max: window._maxPops, later });`);
    await t.step('running is a quarter slower than before Patch 22: 3.45 m/s, not 4.6', `const { RUN, SPRINT } = await import('/src/player/speeds.js'); if (Math.abs(RUN - 4.6 * 0.75) > 1e-9 || Math.abs(SPRINT - 7.6 * 0.75) > 1e-9) return 'RUN ' + RUN + ' SPRINT ' + SPRINT;
      inv.slots.forEach((s) => { if (s?.worn) delete s.worn; }); g.inv.onChange?.(); P.spawn(10, 10); P.yaw = P.camYaw + Math.PI; return true;`);
    await t.until('AG.terrain.pending === 0 && P.onGround', 4000); await t.page.keyboard.down('KeyW'); await t.wait(1500);
    const run = await t.eval(`const S = P.stats, sl = P.slope || 0, k = sl > 0 ? 1 - 0.35 * Math.min(sl, 0.8) : 1 + 0.12 * Math.min(-sl, 0.6); return { speed: P.speed, want: 4.6 * 0.75 * S.speedK * (1 + P.speedMod) * (P.overweight ? 0.6 : 1) * k, slope: sl };`);
    await t.page.keyboard.up('KeyW');
    t.check('…measured: the hero runs at 75% of the old run (within 6%)', Math.abs(run.speed / run.want - 1) < 0.06 && run.speed < 4.6 * 0.8, JSON.stringify(run));
    await t.step('into the sea', `for (let r = 600; r < 2000; r += 20) if (AG.heightAt(r, 0) < -3) { P.spawn(r, 0); return true; } return 'no sea found';`);
    await t.page.keyboard.down('KeyW'); await t.until('P.swimming && P.hero.ik.w <= 0.2', 4000); await t.page.keyboard.up('KeyW');
    await t.step('…swimming: no foot planting, nothing broken', `if (!P.swimming) return 'not swimming'; if (P.hero.ik.w > 0.2) return 'feet still planting (w ' + P.hero.ik.w.toFixed(2) + ')'; ${feetOk}`);
    await t.step('dying', `P.spawn(10, 10); P.stats.damage(999); return P.dead || 'not dead';`);
    await t.until('!P.dead && P.onGround && AG.terrain.pending === 0', 12000); await t.eval('await frames(10); return true;');
    await t.step('…and coming back on your feet', `if (P.dead) return 'still dead'; ${feetOk}`);
    const a = await walk(t, temple, 5);
    // (crossing a step edge, a swinging foot can dip into the riser for a frame or two: allowed, briefly and shallowly; the
    // limit grew with the temple's risers in Patch 16, to 30 cm; the platform's steps are walked as the model has them
    // since, eight of 21 cm up to the colonnade and seven more up to the hall, from 4 m out on the plaza)
    t.check('up the temple steps: no broken bones; feet sink over 3 cm in under 3% of frames, never over 30 cm', a.bad === 0 && a.deep / a.frames < 0.03 && a.sink > -0.3, JSON.stringify(a));
    const b = await walk(t, hill, 4), hy = await t.eval('return window._hy;');
    t.check('up a hillside: no broken bones, planted feet never sink more than 3 cm, and you get somewhere', b.bad === 0 && b.sink > -0.03 && b.y - hy > 1, JSON.stringify({ ...b, climbed: b.y - hy }));
    const cost = await t.eval(`const h = P.hero, st = { speed: 3, onGround: true, ground: P.groundFn, rootY: P.pos.y }; let t0 = performance.now(); for (let i = 0; i < 300; i++) h.update(1 / 60, st); const on = (performance.now() - t0) / 300; st.ground = null; t0 = performance.now(); for (let i = 0; i < 300; i++) h.update(1 / 60, st); return { with: on, without: (performance.now() - t0) / 300 };`);
    t.metric('hero update ms (with / without feet)', `${cost.with.toFixed(3)} / ${cost.without.toFixed(3)}`);
    t.check('foot placement costs under 0.2 ms a frame', cost.with - cost.without < 0.2, JSON.stringify(cost));
    // Sitting (X): cross-legged, the camera free round the hero and kept within 30 m of him and over the ground
    await t.eval(`P.spawn(12, 14); await new Promise((r) => { const w = () => (P.hero.has('sit') && P.hero.has('getUp') ? r() : setTimeout(w, 200)); w(); }); return true;`);
    await t.until('AG.terrain.pending === 0 && P.onGround', 4000); await t.wait(300); await t.page.keyboard.press('KeyX');
    await t.step('X sits you down cross-legged, the camera free', `const HB = P.hero.bones, at = (n) => HB[n].getWorldPosition(new V()).applyMatrix4(P.hero.root.matrixWorld.clone().invert());
      let l, r, lk, rk; await until(() => { if (g.acts.pose?.kind !== 'sit' || !P.seat?.look) return false; l = at('mixamorigLeftFoot'); r = at('mixamorigRightFoot'); lk = at('mixamorigLeftLeg'); rk = at('mixamorigRightLeg'); return lk.x - rk.x > 0.6 && lk.y < 0.35 && rk.y < 0.35 && lk.x - l.x > 0.25 && r.x - rk.x > 0.25 && l.z > 0 && r.z > 0; }, 4000);
      if (g.acts.pose?.kind !== 'sit' || !P.seat?.look) return 'not seated: ' + g.acts.pose?.kind;
      // (the knees out wide and low, each shin running across in front towards the other side: in the clip alone the knees
      // stand up close together, the feet straight ahead of them)
      return (lk.x - rk.x > 0.6 && lk.y < 0.35 && rk.y < 0.35 && lk.x - l.x > 0.25 && r.x - rk.x > 0.25 && l.z > 0 && r.z > 0) || 'legs not crossed: feet ' + [l.x, l.z, r.x, r.z].map((v) => v.toFixed(2)) + ' knees ' + [lk.x, lk.y, rk.x, rk.y].map((v) => v.toFixed(2));`);
    await t.eval(`const h = P.pos.clone(); window._s = { h, far: 0, low: 1e9, moved: 0, n: 0 }; P.camPitch = 1.4; P.camDist = 14; window._iv = setInterval(() => { const c = AG.camera.position, s = window._s; s.far = Math.max(s.far, c.distanceTo(P.pos)); s.low = Math.min(s.low, c.y - P.groundHere(c.x, c.z, c.y)); s.moved = Math.max(s.moved, P.pos.distanceTo(h)); s.n++; }, 30); return true;`);
    await t.page.keyboard.down('ShiftLeft'); await t.page.keyboard.down('KeyW'); await t.page.keyboard.down('KeyQ'); await t.wait(4000);
    await t.page.keyboard.up('KeyQ'); await t.page.keyboard.down('KeyD'); await t.wait(3000); await t.page.keyboard.up('KeyD'); await t.page.keyboard.up('KeyW'); await t.page.keyboard.up('ShiftLeft');
    await t.step('seated, WASD and Q move the camera, not the hero: within 30 m of him, never under the ground', `clearInterval(window._iv); const s = window._s, off = P.lookOff.length();
      return (g.acts.pose?.kind === 'sit' && s.moved < 0.05 && off > 12 && off + P.camDist <= 30.01 && s.far <= 30.6 && s.low >= 0.1) || JSON.stringify({ ...s, off, kind: g.acts.pose?.kind });`);
    await t.page.keyboard.press('KeyX');
    await t.step('X again stands you up, the camera back behind you', `const c = AG.camera.position, dist = () => c.distanceTo(P.pos), back = () => Math.abs(Math.atan2(Math.sin(P.camYaw - P.yaw - Math.PI), Math.cos(P.camYaw - P.yaw - Math.PI)));
      await until(() => !g.acts.pose && !P.seat && P.lookOff.length() < 0.5 && dist() < 12 && back() < 0.3, 5000); const d = dist(), behind = back();
      return (!g.acts.pose && !P.seat && P.lookOff.length() < 0.5 && d < 12 && behind < 0.3) || JSON.stringify({ kind: g.acts.pose?.kind, seat: !!P.seat, off: P.lookOff.length(), d, behind });`);
    await t.page.keyboard.press('KeyX'); await t.until("g.acts.pose?.kind === 'sit' && P.seat", 3000); await t.page.keyboard.press('Space');
    await t.step('Space stands you up too', `await until(() => !g.acts.pose && !P.seat, 4000); return (!g.acts.pose && !P.seat) || 'still ' + g.acts.pose?.kind;`);
    await t.eval(`g.give('hammer'); g.useSlot(g.inv.slots.findIndex((s) => s?.id === 'hammer')); return true;`); await t.until('!P.equip && P.hero.moveK > 0.9', 3000);
    await t.page.keyboard.press('KeyX'); await t.wait(500);
    await t.step('with the hammer in hand X does not sit you down (it takes down a piece)', `return !g.acts.pose || 'sat down: ' + g.acts.pose.kind;`);
    // last, as it reloads the page: the skills found are in the save, so using them again after a reload announces
    // nothing, while a level-up still shows
    const seen = await t.eval(`const { save } = await import('/src/game/save.js'); if (!save(g)) return null; return Object.keys(P.stats.skills).filter((k) => P.stats.skills[k].seen);`);
    await t.page.reload(); await t.page.waitForFunction(() => window.AG?.player.hero.model && AG.terrain.pending === 0, null, { timeout: 120000 });
    await t.eval(`g.save = () => false; AG.S.peaceful = true; g.weatherRain = () => 0; g.owl.st.done.push('intro', 'night', 'house', 'temple'); g.owl.st.queue = []; g.owl.st.met = true; ${spy}`);
    await t.step('after a reload, the skills found are not announced again', `const seen = ${JSON.stringify(seen)}; if (!seen?.length) return 'no skills found before the reload (or the save failed)'; if (!g.loaded) return 'the save did not load';
      for (const s of seen) { P.stats.learn(s); P.stats.use(0.1, s); P.stats.train(s, 0.5); } const again = window._pops.filter((q) => q.learned); localStorage.removeItem('argonisos.world.v1');
      return (!again.length && seen.includes('sprinting') && seen.includes('jumping') && seen.includes('axe')) || JSON.stringify({ seen, again });`);
    await t.step('…but a level-up still shows', `const L = P.stats.skills.sprinting.level; P.stats.train('sprinting', 2000); const p = window._pops.find((q) => q.s === 'sprinting'), e = await until(() => document.querySelector('.skillPop[data-s="sprinting"]'), 3000); return (p && !p.learned && p.L > L && !!e) || JSON.stringify({ L, p });`);
  },
};
