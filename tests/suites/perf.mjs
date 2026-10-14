// Performance at fixed places, at 1280×720 with the resolution pinned at 100%: frame rate, slow frames, the time a
// frame takes to render uncapped, draw calls and triangles, held to budgets with headroom over what the game does today
// (Apple M4, Metal). Draw calls and triangles depend only on the game, so they're strict; timings also depend on the
// machine, so a slower one may need PERF_FPS=… or PERF_RENDER_MS=… to move those bars. Each run is appended to
// tests/reports/perf-history.jsonl to follow the trend.
import fs from 'node:fs';
import path from 'node:path';
import { visit } from '../lib/places.mjs';
import { REPORTS } from '../lib/harness.mjs';

const BUDGET = { fps: Number(process.env.PERF_FPS) || 50, p95: 28, render: Number(process.env.PERF_RENDER_MS) || 12, draws: 650, tris: 3.5e6 };
const WHERE = ['meadow', 'forest', 'giantwood', 'temple', 'labyrinth', 'summit', 'night'];

export default {
  name: 'Performance',
  slow: true,
  viewport: { w: 1280, h: 720 },
  async run(t) {
    const rows = {};
    for (const name of WHERE) {
      await visit(t, name);
      const m = await t.eval(`const d = []; let last = performance.now(); await new Promise((done) => { const f = (now) => { d.push(now - last); last = now; if (d.length < 180) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
        d.sort((a, b) => a - b); const avg = d.reduce((a, b) => a + b, 0) / d.length, i = AG.renderer.info.render;
        // frames are capped at 60, which hides headroom: also time 20 renders back to back, waiting for the GPU to finish
        const gl = AG.renderer.getContext(); gl.finish(); let t0 = performance.now(); for (let k = 0; k < 20; k++) AG.render(); gl.finish(); const render = (performance.now() - t0) / 20;
        return { render: +render.toFixed(2), fps: +(1000 / avg).toFixed(1), p95: +d[Math.floor(d.length * 0.95)].toFixed(1), worst: +d[d.length - 1].toFixed(1), draws: i.calls, tris: i.triangles, heapMB: performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1e6) : null };`);
      rows[name] = m;
      t.metric(name, `${m.fps} fps · render ${m.render} ms · p95 ${m.p95} ms · ${m.draws} draws · ${(m.tris / 1e6).toFixed(2)}M tris · heap ${m.heapMB} MB`);
      t.check(`${name}: at least ${BUDGET.fps} fps, 95% of frames under ${BUDGET.p95} ms`, m.fps >= BUDGET.fps && m.p95 <= BUDGET.p95, `${m.fps} fps, p95 ${m.p95} ms`);
      t.check(`${name}: a frame renders in under ${BUDGET.render} ms`, m.render <= BUDGET.render, `${m.render} ms`);
      t.check(`${name}: under ${BUDGET.draws} draw calls and ${BUDGET.tris / 1e6}M triangles`, m.draws <= BUDGET.draws && m.tris <= BUDGET.tris, `${m.draws} draws, ${(m.tris / 1e6).toFixed(2)}M tris`);
    }
    fs.mkdirSync(REPORTS, { recursive: true });
    fs.appendFileSync(path.join(REPORTS, 'perf-history.jsonl'), JSON.stringify({ when: new Date().toISOString(), rows }) + '\n');
  },
};
