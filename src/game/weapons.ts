// Weapon firing systems, projectile simulation, orbital blades, turrets.
// Level tables are cumulative multipliers indexed by level-1 (levels 1..8);
// index 8 is the evolved form.

import { Game } from './game';
import { Enemy, ParticleKind, WeaponId, WeaponState, ZoneKind } from './types';
import { WEAPONS } from './data';
import { dist2, rand, TAU } from '../core/math';
import { audio } from '../audio/audio';
import { wormAt, hitWorm } from './enemies';

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
  count: [1, 2, 2, 2, 3, 3, 4, 6, 0],
  dmg: [1, 1, 1.3, 1.3, 1.3, 1.3, 1.69, 1.69, 1.4],
  orbit: [70, 70, 70, 88, 88, 88, 88, 110, 0],
  spin: [2.6, 2.6, 2.6, 2.6, 2.6, 3.6, 3.6, 3.6, 4],
  base: 14,
};
const CRYO = {
  count: [3, 4, 4, 4, 6, 6, 6, 8, 9],
  dmg: [1, 1, 1.25, 1.25, 1.25, 1.55, 1.55, 1.55, 1.9],
  cd: [1.5, 1.5, 1.5, 1.5, 1.5, 1.5, 1.14, 1.14, 1.0],
  chill: [1, 1, 1, 1.5, 1.5, 1.5, 1.5, 2, 2.2],
  base: 9,
};
const ACID = {
  globs: [1, 1, 1, 1, 2, 2, 2, 3, 3],
  radius: [1, 1.2, 1.2, 1.2, 1.2, 1.2, 1.45, 1.45, 1.9],
  dmg: [1, 1, 1.25, 1.25, 1.25, 1.55, 1.55, 1.55, 1.9],
  cd: [2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 2.6, 1.95, 1.7],
  life: [2.5, 2.5, 2.5, 3.5, 3.5, 3.5, 3.5, 3.5, 4.5],
  base: 14, // pool dps
};
const GLAIVE = {
  count: [1, 1, 1, 1, 1, 2, 2, 2, 2],
  dmg: [1, 1.3, 1.3, 1.3, 1.75, 1.75, 1.75, 2.45, 3.0],
  cd: [2.1, 2.1, 2.1, 1.6, 1.6, 1.6, 1.6, 1.2, 1.05],
  size: [10, 10, 14, 14, 14, 14, 18, 18, 26],
  base: 26,
};
const MINES = {
  count: [1, 1, 1, 1, 2, 2, 2, 2, 3],
  dmg: [1, 1, 1.3, 1.3, 1.3, 1.69, 1.69, 1.69, 2.1],
  cd: [2.4, 2.4, 2.4, 1.8, 1.8, 1.8, 1.8, 1.4, 1.2],
  radius: [1, 1.25, 1.25, 1.25, 1.25, 1.25, 1.55, 1.55, 1.9],
  base: 35,
};
const TURRET = {
  dmg: [1, 1, 1.3, 1.3, 1.69, 1.69, 2.28, 2.28, 2.28],
  cd: [0.7, 0.53, 0.53, 0.53, 0.53, 0.42, 0.42, 0.32, 0.28],
  shots: [1, 1, 1, 2, 2, 2, 2, 2, 2],
  base: 13,
};
const VOID = {
  dmg: [1, 1.25, 1.25, 1.25, 1.55, 1.55, 1.55, 1.95, 2.4], // aura dps mult
  pull: [140, 140, 220, 220, 220, 220, 300, 300, 380],
  size: [26, 26, 26, 34, 34, 34, 34, 34, 46],
  cd: [4.2, 4.2, 4.2, 4.2, 4.2, 3.2, 3.2, 3.2, 2.8],
  base: 30,
};

// ------------------------------------------------------------ firing

export function fireWeapons(g: Game, dt: number): void {
  for (const w of g.weapons) {
    w.cooldown -= dt;
    if (w.id === WeaponId.Blades || w.id === WeaponId.Turret) continue; // continuous systems
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
      case WeaponId.Cryo: fireCryo(g, w); break;
      case WeaponId.Acid: fireAcid(g, w); break;
      case WeaponId.Glaive: fireGlaive(g, w); break;
      case WeaponId.Mines: fireMines(g, w); break;
      case WeaponId.Void: fireVoid(g, w); break;
    }
  }
}

function firePulseVolley(g: Game, w: WeaponState): void {
  const target = g.nearestEnemy(g.px, g.py, 720);
  if (!target) return;
  const i = idx(w);
  const n = PULSE.count[i];
  const baseAngle = Math.atan2(target.y - g.py, target.x - g.px);
  for (let k = 0; k < n; k++) {
    const a = baseAngle + (k - (n - 1) / 2) * 0.09;
    const p = g.projectiles.spawn();
    if (!p) return;
    p.x = g.px; p.y = g.py;
    p.vx = Math.cos(a) * 640; p.vy = Math.sin(a) * 640;
    p.radius = w.evolved ? 7 : 4.5;
    p.damage = PULSE.base * PULSE.dmg[i] * g.dmgMult();
    p.pierce = PULSE.pierce[i];
    p.life = 1.3;
    p.kind = WeaponId.Pulse;
    p.homing = 0; p.targetIdx = -1; p.hitCd = 0; p.phase = 0; p.knockback = 90;
    p.seed = Math.random();
  }
  muzzleFlash(g, baseAngle, WEAPONS[WeaponId.Pulse].color);
  audio.shoot(0);
}

function muzzleFlash(g: Game, angle: number, _color: string): void {
  const m = g.particles.spawnOrRecycle();
  m.kind = ParticleKind.Orb;
  m.x = g.px + Math.cos(angle) * 20;
  m.y = g.py + Math.sin(angle) * 20;
  m.vx = 0; m.vy = 0;
  m.life = 0.09; m.maxLife = 0.09; m.size = 13; m.color = 6;
}

function fireTesla(g: Game, w: WeaponState): void {
  const i = idx(w);
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
  const applyShock = w.level >= 4 || w.evolved;
  for (let s = 0; s < strikes; s++) {
    let cur: Enemy | null = candidates[(Math.random() * candidates.length) | 0];
    let px = g.px, py = g.py;
    const visited = new Set<Enemy>();
    for (let c = 0; c <= TESLA.chains[i]; c++) {
      if (!cur || visited.has(cur)) break;
      visited.add(cur);
      g.bolts.push({ x1: px, y1: py, x2: cur.x, y2: cur.y, life: 0.16, color: WEAPONS[WeaponId.Tesla].color });
      px = cur.x; py = cur.y;
      if (applyShock) g.applyShock(cur, w.evolved ? 0.9 : 0.35);
      g.dealDamage(cur, dmg, {});
      let next: Enemy | null = null;
      let bestD = 260 * 260;
      const near = g.grid.query(px, py, 260);
      for (let q = 0; q < near.length; q++) {
        const e2 = near[q];
        if (visited.has(e2) || e2.spawnTimer > 0 || e2.hp <= 0) continue;
        const d = dist2(px, py, e2.x, e2.y);
        if (d < bestD) { bestD = d; next = e2; }
      }
      cur = next;
    }
  }
  audio.shoot(1);
}

function fireNova(g: Game, w: WeaponState): void {
  const i = idx(w);
  w.cooldown = NOVA.cd[i] * g.cdMult();
  const radius = 100 * NOVA.radius[i] * g.stats.areaMult;
  const dmg = NOVA.base * NOVA.dmg[i] * g.dmgMult();
  const burn = w.level >= 3 || w.evolved;
  const near = g.grid.query(g.px, g.py, radius + 30);
  for (let k = near.length - 1; k >= 0; k--) {
    const e = near[k];
    if (e.spawnTimer > 0) continue;
    const d2 = dist2(g.px, g.py, e.x, e.y);
    if (d2 < (radius + e.radius) ** 2) {
      const d = Math.sqrt(d2) || 1;
      if (burn) g.applyBurn(e, (w.evolved ? 10 : 5) * g.dmgMult() * 0.5, w.evolved ? 4 : 2.5);
      g.dealDamage(e, dmg, {
        knockX: ((e.x - g.px) / d) * NOVA.knock[i],
        knockY: ((e.y - g.py) / d) * NOVA.knock[i],
      });
    }
  }
  // nova also slams serpents
  for (const worm of g.worms) {
    for (let s = 0; s < worm.segs.length; s++) {
      if (dist2(g.px, g.py, worm.segs[s].x, worm.segs[s].y) < (radius + worm.radius) ** 2) {
        hitWorm(g, worm, s, dmg);
        break; // one hit per nova per worm
      }
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
  for (let k = 0; k < SWARM.count[i]; k++) {
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
  p.hitCd = 0.12;
  p.phase = 0;
  p.knockback = 60;
  p.seed = Math.random();
}

function fireRail(g: Game, w: WeaponState): void {
  const i = idx(w);
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
  for (let l = 0; l < RAIL.lances[i]; l++) {
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
      const side = -relX * sin + relY * cos > 0 ? 1 : -1;
      e.kbx += sin * side * -220 * (1 - e.kbResist);
      e.kby += cos * side * 220 * (1 - e.kbResist);
    }
    if (perp < width / 2 + e.radius) {
      g.dealDamage(e, dmg, { knockX: cos * 60, knockY: sin * 60 });
    }
  }
  // rail vs serpents: first segment crossing the beam line
  for (const worm of g.worms) {
    for (let s = 0; s < worm.segs.length; s++) {
      const relX = worm.segs[s].x - g.px;
      const relY = worm.segs[s].y - g.py;
      const along = relX * cos + relY * sin;
      if (along < 0 || along > len) continue;
      if (Math.abs(-relX * sin + relY * cos) < width / 2 + worm.radius) {
        hitWorm(g, worm, s, dmg);
        break;
      }
    }
  }
  g.beams.push({
    x: g.px, y: g.py, angle, len, width,
    life: 0.28, maxLife: 0.28, color: WEAPONS[WeaponId.Rail].color,
  });
  for (let s = 0; s < 5; s++) {
    const p = g.particles.spawnOrRecycle();
    p.kind = ParticleKind.Spark;
    p.x = g.px + cos * 20; p.y = g.py + sin * 20;
    p.vx = cos * rand(200, 500) + rand(-80, 80);
    p.vy = sin * rand(200, 500) + rand(-80, 80);
    p.life = 0.3; p.maxLife = 0.3; p.size = 2.5; p.color = 5;
  }
}

function fireCryo(g: Game, w: WeaponState): void {
  const target = g.nearestEnemy(g.px, g.py, 620);
  if (!target) return;
  const i = idx(w);
  w.cooldown = CRYO.cd[i] * g.cdMult();
  const n = CRYO.count[i];
  const baseAngle = Math.atan2(target.y - g.py, target.x - g.px);
  for (let k = 0; k < n; k++) {
    const a = baseAngle + (k - (n - 1) / 2) * 0.16;
    const p = g.projectiles.spawn();
    if (!p) return;
    const sp = rand(420, 520);
    p.x = g.px; p.y = g.py;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.radius = 4;
    p.damage = CRYO.base * CRYO.dmg[i] * g.dmgMult();
    p.pierce = 0;
    p.life = 1.1;
    p.kind = WeaponId.Cryo;
    p.homing = 0; p.targetIdx = -1; p.hitCd = 0;
    p.phase = CRYO.chill[i]; // chill amount rides in phase
    p.knockback = 40;
    p.seed = Math.random();
  }
  muzzleFlash(g, baseAngle, WEAPONS[WeaponId.Cryo].color);
  // Glacier Storm: periodic freezing nova
  if (w.evolved) {
    w.angle += 1;
    if (w.angle >= 3) {
      w.angle = 0;
      const r = 190 * g.stats.areaMult;
      const near = g.grid.query(g.px, g.py, r + 30);
      for (let k = near.length - 1; k >= 0; k--) {
        const e = near[k];
        if (e.spawnTimer > 0) continue;
        if (dist2(g.px, g.py, e.x, e.y) < (r + e.radius) ** 2) {
          g.applyChill(e, 3);
          g.dealDamage(e, 20 * g.dmgMult(), { canCrit: false, showNumber: false });
        }
      }
      const ring = g.particles.spawnOrRecycle();
      ring.kind = ParticleKind.Ring; ring.x = g.px; ring.y = g.py; ring.vx = 0; ring.vy = 0;
      ring.life = 0.45; ring.maxLife = 0.45; ring.size = r; ring.color = 7;
    }
  }
  audio.shoot(0);
}

function fireAcid(g: Game, w: WeaponState): void {
  const i = idx(w);
  const target = g.nearestEnemy(g.px, g.py, 560);
  if (!target) return;
  w.cooldown = ACID.cd[i] * g.cdMult();
  for (let k = 0; k < ACID.globs[i]; k++) {
    const p = g.projectiles.spawn();
    if (!p) return;
    const tx = target.x + rand(-70, 70) * k;
    const ty = target.y + rand(-70, 70) * k;
    const d = Math.hypot(tx - g.px, ty - g.py) || 1;
    const sp = 380;
    p.x = g.px; p.y = g.py;
    p.vx = ((tx - g.px) / d) * sp; p.vy = ((ty - g.py) / d) * sp;
    p.radius = 7;
    p.damage = ACID.base * ACID.dmg[i] * g.dmgMult(); // pool dps
    p.pierce = 0;
    p.life = d / sp; // burst exactly at target range
    p.kind = WeaponId.Acid;
    p.homing = 0; p.targetIdx = -1; p.hitCd = 0;
    p.phase = ACID.radius[i] * (w.evolved ? 1 : 1); // radius mult
    p.knockback = 0;
    p.seed = ACID.life[i];
  }
  audio.shoot(2);
}

/** Acid glob lands → pool. Called from projectile update on expiry/hit. */
export function burstAcid(g: Game, x: number, y: number, dps: number, radiusMult: number, life: number): void {
  g.spawnZone(x, y, 62 * radiusMult * g.stats.areaMult, life, dps, false, ZoneKind.Acid, 0);
  for (let s = 0; s < 6; s++) {
    const p = g.particles.spawnOrRecycle();
    p.kind = ParticleKind.Spark;
    p.x = x; p.y = y;
    const a = Math.random() * TAU;
    p.vx = Math.cos(a) * rand(60, 200); p.vy = Math.sin(a) * rand(60, 200);
    p.life = 0.3; p.maxLife = 0.3; p.size = 2.5; p.color = 8;
  }
}

function fireGlaive(g: Game, w: WeaponState): void {
  const target = g.nearestEnemy(g.px, g.py, 650);
  if (!target) return;
  const i = idx(w);
  w.cooldown = GLAIVE.cd[i] * g.cdMult();
  const n = GLAIVE.count[i];
  const baseAngle = Math.atan2(target.y - g.py, target.x - g.px);
  for (let k = 0; k < n; k++) {
    const a = baseAngle + (k === 0 ? 0 : Math.PI * 0.5);
    const p = g.projectiles.spawn();
    if (!p) return;
    const sp = 520;
    p.x = g.px; p.y = g.py;
    p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp;
    p.radius = GLAIVE.size[i];
    p.damage = GLAIVE.base * GLAIVE.dmg[i] * g.dmgMult();
    p.pierce = 999;
    p.life = 3.2;
    p.kind = WeaponId.Glaive;
    p.homing = 0; p.targetIdx = -1; p.hitCd = 0;
    p.phase = 0; // 0 = outgoing, 1 = returning
    p.knockback = 110;
    p.seed = Math.random();
  }
  audio.shoot(4);
}

function fireMines(g: Game, w: WeaponState): void {
  const i = idx(w);
  w.cooldown = MINES.cd[i] * g.cdMult();
  for (let k = 0; k < MINES.count[i]; k++) {
    const p = g.projectiles.spawn();
    if (!p) return;
    p.x = g.px - g.moveDirX * 30 + rand(-24, 24) * k;
    p.y = g.py - g.moveDirY * 30 + rand(-24, 24) * k;
    p.vx = 0; p.vy = 0;
    p.radius = 7;
    p.damage = MINES.base * MINES.dmg[i] * g.dmgMult();
    p.pierce = 0;
    p.life = 20;
    p.kind = WeaponId.Mines;
    p.homing = 0; p.targetIdx = -1;
    p.hitCd = 0.6; // arming delay
    p.phase = MINES.radius[i]; // blast radius mult
    p.knockback = 0;
    p.seed = Math.random();
  }
}

export function explodeMine(g: Game, x: number, y: number, damage: number, radiusMult: number, cluster: boolean): void {
  const r = 78 * radiusMult * g.stats.areaMult;
  const near = g.grid.query(x, y, r + 30);
  for (let k = near.length - 1; k >= 0; k--) {
    const e = near[k];
    if (e.spawnTimer > 0 || e.hp <= 0) continue;
    const d2 = dist2(x, y, e.x, e.y);
    if (d2 < (r + e.radius) ** 2) {
      const d = Math.sqrt(d2) || 1;
      g.dealDamage(e, damage, {
        knockX: ((e.x - x) / d) * 260,
        knockY: ((e.y - y) / d) * 260,
      });
    }
  }
  const wormHit = wormAt(g, x, y, r);
  if (wormHit) hitWorm(g, wormHit.worm, wormHit.segIdx, damage);
  const ring = g.particles.spawnOrRecycle();
  ring.kind = ParticleKind.Ring; ring.x = x; ring.y = y; ring.vx = 0; ring.vy = 0;
  ring.life = 0.35; ring.maxLife = 0.35; ring.size = r; ring.color = 4;
  const orb = g.particles.spawnOrRecycle();
  orb.kind = ParticleKind.Orb; orb.x = x; orb.y = y; orb.vx = 0; orb.vy = 0;
  orb.life = 0.3; orb.maxLife = 0.3; orb.size = r * 0.7; orb.color = 4;
  g.addTrauma(0.15);
  audio.kill(10);
  if (cluster) {
    // spawn 3 delayed sub-blasts as tiny mines with short fuses
    for (let c = 0; c < 3; c++) {
      const p = g.projectiles.spawn();
      if (!p) break;
      const a = Math.random() * TAU;
      p.x = x + Math.cos(a) * r * 0.7;
      p.y = y + Math.sin(a) * r * 0.7;
      p.vx = 0; p.vy = 0;
      p.radius = 5;
      p.damage = damage * 0.5;
      p.pierce = 0;
      p.life = 0.25 + c * 0.12; // fuse
      p.kind = WeaponId.Mines;
      p.homing = 0; p.targetIdx = -1;
      p.hitCd = 99; // never proximity-trigger — explodes on life end
      p.phase = 0.6;
      p.knockback = 0;
      p.seed = 2; // marks sub-blast (no re-cluster)
    }
  }
}

function fireVoid(g: Game, w: WeaponState): void {
  const i = idx(w);
  const target = g.nearestEnemy(g.px, g.py, 700);
  if (!target) return;
  w.cooldown = VOID.cd[i] * g.cdMult();
  const p = g.projectiles.spawn();
  if (!p) return;
  const a = Math.atan2(target.y - g.py, target.x - g.px);
  p.x = g.px; p.y = g.py;
  p.vx = Math.cos(a) * 85; p.vy = Math.sin(a) * 85;
  p.radius = VOID.size[i];
  p.damage = VOID.base * VOID.dmg[i] * g.dmgMult(); // aura dps
  p.pierce = 999;
  p.life = 4.5;
  p.kind = WeaponId.Void;
  p.homing = 0; p.targetIdx = -1; p.hitCd = 0;
  p.phase = VOID.pull[i];
  p.knockback = 0;
  p.seed = Math.random();
  audio.shoot(1);
}

// ------------------------------------------------------------ turrets

export function updateTurrets(g: Game, dt: number): void {
  const w = g.weapons.find(x => x.id === WeaponId.Turret);
  if (!w || g.turrets.length === 0) return;
  const i = idx(w);
  for (const t of g.turrets) {
    // teleport back to the player when left too far behind
    if (dist2(t.x, t.y, g.px, g.py) > 320 * 320) {
      t.x = g.px + rand(-60, 60);
      t.y = g.py + rand(-60, 60);
      const ring = g.particles.spawnOrRecycle();
      ring.kind = ParticleKind.Ring; ring.x = t.x; ring.y = t.y; ring.vx = 0; ring.vy = 0;
      ring.life = 0.3; ring.maxLife = 0.3; ring.size = 22; ring.color = 0;
    }
    t.cooldown -= dt;
    if (t.cooldown > 0) continue;
    const target = g.nearestEnemy(t.x, t.y, 480);
    if (!target) { t.cooldown = 0.15; continue; }
    t.cooldown = TURRET.cd[i] * g.cdMult();
    t.angle = Math.atan2(target.y - t.y, target.x - t.x);
    for (let s = 0; s < TURRET.shots[i]; s++) {
      const p = g.projectiles.spawn();
      if (!p) break;
      const a = t.angle + (s - (TURRET.shots[i] - 1) / 2) * 0.1;
      p.x = t.x; p.y = t.y;
      p.vx = Math.cos(a) * 560; p.vy = Math.sin(a) * 560;
      p.radius = 4;
      p.damage = TURRET.base * TURRET.dmg[i] * g.dmgMult();
      p.pierce = 0;
      p.life = 0.95;
      p.kind = WeaponId.Turret;
      p.homing = 0; p.targetIdx = -1; p.hitCd = 0; p.phase = 0; p.knockback = 60;
      p.seed = Math.random();
    }
    audio.shoot(0);
  }
  // Sentinel Net: tether beam between two turrets damages what it crosses
  if (w.evolved && g.turrets.length >= 2) {
    const a = g.turrets[0];
    const b = g.turrets[1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const cos = dx / len, sin = dy / len;
    const midX = (a.x + b.x) / 2, midY = (a.y + b.y) / 2;
    const near = g.grid.query(midX, midY, len / 2 + 40);
    for (let k = near.length - 1; k >= 0; k--) {
      const e = near[k];
      if (e.spawnTimer > 0 || e.hp <= 0) continue;
      e.bladeCd -= dt;
      if (e.bladeCd > 0) continue;
      const relX = e.x - a.x, relY = e.y - a.y;
      const along = relX * cos + relY * sin;
      if (along < 0 || along > len) continue;
      if (Math.abs(-relX * sin + relY * cos) < 10 + e.radius) {
        e.bladeCd = 0.3;
        g.dealDamage(e, 16 * g.dmgMult(), { canCrit: false });
      }
    }
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
      e.bladeCd -= dt;
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

    if (p.life <= 0) {
      // expiry behaviors
      if (p.kind === WeaponId.Acid) {
        burstAcid(g, p.x, p.y, p.damage, p.phase, p.seed);
      } else if (p.kind === WeaponId.Mines) {
        explodeMine(g, p.x, p.y, p.damage, p.phase, isClusterEvolved(g) && p.seed !== 2);
      } else if (p.kind === WeaponId.Void) {
        const w = g.weapons.find(x => x.id === WeaponId.Void);
        if (w?.evolved) {
          g.spawnZone(p.x, p.y, 130 * g.stats.areaMult, 2.8, p.damage * 0.8, false, 2, 0);
          g.addTrauma(0.3);
          audio.bigKill();
        }
      }
      g.projectiles.releaseAt(i);
      continue;
    }

    // per-kind steering
    if (p.kind === WeaponId.Glaive) {
      if (p.phase === 0 && p.life < 2.55) p.phase = 1;
      if (p.phase === 1) {
        // accelerate home toward the player
        const dx = g.px - p.x;
        const dy = g.py - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const k = Math.min(1, 7 * dt);
        p.vx += ((dx / d) * 620 - p.vx) * k;
        p.vy += ((dy / d) * 620 - p.vy) * k;
        if (d < 26) {
          g.projectiles.releaseAt(i);
          continue;
        }
      }
    } else if (p.homing > 0) {
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
        const k = Math.min(1, p.homing * dt);
        p.vx += (((target.x - p.x) / d) * 430 - p.vx) * k;
        p.vy += (((target.y - p.y) / d) * 430 - p.vy) * k;
      }
      if (Math.random() < dt * 40) {
        const t = g.particles.spawnOrRecycle();
        t.kind = ParticleKind.Orb; t.x = p.x; t.y = p.y;
        t.vx = 0; t.vy = 0; t.life = 0.2; t.maxLife = 0.2; t.size = 4; t.color = 6;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Void orb: continuous pull + damage aura, never "hits"
    if (p.kind === WeaponId.Void) {
      const pullR = p.radius + 110;
      const near = g.grid.query(p.x, p.y, pullR + 30);
      for (let k = near.length - 1; k >= 0; k--) {
        const e = near[k];
        if (e.spawnTimer > 0 || e.hp <= 0) continue;
        const d2v = dist2(p.x, p.y, e.x, e.y);
        if (d2v < pullR * pullR) {
          const d = Math.sqrt(d2v) || 1;
          e.kbx -= ((e.x - p.x) / d) * p.phase * dt * 3.5 * (1 - e.kbResist);
          e.kby -= ((e.y - p.y) / d) * p.phase * dt * 3.5 * (1 - e.kbResist);
          if (d2v < (p.radius + e.radius) ** 2) {
            e.zoneCd -= dt;
            if (e.zoneCd <= 0) {
              e.zoneCd = 0.3;
              g.dealDamage(e, p.damage * 0.3, { canCrit: false, showNumber: false });
            }
          }
        }
      }
      continue; // void orbs don't do standard collision
    }

    if (p.hitCd > 0 && p.kind !== WeaponId.Mines) continue;

    // Mines: proximity trigger
    if (p.kind === WeaponId.Mines) {
      if (p.hitCd > 0) continue; // still arming (or sub-blast fuse)
      const near = g.grid.query(p.x, p.y, 60);
      for (let k = 0; k < near.length; k++) {
        const e = near[k];
        if (e.spawnTimer > 0 || e.hp <= 0) continue;
        if (dist2(p.x, p.y, e.x, e.y) < (34 + e.radius) ** 2) {
          explodeMine(g, p.x, p.y, p.damage, p.phase, isClusterEvolved(g) && p.seed !== 2);
          g.projectiles.releaseAt(i);
          break;
        }
      }
      continue;
    }

    // collision vs void serpents
    if (g.worms.length > 0) {
      const hit = wormAt(g, p.x, p.y, p.radius);
      if (hit) {
        hitWorm(g, hit.worm, hit.segIdx, p.damage);
        const s = g.particles.spawnOrRecycle();
        s.kind = ParticleKind.Spark; s.x = p.x; s.y = p.y;
        s.vx = rand(-90, 90); s.vy = rand(-90, 90);
        s.life = 0.18; s.maxLife = 0.18; s.size = 2; s.color = 9;
        p.pierce--;
        p.hitCd = 0.09;
        if (p.pierce < 0) {
          g.projectiles.releaseAt(i);
          continue;
        }
      }
    }

    // standard collision vs enemies
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
        const s = g.particles.spawnOrRecycle();
        s.kind = ParticleKind.Spark; s.x = p.x; s.y = p.y;
        s.vx = -p.vx * 0.15 + rand(-50, 50); s.vy = -p.vy * 0.15 + rand(-50, 50);
        s.life = 0.18; s.maxLife = 0.18; s.size = 2; s.color = 6;

        if (p.kind === WeaponId.Cryo) {
          g.applyChill(e, p.phase);
        }

        if (p.kind === WeaponId.Acid) {
          burstAcid(g, p.x, p.y, p.damage, p.phase, p.seed);
          g.projectiles.releaseAt(i);
          break;
        }

        if (p.kind === WeaponId.Swarm) {
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
          if (killed) {
            const sw = g.weapons.find(x => x.id === WeaponId.Swarm);
            if (sw?.evolved && g.projectiles.count < 220) {
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

function isClusterEvolved(g: Game): boolean {
  return !!g.weapons.find(x => x.id === WeaponId.Mines)?.evolved;
}
