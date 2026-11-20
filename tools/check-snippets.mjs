// The tests' page snippets, without a browser (npm run check): they are strings, so ESLint, Knip and Madge never see
// the modules they load inside the page (`await import('/src/…')`) or the names they take from them. A file moved or a
// name renamed would pass every other check and fail only on the GPU. This finds every such import in tests/, and
// fails if the file is gone or a name it takes (`{ a, b } = await import(…)`, `X.a` after `const X = await import(…)`,
// `(await import(…)).a`) isn't exported. Exports are read from the modules' syntax trees (ESLint's parser), never run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Linter } from 'eslint';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), linter = new Linter(), cache = new Map();
// (the only way ESLint hands out its tree: a rule that keeps the Program node)
function tree(code) {
  let ast = null;
  const msgs = linter.verify(code, { plugins: { t: { rules: { keep: { create: () => ({ Program: (n) => { ast = n; } }) } } } }, rules: { 't/keep': 'error' }, languageOptions: { ecmaVersion: 2024, sourceType: 'module' } });
  if (!ast) throw new Error(msgs[0]?.message || 'unparsable'); return ast;
}
const names = (p, out) => { if (!p) return out; if (p.type === 'Identifier') out.push(p.name); else if (p.type === 'ObjectPattern') for (const q of p.properties) names(q.type === 'RestElement' ? q.argument : q.value, out); else if (p.type === 'ArrayPattern') for (const q of p.elements) names(q, out); else if (p.type === 'AssignmentPattern') names(p.left, out); else if (p.type === 'RestElement') names(p.argument, out); return out; };
function exportsOf(file, seen = new Set()) {
  if (cache.has(file)) return cache.get(file); if (seen.has(file)) return new Set(); seen.add(file);
  const out = new Set(), ast = tree(fs.readFileSync(file, 'utf8'));
  for (const n of ast.body) {
    if (n.type === 'ExportDefaultDeclaration') out.add('default');
    else if (n.type === 'ExportAllDeclaration') { if (n.exported) out.add(n.exported.name); else for (const k of exportsOf(path.resolve(path.dirname(file), n.source.value), seen)) if (k !== 'default') out.add(k); }
    else if (n.type === 'ExportNamedDeclaration') {
      const d = n.declaration; if (d?.declarations) for (const v of d.declarations) for (const k of names(v.id, [])) out.add(k); else if (d?.id) out.add(d.id.name);
      for (const s of n.specifiers) out.add(s.exported.name ?? s.exported.value);
    }
  }
  cache.set(file, out); return out;
}

const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => e.name === 'reports' ? [] : e.isDirectory() ? walk(path.join(d, e.name)) : /\.m?js$/.test(e.name) ? [path.join(d, e.name)] : []);
const bad = [], used = new Map(), IMP = String.raw`await\s+import\(\s*(?<q>['"\x60])(?<p>\/src\/[^'"\x60$]+)\k<q>\s*\)`;
// (each string or template in a test file is read on its own, since a short name such as G or M stands for a module in
// one snippet and for something else in the next; a name imported in one template and used in another is not checked)
const strings = (n, out = []) => {
  if (!n || typeof n !== 'object') return out; if (Array.isArray(n)) { for (const c of n) strings(c, out); return out; }
  if (n.type === 'TemplateLiteral') out.push(n.quasis.map((q) => q.value.cooked ?? q.value.raw).join(' ')); else if (n.type === 'Literal' && typeof n.value === 'string') out.push(n.value);
  for (const k in n) if (k !== 'parent' && k !== 'loc' && k !== 'range') strings(n[k], out); return out;
};
for (const f of walk(path.join(ROOT, 'tests'))) {
  const rel = path.relative(ROOT, f), want = (k) => { if (!used.has(k)) used.set(k, rel); };
  let ast; try { ast = tree(fs.readFileSync(f, 'utf8')); } catch (e) { bad.push(`${rel}: can't be parsed (${e.message})`); continue; }
  for (const text of strings(ast)) {
    if (!text.includes('/src/')) continue;
    const alias = new Map();
    for (const m of text.matchAll(new RegExp(String.raw`(?:const|let|var)\s+\{([^{}]*)\}\s*=\s*` + IMP, 'g'))) for (const p of m[1].split(',')) { const k = p.split(':')[0].trim(); if (k && !k.startsWith('...')) want(m.groups.p + '\0' + k); }
    for (const m of text.matchAll(new RegExp(String.raw`(?:const|let|var|,)\s*([A-Za-z_$][\w$]*)\s*=\s*` + IMP, 'g'))) alias.set(m[1], m.groups.p);
    for (const m of text.matchAll(new RegExp(String.raw`\(\s*` + IMP + String.raw`\s*\)\s*\.\s*([A-Za-z_$][\w$]*)`, 'g'))) want(m.groups.p + '\0' + m[3]);
    for (const m of text.matchAll(new RegExp(IMP, 'g'))) want(m.groups.p + '\0');
    for (const [a, mod] of alias) for (const m of text.matchAll(new RegExp(String.raw`(?<![\w$./])` + a.replace('$', '\\$') + String.raw`\.([A-Za-z_$][\w$]*)`, 'g'))) want(mod + '\0' + m[1]);
  }
}
if (process.env.SNIP_DEBUG) console.log([...used.keys()].map((k) => k.replace('\0', ' ')).join('\n'));
let n = 0;
for (const [k, where] of used) {
  const [mod, name] = k.split('\0'), file = path.join(ROOT, mod); n++;
  if (!fs.existsSync(file)) { bad.push(`${where}: ${mod} doesn't exist`); continue; }
  try { if (name && !exportsOf(file).has(name)) bad.push(`${where}: ${mod} exports no ${name}`); } catch (e) { bad.push(`${mod}: can't be parsed (${e.message})`); }
}
if (bad.length) { console.error('Test snippets import what the game no longer has:\n  ' + [...new Set(bad)].join('\n  ')); process.exit(1); }
console.log(`test snippets: ${n} in-page imports and names, all present`);
