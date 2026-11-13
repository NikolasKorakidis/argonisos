// Backs up what the licences keep out of this public repo to the team's private one: node tools/assets/backup.mjs
// The converted models and sounds and the catalogue notes are tracked by a git history of their own (.assets-git, kept
// out of this repo) over this same folder, so there is nothing to copy. The raw packs (gigabytes) stay in the team's
// drive; the Blender files and pack/all, every model on its own, are left out (lineup.py, catalogue.py and everything.mjs make
// them again), all but the ones the game loads. The public site is built from it with these files (pages.yml).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), DIR = path.join(ROOT, '.assets-git');
const REMOTE = process.env.ASSETS_REMOTE || 'https://github.com/NikolasKorakidis/argonisos-assets.git';
const PATHS = ['assets/models/pack', 'assets/sounds/pack', 'assets/ui/pack', 'incoming assets/catalogue'];
const git = (...a) => execFileSync('git', ['--git-dir', DIR, '--work-tree', ROOT, '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...a], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
if (!fs.existsSync(DIR)) { execFileSync('git', ['init', '-q', '--bare', '-b', 'main', DIR]); git('config', 'core.bare', 'false'); git('remote', 'add', 'origin', REMOTE); }
git('add', '-f', '--all', '--', ...PATHS, ':(exclude)incoming assets/catalogue/*.blend*', ':(exclude)assets/models/pack/all', ':(exclude)assets/models/pack/all-lod*');   // (-f: this repo's .gitignore names them; every model on its own is made again by everything.mjs)
// ...except the few of pack/all the game itself loads (the cape, the chests, bones, the temple's furnishings): the public
// site is built from this backup (.github/workflows/pages.yml), so those must be in it. Found in the code: whole names
// ('all/<pack>/<model>') and lists spelled out for a prefix ([...].map((k) => 'all/<pack>/<prefix>' + k)).
const used = new Set();
for (const f of fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('dev'))) {
  const src = fs.readFileSync(path.join(ROOT, 'src', f), 'utf8');
  for (const m of src.matchAll(/'(all\/[\w-]+\/[\w-]+[a-z0-9])'/g)) used.add(m[1]);
  for (const m of src.matchAll(/\[([^[\]]*)\]\.map\(\(k\) => '(all\/[\w-]+\/[\w-]+)' \+ k\)/g)) for (const k of m[1].matchAll(/'([\w-]+)'/g)) used.add(m[2] + k[1]);
}
// (and any quoted '<pack>/<model>' that names a file there, for lists spelled without the 'all/' they're loaded with)
for (const f of fs.readdirSync(path.join(ROOT, 'src'), { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('dev'))) {
  for (const m of fs.readFileSync(path.join(ROOT, 'src', f), 'utf8').matchAll(/'([a-z0-9-]+\/[a-zA-Z0-9_-]+)'/g)) if (fs.existsSync(path.join(ROOT, 'assets/models/pack/all', m[1] + '.glb'))) used.add('all/' + m[1]);
}
const files = [...used].map((u) => `assets/models/pack/${u}.glb`), gone = files.filter((f) => !fs.existsSync(path.join(ROOT, f)));
if (gone.length) { console.error('the game loads these, but they are missing (node tools/assets/everything.mjs):\n  ' + gone.join('\n  ')); process.exit(1); }
git('add', '-f', '--', ...files);
if (!git('status', '--porcelain', '--', ...PATHS).trim()) { console.log('nothing new to back up'); process.exit(0); }
git('commit', '-q', '-m', `Backup ${new Date().toISOString().slice(0, 10)}`);
git('push', '-q', '-u', 'origin', 'main');
console.log('backed up:', git('log', '--oneline', '-1').trim(), '→', REMOTE);
