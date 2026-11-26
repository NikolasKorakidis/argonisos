// Sound and music (Patch 21): the right recording plays at each moment of the game (sound.js logs every one it starts:
// AUDIO.log), the beds come in with the rain and the fires crackle where they burn, the music follows its rules
// (music.js: the boss's track for the fight, a land's track after the quiet, the home track by your fire) and its
// slider, nothing plays twice at once, and the mix: how loud the effects, the ambience and the music are at a few
// places and moments, so none of them blasts over the others. Patch 23: the boss fight's mix (the music loud and clear over
// the storm but the whole no louder than -13 LUFS, nothing clipping), the warnings heard, the rolling log's sounds in the
// mix, the actions that were silent (a swing, a roll, a stroke swimming, a landing by its fall, eating, the pack), the
// chime on the effects, and the music of Olympos and the shore. Patch 25: no birds in the rain, the footsteps -6 dB, the
// wind -3 dB, the lands' music -3 dB and playing all the while you're in a land, crossfaded from one land into the next.
import { visit } from '../lib/places.mjs';

// (A: sound.js's AUDIO; M: music.js's MUSIC; got: what of the log is that sound)
const A = `const A = AG.AUDIO, M = AG.MUSIC, Mu = await import('/src/audio/music.js'), It = (await import('/src/game/items.js')).ITEMS, In = (await import('/src/input.js')).input;
  const wait = (ms) => new Promise((r) => setTimeout(r, ms)), got = (k) => A.log.filter((e) => (Array.isArray(k) ? k.includes(e.k) : e.k === k)), called = (k) => (A.calls || []).filter((e) => e.k === k).length, cur = () => M.playing.find((p) => !p.out)?.key || null;`;
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
    // (the birds' beds, the dawn chorus with them, by day; the rain left to come in at its own pace)
    await t.step('no birdsong in the rain: the birds fall silent as it starts and sing again once it stops', `${A} AG.S.time = 0.32; AG.setWeather('clear'); AG.WEATHER.k.rain = 0;
      const lv = () => { const b = A.levels().beds; return +((b.bedBirds ?? 0) + (b.loopBirds ?? 0)).toFixed(3); }, t0 = performance.now(), sec = () => +((performance.now() - t0) / 1000).toFixed(1);
      let before = 0; for (let i = 0; i < 150 && (before = lv()) < 0.05; i++) await wait(100); if (before < 0.05) return 'no birds by day: ' + JSON.stringify(A.levels().beds);
      const t1 = sec(); AG.setWeather('lightRain'); let gone = null, at = 0; for (let i = 0; i < 300 && gone === null; i++) { if (lv() < 0.004) { gone = +(sec() - t1).toFixed(1); at = +AG.WEATHER.k.rain.toFixed(2); } else await wait(100); }
      let most = 0; for (let i = 0; i < 30; i++) { most = Math.max(most, lv()); await wait(100); }
      const t2 = sec(); AG.setWeather('clear'); AG.WEATHER.k.rain = 0; let back = null; for (let i = 0; i < 200 && back === null; i++) { if (lv() > 0.05) back = +(sec() - t2).toFixed(1); else await wait(100); }
      window._birds = { before, gone, rainThen: at, inRain: most, back }; return (gone !== null && most < 0.004 && back !== null) || JSON.stringify(window._birds);`);
    const birds = await t.eval('return window._birds;');
    t.metric('birds and rain (bed level by day; seconds after the rain began until silent, the rain then; loudest in the rain; seconds to sing again)', `${birds.before} · silent ${birds.gone} s (rain ${birds.rainThen}) · ${birds.inRain} in the rain · back ${birds.back} s`);
    // (the loudest of the wind's beds alone, the wind held still, weighed with and without its trim in turn)
    await t.step('the wind 30% quieter (-3 dB)', `${A} const S2 = await import('/src/audio/sound.js'); AG.S.still = true; Mu.stopMusic(0.1, 1e9); await wait(3000);
      const b = A.levels().beds, k = ['bedWindSoft', 'bedWindMid', 'bedWindStrong'].sort((p, q) => (b[q] ?? 0) - (b[p] ?? 0))[0]; if (!(b[k] > 0.01)) return 'no wind heard: ' + JSON.stringify(b);
      // (judged by the bed's own gain, untrimmed and trimmed in turn, four times each: the recording swells and falls by
      // several dB of its own over seconds, more than the trim, so its loudness is only shown)
      A.solo = k; const trim = S2.MIX.wind, weigh = async (x) => { S2.MIX.wind = x; await wait(3000); let p = 0, gn = 0; for (let i = 0; i < 20; i++) { p += 10 ** (A.meters().amb.lufs / 10); gn += A.levels().beds[k] ?? 0; await wait(100); } return [p / 20, gn / 20]; };
      let full = 0, now = 0, gf = 0, gt = 0; for (let r = 0; r < 4; r++) { const [p1, g1] = await weigh(1), [p2, g2] = await weigh(trim); full += p1; now += p2; gf += g1; gt += g2; } S2.MIX.wind = trim; A.solo = null; AG.S.still = false;
      const lu = (p) => +(10 * Math.log10(p / 4)).toFixed(1); window._wind = { bed: k, full: lu(full), now: lu(now), d: +(lu(now) - lu(full)).toFixed(1), gain: +(20 * Math.log10(gt / gf)).toFixed(1) };
      return (window._wind.gain < -2 && window._wind.gain > -4.5) || JSON.stringify(window._wind);`);
    const wind = await t.eval('return window._wind;');
    t.metric('the wind alone (its loudest bed, ambience LUFS): untrimmed → now', `${wind.bed} ${wind.full} → ${wind.now} (${wind.d} dB; its gain ${wind.gain} dB)`);
    await t.step('a melee hit: an axe\'s on flesh, a dagger\'s blade', `${A} P.yaw = 0; const c = g.creatures.spawn('hog', P.pos.x, P.pos.z + 1.4, { level: 0 }); c.hp = c.max = 9999;
      g.combat.strike(It.crudeAxe); await wait(120); g.combat.strike(It.crudeDagger); g.creatures.remove(c);
      return (got('axeHit').length === 1 && got('swordHit').length === 1 && got('axeHit')[0].vol > 0.2) || JSON.stringify(A.log);`);
    await t.step('two creatures hit by one blow, and a pickup taken twice in one moment, each make one sound', `${A} A.log = []; P.yaw = 0; const cs = [-0.5, 0.5].map((x) => g.creatures.spawn('hog', P.pos.x + x, P.pos.z + 1.3, { level: 0 })); for (const c of cs) c.hp = c.max = 9999;
      g.combat.strike(It.crudeAxe); g.sound('pick'); g.sound('pick'); for (const c of cs) g.creatures.remove(c);
      return (got('axeHit').length === 1 && got('pickupItem').length === 1) || JSON.stringify(A.log);`);
    await t.step('an axe on a tree, then the tree falling', `${A} const F = await import('/src/world/flora.js'); let tr = null, bd = 1e9;
      // (the trees' colliders come with their cells, a moment after the land on a busy machine: waited for)
      for (let k = 0; k < 100 && !tr; k++) { for (const c of g.colliders.near(P.pos.x, P.pos.z, 90)) { if (c.ref?.sp === undefined || F.SPECIES[c.ref.sp].res !== 'tree') continue; const d = Math.hypot(c.x - P.pos.x, c.z - P.pos.z); if (d < bd) { bd = d; tr = c; } } if (!tr) await wait(200); }
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
    await t.step('a door opening and closing, a chest opening and closing', `${A} const x = P.pos.x + 9, z = P.pos.z, y = AG.heightAt(x, z); const fr = B.place('doorframe', new V(x, y, z), 0), d = B.place('door', new V(x - 0.7, y, z), 0), ch = B.place('chest', new V(x + 6, AG.heightAt(x + 6, z), z), 0);   // (a door hangs in its frame)
      P.spawn(x, z - 1.6); P.yaw = 0; A.log = []; const it = () => B.interactable(P.pos, new V(Math.sin(P.yaw), 0, Math.cos(P.yaw)));
      it().use(); await wait(100); it().use(); const door = [got('doorOpen').length, got('doorClose').length];
      P.spawn(x + 6, z - 1.4); P.yaw = 0; it().use(); g.hud.toggle(false); In.uiOpen = false; B.update(0.016); const chest = [got('chestOpen').length, got('chestClose').length];
      return (door.join() === '1,1' && chest.join() === '1,1') || JSON.stringify({ door, chest, log: A.log.map((e) => e.k) });`);
    // (each bed is fetched and decoded the first time it's wanted, which on a busy machine takes some seconds: waited for.
    // One still playing from rain a little earlier, as when the game came up in rain before the tests set it clear, isn't
    // started again, only turned up: heard, as one started is)
    await t.step('rain: droplets as it starts, the downpour when heavy, the drumming under a roof, the hush inside', `${A} const heard = (k) => A.log.some((e) => e.k === k) || (A.levels().beds[k] ?? 0) > 0.05, came = async (k, s = 10) => { for (let i = 0; i < s * 10 && !heard(k); i++) await wait(100); return heard(k); };
      const was = A.levels().beds; if (['bedDrops', 'bedRain', 'bedRoof', 'bedMuffled'].some((k) => (was[k] ?? 0) > 0.05)) return 'a rain bed is heard before the rain: ' + JSON.stringify(was);
      A.log = []; AG.setWeather('lightRain'); const drops = await came('bedDrops');
      AG.setWeather('heavyRain'); AG.WEATHER.k.rain = 1; const pour = await came('bedRain');
      const ur = g.underRoof, rb = B.rayBlock; g.underRoof = () => true; const roof = await came('bedRoof');
      B.rayBlock = () => 1; const inside = await came('bedMuffled'); g.underRoof = ur; B.rayBlock = rb;
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
      // (the fight's mix: fought for 10 s, the hero unkillable, his blows and the boss's, its storm and its music)
      const b = g.trial.boss; P.stats.god = true; await wait(3000); let k = 0; const iv = setInterval(() => { k++; P.stats.heal(999); if (b && !b.dead && b.pos.distanceTo(P.pos) < 9) { P.yaw = Math.atan2(b.pos.x - P.pos.x, b.pos.z - P.pos.z); g.combat.strike(It.crudeAxe); } }, 700);
      window._bossMix = await (async () => { ${meter(10)} })(); clearInterval(iv); P.stats.god = false;
      A.calls = []; g.creatures.hurt(g.trial.boss, [[1e6, 'force']], null); const died = got('bossDeath').length; await wait(5000); const after = cur();
      for (const c of [...g.creatures.list]) g.creatures.remove(c); AG.setWeather('clear');
      return (call === 1 && early === 'bossMinotaur' && roar === 1 && during === 'bossMinotaur' && after !== 'bossMinotaur' && died === 1) || JSON.stringify({ call, early, roar, during, after, died });`);
    const boss = await t.eval('return window._bossMix;');
    t.metric('mix: the Minotaur fight (LUFS, loudest moment, peak dBFS)', Object.entries(boss).filter(([b]) => b !== 'lyre').map(([b, x]) => `${b} ${x.lufs} (${x.top}, ${x.peak})`).join(' · '));
    // (the bosses' tracks a fifth louder since 25 Nov and the fight's storm heavier, both the user's wish: the whole some
    // 2 dB louder by design, -12.5 at most, and still never clipping)
    t.check('the boss fight: the music loud and clear (over the ambience and its storm, not far under the blows), the whole about -13 LUFS (-12.5 at most), never clipping', boss.music.lufs > boss.amb.lufs + 3 && boss.music.lufs > boss.sfx.lufs - 3 && boss.out.lufs < -12.5 && boss.out.lufs > -21 && boss.out.peak < -0.5, JSON.stringify(boss));
    await visit(t, 'forest');
    // (silent: nothing playing, or the music bus under -60 LUFS; the longest such spell, in seconds)
    const hush = `let run = 0, worst = 0; const look = () => { const q = !cur() || A.meters().music.lufs < -60; run = q ? run + 0.1 : 0; worst = Math.max(worst, run); };`;
    await t.step('in a land its music plays all the time: a few seconds after you come in, whatever the quiet, 30% under the others, and on from one round into the next without a break', `${A} ${hush} AG.S.still = false; Mu.stopMusic(0.2, 1e9); await wait(800); M.ended = {}; M.last = null; M.log = []; M.quiet = 1e9;
      M.rest = 0; M.D.land = 0; const t0 = performance.now(); for (let i = 0; i < 100 && cur() !== 'yleos'; i++) await wait(100); const came = +((performance.now() - t0) / 1000).toFixed(1);
      if (cur() !== 'yleos') return 'no Yleos: ' + JSON.stringify({ now: cur(), land: M.D.land, log: M.log });
      const p = M.playing.find((q) => !q.out), vol = p.vol; for (let i = 0; i < 50 && !(p.el?.duration > 0); i++) await wait(100);
      // (on to the end of this round; if the stream can't seek, it plays out)
      await wait(2000); try { p.el.currentTime = Math.max(0, p.el.duration - 8); } catch { /* plays out */ } const t1 = performance.now(); let after = 0;
      while (performance.now() - t1 < 80000 && after < 60) { look(); if (M.log.length >= 2) after++; await wait(100); }
      window._round = { came, vol, rounds: M.log.map((e) => e.key), worst: +worst.toFixed(1) };
      return (came < 8 && vol === 0.7 && M.log.length === 2 && M.log[1].key === 'yleos' && worst < 1.5) || JSON.stringify(window._round);`);
    const round = await t.eval('return window._round;');
    t.metric('a land\'s music: seconds to start on coming in · rounds · longest silence (s)', `${round.came} · ${round.rounds.join(' → ')} · ${round.worst}`);
    await t.step('crossing into another land crossfades into its music, never silent on the way; in Pedias by night the title\'s theme, crossfaded in at dusk and out at dawn', `${A} ${hush} window._back = [P.pos.x, P.pos.z]; M.log = []; AG.teleport(-220, 360);
      for (let i = 0; i < 150 && cur() !== 'pedias'; i++) { look(); await wait(100); } for (let i = 0; i < 40; i++) { look(); await wait(100); } const day = cur(), w1 = worst;
      AG.S.time = 0.86; for (let i = 0; i < 200 && cur() !== 'menu'; i++) { look(); await wait(100); } for (let i = 0; i < 60; i++) { look(); await wait(100); } const q = M.playing.find((p) => !p.out), night = q?.key, nl = q?.land, w2 = worst; worst = run = 0;
      AG.S.time = 0.3; for (let i = 0; i < 200 && cur() !== 'pedias'; i++) { look(); await wait(100); } for (let i = 0; i < 40; i++) { look(); await wait(100); } const dawn = cur();
      AG.teleport(...window._back); window._pedias = { day, night, dawn, silent: [w1, w2, +worst.toFixed(1)].map((x) => +x.toFixed(1)) };
      return (day === 'pedias' && night === 'menu' && nl === 0 && dawn === 'pedias' && w1 < 1.5 && w2 < 2.5 && worst < 2.5) || JSON.stringify({ ...window._pedias, land: M.D.land, log: M.log });`);
    const ped = await t.eval('return window._pedias;');
    t.metric('Pedias: by day → by night → at dawn · longest silence on crossing in, at dusk, at dawn (s)', `${ped.day} → ${ped.night} → ${ped.dawn} · ${ped.silent.join(' / ')}`);
    await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 });
    await t.step('the lands\' music 30% quieter (-3 dB) than a track at full', `${A} const go = async (o) => { Mu.stopMusic(0.1, 1e9); await wait(1500); Mu.playTrack('pedias', o); await wait(3500); let p = 0; for (let i = 0; i < 50; i++) { p += 10 ** (A.meters().music.lufs / 10); await wait(100); } return +(10 * Math.log10(p / 50)).toFixed(1); };
      const full = await go({ vol: 1 }), land = await go(); Mu.stopMusic(0.3); window._land = { full, land, d: +(land - full).toFixed(1) };
      return (window._land.d < -2.3 && window._land.d > -4) || JSON.stringify(window._land);`);
    const land = await t.eval('return window._land;');
    t.metric('Pedias\'s track, seconds 3.5 to 8.5 (music LUFS): at full → as a land\'s', `${land.full} → ${land.land} (${land.d} dB)`);
    await t.step('the music follows its slider', `${A} const St = await import('/src/ui/settings.js'), v0 = St.SETTINGS.music; St.setMusic(0); let off = 0; for (let i = 0; i < 30 && !(off < -90); i++) { await wait(100); off = A.meters().music.lufs; }   // (waited for: the meter hears the last third of a second, and a busy machine's audio runs behind)
      St.setMusic(0.5); let on = -200; for (let i = 0; i < 20; i++) { await wait(100); on = Math.max(on, A.meters().music.lufs); } St.setMusic(v0);
      return (off < -90 && on > -60) || JSON.stringify({ off, on });`);
    await t.step('sitting by your fire a little while plays the home track (over the land\'s music)', `${A} Mu.stopMusic(0.2); await wait(800); M.ended = {}; M.log = []; AG.S.freeBuild = true;
      const x = P.pos.x + 1.6, z = P.pos.z; B.place('campfire', new V(x, AG.heightAt(x, z), z), 0); g.acts.sit(); const sat = g.acts.pose?.kind === 'sit';
      for (let i = 0; i < 120 && cur() !== 'base'; i++) await wait(100); const home = cur(); g.acts.stand?.();
      return (home === 'base' && M.log.filter((e) => e.key === 'base').length === 1) || JSON.stringify({ sat, home, log: M.log, homeT: M.D.homeT });`);
    await t.step('the actions that were silent: a swing (a miss too), a roll, a stroke swimming, a landing by its fall, footsteps by gait, eating, the pack, a guard broken, a piece struck', `${A} const S2 = await import('/src/audio/sound.js'); A.log = []; A.calls = [];
      for (const c of [...g.creatures.list]) g.creatures.remove(c); P.yaw = 0; g.combat.strike(It.crudeAxe); const swing = got('whoosh').length;
      P.onStep('roll'); await wait(500); const roll = got('roll').length; P.onStep('swim'); const swim = got('swimStroke').length;
      S2.GAIT.fall = 6; A.log = []; P.onStep('land'); await wait(100); S2.GAIT.fall = 16; P.onStep('land'); const lands = A.log.filter((e) => e.k.startsWith('land')).map((e) => e.vol);
      S2.GAIT.k = 0.5; A.log = []; g.sound('step', 'stone'); await wait(80); S2.GAIT.k = 1.3; g.sound('step', 'stone'); const steps = got('stepRock').map((e) => e.vol); S2.GAIT.k = 1;
      g.sound('eat', { food: It.raspberries?.food }); g.hud.toggle(true); g.hud.toggle(false); In.uiOpen = false; g.sound('guardBreak'); g.sound('pieceHit', { at: P.pos.clone() });
      const ok = swing === 1 && roll >= 1 && swim === 1 && lands.length === 2 && lands[1] > lands[0] * 1.6 && steps.length === 2 && steps[1] > steps[0] * 1.8 && called('eat') === 1 && called('ui') === 2 && got('parryHit').length >= 1 && called('pieceHit') === 1;
      return ok || JSON.stringify({ swing, roll, swim, lands, steps, calls: A.calls.map((e) => e.k), log: A.log.map((e) => e.k) });`);
    // (each step's loudest moment on the effects bus, the beds silenced, eight steps on grass or bare earth and on stone,
    // as power)
    await t.step('the hero\'s footsteps at half their loudness (-6 dB)', `${A} const S2 = await import('/src/audio/sound.js'); A.solo = 'none'; Mu.stopMusic(0.1, 1e9); S2.GAIT.k = 1; await wait(1500);
      const top = async () => { let m = -200; for (let i = 0; i < 14; i++) { m = Math.max(m, A.meters().sfx.lufs); await wait(40); } return m; };
      const weigh = async (x) => { S2.MIX.step = x; let p = 0; for (let i = 0; i < 8; i++) { g.sound('step', i % 2 ? 'stone' : 'ground'); p += 10 ** (await top() / 10); await wait(300); } return +(10 * Math.log10(p / 8)).toFixed(1); };
      const trim = S2.MIX.step, full = await weigh(1), now = await weigh(trim); S2.MIX.step = trim; A.solo = null; M.rest = 0; window._steps = { full, now, d: +(now - full).toFixed(1) };
      return (window._steps.d < -4.5 && window._steps.d > -7.5) || JSON.stringify(window._steps);`);
    const steps = await t.eval('return window._steps;');
    t.metric('a footstep\'s loudest moment (effects LUFS): untrimmed → now', `${steps.full} → ${steps.now} (${steps.d} dB)`);
    await t.step('a rolling log: its rumble a live voice in the mix, following it, and its thud and crack', `${A} const S2 = await import('/src/audio/sound.js'); A.log = []; A.calls = [];
      const v = S2.voice('logRumble'), at = P.pos.clone().add(new V(4, 0, 0)); v.set(at, 1, 1); await wait(400); const m = A.meters().sfx.lufs; at.x += 3; v.set(at, 0.5, 1); v.stop();
      g.sound('logThud', { at, k: 1 }); const src = await (await fetch('/src/game/harvest.js')).text();
      return (got('logRumble').length === 1 && m > -60 && got('logThud').length === 1 && got('hitTree').length === 1 && !/createGain|THUNDER/.test(src)) || JSON.stringify({ log: A.log.map((e) => e.k), m });`);
    await t.step('a creature killed falls where it lies (placed: a far one quieter), a skeleton\'s bones are struck as bone', `${A} A.log = []; g.sound('kill', { at: P.pos.clone().add(new V(3, 0, 0)), type: 'hog' }); await wait(400); g.sound('kill', { at: P.pos.clone().add(new V(40, 0, 0)), type: 'hog' }); await wait(400);
      const falls = got('landGrass').map((e) => e.vol); A.log = []; g.sound('hit', { at: P.pos.clone().add(new V(2, 1, 0)), kind: 'axe', type: 'skeleton' }); const bone = got('blockHit').length;
      return (falls.length === 2 && falls[1] < falls[0] * 0.5 && bone === 1) || JSON.stringify({ falls, log: A.log.map((e) => e.k) });`);
    // (each alone, the beds silenced: their loudest moment on the effects bus, LUFS)
    await t.step('the warnings are heard: the Minotaur\'s snort at 15 m, a skeleton\'s bones at 4 m, a dryad\'s thorn; the guide\'s chime with the music off', `${A} A.solo = 'none'; Mu.stopMusic(0.1); const St = await import('/src/ui/settings.js'), v0 = St.SETTINGS.music; await wait(1500);
      const top = async (fn) => { let m = -200; for (let r = 0; r < 3; r++) { fn(); for (let i = 0; i < 25; i++) { m = Math.max(m, A.meters().sfx.lufs); await wait(60); } await wait(600); } return +m.toFixed(1); };   // (the loudest of three: each play takes a variant at a varied volume)
      const snort = await top(() => g.sound('snort', { at: P.pos.clone().add(new V(15, 8, 0)) })), bones = await top(() => g.sound('boneRattle', { at: P.pos.clone().add(new V(4, 1, 0)) })), thorn = await top(() => g.sound('thornThrow', 1));
      St.setMusic(0); const chime = await top(() => g.sound('chime')); St.setMusic(v0); A.solo = null;
      return (snort > -26 && bones > -36 && thorn > -30 && chime > -45) || JSON.stringify({ snort, bones, thorn, chime });`);
    await t.step('the places\' music: Oros on the climb up Olympos, the shore\'s (Nisia or Siren Reef) at dawn', `${A} const Pk = (await import('/src/world/gen.js')).PEAK; let at = null;
      for (let r = 0.2; r < 0.8 && !at; r += 0.02) for (let a = 0; a < 6.28; a += 0.2) { const x = Pk.x + Math.cos(a) * Pk.r * r, z = Pk.z + Math.sin(a) * Pk.r * r; if (AG.heightAt(x, z) > 200) { at = [x, z]; break; } }
      if (!at) return 'no high ground on Olympos'; Mu.stopMusic(0.1); await wait(500); M.ended = {}; M.last = null; M.log = []; AG.teleport(at[0], at[1]); await wait(1500);
      M.quiet = 0; M.D.landT = 30; for (let i = 0; i < 40 && cur() !== 'oros'; i++) await wait(100); const oros = cur();
      Mu.stopMusic(0.1); await wait(500); M.ended = {}; M.last = null; let sh = null; for (let a = 0; a < 6.28 && !sh; a += 0.1) for (let r = 100; r < 2400; r += 15) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (AG.heightAt(x, z) < -1.5) { for (let back = 4; back < 40 && !sh; back += 2) { const bx = Math.cos(a) * (r - back), bz = Math.sin(a) * (r - back); if (AG.heightAt(bx, bz) > 0.3) sh = [bx, bz]; } break; } }
      if (!sh) return 'no shore found'; AG.teleport(sh[0], sh[1]); await wait(2500); M.quiet = 0; M.D.landNew = false; M.D.dawn = 30;
      for (let i = 0; i < 40 && !['nisia', 'sirenReef'].includes(cur()); i++) await wait(100); const shore = cur(), sea = g.amb.sea; Mu.stopMusic(0.1); M.quiet = 600;
      return (oros === 'oros' && ['nisia', 'sirenReef'].includes(shore)) || JSON.stringify({ oros, shore, sea, land: M.D.land, alt: P.pos.y });`);
    await t.step('never two tracks at once (crossfades aside), and no sound started twice in the same instant', `${A}
      const dup = []; const last = {}; for (const e of AG.AUDIO.log || []) { if (e.bed || e.fire) continue; if (last[e.k] !== undefined && Math.abs(e.t - last[e.k]) < 0.04) dup.push(e.k); last[e.k] = e.t; }
      return (window._most <= 1 && !dup.length) || JSON.stringify({ most: window._most, dup });`);
    // ---- the mix: effects, ambience and music at a few places and moments. The beds are weighed with the storm wall's
    // lightning held (its thunder is heard all over the island, now and then: it has a place of its own at the end)
    const mix = {};
    await t.eval(`${A} AG.S.still = false; AG.S.timeScale = 0; AG.S.time = 0.3; AG.STORM_WALL.quiet = true; AG.setWeather('clear'); AG.WEATHER.k.rain = 0; Mu.stopMusic(0.2, 1e9); for (const c of [...g.creatures.list]) g.creatures.remove(c); AG.teleport(300, -300); return true;`);
    await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 }); await t.wait(5000);
    mix['meadow, day'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} Mu.playTrack('pedias'); return true;`); await t.wait(3000);
    mix['meadow, day, with music'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} Mu.stopMusic(0.2, 1e9); P.yaw = 0; window._foe = g.creatures.spawn('hog', P.pos.x, P.pos.z + 1.4, { level: 0 }); window._foe.hp = window._foe.max = 1e6; return true;`); await t.wait(1500);
    mix['a fight'] = await t.eval(`${A} const foe = window._foe; let k = 0; const iv = setInterval(() => { k++; P.yaw = Math.atan2(foe.pos.x - P.pos.x, foe.pos.z - P.pos.z); g.combat.strike(k % 3 ? It.crudeDagger : It.crudeAxe); if (k % 4 === 0) { P.stats.heal(99); g.combat.hitPlayer(foe, [3, 4, 'pierce']); } }, 600);
      const r = await (async () => { ${meter(6)} })(); clearInterval(iv); g.creatures.remove(foe); return r;`);
    await t.eval(`${A} AG.setWeather('heavyRain'); AG.WEATHER.k.rain = 1; return true;`); await t.wait(4000);
    mix['meadow, heavy rain'] = await t.eval(`${A} ${meter(6)}`);
    await t.eval(`${A} AG.setWeather('clear'); AG.WEATHER.k.rain = 0; return true;`);
    await visit(t, 'forest');
    await t.eval(`${A} AG.S.still = false; AG.S.time = 0.86; AG.STORM_WALL.quiet = true; M.rest = 0; return true;`); await t.wait(5000);   // (the land's music with it, as it now always is)
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
