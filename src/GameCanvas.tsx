import React, { useEffect, useRef, useState } from 'react';
import { GameState } from './types';
import { updateGame } from './gameEngine';
import { updateMusic } from './audio';

interface GameCanvasProps {
  gameStateRef: React.MutableRefObject<GameState>;
  onStateUpdate: () => void;
  isPaused: boolean;
}

export default function GameCanvas({ gameStateRef, onStateUpdate, isPaused }: GameCanvasProps) {
  const isPausedRef = useRef(isPaused);
  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const requestRef = useRef<number>();
  const lastUiUpdateRef = useRef<number>(0);
  const onStateUpdateRef = useRef(onStateUpdate);
  
  useEffect(() => {
    onStateUpdateRef.current = onStateUpdate;
  }, [onStateUpdate]);
  
  // Virtual Joystick State (Internal to Canvas for performance)
  const joyOriginRef = useRef<{x: number, y: number} | null>(null);
  const joyCurrentRef = useRef<{x: number, y: number} | null>(null);
  const joystickDirRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    // Dynamic resize observer for crisp mobile rendering
    const handleResize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const draw = (ctx: CanvasRenderingContext2D, state: GameState, cw: number, ch: number) => {
    // Clear background
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, cw, ch);

    ctx.save();
    
    // Screen Shake
    const shakeX = (Math.random() - 0.5) * state.shakeIntensity;
    const shakeY = (Math.random() - 0.5) * state.shakeIntensity;
    
    // Camera follow player (center screen)
    ctx.translate(cw/2, ch/2);
    ctx.scale(state.zoom, state.zoom);
    ctx.translate(-state.cameraPos.x + shakeX, -state.cameraPos.y + shakeY);

    // --- WORLD SPACE DRAWING ---

    // Draw Infinite Grid
    const invZoom = 1 / state.zoom;
    const startX = state.playerPos.x - (cw/2 * invZoom) - 50;
    const endX = state.playerPos.x + (cw/2 * invZoom) + 50;
    const startY = state.playerPos.y - (ch/2 * invZoom) - 50;
    const endY = state.playerPos.y + (ch/2 * invZoom) + 50;

    const offsetX = startX - (startX % 50);
    const offsetY = startY - (startY % 50);

    ctx.strokeStyle = '#1e293b'; // slate-800
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = offsetX; x <= endX; x += 50) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = offsetY; y <= endY; y += 50) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Draw Arena Bounds if Locked
    if (state.isArenaLocked && state.arenaCenter) {
      ctx.beginPath();
      ctx.arc(state.arenaCenter.x, state.arenaCenter.y, state.arenaRadius, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 10;
      ctx.shadowBlur = 30;
      ctx.shadowColor = '#ef4444';
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(state.arenaCenter.x, state.arenaCenter.y, state.arenaRadius + 5, 0, Math.PI * 2);
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fca5a5';
      ctx.stroke();
      
      // Reset shadow for next items
      ctx.shadowBlur = 0;
    }

    // Draw Drops
    state.drops.forEach(drop => {
      ctx.shadowBlur = 20;
      ctx.beginPath();
      if (drop.type === 'chest') {
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.shadowColor = '#fbbf24';
        ctx.fillRect(drop.pos.x - 12, drop.pos.y - 10, 24, 20);
        ctx.fillStyle = '#b45309';
        ctx.fillRect(drop.pos.x - 4, drop.pos.y - 2, 8, 4); // lock
      } else if (drop.type === 'nuke') {
        ctx.fillStyle = '#ef4444'; // Red
        ctx.shadowColor = '#ef4444';
        ctx.arc(drop.pos.x, drop.pos.y, drop.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#fca5a5';
        ctx.fillText("N", drop.pos.x - 4, drop.pos.y + 4);
      } else if (drop.type === 'vacuum') {
        ctx.fillStyle = '#3b82f6'; // Blue
        ctx.shadowColor = '#3b82f6';
        ctx.moveTo(drop.pos.x, drop.pos.y - drop.radius);
        ctx.lineTo(drop.pos.x + drop.radius, drop.pos.y + drop.radius);
        ctx.lineTo(drop.pos.x - drop.radius, drop.pos.y + drop.radius);
        ctx.fill();
        ctx.fillStyle = '#bfdbfe';
        ctx.fillText("V", drop.pos.x - 4, drop.pos.y + 6);
      }
      ctx.shadowBlur = 0;
    });

    // Draw XP Gems
    state.gems.forEach(gem => {
      ctx.fillStyle = gem.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = gem.color;
      ctx.beginPath();
      // Draw diamond shape
      ctx.moveTo(gem.pos.x, gem.pos.y - 4);
      ctx.lineTo(gem.pos.x + 4, gem.pos.y);
      ctx.lineTo(gem.pos.x, gem.pos.y + 4);
      ctx.lineTo(gem.pos.x - 4, gem.pos.y);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Particles
    state.particles.forEach(p => {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      if (p.type === 'text') {
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text || '', p.pos.x, p.pos.y);
      } else if (p.type === 'lightning' && p.targetPos) {
        ctx.strokeStyle = p.color;
        ctx.lineWidth = p.size;
        ctx.shadowBlur = 10;
        ctx.shadowColor = p.color;
        ctx.beginPath();
        ctx.moveTo(p.pos.x, p.pos.y);
        // Add a jagged middle point
        const midX = (p.pos.x + p.targetPos.x) / 2 + (Math.random() - 0.5) * 40;
        const midY = (p.pos.y + p.targetPos.y) / 2 + (Math.random() - 0.5) * 40;
        ctx.lineTo(midX, midY);
        ctx.lineTo(p.targetPos.x, p.targetPos.y);
        ctx.stroke();
        ctx.shadowBlur = 0;
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.pos.x, p.pos.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        
        if (p.type === 'explosion') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = p.color;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
      }
      ctx.globalAlpha = 1.0;
    });

    // Draw Mines
    state.mines.forEach(m => {
      ctx.fillStyle = m.triggered ? '#fbbf24' : '#ef4444';
      const pulseSpeed = m.triggered ? 50 : 200;
      ctx.globalAlpha = 0.5 + Math.sin(Date.now() / pulseSpeed) * 0.3; // Pulsing effect
      ctx.beginPath();
      ctx.arc(m.pos.x, m.pos.y, m.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // Core
      ctx.globalAlpha = 1.0;
      ctx.fillStyle = m.triggered ? '#ffffff' : '#facc15';
      ctx.beginPath();
      ctx.arc(m.pos.x, m.pos.y, m.triggered ? 8 : 6, 0, Math.PI * 2);
      ctx.fill();

      // Show blast radius faintly if triggered
      if (m.triggered) {
          ctx.strokeStyle = '#ef4444';
          ctx.globalAlpha = 0.2;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(m.pos.x, m.pos.y, m.radius * 3.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1.0;
      }
    });

    // Draw Turrets
    state.turrets.forEach(t => {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(t.pos.x - 10, t.pos.y - 10, 20, 20);
      
      // Turret eye
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(t.pos.x, t.pos.y, 4, 0, Math.PI * 2);
      ctx.fill();
      
      // Health/Life bar
      const lifePercent = Math.max(0, t.life / 20);
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(t.pos.x - 10, t.pos.y - 15, 20 * lifePercent, 3);
    });

    // Draw Enemies
    state.enemies.forEach(e => {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius, 0, Math.PI * 2);
      ctx.fill();

      // Inner shape for depth
      ctx.fillStyle = '#00000066';
      ctx.beginPath();
      ctx.arc(e.pos.x, e.pos.y, e.radius * 0.6, 0, Math.PI * 2);
      ctx.fill();

      // Health bar (only if damaged)
      if (e.hp < e.maxHp) {
        const hpPercent = Math.max(0, e.hp / e.maxHp);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(e.pos.x - e.radius, e.pos.y - e.radius - 10, e.radius * 2, 4);
        ctx.fillStyle = '#22c55e';
        ctx.fillRect(e.pos.x - e.radius, e.pos.y - e.radius - 10, e.radius * 2 * hpPercent, 4);
      }
    });

    // Draw Projectiles
    state.projectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 12;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    state.enemyProjectiles.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.shadowBlur = 15;
      ctx.shadowColor = p.color;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
      
      // core
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.radius * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });

    // Draw Magnet Radius (subtle)
    ctx.strokeStyle = '#38bdf811';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(state.playerPos.x, state.playerPos.y, state.playerStats.magnetRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw Orbitals
    if (state.playerStats.orbitals > 0) {
      const orbitalSpeed = 3;
      const orbitalRadius = 70;
      ctx.fillStyle = '#a855f7'; // purple
      ctx.shadowBlur = 15;
      ctx.shadowColor = '#a855f7';
      for (let i = 0; i < state.playerStats.orbitals; i++) {
         const angle = state.time * orbitalSpeed + (Math.PI * 2 / state.playerStats.orbitals) * i;
         const ox = state.playerPos.x + Math.cos(angle) * orbitalRadius;
         const oy = state.playerPos.y + Math.sin(angle) * orbitalRadius;
         
         ctx.beginPath();
         ctx.arc(ox, oy, 6, 0, Math.PI * 2);
         ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    // Draw Player
    ctx.save();
    ctx.translate(state.playerPos.x, state.playerPos.y);
    ctx.rotate(state.playerAngle + Math.PI / 2);

    ctx.fillStyle = state.playerStats.color || '#38bdf8'; // chassis color
    ctx.shadowBlur = 20;
    ctx.shadowColor = state.playerStats.color || '#38bdf8';
    ctx.beginPath();
    // Sleek triangular core shape
    ctx.moveTo(0, -18);
    ctx.lineTo(14, 12);
    ctx.lineTo(-14, 12);
    ctx.closePath();
    ctx.fill();
    
    // Core center
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 2, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // --- END WORLD SPACE ---
    ctx.restore();

    // --- SCREEN SPACE UI ---
    
    // Overdrive Vignette Effect
    if (state.isOverdrive) {
      const gradient = ctx.createRadialGradient(
        cw / 2, ch / 2, ch * 0.2,
        cw / 2, ch / 2, ch * 0.8
      );
      // Pulsing effect based on time
      const pulse = (Math.sin(state.time * 15) + 1) / 2; // 0 to 1
      const alpha = (0.1 + pulse * 0.15).toFixed(3);
      gradient.addColorStop(0, 'rgba(250, 204, 21, 0)');
      gradient.addColorStop(1, `rgba(250, 204, 21, ${alpha})`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, cw, ch);
    }
    
    // Draw Virtual Joystick
    if (joyOriginRef.current && joyCurrentRef.current) {
       const origin = joyOriginRef.current;
       const current = joyCurrentRef.current;
       
       // Outer Base
       ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
       ctx.lineWidth = 2;
       ctx.beginPath();
       ctx.arc(origin.x, origin.y, 50, 0, Math.PI * 2);
       ctx.stroke();
       ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
       ctx.fill();

       // Clamped Inner Knob
       let dx = current.x - origin.x;
       let dy = current.y - origin.y;
       const dist = Math.hypot(dx, dy);
       if (dist > 50) {
           dx = (dx / dist) * 50;
           dy = (dy / dist) * 50;
       }
       
       ctx.fillStyle = 'rgba(56, 189, 248, 0.6)'; // cyan-400
       ctx.shadowBlur = 15;
       ctx.shadowColor = 'rgba(56, 189, 248, 0.5)';
       ctx.beginPath();
       ctx.arc(origin.x + dx, origin.y + dy, 25, 0, Math.PI * 2);
       ctx.fill();
       ctx.shadowBlur = 0;
    }
  };

  const loop = (time: number) => {
    const dt = (time - lastTimeRef.current) / 1000;
    lastTimeRef.current = time;

    // Cap dt to prevent huge jumps
    const safeDt = Math.min(dt, 0.1);

    const state = gameStateRef.current;
    
    const wasLevelingUp = state.isLevelingUp;
    const wasGameOver = state.isGameOver;

    if (!state.isGameOver && !state.isLevelingUp && !isPausedRef.current) {
      updateGame(state, safeDt, joystickDirRef.current);
      updateMusic(state.time, state.isOverdrive);
    }
      
    const needsImmediateUpdate = 
      (state.isLevelingUp && !wasLevelingUp) || 
      (state.isGameOver && !wasGameOver);

    // Throttle UI React state updates (~10fps) unless a critical event happened
    if (needsImmediateUpdate || time - lastUiUpdateRef.current > 100) {
      lastUiUpdateRef.current = time;
      onStateUpdateRef.current();
    }

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        draw(ctx, state, canvas.width, canvas.height);
      }
    }

    requestRef.current = requestAnimationFrame(loop);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(loop);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, []);

  // Pointer Event Handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    joyOriginRef.current = { x, y };
    joyCurrentRef.current = { x, y };
    joystickDirRef.current = { x: 0, y: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!joyOriginRef.current) return;
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    joyCurrentRef.current = { x, y };

    let dx = x - joyOriginRef.current.x;
    let dy = y - joyOriginRef.current.y;
    const dist = Math.hypot(dx, dy);
    const maxRadius = 50;
    
    if (dist > 0) {
      joystickDirRef.current = { 
        x: (dx / dist) * Math.min(dist / maxRadius, 1), 
        y: (dy / dist) * Math.min(dist / maxRadius, 1) 
      };
    }
  };

  const handlePointerUp = () => {
    joyOriginRef.current = null;
    joyCurrentRef.current = null;
    joystickDirRef.current = { x: 0, y: 0 };
  };

  return (
    <div ref={containerRef} className="w-full h-full relative overflow-hidden bg-slate-950">
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onPointerLeave={handlePointerUp}
        className="w-full h-full touch-none select-none outline-none"
        style={{ touchAction: 'none' }}
      />
    </div>
  );
}
