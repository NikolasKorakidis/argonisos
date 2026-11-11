// What kind of thing each pack model is, from its pack, folder and name (everything.mjs puts it in the catalogue; the
// asset browser and the Blender catalogue group by it). The first rule that matches wins, so the narrow ones come first.
// KINDS lists every kind's groups in the order they're shown.
export const KINDS = {
  Creatures: ['Deer & moose', 'Bears', 'Wolves & foxes', 'Boars', 'Hares', 'Birds', 'Fish & sea life', 'Monsters'],
  People: ['Characters', 'Hair & beards', 'Helmets & hats', 'Worn gear'],
  Trees: ['Leafy trees', 'Pines & firs', 'Palms', 'Swamp & willow', 'Dead & bare', 'Stumps, logs & branches', 'Distant trees'],
  Plants: ['Bushes & shrubs', 'Grass', 'Flowers', 'Ferns', 'Mushrooms', 'Crops & garden', 'Ivy, vines & roots', 'Water plants', 'Cacti & succulents', 'Moss & ground cover'],
  'Rocks & ground': ['Rocks & boulders', 'Pebbles & stone piles', 'Cliffs & mountains', 'Ground pieces', 'Paths & roads', 'Water', 'Ice & snow', 'Crystals & lava', 'Bones'],
  Buildings: ['Whole buildings', 'Walls', 'Roofs', 'Floors & ceilings', 'Doors & windows', 'Stairs & ladders', 'Pillars, beams & trims', 'Foundations', 'Fortifications',
    'Fences & gates', 'Docks & bridges', 'Ruins', 'Market & awnings', 'Pipes & city bits'],
  Props: ['Furniture', 'Beds & cloth', 'Containers', 'Pottery & tableware', 'Food', 'Tools', 'Weapons & shields', 'Lights & fire', 'Workshop', 'Statues & monuments',
    'Decor & signs', 'Carts & boats', 'Books, scrolls & potions', 'Camp & junk', 'Other props'],
  'Sky & far away': ['Clouds & sky', 'Far mountains & hills'],
  Effects: ['Effects'],
  Other: ['Other'],
};

// [kind, group, test, where]: tests run on the file and model names (or, with where 'path', on the pack and folder), in
// lower case, words joined by _ (so (^|_) starts a word)
const R = (kind, sub, re, where = 'name') => [kind, sub, re, where];
const RULES = [
  R('Effects', 'Effects', /(^|_)fx(_|$)|particle|gorechunk|sunshaft|decal|fog_ring|medusa_snakes|mystic_arms|(^|_)runes(_|$)/),
  R('Effects', 'Effects', /particlefx|simplefx/, 'path'),
  R('Sky & far away', 'Clouds & sky', /cloud|skydome|(^|_)sky(_|$)/),
  R('Sky & far away', 'Far mountains & hills', /background|backrgound|mountainrange|skyline|hill_background|(^|_)env_mountains?(_|$)|trees_background/),
  // creatures
  R('Creatures', 'Monsters', /magic_pig/, 'path'),
  R('Creatures', 'Birds', /(^|_)(barn_)?owl|(^|_)bird/, 'path'),
  R('Creatures', 'Deer & moose', /polyart.*(deer|moose)/, 'path'),
  R('Creatures', 'Bears', /polyart.*bear/, 'path'),
  R('Creatures', 'Wolves & foxes', /polyart.*(wolf|wolves|fox)/, 'path'),
  R('Creatures', 'Boars', /polyart.*boar/, 'path'),
  R('Creatures', 'Hares', /polyart.*hare/, 'path'),
  R('Creatures', 'Fish & sea life', /starfish|(^|_)coral|turtle/),
  // people
  R('People', 'Hair & beards', /(^|_)hair|beard|moustache|(^|_)chops|ponytail|(^|_)bun(_|$)/),
  R('People', 'Helmets & hats', /helmet|(^|_)hat(_|$)|beanie|headset|sunglasses|headdress|laurel|crown/),
  R('People', 'Worn gear', /chr_attach|backharness|pouch|scabbard|(^|_)cape/),
  R('People', 'Characters', /character|(^|_)chr_/),
  // trees
  R('Trees', 'Stumps, logs & branches', /stump|(^|_)log(s|_|$)|driftwood|branch|(^|_)twig|tree_dead_?log|fallen/),
  R('Trees', 'Palms', /palm|coconut_tree/),
  R('Trees', 'Swamp & willow', /swamp_tree|tree_swamp|willow|mangrove/),
  R('Trees', 'Dead & bare', /tree_dead|dead_tree|tree_bare|deadtree/),
  R('Trees', 'Pines & firs', /pine|(^|_)fir(_|$)|spruce|larch|cedar|conifer/),
  R('Trees', 'Leafy trees', /(^|_)trees?(_|$)|birch|oak|olive|cypress|poplar|tree_|_tree/),
  // plants
  R('Plants', 'Cacti & succulents', /cact|succulent|aloe|agave/),
  R('Plants', 'Water plants', /lil+(y|ies)|reed|seaweed|kelp|cattail|water_?plant/),
  R('Plants', 'Mushrooms', /mushroom|toadstool|boletus|fungus|shroom/),
  R('Plants', 'Ferns', /fern/),
  R('Plants', 'Flowers', /flower|dandelion|poppy|daisy|tulip|rose(_|$)|lavender|wildflower|blossom/),
  R('Plants', 'Crops & garden', /straw_field|crop|rapeseed|wheat|corn(_|$)|vegetable_?patch|garden|flax|vineyard|grape|cabbage|pumpkin|hay(_|$)|plantain/),
  R('Plants', 'Ivy, vines & roots', /ivy|vine|creeper|(^|_)roots?(_|$)|hanging_?moss/),
  R('Plants', 'Moss & ground cover', /moss|groundcover|ground_cover|undergrowth|leaves_pile|leaf_pile|(^|_)leaves|clover/),
  R('Plants', 'Grass', /grass(?!_soil|_edge)|straw_?(bundle|clump)|tussock|toetoe/),
  R('Plants', 'Bushes & shrubs', /bush|shrub|hedge|(^|_)plant/),
  // things that would otherwise land among the ground pieces or the building kit (a wall torch, a stone cabin, a carpet)
  R('Props', 'Weapons & shields', /greekwarfare/, 'path'),
  R('Props', 'Lights & fire', /torch|brazier|candle|lantern|(^|_)lamp|camp_?fire|fireplace|chandelier|senser|censer/),
  R('Props', 'Beds & cloth', /carpet|(^|_)rug(_|$)/),
  R('Props', 'Furniture', /bathtub|stove|oven|shelf/),
  R('Props', 'Weapons & shields', /shield/),
  R('Props', 'Decor & signs', /(^|_)sign(_|$)|bld_sign|birdhouse/),
  R('Buildings', 'Whole buildings', /cabin|windmill|(^|_)bld_.*(house|hut|shack)/),
  // rocks and ground
  R('Rocks & ground', 'Bones', /(^|_)bones?(_|$)|skull|ribcage|whale|skeleton/),
  R('Rocks & ground', 'Crystals & lava', /crystal|lava|sulphur|crater|geyser/),
  R('Rocks & ground', 'Ice & snow', /(^|_)env_(ice|snow)|glacier|icicle|stalactite|frozen/),
  R('Rocks & ground', 'Water', /water|river_plane|waterfall|puddle|pond|(^|_)lake/),
  R('Rocks & ground', 'Paths & roads', /road|path|cobble|sidewalk|pavement|tyremark|manhole|terrain_path|(^|_)tiles?(_|$)/),
  R('Rocks & ground', 'Cliffs & mountains', /cliff|mountain|volcano|(^|_)hill|arch(_|$)|mesa|canyon|pillar_rock|rock_pillar/),
  R('Rocks & ground', 'Pebbles & stone piles', /(^|_)env_pile|pebble|gravel|rubble|stone_?pile|rock_pile|rocks_tiny|rock_small|(^|_)stones?(_|$)/),
  R('Rocks & ground', 'Rocks & boulders', /rock|boulder|(^|_)stone/),
  R('Rocks & ground', 'Ground pieces', /plato|terrain|ground|dirt|mud|sand|beach|trench|mound|dust_?pile|soil|swamp|riverside|grassedge|plane/),
  // buildings
  R('Buildings', 'Fortifications', /fortification|stockade|palisade|tower|rampart|battlement|gate_balcony|wall_platform|watchtower/),
  R('Buildings', 'Stairs & ladders', /stair|ladder|(^|_)steps?(_|$)/),
  R('Buildings', 'Fences & gates', /fence|gate|railing|handrail/),
  R('Buildings', 'Docks & bridges', /dock|jetty|bridge|pier/),
  R('Buildings', 'Ruins', /ruin|broken_wall|wall_broken|rubble_wall/),
  R('Buildings', 'Market & awnings', /awning|stall|market|stockpile|canopy|trellis|pergola/),
  R('Buildings', 'Pipes & city bits', /pipe|aircon|antenna|vent(_|$)|tubes/),
  R('Buildings', 'Roofs', /roof|chimney|gable|eave/),
  R('Buildings', 'Walls', /wall/),
  R('Buildings', 'Doors & windows', /door|window|shutter|archway|doorway/),
  R('Buildings', 'Floors & ceilings', /floor|ceiling|balcony|platform|deck/),
  R('Buildings', 'Pillars, beams & trims', /pillar|column|beam|trim|ornament|cornice|support|(^|_)post(_|$)|connector|frieze|pediment/),
  R('Buildings', 'Foundations', /basement|foundation|(^|_)base_|bld_base/),
  R('Buildings', 'Whole buildings', /(^|_)bld_(?!sign)|house|shack|(^|_)shed|(^|_)hut|temple|building|boathouse|barn|structures/),
  // props
  R('Props', 'Statues & monuments', /statue|fountain|sundial|monolith|monument|bust|obelisk|tombstone|grave|shrine|altar|plinth|stone_?runes|totem|tiki/),
  R('Props', 'Lights & fire', /torch|brazier|candle|lantern|lamp|fire|light|senser|censer|chandelier/),
  R('Props', 'Weapons & shields', /(^|_)wep_|quiver|sword|spear|shield|axe(?!_?log|l)|bow(_|$)|arrow|dagger|mace|club|javelin|weapon|helmet_rack|knife/),
  R('Props', 'Workshop', /anvil|forge|kiln|bellows|grindstone|workbench|blacksmith|loom|grind|mill|smith|carpenter|tool_?rack|tools_hanger/),
  R('Props', 'Tools', /hammer|pickaxe|shovel|spade|rake|pitchfork|sickle|saw|chisel|pliers|scissors|tool|hook|broom|rope|chain|net(_|$)|bucket|shears/),
  R('Props', 'Carts & boats', /cart|wagon|boat|ship|wreck|kite|wheel|(^|_)veh_|canoe/),
  R('Props', 'Books, scrolls & potions', /book|scroll|potion|alchemy|bottle|paper|letter|map(_|$)|numeral|hourglass|feather|quill|mirror|harp|trumpet|lyre|flute/),
  R('Props', 'Food', /food|bread|meat|fish|fruit|apple|cheese|grapes|vegetable|egg|olive_?pile|coconut|fig/),
  R('Props', 'Pottery & tableware', /vase|jar|jug|amphora|pot(_|$)|pottery|bowl|plate|cup|mug|goblet|kettle|pan(_|$)|ladle|spoon|cauldron|clay/),
  R('Props', 'Containers', /basket|barrel|crate|sack|box|chest|bag|container|bin|keg|urn|coin/),
  R('Props', 'Beds & cloth', /bed(_|$)|mattress|pillow|cushion|rug|carpet|drapery|cloth|curtain|fur(_|$)|blanket|hanger/),
  R('Props', 'Furniture', /table|chair|bench|stool|seat|shelf|shelves|cabinet|cupboard|desk|throne|bathtub|stove|fireplace|cage/),
  R('Props', 'Decor & signs', /banner|flag|symbol|mural|sign|ornament|wreath|emblem|pole/),
  R('Props', 'Camp & junk', /camp|junk|plank|wood_?pile|wood(_|$)|tent|hose|lever|button|switch|keypad|screen|medkit|clock|key(_|$)|sewer/),
  R('Props', 'Other props', /(^|_)prop_|rpgpp_ag/),
  R('Buildings', 'Whole buildings', /structures/, 'path'),
];
const words = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '_');
export function kindOf(r) {
  const name = words(`${r.file.split('/').pop().replace(/\.fbx$/i, '')} ${r.name}`), where = words(`${r.pack} ${r.file.split('/').slice(0, -1).join(' ')}`);
  for (const [kind, sub, re, on] of RULES) if (re.test(on === 'path' ? where : name)) return { kind, sub };
  return { kind: 'Other', sub: 'Other' };
}
