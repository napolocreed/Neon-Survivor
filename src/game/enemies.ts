// Enemy AI, flocks, void serpents (worms), the spawn director, enemy bullets.

import { Game, GRAZE_RADIUS } from './game';
import { Enemy, EnemyKind, Affix, ParticleKind, Worm } from './types';
import { WAVES, BOSS_TIMES, EVENTS, ENEMY_DEFS, BOSS_NAMES, WORM, hpScale, damageScale } from './data';
import { rand, randInt, TAU, pickWeighted, clamp } from '../core/math';
import { audio } from '../audio/audio';
import { profile } from '../meta/save';

// per-frame flock aggregation scratch
const flockAgg = new Map<number, { n: number; cx: number; cy: number; vx: number; vy: number }>();
let nextFlockId = 1;

// ------------------------------------------------------------ AI

export function updateEnemies(g: Game, dt: number): void {
  // aggregate flock data from last frame's state
  flockAgg.clear();
  for (let i = 0; i < g.enemies.count; i++) {
    const e = g.enemies.items[i];
    if (e.flockId < 0 || e.spawnTimer > 0) continue;
    let f = flockAgg.get(e.flockId);
    if (!f) {
      f = { n: 0, cx: 0, cy: 0, vx: 0, vy: 0 };
      flockAgg.set(e.flockId, f);
    }
    f.n++;
    f.cx += e.x; f.cy += e.y;
    f.vx += e.vx; f.vy += e.vy;
  }
  for (const f of flockAgg.values()) {
    f.cx /= f.n; f.cy /= f.n;
    f.vx /= f.n; f.vy /= f.n;
  }

  for (let i = g.enemies.count - 1; i >= 0; i--) {
    const e = g.enemies.items[i];

    if (e.flashTimer > 0) e.flashTimer -= dt;
    if (e.spawnTimer > 0) {
      e.spawnTimer -= dt;
      continue;
    }
    if (e.dashHitCd > 0) e.dashHitCd -= dt;
    if (e.slowTimer > 0) e.slowTimer -= dt;
    if (e.shockTimer > 0) e.shockTimer -= dt;
    if (e.chill > 0 && e.frozenTimer <= 0) e.chill = Math.max(0, e.chill - dt * 0.5);
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDps * dt;
      if (Math.random() < dt * 6) {
        const p = g.particles.spawnOrRecycle();
        p.kind = ParticleKind.Orb; p.x = e.x + rand(-e.radius, e.radius); p.y = e.y + rand(-e.radius, e.radius);
        p.vx = 0; p.vy = -30; p.life = 0.3; p.maxLife = 0.3; p.size = 5; p.color = 4;
      }
      if (e.hp <= 0) { g.killEnemy(e); continue; }
    }
    if (e.acidTimer > 0) {
      e.acidTimer -= dt;
      e.hp -= e.acidDps * dt;
      if (Math.random() < dt * 5) {
        const p = g.particles.spawnOrRecycle();
        p.kind = ParticleKind.Orb; p.x = e.x + rand(-e.radius, e.radius); p.y = e.y + rand(-e.radius, e.radius);
        p.vx = 0; p.vy = -20; p.life = 0.25; p.maxLife = 0.25; p.size = 4; p.color = 8;
      }
      if (e.hp <= 0) { g.killEnemy(e); continue; }
    }

    // frozen / shocked: locked in place (knockback still applies)
    if (e.frozenTimer > 0) {
      e.frozenTimer -= dt;
      e.vx = 0;
      e.vy = 0;
      e.x += e.kbx * dt;
      e.y += e.kby * dt;
      const kd = 1 - Math.min(1, dt * 6);
      e.kbx *= kd; e.kby *= kd;
      continue;
    }
    if (e.shockTimer > 0) {
      e.vx *= 0.8;
      e.vy *= 0.8;
      e.x += (e.vx + e.kbx) * dt;
      e.y += (e.vy + e.kby) * dt;
      const kd = 1 - Math.min(1, dt * 6);
      e.kbx *= kd; e.kby *= kd;
      continue;
    }

    const dx = g.px - e.x;
    const dy = g.py - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist;
    const ny = dy / dist;
    const slow = e.slowTimer > 0 ? 0.45 : 1;
    const spd = e.speed * slow * (e.affix === Affix.Swift ? 1.6 : 1);

    if (e.kind >= EnemyKind.BossWarden) {
      updateBoss(g, e, dt, nx, ny, dist);
    } else {
      switch (e.kind) {
        case EnemyKind.Chaser:
        case EnemyKind.Mini:
          e.vx = nx * spd;
          e.vy = ny * spd;
          break;
        case EnemyKind.Swarm: {
          const wob = Math.sin(g.time * 6 + e.seed) * 0.5;
          e.vx = (nx - ny * wob) * spd;
          e.vy = (ny + nx * wob) * spd;
          break;
        }
        case EnemyKind.Weaver: {
          const wob = Math.sin(g.time * 3.2 + e.seed) * 1.1;
          e.vx = (nx - ny * wob) * spd;
          e.vy = (ny + nx * wob) * spd;
          break;
        }
        case EnemyKind.Flocker: {
          // boids-lite: cohesion + alignment + player seek
          const f = e.flockId >= 0 ? flockAgg.get(e.flockId) : undefined;
          let sx = nx, sy = ny;
          if (f && f.n > 1) {
            const cohX = (f.cx - e.x) * 0.012;
            const cohY = (f.cy - e.y) * 0.012;
            const alnM = Math.hypot(f.vx, f.vy) || 1;
            sx = nx * 0.9 + cohX + (f.vx / alnM) * 0.55;
            sy = ny * 0.9 + cohY + (f.vy / alnM) * 0.55;
            const m = Math.hypot(sx, sy) || 1;
            sx /= m; sy /= m;
          }
          e.vx = sx * spd;
          e.vy = sy * spd;
          break;
        }
        case EnemyKind.Tank:
        case EnemyKind.Splitter:
          e.vx = nx * spd;
          e.vy = ny * spd;
          break;
        case EnemyKind.Dasher: {
          e.aiTimer -= dt;
          if (e.aiState === 0) {
            e.vx = nx * spd;
            e.vy = ny * spd;
            if (dist < 240) { e.aiState = 1; e.aiTimer = 0.55; }
          } else if (e.aiState === 1) {
            e.vx *= 0.82;
            e.vy *= 0.82;
            e.aimX = nx;
            e.aimY = ny;
            if (e.aiTimer <= 0) { e.aiState = 2; e.aiTimer = 0.4; }
          } else if (e.aiState === 2) {
            e.vx = e.aimX * spd * 3.6;
            e.vy = e.aimY * spd * 3.6;
            if (e.aiTimer <= 0) { e.aiState = 3; e.aiTimer = 0.9; }
          } else {
            e.vx *= 0.9;
            e.vy *= 0.9;
            if (e.aiTimer <= 0) e.aiState = 0;
          }
          break;
        }
        case EnemyKind.Spitter: {
          if (dist > 330) { e.vx = nx * spd; e.vy = ny * spd; }
          else if (dist < 230) { e.vx = -nx * spd * 0.8; e.vy = -ny * spd * 0.8; }
          else { e.vx = -ny * spd * 0.4; e.vy = nx * spd * 0.4; }
          e.shootTimer -= dt;
          if (e.shootTimer <= 0 && dist < 460) {
            e.shootTimer = 2.6;
            const dmg = ENEMY_DEFS[e.kind].damage * damageScale(g.time);
            g.spawnEnemyBullet(e.x, e.y, nx * 195, ny * 195, dmg, 195);
          }
          break;
        }
      }
    }

    e.x += (e.vx + e.kbx) * dt;
    e.y += (e.vy + e.kby) * dt;
    const kbDecay = 1 - Math.min(1, dt * 6);
    e.kbx *= kbDecay;
    e.kby *= kbDecay;
    e.angle = Math.atan2(e.vy, e.vx);

    // soft separation
    if (e.kind < EnemyKind.BossWarden) {
      const near = g.grid.query(e.x, e.y, e.radius + 14);
      let pushed = 0;
      for (let q = 0; q < near.length && pushed < 4; q++) {
        const o = near[q];
        if (o === e) continue;
        const ddx = e.x - o.x;
        const ddy = e.y - o.y;
        const d2 = ddx * ddx + ddy * ddy;
        const minD = (e.radius + o.radius) * 0.85;
        if (d2 > 0.01 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const push = ((minD - d) / d) * 0.5;
          e.x += ddx * push;
          e.y += ddy * push;
          pushed++;
        }
      }
    }

    // recycle stragglers
    if (dist > g.viewR + 560 && e.kind < EnemyKind.BossWarden) {
      const a = Math.random() * TAU;
      const r = g.viewR + rand(60, 140);
      e.x = g.px + Math.cos(a) * r;
      e.y = g.py + Math.sin(a) * r;
      e.spawnTimer = 0.4;
    }
  }
}

// ------------------------------------------------------------ worms

export function updateWorms(g: Game, dt: number): void {
  for (let wi = g.worms.length - 1; wi >= 0; wi--) {
    const w = g.worms[wi];
    if (w.flashTimer > 0) w.flashTimer -= dt;
    w.hitCd -= dt;

    // death cascade: segments pop one by one, front to back
    if (w.dying > 0) {
      w.dying -= dt;
      if (w.dying <= 0 && w.dyingIdx < w.segs.length) {
        const s = w.segs[w.dyingIdx];
        for (let k = 0; k < 6; k++) {
          const p = g.particles.spawnOrRecycle();
          const a = Math.random() * TAU;
          p.kind = k % 2 ? ParticleKind.Spark : ParticleKind.Shard;
          p.x = s.x; p.y = s.y;
          p.vx = Math.cos(a) * rand(80, 300); p.vy = Math.sin(a) * rand(80, 300);
          p.life = rand(0.3, 0.6); p.maxLife = p.life; p.size = rand(2, 4); p.color = 9;
          p.rot = Math.random() * TAU; p.vrot = rand(-8, 8);
        }
        const ring = g.particles.spawnOrRecycle();
        ring.kind = ParticleKind.Ring; ring.x = s.x; ring.y = s.y; ring.vx = 0; ring.vy = 0;
        ring.life = 0.3; ring.maxLife = 0.3; ring.size = w.radius * 2; ring.color = 9;
        g.spawnGem(s.x, s.y, Math.round((WORM.xp / w.segs.length) * (1 + g.time / 300)));
        audio.kill(20);
        g.addTrauma(0.1);
        w.dyingIdx++;
        w.dying = w.dyingIdx < w.segs.length ? 0.07 : 0;
        if (w.dyingIdx >= w.segs.length) {
          g.worms.splice(wi, 1);
          profile.records.wormKills++;
          g.kills++;
        }
      }
      continue;
    }

    // head steering: sinuous approach
    const head = w.segs[0];
    const dx = g.px - head.x;
    const dy = g.py - head.y;
    const dist = Math.hypot(dx, dy) || 1;
    const targetA = Math.atan2(dy, dx) + Math.sin(g.time * 2.2 + w.seed) * 0.7;
    let da = targetA - w.angle;
    while (da > Math.PI) da -= TAU;
    while (da < -Math.PI) da += TAU;
    w.angle += clamp(da, -2.4 * dt, 2.4 * dt);
    const spd = w.speed * (dist > 500 ? 1.35 : 1);
    head.x += Math.cos(w.angle) * spd * dt;
    head.y += Math.sin(w.angle) * spd * dt;

    // segments follow at fixed spacing
    for (let s = 1; s < w.segs.length; s++) {
      const prev = w.segs[s - 1];
      const seg = w.segs[s];
      const sdx = prev.x - seg.x;
      const sdy = prev.y - seg.y;
      const d = Math.hypot(sdx, sdy) || 1;
      const excess = d - WORM.segSpacing;
      if (excess > 0) {
        seg.x += (sdx / d) * excess;
        seg.y += (sdy / d) * excess;
      }
    }

    // player contact (any segment)
    if (w.hitCd <= 0) {
      for (let s = 0; s < w.segs.length; s++) {
        const seg = w.segs[s];
        const d2 = (seg.x - g.px) ** 2 + (seg.y - g.py) ** 2;
        if (d2 < (w.radius + g.playerRadius) ** 2) {
          w.hitCd = 0.75;
          g.hurtPlayer(w.damage);
          break;
        }
        if (d2 < (w.radius + GRAZE_RADIUS) ** 2 && w.hitCd <= 0 && Math.random() < dt * 3) {
          g.runGraze++;
          g.chargeOverdrive(0.8);
        }
      }
    }
  }
}

/** Damage a worm at a specific segment. Head takes double. Returns true if it hit. */
export function hitWorm(g: Game, w: Worm, segIdx: number, damage: number): boolean {
  if (w.dying > 0) return false;
  const mult = segIdx === 0 ? 2 : 0.75; // head is the weak point, body is plated
  w.hp -= damage * mult;
  w.flashTimer = 0.08;
  const n = g.dmgNumbers.spawnOrRecycle();
  const s = w.segs[segIdx];
  n.x = s.x; n.y = s.y - w.radius - 4;
  n.vy = -60; n.value = Math.round(damage * mult); n.life = 0.55; n.crit = segIdx === 0;
  audio.hit();
  if (w.hp <= 0) {
    w.dying = 0.05;
    w.dyingIdx = 0;
    g.score += 800;
    g.combo += 5;
    g.maxCombo = Math.max(g.maxCombo, g.combo);
    g.comboTimer = 3;
    g.hitStop = Math.max(g.hitStop, 0.12);
    g.addTrauma(0.45);
    g.haptic(40);
    audio.bigKill();
  }
  return true;
}

/** First worm segment overlapping the circle, or null. */
export function wormAt(g: Game, x: number, y: number, r: number): { worm: Worm; segIdx: number } | null {
  for (const w of g.worms) {
    if (w.dying > 0) continue;
    const rr = (r + w.radius) ** 2;
    for (let s = 0; s < w.segs.length; s++) {
      const seg = w.segs[s];
      const dx = seg.x - x;
      const dy = seg.y - y;
      if (dx * dx + dy * dy < rr) return { worm: w, segIdx: s };
    }
  }
  return null;
}

export function spawnWorm(g: Game): void {
  const a = Math.random() * TAU;
  const r = g.viewR + 150;
  const x = g.px + Math.cos(a) * r;
  const y = g.py + Math.sin(a) * r;
  const segs = [];
  for (let s = 0; s < WORM.segCount; s++) {
    segs.push({ x: x - Math.cos(a) * s * WORM.segSpacing, y: y - Math.sin(a) * s * WORM.segSpacing });
  }
  g.worms.push({
    segs,
    hp: WORM.hp * hpScale(g.time),
    maxHp: WORM.hp * hpScale(g.time),
    speed: WORM.speed,
    radius: WORM.radius,
    damage: Math.round(WORM.damage * damageScale(g.time)),
    angle: a + Math.PI,
    seed: Math.random() * TAU,
    hitCd: 0,
    flashTimer: 0,
    dying: 0,
    dyingIdx: 0,
  });
  audio.bossWarning();
  g.addTrauma(0.3);
}

// ------------------------------------------------------------ bosses

function updateBoss(g: Game, e: Enemy, dt: number, nx: number, ny: number, dist: number): void {
  e.aiTimer -= dt;
  const enraged = e.hp < e.maxHp * 0.33;
  const mid = e.hp < e.maxHp * 0.66;
  const spd = e.speed * (enraged ? 1.3 : 1);
  const dmg = e.touchDamage * 0.55;

  const ring = (count: number, speed: number, offset = 0): void => {
    for (let k = 0; k < count; k++) {
      const a = (k / count) * TAU + offset;
      g.spawnEnemyBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg, speed);
    }
    audio.shoot(2);
  };
  const shotgun = (n: number, speed: number): void => {
    const base = Math.atan2(g.py - e.y, g.px - e.x);
    for (let k = 0; k < n; k++) {
      const a = base + (k - (n - 1) / 2) * 0.16;
      g.spawnEnemyBullet(e.x, e.y, Math.cos(a) * speed, Math.sin(a) * speed, dmg, speed);
    }
    audio.shoot(2);
  };

  switch (e.kind) {
    case EnemyKind.BossWarden: {
      if (e.aiState === 0) {
        e.vx = nx * spd; e.vy = ny * spd;
        if (e.aiTimer <= 0) { e.aiState = 1; e.aiTimer = 0.6; }
      } else if (e.aiState === 1) {
        e.vx *= 0.9; e.vy *= 0.9;
        if (e.aiTimer <= 0) {
          ring(mid ? 22 : 16, 175);
          if (mid) ring(16, 135, 0.2);
          e.aiState = 2; e.aiTimer = 1.8;
        }
      } else if (e.aiState === 2) {
        e.vx = nx * spd; e.vy = ny * spd;
        if (e.aiTimer <= 0) { e.aiState = 3; e.aiTimer = 0.7; e.aimX = nx; e.aimY = ny; }
      } else if (e.aiState === 3) {
        e.vx *= 0.85; e.vy *= 0.85;
        e.aimX = nx; e.aimY = ny;
        if (e.aiTimer <= 0) { e.aiState = 4; e.aiTimer = 0.75; }
      } else {
        e.vx = e.aimX * 540;
        e.vy = e.aimY * 540;
        if (e.aiTimer <= 0) { e.aiState = 0; e.aiTimer = 2.2; }
      }
      break;
    }
    case EnemyKind.BossSeraph: {
      if (e.aiState === 0) {
        e.vx = nx * spd; e.vy = ny * spd;
        if (e.aiTimer <= 0) { e.aiState = 1; e.aiTimer = 2.8; e.shootTimer = 0; }
      } else if (e.aiState === 1) {
        e.vx = nx * spd * 0.3; e.vy = ny * spd * 0.3;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = enraged ? 0.085 : 0.115;
          e.angle += 0.44;
          for (let arm = 0; arm < (mid ? 3 : 2); arm++) {
            const a = e.angle + (arm / (mid ? 3 : 2)) * TAU;
            g.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 165, Math.sin(a) * 165, dmg, 165);
          }
        }
        if (e.aiTimer <= 0) { e.aiState = 2; e.aiTimer = 1.3; }
      } else if (e.aiState === 2) {
        e.vx = nx * spd; e.vy = ny * spd;
        if (e.aiTimer <= 0) { e.aiState = 3; e.aiTimer = 1.2; e.shootTimer = 0; e.seed = 0; }
      } else if (e.aiState === 3) {
        e.vx *= 0.9; e.vy *= 0.9;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.seed < 3) {
          e.shootTimer = 0.42;
          e.seed++;
          shotgun(5, 230);
        }
        if (e.aiTimer <= 0) { e.aiState = 4; }
      } else {
        for (let k = 0; k < 5; k++) {
          const a = Math.random() * TAU;
          const m = g.spawnEnemyAt(EnemyKind.Swarm, e.x + Math.cos(a) * 70, e.y + Math.sin(a) * 70, hpScale(g.time));
          if (m) m.spawnTimer = 0.5;
        }
        e.aiState = 0; e.aiTimer = 1.6;
      }
      break;
    }
    case EnemyKind.BossOmega: {
      if (e.aiState === 0) {
        e.vx = nx * spd; e.vy = ny * spd;
        if (e.aiTimer <= 0) { e.aiState = 1; e.aiTimer = 1.4; e.shootTimer = 0; e.seed = 0; }
      } else if (e.aiState === 1) {
        e.vx = nx * spd * 0.5; e.vy = ny * spd * 0.5;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0 && e.seed < (enraged ? 4 : 2)) {
          e.shootTimer = 0.5;
          e.seed++;
          shotgun(enraged ? 7 : 5, 250);
        }
        if (e.aiTimer <= 0) { e.aiState = 2; e.aiTimer = 2.1; e.shootTimer = 0; }
      } else if (e.aiState === 2) {
        e.vx = nx * spd * 0.25; e.vy = ny * spd * 0.25;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = enraged ? 0.09 : 0.13;
          e.angle -= 0.38;
          for (let arm = 0; arm < 4; arm++) {
            const a = e.angle + (arm / 4) * TAU;
            g.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, dmg, 150);
          }
        }
        if (e.aiTimer <= 0) { e.aiState = 3; e.aiTimer = 0.5; }
      } else {
        if (e.aiTimer <= 0) {
          ring(20, 190);
          ring(14, 140, 0.22);
          if (mid) {
            for (let k = 0; k < 2; k++) {
              const a = Math.random() * TAU;
              const d = g.spawnEnemyAt(EnemyKind.Dasher, e.x + Math.cos(a) * 90, e.y + Math.sin(a) * 90, hpScale(g.time));
              if (d) d.spawnTimer = 0.5;
            }
          }
          e.aiState = 0; e.aiTimer = 1.5;
        }
      }
      break;
    }
  }

  // keep bosses inside the arena
  if (g.arenaActive) {
    const adx = e.x - g.arenaX;
    const ady = e.y - g.arenaY;
    const d = Math.hypot(adx, ady);
    const max = g.arenaR - e.radius;
    if (d > max) {
      e.x = g.arenaX + (adx / d) * max;
      e.y = g.arenaY + (ady / d) * max;
    }
  } else if (dist > g.viewR + 200) {
    e.vx = nx * spd * 2.5;
    e.vy = ny * spd * 2.5;
  }
}

// ------------------------------------------------------------ enemy bullets

export function updateEnemyBullets(g: Game, dt: number): void {
  for (let i = g.enemyBullets.count - 1; i >= 0; i--) {
    const b = g.enemyBullets.items[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    const dx = b.x - g.px;
    const dy = b.y - g.py;
    const d2 = dx * dx + dy * dy;
    if (b.life <= 0 || d2 > (g.viewR + 320) ** 2) {
      g.enemyBullets.releaseAt(i);
      continue;
    }
    const hitR = b.radius + g.playerRadius;
    if (d2 < hitR * hitR) {
      g.hurtPlayer(b.damage);
      g.enemyBullets.releaseAt(i);
      continue;
    }
    if (!b.grazed && d2 < (b.radius + GRAZE_RADIUS) ** 2) {
      b.grazed = true;
      g.runGraze++;
      g.chargeOverdrive(3.5);
      const p = g.particles.spawnOrRecycle();
      p.kind = ParticleKind.Spark;
      p.x = b.x; p.y = b.y;
      p.vx = rand(-80, 80); p.vy = rand(-80, 80);
      p.life = 0.3; p.maxLife = 0.3; p.size = 2.5; p.color = 3;
    }
  }
}

// ------------------------------------------------------------ director

export function updateSpawner(g: Game, dt: number): void {
  const t = g.time;

  while (g.waveIdx < WAVES.length - 1 && t >= WAVES[g.waveIdx + 1].t) g.waveIdx++;
  const wave = WAVES[g.waveIdx];

  let bossAlive = findBoss(g);
  if (!g.endless && g.bossIdx < BOSS_TIMES.length) {
    const next = BOSS_TIMES[g.bossIdx];
    if (g.bossWarnAt < 0 && t >= next.t - 3.5) {
      g.bossWarnAt = t;
      g.hooks.bossWarn(BOSS_NAMES[next.kind]);
      audio.bossWarning();
      g.haptic(30);
    }
    if (t >= next.t) {
      spawnBoss(g, next.kind, 1);
      g.bossIdx++;
      g.bossWarnAt = -1;
      bossAlive = findBoss(g);
    }
  } else if (g.endless) {
    g.endlessBossTimer -= dt;
    if (g.endlessBossTimer <= 0) {
      const kinds = [EnemyKind.BossWarden, EnemyKind.BossSeraph, EnemyKind.BossOmega];
      const kind = kinds[g.endlessCycle % 3];
      g.hooks.bossWarn(BOSS_NAMES[kind]);
      audio.bossWarning();
      spawnBoss(g, kind, Math.pow(1.6, g.endlessCycle + 1));
      g.endlessCycle++;
      g.endlessBossTimer = 150;
      bossAlive = findBoss(g);
    }
  }

  if (bossAlive) {
    g.hooks.bossBar(BOSS_NAMES[bossAlive.kind], Math.max(0, bossAlive.hp / bossAlive.maxHp), true);
  } else if (g.arenaActive) {
    g.arenaActive = false; // boss died via burn tick etc.
  }

  const interval = wave.interval * (bossAlive ? 2.6 : 1) * (g.endless ? Math.pow(0.93, g.endlessCycle) : 1);
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = interval;
    const batch = wave.batch + (g.endless ? g.endlessCycle : 0);
    for (let k = 0; k < batch; k++) {
      const kind = pickWeighted(wave.kinds, wave.weights);
      spawnAtRing(g, kind, hpScale(t));
    }
  }

  if (t > 110 && !bossAlive) {
    g.eliteTimer -= dt;
    if (g.eliteTimer <= 0) {
      g.eliteTimer = rand(42, 65);
      spawnElite(g);
    }
  }

  if (!g.endless && g.eventIdx < EVENTS.length && t >= EVENTS[g.eventIdx].t) {
    const ev = EVENTS[g.eventIdx];
    g.eventIdx++;
    if (!bossAlive) runEvent(g, ev.type);
  }
  // endless: periodic surprise events
  if (g.endless && !bossAlive && Math.random() < dt / 45) {
    runEvent(g, (['ring', 'stream', 'flock', 'worm'] as const)[randInt(0, 3)]);
  }
}

function findBoss(g: Game): Enemy | null {
  for (let i = 0; i < g.enemies.count; i++) {
    if (g.enemies.items[i].kind >= EnemyKind.BossWarden) return g.enemies.items[i];
  }
  return null;
}

function spawnAtRing(g: Game, kind: EnemyKind, hpMult: number): Enemy | null {
  const a = Math.random() * TAU;
  const r = g.viewR + rand(50, 150);
  return g.spawnEnemyAt(kind, g.px + Math.cos(a) * r, g.py + Math.sin(a) * r, hpMult);
}

function spawnBoss(g: Game, kind: EnemyKind, extraMult: number): void {
  const a = Math.random() * TAU;
  const r = Math.min(g.viewR * 0.8, 420);
  // arena centers on the player; boss enters from the arena edge
  g.arenaActive = true;
  g.arenaX = g.px;
  g.arenaY = g.py;
  g.arenaR = Math.min(g.viewR * 1.02, 520);
  const e = g.spawnEnemyAt(kind, g.px + Math.cos(a) * r, g.py + Math.sin(a) * r, extraMult);
  if (!e) {
    g.arenaActive = false;
    return;
  }
  e.touchDamage = ENEMY_DEFS[kind].damage * damageScale(g.time);
  e.spawnTimer = 1.2;
  e.aiTimer = 2;
  g.hitStop = Math.max(g.hitStop, 0.18);
  g.addTrauma(0.5);
}

function spawnElite(g: Game): void {
  const pool = [EnemyKind.Chaser, EnemyKind.Tank, EnemyKind.Dasher, EnemyKind.Weaver, EnemyKind.Splitter];
  const kind = pool[randInt(0, Math.min(pool.length - 1, Math.floor(g.time / 130) + 1))];
  const e = spawnAtRing(g, kind, hpScale(g.time) * 13);
  if (!e) return;
  e.elite = true;
  e.radius *= 1.75;
  e.speed *= 0.85;
  e.touchDamage = Math.round(e.touchDamage * 1.6 * damageScale(g.time));
  e.xp *= 8;
  e.kbResist = clamp(e.kbResist + 0.5, 0, 0.95);
  e.affix = randInt(1, 3) as Affix;
  if (e.affix === Affix.Armored) e.hp = e.maxHp = e.maxHp * 1.3;
}

function runEvent(g: Game, type: 'ring' | 'stream' | 'flock' | 'worm'): void {
  if (type === 'worm') {
    spawnWorm(g);
    return;
  }
  if (type === 'flock') {
    // a coordinated flock sweeping in from one side
    const a = Math.random() * TAU;
    const flockId = nextFlockId++;
    for (let k = 0; k < 14; k++) {
      const r = g.viewR + 80 + rand(0, 120);
      const off = (Math.random() - 0.5) * 260;
      const e = g.spawnEnemyAt(
        EnemyKind.Flocker,
        g.px + Math.cos(a) * r - Math.sin(a) * off,
        g.py + Math.sin(a) * r + Math.cos(a) * off,
        hpScale(g.time) * 0.9,
      );
      if (e) {
        e.flockId = flockId;
        e.spawnTimer = 0.6;
      }
    }
    g.addTrauma(0.15);
    return;
  }
  if (type === 'ring') {
    const n = 24;
    const kind = g.time > 300 ? EnemyKind.Weaver : EnemyKind.Chaser;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * TAU;
      const r = g.viewR * 0.95;
      const e = g.spawnEnemyAt(kind, g.px + Math.cos(a) * r, g.py + Math.sin(a) * r, hpScale(g.time) * 0.8);
      if (e) e.spawnTimer = 1.2;
    }
  } else {
    const a = Math.random() * TAU;
    const perpX = -Math.sin(a);
    const perpY = Math.cos(a);
    for (let k = 0; k < 18; k++) {
      const r = g.viewR + 60 + k * 34;
      const off = (Math.random() - 0.5) * 120;
      const e = g.spawnEnemyAt(
        EnemyKind.Swarm,
        g.px + Math.cos(a) * r + perpX * off,
        g.py + Math.sin(a) * r + perpY * off,
        hpScale(g.time) * 0.9,
      );
      if (e) e.speed *= 1.35;
    }
  }
  g.addTrauma(0.2);
}
