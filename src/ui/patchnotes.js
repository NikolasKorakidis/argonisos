// Patch notes, newest first, shown from the title screen and the pause menu. A new patch goes at the top of the list;
// players see a "New" mark on the button until they've opened the notes for the newest one.
import { glyph } from './icons.js';

export const PATCHES = [
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
        'Its thunder carries only so far: a faint rumble now and then from the temple, growing as you come nearer, and the full roar of wind and storm right at its foot. On Olympos you won\'t hear it at all.',
        '<b>Thunderstorms:</b> forked bolts strike the land, the whole world flashes blue-white, and wet stone and leaves glint in it. The thunder follows a moment later, sooner the closer the strike. At night a close strike lights up the land for an instant.',
        'A new setting, <b>Reduce flashing</b>, softens lightning and other bright flashes.',
      ] },
      { t: 'Weather and Sky', icon: 'wet', items: [
        '<b>Fog</b> is thick now: you see only some thirty metres, the sky disappears, and the light goes soft and grey.',
        'The sun now crosses the sky from the side, so it no longer sets behind Olympos or rises out of the storm.',
        '<b>New clouds:</b> puffy low-poly clouds drift across the sky with the wind, a few on a fine day and crowds of them when it clouds over, golden at dawn and dusk and dark blue by moonlight, with a ring of cloud banks low on the horizon.',
        '<b>Storms are heavy now:</b> a thick, low, lumpy ceiling of dark cloud covers the whole sky in heavy rain and thunderstorms, with ragged cloud racing beneath it. No more stars, moon or sun through a storm, and lightning lights the clouds up from inside.',
        '<b>Olympos makes its own weather:</b> a cap of cloud sits on the summit at times with a banner streaming off it downwind, banks of cloud lie in its gullies, and mist pools in the valleys at its foot in the morning. More of it in bad weather and early in the day; some days it clears. Climb into one and you walk through the fog of the cloud itself.',
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
