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
