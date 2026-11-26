// Every building piece of the three building packs (RPGPP_AG, Synty Vikings, Synty Ancient Empire) as a piece the hammer
// can place, for the reviewer to try and choose from (Free build only: build/pieces.js). node tools/assets/pack-pieces.mjs
// From the pack catalogue (everything.mjs: pack/all/catalogue.json, every model on its own) it picks the building pieces
// (leaving out whole buildings and props), names each one's role by its pack and name (a wall, a floor, a roof panel, a
// gable, stairs, a door...: TEMPLATES below), measures each model in a page as the game will load it (its bounds, which way
// a slope rises, a doorway's opening) and fits it to our build grid: RPGPP_AG is already on our 3 m grid; Ancient
// Empire's 2.5 m grid is stretched to 3 m across (its storeys stay 3 m high); Vikings' houses are scaled by 1.2 and
// rounded to the 1.5 m grid. Writes src/build/pack-pieces.js (the pieces, read by build/pieces.js) and
// docs/plans/pack-pieces.md (the reviewer's list, with each piece's picture: icons.mjs p_<id>).
import fs from 'node:fs';
import path from 'node:path';
import { serve, ROOT } from '../../tests/lib/server.mjs';
import { launch } from '../../tests/lib/harness.mjs';

const CAT = JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/models/pack/all/catalogue.json'), 'utf8'));
// per pack: its label in the menu, the short prefix of its ids, scale across and up, and the grid its sizes round to
const PACKS = {
  'rpgpp-ag': { label: 'RPGPP', pre: 'ag', s: [1, 1], q: 0.5, strip: /^rpgpp_ag_/ },
  polygonvikings: { label: 'Vikings', pre: 'vk', s: [1.2, 1.2], q: 0.5, qBig: 1.5, strip: /^SM_(Bld_|Prop_)?/ },
  polygonancientempire: { label: 'Empire', pre: 'ae', s: [1.2, 1], q: 0.3, strip: /^SM_(Bld_|Prop_|Env_)?/ },
};
// The kinds of piece (the menu's tabs per pack, in this order) and the templates: how each is placed, held up and walked on
// (build/pieces.js packDef). wall: a wall on the floor's edge (a doorway in it, from its measured opening) · tri: a
// half gable, high at +x · gable: a gable end (a doorway in it too) · trim: what caps a gable's sloping edges · roof: one
// slope, its eave along x, rising to -z · ridge: both slopes, the ridge along x · rafter: a roof panel's or a ridge's frame
// (no shelter) · floor · deck: a floor with its rails above it · stairs · post · beam · ladder · fence · door: into a
// doorway of its size · block: a solid lump with a top to stand on (a Viking house's base, a tower) · canopy: a roof or a
// deck on posts · deco: trims, windows, shutters, ornaments, handrails: on any face of what's built, where you aim
export const KINDS = ['Walls', 'Floors', 'Roofs', 'Gables', 'Rafters', 'Doors', 'Windows', 'Stairs', 'Beams', 'Fences', 'Trims', 'Big'];

// ---- the role of each model, by pack and name (lower case, words joined by _); null leaves it out
function classify(pack, raw) {
  const n = raw.toLowerCase(), has = (re) => re.test(n);
  if (pack === 'rpgpp-ag') {
    const nm = n.replace(/^rpgpp_ag_/, ''), dims = (nm.match(/_(\d+(?:\.\d)?)x(\d+(?:\.\d)?)(?:x(\d+(?:\.\d)?))?(?=_|$)/) || []).slice(1).map(Number);
    const stone = /^(wall_0[345]|basement_01|floor_0[34]|ceiling_0[34]|chimney|door_frame_0[78]|window_0[67]|wall_connector_corner_03)/.test(nm) || /^roof_end_01_\dx\d_wall_(c|d|e)(_|$)|_wall_(door|window)_0[345]/.test(nm);
    const m = stone ? 's' : 'w';
    if (/^(building_exterior|shed_wood)/.test(nm)) return null;
    if (/^ladder/.test(nm)) return { kind: 'Stairs', tpl: 'ladder', m };
    if (/^balcony_01_\dm_[ab]$/.test(nm)) return { kind: 'Floors', tpl: 'deck', m };
    if (/^balcony_01_\dm_[ab]_roof/.test(nm)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
    if (/^balcony_01_support_a/.test(nm)) return { kind: 'Beams', tpl: 'deco', m };
    if (/^balcony_01_support_b/.test(nm)) return { kind: 'Beams', tpl: 'beam', m };
    if (/^basement_.*corner/.test(nm)) return { kind: 'Walls', tpl: 'post', m };
    if (/^basement/.test(nm)) return { kind: 'Walls', tpl: 'wall', m };
    if (/^(ceiling|floor)_/.test(nm)) return { kind: 'Floors', tpl: 'floor', m };
    if (/^chimney/.test(nm)) return { kind: 'Roofs', tpl: 'block', m: 's' };
    if (/^door_gate_closed/.test(nm)) return { kind: 'Doors', tpl: 'beam', m };
    if (/^door_frame/.test(nm)) return { kind: 'Doors', tpl: 'wall', open: true, m };
    if (/^(door_|door_gate_)/.test(nm)) return { kind: 'Doors', tpl: 'door', m };
    if (/^window/.test(nm)) return { kind: 'Windows', tpl: 'deco', m };
    if (/^fence_.*corner/.test(nm)) return { kind: 'Fences', tpl: 'deco', m };
    if (/^fence/.test(nm)) return { kind: 'Fences', tpl: 'fence', m };
    if (/^gate_small/.test(nm)) return { kind: 'Fences', tpl: 'wall', open: true, m };
    if (/^stockade.*corner/.test(nm)) return { kind: 'Fences', tpl: 'post', m };
    if (/^stockade/.test(nm)) return { kind: 'Fences', tpl: 'fence', m };
    if (/^stockpile_01_stairs/.test(nm)) return { kind: 'Stairs', tpl: 'stairs', m };
    if (/(^|_)handrail/.test(nm)) return { kind: 'Trims', tpl: 'deco', m };
    if (/_roof_support/.test(nm)) return { kind: 'Rafters', tpl: 'deco', m };
    if (/^(gate_balcony|tower_01|stockpile)_.*roof/.test(nm)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
    if (/^(gate_balcony|tower_01|stockpile_02).*platform|^gate_balcony_0[12][ab]$|^stockpile_01$/.test(nm)) return { kind: 'Floors', tpl: 'deck', m };
    if (/^(gate_balcony|tower_01|wall_platform).*support/.test(nm)) return { kind: 'Beams', tpl: 'canopy', walk: false, m };
    if (/^wall_platform_stairs/.test(nm)) return { kind: 'Stairs', tpl: 'stairs', rise: +nm.match(/_(\d)m/)[1], m };
    if (/^wall_platform/.test(nm)) return { kind: 'Floors', tpl: 'floor', m };
    if (/^ladder_tower/.test(nm)) return { kind: 'Stairs', tpl: 'ladder', m };
    if (/^roof_end_01_\dx\d_beam/.test(nm)) return { kind: 'Gables', tpl: /half/.test(nm) ? 'tri' : 'gable', nominal: dims, frame: true, m };
    if (/^roof_end_01_\dx\d_wall_beam/.test(nm)) return { kind: 'Gables', tpl: 'deco', m };
    if (/^roof_end_01_\dx\d_wall_half/.test(nm)) return { kind: 'Gables', tpl: 'tri', nominal: dims, m };
    if (/^roof_end_01_\dx\d_wall/.test(nm)) return { kind: 'Gables', tpl: 'gable', nominal: dims, open: /_door_/.test(nm), m };
    if (/^roof_0\d[a-e]?_(half_)?window|^roof_02_end_0\d_window/.test(nm)) return { kind: 'Windows', tpl: 'deco', m: 't' };
    if (/^roof_support_.*(corner|end)/.test(nm)) return { kind: 'Rafters', tpl: 'deco', m };
    if (/^roof_support_.*half/.test(nm)) return { kind: 'Rafters', tpl: 'rafter', nominal: dims, m };
    if (/^roof_support_.*roof_01b$/.test(nm) || /^roof_support_01_\dx\dx\d(_chimney_01)?$/.test(nm)) return { kind: 'Rafters', tpl: 'ridge', nominal: dims, frame: true, m };
    if (/^roof_support/.test(nm)) return { kind: 'Rafters', tpl: 'deco', m };
    if (/^roof_.*corner/.test(nm)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
    if (/^roof_.*_end_01[ab]?_half/.test(nm)) return { kind: 'Roofs', tpl: 'trim', half: true, nominal: dims, m: 't' };
    if (/^roof_.*_end_01[ab]?$/.test(nm)) return { kind: 'Roofs', tpl: 'trim', nominal: dims, m: 't' };
    if (/^roof_.*_end_0[23]/.test(nm)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
    if (/^roof_.*half/.test(nm)) return { kind: 'Roofs', tpl: 'roof', nominal: dims, m: 't' };
    if (/^roof_/.test(nm)) return { kind: 'Roofs', tpl: 'ridge', nominal: dims, m: 't' };
    if (/^stairs_.*handrail/.test(nm)) return { kind: 'Stairs', tpl: 'deco', m };
    if (/^stairs_interior/.test(nm)) return { kind: 'Stairs', tpl: 'stairs', rise: +nm.match(/_(\d)m/)[1], m };
    if (/^stairs/.test(nm)) return { kind: 'Stairs', tpl: 'stairs', m };
    if (/^support_beam/.test(nm)) return { kind: 'Beams', tpl: 'post', m };
    if (/^wall_connector_(between|corner)/.test(nm)) return { kind: 'Beams', tpl: 'post', m };
    if (/^wall_connector_bottom_corner/.test(nm)) return { kind: 'Beams', tpl: 'deco', m };
    if (/^wall_connector_bottom/.test(nm)) return { kind: 'Beams', tpl: 'beam', m };
    if (/^wall_.*corner/.test(nm)) return { kind: 'Walls', tpl: 'post', m };
    if (/^wall_/.test(nm)) return { kind: 'Walls', tpl: 'wall', open: /_door_/.test(nm) && !/_door_d/.test(nm), m };
    if (/^awning_standing/.test(nm)) return { kind: 'Roofs', tpl: 'canopy', walk: false, roof: true, m: 't' };
    if (/^awning/.test(nm)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
    return { kind: 'Trims', tpl: 'deco', m };
  }
  if (pack === 'polygonvikings') {
    if (has(/boathouse|wharf|crate_base/)) return null;
    if (has(/bld_base/)) return { kind: 'Big', tpl: 'block', big: true, m: 'w' };
    if (has(/guard_tower|bld_tower/)) return { kind: 'Big', tpl: 'block', m: 'w' };
    if (has(/roof_window/)) return { kind: 'Windows', tpl: 'deco', m: 't' };
    if (has(/bld_roof/)) return { kind: 'Roofs', tpl: 'ridge', big: true, m: 't' };
    if (has(/stall_cover/)) return { kind: 'Roofs', tpl: 'canopy', walk: false, roof: true, m: 't' };
    if (has(/bld_door/)) return { kind: 'Doors', tpl: 'door', m: 'w' };
    if (has(/bld_window/)) return { kind: 'Windows', tpl: 'deco', m: 'w' };
    if (has(/archway/)) return { kind: 'Doors', tpl: 'wall', open: true, m: 'w' };
    if (has(/dock_0[12]|fence_platform/)) return { kind: 'Floors', tpl: 'canopy', walk: true, m: 'w' };
    if (has(/dock_03/)) return { kind: 'Floors', tpl: 'floor', m: 'w' };
    if (has(/pole/)) return { kind: 'Beams', tpl: 'post', m: 'w' };
    if (has(/fence/)) return { kind: 'Fences', tpl: 'fence', m: 'w' };
    if (has(/ladder/)) return { kind: 'Stairs', tpl: 'ladder', m: 'w' };
    return { kind: 'Trims', tpl: 'deco', m: 'w' };
  }
  // Ancient Empire
  if (has(/amphitheatre|temp_building|pergola/)) return null;
  const wood = has(/door|fence|trellis|ladder|(^|_)beam_01|ceiling_02|balcony_0[1-3]$|balcony_stairs|balcony_pillar_01|banner/) && !has(/(^|_)wall_/);
  const m = wood ? 'w' : 's';
  if (has(/banner_roof|roof_detail|roof_topper|roof_edge|roof_end_|corner_cap|peak_large_01_trim|thin_large_01_trim/)) return { kind: 'Trims', tpl: 'deco', m: 't' };
  if (has(/ornament|(^|_)trim_|floor_trim|beam_detail|wall_large_cap|pillar_cap|stairs_wall_cap|stairs_wall_0|balcony_stairs/)) return { kind: 'Trims', tpl: 'deco', m };
  if (has(/stairs_wall_edge/)) return { kind: 'Trims', tpl: 'beam', m };
  if (has(/door_monument/)) return { kind: 'Big', tpl: 'block', m };
  if (has(/wall_.*door|glass_door/)) return { kind: 'Walls', tpl: 'wall', open: true, m };
  if (has(/wall_circle/)) return { kind: 'Walls', tpl: 'wall', open: true, m };
  if (has(/(^|_)door/)) return { kind: 'Doors', tpl: 'door', m: 'w' };
  if (has(/pillar_base|pillar_top|pillar_trim|monument_trim|seat_bench_04_pillar/)) return { kind: 'Beams', tpl: 'block', m };
  if (has(/pillar|wall_end|tiny_end|bath_corner/)) return { kind: 'Beams', tpl: 'post', m };
  if (has(/step_0\d_(corner|insert)/)) return { kind: 'Stairs', tpl: 'deco', m };
  if (has(/stair|staris|step_0/)) return { kind: 'Stairs', tpl: 'stairs', m };
  if (has(/side/)) return { kind: 'Gables', tpl: 'tri', m: 's' };
  if (has(/roof_base_corner/)) return { kind: 'Roofs', tpl: 'deco', m: 't' };
  if (has(/roof_base_flat|trellis_roof_0|trellis_roof_large/)) return { kind: has(/trellis/) ? 'Roofs' : 'Roofs', tpl: 'floor', roof: true, m: has(/trellis/) ? 'w' : 't' };
  if (has(/peak/)) return { kind: 'Roofs', tpl: 'ridge', m: 't' };
  if (has(/roof/)) return { kind: 'Roofs', tpl: 'roof', m: 't' };
  if (has(/(^|_)balcony_01$/)) return { kind: 'Floors', tpl: 'deck', m };
  if (has(/ceiling|floor/)) return { kind: 'Floors', tpl: 'floor', m };
  if (has(/beam/)) return { kind: 'Beams', tpl: 'beam', m };
  if (has(/fence/)) return { kind: 'Fences', tpl: 'fence', m: 'w' };
  if (has(/wall|trellis_0|bath_edge/)) return { kind: 'Walls', tpl: 'wall', m };
  return { kind: 'Trims', tpl: 'deco', m };
}

// ---- the page: each model measured as the game loads it (assets.js loadPack): its turned bounds, and for a doorway the
// opening, found by rays through the wall's plane on a 5 cm grid
async function page() {
  const THREE = await import('three'), { loadPack } = await import('../../src/assets.js');   // (relative to the page, which is served from this folder)
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(0, 0, 1);
  window.measure = async (job) => {
    const gl = await loadPack(job.f); gl.scene.updateMatrixWorld(true);
    const pos = []; gl.scene.traverse((m) => { if (!m.isMesh) return; const g = (m.geometry.index ? m.geometry.toNonIndexed() : m.geometry.clone()).applyMatrix4(m.matrixWorld), p = g.attributes.position; for (let i = 0; i < p.count; i++) pos.push([p.getX(i), p.getY(i), p.getZ(i)]); });
    const box = (P) => { const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity]; for (const p of P) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); } return [lo, hi]; };
    const turnP = (P, q) => P.map(([x, y, z]) => { for (let k = 0; k < q; k++) [x, z] = [z, -x]; return [x, y, z]; });   // (a quarter turn about y, as rotateY(π/2) does)
    let [lo, hi] = box(pos), turn = 0;
    const S = () => [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]], mid = () => [(lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2];
    const mean = (P, f) => { let s = 0, n = 0; for (const p of P) if (f(p)) { s += p[1]; n++; } return n ? s / n : 0; };
    const t = job.tpl;
    // a slope's or a span's axis: the one along which the height changes most (a slope: from end to end; a ridge: from the
    // middle out). Laid along z, a slope rising towards -z
    const corr = (P, k, abs) => { const c = mid(); let sxy = 0, sxx = 0, syy = 0, my = 0, mx = 0; for (const p of P) { mx += abs ? Math.abs(p[k] - c[k]) : p[k] - c[k]; my += p[1]; } mx /= P.length; my /= P.length; for (const p of P) { const x = (abs ? Math.abs(p[k] - c[k]) : p[k] - c[k]) - mx, y = p[1] - my; sxy += x * y; sxx += x * x; syy += y * y; } return sxy / Math.sqrt(sxx * syy || 1); };
    let P = pos;
    if (['roof', 'rafter', 'stairs'].includes(t)) { if (Math.abs(corr(P, 0)) > Math.abs(corr(P, 2))) turn = 1; P = turnP(pos, turn); [lo, hi] = box(P); const c = mid(); if (mean(P, (p) => p[2] < c[2]) < mean(P, (p) => p[2] > c[2])) { turn += 2; P = turnP(pos, turn); [lo, hi] = box(P); } }
    else if (t === 'ridge') { if (corr(P, 0, true) < corr(P, 2, true)) turn = 1; P = turnP(pos, turn); [lo, hi] = box(P); }
    else if (['wall', 'tri', 'gable', 'trim', 'fence', 'door', 'beam'].includes(t)) { const s = S(); if (s[2] > s[0] * 1.05) { turn = 1; P = turnP(pos, turn); [lo, hi] = box(P); } }
    // (a half gable stands high at +x; a door hangs from x 0, its handle side away from it, which can't be told: as it comes)
    let apex = null;
    if (t === 'tri' || t === 'gable' || t === 'trim') { const c = mid(); let top = -Infinity, ax = 0; for (const p of P) if (p[1] > top - 1e-3) { if (p[1] > top + 1e-3) { top = p[1]; ax = p[0]; } else ax = (ax + p[0]) / 2; } apex = (ax - c[0]) / (S()[0] / 2); if ((t === 'tri' || job.half) && apex < 0) { turn += 2; P = turnP(pos, turn); [lo, hi] = box(P); apex = -apex; } }
    // a doorway: rays along z through the wall's plane, which of them pass; the opening is the clear rectangle round the
    // middle of the wall's foot
    let open = null;
    if (job.open) {
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(P.flat(), 3));
      const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); mesh.updateMatrixWorld(true);
      const step = 0.05, s = S(), nx = Math.round(s[0] / step), ny = Math.round(s[1] / step), clear = (i, j) => { o.set(lo[0] + (i + 0.5) * step, lo[1] + (j + 0.5) * step, lo[2] - 1); rc.set(o, d); rc.far = s[2] + 2; return rc.intersectObject(mesh, false).length === 0; };
      const grid = []; for (let i = 0; i < nx; i++) { grid.push([]); for (let j = 0; j < ny; j++) grid[i].push(clear(i, j)); }
      const j0 = Math.min(ny - 1, Math.round(0.8 / step)); let best = null;
      // (the widest clear column run round any clear foot column, then how high it stays clear)
      for (let i = 0; i < nx; i++) {
        if (!grid[i][j0]) continue; let a = i, b = i; while (a > 0 && grid[a - 1][j0]) a--; while (b < nx - 1 && grid[b + 1][j0]) b++;
        const w = (b - a + 1) * step; if (best && best.w >= w) continue;
        let h = j0; while (h < ny - 1 && grid[Math.floor((a + b) / 2)][h + 1]) h++;
        best = { ox: lo[0] + ((a + b + 1) / 2) * step - mid()[0], w, h: (h + 1) * step };
      }
      if (best && best.w > 0.4 && best.h > 1.2) open = best;
    }
    return { size: S(), turn: turn % 4, apex, open, mats: [...new Set((() => { const a = []; gl.scene.traverse((m) => { if (m.isMesh) for (const mt of [].concat(m.material)) a.push(mt.name); }); return a; })())] };
  };
  window.ready = true;
}

// ---- the pieces
const r2 = (v) => Math.round(v * 100) / 100;
const qz = (v, q) => Math.max(q, Math.round(v / q) * q);
const qh = (v) => (v >= 1 ? Math.max(1, Math.round(v * 2) / 2) : Math.max(0.1, Math.round(v * 10) / 10));
const pretty = (pack, name) => {
  const s = name.replace(PACKS[pack].strip, '').replace(/_optimized$/i, ' (light)').replace(/_snow$/i, ' (snow)').replace(/(\d)\.5/g, '$1½').replace(/(\d)x(?=\d)/g, '$1×').replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
};
// a piece from a measured model: [id, file, kind, name, template, quarter turns, box, params, material, extra]
function piece(it, c, me) {
  const P = PACKS[c.pack], [sh, sv] = P.s, q = c.big && P.qBig ? P.qBig : P.q, [x, y, z] = [me.size[0] * sh, me.size[1] * sv, me.size[2] * sh];
  const nm = c.nominal || [], o = me.open, t = c.tpl === 'tri' && !nm.length && me.apex !== null && Math.abs(me.apex) < 0.3 ? 'gable' : c.tpl;
  let box, p, extra = {};
  const C = (w, h, d, y0 = 0) => [-w / 2, w / 2, y0, y0 + h, -d / 2, d / 2];
  switch (t) {
    case 'wall': { const w = qz(x, q), h = qh(y); box = C(w, h, Math.max(z, 0.1)); p = [w, h]; if (o) extra.open = [o.ox * sh * (w / x), o.w * sh * (w / x), o.h * sv * (h / y)].map(r2); break; }
    case 'tri': { const w = nm[0] ? nm[0] / 2 : qz(x, q), h = nm[1] || qh(y); box = C(w, h, Math.max(z, 0.1)); p = [w, h]; break; }
    case 'gable': { const span = nm[0] || qz(x, q), rise = nm[1] || qh(y); box = C(span, rise, c.frame ? Math.max(z, 0.1) : Math.min(Math.max(z, 0.1), 0.5)); p = [span, rise]; if (o) extra.open = [o.ox * sh * (span / x), o.w * sh * (span / x), o.h * sv * (rise / y)].map(r2); if (c.frame) extra.frame = 1; break; }
    case 'trim': { const span = nm[0], rise = nm[1], run = c.half ? span / 2 : span / 2; box = c.half ? [-run / 2 - 0.45, run / 2 + 0.45, -0.45 * rise / run, rise + 0.3, -0.4, 0.4] : [-run - 0.45, run + 0.45, -0.45 * rise / run, rise + 0.3, -0.4, 0.4]; p = [c.half ? run : span, rise]; if (c.half) extra.half = 1; break; }
    case 'roof': case 'rafter': {
      if (nm.length) { const [span, rise, len] = nm, run = span / 2; box = t === 'roof' ? [-len / 2, len / 2, -0.45 * rise / run, rise + 0.3, -run - 0.05, 0.45] : [-len / 2, len / 2, 0, rise, -run, 0]; p = [len, run, rise]; }
      else { const w = qz(x, q), run = qz(z, q); box = [-w / 2, w / 2, 0, y, -run, 0]; p = [w, run, r2(y)]; }
      break;
    }
    case 'ridge': {
      if (nm.length) { const [span, rise, len] = nm, run = span / 2; box = c.frame ? [-len / 2, len / 2, 0, rise, -span, 0] : [-len / 2, len / 2, -0.45 * rise / run, rise + 0.3, -span - 0.45, 0.45]; p = [len, span, rise]; }
      else { const w = qz(x, q), span = qz(z, q); box = [-w / 2, w / 2, 0, y, -span, 0]; p = [w, span, r2(y)]; }
      if (c.frame) extra.frame = 1; break;
    }
    case 'floor': { const w = qz(x, q), d = qz(z, q), th = Math.max(y, 0.04); box = C(w, th, d, -th); p = [w, d]; break; }
    case 'deck': { const w = qz(x, q), d = qz(z, q); box = C(w, y, d, -0.12); p = [w, d, r2(y - 0.12)]; break; }
    case 'stairs': { const run = qz(z, q), rise = c.rise || qh(y); box = [-x / 2, x / 2, 0, rise, -run, 0]; p = [r2(x), run, rise]; break; }
    case 'post': case 'ladder': { const h = qh(y); box = C(x, h, z); p = [h, r2(x), r2(z)]; break; }
    case 'beam': { const len = qz(x, q); box = C(len, y, z, -y / 2); p = [len, r2(y), r2(z)]; break; }
    case 'fence': { const w = qz(x, q); box = C(w, y, Math.max(z, 0.1)); p = [w, r2(y)]; break; }
    case 'door': { box = [0, x, 0, y, -z / 2, z / 2]; p = [r2(x), r2(y)]; break; }
    case 'block': case 'canopy': { const w = qz(x, q), d = qz(z, q); box = C(w, y, d); p = [w, r2(y), d]; if (t === 'canopy') { extra.walk = c.walk ? 1 : 0; extra.roof = c.roof ? 1 : 0; } break; }
    default: { box = C(x, y, z); p = [r2(x), r2(y), r2(z)]; }
  }
  const id = `${P.pre}.${it.id.split('/')[1].replace(/^(rpgpp-ag-|sm-bld-|sm-prop-|sm-env-|sm-)/, '')}`;
  return [id, 'all/' + it.id, `${P.label} · ${c.kind}`, pretty(c.pack, it.name), t, me.turn, box.map(r2), p.map(r2), c.m, Object.keys(extra).length ? extra : 0];
}

// ---- run
const want = CAT.items.filter((it) => PACKS[it.id.split('/')[0]] && it.kind === 'Buildings').map((it) => ({ it, c: { pack: it.id.split('/')[0], ...(classify(it.id.split('/')[0], it.name) || { skip: true }) } }));
const left = want.filter((w) => w.c.skip), take = want.filter((w) => !w.c.skip);
const server = await serve(), browser = await launch(), tab = await browser.newPage();
tab.on('pageerror', (e) => console.error('page:', e.message));
const html = `<!doctype html><meta charset="utf-8"><script type="importmap">{ "imports": { "three": "/vendor/three/three.module.js" } }</script><script type="module">(${page})()</script>`;
await tab.route('**/tools/assets/__pieces.html', (rt) => rt.fulfill({ contentType: 'text/html', body: html }));
await tab.goto(server.url + '/tools/assets/__pieces.html'); await tab.waitForFunction(() => window.ready, null, { timeout: 60000 });
const out = [], failed = [];
for (const { it, c } of take) {
  try { const me = await tab.evaluate((j) => window.measure(j), { f: 'all/' + it.id, tpl: c.tpl, open: !!c.open, half: !!c.half }); if (c.open && !me.open) c.open = false; out.push(piece(it, c, me)); }
  catch (e) { failed.push(`${it.id}: ${e.message.split('\n')[0]}`); }
}
await browser.close(); server.close();
// in the menu's order: pack, then kind, then name
const PO = Object.values(PACKS).map((p) => p.label), ko = (k) => { const [a, b] = k.split(' · '); return PO.indexOf(a) * 100 + KINDS.indexOf(b); };
out.sort((a, b) => ko(a[2]) - ko(b[2]) || a[3].localeCompare(b[3], 'en', { numeric: true }));
const js = `// The building pieces of the three building packs (RPGPP_AG, Synty Vikings, Synty Ancient Empire), for the reviewer to try
// with Free build on (build/pieces.js packDef). Made by tools/assets/pack-pieces.mjs from the pack catalogue: don't edit by
// hand, run it again. Each: [id, model, menu category, name, template, quarter turns, box [x0, x1, y0, y1, z0, z1] the model
// is fitted into, the template's sizes, material (w wood, s stone, t roofing), extra (open: a doorway [middle, width,
// height]; frame: a frame without a body; walk, roof: a canopy's top to stand on or shelter under; half)]
export const PACK_PIECES = [
${out.map((r) => '  ' + JSON.stringify(r).replace(/"/g, "'") + ',').join('\n')}
];
`;
fs.writeFileSync(path.join(ROOT, 'src/build/pack-pieces.js'), js);
// the reviewer's list
const byPack = {}; for (const r of out) (byPack[r[2].split(' · ')[0]] ||= []).push(r);
const fmt = (b) => `${r2(b[1] - b[0])} × ${r2(b[3] - b[2])} × ${r2(b[5] - b[4])}`;
const TPL = { wall: 'wall', tri: 'half gable', gable: 'gable end', trim: 'gable cap', roof: 'roof panel', ridge: 'ridge (both slopes)', rafter: 'rafters', floor: 'floor', deck: 'deck', stairs: 'stairs', post: 'post', beam: 'beam', ladder: 'ladder (no climbing)', fence: 'fence', door: 'door', block: 'block', canopy: 'on posts', deco: 'trim (on any face)' };
let md = `# Pack building pieces: the reviewer's list

Status: **for review** (26 Nov). Every building piece of RPGPP_AG, Synty Vikings and Synty Ancient Empire is in the game
as a piece the hammer can place, **only with the dev tools' Free build on** (Esc → Dev tools → Free crafting and building), each pack in tabs
of its own in the hammer's menu ("RPGPP · Walls", "Vikings · Roofs", "Empire · Stairs"…). Tick the ones that stay
(\`[x]\`); the rest go. Their textures become stylised texels afterwards.

How they fit our grid (3 m walls and floors, 3 m storeys):
- **RPGPP_AG** is on our grid already (it's the pack our own kit comes from): sizes as the pack names them.
- **Ancient Empire** is built on 2.5 m: stretched to 3 m across (×1.2), its heights kept (its walls are 3 m high).
- **Vikings** isn't modular (whole house bases, roofs to fit them): scaled by 1.2 and rounded to the 1.5 m grid, so a
  house base is 6 × 2.9 × 6 m and its roof sits on it.
- Every model is stretched to the size in the table (by a few per cent at most for RPGPP and Ancient Empire; the
  rounding to the grid can take up to 0.75 m off or on for Vikings), so pieces meet edge to edge.

What each kind does in the game (the "As" column): walls, floors, roofs, gables, stairs, beams and fences snap and hold
each other up as our own pieces do; a door goes into a doorway of about its size and is stretched to fill it; a **trim**
(windows, shutters, ornaments, handrails, roof details) goes on any face of what's built, where you aim; a **block** is
solid with a top to stand on (the Viking house bases have their doors drawn on: you can't go in); ladders can't be
climbed (the game has no climbing, nor has Valheim). Left out: whole buildings (RPGPP's houses and sheds, Vikings' boat
houses and wharf, Ancient Empire's town blocks, amphitheatre and pergola) and the Vikings' crate.

What doesn't fit, and how it's placed instead:
- **RPGPP's L- and U-shaped stairs** (stairs interior 01, 02b–e, wall platform stairs 01b/c, 02b/c) walk as one straight ramp
  across their box; only the straight flights (02a, entrance, wall platform 01a/02a) match their steps.
- **Roof corners and hip ends** (RPGPP roof corner/end 02–03, Ancient Empire roof base corner) and the **towers' and
  balconies' roofs** have no template of their own: they go as trims (where you aim) and give no shelter.
- **Ancient Empire's plain walls, steps and roof sides** show the whole texture atlas across each face in the pack (the
  pack means them to take a plaster material): they get its white plaster instead.
- **Snow** (Vikings) and **light** (RPGPP's optimised, a few triangles) versions are in as their own pieces.
- **Gates** (RPGPP's door gates, Ancient Empire's fence gate) hang as doors only in a doorway about their width (the
  RPGPP gate frames, Ancient Empire's double doorways); the fence gate stands as a fence.

Pictures: \`assets/ui/pack/icons/p_<id>.webp\` (pack art, so not in the public repo: \`node tools/assets/icons.mjs\` makes them).

`;
for (const [pk, rows] of Object.entries(byPack)) {
  md += `## ${pk} (${rows.length})\n\n`;
  const kinds = {}; for (const r of rows) (kinds[r[2].split(' · ')[1]] ||= []).push(r);
  for (const [k, list] of Object.entries(kinds)) {
    md += `### ${pk} · ${k} (${list.length})\n\n| Keep | Piece | As | Size in game (m) | Model | Picture |\n|---|---|---|---|---|---|\n`;
    for (const r of list) md += `| [ ] | ${r[3]} | ${TPL[r[4]]}${r[9]?.open ? ' (doorway)' : ''} | ${fmt(r[6])} | \`${r[1].replace(/^all\//, '')}\` | ![](../../assets/ui/pack/icons/p_${r[0]}.webp) |\n`;
    md += '\n';
  }
}
md += `## Left out (${left.length})\n\n${left.map((w) => `- \`${w.it.id}\` (${w.it.sub})`).join('\n')}\n`;
if (failed.length) md += `\n## Couldn't be measured (${failed.length})\n\n${failed.map((f) => `- ${f}`).join('\n')}\n`;
fs.writeFileSync(path.join(ROOT, 'docs/plans/pack-pieces.md'), md);
const counts = {}; for (const r of out) counts[r[2]] = (counts[r[2]] || 0) + 1;
console.log(`${out.length} pieces (${left.length} left out, ${failed.length} failed) → src/build/pack-pieces.js, docs/plans/pack-pieces.md`);
for (const [k, n] of Object.entries(counts)) console.log(`  ${k}: ${n}`);
