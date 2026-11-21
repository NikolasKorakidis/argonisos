// The repository's own guards, without a browser (npm run check). The repo is public: the private design docs, the
// team's raw asset drops, everything converted from the licensed packs and the team's asset list must never be in it,
// and .gitignore alone doesn't stop a `git add -f` or a careless edit of it. Fails if any of them is tracked, staged or
// in the last commit. Also parses every tracked JSON file (the asset manifest is read by tools nothing else checks).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), bad = [];
// (compared lower-cased: the Mac's disk ignores case, so Concept/ is the same folder as concept/)
const PRIVATE = ['concept/', 'incoming assets/', 'assets/models/pack/', 'assets/sounds/pack/', 'assets/ui/pack/', '.assets-git/'];
const isPrivate = (f) => { const l = f.toLowerCase(); return PRIVATE.some((p) => l.startsWith(p)) || (!l.includes('/') && l.endsWith('.xlsx')); };
const git = (...a) => { try { return execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\0').filter(Boolean); } catch { return null; } };
const index = git('ls-files', '-z'), head = git('ls-tree', '-r', '-z', '--name-only', 'HEAD') || [];
if (!index) console.log('repo guard: not a git checkout, nothing to check');
else {
  for (const f of new Set([...index, ...head])) if (isPrivate(f)) bad.push(`${f} is in git (${index.includes(f) ? 'tracked or staged' : 'in the last commit'}): it must never be published`);
  for (const f of index.filter((f) => f.endsWith('.json') && fs.existsSync(path.join(ROOT, f)))) try { JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { bad.push(`${f} isn't valid JSON: ${e.message}`); }
}
if (bad.length) { console.error('Repository guard:\n  ' + bad.slice(0, 40).join('\n  ') + (bad.length > 40 ? `\n  …and ${bad.length - 40} more` : '')); process.exit(1); }
if (index) console.log(`repo guard: ${index.length} tracked files, none private; every JSON file parses`);
