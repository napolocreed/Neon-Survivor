// Core gameplay types. Entities are flat pooled structs (data-oriented):
// one interface carries every field any kind might use.

export const enum EnemyKind {
  Chaser = 0,
  Swarm = 1,
  Tank = 2,
  Dasher = 3,
  Spitter = 4,
  Splitter = 5,
  Mini = 6,
  Weaver = 7,
  Flocker = 8,
  BossWarden = 100,
  BossSeraph = 101,
  BossOmega = 102,
}

export const enum Affix {
  None = 0,
  Volatile = 1, // fires a bullet ring on death
  Armored = 2, // 40% damage reduction
  Swift = 3, // +60% speed
  Regen = 4, // heals over time — burst it down
  Phasing = 5, // teleports toward the player
}

export interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  touchDamage: number;
  kind: EnemyKind;
  elite: boolean;
  affix: Affix;
  xp: number;
  // fx / status
  flashTimer: number;
  spawnTimer: number; // fade-in, no collision while > 0
  hitCd: number; // contact-damage cooldown vs player
  grazeCd: number;
  kbx: number; // knockback velocity
  kby: number;
  kbResist: number; // 0..1, 1 = immune
  slowTimer: number;
  burnTimer: number;
  burnDps: number;
  chill: number; // 0..3 stacks; at 3 → frozen
  frozenTimer: number;
  shockTimer: number; // stunned + takes bonus damage
  acidTimer: number;
  acidDps: number;
  bladeCd: number; // orbital-blade re-hit throttle
  dashHitCd: number; // dash-through re-hit throttle
  zoneCd: number; // ground-zone tick throttle
  // AI scratch
  seed: number;
  flockId: number;
  aiState: number;
  aiTimer: number;
  aimX: number;
  aimY: number;
  shootTimer: number;
  angle: number;
}

export interface Projectile {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  pierce: number;
  life: number;
  kind: number; // WeaponId for visuals/behavior
  seed: number;
  homing: number; // steering strength, 0 = none
  targetIdx: number; // enemy index hint for homing (revalidated)
  hitCd: number;
  phase: number; // glaive: 0 outgoing 1 returning · mine: armed state · void orb: pull
  knockback: number;
}

export interface EnemyBullet {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  damage: number;
  life: number;
  grazed: boolean;
  hue: number;
}

export const enum PickupKind {
  Gem = 0,
  Shard = 1, // meta currency
  Health = 2,
  Magnet = 3,
  Nuke = 4,
  Chest = 5,
}

export interface Pickup {
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: PickupKind;
  value: number;
  magnetized: boolean;
  life: number; // gems live forever (-1); consumables decay
  seed: number;
}

export const enum ZoneKind {
  Acid = 0, // weapon pools & sector-2 hazard
  Fire = 1, // sector-3 hazard
  Void = 2, // event horizon (pull + dps)
}

export interface Zone {
  x: number;
  y: number;
  r: number;
  life: number;
  maxLife: number;
  dps: number;
  hostile: boolean; // true = hurts the player, false = hurts enemies
  kind: ZoneKind;
  telegraph: number; // warn time before it becomes active
  seed: number;
}

export interface TurretState {
  x: number;
  y: number;
  cooldown: number;
  angle: number;
}

export interface WormSeg {
  x: number;
  y: number;
}

export interface Worm {
  segs: WormSeg[];
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  damage: number;
  angle: number;
  seed: number;
  hitCd: number; // player contact throttle
  flashTimer: number;
  dying: number; // >0: cascade destruction in progress
  dyingIdx: number;
}

export const enum ParticleKind {
  Spark = 0, // bright dot with velocity + drag
  Orb = 1, // soft additive glow puff
  Ring = 2, // expanding circle stroke
  Ghost = 3, // player afterimage (dash)
  Shard = 4, // small rotating triangle debris
  Line = 5, // fast streak (speed lines)
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  kind: ParticleKind;
  color: number; // palette index
  rot: number;
  vrot: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  vy: number;
  value: number;
  life: number;
  crit: boolean;
}

export const enum WeaponId {
  Pulse = 0,
  Tesla = 1,
  Nova = 2,
  Swarm = 3,
  Rail = 4,
  Blades = 5,
  Cryo = 6,
  Acid = 7,
  Glaive = 8,
  Mines = 9,
  Turret = 10,
  Void = 11,
}

export const enum PassiveId {
  Power = 0,
  Overclock = 1,
  Amplifier = 2,
  Thrusters = 3,
  Vitality = 4,
  Lucky = 5,
  Magnet = 6,
  Plating = 7,
  Reactor = 8,
  Catalyst = 9, // status effect potency
}

export interface WeaponState {
  id: WeaponId;
  level: number; // 1..8, 9 = evolved
  cooldown: number;
  evolved: boolean;
  angle: number; // scratch (orbitals rotation…)
  burst: number; // scratch for burst fire
  burstTimer: number;
}

/** Recomputed from pilot + meta + passives + curses whenever anything changes. */
export interface PlayerStats {
  maxHp: number;
  regen: number;
  speed: number;
  magnet: number;
  armor: number;
  damageMult: number;
  fireRateMult: number; // multiplies attack cooldowns down
  areaMult: number;
  statusMult: number; // status-effect potency
  critChance: number;
  critMult: number;
  luck: number;
  xpMult: number;
  gemMult: number; // curse: gem value multiplier
  shardMult: number;
  damageTakenMult: number;
  dashCharges: number;
  dashCooldown: number;
  dashDamageMult: number;
  abilityCooldown: number;
}

export interface CardOffer {
  kind: 'weapon' | 'passive' | 'evolution' | 'heal' | 'shards';
  id: number; // WeaponId | PassiveId
  title: string;
  desc: string;
  rarity: 0 | 1 | 2 | 3; // common rare epic legendary
  isNew: boolean;
  level: number; // resulting level
}

export interface CurseDef {
  id: string;
  name: string;
  good: string;
  bad: string;
}

export type GamePhase = 'run' | 'levelup' | 'chest' | 'deal' | 'over' | 'victory' | 'paused';
