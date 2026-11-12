// Backs up what the licences keep out of this public repo to the team's private one: node tools/assets/backup.mjs
// The converted models and sounds and the catalogue notes are tracked by a git history of their own (.assets-git, kept
// out of this repo) over this same folder, so there is nothing to copy. The raw packs (gigabytes) stay in the team's
// drive; the Blender files and pack/all, every model on its own, are left out (lineup.py, catalogue.py and everything.mjs make
// them again).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..'), DIR = path.join(ROOT, '.assets-git');
const REMOTE = process.env.ASSETS_REMOTE || 'https://github.com/NikolasKorakidis/argonisos-assets.git';
const PATHS = ['assets/models/pack', 'assets/sounds/pack', 'assets/ui/pack', 'incoming assets/catalogue'];
const git = (...a) => execFileSync('git', ['--git-dir', DIR, '--work-tree', ROOT, '-c', 'credential.helper=', '-c', 'credential.helper=!gh auth git-credential', ...a], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });
if (!fs.existsSync(DIR)) { execFileSync('git', ['init', '-q', '--bare', '-b', 'main', DIR]); git('config', 'core.bare', 'false'); git('remote', 'add', 'origin', REMOTE); }
git('add', '-f', '--all', '--', ...PATHS, ':(exclude)incoming assets/catalogue/*.blend*', ':(exclude)assets/models/pack/all', ':(exclude)assets/models/pack/all-lod*');   // (-f: this repo's .gitignore names them; every model on its own is made again by everything.mjs)
if (!git('status', '--porcelain', '--', ...PATHS).trim()) { console.log('nothing new to back up'); process.exit(0); }
git('commit', '-q', '-m', `Backup ${new Date().toISOString().slice(0, 10)}`);
git('push', '-q', '-u', 'origin', 'main');
console.log('backed up:', git('log', '--oneline', '-1').trim(), '→', REMOTE);
