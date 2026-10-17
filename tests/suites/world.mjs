// The world's fingerprint: the land is generated from hashes of position, and saves refer to trees by their place in
// each cell's layout, so a change anywhere in that chain changes the game. This hashes everything the generator makes
// (heights, biomes, the slope rule, ground colours, the trial's sites, the trees, plants and pickups of every sampled
// cell) and compares it with the fingerprint recorded below. Runs in Node, without a browser or a GPU, in about twenty seconds,
// so it also runs on every pull request.
// When the world is meant to change: run `node tests/run.mjs world --update`, paste the new fingerprint printed here,
// and bump WORLD_LAYOUT in src/game/save.js if trees or pickups moved.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../lib/server.mjs';

const FINGERPRINT = {
  heights: '11d2a772', biomes: '7cf08545', rock: 'b3c2807e', colours: 'ee54c788', sites: '9f717d17', flora: 'b115707a', pickups: 'e99a3603',
};

// FNV-1a over numbers rounded to a fixed precision (so the hash doesn't depend on the last float bit)
function hasher() {
  let h = 0x811c9dc5;
  const add = (v) => { const s = Number.isFinite(v) ? (Math.round(v * 1e4) / 1e4).toString() : String(v); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } h ^= 44; h = Math.imul(h, 0x01000193); };
  return { add, hex: () => (h >>> 0).toString(16).padStart(8, '0') };
}

export default {
  name: 'World fingerprint',
  node: true,
  async run(t, { flags }) {
    const mod = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
    const G = await mod('src/world/gen.js'), S = await mod('src/world/sites.js'), F = await mod('src/world/flora.js'), PK = await mod('src/world/pickup-layout.js');
    const got = {}, H = {}; for (const k of Object.keys(FINGERPRINT)) H[k] = hasher();
    const R = G.WORLD.R, w = { p: 0, y: 0, v: 0, r: 0 }, c = [0, 0, 0, 0];
    for (let z = -R; z <= R; z += 23) for (let x = -R; x <= R; x += 23) {
      const h = G.heightAt(x, z); H.heights.add(h);
      G.biomeWeights(x, z, w); H.biomes.add(w.p); H.biomes.add(w.y); H.biomes.add(w.v);
      const g = G.slopeGrade(x, z); H.rock.add(g); H.rock.add(G.rockLimit(x, z)); H.rock.add(G.isRock(x, z) ? 1 : 0);
      G.groundColor(x, z, h, g, w, c); for (const v of c) H.colours.add(v);
    }
    for (const s of [...S.ALL_SITES(), S.SITES.peak].filter(Boolean)) for (const v of [s.x, s.z, s.y, s.r]) H.sites.add(v);
    H.sites.add(S.ALL_SITES().map((s) => s.kind).join());
    const cells = []; for (let cz = -7; cz < 7; cz++) for (let cx = -7; cx < 7; cx++) cells.push([cx, cz]);
    for (const [cx, cz] of [[15, 3], [-17, 9], [4, -19], [-8, -16], [19, 18]]) cells.push([cx, cz]);   // (forest hills, marsh and the giant forest)
    let items = 0; for (const [cx, cz] of cells) { const it = F.layoutCell(cx, cz); items += it.length / F.STRIDE; for (const v of it) H.flora.add(v); }
    for (const [cx, cz] of cells) for (const p of PK.layoutPickups(cx, cz)) { H.pickups.add(p.id + p.kind); for (const v of [p.x, p.z, p.y, p.rot]) H.pickups.add(v); }
    for (const k of Object.keys(FINGERPRINT)) got[k] = H[k].hex();
    t.metric('fingerprint', got); t.metric('flora items sampled', items);
    if (flags.has('--update')) { console.log('\n  new fingerprint: ' + JSON.stringify(got).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ') + '\n'); return; }
    for (const k of Object.keys(FINGERPRINT)) t.check(`${k}: exactly as before`, got[k] === FINGERPRINT[k], `fingerprint ${got[k]}, recorded ${FINGERPRINT[k]}`);
  },
};
