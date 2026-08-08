// Canvas renderer: pre-baked glow sprites + additive blending, sector
// palettes, parallax starfield, arena walls, worms, zones, screen shake.

import { Game } from '../game/game';
import { EnemyKind, ParticleKind, PickupKind, WeaponId, Affix, ZoneKind } from '../game/types';
import { COLORS, WEAPONS, SECTORS } from '../game/data';
import { bladeGeometry } from '../game/weapons';
import { clamp, damp, TAU } from '../core/math';
import { profile } from '../meta/save';

// particle palette (indexed by particle.color)
const PALETTE = [
  '#4df3ff', '#ff3860', '#ffb02e', '#ffd75e', '#ff9f45',
  '#ff5e7a', '#ffffff', '#7ad7ff', '#9fff45', '#ff7ad7',
];

const ZONE_COLORS: Record<number, string> = {
  [ZoneKind.Acid]: '#9fff45',
  [ZoneKind.Fire]: '#ff7a45',
  [ZoneKind.Void]: '#c46bff',
};

interface Star {
  x: number;
  y: number;
  size: number;
  layer: number;
  tw: number;
}

export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glows = new Map<string, HTMLCanvasElement>();
  private stars: Star[] = [];
  private w = 0;
  private h = 0;
  private dpr = 1;
  private shakeT = 0;
  private zoom = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false })!;
    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * 2000,
        y: Math.random() * 2000,
        size: Math.random() < 0.8 ? 1 : 2,
        layer: i % 3 === 0 ? 0.12 : i % 3 === 1 ? 0.25 : 0.45,
        tw: Math.random() * TAU,
      });
    }
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize(): void {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = `${this.w}px`;
    this.canvas.style.height = `${this.h}px`;
  }

  viewRadius(): number {
    return Math.hypot(this.w, this.h) / 2 + 40;
  }

  private glow(color: string): HTMLCanvasElement {
    let g = this.glows.get(color);
    if (g) return g;
    g = document.createElement('canvas');
    g.width = g.height = 64;
    const c = g.getContext('2d')!;
    const grad = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.25, color);
    grad.addColorStop(1, 'transparent');
    c.fillStyle = grad;
    c.fillRect(0, 0, 64, 64);
    this.glows.set(color, g);
    return g;
  }

  private drawGlow(x: number, y: number, size: number, color: string, alpha: number): void {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.glow(color), x - size, y - size, size * 2, size * 2);
    ctx.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- frame

  renderAmbient(time: number): void {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.fillStyle = '#05060f';
    ctx.fillRect(0, 0, this.w, this.h);
    const camX = time * 18;
    const camY = time * -7;
    for (const s of this.stars) {
      const sx = ((s.x - camX * s.layer) % 2000 + 2000) % 2000 - (2000 - this.w) / 2;
      const sy = ((s.y - camY * s.layer) % 2000 + 2000) % 2000 - (2000 - this.h) / 2;
      if (sx < -4 || sx > this.w + 4 || sy < -4 || sy > this.h + 4) continue;
      const a = 0.25 + 0.2 * Math.sin(time * 2 + s.tw);
      ctx.fillStyle = `rgba(160,190,255,${a * s.layer * 2.4})`;
      ctx.fillRect(sx, sy, s.size, s.size);
    }
    const grid = 90;
    const gx = ((-camX % grid) + grid) % grid;
    const gy = ((-camY % grid) + grid) % grid;
    ctx.strokeStyle = 'rgba(77,163,255,0.05)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = gx; x < this.w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, this.h); }
    for (let y = gy; y < this.h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(this.w, y); }
    ctx.stroke();
  }

  render(g: Game, time: number, dt: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;
    const sector = SECTORS[g.sectorIdx];

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    // boss-arena zoom-out
    const zoomTarget = g.arenaActive ? 0.84 : 1;
    this.zoom += (zoomTarget - this.zoom) * damp(3, dt);

    // background base
    ctx.fillStyle = g.overdriveActive ? sector.bgOver : sector.bg;
    ctx.fillRect(0, 0, w, h);

    // screen shake
    this.shakeT += 0.35;
    let shakeX = 0;
    let shakeY = 0;
    if (profile.settings.shake && g.trauma > 0) {
      const s = g.trauma * g.trauma * 16;
      shakeX = Math.sin(this.shakeT * 7.9) * s;
      shakeY = Math.cos(this.shakeT * 6.3) * s;
    }

    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.scale(this.zoom, this.zoom);
    ctx.translate(-w / 2, -h / 2);

    const camX = g.camX - w / 2 + shakeX;
    const camY = g.camY - h / 2 + shakeY;

    this.drawBackground(g, camX, camY, time, sector);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawZones(g, time);
    this.drawArena(g, time);
    this.drawPickups(g, time);
    this.drawTurrets(g, time);
    this.drawEnemies(g, time);
    this.drawWorms(g, time);
    this.drawPlayer(g, time);
    this.drawBlades(g);
    this.drawProjectiles(g, time);
    this.drawBeams(g);
    this.drawBolts(g);
    this.drawParticles(g);
    this.drawEnemyBullets(g, time);
    this.drawDamageNumbers(g);

    ctx.restore(); // camera
    ctx.restore(); // zoom

    this.drawOverlays(g, time);
    this.drawJoystick(g);
  }

  // ---------------------------------------------------------------- layers

  private drawBackground(g: Game, camX: number, camY: number, time: number, sector: (typeof SECTORS)[0]): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    for (const s of this.stars) {
      const sx = ((s.x - camX * s.layer) % 2000 + 2000) % 2000 - (2000 - w) / 2;
      const sy = ((s.y - camY * s.layer) % 2000 + 2000) % 2000 - (2000 - h) / 2;
      if (sx < -4 || sx > w + 4 || sy < -4 || sy > h + 4) continue;
      const a = 0.25 + 0.2 * Math.sin(time * 2 + s.tw);
      ctx.fillStyle = `rgba(${sector.star},${a * s.layer * 2.4})`;
      ctx.fillRect(sx, sy, s.size, s.size);
    }

    const grid = 90;
    const gx = ((-camX % grid) + grid) % grid;
    const gy = ((-camY % grid) + grid) % grid;
    ctx.strokeStyle = g.overdriveActive ? 'rgba(255,215,94,0.07)' : sector.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = gx - grid; x < w + grid; x += grid) {
      ctx.moveTo(x, -grid);
      ctx.lineTo(x, h + grid);
    }
    for (let y = gy - grid; y < h + grid; y += grid) {
      ctx.moveTo(-grid, y);
      ctx.lineTo(w + grid, y);
    }
    ctx.stroke();
  }

  private drawZones(g: Game, time: number): void {
    const ctx = this.ctx;
    for (const z of g.zones) {
      const color = ZONE_COLORS[z.kind];
      if (z.telegraph > 0) {
        // warning: pulsing dashed circle
        const pulse = 0.4 + 0.4 * Math.sin(time * 14);
        ctx.strokeStyle = color;
        ctx.globalAlpha = pulse;
        ctx.setLineDash([8, 8]);
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(z.x, z.y, z.r, 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        continue;
      }
      const fade = Math.min(1, z.life / 0.5);
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(z.x, z.y, z.r * 1.15, color, 0.18 * fade);
      ctx.globalAlpha = 0.16 * fade;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.r, 0, TAU);
      ctx.fill();
      ctx.globalAlpha = 0.5 * fade;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // bubbles
      for (let b = 0; b < 3; b++) {
        const ba = z.seed + b * 2.1 + time * (1.2 + b * 0.3);
        const br = z.r * (0.25 + 0.55 * ((Math.sin(ba * 0.7) + 1) / 2));
        ctx.globalAlpha = 0.3 * fade;
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(ba) * br, z.y + Math.sin(ba) * br, 3 + (b % 2) * 2, 0, TAU);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  private drawArena(g: Game, time: number): void {
    if (!g.arenaActive) return;
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    const pulse = 0.5 + 0.3 * Math.sin(time * 4);
    ctx.strokeStyle = '#ff3860';
    ctx.globalAlpha = 0.55 * pulse;
    ctx.lineWidth = 4;
    ctx.setLineDash([26, 14]);
    ctx.lineDashOffset = -time * 60;
    ctx.beginPath();
    ctx.arc(g.arenaX, g.arenaY, g.arenaR, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.2;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.arc(g.arenaX, g.arenaY, g.arenaR + 9, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawTurrets(g: Game, time: number): void {
    if (g.turrets.length === 0) return;
    const ctx = this.ctx;
    const color = WEAPONS[WeaponId.Turret].color;
    const evolved = g.weapons.find(x => x.id === WeaponId.Turret)?.evolved;
    // tether beam
    if (evolved && g.turrets.length >= 2) {
      const a = g.turrets[0];
      const b = g.turrets[1];
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.5 + 0.25 * Math.sin(time * 10);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
    for (const t of g.turrets) {
      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(t.x, t.y, 20, color, 0.5);
      ctx.globalCompositeOperation = 'source-over';
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.fillStyle = '#0a1220';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= 6; k++) {
        const a = time * 0.6 + (k / 6) * TAU;
        if (k === 0) ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11);
        else ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      }
      ctx.fill();
      ctx.stroke();
      ctx.rotate(t.angle);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(4, 0);
      ctx.lineTo(15, 0);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawPickups(g: Game, time: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < g.pickups.count; i++) {
      const p = g.pickups.items[i];
      const bob = Math.sin(time * 4 + p.seed) * 2;
      switch (p.kind) {
        case PickupKind.Gem: {
          const tier = p.value >= 25 ? 2 : p.value >= 5 ? 1 : 0;
          const color = tier === 2 ? COLORS.xpHuge : tier === 1 ? COLORS.xpBig : COLORS.xp;
          const size = 4 + tier * 2;
          this.drawGlow(p.x, p.y + bob, size * 2.6, color, 0.5);
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(p.x, p.y + bob);
          ctx.rotate(time * 1.5 + p.seed);
          ctx.fillRect(-size / 2, -size / 2, size, size);
          ctx.restore();
          break;
        }
        case PickupKind.Shard: {
          this.drawGlow(p.x, p.y + bob, 10, COLORS.shard, 0.55);
          ctx.save();
          ctx.translate(p.x, p.y + bob);
          ctx.rotate(time * 2 + p.seed);
          ctx.fillStyle = COLORS.shard;
          ctx.beginPath();
          ctx.moveTo(0, -6);
          ctx.lineTo(4, 0);
          ctx.lineTo(0, 6);
          ctx.lineTo(-4, 0);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case PickupKind.Health: {
          this.drawGlow(p.x, p.y + bob, 13, COLORS.health, 0.5);
          ctx.fillStyle = COLORS.health;
          ctx.fillRect(p.x - 6, p.y + bob - 2, 12, 4);
          ctx.fillRect(p.x - 2, p.y + bob - 6, 4, 12);
          break;
        }
        case PickupKind.Magnet: {
          this.drawGlow(p.x, p.y + bob, 15, '#37d9f0', 0.6);
          ctx.strokeStyle = '#37d9f0';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(p.x, p.y + bob, 7, 0.3, Math.PI - 0.3, true);
          ctx.stroke();
          break;
        }
        case PickupKind.Nuke: {
          const pulse = 1 + Math.sin(time * 8) * 0.2;
          this.drawGlow(p.x, p.y + bob, 18 * pulse, '#ffe45e', 0.7);
          ctx.fillStyle = '#ffe45e';
          ctx.beginPath();
          ctx.arc(p.x, p.y + bob, 7, 0, TAU);
          ctx.fill();
          break;
        }
        case PickupKind.Chest: {
          const pulse = 1 + Math.sin(time * 5) * 0.15;
          this.drawGlow(p.x, p.y + bob, 26 * pulse, COLORS.shard, 0.75);
          ctx.save();
          ctx.translate(p.x, p.y + bob);
          ctx.fillStyle = '#1a1509';
          ctx.strokeStyle = COLORS.shard;
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.rect(-11, -8, 22, 16);
          ctx.fill();
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(-11, -1);
          ctx.lineTo(11, -1);
          ctx.stroke();
          ctx.restore();
          break;
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private enemyColor(kind: EnemyKind, elite: boolean): string {
    if (elite) return COLORS.elite;
    switch (kind) {
      case EnemyKind.Tank: return '#ff7a45';
      case EnemyKind.Dasher: return '#ff4dd8';
      case EnemyKind.Spitter: return '#c46bff';
      case EnemyKind.Splitter: return '#ff9f45';
      case EnemyKind.Weaver: return '#ff5e9f';
      case EnemyKind.Swarm: return '#ff6b57';
      case EnemyKind.Mini: return '#ff9f45';
      case EnemyKind.Flocker: return '#ffd75e';
      default: return COLORS.enemy;
    }
  }

  private drawEnemies(g: Game, time: number): void {
    const ctx = this.ctx;
    for (let i = 0; i < g.enemies.count; i++) {
      const e = g.enemies.items[i];
      const boss = e.kind >= EnemyKind.BossWarden;
      let color = boss ? '#ff3860' : this.enemyColor(e.kind, e.elite);
      if (e.frozenTimer > 0) color = '#7ad7ff';

      if (e.spawnTimer > 0) {
        const t = 1 - clamp(e.spawnTimer / 0.6, 0, 1);
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.5 * t;
        ctx.setLineDash([4, 6]);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.radius * (0.5 + t * 0.8), 0, TAU);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
        continue;
      }

      const flash = e.flashTimer > 0;
      ctx.save();
      ctx.translate(e.x, e.y);

      ctx.globalCompositeOperation = 'lighter';
      this.drawGlow(0, 0, e.radius * (boss ? 2.6 : 1.9), color, boss ? 0.5 : 0.32);
      ctx.globalCompositeOperation = 'source-over';

      if (e.elite) {
        const affixColor = e.affix === Affix.Volatile ? '#ffe45e' : e.affix === Affix.Armored ? '#8fa3ff' : '#5eff9f';
        ctx.strokeStyle = affixColor;
        ctx.globalAlpha = 0.6 + 0.3 * Math.sin(time * 6);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, e.radius + 6, 0, TAU);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }

      ctx.fillStyle = flash ? '#ffffff' : e.frozenTimer > 0 ? '#10283a' : '#0a0c18';
      ctx.strokeStyle = flash ? '#ffffff' : color;
      ctx.lineWidth = boss ? 3 : 2;
      const r = e.radius;

      if (e.kind === EnemyKind.Dasher && e.aiState === 1) {
        ctx.strokeStyle = '#ffffff';
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(time * 30);
      }

      ctx.beginPath();
      switch (e.kind) {
        case EnemyKind.Chaser:
        case EnemyKind.Mini:
        case EnemyKind.Swarm:
          this.poly(3, r, e.angle);
          break;
        case EnemyKind.Flocker: {
          // arrow dart
          ctx.rotate(e.angle);
          ctx.moveTo(r * 1.2, 0);
          ctx.lineTo(-r * 0.8, r * 0.7);
          ctx.lineTo(-r * 0.3, 0);
          ctx.lineTo(-r * 0.8, -r * 0.7);
          ctx.closePath();
          break;
        }
        case EnemyKind.Tank:
          this.poly(6, r, time * 0.3);
          break;
        case EnemyKind.Dasher: {
          const a = e.aiState >= 1 ? Math.atan2(e.aimY, e.aimX) : e.angle;
          ctx.rotate(a);
          ctx.moveTo(r, 0);
          ctx.lineTo(-r * 0.7, r * 0.8);
          ctx.lineTo(-r * 0.2, 0);
          ctx.lineTo(-r * 0.7, -r * 0.8);
          ctx.closePath();
          break;
        }
        case EnemyKind.Spitter:
          this.poly(4, r, time * 0.8 + e.seed);
          break;
        case EnemyKind.Splitter:
          this.poly(8, r, e.seed);
          break;
        case EnemyKind.Weaver: {
          ctx.rotate(e.angle);
          ctx.moveTo(r, 0);
          ctx.quadraticCurveTo(0, r, -r, 0);
          ctx.quadraticCurveTo(0, -r, r, 0);
          break;
        }
        case EnemyKind.BossWarden:
          this.poly(6, r, time * 0.5);
          break;
        case EnemyKind.BossSeraph: {
          ctx.moveTo(0, -r);
          ctx.lineTo(r * 0.9, 0);
          ctx.lineTo(0, r);
          ctx.lineTo(-r * 0.9, 0);
          ctx.closePath();
          ctx.moveTo(r * 0.9, 0);
          ctx.lineTo(r * 1.5, -r * 0.5);
          ctx.moveTo(-r * 0.9, 0);
          ctx.lineTo(-r * 1.5, -r * 0.5);
          break;
        }
        case EnemyKind.BossOmega:
          this.poly(8, r, -time * 0.4);
          break;
      }
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;

      // status decals
      if (e.frozenTimer > 0) {
        ctx.strokeStyle = 'rgba(220,245,255,0.8)';
        ctx.lineWidth = 1.5;
        for (let k = 0; k < 3; k++) {
          const a = e.seed + (k / 3) * TAU;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
          ctx.lineTo(Math.cos(a) * r * 1.1, Math.sin(a) * r * 1.1);
          ctx.stroke();
        }
      } else if (e.shockTimer > 0 && Math.sin(time * 40) > 0) {
        ctx.strokeStyle = '#ffe45e';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-r * 0.6, -r);
        ctx.lineTo(0, 0);
        ctx.lineTo(-r * 0.2, r * 0.2);
        ctx.lineTo(r * 0.6, r);
        ctx.stroke();
      }

      if (boss) {
        const pulse = 0.5 + 0.5 * Math.sin(time * 4);
        ctx.fillStyle = `rgba(255,56,96,${0.4 + pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(0, 0, r * 0.35, 0, TAU);
        ctx.fill();
        if (e.kind === EnemyKind.BossWarden && e.aiState === 3) {
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.setLineDash([8, 8]);
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(e.aimX * 600, e.aimY * 600);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      if ((e.elite || boss) && e.hp < e.maxHp) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, r + (boss ? 12 : 9), -Math.PI / 2, -Math.PI / 2 + TAU * (e.hp / e.maxHp));
        ctx.stroke();
      }

      ctx.restore();
    }
  }

  private poly(sides: number, r: number, rot: number): void {
    const ctx = this.ctx;
    for (let k = 0; k <= sides; k++) {
      const a = rot + (k / sides) * TAU;
      if (k === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
  }

  private drawWorms(g: Game, time: number): void {
    const ctx = this.ctx;
    const color = '#ff7ad7';
    for (const w of g.worms) {
      const startIdx = w.dying > 0 ? w.dyingIdx : 0;
      // body: back to front
      for (let s = w.segs.length - 1; s >= startIdx; s--) {
        const seg = w.segs[s];
        const isHead = s === 0;
        const r = isHead ? w.radius * 1.25 : w.radius * (1 - (s / w.segs.length) * 0.35);
        const flash = w.flashTimer > 0 && (isHead || s < 3);
        ctx.globalCompositeOperation = 'lighter';
        this.drawGlow(seg.x, seg.y, r * 1.7, color, isHead ? 0.5 : 0.22);
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = flash ? '#ffffff' : '#160a18';
        ctx.strokeStyle = flash ? '#ffffff' : color;
        ctx.lineWidth = isHead ? 3 : 2;
        ctx.beginPath();
        if (isHead) {
          // head: pointed hexagon facing travel
          ctx.save();
          ctx.translate(seg.x, seg.y);
          ctx.rotate(w.angle);
          ctx.moveTo(r * 1.4, 0);
          ctx.lineTo(r * 0.4, r);
          ctx.lineTo(-r, r * 0.7);
          ctx.lineTo(-r, -r * 0.7);
          ctx.lineTo(r * 0.4, -r);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          // eye
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(r * 0.5, 0, 3.4, 0, TAU);
          ctx.fill();
          ctx.restore();
        } else {
          ctx.arc(seg.x, seg.y, r, 0, TAU);
          ctx.fill();
          ctx.stroke();
          // segment spine glints
          if (s % 2 === 0) {
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.5 + 0.3 * Math.sin(time * 6 + s);
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, 2.5, 0, TAU);
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
      // head hp arc
      if (w.dying <= 0 && w.hp < w.maxHp) {
        const head = w.segs[0];
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(head.x, head.y, w.radius * 1.7, -Math.PI / 2, -Math.PI / 2 + TAU * Math.max(0, w.hp / w.maxHp));
        ctx.stroke();
      }
    }
  }

  private drawPlayer(g: Game, time: number): void {
    const ctx = this.ctx;
    const blink = g.invuln > 0 && g.dashTimer <= 0 && g.reflectTimer <= 0 && Math.sin(time * 40) > 0;
    const color = g.overdriveActive ? COLORS.overdrive : g.pilot.color;
    const angle = Math.atan2(g.moveDirY, g.moveDirX);

    ctx.globalCompositeOperation = 'lighter';
    this.drawGlow(g.px, g.py, 34, color, g.overdriveActive ? 0.75 : 0.45);
    if (!g.overdriveActive && g.overdrive > 2) {
      ctx.strokeStyle = COLORS.overdrive;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 24, -Math.PI / 2, -Math.PI / 2 + TAU * (g.overdrive / 100));
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (g.overdriveActive) {
      const pulse = 1 + Math.sin(time * 10) * 0.12;
      ctx.strokeStyle = COLORS.overdrive;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 27 * pulse, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    // Aegis shield
    if (g.reflectTimer > 0) {
      const pulse = 1 + Math.sin(time * 12) * 0.08;
      ctx.strokeStyle = '#ff9f45';
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 24 * pulse, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';

    if (!blink) {
      ctx.save();
      ctx.translate(g.px, g.py);
      ctx.rotate(angle);
      const r = g.playerRadius;
      ctx.fillStyle = '#0a1220';
      ctx.strokeStyle = color;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(r * 1.35, 0);
      ctx.lineTo(-r * 0.9, r * 0.95);
      ctx.lineTo(-r * 0.45, 0);
      ctx.lineTo(-r * 0.9, -r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = COLORS.playerCore;
      ctx.beginPath();
      ctx.arc(r * 0.2, 0, 3, 0, TAU);
      ctx.fill();
      ctx.restore();

      const moving = g.input.moveX !== 0 || g.input.moveY !== 0 || g.dashTimer > 0;
      if (moving) {
        ctx.globalCompositeOperation = 'lighter';
        const flick = 6 + Math.sin(time * 50) * 3;
        this.drawGlow(
          g.px - Math.cos(angle) * (g.playerRadius + 4),
          g.py - Math.sin(angle) * (g.playerRadius + 4),
          flick, color, 0.8,
        );
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    if (g.invuln > 1 && g.reflectTimer <= 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 22 + Math.sin(time * 8) * 2, 0, TAU);
      ctx.stroke();
    }
  }

  private drawBlades(g: Game): void {
    const geo = bladeGeometry(g);
    if (!geo) return;
    const ctx = this.ctx;
    const color = WEAPONS[WeaponId.Blades].color;
    ctx.globalCompositeOperation = 'lighter';
    if (geo.evolved) {
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = (158 - 92) * g.stats.areaMult;
      ctx.beginPath();
      ctx.arc(g.px, g.py, 125 * g.stats.areaMult, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#ffffff';
      for (let k = 0; k < 12; k++) {
        const a = geo.angle * 1.6 + (k / 12) * TAU;
        const r1 = 105 * g.stats.areaMult;
        const r2 = 145 * g.stats.areaMult;
        ctx.beginPath();
        ctx.moveTo(g.px + Math.cos(a) * r1, g.py + Math.sin(a) * r1);
        ctx.lineTo(g.px + Math.cos(a + 0.12) * r2, g.py + Math.sin(a + 0.12) * r2);
        ctx.stroke();
      }
    } else {
      for (let b = 0; b < geo.n; b++) {
        const a = geo.angle + (b / geo.n) * TAU;
        const bx = g.px + Math.cos(a) * geo.orbit;
        const by = g.py + Math.sin(a) * geo.orbit;
        this.drawGlow(bx, by, 16, color, 0.6);
        ctx.save();
        ctx.translate(bx, by);
        ctx.rotate(a * 3);
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(0, 4);
        ctx.lineTo(-10, 0);
        ctx.lineTo(0, -4);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawProjectiles(g: Game, time: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < g.projectiles.count; i++) {
      const p = g.projectiles.items[i];
      const color = WEAPONS[p.kind]?.color ?? '#ffffff';
      const a = Math.atan2(p.vy, p.vx);
      switch (p.kind) {
        case WeaponId.Glaive: {
          this.drawGlow(p.x, p.y, p.radius * 2.2, color, 0.55);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(time * 16 + p.seed * 6);
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-p.radius, 0);
          ctx.lineTo(p.radius, 0);
          ctx.moveTo(0, -p.radius);
          ctx.lineTo(0, p.radius);
          ctx.stroke();
          ctx.restore();
          break;
        }
        case WeaponId.Mines: {
          const armed = p.hitCd <= 0;
          const blink = armed && Math.sin(time * 10 + p.seed * 9) > 0.4;
          this.drawGlow(p.x, p.y, 12, color, blink ? 0.8 : 0.3);
          ctx.fillStyle = blink ? '#ffffff' : color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 5, 0, TAU);
          ctx.fill();
          break;
        }
        case WeaponId.Void: {
          this.drawGlow(p.x, p.y, p.radius * 2.6, color, 0.5);
          ctx.fillStyle = '#0a0614';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius, 0, TAU);
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          // swirl
          ctx.strokeStyle = 'rgba(255,255,255,0.6)';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.55, time * 5 % TAU, (time * 5 + 2) % TAU);
          ctx.stroke();
          break;
        }
        case WeaponId.Cryo: {
          this.drawGlow(p.x, p.y, 9, color, 0.5);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(a);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(6, 0);
          ctx.lineTo(0, 3);
          ctx.lineTo(-6, 0);
          ctx.lineTo(0, -3);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        case WeaponId.Acid: {
          this.drawGlow(p.x, p.y, 12, color, 0.6);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.radius * 0.8 + Math.sin(time * 18) * 1.2, 0, TAU);
          ctx.fill();
          break;
        }
        case WeaponId.Swarm: {
          this.drawGlow(p.x, p.y, p.radius * 3, color, 0.55);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(a);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.moveTo(p.radius + 4, 0);
          ctx.lineTo(-p.radius, p.radius * 0.7);
          ctx.lineTo(-p.radius, -p.radius * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        }
        default: {
          this.drawGlow(p.x, p.y, p.radius * 3, color, 0.55);
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(a);
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 2.2, p.radius * 0.75, 0, 0, TAU);
          ctx.fill();
          ctx.restore();
        }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBeams(g: Game): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.beams) {
      const t = b.life / b.maxLife;
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.angle);
      ctx.globalAlpha = t;
      ctx.fillStyle = b.color;
      ctx.fillRect(0, -b.width / 2, b.len, b.width);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, -b.width * 0.18, b.len, b.width * 0.36);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawBolts(g: Game): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (const b of g.bolts) {
      ctx.strokeStyle = b.color;
      ctx.lineWidth = 2;
      ctx.globalAlpha = clamp(b.life / 0.16, 0, 1);
      const dx = b.x2 - b.x1;
      const dy = b.y2 - b.y1;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      const segs = 5;
      for (let s = 1; s < segs; s++) {
        const t = s / segs;
        const off = (Math.random() - 0.5) * 18;
        ctx.lineTo(b.x1 + dx * t - dy * off * 0.02, b.y1 + dy * t + dx * off * 0.02);
      }
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawEnemyBullets(g: Game, time: number): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < g.enemyBullets.count; i++) {
      const b = g.enemyBullets.items[i];
      const pulse = 1 + Math.sin(time * 12 + b.hue * 6) * 0.15;
      this.drawGlow(b.x, b.y, b.radius * 2.8 * pulse, COLORS.bullet, 0.7);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius * 0.55, 0, TAU);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawParticles(g: Game): void {
    const ctx = this.ctx;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < g.particles.count; i++) {
      const p = g.particles.items[i];
      const t = p.life / p.maxLife;
      const color = PALETTE[p.color] ?? '#ffffff';
      switch (p.kind) {
        case ParticleKind.Spark:
          ctx.globalAlpha = t;
          ctx.fillStyle = color;
          ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
          break;
        case ParticleKind.Orb:
          this.drawGlow(p.x, p.y, p.size * (2 - t), color, t * 0.6);
          break;
        case ParticleKind.Ring:
          ctx.globalAlpha = t * 0.8;
          ctx.strokeStyle = color;
          ctx.lineWidth = 3 * t + 1;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.3 - t * 0.3) * (1 - t * 0.9 + 0.9), 0, TAU);
          ctx.stroke();
          break;
        case ParticleKind.Ghost: {
          ctx.globalAlpha = t * 0.5;
          ctx.strokeStyle = color;
          ctx.lineWidth = 2;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          const r = p.size;
          ctx.beginPath();
          ctx.moveTo(r * 1.35, 0);
          ctx.lineTo(-r * 0.9, r * 0.95);
          ctx.lineTo(-r * 0.45, 0);
          ctx.lineTo(-r * 0.9, -r * 0.95);
          ctx.closePath();
          ctx.stroke();
          ctx.restore();
          break;
        }
        case ParticleKind.Shard:
          ctx.globalAlpha = t;
          ctx.fillStyle = color;
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.beginPath();
          ctx.moveTo(p.size, 0);
          ctx.lineTo(-p.size, p.size * 0.7);
          ctx.lineTo(-p.size * 0.4, -p.size * 0.7);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        case ParticleKind.Line: {
          ctx.globalAlpha = t * 0.8;
          ctx.strokeStyle = color;
          ctx.lineWidth = p.size;
          const vlen = Math.hypot(p.vx, p.vy) * 0.06;
          const va = Math.atan2(p.vy, p.vx);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x + Math.cos(va) * vlen, p.y + Math.sin(va) * vlen);
          ctx.stroke();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  private drawDamageNumbers(g: Game): void {
    const ctx = this.ctx;
    ctx.textAlign = 'center';
    for (let i = 0; i < g.dmgNumbers.count; i++) {
      const n = g.dmgNumbers.items[i];
      const t = clamp(n.life / 0.55, 0, 1);
      ctx.globalAlpha = t;
      if (n.crit) {
        ctx.font = '700 17px system-ui, sans-serif';
        ctx.fillStyle = '#ffd75e';
      } else {
        ctx.font = '600 12px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(220,235,255,0.9)';
      }
      ctx.fillText(String(n.value), n.x, n.y);
    }
    ctx.globalAlpha = 1;
  }

  private drawOverlays(g: Game, time: number): void {
    const ctx = this.ctx;
    const w = this.w;
    const h = this.h;

    const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, w, h);

    const hpFrac = g.hp / g.stats.maxHp;
    if (hpFrac < 0.35 && g.phase === 'run') {
      const a = (0.35 - hpFrac) * (0.9 + 0.5 * Math.sin(time * 6)) * 0.9;
      const rg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      rg.addColorStop(0, 'rgba(255,40,70,0)');
      rg.addColorStop(1, `rgba(255,40,70,${clamp(a, 0, 0.5)})`);
      ctx.fillStyle = rg;
      ctx.fillRect(0, 0, w, h);
    }

    if (g.screenFlash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${g.screenFlash * 0.28})`;
      ctx.fillRect(0, 0, w, h);
    }

    if (g.overdriveActive) {
      const a = 0.12 + 0.06 * Math.sin(time * 9);
      const og = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.72);
      og.addColorStop(0, 'rgba(255,215,94,0)');
      og.addColorStop(1, `rgba(255,190,60,${a})`);
      ctx.fillStyle = og;
      ctx.fillRect(0, 0, w, h);
    }

    // bullet time tint
    if (g.bulletTime > 0) {
      const a = Math.min(0.14, g.bulletTime * 0.1);
      ctx.fillStyle = `rgba(120,180,255,${a})`;
      ctx.fillRect(0, 0, w, h);
    }
  }

  private drawJoystick(g: Game): void {
    const inp = g.input;
    if (!inp.joyActive || g.phase !== 'run') return;
    const ctx = this.ctx;
    ctx.strokeStyle = 'rgba(120,200,255,0.25)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(inp.joyAnchorX, inp.joyAnchorY, 46, 0, TAU);
    ctx.stroke();
    ctx.fillStyle = 'rgba(120,200,255,0.3)';
    ctx.beginPath();
    ctx.arc(inp.joyStickX, inp.joyStickY, 22, 0, TAU);
    ctx.fill();
  }
}
