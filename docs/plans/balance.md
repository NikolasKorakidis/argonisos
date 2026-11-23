# Balance (Patch 21)

> Status: done. The Patch 21 changes, the Patch 22 Minotaur fight and the Patch 25 changes (the Minotaur's health ×5, the
> deer's health) are in the game; "Noted, not changed" lists what was left.

The team's balance changelog, as built. Tests: `node tests/run.mjs combat` (the "balance sheet" steps at the end of
`tests/suites/combat.mjs`).

## Changes
- **F5, hog health 10–14 → 50–65** (`TYPES.hog.hp`, `src/creatures/creatures.js`). A grown level-0 hog takes 4–5 normal
  hits with the Crude Axe (15 slash, ×1.00 at axe skill 1; hogs have no weakness, resistance or block): 50 → 4 hits,
  65 → 5. Level 1 (×1.25, 62.5–81) takes 5–6, level 2 (×1.5, 75–97.5) 5–7. A piglet (`YOUNG_K` 0.4, 20–26) takes 2. A
  sneak attack (the axe's ×3 backstab, 45) still makes it 2–3.
- **T5, hog: fire until hit** (`fearFire`, `fury`). A hog keeps out of the light of a lit fire within 7 m, and away from
  the torch in your hand. Once you hurt it, it and its whole family (`kin`, as `rouse` already makes them charge
  together) are angered (`c.angered`) and fight on through fire and torch until the fight is over: it calms down, loses
  you, or you die. The held torch counts as a fire for fire-fearing creatures now (`g.torchLit` in `game.js`: a torch in
  the right hand, not while swimming); `build.nearFire` only ever saw placed fires and torches. A creature backing out of
  the firelight no longer strikes on the way.
- **T6, dryadling: shies from the torch once** (`torchShy: 2`). The first time a dryadling in a fight (alert or chasing)
  sees your lit torch within its sight, it backs away for 2 s, then comes on and ignores the torch for the rest of the
  fight (`c.torchSeen`, cleared when it calms down). It still keeps out of a placed fire's light.
- **T7, dryad: no fire fear.** `fearFire` is gone from the dryad; she keeps her weakness to fire (`weak: ['fire']`).
- **M11, the Minotaur's ram 34–42 → 42–46 pierce** (the charge's gore in `trial.js` `runMove`). Only the charge changed;
  his other moves and his 900 health stayed (4500 since Patch 25, below). These are the values before armour; enraged (below half health) every blow of
  his is ×1.15, so the gore is 48–53 then.
- **T11, the Minotaur's dead in waves** (`helpAt: 300`, 1500 since Patch 25, `Trial.begin` and `Trial.help`). The first wave of two skeletons
  comes 30 s after he drops into the arena, or as soon as he is down to 300 health, whichever is first; each later wave
  30 s after the one before; both at once give one wave. Waves stop when he dies or you flee the arena. The skeletons
  rise at the arena's edge (14 m from its middle), never within 6 m of you. Before, a wave came every 30 s and one came at
  once when he was enraged; his rage no longer calls the dead (the Chimera's still calls the forest at once). 300 health
  is a third of his 900, so a fight that goes fast meets its first wave from the threshold, a slow one from the clock.

## Patch 25 (the Greek reviewer)
- **The Minotaur's health ×5: 900 → 4500** (`TYPES.minotaur.hp`, `trial.js`). What is counted in his health went with it:
  the first wave of his dead at **1500** (`helpAt`, a third of him, as 300 was of 900) and Zeus's bolt on him **35 → 175**
  (`TYPES.minotaur.bolt`; the Chimera's stays `STORM.boss` 35). What is a share of him stays: the enrage below half
  (now 2250), the spent ×1.5, the arena's 5%/s healing when he's drawn off, and the stagger (12% of his health inside a
  few seconds, `GIANT.poise`: 540 now, so in practice he no longer staggers from your blows, as the Chimera, 396 of 3300,
  already all but didn't). Moves, blows, rests, spent windows and waves keep their times, so the fight is the same fight
  five times as long.
- **His fight keeps the follow camera.** The boss camera (`player.js` `BOSS_CAM`: drawn back to 13 m, lifted 2.6 m, 8°
  wider) is the Chimera's alone now (`TYPES.chimera.bossCam`); his coming still turns the camera to watch him land
  (`player.focus`) until the arrival is over.
- **The deer's health 10–14 → 50–65** (`TYPES.deer.hp`, `creatures.js`), the hog's since Patch 21 (F5), so a deer takes
  as many blows: with the Crude Axe (15 slash at skill 1; deer have no weakness, resistance or block) **one blow before,
  four or five now** (50 → 4, 65 → 5); a stag (level 1, ×1.25, 62.5–81) 5–6; a fawn (`YOUNG_K` 0.4, 20–26) **one before,
  two now**. The Crude Spear (20 pierce) one before, three or four now; the Crude Bow with a Crude Arrow at full draw
  (40 pierce) one before, two now, and a sneak shot (×3, 120) still one. Behaviour unchanged: a deer still bolts from 18 m.

### How long the Minotaur fight takes now
A rough reckoning for the gear of that point in the game (no lightstone yet: that comes with his tier), at skill 10
(×1.27) with his pierce weakness (×1.5) and his slash and blunt resistance (×0.5):

| weapon | a blow | spent (×1.5) | blows to kill 4500 | before (900) |
|---|---|---|---|---|
| Crude Spear (20 pierce) | 38 | 57 | ~100–120 | ~20–25 |
| Crude Bow + Crude Arrow, full draw (40 pierce) | 76 | 114 | ~45–55 arrows | ~10 |
| Crude Axe (15 slash) | 9.5 | 14 | ~350–400 | ~70–80 |

He gives openings of about 4.5 s every 15–17 s (spent after 2–3 big moves; 3–4 and 2.6–3.2 s enraged) and a little
between moves (his 25% block takes 30 off a blow while he chases, most of a spear's). With a spear that is ~400 damage
a cycle, so **about 3½–4½ minutes** of fighting (11–12 cycles, longer once he's enraged and rests less), plus a wave of
two dead every 30 s (6–8 waves, each ~5 s to put down): **4–5 minutes**, against about a minute before. With the bow and
spear together, about 3–3½ minutes; with an axe alone it's a slog of 10 minutes or more, as his resistance means it to be.
**Watch:** the Crude Spear's durability is 100 and a blow that lands costs 1, so one spear no longer lasts the fight
(100–120 blows): bring two, or the bow (its arrows are what's spent). Not changed here; the team may want the
Minotaur-tier weapons sturdier, or the spent ×1.5 higher (`TYPES.minotaur.tiredK`), if the fight drags in playtests.

## Noted, not changed
- **G9, the Crude Arrow stays 22 pierce.** The bow adds the arrow's damage to its own (`combat.js` `shoot`:
  `(bow.dmg + arrow.dmg) * (0.25 + 0.75 * power)`), so a crude bow (18) with a crude arrow (22) makes 40 pierce at full
  draw. The team's proposed 22 → 10 would bring that to 28.

# The Minotaur fight (Patch 22)

The player: "the Minotaur is moving very unnatural… he charges with full speed, it doesn't make sense, because he's so
big". With the hero a quarter slower (run 3.45 m/s, sprint 5.7), the fight was rebuilt for a giant against a small hero.
Numbers in `trial.js` (`MOVE`, `STORM`, `TYPES.minotaur`) and `creatures.js` (`GIANT`, `TYPES.skeleton.risen`).

## What was broken
- **A leg hanging in the air.** `plantFeet` (models.js) put every animation binding back each frame before the foot IK,
  the idle ones too, whose buffers still held a pose from a clip long finished (his charge): standing, one leg hung a
  couple of metres up. Only the bindings a playing clip drives are put back now.
- **Clips that moved him.** RamStart drew his hips three of his metres (ten in the game) back and snapped them home;
  RamWall was posed five metres ahead of him, so he lurched forward as he hit a wall; the skeleton's walk carried it a
  stride and a half forward and back each cycle. The clips are put back in place as they load (`KIT.fix`).
- **Sliding feet.** The walk was played for 1.85 m/s at his scale where its stride covers 1.32 (feet sliding 40%), the
  run for 5.75 where it covers 4.4. Measured again, and his planted feet are now held where they come down (`FootIK` lock).
- **Spinning on the spot.** He turned towards you at any rate, half a turn in a fraction of a second; he gathered speed
  and stopped in a moment; the charge was 17–19 m/s with a snapped heading; unstuck, he teleported 2 m; every blow made
  him flinch. Now: 0.65 rad/s turning walking, 0.85 standing (stepping round), an arc for a sharp turn, 2 m/s² to
  speed up and 5 to stop, a shove over half a second, and a stagger only for 12% of his health inside a few seconds.

## His moves
| move | wind-up | what it does | dodge |
|---|---|---|---|
| walk | — | 4.5 m/s (was 7): gains on a running hero, a sprinting one gets away | — |
| roar | 0.85 s (its reach shown on the ground) | shockwave to 16 m, **stunned 2 s** | out of reach, or a wall between |
| charge | 1.3 s pawing (1.0 enraged) | 5.5 m/s² to 11 m/s (12.5 enraged); turns 0.6 → 0.12 rad/s as he speeds up; gore 42–46 pierce (M11) | step aside late; roll |
| slam | 1.24 s, glow where it bites | 30–38 blunt within 3.5 m, falling to a quarter at 13 m | out of the wave, or jump it |
| sweep | 1.55 s | 24–30 slash, 9 m in front, ±63° | roll back, or crouch under |
| throw | 0.6 s, rock in his hand | 24–34 blunt, its shadow where it lands | step off the shadow |
| spent | after 2–3 big moves (3–4 enraged), or a charge into a wall | stands 4–5 s (2.6–3.2 enraged; 4.5/3.5 after a wall), **takes ×1.5**, then bellows you back 10 m | — |

Between moves he rests 1.1–1.8 s (0.5–0.9 enraged); a roar leads into a charge (or a slam if you're close), and
enraged a slam often into a sweep. A roar never comes with a bolt at you: none fall near you while you're stunned.

## His dead
Two at a time, 30 s apart (T11 unchanged; the first sooner at 1500 health since Patch 25). Risen dead are 0.8 of a skeleton's health (28–44) and 0.6 of its blows
(12–18 slash), each at 0.55–0.75 of its pace (2.5–3.4 m/s, under the hero's run); they rise over 1.5 s, at most two
attack at once with 1.1–2.1 s more between blows, the rest circling 4.5–6.5 m off; none while he charges.

## The storm
A bolt every 2.6–4.2 s (1.5–2.6 enraged) about the arena; 30% of them (45%) within 4 m of you, glowing 1.3 s first:
14–18 to you within 2.8 m, 35 to him (175 since Patch 25, for his ×5 health), and it destroys his dead.
