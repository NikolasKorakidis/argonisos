// Olympos: its path can be climbed (switchbacks, the crest and its rock steps, jumped), its faces can't be walked
// straight up, and the old altar on the top opens the whole map once, and remembers it in the save.
// The hero is driven up the path's line (gen.js PEAK.route) the way a player would: W held, the camera turned towards
// the line a few metres ahead, Space where the ground ahead rises more than a stride can take.
const climb = (from, secs) =>   // (from: an index into the path, or an expression of R)
  `const G = await import('/src/world/gen.js'), R = G.PEAK.route, s = g.SITES.peak, key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
  AG.teleport(R[${from}].x, R[${from}].z); await new Promise((r) => setTimeout(r, 2500)); P.stats.stamina = P.stats.maxStamina;
  let i = ${from}, jumps = 0, slid = 0, t0 = performance.now(), lastI = i, lastT = t0; key('keydown', 'KeyW');
  return await new Promise((done) => { const iv = setInterval(() => {
    const p = P.pos; { let b = i, bd = 1e9; for (let j = i; j < Math.min(R.length, i + 12); j++) { const d = Math.hypot(R[j].x - p.x, R[j].z - p.z); if (d < bd) { bd = d; b = j; } } i = b; }
    const q = R[Math.min(R.length - 1, i + 2)], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1; P.camYaw = Math.atan2(-dx, -dz);
    if (P.onGround && P.groundHere(p.x + dx / l * 1.1, p.z + dz / l * 1.1) - p.y > 1.15) { key('keydown', 'Space'); setTimeout(() => key('keyup', 'Space'), 60); jumps++; }
    if (P.sliding) slid++; const now = performance.now(); if (i !== lastI) { lastI = i; lastT = now; }
    const top = Math.hypot(p.x - s.x, p.z - s.z) < 10 && p.y > s.y - 1;
    if (top || now - lastT > 12000 || now - t0 > ${secs * 1000}) { clearInterval(iv); key('keyup', 'KeyW'); done({ top, secs: Math.round((now - t0) / 1000), at: i, of: R.length, y: +p.y.toFixed(1), summit: +s.y.toFixed(1), jumps, slid }); }
  }, 50); });`;

export default {
  name: 'Olympos',
  async run(t) {
    await t.eval(`AG.S.timeScale = 0; AG.S.time = 0.32; for (const c of [...g.creatures.list]) g.creatures.remove(c); g.owl.update = () => {}; return true;`);
    await t.step('the path is laid from the foot of the steep ground to the summit, rock steps on its crest', `const G = await import('/src/world/gen.js'), R = G.PEAK.route, s = g.SITES.peak, e = R.at(-1);
      return (R.length > 200 && G.PEAK.steps.length >= 4 && Math.hypot(e.x - s.x, e.z - s.z) < 12 && Math.abs(e.y - s.y) < 1.5 && !G.climbable(R[0].x, R[0].z)) || JSON.stringify({ n: R.length, steps: G.PEAK.steps.length, end: [e.x - s.x, e.z - s.z, e.y - s.y] });`);
    // the upper path: its last switchbacks, a hairpin, the crest and every rock step
    const up = await t.eval(climb('R.length - 130', 150));
    t.check('the upper path climbs to the summit (switchbacks, the crest, its rock steps jumped)', up.top && up.jumps >= 4, JSON.stringify(up));
    t.metric('upper path', up);
    // a face: steep ground on the upper mountain, off the path, walked straight up for six seconds
    const face = await t.eval(`const G = await import('/src/world/gen.js'), P0 = G.PEAK; let f = null;
      for (let a = P0.a + 2.2; a < P0.a + 4.1 && !f; a += 0.05) for (let d = 0.25; d < 0.45 && !f; d += 0.02) { const x = P0.x + Math.cos(a) * d * P0.r, z = P0.z + Math.sin(a) * d * P0.r;
        if (G.climbable(x, z) && G.routeAt(x, z).k === 0 && G.slopeGrade(x, z) > 1.3) f = { x, z }; }
      if (!f) return 'no steep face found'; const gx = AG.heightAt(f.x + 1, f.z) - AG.heightAt(f.x - 1, f.z), gz = AG.heightAt(f.x, f.z + 1) - AG.heightAt(f.x, f.z - 1);
      AG.teleport(f.x, f.z, Math.atan2(-gx, -gz)); await new Promise((r) => setTimeout(r, 2000)); const y0 = P.pos.y, key = (type, code) => dispatchEvent(new KeyboardEvent(type, { code }));
      let best = y0; key('keydown', 'KeyW'); key('keydown', 'ShiftLeft'); for (let k = 0; k < 60; k++) { P.camYaw = Math.atan2(-gx, -gz); if (k % 8 === 0) { key('keydown', 'Space'); setTimeout(() => key('keyup', 'Space'), 60); } await new Promise((r) => setTimeout(r, 100)); best = Math.max(best, P.pos.y); }
      key('keyup', 'KeyW'); key('keyup', 'ShiftLeft'); return { grade: +G.slopeGrade(f.x, f.z).toFixed(2), gained: +(best - y0).toFixed(2), end: +(P.pos.y - y0).toFixed(2) };`);
    t.metric('steep face', face);
    t.check('a steep face can\'t be run, walked or hopped straight up (it slides you back)', typeof face === 'object' && face.gained < 2.5 && face.end < 1, JSON.stringify(face));
    // the altar on the top
    const pray = `const { PEAK } = await import('/src/world/gen.js'), u = g.structures.uses.find((q) => q.kind === 'olympos'); P.spawn(u.at.x + Math.cos(PEAK.a) * 2.2, u.at.z + Math.sin(PEAK.a) * 2.2);`;   // (in front of the altar, where the path comes up)
    await t.step('at the summit the altar offers a prayer', `${pray} await new Promise((r) => setTimeout(r, 600)); const tr = g.trial.interactable(P.pos); return (tr?.label === 'Pray to Zeus' && /Olympos/.test(tr.sub)) || JSON.stringify(tr && { label: tr.label, sub: tr.sub });`);
    await t.step('…before it, most of the map is fog and few places are known', `const m = g.map, d = m.fctx.getImageData(0, 0, m.fog.width, m.fog.height).data; let fog = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 128) fog++; return (fog / (d.length / 4) > 0.5 && m.sites().filter((s) => m.isKnown(s)).length < m.sites().length) || 'fog ' + (fog / (d.length / 4)).toFixed(2);`);
    await t.step('praying (E, kneeling until Zeus answers)', `g.interact(); return g.acts.pose?.kind === 'pray' || 'not kneeling: ' + g.acts.pose?.kind;`);
    await t.wait(4500);
    await t.step('…clears the fog everywhere and marks every place of the trial on the map', `const m = g.map, d = m.fctx.getImageData(0, 0, m.fog.width, m.fog.height).data; let fog = 0; for (let i = 3; i < d.length; i += 4) if (d[i] > 8) fog++; const known = m.sites().filter((s) => m.isKnown(s)).length;
      return (fog === 0 && known === m.sites().length && g.trial.st.olympos === true) || JSON.stringify({ fog, known, of: m.sites().length, flag: g.trial.st.olympos });`);
    await t.wait(3000);
    await t.step('…and opens the map to show it', `return g.map.open || 'map closed';`);
    await t.shot('map-revealed');
    await t.step('a second prayer: the altar says the island already lies open', `g.map.toggle(false); g.acts.rise?.(); await new Promise((r) => setTimeout(r, 1500)); ${pray} await new Promise((r) => setTimeout(r, 300)); const tr = g.trial.interactable(P.pos); return /already/.test(tr?.label || '') || JSON.stringify(tr && tr.label);`);
    await t.step('the save keeps it: saved, forgotten, loaded back', `const SV = await import('/src/game/save.js'); if (!SV.save(g)) return 'save failed'; g.trial.st.olympos = false; const ok = SV.load(g); SV.clearSave(); return (ok && g.trial.st.olympos === true) || 'flag ' + g.trial.st.olympos;`);
  },
};
