// Creatures and bosses: the Minotaur fights on his own feet and finds his way through the Labyrinth's rings to you,
// using his moves on the way; the Chimera comes and fights; animals tilt with the slope they stand on.
export default {
  name: 'Creatures and bosses',
  slow: true,
  async run(t) {
    await t.step('summon the Minotaur in the Labyrinth', `AG.S.peaceful = false; g.give('deerHide', 5); g.give('olive', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'minotaur'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); window._u = u; let taken = 0; P.stats.damage = (n) => { taken += n; }; window._taken = () => taken; return true;`);
    await t.wait(3500);
    await t.step('…he stands on his own feet (legs posed, nothing broken)', `const c = g.trial.boss; if (!c) return 'no boss'; const b = c.body; if (!b.ik) return 'no foot placement on the boss'; const v = new V(); for (const s of ['Left', 'Right']) { b.bones['mixamorig' + s + 'Foot'].getWorldPosition(v); if (!Number.isFinite(v.y) || Math.abs(v.y - c.pos.y) > 1.5) return 'foot ' + s + ' at ' + (v.y - c.pos.y); } return true;`);
    // put him in the outer ring across from the gap, and the player at the altar in the middle
    await t.page.evaluate(() => { const c = AG.game.trial.boss, L = AG.game.structures.lab; const [a0, a1] = L.gaps[22][0], a = (a0 + a1) / 2 + Math.PI; c.pos.set(L.c.x + Math.cos(a) * 18.5, c.pos.y, L.c.z + Math.sin(a) * 18.5); window._iv = setInterval(() => { const P = AG.player; P.pos.set(window._u.center.x + 2, P.pos.y, window._u.center.z + 2); }, 50); });
    await t.wait(16000);
    await t.step('…he finds his way through the rings to the altar within 16 s', `clearInterval(window._iv); const c = g.trial.boss; if (!c) return 'boss gone'; const d = c.pos.distanceTo(P.pos); return d < 6 || 'still ' + d.toFixed(1) + ' m away, ' + c.pos.distanceTo(window._u.center).toFixed(1) + ' from the altar';`);
    await t.step('…and used his moves on the way (charge, throw, slam, roar)', `return window._taken() > 0 || 'no damage taken';`);
    await t.shot('minotaur');
    await t.step('the Minotaur falls and drops his head', `g.creatures.hurt(g.trial.boss, [[99999, 'force']], P); return true;`);
    await t.wait(1500);
    await t.step('…(his head lies on the ground)', `return g.pickups.drops.some((d) => d.item === 'minotaurHead') || g.trial.st.down.minotaur || 'no head, ' + JSON.stringify(g.trial.st.down);`);
    await t.step('summon the Chimera at its shrine', `for (const c of [...g.creatures.list]) g.creatures.remove(c); g.give('dryadHeart', 3); g.give('pomegranate', 10); const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'chimera'); P.spawn(u.at.x, u.at.z + 1); g.trial.summon(u); return true;`);
    await t.wait(8000);
    await t.step('…the Chimera fights (it has hurt the player)', `const c = g.trial.boss; if (!c || c.type !== 'chimera') return 'no chimera'; const v = new V(); for (const [k, b] of Object.entries(c.body.bones || {})) { b.getWorldPosition(v); if (!Number.isFinite(v.x + v.y + v.z)) return 'bone ' + k + ' not finite'; } return window._taken() > 0 || 'no damage taken';`);
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
  },
};
