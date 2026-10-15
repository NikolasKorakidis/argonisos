// Building as a player does it: aim, and the ghost should go where you mean. Each scenario builds part of a house (also
// turned 35°, which is how most houses end up), then aims at it many slightly different ways, from outside and inside,
// and checks the ghost lands in the one spot a player would expect, allowed (green). Failures list the aims that missed.
const LIB = `
  AG.S.freeBuild = true; for (const q of [...B.placed]) B.remove(q, false); g.give('hammer'); if (!g.equippedTool('build')) g.useSlot(inv.slots.findIndex((s) => s?.id === 'hammer'));
  const H = window._H, R = H.R, c = Math.cos(R), s = Math.sin(R);
  // house space: x along the front, z inward, y up from the floor, turned by R about the house's middle
  const W = (x, y, z) => new V(H.x + x * c + z * s, H.y + y, H.z - x * s + z * c);
  const local = (p) => { const dx = p.x - H.x, dz = p.z - H.z; return [dx * c - dz * s, p.y - H.y, dx * s + dz * c]; };
  const put = (id, x, y, z, r = 0) => { const p = B.place(id, W(x, y, z), R + r); if (!p) throw new Error('could not build ' + id); return p; };
  const floors = () => { for (const [x, z] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) put('floor', x, 0, z); };
  const walls = (skip = []) => { const all = { f1: ['wall', -1.5, 0, -3, 0], f2: ['wall', 1.5, 0, -3, 0], b1: ['wall', -1.5, 0, 3, 0], b2: ['wall', 1.5, 0, 3, 0], l1: ['wall', -3, 0, -1.5, Math.PI / 2], l2: ['wall', -3, 0, 1.5, Math.PI / 2], r1: ['wall', 3, 0, -1.5, Math.PI / 2], r2: ['wall', 3, 0, 1.5, Math.PI / 2] }; for (const [k, w] of Object.entries(all)) if (!skip.includes(k)) put(...w); };
  const norm = (a) => ((a % (2 * Math.PI)) + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
  // aim from cam to target (both in house space), the hero standing at stand; returns where the ghost went, in house space
  const aim = (id, rot, cam, target, stand) => {
    B.select(id); B.rot = R + rot; B.lastSnap = null; const st = stand || [cam[0] + (target[0] - cam[0]) * 0.45, 0, cam[2] + (target[2] - cam[2]) * 0.45]; const sp = W(...st); P.spawn(sp.x, sp.z);
    const cp = W(...cam), tp = W(...target); AG.camera.position.copy(cp); AG.camera.lookAt(tp); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
    const r = B.placeGhost(); return r && { at: local(r.pos), rot: norm(r.rot - R), why: r.why };
  };
  // try every aim; report the ones that miss the spot (or its turn), or that are refused
  const check = (id, rot, want, wantRot, aims) => { const bad = [];
    for (const [cam, target, stand] of aims) { const r = aim(id, rot, cam, target, stand); const ok = r && !r.why && Math.hypot(r.at[0] - want[0], r.at[1] - want[1], r.at[2] - want[2]) < 0.05 && (wantRot === null || Math.abs(norm(r.rot - wantRot)) < 0.05 || Math.abs(norm(r.rot - wantRot - Math.PI)) < 0.05 && id === 'wall');
      if (!ok) bad.push('aim at ' + target.map((v) => v.toFixed(1)) + ' from ' + cam.map((v) => v.toFixed(0)) + ' → ' + (r ? r.at.map((v) => v.toFixed(2)) + ' turn ' + r.rot.toFixed(2) + (r.why ? ' (' + r.why + ')' : '') : 'no ghost')); }
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
    return bad.length === 0 || bad.length + '/' + aims.length + ' missed: ' + bad.slice(0, 3).join(' | ');
  };
  const grid = (cx, cy, cz, sx, sy, sz, n = 3) => { const o = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) o.push([cx + (i / (n - 1) - 0.5) * sx, cy + (j / (n - 1) - 0.5) * sy, cz + (i / (n - 1) - 0.5) * sz]); return o; };
`;

const SCENARIOS = [
  // floors: aim at the ground just past an edge and the next tile goes there
  ['a floor tile goes beside the floor you aim past (front)', `floors(); return check('floor', 0, [-1.5, 0, -4.5], 0, grid(-1.5, -0.1, -4.4, 1, 0.1, 0.8).map((t) => [[t[0], 2.4, -10], t]));`],
  ['a floor tile goes beside the floor you aim past (side)', `floors(); return check('floor', 0, [4.5, 0, 1.5], 0, grid(4.4, -0.1, 1.5, 0.8, 0.1, 1).map((t) => [[10, 2.4, t[2]], t]));`],
  ['a floor tile fills the gap between two floors', `put('floor', -1.5, 0, 0); put('floor', 4.5, 0, 0); return check('floor', 0, [1.5, 0, 0], 0, grid(1.5, 0, 0, 1, 0, 1).map((t) => [[t[0], 4, -8], t]));`],
  // walls: aim at the floor near an edge and the wall stands on that edge
  ['a wall goes on the edge of the floor you aim at (front)', `floors(); return check('wall', 0, [-1.5, 0, -3], 0, grid(-1.5, 0, -2.6, 1, 0, 0.5).map((t) => [[t[0] + 0.5, 3, -9], t]));`],
  ['a wall goes on the edge of the floor you aim at (side, from inside)', `floors(); return check('wall', Math.PI / 2, [3, 0, 1.5], Math.PI / 2, grid(2.6, 0, 1.5, 0.5, 0, 1).map((t) => [[-1, 2.6, 1.5], t, [0, 0, 1.5]]));`],
  ['a wall goes on top of the wall you aim at', `floors(); walls(); return check('wall', 0, [-1.5, 3, -3], 0, grid(-1.5, 2.85, -3.1, 1, 0.2, 0).map((t) => [[t[0] + 0.4, 4, -10], t]));`],
  // roofs: the playtest report (15 Oct), from outside and from inside, on both long sides
  ['a roof panel goes on the top of the wall you aim at (outside, front)', `floors(); walls(); return check('roof63', Math.PI, [-1.5, 3, -3], Math.PI, grid(-1.5, 2.9, -3.05, 1, 0.2, 0).map((t) => [[t[0] + 0.5, 3.6, -12], t]));`],
  ['a roof panel goes on the top of the wall you aim at (outside, back)', `floors(); walls(); return check('roof63', 0, [1.5, 3, 3], 0, grid(1.5, 2.9, 3.05, 1, 0.2, 0).map((t) => [[t[0] - 0.5, 3.6, 12], t]));`],
  ['a roof panel goes on the top of the wall you aim at (inside)', `floors(); walls(); return check('roof63', Math.PI, [1.5, 3, -3], Math.PI, grid(1.5, 2.9, -2.95, 1, 0.2, 0).map((t) => [[0.3, 2.4, 2.4], t, [0, 0, 1.4]]));`],
  ['a roof panel fills the gap between two others', `put('floor', -3, 0, -1.5); put('floor', 0, 0, -1.5); put('floor', 3, 0, -1.5); for (const x of [-3, 0, 3]) put('wall', x, 0, -3); put('roof63', -3, 3, -3, Math.PI); put('roof63', 3, 3, -3, Math.PI);
    return check('roof63', Math.PI, [0, 3, -3], Math.PI, grid(0, 4.6, -1.6, 1.4, 0.8, 0.6).map((t) => [[t[0] + 0.5, 6, -9], t]));`],
  ['a gable end goes on the top of the side wall you aim at', `floors(); walls(); return check('end63', Math.PI / 2, [-3, 3, 0], Math.PI / 2, grid(-3.05, 2.9, 0, 0, 0.2, 1).map((t) => [[-10, 3.5, t[2] + 0.3], t]));`],
  // doors: only ever into a door frame, never hanging in the air
  ['a door frame goes in the gap in a wall line', `floors(); walls(['f2']); return check('doorframe', 0, [1.5, 0, -3], 0, grid(1.5, 0, -2.6, 1, 0, 0.4).map((t) => [[t[0], 3, -9], t]));`],
  ['a door goes into the door frame you aim at (outside)', `floors(); walls(['f2']); put('doorframe', 1.5, 0, -3); return check('door', 0, [0.8, 0, -3], 0, grid(1.5, 1.2, -3, 1.1, 1.6, 0).map((t) => [[t[0], 2.2, -9], t]));`],
  ['a door goes into the door frame you aim at (inside)', `floors(); walls(['f2']); put('doorframe', 1.5, 0, -3); return check('door', Math.PI, [2.2, 0, -3], Math.PI, grid(1.5, 1.2, -3, 1.1, 1.6, 0).map((t) => [[t[0], 2.2, 2.5], t, [t[0], 0, 1]]));`],
  ['aimed anywhere else, a door is refused rather than hung in the air', `floors(); walls(['f2']); put('doorframe', 1.5, 0, -3); const bad = [];
    for (const t of [[-1.5, 2.9, -3.05], [3, 1, 0], [0, 0, 0], [-3.05, 1.5, 1.5]]) { const r = aim('door', 0, [t[0] * 1.5, 3, -10], t); if (r && !r.why) bad.push(t.join(',') + ' → ' + r.at.map((v) => v.toFixed(2))); }
    return bad.length === 0 || 'placed away from a frame: ' + bad.join(' | ');`],
  // a second storey, posts and beams, half walls, stairs
  ['a floor tile goes on top of the walls you aim at (second storey, from inside)', `floors(); walls(); return check('floor', 0, [-1.5, 3, -1.5], 0, grid(-1.5, 2.95, -2.95, 1, 0.1, 0).map((t) => [[t[0] + 0.3, 2.3, 1.5], t, [0, 0, 1]]));`],
  ['a post goes on the corner of the floor you aim at', `floors(); return check('beamV', 0, [3, 0, -3], null, grid(2.85, 0, -2.85, 0.3, 0, 0.3).map((t) => [[7, 3, -7], t]));`],
  ['a beam goes across the tops of two posts', `floors(); put('beamV', 3, 0, -3); put('beamV', 3, 0, 0); return check('beamH', Math.PI / 2, [3, 3, -1.5], Math.PI / 2, grid(3, 3, -1.5, 0, 0.1, 1.2).map((t) => [[8, 4, t[2]], t]));`],
  ['a half wall goes on the edge of the floor you aim at', `floors(); return check('wallHalf', 0, [1.5, 0, -3], 0, grid(1.5, 0, -2.6, 1, 0, 0.4).map((t) => [[t[0], 3, -9], t]));`],
  // what a click does: the piece goes where the ghost was
  ['clicking places the piece where the ghost stood', `floors(); walls(); const I = (await import('/src/input.js')).input; const r = aim('roof63', Math.PI, [-1, 3.6, -12], [-1.5, 2.9, -3.05]); if (!r || r.why) return 'ghost: ' + JSON.stringify(r);
    const before = new Set(B.placed); I.clicks.push(0); B.update(0.016); I.clicks.length = 0; const fresh = B.placed.filter((q) => !before.has(q)), p = fresh[0]; if (!p) return 'nothing placed'; const at = local(p.pos);
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null; return (fresh.length === 1 && p.id === 'roof63' && Math.hypot(at[0] + 1.5, at[1] - 3, at[2] + 3) < 0.05) || 'placed ' + p?.id + ' at ' + at.map((v) => v.toFixed(2));`],
  // a sweep of random aims with every kind of piece: whatever the ghost offers as allowed must be held by something
  ['300 random aims: an allowed ghost always stands on the ground, joins something built, or (a door) fills a frame', `floors(); walls(['f2']); put('doorframe', 1.5, 0, -3); put('roof63', -1.5, 3, -3, Math.PI);
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646; const ids = ['floor', 'wall', 'wallHalf', 'doorframe', 'door', 'beamV', 'beamH', 'stairs', 'roof63', 'end63', 'fence'], bad = []; let allowed = 0;
    const snapsAll = B.placed.flatMap((q) => q.snaps);
    for (let k = 0; k < 300; k++) {
      const id = ids[Math.floor(rnd() * ids.length)], a = rnd() * 6.283, r0 = 4 + rnd() * 8, cam = [Math.cos(a) * r0, 1.5 + rnd() * 4, Math.sin(a) * r0], tg = [(rnd() - 0.5) * 8, rnd() * 4, (rnd() - 0.5) * 8];
      const r = aim(id, Math.floor(rnd() * 4) * Math.PI / 2, cam, tg); if (!r || r.why) continue; allowed++;
      const def = B.piece(id), pos = W(...r.at), rot = r.rot + R, mine = B.snapsOf(def, pos, rot);
      const held = B.grounded(def, pos, rot) || mine.some((m) => snapsAll.some((q) => q.distanceTo(m) < 0.05)) || (def.door && B.doorFrameAt(pos, rot));
      if (!held || B.blocked(def, pos, rot)) bad.push(id + ' at ' + r.at.map((v) => v.toFixed(2)) + (held ? ' overlapping' : ' in the air'));
    }
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
    return (bad.length === 0 && allowed > 60) || (allowed + ' allowed, ' + bad.length + ' bad: ' + bad.slice(0, 4).join(' | '));`],
];

export default {
  name: 'Placement',
  async run(t) {
    await t.eval(`window._spot = { x: P.pos.x + 30, z: P.pos.z + 10 }; return true;`);   // (the same spot for both runs)
    for (const [label, R] of [['', 0], [' (house turned 35°)', 35 * Math.PI / 180]]) {
      await t.eval(`const { x, z } = window._spot; window._H = { x, z, y: AG.heightAt(x, z) + 0.05, R: ${R} }; return true;`);
      for (const [name, code] of SCENARIOS) await t.step(name + label, `${LIB} ${code}`);
    }
  },
};
