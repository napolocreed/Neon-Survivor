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
  BossWarden = 100,
  BossSeraph = 101,
  BossOmega = 102,
}

export const enum Affix {
  None = 0,
  Volatile = 1, // fires a bullet ring on death
  Armored = 2, // 40% damage reduction
  Swift = 3, // +60% speed
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
  bladeCd: number; // orbital-blade re-hit throttle
  dashHitCd: number; // dash-through re-hit throttle
  // AI scratch
  seed: number;
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
  hitCd: number; // for persistent beams: per-frame hit throttle
  lastHit: number; // enemy slot bitfilter is overkill; short memory of last enemy hit
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
}

export interface WeaponState {
  id: WeaponId;
  level: number; // 1..8, 9 = evolved
  cooldown: number;
  evolved: boolean;
  angle: number; // scratch (orbitals rotation, rail sweep...)
  burst: number; // scratch for burst fire
  burstTimer: number;
}

/** Recomputed from pilot + meta + passives whenever anything changes. */
export interface PlayerStats {
  maxHp: number;
  regen: number;
  speed: number;
  magnet: number;
  armor: number;
  damageMult: number;
  fireRateMult: number; // multiplies attack cooldowns down
  areaMult: number;
  projSpeedMult: number;
  critChance: number;
  critMult: number;
  luck: number;
  xpMult: number;
  shardMult: number;
  dashCharges: number;
  dashCooldown: number;
  dashDamageMult: number;
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

export type GamePhase = 'run' | 'levelup' | 'chest' | 'over' | 'victory' | 'paused';
