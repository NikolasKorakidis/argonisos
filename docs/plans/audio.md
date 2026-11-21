# Sound and music (Patch 21, mix and coverage reworked in Patch 23)

The team's audio (`incoming assets/audio/`, git-ignored) and where each file plays. Conversion: `node tools/assets/sounds.mjs`
(manifest `sounds`, `soundGroups`, `music`) into `assets/sounds/pack/` (git-ignored; backed up by `tools/assets/backup.mjs`,
music in `music/`); `node tools/assets/sounds.mjs --report` prints every converted file's loudest moment and true peak
against its group. Playback: `src/audio/sound.js` (effects and ambience), `src/audio/music.js` (the music director, and
what it tells sound.js about where you are: `PLACE`). Tests: `node tests/run.mjs audio`.

## How it's converted
- One-shots: mono MP3 96 kb/s, trailing silence trimmed, each brought to its group's loudness by its loudest moment
  (EBU R128 momentary): combat and gathering -16 LUFS, voice and building -17, fire and the trial's chime -18, owl -19,
  the pickup and gusts -20, bosses -13, thunder -14, creatures' calls -16; from the first packs, footsteps -25 (wood -23),
  landings and swim strokes -22, the roll -21, the swing's whoosh and the bell -20. Several blows in one file
  (`pickaxe-stone-many`, `arrow-fly-many`, `arrow-hit-target-many`) are cut into one variant per blow (`slice`).
- Patch 23: no one-shot is pushed hard into a limiter any more (before, the gain to the target ran into
  `alimiter`, flattening the transients and leaving variants of one sound up to 5 LU apart). Each variant may be limited
  by 3 dB at most past the point its true peak reaches -1 dBTP, and all a key's variants meet at one level: the group's,
  or what the peakiest allows. Keys left short (the pickaxe's clicks, the bowstring, the arrows, the blocks) are made up
  with their `vol` in `SFX`, where the master limiter works on the whole mix. The first packs' other one-shots (door,
  creak, brick, growl, fire burst, thunder, foliage, fox) keep their own level and are only brought down where they'd clip.
- The footsteps and landings are matched per variant by their loudest moment (they were matched by mean volume, which
  left wood 5 dB under grass and variants of one set 5 dB apart).
- Beds: looped, -24 LUFS integrated, stereo (112 kb/s) except the fire and the roof (mono). The seam is the bed's own
  continuation crossfaded (equal power, 2.5 s) over its start; long recordings give 40 or 45 s of themselves. Chrome
  decodes the MP3s without encoder padding, so the loops are gapless.
- Music: stereo MP3 144 kb/s, -18 LUFS integrated (two-pass loudnorm, linear). Streamed from an `<audio>` element when
  first played, never loaded at start. The looped tracks (`loop: true`: menu, bossMinotaur, bossChimera) get loop points:
  the end and start where the music after each sounds most alike (three bands' loudness over 1 s before and 4 s after,
  coarse then fine, then lined up to the sample by the waveform), the end crossfaded (0.25 s) into the music just before
  the start. Found: menu 11.1 → 47.1 s of 60, bossMinotaur 63.2 → 144.1 s of 174.6, bossChimera 59.6 → 142.3 s of 183.
  Worth a listen by someone with a musician's ear; a marked loop point from the composer would beat any search.

## Effects (sound.js `SFX`)
Every one-shot picks a variant at random (never the last one), ±5% pitch, ±10% volume. Sounds with a place (`at`) pan by
direction from the camera and fall away with distance (their highs first, a quarter more of them from behind you);
indoors, far ones are muffled. A sound longer than 2 s with a place follows it while it plays (its pan, loudness and
lowpass refreshed each frame from `spatial`): a boss's roar as he walks round you, a tree falling as you turn.

| Key | Files | Moment |
| --- | --- | --- |
| swordHit | sword-hit-1..5 | a blade (dagger, spear, the Chimera's claws) landing on a creature |
| axeHit | axe-hit-flesh-1..2 | an axe landing on a creature |
| hitPlant | hit-plant-1..3 | striking a bush; layered into a blow on a dryad, a thorn striking |
| hurtMale | hurt-1..3 | the hero hurt, when the hero is a man |
| deathMale | male-death-1 | the hero's death, when a man |
| blockHit, parryHit | block-1..2, parry-1..3 | a blow blocked; a parry; slowed, a blunt blow (mace, club, fist, kick) and a guard breaking; high, a blow on bone |
| drawWeapon | draw-weapon-1 | equipping a weapon or tool; lower and softer, putting it away |
| bowStretch | bow-stretch | drawing the bow |
| arrowRelease, arrowFly | arrow-release-1, arrow-fly-many (5 cut) | loosing an arrow, then its flight |
| arrowFlesh, arrowWood | arrow-hit-target-1..2 and -many (3 cut), arrow-hit-wood-1 | an arrow into a creature; into a trunk, log or wall; slowed and darkened, into the ground |
| slamHit | slam-1..2 | the giant's and the Minotaur's blows, the labrys slam, the charge into a wall, the Chimera's pounce landing, a hoof's scrape in the snort |
| enemyAlert | enemy-alert-1..2 | a dryad (high), a dryadling (higher) or a skeleton (low, its bones rattling) noticing you, cut to 3.2 s |
| hitTree | hit-tree-01..03 | an axe in a tree, a log, a stump or dead wood; a blow on a dryad; slowed and dark, the wrong tool on wood, a log's crack, a piece struck |
| fallingTree | falling-tree | a felled tree landing (from just before the crash, where its crown lands) |
| mineHit | pickaxe-stone-many (11 cut) | each pickaxe blow on rock |
| pickupItem | pickup-item | picking up, picking fruit, loot walked over |
| buildPiece, breakPiece, repairPiece, craftItem | build-1..2, break-1, repair-1, craft-1 | placing; removing or a piece collapsing; repairing; crafting |
| doorOpen, doorClose | door-1, door-2 | a door opening, closing |
| chestOpen, chestClose | chest-2, chest-1 | a chest (or the house's old chest) opening; closing |
| fireStart | campfire-start-1..2 | lighting a campfire or torch; laying a campfire (lit as it's laid) |
| fireDouse | campfire-douse-1..2 | putting a fire out (F), the rain putting it out |
| bossRoar, bossRoarLong | boss-roar-1 (4.2 s; whole) | the Minotaur's war cry, his charge, the Chimera's pounce, the hero's Minotaur's Roar; the full roar as a boss appears and when enraged; slowed and dying away, a boss's death |
| bossSummon | boss-summon | laying a tribute |
| boulder | boulder-2..3 | the Minotaur tearing up a rock, where it lands, a wall falling, a boss's body coming down |
| revealChime | reveal-1..2 | a clue's map complete, the Olympos altar, the top of Olympos, a head offered |
| owlHoot | owl-hoot-1..3 | the owl arriving and talking; owls far off at night |
| thunderClap | thunder-clap-items-burst | a strike within 260 m; a creature's body vanishing (small, where it lay, on the effects bus) |
| thunderNear | thunder-1..2 | a strike 260-900 m off (and after the clap of a close one); Zeus's blessing, the offering |
| thunderFar | thunder-3, -5, -6 | a strike further off (the storm wall's, mostly), slowed and darkened |
| windGust, leafRustle | wind-gust-1..2, leaves-rustle-2..3 | on the wind's gusts, from upwind; leaves rustle after it in the woods |

From the first packs (Footsteps - Essentials, Classic Footstep SFX, 96 General Library):

| Key | Moment |
| --- | --- |
| stepGrass, stepDirt, stepRock, stepWood, stepWater, stepLeaves, stepSand | footsteps by ground; the meadow's grass or bare earth by patches of 7 m (not at random each step); louder sprinting (×1.3), softer sneaking (×0.5) |
| stepSnow, stepMud | Olympos's snow (above `PEAK.snow`), the marsh's mud (Valtos) |
| landGrass, landRock, landWood, landWater, landSand, landSnow, landMud | landings, louder and lower the harder the fall (×0.6 for a hop to ×1.6), a thud under a long drop; slowed, a creature's body falling (its kill), heavier for a giant |
| roll | the dodge roll: the body and cloth going over in tall grass, then a landing and a step |
| swimStroke | a stroke each 1.5 m swum, slowed |
| whoosh | every swing (a miss too), by the weapon's weight (fists and daggers quick, maces slow); a creature's blow just before it lands (a giant's or a boss's slow and heavy); a dryad's thorn leaving her hand |
| growl | a hog's cry (sped up); the giant's call under its own; slowed, the Minotaur's snort |
| giantCall | a giant noticing you and coming on (a gorilla, slowed) |
| bell | the skill banner's bell (a hand bell's high C, pitched to each note) |
| stoneHit | the wrong tool on rock, high and short |
| fireBurst, foxCry | the Chimera's fire; a fox far off |

Still synthesised: the jump, the creak of a tree starting to fall, the dryads' thorns (now some 10 dB up), the Minotaur's
pant, snort (15 dB up, with the growl in it), charge and the storm's zap, the skeletons' bones (rising, rattling 20 dB
up and broad, falling apart), the guide's and the grave's little chime (the lyre's rising notes, now on the effects bus,
so it's heard with the music off), the food done on a cooking stand (`cooked`: heard across the camp now, 14 grains not
34) and its sizzle while it cooks, eating (bites and a chew, crisper for fruit), the pack (a leather flap), the map
(parchment) and the build menu (a wooden knock from `hitTree`), the log's thud and rumble.

### Moved into sound.js (Patch 23)
- The rolling logs' sounds (harvest.js built its own WebAudio graph straight into the master, past the limiter, the
  sliders' buses, the reverb and the tests): now `logThud` (a deep wooden thud, `hitTree` slowed for the crack of a hard
  one) and a live voice, `voice('logRumble')`: `{ set(at, k, big), stop() }`, its gain, brightness and pan following
  the log, kept through a bounce for 0.3 s. Both are logged.
- A creature's body vanishing in its thunderclap is on the effects bus (it was on the ambience's slider).

## Ambience (sound.js `updateAmbience`, beds faded every frame)
| Bed | Files | When |
| --- | --- | --- |
| bedWindSoft / Mid / Strong | wind-1..2 / wind-4 / wind-3, wind-5 | by the wind's strength (wind.js), each swelling with the gusts; half as loud in fog; high on Olympos (200-330 m up) the mid and strong winds and a thin whistle come in |
| bedGrass | wind-soft-grass | open Pedias meadow (less where trees stand), not high on Olympos |
| bedLeaves | leaves-rustle-1 | wherever trees stand round you |
| bedBirds | birdsong-1..2 | by day, rising with the light (no step at dusk), 40% louder in the first hour of sunrise; hushed by fog and the marsh; none on Olympos's head |
| loopBirds | the first pack's dawn chorus | over the birdsong at sunrise (`PLACE.morning`: the sun climbing) |
| bedCricketsP, bedCricketsY | pedias-crickets-night-1..2, yleos-crickets-night-1..2 | from dusk (not at dawn), by the land you're in; less deep in the trees |
| bedFrogs | swamps-ambience-frogs-1..2 | near the marsh, louder by night and in rain |
| bedWaves | waves-shore-1..2 | by how much sea is round you |
| bedDrops / bedRain | rain-droplets / rain-downpour | light rain / heavy rain, outdoors |
| bedRoof / bedMuffled | rain-on-roof / rain-muffled | under a roof / under a roof with walls round you (or in a cave) |
| bedFire | campfire-ongoing-1..2 | each lit fire within 25 m (the nearest three), from where it burns; its variant by a hash of its id (every site fire was variant 1, the 7.5 s loop) and heard from further (full within 2 m, gone by 30 m, not 25) |

- A bed under 30 s long (the leaves 8.9 s, the winds 11-17 s, the frogs 19.6 s, a fire's 7.5 s) plays as two copies, its
  other recording where it has one, at random places in them and 3% apart in pace, each at -3 dB: their sum never
  repeats in step, so the loop isn't heard.
- The synthesised beds (the wind's rumble and whistle, the leaves' hiss, the synthesised rain, roof, sea, fire, the storm
  wall's roar) are made when first wanted and stopped and let go of after 10 s silent: none runs for nothing.
- Indoors and in caves the world outside is muffled (a lowpass on the ambience: 1.2 kHz with walls round you, 2.5 kHz
  under a roof only); the fires near you, the roof's drumming and the rain through the walls are not. The reverb is two
  (`verb` is their send): the open air's soft 2.8 s hall, and a stone hall (3.4 s, brighter, with early reflections),
  blended by place: a cave fully, the labyrinth's walls (within 24 m of it) 85%, a house's room 40%. Every send is
  wetter in a room, and the dry sounds (the steps) get a little of it.
- The storm wall's roar is as before (its synthesised rumble and the first pack's storm loop near it).

## Music (music.js)
- Title screen and character creator: menu (Main-Menu), looped between its loop points (the intro plays once).
- A new trial begins: story (Story-Telling); again for the owl's first talk, unless it's still playing or just ended.
- Coming into a place (20 s after you're well inside it; 8 s for a cave), and at dawn and dusk: pedias, yleos, or swamp
  (Valtos, behind the storm); oros on the climb up Olympos (above 150 m on its flanks); erebos in the Giants' caves, and
  for a land come into by night; on the shore at dawn and dusk (sea a third of the way round you), nisia and sirenReef in turn. Only
  when nothing plays and the quiet is over: after a track ends, 3 to 6 minutes of no music. The same recording never
  twice running unless 10 minutes have passed.
- Home (Inside-Base): 8 s by your own lit fire (within 5 m, sitting or not) or under your own roof, if it hasn't played
  for 4 minutes and nothing has for 45 s; fades as you leave. A minute or two of quiet follows.
- Bosses: bossMinotaur, bossChimera from the tribute until the boss dies or you flee, looped between their loop points
  (decoded whole when the tribute is laid: about 60 MB while a fight lasts, let go of as it ends); then the quiet.
- Crossfades of 3 s; the music dips under loud thunder and the bosses' big warnings.
- Not played: sailing, acheron (no sailing or underworld yet).

## Boss fights (the giants, Patch 21; the mix reworked in Patch 23)
The bosses are giants, and sound it. Every boss sound goes through the effects bus (its slider), layered with a synthesised
sub boom (`sub` in sound.js: a sine falling from 50-80 Hz to 20-35 Hz with a brown-noise rumble, placed and faded like
the recording it goes with):
- Roars (`roar` with `boss`): `bossRoar`/`bossRoarLong` slowed to 0.78-0.85 (heard to 240 m) over a 2-3.4 s boom, the
  music dipping some 3 dB under them.
- Footsteps (`giantStep`, from each foot the body brings down: models.js `footfalls`): `landRock` at 0.4-0.48 over a short
  thud; the camera trembles with each near you.
- Slams, the charge into a wall, the pounce, the claws and sting landing (`slam` with `big`): `slamHit` at 0.7-0.78 over a
  boom, grit pattering down after (`rattle`); the camera kicks hard.
- A boss's blow landing on you (`bossHit`): `slamHit` sped up a little over a short, hard boom, under the hurt cry.
- The Chimera's fire (`breath`): `fireBurst` at 0.6-0.68 with the lion's roar in it and the fire's own roar for its length.
- The arrival: the ground's rumble rising for three seconds (`quake`), then the blast as it lands (`blast`: `thunderClap`
  and `slamHit` slowed, the deepest boom, stones raining down), and each wall and column falling (`collapse`: `boulder`
  slowed over a boom).
- The warnings: the snort before the charge (15 dB up, the first pack's growl slowed in it and a hoof's scrape, the music
  dipping 3 dB for a second), the skeletons' rattle (20 dB up), the dryads' thorns (10 dB up).
- Its death (`kill` with `boss`, `bossDeath`): the long roar slowed to 0.66-0.72 and dying away, a long boom, then 2.4 s
  later the body coming down (`collapse`, a deep boom, stones), the music hushed for it.
- Patch 23: the boss layer some 4 dB under what it was (slams, roars, the blast, the fire, his blows on you); the sub
  booms carry the weight.

## The mix (Patch 23)
- Buses: effects (`sfxBus`, 0.9 × slider) → a gentle glue compressor (-20 dB, 2.5:1, knee 8) → its makeup gain divided
  out (Chrome's compressor adds one that can't be turned off: measured offline at start and divided out); ambience
  (`ambBus`: the world's beds through `ambW`, the indoor lowpass); the lyre (`musicBus`); the recorded music (`recBus` →
  the duck → the fight's gain). The music and the beds no longer go through any compressor, so nothing pumps under the
  blows.
- Then one `LEVEL` (2.2, +6.8 dB) for everything: what the old shared compressor and limiter added by their hidden makeup
  gain, now in sight, so the world outside a fight is as loud as it was. Then the master: a true brickwall at -1 dBFS,
  a lookahead peak limiter in an AudioWorklet (5 ms lookahead, the gain held and averaged over it, about 120 ms release;
  made from a Blob URL in sound.js), with Chrome's compressor as a limiter (its makeup divided out) until it loads.
- In a boss fight (`setFight`): the music ×1.6 (+4 dB; it was ×3.6, +11 dB), the ambience ×0.22 (-13 dB) and the effects ×0.36
  (-9 dB, their reverb sends with them), the music dipping under thunder only 15% as much as usual. So the music is the
  loudest thing in the fight and level with the blows (the boss's own sounds are also some 4 dB under what they were).
- The reverb sends go through their bus's own send (`sfxSend`, `ambSend`), so the sliders and the fight's mix turn the
  echo down with the sound (they used to bypass the sliders).
- The duck (`duck`) keeps every dip asked for and schedules the gain afresh from them, each moment the deepest of those
  under way: a near strike asked for after a far one no longer wipes out the far one's dip (it used to cancel it).

Measured (`AUDIO.meters()`, K-weighted, about 0.37 s window, LUFS; mean / loudest moment / peak dBFS):

| Scene | Before (Patch 22) | After (Patch 23) |
| --- | --- | --- |
| meadow, day: ambience / output | -30.9 / -26.0 | -31.0 / -26.1 |
| meadow, a land's track: music / ambience / output | -25.7 / -32.3 / -19.9 | -25.5 / -28.9 / -19.0 |
| a fight with a hog: effects (top) / output | -28.2 (-22.2) / -21.8 | -24.2 (-20.4) / -18.4 (the swings' whooshes, the hog's own) |
| the Minotaur fight, striking at him: output | -10.6 (top -9.2, peak -3.4) | -14.9 (top -10.5, peak -3.1) |
| … music / ambience / effects (top) | -14.0 / -22.5 / -17.2 (-9.5) | -23.4 / -31.6 / -23.4 (-16.3) |

(Before: 20 s of the fight from 6 s after he landed; after: the suite's 10 s from 3 s after, his walls still falling. The
music meter is the recorded music after the fight's gain, the effects' after their glue compressor.) The suite checks the
fight: the music over the ambience by 3 LU or more and no more than 3 LU under the effects, the output -14 to -21 LUFS,
the peak under -0.5 dBFS.

Each alone, its loudest moment on the effects bus (LUFS, outside a fight), before → after:

| Sound | Before | After |
| --- | --- | --- |
| the Minotaur's snort at 15 m | -37.8 | -17.1 |
| a skeleton's bones rattling at 4 m | -63.7 | about -32 |
| a dryad's thorn thrown / striking | -40.3 / -28.6 | -27.1 / -26.6 |
| a blunt blow (mace, club, fist) | -36.9 | -22.9 (an axe's: -21.9) |
| the wrong tool on rock / on wood | -45.3 / -40.8 | -31.2 / -29.6 |
| an arrow into the ground | -49.9 | -26.9 |
| a creature killed, 5 m off | -34.3 (in your ear) | -28.5 (placed) |
| a pickaxe blow / an axe in a tree | -25.3 / -23.4 | about -27 / -24.1 |
| a big slam at 15 m / a boss roar at 20 m / the arrival's blast at 30 m | -11.0 / -10.6 / -6.5 | -17.1 / -17.5 / -15.8 (and ×0.36 more in the fight) |
| a boss's blow on you | -11.6 | -17.6 |
| a swing / a roll / eating / the pack opening / the guard breaking | silent | -28.1 / -29.6 / -26.9 / about -33 / -19.1 |

## Odd files
- Byte-identical pairs: `arrow-fly-1` = `arrow-release-1`, `seathe-weapon-1` = `sword-hit-1`, `boulder-1` = `slam-1`,
  `WEATHER/arrow-hit-target-1` = `COMBAT/arrow-hit-target-1`. `thunder-4` is `thunder-2` 25 ms later. Each is used once.
- Music: `Main-Menu` and `Yleos` are the same file ("Track 5"), as are `Story-Telling`, `Swamp` and `Acheron` ("Track 1"):
  coming into the forest plays the title's tune, and Valtos the opening's. **For the team: Yleos and Valtos need tracks
  of their own.**
- `bedFrogs`' two recordings are both exactly 19.573 s long: check they aren't one take.
- `loopStorm` (the first pack's storm, near the wall) has thunder of its own baked in, with no lightning to go with it.

## Recordings the team should source
Listed by how much each would improve the game. WAV at 48 kHz/24-bit, dry (no reverb), a few frames of silence before
and after, 4 to 6 variants for anything repeated. Beds at least 60 to 90 s with no obvious events. (Stand-ins in brackets.)

For the player (most often heard):
1. Weapon swings: light (dagger), medium (axe, spear) and heavy (mace, club); 5 each. (The first pack's bamboo whoosh.)
2. Blunt impacts on flesh: club, mace, fist, kick; 5 each. (The block slowed over a thud.)
3. A woman's voice: hurt (5), death (2), effort grunts for jumping and attacking (4), tired breathing (2). (A thud.)
4. A man's jump and land grunts (4) and tired breathing (2).
5. More pickup variants (4 or 5: soft cloth and leather, a light rattle) and a "loot into the pack" tick.
6. Eating (a crunch or chew for fruit, a bite of meat; 3 each) and drinking (2). (Synthesised bites.)
7. Sheathing a blade (2), stowing a tool (2), putting on armour: cloth and leather (2), bronze (2).
8. Armour movement foley: bronze plates clinking, as a step layer and when rolling.
9. A roll or dodge: body and cloth on the ground (3). (Tall-grass foley.)
10. Swimming: strokes (4), entering water with a splash (2), climbing out dripping (1). (Wading steps, slowed.)
11. Louder, more hollow wooden-floor steps (6).
12. UI: opening and closing the pack (leather bag), the map (parchment), the build menu; a hotbar tick; moving an item; an
    error knock. (Synthesised.)
13. A torch held in the hand: a burning loop (30 s+) and a whoosh as you swing it.

Creatures (each has a pitched stand-in now):
14. Hog: grunts as idle calls (5), squeal for alert and charge (3), hurt (3), death (2), footsteps (4).
15. Deer: alarm bark or snort (3), hooves bolting (4), hurt and death (2). Fox: alert yip (2), hurt (2). Rabbit: a thump and
    a squeak (2).
16. Dryad and dryadling: a wooden creak or whisper voice for alert (3), hurt (3), death (2); a leafy whoosh for the thorn
    throw (3); a wood-and-leaf burst when it hits (3).
17. Skeleton: a bone-rattle walk loop (10 s), bone hits (4), collapse (2), a dry jaw clatter for alert (2).
18. Giant: a growl or alert of its own (3), hurt (3), death fall (1). (A gorilla, slowed.)
19. Hits by material: an axe or blade on bone (4), on wood (4).

Bosses:
20. A bull's breath and snort: a heavy snort before the charge (3), a long tired pant (3), a hoof scrape or ground pawing (3).
21. A Minotaur death: a dying bellow (1 or 2) and the body falling (1). A Chimera death (1).
22. A second boss roar (the war cry and the long cry are one file now), and a Chimera roar of its own.
23. Electric crackle building up for the boss's lightning (`zap`; 2 to 3 s, 3 variants).
24. Skeletons rising: earth breaking, bones scraping (2).
25. A victory sting when a boss falls (music, 5 to 8 s).

World and ambience:
26. Cicadas by day (the meadows' midday bed, 60 s+): the most Greek sound missing.
27. Forest birds distinct from the meadow's, separate bird calls as one-shots (10 to 15), a dawn chorus of the island's own.
28. Longer beds (60 to 90 s): leaves in the wind (8.9 s now), soft and mid wind (11 to 14 s), strong wind, frogs (19.6 s),
    grass (25 s), a campfire (one variant is 7.5 s).
29. The storm wall: a vast roaring gale with sheets of rain, without thunder in it; a near bed and a distant one.
30. Mountain wind at altitude for Olympos, and an eagle or kite call (3).
31. A cave bed: drips, a low room tone, a distant wind moan (60 s), and drip one-shots (6).
32. Fog: a damp, muffled bed with drips from leaves (60 s). Trees dripping after rain (60 s).
33. Rain on leaves in the forest (60 s); rain on thatch.
34. Creaking timber: a tree starting to fall (3); a log rolling (loop, 10 s) and log thuds (4).
35. Cooking: meat on a hot grill, a sizzle loop (20 s) and "done" (spit and steam, 3).
36. A skill bell: two or three soft bell notes, and a variant for a level up. (The first pack's hand bell.)
37. Building by material: thatch (3), wood (3, the current pair), stone (3); a whole-structure collapse (2); a wall damaged (3).
38. Crafting by station: workbench sawing and hammering (3), cooking stand (2), forge or anvil if one comes (3).
39. Doors and chests: one more of each opening and closing.
40. Night creatures: more owls (3 now), a distant golden jackal (2), a nightjar's churr (1).

Music:
41. Yleos and Valtos tracks of their own (they're the menu's and the story's now).
42. Land tracks of 2.5 to 4 min, or 2 or 3 per land (each is about 1 min), and loop-ready edits of the menu, base and
    boss tracks with marked loop points.
43. A short death sting and a discovery sting for a new site (5 s).
