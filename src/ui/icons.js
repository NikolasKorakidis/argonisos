// The black-figure icon set (../../icons.js) plus the things the open world adds: new materials, food, tools, weapons,
// armour and the condition badges.
import { ICONS, K, R, C, G, O, L, icon, iconImg } from '../../icons.js';

const inc = (d, w = 1.6) => `<path d="${d}" fill="none" stroke="${C}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const fill = (d, c = K) => `<path d="${d}" fill="${c}"/>`;
const ln = (d, c = K, w = 3) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const circ = (x, y, r, c = K) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/>`;
const ell = (x, y, rx, ry, c = K, a = 0) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${a} ${x} ${y})"/>`;

Object.assign(ICONS, {
  log: fill('M6 26 h46 a8 10 0 0 1 0 20 h-46z') + ell(52, 36, 8, 10, O) + inc('M52 30 a3 5 0 1 1 -0.1 0 M52 27 a6 9 0 0 1 3 9', 1.3) + inc('M12 32 h30 M16 40 h22', 1.2),
  leather: fill('M10 18 q12 -8 22 0 q10 -8 22 0 q-4 16 2 30 q-14 6 -24 -2 q-12 8 -24 2 q6 -14 2 -30z', O) + ln('M10 18 q12 -8 22 0 q10 -8 22 0 q-4 16 2 30 q-14 6 -24 -2 q-12 8 -24 2 q6 -14 2 -30z', K, 2.4),
  lightstone: fill('M14 44 L22 18 L38 10 L52 24 L48 46 L30 54z', C) + ln('M14 44 L22 18 L38 10 L52 24 L48 46 L30 54z', K, 2.6) + ln('M22 18 L32 30 L38 10 M32 30 L30 54 M32 30 L52 24', K, 1.4),
  coal: fill('M10 44 q2 -16 16 -18 q6 -12 18 -6 q12 4 10 18 q-2 12 -18 12 q-22 4 -26 -6z') + inc('M20 38 l6 -4 M34 30 l6 2 M30 46 l8 -2', 1.2),
  resin: fill('M32 8 q14 20 14 32 a14 14 0 1 1 -28 0 q0 -12 14 -32z', G) + ln('M32 8 q14 20 14 32 a14 14 0 1 1 -28 0 q0 -12 14 -32z', K, 2.4) + fill('M26 36 q-2 8 4 12 q-8 -2 -4 -12z', C),
  feather: fill('M50 8 q-30 6 -36 40 l4 2 q20 -14 32 -42z') + ln('M12 56 L44 16', C, 1.4) + inc('M24 38 l-6 -2 M30 30 l-6 -3 M36 22 l-5 -3 M28 40 l2 6 M34 32 l3 5', 1),
  flower: ln('M32 60 Q30 44 32 30', L, 3) + [0, 1, 2, 3, 4, 5].map((i) => { const a = i / 6 * Math.PI * 2; return ell(32 + Math.cos(a) * 9, 20 + Math.sin(a) * 9, 7, 4, G, a * 57.3); }).join('') + circ(32, 20, 5) + fill('M32 46 q-12 -2 -14 -10 q10 0 14 10z', L),
  seed: ell(24, 34, 9, 13, K, -20) + ell(42, 30, 7, 10, O, 25) + ln('M42 30 m-7 0 a7 10 25 1 0 14 0 a7 10 25 1 0 -14 0', K, 2) + inc('M22 26 q4 8 2 16', 1.2),
  cone: ell(32, 34, 13, 20) + [-12, -4, 4, 12].map((y) => inc(`M21 ${34 + y} q11 5 22 0`, 1.3)).join('') + ln('M32 14 L32 6', K, 3),
  trophy: fill('M18 10 h28 v6 q10 0 10 10 q0 10 -12 10 q-4 8 -10 10 v6 h8 v6 h-24 v-6 h8 v-6 q-6 -2 -10 -10 q-12 0 -12 -10 q0 -10 10 -10z', G) + ln('M18 10 h28 v14 q0 14 -14 18 q-14 -4 -14 -18z', K, 2.4) + inc('M24 18 v8 q2 6 8 8', 1.4),
  heart: fill('M32 56 Q8 40 8 24 Q8 12 20 12 Q28 12 32 20 Q36 12 44 12 Q56 12 56 24 Q56 40 32 56z', L) + ln('M32 20 Q30 34 32 54 M32 34 l-10 -6 M32 42 l10 -8', K, 2) + fill('M44 18 q6 0 6 6 q-2 -3 -6 -6z', C),
  olive: ell(26, 36, 10, 14, L, -25) + ell(42, 30, 9, 13, K, 20) + ln('M28 22 Q34 10 46 8', K, 2.4) + ell(48, 12, 7, 3, L, -20) + fill('M24 30 q-2 6 2 10 q-6 -2 -2 -10z', C),
  acorn: fill('M18 26 q14 -12 28 0 q2 6 -4 6 h-20 q-6 0 -4 -6z') + ln('M32 18 l2 -8', K, 3) + fill('M20 32 h24 q0 22 -12 26 q-12 -4 -12 -26z', O) + ln('M20 32 h24 q0 22 -12 26 q-12 -4 -12 -26z', K, 2.2) + inc('M22 26 h20', 1.2),
  pomegranate: circ(32, 36, 20, R) + ln('M32 16 m-20 20 a20 20 0 1 0 40 0 a20 20 0 1 0 -40 0', K, 2.4) + fill('M24 18 l4 -10 l4 6 l4 -6 l4 10z') + fill('M24 30 q-2 10 6 16 q-10 -4 -6 -16z', C),
  cookedMeat: fill('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z', O) + ln('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z', K, 2.4) + fill('M38 40 l12 10 a4 4 0 1 1 4 5 a4 4 0 1 1 -5 4 l-11 -11z', C) + ln('M16 26 l12 10 M22 20 l10 8', K, 2),
  fish: fill('M8 32 q14 -16 34 -6 l12 -10 v32 l-12 -10 q-20 10 -34 -6z') + circ(18, 30, 2.4, C) + inc('M28 24 q4 8 0 16 M34 26 q3 6 0 12', 1.2),
  cookedFish: fill('M8 32 q14 -16 34 -6 l12 -10 v32 l-12 -10 q-20 10 -34 -6z', O) + ln('M8 32 q14 -16 34 -6 l12 -10 v32 l-12 -10 q-20 10 -34 -6z', K, 2.4) + ln('M22 24 l8 16 M32 24 l6 12', K, 2),
  spoiled: fill('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z', '#5d6b3a') + ln('M10 40 q-4 -20 16 -26 q16 -4 22 10 q4 10 -6 18 l-12 6 q-16 6 -20 -8z', K, 2.4) + circ(22, 30, 3, K) + circ(32, 38, 2, K) + ln('M44 10 q4 -4 0 -8 M52 14 q4 -4 0 -8', L, 2),
  hoe: ln('M14 58 L44 12', K, 5) + fill('M38 10 l18 4 l-2 8 l-14 -4z') + inc('M18 52 L42 16', 1),
  torch: ln('M28 60 L34 28', K, 5) + fill('M28 30 h12 l-2 6 h-8z', O) + fill('M34 4 q12 10 6 22 h-12 q-6 -12 6 -22z', R) + fill('M34 12 q6 6 2 14 h-6 q-2 -8 4 -14z', G),
  pickaxe: ln('M30 60 L34 14', K, 5) + fill('M8 22 q24 -16 48 0 l-2 4 q-22 -10 -44 0z') + inc('M12 20 q20 -10 40 0', 1.2) + `<rect x="29" y="12" width="9" height="9" fill="${R}"/>`,
  dagger: ln('M14 50 L22 42', K, 6) + fill('M20 40 L50 10 L54 14 L24 44z') + inc('M24 38 L48 14', 1.1) + ln('M14 36 L28 50', K, 4) + circ(12, 52, 3.4, R),
  club: fill('M12 56 L20 48 L46 10 q10 -4 10 6 L26 54 L18 60z') + inc('M24 46 L46 16', 1.2) + circ(46, 14, 2, C) + circ(40, 24, 2, C) + circ(50, 18, 1.6, C),
  spear: ln('M8 58 L48 18', K, 4) + fill('M44 14 L58 4 L54 22 L48 20z') + inc('M50 14 L55 8', 1.2) + `<rect x="38" y="24" width="7" height="5" fill="${R}" transform="rotate(-45 41 26)"/>`,
  shield: circ(32, 32, 24) + ln('M32 8 m-24 24 a24 24 0 1 0 48 0 a24 24 0 1 0 -48 0', G, 2.4) + circ(32, 32, 7, R) + inc('M32 14 v8 M32 42 v8 M14 32 h8 M42 32 h8', 1.4),
  towerShield: fill('M14 6 h36 v40 q-6 12 -18 14 q-12 -2 -18 -14z') + inc('M20 12 h24 v32 q-4 9 -12 11 q-8 -2 -12 -11z', 1.4) + circ(32, 28, 5, R),
  arrow: ln('M8 56 L50 14', K, 3) + fill('M46 10 L58 6 L54 18z') + fill('M8 56 l-2 -10 l8 6z M8 56 l10 2 l-6 -8z', R),
  helmet: fill('M10 40 q0 -28 22 -30 q22 2 22 30 v8 h-10 v-12 q-4 -4 -12 -4 q-8 0 -12 4 v12 h-10z') + fill('M26 10 q6 -8 14 -4 q-4 2 -6 8z', R) + inc('M16 34 q16 -8 32 0', 1.4),
  armor: fill('M14 10 l10 -2 q8 6 16 0 l10 2 l6 14 l-8 4 v26 h-32 v-26 l-8 -4z') + inc('M24 26 h16 M22 34 h20 M22 42 h20', 1.3) + fill('M26 8 q6 6 12 0 l-2 6 q-4 2 -8 0z', R),
  legs: fill('M16 8 h32 l-2 18 l-4 30 h-8 l-2 -26 l-2 26 h-8 l-4 -30z') + inc('M20 16 h24 M24 36 v12 M40 36 v12', 1.3),
  cape: fill('M18 8 h28 q6 22 10 48 q-12 -6 -24 -2 q-12 -4 -24 2 q4 -26 10 -48z', R) + ln('M18 8 h28 q6 22 10 48 q-12 -6 -24 -2 q-12 -4 -24 2 q4 -26 10 -48z', K, 2.4) + ln('M18 10 h28', G, 3),
  // condition badges
  rested: fill('M8 40 q0 -10 10 -10 h30 q8 0 8 8 v8 h-48z') + `<rect x="6" y="46" width="52" height="5" fill="${K}"/>` + inc('M40 10 h10 l-10 10 h10', 2),
  roof: fill('M4 30 L32 8 L60 30 h-8 v24 h-40 v-24z') + fill('M26 54 v-14 h12 v14z', C) + inc('M10 28 L32 12 L54 28', 1.3),
  wet: fill('M32 6 q18 24 18 34 a18 18 0 1 1 -36 0 q0 -10 18 -34z', '#3d6a8a') + ln('M32 6 q18 24 18 34 a18 18 0 1 1 -36 0 q0 -10 18 -34z', K, 2.4) + fill('M24 38 q-2 10 6 14 q-10 -2 -6 -14z', C),
  cold: ln('M32 6 V58 M9 19 L55 45 M9 45 L55 19', '#3d6a8a', 4) + ln('M26 10 L32 16 L38 10 M26 54 L32 48 L38 54', '#3d6a8a', 3) + circ(32, 32, 5, C),
  freezing: ln('M32 6 V58 M9 19 L55 45 M9 45 L55 19', K, 5) + ln('M32 6 V58 M9 19 L55 45 M9 45 L55 19', '#8fc2e0', 2.4) + circ(32, 32, 7, '#8fc2e0'),
  stunned: [0, 1, 2, 3, 4].map((i) => { const a = i / 5 * Math.PI * 2; return fill(`M${32 + Math.cos(a) * 20} ${30 + Math.sin(a) * 10} l3 -6 l3 6 l-3 6z`, G); }).join('') + circ(32, 44, 12),
  zeus: fill('M38 4 L18 34 h12 L24 60 L48 26 h-12 L44 4z', G) + ln('M38 4 L18 34 h12 L24 60 L48 26 h-12 L44 4z', K, 2.2),
  blessing: Array.from({ length: 10 }, (_, i) => { const a = i / 10 * Math.PI * 2; return ln(`M${(32 + Math.cos(a) * 16).toFixed(1)} ${(32 + Math.sin(a) * 16).toFixed(1)} L${(32 + Math.cos(a) * 26).toFixed(1)} ${(32 + Math.sin(a) * 26).toFixed(1)}`, G, 2.6); }).join('') + circ(32, 32, 12, G) + fill('M34 22 L26 33 h5 L28 42 L38 30 h-5 L36 22z'),
  swift: fill('M10 32 q14 -18 40 -10 l-8 4 q8 2 12 8 q-26 -4 -44 -2z') + ln('M6 40 h20 M10 46 h14', K, 2.4),
  hammerBuild: ICONS.hammer,
});

export { ICONS, icon, iconImg, K, R, C, G, O, L };
