// Argonisos icon set: hand-drawn SVG in the manner of Attic black-figure pottery. Figures are black glaze with
// incised cream lines and touches of added red and gold, meant to sit on clay or papyrus. Every icon is a 64×64 viewBox.
//   icon(name, cls)  → inline <svg> markup for the DOM
//   iconImg(name)    → an <img> of the same drawing, for canvas (minimap, map)
const K = '#211610', R = '#a8401f', C = '#f1dcae', G = '#c9973a', O = '#d97d3e', L = '#6b7a32';   // glaze, red, cream, gold, clay, olive
const inc = (d, w = 1.6) => `<path d="${d}" fill="none" stroke="${C}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;   // incised line
const fill = (d, c = K) => `<path d="${d}" fill="${c}"/>`;
const ln = (d, c = K, w = 3) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circ = (x, y, r, c = K) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;

// A black-figure quadruped for the map: body, neck, head, legs and a few telling features
function beast({ len = 30, h = 14, leg = 12, neck = 10, neckA = -0.9, head = 9, tail = 'thin', horns = '', ears = 'small', bulk = 1 }) {
  const x0 = 32 - len / 2, x1 = 32 + len / 2, top = 30 - h / 2, bot = top + h;
  let s = `<ellipse cx="32" cy="${30}" rx="${len / 2}" ry="${(h / 2) * bulk}" fill="${K}"/>`;
  for (const [x, k] of [[x0 + 4, 1], [x0 + 9, -1], [x1 - 6, 1], [x1 - 2, -1]]) s += ln(`M${x} ${bot - 2} L${x + k * 1.2} ${bot + leg - 4} L${x + k * 0.6} ${bot + leg}`, K, 3.2);
  const nx = x1 - 2 + Math.cos(neckA) * neck, ny = top + 3 + Math.sin(neckA) * neck;
  s += ln(`M${x1 - 4} ${top + 4} L${nx} ${ny}`, K, 6.5);
  s += `<ellipse cx="${nx + head / 2 - 1}" cy="${ny + 1}" rx="${head / 2 + 1}" ry="${head / 3.2}" fill="${K}" transform="rotate(18 ${nx + head / 2} ${ny})"/>`;
  if (ears === 'small') s += fill(`M${nx - 1} ${ny - 2} l2 -5 l2 5z`);
  if (ears === 'long') s += ln(`M${nx} ${ny - 1} l-1 -10 M${nx + 3} ${ny - 1} l1 -10`, K, 2.6);
  if (ears === 'point') s += fill(`M${nx - 2} ${ny - 1} l2 -7 l3 6z`);
  if (horns === 'antlers') s += ln(`M${nx + 1} ${ny - 2} l-3 -9 m1.4 4 l-5 -2 m3.6 -2 l2 -6 M${nx + 4} ${ny - 2} l3 -9 m-1.2 4 l5 -2`, K, 2.2);
  if (horns === 'bull') s += ln(`M${nx - 1} ${ny - 2} q-6 -2 -5 -8 M${nx + 4} ${ny - 2} q6 -2 5 -8`, K, 2.6);
  if (horns === 'mane') s += ln(`M${x1 - 4} ${top + 2} Q${nx - 3} ${ny - 6} ${nx + 1} ${ny - 3}`, K, 4);
  if (tail === 'thin') s += ln(`M${x0 + 1} ${top + 4} q-5 4 -4 12`, K, 2);
  if (tail === 'bushy') s += `<ellipse cx="${x0 - 4}" cy="${top + 9}" rx="7" ry="3.6" fill="${K}" transform="rotate(30 ${x0 - 4} ${top + 9})"/>` + circ(x0 - 9, top + 12, 1.6, C);
  if (tail === 'curl') s += ln(`M${x0 + 1} ${top + 3} q-6 -6 -2 -9 q4 -1 3 4`, K, 2.6);
  if (tail === 'down') s += ln(`M${x0 + 1} ${top + 4} q-6 6 -5 13`, K, 3.6);
  s += inc(`M${x0 + 5} ${30} Q32 ${33 + h / 4} ${x1 - 5} ${30}`, 1.2);                                    // incised belly line
  return s;
}

const ICONS = {
  // ---- materials ----
  wood: fill('M8 40 L50 26 a6 6 0 0 1 4 11 L12 51 a6 6 0 0 1 -4 -11z') + `<ellipse cx="10" cy="45.5" rx="5" ry="6" fill="${O}" transform="rotate(-18 10 45.5)"/>` + inc('M8 44 a2.6 3 -18 1 1 4 3') +
        fill('M14 25 L54 18 a5 5 0 0 1 2 10 L16 35 a5 5 0 0 1 -2 -10z') + `<ellipse cx="15" cy="30" rx="4.2" ry="5" fill="${O}" transform="rotate(-10 15 30)"/>` + inc('M14 29 a2 2.4 -10 1 1 3 2') + inc('M24 31 L44 27 M22 44 L40 38', 1.2),
  stone: fill('M10 46 L16 26 L30 16 L46 20 L56 36 L48 50 L24 54z') + inc('M16 26 L28 32 L46 20 M28 32 L24 54 M28 32 L48 50') + fill('M30 18 L44 21 L36 25z', C),
  fiber: ln('M32 56 L32 18 M32 54 L22 20 M32 54 L42 20 M32 54 L16 26 M32 54 L48 26', K, 2.4) +
         [[32, 14], [22, 16], [42, 16], [16, 22], [48, 22]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="3.2" ry="6" fill="${K}"/>` + inc(`M${x} ${y - 4} L${x} ${y + 4}`, 1)).join('') + `<rect x="25" y="38" width="14" height="5" rx="1.5" fill="${R}"/>`,
  berries: fill('M34 12 q14 -2 18 10 q-12 4 -18 -10z', L) + ln('M34 12 q-2 8 -6 14', K, 2) +
           [[24, 34], [36, 32], [30, 44], [42, 42], [20, 46], [33, 54]].map(([x, y]) => circ(x, y, 7) + circ(x - 2.4, y - 2.4, 1.7, C)).join(''),
  rawmeat: fill('M12 30 q6 -16 26 -14 q18 2 16 18 q-2 16 -22 18 q-20 2 -20 -22z', R) + inc('M18 32 q10 -10 26 -6 M18 40 q12 -6 28 0', 1.6) + fill('M40 38 a6 6 0 1 1 0.1 0z', C) + circ(40, 44, 2.4, R),
  meat: fill('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z') + inc('M16 30 q8 -10 20 -8 M15 38 q10 -4 18 -2') +
        fill('M38 40 l12 10 a4 4 0 1 1 4 5 a4 4 0 1 1 -5 4 l-11 -11z', C),
  hide: fill('M14 14 q18 6 36 0 q-4 10 4 18 q-8 8 -4 18 q-18 -6 -36 0 q4 -10 -4 -18 q8 -8 4 -18z') + `<path d="M19 20 q13 4 26 0 q-3 8 3 12 q-6 6 -3 12 q-13 -4 -26 0 q3 -6 -3 -12 q6 -6 3 -12z" fill="none" stroke="${C}" stroke-width="1.4" stroke-dasharray="3 3"/>`,
  rope: `<circle cx="32" cy="34" r="20" fill="${K}"/>` + inc('M32 18 a16 16 0 1 1 -0.1 0 M32 23 a11 11 0 1 1 -0.1 0 M32 28 a6 6 0 1 1 -0.1 0', 1.5) + ln('M48 26 q10 -8 8 -18', K, 4) + inc('M50 22 l3 -2 M52 17 l3 -1', 1.2),
  sail: ln('M32 6 L32 58', K, 3) + ln('M12 14 L52 14', K, 3) + fill('M14 16 L50 16 Q54 34 50 48 L14 48 Q10 34 14 16z') +
        `<rect x="14" y="27" width="36" height="7" fill="${R}"/>` + inc('M15 28 h5 v4 h4 v-4 h5 v4 h4 v-4 h5 v4 h4 v-4 h4', 1.2) + fill('M22 52 h20 l-4 6 h-12z', R),
  arrows: [[10, 54, 50, 14], [12, 14, 52, 54]].map(([x0, y0, x1, y1]) => { const a = Math.atan2(y1 - y0, x1 - x0), c = Math.cos(a), si = Math.sin(a), px = -si, py = c, f = (k, s2) => `${(x1 + c * k + px * s2).toFixed(1)} ${(y1 + si * k + py * s2).toFixed(1)}`, t = (k, s2) => `${(x0 + c * k + px * s2).toFixed(1)} ${(y0 + si * k + py * s2).toFixed(1)}`;
    return ln(`M${x0} ${y0} L${x1} ${y1}`, K, 2.6) + fill(`M${f(4, 0)} L${f(-7, 4)} L${f(-7, -4)}z`) + fill(`M${t(0, 0)} L${t(10, 5)} L${t(4, 0)} L${t(10, -5)}z`, R); }).join(''),
  bone: fill('M14 18 a6 6 0 1 1 8 -6 l22 22 a6 6 0 1 1 6 8 a6 6 0 1 1 -8 6 l-22 -22 a6 6 0 1 1 -6 -8z', C) + ln('M14 18 a6 6 0 1 1 8 -6 l22 22 a6 6 0 1 1 6 8 a6 6 0 1 1 -8 6 l-22 -22 a6 6 0 1 1 -6 -8z', K, 2.6) + ln('M24 22 l18 18', K, 1.4),
  horn: fill('M12 54 q-2 -26 18 -40 q14 -8 26 -2 q-14 0 -22 10 q-10 14 -12 32z') + inc('M18 48 q2 -16 12 -26 M24 50 q2 -14 10 -24', 1.3) + `<ellipse cx="15" cy="54" rx="5" ry="3" fill="${C}" stroke="${K}" stroke-width="1.6"/>`,
  bronze: fill('M8 22 q8 4 24 2 q16 2 24 -2 q-4 10 0 20 q-8 -4 -24 -2 q-16 -2 -24 2 q4 -10 0 -20z', G) + ln('M8 22 q8 4 24 2 q16 2 24 -2 q-4 10 0 20 q-8 -4 -24 -2 q-16 -2 -24 2 q4 -10 0 -20z', K, 2.6) + inc('M18 30 h28 M18 35 h28', 1.2),   // an oxhide ingot
  // ---- tools ----
  axe: ln('M18 58 L44 10', K, 5) + inc('M21 52 L42 14', 1) + fill('M34 12 q14 -6 22 4 q-4 14 -18 14 q-2 -8 -6 -10z') + inc('M40 16 q8 -2 12 2 M38 24 q8 0 13 -4', 1.3) +
       `<rect x="33" y="17" width="9" height="8" rx="1.5" fill="${R}" transform="rotate(30 37 21)"/>`,
  bow: ln('M22 6 Q50 32 22 58', K, 6) + ln('M22 6 Q17 1 12 5 M22 58 Q17 63 12 59', K, 3.4) + ln('M14 6 L14 58', K, 1.4) + inc('M27 14 Q38 32 27 50', 1.2) + `<rect x="31" y="27" width="7" height="10" rx="2" fill="${R}"/>`,
  hands: fill('M18 30 q0 -8 6 -8 h18 q8 0 8 8 v12 q0 12 -14 12 h-6 q-12 0 -12 -12z') + inc('M26 22 v10 M33 22 v10 M40 22 v10 M20 36 q6 2 14 -2', 1.6) +
         fill('M14 34 q-4 -8 4 -10 q6 0 6 8z') + `<rect x="18" y="50" width="28" height="7" rx="1" fill="${R}"/>` + inc('M18 53.5 h28', 1),
  fire: fill('M32 6 q16 16 12 30 q8 -4 6 -12 q10 14 2 28 q-8 10 -20 10 q-14 0 -20 -12 q-6 -12 4 -24 q0 8 6 10 q-4 -16 10 -30z') +
        fill('M32 26 q10 10 6 20 q-2 8 -6 8 q-8 0 -8 -8 q0 -8 8 -20z', R) + fill('M32 38 q4 6 2 10 q-2 2 -4 0 q-2 -4 2 -10z', G) + ln('M14 58 L50 52 M14 52 L50 58', K, 3.5),
  scroll: `<rect x="16" y="14" width="32" height="38" fill="${C}" stroke="${K}" stroke-width="2"/>` + fill('M12 10 h40 a4 4 0 0 1 0 8 h-40 a4 4 0 0 1 0 -8z M12 48 h40 a4 4 0 0 1 0 8 h-40 a4 4 0 0 1 0 -8z') + ln('M22 26 h20 M22 32 h20 M22 38 h14', K, 1.6),
  // ---- HUD ----
  health: fill('M32 56 Q8 40 8 24 Q8 12 20 12 Q28 12 32 20 Q36 12 44 12 Q56 12 56 24 Q56 40 32 56z', R) + inc('M32 50 Q14 38 14 25 Q14 18 20 18', 1.4) + fill('M44 18 q6 0 6 6 q-2 -3 -6 -6z', C),
  stamina: fill('M38 4 L18 34 h12 L24 60 L48 26 h-12 L44 4z') + inc('M37 9 L24 31 M34 30 l-5 20', 1.3),
  food: fill('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z') + fill('M38 40 l12 10 a4 4 0 1 1 4 5 a4 4 0 1 1 -5 4 l-11 -11z', C),
  energy: fill('M40 8 a24 24 0 1 0 16 38 a20 20 0 1 1 -16 -38z') + fill('M46 16 l2 5 l5 2 l-5 2 l-2 5 l-2 -5 l-5 -2 l5 -2z', G),
  sun: circ(32, 32, 12) + Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2, x = 32 + Math.cos(a) * 17, y = 32 + Math.sin(a) * 17; return ln(`M${x.toFixed(1)} ${y.toFixed(1)} L${(32 + Math.cos(a) * 26).toFixed(1)} ${(32 + Math.sin(a) * 26).toFixed(1)}`, K, i % 2 ? 2 : 3.4); }).join('') + circ(32, 32, 6, G),
  moon: fill('M40 8 a24 24 0 1 0 16 38 a20 20 0 1 1 -16 -38z') + circ(20, 36, 2.4, C) + circ(28, 46, 1.6, C),
  weight: ln('M32 10 V54 M18 54 h28 M10 20 h44', K, 3) + circ(32, 10, 3.5) + ln('M10 20 L4 38 M10 20 L16 38 M54 20 L48 38 M54 20 L60 38', K, 1.4) + fill('M2 38 h16 q-2 7 -8 7 q-6 0 -8 -7z M46 38 h16 q-2 7 -8 7 q-6 0 -8 -7z'),
  close: ln('M16 16 L48 48 M48 16 L16 48', 'currentColor', 6),
  check: ln('M12 34 L26 48 L52 16', 'currentColor', 7),
  ring: `<circle cx="32" cy="32" r="18" fill="none" stroke="currentColor" stroke-width="5"/>`,
  goal: fill('M32 4 L54 32 L32 60 L10 32z', 'currentColor') + fill('M32 22 L40 32 L32 42 L24 32z', C),
  you: fill('M32 6 L52 56 L32 46 L12 56z', 'currentColor'),
  dot: circ(32, 32, 16, 'currentColor'),
  chevron: ln('M18 14 L36 32 L18 50 M34 14 L52 32 L34 50', 'currentColor', 6),
  // ---- crafting tabs ----
  hammer: ln('M20 56 L42 22', K, 6) + fill('M30 10 l26 14 l-6 10 l-26 -14z') + inc('M36 15 l-4 7 M44 19 l-4 7', 1.2),
  temple: fill('M6 24 L32 8 L58 24z') + `<rect x="8" y="26" width="48" height="5" fill="${K}"/>` + [12, 22, 32, 42, 52].map((x) => `<rect x="${x - 2.5}" y="31" width="5" height="20" fill="${K}"/>`).join('') + `<rect x="6" y="51" width="52" height="6" fill="${K}"/>` + circ(32, 18, 3, C),
  anvil: fill('M8 22 h40 q10 0 12 8 h-14 q-2 8 -10 10 v8 h10 v8 h-36 v-8 h10 v-8 q-12 -4 -12 -18z') + inc('M12 26 h34', 1.3) + fill('M20 8 l4 6 l-3 1 z', R),
  star: Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * Math.PI * 2 - Math.PI / 2, b = a + Math.PI / 16, c = a - Math.PI / 16;
    return `<path d="M${(32 + Math.cos(c) * 9).toFixed(1)} ${(32 + Math.sin(c) * 9).toFixed(1)} L${(32 + Math.cos(a) * 28).toFixed(1)} ${(32 + Math.sin(a) * 28).toFixed(1)} L${(32 + Math.cos(b) * 9).toFixed(1)} ${(32 + Math.sin(b) * 9).toFixed(1)}z" fill="${K}"/>`; }).join('') + circ(32, 32, 9) + circ(32, 32, 4, G),
  // ---- actions & skills ----
  jump: ln('M14 50 Q32 4 50 50', K, 3) + fill('M44 46 l8 8 l2 -12z') + fill('M10 54 h12 v4 h-12z M42 54 h12 v4 h-12z', R),
  sprint: fill('M10 46 q2 -6 10 -6 h14 q4 -12 12 -12 q6 0 6 8 v10 q0 6 -6 6 h-30 q-6 0 -6 -6z') + ln('M8 52 h42', R, 3) + fill('M44 24 q4 -14 16 -16 q-2 6 -8 8 q6 0 6 4 q-6 2 -10 2 q4 2 2 4z', C) + ln('M44 24 q4 -14 16 -16 q-2 6 -8 8 q6 0 6 4 q-6 2 -10 2 q4 2 2 4z', K, 1.6) + inc('M20 40 l6 -8 M28 40 l4 -8', 1.4),
  eat: fill('M20 8 h24 q2 14 -6 20 v24 h6 v4 h-24 v-4 h6 v-24 q-8 -6 -6 -20z') + fill('M24 14 h16 q0 8 -8 10 q-8 -2 -8 -10z', R),
  talk: fill('M8 14 h48 q4 0 4 4 v22 q0 4 -4 4 h-26 l-12 10 v-10 h-10 q-4 0 -4 -4 v-22 q0 -4 4 -4z') + ln('M16 24 h32 M16 32 h22', C, 2),
  // ---- map markers (minimap) ----
  bush: circ(24, 34, 14) + circ(40, 32, 13) + circ(32, 24, 12) + [[24, 34], [38, 36], [32, 24], [42, 26]].map(([x, y]) => circ(x, y, 3.2, R)).join(''),
  branch: ln('M8 52 L54 14', K, 5) + ln('M24 40 L18 26 M36 30 L44 36', K, 3) + fill('M18 26 q-6 -6 -2 -12 q6 4 2 12z M44 36 q8 -2 10 4 q-6 2 -10 -4z', L),
  pebble: fill('M8 40 q4 -14 20 -12 q14 2 12 14 q-2 10 -16 10 q-14 0 -16 -12z') + fill('M38 30 q4 -10 14 -8 q8 2 6 10 q-2 8 -12 6 q-8 -2 -8 -8z') + inc('M14 38 q6 -6 14 -4', 1.2),
  reeds: ln('M20 60 Q22 30 16 8 M32 60 Q32 30 34 6 M44 60 Q42 32 50 12', K, 2.8) + `<ellipse cx="34" cy="16" rx="3.4" ry="8" fill="${R}"/><ellipse cx="17" cy="18" rx="3" ry="7" fill="${R}"/>`,
  olivebranch: ln('M8 56 Q30 40 56 8', K, 3) + [[16, 50, -40], [24, 42, 30], [30, 38, -50], [38, 30, 20], [44, 24, -40], [50, 16, 30]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="7" ry="2.6" fill="${L}" transform="rotate(${a} ${x} ${y})"/>`).join('') + circ(34, 44, 3.4) + circ(46, 34, 3),
  chest: fill('M8 28 q0 -14 24 -14 q24 0 24 14z') + `<rect x="8" y="28" width="48" height="24" fill="${K}"/>` + `<rect x="8" y="27" width="48" height="4" fill="${G}"/>` + `<rect x="28" y="30" width="8" height="10" rx="1" fill="${G}"/>` + inc('M14 36 h10 M40 36 h10 M14 46 h36', 1.2),
  // animals: black-figure silhouettes
  deer: beast({ len: 26, h: 11, leg: 15, neck: 11, neckA: -1.1, head: 8, tail: 'thin', ears: 'point' }),
  stag: beast({ len: 28, h: 12, leg: 15, neck: 11, neckA: -1.1, head: 8, tail: 'thin', horns: 'antlers', ears: 'none' }),
  fox: beast({ len: 26, h: 9, leg: 8, neck: 7, neckA: -0.5, head: 9, tail: 'bushy', ears: 'point' }),
  bull: beast({ len: 34, h: 18, leg: 10, neck: 6, neckA: -0.2, head: 9, tail: 'thin', horns: 'bull', ears: 'none', bulk: 1.05 }),
  cow: beast({ len: 32, h: 16, leg: 10, neck: 6, neckA: -0.3, head: 9, tail: 'thin', ears: 'small' }) + circ(26, 28, 3, C) + circ(36, 32, 2.4, C),
  horse: beast({ len: 30, h: 13, leg: 15, neck: 13, neckA: -1.0, head: 11, tail: 'down', horns: 'mane', ears: 'small' }),
  donkey: beast({ len: 26, h: 13, leg: 12, neck: 9, neckA: -0.8, head: 10, tail: 'thin', ears: 'long' }),
  alpaca: beast({ len: 22, h: 14, leg: 13, neck: 17, neckA: -1.4, head: 7, tail: 'curl', ears: 'long' }),
  dog: beast({ len: 24, h: 10, leg: 10, neck: 7, neckA: -0.8, head: 8, tail: 'curl', ears: 'point' }),
  wolf: beast({ len: 28, h: 11, leg: 12, neck: 8, neckA: -0.6, head: 10, tail: 'down', ears: 'point' }),
};

export function icon(name, cls = '') {
  const body = ICONS[name]; if (body === undefined) return '';
  return `<svg class="ic ${cls}" viewBox="0 0 64 64" aria-hidden="true">${body}</svg>`;
}
const imgCache = {};
export function iconImg(name) {
  if (imgCache[name]) return imgCache[name];
  const im = new Image(); im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">${ICONS[name] || ''}</svg>`);
  return (imgCache[name] = im);
}
export const ICON_NAMES = Object.keys(ICONS);
