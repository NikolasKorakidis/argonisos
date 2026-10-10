// Patch notes, newest first, shown from the title screen and the pause menu. A new patch goes at the top of the list;
// players see a "New" mark on the button until they've opened the notes for the newest one.
import { icon } from './icons.js';

export const PATCHES = [
  {
    id: 'patch-1', name: 'Patch 1', title: 'The Trial Awakens', date: '9 October 2026',
    intro: 'The first big update to Argonisos: a better world to explore, a smoother building game, livelier bosses and a fresher look. Thank you to everyone who played and told us what felt wrong. Here is everything we changed.',
    sections: [
      { t: 'New', icon: 'goal', items: [
        '<b>Building Menu</b>: with the hammer out, press RMB for a menu of every piece you know, sorted into tabs (Q / E to switch). Pick a piece and you are placing it straight away. Crafting stations come first.',
        '<b>Sort Items</b>: one button in your pack and in every chest merges stacks and sorts everything by name. Your hotbar and the gear you wear stay where they are.',
        '<b>Repair Items</b> at the workbench: mend worn tools, weapons and armour one at a time. It costs part of what the item took to make, and nothing is taken unless the repair goes ahead.',
        '<b>Fiber bushes</b> grow in the meadows and the forest. Gather them and twist 3 fiber into 2 rope by hand, no workbench needed.',
        '<b>Minimap</b> in the bottom right corner, with the name of the biome you are in.',
        '<b>Your spawn point</b> is marked with a house on the compass, the minimap and the map.',
        '<b>Pause menu with settings</b>: fullscreen, graphics quality, resolution, volume, music and mouse sensitivity.',
        '<b>A new title screen</b>, and these patch notes.',
      ] },
      { t: 'The world', icon: 'temple', items: [
        '<b>Olympos</b>: one great mountain now rises out of the far hills of Yleos, bare rock above the trees and snow on its head. Climb it: from the summit, by the altar fire and the bronze eagle of Zeus, the whole island lies below you.',
        '<b>The giant forest</b>: where the meadows give way to the hills, long stretches of enormous trees, their trunks like columns and their crowns thirty metres up. Walk through their shade between ferns, with shafts of sun slanting down through the canopy.',
        'New bushes and ferns across the land (beautiful free models by Quaternius), and here and there a bush with leaves turned rust-red.',
        'More fallen branches and stones to pick up, and a branch now gives you 2 wood directly.',
        'The Ancient Temple of Zeus stands further out in the meadows. Explore to find it.',
        'The meadows roll gently instead of lying perfectly flat.',
        'The edge of the view fades softly into the haze instead of cutting off.',
        'Trees and bushes no longer grow inside rocks and boulders.',
        'Floors you build press the ground down beneath them: no more grass or earth poking through your boards on a slope.',
        'The Labyrinth has been rebuilt: a paved arena, a great horned gate, braziers lighting the way in, and the bones of those who came before.',
      ] },
      { t: 'Places of the trial', icon: 'temple', items: [
        '<b>The Ancient Temple of Zeus</b> has been rebuilt inside and out: the gods on painted pediments, gilded palmettes, a paved sacred way between cypresses and votive statues, and inside a painted hall under a ceiling of golden stars, with a dark pool before an ivory-and-gold Zeus lit by bronze tripods.',
        '<b>The abandoned farmhouse</b> is a real Greek farmstead now: whitewashed walls, half its tiled roof fallen in, a walled yard with a well, a clay oven, storage jars and an olive, a vine over the door, and inside the hearth, a loom and the shelves the family left.',
        '<b>The Giant caves</b> are great rocky outcrops with moss on top and stalactites within. The giant\'s fire burns inside with his supper on the spit, and the carving stands on a stele at the back.',
        '<b>The Chimera\'s shrine</b> is a dark, sunken court of mossy flagstones among fallen, ivy-grown columns, with mist on the stones, tripod fires, and the beast itself in black stone on the altar, its eyes burning.',
        'The marked olive trees carry their marks on a small stele, with offerings at its foot.',
        'Ruins lie across the land: fallen and standing columns, roadside herms, caches of amphorae and old walls (break them up for stone). Lavender, broom and myrtle grow on the hillsides.',
        'Fixed: the rocks of the Giant caves were broken into shards with the sky showing through.',
      ] },
      { t: 'Bosses and creatures', icon: 'bull', items: [
        '<b>The Minotaur</b> fights with everything he has: a bull charge you can see coming (if he runs into a wall he is dazed: strike!), a slam of his labrys that shakes the ground, blocks of stone thrown at anyone keeping their distance, a war cry that stuns, and quick follow-up swings. Below half health he becomes enraged.',
        'The Minotaur and the dead now find their way through the gaps in the Labyrinth\'s walls instead of getting stuck on them.',
        '<b>The Chimera</b> breathes fire (and sets you burning) and pounces on you from afar, as well as clawing and stinging anyone behind it.',
        'Animals see in front of them and only hear behind them. When they spot you they freeze for a moment of alarm before they run, so careful hunters get their chance.',
        'Stronger creatures are marked with owls over their name instead of stars.',
        'Wild boars have the build of a boar: heavy shoulders and a crest of bristles.',
      ] },
      { t: 'Building', icon: 'hammer', items: [
        'Snapping is far steadier: pieces snap to the closest fitting point, keep their snap while you aim, and never snap to the workbench or furniture.',
        'You can no longer build a piece on top of the same piece, or half over another floor.',
        'No more flickering where pieces meet: roof joints, gable ends, wall corners and floors all render cleanly.',
        'Grass no longer grows through your floors.',
        'Anything standing between the camera and you (walls, buildings, trees) turns see-through and comes back when the view is clear.',
      ] },
      { t: 'Survival and crafting', icon: 'fire', items: [
        'The cooking stand takes all your raw meat and fish at once, and each piece cooks on its own.',
        'A lit campfire can be put out (F) and lit again, keeping its wood.',
        'Fixed: the cooking stand could not be used when it stood over a fire.',
        'Menus open where you left them, and C opens and closes crafting.',
        'You are asked before an item is dropped from your pack.',
        'Things lying on the ground stand out better, with a patch of bare earth around them.',
      ] },
      { t: 'The Owl', icon: 'owl', items: [
        'The Owl flies beside you and shows a <b>!</b> when she has something to say. She comes back at the important moments of your trial.',
        'Each marked olive tree you copy points you towards the next, and so does each cave carving.',
      ] },
      { t: 'Moving through the world', icon: 'jump', items: [
        '<b>Feet on the ground</b>: your hero\'s feet now find the real ground under them. On hillsides, steps, stairs and the temple platform each foot plants where it should, the hips drop to let the lower leg reach, and a planted foot follows the slope. No more floating or sinking feet.',
        'Hills matter: you slow down and lean in going up a slope, and pick up a little speed leaning back coming down. Sprinting uphill costs more stamina.',
        'The Minotaur, the giants, the dryads and the dead plant their feet the same way, and they now climb steps at the shrines instead of walking through them.',
        'Deer, foxes, rabbits, boars and the Chimera tilt with the ground they stand on, nose up a hill and down it going down.',
      ] },
      { t: 'Graphics and sound', icon: 'blessing', items: [
        '<b>Smoother everywhere</b>: trees and plants are now drawn in a handful of batches instead of hundreds of pieces, only what is in view is drawn, and far-off places are skipped. The forest is drawn with half the work it took before. If a frame still runs long, the picture quietly drops a little in resolution and climbs back when it can.',
        'Clouds cast soft shadows that drift across the land with the wind.',
        'Every place and hour has its own colour: warm and golden in the meadows, cool and green in the forest and under the giants, amber at sunrise and sunset, blue at night. A new tone curve keeps snow, marble and bright skies from burning out.',
        'Trees, rocks and ruins shade the ground and the grass beneath them, and hollows lie a little darker.',
        'The meadows look fuller: grass blades no longer thin to lines when seen side-on, their colour varies in clumps, and distant grass is drawn more cleverly.',
        'Pollen drifts over the meadows by day, fireflies blink at dusk and through the night, leaves spin down in the forests, and snow blows across the summit of Olympos.',
        'Trees no longer pop between their near and far forms: one dissolves into the other.',
        '<b>Day and night, smoothed out</b>: the light no longer steps as the sun moves, and the shadows no longer swing across the ground when the moon takes over.',
        '<b>Sunrises and sunsets</b> glow around the sun, with a pink band in the sky opposite. In the morning a mist lies in the low ground and burns off as the day warms.',
        'Haze glows when you look towards the sun, and shafts of light break past trees, trunks and ridges.',
        'Day turns to night smoothly, and a new soundscape and music follow the time of day, the weather and the biome.',
        'Grass sways in gusts that sweep across the meadows, and glows where the sun shines through it.',
        'Leaves glow with the sun behind them, and tree edges no longer shimmer as you move.',
        'The fir trees of Yleos have been rebuilt with drooping boughs.',
        'Sharper shadows on High graphics, clouds with shape and shade, and marble and stone that no longer burn out to white in full sun.',
        'Fixed: the bow was held the wrong way round.',
      ] },
    ],
  },
];

// The notes as HTML (for the panel)
export function patchHTML(p) {
  return `<div class="pnhead"><span class="pnname">${p.name}</span><h3>${p.title}</h3><span class="pndate">${p.date}</span></div>
    <p class="pnintro">${p.intro}</p>
    ${p.sections.map((s) => `<p class="psub">${icon(s.icon)} ${s.t}</p><ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`).join('')}`;
}
// The same notes as plain text, for pasting into a post or a message (headings, then "- " bullets)
export function patchText(p) {
  const plain = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  return [`Argonisos · ${p.name}: ${p.title} (${p.date})`, '', plain(p.intro), ...p.sections.flatMap((s) => ['', s.t.toUpperCase(), ...s.items.map((i) => `- ${plain(i)}`)])].join('\n');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* not allowed here: fall back to a selected text box */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
  let ok = false; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
}
const SEEN = 'argonisos.notesSeen';
export const notesUnread = () => { try { return localStorage.getItem(SEEN) !== PATCHES[0].id; } catch { return false; } };
export const markNotesRead = () => { try { localStorage.setItem(SEEN, PATCHES[0].id); } catch { /* private mode */ } };

// The patch notes panel (one, shared by the title screen and the pause menu): a list of patches on the left, the chosen
// one's notes on the right
let panel = null;
export function notesPanel() {
  if (panel) return panel; let onClose = null;
  const el = document.createElement('div'); el.id = 'notes'; el.className = 'hidden';
  el.innerHTML = `<div class="pnl"><h2>Patch Notes</h2><button class="x" title="Close">×</button><div class="pnwrap">
    <nav>${PATCHES.map((p, i) => `<button data-i="${i}" class="${i ? '' : 'on'}"><b>${p.name}</b><span>${p.title}</span><em>${p.date}</em></button>`).join('')}
      <button class="btn small copy" title="Copy these notes as plain text">Copy all notes</button></nav>
    <article>${patchHTML(PATCHES[0])}</article></div></div>`;
  document.body.appendChild(el);
  const close = () => { el.classList.add('hidden'); onClose?.(); onClose = null; };
  el.querySelector('.x').onclick = close;
  el.addEventListener('click', (e) => { if (e.target === el) close(); });
  addEventListener('keydown', (e) => { if (e.code === 'Escape' && !el.classList.contains('hidden')) { e.stopPropagation(); close(); } }, true);
  let cur = 0;
  el.querySelector('.copy').onclick = async (e) => { e.stopPropagation(); const b = e.currentTarget, ok = await copyText(patchText(PATCHES[cur])); b.textContent = ok ? 'Copied!' : 'Could not copy'; setTimeout(() => (b.textContent = 'Copy all notes'), 1800); };
  el.querySelector('nav').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (!b) return; cur = +b.dataset.i; el.querySelectorAll('nav button[data-i]').forEach((x) => x.classList.toggle('on', x === b)); el.querySelector('article').innerHTML = patchHTML(PATCHES[+b.dataset.i]); el.querySelector('article').scrollTop = 0; };
  return (panel = { el, open: (cb) => { onClose = cb; el.classList.remove('hidden'); el.querySelector('article').scrollTop = 0; markNotesRead(); }, close });
}
