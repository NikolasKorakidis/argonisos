// The light holds steady as you walk (tester, 13 Nov: "I see a beam of light through the trees, then I go close and it
// pops off… I go out from the forest and step two steps ahead and it's immediately disappeared"). The hero walks a
// straight path from deep in a wood out into a meadow and back, and straight towards the sun through the trees, with the
// hour held (but the wind, haze and everything else running as in play). Every 100 ms the picture is read back and
// compared with the one before: the change in the mean brightness, the largest change in any of 48 big tiles (8×6) and
// in any 8×8-pixel block; and the same for the light the woods' haze and the shafts add on their own. Walking makes a
// steady noise in all of them (things pass, the grass sways); light that switches on or off with where you stand makes a
// spike well above it. The hero is hidden (their swinging limbs would swamp the blocks), the camera is held close behind
// their head (below most crowns, so leaves rarely sweep across it) and nothing fades out of the camera's way.
//   LIGHT_FRAMES=<dir> also saves a strip of frames from each walk.
import fs from 'node:fs';
import path from 'node:path';

// Where to walk: a straight line from deep in a wood (many trees within 15 m) to open meadow (none within 22 m of its end),
// passing no trunk or rock, on dry land well away from the trial's sites; heading `dir` (radians, 0 = +x), or any.
const FIND = (dir, len, need) => `const F = await import('/src/world/flora.js'), S = await import('/src/world/sites.js');
  const trees = [], solid = []; for (let cx = -9; cx < 9; cx++) for (let cz = -9; cz < 9; cz++) { const it = F.layoutCell(cx, cz); for (let o = 0; o < it.length; o += F.STRIDE) { if (!(it[o + 6] > 0)) continue; const sp = F.SPECIES[it[o]]; if (sp.res === 'tree') trees.push(it[o + 2], it[o + 4]); if (sp.col) solid.push(it[o + 2], it[o + 4], sp.col * it[o + 6] + 1.0); } }
  const count = (x, z, r) => { let n = 0; for (let k = 0; k < trees.length; k += 2) if ((trees[k] - x) ** 2 + (trees[k + 1] - z) ** 2 < r * r) n++; return n; };
  const clear = (x0, z0, dx, dz, L) => { for (let k = 0; k < solid.length; k += 3) { const px = solid[k] - x0, pz = solid[k + 1] - z0, u = Math.max(0, Math.min(L, px * dx + pz * dz)); if ((px - u * dx) ** 2 + (pz - u * dz) ** 2 < solid[k + 2] ** 2) return false; } for (let u = 0; u <= L; u += 4) { const x = x0 + dx * u, z = z0 + dz * u, h = AG.heightAt(x, z); if (h < 2 || Math.abs(AG.heightAt(x + 2, z) - h) > 1.2 || Math.abs(AG.heightAt(x, z + 2) - h) > 1.2) return false; } return true; };
  const sites = S.ALL_SITES(); const far = (x, z) => sites.every((s) => Math.hypot(s.x - x, s.z - z) > s.r + 40);
  for (let r = 40; r < 520; r += 6) for (let a = 0; a < 6.28; a += 0.13) { const x = Math.cos(a) * r, z = Math.sin(a) * r; if (!far(x, z) || count(x, z, 15) < ${need}) continue;
    for (const d of ${dir === null ? '[...Array(24).keys()].map((i) => i * 0.2618)' : `[${dir}]`}) { const dx = Math.cos(d), dz = Math.sin(d);
      if (${dir === null ? `count(x + dx * ${len}, z + dz * ${len}, 22) === 0 &&` : ''} far(x + dx * ${len}, z + dz * ${len}) && clear(x, z, dx, dz, ${len})) return { x, z, dx, dz, len: ${len}, start: count(x, z, 15), end: count(x + dx * ${len}, z + dz * ${len}, 22) }; } }
  return null;`;

// Read the picture back right after each frame is drawn (every 100 ms, while on), and with it the light the air adds on
// its own: the woods' haze (the light it scatters) and the shafts of sun, from the atmosphere pass's own buffers, so a
// branch sweeping past the camera (which changes the picture, not the light) can be told from light switching on or
// off. For each: the mean brightness, 48 big tiles and every 8×8 block, compared with the last capture's.
const HOOK = `const RC = await import('/src/render/core.js'), AM = await import('/src/render/atmosphere.js'), gl = AG.renderer.getContext();
  if (!window._cap) { const draw = RC.composer.render.bind(RC.composer); window._cap = { on: false };
    // (l: brightness per pixel, 0-255, w × h → its means per 8×8 block, per tile and over all, and the change from last time)
    const measure = (l, w, h, prev, out) => { const bw = Math.floor(w / 8), bh = Math.floor(h / 8), blk = new Float32Array(bw * bh); let all = 0;
      for (let y = 0; y < bh * 8; y++) for (let x = 0; x < bw * 8; x++) { const v = l[y * w + x]; blk[(y >> 3) * bw + (x >> 3)] += v; all += v; }
      for (let i = 0; i < blk.length; i++) blk[i] /= 64; const mean = all / (bw * bh * 64);
      const TX = 8, TY = 6, tile = new Float32Array(TX * TY), tn = new Float32Array(TX * TY);
      for (let by = 0; by < bh; by++) for (let bx = 0; bx < bw; bx++) { const t = Math.floor(by * TY / bh) * TX + Math.floor(bx * TX / bw); tile[t] += blk[by * bw + bx]; tn[t]++; }
      for (let i = 0; i < tile.length; i++) tile[i] /= tn[i];
      if (prev) { const db = []; let mx = 0, tm = 0; for (let i = 0; i < blk.length; i++) { const v = Math.abs(blk[i] - prev.blk[i]); db.push(v); if (v > mx) mx = v; }
        for (let i = 0; i < tile.length; i++) tm = Math.max(tm, Math.abs(tile[i] - prev.tile[i]));
        db.sort((a, b) => a - b); Object.assign(out, { mean: Math.abs(mean - prev.mean), tile: tm, block: mx, p99: db[Math.floor(db.length * 0.99)], lum: +mean.toFixed(1) }); }
      return { blk, tile, mean }; };
    const readRT = (rt) => { if (!rt || rt.width < 8) return null; AG.renderer.setRenderTarget(rt); const f = new Float32Array(rt.width * rt.height * 4); gl.readPixels(0, 0, rt.width, rt.height, gl.RGBA, gl.FLOAT, f); return f; };
    RC.composer.render = (...a) => { draw(...a); const c = window._cap, now = performance.now(); if (!c.on || now - c.last < 100) return; c.last = now;
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight; if (!c.buf || c.buf.length !== w * h * 4) c.buf = new Uint8Array(w * h * 4);
      AG.renderer.setRenderTarget(null); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, c.buf); const d = c.buf, l = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) l[i] = 0.2126 * d[i * 4] + 0.7152 * d[i * 4 + 1] + 0.0722 * d[i * 4 + 2];
      const row = { x: +P.pos.x.toFixed(1), z: +P.pos.z.toFixed(1) }; c.prev = measure(l, w, h, c.prev, row);
      // the air's light: the haze's (the light it scatters, from its blended buffer when there is one) and, apart, the
      // shafts' (a quarter of the size, in the sun's colour and strength), at half the size of the picture; linear × 255
      const A = RC.atmosphere, U = AM.ATMO, haze = U.woodK.value > 0.0001 ? readRT(A.hist ? A.hist[A.hi] : A.hazeRT) : null, sh = U.shaftK?.value > 0.001 && A.sh ? readRT(A.sh[1]) : null;
      const hw = Math.ceil(w / 2), hh = Math.ceil(h / 2), qw = Math.ceil(w / 4), hl = new Float32Array(hw * hh), shl = new Float32Array(hw * hh), sc = U.sunCol.value, sk = (0.2126 * sc.r + 0.7152 * sc.g + 0.0722 * sc.b) * (U.shaftK?.value || 0);
      for (let y = 0; y < hh; y++) for (let x = 0; x < hw; x++) { const i = y * hw + x;
        if (haze && haze.length === hw * hh * 4) hl[i] = 255 * (0.2126 * haze[i * 4] + 0.7152 * haze[i * 4 + 1] + 0.0722 * haze[i * 4 + 2]);
        if (sh) shl[i] = 255 * sk * sh[((y >> 1) * qw + (x >> 1)) * 4]; }
      const hz = {}, sf = {}; c.prevHaze = measure(hl, hw, hh, c.prevHaze, hz); c.prevSh = measure(shl, hw, hh, c.prevSh, sf);
      if (hz.mean !== undefined) { row.haze = hz; row.shafts = sf; }
      AG.renderer.setRenderTarget(null);
      if (row.mean !== undefined) c.rows.push(row);
      if (c.keep && c.rows.length % c.keep === 0) { const cv = c.cv || (c.cv = document.createElement('canvas')); cv.width = w / 2; cv.height = h / 2; const x2 = cv.getContext('2d'), im = x2.createImageData(w / 2, h / 2);
        for (let y = 0; y < h / 2; y++) for (let x = 0; x < w / 2; x++) { const s = ((h - 1 - y * 2) * w + x * 2) * 4, o = (y * (w / 2) + x) * 4; im.data[o] = d[s]; im.data[o + 1] = d[s + 1]; im.data[o + 2] = d[s + 2]; im.data[o + 3] = 255; }
        x2.putImageData(im, 0, 0); c.frames.push(cv.toDataURL('image/png')); } }; }
  return true;`;

const stats = (a) => { const s = [...a].sort((p, q) => p - q), q = (k) => s[Math.min(s.length - 1, Math.floor(s.length * k))]; return { median: q(0.5), p90: q(0.9), max: s[s.length - 1] }; };
const r1 = (v) => +v.toFixed(2);

// Walk from (x, z) along (dx, dz) for len metres, the camera behind the hero looking the way they go; → the rows captured
async function walk(t, p, { time, back = false, frames }) {
  const dx = back ? -p.dx : p.dx, dz = back ? -p.dz : p.dz, x = back ? p.x + p.dx * p.len : p.x, z = back ? p.z + p.dz * p.len : p.z;
  await t.eval(`AG.S.time = ${time}; AG.teleport(${x}, ${z}, Math.atan2(${-dx}, ${-dz}), 0.02); P.camDist = 2; P.root.visible = false; window._cap.on = false; return true;`);
  await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 });
  await t.wait(6000);
  await t.eval(`Object.assign(window._cap, { on: true, last: 0, prev: null, rows: [], frames: [], keep: ${frames ? 6 : 0} }); return true;`);
  await t.wait(600);
  await t.page.keyboard.down('KeyW'); await t.wait((p.len / 4.6 + 0.4) * 1000); await t.page.keyboard.up('KeyW'); await t.wait(500);
  const r = await t.eval(`window._cap.on = false; return { rows: window._cap.rows, frames: window._cap.frames, at: [P.pos.x, P.pos.z] };`);
  const walked = Math.hypot(r.at[0] - x, r.at[1] - z);
  return { ...r, walked };
}

// A walk passes when the woods' haze, the light that used to switch with where you stood, never jumps: no step's change
// in its mean or in any tile is more than SPIKE times the usual change of the steps around it (a light switching on or off
// is one such step; walking out of a wood into the open changes it steadily over many). The shafts follow the shapes
// against the sky by their nature (a branch crossing the sun moves them), so they and the whole picture are reported
// beside it; the picture's mean must never leap as far as a light switching on does, nor blow out white.
const SPIKE = 4, FLOOR = { mean: 0.3, tile: 2 }, PICTURE_STEP = 30, PICTURE_TOP = 220;
const fmt = (S) => ['mean', 'tile', 'block'].map((k) => `${k} ${r1(S[k].median)}/${r1(S[k].p90)}/${r1(S[k].max)}`).join(' · ');
// each step's change over the median of the six steps before and after it
const local = (xs, floor) => Math.max(0, ...xs.map((x, i) => { const w = xs.slice(Math.max(0, i - 6), i).concat(xs.slice(i + 1, i + 7)).sort((a, b) => a - b); return x / Math.max(w[Math.floor(w.length / 2)] ?? 0, floor); }));
function judge(t, name, w) {
  const of = (rows) => ({ mean: stats(rows.map((r) => r.mean)), tile: stats(rows.map((r) => r.tile)), block: stats(rows.map((r) => r.block)) }), zero = { mean: 0, tile: 0, block: 0 };
  const haze = w.rows.map((r) => r.haze || zero), shafts = w.rows.map((r) => r.shafts || zero), S = of(w.rows), H = of(haze), F = of(shafts);
  const jump = { haze: [local(haze.map((r) => r.mean), FLOOR.mean), local(haze.map((r) => r.tile), FLOOR.tile)], picture: local(w.rows.map((r) => r.mean), 0.5), top: Math.max(...w.rows.map((r) => r.lum)) };
  t.metric(name, `${w.rows.length} steps, walked ${w.walked.toFixed(0)} m · picture ${fmt(S)}, brightest ${r1(jump.top)}, largest jump ${r1(jump.picture)}× · haze ${fmt(H)}, largest jump ${r1(jump.haze[0])}× (mean) ${r1(jump.haze[1])}× (tile) · shafts ${fmt(F)} (median/p90/max of the changes, 0-255)`);
  t.check(`${name}: the woods' haze never jumps (no step over ${SPIKE}× the steps round it), the picture never leaps or blows out`,
    w.rows.length > 20 && jump.haze[0] <= SPIKE && jump.haze[1] <= SPIKE && S.mean.max <= PICTURE_STEP && jump.top <= PICTURE_TOP,
    `haze jumps ${r1(jump.haze[0])}× / ${r1(jump.haze[1])}×, picture step ${r1(S.mean.max)} (limit ${PICTURE_STEP}), brightest ${r1(jump.top)} (limit ${PICTURE_TOP})`);
  return { picture: S, haze: H, shafts: F, jump };
}

export default {
  name: 'Light while walking',
  slow: true,
  viewport: { w: 1100, h: 620 },
  async run(t) {
    const out = process.env.LIGHT_FRAMES, report = {};
    await t.eval(`const R = await import('/src/render/core.js'); R.ADAPT.on = false; if (R.ADAPT.k !== 1) { R.ADAPT.k = 1; R.setScale(); }
      AG.S.timeScale = 0; AG.setWeather('clear'); AG.snapWeather(); for (const c of [...g.creatures.list]) g.creatures.remove(c); g.creatures.update = () => {};
      g.owl.update = () => {}; g.owl.o.g.visible = false; g.occlusion.clearAll(); g.occlusion.update = () => {}; ${HOOK}`);
    const edge = await t.eval(FIND(null, 70, 9));
    if (!t.check('a straight path from deep in a wood out into a meadow', edge, 'none found')) return;
    t.metric('wood to meadow', `from ${edge.x.toFixed(0)}, ${edge.z.toFixed(0)} (${edge.start} trees within 15 m) heading ${Math.atan2(edge.dz, edge.dx).toFixed(2)}, ${edge.len} m`);
    const sun = await t.eval(`AG.S.time = 0.15; await new Promise((r) => setTimeout(r, 300)); const s = AG.sun.position.clone().sub(AG.sun.target.position); return Math.atan2(s.z, s.x);`);
    const beam = await t.eval(FIND(sun, 50, 8));
    const walks = [['out of the wood at 9:00', edge, { time: 0.15 }], ['back into the wood at 9:00', edge, { time: 0.15, back: true }],
      ['out of the wood at 17:00', edge, { time: 0.55 }], ['out of the wood at night', edge, { time: 0.86 }], ['back into the wood at night', edge, { time: 0.86, back: true }]];
    if (beam) walks.push(['towards the sun through the wood at 9:00', beam, { time: 0.15 }]);
    else t.metric('towards the sun', 'no clear path towards the sun found');
    for (const [name, p, o] of walks) {
      const w = await walk(t, p, { ...o, frames: !!out });
      report[name] = { ...judge(t, name, w), rows: w.rows };
      if (out && w.frames.length) { fs.mkdirSync(out, { recursive: true }); w.frames.forEach((u, i) => fs.writeFileSync(path.join(out, `${name.replace(/[^a-z0-9]+/gi, '-')}-${String(i).padStart(2, '0')}.png`), Buffer.from(u.split(',')[1], 'base64'))); }
    }
    fs.writeFileSync(path.join(t.dir, '..', 'light.json'), JSON.stringify(report));
  },
};
