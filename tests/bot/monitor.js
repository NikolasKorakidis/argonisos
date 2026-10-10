// Runs inside the game page while the bot plays: watches every frame and samples the game once a second, noting
// anything wrong as an incident for the bot to collect (and photograph). Installed again after every page reload.
(() => {
  if (window.__mon) return;
  const g = AG.game, P = g.player, M = (window.__mon = { act: 'start', incidents: [], samples: [], hitches: [], frames: 0, t0: performance.now() });
  const where = () => ({ x: +P.pos.x.toFixed(1), y: +P.pos.y.toFixed(1), z: +P.pos.z.toFixed(1) });
  const once = new Map();   // the same problem in the same place is noted once a minute, not every second
  M.note = (kind, detail, extra = {}) => {
    const k = kind + ':' + Math.round(P.pos.x / 10) + ',' + Math.round(P.pos.z / 10), now = performance.now();
    if (once.get(k) > now - 60000) return; once.set(k, now);
    M.incidents.push({ kind, detail, act: M.act, at: where(), t: Math.round((now - M.t0) / 1000), ...extra });
  };
  // every frame: hitches (a frame over 50 ms while the tab is visible and the world isn't loading)
  let last = performance.now();
  const frame = (now) => {
    const d = now - last; last = now; M.frames++;
    if (d > 50 && d < 5000 && document.visibilityState === 'visible' && AG.terrain.pending === 0) M.hitches.push({ ms: Math.round(d), act: M.act, at: where(), t: Math.round((now - M.t0) / 1000) });
    if (M.hitches.length > 2000) M.hitches.splice(0, 1000);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  // every second: where the hero is and whether that makes sense, how the game is doing
  let n = 0;
  M.iv = setInterval(() => {
    n++;
    const p = P.pos, ground = P.groundHere ? P.groundHere(p.x, p.z, p.y) : AG.heightAt(p.x, p.z), info = AG.renderer.info.render, st = P.stats;
    if (![p.x, p.y, p.z].every(Number.isFinite)) M.note('nan', 'the hero\'s position is not a number');
    else if (!AG.S.fly && !P.dead && !P.swimming && p.y < ground - 1.2) M.note('underground', `${(ground - p.y).toFixed(1)} m below the ground`);
    else if (Math.hypot(p.x, p.z) > 1800 || p.y < -40) M.note('out of the world', `at ${Math.round(Math.hypot(p.x, p.z))} m from the centre, y ${p.y.toFixed(0)}`);
    for (const c of g.creatures.list) if (![c.pos.x, c.pos.y, c.pos.z].every(Number.isFinite)) { M.note('nan', `a ${c.type}'s position is not a number`); break; }
    for (const k of ['health', 'stamina']) { const v = st[k]; if (v !== undefined && !Number.isFinite(v)) M.note('nan', `${k} is ${v}`); }
    if (g.paused && !M.allowPause) M.note('paused', 'the game paused itself');
    const s = { t: Math.round((performance.now() - M.t0) / 1000), act: M.act, fps: Math.round(AG.fps), draws: info.calls, tris: info.triangles, creatures: g.creatures.list.length, drops: g.pickups.drops.length, x: Math.round(p.x), z: Math.round(p.z) };
    if (performance.memory) s.heap = Math.round(performance.memory.usedJSHeapSize / 1e6);
    if (n % 10 === 0) { let objs = 0; AG.scene.traverse(() => objs++); s.objects = objs; s.geometries = AG.renderer.info.memory.geometries; s.textures = AG.renderer.info.memory.textures; }
    M.samples.push(s); if (M.samples.length > 7200) M.samples.splice(0, 3600);
  }, 1000);
})();
