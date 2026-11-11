// The catalogue of every model in the team's packs (tools/assets/everything.mjs writes it, git-ignored with the packs),
// and the filters the sidebar sets on it. Filtering runs over the plain list before any of it reaches the page.
const FILE = new URL('../../assets/models/pack/all/catalogue.json', import.meta.url);

export async function loadCatalogue() {
  const r = await fetch(FILE).catch(() => null); if (!r || !r.ok) return null;
  const c = await r.json().catch(() => null); if (!c?.items?.length) return null;
  const kinds = Object.keys(c.kinds), rank = new Map();
  kinds.forEach((k, i) => c.kinds[k].forEach((s, j) => rank.set(k + '|' + s, i * 100 + j)));
  for (const it of c.items) {
    it.big = Math.max(...it.size); it.rank = rank.get(it.kind + '|' + it.sub) ?? 1e5;
    it.snow = /_snow(_|\d|$)/i.test(it.name);
    it.find = `${it.name} ${it.id} ${it.file} ${it.kind} ${it.sub} ${it.pack}`.toLowerCase().replace(/[_-]+/g, ' ');   // (what the search box looks in)
  }
  // each group from small to large, as tools/assets/library.py lays them out
  c.items.sort((a, b) => a.rank - b.rank || a.big - b.big || a.name.localeCompare(b.name));
  c.byId = new Map(c.items.map((it) => [it.id, it]));
  return c;
}

// f: { q (search words), pack, inGame, noSnow, kind, sub }. The tree's counts use everything but the kind and group.
export function test(it, f, withKind = true) {
  if (f.pack && it.pack !== f.pack) return false;
  if (f.inGame && !it.inGame) return false;
  if (f.noSnow && it.snow) return false;
  if (withKind && f.kind && (it.kind !== f.kind || (f.sub && it.sub !== f.sub))) return false;
  if (f.q) for (const w of f.q.toLowerCase().replace(/[_-]+/g, ' ').split(/\s+/)) if (w && !it.find.includes(w)) return false;
  return true;
}
export const filter = (items, f) => items.filter((it) => test(it, f));

export const metres = (v) => v >= 10 ? v.toFixed(1) : v.toFixed(2);
export const sizeText = (s) => `${metres(s[0])} × ${metres(s[1])} × ${metres(s[2])} m`;
