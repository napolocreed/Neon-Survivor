// One-thumb mobile controls + keyboard.
// - Hold & drag anywhere: floating joystick (re-anchoring when pulled past max).
// - Quick tap (any finger, incl. a second finger while steering): DASH.
// - Keyboard: WASD / arrows to move, Space or Shift to dash.

import { clamp } from './math';

const JOY_MAX = 56; // px from anchor for full speed
const TAP_TIME = 220; // ms
const TAP_DIST = 18; // px

interface TouchInfo {
  id: number;
  startX: number;
  startY: number;
  startTime: number;
  moved: boolean;
}

export class Input {
  // Normalized movement vector, magnitude 0..1
  moveX = 0;
  moveY = 0;
  /** Set true for one frame-consumer when a dash is requested. */
  private dashQueued = false;

  // Joystick visual state (screen px)
  joyActive = false;
  joyAnchorX = 0;
  joyAnchorY = 0;
  joyStickX = 0;
  joyStickY = 0;

  usedTouch = false;

  private keys = new Set<string>();
  private steerTouch: TouchInfo | null = null;
  private taps = new Map<number, TouchInfo>();
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    el.addEventListener('touchstart', this.onTouchStart, { passive: false });
    el.addEventListener('touchmove', this.onTouchMove, { passive: false });
    el.addEventListener('touchend', this.onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
  }

  destroy(): void {
    this.el.removeEventListener('touchstart', this.onTouchStart);
    this.el.removeEventListener('touchmove', this.onTouchMove);
    this.el.removeEventListener('touchend', this.onTouchEnd);
    this.el.removeEventListener('touchcancel', this.onTouchEnd);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
  }

  consumeDash(): boolean {
    const d = this.dashQueued;
    this.dashQueued = false;
    return d;
  }

  reset(): void {
    this.moveX = 0;
    this.moveY = 0;
    this.dashQueued = false;
    this.joyActive = false;
    this.steerTouch = null;
    this.taps.clear();
    this.keys.clear();
  }

  update(): void {
    if (this.steerTouch) return; // touch steering owns the vector
    let x = 0;
    let y = 0;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) x += 1;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) y -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) y += 1;
    const m = Math.hypot(x, y);
    if (m > 0) {
      this.moveX = x / m;
      this.moveY = y / m;
    } else {
      this.moveX = 0;
      this.moveY = 0;
    }
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
      if (!e.repeat) this.dashQueued = true;
      e.preventDefault();
      return;
    }
    this.keys.add(e.code);
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  private onTouchStart = (e: TouchEvent): void => {
    // let UI buttons receive their clicks untouched
    if (e.target instanceof Element && e.target.closest('#ui, .hud-pause')) return;
    e.preventDefault();
    this.usedTouch = true;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const info: TouchInfo = {
        id: t.identifier,
        startX: t.clientX,
        startY: t.clientY,
        startTime: performance.now(),
        moved: false,
      };
      this.taps.set(t.identifier, info);
      if (!this.steerTouch) {
        this.steerTouch = info;
        this.joyAnchorX = t.clientX;
        this.joyAnchorY = t.clientY;
        this.joyStickX = t.clientX;
        this.joyStickY = t.clientY;
      }
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    if (!this.tracksAny(e)) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const info = this.taps.get(t.identifier);
      if (!info) continue;
      const dxs = t.clientX - info.startX;
      const dys = t.clientY - info.startY;
      if (dxs * dxs + dys * dys > TAP_DIST * TAP_DIST) info.moved = true;

      if (this.steerTouch && t.identifier === this.steerTouch.id) {
        let dx = t.clientX - this.joyAnchorX;
        let dy = t.clientY - this.joyAnchorY;
        const d = Math.hypot(dx, dy);
        if (d > JOY_MAX) {
          // drag anchor along so direction changes feel instant
          const excess = d - JOY_MAX;
          this.joyAnchorX += (dx / d) * excess;
          this.joyAnchorY += (dy / d) * excess;
          dx = t.clientX - this.joyAnchorX;
          dy = t.clientY - this.joyAnchorY;
        }
        this.joyStickX = t.clientX;
        this.joyStickY = t.clientY;
        this.joyActive = info.moved;
        const mag = clamp(Math.hypot(dx, dy) / JOY_MAX, 0, 1);
        if (mag > 0.01) {
          const dd = Math.hypot(dx, dy) || 1;
          this.moveX = (dx / dd) * mag;
          this.moveY = (dy / dd) * mag;
        } else {
          this.moveX = 0;
          this.moveY = 0;
        }
      }
    }
  };

  private tracksAny(e: TouchEvent): boolean {
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (this.taps.has(e.changedTouches[i].identifier)) return true;
    }
    return false;
  }

  private onTouchEnd = (e: TouchEvent): void => {
    if (!this.tracksAny(e)) return;
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const info = this.taps.get(t.identifier);
      if (!info) continue;
      this.taps.delete(t.identifier);
      const quick = performance.now() - info.startTime < TAP_TIME && !info.moved;
      if (quick) this.dashQueued = true;
      if (this.steerTouch && t.identifier === this.steerTouch.id) {
        this.steerTouch = null;
        this.joyActive = false;
        this.moveX = 0;
        this.moveY = 0;
      }
    }
  };
}
