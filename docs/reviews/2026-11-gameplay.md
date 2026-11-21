# Argonisos: gameplay systems review

> Kept from the review round of 20 November 2026. The screenshots, probe scripts and raw logs it names were in the
> reviewer's scratch folder and are not kept; the line numbers are as of the commit it names.

Scope: `src/game` (combat, trial, guide, owl, acts, save, game), `src/creatures` (creatures, models), `src/player`
(player, stats, speeds), `docs/plans/balance.md`, the patch notes up to Patch 22. Read the code; ran the bot playtest
once (`npm run playtest -- --minutes 8 --seed 7`, report in `tests/reports/playtest/2026-11-20T21-27-01/`). Nothing under `src/`, `tests/`, `tools/`
or `docs/` was changed.

Playtest: 0 page errors, 0 incidents, 275 hitches over 50 ms (worst 400 ms while gathering at the spawn). The bot is a
stability check rather than a judge of fun, so the findings below come from reading the systems. One thing for the
performance reviewer: over a 4.3-minute stretch with no reload, GPU geometries went 410 → 1231 and scene objects
+91/min. That looks like a leak.

Effort: S under an hour, M a few hours, L a day or more.

---

## 1. Bugs, ranked

### B1. You can't dodge-roll with a bow, or with nothing in your hands (High, S–M)
- **Issue:** the roll only works with the guard up (Space while blocking). The bow and bare hands can't block, so they
  can't roll either. The bow is the weapon the owl and the guide recommend for the Minotaur, and the advice for his
  sweep and charge ("roll back out of it", "roll") can't be followed with it.
- **Evidence:** `player.js:161` needs `this.blocking`; `combat.js:194` `canBlock = !g.bow() && … (g.held() || shield)`.
  With the bow, RMB draws instead.
- **Fix:** make the roll independent of blocking. Either Space while RMB is held with any loadout (with the bow it
  cancels the draw, `setBow('lower')`), or its own key or a double-tap of a direction. Keep the stamina cost (12) and
  the safe window.

### B2. A parry staggers anything, bosses and giants included, and the tower shield parries (High, S)
- **Issue:** every parry sets `c.hitT = 1.2; c.atkCd = 2.5` on whatever struck you (`combat.js:102`). On a boss,
  `hitT > 0` stops new moves from starting (`trial.js` `bossThink`: `if (c.state !== 'chase' || c.hitT > 0) return null`),
  so parrying the Minotaur's sweep or a thrown rock holds a 10 m giant in place. A Yleos giant (50–70) can be parried
  over and over: a crude shield soaks 30 for about 20 stamina, and each parry pushes its next blow back 2.5 s. The tower
  shield has no `parry` value, but `parryBonus()` falls back to `|| 1.5` (`combat.js:122`), so it parries like the round
  shield. In Valheim, tower shields can't parry and bosses resist parry stagger.
- **Fix:** stagger on parry only when `!c.boss` (and for heavy creatures only if the parry's block value is at least,
  say, 60% of the blow: a "parry force"). Give the tower shield `parry: 0`, and skip the parry branch when the bonus
  is 0 (use `??` rather than `||`). Pair this with I4, the riposte.

### B3. Saving or dying during a boss fight loses the tribute, and the arena stays broken (High, S–M)
- **Issue:** creatures aren't saved (`creatures.js:417` `toJSON() { return []; }`), and the trial doesn't record that a
  fight is on. The tribute is taken when you lay it (`trial.js:174`), and the site's ruin is saved (`st.broken`). The
  autosave runs every 60 s and when the page closes (`game.js:210`). If you reload mid-fight, the boss is gone, the
  tribute too, and the altar asks for another. Dying does the same: you wake at a bed more than 70 m away, which
  counts as fleeing (`trial.js:502`, "You fled…"). Ten olives come from olive trees once a day each, so one death can
  cost days of gathering.
- **Fix:** at the summons, keep `st.fight = { boss, tribute }`. When the fight ends without a kill (fled, died, or
  loaded with a fight on), leave the tribute on the altar ("The tribute still lies on the altar", E calls again for
  free) instead of consuming it. In Valheim the boss stays where it is and nothing is lost.

### B4. Creatures hit you through walls (Medium, S)
- **Issue:** a creature's blow lands if you're in front of it and within `T.reach + T.r + 0.6`, with no line-of-sight
  test (`creatures.js:256–258`). A hog outside a wall hits you up to about 2.3 m inside it, and a giant (reach 3.6, `r`
  1.2) much further. Inside your house is the one place that should feel safe.
- **Fix:** before `hitPlayer`, cast `g.colliders.pick(c.pos → player, filter k.ref?.piece || structure walls)`. If a
  wall is in the way, the blow goes into the wall (`hitBuildings` already damages pieces). The same test for dryads'
  `sight` would stop them noticing you through walls.

### B5. Poison and burning take hold even when you rolled or blocked (Medium, S)
- **Evidence:** `trial.js:429` `g.combat.hitPlayer(c, [52, 72, 'pierce']); P.stats.add('poisoned', 6);`, and
  `trial.js:441` does the same for `burning`. Both are unconditional.
- **Fix:** `const r = hitPlayer(…); if (typeof r === 'number' && r > 0) P.stats.add(…)`.

### B6. The bow ignores most of what should make it stronger (Medium, S)
- Arrows ignore the Bowman skill. There's no `k` in the arrow's `hurt` (`combat.js:209`), and only accuracy scales
  (`combat.js:185`), while melee gets `damageK` (3% a level).
- Zeus's Blessing promises "+10% melee and bow damage, +10% block" (`stats.js:22`), but only melee gets it
  (`combat.js:77`). `blockValue()` (`combat.js:121`) never applies the +10%.
- The Cretan Helmet's `bowDmg: 0.05` and the Cretan Bow's `sneak: 0.1` are never read anywhere (`items.js:69,75`).
- The arrow's backstab is fixed at 3 (`combat.js:209`), not the bow's own (the Cretan Bow has 4).
- **Fix:** pass `k: damageK('bow') * blessing * (1 + helmet bowDmg)` and `backstab: bow.backstab` for arrows, multiply
  `blockValue()` by 1.1 under the Blessing, and fold the bow's `sneak` into `senseK` (B7).

### B7. The Sneaking skill only makes sneaking cheaper (Medium, S)
- **Evidence:** `senseK` halves the range while sneaking whatever the skill level (`creatures.js:135`). The skill only
  lowers the stamina cost through `Stats.use`.
- **Fix:** `k *= 0.5 * (1 - 0.004 * (level - 1)) * (1 - bow.sneak)`, so level 100 is about 0.3. Training then pays
  off in hunting and sneak attacks.

### B8. Each creature can only be sneak-attacked once (Low–Medium, S)
- **Issue:** `c.aware` turns true at the first alert or hurt. It only turns false again if you back off during the
  alert moment (`creatures.js:209`), not when a chase ends and it goes idle (`creatures.js:234`). A creature that lost
  you can never be sneak-attacked again.
- **Fix:** set `c.aware = false` wherever a chase or flight returns to idle.

### B9. The death penalty usually costs nothing, and when it does it breaks the skill bar (Low–Medium, S)
- **Issue:** the penalty takes 5% of one random skill's *total* XP (`main.js:85`). With 13 skills, many never used, it
  often hits a skill at 0 XP and costs nothing. When it does hit, XP can fall below the current level's threshold:
  the level stays, but `hud.js:207` then works out a negative width for the progress bar.
- **Fix:** take a share of every used skill's progress within its level (Valheim takes 5% from all skills),
  `xp = max(xpForLevel(L), xp - 0.05 * (xpForLevel(L + 1) - xpForLevel(L)))`, or at least pick from skills with
  `xp > 0`, and clamp.

### B10. Save robustness (Low–Medium, S)
- `save.js:39` replaces the skills object wholesale with the saved one (`P.stats.skills = st.skills`). A skill added in a
  later patch has no entry in an older save, and `Stats.use` / `skillK` / `damageK` read `this.skills[s].level`, which
  throws on the first sprint or swing. Merge instead: `for (k in SKILLS) skills[k] = { ...default, ...st.skills?.[k] }`.
- A failed save (storage full) only logs to the console (`save.js:26`). Tell the player with a toast, since a large
  build list can fill localStorage.
- `g.save` refuses while you're dead (`game.js:209`). Closing the tab during the 5.5 s death screen brings back the
  last autosave with your full pack and no grave, a cheap way out of the corpse run. Save the grave at once (or save
  right after `graves.fall()`).

### B11. Being stunned doesn't drop your guard (Low, S)
- `P.blocking` doesn't check `stunned` (`combat.js:195`). You can block while the roar has you stunned, and a guard
  break, which stuns you, doesn't open you up if RMB is still held. Add `&& !P.stats.has('stunned')`.

### B12. The owl still says dryads fear fire (Low, S)
- `owl.js:30` ("they fear fire") and `guide.js:37` ("Dryads fear fire") contradict Patch 21 T7: the dryad isn't afraid
  of fire, only the dryadling is, and only of placed fires. Players will walk into a dryad with a torch out.

### B13. The Chimera's weakness to poison can't be used (Low, S–M)
- The Chimera is `weak: ['poison']` (`trial.js:40`), but the only poison damage in the game is the Chimera's Claws
  power, the reward for killing it (`combat.js:77`). Either add a poison source in Yleos before the fight (venom
  arrows from dryad thorns or a forest plant), or give it a weakness the player has. Fire is out: it resists fire.

### B14. A second giant can spawn at a cave while the first is still alive (Low, S)
- `trial.js:516` spawns a guard once a day when you're within 70 m, but doesn't check whether the last one is alive.
  Stay near a cave over a day change and there are two. Check that no guard of that cave is alive first.

### B15. You can sleep with enemies beside the bed (Low, S)
- `build.js:534` and `acts.js:190` never check for enemies, creatures keep acting while you sleep, and
  `acts.hurt` doesn't wake you. Refuse with "You can't sleep with enemies near" (any aware hostile within about 25 m),
  as Valheim does.

### B16. Melee hits whichever creature comes first in the list, not the nearest (Low, S)
- `combat.js:75` takes `inArc(...).slice(0, 1 or 2)` in list order. With two hogs in the arc, the swing can hit the far
  one. Sort by distance first.

### B17. Stats and items that do nothing (Low, S each; listed so they aren't forgotten)
- `freezing` is never applied, so the Cretan Cape's `noFreeze` does nothing.
- `spoil` / `spoilTo` on meat and fish are never counted down. That's fine (Valheim has no spoilage), but the item
  data says otherwise.
- The spear's `throwable` is unused (see I3).
- `rawFish` / `cookedFish` can't be got: there's no fish and no fishing.
- `minotaurHide` (12 from the boss), `giantHide`, `chimeraHide`, `sharpBone` (dropped by nearly everything),
  `dandelion`, `moonflower` and `coal` go into no recipe. `boarHide` and `rabbitHide` are never dropped.

---

## 2. Improvements (balance, feel, flow), ranked

### I1. Armour against the forest's creatures (the known open item). For you to decide
`armorReduce` (`combat.js:25`) is Valheim's curve (`dmg - armour` while armour is under half the blow, `dmg²/(4·armour)`
above that). Armour totals with the set bonus are: Thrower 17, Cretan 38, Corinthian 67. Damage taken per hit
(average blow):

| blow | none | Thrower 17 | Cretan 38 | Corinthian 67 |
|---|---|---|---|---|
| hog 10 | 10 | 1.5 | 0.7 | 0.4 |
| dryadling 5 | 5 | 0.4 | 0.2 | 0.1 |
| dryad melee 7 / thorn 5 | 7 / 5 | 0.7 / 0.4 | 0.3 / 0.2 | 0.2 / 0.1 |
| risen skeleton 15 | 15 | 3.3 | 1.5 | 0.8 |
| giant 60 | 60 | 43 | 24 | 13 |
| Minotaur gore 44 / slam 34 / sweep 27 | | 27 / 17 / 11 | 13 / 8 / 5 | 7 / 4 / 3 |
| Chimera sting 62 / pounce 45 / claw 27 | | 45 / 28 / 11 | 25 / 13 / 5 | 14 / 8 / 3 |

What this shows:
- **Cretan armour isn't really the cause.** The leather Thrower set already makes everything but giants and bosses
  harmless (under 1 a hit). Halving Cretan to 19 would change almost nothing for dryads (0.3 → 0.6). The forest's
  small creatures hit too softly for *any* armour the island offers.
- Valheim is the same shape (greydwarfs barely scratch troll armour). There the danger comes from a mid-tier hitter
  (brutes), the troll, poison that ignores armour (the shaman), numbers, and stagger. Yleos has the giant, but nothing
  between it and the 5–7 damage dryads.
- Cretan comes straight after the Minotaur from Pedias materials (20 deer hide + 20 fox hide), *before* you enter
  Yleos, so the forest is beaten before it's met. In Valheim each biome's armour needs that biome's drops.

Options, by how much they change:
1. **Gate Cretan on Yleos (S):** put the unused `giantHide` into the body and legs (for example 2 + 1). You then wear
   Thrower (17) through your first forest weeks and Cretan only after a giant falls. The dryads still won't hurt much,
   but giants and the Chimera keep their weight.
2. **Give the forest a mid-tier hitter and armour-proof damage (M, recommended with 1):** a heavy dryad bruiser
   (about 30–40 blunt, which deals 6–10 through Cretan and staggers) and a dryad that poisons with its thorns (poison
   over time isn't reduced by armour, as with the Chimera's sting today); dryads in bigger groups at night.
3. **A floor on the curve (S):** `max(curve, 0.15 · dmg)` so no blow is ever fully shrugged off. Every hit stays
   visible, and a pack of five dryads chips at you. This is the least Valheim-like of the three, but it's one line and
   it's tunable.
4. **Lower all armour by about a third (S):** brings bosses and giants back up (giant 24 → 31 against Cretan) but
   leaves small creatures trivial, so it doesn't answer the complaint by itself.

My recommendation: options 1 and 2, with 3 held back as a quick fix if the team wants the feel at once.

### I2. Deer are too easy to walk up to (Medium, S)
Deer flee at 6 m in front and 2 m behind, half that sneaking (`creatures.js:37`, `senseK`), so you can stroll up to
one and club it. Valheim's deer bolt from 20–30 m, which is what makes the bow and sneaking matter early. Raise
`flee` for deer to about 18 m (foxes 10, rabbits 8); with B7, sneaking skill is then what lets you get close.

### I3. Every weapon swings the same (Medium, M)
Every swing costs 5 stamina whatever the weapon (`game.js:191`), and there are no secondary attacks. A dagger and an
axe feel alike in the stamina economy. Valheim's identity comes from per-weapon cost plus a special (MMB): give each
weapon its own cost (dagger 4, club 6, axe 7, spear 8) and add a secondary. The spear can be thrown (`throwable` is
already in the data), the axe or club an overhead blow that staggers, the dagger a lunge with a big backstab.

### I4. Stagger and riposte (Medium, M)
Today every hit makes a creature flinch for 0.25 s (`creatures.js:150`). That halves its speed but never interrupts
its swing, and a parry's stagger gives no damage bonus. Valheim's loop is: block or parry, the enemy is staggered,
your hit does double. Give ordinary creatures a stagger meter (the boss's `poise` already does this), take hits ×2
while staggered, and show it (a ring or the bar flashing). Parrying then becomes the skill play it is in Valheim.

### I5. The game never teaches parrying or rolling (Medium, S)
Nothing in the game mentions the parry window or the roll (no owl card, no hint, no controls screen; the intro card
`owl.js:17` only says "RMB block"). Add an owl topic triggered by the first hostile fight or the first blow taken:
"Raise your guard just as the blow comes and you'll parry it, leaving them open; Space with your guard up rolls you
clear." Give it a one-time toast after the first successful block.

### I6. Nothing leads from the temple to the marked olives (Medium, S)
The intro points to the house and the temple. After that, the next goal, the marked olives, only comes up when you
pass within 18 m of one (`owl.js:96`); nothing at the temple mentions them. A player can wander for a long time
without a lead. Have the temple card (or the first prayer) mark the nearest marked olive ("Zeus shows you an ancient
olive where the old ones carved the way"), as the clues already do for one another (`trial.pointNext`).

### I7. A journal for goals (Medium, M)
Players get the owl's cards once and can't read them again. The step list in `guide.js` (dev only) is in effect a
quest log. Show a trimmed version to players: a "Trial" tab in the C panel with the owl's past cards and the open
goals (clues 2/3, the tribute counts, where the head goes). Valheim keeps Hugin's tips in the compendium for the same
reason.

### I8. Your grave isn't on the map or compass (Medium, S)
After a death you wake at your bed, possibly a kilometre away, and only the light over the grave shows where it is
(`save.js` `Graves`). Valheim marks the tombstone on the map. Add it to the map and the compass (`map.js` already does
this for the bed), and remove the mark when the grave is emptied.

### I9. Bosses can't be fought again (Low–Medium, S)
`st.down[boss]` silences the altar for good (`trial.js:111`). In Valheim you can summon a boss again for trophies and
materials. Let the tribute call it again, maybe with a lesser reward (hide, no power), once the boss's hide has a use
(I14).

### I10. Healing (Low–Medium, S)
Base 0.5 hp/s plus half of each food's regen per second (`stats.js:107`) comes to about 2–2.5 hp/s with three foods:
backing off for 20 s restores 50 hp, even mid-fight. The values are as intended. To make the fight-then-rest rhythm
matter without changing food, pause health regen for about 4 s after taking a blow ("in combat").

### I11. Rest and comfort (Medium, M)
Rested is 20 minutes of +5% speed and 5% less stamina (`stats.js:11`), whether you slept in a hut or a hall, so there's
little reason to build a cosy base. Valheim's comfort (chairs, banners, fire under a roof) lengthens Rested, and
Rested raises regeneration and skill gain. Count comfort pieces near the bed or fire for the duration, and give
Rested a regen bonus (+50%) and an XP bonus. Building a home then pays off.

### I12. Weather barely affects play (Low–Medium, M)
Rain only makes you wet: −25% regen for 2 min (`stats.js:13`, `main.js:122`). Ideas:
- rain and wind cover your sound, so creatures hear you a third less;
- fog halves sight ranges (`senseK`);
- a wet bowstring draws slower;
- in a thunderstorm, Zeus's bolts can strike the highest thing about: a hero in bronze on a hilltop. Lightning and
  warning marks already exist in `trial.js` (`bolt`).

### I13. Few hostile kinds, little variety at night (Medium, M–L)
Pedias has one hostile creature (the hog, which only attacks within 3 m: `aggro: 10*FT`) plus rare dryadlings. Yleos
has three. Skeletons only appear for the boss. The first nights in Pedias aren't tense. Ideas:
- risen dead walking near the Labyrinth and the town by night;
- bats in the giants' caves;
- the bruiser and poisoner from I1;
- a creature that comes out of Yleos into the edge of the meadows at night, as Valheim's greydwarfs do.

### I14. Exploration rewards (Medium, M)
There are five one-time chests on the island (the farmhouse and four in the town, all in Pedias; `structures.js:660`,
`town.js:121–124`) and none in Yleos. Exploring Yleos pays only in carvings and lightstone. Ideas:
- a giant's hoard in each cave once the guard is dead (there's already a fire and a den);
- dryad groves with heartwood;
- small shrines that bless (+10% of something for 5 min, once a day);
- rare trophy heads;
- recipes for the dead materials (B17): bone arrows and a bone needle (`sharpBone`), a Minotaur-hide cape or shield,
  giant-hide armour (I1), moonflower or dandelion meads.

In Valheim every drop feeds a recipe, and that's much of the pull to explore.

### I15. The last boss's reward has nothing left to use it on (Medium, design)
The Cretan Bow and the Corinthian armour unlock only when the Chimera's head is offered (`trial.js:238`), and Valtos
is locked, so the best gear arrives with nothing to use it on. Either unlock them partway through Yleos (on the third
carving, or on killing a giant) so they're the gear for the Chimera, or give the post-Chimera island something to do
(rematches I9, raids F2, level-2 nights).

### I16. Flee rules in the boss fight (Low, S)
At 45 m from the arena the boss heals 5% a second (`trial.js:291`). At 70 m the fight ends (B3). The leash ring
isn't shown anywhere: put it on the ground when the fight starts (the `ring` effect exists), so "don't leave the
arena" is visible.

### I17. A roar into a slam may be unavoidable at close range (Low, S to check)
Roar → slam at under 10 m. Measured from the roar's hit: the stun lasts about 2.0–2.5 s (ring plus 2 s), and the
slam's blade comes down at about 2.5 s (roar end 1.05 + rest 0.2 + slam hit 1.23 at his pace). Close in, that leaves
under half a second to get 3.5 m clear. Worth a scripted test in `creatures.mjs`. If it's tight, delay the follow-up
slam until the stun has worn off by 0.8 s or more.

---

## 3. The first 30 minutes

From the code (the bot doesn't judge pacing):
- **Start:** you pick something up, the owl gives its intro (three cards: trial, crafting, controls), and the house
  is marked: rope, leather, a dagger, a torch. This is good and quick.
- **Minutes 5–15:** a club or dagger, the hammer, the workbench, the campfire, the evening owl card. Roofs need rope,
  and rope runs out early (6 from the chest; 1 leather → 10 at the workbench is the escape hatch, and it's well
  explained).
- **Minutes 15–30:** you're meant to find the temple (no marker until found) and then the olives (no lead, I6).
  Deer hides and olives for the tribute. Hunting deer is too easy (I2), so most of the time goes on walking (the hero
  is a quarter slower since Patch 22) and on olives being once a day per tree.
- **Difficulty curve:** gentle in Pedias. An unfed hero (25 health) dies to three hog blows, but hogs only attack at
  3 m and keep away from your torch, so you're rarely forced to fight. After the first leather set nothing in Pedias
  hurts (I1). The Minotaur is a real step up (well built, telegraphed moves, the storm), then Yleos is easy again in
  Cretan armour, apart from the giants. The curve is flat, then a spike, then flat, then the Chimera; Valheim's is a
  steady staircase.
- **Clarity:** good in the moment (toasts, banners, compass marks once a clue is found), weak between goals (I6, I7)
  and in combat teaching (I5).

## 4. System notes (what works well)
- Hit feedback is strong: weight-scaled screen punch, hit-stop on heavy weapons and kills, damage numbers, hurt
  direction on the screen edge, blood colour per creature, distinct hit sounds.
- Readable enemy blows: the attacker commits a moment before the strike (`COMMIT`), so sidestepping a wind-up works.
  Dryad thorns are slow and glow. The Minotaur's moves all have a tell (ground rings, marks, rock shadows) and a
  tired window. This is the best-crafted part of combat.
- Families (sows and piglets, does and fawns) acting as one, fear of fire, and the torch-shy dryadling give the
  creatures character for little code.
- The death loop (grave with a beam, Zeus's Favour +75% speed for the run back, waking at the bed) is Valheim's and
  works. Its penalty is too light (B9) and the grave needs a map mark (I8).
- Skills: the discovery banners make growth visible. The level curve (16 hits to level 2, about 110 to level 5) is
  sensible; 3% damage a level adds up (level 20 is ×1.57) but takes about 1,700 hits to reach.

---

## 5. Feature ideas (Valheim-inspired)

| # | Idea | Why (Valheim's reasoning) | Effort |
|---|---|---|---|
| F1 | **Item quality levels and workbench extensions** (a tanning rack, a chopping block, a shrine of Hephaestus): upgrade a weapon or armour piece at a better bench with more of its materials | Valheim's main long-term crafting loop. It lets early gear stay relevant and gives every drop (bone, hides, resin) a sink | L |
| F2 | **Raids** ("The ground shakes…" hogs, then dryads from the forest, the dead of the Labyrinth after it's broken) on your base, by days survived and bosses beaten | The reason walls, stakes and fires matter in Valheim, and it turns the base into a place you defend | M–L |
| F3 | **Waystones at Zeus's altars**: pray at one and you can return there from another, or a pair of portal stones made from lightstone | Valheim's portals make a big island walkable. Patch 22 made the hero slower and the island bigger | M |
| F4 | **Comfort**: chairs, rugs, a hearth and banners under a roof raise a comfort level that lengthens Rested (I11) | Turns building from shelter into home | M |
| F5 | **Mead or potions** at a cauldron: dandelion healing mead, moonflower stamina mead, resin fire-resistance | Valheim's meads are the tactical layer of boss preparation. Moonflower and dandelion already lie about unused | M |
| F6 | **Fishing** (a rod from wood, fiber and sharp bone; fish in the shallows) | Cooked fish already exists as food, and a calm activity balances the fighting | M |
| F7 | **Boss rematch and a trophy hall**: summon a beaten boss again and hang its head (or a dryad's or giant's) on your wall for a small aura (+5% damage against its kind nearby) | Valheim trophies turn kills into decoration and a reason to hunt | S–M |
| F8 | **Secondary attacks** (MMB): spear throw, axe overhead (stagger), dagger lunge (I3) | Most of Valheim's weapon identity | M |
| F9 | **Creature taming or herding**: piglets raised in a pen near a fire, for meat and leather | Valheim's boar and wolf taming gives the meadows a farming loop | M–L |
| F10 | **A Yleos dungeon**: one giant cave going deeper, with a hoard, bats and a puzzle door | Valheim's burial chambers and crypts are where exploration pays off | L |
| F11 | **Night-only wonders**: moonflowers that only open at night and only show by torchlight; fireflies that lead to a hidden chest | Valheim rewards going out at night (the Fuling camps, the Bonemass swamp at night) | S–M |
| F12 | **A weather-reading skill** (the owl warns of storms; a "weather vane" piece) | Valheim's rain and cold matter because you plan around them. Pairs with I12 | S |
