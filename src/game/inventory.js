// The player's pack: 8 × 4 slots, the top row doubling as the hotbar (keys 1-8), and a carry limit of 300.
// Over the limit you can still walk, but not run. Equipment (hands, armour) stays in its slot and is flagged as worn.
import { ITEMS } from './items.js';

export const COLS = 8, ROWS = 4, MAX_WEIGHT = 300;

export class Inventory {
  constructor() {
    this.slots = new Array(COLS * ROWS).fill(null);    // { id, n, dur?, worn? }
    this.seen = new Set();                              // every item id ever held (recipes are discovered from these)
    this.onChange = null; this.onNew = null;
  }
  get weight() { let w = 0; for (const s of this.slots) if (s) w += ITEMS[s.id].weight * s.n; return w; }
  get overweight() { return this.weight > MAX_WEIGHT; }
  count(id) { let n = 0; for (const s of this.slots) if (s?.id === id) n += s.n; return n; }
  has(mats) { return Object.entries(mats).every(([id, n]) => this.count(id) >= n); }
  // Room for n more of an item (stacking into existing piles first)
  room(id) { const st = ITEMS[id].stack; let r = 0; for (const s of this.slots) r += !s ? st : s.id === id && !s.worn ? st - s.n : 0; return r; }
  // Add n of an item; returns how many didn't fit
  add(id, n = 1, extra = {}) {
    const def = ITEMS[id]; if (!def) { console.warn('unknown item', id); return n; }
    const first = !this.seen.has(id); this.seen.add(id);
    for (const s of this.slots) { if (n <= 0) break; if (s?.id === id && s.n < def.stack && !s.worn) { const k = Math.min(n, def.stack - s.n); s.n += k; n -= k; } }
    // new piles: the hotbar row first for tools and weapons, the pack (rows 2-4) first for everything else
    const order = [...this.slots.keys()]; if (!['tool', 'weapon', 'shield', 'food'].includes(def.type)) order.push(...order.splice(0, COLS));
    for (const i of order) { if (n <= 0) break; if (!this.slots[i]) { const k = Math.min(n, def.stack); this.slots[i] = { id, n: k, ...(def.dur ? { dur: def.dur } : {}), ...extra }; n -= k; } }
    if (first) this.onNew?.(id);
    this.onChange?.(); return n;
  }
  // Take n of an item out (from the fullest piles last so stacks stay tidy); returns how many were taken
  take(id, n = 1) {
    let left = n;
    for (let i = this.slots.length - 1; i >= 0 && left > 0; i--) { const s = this.slots[i]; if (s?.id === id && !s.worn) { const k = Math.min(left, s.n); s.n -= k; left -= k; if (s.n <= 0) this.slots[i] = null; } }
    if (left < n) this.onChange?.();
    return n - left;
  }
  takeMats(mats) { if (!this.has(mats)) return false; for (const [id, n] of Object.entries(mats)) this.take(id, n); return true; }
  move(a, b) {          // drag a → b: merge piles of the same thing, otherwise swap
    if (a === b) return; const A = this.slots[a], B = this.slots[b]; if (!A) return;
    if (B && B.id === A.id && !A.worn && !B.worn) { const st = ITEMS[A.id].stack, k = Math.min(A.n, st - B.n); B.n += k; A.n -= k; if (A.n <= 0) this.slots[a] = null; }
    else { this.slots[a] = B; this.slots[b] = A; }
    this.onChange?.();
  }
  split(a) {            // halve a pile into the first empty slot
    const A = this.slots[a]; if (!A || A.n < 2) return; const e = this.slots.indexOf(null); if (e < 0) return;
    const k = Math.floor(A.n / 2); A.n -= k; this.slots[e] = { id: A.id, n: k }; this.onChange?.();
  }
  // Sort the slots from..to: identical plain piles merge (up to the stack size), then everything is ordered by name.
  // Worn items keep their slots; anything carrying data of its own (durability...) is moved but never merged.
  sort(from = 0, to = this.slots.length) {
    const idx = []; for (let i = from; i < to; i++) if (!this.slots[i]?.worn) idx.push(i);
    const items = idx.map((i) => this.slots[i]).filter(Boolean), out = [], piles = new Map();
    const plain = (it) => Object.keys(it).every((k) => k === 'id' || k === 'n');
    for (const it of items) {
      const st = ITEMS[it.id]?.stack ?? 1;
      if (st <= 1 || !plain(it)) { out.push(it); continue; }
      let n = it.n; const list = piles.get(it.id) || piles.set(it.id, []).get(it.id);
      for (const p of list) { const k = Math.min(n, st - p.n); p.n += k; n -= k; if (!n) break; }
      while (n > 0) { const k = Math.min(n, st), p = { id: it.id, n: k }; out.push(p); list.push(p); n -= k; }
    }
    out.sort((a, b) => (ITEMS[a.id]?.name ?? a.id).localeCompare(ITEMS[b.id]?.name ?? b.id) || b.n - a.n);
    idx.forEach((i, k) => (this.slots[i] = out[k] || null));
    this.onChange?.();
  }
  drop(i) { const s = this.slots[i]; this.slots[i] = null; this.onChange?.(); return s; }
  worn(slot) { return this.slots.find((s) => s?.worn === slot) || null; }
  toJSON() { return { slots: this.slots, seen: [...this.seen] }; }
  load(o) { this.slots = o.slots.map((s) => (s && ITEMS[s.id] ? s : null)); while (this.slots.length < COLS * ROWS) this.slots.push(null); this.seen = new Set(o.seen); this.onChange?.(); }
}
