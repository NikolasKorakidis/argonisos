// Every model in the team's packs, each on its own and sorted by kind, for the asset browser (dev/index.html) and the
// Blender catalogue (catalogue.py):  node tools/assets/everything.mjs [--sort] [pack…]
// Exports each pack with Blender (everything.py, five at a time) to assets/models/pack/all/<pack>/<model>.glb, converts
// the textures they use to pack/tex/<key>.webp (where loadPack finds them, so the game can take any of these up as it is),
// and writes assets/models/pack/all/catalogue.json: every model with its pack, kind (kinds.mjs), size and triangles, and
// whether the game already uses it. Packs already exported are kept; name packs to export them again. --sort only sorts
// again (after a change to kinds.mjs). All of it stays out of the public repo with the rest of pack/.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync, spawn } from 'node:child_process';
import { kindOf, KINDS } from './kinds.mjs';

const HERE = path.dirname(new URL(import.meta.url).pathname), ROOT = path.resolve(HERE, '../..');
const OUT = path.join(ROOT, 'assets/models/pack/all'), TEX = path.join(ROOT, 'assets/models/pack/tex'), WORK = path.join(OUT, '.records');
const BLENDER = '/Applications/Blender.app/Contents/MacOS/Blender';
const args = process.argv.slice(2), sortOnly = args.includes('--sort'), want = args.filter((a) => !a.startsWith('--'));
fs.mkdirSync(WORK, { recursive: true }); fs.mkdirSync(TEX, { recursive: true });

const index = path.join(os.tmpdir(), 'argonisos-index.json');
execFileSync('node', [path.join(HERE, 'library-index.mjs'), index], { stdio: 'ignore' });
const idx = JSON.parse(fs.readFileSync(index, 'utf8'));
const recOf = (p) => path.join(WORK, p.replace(/[^\w]+/g, '_') + '.json'), slug = (p) => p.toLowerCase().replace(/^synty\/(polygonnaturebiomes\/)?/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

if (!sortOnly) {
  const todo = idx.packs.filter((p) => want.length ? want.includes(p) : !fs.existsSync(recOf(p)));
  // biggest first, so the long ones don't start last
  const count = (p) => { let n = 0; const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) e.isDirectory() ? walk(path.join(d, e.name)) : n += /\.fbx$/i.test(e.name); }; walk(path.join(idx.pack, p)); return n; };
  todo.sort((a, b) => count(b) - count(a));
  const run = (p) => new Promise((ok) => {
    const dir = path.join(OUT, slug(p)); fs.rmSync(dir, { recursive: true, force: true });
    const b = spawn(BLENDER, ['-b', '--factory-startup', '-P', path.join(HERE, 'everything.py'), '--', index, p, dir, recOf(p)]);
    let log = ''; b.stdout.on('data', (d) => { log += d; for (const l of String(d).split('\n')) if (/^(PROGRESS|EVERYTHING|FAILED)/.test(l)) console.log(l.slice(0, 200)); });
    b.on('close', (code) => { if (code || !fs.existsSync(recOf(p))) console.error(p, 'failed with', code, log.split('\n').filter((l) => l.startsWith('FILE')).pop()); ok(); });
  });
  const queue = [...todo]; await Promise.all(Array.from({ length: 5 }, async () => { while (queue.length) await run(queue.shift()); }));
  for (const p of todo) if (!fs.existsSync(recOf(p))) { console.log('again:', p); await run(p); }   // (Blender now and then falls over with five running: once more on its own)
}

// the textures, once each (as big as they are, up to 1024)
const records = [], textures = {};
for (const p of idx.packs) { if (!fs.existsSync(recOf(p))) continue; const r = JSON.parse(fs.readFileSync(recOf(p), 'utf8')); records.push(...r.records.map((x) => ({ ...x, slug: r.slug }))); Object.assign(textures, r.textures); }
for (const [key, src] of Object.entries(textures)) {
  const t = path.join(TEX, key + '.webp'); if (fs.existsSync(t)) continue;
  const w = Number(execFileSync('sips', ['-g', 'pixelWidth', src], { encoding: 'utf8' }).match(/pixelWidth: (\d+)/)?.[1] || 1024);
  const png = src.toLowerCase().endsWith('.tga') || src.toLowerCase().endsWith('.psd') ? path.join(os.tmpdir(), key + '.png') : src;
  if (png !== src) execFileSync('sips', ['-s', 'format', 'png', src, '--out', png], { stdio: 'ignore' });
  execFileSync('cwebp', ['-quiet', '-q', '86', ...(w > 1024 ? ['-resize', '1024', '0'] : []), png, '-o', t]);
}

// which pack files the game already uses (the manifest's sources)
const manifest = JSON.parse(fs.readFileSync(path.join(HERE, 'manifest.json'), 'utf8')), used = new Set();
const note = (f) => { if (typeof f === 'string' && /\.fbx$/i.test(f)) used.add(path.basename(f).toLowerCase()); };
for (const e of Object.values(manifest.models)) { note(e.src); (e.compose || []).forEach((c) => note(c.src)); (e.attach || []).forEach(note); Object.values(e.wear || {}).forEach((w) => note(w.src)); }

const items = records.map((r) => ({ id: `${r.slug}/${r.glb}`, name: r.name, pack: r.pack, file: r.file, ...kindOf(r), size: r.size, tris: r.tris, tex: r.tex, rigged: r.rigged || undefined,
  inGame: used.has(path.basename(r.file).toLowerCase()) || undefined }));
const unsorted = items.filter((i) => i.kind === 'Other');
// textures to cut out where they're clear (leaves, grass cards): their keys and alpha thresholds
const cutout = Object.fromEntries(Object.entries(textures).filter(([, src]) => idx.cut[src] !== undefined).map(([k, src]) => [k, idx.cut[src]]));
fs.writeFileSync(path.join(OUT, 'catalogue.json'), JSON.stringify({ made: new Date().toISOString(), kinds: KINDS, packs: idx.packs, cutout, items }));
console.log(`catalogue: ${items.length} models, ${Object.keys(textures).length} textures (${Object.keys(cutout).length} cut out), ${unsorted.length} not sorted`);
for (const k of Object.keys(KINDS)) console.log(' ', k.padEnd(18), items.filter((i) => i.kind === k).length);
if (unsorted.length) console.log('not sorted:', unsorted.slice(0, 60).map((i) => i.name).join(', '));
