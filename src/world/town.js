// The abandoned town and the island's small scenes (placed by sites.js), built from the team's Ancient Empire pieces
// (site-pack.js piece(): houses put together in Blender from the pack's kit, props one by one). The town: two paved
// streets crossing at a square with a fountain, a well, a statue and market stalls under vines; a stoa on the square, a
// ruined temple corner across the street, a dozen houses facing the streets, half of them falling in, a smithy's yard and
// a walled garden, all grown over. Houses block you but their doorways and fallen walls let you in; what still has a roof
// keeps the rain off. Without the pack the places stand empty.
import { piece } from './site-pack.js';
import { clearGrass } from './grass.js';
import { seeded } from '../util/math.js';

const BAY = 2.5, STOREY = 3, R90 = Math.PI / 2;
// the houses as tools/assets/manifest.json builds them: bays across the front (w) and deep (d), the doorway's front bay,
// the bays gone altogether ([side, bay]: sides run front, right, back, left) and how much roof is left
const HOUSE = {
  twHouseA: { w: 3, d: 2, door: 1, roof: 'full' }, twHouseB: { w: 2, d: 2, door: 0, gone: [[1, 1]], roof: 'half' }, twHouseC: { w: 2, d: 1, door: 0, roof: 'full' },
  twHouseD: { w: 4, d: 2, door: 1, gone: [[0, 3]], roof: 'half' }, twHouseE: { w: 3, d: 2, door: 1, gone: [[2, 1], [3, 1]], roof: 'none' }, twHouseF: { w: 2, d: 2, door: 1, roof: 'full' },
  twShed: { w: 1, d: 1, door: 0, roof: 'full' }, twShell: { w: 3, d: 1, door: 1, gone: [[2, 1], [2, 2]], roof: 'none' },
};
// a point of a piece (its own lx, lz) placed at x, z turned rot, in the site's frame
const at = (x, z, rot, lx, lz) => [x + lx * Math.cos(rot) + lz * Math.sin(rot), z - lx * Math.sin(rot) + lz * Math.cos(rot)];
function wallOf(st, ctx, x, z, rot, a, b, c, d, h = STOREY) { const [x0, z0] = at(x, z, rot, a, b), [x1, z1] = at(x, z, rot, c, d); st.wall(ctx, x0, z0, x1, z1, h, 0.25); }
function roofOf(st, ctx, x, z, rot, a, b, c, d, y) { const [x0, z0] = at(x, z, rot, a, c), [x1, z1] = at(x, z, rot, b, d); st.top(ctx, Math.min(x0, x1), Math.max(x0, x1), Math.min(z0, z1), Math.max(z0, z1), y, true); }

// a house at x, z, its front (and door) turned to face rot (0: +z)
function house(st, ctx, k, x, z, rot) {
  const H = HOUSE[k], W = H.w * BAY, D = H.d * BAY; ctx.P.push(...piece(k, x, 0, z, rot));
  for (const [s, n] of [[0, H.w], [1, H.d], [2, H.w], [3, H.d]]) for (let i = 0; i < n; i++) {
    if ((H.gone || []).some(([gs, gi]) => gs === s && gi === i)) continue;
    const [a, b, c, d] = s === 0 ? [-W / 2 + i * BAY, D / 2, -W / 2 + (i + 1) * BAY, D / 2] : s === 1 ? [W / 2, D / 2 - i * BAY, W / 2, D / 2 - (i + 1) * BAY]
      : s === 2 ? [W / 2 - i * BAY, -D / 2, W / 2 - (i + 1) * BAY, -D / 2] : [-W / 2, -D / 2 + i * BAY, -W / 2, -D / 2 + (i + 1) * BAY];
    if (s === 0 && i === H.door) { wallOf(st, ctx, x, z, rot, a, b, a + 0.5, d); wallOf(st, ctx, x, z, rot, c - 0.5, b, c, d); }   // (the doorway: a metre clear in the middle of its bay)
    else wallOf(st, ctx, x, z, rot, a, b, c, d);
  }
  if (H.roof !== 'none') roofOf(st, ctx, x, z, rot, -W / 2, H.roof === 'full' ? W / 2 : -W / 2 + Math.max(1, Math.floor(H.w / 2)) * BAY, -D / 2, D / 2, STOREY);
  return { W, D };
}
// the stoa: six columns along the front, a lean-to roof rising to a back wall (12.5 × 5 m)
function stoa(st, ctx, x, z, rot) {
  ctx.P.push(...piece('twStoa', x, 0, z, rot));
  for (let i = 0; i <= 5; i++) { const [cx, cz] = at(x, z, rot, -6.25 + i * BAY, 2.2); st.solid(ctx, cx, cz, 0.38); }
  wallOf(st, ctx, x, z, rot, -6.25, -2.4, 6.25, -2.4, 4.5); wallOf(st, ctx, x, z, rot, -6.25, -2.4, -6.25, 0.1); wallOf(st, ctx, x, z, rot, 6.25, -2.4, 6.25, 0.1);
  roofOf(st, ctx, x, z, rot, -6.25, 6.25, -2.4, 2.6, STOREY);
}
// the ruined temple corner: columns standing, fallen drums, a heap of marble and the back wall's last courses
function templeRuin(st, ctx, x, z, rot) {
  ctx.P.push(...piece('twTempleRuin', x, 0, z, rot));
  for (const [lx, lz, r] of [[-3.8, 4.2, 0.4], [-1.3, 4.2, 0.4], [1.2, 4.2, 0.45], [3.7, 4.2, 0.45], [-3.8, -0.8, 0.4], [-3.8, 1.7, 0.45], [2.7, -2.4, 1.2], [-1.8, 1.6, 0.8]]) { const [cx, cz] = at(x, z, rot, lx, lz); st.solid(ctx, cx, cz, r); }
  wallOf(st, ctx, x, z, rot, -3.5, -4.0, 0.6, -4.0, 2.1);
}

export function buildTown(st, s) {
  const ctx = st.site(s, 0.35), P = ctx.P, rnd = seeded(97), rr = (a, b) => a + rnd() * (b - a);
  const put = (k, x, z, rot = 0, r = 0, sc = 1, y = 0) => { P.push(...piece(k, x, y, z, rot, sc)); if (r) st.solid(ctx, x, z, r); };
  const bare = (key, x, z, hw, hd) => { const c = st.w(ctx, x, z); clearGrass('town' + key, { x: c.x, z: c.z, hw, hd, rot: ctx.rot }); };
  // the streets: paved, crossing at the square (and the grass worn off them)
  for (const sz of [-1, 1]) {
    for (const d of [16.95, 30.85]) { put('twRoad', 0, sz * d, 0, 0, 1, 0.01); put('twRoad', sz * d, 0, R90, 0, 1, 0.01); }
    bare('ns' + sz, 0, sz * 23, 2.8, 13.5); bare('ew' + sz, sz * 23, 0, 13.5, 2.8);
  }
  bare('square', 0, 0, 10, 10);
  // the square: the fountain, a statue looking down the north street, the well, market stalls under vines, benches
  put('twFountain', 0, 0, 0, 1.6); put('twPlinth', 0, -7.2, 0, 0.45); put('twStatue', 0, -7.2, 0, 0, 1, 1.0);
  put('twWell', -6.8, -6.5, 0.4, 1.6);
  for (const [x, z, r] of [[-6.6, 6.6, 0.2], [6.6, 6.6, -0.15], [6.6, -6.6, 0.1]]) {
    put('twPergola', x, z, r); for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) { const [cx, cz] = at(x, z, r, px, pz); st.solid(ctx, cx, cz, 0.18); }
    roofOf(st, ctx, x, z, 0, -1.25, 1.25, -1.25, 1.25, STOREY);
    put('twTable', x, z, r + R90, 0.7, 0.8); put('twVase', x - 0.4, z + 0.2, rr(0, 6), 0, 0.8, 0.62); put('twBasket', x + 0.35, z - 0.3, rr(0, 6), 0, 0.9, 0.62);
    put(rnd() < 0.5 ? 'twSacks' : 'twBaskets', x + 2.4, z + rr(-0.6, 0.6), rr(0, 6), 0.8); put('twJars', x - 2.3, z + rr(-0.5, 0.5), rr(0, 6), 0.7);
  }
  for (const [x, z, r] of [[3.4, 2.4, 0.6], [-3.4, 2.4, -0.6], [3.2, -2.6, -0.5]]) put('twBench', x, z, r, 0.6);
  // the stoa on the north side of the square, braziers before it; the temple ruin across the street
  stoa(st, ctx, -8.7, -15.6, 0); for (const x of [-13.5, -4.2]) put('twBrazier', x, -11.6, 0, 0.75, 0.6);
  put('twBanner', -8.7, -13.2, 0, 0, 1, 1.2);
  templeRuin(st, ctx, 15.2, -17, Math.PI);
  // the houses, facing the streets
  for (const [k, x, z, rot] of [
    ['twHouseD', -5.6, -27.5, R90], ['twShed', -12.6, -25, R90], ['twHouseE', -22, -16.5, 0], ['twHouseB', -22, -28.5, 0],
    ['twHouseA', 5.6, -27.5, -R90], ['twHouseC', 15, -29, 0], ['twHouseF', 24, -5.6, 0],
    ['twHouseF', -16, 5.6, Math.PI], ['twHouseA', -26, 5.6, Math.PI], ['twShell', -4.35, 17, R90],
    ['twHouseB', 5.6, 16, -R90], ['twHouseC', 16, 4.35, Math.PI], ['twHouseE', 26.5, 5.6, Math.PI], ['twHouseD', 5.6, 29, -R90],
  ]) {
    const H = HOUSE[k], { W, D } = house(st, ctx, k, x, z, rot), dx = -W / 2 + H.door * BAY + BAY / 2;
    if (H.roof === 'full') bare(k + x + z, x, z, (Math.abs(Math.sin(rot)) > 0.5 ? D : W) / 2, (Math.abs(Math.sin(rot)) > 0.5 ? W : D) / 2);
    // by the door: an awning where the roof still stands, and what was left on the step (a jar, a basket, sacks, a bench...)
    if (H.roof === 'full') { const [ax, az] = at(x, z, rot, dx, D / 2 + 0.36); P.push(...piece('twAwning', ax, 2.35, az, rot)); }
    for (const side of [-1, 1]) {
      if (rnd() < 0.3) continue; const kk = ['twJar', 'twVase', 'twBasket', 'twSack', 'twBench', 'twStrawBundle', 'twJars'][Math.floor(rnd() * 7)];
      const [px, pz] = at(x, z, rot, dx + side * (kk === 'twBench' ? 1.9 : 1.25), D / 2 + 0.55); put(kk, px, pz, rot + (kk === 'twBench' ? 0 : rr(0, 6)), kk === 'twBench' ? 0.5 : 0.35, rr(0.85, 1.05));
    }
  }
  // the smithy's yard: forge, anvil, kiln, logs and straw, a cart left with its shafts down
  put('twForge', -14, 22.5, 0.3, 1.3); put('twAnvil', -11.4, 20.3, 1.1, 0.5); put('twKiln', -19, 25, 0.8, 1.2); put('twLogs', -11.6, 25.4, 0.4, 0.6); put('twLogs', -12.6, 26.1, 1.6, 0);
  put('twStraw', -20.5, 16.8, 0.2, 0.8); put('twStraw', -22.2, 18.6, 1.1, 0.8); put('twStrawBundle', -18.6, 15.5, 0.5, 0.3); put('twCartB', -8.8, 26.5, 0.7, 1.2); put('twGrind', -16.2, 16.6, 0.4, 0.7);
  put('twSacks', -9.6, 21.8, 1.4, 0.8); put('twJar', -15.8, 19.4, 0, 0.35);
  // the walled garden: two vine pergolas, fruit trees, a fence with its gate gone
  for (const x of [16.8, 19.3]) { put('twPergola', x, 20.5, 0); for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) st.solid(ctx, x + px, 20.5 + pz, 0.18); }
  put('twTable', 18, 20.5, 0, 0.7, 0.9); put('twBench', 18, 22.2, 0, 0.5); put('twVases', 22.5, 24.2, 0.9, 0.9);
  for (let i = 0; i < 4; i++) { if (i !== 1) put('twFence', 13.5 + i * 2.6 + 1.3, 14.6, 0, 0); put('twFence', 13.5 + i * 2.6 + 1.3, 26.4, 0, 0); }
  for (let i = 0; i < 4; i++) { put('twFence', 13.2, 15.9 + i * 2.6 + 0.1, R90, 0); put('twFence', 24.2, 15.9 + i * 2.6 + 0.1, R90, 0); }
  st.wall(ctx, 13.2, 14.6, 13.2, 26.4, 1.4, 0.15); st.wall(ctx, 24.2, 14.6, 24.2, 26.4, 1.4, 0.15); st.wall(ctx, 13.2, 26.4, 24.2, 26.4, 1.4, 0.15); st.wall(ctx, 13.2, 14.6, 15.5, 14.6, 1.4, 0.15); st.wall(ctx, 18.9, 14.6, 24.2, 14.6, 1.4, 0.15);
  for (const [n, v, x, z, sc] of [['pomegranate', 0, 15.2, 24.4, 0.8], ['fig', 1, 22.4, 17.2, 0.85], ['olive', 2, 21.6, 24.8, 0.9]]) { st.plant(ctx, n, v, x, 0, z, sc); st.solid(ctx, x, z, 0.35); }
  // what's left about the streets: a cart, pottery by the doors, rubble where walls came down, a broken statue
  put('twCart', 1.5, -19.5, 0.12, 1.4); put('twSack', 2.8, -21.4, 0.7, 0.3); put('twBaskets', 2.3, 21.5, 1.2, 0.8);
  for (const [x, z] of [[-19.6, 9.6], [-23.2, 9.2], [9.6, 13.6], [-8.6, -21.6], [19.8, -2.2], [9.6, 31.8]]) put(rnd() < 0.5 ? 'twJar' : 'twVase', x, z, rr(0, 6), 0.35, rr(0.8, 1.1));
  for (const [k, x, z] of [['twRubbleA', -21.5, -12.8], ['twRubbleB', 27, 10.4], ['twRubbleC', -1.2, 13.2], ['twRubbleA', -8.6, 33.5], ['twDrum', 10.8, -10.8], ['twMarblePile', 26.5, -15.5], ['twStack', 31, -24]])
    put(k, x, z, rr(0, 6), k === 'twStack' ? 0 : 1.0);
  st.wall(ctx, 29, -24.4, 33, -24.4, 2, 0.5);
  // old chests left behind, worth searching (trial.js opens them; each remembered by its id): plain things for the road
  // under the stoa, arrows at the smithy, odds and ends in two of the houses that still have their roofs, and in one of
  // those a leather cap someone forgot
  const chest = (id, x, z, rot, items) => st.chest(ctx, x, z, rot, { id, items, sub: 'Abandoned town' }, Math.max(0, st.groundY(ctx, x, z)));
  chest('townStoa', -11.4, -17.1, 0, [['rope', 5], ['resin', 3], ['stone', 6], ['olive', 6], ['torch', 1]]);
  chest('townSmithy', -17.2, 21.0, 0.3, [['crudeArrow', 20], ['feather', 3], ['wood', 6]]);
  chest('townHouseW', ...at(-26, 5.6, Math.PI, -2.6, -1.75), Math.PI, [['leather', 3], ['fiber', 6], ['rope', 2], ['wood', 4]]);
  chest('townHouseE', ...at(24, -5.6, 0, -1.3, -1.75), 0, [['throwerHelmet', 1], ['leather', 2], ['resin', 1]]);
  put('twStatueBroken', 11.2, -8.6, 2.6, 0.5); put('twColumn', -31, -5, 0, 0.4); put('twColumnBase', -31, 5, 0, 0.45); put('twDrum', -29.5, 9, 1.2, 0);
  // and the green that has come back: cypresses at the street ends, olives and figs in the yards, bushes in the ruins
  for (const [n, v, x, z, sc, r] of [['cypress', 0, -4.2, -36, 1, 0.4], ['cypress', 1, 4.2, -36, 0.95, 0.4], ['cypress', 0, -4.2, 36, 1.05, 0.4], ['cypress', 1, 4.2, 36, 1, 0.4], ['cypress', 0, -36, -4.2, 0.95, 0.4], ['cypress', 1, 36, 4.2, 1, 0.4],
    ['olive', 1, -15.5, -31, 0.95, 0.5], ['olive', 0, 22.5, -24.5, 1, 0.5], ['fig', 0, -29, -12, 0.9, 0.4], ['olive', 2, 31, -9, 0.9, 0.5], ['pomegranate', 1, -27, 13, 0.85, 0.35],
    ['broom', 0, -21.4, -18.2, 1, 0], ['myrtle', 1, -23.4, -15, 1.1, 0], ['broom', 1, 26.4, 6.2, 1, 0], ['myrtle', 0, -3.9, 18.4, 1, 0], ['broom', 0, 13, -14, 1.1, 0], ['redbush', 0, 17.6, -19.5, 1, 0], ['fern', 0, -6, -26, 1, 0]]) {
    st.plant(ctx, n, v, x, 0, z, sc); if (r) st.solid(ctx, x, z, r);
  }
  st.finish(ctx);
}

// ---- the small scenes about the island: one of eight kinds each (s.v), turned by where it stands
export function buildSpot(st, s) {
  const ctx = st.site(s, ((s.x * 0.37 + s.z * 0.11) % 6.28 + 6.28) % 6.28), P = ctx.P;
  const put = (k, x, z, rot = 0, r = 0, sc = 1, y = 0) => { P.push(...piece(k, x, y, z, rot, sc)); if (r) st.solid(ctx, x, z, r); };
  const plant = (n, v, x, z, sc, r = 0) => { st.plant(ctx, n, v, x, st.groundY(ctx, x, z), z, sc); if (r) st.solid(ctx, x, z, r); };
  switch (s.v) {
    case 0:   // a roadside shrine: a goddess with her water jar on a pedestal, censers, offerings, two cypresses and a bench
      put('twPlinth', 0, -1, 0, 0.45); put('twStatue', 0, -1, 0, 0, 1, 1.0); put('twCenser', -0.9, -0.3, 0, 0.25); put('twCenser', 0.9, -0.3, 0.5, 0.25);
      put('twBowl', 0, 0.2, 0, 0, 0.5); put('twVase', -1.4, -1.2, 0.3, 0.35); put('twJar', 1.3, -1.4, 1.2, 0.35); put('twBench', 0, 2.6, Math.PI, 0.6);
      plant('cypress', 0, -2.6, -2, 0.9, 0.4); plant('cypress', 1, 2.6, -2, 0.95, 0.4); break;
    case 1:   // a cart lost on the way to market: its load spilt, a sack split open, straw, a broken jar
      put('twCart', 0, 0, 0.3, 1.5); put('twSacks', 1.8, 1.4, 0.8, 0.8); put('twSack', -1.6, 1.8, 1.9, 0.3); put('twBaskets', -1.9, -1.2, 0.5, 0.8);
      put('twStrawBundle', 2.2, -1.5, 1.4, 0.3); put('twJar', 0.6, 2.6, 2.2, 0.35); plant('broom', 0, -3, 2.5, 1); break;
    case 2:   // a fallen colonnade: a column still up, its fellows' drums in the grass, a heap of marble, a broken statue
      put('twColumnBase', -2, -1.5, 0, 0.45); put('twColumn', 0, -1.5, 0, 0.4); put('twColumnBase', 2, -1.5, 0, 0.45); put('twDrum', 1.2, 1.2, 1.3, 0); put('twDrum', -1.8, 1.6, 0.4, 0);
      put('twMarblePile', 3.4, 2, 0.6, 1.2); put('twRubbleA', -3.4, 0.4, 2.1, 0); put('twStatueBroken', -0.6, 3, 2.8, 0.5); plant('myrtle', 1, 4, -1.5, 1.1); break;
    case 3:   // a shepherd's camp: a fire ring with logs, straw stacks, a fence for the flock, baskets and a sack
      put('twFirepit', 0, 0, 0, 0, 0.5); put('twLogs', 1.3, 0.9, 0.7, 0.4); put('twStraw', -2.6, -1.4, 0.4, 0.8); put('twStraw', -2.4, 1.2, 1.7, 0.8);
      for (let i = 0; i < 3; i++) put('twFence', 1.5 + i * 2.6, -3, 0, 0); st.wall(ctx, 0.2, -3, 8, -3, 1.4, 0.15);
      put('twBasket', 1.8, -1.4, 0.4, 0.3); put('twSack', -0.8, 1.9, 1.1, 0.3); break;
    case 4:   // a farmer's hut: the shed, a fence, straw, the grinding stone and his handcart
      house(st, ctx, 'twShed', 0, -1, 0); put('twStraw', 2.8, -1.6, 0.3, 0.8); put('twGrind', -2.6, 0.4, 0.4, 0.7); put('twCartB', 2.6, 2.4, 2.2, 1.2);
      for (let i = 0; i < 2; i++) put('twFence', -3.9, 2.9 - i * 2.6, R90, 0); put('twJars', -1.2, 3, 0.4, 0.7); plant('olive', 1, 4.4, -3.6, 0.9, 0.5); break;
    case 5:   // an old well under an olive, its jars and a bench
      put('twWell', 0, 0, 0.6, 1.6); put('twJar', 2.2, 0.8, 0, 0.35); put('twVase', 2.5, -0.1, 1, 0.35); put('twBench', -2.4, 1.6, 0.9, 0.6); plant('olive', 0, -3, -2.6, 1, 0.5); break;
    case 6:   // the last of a lookout: a stack of ashlar, rubble, a brazier gone cold, a broken statue looking out
      put('twStack', 0, -1.8, 0); st.wall(ctx, -2, -1.8, 2, -1.8, 2.1, 0.55); put('twRubbleB', 1.4, 1, 1.2, 0); put('twRubbleC', -2, 1.4, 2.6, 0);
      put('twBrazier', 2.6, 2.2, 0, 0.7, 0.55); put('twStatueBroken', -1.2, 2.6, 0.3, 0.5); plant('broom', 0, 3.6, -0.4, 1); break;
    default:  // a vineyard's rest: a vine pergola over a table, baskets of grapes, pottery, a fence
      put('twPergola', 0, 0, 0); for (const [px, pz] of [[-1.1, -1.1], [1.1, -1.1], [-1.1, 1.1], [1.1, 1.1]]) st.solid(ctx, px, pz, 0.18); st.top(ctx, -1.25, 1.25, -1.25, 1.25, STOREY, true);
      put('twTable', 0, 0, R90, 0.7, 0.8); put('twBench', 0, 1.6, 0, 0); put('twBaskets', 2.6, -0.6, 0.7, 0.8); put('twVases', -2.8, 0.4, 1.1, 0.9);
      for (let i = 0; i < 2; i++) put('twFence', -1.3 + i * 2.6, -3.2, 0, 0); st.wall(ctx, -2.6, -3.2, 2.6, -3.2, 1.4, 0.15); plant('pomegranate', 0, 3.2, 2.4, 0.8, 0.35);
  }
  st.finish(ctx, { r: 5 });   // (the grass worn down round it, or the small things vanish in it)
}
