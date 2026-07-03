import { GameState, Enemy, Projectile, Particle, Vector2, XpGem } from './types';
import { playSound } from './audio';
import { GLOBAL_UPGRADES, CHASSIS_LIST, ChassisId } from './metaStore';

let spawnTimer = 0;
let attackTimer = 0;
let regenTimer = 0;

class SpatialGrid {
  cellSize: number;
  cells: Map<string, Enemy[]>;

  constructor(cellSize: number) {
    this.cellSize = cellSize;
    this.cells = new Map();
  }

  clear() {
    this.cells.clear();
  }

  insert(enemy: Enemy) {
    const col = Math.floor(enemy.pos.x / this.cellSize);
    const row = Math.floor(enemy.pos.y / this.cellSize);
    const key = `${col},${row}`;
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(enemy);
  }

  getNearby(pos: Vector2, searchRadius: number): Enemy[] {
    const startCol = Math.floor((pos.x - searchRadius) / this.cellSize);
    const endCol = Math.floor((pos.x + searchRadius) / this.cellSize);
    const startRow = Math.floor((pos.y - searchRadius) / this.cellSize);
    const endRow = Math.floor((pos.y + searchRadius) / this.cellSize);

    const result: Enemy[] = [];
    for (let c = startCol; c <= endCol; c++) {
      for (let r = startRow; r <= endRow; r++) {
        const cell = this.cells.get(`${c},${r}`);
        if (cell) {
          for (let i = 0; i < cell.length; i++) {
             result.push(cell[i]);
          }
        }
      }
    }
    return result;
  }
}

const enemyGrid = new SpatialGrid(150);

export const createInitialState = (globalUpgrades: { [key: string]: number } = {}, selectedChassis: ChassisId = 'standard'): GameState => {
  const state: GameState = {
    playerPos: { x: 0, y: 0 },
    playerAngle: -Math.PI / 2,
    cameraPos: { x: 0, y: 0 },
    playerStats: {
      damage: 15,
      attackSpeed: 1.5,
      projectileSpeed: 600,
      multiShot: 0,
      pierce: 0,
      explosiveChance: 0,
      explosiveRadius: 80,
      explosiveDamageMult: 0.5,
      maxHealth: 100,
      health: 100,
      healthRegen: 1,
      moveSpeed: 300,
      magnetRadius: 150, 
      chainLightning: 0,
      orbitals: 0,
      freezeChance: 0,
      corrosiveChance: 0,
      baseCritChance: 0.05,
      baseCritMultiplier: 1.5,
      shatterUnlocked: false,
      plasmaBurnUnlocked: false,
      vampireUnlocked: false,
      missiles: 0,
      mines: 0,
      turrets: 0,
      abilityType: 'none',
      abilityCooldownMax: 10,
      abilityCooldownTimer: 0,
      color: '#38bdf8',
    },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    particles: [],
    gems: [],
    mines: [],
    turrets: [],
    drops: [],
    missileTimer: 0,
    mineTimer: 0,
    turretTimer: 0,
    vacuumTimer: 0,
    chestRewards: null,
    eliteTimer: 0,
    bossTimer: 0,
    bossesSpawned: 0,
    arenaCenter: null,
    arenaRadius: 2000,
    isArenaLocked: false,
    zoom: 1.0,
    xp: 0,
    xpToNext: 20, 
    level: 1,
    isLevelingUp: false,
    combo: 0,
    comboTimer: 0,
    isOverdrive: false,
    shakeIntensity: 0,
    invulnerableTimer: 0,
    score: 0,
    time: 0,
    isGameOver: false,
    kills: 0,
    runStats: {
      damageDealt: 0,
      damageTaken: 0,
      killsByType: {}
    }
  };

  // Apply Global Upgrades
  for (const upgrade of GLOBAL_UPGRADES) {
    const level = globalUpgrades[upgrade.id] || 0;
    if (level > 0) {
      upgrade.apply(state.playerStats, level);
    }
  }

  // Apply Chassis
  const chassis = CHASSIS_LIST.find(c => c.id === selectedChassis);
  if (chassis) {
    chassis.apply(state.playerStats);
  }

  return state;
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const distance = (p1: Vector2, p2: Vector2) => {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
};

const normalize = (v: Vector2): Vector2 => {
  const len = Math.sqrt(v.x * v.x + v.y * v.y);
  if (len === 0) return { x: 0, y: 0 };
  return { x: v.x / len, y: v.y / len };
};

const spawnEnemy = (state: GameState, isElite = false, forceType?: Enemy['type'], overridePos?: Vector2) => {
  let x, y;
  if (overridePos) {
     x = overridePos.x;
     y = overridePos.y;
  } else {
    const angle = Math.random() * Math.PI * 2;
    const dist = 1200 + Math.random() * 200;
    x = state.playerPos.x + Math.cos(angle) * dist;
    y = state.playerPos.y + Math.sin(angle) * dist;
  }

  const waveMultiplier = 1 + Math.pow(state.time / 60, 1.4) * 2.5; 

  const rand = Math.random();
  let type: Enemy['type'] = forceType || 'basic';
  
  if (!forceType) {
    if (state.time > 120 && rand < 0.05) {
      type = 'worm_head';
    } else if (state.time > 100 && rand < 0.1) {
      type = 'flocker';
    } else if (state.time > 80 && rand < 0.15) {
      type = 'summoner';
    } else if (state.time > 60 && rand < 0.25) {
      type = 'sniper';
    } else if (state.time > 40 && rand < 0.35) {
      type = 'dasher';
    } else if (state.time > 20 && rand < 0.45) {
      type = 'tank';
    } else if (state.time > 30 && rand > 0.75) {
      type = 'swarm';
    }
  }

  let hp = 40 * waveMultiplier;
  let speed = 150 + Math.random() * 40;
  let radius = 18;
  let color = '#ef4444'; // red
  let worth = 5;
  let damage = 15;
  let dashTimer = 0;
  let shootTimer = 0;

  if (type === 'tank') {
    hp = 180 * waveMultiplier;
    speed = 90 + Math.random() * 20;
    radius = 32;
    color = '#eab308'; // yellow
    worth = 20;
    damage = 35;
  } else if (type === 'swarm') {
    hp = 20 * waveMultiplier;
    speed = 240 + Math.random() * 50;
    radius = 12;
    color = '#a855f7'; // purple
    worth = 2;
    damage = 5;
  } else if (type === 'dasher') {
    hp = 60 * waveMultiplier;
    speed = 100; // very slow normally, but dashes
    radius = 20;
    color = '#f97316'; // orange
    worth = 15;
    damage = 25;
    dashTimer = 2;
  } else if (type === 'sniper') {
    hp = 50 * waveMultiplier;
    speed = 110; 
    radius = 24;
    color = '#06b6d4'; // cyan
    worth = 15;
    damage = 10;
    shootTimer = 3;
  } else if (type === 'summoner') {
    hp = 120 * waveMultiplier;
    speed = 70;
    radius = 28;
    color = '#8b5cf6'; // violet
    worth = 30;
    damage = 15;
    shootTimer = 4;
  } else if (type === 'boss') {
    hp = 1500 * waveMultiplier;
    speed = 100;
    radius = 80;
    color = '#dc2626'; // strong red
    worth = 1000;
    damage = 25;
    shootTimer = 2;
    isElite = true;
  } else if (type === 'flocker') {
    hp = 30 * waveMultiplier;
    speed = 180 + Math.random() * 30;
    radius = 16;
    color = '#10b981'; // emerald green
    worth = 5;
    damage = 10;
  } else if (type === 'worm_head') {
    hp = 200 * waveMultiplier;
    speed = 160;
    radius = 28;
    color = '#ec4899'; // pink
    worth = 50;
    damage = 30;
  } else if (type === 'worm_body') {
    hp = 80 * waveMultiplier;
    speed = 160;
    radius = 24;
    color = '#be185d'; // dark pink
    worth = 10;
    damage = 20;
  }

  if (isElite && type !== 'boss') {
     hp *= 5;
     radius *= 1.5;
     damage *= 2;
     worth *= 5;
     // Give it a slightly different color or stroke in rendering if elite
  }

  const newId = generateId();
  state.enemies.push({
    id: newId,
    pos: { x, y },
    vel: { x: 0, y: 0 },
    radius,
    hp,
    maxHp: hp,
    speed,
    color,
    type,
    damage: damage * waveMultiplier,
    worth: Math.floor(worth * waveMultiplier),
    statuses: [],
    dashTimer,
    shootTimer,
    isElite,
    isBoss: type === 'boss'
  });

  if (!forceType) {
    if (type === 'flocker') {
      for (let i = 0; i < 4; i++) {
        spawnEnemy(state, false, 'flocker', { x: x + (Math.random() - 0.5) * 100, y: y + (Math.random() - 0.5) * 100 });
      }
    } else if (type === 'worm_head') {
      let prevId = newId;
      for (let i = 0; i < 6; i++) {
        // Spawn 6 body segments, spaced slightly apart, targeting the previous segment
        const bodyId = generateId();
        const distOffset = (i + 1) * 30;
        state.enemies.push({
          id: bodyId,
          pos: { x: x - distOffset, y: y - distOffset }, // initial offset doesn't matter much as they will snap to following
          vel: { x: 0, y: 0 },
          radius: 24,
          hp: 80 * waveMultiplier,
          maxHp: 80 * waveMultiplier,
          speed: 160,
          color: '#be185d',
          type: 'worm_body',
          damage: 20 * waveMultiplier,
          worth: Math.floor(10 * waveMultiplier),
          statuses: [],
          targetId: prevId
        });
        prevId = bodyId;
      }
    }
  }
};

const spawnParticles = (state: GameState, pos: Vector2, color: string, count: number, type: Particle['type'], text?: string, targetPos?: Vector2, isCrit?: boolean) => {
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = type === 'explosion' ? Math.random() * 220 + 50 : Math.random() * 70 + 20;
    
    let baseSize = 0;
    if (type === 'text') {
        baseSize = Math.floor(isCrit ? 26 + Math.random() * 8 : 14 + Math.random() * 4);
    } else if (type === 'explosion') {
        baseSize = Math.random() * 6 + 3;
    } else {
        baseSize = Math.random() * 4 + 1;
    }

    state.particles.push({
      id: generateId(),
      pos: { ...pos },
      vel: type === 'text' ? { x: (Math.random() - 0.5) * (isCrit ? 100 : 40), y: (isCrit ? -120 : -60) - Math.random() * 40 } : { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
      life: type === 'text' ? (isCrit ? 1.2 : 0.8) : type === 'explosion' ? 0.4 + Math.random() * 0.3 : type === 'lightning' ? 0.2 : 0.5 + Math.random() * 0.5,
      maxLife: type === 'text' ? (isCrit ? 1.2 : 0.8) : type === 'explosion' ? 0.7 : type === 'lightning' ? 0.2 : 1,
      color,
      size: baseSize,
      type,
      text,
      targetPos
    });
  }
};

const triggerExplosion = (state: GameState, pos: Vector2, radius: number, damage: number, sourceEnemyId?: string) => {
  playSound('explosion');
  spawnParticles(state, pos, '#f97316', 35, 'explosion');
  state.shakeIntensity = Math.min(state.shakeIntensity + 10, 30); 
  
  const nearby = enemyGrid.getNearby(pos, radius + 80);
  nearby.forEach(enemy => {
    if (enemy.id === sourceEnemyId || enemy.hp <= 0) return;
    const dist = distance(pos, enemy.pos);
    if (dist <= radius + enemy.radius) {
      enemy.hp -= damage;
      state.runStats.damageDealt += damage;
      spawnParticles(state, enemy.pos, '#f97316', 1, 'text', Math.floor(damage).toString());
      if (enemy.hp <= 0) {
        handleEnemyDeath(state, enemy);
      }
    }
  });
};

const handleChainLightning = (state: GameState, startPos: Vector2, damage: number, jumps: number, hitSet: Set<string>) => {
  if (jumps <= 0) return;
  
  let nearest: Enemy | null = null;
  let minDist = 300; // Chain jump radius
  
  const nearby = enemyGrid.getNearby(startPos, minDist);
  for (const e of nearby) {
    if (e.hp > 0 && !hitSet.has(e.id)) {
      const d = distance(startPos, e.pos);
      if (d < minDist) {
        minDist = d;
        nearest = e;
      }
    }
  }

  if (nearest) {
    playSound('lightning');
    hitSet.add(nearest.id);
    const jumpDmg = damage * 0.75;
    nearest.hp -= jumpDmg; // 75% damage on jumps
    state.runStats.damageDealt += jumpDmg;
    
    // Create lightning arc particle
    spawnParticles(state, startPos, '#60a5fa', 1, 'lightning', undefined, { ...nearest.pos });
    spawnParticles(state, nearest.pos, '#60a5fa', 1, 'text', Math.floor(jumpDmg).toString());
    spawnParticles(state, nearest.pos, '#60a5fa', 8, 'spark');

    if (nearest.hp <= 0) {
      handleEnemyDeath(state, nearest);
    }
    
    // Recursively jump
    handleChainLightning(state, nearest.pos, damage, jumps - 1, hitSet);
  }
};

export const triggerActiveAbility = (state: GameState) => {
  if (state.playerStats.abilityCooldownTimer > 0 || state.playerStats.abilityType === 'none') return;
  
  if (state.playerStats.abilityType === 'emp') {
     playSound('explosion'); // maybe a different sound for EMP?
     spawnParticles(state, state.playerPos, '#06b6d4', 100, 'explosion');
     state.shakeIntensity = 40;
     
     // EMP deals damage and pushes enemies away
     state.enemies.forEach(enemy => {
       const dist = distance(state.playerPos, enemy.pos);
       if (dist <= 400 + enemy.radius) {
          const empDmg = state.playerStats.damage * 5;
          enemy.hp -= empDmg;
          state.runStats.damageDealt += empDmg;
          
          // push back
          const pushDir = normalize({ x: enemy.pos.x - state.playerPos.x, y: enemy.pos.y - state.playerPos.y });
          enemy.pos.x += pushDir.x * 200;
          enemy.pos.y += pushDir.y * 200;
          
          spawnParticles(state, enemy.pos, '#06b6d4', 1, 'text', Math.floor(empDmg).toString());
          if (enemy.hp <= 0) {
            handleEnemyDeath(state, enemy);
          }
       }
     });
     
     // Clear enemy projectiles
     state.enemyProjectiles = state.enemyProjectiles.filter(p => distance(state.playerPos, p.pos) > 400);
     
  } else if (state.playerStats.abilityType === 'dash') {
     playSound('shoot');
     state.playerStats.health = Math.min(state.playerStats.maxHealth, state.playerStats.health + 50); // heal a bit? no, just move?
     // Actually, let's just make it a shockwave for now or give massive movespeed.
     // Let's keep it simple: clear projectiles around player.
     state.enemyProjectiles = [];
     spawnParticles(state, state.playerPos, '#10b981', 50, 'spark');
  }

  state.playerStats.abilityCooldownTimer = state.playerStats.abilityCooldownMax;
};

const handleEnemyDeath = (state: GameState, enemy: Enemy) => {
  if (enemy.hp === -9999) return;
  enemy.hp = -9999;

  // Combo system
  state.combo += 1;
  state.comboTimer = 3; // 3 seconds to keep combo alive
  state.kills += 1;
  state.runStats.killsByType[enemy.type] = (state.runStats.killsByType[enemy.type] || 0) + 1;
  
  const comboMultiplier = 1 + Math.min(state.combo * 0.05, 2.0); // up to 3x multiplier
  
  state.score += Math.floor(enemy.worth * 10 * comboMultiplier);

  if (enemy.isBoss) {
    state.isArenaLocked = false;
    spawnParticles(state, enemy.pos, '#facc15', 100, 'explosion');
    state.shakeIntensity = 40;
  }
  spawnParticles(state, enemy.pos, enemy.color, 12, 'spark');

  let gemColor = '#38bdf8'; 
  if (enemy.worth >= 15) gemColor = '#4ade80'; 
  if (enemy.worth >= 50) gemColor = '#c084fc'; 

  state.gems.push({
    id: generateId(),
    pos: { ...enemy.pos },
    value: enemy.worth,
    color: gemColor
  });

  if (enemy.type === 'tank') {
    for (let i = 0; i < 3; i++) {
      const angle = (Math.PI * 2 / 3) * i;
      state.enemies.push({
        id: generateId(),
        pos: { x: enemy.pos.x + Math.cos(angle) * 15, y: enemy.pos.y + Math.sin(angle) * 15 },
        vel: { x: 0, y: 0 },
        radius: 12,
        hp: enemy.maxHp * 0.3,
        maxHp: enemy.maxHp * 0.3,
        speed: 210,
        color: '#a855f7',
        type: 'swarm',
        damage: enemy.damage * 0.5,
        worth: Math.floor(enemy.worth / 3),
        statuses: []
      });
    }
  }

  if (enemy.isElite) {
    state.drops.push({
      id: generateId(),
      pos: { ...enemy.pos },
      type: 'chest',
      radius: 15
    });
  } else if (Math.random() < 0.005) { // 0.5% chance
    state.drops.push({
      id: generateId(),
      pos: { ...enemy.pos },
      type: Math.random() < 0.5 ? 'nuke' : 'vacuum',
      radius: 12
    });
  }
};

const fireMissiles = (state: GameState) => {
  for (let i = 0; i < state.playerStats.missiles; i++) {
    let target = null;
    let minD = Infinity;
    const nearby = enemyGrid.getNearby(state.playerPos, 800);
    for (const e of nearby) {
      const d = distance(state.playerPos, e.pos);
      if (d < minD) {
        minD = d;
        target = e;
      }
    }
    const angle = Math.PI * 2 * Math.random();
    const vel = { x: Math.cos(angle) * 150, y: Math.sin(angle) * 150 };
    
    state.projectiles.push({
      id: generateId(),
      pos: { ...state.playerPos },
      vel,
      radius: 8,
      damage: state.playerStats.damage * 1.5,
      pierceLeft: 0,
      color: '#f97316',
      explosiveChance: 1, 
      explosiveRadius: state.playerStats.explosiveRadius || 60,
      explosiveDamageMult: state.playerStats.explosiveDamageMult || 0.5,
      life: 5,
      targetId: target?.id,
      isMissile: true,
    });
  }
};

const dropMine = (state: GameState) => {
  state.mines.push({
    id: generateId(),
    pos: { ...state.playerPos },
    damage: state.playerStats.damage * 3 * state.playerStats.mines,
    radius: 40 + (state.playerStats.mines * 10),
  });
};

const spawnTurret = (state: GameState) => {
  state.turrets.push({
    id: generateId(),
    pos: { ...state.playerPos },
    damage: state.playerStats.damage * 0.8,
    fireTimer: 0,
    life: 20,
  });
};

const updateMines = (state: GameState, dt: number) => {
  for (let i = state.mines.length - 1; i >= 0; i--) {
    const m = state.mines[i];
    
    if (m.triggered && m.triggerTimer !== undefined) {
       m.triggerTimer -= dt;
       if (m.triggerTimer <= 0) {
          playSound('hit');
          spawnParticles(state, m.pos, '#facc15', 40, 'explosion');
          const blastRadius = m.radius * 3.5;
          const nearbyBlast = enemyGrid.getNearby(m.pos, blastRadius + 80);
          for (const e of nearbyBlast) {
            if (distance(m.pos, e.pos) <= blastRadius) {
              e.hp -= m.damage;
              state.runStats.damageDealt += m.damage;
              spawnParticles(state, e.pos, '#ffffff', 1, 'text', Math.floor(m.damage).toString());
            }
          }
          state.mines.splice(i, 1);
       }
       continue;
    }

    let detected = false;
    const nearby = enemyGrid.getNearby(m.pos, m.radius + 80); // 80 is max enemy radius roughly
    for (const e of nearby) {
      if (distance(m.pos, e.pos) < m.radius + e.radius) {
        detected = true;
        break;
      }
    }
    
    if (detected) {
      m.triggered = true;
      m.triggerTimer = 0.5; // 0.5 seconds delay
    }
  }
};

const updateTurrets = (state: GameState, dt: number) => {
  for (let i = state.turrets.length - 1; i >= 0; i--) {
    const t = state.turrets[i];
    t.life -= dt;
    if (t.life <= 0) {
      state.turrets.splice(i, 1);
      continue;
    }
    
    t.fireTimer -= dt;
    if (t.fireTimer <= 0) {
      let target = null;
      let minD = 400; // Turret range
      const nearby = enemyGrid.getNearby(t.pos, 400);
      for (const e of nearby) {
        const d = distance(t.pos, e.pos);
        if (d < minD) {
          minD = d;
          target = e;
        }
      }
      if (target) {
        t.fireTimer = 1 / state.playerStats.attackSpeed; // Fire with player's rate
        playSound('shoot');
        const baseDir = normalize({ x: target.pos.x - t.pos.x, y: target.pos.y - t.pos.y });
        const baseAngle = Math.atan2(baseDir.y, baseDir.x);
        
        const multi = 1 + state.playerStats.multiShot;
        const spread = 0.2; // roughly 11 degrees
        const startAngle = baseAngle - (spread * (multi - 1)) / 2;

        for (let j = 0; j < multi; j++) {
           const angle = startAngle + j * spread;
           const dir = { x: Math.cos(angle), y: Math.sin(angle) };
           
           let damage = state.playerStats.damage; // use player damage instead of weak turret damage
           let color = '#fbbf24';
           if (Math.random() < state.playerStats.baseCritChance) {
               damage *= state.playerStats.baseCritMultiplier;
               color = '#ef4444';
           }

           state.projectiles.push({
             id: generateId(),
             pos: { ...t.pos },
             vel: { x: dir.x * 500, y: dir.y * 500 },
             radius: 5,
             damage: damage,
             pierceLeft: state.playerStats.pierce,
             color: color,
             explosiveChance: state.playerStats.explosiveChance,
             explosiveRadius: state.playerStats.explosiveRadius,
             explosiveDamageMult: state.playerStats.explosiveDamageMult || 0,
             life: 1.0,
           });
        }
      }
    }
  }
};

export const updateGame = (state: GameState, dt: number, joystickDir: Vector2) => {
  if (state.isGameOver || state.isLevelingUp || state.chestRewards !== null) return;
  
  state.time += dt;
  spawnTimer += dt;
  attackTimer += dt;
  regenTimer += dt;
  
  if (state.comboTimer > 0) {
    state.comboTimer -= dt;
    if (state.comboTimer <= 0) {
      state.combo = 0;
    }
  }

  if (state.combo >= 50) {
    if (!state.isOverdrive) {
      state.isOverdrive = true;
      playSound('levelup');
      spawnParticles(state, state.playerPos, '#facc15', 30, 'explosion');
      spawnParticles(state, state.playerPos, '#facc15', 1, 'text', 'OVERDRIVE!');
    }
  } else {
    state.isOverdrive = false;
  }

  if (state.shakeIntensity > 0) {
    state.shakeIntensity -= dt * 40;
    if (state.shakeIntensity < 0) state.shakeIntensity = 0;
  }

  if (state.invulnerableTimer > 0) {
    state.invulnerableTimer -= dt;
  }

  if (regenTimer >= 1) {
    regenTimer = 0;
    if (state.playerStats.health < state.playerStats.maxHealth) {
      state.playerStats.health = Math.min(state.playerStats.maxHealth, state.playerStats.health + state.playerStats.healthRegen);
    }
  }

  if (state.playerStats.missiles > 0) {
    state.missileTimer += dt;
    if (state.missileTimer >= 2) {
      state.missileTimer = 0;
      fireMissiles(state);
    }
  }

  if (state.playerStats.mines > 0) {
    state.mineTimer += dt;
    if (state.mineTimer >= 3 / state.playerStats.mines) {
      state.mineTimer = 0;
      dropMine(state);
    }
  }

  if (state.playerStats.turrets > 0) {
    state.turretTimer += dt;
    if (state.turretTimer >= 15) {
      state.turretTimer = 0;
      spawnTurret(state);
    }
  }

  enemyGrid.clear();
  for (let i = 0; i < state.enemies.length; i++) {
     enemyGrid.insert(state.enemies[i]);
  }

  updateTurrets(state, dt);
  updateMines(state, dt);

  const spawnRate = Math.max(0.05, 1.2 - (state.time / 150)); 
  if (spawnTimer >= spawnRate && !state.isArenaLocked) {
    spawnTimer = 0;
    spawnEnemy(state);
  }

  // Elite Spawning (Every 1.5 minutes)
  state.eliteTimer += dt;
  if (state.eliteTimer >= 90 && !state.isArenaLocked) {
    state.eliteTimer = 0;
    spawnEnemy(state, true);
  }

  // Boss Spawning (Level 10 or 3 minutes)
  state.bossTimer += dt;
  let shouldSpawnBoss = false;
  
  if (state.bossTimer >= 180 && !state.isArenaLocked) {
    shouldSpawnBoss = true;
  } else if (state.level >= 10 && state.bossesSpawned === 0 && !state.isArenaLocked) {
    shouldSpawnBoss = true;
  }

  if (shouldSpawnBoss) {
    state.bossTimer = 0;
    state.bossesSpawned += 1;
    state.isArenaLocked = true;
    state.arenaCenter = { ...state.playerPos };
    state.arenaRadius = 800; // Shrink arena
    
    // Clear out existing normal enemies to make room for the boss
    state.enemies = [];
    
    spawnEnemy(state, false, 'boss');
  }

  // Arena Lockdown bounds enforcement
  if (state.isArenaLocked && state.arenaCenter) {
     const d = distance(state.playerPos, state.arenaCenter);
     if (d > state.arenaRadius - 30) {
        const angle = Math.atan2(state.playerPos.y - state.arenaCenter.y, state.playerPos.x - state.arenaCenter.x);
        state.playerPos.x = state.arenaCenter.x + Math.cos(angle) * (state.arenaRadius - 30);
        state.playerPos.y = state.arenaCenter.y + Math.sin(angle) * (state.arenaRadius - 30);
     }
  }

  // Camera smooth follow with buffer
  const cameraLerpSpeed = 4;
  state.cameraPos.x += (state.playerPos.x - state.cameraPos.x) * cameraLerpSpeed * dt;
  state.cameraPos.y += (state.playerPos.y - state.cameraPos.y) * cameraLerpSpeed * dt;

  // Zoom lerp
  const targetZoom = state.isArenaLocked ? 0.6 : 1.0;
  state.zoom += (targetZoom - state.zoom) * 2 * dt;

  let currentMoveSpeed = state.playerStats.moveSpeed;
  let currentAttackSpeed = state.playerStats.attackSpeed;
  
  if (state.isOverdrive) {
    currentMoveSpeed *= 1.5;
    currentAttackSpeed *= 1.5;
  }

  if (joystickDir.x !== 0 || joystickDir.y !== 0) {
    state.playerPos.x += joystickDir.x * currentMoveSpeed * dt;
    state.playerPos.y += joystickDir.y * currentMoveSpeed * dt;
    
    const targetAngle = Math.atan2(joystickDir.y, joystickDir.x);
    let diff = targetAngle - state.playerAngle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    state.playerAngle += diff * 12 * dt;
    
    // Trail effect
    if (Math.random() < 0.3 + (state.isOverdrive ? 0.3 : 0)) {
       spawnParticles(state, { x: state.playerPos.x - joystickDir.x * 15, y: state.playerPos.y - joystickDir.y * 15 }, state.isOverdrive ? '#facc15' : state.playerStats.color, 1, 'spark');
    }
  }

  // Ability Timer
  if (state.playerStats.abilityCooldownTimer > 0) {
     state.playerStats.abilityCooldownTimer -= dt;
  }

  // Graze Logic
  let isGrazing = false;
  for (const e of state.enemies) {
    const dist = distance(state.playerPos, e.pos);
    if (dist < e.radius + 15 + 60 && dist > e.radius + 15) { // 60px graze zone
      isGrazing = true;
      break;
    }
  }

  if (isGrazing) {
    state.comboTimer = Math.min(3, state.comboTimer + dt * 2);
    if (Math.random() < 0.2) { // Occasionally add to combo
       state.combo += 1;
       state.score += 5;
       spawnParticles(state, state.playerPos, '#94a3b8', 1, 'spark');
    }
  }

  // Orbital Shields Logic
  if (state.playerStats.orbitals > 0) {
    const orbitalSpeed = 3; // rad/s
    const orbitalRadius = 70;
    
    for (let i = 0; i < state.playerStats.orbitals; i++) {
       const angle = state.time * orbitalSpeed + (Math.PI * 2 / state.playerStats.orbitals) * i;
       const ox = state.playerPos.x + Math.cos(angle) * orbitalRadius;
       const oy = state.playerPos.y + Math.sin(angle) * orbitalRadius;
       
       // Optional: Add trail particles for orbitals occasionally
       if (Math.random() < 0.2) {
           spawnParticles(state, {x: ox, y: oy}, '#a855f7', 1, 'spark');
       }
       
       for (const e of state.enemies) {
         if (e.hp > 0 && distance({x: ox, y: oy}, e.pos) < e.radius + 15) {
            const orbitalDmg = (state.playerStats.damage * 2) * dt;
            e.hp -= orbitalDmg; 
            state.runStats.damageDealt += orbitalDmg;
            
            if (Math.random() < 0.1) {
               playSound('hit');
               spawnParticles(state, e.pos, '#a855f7', 1, 'text', Math.floor(state.playerStats.damage).toString());
            }
            
            if (e.hp <= 0) {
              handleEnemyDeath(state, e);
            }
         }
       }
    }
  }

  if (attackTimer >= 1 / currentAttackSpeed && state.enemies.length > 0) {
    attackTimer = 0;
    
    const sortedEnemies = [...state.enemies].sort((a, b) => distance(state.playerPos, a.pos) - distance(state.playerPos, b.pos));
    const target = sortedEnemies[0];

    if (target && distance(state.playerPos, target.pos) < 1200) { 
      playSound('shoot');
      const dir = normalize({ x: target.pos.x - state.playerPos.x, y: target.pos.y - state.playerPos.y });
      
      const fireProjectile = (angleOffset: number) => {
        const angle = Math.atan2(dir.y, dir.x) + angleOffset;
        const vel = { x: Math.cos(angle) * state.playerStats.projectileSpeed, y: Math.sin(angle) * state.playerStats.projectileSpeed };
        state.projectiles.push({
          id: generateId(),
          pos: { ...state.playerPos },
          vel,
          radius: 6,
          damage: state.playerStats.damage,
          pierceLeft: state.playerStats.pierce,
          color: '#38bdf8', 
          explosiveChance: state.playerStats.explosiveChance,
          explosiveRadius: state.playerStats.explosiveRadius,
          explosiveDamageMult: state.playerStats.explosiveDamageMult,
          life: 1.5,
        });
      };

      fireProjectile(0);
      for (let i = 1; i <= state.playerStats.multiShot; i++) {
        const spread = 0.12;
        fireProjectile(i * spread * (i % 2 === 0 ? -1 : 1) * Math.ceil(i/2));
      }
    }
  }

  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const p = state.projectiles[i];

    if (p.isMissile && p.targetId) {
       const target = state.enemies.find(e => e.id === p.targetId);
       if (target && target.hp > 0) {
          const dir = normalize({ x: target.pos.x - p.pos.x, y: target.pos.y - p.pos.y });
          const speed = 400;
          p.vel.x += (dir.x * speed - p.vel.x) * 5 * dt;
          p.vel.y += (dir.y * speed - p.vel.y) * 5 * dt;
       } else {
          p.targetId = undefined; // Target lost or dead
       }
       if (Math.random() < 0.3) {
          spawnParticles(state, p.pos, '#facc15', 1, 'spark');
       }
    }

    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;

    if (p.life <= 0) {
      state.projectiles.splice(i, 1);
      continue;
    }

    const nearby = enemyGrid.getNearby(p.pos, p.radius + 80);
    for (let j = nearby.length - 1; j >= 0; j--) {
      const e = nearby[j];
      if (e.hp <= 0) continue;
      if (p.hitEnemies && p.hitEnemies.has(e.id)) continue;

      if (distance(p.pos, e.pos) <= p.radius + e.radius) {
        if (!p.hitEnemies) p.hitEnemies = new Set();
        p.hitEnemies.add(e.id);
        
        playSound('hit');
        
        // Apply Elemental Statuses
        let isFrozen = false;
        if (state.playerStats.freezeChance > 0 && Math.random() < state.playerStats.freezeChance) {
          e.statuses.push({ type: 'frozen', duration: 3 });
          spawnParticles(state, e.pos, '#38bdf8', 5, 'spark'); // ice particles
          isFrozen = true;
        } else {
          isFrozen = e.statuses.some(s => s.type === 'frozen');
        }

        if (state.playerStats.corrosiveChance > 0 && Math.random() < state.playerStats.corrosiveChance) {
          e.statuses.push({ type: 'corrosive', duration: 4, tickTimer: 0 });
          spawnParticles(state, e.pos, '#22c55e', 5, 'spark'); // acid particles
        }

        // Critical hits based on combo + base stats
        const isCrit = Math.random() < state.playerStats.baseCritChance;
        const comboMultiplier = 1 + (state.combo * 0.01); 
        let totalDamage = p.damage * comboMultiplier * (isCrit ? state.playerStats.baseCritMultiplier : 1);
        
        // Shatter mechanic: double damage if frozen and shatter is unlocked
        if (isFrozen && state.playerStats.shatterUnlocked) {
           totalDamage *= 2.0; 
        }

        e.hp -= totalDamage;
        state.runStats.damageDealt += totalDamage;
        const textColor = isCrit ? '#fbbf24' : '#ffffff';
        spawnParticles(state, e.pos, textColor, 1, 'text', Math.floor(totalDamage).toString() + (isCrit ? '!' : ''), undefined, isCrit);
        spawnParticles(state, e.pos, p.color, 4, 'spark');

        if (state.playerStats.vampireUnlocked && Math.random() < 0.05) { // 5% chance to heal 1hp
           state.playerStats.health = Math.min(state.playerStats.maxHealth, state.playerStats.health + 1);
           spawnParticles(state, state.playerPos, '#ef4444', 2, 'text', '+1');
        }

        const willExplode = Math.random() < p.explosiveChance;
        if (willExplode) {
          triggerExplosion(state, e.pos, p.explosiveRadius, totalDamage * p.explosiveDamageMult, e.id);
        }

        if (state.playerStats.chainLightning > 0) {
           const hitSet = new Set([e.id]);
           handleChainLightning(state, e.pos, totalDamage, state.playerStats.chainLightning, hitSet);
        }

        if (p.pierceLeft > 0) {
          p.pierceLeft--;
        } else {
          state.projectiles.splice(i, 1);
          break; 
        }
      }
    }
  }

  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hp <= 0 && e.hp !== -9999) {
      handleEnemyDeath(state, e);
    }
    
    if (e.hp === -9999) {
       state.enemies.splice(i, 1);
       continue;
    }

    // Process Status Effects
    let currentSpeed = e.speed;
    let isDeadFromDoT = false;
    for (let s = e.statuses.length - 1; s >= 0; s--) {
       const status = e.statuses[s];
       status.duration -= dt;
       
         if (status.type === 'frozen') {
         currentSpeed *= 0.3; // 70% slow
       } else if (status.type === 'corrosive') {
         status.tickTimer = (status.tickTimer || 0) + dt;
         const tickInterval = state.playerStats.plasmaBurnUnlocked ? 0.25 : 0.5;
         if (status.tickTimer >= tickInterval) {
            status.tickTimer = 0;
            const dmgMult = state.playerStats.plasmaBurnUnlocked ? 0.4 : 0.2;
            const dotDmg = state.playerStats.damage * dmgMult;
            e.hp -= dotDmg;
            state.runStats.damageDealt += dotDmg;
            spawnParticles(state, { x: e.pos.x + Math.random() * 10 - 5, y: e.pos.y + Math.random() * 10 - 5 }, state.playerStats.plasmaBurnUnlocked ? '#f97316' : '#22c55e', 1, 'text', Math.floor(dotDmg).toString());
            spawnParticles(state, e.pos, state.playerStats.plasmaBurnUnlocked ? '#f97316' : '#22c55e', 1, 'spark');
            if (e.hp <= 0) {
               isDeadFromDoT = true;
            }
         }
       }

       if (status.duration <= 0) {
          e.statuses.splice(s, 1);
       }
    }

    if (isDeadFromDoT) {
       playSound('explosion');
       spawnParticles(state, e.pos, e.color, 15, 'explosion');
       handleEnemyDeath(state, e);
       state.enemies.splice(i, 1);
       continue;
    }

    const distToPlayer = distance(e.pos, state.playerPos);
    let isMoving = true;
    let actualSpeed = currentSpeed;
    let dir = normalize({ x: state.playerPos.x - e.pos.x, y: state.playerPos.y - e.pos.y });

    if (e.type === 'flocker') {
      let sepX = 0, sepY = 0;
      for (const other of state.enemies) {
         if (other.type === 'flocker' && other.id !== e.id) {
            const d = distance(e.pos, other.pos);
            if (d < 60 && d > 0) {
               sepX += (e.pos.x - other.pos.x) / d;
               sepY += (e.pos.y - other.pos.y) / d;
            }
         }
      }
      dir.x = dir.x * 0.8 + sepX * 0.5;
      dir.y = dir.y * 0.8 + sepY * 0.5;
      dir = normalize(dir);
    } else if (e.type === 'worm_body' && e.targetId) {
      const target = state.enemies.find(x => x.id === e.targetId);
      if (target) {
         dir = normalize({ x: target.pos.x - e.pos.x, y: target.pos.y - e.pos.y });
         const distToTarget = distance(e.pos, target.pos);
         if (distToTarget < 25) {
            isMoving = false; // Stay close behind
         } else {
            actualSpeed *= 1.2; // Catch up fast
         }
      } else {
         e.type = 'worm_head'; // Become head if leader dies
         e.color = '#ec4899';
         e.radius = 28;
      }
    }

    if (e.type === 'dasher') {
       if (e.dashTimer !== undefined) {
         e.dashTimer -= dt;
         if (e.dashTimer <= 0) {
            e.dashTimer = 2.5; // Next dash in 2.5s
            // Add a massive velocity burst
            e.vel = { x: dir.x * 600, y: dir.y * 600 };
            playSound('shoot'); // or another dash sound
         }
       }
       
       // Friction for velocity
       if (Math.abs(e.vel.x) > 10 || Math.abs(e.vel.y) > 10) {
          e.pos.x += e.vel.x * dt;
          e.pos.y += e.vel.y * dt;
          e.vel.x *= 0.9;
          e.vel.y *= 0.9;
          isMoving = false; // Don't apply normal movement while dashing
          spawnParticles(state, e.pos, e.color, 1, 'spark'); // dash trail
       }
    } else if (e.type === 'sniper' || e.type === 'boss') {
       if (e.shootTimer !== undefined && distToPlayer < 600) {
          isMoving = false; // Stop to shoot/boss is slower when shooting
          if (e.type === 'boss') {
             actualSpeed *= 0.5; // Boss keeps moving slowly
             isMoving = true;
          }
          
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
             e.shootTimer = e.type === 'boss' ? 0.8 : 3;
             
             if (e.type === 'boss') {
                // Boss shoots a spiral ring of 8
                for (let i = 0; i < 8; i++) {
                   const angle = (Math.PI * 2 / 8) * i + (state.time * 3);
                   const spreadDir = {
                      x: Math.cos(angle),
                      y: Math.sin(angle)
                   };
                   state.enemyProjectiles.push({
                      id: generateId(),
                      pos: { ...e.pos },
                      vel: { x: spreadDir.x * 150, y: spreadDir.y * 150 },
                      radius: 8,
                      damage: e.damage * 0.4,
                      pierceLeft: 0,
                      color: '#f87171',
                      explosiveChance: 0,
                      explosiveRadius: 0,
                      explosiveDamageMult: 0,
                      life: 4
                   });
                }
                playSound('shoot');
             } else {
                // Sniper shoots one fast bullet
                state.enemyProjectiles.push({
                   id: generateId(),
                   pos: { ...e.pos },
                   vel: { x: dir.x * 400, y: dir.y * 400 },
                   radius: 6,
                   damage: e.damage,
                   pierceLeft: 0,
                   color: '#06b6d4',
                   explosiveChance: 0,
                   explosiveRadius: 0,
                   explosiveDamageMult: 0,
                   life: 3
                });
                playSound('shoot');
             }
          }
       }
    } else if (e.type === 'summoner') {
       if (distToPlayer < 700) {
          isMoving = false;
          if (e.shootTimer !== undefined) {
             e.shootTimer -= dt;
             if (e.shootTimer <= 0) {
                e.shootTimer = 4;
                spawnEnemy(state, false, 'swarm', { x: e.pos.x + 40, y: e.pos.y });
                spawnEnemy(state, false, 'swarm', { x: e.pos.x - 40, y: e.pos.y });
                spawnEnemy(state, false, 'swarm', { x: e.pos.x, y: e.pos.y + 40 });
                spawnParticles(state, e.pos, '#8b5cf6', 15, 'explosion');
             }
          }
       }
    }

    if (isMoving) {
      e.pos.x += dir.x * actualSpeed * dt;
      e.pos.y += dir.y * actualSpeed * dt;
    }

    if (distToPlayer <= e.radius + 15) { 
      let dmg = e.damage * dt;
      if (state.playerStats.armor) dmg = Math.max(0, dmg - state.playerStats.armor * dt);
      state.playerStats.health -= dmg; 
      state.runStats.damageTaken += dmg;
      state.combo = 0;
      state.comboTimer = 0;
      
      if (Math.random() < 0.2) {
         playSound('hit');
         spawnParticles(state, state.playerPos, '#ef4444', 3, 'spark');
         state.shakeIntensity = Math.max(state.shakeIntensity, 15);
      }
      
      e.pos.x -= dir.x * currentSpeed * dt * 1.5;
      e.pos.y -= dir.y * currentSpeed * dt * 1.5;

      if (state.playerStats.health <= 0) {
        state.isGameOver = true;
      }
    }
  }

  enemyGrid.clear();
  for (let i = 0; i < state.enemies.length; i++) {
     enemyGrid.insert(state.enemies[i]);
  }

  for (let i = 0; i < state.enemies.length; i++) {
    const e1 = state.enemies[i];
    const nearby = enemyGrid.getNearby(e1.pos, e1.radius + 80);
    for (let j = 0; j < nearby.length; j++) {
      const e2 = nearby[j];
      if (e1.id === e2.id) continue;
      const dist = distance(e1.pos, e2.pos);
      const minDist = e1.radius + e2.radius;
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const dir = normalize({ x: e1.pos.x - e2.pos.x, y: e1.pos.y - e2.pos.y });
        // Since we process e1 and e2, we can just push e1. e2 will be pushed when its turn comes.
        e1.pos.x += dir.x * overlap * 0.5;
        e1.pos.y += dir.y * overlap * 0.5;
      }
    }
  }

  // Enemy Projectiles
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const p = state.enemyProjectiles[i];
    p.life -= dt;
    if (p.life <= 0) {
      state.enemyProjectiles.splice(i, 1);
      continue;
    }
    
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;

    if (distance(p.pos, state.playerPos) <= p.radius + 15) {
       if (state.invulnerableTimer <= 0) {
           let dmg = p.damage;
           if (state.playerStats.armor) dmg = Math.max(0, dmg - state.playerStats.armor);
           state.playerStats.health -= dmg;
           state.runStats.damageTaken += dmg;
           state.combo = 0;
           state.comboTimer = 0;
           playSound('hit');
           spawnParticles(state, state.playerPos, '#ef4444', 5, 'spark');
           state.shakeIntensity = Math.max(state.shakeIntensity, 15);
           state.invulnerableTimer = 0.2; // 200ms invulnerability against projectiles to prevent shotgunning
           
           if (state.playerStats.health <= 0) {
              state.isGameOver = true;
           }
       }
       state.enemyProjectiles.splice(i, 1);
    }
  }

  if (state.vacuumTimer > 0) {
    state.vacuumTimer -= dt;
  }

  for (let i = state.gems.length - 1; i >= 0; i--) {
      const gem = state.gems[i];
      const d = distance(state.playerPos, gem.pos);
      
      if (d < state.playerStats.magnetRadius || state.vacuumTimer > 0) {
          const dir = normalize({ x: state.playerPos.x - gem.pos.x, y: state.playerPos.y - gem.pos.y });
          const pullSpeed = state.vacuumTimer > 0 ? 1500 : 300; 
          gem.pos.x += dir.x * pullSpeed * dt;
          gem.pos.y += dir.y * pullSpeed * dt;
          
          if (d < 25 || (state.vacuumTimer > 0 && d < 100)) { 
              playSound('gem');
              const finalXp = gem.value * (state.playerStats.xpGainMult || 1);
              state.xp += finalXp;
              state.score += gem.value * 5;
              state.gems.splice(i, 1);
              
              if (state.xp >= state.xpToNext) {
                  playSound('levelup');
                  state.xp -= state.xpToNext;
                  state.level++;
                  state.xpToNext = Math.floor(state.xpToNext * 1.5 + 15);
                  state.isLevelingUp = true;
                  
                  // Flash screen effect
                  spawnParticles(state, state.playerPos, '#38bdf8', 40, 'spark');
                  state.shakeIntensity = 20;
              }
          }
      }
  }

  for (let i = state.drops.length - 1; i >= 0; i--) {
    const drop = state.drops[i];
    const d = distance(state.playerPos, drop.pos);
    
    if (d < state.playerStats.magnetRadius) {
      const dir = normalize({ x: state.playerPos.x - drop.pos.x, y: state.playerPos.y - drop.pos.y });
      const pullSpeed = 300;
      drop.pos.x += dir.x * pullSpeed * dt;
      drop.pos.y += dir.y * pullSpeed * dt;

      if (d < drop.radius + 20) {
        if (drop.type === 'chest') {
          playSound('levelup'); // Use levelup or powerup
          state.chestRewards = Math.floor(Math.random() * 3) + 1; // 1 to 3 rewards
          state.isLevelingUp = true; // Wait, actually it's like a level up modal! We can use this to pause. 
          // But wait, chestRewards > 0 will render the chest overlay. IsLevelingUp pauses game too.
          // Let's set isLevelingUp = false and add isChestOpen state or let chestRewards pause it.
          // Actually, updateGame starts with `if (state.isGameOver || state.isLevelingUp) return;`
          // Let's change that to `if (state.isGameOver || state.isLevelingUp || state.chestRewards !== null) return;`
        } else if (drop.type === 'nuke') {
          playSound('explosion');
          state.shakeIntensity = 30;
          for (let j = state.enemies.length - 1; j >= 0; j--) {
            const e = state.enemies[j];
            if (!e.isBoss) {
              spawnParticles(state, e.pos, '#ef4444', 5, 'explosion');
              handleEnemyDeath(state, e);
              state.enemies.splice(j, 1);
            }
          }
        } else if (drop.type === 'vacuum') {
          playSound('powerup');
          state.vacuumTimer = 2.0;
        }
        state.drops.splice(i, 1);
      }
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.pos.x += p.vel.x * dt;
    p.pos.y += p.vel.y * dt;
    p.life -= dt;
    
    if (p.type === 'spark' || p.type === 'explosion') {
        p.vel.x *= 0.90;
        p.vel.y *= 0.90;
    }
    if (p.type === 'text') {
        p.pos.y -= 30 * dt;
        // Float logic with slight bounciness
        p.vel.y += 100 * dt; 
    }

    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
};
