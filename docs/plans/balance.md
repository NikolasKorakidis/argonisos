# Balance (Patch 21)

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
  his other moves and his 900 health stay. These are the values before armour; enraged (below half health) every blow of
  his is ×1.15, so the gore is 48–53 then.
- **T11, the Minotaur's dead in waves** (`helpAt: 300`, `Trial.begin` and `Trial.help`). The first wave of two skeletons
  comes 30 s after he drops into the arena, or as soon as he is down to 300 health, whichever is first; each later wave
  30 s after the one before; both at once give one wave. Waves stop when he dies or you flee the arena. The skeletons
  rise at the arena's edge (14 m from its middle), never within 6 m of you. Before, a wave came every 30 s and one came at
  once when he was enraged; his rage no longer calls the dead (the Chimera's still calls the forest at once). 300 health
  is a third of his 900, so a fight that goes fast meets its first wave from the threshold, a slow one from the clock.

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
Two at a time, 30 s apart (T11 unchanged). Risen dead are 0.8 of a skeleton's health (28–44) and 0.6 of its blows
(12–18 slash), each at 0.55–0.75 of its pace (2.5–3.4 m/s, under the hero's run); they rise over 1.5 s, at most two
attack at once with 1.1–2.1 s more between blows, the rest circling 4.5–6.5 m off; none while he charges.

## The storm
A bolt every 2.6–4.2 s (1.5–2.6 enraged) about the arena; 30% of them (45%) within 4 m of you, glowing 1.3 s first:
14–18 to you within 2.8 m, 35 to him, and it destroys his dead.
