# Sound and music (Patch 21)

The team's audio (`incoming assets/audio/`, git-ignored) and where each file plays. Conversion: `node tools/assets/sounds.mjs`
(manifest `sounds`, `soundGroups`, `music`) into `assets/sounds/pack/` (git-ignored; backed up by `tools/assets/backup.mjs`,
music in `music/`). Playback: `src/audio/sound.js` (effects and ambience), `src/audio/music.js` (the music director). Tests:
`node tests/run.mjs audio`.

## How it's converted
- One-shots: mono MP3 96 kb/s, trailing silence trimmed, each brought to its group's loudness by its loudest moment
  (EBU R128 momentary): combat and gathering -16 LUFS, voice and building -17, fire and the trial's chime -18, owl -19,
  the pickup and gusts -20, bosses -13, thunder -14. Several blows in one file (`pickaxe-stone-many`, `arrow-fly-many`,
  `arrow-hit-target-many`) are cut into one variant per blow (`slice`).
- Beds: looped, -24 LUFS integrated, stereo (112 kb/s) except the fire and the roof (mono). The seam is the bed's own
  continuation crossfaded (equal power, 2.5 s) over its start; long recordings give 40 or 45 s of themselves. Chrome
  decodes the MP3s without encoder padding, so the loops are gapless.
- Music: stereo MP3 144 kb/s, -18 LUFS integrated (two-pass loudnorm, linear). Streamed from an `<audio>` element when
  first played, never loaded at start.

## Effects (sound.js `SFX`)
Every one-shot picks a variant at random (never the last one), ±5% pitch, ±10% volume. Sounds with a place (`at`) pan by
direction from the camera and fall away with distance (their highs first); indoors, far ones are muffled.

| Key | Files | Moment |
| --- | --- | --- |
| swordHit | sword-hit-1..5 | a blade (dagger, spear, the Chimera's claws) landing on a creature |
| axeHit | axe-hit-flesh-1..2 | an axe landing on a creature |
| hitPlant | hit-plant-1..3 | striking a bush (with or without an axe) |
| hurtMale | hurt-1..3 | the hero hurt, when the hero is a man |
| deathMale | male-death-1 | the hero's death, when a man |
| blockHit, parryHit | block-1..2, parry-1..3 | a blow blocked; a parry |
| drawWeapon | draw-weapon-1 | equipping a weapon or tool; lower and softer, putting it away |
| bowStretch | bow-stretch | drawing the bow |
| arrowRelease, arrowFly | arrow-release-1, arrow-fly-many (5 cut) | loosing an arrow, then its flight |
| arrowFlesh, arrowWood | arrow-hit-target-1..2 and -many (3 cut), arrow-hit-wood-1 | an arrow into a creature; into a trunk, log or wall |
| slamHit | slam-1..2 | the giant's and the Minotaur's blows, the labrys slam, the charge into a wall, the Chimera's pounce landing |
| enemyAlert | enemy-alert-1..2 | a hostile creature noticing you (at most once every 4 s; animals don't cry) |
| hitTree | hit-tree-01..03 | an axe in a tree, a log, a stump or dead wood |
| fallingTree | falling-tree | a felled tree landing (from just before the crash, where its crown lands) |
| mineHit | pickaxe-stone-many (11 cut) | each pickaxe blow on rock |
| pickupItem | pickup-item | picking up, picking fruit, loot walked over |
| buildPiece, breakPiece, repairPiece, craftItem | build-1..2, break-1, repair-1, craft-1 | placing; removing or a piece collapsing; repairing; crafting |
| doorOpen, doorClose | door-1, door-2 | a door opening, closing |
| chestOpen, chestClose | chest-2, chest-1 | a chest (or the house's old chest) opening; closing |
| fireStart | campfire-start-1..2 | lighting a campfire or torch; laying a campfire (lit as it's laid) |
| fireDouse | campfire-douse-1..2 | putting a fire out (F), the rain putting it out |
| bossRoar, bossRoarLong | boss-roar-1 (4.2 s; whole) | the Minotaur's war cry, his charge, the Chimera's pounce, the hero's Minotaur's Roar; the full roar as a boss appears and when enraged |
| bossSummon | boss-summon | laying a tribute |
| boulder | boulder-2..3 | the Minotaur tearing up a rock, and where it lands |
| revealChime | reveal-1..2 | a clue's map complete, the Olympos altar, the top of Olympos, a head offered |
| owlHoot | owl-hoot-1..3 | the owl arriving and talking; owls far off at night |
| thunderClap | thunder-clap-items-burst | a strike within 260 m; a creature's body vanishing (small, where it lay) |
| thunderNear | thunder-1..2 | a strike 260-900 m off (and after the clap of a close one); Zeus's blessing, the offering |
| thunderFar | thunder-3, -5, -6 | a strike further off (the storm wall's, mostly), slowed and darkened |
| windGust, leafRustle | wind-gust-1..2, leaves-rustle-2..3 | on the wind's gusts, from upwind; leaves rustle after it in the woods |

The first packs' sounds stay where nothing new replaces them: footsteps and landings, the giant's growl, the Chimera's
fire, the fox. The rest of them (rain, birds, crickets, thunder, door, chest creak, stone hit, foliage) are the
fallback, played only if the team's files are missing; without any pack, everything is synthesised as before. Still
synthesised: the jump, the creak of a tree starting to fall, the wrong tool's clink, blunt hits (club, fist, kick), the
kill, the dryads' thorns, the guide's and the grave's little chime (the lyre's rising notes).

## Ambience (sound.js `updateAmbience`, beds faded every frame)
| Bed | Files | When |
| --- | --- | --- |
| bedWindSoft / Mid / Strong | wind-1..2 / wind-4 / wind-3, wind-5 | by the wind's strength (wind.js), each swelling with the gusts |
| bedGrass | wind-soft-grass | open Pedias meadow (less where trees stand) |
| bedLeaves | leaves-rustle-1 | wherever trees stand round you |
| bedBirds | birdsong-1..2 | by day, not in rain or the marsh |
| bedCricketsP, bedCricketsY | pedias-crickets-night-1..2, yleos-crickets-night-1..2 | from dusk, by the land you're in; less deep in the trees |
| bedFrogs | swamps-ambience-frogs-1..2 | near the marsh, louder by night and in rain |
| bedWaves | waves-shore-1..2 | by how much sea is round you |
| bedDrops / bedRain | rain-droplets / rain-downpour | light rain / heavy rain, outdoors |
| bedRoof / bedMuffled | rain-on-roof / rain-muffled | under a roof / under a roof with walls round you (or in a cave) |
| bedFire | campfire-ongoing-1..2 | each lit fire within 25 m (the nearest three: yours, torches, the temple's and the caves'), from where it burns |

The storm wall's roar is as before (its synthesised rumble and the first pack's storm loop near it). Beds load the first
time they're wanted and are let go of after 25 s silent, so only what's audible sits in memory.

## Music (music.js)
- Title screen and character creator: menu (Main-Menu), looped.
- A new trial begins: story (Story-Telling); again for the owl's first talk, unless it's still playing or just ended.
- Coming into a land (20 s after you're well inside it), and at dawn and dusk: pedias, yleos, or swamp (Valtos, behind
  the storm). Only when nothing plays and the quiet is over: after a track ends, 3 to 6 minutes of no music. The same
  recording never twice running unless 10 minutes have passed.
- Home (Inside-Base): 8 s by your own lit fire (within 5 m, sitting or not) or under your own roof, if it hasn't played
  for 4 minutes and nothing has for 45 s; fades as you leave. A minute or two of quiet follows.
- Bosses: bossMinotaur, bossChimera from the tribute until the boss dies or you flee, looped; then the quiet.
- Crossfades of 3 s (loops crossfade into a fresh start of themselves); the music dips under loud thunder.
- Not played (places not in the game yet): oros, sailing, nisia, sirenReef, acheron, erebos.

## The mix (tests/suites/audio.mjs, K-weighted meters, LUFS)
At the default sliders: a calm meadow's ambience about -29, a forest at night -29, a downpour about -27, a land's track
about 3-4 LU over the ambience, the blows of a fight peaking about 10 LU over it, the output -22 to -29, never clipping.

## Odd files
- Byte-identical pairs: `arrow-fly-1` = `arrow-release-1`, `seathe-weapon-1` = `sword-hit-1`, `boulder-1` = `slam-1`,
  `WEATHER/arrow-hit-target-1` = `COMBAT/arrow-hit-target-1`. `thunder-4` is `thunder-2` 25 ms later. Each is used once.
- Music: `Main-Menu` and `Yleos` are the same file ("Track 5"), as are `Story-Telling`, `Swamp` and `Acheron` ("Track 1").
- Missing: a woman's hurt and death, a sheathing, jump and landing grunts, breathing when tired, a tree's creak, blunt
  hits.
