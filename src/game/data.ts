// All content definitions: weapons, passives, enemies, pilots, sectors,
// curses, achievements, the Nanite Matrix. This file is the balance surface.

import { EnemyKind, PassiveId, WeaponId, CurseDef } from './types';

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
  elite: '#ffb02e',
  bullet: '#ff4d6d',
  weapons: [
    '#4df3ff', // pulse
    '#a06bff', // tesla
    '#ff9f45', // nova
    '#5eff9f', // swarm
    '#ff5e7a', // rail
    '#ffe45e', // blades
    '#7ad7ff', // cryo
    '#9fff45', // acid
    '#ff7ad7', // glaive
    '#ffb02e', // mines
    '#45d7ff', // turret
    '#c46bff', // void
  ] as string[],
};

export interface SectorDef {
  t: number;
  name: string;
  sub: string;
  bg: string;
  bgOver: string; // overdrive-tinted bg
  grid: string;
  star: string;
  hazard: 'none' | 'acid' | 'fire';
}

export const SECTORS: SectorDef[] = [
  {
    t: 0, name: 'SECTOR 01', sub: 'THE GRID',
    bg: '#05060f', bgOver: '#0d0a14', grid: 'rgba(77,163,255,0.07)', star: '160,190,255', hazard: 'none',
  },
  {
    t: 200, name: 'SECTOR 02', sub: 'ACID WASTES',
    bg: '#04100a', bgOver: '#0d1408', grid: 'rgba(94,255,159,0.08)', star: '150,255,190', hazard: 'acid',
  },
  {
    t: 420, name: 'SECTOR 03', sub: 'MELTDOWN CORE',
    bg: '#12060a', bgOver: '#161006', grid: 'rgba(255,110,90,0.08)', star: '255,170,150', hazard: 'fire',
  },
];

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
  levelDesc: string[]; // index = current level, describing the next one
}

export const WEAPONS: WeaponDef[] = [
  {
    id: WeaponId.Pulse, name: 'Pulse Blaster', evoName: 'HYPER REPEATER',
    desc: 'Rapid bolts seek the nearest threat.',
    evoDesc: 'Triple-burst storm of piercing mega-bolts.',
    pair: PassiveId.Overclock, color: COLORS.weapons[0], maxLevel: 8,
    levelDesc: ['Fires seeking bolts at the nearest enemy', '+1 projectile', '+25% damage', 'Faster fire rate', '+1 projectile', 'Bolts pierce +1 enemy', '+30% damage', '+1 projectile & faster fire rate'],
  },
  {
    id: WeaponId.Tesla, name: 'Arc Tesla', evoName: 'STORM CAGE',
    desc: 'Lightning that chains and stuns.',
    evoDesc: 'Perpetual storm — long chains, hard stuns.',
    pair: PassiveId.Lucky, color: COLORS.weapons[1], maxLevel: 8,
    levelDesc: ['Lightning strikes chain between enemies', '+1 chain jump', '+30% damage', 'Chains apply SHOCK (stun)', '+2 chain jumps', '+30% damage', 'Strikes twice', '+2 chains & faster strikes'],
  },
  {
    id: WeaponId.Nova, name: 'Nova Pulse', evoName: 'SUPERNOVA',
    desc: 'Fiery shockwave that sets everything ablaze.',
    evoDesc: 'Colossal blast that leaves the horde burning.',
    pair: PassiveId.Vitality, color: COLORS.weapons[2], maxLevel: 8,
    levelDesc: ['Emits a damaging shockwave around you', '+20% radius', 'Ignites enemies (BURN)', 'Faster pulses', '+25% radius', 'Adds heavy knockback', '+40% damage', '+30% radius & faster pulses'],
  },
  {
    id: WeaponId.Swarm, name: 'Homing Swarm', evoName: 'HIVE MIND',
    desc: 'Missiles that hunt targets on their own.',
    evoDesc: 'Kills spawn new missiles. The swarm feeds itself.',
    pair: PassiveId.Thrusters, color: COLORS.weapons[3], maxLevel: 8,
    levelDesc: ['Launches homing missiles', '+1 missile', '+25% damage', 'Sharper tracking', '+1 missile', '+30% damage', '+1 missile', '+2 missiles & faster launch'],
  },
  {
    id: WeaponId.Rail, name: 'Rail Lance', evoName: 'SINGULARITY LANCE',
    desc: 'Devastating beam that pierces the horde.',
    evoDesc: 'A gravity beam that drags enemies into its path.',
    pair: PassiveId.Power, color: COLORS.weapons[4], maxLevel: 8,
    levelDesc: ['Piercing rail shot toward the densest pack', '+35% damage', 'Wider beam', 'Faster charge', '+35% damage', 'Fires 2 lances', 'Wider beam', '+40% damage & faster charge'],
  },
  {
    id: WeaponId.Blades, name: 'Orbital Blades', evoName: 'HALO SAW',
    desc: 'Blades orbit you, shredding what they touch.',
    evoDesc: 'A massive saw-halo that slows and shreds.',
    pair: PassiveId.Amplifier, color: COLORS.weapons[5], maxLevel: 8,
    levelDesc: ['A blade orbits around you', '+1 blade', '+30% damage', 'Wider orbit', '+1 blade', 'Faster spin', '+1 blade & +30% damage', '+2 blades & wider orbit'],
  },
  {
    id: WeaponId.Cryo, name: 'Cryo Array', evoName: 'GLACIER STORM',
    desc: 'Ice shards that chill and freeze. Frozen enemies SHATTER.',
    evoDesc: 'Blizzard volleys + a freezing nova. Everything shatters.',
    pair: PassiveId.Catalyst, color: COLORS.weapons[6], maxLevel: 8,
    levelDesc: ['Fires chilling ice shards — 3 hits freeze', '+1 shard', '+25% damage', 'Deeper chill', '+2 shards', '+30% damage', 'Faster volleys', '+2 shards & deeper chill'],
  },
  {
    id: WeaponId.Acid, name: 'Acid Launcher', evoName: 'PLAGUE VATS',
    desc: 'Lobs globs that melt into corrosive pools.',
    evoDesc: 'Huge pools; melted enemies burst into acid.',
    pair: PassiveId.Reactor, color: COLORS.weapons[7], maxLevel: 8,
    levelDesc: ['Lobs a corrosive glob at packs', '+20% pool size', '+25% damage', 'Pools last longer', '+1 glob', '+30% damage', '+25% pool size', '+1 glob & faster lobs'],
  },
  {
    id: WeaponId.Glaive, name: 'Boomerang Glaive', evoName: 'TWIN CYCLONE',
    desc: 'A blade that flies out and carves its way back.',
    evoDesc: 'Two massive glaives in perpetual orbit-flight.',
    pair: PassiveId.Power, color: COLORS.weapons[8], maxLevel: 8,
    levelDesc: ['Throws a piercing returning glaive', '+30% damage', 'Bigger blade', 'Faster throws', '+35% damage', 'Throws 2 glaives', 'Bigger blade', '+40% damage & faster throws'],
  },
  {
    id: WeaponId.Mines, name: 'Mine Layer', evoName: 'CLUSTER FIELD',
    desc: 'Drops proximity mines in your wake.',
    evoDesc: 'Mines burst into chains of cluster explosions.',
    pair: PassiveId.Amplifier, color: COLORS.weapons[9], maxLevel: 8,
    levelDesc: ['Drops a proximity mine behind you', '+25% blast radius', '+30% damage', 'Faster deployment', '+1 mine per drop', '+30% damage', '+25% blast radius', 'Faster & bigger'],
  },
  {
    id: WeaponId.Turret, name: 'Drone Turret', evoName: 'SENTINEL NET',
    desc: 'Deploys an autonomous gun drone.',
    evoDesc: 'Two linked sentinels with a killing tether-beam.',
    pair: PassiveId.Overclock, color: COLORS.weapons[10], maxLevel: 8,
    levelDesc: ['Deploys a drone that shoots nearby enemies', '+25% fire rate', '+30% damage', 'Drone shoots 2 bolts', '+30% damage', 'Faster fire rate', '+35% damage', 'Relentless fire'],
  },
  {
    id: WeaponId.Void, name: 'Void Orb', evoName: 'EVENT HORIZON',
    desc: 'A slow orb that drags enemies into itself.',
    evoDesc: 'Collapses into a black hole that devours the field.',
    pair: PassiveId.Magnet, color: COLORS.weapons[11], maxLevel: 8,
    levelDesc: ['Launches a crushing gravity orb', '+25% damage', 'Stronger pull', 'Bigger orb', '+30% damage', 'Faster launches', 'Stronger pull', '+40% damage & bigger orb'],
  },
];

// ------------------------------------------------------------------ passives

export interface PassiveDef {
  id: PassiveId;
  name: string;
  desc: string;
  maxLevel: number;
  icon: string;
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
  { id: PassiveId.Catalyst, name: 'Catalyst', desc: '+15% status effect power', maxLevel: 5, icon: '☣' },
];

// ------------------------------------------------------------------ curses

export const CURSES: CurseDef[] = [
  { id: 'overcharge', name: 'Overcharge Core', good: '+35% damage', bad: '−25% max HP' },
  { id: 'glass', name: 'Glass Rounds', good: '+25% crit chance', bad: '+25% damage taken' },
  { id: 'berserk', name: 'Berserk Chip', good: '+25% fire rate', bad: 'No natural regen' },
  { id: 'greed', name: 'Greed Engine', good: 'XP gems worth ×2', bad: '−35% magnet radius' },
  { id: 'haste', name: 'Phase Racer', good: '+20% speed, +1 dash', bad: '−20% max HP' },
  { id: 'volatile', name: 'Volatile Rounds', good: 'Enemies explode on death', bad: 'Blasts hurt you too' },
  { id: 'singularity', name: 'Singularity Lens', good: '+40% area of effect', bad: 'Enemies 10% faster' },
  { id: 'vampire', name: 'Crimson Firmware', good: 'Heal 2 HP per kill in Overdrive', bad: 'Overdrive charges 30% slower' },
];

// ------------------------------------------------------------------ mutators

export interface MutatorDef {
  id: string;
  name: string;
  desc: string;
  weight: number;
}

export const MUTATORS: MutatorDef[] = [
  { id: 'null', name: 'STANDARD GRID', desc: 'No anomalies detected', weight: 2.2 },
  { id: 'volatile', name: 'VOLATILE GRID', desc: 'Enemies detonate on death', weight: 1 },
  { id: 'rich', name: 'GILDED GRID', desc: '+40% gems · enemies 15% faster', weight: 1 },
  { id: 'swarm', name: 'SWARM GRID', desc: 'Hordes ×1.35 · enemies −20% HP', weight: 1 },
  { id: 'titan', name: 'TITAN GRID', desc: 'Elites hunt twice as often', weight: 1 },
  { id: 'phantom', name: 'PHANTOM GRID', desc: '+1 dash charge · −15% max HP', weight: 1 },
  { id: 'storm', name: 'STORM GRID', desc: 'Wild lightning strikes your foes', weight: 1 },
  { id: 'cryo', name: 'FROZEN GRID', desc: 'Enemies 12% slower · +15% HP', weight: 1 },
];

export const REACTIONS = {
  thermal: 'THERMAL SHOCK',
  superconduct: 'SUPERCONDUCT',
  electrolysis: 'ELECTROLYSIS',
  napalm: 'NAPALM',
} as const;

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
  [EnemyKind.Flocker]: { hp: 14, speed: 130, radius: 11, damage: 7, xp: 2, kbResist: 0 },
  [EnemyKind.BossWarden]: { hp: 1900, speed: 55, radius: 52, damage: 22, xp: 60, kbResist: 1 },
  [EnemyKind.BossSeraph]: { hp: 6800, speed: 62, radius: 56, damage: 26, xp: 100, kbResist: 1 },
  [EnemyKind.BossOmega]: { hp: 16000, speed: 70, radius: 64, damage: 32, xp: 200, kbResist: 1 },
};

export const BOSS_NAMES: Record<number, string> = {
  [EnemyKind.BossWarden]: 'THE WARDEN',
  [EnemyKind.BossSeraph]: 'SERAPH-9',
  [EnemyKind.BossOmega]: 'OMEGA PRIME',
};

export const WORM = {
  hp: 900, // head hp, scaled by hpScale
  segCount: 12,
  segSpacing: 24,
  radius: 16,
  speed: 155,
  damage: 14,
  xp: 40,
};

// spawn timeline
export interface WavePhase {
  t: number;
  interval: number;
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

export const BOSS_SLOT_TIMES = [180, 390, 600];

/** Candidate pools per boss slot — each run rolls one boss per slot. */
export const BOSS_POOLS: EnemyKind[][] = [
  [EnemyKind.BossWarden],
  [EnemyKind.BossSeraph],
  [EnemyKind.BossOmega],
];

export const EVENTS: { t: number; type: 'ring' | 'stream' | 'flock' | 'worm' }[] = [
  { t: 95, type: 'flock' },
  { t: 140, type: 'ring' },
  { t: 245, type: 'stream' },
  { t: 280, type: 'worm' },
  { t: 330, type: 'flock' },
  { t: 360, type: 'ring' },
  { t: 460, type: 'stream' },
  { t: 490, type: 'worm' },
  { t: 520, type: 'flock' },
  { t: 575, type: 'ring' },
];

export function hpScale(t: number): number {
  const m = t / 60;
  return 1 + m * 0.26 + m * m * 0.04;
}

export function damageScale(t: number): number {
  return 1 + (t / 60) * 0.13;
}

// ------------------------------------------------------------------ ship silhouettes
// Polygon points in unit space, nose toward +x. Shared by canvas & menu SVG.

export const SHIP_PATHS: Record<string, [number, number][]> = {
  vector: [[1.35, 0], [-0.9, 0.95], [-0.45, 0], [-0.9, -0.95]],
  razor: [[1.65, 0], [-0.35, 0.42], [-1.05, 0.72], [-0.7, 0], [-1.05, -0.72], [-0.35, -0.42]],
  bulwark: [[1.1, 0], [0.35, 0.62], [-0.55, 1.0], [-0.95, 0.45], [-0.6, 0], [-0.95, -0.45], [-0.55, -1.0], [0.35, -0.62]],
  wraith: [[1.35, 0], [-0.1, 0.42], [-1.15, 0.95], [-0.55, 0.12], [-0.55, -0.12], [-1.15, -0.95], [-0.1, -0.42]],
  glitch: [[1.45, 0.12], [-0.25, 0.88], [-0.75, 0.28], [-1.05, -0.55], [-0.15, -0.75]],
};

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
  ability: 'overload' | 'bullettime' | 'aegis' | 'phantom' | 'anomaly';
  abilityName: string;
  abilityDesc: string;
  abilityCd: number;
}

export const PILOTS: PilotDef[] = [
  {
    id: 'vector', name: 'VECTOR', title: 'The Balanced Blade',
    desc: 'Reliable in every situation. Starts with the Pulse Blaster.',
    color: '#4df3ff', cost: 0, startWeapon: WeaponId.Pulse,
    hpMult: 1, dmgMult: 1, speedMult: 1, armor: 0, regen: 0.6,
    dashCharges: 2, dashCooldownMult: 1, dashDamageMult: 1,
    ability: 'overload', abilityName: 'OVERLOAD', abilityDesc: 'Devastating shockwave around you', abilityCd: 40,
  },
  {
    id: 'razor', name: 'RAZOR', title: 'The Glass Cannon',
    desc: '+40% damage, +10% speed, but fragile. Starts with the Rail Lance.',
    color: '#ff5e7a', cost: 600, startWeapon: WeaponId.Rail,
    hpMult: 0.65, dmgMult: 1.4, speedMult: 1.1, armor: 0, regen: 0.4,
    dashCharges: 2, dashCooldownMult: 1, dashDamageMult: 1,
    ability: 'bullettime', abilityName: 'BULLET TIME', abilityDesc: 'Slow the world for 3.5s', abilityCd: 32,
  },
  {
    id: 'bulwark', name: 'BULWARK', title: 'The Living Fortress',
    desc: '+80% HP, +3 armor, strong regen, slower. Starts with the Nova Pulse.',
    color: '#ff9f45', cost: 900, startWeapon: WeaponId.Nova,
    hpMult: 1.8, dmgMult: 0.95, speedMult: 0.88, armor: 3, regen: 1.6,
    dashCharges: 2, dashCooldownMult: 1.15, dashDamageMult: 1,
    ability: 'aegis', abilityName: 'AEGIS', abilityDesc: '3s invulnerable — contact burns attackers', abilityCd: 38,
  },
  {
    id: 'wraith', name: 'WRAITH', title: 'The Phase Dancer',
    desc: '3 dashes, dash hits ×3 damage, fast recovery. Starts with Orbital Blades.',
    color: '#a06bff', cost: 1200, startWeapon: WeaponId.Blades,
    hpMult: 0.75, dmgMult: 1, speedMult: 1.05, armor: 0, regen: 0.5,
    dashCharges: 3, dashCooldownMult: 0.7, dashDamageMult: 3,
    ability: 'phantom', abilityName: 'PHANTOM STRIKE', abilityDesc: 'Chain-dash through 3 enemies', abilityCd: 26,
  },
  {
    id: 'glitch', name: 'GLITCH', title: 'The Anomaly',
    desc: 'Starts with 2 random weapons. +20% luck. Nobody knows what it is.',
    color: '#5eff9f', cost: 2000, startWeapon: WeaponId.Pulse, // randomized at run start
    hpMult: 0.9, dmgMult: 1, speedMult: 1, armor: 0, regen: 0.6,
    dashCharges: 2, dashCooldownMult: 1, dashDamageMult: 1,
    ability: 'anomaly', abilityName: 'ANOMALY', abilityDesc: 'Something happens. Always something good.', abilityCd: 35,
  },
];

// ------------------------------------------------------------------ nanite matrix

export interface MatrixNode {
  id: string;
  name: string;
  desc: (rank: number) => string;
  maxRank: number;
  baseCost: number;
  branch: 0 | 1 | 2; // offense · survival · fortune
  tier: 0 | 1 | 2;
}

export const MATRIX: MatrixNode[] = [
  // OFFENSE
  { id: 'firepower', name: 'Weapon Lab', desc: r => `+${5 * r}% damage`, maxRank: 5, baseCost: 70, branch: 0, tier: 0 },
  { id: 'overclock', name: 'Chrono Chip', desc: r => `+${4 * r}% fire rate`, maxRank: 5, baseCost: 90, branch: 0, tier: 1 },
  { id: 'warcore', name: 'War Core', desc: () => 'Start every run with your weapon at Level 2', maxRank: 1, baseCost: 900, branch: 0, tier: 2 },
  // SURVIVAL
  { id: 'vitality', name: 'Reinforced Hull', desc: r => `+${12 * r} max HP`, maxRank: 5, baseCost: 60, branch: 1, tier: 0 },
  { id: 'thrusters', name: 'Ion Thrusters', desc: r => `+${4 * r}% move speed`, maxRank: 5, baseCost: 80, branch: 1, tier: 1 },
  { id: 'guardian', name: 'Phoenix Protocol', desc: () => 'Revive once per run at 50% HP', maxRank: 1, baseCost: 1100, branch: 1, tier: 2 },
  // FORTUNE
  { id: 'greed', name: 'Shard Refinery', desc: r => `+${10 * r}% shards earned`, maxRank: 5, baseCost: 65, branch: 2, tier: 0 },
  { id: 'wisdom', name: 'Neural Link', desc: r => `+${6 * r}% XP gain`, maxRank: 5, baseCost: 75, branch: 2, tier: 1 },
  { id: 'fortune', name: 'Fortune Engine', desc: () => '+1 reroll & +1 banish per run', maxRank: 1, baseCost: 800, branch: 2, tier: 2 },
];

export const MATRIX_BRANCHES = ['OFFENSE', 'SURVIVAL', 'FORTUNE'];

export function matrixCost(def: MatrixNode, rank: number): number {
  return Math.round((def.baseCost * Math.pow(rank + 1, 1.7)) / 5) * 5;
}

// ------------------------------------------------------------------ achievements

export interface AchievementDef {
  id: string;
  name: string;
  desc: string;
  reward: number; // shards
  /** returns progress 0..1 given profile-level stats snapshot */
  check: (s: AchievementStats) => boolean;
}

export interface AchievementStats {
  totalKills: number;
  bestTime: number;
  bestCombo: number;
  victories: number;
  runGraze: number;
  runOverdrives: number;
  runDashKills: number;
  evolutionsSeen: number;
  bossKills: [number, number, number];
  totalFrozen: number;
  wormKills: number;
  shardsHeld: number;
  pilotsOwned: number;
  cursesTaken: number;
  endlessTime: number;
  bestChain: number;
  reactionsSeen: number;
  surgesCleared: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { id: 'blood', name: 'First Contact', desc: 'Destroy 100 enemies (total)', reward: 50, check: s => s.totalKills >= 100 },
  { id: 'slayer', name: 'Exterminator', desc: 'Destroy 5,000 enemies (total)', reward: 200, check: s => s.totalKills >= 5000 },
  { id: 'legion', name: 'Legion Slayer', desc: 'Destroy 25,000 enemies (total)', reward: 500, check: s => s.totalKills >= 25000 },
  { id: 'surv5', name: 'Still Alive', desc: 'Survive 5 minutes', reward: 100, check: s => s.bestTime >= 300 },
  { id: 'clear', name: 'Sector Cleared', desc: 'Destroy OMEGA PRIME', reward: 500, check: s => s.victories >= 1 },
  { id: 'combo50', name: 'Flow State', desc: 'Reach a 50× combo', reward: 100, check: s => s.bestCombo >= 50 },
  { id: 'combo150', name: 'Untouchable Rhythm', desc: 'Reach a 150× combo', reward: 250, check: s => s.bestCombo >= 150 },
  { id: 'graze', name: 'Death Dancer', desc: 'Graze 150 times in one run', reward: 150, check: s => s.runGraze >= 150 },
  { id: 'od3', name: 'Golden Hour', desc: 'Trigger Overdrive 3 times in one run', reward: 150, check: s => s.runOverdrives >= 3 },
  { id: 'dashk', name: 'Phase Reaper', desc: '30 dash kills in one run', reward: 150, check: s => s.runDashKills >= 30 },
  { id: 'evo1', name: 'Metamorphosis', desc: 'Evolve a weapon', reward: 100, check: s => s.evolutionsSeen >= 1 },
  { id: 'evo6', name: 'Full Arsenal', desc: 'Discover 6 evolutions (all-time)', reward: 400, check: s => s.evolutionsSeen >= 6 },
  { id: 'warden', name: 'Warden Down', desc: 'Destroy THE WARDEN', reward: 100, check: s => s.bossKills[0] >= 1 },
  { id: 'seraph', name: 'Wings Clipped', desc: 'Destroy SERAPH-9', reward: 150, check: s => s.bossKills[1] >= 1 },
  { id: 'frozen', name: 'Absolute Zero', desc: 'Freeze 200 enemies (total)', reward: 150, check: s => s.totalFrozen >= 200 },
  { id: 'worm', name: 'Serpent Slayer', desc: 'Destroy a Void Serpent', reward: 150, check: s => s.wormKills >= 1 },
  { id: 'deal', name: 'Deal With It', desc: 'Accept a Cursed Tech offer', reward: 75, check: s => s.cursesTaken >= 1 },
  { id: 'endless15', name: 'Beyond The Wall', desc: 'Reach 15:00 in Endless', reward: 300, check: s => s.endlessTime >= 900 },
  { id: 'chain8', name: 'You Are The Bullet', desc: 'Reach an 8× dash chain', reward: 150, check: s => s.bestChain >= 8 },
  { id: 'chain15', name: 'Human Railgun', desc: 'Reach a 15× dash chain', reward: 300, check: s => s.bestChain >= 15 },
  { id: 'chemist', name: 'Grid Chemist', desc: 'Discover all 4 elemental reactions', reward: 300, check: s => s.reactionsSeen >= 4 },
  { id: 'surge', name: 'Defiant', desc: 'Survive a Defiance Surge', reward: 150, check: s => s.surgesCleared >= 1 },
];

// ------------------------------------------------------------------ leveling

/** XP needed to go from (level-1) to level. */
export function xpForLevel(level: number): number {
  const n = Math.max(0, level - 2);
  return Math.round(3 + n * 3.5 + Math.pow(n, 1.85) * 0.6);
}

export const RARITY_COLORS = ['#9aa7c7', '#4df3ff', '#a06bff', '#ffd75e'];
export const RARITY_NAMES = ['COMMON', 'RARE', 'EPIC', 'LEGENDARY'];
