// Patch notes, newest first, shown from the title screen and the pause menu. A new patch goes at the top of the list;
// players see a "New" mark on the button until they've opened the notes for the newest one.
import { glyph } from './icons.js';

export const PATCHES = [
  {
    id: 'patch-27', name: 'Patch 27', title: 'Solid', date: '26 November 2026',
    intro: 'Walls you can trust, a wind that never twitches, and your gear painted in texels like the trees.',
    sections: [
      { t: 'Building', icon: 'build', items: [
        '<b>Walls look solid from every side.</b> The wooden walls, gables and floors you build no longer let you see through the ends of their logs at a corner or along a row, a floor overhead is a proper ceiling (and shades the room below), and the camera no longer slips inside the top of a gable.',
      ] },
      { t: 'The look', icon: 'sun', items: [
        '<b>Your gear in texels.</b> Armour, shields, weapons and tools now have the same chunky, hand-painted texels as the tree trunks: hammered bronze, worn leather and wool, and painted wood and metal on everything you hold.',
        '<b>A smooth wind.</b> The grass, flowers and leaves no longer thrash for a moment now and then when the wind changes (it got worse the longer you played); a gust from a lightning strike eases in instead of snapping the grass over.',
      ] },
    ],
  },
  {
    id: 'patch-26', name: 'Patch 26', title: 'Drawn', date: '25 November 2026',
    intro: 'The bow drawn and held, bosses that wait for you to come back and die like gods\' enemies, the island back in full colour and painted in texels from leaf to hoof, and a quicker hero.',
    sections: [
      { t: 'The bow', icon: 'bow', items: [
        '<b>Draw, then loose.</b> Hold the left mouse button to draw the bow and let go to shoot. The longer you draw, the harder and faster the arrow flies and the further it goes; only a full draw does the bow\'s full damage.',
        'A full draw takes 1.5 seconds with the crude bow and 1.25 with the Cretan bow, and up to a third less as your Bowman skill grows. A ring round the crosshair closes in as the string comes back, tightest at a full draw.',
        '<b>The bow blocks.</b> Hold the right mouse button with the bow to raise your guard: it soaks less than a shield, and raised just as a blow lands it parries and staggers the beast. Pressing it while drawing lowers the bow, keeps the arrow and guards.',
        'Holding a draw costs stamina; run out and you lower the bow, keeping the arrow. Right-click and Space still roll, and if you\'re still holding the left button you draw again after the roll.',
      ] },
      { t: 'Bosses', icon: 'bull', items: [
        '<b>Running doesn\'t end the fight.</b> Go far enough from its arena and the beast goes back to it and gathers its strength while you\'re away, its health bar saying so and its music falling quiet. Come back and the fight carries on where it left off. Only falling in battle ends a fight early, and your tribute stays on the altar so you can call it again.',
        '<b>The Labyrinth falls.</b> When the Minotaur comes, the maze comes down almost entirely: only the gate, a few lone lengths of wall and some columns stay standing, and the arena is open ground. Seven great boulders ring it: hide behind them, and he has to come round to reach you, and can\'t charge, slam, sweep or throw at you through them.',
        '<b>They hunt you.</b> The Minotaur and his dead now find their way round walls and boulders to you instead of walking into them and getting stuck, and a skeleton pressed against a rock beside you can hit you round it.',
        '<b>Every boss attack hits with spectacle.</b> The Minotaur\'s roar steams and throws off embers, his axe slam splits the ground glowing hot and flings stone, his sweep leaves a bright arc through the air, his charge throws up dust and clods, and the boulders he hurls trail grit and burst where they land. The Chimera rakes the air with glowing claws, whips venom from its serpent tail and pours real fire that scorches the ground; its pounce lands with a blast of dust and glowing cracks, and when its goat head calls the forest, runes flare round it and violet light streams to where the dryads rise. The Labyrinth\'s dead rise in a pale grave-light.',
        '<b>The Minotaur and the Chimera look the part.</b> Dark dust swirls round the Minotaur\'s hooves and embers rise round him, and he snorts smoke and sparks; smoke trails off the Chimera\'s back, flames stream from its mane and sparks spit from its jaws.',
        '<b>Zeus\'s storm is far fiercer:</b> brighter, heavier bolts that blast the ground and leave it scorched and smouldering, lightning flickering through the clouds between strikes, and a jolt when one lands near you.',
        '<b>A boss\'s death is a moment.</b> The killing blow shakes the screen; then Zeus strikes the fallen beast with a bolt, there\'s a great boom and thunder, and its body bursts into glowing embers that swirl up and drift away on the wind in smoke, their light slowly fading, leaving its trophies where it lay.',
        'The bosses\' music is a fifth louder.',
        'The Chimera\'s fight is seen from much closer, behind you like the usual camera, tilting up towards the beast instead of pulling far back.',
        'The Owl keeps quiet for the whole of a boss fight, even while you\'re away from the arena, and drops advice that no longer applies once the beast is gone.',
      ] },
      { t: 'The look', icon: 'sun', items: [
        '<b>Full colour again.</b> The island is back in its full colours. The Colour setting still lets you mute it, and if you\'ve set it yourself your choice is kept.',
        '<b>Painted in texels, everywhere.</b> The Pixel texture setting now reaches almost everything: leaves, bushes, grass, rocks, buildings and ruins, the things lying about, animals and monsters, the Owl, the tools in your hand, fires and smoke, all in the chunky hand-painted texels the tree trunks had. Off draws the smooth look; Strong makes the texels bigger.',
      ] },
      { t: 'You', icon: 'you', items: [
        '<b>A fifth quicker.</b> You walk, run, sprint, sneak and swim a fifth faster, with or without armour or a heavy load.',
        'The woman\'s eyebrows are finer, and she has seven new ways to wear her hair: a high ponytail, a fringe gathered up, a fringe and ponytail, a fringe and bun, waves tied up, curls tied up and a banded bun. Switching between the man and the woman in the creator now gives each a hairstyle of their own.',
      ] },
      { t: 'Menus and keys', icon: 'goal', items: [
        '<b>Return to Main Menu</b> in the pause menu saves your game and takes you back to the title screen.',
        '<b>Ctrl+W no longer closes the game by accident.</b> In fullscreen the game keeps the key; in a window the browser asks before leaving a game in progress. While you play, Ctrl with S, D and the like no longer set off the browser either (Ctrl is sneak).',
      ] },
    ],
  },
  {
    id: 'patch-25', name: 'Patch 25', title: 'Steady', date: '23 November 2026',
    intro: 'Steadier frames on Ultra, by the fire and on big screens, less graphics memory, and a game that survives the graphics card dropping its picture.',
    sections: [
      { t: 'Smoother', icon: 'sprint', items: [
        '<b>Steadier by the fire.</b> Carrying a torch no longer redraws the fire\'s shadows every frame, a camp of two fires no longer swaps its shadows back and forth as you turn, the shadows are drawn from what stands by the fire alone, and the first fire of a visit no longer stutters as you walk up to it.',
        '<b>Ultra on big screens.</b> Ultra no longer draws more than a 4K picture\'s worth of pixels when it sharpens the picture above your screen\'s own resolution, and while it does it uses four samples of smoothing instead of eight, which looked the same: far less graphics memory, and less work for spray, mist and smoke.',
        'Less graphics memory and steadier frames everywhere: the pictures of the distant trees and the sky\'s light no longer keep or remake what they don\'t need, and the compass no longer costs a little every frame.',
        '<b>If the graphics card drops the picture</b> (its driver resets or it runs out of memory), the game saves, says so, and picks up again when the picture comes back, or offers to reload, instead of freezing.',
        '<b>The performance overlay (F3)</b> now also shows the graphics card\'s own time, its memory and the game\'s, how often the resolution changed, the fire\'s shadow and the river\'s reflections; <b>F4</b> copies a full report you can paste to us.',
      ] },
      { t: 'Sound', icon: 'lyre', items: [
        '<b>Music all the while you\'re in a land.</b> Each land\'s music now plays the whole time you are in it, on and on with no gaps, instead of once as you arrive and then minutes of silence, and it fades into the next land\'s as you cross over. It is also a little quieter, so it sits behind the world. <b>By night the meadows have the title\'s theme</b>, fading in at dusk and back to their own music at dawn. The boss fights, your home by the fire, the story, the climb up Olympos, the caves and the shore at dawn and dusk keep their own music as before.',
        '<b>No birdsong in the rain.</b> The birds fall silent as the rain starts and sing again once it stops; the wind and the thunder carry on.',
        'Your footsteps are half as loud, and the wind a little quieter.',
      ] },
      { t: 'The pack', icon: 'gear', items: [
        '<b>Ten slots on the hotbar.</b> The hotbar now has ten slots, on the keys 1 to 9 and 0, and the pack is ten wide: 40 slots instead of 32. Your saved pack comes across as you left it, everything in its row and its place along it, the hotbar too, with the new slots empty at the end of each row.',
        '<b>Break down what you made.</b> Shift and right-click a crafted tool, weapon, shield or piece of armour in your pack to break it down for half of each of its materials, rounded down but at least one of each. It asks first, so a slip of the mouse costs nothing; take off what you are wearing before you break it down. Arrows go ten at a time. A plain right-click still uses or equips, as before.',
        'The pack no longer grows or shifts when a thing has a long description: the description has a box of its own, which scrolls when there is more to read.',
        'In a window too narrow for both, the compass now sits just below the hotbar instead of under it.',
      ] },
      { t: 'Searching', icon: 'chest', items: [
        '<b>Search what was left behind.</b> The jars, amphorae, baskets, sacks, straw and woodpiles about the abandoned town, the old farmhouse, the little places along the roads and the Giants\' caves can now be searched with E, once each, as in Valheim: look at one and the prompt says what it is, "Search the amphora" or "Take the wood (20)".',
        'What you find goes by what it is: a woodpile gives 20 wood (the small stack by a shepherd\'s fire 8 to 12), straw gives fiber, jars and amphorae olives, seeds, resin or rope, baskets fruit, acorns or fiber, sacks acorns, seeds or fiber, and the smithy\'s forge a little coal and stone, now and then with an old axe or club left to mend. Some jars hold nothing but dust.',
        'A searched woodpile is down to its bottom logs, a jar or a basket lies tipped over and a sack slumps empty, and it stays so: your save remembers each one. The farmhouse\'s old chest is as it was.',
        'The offerings at the roadside shrines, under the old olives, in the temple and on Olympos are the gods\' and stay where they are.',
      ] },
      { t: 'Controls', icon: 'goal', items: [
        '<b>Esc in fullscreen.</b> Esc now always brings up the pause menu in fullscreen. In Chrome and Edge a tap pauses and you hold Esc to leave fullscreen; in browsers where Esc leaves fullscreen at once, leaving it during play now pauses the game, even with the pack or the map open. F11 now goes into the game\'s own fullscreen, the one where Esc still pauses.',
      ] },
      { t: 'The camera', icon: 'you', items: [
        '<b>The camera comes in instead of things vanishing.</b> When a wall, a roof, a rock, a cliff, a tree trunk or a hill comes between the camera and you, the camera now moves in closer in front of it, as in Valheim, instead of the thing turning see-through. It comes in at once and glides back out when the way is clear. Indoors it stays inside the room and under the ceiling.',
        'Leaves don\'t push the camera: it passes through the crowns of trees as before, and a crown that comes between you and the camera still fades.',
        'Backed right into a corner, the camera no longer looks out from inside your hero: you are hidden from it until it has room again.',
        'The camera shakes a little harder (a tenth more) at every blow, slam, roar and thunderclap, never past a sensible limit however many come at once.',
      ] },
      { t: 'Fights', icon: 'bull', items: [
        '<b>The Minotaur is five times as tough</b>: 4500 health instead of 900. His dead come to his aid at 1500 health instead of 300, still a third of him, and Zeus\'s lightning hurts him five times as much. He becomes enraged at half his health as before. The fight takes four or five minutes with the first weapons instead of one. A spear wears out after 100 blows that land, so bring a spare or your bow.',
        '<b>The camera stays where it is in the Minotaur\'s fight.</b> It no longer draws back and up when he comes: you fight him with the camera you always have. The Chimera\'s fight still draws the camera back to fit the beast in.',
        '<b>Deer are tougher</b>, as hogs became in Patch 21: four or five blows of the Crude Axe instead of one, a fawn two. A well-aimed arrow from hiding still drops one.',
      ] },
      { t: 'The look', icon: 'sun', items: [
        '<b>A painted hero.</b> Your hero, man or woman, now looks hand-painted instead of shiny: skin shaded in soft bands with a warm edge where the light turns away, and no gloss; the face kept clean, so brows, eyes and mouth read from afar; clothes and the cape in a coarse weave you can make out up close, their folds darker; leather straps darker; and gold and bronze armour with painted highlights and pale bevelled edges in place of the plastic shine. The colours in the character creator are softer and earthier, each still easy to tell apart, and the weave follows the Pixel texture setting like the rest of the world.',
        '<b>Muted, earthy colour.</b> The world\'s colours are half as strong as before, as in Valheim, while the sun, fire and magic keep their glow and the sky keeps more of its blue. The new <b>Colour</b> slider in the settings sets it anywhere from grey to the old full colour.',
        '<b>Pixel texture.</b> Rock, bark, planks and the ground now show their detail in small square texels, like the low-resolution textures of Valheim, while the light and shadows on them stay smooth. Choose Off, Mild (the default) or Strong in the settings.',
        '<b>Darker nights.</b> Moonlit nights are about a third darker. You can still make out the hills and the trees against the sky, and a fire now stands out all the more.',
        '<b>Only the leaves move in the wind.</b> The wind now stirs only the grass, the flowers and the leaves of trees and bushes. Trunks, branches, columns and ruins stand still, so nothing bends or stretches oddly in a storm. A tree you strike still shakes.',
        '<b>Bark, planks and petals.</b> Tree trunks have bark with fibres and furrows, each tree its own shade, with moss on the shaded side in the woods. Building pieces show grain along each plank, dark seams, worn edges and a tone of their own, and darken in the rain. The old columns and walls and the hearth\'s stones look like the island\'s rocks, and the meadow flowers have veined petals, deeper in colour at the base.',
      ] },
    ],
  },
  {
    id: 'patch-24', name: 'Patch 24', title: 'Footwork', date: '21 November 2026',
    intro: 'Surer footing for the hero, rocks that look like stone, a grander Olympos with a smoother path up it, a river falling from it to the sea, and a gentler storm seen from its top.',
    sections: [
      { t: 'The look', icon: 'sun', items: [
        '<b>Rocks and boulders in real stone.</b> Every rock on the island now has grain, cracks and layers, pale edges where its faces meet and darker hollows, and each is a little different in colour. Moss grows over their tops in the woods and a pale, sun-bleached lichen out in the meadows, less up the mountain and none by the sea, and they turn dark and wet in the rain. The stones you pick up, the cairns on Olympos and the boulders at the ruins match them.',
        '<b>Zeus\'s storm from the top of Olympos.</b> Seen from up high it now sits in the same soft haze as the rest of the island instead of standing out near black, its outline against the sky is softer, and its rings of cloud share the haze. It still towers dark over the marsh, and from the meadows it looks as before.',
        '<b>Distant woods with depth, not cardboard.</b> Trees far away are no longer flat cut-outs that swing round to face you: each is now pictured from all round and from above, so it turns as you walk past it, and it is lit by the real sun and sky like the trees nearby, bright on its sunny side and darker in its own shade, in the same haze. The woods no longer turn near black past the nearest trees, and there is no more chequered band where near trees hand over to distant ones. The giant forest keeps its leafy roof far off, its trunks in their own shade instead of a row of pale sticks. On Ultra, the giants stay full trees out to 600 metres.',
      ] },
      { t: 'Footwork', icon: 'sprint', items: [
        '<b>Dodge any way you like.</b> Hold the right mouse button and press Space to dodge the way you are pressing: forwards, backwards, to either side or on a diagonal, or straight back if you press no direction. You throw yourself into a quick roll of about three and a half metres, and nothing can hit you in the heart of it. It costs the same stamina as before and works with anything in your hands, the bow and bare hands too.',
        '<b>A running leap.</b> Sprinting with Shift, Space throws you a little higher and carries you on at a sprint, over logs and gaps.',
        '<b>No more spinning while you aim.</b> Walking with the bow drawn, your body no longer twists round on itself: you face your aim steadily and step forwards, backwards and sideways under it. Drawing or lowering the bow on the move, and raising or dropping a shield, no longer swings you round either.',
        'Turning to your aim or your guard is quick but no longer instant, and after you lower the bow you turn smoothly back to where you are walking.',
      ] },
      { t: 'Olympos', icon: 'stone', items: [
        '<b>A mountain, not a cone.</b> Olympos now rises in bands of grey limestone cliffs with shoulders between them, the rock beds tilted across the massif, streaked dark where water runs down and darker in its gullies. Holm oaks and olives grow on its lower slopes, then pines on the shoulders, then a thin turf and bare scree, and snow lies on the ledges and in the gullies near the top.',
        '<b>A smoother way up.</b> The path climbs at a steady grade, with no more level stretches broken by steep ramps or bumps underfoot. It is a worn track you can see winding up the face, it passes the cliff bands where they break, and the last rock steps under the summit are each one clean jump. Off the path the cliffs can\'t be hopped up: you can\'t jump while sliding down a face or with a cliff right in front of you, and no jump lands you on a ledge above one.',
        '<b>Boulders where the mountain drops them.</b> The rocks scattered all over the slopes are gone. Fallen blocks now gather at the foot of the cliffs, rounded stones lie in the gullies, outcrops stand out of the ridges and a few stones from the cut lie beside the path, all bedded in the ground, none floating and none in your way.',
        '<b>Places to stop on the climb.</b> A ledge halfway up with a bench and a little shrine looking out over the island, a spring running from a bronze spout in the cut above the path, broken votive columns and pilgrims\' cairns where the crest begins, an eagle\'s nest on the lesser summit, and a cairn at every bend of the path. At the top, a gateway of columns leads in to the altar over old flagstones, ringed by crags.',
      ] },
      { t: 'The river', icon: 'wet', items: [
        '<b>A river from Olympos to the sea.</b> It rises from a spring under a crag high on the mountain\'s south-west face, just below the snows, and comes down the cliff bands in four waterfalls, the highest some sixty-five metres, each pouring into a deep pool at its foot. Out on the meadows it winds south-west between the Ancient Temple and the western Giant\'s cave, turns north into a small lake under the forest hills, and leaves it through a ravine, down rapids to the sea on the north-west coast.',
        '<b>Swim it.</b> Its deep, wide reach in the meadows and the lake are too deep to stand in: you swim across, as at sea. In the shallows you wade, slower the deeper it gets and splashing as you go, and the current carries you downstream, harder where the river runs narrow and quick; the lake is still. Animals keep out of its deep water, and a log you fell into it floats off downstream.',
        '<b>Water you can see into.</b> The shallows are clear over their gravel and stones, with the sun\'s light playing on the bed; deeper water turns green and then dark in the pools. The river mirrors its banks, the trees and the mountain, the ripples run with the current, quicker and broken over the riffles, and foam gathers on the rapids, along the banks and under the falls. The lake lies almost still. Rain rings the surface, and by night it holds the moonlight.',
        '<b>The falls.</b> Their water streams down the rock, quickening as it falls, white at the foot, with spray thrown up from the pools and mist drifting off them on the wind; stand with the sun behind you and you may see a rainbow in it. The rock round them is dark and wet, with moss and ferns in the spray.',
        'Reeds stand at the slow water\'s edge, water lilies float on the lake and the deep reach, plane trees grow in groups along the meadow river, and nothing grows in the water. You hear the river babbling as you come near it, louder over the riffles, the roar of the falls from far off, and water lapping at the lake\'s shore. The map shows it all.',
      ] },
    ],
  },
  {
    id: 'patch-23', name: 'Patch 23', title: 'Polish and Pace', date: '21 November 2026',
    intro: 'A long look over the whole island: a brighter sky and storm, clearer air, a smoother forest, fuller sound, fairer fights and building that keeps what you build.',
    sections: [
      { t: 'The look', icon: 'sun', items: [
        '<b>Zeus\'s storm wall looks like a storm, not a hole in the sky.</b> By day it stands slate-blue across the island, its towering tops lit silver by the sun; by night and under a stormy sky it stays dark and menacing.',
        '<b>Softer, brighter clouds.</b> Shaded smoothly, their tops lit white by the sun, their bases melting into the sky; the little puffs that looked like pebbles are gone, and by night the clouds take the night sky\'s colour.',
        '<b>Clearer distance on High.</b> The haze round you is lighter and takes the sky\'s own colour, glowing towards the sun and thinning upward instead of stopping at a flat top, so distant woods and hills read as far away rather than behind a grey wall.',
        'Rain and grey skies now drain the colour from the land and cool the light.',
        'Shade is less blue: bark, marble and skin no longer turn lilac, the woods\' shade is a little green, and bare earth no longer looks like snow by moonlight.',
        'Sun flecks on the forest floor are softer and warmer, and the forest\'s roots and needles no longer appear on beaches or on the summit.',
        '<b>Firelight.</b> Campfires are brighter close by and fall off sooner, and on High and Ultra the nearest fire casts shadows: your hut, your workbench and you.',
        'The sea is a deeper blue, the foam along the beach comes and goes in sets, and on Ultra its reflections are no longer speckled.',
        'The focus blur at the edges of the screen is gentler and never blurs the sky. You can turn it off: Focus blur, in the settings.',
        'A little more contrast in the picture; gold and bronze armour shines like metal; deer are a natural brown rather than orange.',
        '<b>Softer grass.</b> Its tips are a natural green instead of lime and yellow, each blade catches the light a little on its own, the forest floor\'s grass is finer instead of rows of green spikes, and in the rain the meadows darken as wet grass does.',
      ] },
      { t: 'Smoother', icon: 'sprint', items: [
        'Fixed: a short freeze every time the sky\'s light was refreshed, felt most in the woods and when time runs fast.',
        'The grass costs far less to draw, most of all in the forest, and the shadows under the trees, the far-off temples and the labyrinth take less work too: steadier frames in the woods, on every setting.',
        'No more hitch the first time shafts of sun break through, or when you look into a deep corner for the first time; the trees far off come in faster after a long jump, and a long walk through the woods no longer slowly fills the graphics memory.',
      ] },
      { t: 'Sound', icon: 'lyre', items: [
        '<b>Boss fights no longer blast.</b> The boss\'s heavy music is still loud and clear over its storm, but the whole fight is about 5 dB quieter, the slams and roars sit with the music instead of over it, and nothing pumps or clips.',
        'You can hear the warnings: the Minotaur\'s snort before he charges, the bones of the dead rattling as they come, a dryad\'s thorn leaving her hand. The music dips for a moment under the big ones.',
        'Every swing whooshes, a miss too, quick for a dagger and heavy for a mace; creatures\' blows whoosh in just before they land.',
        'New sounds for the roll, swimming strokes, eating, opening the pack, the map and the build menu, your guard breaking and a wall taking a blow. Landings sound as hard as the fall, footsteps are louder sprinting and softer sneaking, and Olympos\'s snow and the marsh\'s mud have steps of their own.',
        'Maces, clubs, fists and kicks land with a solid thump instead of a faint tap. Blows on skeletons crack bone and blows on dryads knock wood, and each creature has a cry of its own: a hog\'s grunt, a giant\'s bellow, the dryads\' high call.',
        'A creature you kill falls where it lies, not in your ear. A boss dies with a long, failing roar and the ground shakes as it comes down.',
        'Rolling logs rumble and thud with the rest of the sounds: under the effects slider, quieter indoors, and no more clipping over a fight.',
        'Music for more places: the climb up Olympos, the Giants\' caves (and a land you come into by night), and the shore at dawn and dusk. The title and boss music loop smoothly without their opening coming back every minute.',
        'Indoors and in caves the world outside comes muffled, and caves, the labyrinth and your house ring like stone rooms.',
        'A dawn chorus at sunrise; crickets only in the evening and at night; the wind falls quieter in fog; Olympos\'s summit sounds like wind and height, not a meadow. Long sounds like a roar follow their source as you turn.',
        'Recordings are levelled more carefully, so one pickaxe blow or footstep is as loud as the next, and wooden floors no longer sound quieter than grass. Short ambience loops (leaves, wind, frogs, fires) no longer repeat audibly, and each campfire crackles in its own way.',
        'Meat sizzles on a cooking stand while it cooks, and you hear it\'s done from across the camp. The guide\'s chime plays even with the music turned off, and the skill bell is a real bell.',
      ] },
      { t: 'Fights and survival', icon: 'sword', items: [
        '<b>Roll with anything in your hands.</b> Hold the right mouse button and press Space to roll: with a weapon or shield, with the bow (it lowers the bow, and you draw again after), or with bare hands. It costs stamina as before, and nothing touches you in the heart of the roll.',
        'A parry no longer holds a boss in place, and a giant only staggers if your guard takes most of its blow. The tower shield soaks blows but can\'t parry.',
        'Beasts can no longer hit you through a wall: inside your house you\'re safe from what\'s outside, and the blow lands on the wall instead.',
        'The Chimera\'s venom and fire only take hold if its blow actually lands: roll clear or block it and you\'re spared.',
        '<b>The bow grows with you</b>: the Bowman skill now makes your arrows hit harder, as a weapon skill does, and so do Zeus\'s Blessing and the Cretan helmet. Its blessing strengthens your guard too, as promised. Arrows take the bow\'s own sneak-attack bonus, and the Cretan bow helps you sneak up on game.',
        'Sneaking gets better as your Sneaking skill grows: beasts notice you later.',
        'Deer, foxes and hares take fright from further off (a deer from about 18 m): sneak up on them or bring a bow.',
        'A beast that lost track of you can be caught unawares again, so a second sneak attack works.',
        'A swing meets the nearest beast in front of you first. Swings cost stamina by the weapon: a dagger or a fist is cheap, an axe or a club dearer, a spear\'s thrust dearest.',
        '<b>Dying costs a little</b>: 5% of what you have learned of each skill you\'ve used (a long-trained skill can lose a level), shown on the death screen. It used to take from one skill at random, often one you\'d never used.',
        'Your grave is marked on the map, the minimap and the compass until you\'ve emptied it.',
        'Fixed: closing the game on the death screen brought back your full pack without a grave. Dying now saves at once.',
        'Fixed: a skill bar could run backwards after a death.',
        'If a boss fight ends without the kill (you flee, fall, or leave the game mid-fight) your tribute stays on the altar: call the beast again for nothing more.',
        'The Owl tells you about guarding, parrying and rolling after the first blow a beast lands on you, and gives you a tip the first time you block. What she has told you can be read again from the pause menu (<b>The Owl\'s counsel</b>).',
        'The first time you pray at the temple, Zeus shows you the nearest marked olive on your map and compass, so you know where the trial begins.',
        'The Owl no longer says that dryads fear fire: they don\'t (only dryadlings shy from a campfire).',
        'Fixed: the Cretan cape could vanish from your back.',
        'The clock\'s zero no longer looks like a crossed-out circle, and the minimap is sharper.',
        'Saves are sturdier: a save from an older version with things this one doesn\'t know loads without them, a skill added since starts at level 1, a save that can\'t be read is kept aside while a new trial begins (you\'re told), and you\'re told if the game can\'t save.',
      ] },
      { t: 'Building and crafting', icon: 'hammer', items: [
        '<b>Your buildings load whole.</b> A floor whose wall you had rebuilt no longer falls when the game loads, and a big base loads in a blink instead of several seconds.',
        'Building in a big base is quick: placing or taking down a piece no longer stutters.',
        'Support now fades by the metre rather than by the piece: a floor reaches about 20 m out from one wall (it was 30, more than Valheim allows) and log beams a little further. Buildings you already have stand as they are.',
        '<b>What falls drops what it was made of.</b> A collapse, or a piece broken by a beast or a storm, leaves its wood and rope where it fell, gathered into a few piles.',
        'Taking down a piece that holds others up first flashes red everything that would fall with it: press again, or hold <b>X</b>, to take it down. A chest with things in it can\'t be taken down.',
        'The ghost shows how well a piece would be held up (green, yellow, orange) and red where it can\'t go, and it says why, down to what you\'re short of: "Need 1 more wood, 2 more rope".',
        '<b>New pieces:</b> a window wall, a narrow wall, a triangle wall for lean-tos and gables, a low thatch roof with its gable end, log beams and posts made from the giants\' logs (they hold more up than planks), and a stone hearth that holds 20 wood and that the rain can\'t put out.',
        'A door falls with its frame. Beds, benches and chests can\'t be set on steep ground, where they stood half in the air, and walls and furniture can\'t be built through tree trunks or rocks.',
        'A deck, porch or balcony built out from walls no longer turns the ground under it into a mound.',
        'A felled tree\'s stump is in your way, goes from under a floor you build over it, and three blows of an axe cut it up for a little wood.',
        'Fixed: invisible trees in the meadows that an axe could fell out of thin air.',
        '<b>Cooking:</b> a ring over each piece of meat fills as it cooks and the meat browns; left on as long again it burns to coal. Taking down a cooking stand gives back the meat on it.',
        '<b>Recipes are learnt once you\'ve held everything they need</b> (and stood by a workbench, for the bench\'s), so your first rope no longer floods the screen, and what\'s new comes in one message. A boss\'s gear stays hidden until you hold its head.',
        'A tool worn to nothing breaks but stays in your pack: mend it at a workbench. A wrong tool\'s clink no longer wears it.',
        'Crafting: <b>Craft ×5</b> (or Shift-click), <b>Repair all</b> at the workbench, where to find what you\'re short of, and what each thing is used in (in the pack).',
        'Chests have <b>Take All</b> and <b>Store Stacks</b>, and show your tools\' wear. In the pack, a pile dropped on one of the same kind tops it up (or swaps, when it\'s full), and a split pile goes into the pack instead of the hotbar.',
        'The hoe is put away until there is something to plant.',
      ] },
      { t: 'Under the hood', icon: 'gear', items: [
        'The title screen shows which build of the game you are playing, its number and the date it went up, so a report can say which one it was.',
      ] },
    ],
  },
  {
    id: 'patch-22', name: 'Patch 22', title: 'Learning by Doing', date: '20 November 2026',
    intro: 'Skills you can see grow, a hero who doesn\'t race across the island, your stamina in numbers, and meat that tells you when it\'s done.',
    sections: [
      { t: 'The Minotaur', icon: 'bull', items: [
        'He moves like the giant he is: he swings his weight round slowly and turns in an arc as he walks, gathers speed over a few strides and takes a while to stop, and his hooves stay put on the ground instead of sliding. No more leg hanging in the air while he stands, no lurch forward when he hits a wall, no slide back when he paws the ground.',
        'He doesn\'t flinch at every blow any more: only a flurry of hard hits staggers him.',
        '<b>His roar stuns.</b> He rears and bellows, and a shockwave rolls out some 16 m round him (the ground shows how far as he draws breath). Caught in it, you\'re stunned for 2 seconds: you reel, the world swims and sounds come muffled, and you can\'t move or strike. Get out of reach, or behind a wall.',
        '<b>His charge</b> is slower and heavier. He lowers his horns and paws the ground first, then gathers speed over a few strides, and once he\'s going he can hardly turn: step aside at the last moment and he thunders past, skids to a stop and turns round, panting. Run him into a wall and he reels, dazed.',
        '<b>His slam</b> glows on the ground where the axe will bite, and its shockwave hurts less the further you are from it (jump it and it passes under you). <b>His sweep</b> swings the axe flat across in front of him: roll back out of it, or crouch and it goes over you. A rock he throws shows its shadow where it will land.',
        '<b>He tires.</b> After a few big moves, or a charge into a wall, he stops and stands heaving for breath, steam from his nostrils, a golden glow on him and on his health bar. For those few seconds your blows land half again as hard. Then he bellows you back and comes on.',
        'Below half his health he\'s enraged: lightning strikes beside him, his moves come faster and he rests less.',
        '<b>His dead</b> claw their way up out of the ground and come on at a shamble, each at its own pace. Only two at a time come at you; the others circle a few steps off, waiting their turn, and they all hold back while he charges. They\'re frailer than the dead of Valtos and hit softer, and they fall apart in a clatter of bones.',
        'The Chimera shows where its pounce will land, and it tires too after its fire and its leaps.',
      ] },
      { t: 'Zeus\'s storm', icon: 'zeus', items: [
        'When you lay the tribute, a thunderstorm rolls in over the arena: the sky goes dark, the rain drives and the wind gets up. Lightning strikes all round you with the thunder right on top of it, and some bolts come down close: the ground glows and crackles a second first, so move. A bolt hurts whatever it falls on, you, the Minotaur or his dead.',
        'When the beast falls, the storm breaks: the rain stops, the clouds part and the sun comes through.',
        'The boss\'s music plays loud and clear through the fight, over the storm.',
      ] },
      { t: 'Skills', icon: 'star', items: [
        'The first time you use a skill, a banner on the right tells you at once: <b>Skill learned: Jumping, level 1</b>. Your first sprint, jump, swim, sneak and swing, the first guard you raise and the first thing you pick up each find theirs.',
        'Every level after that shows a banner too, with a soft chime. Several at once wait their turn, so none covers another.',
        'Your save remembers which skills you\'ve found, so they aren\'t announced again when you come back.',
      ] },
      { t: 'Moving', icon: 'sprint', items: [
        'You move a quarter slower: running, sprinting, walking, sneaking, swimming, aiming and walking with your guard up. The island feels bigger, and your feet still keep time with the ground.',
        'Fixed: when you woke at your bed after dying, the camera swept over from where you fell. It now starts behind you.',
      ] },
      { t: 'The HUD', icon: 'stamina', items: [
        'The stamina bar shows how much you have and how much you can have, under the bar, as the health bar does.',
      ] },
      { t: 'Cooking', icon: 'fire', items: [
        'When meat or fish is done on the cooking stand it sizzles and lets out a soft hiss and a puff of steam, so you know it\'s ready without watching it.',
      ] },
      { t: 'Felling', icon: 'tree', items: [
        'A felled tree falls with its own weight: slowly at first, then faster, until it hits the ground, a rock, a wall or another tree. Where the ground drops away it falls further, and on a rise it lands sooner.',
        'If it falls onto a smaller tree, it breaks that one too and both come down, each leaving its own stump and log. Only the one: the second tree can\'t knock down a third. If the tree it falls onto is as big or bigger, it stays leaning against it.',
        'Logs roll. On a slope a log rolls downhill, faster the steeper the ground, and slides a little on very steep ground. It stops against trees, rocks, stumps, walls and other logs, glances off them at an angle, and settles on flat ground or in a hollow. You can split it wherever it comes to rest.',
        'Keep out of the way of a rolling log: it shoves you aside, and a fast, heavy one hurts and knocks you back. Creatures too.',
        'You hear a log rumble as it rolls and thud when it lands, and it kicks up dust.',
        'Logs now stay where they lie when you save and come back.',
      ] },
      { t: 'The abandoned house', icon: 'roof', items: [
        'The abandoned house is a farmstead now: the house under a porch on square piers that stand either side of the door, never in front of it, a roofless storeroom along the yard, and a dry-stone wall round the yard with the well, the bread oven and a vine. Part of the porch has come down, and the old hearth, the loom, the couch, the shelves and the chest are still inside.',
        '<b>Old houses are shelter.</b> Inside the farmhouse and the town\'s houses that still have their roofs you can build a bed and sleep in it, set up a workbench that works, and keep a fire going through the rain, just as under a roof of your own.',
        '<b>No house is ever perfect.</b> Each one has a hole in its roof where a few tiles have fallen in: the rain comes in there, and nothing right under it counts as covered. Build a <b>Roof Patch</b> (3 wood, under Roofs) and aim into the hole: it snaps in, and the house is whole. The patch is kept with your buildings when you save.',
      ] },
      { t: 'Building', icon: 'hammer', items: [
        'Nothing grows through your floors any more. Building a floor, stairs, a wall or anything on the ground clears away the flowers, tall grass, bushes, mushrooms, tomato bushes and stones under it, with a little room round it, for good. On a slope and on stilts too, wherever the boards come near the ground.',
      ] },
    ],
  },
  {
    id: 'patch-21', name: 'Patch 21', title: 'The Island Speaks', date: '19 November 2026',
    intro: 'The team\'s own sounds and music: every blow, cut and knock, the fire, the bosses, thunder and rain, the wind and the creatures of each land, and music that comes now and then, as it does in Valheim. And bronze Corinthian armour for those who have beaten the Chimera.',
    sections: [
      { t: 'Music', icon: 'temple', items: [
        '<b>Music of its own:</b> the title screen and the character creator have their theme, and a new trial opens with the story\'s music as you wake on the shore. It plays again when the owl first speaks to you.',
        'Each land has its track. It plays when you\'ve been in the land a little while after coming into it, and at dawn and at dusk, then leaves you a few quiet minutes with only the world\'s sounds before another can play. You won\'t hear the same track twice running.',
        'Sit or stand by your own fire, or shelter under your own roof, and after a moment the home theme plays. It fades as you leave.',
        'Each boss has its battle music, from the moment you lay the tribute until it dies or you flee its arena.',
        'Music fades in and out over a few seconds, and dips a little under loud thunder.',
        'The settings have four volume sliders now: <b>Volume</b> (everything), <b>Effects</b>, <b>Ambience</b> and <b>Music</b>.',
      ] },
      { t: 'Fighting', icon: 'bow', items: [
        'Blades, axes and arrows each sound different when they hit, and you hear them from where they land. Blocks and parries ring, your weapon scrapes as you draw it and put it away, and your bowstring creaks as you pull it.',
        'Hostile creatures cry out when they notice you. Animals only start.',
        'The giants\' blows and the Minotaur\'s slam shake the ground, and his thrown rocks crash as they\'re torn up and as they land. The Minotaur and the Chimera roar for real now.',
        'When you play a man, you hear him cry out when he\'s hurt and when he falls.',
      ] },
      { t: 'The Giants', icon: 'zeus', items: [
        '<b>The bosses are giants now.</b> The Minotaur stands over ten metres tall, five and a half times your height, and the Chimera is over twenty metres long and nearly as tall as he is. They are much stronger too: more health, harder blows, and a heavy blow sends you flying.',
        '<b>Their coming:</b> lay the tribute and the ground starts to shake. A pillar of light rises over the arena, the beast drops out of the sky inside it and lands with a blast that throws you off your feet, and for a moment everything slows.',
        '<b>The Labyrinth breaks apart</b> as the Minotaur lands: walls topple and crash down in clouds of dust, the outer ring is breached in several places, the inner rings are mostly gone, columns fall across the corridors, and the floor cracks out from a crater. The Chimera\'s shrine breaks too: its columns topple into the forest, the beams come down, the stone Chimera on the altar bursts apart and the court splits in glowing fissures.',
        'The ruins stay ruined: after the fight, after you reload, and if you call the boss again. In the open ruin the boss comes straight for you over the rubble and round what still stands, and no longer gets stuck.',
        'In a boss fight the camera draws back and up so the beast fits in view, and eases back in afterwards.',
        '<b>The fights sound huge:</b> the battle music is louder, the roars are deeper with a boom you feel, every footstep thuds and shakes the ground near you, slams and charges into walls crash, the Chimera\'s fire roars, and a boss\'s blow lands on you with a heavy thump.',
      ] },
      { t: 'Gathering and Building', icon: 'hammer', items: [
        'The axe bites into trees and logs, a felled tree crashes to the ground, the pickaxe rings on stone, bushes thrash, and picking something up has its own sound.',
        'Building, breaking, repairing and crafting have new sounds. Doors creak open and bang shut, and chests open and close.',
      ] },
      { t: 'Fire', icon: 'fire', items: [
        'A campfire roars up when you light it, crackles where it burns (you hear each fire near you from its own side), and hisses out when you douse it or the rain puts it out.',
      ] },
      { t: 'The World', icon: 'wet', items: [
        '<b>Rain in layers:</b> a patter as it starts, a downpour when it\'s heavy, drumming on the roof over you, and only a muffled hush once you\'re inside walls.',
        'A downpour is a little quieter, so it no longer drowns out everything else.',
        'Thunder sounds different by distance: a crack and burst right overhead, a peal a few hundred metres off, a low roll from far away.',
        'The wind rises and falls with the weather and gusts with it. It whispers through the meadow grass and the leaves of the woods.',
        'Waves break near the shore. Birds sing by day; by night Pedias and Yleos each have their own crickets, owls call, and frogs croak in the marsh.',
        'Sounds out in the world come from their side and fade with distance, and they come muffled when you\'re indoors.',
      ] },
      { t: 'Corinthian Armour', icon: 'helmet', items: [
        '<b>A new set of armour:</b> a bronze Corinthian helmet with a red crest, a muscled bronze corslet over a pleated skirt with bracers, and bronze greaves. Make it at the workbench once you have offered the Chimera\'s head, from lightstone, deer hide and rope.',
        'It is the strongest armour yet: 8 for the helmet, 32 for the corslet and 24 for the greaves, and a little more for wearing all three. Each piece halves the harm fire does to you, the corslet keeps out the cold, and the helmet makes you heal a little faster. The corslet and the greaves are heavy: each slows you a little.',
        'It goes on over your own body, so your arms and legs still show beneath it, on a man or a woman.',
      ] },
      { t: 'Tools and Food', icon: 'pomegranate', items: [
        'The <b>crude spear</b> is a real spear now, a stone head bound to a long shaft, instead of a sharpened stake.',
        'The <b>hoe</b> is a real hoe, its blade across the handle, instead of a spade.',
        'Olives, acorns and pomegranates have pictures of their own in your pack: an olive on its twig, an acorn in its cup and a pomegranate with its crown.',
      ] },
      { t: 'Balance', icon: 'bull', items: [
        '<b>Hogs are much tougher:</b> a grown hog now takes four or five blows of the crude axe.',
        '<b>Hogs fear fire, until you hit one.</b> A hog keeps away from a lit fire and from the torch in your hand. Hit it, or one of its family, and the whole family turns on you and keeps fighting, torch or no torch, until the fight is over.',
        '<b>Dryadlings</b> back away for a moment the first time they see your lit torch in a fight, then come at you regardless.',
        '<b>Dryads</b> no longer fear fire at all: a torch won\'t keep one off. Fire still hurts them more than other blows.',
        '<b>The Minotaur\'s charge</b> hits harder when his horns catch you.',
        '<b>The dead of the Labyrinth</b> now rise in waves 30 seconds apart. The first comes 30 seconds into the fight, or sooner if you bring the Minotaur down to a third of his health first.',
      ] },
    ],
  },
  {
    id: 'patch-20', name: 'Patch 20', title: 'Each Land Its Own', date: '16 November 2026',
    intro: 'Our reviewer\'s list: taller trees and thinner woods, a darker, foggier Yleos, moonlit nights, a meadow of new grass and tomato bushes, fights you can read, free repairs, a seat for screenshots, and a smoother game.',
    sections: [
      { t: 'Smoother Play', icon: 'goal', items: [
        'Far fewer hitches while you walk and run, on every graphics setting and above all on Ultra: the game no longer stalls for a moment when new trees come into view, when you pass behind a trunk, or every few seconds as the sun moves, and it sends the graphics card much less work each frame.',
        'The automatic resolution no longer drops a step after a single slow frame, which itself caused a stutter.',
        'A <b>Performance overlay</b> (F3, or in the settings) shows your frame rate, a graph of recent frames, the hitches and what caused the last one. If the game stutters for you, a screenshot of it helps us find out why.',
      ] },
      { t: 'Fighting', icon: 'bow', items: [
        '<b>Dryads\' thorns:</b> a dryad now raises her arm to throw, and you see a green glow gather in her hand first. The thorn is a glowing bramble bolt trailing light and leaves, slow enough to see coming: step aside, roll under it or block it. You hear it leave her hand and crack where it strikes, in a burst of leaves.',
        'Hit a dryad while she winds up and her throw is broken off.',
        'Every enemy\'s blow lands when its swing does: hogs, dryads, dryadlings, giants, skeletons, the Minotaur and the Chimera all play their whole attack, wind-up included, and you are hurt only at the moment of the strike.',
        'An enemy commits to its swing a moment before it lands: step out of the way, back off or roll, and it misses. A blow must catch you in front of the attacker and within its reach.',
        'The Minotaur\'s war cry, his labrys slam and the rock he throws, and the Chimera\'s claws, sting, fire and pounce now all come with the moment you see in the animation. The Minotaur throws his rock from his hand, and the Chimera breathes its fire with its head lowered at you.',
        'When you are hurt, a red glow at the edge of the screen shows which way the blow came from.',
      ] },
      { t: 'Night and Weather', icon: 'moon', items: [
        '<b>Moonlit nights:</b> night now falls because the sun\'s light goes, not because the screen is tinted blue. The moon lights the land in a dim, cool silver, casting soft shadows near you; the sky turns a deep blue-black full of stars, and a campfire\'s warm glow stands out against it. Under thick cloud the night is very dark.',
        '<b>Forest fog:</b> one spell in five in the Yleos forest brings a deep, pale fog that lies low among the trunks. You see only some thirty metres along the ground, while the dark crowns loom out of it overhead.',
        'The Yleos forest is darker and heavier than before, its shade a deep green-teal, and a thin mist always lies on its floor, thicker in the early morning.',
        'A clear night is dark but readable: the moon and the night sky light the land a cool blue, the woods fill with a faint moonlit haze between the trunks, and the horizon stays a shade lighter than the hills. Under heavy cloud the night is still nearly black.',
        'The haze on the horizon no longer creeps up into the open sky above the treetops: the sky overhead stays clear.',
        'After a long journey, or as the sun comes up, the shade of the trees in the distance and the sunlight in the woods\' air are right straight away, instead of glowing through crowns that weren\'t there until you had taken a few steps.',
      ] },
      { t: 'The Land', icon: 'stone', items: [
        'Each land now looks and feels different underfoot. The meadows of Pedias are flatter and gentler, sunny green and gold, with dry patches and worn earthen paths winding across them where the grass grows thin.',
        'The Yleos forest floor is dark loam strewn with needles and twigs, with cushions of moss and roots snaking across it, over rougher, hummocky ground.',
        'At the edge of the marsh the ground turns to dark, wet mud with water shining in its hollows.',
        'Walking up a hillside, your feet now come down on the slope instead of dipping into it.',
        'When the camera ends up inside a tree or right against its trunk in a thick wood, the tree fades out of the way instead of filling half the screen, and a tree faded between you and the camera keeps its leaves.',
        '<b>Life in the air:</b> butterflies flutter over the meadows by day; in the forest, tiny motes and spores glitter in the shafts of sun; at the marsh\'s edge low mist drifts over the ground and pale wisps of swamp gas rise and fade, glowing faintly at night.',
      ] },
      { t: 'Trees and Plants', icon: 'tomato', items: [
        'Every tree stands taller, by almost a third, and the woods of the meadows are a fifth thinner, with more light and room between the trunks.',
        'Pedias grows broad, round-crowned trees only: olives, oaks, holm oaks, plane trees, pomegranates and figs. The cypresses by the temple\'s sacred way still stand.',
        'The Yleos hills are a dark forest of firs and cypresses, with fig trees among them. The giants of the old forest still tower over the belt between the meadows and the hills.',
        'The mushrooms are gone from the forest floor.',
        '<b>Tomato bushes</b> grow here and there in the meadows and along the edges of the woods. Press E to pick 8 to 12 tomatoes, and now and then a tomato seed; the bush grows its fruit back in a day. An axe cuts one down for 6 to 8 wood.',
        '<b>Tomatoes</b> are a light food: a little health and plenty of stamina for a quarter of an hour.',
        'The grass of Pedias grows in full, leafy clumps, with tufts of tall grass in the tall patches, all swaying in the wind as before. The grass you walk through parts in a ring half as wide round your feet.',
      ] },
      { t: 'Sitting and Pictures', icon: 'you', items: [
        'Press <b>X</b> to sit down cross-legged on the ground (it used to be Z), facing the fire if one burns nearby. X again or Space stands you up. With the hammer in hand, X still takes down a piece.',
        'While you sit, the camera is free for pictures: the mouse takes it all the way round, down low over the grass or high above, the wheel brings it close or far, and WASD with Q and E move what it looks at, up to 30 metres from you. <b>F10</b> hides the HUD. Stand up and the camera comes back behind you.',
      ] },
      { t: 'Building and Crafting', icon: 'hammer', items: [
        '<b>Repairing</b> tools, weapons and armour at the workbench is free now: no materials, just the bench.',
        'The wooden door fills its frame: it is wider and taller, its top follows the arch and its foot the sill, with no more gap down the sides.',
      ] },
    ],
  },
  {
    id: 'patch-19', name: 'Patch 19', title: 'Storm and Shade', date: '13 November 2026',
    intro: 'Zeus\'s storm towers over the marsh, the temple stands on its own hill, Olympos has become a true mountain and the Giants live in caves. Real shadows fall across the land, and the fog and the storms finally look the part.',
    sections: [
      { t: 'The Temple of Zeus', icon: 'temple', items: [
        'The temple stands on its own hill now, bigger and grander: columns seven times your height, doors fit for a god, and a great hall round a towering Zeus.',
        'A broad marble plaza surrounds it, and a paved sacred way climbs the hill between tall cypresses, through a marble gateway and past the lions. Olives, plane trees, myrtle and lavender grow round the hill.',
        'The back door is as grand as the front, and the slim posts inside are now great columns that reach the roof.',
      ] },
      { t: 'The Giants\' Caves', icon: 'stone', items: [
        'Each Giant now lives in a cave inside a wooded hill: a cliff with roots hanging over the mouth, fallen boulders and a worn path. You can climb the hill and walk over it.',
        'Inside, a smoky lair lit by his fire: his supper on the spit, a bed of straw and hides, heaps of bones, his club, hunts painted on the walls, stalactites, glowing mushrooms in the damp, and the carving lit at the back.',
      ] },
      { t: 'Olympos', icon: 'goal', items: [
        'Olympos has grown into a true mountain of ridges, gullies and crags, with snow lying high up. Its upper faces are too steep to climb: a single mule track winds up it, past cairns, to the old altar at the top.',
      ] },
      { t: 'Zeus\'s Storm', icon: 'wet', items: [
        'The storm that seals the marsh is now a towering wall of churning black cloud, five times taller than before, with a ragged shelf, rain sheets and lightning flickering inside it. You can see it looming from across the island.',
        'Three great rolls of storm cloud circle the wall at its foot, its middle and its crown, turning slowly round it, each the other way from the one below.',
        'Its thunder carries only so far: a faint rumble now and then from the temple, growing as you come nearer, and the full roar of wind and storm right at its foot. On Olympos you won\'t hear it at all.',
        '<b>Thunderstorms:</b> forked bolts strike the land, the whole world flashes blue-white, and wet stone and leaves glint in it. The thunder follows a moment later, sooner the closer the strike. At night a close strike lights up the land for an instant.',
        'A new setting, <b>Reduce flashing</b>, softens lightning and other bright flashes.',
      ] },
      { t: 'Weather and Sky', icon: 'wet', items: [
        '<b>Fog</b> is thick now: you see only some thirty metres, the sky disappears, and the light goes soft and grey.',
        '<b>Three kinds of fog:</b> a fog, a thick fog where you see half as far, and a dense fog where the world ends ten metres away. The thicker ones are rarer, more common in the forest and the marsh, and the dense one comes mostly at night and in the early morning. Fog rolls in and lifts slowly, over a minute or so.',
        'Fog is pale grey-white by day, a dark blue by night and a green grey over the marsh, and it glows warmer and brighter towards the sun. Fires, braziers and torches glow through it with a soft halo.',
        '<b>Light on the lens:</b> look towards the sun through fog or mist and soft stains of light bloom on the screen, as on a camera lens, fading as you turn away. On a clear day you see only a hint of them. (High and Ultra graphics; gentler with Reduce flashing.)',
        'The sun now crosses the sky from the side, so it no longer sets behind Olympos or rises out of the storm.',
        '<b>New clouds:</b> billowing low-poly cumulus with flat grey bases drift across the sky with the wind, a few on a fine day, crowds of them and a few towering ones when it clouds over, golden at dawn and dusk and dark blue by moonlight, with great banks of cloud low on the horizon. None drift into Zeus\'s storm.',
        '<b>Storms are heavy now:</b> a thick, low, lumpy ceiling of dark cloud covers the whole sky in heavy rain and thunderstorms, with ragged cloud racing beneath it. No more stars, moon or sun through a storm, and lightning lights the clouds up from inside.',
        '<b>Olympos makes its own weather:</b> soft rings of cloud wrap round its upper slopes in layers, turning slowly round the peak, now and then with one more ring hugging the summit, and mist pools in the valleys at its foot in the morning. More of it in bad weather and early in the day; some days it clears. Climb into one and you walk through the fog of the cloud itself.',
      ] },
      { t: 'Every Blow Counts', icon: 'log', items: [
        'You feel every blow now, as in Valheim: the view gives a short, sharp kick when your axe bites into a trunk, harder when a pickaxe rings on rock, and a big jolt when a tree crashes down beside you. Heavy blows hold your swing for a split second where they land.',
        'Chips, splinters and bark fly off wood, stone chips, dust and sparks off rock, and leaves and twigs off bushes. Every chop and strike sounds a little different, a thin trunk higher than a great one.',
        'The wrong tool only gives a dull clink and a little jolt: an axe glances off rock, a pickaxe off a trunk.',
        '<b>Bushes give wood:</b> chop a bush (the leafy bushes, myrtle, broom and the red-leaved bushes of the hills) two to four times by its size and it is gone, leaving one to three wood, and sometimes a little fiber. Old stumps, fallen logs and driftwood can be chopped up for wood too. Flowers, ferns, lavender, grass and moss are left alone. What you clear stays cleared.',
        'In a fight your blows land with a punch: a light one with a dagger, a heavy one with an axe or club, the heaviest on a killing blow. Blows you take jolt the view by how much they hurt, and blocks and parries strike sparks with a crisp jolt. A swing that hits nothing doesn\'t shake at all.',
        'A new setting, <b>Camera shake</b>: On, Reduced or Off.',
      ] },
      { t: 'Small Things', icon: 'build', items: [
        'A felled tree leaves a log and a stump as thick as its trunk was.',
        'The lightstone dagger is held the right way round, blade forward.',
        'Footsteps are a little softer, and quieter still the further you pull the camera back.',
        'Things dropped on top of a cave\'s hill stay there instead of falling through to the cave floor.',
        'The owl speaks about the temple as you reach its plaza, not only once you are on its steps.',
      ] },
      { t: 'Shadows', icon: 'blessing', items: [
        'The trees cast their shadows again. The forest floor is a patchwork of shade and dappled sun, and the trunks throw long stripes when the sun is low.',
        'Shadows are deeper and a little blue, not a faint grey, so you can see the shade of a rock, a wall or your hero in bright daylight.',
        'Shadows now reach well into the distance, not just the area right around you: woods and buildings far ahead throw shade too.',
        'Shadows are soft where they fall from high up, like the shade of a treetop, and sharp where something touches the ground, like your feet or a stone.',
        'The meadow grass and wildflowers take the shade of the trees, rocks and your hero.',
        'Far-off forests look darker beneath their treetops, as near ones do.',
      ] },
      { t: 'Light', icon: 'goal', items: [
        'Corners, steps, the foot of a column, the base of a tree and the ground under a boulder are softly shaded, so everything sits in the world instead of floating on it (Medium and High settings).',
        'Rays of light in the woods reach further, and still don\'t change as you walk.',
        'By moonlight the trees cast faint shadows close by.',
        'A new <b>Ultra</b> graphics setting, above High, for powerful PCs. It sees about twice as far: the mist starts further out, full trees, grass and flowers reach much further, and the whole forest stays on the hills to the horizon. It also adds sharper, smoother edges and shadows, the sea mirroring the shore, more firelight at once, and a sharper picture when your graphics card has room to spare. Its view distance comes in after a reload. High, Medium and Low are unchanged.',
      ] },
      { t: 'Your hero', icon: 'you', items: [
        'Your hero walks and runs on straight legs: the feet land side by side under the hips instead of crossing in a line, and the ankles no longer bend inwards.',
        'The woman stands and moves with her feet flat on the ground, not rolled onto their inner edges.',
        'A foot set down stands flat on the ground, across a slope too.',
      ] },
    ],
  },
  {
    id: 'patch-18', name: 'Patch 18', title: 'Steady Light', date: '13 November 2026',
    intro: 'The light in the woods no longer flickers on and off as you walk, and the nights have their crickets back.',
    sections: [
      { t: 'Light', icon: 'blessing', items: [
        'Sunbeams stay put. You can see them from a distance, walk up to them and through them, and they don\'t vanish or pop back.',
        'Leaving the woods no longer floods the screen with white light, and walking two steps on no longer switches it all off.',
        'Shafts of sun break through gaps in the leaves, past temple columns and over hills, strongest when the sun is low and in front of you.',
        'Woods have a soft, thin haze that glows towards the sun. Far woods look hazy too.',
        'Shade and dappled sunlight under the trees no longer change shape as you walk closer to a tree.',
        'Nights are calmer: moonlit blue and dark, with no bright fog in the woods.',
      ] },
      { t: 'Sound', icon: 'owl', items: [
        'You can hear the crickets now. They start at dusk, sing loudest in the meadows and at the edges of woods, and go quiet at dawn.',
        'An owl calls from the trees now and then at night, and sometimes a fox cries far away.',
        'You hear the wind in the leaves wherever there are trees around you, by day and by night.',
        'More birdsong by day, and the countryside sounds a little fuller overall.',
      ] },
      { t: 'The Map', icon: 'goal', items: [
        'The abandoned town is no longer marked on your map: you\'ll have to come upon it yourself.',
      ] },
    ],
  },
  {
    id: 'patch-17', name: 'Patch 17', title: 'A Hero Who Moves', date: '12 November 2026',
    intro: 'Your hero walks, sneaks, swims, fights, kneels and rests like a real person, and the woods are lit by real sunbeams.',
    sections: [
      { t: 'Moving', icon: 'jump', items: [
        '<b>Sneaking</b> (Ctrl) crouches you low, creeping forward, back and sideways.',
        'A real walk when you move slowly, and proper steps backwards and sideways while you aim or block.',
        'Real swimming with your head above the water, treading water when you stop, a falling pose in long drops and a hard landing after big ones.',
        'Your hero breathes while standing, and looks around if you wait a while.',
        'Footsteps sound with every step, walking and sneaking too.',
      ] },
      { t: 'Fighting', icon: 'hammer', items: [
        'Each weapon moves its own way: axes and clubs chop and sweep, daggers stab and slash, spears thrust.',
        'A shield and a one-handed weapon give you a guard stance, and blocking shows it.',
        '<b>Dodge roll:</b> press Space while blocking to roll out of the way (it costs stamina, and blows can\'t touch you mid-roll).',
        '<b>Kick</b> (Q) to shove small creatures back.',
        'You flinch from hits, stagger from big ones, and fall properly when you die, then get up again at your spawn.',
      ] },
      { t: 'Living', icon: 'fire', items: [
        '<b>Praying</b> at Zeus\'s altar: you kneel for a few moments while the light gathers. Move away and the prayer is broken.',
        '<b>Eating</b> takes a moment, bite by bite. Strike, block or take a heavy blow and you stop, keeping your food.',
        '<b>Sit</b> (Z) on the ground, facing the fire if one is near. Rest by a burning fire for a while and you\'ll feel <b>Rested</b>.',
        'You lie down to sleep in your bed and get up in the morning.',
        'You bend to pick things up, throw what you drop, and swing your hammer as each piece goes into place.',
        '<b>Wave</b> (G) and <b>cheer</b> (H). Your hero waves the owl goodbye and cheers when a great beast falls.',
        'The man no longer looks like he\'s wearing dark glasses: real eyebrows at last.',
      ] },
      { t: 'Light', icon: 'blessing', items: [
        'Sunlight through the woods comes from the real leaves now: the dappled light stays where it falls, and you walk through it.',
        'Clear sunbeams slant between the trees, strongest at morning and evening.',
      ] },
    ],
  },
  {
    id: 'patch-16', name: 'Patch 16', title: 'Light Between the Trees', date: '12 November 2026',
    intro: 'Sunbeams in the woods, moonlit nights and fireflies, a grander temple, families of animals, and a hero who holds his tools properly.',
    sections: [
      { t: 'Light', icon: 'blessing', items: [
        '<b>Light in the woods:</b> sunbeams slant down between the trees through a soft haze, golden and thickest at morning and evening, and the forest floor is dappled with sun and shade.',
        '<b>Moonlit nights:</b> nights are blue and dark but readable, in the woods too, and your torches and fires glow warm against them.',
        '<b>Fireflies</b> drift over the meadows on clear nights.',
      ] },
      { t: 'Your Hero', icon: 'you', items: [
        'Tools and weapons sit properly in the hand: axe blades, hammer heads and dagger points face the way you swing.',
        'Footsteps sound the moment each foot touches the ground, at any pace.',
        'Your feet no longer cross over each other when you run.',
        'The <b>Cretan cape</b> now shows when you wear it, and streams out behind you as you run.',
        'The minimap is bigger.',
      ] },
      { t: 'The Woods', icon: 'tree', items: [
        'Trees stand deeper in the earth: no more roots sticking out like legs.',
        'Trees shake when your axe bites into them.',
        'The <b>ancient olives</b>: the carved stone now stands clear of the trunk where you can see it, with a small offering fire and its smoke beside it, so you can spot them from afar.',
      ] },
      { t: 'The Temple of Zeus', icon: 'temple', items: [
        'The temple is half as big again, with doorways a person can walk through. Inside there are rugs, lit braziers, offering tables, jars and banners, and an open way through to the back room.',
        'Carrying a boss\'s head? A column of golden light rises over its offering stand, and the stand is on your map and compass. Fires now burn beside the altar and the stands.',
        'The head you offer is the <b>beast\'s own head</b>, set on the stand for all to see.',
        'Fires everywhere burn with soft, flickering flames.',
      ] },
      { t: 'Creatures', icon: 'bull', items: [
        'Some <b>hogs</b> roam as a sow with her piglets. Anger one and the whole family comes for you.',
        'Some <b>does</b> walk with a fawn, which runs when she runs.',
        'Hares are bigger, hop in quick bursts and wear natural coats.',
        'Animals no longer pile into one spot when they charge you.',
      ] },
      { t: 'Things to Find', icon: 'goal', items: [
        '<b>Feathers</b> are bigger and brighter, and sparkle so you can spot them; lightstone glints faintly too.',
        'Four old chests wait in the <b>abandoned town</b>: rope and food, a bundle of arrows, leather and fibre, and a simple helmet.',
      ] },
    ],
  },
  {
    id: 'patch-15', name: 'Patch 15', title: 'Who Wakes on the Shore', date: '12 November 2026',
    intro: 'Make your own hero, walk through sturdier woods, and see the great places of Nisos rebuilt.',
    sections: [
      { t: 'Your Hero', icon: 'you', items: [
        'A new trial begins by choosing <b>who wakes on the shore</b>: man or woman, skin, hair and its colour, beard, eyes, clothes, and a laurel or golden wreath. Change your look any time from the pause menu (Appearance); your saved game remembers it.',
        'No more heavy "sunglasses" brows on the man\'s face.',
      ] },
      { t: 'The Woods', icon: 'tree', items: [
        'Fixed: trees no longer look crooked or broken up close, their crowns are full again (no more seeing through the olives), and their roots sit in the ground instead of standing clear of it on slopes.',
        'Silver birches no longer glare white in the sun.',
      ] },
      { t: 'The Great Places', icon: 'temple', items: [
        'The <b>Temple of Zeus</b>, the Labyrinth, the abandoned farmhouse, the Chimera\'s shrine and the summit of Olympos are rebuilt: a great painted temple with gold reliefs on its pediment, ashlar walls and a horned gate for the Minotaur\'s arena, a farmhouse with its loom and bread oven, and a mossy shrine with the Chimera in bronze on its altar.',
      ] },
      { t: 'Creatures', icon: 'bull', items: [
        'Most animals you meet are now grown, and their coats look like they belong in Greece (no more glowing markings). The dryad carries her staff where you can see it.',
      ] },
      { t: 'Things and Places', icon: 'build', items: [
        'Every tool, weapon, piece of armour, food, material and building piece has an icon showing its own model, and the pack, crafting and build menus have new copper-rimmed frames, bars and buttons.',
        'Fallen branches lie on the ground, felled trees leave proper logs, the bed is a real low bed, and log walls no longer let daylight through their corners.',
        'Your footsteps now sound different on rock, sand, leaves, boards and water, and land the same way.',
      ] },
    ],
  },
  {
    id: 'patch-14', name: 'Patch 14', title: 'New Leaves', date: '12 November 2026',
    intro: 'A new look for much of Nisos, chosen by our playtesters: the trees, the creatures, the hero and what you build.',
    sections: [
      { t: 'The Woods', icon: 'tree', items: [
        'All-new trees: broad <b>meadow trees</b> with great spreading trunks, orchard trees, silver birches, and tall pines in the hills and the forest of Yleos. Every crown is made of real leaves that move in the wind.',
        'New bushes, flowering lavender, new rocks and boulders, and the marble ruins in the grass: fallen column drums, scattered blocks and broken statues.',
        'Bare pines in the marsh and dead trees in the woods.',
      ] },
      { t: 'You', icon: 'you', items: [
        'You begin as a plain islander, and the armour you make now shows on you piece by piece.',
        'Play as a <b>man or a woman</b>: choose under Hero in the settings.',
      ] },
      { t: 'Creatures', icon: 'bull', items: [
        'Animals come young and grown: <b>fawns, does and stags</b>, fox cubs, leverets and piglets, each with its own coat, so no two herds look alike.',
        'New bodies for the giants (now swinging a spiked mace), the dryads (forest witches with a staff) and the dryadlings.',
      ] },
      { t: 'Around the Island', icon: 'temple', items: [
        'A new <b>statue of Zeus</b> in the temple, hoplite guardians along the sacred way and a pair of stone lions where it comes in. Broken statues lie in the labyrinth and at the Chimera\'s shrine, and a water-bearer stands by the ancient olives.',
        'New looks for what you gather: stones, branches, lightstone, dandelions, moonflowers, feathers, bones and fiber bushes, each in several shapes. Fallen trees leave proper logs, what you drop lies in a basket, and graves are marked with a marble stele.',
      ] },
      { t: 'Building', icon: 'build', items: [
        'Buildings have a new look: plank floors, a heavy timber door frame and plank door, thatched gable ends, a stick fence, a stone campfire, a smaller rack for the cooking stand, a new bed and a tall standing torch.',
      ] },
      { t: 'Sound', icon: 'jump', items: [
        'New footsteps on grass, earth, rock and wooden floors.',
      ] },
    ],
  },
  {
    id: 'patch-13', name: 'Patch 13', title: 'Each in Its Place', date: '11 November 2026',
    intro: 'The plants of Nisos now grow where they belong, and look as they should up close.',
    sections: [
      { t: 'Fixed', icon: 'goal', items: [
        'No more <b>strange patches of colour</b> on plants: the coloured squares in the marsh, the red-and-white zigzags on some pines, the grey lumps where bushes should be, and flowers growing out of grey stones are all gone.',
        'Pines and the forest\'s bushes have proper needles and leaves now, swaying in the wind.',
        'Flowers, grass and the small things on the ground no longer vanish all at once in a ring around you. Each one sinks gently into the ground at its own distance as you walk away.',
        'Pebbles and rocks are stone-coloured again, not glaring white in the sun.',
      ] },
      { t: 'The Meadows', icon: 'tree', items: [
        'Each stretch of meadow has its own flowers: <b>fields of poppies</b> in one place, lavender, purple anemones or yellow crown daisies in another, with a few others mixed in.',
        'Tall grass grows in tussocks, and real shrubs line the edges of the woods. Lavender grows from a mound of grey-green leaves.',
      ] },
      { t: 'The Forests and the Marsh', icon: 'wet', items: [
        'Leafy undergrowth and <b>moss</b> beneath the forest trees. Brown mushrooms at their feet, and red-capped fly agarics in the giant forest.',
        'Meadow flowers no longer stray into the forest or the marsh. The marsh has water lilies in flower, cattails, sedge and mossy banks.',
      ] },
    ],
  },
  {
    id: 'patch-12', name: 'Patch 12', title: 'Undergrowth', date: '11 November 2026',
    intro: 'The ground of Nisos has filled in: flowers, bushes and the litter of the woods, everywhere you walk.',
    sections: [
      { t: 'The Meadows', icon: 'tree', items: [
        'Drifts of <b>wildflowers</b> in the open meadows and the clearings: poppies, marigolds, irises, daisies and more, each drift mostly of one kind.',
        'Tufts of tall grass, and leafy bushes along the edges of the woods.',
      ] },
      { t: 'The Forests', icon: 'log', items: [
        'Stumps, fallen logs, branches and roots on the forest floor, and little clusters of mushrooms at the feet of the trees. The giant forest has the most.',
        'More kinds of trees: new pines and firs in the hills, rounder holm oaks, bare dead trees, and a second pomegranate.',
      ] },
      { t: 'Water and Stone', icon: 'wet', items: [
        'Lily pads on the marsh pools, sedge along their banks, half-drowned logs. Driftwood washed up on the shore.',
        'Pebbles everywhere, and scree on the rocky slopes.',
        'Nothing you had cut or gathered comes back: everything new grows in between.',
      ] },
    ],
  },
  {
    id: 'patch-11', name: 'Patch 11', title: 'Lost Places', date: '11 November 2026',
    intro: 'People lived on Nisos once. Out in the meadows you can now find what they left behind.',
    sections: [
      { t: 'The Abandoned Town', icon: 'roof', items: [
        'Far out in the meadows lies <b>a little town</b>, long empty: two paved streets crossing at a square with a fountain, a well and a statue, market stalls under the vines, a colonnaded stoa and the ruins of a temple.',
        'A dozen houses face the streets, some still roofed, some fallen in. Walk in through their doorways or the gaps where walls came down; a roof still keeps the rain off.',
        'Behind the houses: a smithy\'s yard with its forge and kiln, and a walled garden of figs and pomegranates. It goes on your map once you have found it.',
      ] },
      { t: 'About the Island', icon: 'temple', items: [
        'Small places all over Nisos: a roadside shrine, a cart lost on the way to market, a fallen colonnade, a shepherd\'s camp, a farmer\'s hut, an old well under an olive, the last of a lookout, a vineyard\'s rest.',
        'Trees and pickups near these new places have moved, so any you had cut or gathered there grow back.',
      ] },
      { t: 'You', icon: 'goal', items: [
        '<b>Better proportions:</b> longer legs, shorter arms and smaller hands, so you no longer look squat beside the doorways and your armour.',
        'Axes, hammers, daggers and the rest are gripped in your fist now, not beside it, and your bow hand closes round the bow\'s grip.',
        'Shields are strapped to your forearm, face out, so your arm no longer pokes through them.',
      ] },
    ],
  },
  {
    id: 'patch-10', name: 'Patch 10', title: 'New Faces', date: '11 November 2026',
    intro: 'Nisos has a new look: a new hero, new creatures and bosses, new trees, new buildings to build, new tools and new sounds.',
    sections: [
      { t: 'You', icon: 'goal', items: [
        'You are a young Cretan in a white chiton now, with the same moves as before.',
        'New tools in your hands: axes, club, daggers, a building mallet, a pickaxe, a spade for the garden, a wooden spear and a torch.',
        'The Cretan Bow and its arrows, the two shields and the Lightstone Spear are new too: a labrys on the small shield, Athena\'s owl on the great one.',
        '<b>You wear your armour now.</b> The Thrower set is a felt cap, a patterned linen corslet and greaves; the Cretan set a bronze helmet, a scaled corslet and gilded greaves. Each piece shows on its own, so you can mix them.',
        'A torch\'s flame burns straight up and flickers, however you hold it.',
      ] },
      { t: 'Creatures', icon: 'bull', items: [
        'Deer, stags, foxes, hares and boars are new, fully animated animals: they walk, run, graze, attack, flinch and fall with their own movements.',
        '<b>The Minotaur</b> is new: horned and armoured, his great axe in hand. He paws the ground before he charges, roars, staggers when he runs into a wall, and his blows land when his axe does.',
        'The skeletons that rise to help him, the dryads, the giants and the dryadlings all have new bodies. <b>The Chimera</b> is now a great spined beast.',
        'The Owl is a real barn owl now, gliding, flapping and hovering beside you.',
      ] },
      { t: 'The World', icon: 'temple', items: [
        'New trees everywhere: olives and cypresses, oaks, figs, pines and firs, with new rocks, bushes, reeds and ferns, and new ruins in the countryside.',
        'The sites have new pottery, tripods, firewood, marble columns and painted statues.',
        'What you find on the ground is new: stones, branches, fiber bushes, bones, and a sack for whatever you drop.',
      ] },
      { t: 'Building', icon: 'hammerBuild', items: [
        'Every building piece has a new look: log walls, plank floors and doors, thatch roofs and gables, stairs, fences, a palisade and gates. They snap and hold up exactly as before.',
        'The workbench, campfire, cooking stand, bed, chest and standing torch are new too.',
      ] },
      { t: 'Sound', icon: 'wet', items: [
        'Real footsteps on grass, earth, stone, wood and water; landings, doors, chests and the ring of a pick on stone.',
        'Birdsong by day, crickets at night, and recorded rain, storms and thunder.',
      ] },
    ],
  },
  {
    id: 'patch-9', name: 'Patch 9', title: 'Firm Ground', date: '20 October 2026',
    intro: 'Building on hills: walls and floors now stand on the ground, however long the row.',
    sections: [
      { t: 'Building', icon: 'hammerBuild', items: [
        'Fixed: a row of walls built down a slope left gaps underneath, and after a few walls it said "Nothing holds it up". Now every wall or floor built at ground level stands on the ground: the earth rises to meet it along its whole length, and it is held up fully, however long the row.',
        'Keep a row level over ground that falls away and it carries on while the earth can be raised to it (up to about two and a half metres). Past that the game tells you to build a wall under it first; once there is one, the row carries on along its top.',
        'Aiming at the ground ahead of a row on a slope now places the next wall on the ground there, instead of half buried a whole storey down in the hill.',
        '<b>See where a floor goes</b>: while you aim a floor, the ground under the green tile is already flattened to it and the grass round it parts, so the tile is never hidden in the grass. Stop aiming and it all comes back.',
        'Fixed: grass and flowers grew up through floors built on a slope. The ground under a floor is now flattened to it, raised where it was low, and bare.',
        'Upper storeys, a wall standing on a wall, and floors laid on walls are unchanged: they rest on what you have built and leave the ground alone.',
      ] },
    ],
  },
  {
    id: 'patch-8', name: 'Patch 8', title: 'Wind and Earth', date: '19 October 2026',
    intro: 'You can see the wind now, and what you build sits on the ground instead of hanging over it.',
    sections: [
      { t: 'Building', icon: 'hammerBuild', items: [
        '<b>The ground meets your building</b>: on a slope, the earth now rises to meet a floor or a wall built on it, with a gentle grassy bank round the edge, so nothing is left hanging in the air. Where the ground is higher it is still pressed down under the boards.',
        'A floor high up (an upper storey, a balcony, anything on posts) leaves the ground alone, and taking a piece down puts the ground back as it was.',
      ] },
      { t: 'Weather', icon: 'wet', items: [
        '<b>Wind you can see</b>: faint, thin white strands flow through the air with the wind, spread out across the land into the distance, waving gently and now and then curling into a small hook; a few in a breeze, more in a gale. They belong to the place they blow through (they don\'t follow you), and only in the open, not under roofs or trees.',
        'The wind now has a direction that slowly changes, and it grows stronger as the weather turns. The rain slants with it.',
        '<b>Everything blows with the wind</b>: the grass and flowers lean downwind with waves of gusts rolling across the meadows, the trees sway and lean that way with their leaves fluttering, and the clouds drift along it. Gentle on a fair day, wild in a storm.',
      ] },
    ],
  },
  {
    id: 'patch-7', name: 'Patch 7', title: 'After the Rain', date: '17 October 2026',
    intro: 'The rain now soaks the island, and it no longer falls inside your house.',
    sections: [
      { t: 'Weather', icon: 'wet', items: [
        'Fixed: rain fell inside houses you had built, even under a roof. A roof now keeps the rain out, and the ground under it stays dry.',
        '<b>New rain</b>: thousands of drops slanting with the wind, harder in a storm. Only a little gets through the leaves under a tree.',
        '<b>The world gets wet</b>: in the rain the ground, stone, wood, thatch and leaves turn darker and glisten, and slowly dry again afterwards, faster in the sun.',
        '<b>Puddles</b> gather on flat open ground as the rain goes on, and the drops ring the puddles, the sea and the marsh with ripples.',
      ] },
    ],
  },
  {
    id: 'patch-6', name: 'Patch 6', title: 'Smooth Going', date: '17 October 2026',
    intro: 'Nothing new to find, but the island runs more smoothly as you travel.',
    sections: [
      { t: 'Graphics and performance', icon: 'blessing', items: [
        'Running into new ground no longer makes the game stutter now and then: what lies about in each new stretch of land is worked out in the background.',
        'The first click or key press no longer freezes the game for a moment: the sound starts up while the island loads.',
        'After you come back from a fall, the grass round you appears sooner.',
        'The first time you see something, it no longer hitches: everything is prepared while the island loads.',
      ] },
      { t: 'Other', icon: 'goal', items: [
        'The title screen now shows which build you are playing, next to the patch.',
      ] },
    ],
  },
  {
    id: 'patch-5', name: 'Patch 5', title: 'Into the Woods', date: '16 October 2026',
    intro: 'Pedias is now mostly forest, the grass reaches far out around you, and steep ground looks like real rock.',
    sections: [
      { t: 'The world', icon: 'temple', items: [
        '<b>Deeper woods</b>: woods now cover most of Pedias, about seven tenths of it, with open clearings of every size between them, from small glades to wide meadows.',
        'The temple, the farmhouse, the Labyrinth and the sacred olives each stand in a clearing of their own, so you can see them from the edge of the wood.',
        '<b>Rock that looks like rock</b>: steep ground now shows cracked slabs of stone in different greys, with layers running along the hillside, a little lichen, and a surface that catches the light.',
        'The edge between grass and rock is now ragged, with tongues of rock reaching a little way down the slope, instead of a clean line. Everything steeper than about 25° is still bare rock.',
      ] },
      { t: 'Graphics and performance', icon: 'blessing', items: [
        '<b>Grass all around you</b>: the grass now reaches about 80 metres out (it used to stop at about 40), with fewer, broader blades further away so it costs little to draw.',
        '<b>The mist now lies on the edge of the grass</b>: clear for about 60 metres, it thickens to hide about two thirds of what lies beyond 100 metres. Behind it the game draws even less than before.',
        'Fixed: the crowns of distant giant trees showed as black shapes over the mist. They are now hidden in it like everything else far away.',
      ] },
      { t: 'Saves', icon: 'goal', items: [
        'The woods have changed, so a world saved before this patch keeps your pack, buildings and progress, but its felled trees and gathered items grow back.',
      ] },
    ],
  },
  {
    id: 'patch-4', name: 'Patch 4', title: 'Woods and Stone', date: '15 October 2026',
    intro: 'A new look for the land: real woods and open meadows, bare rock where the ground is steep, and a mist that lets the game draw far less in the distance.',
    sections: [
      { t: 'The world', icon: 'temple', items: [
        '<b>The woods of Pedias</b>: trees now grow together in woods of every size, from small islands to great forest belts along the hills, with wide open meadow between. No tree stands alone or in a pair out in the open.',
        '<b>Taller grass</b>: here and there are patches where the grass all stands taller, up to your waist and chest, ripening golden at the tips. Most are in the meadows, some in the marsh and the forest.',
        'Grass no longer grows in or over rocks, boulders, tree trunks, shrubs or ruins: a little clear ground is left round each, as round things lying on the ground.',
        '<b>Tall trees</b>: every tree has a clear trunk, its crown starting well above your head, so in a wood you can see between the trunks.',
        'Small orchards of olive, pomegranate and fig trees dot the meadows, so tribute fruit is still near at hand.',
        '<b>Bare rock</b>: wherever the ground is steeper than about 25°, it is bare rock. No grass, flowers, bushes or trees grow there, and only loose stones lie about, in little heaps.',
        'Fixed: lightstone never lay on the ground. Now it does, mostly in the forest hills.',
      ] },
      { t: 'Graphics and performance', icon: 'blessing', items: [
        '<b>A mist hangs around you</b> beyond about 100 metres, rising a little above the tallest things near you (trees, giants, buildings), with the sky clear above it. Behind it the game draws far less: about half the trees, a tenth of the big rocks and none of the small plants, and the farmhouse, caves and olive markers only once you come near. The great landmarks stay in sight. Everything comes back as you approach.',
        'The edges of the screen soften around the centre of your view, where you are looking, which hides the simpler detail in the distance.',
      ] },
      { t: 'Saves', icon: 'goal', items: [
        'The land has changed, so a world saved before this patch keeps your pack, buildings and progress, but its felled trees and gathered items grow back.',
      ] },
    ],
  },
  {
    id: 'patch-3', name: 'Patch 3', title: 'Square and True', date: '15 October 2026',
    intro: 'A building patch: pieces now go where you aim, at any angle, from inside or out.',
    sections: [
      { t: 'Building', icon: 'hammer', items: [
        'Fixed: next to a floor or wall built at an angle, the next piece was refused with "Already built here". Pieces fit side by side at any angle now.',
        'Fixed: roof panels kept going down onto the floor instead of onto the wall you aimed at. Aim at the top of a wall, from outside or inside (even just over its top edge), and the panel sits on it.',
        'Fixed: doors could hang in the air off a corner. A door now only goes into a door frame. Aim at the frame from either side and it settles into the opening, hinged on the side your turn chooses.',
        'New pieces line up with the building you aim at, even when you aim at the ground just past its edge.',
        'A floor laid off the top of a wall (for an upper storey) comes out toward you, inside the house, instead of straddling the wall.',
        'Pieces must stand on the ground or attach to your building. Nothing can be left floating against the side of a wall.',
        'Fixed: stairs never attached properly to an upper floor. Stairs now snap by the middle of each end to the middle of a floor\'s edge. Aim at the edge you want them to reach, or at the spot where they should start, and they run between the two. Stairs can no longer come up through the middle of a floor.',
        'Fences and stockades follow the ground: a fence line now runs up a hill instead of sinking into it.',
        'Fixed: in a one-room building, aiming at the spot for a wall across the room could put the wall on the near side instead.',
      ] },
      { t: 'Behind the scenes', icon: 'goal', items: [
        'Building is now checked by over 70 automatic tests that aim at a house from inside and out, square and turned at an angle, plus 300 random aims every run, so these problems stay fixed.',
        'An automatic builder now puts up a two-storey house with a terrace and outside stairs, a four-storey tower, a long hall and a fenced yard, aiming at every single piece the way you do. Then it walks up the stairs.',
      ] },
    ],
  },
  {
    id: 'patch-2', name: 'Patch 2', title: 'Hearth and Hillside', date: '13 October 2026',
    intro: 'Fixes for what our testers found in Patch 1: building roofs and cooking over the fire work the way they should, and the land itself is rougher underfoot.',
    sections: [
      { t: 'Building and cooking', icon: 'hammer', items: [
        'Fixed: a thatch roof panel would not go into the gap between two others. Aim into the gap and it snaps in. Every piece now snaps to what you aim through, not to whatever lies behind it.',
        'Fixed: the cooking stand could not be placed over a campfire. Aim at the fire, or close to it, and the stand settles right over it.',
        'Fixed: with a cooking stand over a campfire, E only offered to cook if you carried meat. E now lights or feeds the fire, and goes to the stand only when there is food to take off, or meat to cook over a burning fire. F still puts the fire out.',
      ] },
      { t: 'The world', icon: 'temple', items: [
        'The ground is rougher underfoot: small rises and dips on top of the rolling hills, gentle in the meadows and stronger in the forest hills. The ground around the temple, the Labyrinth and the other sites stays level.',
        'Far-off land now blurs softly into the haze, so the end of the view no longer ends in a sharp line.',
      ] },
    ],
  },
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
        'Fixed: a tree between the camera and you pulsed in and out instead of staying see-through.',
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
        'Fixed: long sessions slowly used up more and more graphics memory as creatures came and went and logs were split. The game now stays steady however long you play.',
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
      { t: 'Behind the scenes', icon: 'goal', items: [
        'Every update is now checked by an automatic playthrough of the whole trial, from the first stone to the Chimera\'s head, plus checks on building, combat, movement, frame rate and how each part of the island looks.',
        'A tireless bot now plays the game on its own (exploring, fighting, building, swimming, dying and saving) and reports anything that breaks. It has already found the graphics memory and tree flicker problems fixed above.',
      ] },
    ],
  },
];

// The notes as HTML (for the panel)
export function patchHTML(p) {
  return `<div class="pnhead"><span class="pnname">${p.name}</span><h3>${p.title}</h3><span class="pndate">${p.date}</span></div>
    <p class="pnintro">${p.intro}</p>
    ${p.sections.map((s) => `<p class="psub">${glyph(s.icon)} ${s.t}</p><ul>${s.items.map((i) => `<li>${i}</li>`).join('')}</ul>`).join('')}`;
}
// The same notes as plain text, for pasting into a post or a message (headings, then "- " bullets)
export function patchText(p) {
  const plain = (h) => h.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&');
  return [`Argonisos · ${p.name}: ${p.title} (${p.date})`, '', plain(p.intro), ...p.sections.flatMap((s) => ['', s.t.toUpperCase(), ...s.items.map((i) => `- ${plain(i)}`)])].join('\n');
}
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; } catch { /* not allowed here: fall back to a selected text box */ }
  const ta = document.createElement('textarea'); ta.value = t; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
  let ok; try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove(); return ok;
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
