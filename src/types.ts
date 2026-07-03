export interface Vector2 {
  x: number;
  y: number;
}

export interface PlayerStats {
  damage: number;
  attackSpeed: number; // Attacks per second
  projectileSpeed: number;
  multiShot: number; // Number of extra projectiles
  pierce: number; // How many enemies a projectile can hit before dying
  explosiveChance: number; // 0 to 1
  explosiveRadius: number;
  explosiveDamageMult: number;
  maxHealth: number;
  health: number;
  healthRegen: number; // per second
  moveSpeed: number;
  magnetRadius: number; // Distance to attract XP gems
  chainLightning: number; // Number of jumps
  orbitals: number; // Number of orbiting energy balls
  freezeChance: number; // % chance to freeze
  corrosiveChance: number; // % chance to apply acid DoT
  baseCritChance: number; // Base % chance to crit
  baseCritMultiplier: number; // Critical damage multiplier
  shatterUnlocked: boolean; // Double damage to frozen targets
  plasmaBurnUnlocked: boolean; // Double acid damage and frequency
  vampireUnlocked: boolean; // Chance to heal on hit
  missiles: number; // Number of seeking missiles
  mines: number; // Level/Number of trailing mines
  turrets: number; // Number of stationary turrets
  abilityType: 'none' | 'emp' | 'dash';
  abilityCooldownMax: number;
  abilityCooldownTimer: number;
  color: string; // Color of the ship
  xpGainMult?: number;
  armor?: number;
}

export interface EnemyStatus {
  type: 'frozen' | 'corrosive';
  duration: number;
  tickTimer?: number;
}

export interface Enemy {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  hp: number;
  maxHp: number;
  speed: number;
  color: string;
  type: 'basic' | 'tank' | 'swarm' | 'dasher' | 'sniper' | 'summoner' | 'elite' | 'boss' | 'flocker' | 'worm_head' | 'worm_body';
  damage: number;
  worth: number; // XP value
  statuses: EnemyStatus[];
  dashTimer?: number; // For dashers
  shootTimer?: number; // For snipers / summoners / boss
  isElite?: boolean;
  isBoss?: boolean;
  targetId?: string; // For flockers / worm segments
}

export interface Projectile {
  id: string;
  pos: Vector2;
  vel: Vector2;
  radius: number;
  damage: number;
  pierceLeft: number;
  hitEnemies?: Set<string>;
  color: string;
  explosiveChance: number;
  explosiveRadius: number;
  explosiveDamageMult: number;
  life: number;
  targetId?: string; // For seeking missiles
  isMissile?: boolean;
}

export interface Mine {
  id: string;
  pos: Vector2;
  damage: number;
  radius: number;
  triggered?: boolean;
  triggerTimer?: number;
}

export interface Turret {
  id: string;
  pos: Vector2;
  damage: number;
  fireTimer: number;
  life: number;
}

export interface Particle {
  id: string;
  pos: Vector2;
  vel: Vector2;
  life: number;
  maxLife: number;
  color: string;
  size: number;
  type: 'spark' | 'explosion' | 'text' | 'lightning';
  text?: string;
  targetPos?: Vector2; // for lightning arcs
}

export interface XpGem {
  id: string;
  pos: Vector2;
  value: number;
  color: string;
}

export interface Drop {
  id: string;
  pos: Vector2;
  type: 'chest' | 'nuke' | 'vacuum';
  radius: number;
}

export interface GameState {
  playerPos: Vector2;
  playerAngle: number;
  cameraPos: Vector2;
  playerStats: PlayerStats;
  enemies: Enemy[];
  projectiles: Projectile[];
  enemyProjectiles: Projectile[];
  particles: Particle[];
  gems: XpGem[];
  mines: Mine[];
  turrets: Turret[];
  drops: Drop[];
  
  missileTimer: number;
  mineTimer: number;
  turretTimer: number;

  vacuumTimer: number;
  chestRewards: number | null; 

  eliteTimer: number;
  bossTimer: number;
  bossesSpawned: number;
  arenaCenter: Vector2 | null;
  arenaRadius: number;
  isArenaLocked: boolean;
  zoom: number;

  xp: number;
  xpToNext: number;
  level: number;
  isLevelingUp: boolean;
  
  combo: number;
  comboTimer: number; // Time left before combo resets
  isOverdrive: boolean;
  
  shakeIntensity: number;
  invulnerableTimer: number;
  score: number;
  time: number;
  isGameOver: boolean;
  kills: number;
  runStats: {
    damageDealt: number;
    damageTaken: number;
    killsByType: Record<string, number>;
  };
}

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  level: number;
  maxLevel: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  prerequisites?: string[]; // Array of upgrade IDs required before this can appear
  apply: (stats: PlayerStats) => void;
}

