// Guided gameplay (Dev tools → Script): a step-by-step walkthrough of the whole trial, for testing. Each step knows
// when it's done (from the game's own state), so the panel moves on by itself and says what to do next; steps with a
// place to go put a marker on the compass and the map. Players don't get this: they find their own way.
import { SITES } from '../world/sites.js';
import { biomeWeights } from '../world/gen.js';
import { icon } from '../ui/icons.js';

const K = (k) => `<span class="kbd">${k}</span>`;
const nearest = (P, list) => list.slice().sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z))[0];

export function steps(g) {
  const inv = g.inv, seen = (id) => inv.seen.has(id), has = (id, n) => inv.count(id) >= n, tr = () => g.trial.st, P = () => g.player.pos;
  const placed = (id) => g.build.placed.some((p) => p.id === id);
  const left = (key) => (key === 'scraps' ? SITES.olives.filter((s, i) => !tr().scraps.includes('olive' + i)) : SITES.caves.filter((s, i) => !tr().carvings.includes('cave' + i)));
  return [
    { t: 'Pick something up', h: `Stones, branches and flowers lie in the grass. Walk up to one and press ${K('E')}.`, done: () => inv.seen.size > 0 },
    { t: 'Talk to the Owl', h: `She's flying beside you with a <b>!</b> over her head. Face her and press ${K('E')}.`, done: () => g.owl.st.done.includes('intro') },
    { t: 'Gather wood', h: 'Pick up fallen branches: each gives 2 wood.', done: () => seen('wood') },
    { t: 'Make a weapon', h: `${K('C')}: a <b>crude club</b> (6 wood) or a <b>crude dagger</b> (1 wood, 2 stone). Equip it from the hotbar (${K('1')}–${K('8')}).`, done: () => seen('crudeClub') || seen('crudeDagger') },
    { t: 'Search the abandoned house', h: 'It\'s on your map. The old chest inside holds rope, leather, a dagger and a torch.', done: () => tr().looted.includes('houseChest'), go: () => SITES.house },
    { t: 'Make a hammer', h: `${K('C')} → <b>Wooden Hammer</b> (4 wood).`, done: () => seen('hammer') },
    { t: 'Build a workbench', h: `Hammer in hand, ${K('RMB')} → Build → <b>Workbench</b> (10 wood). Aim, ${K('LMB')} to place.`, done: () => placed('workbench') },
    { t: 'Hunt a deer', h: `Deer give leather and <b>deer hides</b> (you'll need 5 for the Minotaur). Sneak (${K('Ctrl')}) up close: an unaware animal takes a sneak attack.`, done: () => seen('deerHide') },
    { t: 'Make a crude axe', h: `${K('C')} → <b>Crude Axe</b>: 5 wood, 4 stone, 2 rope. Out of rope? Gather <b>fiber bushes</b> (3 fiber → 2 rope by hand), or 1 leather → 10 rope at the workbench.`, done: () => seen('crudeAxe') },
    { t: 'Fell a tree', h: 'Axe in hand, strike a tree until it falls, then split the log for wood.', done: () => g.harvest.stumps.length > 0 },
    { t: 'Build a campfire', h: `Build → <b>Campfire</b> (10 stone, 10 wood). It keeps you warm and cooks meat on a cooking stand.`, done: () => placed('campfire') },
    { t: 'Put a roof over your workbench', h: 'Walls and thatch roofs need rope. Most workbench recipes need a roof over the bench.', done: () => g.build.placed.some((p) => p.id === 'workbench' && g.build.underRoof(p.pos, 1.2)) },
    { t: 'Make a bed and sleep', h: 'Build → <b>Bed</b> (8 wood, 2 leather) under a roof. Use it (E) to set your spawn; at night you can sleep.', done: () => !!g.S.bed },
    { t: 'Make a bow and arrows', h: 'At the roofed workbench: <b>Crude Bow</b> (10 wood, 4 rope, 1 leather) and <b>Crude Arrows</b> (5 wood, 1 feather → 10). The Minotaur is weak to piercing.', done: () => seen('crudeBow') && seen('crudeArrow') },
    { t: 'Find the Ancient Temple and pray', h: 'It stands on a rise out in the meadows. The altar before its steps gives Zeus\'s Blessing, once a day.', done: () => tr().prayDay >= 1, go: () => SITES.temple },
    { t: 'Copy the marks of three ancient olives', h: () => `Marked olive trees glow in Pedias. Each one you copy marks the next. <b>${tr().scraps.length} / 3</b>`, done: () => tr().scraps.length >= 3 || tr().revealed.labyrinth, go: () => nearest(P(), left('scraps')) },
    { t: 'Gather the Minotaur\'s tribute', h: () => `<b>${Math.min(5, inv.count('deerHide'))} / 5</b> deer hides (deer) · <b>${Math.min(10, inv.count('olive'))} / 10</b> olives (olive trees, once a day each).`, done: () => (has('deerHide', 5) && has('olive', 10)) || !!g.trial.boss || tr().down.minotaur },
    { t: 'Call the Minotaur', h: `Go to the Labyrinth and lay the tribute on its altar (${K('E')}). Eat well first.`, done: () => !!g.trial.boss || tr().down.minotaur, go: () => SITES.labyrinth },
    { t: 'Defeat the Minotaur', h: 'Arrows and spears hurt him most. Skeletons rise every 30 seconds. Don\'t leave the arena.', done: () => tr().down.minotaur, go: () => SITES.labyrinth },
    { t: 'Offer the Minotaur\'s head', h: `Pick up his head, then lay it on its stand at the Ancient Temple (${K('E')}).`, done: () => tr().offered.minotaur, go: () => SITES.temple },
    { t: 'Enter the forest of Yleos', h: `The dark forest ring around the meadows. Try the Minotaur's Roar (${K('F')}). Dryads fear fire; giants hit very hard.`, done: () => g.owl.st.done.includes('yleos') || biomeWeights(P().x, P().z).y > 0.75 },
    { t: 'Take rubbings in three Giant caves', h: () => `Each cave on the forest's edge has a giant guard and a carving inside. <b>${tr().carvings.length} / 3</b>`, done: () => tr().carvings.length >= 3 || tr().revealed.chimera, go: () => nearest(P(), left('carvings')) },
    { t: 'Gather the Chimera\'s tribute', h: () => `<b>${Math.min(3, inv.count('dryadHeart'))} / 3</b> dryad hearts (some dryads carry one) · <b>${Math.min(10, inv.count('pomegranate'))} / 10</b> pomegranates (meadow groves).`, done: () => (has('dryadHeart', 3) && has('pomegranate', 10)) || !!g.trial.boss || tr().down.chimera },
    { t: 'Call the Chimera', h: `Lay the tribute on the altar of its shrine (${K('E')}). Lightstone gear and Cretan armour help.`, done: () => (g.trial.boss?.type === 'chimera') || tr().down.chimera, go: () => SITES.chimera },
    { t: 'Defeat the Chimera', h: 'Never stand behind it: the tail stings and poisons. Dryads join every 30 seconds.', done: () => tr().down.chimera, go: () => SITES.chimera },
    { t: 'Offer the Chimera\'s head', h: 'Lay it on its stand at the Ancient Temple.', done: () => tr().offered.chimera, go: () => SITES.temple },
  ];
}

export class Guide {
  constructor(g) {
    this.g = g; this.steps = steps(g); this.st = (g.S.guide ||= { done: [] }); this.on = false; this.t = 0; this.cur = -1;
    const el = document.createElement('div'); el.id = 'guide'; el.className = 'hidden'; document.getElementById('hud').appendChild(el); this.el = el;
  }
  set(on) { this.on = on; this.el.classList.toggle('hidden', !on); if (!on) this.g.map.guideTarget = null; this.cur = -1; this.update(1); }
  update(dt) {
    if (!this.on) return; this.t -= dt; if (this.t > 0) return; this.t = 0.4;
    const S = this.steps, done = this.st.done;
    // a step counts as done once its condition was met while it (or a later one) was current
    let i = 0; while (i < S.length && (done.includes(i) || S[i].done())) { if (!done.includes(i)) { done.push(i); if (i === this.cur) this.g.hud.toast(`Step done: <b>${S[i].t}</b>`); } i++; }
    if (i !== this.cur) { this.cur = i; if (i < S.length && this.shown) this.g.sound?.('reveal'); this.shown = true; }
    const s = S[i];
    this.g.map.guideTarget = s?.go ? { ...s.go(), label: s.t } : null;
    const P = this.g.player.pos, tgt = this.g.map.guideTarget, dist = tgt ? Math.round(Math.hypot(tgt.x - P.x, tgt.z - P.z)) : null;
    const html = s
      ? `<div class="gh">${icon('goal')}<span>Guided gameplay</span><em>Step ${i + 1} / ${S.length}</em></div><div class="gbar"><i style="width:${(i / S.length) * 100}%"></i></div>
         <h4>${s.t}</h4><p>${typeof s.h === 'function' ? s.h() : s.h}</p>${dist !== null ? `<p class="gd">${icon('chevron')} ${dist > 999 ? (dist / 1000).toFixed(1) + ' km' : dist + ' m'} · marked on your compass and map</p>` : ''}
         ${S[i + 1] ? `<p class="gn">Next: ${S[i + 1].t}</p>` : ''}`
      : `<div class="gh">${icon('goal')}<span>Guided gameplay</span><em>Complete</em></div><div class="gbar"><i style="width:100%"></i></div><h4>The trial is complete</h4><p>Both heads offered. Valtos and its storm are the next trial, still to come.</p>`;
    if (html !== this.last) { this.last = html; this.el.innerHTML = html; }
  }
}
