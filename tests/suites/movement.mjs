// Moving about: sprinting and jumping, swimming, dying and coming back, and the feet finding the ground on slopes and
// the temple steps (planted feet never sink, nothing breaks, foot placement stays cheap).
const feetOk = `const HB = P.hero.bones, v = new V(); for (const s of ['Left', 'Right']) { HB['mixamorig' + s + 'Foot'].getWorldPosition(v); if (!Number.isFinite(v.y) || Math.abs(v.y - P.pos.y) > 2.5) return 'foot ' + s + ' at ' + (v.y - P.pos.y); } return true;`;
const temple = `const s = g.map.sites().find((q) => q.kind === 'temple'), r = Math.atan2(-s.x, -s.z), lz = 21 / 2 + 7; AG.teleport(s.x + lz * Math.sin(r) + 0.6 * Math.cos(r), s.z + lz * Math.cos(r) - 0.6 * Math.sin(r), r, -0.2); return true;`;
const hill = `for (let r = 400; r < 1400; r += 5) for (let a = 0; a < 6.28; a += 0.2) { const x = r * Math.cos(a), z = r * Math.sin(a), gx = AG.heightAt(x + 1, z) - AG.heightAt(x - 1, z), gz = AG.heightAt(x, z + 1) - AG.heightAt(x, z - 1), s = Math.hypot(gx, gz) / 2; if (s > 0.25 && s < 0.7 && AG.heightAt(x, z) > 2 && AG.heightAt(x + gx * 4, z + gz * 4) > AG.heightAt(x, z) + 1) { AG.teleport(x, z, Math.atan2(gx, gz) + Math.PI, -0.2); window._hy = AG.heightAt(x, z); return true; } } return 'no hillside found';`;

// walk forward for a while, sampling how far each foot is above its own ground
async function walk(t, setup, secs) {
  await t.eval(setup); await t.wait(1500);
  await t.eval(`window._w = { sink: 0, bad: 0, frames: 0, deep: 0, at: null }; const HB = P.hero.bones, v = new V(); window._iv = setInterval(() => { for (const s of ['Left', 'Right']) { HB['mixamorig' + s + 'Foot'].getWorldPosition(v); if (!Number.isFinite(v.y)) window._w.bad++; const d = v.y - P.groundHere(v.x, v.z); if (d < -0.03) window._w.deep++; if (d < window._w.sink) { window._w.sink = d; window._w.at = [s, +(v.x - P.pos.x).toFixed(2), +(v.z - P.pos.z).toFixed(2), +P.groundHere(v.x, v.z).toFixed(2), +P.pos.y.toFixed(2)]; } } window._w.frames++; }, 30); return true;`);
  await t.page.keyboard.down('KeyW'); await t.wait(secs * 1000); await t.page.keyboard.up('KeyW'); await t.wait(400);
  return t.eval(`clearInterval(window._iv); return { ...window._w, y: P.pos.y };`);
}

export default {
  name: 'Movement and feet',
  async run(t) {
    await t.page.keyboard.down('KeyW'); await t.page.keyboard.down('ShiftLeft'); await t.wait(2500);
    for (let i = 0; i < 3; i++) { await t.page.keyboard.press('Space'); await t.wait(700); }
    await t.page.keyboard.up('ShiftLeft'); await t.page.keyboard.up('KeyW');
    await t.step('sprinting and jumping: legs fine, the feet let go in the air', feetOk);
    await t.step('into the sea', `for (let r = 600; r < 2000; r += 20) if (AG.heightAt(r, 0) < -3) { P.spawn(r, 0); return true; } return 'no sea found';`);
    await t.page.keyboard.down('KeyW'); await t.wait(2000); await t.page.keyboard.up('KeyW');
    await t.step('…swimming: no foot planting, nothing broken', `if (!P.swimming) return 'not swimming'; if (P.hero.ik.w > 0.2) return 'feet still planting (w ' + P.hero.ik.w.toFixed(2) + ')'; ${feetOk}`);
    await t.step('dying', `P.spawn(10, 10); P.stats.damage(999); return P.dead || 'not dead';`);
    await t.wait(7500);
    await t.step('…and coming back on your feet', `if (P.dead) return 'still dead'; ${feetOk}`);
    const a = await walk(t, temple, 5);
    // (crossing a step edge, a swinging foot can dip into the riser for a frame or two: allowed, briefly and shallowly)
    t.check('up the temple steps: no broken bones; feet sink over 3 cm in under 3% of frames, never over 10 cm', a.bad === 0 && a.deep / a.frames < 0.03 && a.sink > -0.1, JSON.stringify(a));
    const b = await walk(t, hill, 4), hy = await t.eval('return window._hy;');
    t.check('up a hillside: no broken bones, planted feet never sink more than 3 cm, and you get somewhere', b.bad === 0 && b.sink > -0.03 && b.y - hy > 1, JSON.stringify({ ...b, climbed: b.y - hy }));
    const cost = await t.eval(`const h = P.hero, st = { speed: 3, onGround: true, ground: P.groundFn, rootY: P.pos.y }; let t0 = performance.now(); for (let i = 0; i < 300; i++) h.update(1 / 60, st); const on = (performance.now() - t0) / 300; st.ground = null; t0 = performance.now(); for (let i = 0; i < 300; i++) h.update(1 / 60, st); return { with: on, without: (performance.now() - t0) / 300 };`);
    t.metric('hero update ms (with / without feet)', `${cost.with.toFixed(3)} / ${cost.without.toFixed(3)}`);
    t.check('foot placement costs under 0.2 ms a frame', cost.with - cost.without < 0.2, JSON.stringify(cost));
  },
};
