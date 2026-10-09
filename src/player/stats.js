// Survival stats, the Valheim way: no hunger. Health and stamina have small base pools that food raises for a while.
// Conditions (wet, cold, rested, near fire, under roof...) change regeneration and speed. Skills level up by doing.

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const BASE = { health: 25, healthRegen: 0.5, stamina: 50, staminaRegen: 5, staminaDelay: 1.0 };

// ---- Conditions. Timed ones count down; the others are switched on and off by the world every frame.
export const CONDITIONS = {
  nearFire: { name: 'Near Fire', icon: 'fire', desc: 'Warm by the fire: no wet, cold or freezing.' },
  rested: { name: 'Rested', icon: 'rested', time: 1200, desc: '+5% movement speed, 5% less stamina used.' },
  underRoof: { name: 'Under Roof', icon: 'roof', desc: 'Sheltered: you can rest and sleep here.' },
  wet: { name: 'Wet', icon: 'wet', time: 120, desc: '-25% health and stamina regeneration.' },
  cold: { name: 'Cold', icon: 'cold', desc: '-15% health and stamina regeneration.' },
  freezing: { name: 'Freezing', icon: 'freezing', desc: 'Losing 1 health a second. No health regeneration.' },
  swift: { name: 'Swift', icon: 'swift', time: 60, desc: '+10% movement speed.' },
  claws: { name: "Chimera's Claws", icon: 'blessing', time: 300, desc: 'Your bare hands strike like claws.' },
  poisoned: { name: 'Poisoned', icon: 'spoiled', time: 6, desc: 'Losing health to venom.' },
  burning: { name: 'Burning', icon: 'fire', time: 3, desc: 'Losing health to flames.' },
  stunned: { name: 'Stunned', icon: 'stunned', time: 4, desc: 'Cannot act.' },
  zeusBuff: { name: "Zeus's Favour", icon: 'zeus', time: 90, desc: 'Zeus lifts you up after death: +75% movement speed, 75% less stamina used.' },
  zeusBlessing: { name: "Zeus's Blessing", icon: 'blessing', time: 600, desc: '+30 health, +10% movement speed, +10% melee and bow damage, +10% block.' },
};

// ---- Skills: level 1 → 100, XP to reach level L is 50·(L-1)·(L+2); each level is worth 0.3% (0.03× damage for weapons)
export const SKILLS = {
  sprinting: { name: 'Sprinting', xp: 'per 10 ft sprinted' }, jumping: { name: 'Jumping' }, gathering: { name: 'Gathering' }, swimming: { name: 'Swimming' },
  sneaking: { name: 'Sneaking' }, unarmed: { name: 'Unarmed' }, axe: { name: 'Axeman' }, sword: { name: 'Swordsman' }, spear: { name: 'Spearman' },
  dagger: { name: 'Daggerman' }, mace: { name: 'Maceman' }, bow: { name: 'Bowman' }, blocking: { name: 'Blocking' },
};
export const xpForLevel = (L) => 50 * (L - 1) * (L + 2);

export class Stats {
  constructor() {
    this.health = BASE.health; this.stamina = BASE.stamina; this.staminaUsedT = 9;
    this.food = [];                               // up to 3: { id, def, t } (def: health, stamina, regen, duration, effect)
    this.cond = {};                               // active conditions: name → seconds left (Infinity for world-driven ones)
    this.skills = Object.fromEntries(Object.keys(SKILLS).map((k) => [k, { level: 1, xp: 0 }]));
    this.onLevel = null; this.onDeath = null; this.dead = false;
  }
  // ---- food
  // How much of a food's bonus is left: full for most of its time, tailing off at the end (as in Valheim)
  static foodK(f) { const r = clamp(f.t / f.def.duration, 0, 1); return Math.pow(r, 0.3); }
  get maxHealth() { let h = BASE.health; for (const f of this.food) h += f.def.health * Stats.foodK(f); if (this.has('zeusBlessing')) h += 30; return h; }
  get maxStamina() { let s = BASE.stamina; for (const f of this.food) s += f.def.stamina * Stats.foodK(f); return s; }
  // Eat something. Spoiled or raw food hurts instead. Returns a reason it couldn't be eaten, or null
  eat(id, def) {
    if (def.health < 0 || def.stamina < 0) { this.damage(-Math.min(0, def.health)); this.stamina = Math.max(0, this.stamina + Math.min(0, def.stamina)); return null; }
    const same = this.food.find((f) => f.id === id);
    if (same) { if (same.t > def.duration * 0.5) return 'not hungry for that yet'; same.t = def.duration; return null; }
    if (this.food.length >= 3) { const low = this.food.reduce((a, b) => (Stats.foodK(b) < Stats.foodK(a) ? b : a)); if (Stats.foodK(low) > 0.5) return 'too full'; this.food.splice(this.food.indexOf(low), 1); }
    this.food.push({ id, def, t: def.duration });
    this.health = Math.min(this.health + def.health * 0.5, this.maxHealth); this.stamina = Math.min(this.stamina + def.stamina * 0.5, this.maxStamina);
    if (def.effect) this.add(def.effect.cond, def.effect.time);
    return null;
  }
  // ---- conditions
  has(c) { return (this.cond[c] || 0) > 0; }
  add(c, t = CONDITIONS[c]?.time ?? Infinity) { this.cond[c] = Math.max(this.cond[c] || 0, t); }
  set(c, on) { if (on) this.cond[c] = Infinity; else delete this.cond[c]; }
  remove(c) { delete this.cond[c]; }
  // speed and stamina-use multipliers from conditions and skills
  get speedK() { return 1 + (this.has('rested') ? 0.05 : 0) + (this.has('zeusBuff') ? 0.75 : 0) + (this.has('zeusBlessing') ? 0.1 : 0) + (this.has('swift') ? 0.1 : 0); }
  get drainK() { return (1 - (this.has('rested') ? 0.05 : 0)) * (1 - (this.has('zeusBuff') ? 0.75 : 0)); }
  get healthRegenK() { if (this.has('freezing')) return 0; return (1 - (this.has('wet') ? 0.25 : 0)) * (1 - (this.has('cold') ? 0.15 : 0)); }
  get staminaRegenK() { return (1 - (this.has('wet') ? 0.25 : 0)) * (1 - (this.has('cold') ? 0.15 : 0)) * (this.has('freezing') ? 0.4 : 1); }
  // ---- stamina
  // Spend stamina for an action (skill makes it cheaper). Returns false if there isn't enough
  use(amount, skill) {
    if (this.god) return true;
    const cost = amount * this.drainK * (skill ? 1 - (this.skills[skill].level - 1) * 0.003 : 1);
    if (this.stamina < cost && amount > 0) return false;
    this.stamina = Math.max(0, this.stamina - cost); this.staminaUsedT = 0; return true;
  }
  drain(perSec, dt, skill) { this.use(perSec * dt, skill); this.stamina = Math.max(0, this.stamina); }
  // ---- skills
  skillK(s) { return 1 + (this.skills[s].level - 1) * 0.003; }
  damageK(s) { return 1 + (this.skills[s].level - 1) * 0.03; }
  train(s, xp) {
    const k = this.skills[s]; if (!k || k.level >= 100) return;
    k.xp += xp;
    while (k.level < 100 && k.xp >= xpForLevel(k.level + 1)) { k.level++; this.onLevel?.(s, k.level); }
  }
  // ---- health
  damage(n) { if (this.dead || n <= 0 || this.god) return; this.health -= n; if (this.health <= 0) { this.health = 0; this.dead = true; this.onDeath?.(); } }
  heal(n) { this.health = Math.min(this.maxHealth, this.health + n); }
  // ---- per frame
  update(dt) {
    for (const c of Object.keys(this.cond)) { if (this.cond[c] !== Infinity) { this.cond[c] -= dt; if (this.cond[c] <= 0) delete this.cond[c]; } }
    for (let i = this.food.length - 1; i >= 0; i--) { this.food[i].t -= dt; if (this.food[i].t <= 0) this.food.splice(i, 1); }
    if (this.dead) return;
    let regen = BASE.healthRegen; for (const f of this.food) regen += (f.def.regen || 0) * 0.5;
    this.health = Math.min(this.maxHealth, this.health + regen * this.healthRegenK * dt);
    if (this.has('freezing')) this.damage(dt);
    this.staminaUsedT += dt;
    if (this.staminaUsedT > BASE.staminaDelay) this.stamina = Math.min(this.maxStamina, this.stamina + BASE.staminaRegen * this.staminaRegenK * dt);
    this.health = Math.min(this.health, this.maxHealth); this.stamina = Math.min(this.stamina, this.maxStamina);
  }
  revive() { this.dead = false; this.health = BASE.health; this.stamina = BASE.stamina; this.food = []; this.cond = {}; this.add('zeusBuff'); }
  toJSON() { return { health: this.health, stamina: this.stamina, food: this.food.map((f) => ({ id: f.id, t: f.t })), cond: Object.fromEntries(Object.entries(this.cond).filter(([, v]) => v !== Infinity)), skills: this.skills }; }
}
