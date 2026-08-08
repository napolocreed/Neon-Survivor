// The Game class: run state, player, damage, pickups, leveling, fx timers.
// Weapon firing lives in weapons.ts, enemy AI + spawning in enemies.ts.

import { Pool } from '../core/pool';
import { SpatialHash } from '../core/spatial';
import { Input } from '../core/input';
import { damp, dist2, rand, TAU, pickWeighted } from '../core/math';
import { audio } from '../audio/audio';
import {
  Enemy, Projectile, EnemyBullet, Pickup, Particle, DamageNumber,
  PickupKind, ParticleKind, WeaponState, PlayerStats, CardOffer,
  GamePhase, WeaponId, PassiveId, EnemyKind, Affix,
} from './types';
import { WEAPONS, PASSIVES, PILOTS, PilotDef, xpForLevel, COLORS, ENEMY_DEFS } from './data';
import { profile, metaBonuses } from '../meta/save';
import { fireWeapons, updateProjectiles, updateBlades } from './weapons';
import { updateEnemies, updateSpawner, updateEnemyBullets } from './enemies';

export interface Beam {
  x: number; y: number; angle: number; len: number; width: number;
  life: number; maxLife: number; color: string;
}

export interface Bolt {
  x1: number; y1: number; x2: number; y2: number; life: number; color: string;
}

export interface RunStats {
  time: number; kills: number; level: number; score: number;
  shardsFromScore: number; shardsPicked: number; bossKills: number;
  maxCombo: number; pilotName: string; victory: boolean; endless: boolean;
}

export interface GameHooks {
  levelUp(offers: CardOffer[]): void;
  chestOpen(result: ChestResult): void;
  gameOver(stats: RunStats): void;
  victory(stats: RunStats): void;
  bossWarn(name: string): void;
  bossBar(name: string, frac: number, visible: boolean): void;
  evolved(name: string): void;
  overdrive(): void;
  hud(): void; // light per-frame HUD refresh
}

export interface ChestResult {
  items: { name: string; detail: string; color: string; isEvo: boolean }[];
  shards: number;
}

export const GRAZE_RADIUS = 46;
const PLAYER_RADIUS = 13;
const DASH_SPEED = 950;
const DASH_TIME = 0.17;

function makeEnemy(): Enemy {
  return {
    x: 0, y: 0, vx: 0, vy: 0, radius: 10, hp: 1, maxHp: 1, speed: 0, touchDamage: 0,
    kind: EnemyKind.Chaser, elite: false, affix: Affix.None, xp: 1,
    flashTimer: 0, spawnTimer: 0, hitCd: 0, grazeCd: 0, kbx: 0, kby: 0, kbResist: 0,
    slowTimer: 0, burnTimer: 0, burnDps: 0, bladeCd: 0, dashHitCd: 0,
    seed: 0, aiState: 0, aiTimer: 0, aimX: 0, aimY: 0, shootTimer: 0, angle: 0,
  };
}

export class Game {
  // pools
  enemies = new Pool<Enemy>(makeEnemy, 320);
  projectiles = new Pool<Projectile>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, radius: 4, damage: 0, pierce: 0, life: 0, kind: 0,
    seed: 0, homing: 0, targetIdx: -1, hitCd: 0, lastHit: -1, knockback: 0,
  }), 260);
  enemyBullets = new Pool<EnemyBullet>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, radius: 6, damage: 0, life: 0, grazed: false, hue: 0,
  }), 400);
  pickups = new Pool<Pickup>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, kind: PickupKind.Gem, value: 1, magnetized: false, life: -1, seed: 0,
  }), 420);
  particles = new Pool<Particle>(() => ({
    x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, size: 2,
    kind: ParticleKind.Spark, color: 0, rot: 0, vrot: 0,
  }), 700);
  dmgNumbers = new Pool<DamageNumber>(() => ({ x: 0, y: 0, vy: 0, value: 0, life: 0, crit: false }), 60);
  grid = new SpatialHash<Enemy>(72);

  beams: Beam[] = [];
  bolts: Bolt[] = [];

  // player
  px = 0; py = 0;
  moveDirX = 0; moveDirY = -1; // last non-zero move dir
  playerRadius = PLAYER_RADIUS;
  hp = 100;
  stats!: PlayerStats;
  pilot: PilotDef = PILOTS[0];
  invuln = 0;
  dashCharges = 2;
  dashRecharge = 0;
  dashTimer = 0;
  dashDirX = 0; dashDirY = -1;
  overdrive = 0; // 0..100 charge
  overdriveTimer = 0; // active seconds remaining
  reviveAvailable = false;
  regenAcc = 0;

  // run progress
  time = 0;
  phase: GamePhase = 'run';
  level = 1;
  xp = 0;
  xpNext = xpForLevel(2);
  pendingLevelUps = 0;
  kills = 0;
  bossKills = 0;
  score = 0;
  shardsPicked = 0;
  combo = 0;
  maxCombo = 0;
  comboTimer = 0;
  gemStreak = 0;
  gemStreakTimer = 0;
  rerollsLeft = 1;
  endless = false;
  god = false;
  private scoreBanked = 0;
  private pickedBanked = 0;

  weapons: WeaponState[] = [];
  passives = new Map<PassiveId, number>();

  // director state (driven by enemies.ts)
  waveIdx = 0;
  spawnTimer = 1;
  eliteTimer = 55;
  eventIdx = 0;
  bossIdx = 0;
  bossSlot = -1; // index into enemies pool while boss alive (revalidated each frame)
  bossWarnAt = -1;
  endlessCycle = 0;
  endlessBossTimer = 0;

  // fx
  camX = 0; camY = 0;
  trauma = 0;
  timeScale = 1;
  hitStop = 0;
  screenFlash = 0;
  viewR = 520; // half-diagonal of view, set by renderer

  input: Input;
  hooks: GameHooks;
  private offers: CardOffer[] = [];

  constructor(input: Input, hooks: GameHooks, pilot: PilotDef, opts: { startTime?: number; god?: boolean } = {}) {
    this.input = input;
    this.hooks = hooks;
    this.pilot = pilot;
    this.god = !!opts.god;
    this.time = opts.startTime ?? 0;
    this.rerollsLeft = 1 + metaBonuses().rerolls;
    this.reviveAvailable = metaBonuses().revive;
    this.addWeapon(pilot.startWeapon);
    this.recomputeStats();
    this.hp = this.stats.maxHp;
    this.dashCharges = this.stats.dashCharges;
    // fast-forward director past skipped time (testing)
    if (this.time > 0) {
      this.eliteTimer = 20;
      while (this.bossIdx < 3 && this.time > [180, 390, 600][this.bossIdx]) this.bossIdx++;
    }
  }

  // ------------------------------------------------------------ stats

  recomputeStats(): void {
    const m = metaBonuses();
    const p = this.pilot;
    const lv = (id: PassiveId) => this.passives.get(id) ?? 0;
    const prevMax = this.stats?.maxHp ?? 0;
    this.stats = {
      maxHp: Math.round((100 + m.hp) * p.hpMult * (1 + 0.18 * lv(PassiveId.Vitality))),
      regen: p.regen + 0.8 * lv(PassiveId.Reactor),
      speed: 250 * p.speedMult * (1 + m.speed) * (1 + 0.06 * lv(PassiveId.Thrusters)),
      magnet: 118 * (1 + m.magnet) * (1 + 0.25 * lv(PassiveId.Magnet)),
      armor: p.armor + lv(PassiveId.Plating),
      damageMult: p.dmgMult * (1 + m.dmg) * (1 + 0.09 * lv(PassiveId.Power)),
      fireRateMult: 1 / ((1 + m.fireRate) * (1 + 0.08 * lv(PassiveId.Overclock))),
      areaMult: 1 + 0.12 * lv(PassiveId.Amplifier),
      projSpeedMult: 1,
      critChance: 0.05 + 0.04 * lv(PassiveId.Lucky),
      critMult: 2,
      luck: 1 + 0.15 * lv(PassiveId.Lucky),
      xpMult: 1 + m.xp,
      shardMult: 1 + m.shards,
      dashCharges: p.dashCharges,
      dashCooldown: 2.6 * p.dashCooldownMult,
      dashDamageMult: p.dashDamageMult,
    };
    if (prevMax > 0 && this.stats.maxHp > prevMax) this.hp += this.stats.maxHp - prevMax;
    this.hp = Math.min(this.hp, this.stats.maxHp);
  }

  get overdriveActive(): boolean {
    return this.overdriveTimer > 0;
  }

  /** fire-rate multiplier including overdrive (lower = faster). */
  cdMult(): number {
    return this.stats.fireRateMult * (this.overdriveActive ? 0.72 : 1);
  }

  dmgMult(): number {
    return this.stats.damageMult * (this.overdriveActive ? 1.18 : 1);
  }

  // ------------------------------------------------------------ main update

  update(rawDt: number): void {
    if (this.phase !== 'run') return;
    // hit-stop envelope
    if (this.hitStop > 0) {
      this.hitStop -= rawDt;
      this.timeScale = 0.05;
    } else {
      this.timeScale += (1 - this.timeScale) * damp(12, rawDt);
    }
    const dt = rawDt * this.timeScale;
    this.time += dt;

    this.updateTimers(dt, rawDt);
    this.updatePlayer(dt);
    fireWeapons(this, dt);
    updateEnemies(this, dt);
    this.rebuildGrid();
    updateBlades(this, dt);
    updateProjectiles(this, dt);
    updateEnemyBullets(this, dt);
    this.contactAndGraze(dt);
    this.updatePickups(dt);
    updateSpawner(this, dt);
    this.updateParticles(dt);
    this.updateCamera(dt);

    audio.intensity = this.overdriveActive || this.bossSlot >= 0 ? 3 : this.time > 150 ? 2 : 1;

    // deferred level-ups (never interrupt a chest/boss-death slowmo mid-frame)
    if (this.pendingLevelUps > 0) {
      this.pendingLevelUps--;
      this.openLevelUp();
    }
    this.hooks.hud();
  }

  private updateTimers(dt: number, rawDt: number): void {
    this.invuln = Math.max(0, this.invuln - dt);
    this.screenFlash = Math.max(0, this.screenFlash - rawDt * 3);
    this.trauma = Math.max(0, this.trauma - rawDt * 1.7);
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.gemStreakTimer > 0) {
      this.gemStreakTimer -= dt;
      if (this.gemStreakTimer <= 0) this.gemStreak = 0;
    }
    if (this.overdriveTimer > 0) {
      this.overdriveTimer -= dt;
      if (this.overdriveTimer <= 0) this.overdrive = 0;
    }
    // dash recharge
    if (this.dashCharges < this.stats.dashCharges) {
      this.dashRecharge -= dt;
      if (this.dashRecharge <= 0) {
        this.dashCharges++;
        this.dashRecharge = this.stats.dashCooldown;
      }
    }
    // regen
    this.regenAcc += this.stats.regen * dt;
    if (this.regenAcc >= 1) {
      const heal = Math.floor(this.regenAcc);
      this.regenAcc -= heal;
      this.hp = Math.min(this.stats.maxHp, this.hp + heal);
    }
  }

  private updatePlayer(dt: number): void {
    const inp = this.input;
    inp.update();

    if (inp.consumeDash()) this.tryDash();

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      this.px += this.dashDirX * DASH_SPEED * dt;
      this.py += this.dashDirY * DASH_SPEED * dt;
      // afterimage
      const g = this.particles.spawnOrRecycle();
      g.kind = ParticleKind.Ghost; g.x = this.px; g.y = this.py;
      g.vx = 0; g.vy = 0; g.life = 0.28; g.maxLife = 0.28; g.size = this.playerRadius;
      g.rot = Math.atan2(this.dashDirY, this.dashDirX); g.color = 0;
      this.dashDamage();
    } else {
      const spd = this.stats.speed * (this.overdriveActive ? 1.22 : 1);
      this.px += inp.moveX * spd * dt;
      this.py += inp.moveY * spd * dt;
    }
    if (inp.moveX !== 0 || inp.moveY !== 0) {
      const m = Math.hypot(inp.moveX, inp.moveY);
      this.moveDirX = inp.moveX / m;
      this.moveDirY = inp.moveY / m;
    }
  }

  private tryDash(): void {
    if (this.dashCharges <= 0 || this.dashTimer > 0) return;
    if (this.dashCharges === this.stats.dashCharges) this.dashRecharge = this.stats.dashCooldown;
    this.dashCharges--;
    this.dashTimer = DASH_TIME;
    this.invuln = Math.max(this.invuln, 0.34);
    // dash in move direction; when idle, dash away from nearest enemy
    let dx = this.moveDirX;
    let dy = this.moveDirY;
    if (this.input.moveX === 0 && this.input.moveY === 0) {
      const near = this.nearestEnemy(this.px, this.py, 400);
      if (near) {
        const d = Math.hypot(near.x - this.px, near.y - this.py) || 1;
        dx = -(near.x - this.px) / d;
        dy = -(near.y - this.py) / d;
      }
    }
    this.dashDirX = dx;
    this.dashDirY = dy;
    audio.dash();
    this.haptic(12);
    this.addTrauma(0.12);
    for (let i = 0; i < 6; i++) {
      const p = this.particles.spawnOrRecycle();
      p.kind = ParticleKind.Line;
      p.x = this.px + rand(-14, 14); p.y = this.py + rand(-14, 14);
      p.vx = -dx * rand(300, 600); p.vy = -dy * rand(300, 600);
      p.life = 0.22; p.maxLife = 0.22; p.size = rand(1, 2.5); p.color = 0;
    }
  }

  private dashDamage(): void {
    const dmg = 30 * this.dmgMult() * this.stats.dashDamageMult;
    const near = this.grid.query(this.px, this.py, 40);
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (e.dashHitCd > 0 || e.spawnTimer > 0) continue;
      if (dist2(this.px, this.py, e.x, e.y) < (30 + e.radius) ** 2) {
        e.dashHitCd = 0.5;
        const killed = this.dealDamage(e, dmg, { knockX: this.dashDirX * 300, knockY: this.dashDirY * 300 });
        if (killed) {
          this.chargeOverdrive(2);
          // dash kills accelerate recharge
          this.dashRecharge = Math.max(0.2, this.dashRecharge - 0.7);
        }
      }
    }
  }

  nearestEnemy(x: number, y: number, maxDist: number): Enemy | null {
    let best: Enemy | null = null;
    let bestD = maxDist * maxDist;
    for (let i = 0; i < this.enemies.count; i++) {
      const e = this.enemies.items[i];
      if (e.spawnTimer > 0) continue;
      const d = dist2(x, y, e.x, e.y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private rebuildGrid(): void {
    this.grid.clear();
    for (let i = 0; i < this.enemies.count; i++) this.grid.insert(this.enemies.items[i]);
  }

  // ------------------------------------------------------------ damage

  /** Apply damage to an enemy. Returns true if this killed it. */
  dealDamage(
    e: Enemy,
    amount: number,
    opts: { canCrit?: boolean; knockX?: number; knockY?: number; showNumber?: boolean } = {},
  ): boolean {
    let dmg = amount;
    let crit = false;
    if (opts.canCrit !== false && Math.random() < this.stats.critChance) {
      crit = true;
      dmg *= this.stats.critMult;
    }
    if (e.affix === Affix.Armored) dmg *= 0.6;
    e.hp -= dmg;
    e.flashTimer = 0.08;
    if (opts.knockX || opts.knockY) {
      const resist = 1 - e.kbResist;
      e.kbx += (opts.knockX ?? 0) * resist;
      e.kby += (opts.knockY ?? 0) * resist;
    }
    if (opts.showNumber !== false) {
      const n = this.dmgNumbers.spawnOrRecycle();
      n.x = e.x + rand(-6, 6); n.y = e.y - e.radius - 4;
      n.vy = -60; n.value = Math.round(dmg); n.life = crit ? 0.8 : 0.55; n.crit = crit;
    }
    audio.hit();
    if (e.hp <= 0) {
      this.killEnemy(e);
      return true;
    }
    return false;
  }

  killEnemy(e: Enemy): void {
    // find slot & release
    const idx = this.enemies.items.indexOf(e);
    if (idx < 0 || idx >= this.enemies.count) return;

    this.kills++;
    profile.records.totalKills++;
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.comboTimer = 3;
    this.chargeOverdrive(0.3);
    this.score += (e.elite ? 150 : 10) * (1 + Math.min(this.combo, 100) * 0.01);

    // fx scale with enemy size
    const big = e.elite || e.kind >= EnemyKind.BossWarden || e.kind === EnemyKind.Tank;
    this.spawnDeathFx(e, big);
    if (big) {
      this.addTrauma(e.elite ? 0.32 : 0.2);
      this.haptic(e.elite ? 24 : 12);
      audio.bigKill();
      if (e.elite) this.hitStop = Math.max(this.hitStop, 0.07);
    } else {
      audio.kill(this.combo);
    }

    this.dropLoot(e);

    if (e.kind >= EnemyKind.BossWarden) {
      this.onBossKilled(e);
    }
    if (e.kind === EnemyKind.Splitter) {
      // burst into minis (queued via enemies.ts helper — inline here)
      for (let k = 0; k < 3; k++) {
        const m = this.spawnEnemyAt(EnemyKind.Mini, e.x + rand(-18, 18), e.y + rand(-18, 18), 1);
        if (m) m.spawnTimer = 0.25;
      }
    }
    if (e.affix === Affix.Volatile) {
      // bullet ring on death
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        this.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, 8, 300);
      }
    }

    this.enemies.releaseAt(idx);
    // fix boss slot cache
    if (this.bossSlot === idx || this.bossSlot === this.enemies.count) this.bossSlot = -1;
  }

  private onBossKilled(e: Enemy): void {
    this.bossKills++;
    this.score += 1500;
    this.hitStop = Math.max(this.hitStop, 0.3);
    this.addTrauma(0.7);
    this.screenFlash = 1;
    this.haptic(60);
    audio.bossDown();
    this.hooks.bossBar('', 0, false);
    this.bossSlot = -1;
    // loot shower
    for (let i = 0; i < 6; i++) this.spawnPickup(PickupKind.Shard, e.x + rand(-50, 50), e.y + rand(-50, 50), 12);
    this.spawnPickup(PickupKind.Chest, e.x, e.y, 1);
    this.spawnPickup(PickupKind.Health, e.x + rand(-60, 60), e.y + rand(-60, 60), 40);
    if (e.kind === EnemyKind.BossOmega && !this.endless) {
      this.finishRun(true);
    }
  }

  spawnDeathFx(e: Enemy, big: boolean): void {
    const n = big ? 16 : 7;
    for (let i = 0; i < n; i++) {
      const p = this.particles.spawnOrRecycle();
      const a = Math.random() * TAU;
      const sp = rand(60, big ? 420 : 260);
      p.kind = i % 3 === 0 ? ParticleKind.Shard : ParticleKind.Spark;
      p.x = e.x; p.y = e.y;
      p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
      p.life = rand(0.3, big ? 0.9 : 0.55); p.maxLife = p.life;
      p.size = rand(1.5, big ? 5 : 3);
      p.color = e.elite ? 2 : 1;
      p.rot = Math.random() * TAU; p.vrot = rand(-8, 8);
    }
    const ring = this.particles.spawnOrRecycle();
    ring.kind = ParticleKind.Ring; ring.x = e.x; ring.y = e.y;
    ring.vx = 0; ring.vy = 0; ring.life = big ? 0.5 : 0.3; ring.maxLife = ring.life;
    ring.size = e.radius * (big ? 3.2 : 2); ring.color = e.elite ? 2 : 1;
    const glow = this.particles.spawnOrRecycle();
    glow.kind = ParticleKind.Orb; glow.x = e.x; glow.y = e.y; glow.vx = 0; glow.vy = 0;
    glow.life = 0.35; glow.maxLife = 0.35; glow.size = e.radius * 2.4; glow.color = e.elite ? 2 : 1;
  }

  private dropLoot(e: Enemy): void {
    // XP gems, with merging pressure near pool cap.
    // Gem value drifts upward over the run so leveling keeps its rhythm.
    let value = e.xp;
    if ((e.kind === EnemyKind.Swarm || e.kind === EnemyKind.Mini) && Math.random() < 0.35) value = 0;
    if (value > 0) this.spawnGem(e.x, e.y, Math.round(value * (1 + this.time / 300)));
    if (e.elite) {
      this.spawnPickup(PickupKind.Chest, e.x, e.y, 1);
      for (let i = 0; i < 3; i++) this.spawnPickup(PickupKind.Shard, e.x + rand(-40, 40), e.y + rand(-40, 40), 8);
    }
    // rare consumables
    const r = Math.random();
    if (r < 0.006) this.spawnPickup(PickupKind.Magnet, e.x, e.y, 1);
    else if (r < 0.012) this.spawnPickup(PickupKind.Health, e.x, e.y, 25);
    else if (r < 0.0135 && this.time > 240) this.spawnPickup(PickupKind.Nuke, e.x, e.y, 1);
    else if (r < 0.028) this.spawnPickup(PickupKind.Shard, e.x, e.y, 3);
  }

  spawnGem(x: number, y: number, value: number): void {
    // merge into a nearby gem when the pool is crowded
    if (this.pickups.count > 360) {
      let best: Pickup | null = null;
      let bestD = 250 * 250;
      for (let i = 0; i < this.pickups.count; i++) {
        const g = this.pickups.items[i];
        if (g.kind !== PickupKind.Gem) continue;
        const d = dist2(x, y, g.x, g.y);
        if (d < bestD) { bestD = d; best = g; }
      }
      if (best) { best.value += value; return; }
    }
    this.spawnPickup(PickupKind.Gem, x, y, value);
  }

  spawnPickup(kind: PickupKind, x: number, y: number, value: number): void {
    const p = this.pickups.spawn();
    if (!p) return;
    p.kind = kind; p.x = x; p.y = y; p.value = value;
    p.vx = rand(-40, 40); p.vy = rand(-40, 40);
    p.magnetized = false;
    p.life = kind === PickupKind.Gem || kind === PickupKind.Chest ? -1 : 25;
    p.seed = Math.random() * TAU;
  }

  spawnEnemyBullet(x: number, y: number, vx: number, vy: number, damage: number, _speed: number): void {
    const b = this.enemyBullets.spawn();
    if (!b) return;
    b.x = x; b.y = y; b.vx = vx; b.vy = vy;
    b.radius = 6; b.damage = damage; b.life = 7; b.grazed = false;
    b.hue = Math.random();
  }

  spawnEnemyAt(kind: EnemyKind, x: number, y: number, hpMult: number): Enemy | null {
    const e = this.enemies.spawn();
    if (!e) return null;
    const def = ENEMY_DEFS[kind];
    e.kind = kind;
    e.x = x; e.y = y; e.vx = 0; e.vy = 0;
    e.radius = def.radius;
    e.maxHp = e.hp = def.hp * hpMult;
    e.speed = def.speed * rand(0.9, 1.1);
    e.touchDamage = def.damage;
    e.xp = def.xp;
    e.kbResist = def.kbResist;
    e.elite = false;
    e.affix = Affix.None;
    e.flashTimer = 0; e.spawnTimer = 0.6; e.hitCd = 0; e.grazeCd = 0;
    e.kbx = 0; e.kby = 0; e.slowTimer = 0; e.burnTimer = 0; e.burnDps = 0;
    e.bladeCd = 0; e.dashHitCd = 0;
    e.seed = Math.random() * TAU;
    e.aiState = 0; e.aiTimer = rand(0, 1); e.shootTimer = rand(1, 3); e.angle = 0;
    return e;
  }

  // ------------------------------------------------------------ player hit & graze

  private contactAndGraze(dt: number): void {
    const near = this.grid.query(this.px, this.py, GRAZE_RADIUS + 40);
    for (let i = 0; i < near.length; i++) {
      const e = near[i];
      if (e.spawnTimer > 0) continue;
      e.hitCd -= dt;
      e.grazeCd -= dt;
      const d = Math.hypot(e.x - this.px, e.y - this.py);
      if (d < e.radius + this.playerRadius) {
        if (e.hitCd <= 0) {
          e.hitCd = 0.75;
          this.hurtPlayer(e.touchDamage);
          // push enemy back a touch
          const inv = 1 / (d || 1);
          e.kbx += (e.x - this.px) * inv * 180 * (1 - e.kbResist);
          e.kby += (e.y - this.py) * inv * 180 * (1 - e.kbResist);
        }
      } else if (d < e.radius + GRAZE_RADIUS && e.grazeCd <= 0) {
        e.grazeCd = 0.6;
        this.chargeOverdrive(1.4);
        const p = this.particles.spawnOrRecycle();
        p.kind = ParticleKind.Spark;
        p.x = (this.px + e.x) / 2; p.y = (this.py + e.y) / 2;
        p.vx = rand(-60, 60); p.vy = rand(-60, 60);
        p.life = 0.25; p.maxLife = 0.25; p.size = 2; p.color = 3;
      }
    }
  }

  hurtPlayer(raw: number): void {
    if (this.invuln > 0 || this.dashTimer > 0 || this.god) return;
    const dmg = Math.max(1, Math.round(raw - this.stats.armor));
    this.hp -= dmg;
    this.invuln = 0.8;
    this.combo = Math.floor(this.combo / 2);
    this.overdrive = Math.max(0, this.overdrive - 12);
    this.addTrauma(0.45);
    this.screenFlash = Math.max(this.screenFlash, 0.55);
    this.hitStop = Math.max(this.hitStop, 0.05);
    this.haptic(40);
    audio.hurt();
    if (this.hp <= 0) {
      if (this.reviveAvailable) {
        this.reviveAvailable = false;
        this.hp = Math.round(this.stats.maxHp * 0.5);
        this.invuln = 2.2;
        this.screenFlash = 1;
        this.nukeEffect(420);
        audio.levelup();
        return;
      }
      this.hp = 0;
      this.finishRun(false);
    }
  }

  nukeEffect(radius: number): void {
    const near = this.grid.query(this.px, this.py, radius);
    for (let i = near.length - 1; i >= 0; i--) {
      const e = near[i];
      if (e.kind >= EnemyKind.BossWarden) {
        this.dealDamage(e, 300, { canCrit: false });
        continue;
      }
      if (dist2(this.px, this.py, e.x, e.y) < radius * radius) this.dealDamage(e, 9999, { canCrit: false, showNumber: false });
    }
    for (let i = this.enemyBullets.count - 1; i >= 0; i--) this.enemyBullets.releaseAt(i);
    const ring = this.particles.spawnOrRecycle();
    ring.kind = ParticleKind.Ring; ring.x = this.px; ring.y = this.py;
    ring.life = 0.6; ring.maxLife = 0.6; ring.size = radius; ring.color = 3; ring.vx = 0; ring.vy = 0;
    this.addTrauma(0.6);
  }

  chargeOverdrive(amount: number): void {
    if (this.overdriveActive) return;
    this.overdrive += amount;
    if (this.overdrive >= 100) {
      this.overdrive = 100;
      this.overdriveTimer = 7;
      this.screenFlash = Math.max(this.screenFlash, 0.4);
      this.addTrauma(0.3);
      this.haptic(30);
      audio.overdrive();
      this.hooks.overdrive();
    }
  }

  // ------------------------------------------------------------ pickups

  private updatePickups(dt: number): void {
    const magnetR = this.stats.magnet * (this.overdriveActive ? 2.6 : 1);
    for (let i = this.pickups.count - 1; i >= 0; i--) {
      const p = this.pickups.items[i];
      if (p.life > 0) {
        p.life -= dt;
        if (p.life <= 0) { this.pickups.releaseAt(i); continue; }
      }
      // drift friction
      p.vx *= 1 - Math.min(1, dt * 4);
      p.vy *= 1 - Math.min(1, dt * 4);
      const dx = this.px - p.x;
      const dy = this.py - p.y;
      const d = Math.hypot(dx, dy) || 1;
      const attractR = p.kind === PickupKind.Gem || p.kind === PickupKind.Shard ? magnetR : 60;
      if (p.magnetized || d < attractR) {
        p.magnetized = true;
        const sp = Math.min(900, 380 + (attractR / Math.max(d, 20)) * 500);
        p.vx = (dx / d) * sp;
        p.vy = (dy / d) * sp;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (d < this.playerRadius + 16) {
        this.collect(p);
        this.pickups.releaseAt(i);
      }
    }
  }

  private collect(p: Pickup): void {
    switch (p.kind) {
      case PickupKind.Gem: {
        this.gainXp(p.value);
        this.gemStreak = Math.min(this.gemStreak + 1, 7);
        this.gemStreakTimer = 1.1;
        audio.gem(this.gemStreak);
        this.chargeOverdrive(0.15);
        break;
      }
      case PickupKind.Shard: {
        this.shardsPicked += p.value;
        audio.buy();
        this.haptic(8);
        break;
      }
      case PickupKind.Health: {
        this.hp = Math.min(this.stats.maxHp, this.hp + p.value);
        audio.levelup();
        this.screenFlash = Math.max(this.screenFlash, 0.15);
        break;
      }
      case PickupKind.Magnet: {
        for (let i = 0; i < this.pickups.count; i++) {
          const g = this.pickups.items[i];
          if (g.kind === PickupKind.Gem || g.kind === PickupKind.Shard) g.magnetized = true;
        }
        audio.chest();
        break;
      }
      case PickupKind.Nuke: {
        this.nukeEffect(this.viewR * 0.9);
        this.screenFlash = 1;
        audio.bigKill();
        this.haptic(50);
        break;
      }
      case PickupKind.Chest: {
        this.openChest();
        break;
      }
    }
  }

  gainXp(value: number): void {
    const comboMult = 1 + Math.min(this.combo, 100) * 0.004;
    this.xp += value * this.stats.xpMult * comboMult;
    while (this.xp >= this.xpNext) {
      this.xp -= this.xpNext;
      this.level++;
      this.xpNext = xpForLevel(this.level + 1);
      this.pendingLevelUps++;
    }
  }

  // ------------------------------------------------------------ level-up offers

  private openLevelUp(): void {
    this.phase = 'levelup';
    audio.levelup();
    this.haptic(20);
    this.offers = this.generateOffers();
    this.hooks.levelUp(this.offers);
  }

  eligibleEvolutions(): WeaponState[] {
    return this.weapons.filter(w => {
      if (w.evolved || w.level < WEAPONS[w.id].maxLevel) return false;
      return (this.passives.get(WEAPONS[w.id].pair) ?? 0) >= 1;
    });
  }

  generateOffers(): CardOffer[] {
    const offers: CardOffer[] = [];
    const evos = this.eligibleEvolutions();
    if (evos.length > 0) {
      const w = evos[0];
      const def = WEAPONS[w.id];
      offers.push({
        kind: 'evolution', id: w.id, title: def.evoName, desc: def.evoDesc,
        rarity: 3, isNew: false, level: 9,
      });
    }

    interface Cand { offer: CardOffer; weight: number }
    const cands: Cand[] = [];
    for (const w of this.weapons) {
      const def = WEAPONS[w.id];
      if (w.evolved || w.level >= def.maxLevel) continue;
      cands.push({
        weight: 3,
        offer: {
          kind: 'weapon', id: w.id, title: def.name,
          desc: def.levelDesc[w.level] ?? '+ Power', rarity: w.level >= 5 ? 2 : 1,
          isNew: false, level: w.level + 1,
        },
      });
    }
    if (this.weapons.length < 4) {
      for (const def of WEAPONS) {
        if (this.weapons.some(w => w.id === def.id)) continue;
        cands.push({
          weight: 1.6 * this.stats.luck,
          offer: { kind: 'weapon', id: def.id, title: def.name, desc: def.desc, rarity: 2, isNew: true, level: 1 },
        });
      }
    }
    for (const [id, lvl] of this.passives) {
      const def = PASSIVES[id];
      if (lvl >= def.maxLevel) continue;
      cands.push({
        weight: 2.6,
        offer: { kind: 'passive', id, title: def.name, desc: def.desc, rarity: lvl >= 3 ? 1 : 0, isNew: false, level: lvl + 1 },
      });
    }
    if (this.passives.size < 4) {
      for (const def of PASSIVES) {
        if (this.passives.has(def.id)) continue;
        // pairing passives for owned weapons get a boost — guides toward evolutions
        const pairs = this.weapons.some(w => !w.evolved && WEAPONS[w.id].pair === def.id);
        cands.push({
          weight: (pairs ? 2.4 : 1.2) * this.stats.luck,
          offer: { kind: 'passive', id: def.id, title: def.name, desc: def.desc, rarity: pairs ? 1 : 0, isNew: true, level: 1 },
        });
      }
    }

    while (offers.length < 3 && cands.length > 0) {
      const weights = cands.map(c => c.weight);
      const chosen = pickWeighted(cands, weights);
      cands.splice(cands.indexOf(chosen), 1);
      offers.push(chosen.offer);
    }
    while (offers.length < 3) {
      offers.push(
        offers.some(o => o.kind === 'heal')
          ? { kind: 'shards', id: 0, title: 'Shard Cache', desc: '+40 shards, instantly', rarity: 0, isNew: false, level: 0 }
          : { kind: 'heal', id: 0, title: 'Repair Nanites', desc: 'Restore 40% HP', rarity: 0, isNew: false, level: 0 },
      );
    }
    return offers;
  }

  reroll(): CardOffer[] | null {
    if (this.rerollsLeft <= 0) return null;
    this.rerollsLeft--;
    audio.ui();
    this.offers = this.generateOffers();
    return this.offers;
  }

  chooseOffer(index: number): void {
    const offer = this.offers[index];
    if (!offer) return;
    this.applyOffer(offer);
    this.phase = 'run';
    this.screenFlash = Math.max(this.screenFlash, 0.2);
  }

  private applyOffer(offer: CardOffer): void {
    switch (offer.kind) {
      case 'weapon': {
        const owned = this.weapons.find(w => w.id === offer.id);
        if (owned) owned.level++;
        else this.addWeapon(offer.id as WeaponId);
        break;
      }
      case 'passive': {
        this.passives.set(offer.id as PassiveId, (this.passives.get(offer.id as PassiveId) ?? 0) + 1);
        if (offer.id === PassiveId.Vitality) {
          this.recomputeStats();
          this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.3);
        }
        this.recomputeStats();
        break;
      }
      case 'evolution': {
        this.evolveWeapon(offer.id as WeaponId);
        break;
      }
      case 'heal':
        this.hp = Math.min(this.stats.maxHp, this.hp + this.stats.maxHp * 0.4);
        break;
      case 'shards':
        this.shardsPicked += 40;
        break;
    }
  }

  addWeapon(id: WeaponId): void {
    this.weapons.push({ id, level: 1, cooldown: 0.4, evolved: false, angle: 0, burst: 0, burstTimer: 0 });
  }

  evolveWeapon(id: WeaponId): void {
    const w = this.weapons.find(x => x.id === id);
    if (!w) return;
    w.evolved = true;
    w.level = 9;
    this.hitStop = Math.max(this.hitStop, 0.12);
    this.screenFlash = 1;
    this.addTrauma(0.5);
    this.haptic(50);
    audio.evolve();
    this.hooks.evolved(WEAPONS[id].evoName);
  }

  // ------------------------------------------------------------ chest

  private openChest(): void {
    this.phase = 'chest';
    audio.chest();
    this.haptic(25);
    const result: ChestResult = { items: [], shards: Math.round(rand(15, 45)) };
    const evos = this.eligibleEvolutions();
    if (evos.length > 0) {
      const w = evos[0];
      const def = WEAPONS[w.id];
      this.evolveWeapon(w.id);
      result.items.push({ name: def.evoName, detail: def.evoDesc, color: def.color, isEvo: true });
    } else {
      const r = Math.random();
      const count = r < 0.7 ? 1 : r < 0.95 ? 3 : 5;
      for (let i = 0; i < count; i++) {
        const upgradable: { kind: 'weapon' | 'passive'; id: number }[] = [];
        for (const w of this.weapons) {
          if (!w.evolved && w.level < WEAPONS[w.id].maxLevel) upgradable.push({ kind: 'weapon', id: w.id });
        }
        for (const [id, lvl] of this.passives) {
          if (lvl < PASSIVES[id].maxLevel) upgradable.push({ kind: 'passive', id });
        }
        if (upgradable.length === 0) {
          result.shards += 25;
          continue;
        }
        const pickIdx = (Math.random() * upgradable.length) | 0;
        const u = upgradable[pickIdx];
        if (u.kind === 'weapon') {
          const w = this.weapons.find(x => x.id === u.id)!;
          w.level++;
          result.items.push({ name: WEAPONS[u.id].name, detail: `Level ${w.level}`, color: WEAPONS[u.id].color, isEvo: false });
        } else {
          const lvl = (this.passives.get(u.id as PassiveId) ?? 0) + 1;
          this.passives.set(u.id as PassiveId, lvl);
          result.items.push({ name: PASSIVES[u.id].name, detail: `Level ${lvl}`, color: '#9aa7c7', isEvo: false });
        }
      }
      this.recomputeStats();
    }
    this.shardsPicked += result.shards;
    this.hooks.chestOpen(result);
  }

  resumeFromChest(): void {
    if (this.phase === 'chest') this.phase = 'run';
  }

  // ------------------------------------------------------------ run end

  finishRun(victory: boolean): void {
    const m = metaBonuses();
    this.score += this.level * 100 + Math.floor(this.time) * 10;
    // bank only what this ending hasn't banked yet (endless can end a run twice)
    const shardsFromScore = Math.round(((this.score - this.scoreBanked) / 240) * (1 + m.shards));
    const picked = this.shardsPicked - this.pickedBanked;
    this.scoreBanked = this.score;
    this.pickedBanked = this.shardsPicked;
    const stats: RunStats = {
      time: this.time, kills: this.kills, level: this.level, score: Math.round(this.score),
      shardsFromScore, shardsPicked: picked, bossKills: this.bossKills,
      maxCombo: this.maxCombo, pilotName: this.pilot.name, victory, endless: this.endless,
    };
    // persist
    profile.shards += shardsFromScore + picked;
    profile.records.runs++;
    profile.records.bestTime = Math.max(profile.records.bestTime, Math.floor(this.time));
    profile.records.bestKills = Math.max(profile.records.bestKills, this.kills);
    profile.records.bestLevel = Math.max(profile.records.bestLevel, this.level);
    profile.records.bestScore = Math.max(profile.records.bestScore, Math.round(this.score));
    if (victory) {
      profile.records.victories++;
      profile.endlessUnlocked = true;
    }
    if (victory) {
      this.phase = 'victory';
      audio.victory();
      this.hooks.victory(stats);
    } else {
      this.phase = 'over';
      audio.gameOver();
      this.hooks.gameOver(stats);
    }
  }

  continueEndless(): void {
    this.endless = true;
    this.endlessBossTimer = 150;
    this.phase = 'run';
  }

  // ------------------------------------------------------------ fx helpers

  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  haptic(ms: number): void {
    if (!profile.settings.haptics) return;
    if ('vibrate' in navigator) navigator.vibrate(ms);
  }

  private updateParticles(dt: number): void {
    for (let i = this.particles.count - 1; i >= 0; i--) {
      const p = this.particles.items[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.releaseAt(i); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - Math.min(1, dt * 5);
      p.vy *= 1 - Math.min(1, dt * 5);
      p.rot += p.vrot * dt;
    }
    for (let i = this.dmgNumbers.count - 1; i >= 0; i--) {
      const n = this.dmgNumbers.items[i];
      n.life -= dt;
      if (n.life <= 0) { this.dmgNumbers.releaseAt(i); continue; }
      n.y += n.vy * dt;
      n.vy *= 1 - Math.min(1, dt * 3);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      this.bolts[i].life -= dt;
      if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
    }
  }

  private updateCamera(dt: number): void {
    const lookX = this.moveDirX * 36;
    const lookY = this.moveDirY * 36;
    const k = damp(6, dt);
    this.camX += (this.px + lookX - this.camX) * k;
    this.camY += (this.py + lookY - this.camY) * k;
  }

  pause(): void {
    if (this.phase === 'run') this.phase = 'paused';
  }

  resume(): void {
    if (this.phase === 'paused') this.phase = 'run';
  }
}

export { COLORS };
