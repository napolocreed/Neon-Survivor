// Weapon firing systems, projectile simulation, orbital blades.
// Level tables are cumulative multipliers indexed by level-1 (levels 1..8);
// index 8 is the evolved form.

import { Game } from './game';
import { Enemy, ParticleKind, WeaponId, WeaponState } from './types';
import { WEAPONS } from './data';
import { dist2, rand, TAU } from '../core/math';
import { audio } from '../audio/audio';

const idx = (w: WeaponState): number => (w.evolved ? 8 : w.level - 1);

// ------------------------------------------------------------ level tables

const PULSE = {
  count: [1, 2, 2, 2, 3, 3, 3, 4, 5],
  dmg: [1, 1, 1.25, 1.25, 1.25, 1.25, 1.63, 1.63, 2.4],
  cd: [0.85, 0.85, 0.85, 0.68, 0.68, 0.68, 0.68, 0.54, 0.5],
  pierce: [0, 0, 0, 0, 0, 1, 1, 1, 3],
  base: 12,
};
const TESLA = {
  chains: [2, 3, 3, 3, 5, 5, 5, 7, 10],
  dmg: [1, 1, 1.3, 1.3, 1.3, 1.69, 1.69, 1.69, 2.1],
  cd: [1.7, 1.7, 1.7, 1.28, 1.28, 1.28, 1.28, 1.02, 0.85],
  strikes: [1, 1, 1, 1, 1, 1, 2, 2, 2],
  base: 18,
};
const NOVA = {
  radius: [1, 1.2, 1.2, 1.2, 1.5, 1.5, 1.5, 1.95, 2.6],
  dmg: [1, 1, 1.3, 1.3, 1.3, 1.3, 1.82, 1.82, 2.55],
  cd: [2.3, 2.3, 2.3, 1.8, 1.8, 1.8, 1.8, 1.44, 1.6],
  knock: [120, 120, 120, 120, 120, 320, 320, 320, 380],
  base: 22,
};
const SWARM = {
  count: [1, 2, 2, 2, 3, 3, 4, 4, 6],
  dmg: [1, 1, 1.25, 1.25, 1.25, 1.63, 1.63, 1.63, 2.0],
  cd: [1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.6, 1.2, 1.05],
  homing: [4, 4, 4, 6.5, 6.5, 6.5, 6.5, 6.5, 8],
  base: 15,
};
const RAIL = {
  dmg: [1, 1.35, 1.35, 1.35, 1.82, 1.82, 1.82, 2.55, 3.3],
  width: [16, 16, 24, 24, 24, 24, 34, 34, 44],
  cd: [3.2, 3.2, 3.2, 2.4, 2.4, 2.4, 2.4, 1.8, 1.7],
  lances: [1, 1, 1, 1, 1, 2, 2, 2, 2],
  base: 62,
};
const BLADES = {
  count: [1, 2, 2, 2, 3, 3, 4, 6, 0], // evolved = halo, no discrete blades
  dmg: [1, 1, 1.3, 1.3, 1.3, 1.3, 1.69, 1.69, 1.4],
  orbit: [70, 70, 70, 88, 88, 88, 88, 110, 0],
  spin: [2.6, 2.6, 2.6, 2.6, 2.6, 3.6, 3.6, 3.6, 4],
  base: 14,
};

// ------------------------------------------------------------ firing

export function fireWeapons(g: Game, dt: number): void {
  for (const w of g.weapons) {
    w.cooldown -= dt;
    if (w.id === WeaponId.Blades) continue; // continuous, handled in updateBlades
    if (w.burst > 0) {
      w.burstTimer -= dt;
      if (w.burstTimer <= 0) {
        w.burst--;
        w.burstTimer = 0.08;
        firePulseVolley(g, w);
      }
    }
    if (w.cooldown > 0) continue;
    switch (w.id) {
      case WeaponId.Pulse: {
        w.cooldown = PULSE.cd[idx(w)] * g.cdMult();
        if (w.evolved) {
          w.burst = 3;
          w.burstTimer = 0;
        } else {
          firePulseVolley(g, w);
        }
        break;
      }
      case WeaponId.Tesla: fireTesla(g, w); break;
      case WeaponId.Nova: fireNova(g, w); break;
      case WeaponId.Swarm: fireSwarm(g, w); break;
      case WeaponId.Rail: fireRail(g, w); break;
    }
  }
}

function firePulseVolley(g: Game, w: WeaponState): void {
  const target = g.nearestEnemy(g.px, g.py, 720);
  if (!target) return;
  const i = idx(w);
  const n = PULSE.count[i];
  const baseAngle = Math.atan2(target.y - g.py, target.x - g.px);
  const spread = 0.09;
  for (let k = 0; k < n; k++) {
    const a = baseAngle + (k - (n - 1) / 2) * spread;
    const p = g.projectiles.spawn();
    if (!p) return;
    const sp = 640;
    p.x = g.px; p.y = g.py;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.radius = w.evolved ? 7 : 4.5;
    p.damage = PULSE.base * PULSE.dmg[i] * g.dmgMult();
    p.pierce = PULSE.pierce[i];
    p.life = 1.3;
    p.kind = WeaponId.Pulse;
    p.homing = 0; p.targetIdx = -1; p.hitCd = 0; p.knockback = 90;
    p.seed = Math.random();
  }
  audio.shoot(0);
}

function fireTesla(g: Game, w: WeaponState): void {
  const i = idx(w);
  // random target within range
  const candidates: Enemy[] = [];
  for (let k = 0; k < g.enemies.count; k++) {
    const e = g.enemies.items[k];
    if (e.spawnTimer > 0) continue;
    if (dist2(g.px, g.py, e.x, e.y) < 540 * 540) candidates.push(e);
  }
  if (candidates.length === 0) return;
  w.cooldown = TESLA.cd[i] * g.cdMult();
  const strikes = TESLA.strikes[i];
  const dmg = TESLA.base * TESLA.dmg[i] * g.dmgMult();
  for (let s = 0; s < strikes; s++) {
    let cur = candidates[(Math.random() * candidates.length) | 0];
    let px = g.px, py = g.py;
    const visited = new Set<Enemy>();
    for (let c = 0; c <= TESLA.chains[i]; c++) {
      if (!cur || visited.has(cur)) break;
      visited.add(cur);
      g.bolts.push({ x1: px, y1: py, x2: cur.x, y2: cur.y, life: 0.16, color: WEAPONS[WeaponId.Tesla].color });
      px = cur.x; py = cur.y;
      if (w.evolved) cur.slowTimer = Math.max(cur.slowTimer, 0.8);
      const killed = g.dealDamage(cur, dmg, {});
      if (killed) { /* chain continues from corpse position */ }
      // next: nearest unvisited within 260
      let next: Enemy | null = null;
      let bestD = 260 * 260;
      const near = g.grid.query(px, py, 260);
      for (let q = 0; q < near.length; q++) {
        const e2 = near[q];
        if (visited.has(e2) || e2.spawnTimer > 0 || e2.hp <= 0) continue;
        const d = dist2(px, py, e2.x, e2.y);
        if (d < bestD) { bestD = d; next = e2; }
      }
      cur = next as Enemy;
    }
  }
  audio.shoot(1);
}

function fireNova(g: Game, w: WeaponState): void {
  const i = idx(w);
  w.cooldown = NOVA.cd[i] * g.cdMult();
  const radius = 100 * NOVA.radius[i] * g.stats.areaMult;
  const dmg = NOVA.base * NOVA.dmg[i] * g.dmgMult();
  const near = g.grid.query(g.px, g.py, radius + 30);
  for (let k = near.length - 1; k >= 0; k--) {
    const e = near[k];
    if (e.spawnTimer > 0) continue;
    const d2 = dist2(g.px, g.py, e.x, e.y);
    if (d2 < (radius + e.radius) ** 2) {
      const d = Math.sqrt(d2) || 1;
      if (w.evolved) {
        e.burnTimer = 4;
        e.burnDps = 9 * g.dmgMult();
      }
      g.dealDamage(e, dmg, {
        knockX: ((e.x - g.px) / d) * NOVA.knock[i],
        knockY: ((e.y - g.py) / d) * NOVA.knock[i],
      });
    }
  }
  const ring = g.particles.spawnOrRecycle();
  ring.kind = ParticleKind.Ring; ring.x = g.px; ring.y = g.py; ring.vx = 0; ring.vy = 0;
  ring.life = 0.42; ring.maxLife = 0.42; ring.size = radius; ring.color = w.evolved ? 3 : 4;
  g.addTrauma(w.evolved ? 0.25 : 0.1);
  audio.shoot(2);
}

function fireSwarm(g: Game, w: WeaponState): void {
  const i = idx(w);
  if (!g.nearestEnemy(g.px, g.py, 800)) return;
  w.cooldown = SWARM.cd[i] * g.cdMult();
  const n = SWARM.count[i];
  for (let k = 0; k < n; k++) {
    spawnMissile(g, g.px, g.py, SWARM.base * SWARM.dmg[i] * g.dmgMult(), SWARM.homing[i]);
  }
  audio.shoot(3);
}

export function spawnMissile(g: Game, x: number, y: number, damage: number, homing: number): void {
  const p = g.projectiles.spawn();
  if (!p) return;
  const a = Math.random() * TAU;
  p.x = x; p.y = y;
  p.vx = Math.cos(a) * 260; p.vy = Math.sin(a) * 260;
  p.radius = 5;
  p.damage = damage;
  p.pierce = 0;
  p.life = 3.2;
  p.kind = WeaponId.Swarm;
  p.homing = homing;
  p.targetIdx = -1;
  p.hitCd = 0.12; // brief arming delay
  p.knockback = 60;
  p.seed = Math.random();
}

function fireRail(g: Game, w: WeaponState): void {
  const i = idx(w);
  // aim at the enemy with the most neighbors (densest pack)
  let best: Enemy | null = null;
  let bestScore = -1;
  const samples = Math.min(g.enemies.count, 10);
  for (let s = 0; s < samples; s++) {
    const e = g.enemies.items[(Math.random() * g.enemies.count) | 0];
    if (e.spawnTimer > 0) continue;
    const neighbors = g.grid.query(e.x, e.y, 110).length;
    if (neighbors > bestScore) { bestScore = neighbors; best = e; }
  }
  if (!best) return;
  w.cooldown = RAIL.cd[i] * g.cdMult();
  const angle = Math.atan2(best.y - g.py, best.x - g.px);
  const lances = RAIL.lances[i];
  for (let l = 0; l < lances; l++) {
    railBlast(g, w, angle + l * Math.PI, i);
  }
  g.addTrauma(0.2);
  g.haptic(10);
  audio.shoot(4);
}

function railBlast(g: Game, w: WeaponState, angle: number, i: number): void {
  const len = 950;
  const width = RAIL.width[i] * g.stats.areaMult;
  const dmg = RAIL.base * RAIL.dmg[i] * g.dmgMult();
  const cos = Math.cos(angle), sin = Math.sin(angle);
  for (let k = g.enemies.count - 1; k >= 0; k--) {
    const e = g.enemies.items[k];
    if (e.spawnTimer > 0) continue;
    const relX = e.x - g.px, relY = e.y - g.py;
    const along = relX * cos + relY * sin;
    if (along < 0 || along > len) continue;
    const perp = Math.abs(-relX * sin + relY * cos);
    if (w.evolved && perp < width * 3 + e.radius && perp > width / 2) {
      // singularity: drag enemies toward the beam line
      const side = -relX * sin + relY * cos > 0 ? 1 : -1;
      e.kbx += sin * side * -220 * (1 - e.kbResist);
      e.kby += cos * side * 220 * (1 - e.kbResist);
    }
    if (perp < width / 2 + e.radius) {
      g.dealDamage(e, dmg, { knockX: cos * 60, knockY: sin * 60 });
    }
  }
  g.beams.push({
    x: g.px, y: g.py, angle, len, width,
    life: 0.28, maxLife: 0.28, color: WEAPONS[WeaponId.Rail].color,
  });
  // muzzle sparks
  for (let s = 0; s < 5; s++) {
    const p = g.particles.spawnOrRecycle();
    p.kind = ParticleKind.Spark;
    p.x = g.px + cos * 20; p.y = g.py + sin * 20;
    p.vx = cos * rand(200, 500) + rand(-80, 80);
    p.vy = sin * rand(200, 500) + rand(-80, 80);
    p.life = 0.3; p.maxLife = 0.3; p.size = 2.5; p.color = 5;
  }
}

// ------------------------------------------------------------ blades

export function updateBlades(g: Game, dt: number): void {
  const w = g.weapons.find(x => x.id === WeaponId.Blades);
  if (!w) return;
  const i = idx(w);
  w.angle += BLADES.spin[i] * (g.overdriveActive ? 1.3 : 1) * dt;
  const dmg = BLADES.base * BLADES.dmg[i] * g.dmgMult();

  if (w.evolved) {
    // halo saw: annulus around the player
    const inner = 92 * g.stats.areaMult;
    const outer = 158 * g.stats.areaMult;
    const near = g.grid.query(g.px, g.py, outer + 30);
    for (let k = near.length - 1; k >= 0; k--) {
      const e = near[k];
      if (e.spawnTimer > 0) continue;
      e.bladeCd -= dt;
      if (e.bladeCd > 0) continue;
      const d = Math.hypot(e.x - g.px, e.y - g.py);
      if (d > inner - e.radius && d < outer + e.radius) {
        e.bladeCd = 0.28;
        e.slowTimer = Math.max(e.slowTimer, 0.5);
        g.dealDamage(e, dmg, {});
      }
    }
    return;
  }

  const n = BLADES.count[i];
  const orbit = BLADES.orbit[i] * g.stats.areaMult;
  for (let b = 0; b < n; b++) {
    const a = w.angle + (b / n) * TAU;
    const bx = g.px + Math.cos(a) * orbit;
    const by = g.py + Math.sin(a) * orbit;
    const near = g.grid.query(bx, by, 40);
    for (let k = near.length - 1; k >= 0; k--) {
      const e = near[k];
      if (e.spawnTimer > 0) continue;
      e.bladeCd -= dt; // decays once per blade check; close enough
      if (e.bladeCd > 0) continue;
      if (dist2(bx, by, e.x, e.y) < (14 + e.radius) ** 2) {
        e.bladeCd = 0.4;
        const d = Math.hypot(e.x - g.px, e.y - g.py) || 1;
        g.dealDamage(e, dmg, {
          knockX: ((e.x - g.px) / d) * 140,
          knockY: ((e.y - g.py) / d) * 140,
        });
      }
    }
  }
}

/** Blade positions for the renderer. */
export function bladeGeometry(g: Game): { n: number; orbit: number; angle: number; evolved: boolean } | null {
  const w = g.weapons.find(x => x.id === WeaponId.Blades);
  if (!w) return null;
  const i = idx(w);
  return {
    n: BLADES.count[i],
    orbit: (w.evolved ? 125 : BLADES.orbit[i]) * g.stats.areaMult,
    angle: w.angle,
    evolved: w.evolved,
  };
}

// ------------------------------------------------------------ projectiles

export function updateProjectiles(g: Game, dt: number): void {
  for (let i = g.projectiles.count - 1; i >= 0; i--) {
    const p = g.projectiles.items[i];
    p.life -= dt;
    p.hitCd -= dt;
    if (p.life <= 0) { g.projectiles.releaseAt(i); continue; }

    // homing steering
    if (p.homing > 0) {
      let target: Enemy | null = null;
      if (p.targetIdx >= 0 && p.targetIdx < g.enemies.count) {
        target = g.enemies.items[p.targetIdx];
        if (target.hp <= 0 || dist2(p.x, p.y, target.x, target.y) > 700 * 700) target = null;
      }
      if (!target) {
        target = g.nearestEnemy(p.x, p.y, 700);
        p.targetIdx = target ? g.enemies.items.indexOf(target) : -1;
      }
      if (target) {
        const d = Math.hypot(target.x - p.x, target.y - p.y) || 1;
        const want = 430;
        const dvx = ((target.x - p.x) / d) * want;
        const dvy = ((target.y - p.y) / d) * want;
        const k = Math.min(1, p.homing * dt);
        p.vx += (dvx - p.vx) * k;
        p.vy += (dvy - p.vy) * k;
      }
      // engine trail
      if (Math.random() < dt * 40) {
        const t = g.particles.spawnOrRecycle();
        t.kind = ParticleKind.Orb; t.x = p.x; t.y = p.y;
        t.vx = 0; t.vy = 0; t.life = 0.2; t.maxLife = 0.2; t.size = 4; t.color = 6;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.hitCd > 0) continue;
    // collision vs enemies
    const near = g.grid.query(p.x, p.y, p.radius + 34);
    for (let k = near.length - 1; k >= 0; k--) {
      const e = near[k];
      if (e.spawnTimer > 0 || e.hp <= 0) continue;
      if (dist2(p.x, p.y, e.x, e.y) < (p.radius + e.radius) ** 2) {
        const sp = Math.hypot(p.vx, p.vy) || 1;
        const killed = g.dealDamage(e, p.damage, {
          knockX: (p.vx / sp) * p.knockback,
          knockY: (p.vy / sp) * p.knockback,
        });
        // impact sparks
        const s = g.particles.spawnOrRecycle();
        s.kind = ParticleKind.Spark; s.x = p.x; s.y = p.y;
        s.vx = -p.vx * 0.15 + rand(-50, 50); s.vy = -p.vy * 0.15 + rand(-50, 50);
        s.life = 0.18; s.maxLife = 0.18; s.size = 2; s.color = 6;

        if (p.kind === WeaponId.Swarm) {
          // small blast
          const blast = 46 * g.stats.areaMult;
          const around = g.grid.query(p.x, p.y, blast + 20);
          for (let q = around.length - 1; q >= 0; q--) {
            const e2 = around[q];
            if (e2 === e || e2.spawnTimer > 0 || e2.hp <= 0) continue;
            if (dist2(p.x, p.y, e2.x, e2.y) < (blast + e2.radius) ** 2) {
              g.dealDamage(e2, p.damage * 0.5, { showNumber: false });
            }
          }
          const ring = g.particles.spawnOrRecycle();
          ring.kind = ParticleKind.Ring; ring.x = p.x; ring.y = p.y; ring.vx = 0; ring.vy = 0;
          ring.life = 0.22; ring.maxLife = 0.22; ring.size = blast; ring.color = 6;
          // hive mind: kills refund a missile
          if (killed) {
            const sw = g.weapons.find(x => x.id === WeaponId.Swarm);
            if (sw?.evolved && g.projectiles.count < 200) {
              spawnMissile(g, e.x, e.y, p.damage, 8);
            }
          }
          g.projectiles.releaseAt(i);
          break;
        }

        p.pierce--;
        p.hitCd = 0.07;
        if (p.pierce < 0) {
          g.projectiles.releaseAt(i);
          break;
        }
      }
    }
  }
}
