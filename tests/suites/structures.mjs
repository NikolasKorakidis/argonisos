// Big builds, made the way a player makes them: for every piece of a plan, find a spot with a clear view of where it
// goes (as a player walks round until they can see it), aim there, check the ghost lands in that spot and is allowed,
// and click. Then the whole thing must still stand (nothing collapses), and you must be able to walk up its stairs.
// A two-storey house with a terrace and outside stairs, a four-storey tower, a long hall roofed ends-first, a fenced yard.
import { LIB } from '../lib/building.mjs';

const BUILDER = `
  const I = (await import('/src/input.js')).input, toW = (pos, rot, l) => { const c = Math.cos(rot), s = Math.sin(rot); return new V(pos.x + l[0] * c + l[2] * s, pos.y + l[1], pos.z - l[0] * s + l[2] * c); };
  // where a player aims to put a piece: the ground where a fence stands, the top end of stairs, the middle of a door, the middle of a floor, otherwise
  // the piece's own reference point (a wall's foot, a roof panel's lower edge)
  const refPoint = (def, pos, rot) => def.cat === 'Fences' ? new V(pos.x, AG.heightAt(pos.x, pos.z) + 0.05, pos.z) : def.aimAt ? toW(pos, rot, def.aimAt[1]) : def.door ? toW(pos, rot, [0.7, 1.2, 0])
    : def.tops?.length === 1 && def.tops[0].y !== undefined ? toW(pos, rot, [(def.tops[0].x0 + def.tops[0].x1) / 2, def.tops[0].y + 0.02, (def.tops[0].z0 + def.tops[0].z1) / 2]) : toW(pos, rot, [0, 0.05, 0]);
  const sym = (id) => ['wall', 'wallHalf', 'fence', 'stockade', 'beamH', 'beamV'].includes(id);
  const report = { bad: [], blind: [], first: [], n: 0 };
  // build one piece by aiming at it, from up to four spots that can see where it goes (nothing in the way of the eye):
  // a wrong ghost from the first is noted (a player would have to move), wrong from all four is a failure; with no
  // view at all it's noted and built directly, so the rest of the plan goes on
  // the first piece on bare ground goes wherever the ground under the aim is, and sets the grid for the rest: take it
  // where it lands (if allowed, and near the plan) and move the plan to match
  const first = (id, x, y, z, r = 0) => {
    const def = B.piece(id), pos = W(x, y, z), rot = R + r, tgt = new V(pos.x, AG.heightAt(pos.x, pos.z), pos.z); report.n++;
    P.spawn(tgt.x - 4, tgt.z); AG.camera.position.set(tgt.x - 7, tgt.y + 2.5, tgt.z + 0.3); AG.camera.lookAt(tgt); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
    B.select(id); B.rot = rot; B.lastSnap = null; const g2 = B.placeGhost();
    if (!g2 || g2.why || Math.hypot(g2.pos.x - pos.x, g2.pos.z - pos.z) > 1) { report.bad.push('first ' + id + ' → ' + (g2 ? (g2.why || 'landed ' + Math.hypot(g2.pos.x - pos.x, g2.pos.z - pos.z).toFixed(2) + ' m off') : 'no ghost')); B.place(id, pos, rot); }
    else { H.x += g2.pos.x - pos.x; H.z += g2.pos.z - pos.z; H.y += g2.pos.y - pos.y; I.clicks.push(0); B.update(0.016); I.clicks.length = 0; }
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
  };
  const build = (id, x, y, z, r = 0) => {
    const def = B.piece(id), pos = W(x, y, z), rot = R + r, tgt = refPoint(def, pos, rot); report.n++;
    let tries = 0, done = false, last = null;
    for (const dist of [6, 8, 4.5]) for (const h of [1.6, 3.2, -0.6, 5]) for (let k = 0; k < 16 && !done && tries < 4; k++) {
      const a = (k / 16) * 6.283, cx = tgt.x + Math.cos(a) * dist, cz = tgt.z + Math.sin(a) * dist, cy = tgt.y + h;
      if (cy < AG.heightAt(cx, cz) + 1) continue;
      P.spawn(tgt.x + Math.cos(a) * Math.min(3.5, dist - 1), tgt.z + Math.sin(a) * Math.min(3.5, dist - 1));
      if (tgt.y - P.pos.y > 8) P.pos.set(H.x, tgt.y - 3, H.z);   // (high up: standing on the floor below, as you would)
      AG.camera.position.set(cx, cy, cz); AG.camera.lookAt(tgt); AG.camera.updateMatrixWorld(); AG.scene.updateMatrixWorld(true);
      const hit = B.aim(); if (hit && hit.p.distanceTo(AG.camera.position) < AG.camera.position.distanceTo(tgt) - 0.45) continue;   // something in the way
      tries++; B.select(id); B.rot = rot; B.lastSnap = null; const g2 = B.placeGhost();
      const dr = g2 && Math.atan2(Math.sin(g2.rot - rot), Math.cos(g2.rot - rot)), ok = g2 && !g2.why && (def.cat === 'Fences' ? Math.hypot(g2.pos.x - pos.x, g2.pos.z - pos.z) : g2.pos.distanceTo(pos)) < 0.05 && (Math.abs(dr) < 0.05 || (sym(id) && Math.abs(Math.abs(dr) - Math.PI) < 0.05));
      if (!ok) { last = g2 ? local(g2.pos).map((v) => v.toFixed(2)) + ' turn ' + norm(g2.rot - R).toFixed(2) + (g2.why ? ' (' + g2.why + ')' : '') : 'no ghost'; if (tries === 1) report.first.push(id + '@' + [x, y, z] + ' → ' + last); continue; }
      const before = new Set(B.placed); I.clicks.push(0); B.update(0.016); I.clicks.length = 0; if (!B.placed.some((q) => !before.has(q) && Math.hypot(q.pos.x - pos.x, q.pos.z - pos.z) < 0.05)) report.bad.push(id + '@' + [x, y, z] + ': the click placed nothing'); done = true;
    }
    if (!tries) report.blind.push(id + '@' + [x, y, z]); else if (!done) report.bad.push(id + '@' + [x, y, z] + ' → ' + last);
    if (!done) B.place(id, pos, rot);
    B.sel = null; if (B.ghost) AG.scene.remove(B.ghost); B.ghost = null;
  };
  // after the build: everything still standing, nothing refused
  const verdict = () => { const n = B.placed.length; B.recompute(); const fell = n - B.placed.length;
    const parts = []; if (report.bad.length) parts.push(report.bad.length + ' of ' + report.n + ' went wrong: ' + report.bad.slice(0, 5).join(' | ')); if (fell) parts.push(fell + ' pieces fell down');
    if (report.first.length > report.n * 0.1) parts.push(report.first.length + ' of ' + report.n + ' wrong at the first try: ' + report.first.slice(0, 4).join(' | '));
    window._blind = (window._blind || []).concat(report.blind); window._first = (window._first || []).concat(report.first); return parts.length === 0 || parts.join(' ; '); };
`;
const F4 = [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]];

const HOUSE = `
  first('floor', -1.5, 0, -1.5); for (const [x, z] of ${JSON.stringify(F4)}.slice(1)) build('floor', x, 0, z);
  build('wall', -1.5, 0, -3); build('doorframe', 1.5, 0, -3); build('door', 0.8, 0, -3); build('wall', -1.5, 0, 3); build('wall', 1.5, 0, 3);
  for (const z of [-1.5, 1.5]) { build('wall', -3, 0, z, Math.PI / 2); build('wall', 3, 0, z, Math.PI / 2); }
  for (const [x, z] of ${JSON.stringify(F4)}) build('floor', x, 3, z);
  build('floor', -1.5, 3, -4.5); build('beamV', -3, 0, -6); build('beamV', 0, 0, -6);                       // the terrace, then its posts
  build('wall', 1.5, 3, -3); build('doorframe', -1.5, 3, -3); build('door', -2.2, 3, -3); build('wall', -1.5, 3, 3); build('wall', 1.5, 3, 3);
  for (const z of [-1.5, 1.5]) { build('wall', -3, 3, z, Math.PI / 2); build('wall', 3, 3, z, Math.PI / 2); }
  build('roof63', -1.5, 6, -3, Math.PI); build('roof63', 1.5, 6, -3, Math.PI); build('roof63', -1.5, 6, 3); build('roof63', 1.5, 6, 3);
  build('end63', -3, 6, 0, Math.PI / 2); build('end63', 3, 6, 0, Math.PI / 2);
  build('stairsLong', -1.5, 0, -10, Math.PI);                                                                // up to the terrace
`;
const TOWER = `
  first('floor', 0, 0, 0);
  for (let k = 0; k < 4; k++) { const y = 3 * k; build('wall', 0, y, -1.5); build('wall', 0, y, 1.5); build('wall', -1.5, y, 0, Math.PI / 2); build('wall', 1.5, y, 0, Math.PI / 2); build('floor', 0, y + 3, 0); }
`;
const HALL = `
  first('floor', -3, 0, -1.5); for (const [x, z] of [[0, -1.5], [3, -1.5], [-3, 1.5], [0, 1.5], [3, 1.5]]) build('floor', x, 0, z);
  for (const x of [-3, 0, 3]) { build('wall', x, 0, -3); build('wall', x, 0, 3); } for (const z of [-1.5, 1.5]) { build('wall', -4.5, 0, z, Math.PI / 2); build('wall', 4.5, 0, z, Math.PI / 2); }
  build('roof63', -3, 3, -3, Math.PI); build('roof63', 3, 3, -3, Math.PI); build('roof63', 0, 3, -3, Math.PI);   // the ends first, then the gap
  build('roof63', -3, 3, 3); build('roof63', 3, 3, 3); build('roof63', 0, 3, 3);
  build('end63', -4.5, 3, 0, Math.PI / 2); build('end63', 4.5, 3, 0, Math.PI / 2);
`;
const YARD = `
  first('fence', -2, 0, -3); for (const x of [0, 2]) build('fence', x, 0, -3); for (const z of [-2, 0, 2]) build('fence', 3, 0, z, Math.PI / 2);
  for (const x of [2, 0, -2]) build('fence', x, 0, 3); for (const z of [2, 0, -2]) build('fence', -3, 0, z, Math.PI / 2);
  first('stockade', -4, 0, 7); for (const x of [0, 4]) build('stockade', x, 0, 7);
`;

export default {
  name: 'Structures',
  slow: true,
  async run(t) {
    // a building site, cleared of trees and rocks; its level is set the way the game lays the first floor tile: on the
    // highest of its corners (tile = the first tile's middle in house space), or for a fence, on the ground where it stands
    const site = (dx, dz, R, tile, fence) => t.eval(`const x = P.pos.x + ${dx}, z = P.pos.z + ${dz}, R = ${R}, c = Math.cos(R), s = Math.sin(R), at = (u, v) => AG.heightAt(x + u * c + v * s, z - u * s + v * c);
      const [tx, tz] = ${JSON.stringify(tile)}; const y = ${fence ? 'at(tx, tz)' : 'Math.max(...[[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5], [0, 0]].map(([u, v]) => at(tx + u, tz + v))) + 0.03'};
      for (const q of [...g.colliders.near(x, z, 18)]) if (q.ref) { g.veg.remove(q.ref.cx, q.ref.cz, q.ref.i); g.colliders.removeOne(q); }   // (fell the trees and break the rocks on the site first, as a player would)
      window._H = { x, z, y, R }; return true;`);
    await site(30, 0, 0.35, [-1.5, -1.5]);
    await t.step('a two-storey house with a terrace, outside stairs, doors on both floors, a roof and gables', `${LIB} ${BUILDER} ${HOUSE} return verdict();`);
    await t.step('…you can walk up its stairs onto the terrace', `const H = window._H, R = H.R, c = Math.cos(R), s = Math.sin(R), W = (x, y, z) => new V(H.x + x * c + z * s, H.y + y, H.z - x * s + z * c);
      const st = W(-1.5, 0, -11.2); P.spawn(st.x, st.z); P.camYaw = R + Math.PI; P.yaw = R; window._y0 = P.pos.y; return true;`);
    await t.page.keyboard.down('KeyW'); await t.wait(250); await t.page.keyboard.press('Space'); await t.wait(3200); await t.page.keyboard.up('KeyW'); await t.wait(500);   // (a hop onto the first step, if its foot is off the ground)
    await t.step('…(standing on the terrace, three metres up)', `const H = window._H; return P.pos.y - H.y > 2.7 || 'only got to ' + (P.pos.y - H.y).toFixed(2) + ' m up (started ' + (window._y0 - H.y).toFixed(2) + ')';`);
    await t.shot('house', { hud: false });
    await site(-30, 0, 0, [0, 0]);
    await t.step('a four-storey tower', `${LIB} ${BUILDER} ${TOWER} return verdict();`);
    await site(0, 34, -0.5, [-3, -1.5]);
    await t.step('a long hall, its roof filled in ends first', `${LIB} ${BUILDER} ${HALL} return verdict();`);
    await site(0, -34, 0.2, [-2, -3], true);
    await t.step('a fenced yard and a stockade wall', `${LIB} ${BUILDER} ${YARD} return verdict();`);
    const blind = await t.eval('return window._blind || [];'), first = await t.eval('return window._first || [];');
    t.metric('pieces no viewpoint could see (built directly)', blind.length ? blind.join(', ') : 'none');
    t.metric('pieces wrong at the first try (right after moving)', first.length ? first.join(' | ') : 'none');
  },
};
