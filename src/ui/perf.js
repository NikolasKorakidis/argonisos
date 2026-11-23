// The performance overlay (F3, or Settings → Performance overlay): frames per second, a graph of the last few seconds'
// frame times, how long the game's own code takes each frame, draw calls and triangles, the preset and the resolution,
// and a count of hitches with what the last one was doing, so a player can tell us what his machine does.
// Off by default and nearly free when off: each lap() is one test of a flag. On, a few timestamps a frame, one column
// drawn into the graph (the rest of it slid along by a copy), and the text written four times a second.
// A hitch is a frame that took longer than the screen's own refresh by half again (a missed refresh: 33 ms instead of
// 16.7 on a 60 Hz screen); its cause is read from the frame before it, which is the one that ran late: a shader compiled
// for the first time, the longest part of the game's own work if that took most of the frame, else the browser or the
// graphics card (the game's code was quick, so the time went elsewhere: garbage collection, the GPU, other tabs).
// With it (a player on Ultra, 21 Nov: "a lot of performance drops… and crashing"): the graphics card's own time where
// the browser can time it, the memory the game holds on the card (VRAM, below) and in the page (heap), how often the
// resolution changed (each change makes every buffer of the frame again), how often the card dropped the picture, and
// the fire's shadow and the river's copy, the two costliest things that come and go with where you stand. F4 copies a
// full report to the clipboard (and prints it in the console), for the player to paste to us.
export const PERF = { on: false, hitches: 0, over33: 0, since: 0, last: null, log: [] };
const N = 240, H = 60, MAX_MS = 50;
let el = null, txt = null, cv = null, ctx = null, t0 = 0, tLap = 0, prevBegin = 0, jsMs = 0, prevJs = 0, textT = 0, lastText = '';
let laps = {}, prevLaps = {}, progs = 0, prevProgs = 0, progs0 = -1;
const avgLaps = {}, peakLaps = {};   // (each part's time, eased over about a second, and its worst since the overlay opened)
const iv = new Float32Array(120); let ivN = 0, ivI = 0, refresh = 16.7;   // (recent frame intervals, for the screen's refresh)
const hist = new Float32Array(N); let histI = 0;          // (frame intervals over the graph's width, for the averages)

// ---- The memory the game holds on the graphics card: every texture, render buffer and vertex buffer the page makes,
// with the bytes it takes (by its size, format, samples and mipmaps), and what is freed taken off again. Kept always (a
// few lines on each allocation, which are rare), so it is right whenever the overlay is opened. An estimate: the driver
// pads and aligns, and what the browser itself holds isn't seen.
// (allocs: textures and render buffers made, the costly kind; bufs: vertex buffers, made as the world streams in)
export const VRAM = { tex: 0, rb: 0, buf: 0, allocs: 0, bufs: 0, live: new Map() };
const BPP = { 0x881A: 8, 0x8814: 16, 0x8058: 4, 0x8C43: 4, 0x8051: 4, 0x81A6: 4, 0x81A5: 2, 0x88F0: 4, 0x8CAC: 4, 0x8CAD: 8, 0x8229: 1, 0x822B: 2, 0x822D: 2, 0x822F: 4, 0x822E: 4, 0x8230: 8, 0x8C3A: 4, 0x881B: 6, 0x8815: 12, 0x8D62: 2 };
const FMT = { 0x881A: 'RGBA16F', 0x8814: 'RGBA32F', 0x8058: 'RGBA8', 0x8C43: 'sRGB8A8', 0x81A6: 'depth24', 0x88F0: 'depth24s8', 0x8CAC: 'depth32F', 0x8229: 'R8', 0x822E: 'R32F', 0x822D: 'R16F', 0x822F: 'RG16F' };
(function track() {
  const P = globalThis.WebGL2RenderingContext?.prototype; if (!P) return;
  const unit = new Map(), bound = new Map(); let active = 0x84C0, rbNow = null;   // (the texture bound to each target of each unit; the render buffer bound)
  const set = (obj, kind, bytes, desc, add) => { if (!obj) return; const o = VRAM.live.get(obj); if (o) { VRAM[o.kind] -= o.bytes; if (add) bytes += o.bytes; } VRAM.live.set(obj, { kind, bytes, desc }); VRAM[kind] += bytes; if (kind === 'buf') VRAM.bufs++; else VRAM.allocs++; };
  const drop = (obj) => { const o = VRAM.live.get(obj); if (o) { VRAM[o.kind] -= o.bytes; VRAM.live.delete(obj); } };
  const texOf = (target) => unit.get(active)?.[target >= 0x8515 && target <= 0x851A ? 0x8513 : target];
  const wrap = (name, f) => { const o = P[name]; if (o) P[name] = function (...a) { f.apply(this, a); return o.apply(this, a); }; };
  wrap('activeTexture', (u) => { active = u; });
  wrap('bindTexture', (target, t) => { let m = unit.get(active); if (!m) unit.set(active, (m = {})); m[target] = t; });
  wrap('bindRenderbuffer', (target, rb) => { rbNow = rb; });
  wrap('bindBuffer', (target, b) => { bound.set(target, b); });
  wrap('texStorage2D', (target, levels, f, w, h) => set(texOf(target), 'tex', w * h * (BPP[f] || 4) * (levels > 1 ? 4 / 3 : 1) * (target === 0x8513 ? 6 : 1), `${w}×${h} ${FMT[f] || f}${levels > 1 ? ' mips' : ''}`));
  wrap('texStorage3D', (target, levels, f, w, h, d) => set(texOf(target), 'tex', w * h * d * (BPP[f] || 4) * (levels > 1 ? 4 / 3 : 1), `${w}×${h}×${d} ${FMT[f] || f}`));
  wrap('texImage2D', (target, level, f, ...a) => { if (level !== 0) return; const im = a.length >= 6 ? null : a[a.length - 1], w = im ? im.width || im.videoWidth || 0 : a[0], h = im ? im.height || im.videoHeight || 0 : a[1];
    const cube = target >= 0x8515 && target <= 0x851A; set(texOf(target), 'tex', w * h * (BPP[f] || 4), `${w}×${h} ${FMT[f] || f}${cube ? ' cube' : ''}`, cube); });
  wrap('texImage3D', (target, level, f, w, h, d) => { if (level === 0) set(texOf(target), 'tex', w * h * d * (BPP[f] || 4), `${w}×${h}×${d} ${FMT[f] || f}`); });
  wrap('generateMipmap', (target) => { const t = texOf(target), o = t && VRAM.live.get(t); if (o && !o.mips && !o.desc.includes('mips')) { VRAM.tex += o.bytes / 3; o.bytes *= 4 / 3; o.mips = true; } });
  wrap('renderbufferStorage', (target, f, w, h) => set(rbNow, 'rb', w * h * (BPP[f] || 4), `${w}×${h} ${FMT[f] || f}`));
  wrap('renderbufferStorageMultisample', (target, n, f, w, h) => set(rbNow, 'rb', w * h * (BPP[f] || 4) * Math.max(1, n), `${w}×${h} ${FMT[f] || f} ×${n}`));
  wrap('bufferData', (target, d) => set(bound.get(target), 'buf', typeof d === 'number' ? d : d?.byteLength || 0, 'buffer'));
  wrap('deleteTexture', drop); wrap('deleteRenderbuffer', drop); wrap('deleteBuffer', drop);
})();
const MB = (b) => (b / 1048576).toFixed(0);
// (the biggest things on the card, grouped by their size and format)
function vramTop(n = 8) {
  const by = new Map(); for (const o of VRAM.live.values()) if (o.kind !== 'buf') by.set(o.desc, (by.get(o.desc) || 0) + o.bytes);
  return [...by].sort((a, b) => b[1] - a[1]).slice(0, n).map(([d, b]) => `${MB(b)} MB ${d}`);
}

function build() {
  el = document.createElement('div'); el.id = 'perf';
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:60;pointer-events:none;font:11px/1.35 ui-monospace,monospace;color:#f4e6c4;background:rgba(20,14,10,.72);padding:6px 8px;border-radius:4px;white-space:pre';
  cv = document.createElement('canvas'); cv.width = N; cv.height = H; cv.style.cssText = `display:block;width:${N}px;height:${H}px;margin-top:4px`;
  txt = document.createElement('div'); el.append(txt, cv); document.body.appendChild(el); ctx = cv.getContext('2d');
}
export function showPerf(on) {
  PERF.on = !!on; if (on && !el) build(); el?.classList.toggle('hidden', !on);
  if (on) { PERF.hitches = PERF.over33 = 0; PERF.since = performance.now(); PERF.last = null; PERF.log.length = 0; ivN = 0; prevBegin = 0; ctx.clearRect(0, 0, N, H); for (const k in peakLaps) delete peakLaps[k]; }
}
// at the start of the loop, with the renderer (for its count of shader programs)
export function perfBegin(renderer) {
  if (!PERF.on) return;
  const now = performance.now(), dt = prevBegin ? now - prevBegin : 0; prevBegin = now;
  prevJs = jsMs; const pl = prevLaps; prevLaps = laps; laps = pl; for (const k in laps) laps[k] = 0;
  for (const k in prevLaps) { const v = prevLaps[k]; avgLaps[k] = (avgLaps[k] ?? v) + (v - (avgLaps[k] ?? v)) * 0.05; if (!(peakLaps[k] >= v)) peakLaps[k] = v; }
  const np = renderer.info.programs.length, added = np - progs; prevProgs = progs; progs = np; if (progs0 < 0) progs0 = np;
  if (dt > 0) {
    iv[ivI] = dt; ivI = (ivI + 1) % iv.length; ivN = Math.min(ivN + 1, iv.length); hist[histI] = dt; histI = (histI + 1) % N;
    if (ivI % 30 === 0) refresh = refreshMs();
    if (dt > refresh * 1.5 && ivN > 30) {   // (a hitch: the frame before this one ran late)
      PERF.hitches++; if (dt > 33.4) PERF.over33++;
      let cause; if (added > 0 && prevProgs) cause = `shader compile (${added} new)`;
      else if (prevJs > dt * 0.5) { let best = '', bm = 0; for (const k in prevLaps) if (prevLaps[k] > bm) { bm = prevLaps[k]; best = k; } cause = `${best} ${bm.toFixed(1)} ms`; }
      else cause = 'browser or GPU (game code was quick)';
      PERF.last = { ms: dt, cause, at: now }; PERF.log.push(PERF.last); if (PERF.log.length > 20) PERF.log.shift();
    }
    // the graph: slide it one column left, draw this interval (the game's own code in the lower, lighter part)
    ctx.drawImage(cv, -1, 0); ctx.clearRect(N - 1, 0, 1, H);
    const y = (ms) => H - Math.min(H, ms / MAX_MS * H);
    ctx.fillStyle = dt > 33.4 ? '#e0523a' : dt > refresh * 1.5 ? '#e8b830' : '#6fae5a'; ctx.fillRect(N - 1, y(dt), 1, H - y(dt));
    ctx.fillStyle = 'rgba(244,230,196,.55)'; ctx.fillRect(N - 1, y(prevJs), 1, H - y(prevJs));
    ctx.fillStyle = 'rgba(244,230,196,.25)'; ctx.fillRect(N - 1, y(1000 / 60), 1, 1); ctx.fillRect(N - 1, y(1000 / 30), 1, 1);   // (lines at 60 and 30 fps)
  }
  t0 = tLap = now;
}
// the end of one part of the loop (name: what it was)
export function lap(name) { if (!PERF.on) return; const n = performance.now(); laps[name] = (laps[name] || 0) + n - tLap; tLap = n; }
function refreshMs() { const s = Array.from(iv.subarray(0, ivN)).sort((a, b) => a - b); return s[Math.floor(s.length * 0.3)] || 16.7; }
// at the end of the loop: what the frame drew, and (asked only when the text is written) the rest, main.js: the preset,
// the resolution, the GPU's time, the fire's shadow, the river's copy, the resolution's changes and the lost contexts
let fireN = 0, fireT = 0, fireRate = 0;
export function perfEnd(info, more) {
  if (!PERF.on) return;
  const n = performance.now(); jsMs = n - t0; if (n - textT < 250) return; textT = n;
  const g = more(), k = Math.min(N, ivN), xs = []; for (let i = 0; i < k; i++) xs.push(hist[(histI - 1 - i + N) % N]); xs.sort((a, b) => a - b);
  const avg = xs.reduce((a, b) => a + b, 0) / Math.max(1, k), p99 = xs[Math.floor(k * 0.99)] || 0, worst = xs[k - 1] || 0, mins = (n - PERF.since) / 60000;
  const top = Object.entries(prevLaps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, b]) => `${a} ${b.toFixed(1)}`).join(' · ');
  if (n - fireT > 1000) { fireRate = (g.fire.updates - fireN) / ((n - fireT) / 1000); fireN = g.fire.updates; fireT = n; }
  const heap = performance.memory ? `heap ${MB(performance.memory.usedJSHeapSize)} MB` : 'heap n/a', L = PERF.last;
  txt.textContent = lastText = `${g.preset} · res ${Math.round(g.res * 100)}% (${g.w}×${g.h}) · MSAA ${g.samples}× · ${(1000 / refresh).toFixed(0)} Hz screen\n`
    + `${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms avg · p99 ${p99.toFixed(1)} · worst ${worst.toFixed(1)} · GPU ${g.gpu.ok ? g.gpu.ms.toFixed(1) + ' ms' : 'n/a'}\n`
    + `game code ${jsMs.toFixed(1)} ms (${top})\n`
    + `${info.calls} draws · ${(info.triangles / 1e6).toFixed(2)}M tris · ${progs} shaders (${progs - progs0} new since start)\n`
    + `VRAM ≈ ${MB(VRAM.tex + VRAM.rb + VRAM.buf)} MB (buffers of the frame and textures ${MB(VRAM.tex + VRAM.rb)}, geometry ${MB(VRAM.buf)}) · ${heap}\n`
    + `fire shadow ${fireRate.toFixed(0)}/s (${g.fire.casters} casters) · river copy ${g.water.grabbed ? 'on' : 'off'} · res changes ${g.changes} · GPU lost ${g.lost}\n`
    + `hitches ${PERF.hitches} (${(PERF.hitches / Math.max(mins, 1 / 60)).toFixed(1)}/min) · over 33 ms ${PERF.over33}\n`
    + (L ? `last: ${L.ms.toFixed(0)} ms, ${((n - L.at) / 1000).toFixed(0)} s ago: ${L.cause}` : 'last: none') + '\nF4: copy a report for us';
  PERF.more = g;
}
// The report F4 copies: the overlay's text, every part of the game's code (its usual and its worst time), the last
// hitches and their causes, the biggest things on the card, the lost contexts, and the machine as the browser sees it
export function perfReport(renderer) {
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info'), now = performance.now();
  const parts = Object.keys(avgLaps).sort((a, b) => avgLaps[b] - avgLaps[a]).map((k) => `  ${k}: ${avgLaps[k].toFixed(2)} ms (worst ${peakLaps[k]?.toFixed(1) ?? '?'})`);
  const g = PERF.more || {};
  return [`Argonisos performance report, ${new Date().toISOString()}`, lastText, '',
    `graphics card: ${dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)}`,
    `browser: ${navigator.userAgent}`, `screen ${innerWidth}×${innerHeight} at ${devicePixelRatio}× · drawn ${renderer.domElement.width}×${renderer.domElement.height}`,
    `the game's code, per frame (usual, worst):`, ...parts,
    `last hitches:`, ...PERF.log.slice(-12).map((h) => `  ${((now - h.at) / 1000).toFixed(0)} s ago: ${h.ms.toFixed(0)} ms, ${h.cause}`),
    `on the card (≈ ${MB(VRAM.tex + VRAM.rb + VRAM.buf)} MB, ${VRAM.live.size} objects):`, ...vramTop(10).map((s) => '  ' + s),
    `graphics context lost ${g.lost ?? 0} times, back ${g.back ?? 0}: ${JSON.stringify(g.ctxLog || [])}`].join('\n');
}
// (copied by a key press, which lets the page write to the clipboard; the older way where the newer one is refused)
export async function copyPerf(renderer) {
  const text = perfReport(renderer); console.log(text);
  try { await navigator.clipboard.writeText(text); return true; } catch { /* below */ }
  const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch { /* none */ } ta.remove(); return ok;
}
