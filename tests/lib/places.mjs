// Fixed viewpoints across the island, for the performance benchmark and the screenshot comparisons. Each is a page
// snippet that sets the hour and puts the hero and camera somewhere; the world is generated from a fixed seed, so a
// place found by searching is the same place on every run.
const sunYaw = `(() => { const s = AG.sun.position.clone().sub(AG.sun.target.position); return Math.atan2(-s.x, -s.z); })()`;
const later = (ms, code) => `await new Promise((r) => setTimeout(r, ${ms})); ${code}`;

export const PLACES = {
  meadow: { time: 0.25, go: `AG.teleport(60, -60, 2.2, -0.12); P.camDist = 9;` },
  grove: { time: 0.3, go: `AG.teleport(-120, 140, 0.4, -0.35); P.camDist = 10;` },
  forest: { time: 0.3, go: `for (let r = 150; r < 1200; r += 10) { const x = r * 0.7, z = r * 0.7; if (AG.biomeWeights(x, z).y > 0.9) { AG.teleport(x, z, 0.9, 0.05); break; } }` },
  giantwood: { time: 0.28, settle: 8000, go: `const F = await import('/src/world/flora.js'); let done = false; for (let r = 300; r < 1100 && !done; r += 8) for (let a = 0; a < 6.28; a += 0.05) { const x = r * Math.cos(a), z = r * Math.sin(a); if (F.titanBand(x, z) > 0.75 && AG.heightAt(x, z) > 3) { AG.teleport(x, z, 0, 0.25); done = true; break; } } ${later(800, `P.camYaw = ${sunYaw} + 0.5; P.camPitch = 0.4; P.camDist = 5;`)}` },
  temple: { time: 0.32, go: `const s = g.SITES.temple, r = Math.atan2(-s.x, -s.z); AG.teleport(s.x + Math.sin(r) * 26, s.z + Math.cos(r) * 26, r, -0.1); P.camDist = 9;` },
  labyrinth: { time: 0.35, go: `const s = g.SITES.labyrinth; AG.teleport(s.x + 30, s.z + 30, Math.PI / 4, -0.45); P.camDist = 14;` },
  summit: { time: 0.32, settle: 9000, go: `const s = g.SITES.peak; AG.teleport(s.x + 1, s.z + 1, Math.atan2(s.x, s.z), -0.25); P.camDist = 7;` },
  golden: { time: 0.69, go: `AG.teleport(40, -30, 0, -0.02); ${later(600, `P.camYaw = ${sunYaw} + 0.8;`)}` },
  night: { time: 0.8, settle: 8000, go: `AG.teleport(40, -30, 1.2, -0.08);` },
};

// Go there and settle: the hour and the wind frozen, clear sky, no creatures or owl wandering into view, the land and trees streamed
// in, the render resolution pinned at 100% (so frame rates and pictures don't depend on the automatic scaling)
export async function visit(t, name) {
  const p = PLACES[name];
  await t.eval(`AG.S.timeScale = 0; AG.S.still = true; AG.S.time = ${p.time}; AG.setWeather('clear'); AG.snapWeather(); for (const c of [...g.creatures.list]) g.creatures.remove(c);
    g.owl.update = () => {}; g.owl.o.g.visible = false; g.occlusion.clearAll();
    const R = await import('/src/render/core.js'); R.ADAPT.on = false; if (R.ADAPT.k !== 1) { R.ADAPT.k = 1; R.setScale(); }
    ${p.go} return true;`);
  await t.page.waitForFunction(() => AG.terrain.pending === 0, null, { timeout: 90000 });
  await t.wait(p.settle || 6000);
  // (the cloud shadows drift with the frames that passed: put them back where they start)
  await t.eval(`g.occlusion.clearAll(); (await import('/src/render/atmosphere.js')).ATMO.cloudOff.value.set(0, 0); return true;`);
  await t.wait(100);
}
