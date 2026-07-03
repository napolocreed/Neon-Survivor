export interface GlobalUpgrade {
  id: string;
  name: string;
  description: (level: number) => string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  apply: (stats: any, level: number) => void;
  prerequisites?: string[];
  gridRow?: number;
  gridCol?: number;
}

export const GLOBAL_UPGRADES: GlobalUpgrade[] = [
  {
    id: 'base_hp',
    name: 'Reinforced Chassis',
    description: (level) => `+${(level + 1) * 20} Starting Max HP`,
    maxLevel: 10,
    baseCost: 50,
    costMultiplier: 1.5,
    gridRow: 0,
    gridCol: 0,
    apply: (stats, level) => { 
      stats.maxHealth += level * 20; 
      stats.health += level * 20; 
    }
  },
  {
    id: 'damage',
    name: 'Weapon Calibration',
    description: (level) => `+${(level + 1) * 5} Base Damage`,
    maxLevel: 10,
    baseCost: 100,
    costMultiplier: 1.8,
    gridRow: 0,
    gridCol: 2,
    apply: (stats, level) => { 
      stats.damage += level * 5; 
    }
  },
  {
    id: 'regen',
    name: 'Nano-Repair Bots',
    description: (level) => `+${(level + 1) * 1} Base HP/sec`,
    maxLevel: 5,
    baseCost: 75,
    costMultiplier: 1.6,
    prerequisites: ['base_hp'],
    gridRow: 1,
    gridCol: 0,
    apply: (stats, level) => { 
      stats.healthRegen += level * 1; 
    }
  },
  {
    id: 'magnet',
    name: 'Graviton Module',
    description: (level) => `+${(level + 1) * 10}% Starting Magnet Radius`,
    maxLevel: 5,
    baseCost: 60,
    costMultiplier: 1.4,
    prerequisites: ['base_hp', 'damage'],
    gridRow: 1,
    gridCol: 1,
    apply: (stats, level) => { 
      stats.magnetRadius *= (1 + level * 0.1); 
    }
  },
  {
    id: 'speed',
    name: 'Overdrive Thrusters',
    description: (level) => `+${(level + 1) * 5}% Base Move Speed`,
    maxLevel: 5,
    baseCost: 80,
    costMultiplier: 1.5,
    prerequisites: ['damage'],
    gridRow: 1,
    gridCol: 2,
    apply: (stats, level) => { 
      stats.moveSpeed *= (1 + level * 0.05); 
    }
  },
  {
    id: 'crit_chance',
    name: 'Targeting Computer',
    description: (level) => `+${(level + 1) * 5}% Crit Chance`,
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.7,
    prerequisites: ['speed'],
    gridRow: 2,
    gridCol: 2,
    apply: (stats, level) => { 
      stats.baseCritChance += level * 0.05; 
    }
  },
  {
    id: 'xp_gain',
    name: 'Neural Uplink',
    description: (level) => `+${(level + 1) * 10}% XP Gain`,
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.6,
    prerequisites: ['magnet'],
    gridRow: 2,
    gridCol: 1,
    apply: (stats, level) => { 
      stats.xpGainMult = (stats.xpGainMult || 1) + (level * 0.1); 
    }
  },
  {
    id: 'armor',
    name: 'Ablative Plating',
    description: (level) => `Flat -${(level + 1) * 1} Damage Taken`,
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 2.0,
    prerequisites: ['regen'],
    gridRow: 2,
    gridCol: 0,
    apply: (stats, level) => { 
      stats.armor = (stats.armor || 0) + level; 
    }
  }
];

export type ChassisId = 'standard' | 'engineer' | 'glass_cannon' | 'speedster';

export interface Chassis {
  id: ChassisId;
  name: string;
  description: string;
  unlockCost: number;
  apply: (stats: any) => void;
  color: string;
}

export const CHASSIS_LIST: Chassis[] = [
  {
    id: 'standard',
    name: 'Vanguard (Standard)',
    description: 'Balanced starting chassis with standard weapon calibration.',
    unlockCost: 0,
    color: '#38bdf8',
    apply: (stats) => {
      stats.color = '#38bdf8';
    }
  },
  {
    id: 'engineer',
    name: 'The Engineer',
    description: 'Starts with 2 Orbitals, +50% Magnet Radius, but -20% Move Speed and -10% Damage.',
    unlockCost: 500,
    color: '#f59e0b',
    apply: (stats) => {
      stats.orbitals += 2;
      stats.magnetRadius *= 1.5;
      stats.moveSpeed *= 0.8;
      stats.damage *= 0.9;
      stats.color = '#f59e0b';
    }
  },
  {
    id: 'glass_cannon',
    name: 'Glass Cannon',
    description: 'Massive firepower. +200% Damage, +50% Attack Speed. Max HP is locked to 1.',
    unlockCost: 1000,
    color: '#ef4444',
    apply: (stats) => {
      stats.damage *= 3.0;
      stats.attackSpeed *= 0.5;
      stats.maxHealth = 1;
      stats.health = 1;
      stats.color = '#ef4444';
    }
  },
  {
    id: 'speedster',
    name: 'The Speedster',
    description: '+50% Move Speed, starts with 1 Chain Lightning jump. -30% Max HP.',
    unlockCost: 800,
    color: '#10b981',
    apply: (stats) => {
      stats.moveSpeed *= 1.5;
      stats.chainLightning += 1;
      stats.maxHealth *= 0.7;
      stats.health *= 0.7;
      stats.color = '#10b981';
    }
  }
];

export interface SaveData {
  nanites: number;
  globalUpgrades: {
    [upgradeId: string]: number;
  };
  unlockedChassis: ChassisId[];
  selectedChassis: ChassisId;
  stats: {
    highestCombo: number;
    longestRun: number;
    highestLevel: number;
    totalEnemiesDefeated: number;
    highestKillsInRun: number;
    gamesPlayed: number;
    totalNanitesEarned: number;
    totalDamageDealt: number;
    totalDamageTaken: number;
    totalTimePlayed: number;
    chassisPlayCounts: Record<string, number>;
    enemyKillsByType: Record<string, number>;
  };
  claimedAchievements: string[];
}

export const loadSaveData = (): SaveData => {
  const defaultSave: SaveData = { 
    nanites: 0, 
    globalUpgrades: {}, 
    unlockedChassis: ['standard'], 
    selectedChassis: 'standard',
    stats: {
      highestCombo: 0,
      longestRun: 0,
      highestLevel: 1,
      totalEnemiesDefeated: 0,
      highestKillsInRun: 0,
      gamesPlayed: 0,
      totalNanitesEarned: 0,
      totalDamageDealt: 0,
      totalDamageTaken: 0,
      totalTimePlayed: 0,
      chassisPlayCounts: {},
      enemyKillsByType: {}
    },
    claimedAchievements: []
  };
  
  try {
    const data = localStorage.getItem('neon_survivor_save');
    if (data) {
      const parsed = JSON.parse(data);
      return {
        nanites: parsed.nanites || 0,
        globalUpgrades: parsed.globalUpgrades || {},
        unlockedChassis: parsed.unlockedChassis || ['standard'],
        selectedChassis: parsed.selectedChassis || 'standard',
        stats: parsed.stats ? { ...defaultSave.stats, ...parsed.stats } : defaultSave.stats,
        claimedAchievements: parsed.claimedAchievements || []
      };
    }
  } catch (e) { }
  return defaultSave;
};

export interface Achievement {
  id: string;
  name: string;
  description: string;
  rewardNanites: number;
  rewardChassis?: ChassisId;
  check: (stats: SaveData['stats']) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'combo_50', name: 'Flow State', description: 'Reach a 50x Combo.', rewardNanites: 50, check: s => s.highestCombo >= 50 },
  { id: 'combo_100', name: 'Unstoppable', description: 'Reach a 100x Combo.', rewardNanites: 100, rewardChassis: 'glass_cannon', check: s => s.highestCombo >= 100 },
  { id: 'combo_200', name: 'Untouchable', description: 'Reach a 200x Combo.', rewardNanites: 250, check: s => s.highestCombo >= 200 },
  { id: 'combo_500', name: 'Godlike', description: 'Reach a 500x Combo.', rewardNanites: 1000, check: s => s.highestCombo >= 500 },
  
  { id: 'survive_5', name: 'Endurance I', description: 'Survive for 5 minutes in a single run.', rewardNanites: 50, check: s => s.longestRun >= 300 },
  { id: 'survive_10', name: 'Endurance II', description: 'Survive for 10 minutes in a single run.', rewardNanites: 150, check: s => s.longestRun >= 600 },
  { id: 'survive_15', name: 'Endurance III', description: 'Survive for 15 minutes in a single run.', rewardNanites: 300, check: s => s.longestRun >= 900 },
  { id: 'survive_30', name: 'Immortality', description: 'Survive for 30 minutes in a single run.', rewardNanites: 1000, check: s => s.longestRun >= 1800 },
  
  { id: 'level_25', name: 'Power I', description: 'Reach Level 25.', rewardNanites: 50, rewardChassis: 'speedster', check: s => s.highestLevel >= 25 },
  { id: 'level_50', name: 'Power II', description: 'Reach Level 50.', rewardNanites: 200, check: s => s.highestLevel >= 50 },
  { id: 'level_100', name: 'Ascension', description: 'Reach Level 100.', rewardNanites: 1000, check: s => s.highestLevel >= 100 },
  
  { id: 'kills_1000', name: 'Exterminator I', description: 'Defeat 1,000 enemies across all runs.', rewardNanites: 50, check: s => s.totalEnemiesDefeated >= 1000 },
  { id: 'kills_5000', name: 'Exterminator II', description: 'Defeat 5,000 enemies across all runs.', rewardNanites: 150, rewardChassis: 'engineer', check: s => s.totalEnemiesDefeated >= 5000 },
  { id: 'kills_25000', name: 'Exterminator III', description: 'Defeat 25,000 enemies across all runs.', rewardNanites: 400, check: s => s.totalEnemiesDefeated >= 25000 },
  { id: 'kills_100000', name: 'Genocide', description: 'Defeat 100,000 enemies across all runs.', rewardNanites: 2000, check: s => s.totalEnemiesDefeated >= 100000 },
  
  { id: 'kills_run_2000', name: 'Bloodlust I', description: 'Defeat 2,000 enemies in a single run.', rewardNanites: 100, check: s => (s.highestKillsInRun || 0) >= 2000 },
  { id: 'kills_run_5000', name: 'Bloodlust II', description: 'Defeat 5,000 enemies in a single run.', rewardNanites: 300, check: s => (s.highestKillsInRun || 0) >= 5000 },
  { id: 'kills_run_10000', name: 'One Man Army', description: 'Defeat 10,000 enemies in a single run.', rewardNanites: 1000, check: s => (s.highestKillsInRun || 0) >= 10000 },
];

export const saveGameData = (data: SaveData) => {
  localStorage.setItem('neon_survivor_save', JSON.stringify(data));
};

export const calculateUpgradeCost = (baseCost: number, multiplier: number, currentLevel: number) => {
  return Math.floor(baseCost * Math.pow(multiplier, currentLevel));
};
