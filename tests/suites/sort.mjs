// Sort Items, without a browser: 500 random packs; nothing lost or duplicated, stacks within their limits, the hotbar
// and worn items stay where they are, piles merged and ordered by name.
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { ROOT } from '../lib/server.mjs';

export default {
  name: 'Inventory sort',
  node: true,
  async run(t) {
    const { Inventory, COLS } = await import(pathToFileURL(path.join(ROOT, 'src/game/inventory.js')));
    const { ITEMS } = await import(pathToFileURL(path.join(ROOT, 'src/game/items.js')));
    const ids = Object.keys(ITEMS), problems = new Map();
    const total = (slots) => { const m = {}; for (const s of slots) if (s) m[s.id] = (m[s.id] || 0) + s.n; return JSON.stringify(Object.entries(m).sort()); };
    for (let run = 0; run < 500; run++) {
      const inv = new Inventory(); let seed = run + 1; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < inv.slots.length; i++) if (r() < 0.6) { const id = ids[Math.floor(r() * ids.length)], d = ITEMS[id]; const s = { id, n: 1 + Math.floor(r() * d.stack) }; if (d.dur) s.dur = Math.floor(r() * d.dur); if (r() < 0.08 && d.type !== 'material') s.worn = 'hand'; inv.slots[i] = s; }
      const before = total(inv.slots), hot = JSON.stringify(inv.slots.slice(0, COLS)), worn = inv.slots.map((s, i) => (s?.worn ? [i, JSON.stringify(s)] : null)).filter(Boolean);
      const durs = inv.slots.slice(COLS).filter((s) => s?.dur !== undefined && !s.worn).map((s) => s.id + s.dur).sort().join();
      inv.sort(COLS, inv.slots.length);
      const after = inv.slots, bad = (k) => problems.set(k, (problems.get(k) || 0) + 1);
      if (total(after) !== before) bad('totals changed');
      if (JSON.stringify(after.slice(0, COLS)) !== hot) bad('hotbar moved');
      for (const [i, s] of worn) if (JSON.stringify(after[i]) !== s) bad('worn item moved');
      if (after.some((s) => s && s.n > ITEMS[s.id].stack)) bad('over a stack limit');
      if (after.slice(COLS).filter((s) => s?.dur !== undefined && !s.worn).map((s) => s.id + s.dur).sort().join() !== durs) bad('durability lost');
      const names = after.slice(COLS).filter((s) => s && !s.worn).map((s) => ITEMS[s.id].name); if (names.some((n, i) => i && names[i - 1].localeCompare(n) > 0)) bad('not in name order');
      const piles = {}; for (const s of after.slice(COLS)) if (s && !s.worn && Object.keys(s).length === 2) (piles[s.id] ||= []).push(s.n);
      if (Object.entries(piles).some(([id, ns]) => ns.filter((n) => n < ITEMS[id].stack).length > 1)) bad('piles left unmerged');
    }
    t.check('500 random packs sort cleanly', problems.size === 0, [...problems].map(([k, n]) => `${k} (${n} runs)`).join(', '));
  },
};
