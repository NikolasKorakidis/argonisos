// The performance overlay (F3, or Settings → Performance overlay): frames per second, a graph of the last few seconds'
// frame times, how long the game's own code takes each frame, draw calls and triangles, the preset and the resolution,
// and a count of hitches with what the last one was doing, so a player can tell us what his machine does.
// Off by default and nearly free when off: each lap() is one test of a flag. On, a few timestamps a frame, one column
// drawn into the graph (the rest of it slid along by a copy), and the text written four times a second.
// A hitch is a frame that took longer than the screen's own refresh by half again (a missed refresh: 33 ms instead of
// 16.7 on a 60 Hz screen); its cause is read from the frame before it, which is the one that ran late: a shader compiled
// for the first time, the longest part of the game's own work if that took most of the frame, else the browser or the
// graphics card (the game's code was quick, so the time went elsewhere: garbage collection, the GPU, other tabs).
export const PERF = { on: false, hitches: 0, over33: 0, since: 0, last: null };
const N = 240, H = 60, MAX_MS = 50;
let el = null, txt = null, cv = null, ctx = null, t0 = 0, tLap = 0, prevBegin = 0, jsMs = 0, prevJs = 0, textT = 0;
let laps = {}, prevLaps = {}, progs = 0, prevProgs = 0;
const iv = new Float32Array(120); let ivN = 0, ivI = 0, refresh = 16.7;   // (recent frame intervals, for the screen's refresh)
const hist = new Float32Array(N); let histI = 0;          // (frame intervals over the graph's width, for the averages)
function build() {
  el = document.createElement('div'); el.id = 'perf';
  el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:60;pointer-events:none;font:11px/1.35 ui-monospace,monospace;color:#f4e6c4;background:rgba(20,14,10,.72);padding:6px 8px;border-radius:4px;white-space:pre';
  cv = document.createElement('canvas'); cv.width = N; cv.height = H; cv.style.cssText = `display:block;width:${N}px;height:${H}px;margin-top:4px`;
  txt = document.createElement('div'); el.append(txt, cv); document.body.appendChild(el); ctx = cv.getContext('2d');
}
export function showPerf(on) {
  PERF.on = !!on; if (on && !el) build(); el?.classList.toggle('hidden', !on);
  if (on) { PERF.hitches = PERF.over33 = 0; PERF.since = performance.now(); PERF.last = null; ivN = 0; prevBegin = 0; ctx.clearRect(0, 0, N, H); }
}
// at the start of the loop, with the renderer (for its count of shader programs)
export function perfBegin(renderer) {
  if (!PERF.on) return;
  const now = performance.now(), dt = prevBegin ? now - prevBegin : 0; prevBegin = now;
  prevJs = jsMs; const pl = prevLaps; prevLaps = laps; laps = pl; for (const k in laps) laps[k] = 0;
  const np = renderer.info.programs.length, added = np - progs; prevProgs = progs; progs = np;
  if (dt > 0) {
    iv[ivI] = dt; ivI = (ivI + 1) % iv.length; ivN = Math.min(ivN + 1, iv.length); hist[histI] = dt; histI = (histI + 1) % N;
    if (ivI % 30 === 0) refresh = refreshMs();
    if (dt > refresh * 1.5 && ivN > 30) {   // (a hitch: the frame before this one ran late)
      PERF.hitches++; if (dt > 33.4) PERF.over33++;
      let cause; if (added > 0 && prevProgs) cause = `shader compile (${added} new)`;
      else if (prevJs > dt * 0.5) { let best = '', bm = 0; for (const k in prevLaps) if (prevLaps[k] > bm) { bm = prevLaps[k]; best = k; } cause = `${best} ${bm.toFixed(1)} ms`; }
      else cause = 'browser or GPU (game code was quick)';
      PERF.last = { ms: dt, cause, at: now };
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
// at the end of the loop: what the frame drew, the preset and the resolution
export function perfEnd(info, gfx) {
  if (!PERF.on) return;
  const n = performance.now(); jsMs = n - t0; if (n - textT < 250) return; textT = n;
  const k = Math.min(N, ivN), xs = []; for (let i = 0; i < k; i++) xs.push(hist[(histI - 1 - i + N) % N]); xs.sort((a, b) => a - b);
  const avg = xs.reduce((a, b) => a + b, 0) / Math.max(1, k), p99 = xs[Math.floor(k * 0.99)] || 0, worst = xs[k - 1] || 0, mins = (n - PERF.since) / 60000;
  const top = Object.entries(prevLaps).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([a, b]) => `${a} ${b.toFixed(1)}`).join(' · ');
  const L = PERF.last;
  txt.textContent = `${gfx.preset} · res ${Math.round(gfx.res * 100)}% (${gfx.w}×${gfx.h}) · ${(1000 / refresh).toFixed(0)} Hz screen\n`
    + `${(1000 / avg).toFixed(0)} fps · ${avg.toFixed(1)} ms avg · p99 ${p99.toFixed(1)} · worst ${worst.toFixed(1)}\n`
    + `game code ${jsMs.toFixed(1)} ms (${top})\n`
    + `${info.calls} draws · ${(info.triangles / 1e6).toFixed(2)}M tris · ${progs} shaders\n`
    + `hitches ${PERF.hitches} (${(PERF.hitches / Math.max(mins, 1 / 60)).toFixed(1)}/min) · over 33 ms ${PERF.over33}\n`
    + (L ? `last: ${L.ms.toFixed(0)} ms, ${((n - L.at) / 1000).toFixed(0)} s ago: ${L.cause}` : 'last: none');
}
