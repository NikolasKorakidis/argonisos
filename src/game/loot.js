// Searching what was left about the island's places (reviewer, 23 Nov: "the loot depends on the kind, a pile of wood
// gives 20 wood"), Valheim's way: look at a jar, a basket, a sack, a heap of straw or a woodpile and E takes what it
// holds, once. The sites put these props down (world/structures.js stash, town.js), each with an id made of its site
// and where it stands, never its place in a list, so a prop added later shifts nothing; what has been searched is kept
// with the chests' ids in the trial's list (S.trial.looted, saved with the rest of the trial) and comes back emptied.
// The temple's offerings, the altars and the shrines' bowls and censers are the gods': none of them is a store.
import { ITEMS } from './items.js';
import { seeded } from '../util/math.js';

// What each kind holds: name (in the prompt), take (shown as "Take the wood (20)" rather than "Search the jar": the
// whole of it is the loot, so how much is said), give: every line given, each [item, least, most]; or one: one line
// drawn of these; rolls: how many draws of one; none: the share found empty (a few dry jars keep it from being a
// larder); rare: [share, item, wear range] a worn tool now and then; look: how it shows once searched (structures.js
// empty). Kept to the first days' things: food, fibre, rope, resin, seeds, wood; nothing from the hills or the bosses.
const JAR = [['olive', 3, 6], ['oliveSeed', 2, 3], ['resin', 1, 2], ['rope', 1, 2]];
const AMPHORA = [['olive', 2, 4], ['resin', 1, 3], ['rope', 1, 2], ['pomegranateSeed', 1, 2]];
const BASKET = [['olive', 3, 5], ['pomegranate', 1, 2], ['tomato', 2, 3], ['fiber', 3, 5], ['acorn', 2, 4]];
const SACK = [['acorn', 3, 6], ['oliveSeed', 2, 3], ['pomegranateSeed', 1, 2], ['fiber', 4, 6]];
export const KINDS = {
  woodpile: { name: 'wood', take: true, give: [['wood', 20, 20]], look: 'pile' },
  logs: { name: 'wood', take: true, give: [['wood', 8, 12]], look: 'pile' },   // (a small stack, by a shepherd's fire)
  straw: { name: 'straw stack', take: true, give: [['fiber', 4, 6]], look: 'heap' },
  bundle: { name: 'straw bundle', take: true, give: [['fiber', 2, 3]], look: 'heap' },
  jar: { name: 'jar', one: JAR, none: 0.25, look: 'pot' },
  jars: { name: 'jars', one: JAR, rolls: 2, none: 0.1, look: 'pot' },
  pithos: { name: 'storage jar', one: [['acorn', 4, 7], ['olive', 4, 8], ['oliveSeed', 2, 4], ['pomegranateSeed', 1, 3]], none: 0.2, look: 'pot' },
  amphora: { name: 'amphora', one: AMPHORA, none: 0.3, look: 'pot' },
  amphorae: { name: 'amphorae', one: AMPHORA, rolls: 2, none: 0.1, look: 'pot' },
  basket: { name: 'basket', one: BASKET, none: 0.15, look: 'basket' },
  baskets: { name: 'baskets', one: BASKET, rolls: 2, none: 0.05, look: 'basket' },
  sack: { name: 'sack', one: SACK, none: 0.2, look: 'heap' },
  sacks: { name: 'sacks', one: SACK, rolls: 2, none: 0.05, look: 'heap' },
  // (the smithy's forge stands in for a tool rack: charcoal and stones about it, and now and then a tool left to mend)
  forge: { name: 'forge', give: [['coal', 1, 3], ['stone', 2, 4]], rare: [0.3, ['crudeAxe', 'crudeClub'], [0.2, 0.45]], look: null },
};

// The dice of one prop: from its id alone, so what it holds is the same on every run and in every save
function dice(id) { let h = 0x811c9dc5; for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 0x01000193); } return seeded((h >>> 0) % 2147483646 + 1); }
// What a prop holds: [[item, n, extra?]...], empty when it holds nothing
export function lootOf(st) {
  const K = KINDS[st.kind], r = dice(st.id), n = ([, a, b]) => a + Math.floor(r() * (b - a + 1)), out = [];
  for (let i = 0; i < 3; i++) r();   // (the first draws of a short seed run close together: let them go)
  if (K.none && r() < K.none) return out;
  for (const l of K.give || []) out.push([l[0], n(l)]);
  for (let k = 0; k < (K.rolls || (K.one ? 1 : 0)); k++) { const l = K.one[Math.floor(r() * K.one.length)], had = out.find((o) => o[0] === l[0]); if (had) had[1] += n(l); else out.push([l[0], n(l)]); }
  if (K.rare && r() < K.rare[0]) { const [, ids, [w0, w1]] = K.rare, id = ids[Math.floor(r() * ids.length)]; out.push([id, 1, { dur: Math.round(ITEMS[id].dur * (w0 + r() * (w1 - w0))) }]); }
  return out;
}

export class Loot {
  constructor(g) { this.g = g; this.n = 0; }
  get looted() { return this.g.trial.st.looted; }
  // The store you're facing within reach (its spot a little ahead of you, as for the things on the ground), and what E
  // does there: nothing once it has been searched, so the prompt goes quiet as Valheim's do
  interactable(pos, f) {
    const list = this.g.structures.stores; if (this.n !== list.length) this.sync();   // (the caves' come later, from a worker)
    const fx = pos.x + f.x * 0.9, fz = pos.z + f.z * 0.9; let best = null, bd = 1e9;
    for (const st of list) {
      if (st.emptied || Math.abs(st.at.y - pos.y) > 2.2) continue;
      const d = Math.hypot(st.at.x - fx, st.at.z - fz); if (d < st.r && d < bd && !this.walled(pos, st.at)) { bd = d; best = st; }
    }
    if (!best) return null; const K = KINDS[best.kind];
    if (K.take) { const [[id, n]] = lootOf(best); return { kind: 'store', st: best, label: `Take the ${ITEMS[id].name.toLowerCase()} (${n})`, sub: best.sub || '', use: () => this.search(best) }; }
    return { kind: 'store', st: best, label: `Search the ${K.name}`, sub: best.sub || '', use: () => this.search(best) };
  }
  // a site's wall between you and it (structures.js marks its posts): not through a wall
  walled(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1;
    for (const c of this.g.colliders.near((a.x + b.x) / 2, (a.z + b.z) / 2, L / 2 + 1)) {
      if (!c.wall) continue; const t = ((c.x - a.x) * dx + (c.z - a.z) * dz) / (L * L);
      if (t > 0.05 && t < 0.95 && Math.hypot(a.x + dx * t - c.x, a.z + dz * t - c.z) < c.r) return true;
    }
    return false;
  }
  search(st) {
    const g = this.g, K = KINDS[st.kind]; if (st.emptied || this.looted.includes(st.id)) return;
    g.acts?.reach(); this.looted.push(st.id); const got = lootOf(st);
    for (const [id, n, extra] of got) g.give(id, n, extra);
    if (!got.length) g.hud.toast(`Nothing in the ${K.name} but dust`);
    g.sound?.(K.look === 'pot' || K.look === null ? 'pick' : 'rustle'); g.structures.empty(st, K.look);
  }
  // after a load, and whenever stores come in: the ones searched before shown so (no sound, nothing given)
  sync() { const L = this.looted, list = this.g.structures.stores; this.n = list.length; for (const st of list) if (!st.emptied && L.includes(st.id)) this.g.structures.empty(st, KINDS[st.kind].look); }
}
