// The stylesheet's sanity, without a browser (npm run check): a comment opened inside another one ends the outer one
// early and the text after it swallows the next rule, which once broke `:root` and turned every menu's text black
// (Patch 21). Fails on a nested comment opener, unbalanced braces, or any var(--x) the stylesheet never defines.
import fs from 'node:fs';
const file = new URL('../src/ui/ui.css', import.meta.url), css = fs.readFileSync(file, 'utf8'), bad = [];
let depth = 0, inC = false, line = 1, opened = 0;
for (let i = 0; i < css.length; i++) {
  const c = css[i], d = css[i + 1]; if (c === '\n') line++;
  if (inC) { if (c === '/' && d === '*') bad.push(`line ${line}: a comment opened inside the comment from line ${opened}`); if (c === '*' && d === '/') { inC = false; i++; } continue; }
  if (c === '/' && d === '*') { inC = true; opened = line; i++; continue; }
  if (c === '{') depth++; else if (c === '}' && --depth < 0) { bad.push(`line ${line}: a } with no {`); depth = 0; }
}
if (inC) bad.push(`the comment from line ${opened} never closes`); if (depth) bad.push(`${depth} { never closed`);
const plain = css.replace(/\/\*[\s\S]*?\*\//g, ''), defined = new Set([...plain.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));
// (and the ones the game sets as it runs: a ring's fill, a swatch's colour, from style="--k:…" or setProperty('--k', …))
const src = new URL('../src/', import.meta.url);
for (const f of fs.readdirSync(src, { recursive: true }).filter((f) => f.endsWith('.js'))) for (const m of fs.readFileSync(new URL(f, src), 'utf8').matchAll(/['"`;\s(](--[\w-]+)['"`]?\s*[:,]/g)) defined.add(m[1]);
for (const v of new Set([...plain.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))) if (!defined.has(v)) bad.push(`var(${v}) is used but never defined`);
const root = /:root\s*\{[^}]*--cream\s*:/.test(plain); if (!root) bad.push(':root no longer defines the palette (--cream)');
if (bad.length) { console.error('ui.css:\n  ' + bad.join('\n  ')); process.exit(1); }
console.log(`ui.css: ${defined.size} colours and values defined, comments and braces balanced`);
