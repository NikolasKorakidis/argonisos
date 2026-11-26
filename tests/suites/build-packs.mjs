// The three building packs' pieces on trial (the reviewer, 26 Nov: every building piece of RPGPP_AG, Synty Vikings and
// Synty Ancient Empire in the game, to choose from; build/pieces.js packDef, tools/assets/pack-pieces.mjs): only with
// Free build on, nothing loaded until wanted, and each kind of piece from each pack snaps where a player aims and stands
// once built, as our own do; a door fills a doorway of its size; they save and load.
import { LIB } from '../lib/building.mjs';

const FLAT = `const flat = (x0, z0) => { for (let r = 0; r < 400; r += 7) for (let a = 0; a < 6.28; a += 0.5) { const x = x0 + r * Math.cos(a), z = z0 + r * Math.sin(a), h = AG.heightAt(x, z); let ok = h > 2; for (const [u, v] of [[-10, -10], [10, -10], [-10, 10], [10, 10], [0, 0]]) if (Math.abs(AG.heightAt(x + u, z + v) - h) > 0.5) ok = false; if (ok) return { x, z, y: h }; } return null; };
  const clearAround = (x, z, r) => { for (const q of [...g.colliders.near(x, z, r)]) if (q.ref?.cx !== undefined) { AG.veg.remove(q.ref.cx, q.ref.cz, q.ref.i); g.colliders.removeOne(q); } };`;
// (a piece placed as a player places it: the ghost aimed somewhere, then a click; whether it's held up as allowed: on the
// ground, sharing a point with what's built, in a doorway, or (a trim) against it)
const HELD = `const { PIECES } = await import('/src/build/pieces.js'); const I = (await import('/src/input.js')).input;
  const held = (def, pos, rot) => B.grounded(def, pos, rot) || B.snapsOf(def, pos, rot).some((m) => B.placed.some((q) => q.snaps.some((s) => s.distanceTo(m) < 0.05))) || (def.door && B.doorFrameAt(pos, rot, def)) || (def.pack?.tpl === 'deco' && B.neighbours(def, pos, rot).length > 0);
  const click = () => { const before = new Set(B.placed); I.clicks.push(0); B.update(0.016); I.clicks.length = 0; B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; return B.placed.find((q) => !before.has(q)); };
  const stands = (p) => { B.recompute(); return !!p && !p.gone && p.support >= 0.1; };`;

export default {
  name: 'Building packs',
  async run(t) {
    await t.step('nothing of the packs is loaded or offered without Free build', `const { PIECES } = await import('/src/build/pieces.js'); AG.S.freeBuild = false;
      const loaded = PIECES.filter((p) => p.free && (p.looking || p.meshes)).length, offered = g.buildMenu.pieces().filter((p) => p.free).length, learnable = C.list().filter((r) => PIECES.find((p) => p.id === r.id)?.free).length;
      return (PIECES.filter((p) => p.free).length > 1000 && !loaded && !offered && !learnable) || JSON.stringify({ loaded, offered, learnable });`);
    await t.step("with Free build on, every pack piece is in the hammer's menu, in a tab per pack and kind", `const { PIECES } = await import('/src/build/pieces.js'); AG.S.freeBuild = true;
      const free = PIECES.filter((p) => p.free), shown = g.buildMenu.pieces().filter((p) => p.free).length, cats = g.buildMenu.cats();
      g.buildMenu.toggle(true); g.buildMenu.cat = 'Vikings · Big'; g.buildMenu.draw(); const tiles = document.querySelectorAll('#buildMenu .bmtile[data-id^="vk."]').length, tabs = [...document.querySelectorAll('#buildMenu nav button.pk')].length; g.buildMenu.toggle(false);
      return (shown === free.length && ['RPGPP · Walls', 'Vikings · Big', 'Empire · Walls'].every((c) => cats.includes(c)) && tiles > 5 && tabs > 20) || JSON.stringify({ shown, free: free.length, tiles, tabs, cats: cats.slice(8, 12) });`);
    await t.step('find flat open ground', `${FLAT} const f = flat(-60, 80); if (!f) return 'no flat ground'; clearAround(f.x, f.z, 30); P.spawn(f.x - 8, f.z - 8); window._H = { x: f.x, z: f.z, y: f.y + 0.05, R: 0 }; return true;`);

    // ---- where a player aims, as our own pieces (the placement suite's aims)
    const SNAPS = [
      ['an RPGPP wall goes on the edge of the floor you aim at', `floors(); return check('ag.wall-01-3x3-a', 0, [-1.5, 0, -3], 0, grid(-1.5, 0, -2.6, 1, 0, 0.5).map((t) => [[t[0] + 0.5, 3, -9], t]));`],
      ['an Empire wall goes on the edge of the floor you aim at', `floors(); return check('ae.wall-01', 0, [-1.5, 0, -3], 0, grid(-1.5, 0, -2.6, 1, 0, 0.5).map((t) => [[t[0] + 0.5, 3, -9], t]));`],
      ['an RPGPP floor goes beside the floor you aim past', `floors(); return check('ag.floor-01a-3x3', 0, [-1.5, 0, -4.5], 0, grid(-1.5, -0.1, -4.4, 1, 0.1, 0.8).map((t) => [[t[0], 2.4, -10], t]));`],
      ['an Empire floor goes beside the floor you aim past', `floors(); return check('ae.base-floor-01', 0, [-1.5, 0, -4.5], 0, grid(-1.5, -0.1, -4.4, 1, 0.1, 0.8).map((t) => [[t[0], 2.4, -10], t]));`],
      ['an RPGPP roof panel goes on the top of the wall you aim at', `floors(); walls(); return check('ag.roof-02b-6x3x3-half', Math.PI, [-1.5, 3, -3], Math.PI, grid(-1.5, 2.9, -3.05, 1, 0.2, 0).map((t) => [[t[0] + 0.5, 3.6, -12], t]));`],
      ['an Empire roof panel goes on the top of the wall you aim at', `floors(); walls(); return check('ae.roof-base-straight-01', Math.PI, [-1.5, 3, -3], Math.PI, grid(-1.5, 2.9, -3.05, 1, 0.2, 0).map((t) => [[t[0] + 0.5, 3.6, -12], t]));`],
      ['an RPGPP gable goes on the top of the side wall you aim at', `floors(); walls(); return check('ag.roof-end-01-6x3-wall-a', Math.PI / 2, [-3, 3, 0], Math.PI / 2, grid(-3.05, 2.9, 0, 0, 0.2, 1).map((t) => [[-10, 3.5, t[2] + 0.3], t]));`],
      ['a Viking roof goes on the house base you aim at, covering it', `const b = put('vk.base-01', 0, 0, 0), h = B.piece('vk.base-01').pack.box[3], bad = [];
        for (const [cam, tg, rot] of [[[0.5, h + 2, -11], [0.3, h, -3], Math.PI], [[-0.8, h + 1.5, -10], [-1, h - 0.1, -3], Math.PI], [[1.5, h + 3, 11], [1, h, 3], 0]]) { const r = aim('vk.roof-01', rot, cam, tg); const m = r && B.piece('vk.roof-01'), mid = r && local(B.snapsOf(m, W(...r.at), r.rot + R)[8]); if (!r || r.why || Math.hypot(mid[0], mid[2]) > 0.05 || Math.abs(mid[1] - h - B.piece('vk.roof-01').snaps[8][1]) > 0.05) bad.push(tg + ' → ' + (r ? r.at.map((v) => v.toFixed(2)) + (r.why ? ' (' + r.why + ')' : '') : 'no ghost')); }
        B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; return (!!b && bad.length === 0) || bad.join(' | ');`],
      ['an RPGPP door goes into the doorway of an RPGPP door wall, stretched across it', `floors(); walls(['f2']); put('ag.wall-01-3x3-door-a', 1.5, 0, -3); const r = aim('ag.door-03a', 0, [1.5, 2.2, -9], [1.5, 1.2, -3]); if (!r || r.why) return 'ghost: ' + JSON.stringify(r);
        const p = click(); await until(() => p.def.meshes, 20000); B.dress(p); const fr = B.piece('ag.wall-01-3x3-door-a').frame, k = p.inner.scale.x * p.def.door.w; return (stands(p) && Math.abs(k - fr.ow) < 0.01 && Math.abs(local(p.pos)[0] - (1.5 + fr.ox - fr.ow / 2)) < 0.05) || JSON.stringify({ k, at: local(p.pos), fr });`],
      ['an Empire door goes into an Empire doorway, and a pair of them into a double one', `floors(); walls(['f1', 'f2']); put('ae.wall-door-04', 1.5, 0, -3); put('ae.wall-door-double-03', -1.5, 0, -3);
        const a = aim('ae.door-01', 0, [1.5, 2.2, -9], [1.5, 1.2, -3]); const pa = a && !a.why && click(); const b = aim('ae.door-01', 0, [-1.5, 2.2, -9], [-1.7, 1.2, -3]); const pb = b && !b.why && click(); const e = aim('ae.door-01', Math.PI, [-1.5, 2.2, -9], [-1.3, 1.2, -3]); const pe = e && !e.why && click();
        return (stands(pa) && stands(pb) && stands(pe) && pb.pos.distanceTo(pe.pos) > 2) || JSON.stringify({ a, b, e });`],
      ['a window goes on the face of the wall you aim at, its back against it', `floors(); walls(); const r = aim('ag.window-01a', 0, [-1.5, 1.6, -8], [-1.2, 1.5, -3.2]); if (!r || r.why) return 'ghost: ' + JSON.stringify(r);
        const p = click(); return (stands(p) && local(p.pos)[2] < -3.1 && local(p.pos)[2] > -3.7 && Math.abs(Math.abs(norm(p.rot - R)) - Math.PI) < 0.05) || JSON.stringify({ at: local(p.pos), rot: p.rot });`],
    ];
    const CLEAR = `${FLAT} clearAround(window._H.x, window._H.z, 30);`;   // (and again before each build: the woods round about stream in as the hero moves)
    for (const [name, code] of SNAPS) await t.step(name, `${LIB} ${HELD} ${CLEAR} ${code}`);

    // ---- one of each kind from each pack: somewhere an aim at a small house (or by it) puts it, held up, and it stands
    // once built (a door beside a doorway of its size, set up first)
    const kinds = await t.eval(`const { PIECES } = await import('/src/build/pieces.js'); const out = {}; for (const p of PIECES) if (p.free && !/snow|light/.test(p.name)) { const k = p.cat.split(' · ')[0] + ' ' + p.pack.tpl; out[k] ||= p.id; } return out;`);
    for (const [k, id] of Object.entries(kinds)) {
      await t.step(`${k} (${id}): placed where a player aims, held up, and it stands`, `${LIB} ${HELD} ${CLEAR} floors(); walls(['f2']); put('roof63', -1.5, 3, -3, Math.PI);
        const def = B.piece('${id}');
        if (def.door) { const fr = PIECES.find((q) => q.frame && (q.frame.ow * 0.55 < def.door.w && def.door.w < q.frame.ow * 1.2)) || PIECES.find((q) => q.frame && def.door.w > q.frame.ow * 0.4); if (!fr) return 'no doorway for it'; put(fr.id, 9, 0, 0); }
        let seed = 11; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646, tried = []; let p = null;
        for (let k = 0; k < 160 && !p; k++) {
          const near = def.door ? [9, 1.2, 0] : [(rnd() - 0.5) * 8, rnd() * 3.5, (rnd() - 0.5) * 8], a = rnd() * 6.283, r0 = 5 + rnd() * 7, cam = [near[0] + Math.cos(a) * r0, 1.5 + rnd() * 4, near[2] + Math.sin(a) * r0];
          const r = aim('${id}', Math.floor(rnd() * 4) * Math.PI / 2, cam, near); if (!r) continue; if (r.why) { tried.push(r.why); continue; }
          if (!held(def, W(...r.at), r.rot + R)) { tried.push('not held'); continue; }
          p = click(); if (!p) tried.push('the click placed nothing');
        }
        if (!p) return 'never allowed: ' + [...new Set(tried)].slice(0, 4).join(' | ');
        return stands(p) || 'it fell: ' + p.support;`);
    }

    // ---- saves
    await t.step('pack pieces save and load as our own do: the same pieces, where they were, held up, the door in its doorway', `${LIB} ${HELD}
      for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('ag.floor-01a-3x3', x, 0, z); put('ag.wall-01-3x3-a', -1.5, 0, -3); put('ag.wall-01-3x3-door-a', 1.5, 0, -3); put('ae.wall-01', -3, 0, -1.5, Math.PI / 2);
      for (const x of [-1.5, 1.5]) put('ag.roof-02b-6x3x3-half', x, 3, -3, Math.PI); const fr = B.piece('ag.wall-01-3x3-door-a').frame; put('ag.door-03a', 1.5 + fr.ox - fr.ow / 2, 0, -3); put('vk.base-01', 12, 0, 0);
      B.recompute(); const was = B.placed.map((q) => q.id + '@' + local(q.pos).map((v) => v.toFixed(2))).sort().join(' '), saved = JSON.parse(JSON.stringify(B.toJSON()));
      for (const q of [...B.placed]) B.remove(q, false); B.load(saved);
      const now = B.placed.map((q) => q.id + '@' + local(q.pos).map((v) => v.toFixed(2))).sort().join(' '), weak = B.placed.filter((q) => q.support < 0.1 || q.held).map((q) => q.id), door = B.placed.find((q) => q.id === 'ag.door-03a');
      await until(() => door.def.meshes, 20000); B.dress(door);
      return (was === now && !weak.length && Math.abs(door.inner.scale.x * door.def.door.w - fr.ow) < 0.01) || JSON.stringify({ was, now, weak, door: door?.inner.scale.x });`);
    await t.step("their models load when wanted: a picked piece's look is the pack's, from its own materials", `const { PIECES } = await import('/src/build/pieces.js'); const ids = ['ag.wall-01-3x3-a', 'ae.wall-window-03', 'vk.base-01', 'ae.roof-base-straight-01'];
      for (const id of ids) B.look(B.piece(id)); const ok = await until(() => ids.every((id) => B.piece(id).meshes), 30000);
      const n = ids.map((id) => B.piece(id).meshes.length), loaded = PIECES.filter((p) => p.free && p.meshes).length;
      return (ok && n.every((k) => k > 0) && loaded < 60) || JSON.stringify({ n, loaded });`);
    await t.eval(`for (const q of [...B.placed]) B.remove(q, false); B.recompute(); return true;`);
  },
};
