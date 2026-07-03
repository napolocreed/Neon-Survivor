import { Upgrade } from './types';

export const UPGRADES: Upgrade[] = [
  // -------------------------
  // CORE WEAPONRY
  // -------------------------
  {
    id: 'dmg',
    name: 'Plasma Emitter',
    description: '+10 Base Damage. Melt through armor.',
    level: 0,
    maxLevel: 100,
    rarity: 'common',
    apply: (stats) => { stats.damage += 10; }
  },
  {
    id: 'atk_spd',
    name: 'Overclock Drive',
    description: '+15% Attack Speed. Unleash a torrent of fire.',
    level: 0,
    maxLevel: 20,
    rarity: 'rare',
    apply: (stats) => { stats.attackSpeed *= 1.15; }
  },
  {
    id: 'multi',
    name: 'Splitter Core',
    description: 'Fire +1 Projectile simultaneously.',
    level: 0,
    maxLevel: 4,
    rarity: 'legendary',
    apply: (stats) => { stats.multiShot += 1; }
  },
  {
    id: 'pierce',
    name: 'Kinetic Penetrator',
    description: 'Projectiles pierce through +1 enemy.',
    level: 0,
    maxLevel: 5,
    rarity: 'epic',
    apply: (stats) => { stats.pierce += 1; }
  },
  {
    id: 'proj_spd',
    name: 'Railgun Accelerator',
    description: '+30% Projectile Speed.',
    level: 0,
    maxLevel: 10,
    rarity: 'common',
    apply: (stats) => { stats.projectileSpeed *= 1.30; }
  },

  // -------------------------
  // ACTIVE ABILITIES
  // -------------------------
  {
    id: 'emp_ability',
    name: 'EMP Pulse (Active)',
    description: 'Unlocks EMP Active Ability. Deals massive damage and pushes enemies away. 15s cooldown.',
    level: 0,
    maxLevel: 1,
    rarity: 'legendary',
    apply: (stats) => { 
        stats.abilityType = 'emp'; 
        stats.abilityCooldownMax = 15;
    }
  },
  {
    id: 'ability_cd',
    name: 'Cooling Vents',
    description: '-10% Active Ability Cooldown.',
    level: 0,
    maxLevel: 5,
    rarity: 'epic',
    prerequisites: ['emp_ability'],
    apply: (stats) => { stats.abilityCooldownMax *= 0.90; }
  },

  // -------------------------
  // CRITICAL HIT BUILD
  // -------------------------
  {
    id: 'crit_chance',
    name: 'Targeting Matrix',
    description: '+10% Critical Hit Chance.',
    level: 0,
    maxLevel: 5,
    rarity: 'epic',
    apply: (stats) => { stats.baseCritChance += 0.10; }
  },
  {
    id: 'crit_dmg',
    name: 'Weakpoint Analyzer',
    description: '+50% Critical Hit Damage.',
    level: 0,
    maxLevel: 5,
    rarity: 'rare',
    prerequisites: ['crit_chance'],
    apply: (stats) => { stats.baseCritMultiplier += 0.50; }
  },

  // -------------------------
  // EXPLOSIVE BUILD
  // -------------------------
  {
    id: 'exp_chance',
    name: 'Volatile Munitions',
    description: '+15% chance for projectiles to explode on impact.',
    level: 0,
    maxLevel: 6,
    rarity: 'epic',
    apply: (stats) => { stats.explosiveChance += 0.15; }
  },
  {
    id: 'exp_radius',
    name: 'Blast Expander',
    description: '+30% Explosion Radius. Massive area damage.',
    level: 0,
    maxLevel: 10,
    rarity: 'rare',
    prerequisites: ['exp_chance'],
    apply: (stats) => { stats.explosiveRadius *= 1.3; }
  },
  {
    id: 'exp_dmg',
    name: 'Shrapnel Warheads',
    description: '+50% Explosion Damage.',
    level: 0,
    maxLevel: 10,
    rarity: 'rare',
    prerequisites: ['exp_chance'],
    apply: (stats) => { stats.explosiveDamageMult += 0.5; }
  },
  {
    id: 'cluster_nuke',
    name: 'CLUSTER NUKE (Evolution)',
    description: 'Explosions trigger mini-explosions. Screen clearing potential.',
    level: 0,
    maxLevel: 1,
    rarity: 'legendary',
    prerequisites: ['exp_chance', 'multi'], // Requires multi-shot and explosive
    apply: (stats) => { 
        stats.explosiveChance += 0.50;
        stats.explosiveRadius *= 2.0;
        stats.explosiveDamageMult *= 2.0;
    }
  },

  // -------------------------
  // ELEMENTAL BUILDS
  // -------------------------
  {
    id: 'lightning',
    name: 'Tesla Coil',
    description: 'Projectiles chain lightning to nearby enemies (+1 Jump).',
    level: 0,
    maxLevel: 8,
    rarity: 'legendary',
    apply: (stats) => { stats.chainLightning += 1; }
  },
  {
    id: 'cryo',
    name: 'Cryogenic Rounds',
    description: '+20% chance to freeze enemies on hit, slowing them drastically.',
    level: 0,
    maxLevel: 5,
    rarity: 'rare',
    apply: (stats) => { stats.freezeChance += 0.20; }
  },
  {
    id: 'corrosive',
    name: 'Corrosive Payload',
    description: '+25% chance to apply Acid DoT (Damage over Time) on hit.',
    level: 0,
    maxLevel: 4,
    rarity: 'epic',
    apply: (stats) => { stats.corrosiveChance += 0.25; }
  },
  {
    id: 'plasma_burn',
    name: 'Plasma Scorch (Evolution)',
    description: 'Corrosive effects deal double damage and tick twice as fast.',
    level: 0,
    maxLevel: 1,
    rarity: 'legendary',
    prerequisites: ['corrosive', 'dmg'],
    apply: (stats) => { 
        stats.plasmaBurnUnlocked = true; 
    }
  },
  {
    id: 'shatter',
    name: 'Shatter Force',
    description: 'Frozen enemies take +100% damage from your weapons.',
    level: 0,
    maxLevel: 1,
    rarity: 'legendary',
    prerequisites: ['cryo'],
    apply: (stats) => {
        stats.shatterUnlocked = true;
    }
  },

  // -------------------------
  // DRONES & ORBITALS
  // -------------------------
  {
    id: 'orbital',
    name: 'Aegis Drone',
    description: '+1 Energy Shield orbiting your core, damaging enemies on contact.',
    level: 0,
    maxLevel: 6,
    rarity: 'epic',
    apply: (stats) => { stats.orbitals += 1; }
  },
  {
    id: 'seeker_missile',
    name: 'Swarm Missiles',
    description: 'Fire seeking missiles periodically that track enemies and explode.',
    level: 0,
    maxLevel: 5,
    rarity: 'rare',
    apply: (stats) => { stats.missiles += 2; } // +2 missiles per burst per level
  },
  {
    id: 'proximity_mine',
    name: 'Plasma Mines',
    description: 'Periodically drop proximity mines behind you that deal massive AoE damage.',
    level: 0,
    maxLevel: 5,
    rarity: 'epic',
    apply: (stats) => { stats.mines += 1; }
  },
  {
    id: 'auto_turret',
    name: 'Deployable Turret',
    description: 'Deploy stationary turrets that auto-fire at nearby enemies.',
    level: 0,
    maxLevel: 4,
    rarity: 'legendary',
    apply: (stats) => { stats.turrets += 1; }
  },

  // -------------------------
  // UTILITY & SURVIVABILITY
  // -------------------------
  {
    id: 'regen',
    name: 'Nano-Repairs',
    description: '+3 HP/sec passive regeneration.',
    level: 0,
    maxLevel: 20,
    rarity: 'common',
    apply: (stats) => { stats.healthRegen += 3; }
  },
  {
    id: 'vampire',
    name: 'Vampiric Plating',
    description: 'Projectile hits have a 5% chance to heal you for 1 HP.',
    level: 0,
    maxLevel: 1,
    rarity: 'legendary',
    apply: (stats) => { stats.vampireUnlocked = true; }
  },
  {
    id: 'max_hp',
    name: 'Hull Reinforcement',
    description: '+100 Max HP. Fortify your core.',
    level: 0,
    maxLevel: 20,
    rarity: 'common',
    apply: (stats) => { 
      stats.maxHealth += 100; 
      stats.health += 100; 
    }
  },
  {
    id: 'move_spd',
    name: 'Thruster Upgrade',
    description: '+15% Movement Speed. Outmaneuver the horde.',
    level: 0,
    maxLevel: 10,
    rarity: 'common',
    apply: (stats) => { stats.moveSpeed *= 1.15; }
  },
  {
    id: 'magnet',
    name: 'Graviton Field',
    description: '+40% XP Gem Pickup Radius.',
    level: 0,
    maxLevel: 10,
    rarity: 'rare',
    apply: (stats) => { stats.magnetRadius *= 1.4; }
  },
  
  // -------------------------
  // CURSED / DEVIL DEALS
  // -------------------------
  {
    id: 'cursed_power',
    name: 'Dark Matter Core (CURSED)',
    description: '+100% Damage, but -50% Max HP and -50% Regen.',
    level: 0,
    maxLevel: 3,
    rarity: 'legendary',
    apply: (stats) => {
        stats.damage *= 2;
        stats.maxHealth *= 0.5;
        stats.health = Math.min(stats.health, stats.maxHealth);
        stats.healthRegen *= 0.5;
    }
  },
  {
    id: 'cursed_frenzy',
    name: 'Blood Engine (CURSED)',
    description: '+100% Attack Speed, but slowly drains health over time (-2 HP/sec).',
    level: 0,
    maxLevel: 3,
    rarity: 'legendary',
    apply: (stats) => {
        stats.attackSpeed *= 2;
        stats.healthRegen -= 2;
    }
  }
];
