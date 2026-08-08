// All content definitions: weapons, passives, evolutions, enemies, pilots,
// armory (meta) upgrades. Numbers here are the balance surface of the game.

import { EnemyKind, PassiveId, WeaponId } from './types';

// ------------------------------------------------------------------ palette

export const COLORS = {
  player: '#4df3ff',
  playerCore: '#eafeff',
  overdrive: '#ffd75e',
  xp: '#3ef58c',
  xpBig: '#37d9f0',
  xpHuge: '#c46bff',
  shard: '#ffd75e',
  health: '#ff5e7a',
  enemy: '#ff3860',
  enemyAlt: '#ff7a45',
  elite: '#ffb02e',
  bullet: '#ff4d6d',
  weapons: ['#4df3ff', '#a06bff', '#ff9f45', '#5eff9f', '#ff5e7a', '#ffe45e'] as string[],
};

// ------------------------------------------------------------------ weapons

export interface WeaponDef {
  id: WeaponId;
  name: string;
  evoName: string;
  desc: string;
  evoDesc: string;
  pair: PassiveId; // passive required for evolution
  color: string;
  maxLevel: number;
  // per-level descriptions shown on cards (index = current level, describing next)
  levelDesc: string[];
}

export const WEAPONS: WeaponDef[] = [
  {
    id: WeaponId.Pulse,
    name: 'Pulse Blaster',
    evoName: 'HYPER REPEATER',
    desc: 'Rapid bolts seek the nearest threat.',
    evoDesc: 'Triple-burst storm of piercing mega-bolts.',
    pair: PassiveId.Overclock,
    color: COLORS.weapons[0],
    maxLevel: 8,
    levelDesc: [
      'Fires seeking bolts at the nearest enemy',
      '+1 projectile',
      '+25% damage',
      'Faster fire rate',
      '+1 projectile',
      'Bolts pierce +1 enemy',
      '+30% damage',
      '+1 projectile & faster fire rate',
    ],
  },
  {
    id: WeaponId.Tesla,
    name: 'Arc Tesla',
    evoName: 'STORM CAGE',
    desc: 'Lightning arcs between enemies.',
    evoDesc: 'Perpetual storm — arcs fork and stun.',
    pair: PassiveId.Lucky,
    color: COLORS.weapons[1],
    maxLevel: 8,
    levelDesc: [
      'Lightning strikes and chains between enemies',
      '+1 chain jump',
      '+30% damage',
      'Faster strikes',
      '+2 chain jumps',
      '+30% damage',
      'Strikes twice',
      '+2 chains & faster strikes',
    ],
  },
  {
    id: WeaponId.Nova,
    name: 'Nova Pulse',
    evoName: 'SUPERNOVA',
    desc: 'Shockwave that blasts everything around you.',
    evoDesc: 'Colossal blast that leaves a burning field.',
    pair: PassiveId.Vitality,
    color: COLORS.weapons[2],
    maxLevel: 8,
    levelDesc: [
      'Emits a damaging shockwave around you',
      '+20% radius',
      '+30% damage',
      'Faster pulses',
      '+25% radius',
      'Adds heavy knockback',
      '+40% damage',
      '+30% radius & faster pulses',
    ],
  },
  {
    id: WeaponId.Swarm,
    name: 'Homing Swarm',
    evoName: 'HIVE MIND',
    desc: 'Missiles that hunt targets on their own.',
    evoDesc: 'Kills spawn new missiles. The swarm feeds itself.',
    pair: PassiveId.Thrusters,
    color: COLORS.weapons[3],
    maxLevel: 8,
    levelDesc: [
      'Launches homing missiles',
      '+1 missile',
      '+25% damage',
      'Sharper tracking',
      '+1 missile',
      '+30% damage',
      '+1 missile',
      '+2 missiles & faster launch',
    ],
  },
  {
    id: WeaponId.Rail,
    name: 'Rail Lance',
    evoName: 'SINGULARITY LANCE',
    desc: 'Devastating beam that pierces the horde.',
    evoDesc: 'A gravity beam that drags enemies into its path.',
    pair: PassiveId.Power,
    color: COLORS.weapons[4],
    maxLevel: 8,
    levelDesc: [
      'Piercing rail shot toward the densest pack',
      '+35% damage',
      'Wider beam',
      'Faster charge',
      '+35% damage',
      'Fires 2 lances',
      'Wider beam',
      '+40% damage & faster charge',
    ],
  },
  {
    id: WeaponId.Blades,
    name: 'Orbital Blades',
    evoName: 'HALO SAW',
    desc: 'Blades orbit you, shredding what they touch.',
    evoDesc: 'A massive saw-halo that slows and shreds.',
    pair: PassiveId.Amplifier,
    color: COLORS.weapons[5],
    maxLevel: 8,
    levelDesc: [
      'A blade orbits around you',
      '+1 blade',
      '+30% damage',
      'Wider orbit',
      '+1 blade',
      'Faster spin',
      '+1 blade & +30% damage',
      '+2 blades & wider orbit',
    ],
  },
];

// ------------------------------------------------------------------ passives

export interface PassiveDef {
  id: PassiveId;
  name: string;
  desc: string;
  maxLevel: number;
  icon: string; // small glyph drawn on cards
}

export const PASSIVES: PassiveDef[] = [
  { id: PassiveId.Power, name: 'Power Cell', desc: '+9% damage', maxLevel: 5, icon: '⚡' },
  { id: PassiveId.Overclock, name: 'Overclock', desc: '+8% fire rate', maxLevel: 5, icon: '⏩' },
  { id: PassiveId.Amplifier, name: 'Amplifier', desc: '+12% area of effect', maxLevel: 5, icon: '◎' },
  { id: PassiveId.Thrusters, name: 'Thrusters', desc: '+6% move speed', maxLevel: 5, icon: '➤' },
  { id: PassiveId.Vitality, name: 'Vitality Core', desc: '+18% max HP, heal 30%', maxLevel: 5, icon: '♥' },
  { id: PassiveId.Lucky, name: 'Lucky Chip', desc: '+4% crit & better drops', maxLevel: 5, icon: '★' },
  { id: PassiveId.Magnet, name: 'Magnet Core', desc: '+25% pickup radius', maxLevel: 5, icon: '◉' },
  { id: PassiveId.Plating, name: 'Neon Plating', desc: '+1 armor', maxLevel: 5, icon: '⬡' },
  { id: PassiveId.Reactor, name: 'Nano Reactor', desc: '+0.8 HP/s regen', maxLevel: 5, icon: '✚' },
];

// ------------------------------------------------------------------ enemies

export interface EnemyDef {
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  kbResist: number;
}

export const ENEMY_DEFS: Record<number, EnemyDef> = {
  [EnemyKind.Chaser]: { hp: 18, speed: 86, radius: 14, damage: 8, xp: 1, kbResist: 0 },
  [EnemyKind.Swarm]: { hp: 8, speed: 148, radius: 9, damage: 5, xp: 1, kbResist: 0 },
  [EnemyKind.Tank]: { hp: 110, speed: 44, radius: 26, damage: 16, xp: 5, kbResist: 0.85 },
  [EnemyKind.Dasher]: { hp: 30, speed: 95, radius: 13, damage: 12, xp: 3, kbResist: 0.3 },
  [EnemyKind.Spitter]: { hp: 26, speed: 70, radius: 14, damage: 8, xp: 3, kbResist: 0.2 },
  [EnemyKind.Splitter]: { hp: 55, speed: 68, radius: 20, damage: 12, xp: 4, kbResist: 0.5 },
  [EnemyKind.Mini]: { hp: 10, speed: 165, radius: 8, damage: 6, xp: 1, kbResist: 0 },
  [EnemyKind.Weaver]: { hp: 22, speed: 120, radius: 12, damage: 9, xp: 2, kbResist: 0.1 },
  [EnemyKind.BossWarden]: { hp: 2100, speed: 55, radius: 52, damage: 22, xp: 60, kbResist: 1 },
  [EnemyKind.BossSeraph]: { hp: 6800, speed: 62, radius: 56, damage: 26, xp: 100, kbResist: 1 },
  [EnemyKind.BossOmega]: { hp: 16000, speed: 70, radius: 64, damage: 32, xp: 200, kbResist: 1 },
};

export const BOSS_NAMES: Record<number, string> = {
  [EnemyKind.BossWarden]: 'THE WARDEN',
  [EnemyKind.BossSeraph]: 'SERAPH-9',
  [EnemyKind.BossOmega]: 'OMEGA PRIME',
};

// spawn timeline: which kinds are in the mix per minute mark
export interface WavePhase {
  t: number; // start time (s)
  interval: number; // seconds between spawn batches
  batch: number;
  kinds: EnemyKind[];
  weights: number[];
}

export const WAVES: WavePhase[] = [
  { t: 0, interval: 1.25, batch: 2, kinds: [EnemyKind.Chaser], weights: [1] },
  { t: 30, interval: 1.0, batch: 2, kinds: [EnemyKind.Chaser, EnemyKind.Swarm], weights: [3, 2] },
  { t: 70, interval: 1.0, batch: 3, kinds: [EnemyKind.Chaser, EnemyKind.Swarm, EnemyKind.Weaver], weights: [3, 3, 2] },
  { t: 115, interval: 1.0, batch: 3, kinds: [EnemyKind.Chaser, EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher], weights: [3, 3, 2, 1.5, 1.5] },
  { t: 205, interval: 1.0, batch: 3, kinds: [EnemyKind.Chaser, EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Spitter], weights: [3, 3, 2, 2, 2, 1.5] },
  { t: 265, interval: 0.95, batch: 4, kinds: [EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Spitter, EnemyKind.Splitter], weights: [3, 2.5, 2, 2, 1.5, 1.5] },
  { t: 420, interval: 0.85, batch: 4, kinds: [EnemyKind.Chaser, EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Spitter, EnemyKind.Splitter], weights: [2, 3, 2.5, 2.5, 2, 1.5, 2] },
  { t: 480, interval: 0.72, batch: 5, kinds: [EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Spitter, EnemyKind.Splitter], weights: [3, 3, 3, 2.5, 2, 2.5] },
  { t: 560, interval: 0.62, batch: 5, kinds: [EnemyKind.Swarm, EnemyKind.Weaver, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Spitter, EnemyKind.Splitter], weights: [3, 3, 3.5, 3, 2.5, 3] },
];

export const BOSS_TIMES: { t: number; kind: EnemyKind }[] = [
  { t: 180, kind: EnemyKind.BossWarden },
  { t: 390, kind: EnemyKind.BossSeraph },
  { t: 600, kind: EnemyKind.BossOmega },
];

/** Ring / stream surprise events (outside boss fights). */
export const EVENTS: { t: number; type: 'ring' | 'stream' }[] = [
  { t: 140, type: 'ring' },
  { t: 245, type: 'stream' },
  { t: 330, type: 'ring' },
  { t: 460, type: 'stream' },
  { t: 520, type: 'ring' },
  { t: 575, type: 'stream' },
];

/** Global HP multiplier over time (applies to non-boss enemies). */
export function hpScale(t: number): number {
  const m = t / 60;
  return 1 + m * 0.26 + m * m * 0.04;
}

export function damageScale(t: number): number {
  return 1 + (t / 60) * 0.13;
}

// ------------------------------------------------------------------ pilots

export interface PilotDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  color: string;
  cost: number;
  startWeapon: WeaponId;
  hpMult: number;
  dmgMult: number;
  speedMult: number;
  armor: number;
  regen: number;
  dashCharges: number;
  dashCooldownMult: number;
  dashDamageMult: number;
}

export const PILOTS: PilotDef[] = [
  {
    id: 'vector', name: 'VECTOR', title: 'The Balanced Blade',
    desc: 'Reliable in every situation. Starts with the Pulse Blaster.',
    color: '#4df3ff', cost: 0, startWeapon: WeaponId.Pulse,
    hpMult: 1, dmgMult: 1, speedMult: 1, armor: 0, regen: 0.6,
    dashCharges: 2, dashCooldownMult: 1, dashDamageMult: 1,
  },
  {
    id: 'razor', name: 'RAZOR', title: 'The Glass Cannon',
    desc: '+40% damage, +10% speed, but fragile. Starts with the Rail Lance.',
    color: '#ff5e7a', cost: 600, startWeapon: WeaponId.Rail,
    hpMult: 0.65, dmgMult: 1.4, speedMult: 1.1, armor: 0, regen: 0.4,
    dashCharges: 2, dashCooldownMult: 1, dashDamageMult: 1,
  },
  {
    id: 'bulwark', name: 'BULWARK', title: 'The Living Fortress',
    desc: '+80% HP, +3 armor, strong regen, slower. Starts with the Nova Pulse.',
    color: '#ff9f45', cost: 900, startWeapon: WeaponId.Nova,
    hpMult: 1.8, dmgMult: 0.95, speedMult: 0.88, armor: 3, regen: 1.6,
    dashCharges: 2, dashCooldownMult: 1.15, dashDamageMult: 1,
  },
  {
    id: 'wraith', name: 'WRAITH', title: 'The Phase Dancer',
    desc: '3 dashes, dash hits ×3 damage, fast recovery. Starts with Orbital Blades.',
    color: '#a06bff', cost: 1200, startWeapon: WeaponId.Blades,
    hpMult: 0.75, dmgMult: 1, speedMult: 1.05, armor: 0, regen: 0.5,
    dashCharges: 3, dashCooldownMult: 0.7, dashDamageMult: 3,
  },
];

// ------------------------------------------------------------------ armory

export interface MetaUpgradeDef {
  id: string;
  name: string;
  desc: (rank: number) => string;
  maxRank: number;
  baseCost: number;
}

export const META_UPGRADES: MetaUpgradeDef[] = [
  { id: 'vitality', name: 'Reinforced Hull', desc: r => `+${12 * r} max HP`, maxRank: 5, baseCost: 60 },
  { id: 'firepower', name: 'Weapon Lab', desc: r => `+${5 * r}% damage`, maxRank: 5, baseCost: 80 },
  { id: 'overclock', name: 'Chrono Chip', desc: r => `+${4 * r}% fire rate`, maxRank: 5, baseCost: 90 },
  { id: 'thrusters', name: 'Ion Thrusters', desc: r => `+${4 * r}% move speed`, maxRank: 5, baseCost: 70 },
  { id: 'magnet', name: 'Tractor Array', desc: r => `+${15 * r}% pickup radius`, maxRank: 5, baseCost: 50 },
  { id: 'wisdom', name: 'Neural Link', desc: r => `+${6 * r}% XP gain`, maxRank: 5, baseCost: 75 },
  { id: 'greed', name: 'Shard Refinery', desc: r => `+${10 * r}% shards earned`, maxRank: 5, baseCost: 65 },
  { id: 'adrenaline', name: 'Reroll Matrix', desc: r => `+${r} reroll${r > 1 ? 's' : ''} per run`, maxRank: 2, baseCost: 150 },
  { id: 'guardian', name: 'Phoenix Protocol', desc: () => `Revive once per run at 50% HP`, maxRank: 1, baseCost: 1200 },
];

export function metaCost(def: MetaUpgradeDef, rank: number): number {
  return Math.round((def.baseCost * Math.pow(rank + 1, 1.7)) / 5) * 5;
}

// ------------------------------------------------------------------ leveling

/** XP needed to go from (level-1) to level. */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 2);
  return Math.round(3 + n * 3.5 + Math.pow(n, 1.85) * 0.6);
}

export const RARITY_COLORS = ['#9aa7c7', '#4df3ff', '#a06bff', '#ffd75e'];
export const RARITY_NAMES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
