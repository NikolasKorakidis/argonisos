// Converts the team's Unity pack models into the .glb files the game loads: node tools/assets/convert.mjs [name...]
// Each entry in manifest.json names its FBX and texture (paths inside the pack's Assets folder), the clips to keep and
// what the game calls them; Blender (convert.py) does the work, or three.js in a browser page (fbx-page.mjs, "via":
// "three") for the rigs Blender reads wrongly. The pack itself lives, unzipped, in "incoming assets/"
// (git-ignored: the licences don't allow it in a public repo), and so do the results in assets/models/pack/.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from '../../tests/lib/server.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const PACK = process.env.PACK || path.join(ROOT, 'incoming assets/Argonisos-Assets/Assets');
const BLENDER = process.env.BLENDER || '/Applications/Blender.app/Contents/MacOS/Blender';
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8'));
const want = process.argv.slice(2), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-'));
// Unity's clip split points (first and last frame of each named clip) from the model's .meta file
function metaSplits(fbx, names) {
  const meta = fs.readFileSync(fbx + '.meta', 'utf8'), at = {};
  for (const m of meta.matchAll(/\n\s*name: (.+)\n(?:.*\n){0,6}?\s*firstFrame: ([-\d.]+)\n\s*lastFrame: ([-\d.]+)/g)) at[m[1].trim()] = [+m[2], +m[3]];
  return Object.fromEntries(Object.entries(names).map(([ours, theirs]) => { if (!at[theirs]) throw new Error(`no clip ${theirs} in ${fbx}.meta: ${Object.keys(at)}`); return [ours, at[theirs]]; }));
}
// the same job done by three.js in a page (served from the project, which holds the pack in "incoming assets/")
let page = null;
async function viaThree(job) {
  if (!page) { const server = await serve(), browser = await chromium.launch(); page = await browser.newPage(); page.on('pageerror', (e) => console.error(e.message));
    process.on('exit', () => { server.close(); }); page.close = ((c) => async () => { await c(); await browser.close(); server.close(); })(page.close.bind(page));
    await page.goto(server.url + '/tools/assets/fbx.html'); await page.waitForFunction(() => window.ready); }
  const rel = (f) => path.relative(ROOT, f);
  const r = await page.evaluate((j) => window[j.refit ? 'refit' : 'convert'](j), { ...job, srcRel: rel(job.src), textureRel: job.texture && rel(job.texture),
    mixamoRel: job.refit && rel(path.join(ROOT, 'assets/models', job.refit)), attachRel: job.attach?.map((f) => rel(path.join(PACK, f))),
    wear: job.wear && Object.fromEntries(Object.entries(job.wear).map(([k, w]) => [k, { ...w, srcRel: rel(path.join(PACK, w.src)) }])),
    clipFilesRel: job.clipFiles && Object.fromEntries(Object.entries(job.clipFiles).map(([k, f]) => [k, path.relative(ROOT, path.join(PACK, f))])) });
  fs.writeFileSync(job.out, Buffer.from(r.glb, 'base64'));
  console.log(job.name.padEnd(10), (fs.statSync(job.out).size / 1024).toFixed(0).padStart(6), 'KB ', job.refit ? `(refit: ${r.parts.join(' ')}, ${r.joints} joints, ×${r.scale})` : `(three.js: ${r.parts} parts, ${r.bones} bones)`, r.clips?.join(' ') ?? '');
}

// the shared atlases, once each, as WebP: assets/models/pack/tex/<key>.webp (the models name them; assets.js loadPack)
const TEX_OUT = path.join(ROOT, 'assets/models/pack/tex');
for (const [key, t] of Object.entries(manifest.textures || {})) {
  const out = path.join(TEX_OUT, key + '.webp'); if (fs.existsSync(out)) continue; fs.mkdirSync(TEX_OUT, { recursive: true });
  execFileSync('cwebp', ['-quiet', '-q', '88', ...(t.size ? ['-resize', String(t.size), String(t.size)] : []), path.join(PACK, t.src), '-o', out]);
  console.log('texture', key.padEnd(10), (fs.statSync(out).size / 1024).toFixed(0).padStart(5), 'KB');
}

// Models put together from the Ancient Empire pieces (compose.py: "compose" lists the parts, "house" a recipe): each
// material slot keeps the texture its Unity prefab gives it (incoming assets/catalogue/empire-materials.json), and each
// texture they use is kept once in pack/tex like the atlases (the tiling ones at 1024²)
const EMPIRE = path.join(PACK, 'Synty/PolygonAncientEmpire');
let slots = null;
const slotsOf = () => (slots ||= Object.fromEntries(Object.entries(JSON.parse(fs.readFileSync(path.join(ROOT, 'incoming assets/catalogue/empire-materials.json'), 'utf8')))
  .filter(([, v]) => v.textures).map(([k, v]) => [k, v.textures.map((t) => (Array.isArray(t) ? t : path.join(EMPIRE, t)))])));
const part = (src) => (src.includes('/') ? path.join(PACK, src) : path.join(EMPIRE, 'Models', src + '.fbx'));   // (a bare name is an Ancient Empire model)
function compose(name, e, out) {
  const job = { name, out, kit: path.join(EMPIRE, 'Models'), slots: slotsOf(), fallback: path.join(EMPIRE, 'Textures/Alts/PolygonAncientEmpire_01_A.png'), house: e.house,
    compose: (e.compose || []).map((p) => ({ ...p, src: part(p.src) })) };
  const jf = path.join(tmp, name + '.json'); fs.writeFileSync(jf, JSON.stringify(job));
  const log = execFileSync(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, 'compose.py'), '--', jf], { encoding: 'utf8', maxBuffer: 64e6 });
  const done = log.split('\n').find((l) => l.startsWith('COMPOSED'));
  if (!done) { console.error(log.slice(-3000)); process.exit(1); }
  for (const [key, src] of Object.entries(JSON.parse(done.split(' ').slice(2).join(' ')))) {
    const t = path.join(TEX_OUT, key + '.webp'); if (fs.existsSync(t)) continue;
    execFileSync('cwebp', ['-quiet', '-q', '86', '-resize', '1024', '1024', src, '-o', t]); console.log('texture', key.padEnd(10), (fs.statSync(t).size / 1024).toFixed(0).padStart(5), 'KB');
  }
  console.log(name.padEnd(10), (fs.statSync(out).size / 1024).toFixed(0).padStart(6), 'KB ', '(composed)');
}

// A plant's lighter versions (manifest "lod": the level of detail its near version is made from; "far": { lod, tris },
// the mid band's, brought down to about that many triangles): the catalogue's export again, of that level
// (everything.py, KEEP_LOD), in assets/models/pack/all-lod<n>/
let catalogue = null, index = null;
function lodOf(id, lod) {
  if (!lod) return path.join(ROOT, 'assets/models/pack/all', id + '.glb');
  const out = path.join(ROOT, `assets/models/pack/all-lod${lod}`, id + '.glb'); if (fs.existsSync(out)) return out;
  catalogue ||= JSON.parse(fs.readFileSync(path.join(ROOT, 'assets/models/pack/all/catalogue.json'), 'utf8')).items;
  if (!index) { index = path.join(tmp, 'index.json'); execFileSync('node', [path.join(HERE, 'library-index.mjs'), index], { stdio: 'ignore' }); }
  const it = catalogue.find((i) => i.id === id); if (!it) throw new Error('no ' + id + ' in the catalogue');
  execFileSync(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, 'everything.py'), '--', index, it.pack, path.dirname(out), path.join(tmp, 'rec.json')],
    { env: { ...process.env, ONLY: it.file, KEEP_LOD: String(lod) }, stdio: 'ignore' });
  if (!fs.existsSync(out)) throw new Error(`no LOD ${lod} export of ${id}`); return out;
}
// (an atlas convert.py made of a model's card textures: to WebP beside the others)
function atlases(log) {
  for (const l of log.split('\n').filter((x) => x.startsWith('ATLAS '))) {
    const [, key, png] = l.split(' '), t = path.join(TEX_OUT, key + '.webp');
    execFileSync('cwebp', ['-quiet', '-q', '88', '-alpha_q', '100', png, '-o', t]); fs.rmSync(png); console.log('atlas', key, (fs.statSync(t).size / 1024).toFixed(0), 'KB');
  }
}

for (const [name0, e0] of Object.entries(manifest.models).flatMap(([n, e]) => (e.far ? [[n, e], [n + '_far', { ...e, lod: e.far.lod, decimate: e.far.tris, cardShare: undefined, cardMin: 0.12, solidMin: undefined, far: undefined }]] : [[n, e]]))) {
  const name = name0, e = e0;
  if (want.length && !want.includes(name.replace(/_far$/, ''))) continue;
  if (e.compose || e.house) { compose(name, e, path.join(ROOT, 'assets/models/pack', name + '.glb')); continue; }
  if (e.shared && !manifest.textures?.[e.shared]) throw new Error(`${name}: no texture ${e.shared} in the manifest`);
  // (a plant comes from the catalogue's export of its model, everything.mjs, which has the right texture on each part)
  const job = { ...e, name, src: e.plant ? lodOf(e.plant, e.lod) : path.join(PACK, e.src), plant: e.plant && path.join(ROOT, 'assets/models/pack/tex'), texture: e.texture && path.join(PACK, e.texture), out: path.join(ROOT, 'assets/models/pack', name + '.glb'),
    clips: typeof e.clips === 'string' ? manifest.clipSets[e.clips] : e.clips, also: e.also?.map((f) => path.join(PACK, f)), bakeColors: e.bakeColors && path.join(PACK, e.bakeColors) };
  if (e.metaClips) job.splits = metaSplits(job.src, e.metaClips);
  fs.mkdirSync(path.dirname(job.out), { recursive: true });
  if (e.via === 'three' || e.refit) { await viaThree(job); continue; }   // (a character fitted onto the game's Mixamo rig: fbx-page.mjs refit)
  const jf = path.join(tmp, name + '.json'); fs.writeFileSync(jf, JSON.stringify(job));
  const log = execFileSync(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, 'convert.py'), '--', jf], { encoding: 'utf8', maxBuffer: 64e6 });
  const done = log.split('\n').find((l) => l.startsWith('CONVERTED'));
  if (!done) { console.error(log.slice(-3000)); process.exit(1); }
  atlases(log);
  console.log(name.padEnd(10), (fs.statSync(job.out).size / 1024).toFixed(0).padStart(6), 'KB ', done.split(' clips ')[1], log.split('\n').find((l) => l.startsWith('DECIMATED')) || '');
}
await page?.close();
