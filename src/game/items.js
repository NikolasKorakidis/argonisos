// Every item in milestone 1.0: materials, food, tools, weapons, armour and ammunition, with their stats.
// type: material | food | tool | weapon | shield | armor | ammo
// Weapons: dmg [[amount, kind]], block, parry, backstab, knock (knockback chance), hands (1|2), skill.
// Tools/weapons/armour have durability; speed is the movement-speed change while equipped (-0.05 = 5% slower).
const M = (name, o = {}) => ({ name, type: 'material', stack: 50, weight: 1, ...o });
const F = (name, health, stamina, regen, duration, o = {}) => ({ name, type: 'food', stack: 50, weight: 0.3, food: { health, stamina, regen, duration }, ...o });

export const ITEMS = {
  // ---- materials
  stone: M('Stone', { weight: 2, icon: 'stone' }),
  wood: M('Wood', { weight: 2, icon: 'wood' }),
  log: M('Log', { weight: 8, stack: 10, icon: 'log' }),
  branch: M('Branch', { weight: 1, icon: 'branch', note: 'Breaks down into wood.' }),
  rope: M('Rope', { weight: 0.2, icon: 'rope' }),
  leather: M('Leather Piece', { weight: 0.5, icon: 'leather' }),
  sharpBone: M('Sharp Bone', { weight: 0.5, icon: 'bone' }),
  lightstone: M('Lightstone', { weight: 2, icon: 'lightstone' }),
  coal: M('Coal', { weight: 0.5, icon: 'coal' }),
  resin: M('Resin', { weight: 0.2, icon: 'resin' }),
  feather: M('Feather', { weight: 0.1, icon: 'feather' }),
  dandelion: M('Dandelion', { weight: 0.1, icon: 'flower' }),
  foxHide: M('Fox Hide', { weight: 1, icon: 'hide' }),
  deerHide: M('Deer Hide', { weight: 1, icon: 'hide' }),
  rabbitHide: M('Rabbit Hide', { weight: 0.5, icon: 'hide' }),
  boarHide: M('Hog Hide', { weight: 1, icon: 'hide' }),
  giantHide: M('Giant Hide', { weight: 2, icon: 'hide' }),
  minotaurHide: M('Minotaur Hide', { weight: 3, icon: 'hide' }),
  chimeraHide: M('Chimera Hide', { weight: 4, icon: 'hide', stack: 5 }),
  dryadHeart: M('Dryad Heart', { weight: 0.5, icon: 'heart' }),
  moonflower: M('Moonflower', { weight: 0.1, icon: 'flower' }),
  oliveSeed: M('Olive Seed', { weight: 0.1, icon: 'seed' }),
  acornSeed: M('Acorn Seed', { weight: 0.1, icon: 'seed' }),
  pomegranateSeed: M('Pomegranate Seed', { weight: 0.1, icon: 'seed' }),
  pineCone: M('Pine Cone', { weight: 0.2, icon: 'cone' }),
  firCone: M('Fir Cone', { weight: 0.2, icon: 'cone' }),
  oliveScrap: M('Olive-tree Scrap', { weight: 0.1, icon: 'scroll', stack: 10, note: 'Carved marks in old olive wood. Pieced together, they point the way to the Minotaur.' }),
  caveCarving: M('Giant Cave Carving', { weight: 0.5, icon: 'scroll', stack: 10, note: 'A slab scratched by Giants. Together, they show where the Chimera sleeps.' }),
  minotaurHead: M('Minotaur Head', { weight: 5, stack: 1, icon: 'trophy', trophy: true }),
  chimeraHead: M('Chimera Head', { weight: 6, stack: 1, icon: 'trophy', trophy: true }),
  // ---- food (instant health bonus, stamina bonus, healing per second, duration in seconds)
  olive: F('Olive', 7, 20, 1, 600, { icon: 'olive' }),
  acorn: F('Acorn', 15, 15, 1, 900, { icon: 'acorn' }),
  pomegranate: F('Pomegranate', 8, 25, 1, 900, { icon: 'pomegranate', effect: { cond: 'swift', time: 60 } }),
  rawMeat: F('Raw Meat', -10, -10, 0, 0, { icon: 'meat', spoil: 140, spoilTo: 'spoiledMeat', cook: { to: 'cookedMeat', time: 30 } }),
  cookedMeat: F('Cooked Meat', 40, 30, 2, 1200, { icon: 'cookedMeat', spoil: 900, spoilTo: 'spoiledMeat' }),
  spoiledMeat: F('Spoiled Meat', -25, -25, 0, 0, { icon: 'spoiled' }),
  rawFish: F('Raw Fish', -15, -15, 0, 0, { icon: 'fish', spoil: 90, spoilTo: 'spoiledFish', cook: { to: 'cookedFish', time: 20 } }),
  cookedFish: F('Cooked Fish', 45, 25, 2, 1200, { icon: 'cookedFish', spoil: 750, spoilTo: 'spoiledFish' }),
  spoiledFish: F('Spoiled Fish', -30, -30, 0, 0, { icon: 'spoiled' }),
  // ---- tools
  hammer: { name: 'Wooden Hammer', type: 'tool', tool: 'build', stack: 1, weight: 2, dur: 200, dmg: [[3, 'blunt']], block: 2, speed: -0.05, icon: 'hammer' },
  hoe: { name: 'Hoe', type: 'tool', tool: 'hoe', stack: 1, weight: 2, dur: 250, dmg: [[2, 'pierce']], block: 3, speed: -0.1, icon: 'hoe' },
  torch: { name: 'Torch', type: 'tool', tool: 'light', stack: 1, weight: 1, dur: 100, dmg: [[4, 'blunt'], [15, 'fire']], block: 2, speed: -0.1, icon: 'torch', light: 9 },
  pickaxe: { name: 'Stone Pickaxe', type: 'tool', tool: 'mine', tier: 1, stack: 1, weight: 2, dur: 300, dmg: [[4, 'pierce']], block: 4, speed: -0.1, icon: 'pickaxe' },
  // ---- weapons (the crude axe also fells trees; the club and the spear double as tools for nothing)
  crudeAxe: { name: 'Crude Axe', type: 'weapon', skill: 'axe', chop: 1, hands: 1, stack: 1, weight: 1.5, dur: 100, dmg: [[15, 'slash']], block: 10, parry: 2, backstab: 3, knock: 0.15, speed: -0.05, icon: 'axe' },
  crudeDagger: { name: 'Crude Dagger', type: 'weapon', skill: 'dagger', hands: 1, stack: 1, weight: 0.3, dur: 75, dmg: [[4, 'slash'], [4, 'pierce']], block: 2, parry: 4, backstab: 8, knock: 0.1, speed: 0.05, icon: 'dagger' },
  crudeClub: { name: 'Crude Club', type: 'weapon', skill: 'mace', hands: 1, stack: 1, weight: 2, dur: 100, dmg: [[12, 'blunt']], block: 10, parry: 2, backstab: 3, knock: 0.2, speed: -0.05, icon: 'club' },
  crudeBow: { name: 'Crude Bow', type: 'weapon', skill: 'bow', bow: true, hands: 2, stack: 1, weight: 1.5, dur: 100, dmg: [[18, 'pierce']], block: 5, backstab: 3, speed: -0.05, icon: 'bow' },
  crudeSpear: { name: 'Crude Spear', type: 'weapon', skill: 'spear', hands: 2, stack: 1, weight: 1.5, dur: 100, dmg: [[20, 'pierce']], block: 6, parry: 2, backstab: 3, knock: 0.1, speed: -0.05, icon: 'spear', throwable: true },
  crudeShield: { name: 'Crude Shield', type: 'shield', skill: 'blocking', hands: 1, stack: 1, weight: 4, dur: 200, block: 20, parry: 1.5, speed: -0.05, icon: 'shield' },
  crudeTowerShield: { name: 'Crude Tower Shield', type: 'shield', skill: 'blocking', hands: 1, stack: 1, weight: 4, dur: 250, block: 35, speed: -0.2, icon: 'towerShield' },
  lightstoneSpear: { name: 'Lightstone Spear', type: 'weapon', skill: 'spear', hands: 2, stack: 1, weight: 1.5, dur: 150, dmg: [[26, 'pierce']], block: 10, parry: 2, backstab: 3, knock: 0.2, speed: -0.05, icon: 'spear', throwable: true },
  lightstoneAxe: { name: 'Lightstone Axe', type: 'weapon', skill: 'axe', chop: 2, hands: 1, stack: 1, weight: 1.5, dur: 100, dmg: [[20, 'slash']], block: 10, parry: 2, backstab: 3, knock: 0.15, speed: -0.05, icon: 'axe' },
  lightstoneDagger: { name: 'Lightstone Dagger', type: 'weapon', skill: 'dagger', hands: 1, stack: 1, weight: 0.3, dur: 100, dmg: [[6, 'slash'], [6, 'pierce']], block: 5, parry: 4, backstab: 10, knock: 0.1, speed: 0.05, icon: 'dagger' },
  cretanBow: { name: 'Cretan Bow', type: 'weapon', skill: 'bow', bow: true, hands: 2, stack: 1, weight: 1, dur: 150, dmg: [[26, 'pierce']], block: 9, backstab: 4, knock: 0.1, speed: 0, sneak: 0.1, icon: 'bow' },
  crudeArrow: { name: 'Crude Arrow', type: 'ammo', stack: 100, weight: 0.05, dmg: [[22, 'pierce']], knock: 0.1, icon: 'arrow' },
  // ---- armour (armor value, slot, effects)
  throwerHelmet: { name: 'Thrower Helmet', type: 'armor', slot: 'head', set: 'thrower', armor: 2, stack: 1, weight: 1, dur: 100, icon: 'helmet' },
  throwerArmor: { name: 'Thrower Armour', type: 'armor', slot: 'body', set: 'thrower', armor: 8, stack: 1, weight: 6, dur: 400, warm: true, icon: 'armor' },
  throwerLegs: { name: 'Thrower Leg Armour', type: 'armor', slot: 'legs', set: 'thrower', armor: 6, stack: 1, weight: 4, dur: 400, speed: 0.1, icon: 'legs' },
  cretanHelmet: { name: 'Cretan Helmet', type: 'armor', slot: 'head', set: 'cretan', armor: 4, stack: 1, weight: 2, dur: 200, bowDmg: 0.05, icon: 'helmet' },
  cretanArmor: { name: 'Cretan Body Armour', type: 'armor', slot: 'body', set: 'cretan', armor: 16, stack: 1, weight: 12, dur: 800, warm: true, icon: 'armor' },
  cretanLegs: { name: 'Cretan Leg Armour', type: 'armor', slot: 'legs', set: 'cretan', armor: 12, stack: 1, weight: 9, dur: 650, speed: 0.05, icon: 'legs' },
  cretanCape: { name: 'Cretan Cape', type: 'armor', slot: 'cape', set: 'cretan', armor: 4, stack: 1, weight: 2, dur: 200, noFreeze: true, icon: 'cape' },
};
for (const [id, it] of Object.entries(ITEMS)) it.id = id;
export const SET_BONUS = 1.05;    // full set: armour ×1.05

// ---- Recipes. at: where it's made (null: anywhere, from the crafting menu; 'workbench': near a workbench).
// n: how many you get. Known (shown in C) once you have held any one of its materials.
export const RECIPES = [
  { id: 'hammer', mats: { wood: 4 } },
  { id: 'torch', mats: { wood: 1, resin: 1, rope: 1 } },
  { id: 'crudeClub', mats: { wood: 6 } },
  { id: 'crudeDagger', mats: { wood: 1, stone: 2 } },
  { id: 'crudeAxe', mats: { wood: 5, stone: 4, rope: 2 } },
  { id: 'throwerHelmet', mats: { leather: 2, rope: 1 } },
  { id: 'throwerArmor', mats: { leather: 8, rope: 2 } },
  { id: 'throwerLegs', mats: { leather: 6, rope: 2 } },
  { id: 'rope', n: 10, mats: { leather: 1 }, at: 'workbench' },
  { id: 'wood', n: 2, mats: { branch: 1 } },
  { id: 'hoe', mats: { wood: 4, stone: 2, leather: 1, rope: 2 }, at: 'workbench' },
  { id: 'pickaxe', mats: { wood: 6, stone: 10, leather: 4, rope: 2 }, at: 'workbench' },
  { id: 'crudeBow', mats: { wood: 10, rope: 4, leather: 1 }, at: 'workbench' },
  { id: 'crudeSpear', mats: { wood: 6, stone: 2, rope: 2 }, at: 'workbench' },
  { id: 'crudeShield', mats: { wood: 10, resin: 4, leather: 4, rope: 6 }, at: 'workbench' },
  { id: 'crudeTowerShield', mats: { wood: 20, resin: 8, leather: 8, rope: 8 }, at: 'workbench' },
  { id: 'crudeArrow', n: 10, mats: { wood: 5, feather: 1 }, at: 'workbench' },
  { id: 'lightstoneSpear', mats: { wood: 5, lightstone: 10, deerHide: 2, rope: 2 }, at: 'workbench', tier: 1 },
  { id: 'lightstoneAxe', mats: { wood: 4, lightstone: 8, deerHide: 1, rope: 2 }, at: 'workbench', tier: 1 },
  { id: 'lightstoneDagger', mats: { wood: 2, lightstone: 2, deerHide: 1, rope: 1 }, at: 'workbench', tier: 1 },
  { id: 'cretanBow', mats: { wood: 10, lightstone: 20, dryadHeart: 4, deerHide: 4, rope: 2 }, at: 'workbench', tier: 2 },
  { id: 'cretanHelmet', mats: { deerHide: 2, rope: 1 }, at: 'workbench', tier: 1 },
  { id: 'cretanArmor', mats: { deerHide: 10, rope: 2 }, at: 'workbench', tier: 1 },
  { id: 'cretanLegs', mats: { deerHide: 8, rope: 2 }, at: 'workbench', tier: 1 },
  { id: 'cretanCape', mats: { foxHide: 20, rope: 2 }, at: 'workbench', tier: 1 },
];
// Placeable things made from the crafting menu go into the build menu (hammer) instead: see build/pieces.js
