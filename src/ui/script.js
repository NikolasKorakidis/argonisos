// The game script: the whole flow of the trial from waking up to the last offering, as shown in Dev tools → Script.
// Keep it in step with the game when the design changes.
const K = (k) => `<span class="kbd">${k}</span>`;
export const SCRIPT = `
<h3>The idea</h3>
<p>There is no quest log. You are set down on Nisos and the trial is simple: <b>defeat the beasts that rule each open land and bring their heads to Zeus.</b> Everything else (gathering, crafting, building, hunting) is how you grow strong enough to do it. Each head makes you stronger and opens the next step. The loop: <i>explore → find the clues → gather the tribute → call the beast → win → offer its head → get stronger → go further.</i></p>

<h3>1 · Waking up</h3>
<ul>
<li>Day 1, morning, empty-handed, in the meadows of <b>Pedias</b> at the heart of the island.</li>
<li>Stones, branches, flowers and feathers lie in the grass. ${K('E')} picks them up.</li>
<li><b>The Owl</b> comes after your first find. She flies alongside you with a <b>!</b> over her head until you talk to her (${K('E')}), tells you how the trial works, then flies off. She comes back whenever there is something new to know.</li>
<li>Whatever you have held unlocks the recipes that use it (${K('C')}). Fallen branches give 2 wood each when picked up. First things: hammer (4 wood); crude club (6 wood); crude dagger (1 wood, 2 stone).</li>
<li>Already on the map (${K('M')}): an <b>abandoned house</b> whose chest holds rope, leather, olives, a dagger, resin and a torch. The <b>Ancient Temple</b> stands 230–320 m out in the meadows and appears on the map once you find it (pray there once a day for Zeus's Blessing; its fire keeps you warm).</li>
</ul>

<h3>2 · Getting set up</h3>
<ul>
<li><b>Rope</b> is twisted by hand from <b>fiber</b> (fiber bushes in both biomes, 3 per bush; 3 fiber → 2 rope), or made from leather at a workbench (1 leather → 10 rope; a workbench is 10 wood). <b>Leather</b> comes from animals: rabbits, deer and hogs. Deer also give <b>deer hides</b>, needed later.</li>
<li><b>Hunting:</b> animals see a wide arc in front of them but only hear you behind. Sneak (${K('Ctrl')}) up from behind and strike: an unaware animal takes a sneak attack. When one notices you it freezes and stares for a moment before it bolts (or charges): that's your chance to strike or loose an arrow. Sprinting is heard from far off; grazing animals notice less.</li>
<li>A <b>crude axe</b> (5 wood, 4 stone, 2 rope) fells trees: they topple and leave a log to split into wood (pines also give resin).</li>
<li>No hunger. Health 25 and stamina 50, raised for a while by food (three slots): olives (olive trees, once a day), acorns (oaks), pomegranates, cooked meat (+40 health). Raw meat makes you sick: cook it on a cooking stand over a fire.</li>
<li>Night or rain makes you <b>Cold</b>, rain makes you <b>Wet</b>: both slow your healing. A <b>campfire</b> (10 stone, 10 wood) cures them; rain puts out a fire that has no roof over it.</li>
</ul>

<h3>3 · A home</h3>
<ul>
<li>Hammer in hand, ${K('RMB')} opens the build menu: walls, floors, roofs, a door, stairs, fences, a campfire, a bed, a chest, torches. Pieces snap together and need support (the hammer tints them by it); unsupported pieces fall.</li>
<li>A <b>bed under a roof</b>: sleep through the night, wake Rested, and wake there when you fall.</li>
<li>A <b>workbench under a roof</b>: pickaxe, bow and arrows, spear, shields. Rope is the one thing it makes without a roof. Leather <b>Thrower armour</b> keeps out the cold.</li>
<li>If you die, your belongings stay in a grave where you fell. You wake at your bed with Zeus's Favour (faster for a while) and walk back for them.</li>
<li>Skills grow by doing: sprinting, jumping, gathering, swimming, sneaking, each weapon, blocking.</li>
</ul>

<h3>4 · The Minotaur (Pedias)</h3>
<ul>
<li><b>Clues:</b> five ancient olive trees in Pedias carry glowing marks. Copy them (${K('E')}); each copied tree marks the next on your map and compass. <b>Three</b> reveal the <b>Labyrinth</b>.</li>
<li><b>Tribute</b> on its altar: <b>5 deer hides + 10 olives</b>.</li>
<li><b>The fight:</b> 500 health. Axe swings, a charge, a roar that can stun. Skeletons rise every 30 seconds. Weak to piercing (bow, spear), resists slashing and blunt. Run too far and the fight ends, tribute lost.</li>
<li><b>Reward:</b> his head, 12 Minotaur hides, 20–30 sharp bones.</li>
<li><b>Offering</b> at the Ancient Temple: <b>Minotaur's Roar</b> (${K('F')}: stuns everything around you; 5 minute cooldown) and <b>tier 1</b>: lightstone axe, spear and dagger, Cretan armour.</li>
</ul>

<h3>5 · The Chimera (Yleos)</h3>
<ul>
<li><b>Yleos</b> is the dark forest ring around Pedias: dryads hunt on sight (they fear fire), giants roam, more at night. Lightstone is mined from its boulders.</li>
<li><b>Clues:</b> four Giant caves on the forest's outer edge, each guarded by a Giant (550–650 health, blows of 50–70). Take a rubbing of each carving; each points to the next; <b>three</b> reveal the <b>Chimera's Shrine</b>.</li>
<li><b>Tribute:</b> <b>3 dryad hearts + 10 pomegranates</b> (some dryads carry a heart).</li>
<li><b>The fight:</b> 2,500 health. Bite, claws, and a venomous tail sting for anyone behind it. Dryads join every 30 seconds.</li>
<li><b>Offering:</b> <b>Chimera's Claws</b> (${K('F')}: your bare hands strike like claws for 5 minutes) and <b>tier 2</b>: the Cretan bow.</li>
</ul>

<h3>6 · The end of this trial</h3>
<p>With both heads offered, this milestone is complete. The marsh of <b>Valtos</b> lies behind Zeus's storm wall; the storm throws you back. It is the next trial: its boss and its tier will continue the same loop.</p>

<h3>Where the Owl appears</h3>
<p>First find · first evening · the abandoned house · the Ancient Temple · the first marked olive · the Labyrinth revealed · its altar · the Minotaur's fall · the first offering · entering Yleos · the Giant caves · the Chimera's Shrine revealed · its altar · the Chimera's fall · the second offering · your first death.</p>

<h3>Not built yet</h3>
<p>Farming (the hoe), throwing spears, fishing; balance has not been playtested.</p>
`;
