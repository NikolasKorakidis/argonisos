// Sound and music (Patch 21): the right recording plays at each moment of the game (sound.js logs every one it starts:
// AUDIO.log), the beds come in with the rain and the fires crackle where they burn, the music follows its rules
// (music.js: the boss's track for the fight, a land's track after the quiet, the home track by your fire) and its
// slider, nothing plays twice at once, and the mix: how loud the effects, the ambience and the music are at a few
// places and moments, so none of them blasts over the others.
import { visit } from '../lib/places.mjs';

// (A: sound.js's AUDIO; M: music.js's MUSIC; got: what of the log is that sound)
const A = `const A = AG.AUDIO, M = AG.MUSIC, Mu = await import('/src/audio/music.js'), It = (await import('/src/game/items.js')).ITEMS, In = (await import('/src/input.js')).input;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), got = (k) => A.log.filter((e) => (Array.isArray(k) ? k.includes(e.k) : e.k === k)), cur = () => M.playing.find((p) => !p.out)?.key || null;`;
// the meters, read every tenth of a second for a while: each bus's mean loudness (RMS, dBFS, as power) and its peak
// (loudness: the mean of each moment's, as power, in LUFS near enough; top: the loudest moment; peak: the highest sample)
const meter = (secs) => `const S = {}; for (let i = 0; i < ${secs * 10}; i++) { const m = A.meters(); for (const [k, v] of Object.entries(m)) { const s = (S[k] ||= { p: 0, n: 0, top: -200, pk: -200 }); s.p += 10 ** (v.lufs / 10); s.n++; s.top = Math.max(s.top, v.lufs); s.pk = Math.max(s.pk, v.peak); } await wait(100); }
  const out = {}; for (const [k, s] of Object.entries(S)) out[k] = { lufs: +(10 * Math.log10(s.p / s.n + 1e-12)).toFixed(1), top: +s.top.toFixed(1), peak: +s.pk.toFixed(1) }; return out;`;

export default {
  name: 'Sound and music',
  order: 80,
  async run(t) {
    await t.page.waitForFunction(() => AG.AUDIO.ready && AG.AUDIO.ctx()?.state === 'running', null, { timeout: 60000 });
    await t.step('the recordings and the music are there, and a new trial opens with Story-Telling', `${A} const n = Object.keys(A.META).length, m = Object.keys(A.music).length;
      // (a sampler from now to the end: how many tracks sound at once, not counting those fading out)
      window._most = 0; setInterval(() => { window._most = Math.max(window._most, M.playing.filter((p) => !p.out).length); }, 50);
      return (n >= 75 && m === 14 && A.has('swordHit') && M.last === 'story') || JSON.stringify({ n, m, last: M.last });`);
    await visit(t, 'meadow');
    await t.eval(`${A} AG.S.still = false; AG.S.timeScale = 0; Mu.stopMusic(0.3); A.log = []; M.log = []; return true;`);
    await t.step('a melee hit: an axe\'s on flesh, a dagger\'s blade', `${A} P.yaw = 0; const c = g.creatures.spawn('hog', P.pos.x, P.pos.z + 1.4, { level: 0 }); c.hp = c.max = 9999;
      g.combat.strike(It.crudeAxe); await wait(120); g.combat.strike(It.crudeDagger); g.creatures.remove(c);
      return (got('axeHit').length === 1 && got('swordHit').length === 1 && got('axeHit')[0].vol > 0.2) || JSON.stringify(A.log);`);
    await t.step('two creatures hit by one blow, and a pickup taken twice in one moment, each make one sound', `${A} A.log = []; P.yaw = 0; const cs = [-0.5, 0.5].map((x) => g.creatures.spawn('hog', P.pos.x + x, P.pos.z + 1.3, { level: 0 })); for (const c of cs) c.hp = c.max = 9999;
      g.combat.strike(It.crudeAxe); g.sound('pick'); g.sound('pick'); for (const c of cs) g.creatures.remove(c);
      return (got('axeHit').length === 1 && got('pickupItem').length === 1) || JSON.stringify(A.log);`);
    await t.step('an axe on a tree, then the tree falling', `${A} const F = await import('/src/world/flora.js'); let tr = null, bd = 1e9;
      for (const c of g.colliders.near(P.pos.x, P.pos.z, 45)) { if (c.ref?.sp === undefined || F.SPECIES[c.ref.sp].res !== 'tree') continue; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < bd) { bd = d; tr = c; } }
      if (!tr) return 'no tree near'; P.spawn(tr.x, tr.z - tr.r - 0.9); P.yaw = Math.atan2(tr.x - P.pos.x, tr.z - P.pos.z); A.log = [];
      g.harvest.strike(It.crudeAxe); const first = got('hitTree').length;
      for (let i = 0; i < 80 && !g.harvest.falling.length; i++) { g.harvest.strike(It.lightstoneAxe); await wait(60); }
      for (let i = 0; i < 80 && !got('fallingTree').length; i++) await wait(100);
      return (first === 1 && got('fallingTree').length === 1) || JSON.stringify({ first, falling: g.harvest.falling.length, log: A.log.map((e) => e.k) });`);
    await t.step('a pickaxe on rock', `${A} const F = await import('/src/world/flora.js'); let rk = null, bd = 1e9;
      for (const c of g.colliders.near(P.pos.x, P.pos.z, 80)) { if (c.ref?.sp === undefined || F.SPECIES[c.ref.sp].res !== 'rock') continue; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < bd) { bd = d; rk = c; } }
      if (!rk) return 'no rock near'; P.spawn(rk.x, rk.z - rk.r - 0.7); P.yaw = Math.atan2(rk.x - P.pos.x, rk.z - P.pos.z); A.log = []; g.harvest.strike(It.pickaxe);
      return got('mineHit').length === 1 || JSON.stringify(A.log);`);
    await t.page.waitForFunction(() => AG.game.pickups.visible.length > 5, null, { timeout: 60000 });
    await t.step('picking something up', `${A} const v = g.pickups.visible[0]; P.spawn(v.x, v.z - 0.9); P.yaw = 0; A.log = []; g.interact(); return got('pickupItem').length === 1 || JSON.stringify(A.log.map((e) => e.k));`);
    await t.step('building a piece (a campfire: it\'s lit as it\'s laid)', `${A} AG.S.freeBuild = true; g.give('hammer'); const h = inv.slots.findIndex((s) => s?.id === 'hammer' && !s.worn); if (!inv.slots[h].worn) g.useSlot(h);
      B.select('campfire'); P.camPitch = -0.55; P.camDist = 4; await wait(300); const r = B.placeGhost(); if (!r || r.why) return 'cannot place: ' + r?.why;
      A.log = []; In.clicks.push(0); B.update(0.016); In.clicks.length = 0; B.sel = null; if (B.ghost) { g.scene.remove(B.ghost); B.ghost = null; } g.useSlot(h);
      window._fire = B.placed.find((p) => p.def.fire); return (got('buildPiece').length === 1 && got('fireStart').length === 1) || JSON.stringify(A.log.map((e) => e.k));`);
    await t.step('a lit fire crackles where it burns; lighting one, and putting it out', `${A} const f = window._fire; P.spawn(f.pos.x - 1.6, f.pos.z); P.yaw = Math.PI / 2; await wait(1500); const loop = A.log.some((e) => e.k === 'bedFire' && e.fire === f.uid);
      const fw = new V(1, 0, 0); A.log = []; B.interactable(P.pos, fw).alt.use(); const doused = got('fireDouse').length; g.give('wood', 2); B.interactable(P.pos, fw).use(); const lit = got('fireStart').length;
      return (loop && doused === 1 && lit === 1 && f.state.lit) || JSON.stringify({ loop, doused, lit, log: A.log.map((e) => e.k) });`);
    await t.step('a door opening and closing, a chest opening and closing', `${A} const x = P.pos.x + 9, z = P.pos.z, y = AG.heightAt(x, z); const d = B.place('door', new V(x, y, z), 0), ch = B.place('chest', new V(x + 6, AG.heightAt(x + 6, z), z), 0);
      P.spawn(x, z - 1.6); P.yaw = 0; A.log = []; const it = () => B.interactable(P.pos, new V(Math.sin(P.yaw), 0, Math.cos(P.yaw)));
      it().use(); await wait(100); it().use(); const door = [got('doorOpen').length, got('doorClose').length];
      P.spawn(x + 6, z - 1.4); P.yaw = 0; it().use(); g.hud.toggle(false); In.uiOpen = false; B.update(0.016); const chest = [got('chestOpen').length, got('chestClose').length];
      return (door.join() === '1,1' && chest.join() === '1,1') || JSON.stringify({ door, chest, log: A.log.map((e) => e.k) });`);
    await t.step('rain: droplets as it starts, the downpour when heavy, the drumming under a roof, the hush inside', `${A} A.log = []; AG.setWeather('lightRain'); for (let i = 0; i < 60 && !A.log.some((e) => e.k === 'bedDrops'); i++) await wait(100); const drops = A.log.some((e) => e.k === 'bedDrops');
      AG.setWeather('heavyRain'); AG.WEATHER.k.rain = 1; await wait(1500); const pour = A.log.some((e) => e.k === 'bedRain');
      const ur = g.underRoof, rb = B.rayBlock; g.underRoof = () => true; await wait(1200); const roof = A.log.some((e) => e.k === 'bedRoof');
      B.rayBlock = () => 1; await wait(1500); const inside = A.log.some((e) => e.k === 'bedMuffled'); g.underRoof = ur; B.rayBlock = rb;
      AG.setWeather('clear'); AG.WEATHER.k.rain = 0; return (drops && pour && roof && inside) || JSON.stringify({ drops, pour, roof, inside });`);
    await t.step('a lightning strike: a close one cracks and bursts, a far one rolls, each when its sound arrives', `${A} const Lg = await import('/src/world/lightning.js'), S2 = await import('/src/audio/sound.js'); A.log = [];
      const strike = (d) => { const x = P.pos.x + d, z = P.pos.z, gy = AG.heightAt(x, z); Lg.strike({ at: new V(x, gy + 220, z), ground: new V(x, gy, z) }); return { at: S2.THUNDER.at, now: S2.THUNDER.now(), delay: Lg.LIGHTNING.last.delay }; };
      const near = strike(90), clap = got('thunderClap')[0]; A.log = []; const far = strike(2400), roll = got('thunderFar')[0];
      const ok = clap && roll && Math.abs(clap.t - near.at) < 0.05 && Math.abs(near.at - near.now - near.delay) < 0.1 && Math.abs(roll.t - far.at) < 0.2 && far.at - far.now > 6;
      return ok || JSON.stringify({ near, far, clap, roll });`);
    await t.step('a boss summoned: its call, its music for the fight, and the music fading once it dies', `${A} const s = g.SITES.labyrinth; AG.teleport(s.x + 8, s.z + 8); await wait(4000);
      const u = g.structures.uses.find((u) => u.kind === 'summon' && u.boss === 'minotaur'); if (!u) return 'no altar';
      g.give('deerHide', 5); g.give('olive', 10); A.log = []; M.log = []; g.trial.summon(u); await wait(300); const call = got('bossSummon').length, early = cur();
      for (let i = 0; i < 60 && !g.trial.boss; i++) await wait(100); await wait(300); const roar = got('bossRoarLong').length, during = cur();
      g.creatures.hurt(g.trial.boss, [[1e6, 'force']], null); await wait(5000); const after = cur();
      for (const c of [...g.creatures.list]) g.creatures.remove(c); AG.setWeather('clear');
      return (call === 1 && early === 'bossMinotaur' && roar === 1 && during === 'bossMinotaur' && after !== 'bossMinotaur') || JSON.stringify({ call, early, roar, during, after });`);
    await visit(t, 'forest');
    await t.step('coming into a land after the quiet plays its track (and not before the quiet is over)', `${A} AG.S.still = false; Mu.stopMusic(0.2); await wait(800); M.ended = {}; M.last = null; M.log = [];
      M.D.land = 0; await wait(1500); if (M.D.land !== 1) return 'not in Yleos: ' + M.D.land;
      M.quiet = 100; M.D.landT = 25; await wait(500); const early = cur(); M.quiet = 0; await wait(500);
      return (early === null && cur() === 'yleos' && M.log.length === 1) || JSON.stringify({ early, now: cur(), log: M.log });`);
    await t.step('the music follows its slider', `${A} const St = await import('/src/ui/settings.js'), v0 = St.SETTINGS.music; St.setMusic(0); await wait(400); const off = A.meters().music.lufs;
      St.setMusic(0.5); let on = -200; for (let i = 0; i < 20; i++) { await wait(100); on = Math.max(on, A.meters().music.lufs); } St.setMusic(v0);
      return (off < -90 && on > -60) || JSON.stringify({ off, on });`);
    await t.step('sitting by your fire a little while plays the home track', `${A} Mu.stopMusic(0.2); await wait(800); M.ended = {}; M.log = []; AG.S.freeBuild = true;
      const x = P.pos.x + 1.6, z = P.pos.z; B.place('campfire', new V(x, AG.heightAt(x, z), z), 0); g.acts.sit(); const sat = g.acts.pose?.kind === 'sit';
      for (let i = 0; i < 120 && cur() !== 'base'; i++) await wait(100); const home = cur(); g.acts.stand?.();
      return (home === 'base' && M.log.length === 1) || JSON.stringify({ sat, home, log: M.log, homeT: M.D.homeT });`);
    await t.step('never two tracks at once (crossfades aside), and no sound started twice in the same instant', `${A}
      const dup = []; const last = {}; for (const e of AG.AUDIO.log || []) { if (e.bed || e.fire) continue; if (last[e.k] !== undefined && Math.abs(e.t - last[e.k]) < 0.04) dup.push(e.k); last[e.k] = e.t; }
      return (window._most <= 1 && !dup.length) || JSON.stringify({ most: window._most, dup });`);
    // ---- the mix: effects, ambience and music at a few places and moments. The beds are weighed with the storm wall's
    // lightning held (its thunder is heard all over the island, now and then: it has a place of its own at the end)
    const mix = {};
    await t.eval(`${A} AG.S.still = false; AG.S.timeScale = 0; AG.S.time = 0.3; AG.STORM_WALL.quiet = true; AG.setWeather('clear'); AG.WEATHER.k.rain = 0; Mu.stopMusic(0.2); for (const c of [...g.creatures.list]) g.creatures.remove(c); AG.teleport(300, -300); return true;`);
    await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 }); await t.wait(5000);
    mix['meadow, day'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} Mu.playTrack('pedias'); return true;`); await t.wait(3000);
    mix['meadow, day, with music'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} Mu.stopMusic(0.2); P.yaw = 0; window._foe = g.creatures.spawn('hog', P.pos.x, P.pos.z + 1.4, { level: 0 }); window._foe.hp = window._foe.max = 1e6; return true;`); await t.wait(1500);
    mix['a fight'] = await t.eval(`${A} const foe = window._foe; let k = 0; const iv = setInterval(() => { k++; P.yaw = Math.atan2(foe.pos.x - P.pos.x, foe.pos.z - P.pos.z); g.combat.strike(k % 3 ? It.crudeDagger : It.crudeAxe); if (k % 4 === 0) { P.stats.heal(99); g.combat.hitPlayer(foe, [3, 4, 'pierce']); } }, 600);
      const r = await (async () => { ${meter(6)} })(); clearInterval(iv); g.creatures.remove(foe); return r;`);
    await t.eval(`${A} AG.setWeather('heavyRain'); AG.WEATHER.k.rain = 1; return true;`); await t.wait(4000);
    mix['meadow, heavy rain'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} AG.setWeather('clear'); AG.WEATHER.k.rain = 0; return true;`);
    await visit(t, 'forest');
    await t.eval(`${A} AG.S.still = false; AG.S.time = 0.86; AG.STORM_WALL.quiet = true; return true;`); await t.wait(5000);
    mix['forest, night'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} AG.S.time = 0.3; AG.STORM_WALL.quiet = false; AG.teleport(6, 4); return true;`); await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 }); await t.wait(4000);
    mix['the shore, 700 m from the storm wall'] = await t.eval(`${A} ${meter(10)}`);
    for (const [k, v] of Object.entries(mix)) t.metric(`mix: ${k} (LUFS, loudest moment, peak dBFS)`, Object.entries(v).filter(([b]) => b !== 'lyre').map(([b, x]) => `${b} ${x.lufs} (${x.top}, ${x.peak})`).join(' · '));
    const all = Object.values(mix), fight = mix['a fight'], tune = mix['meadow, day, with music'];
    t.check('nothing clips (the output\'s peak under -0.5 dBFS everywhere)', all.every((m) => m.out.peak < -0.5), JSON.stringify(all.map((m) => m.out)));
    t.check('the world is always heard (the ambience at -45 LUFS or louder)', all.every((m) => m.amb.lufs > -45), JSON.stringify(all.map((m) => m.amb)));
    t.check('the ambience stays a bed (under -24 LUFS, even in a downpour)', all.every((m) => m.amb.lufs < -24), JSON.stringify(all.map((m) => m.amb)));
    t.check('in a fight the blows stand out over the ambience, but don\'t blast (their loudest moments 6 to 22 LU over it, under -10 LUFS)', fight.sfx.top - fight.amb.lufs > 6 && fight.sfx.top - fight.amb.lufs < 22 && fight.sfx.top < -10, JSON.stringify(fight));
    t.check('the music sits with the world: over the ambience, but by no more than 10 LU', tune.music.lufs - tune.amb.lufs > 0 && tune.music.lufs - tune.amb.lufs < 10, JSON.stringify(tune));
  },
};
