// Enemy AI, flocks, void serpents (worms), the spawn director, enemy bullets.

import { Game, GRAZE_RADIUS } from './game';
import { Enemy, EnemyKind, Affix, ParticleKind, Worm } from './types';
import { WAVES, BOSS_SLOT_TIMES, BOSS_POOLS, BOSS_SLOT_HP, EVENTS, ENEMY_DEFS, BOSS_NAMES, WORM, hpScale, damageScale } from './data';
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
        case EnemyKind.Sapper: {
          // kamikaze: rush, plant, fuse, blast — bait it into the horde
          if (e.aiState === 0) {
            const wob = Math.sin(g.time * 7 + e.seed) * 0.35;
            e.vx = (nx - ny * wob) * spd;
            e.vy = (ny + nx * wob) * spd;
            if (dist < 90) {
              e.aiState = 1;
              e.aiTimer = 0.9;
              e.kbResist = 0.9;
            }
          } else {
            e.vx *= 0.6;
            e.vy *= 0.6;
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) {
              sapperBlast(g, e);
              g.killEnemy(e);
              continue;
            }
          }
          break;
        }
        case EnemyKind.Aegis: {
          // frontal shield tracks the player, capped at 1.5 rad/s — outflank it
          const cur = Math.atan2(e.aimY, e.aimX);
          const want = Math.atan2(ny, nx);
          let da = want - cur;
          while (da > Math.PI) da -= TAU;
          while (da < -Math.PI) da += TAU;
          const na = cur + clamp(da, -1.5 * dt, 1.5 * dt);
          e.aimX = Math.cos(na);
          e.aimY = Math.sin(na);
          e.vx = nx * spd;
          e.vy = ny * spd;
          break;
        }
        case EnemyKind.Mender: {
          // shadows the nearest pack and channels a heal pulse
          if (e.aiState === 0) {
            if (dist < 260) { e.vx = -nx * spd; e.vy = -ny * spd; }
            else if (dist > 340) { e.vx = nx * spd * 0.7; e.vy = ny * spd * 0.7; }
            else { e.vx = -ny * spd * 0.6; e.vy = nx * spd * 0.6; }
            e.shootTimer -= dt;
            if (e.shootTimer <= 0) {
              // channel only with ≥2 patients nearby
              let allies = 0;
              const near2 = g.grid.query(e.x, e.y, 130);
              for (let q = 0; q < near2.length; q++) {
                const o = near2[q];
                if (o !== e && o.kind < EnemyKind.BossWarden && o.hp < o.maxHp) allies++;
              }
              if (allies >= 2) { e.aiState = 1; e.aiTimer = 0.8; }
              else e.shootTimer = 1;
            }
          } else {
            e.vx *= 0.7;
            e.vy *= 0.7;
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) {
              e.aiState = 0;
              e.shootTimer = 4;
              const near2 = g.grid.query(e.x, e.y, 140);
              for (let q = 0; q < near2.length; q++) {
                const o = near2[q];
                if (o === e || o.kind >= EnemyKind.BossWarden || o.hp <= 0) continue;
                if (o.hp < o.maxHp) {
                  o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.12);
                  g.bolts.push({ x1: e.x, y1: e.y, x2: o.x, y2: o.y, life: 0.2, color: '#5eff9f' });
                }
              }
              audio.shoot(3);
            }
          }
          break;
        }
        case EnemyKind.Blinker: {
          // stalks, then blinks into your escape lane — break your rhythm
          if (e.aiState === 0) {
            e.vx = nx * spd * 0.7;
            e.vy = ny * spd * 0.7;
            e.aiTimer -= dt;
            if (e.aiTimer <= 0 && dist < 420) {
              e.aiState = 1;
              e.aiTimer = 0.35;
              // destination: predicted player pos, offset to the side
              const pvx = g.input.moveX * g.stats.speed;
              const pvy = g.input.moveY * g.stats.speed;
              const side = Math.random() < 0.5 ? 1 : -1;
              const m = Math.hypot(pvx, pvy) || 1;
              e.aimX = g.px + pvx * 0.4 - (pvy / m) * 150 * side;
              e.aimY = g.py + pvy * 0.4 + (pvx / m) * 150 * side;
              const gp = g.particles.spawnOrRecycle();
              gp.kind = ParticleKind.Ring; gp.x = e.aimX; gp.y = e.aimY; gp.vx = 0; gp.vy = 0;
              gp.life = 0.35; gp.maxLife = 0.35; gp.size = 26; gp.color = 10;
            }
          } else if (e.aiState === 1) {
            e.vx *= 0.5;
            e.vy *= 0.5;
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) {
              e.x = e.aimX;
              e.y = e.aimY;
              e.aiState = 2;
              e.aiTimer = 0.3;
              e.spawnTimer = 0.12;
              audio.shoot(1);
            }
          } else {
            // short lunge after materializing
            e.vx = nx * spd * 2.2;
            e.vy = ny * spd * 2.2;
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) { e.aiState = 0; e.aiTimer = 2.2; }
          }
          break;
        }
        case EnemyKind.Pylon: {
          if (e.aiState === 0) {
            // drift to an anchor point, then plant
            e.aiTimer -= dt;
            if (dist < 420 || e.aiTimer <= 0) {
              e.aiState = 1;
              e.aiTimer = 1.0;
              e.kbResist = 1;
              e.vx = 0; e.vy = 0;
            } else {
              e.vx = nx * spd;
              e.vy = ny * spd;
            }
          } else if (e.aiState === 1) {
            // aim: track capped, lock at 0.4s remaining
            e.aiTimer -= dt;
            if (e.aiTimer > 0.4) {
              const cur = Math.atan2(e.aimY, e.aimX) || Math.atan2(ny, nx);
              const want = Math.atan2(ny, nx);
              let da = want - cur;
              while (da > Math.PI) da -= TAU;
              while (da < -Math.PI) da += TAU;
              const na = cur + clamp(da, -1.2 * dt, 1.2 * dt);
              e.aimX = Math.cos(na);
              e.aimY = Math.sin(na);
            }
            if (e.aiTimer <= 0) {
              // FIRE the locked beam
              const len = 520;
              const relX = g.px - e.x, relY = g.py - e.y;
              const along = relX * e.aimX + relY * e.aimY;
              const perp = Math.abs(-relX * e.aimY + relY * e.aimX);
              if (along > 0 && along < len && perp < 14 + g.playerRadius) {
                g.hurtPlayer(Math.round(16 * damageScale(g.time)), 'sniper-beam');
              }
              g.beams.push({
                x: e.x, y: e.y, angle: Math.atan2(e.aimY, e.aimX), len,
                width: 12, life: 0.22, maxLife: 0.22, color: '#ff8f5e',
              });
              audio.shoot(4);
              e.aiState = 2;
              e.aiTimer = 1.6;
            }
          } else {
            e.aiTimer -= dt;
            if (e.aiTimer <= 0) { e.aiState = 1; e.aiTimer = 1.0; }
          }
          break;
        }
      }
    }

    // elite affix behaviors
    if (e.elite) {
      if (e.affix === Affix.Regen && e.hp < e.maxHp) {
        e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
      } else if (e.affix === Affix.Phasing) {
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = rand(3.6, 5);
          const ring1 = g.particles.spawnOrRecycle();
          ring1.kind = ParticleKind.Ring; ring1.x = e.x; ring1.y = e.y; ring1.vx = 0; ring1.vy = 0;
          ring1.life = 0.3; ring1.maxLife = 0.3; ring1.size = e.radius * 1.6; ring1.color = 10;
          const jump = Math.min(190, dist - 80);
          if (jump > 40) {
            e.x += nx * jump;
            e.y += ny * jump;
            e.spawnTimer = 0.35; // brief rematerialize — dodge window
            const ring2 = g.particles.spawnOrRecycle();
            ring2.kind = ParticleKind.Ring; ring2.x = e.x; ring2.y = e.y; ring2.vx = 0; ring2.vy = 0;
            ring2.life = 0.35; ring2.maxLife = 0.35; ring2.size = e.radius * 2; ring2.color = 10;
            audio.shoot(1);
          }
        }
      }
    }

    e.x += (e.vx + e.kbx) * dt;
    e.y += (e.vy + e.kby) * dt;
    const kbDecay = 1 - Math.min(1, dt * 6);
    e.kbx *= kbDecay;
    e.kby *= kbDecay;
    // Bosses drive e.angle themselves (spiral arms, rotating beams) — only
    // regular enemies face their movement direction.
    if (e.kind < EnemyKind.BossWarden) e.angle = Math.atan2(e.vy, e.vx);

    // soft separation (scratch query: this loop never re-queries the grid)
    if (e.kind < EnemyKind.BossWarden) {
      const near = g.grid.queryScratch(e.x, e.y, e.radius + 14);
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

function sapperBlast(g: Game, e: Enemy): void {
  const r = 92;
  // hurts the player…
  if ((e.x - g.px) ** 2 + (e.y - g.py) ** 2 < (r + g.playerRadius) ** 2) {
    g.hurtPlayer(Math.round(24 * damageScale(g.time)), 'sapper');
  }
  // …but shreds the horde ×3 — bait it!
  const near = g.grid.query(e.x, e.y, r + 30);
  for (let q = near.length - 1; q >= 0; q--) {
    const o = near[q];
    if (o === e || o.spawnTimer > 0 || o.hp <= 0) continue;
    if ((e.x - o.x) ** 2 + (e.y - o.y) ** 2 < (r + o.radius) ** 2) {
      g.dealDamage(o, 72, { canCrit: false, showNumber: false });
    }
  }
  const ring = g.particles.spawnOrRecycle();
  ring.kind = ParticleKind.Ring; ring.x = e.x; ring.y = e.y; ring.vx = 0; ring.vy = 0;
  ring.life = 0.4; ring.maxLife = 0.4; ring.size = r; ring.color = 4;
  const orb = g.particles.spawnOrRecycle();
  orb.kind = ParticleKind.Orb; orb.x = e.x; orb.y = e.y; orb.vx = 0; orb.vy = 0;
  orb.life = 0.3; orb.maxLife = 0.3; orb.size = r * 0.8; orb.color = 4;
  g.addTrauma(0.25);
  audio.bigKill();
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
          g.hurtPlayer(w.damage, 'worm');
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
export function hitWorm(g: Game, w: Worm, segIdx: number, damage: number, src = 102): boolean {
  if (w.dying > 0) return false;
  const mult = segIdx === 0 ? 2 : 0.75; // head is the weak point, body is plated
  g.damageBySource.set(src, (g.damageBySource.get(src) ?? 0) + damage * mult);
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
  // fights that drag past 40s escalate — no camping the arena on add-farm
  const drag = g.arenaActive ? clamp((g.time - g.arenaStartT - 40) / 50, 0, 1) : 0;
  const enraged = e.hp < e.maxHp * 0.33 || drag >= 1;
  const mid = e.hp < e.maxHp * 0.66 || drag > 0.4;
  const spd = e.speed * (enraged ? 1.3 : 1) * (1 + drag * 0.5);
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
      // final phase: the arena itself closes in
      if (enraged && g.arenaActive && g.arenaR > 250) {
        g.arenaR -= 22 * dt;
      }
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
    case EnemyKind.BossNull: {
      // NULL VECTOR — blinks, then walls of bullets with a single gate
      const fireWall = (): void => {
        const wallDir = Math.atan2(g.py - e.y, g.px - e.x);
        const cos = Math.cos(wallDir), sin = Math.sin(wallDir);
        const gate = rand(-160, 160);
        for (let k = -13; k <= 13; k++) {
          const off = k * 26;
          if (Math.abs(off - gate) < 37) continue; // the single gate
          g.spawnEnemyBullet(
            e.x - sin * off, e.y + cos * off,
            cos * 160, sin * 160, dmg, 160,
          );
        }
        // gold marker on the gate
        const gp = g.particles.spawnOrRecycle();
        gp.kind = ParticleKind.Orb; gp.x = e.x - sin * gate; gp.y = e.y + cos * gate;
        gp.vx = cos * 160; gp.vy = sin * 160;
        gp.life = 1.4; gp.maxLife = 1.4; gp.size = 14; gp.color = 3;
        audio.shoot(2);
      };
      const gatedRing = (offset: number): void => {
        const gateA = e.seed + offset;
        for (let k = 0; k < 44; k++) {
          const a = (k / 44) * TAU;
          let da = Math.abs(a - (gateA % TAU));
          if (da > Math.PI) da = TAU - da;
          if (da < 0.38) continue;
          g.spawnEnemyBullet(e.x, e.y, Math.cos(a) * 150, Math.sin(a) * 150, dmg, 150);
        }
        audio.shoot(2);
      };
      // WHITEOUT signature at 50% (once)
      if (e.hp < e.maxHp * 0.5 && e.sigFired === 0) {
        e.sigFired = 1;
        e.aiState = 10;
        e.aiTimer = 0.8;
        e.shootTimer = 0;
        e.seed = Math.random() * TAU;
        audio.bossWarning();
      }
      if (e.aiState === 10) {
        e.vx *= 0.8; e.vy *= 0.8;
        e.shootTimer -= dt;
        if (e.aiTimer <= 0 && e.shootTimer <= 0) {
          e.seed += 0.7; // gate rotates each ring
          gatedRing(0);
          e.shootTimer = 0.8;
          e.aimX = (e.aimX || 0) + 1;
          if (e.aimX >= 5) { e.aiState = 0; e.aiTimer = 1.2; e.aimX = 0; }
        }
        break;
      }
      if (e.aiState === 0) { // blink reposition
        e.vx *= 0.9; e.vy *= 0.9;
        if (e.aiTimer <= 0) {
          const a = Math.random() * TAU;
          const gp = g.particles.spawnOrRecycle();
          gp.kind = ParticleKind.Ghost; gp.x = e.x; gp.y = e.y; gp.vx = 0; gp.vy = 0;
          gp.life = 0.4; gp.maxLife = 0.4; gp.size = e.radius * 0.8; gp.color = 10; gp.rot = 0;
          e.x = g.px + Math.cos(a) * Math.min(440, g.arenaR * 0.85);
          e.y = g.py + Math.sin(a) * Math.min(440, g.arenaR * 0.85);
          e.spawnTimer = 0.25;
          e.aiState = 1;
          e.aiTimer = 0.6;
          audio.shoot(1);
        }
      } else if (e.aiState === 1) { // aim + curtain
        e.vx = 0; e.vy = 0;
        if (e.aiTimer <= 0) {
          fireWall();
          if (enraged) {
            e.aiState = 1; e.aiTimer = 1.1; // enraged: chained curtains
            if (Math.random() < 0.4) { e.aiState = 2; e.aiTimer = 1.6; }
          } else {
            e.aiState = 2;
            e.aiTimer = 2.0;
          }
        }
      } else { // drift + snipe
        e.vx = nx * spd;
        e.vy = ny * spd;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 0.9;
          shotgun(3, 230);
        }
        if (e.aiTimer <= 0) { e.aiState = 0; e.aiTimer = 0.4; }
      }
      break;
    }
    case EnemyKind.BossMonolith: {
      // THE MONOLITH — the danger is the terrain: rotating beams + mortars
      const beamCount = e.sigFired >= 1 ? 4 : mid ? 3 : 2;
      const beamLen = Math.max(g.arenaR * 1.05, 520);
      // GRID LOCKDOWN signature at 40% (once): cross beams that reverse
      if (e.hp < e.maxHp * 0.4 && e.sigFired === 0) {
        e.sigFired = 1;
        e.aiState = 1;
        e.aiTimer = 9;
        e.aimY = 1; // rotation sign
        audio.bossWarning();
      }
      e.vx = nx * spd * (e.aiState === 1 ? 0.4 : 1);
      e.vy = ny * spd * (e.aiState === 1 ? 0.4 : 1);
      if (e.aiState === 0) { // telegraph
        if (e.aiTimer <= 0) {
          e.aiState = 1;
          e.aiTimer = e.sigFired >= 1 ? 9 : 5;
          e.shootTimer = 0.3;
          if (!e.aimY) e.aimY = 1;
        }
      } else if (e.aiState === 1) { // beams ON
        // lockdown: reverse every 2s with a warning flash
        if (e.sigFired >= 1) {
          e.aimX = (e.aimX ?? 0) + dt;
          if (e.aimX >= 2) {
            e.aimX = 0;
            e.aimY = -e.aimY;
            g.screenFlash = Math.max(g.screenFlash, 0.25);
          }
        }
        e.angle += 0.55 * e.aimY * dt * (enraged ? 1.25 : 1);
        // beam vs player
        if (g.dashTimer <= 0) {
          for (let b = 0; b < beamCount; b++) {
            const a = e.angle + (b / beamCount) * TAU;
            const cos = Math.cos(a), sin = Math.sin(a);
            const relX = g.px - e.x, relY = g.py - e.y;
            const along = relX * cos + relY * sin;
            if (along > e.radius && along < beamLen) {
              if (Math.abs(-relX * sin + relY * cos) < 10 + g.playerRadius) {
                g.hurtPlayer(Math.round(dmg * 0.9), 'boss-beam');
                break;
              }
            }
          }
        }
        // mortar on predicted position
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = enraged ? 0.8 : 1.1;
          const px = g.px + g.input.moveX * g.stats.speed * 0.5;
          const py = g.py + g.input.moveY * g.stats.speed * 0.5;
          g.spawnZone(px + rand(-40, 40), py + rand(-40, 40), 80, 4, 12 * damageScale(g.time), true, 1, 1.1);
        }
        if (e.aiTimer <= 0) { e.aiState = 2; e.aiTimer = 1.6; }
      } else { // rest + shotgun
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = 0.6;
          shotgun(5, 220);
        }
        if (e.aiTimer <= 0) { e.aiState = 0; e.aiTimer = 0.8; }
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
      g.hurtPlayer(b.damage, 'bullet');
      g.enemyBullets.releaseAt(i);
      continue;
    }
    if (!b.grazed && d2 < (b.radius + GRAZE_RADIUS) ** 2) {
      b.grazed = true;
      g.runGraze++;
      g.onGrazeFromBullet();
      g.chargeOverdrive(3.5 * (g.hasCurse('edge') ? 1.75 : 1));
      const p = g.particles.spawnOrRecycle();
      p.kind = ParticleKind.Spark;
      p.x = b.x; p.y = b.y;
      p.vx = rand(-80, 80); p.vy = rand(-80, 80);
      p.life = 0.3; p.maxLife = 0.3; p.size = 2.5; p.color = 3;
    }
  }
}

// ------------------------------------------------------------ director

/** Standing-population ceiling the director aims for. Well under the pool. */
const POP_SOFT_CAP = 300;

export function updateSpawner(g: Game, dt: number): void {
  const t = g.time;

  while (g.waveIdx < WAVES.length - 1 && t >= WAVES[g.waveIdx + 1].t) g.waveIdx++;
  const wave = WAVES[g.waveIdx];

  let bossAlive = findBoss(g);
  if (!g.endless && g.bossIdx < BOSS_SLOT_TIMES.length) {
    const nextT = BOSS_SLOT_TIMES[g.bossIdx];
    const nextKind = g.bossPlan[g.bossIdx];
    if (g.bossWarnAt < 0 && t >= nextT - 3.5) {
      g.bossWarnAt = t;
      g.hooks.bossWarn(BOSS_NAMES[nextKind]);
      audio.bossWarning();
      g.haptic(30);
    }
    if (t >= nextT && !bossAlive) { // never stack two bosses
      spawnBoss(g, nextKind, 1);
      g.bossIdx++;
      g.bossWarnAt = -1;
      bossAlive = findBoss(g);
    }
  } else if (g.endless) {
    g.endlessBossTimer -= dt;
    if (g.endlessBossTimer <= 0) {
      const kinds = BOSS_POOLS.flat();
      const kind = kinds[g.endlessCycle % kinds.length];
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

  const mut = g.mutator.id;
  const interval = wave.interval
    * (bossAlive ? 2.6 : 1)
    * (g.endless ? Math.pow(0.93, g.endlessCycle) : 1)
    * (g.surgeTimer > 0 ? 0.42 : 1)
    * (mut === 'swarm' ? 0.74 : 1)
    * (mut === 'tidal' ? 2.6 : 1);
  g.spawnTimer -= dt;
  if (g.spawnTimer <= 0) {
    g.spawnTimer = interval;
    let batch = Math.round((wave.batch + (g.endless ? g.endlessCycle : 0)) * (mut === 'tidal' ? 3.5 : 1));
    // Population governor. The pool must never saturate: a full pool makes
    // spawns fail silently, so the director loses control of pacing and the
    // difficulty flatlines at exactly the moment the frame budget is worst.
    // Taper toward the soft cap instead of slamming into the hard one.
    const pop = g.enemies.count;
    if (pop >= POP_SOFT_CAP) batch = 0;
    else if (pop > POP_SOFT_CAP * 0.75) batch = Math.max(1, Math.round(batch * 0.4));
    else if (pop > POP_SOFT_CAP * 0.55) batch = Math.max(1, Math.round(batch * 0.7));
    let hpMult = hpScale(t);
    if (mut === 'swarm') hpMult *= 0.8;
    if (mut === 'cryo') hpMult *= 1.15;
    for (let k = 0; k < batch; k++) {
      const kind = pickWeighted(wave.kinds, wave.weights);
      const e = spawnAtRing(g, kind, hpMult);
      if (e) {
        if (mut === 'rich') e.speed *= 1.15;
        else if (mut === 'cryo') e.speed *= 0.88;
        if (g.beaconAlive && g.hasCurse('defiance')) e.speed *= 1.15;
        if (e.kind === EnemyKind.Aegis || e.kind === EnemyKind.Pylon) {
          const d = Math.hypot(g.px - e.x, g.py - e.y) || 1;
          e.aimX = (g.px - e.x) / d;
          e.aimY = (g.py - e.y) / d;
          if (e.kind === EnemyKind.Pylon) e.aiTimer = 3;
        }
      }
    }
  }

  if (t > 110 && !bossAlive) {
    g.eliteTimer -= dt;
    if (g.eliteTimer <= 0) {
      g.eliteTimer = rand(42, 65) * (mut === 'titan' ? 0.5 : 1) * (g.surgeTimer > 0 ? 0.3 : 1);
      spawnElite(g);
    }
  }

  // SERPENT GRID: the serpent always re-forms
  if (mut === 'serpent' && t > 45 && g.worms.length === 0 && !bossAlive) {
    g.eliteTimer -= dt * 0.5; // reuse spare capacity: spawn soon
    if (Math.random() < dt / 14) spawnWorm(g);
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
  // scale the boss def to the slot's HP budget
  const slot = Math.min(2, g.bossIdx);
  const slotMult = BOSS_SLOT_HP[slot] / ENEMY_DEFS[kind].hp;
  extraMult *= Math.max(1, slotMult);
  const a = Math.random() * TAU;
  const r = Math.min(g.viewR * 0.8, 420);
  // arena centers on the player; boss enters from the arena edge
  g.arenaActive = true;
  g.arenaX = g.px;
  g.arenaY = g.py;
  g.arenaTargetR = Math.min(g.viewR * 1.02, 520);
  g.arenaR = g.arenaTargetR + 420; // sweeps inward during the name card
  g.arenaStartT = g.time;
  const e = g.spawnEnemyAt(kind, g.px + Math.cos(a) * r, g.py + Math.sin(a) * r, extraMult);
  if (!e) {
    g.arenaActive = false;
    return;
  }
  e.bossSlot = slot;
  e.touchDamage = ENEMY_DEFS[kind].damage * damageScale(g.time);
  e.spawnTimer = 1.2;
  e.aiTimer = 2;

  // The arrival vaporises the rabble. This is theatre, but it is also the fix
  // for the single most common death in the game: the lockdown used to trap
  // the entire horde in the ring with the player, so a dozen Spitters kept
  // firing throughout the fight and bullets piled up past 150 on screen with
  // nowhere to dodge. Clearing the stage makes the fight legible — it is about
  // the boss's pattern, which you can learn, not about saturation.
  for (let i = g.enemies.count - 1; i >= 0; i--) {
    const o = g.enemies.items[i];
    if (o === e || o.kind >= EnemyKind.BossWarden) continue;
    g.killEnemy(o);
  }
  g.enemyBullets.clear();
  g.nukeEffect(g.arenaTargetR);

  g.startBossIntro(kind);
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
  e.affix = randInt(1, 5) as Affix;
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
