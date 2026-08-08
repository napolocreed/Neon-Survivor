// Spatial hash over integer cell keys — no string allocation in the hot path.
// Rebuilt every frame; queries collect into a shared scratch array.

export interface Positioned {
  x: number;
  y: number;
  radius: number;
}

const OFFSET = 32768; // supports coords within ±cellSize*32768

export class SpatialHash<T extends Positioned> {
  private cellSize: number;
  private cells = new Map<number, T[]>();
  private scratch: T[] = [];

  constructor(cellSize: number) {
    this.cellSize = cellSize;
  }

  clear(): void {
    for (const arr of this.cells.values()) arr.length = 0;
  }

  insert(e: T): void {
    const key = this.keyFor(e.x, e.y);
    let cell = this.cells.get(key);
    if (!cell) {
      cell = [];
      this.cells.set(key, cell);
    }
    cell.push(e);
  }

  private keyFor(x: number, y: number): number {
    const cx = Math.floor(x / this.cellSize) + OFFSET;
    const cy = Math.floor(y / this.cellSize) + OFFSET;
    return cx * 65536 + cy;
  }

  /** Returns a shared scratch array — consume immediately, do not hold. */
  query(x: number, y: number, r: number): T[] {
    const out = this.scratch;
    out.length = 0;
    const cs = this.cellSize;
    const x0 = Math.floor((x - r) / cs) + OFFSET;
    const x1 = Math.floor((x + r) / cs) + OFFSET;
    const y0 = Math.floor((y - r) / cs) + OFFSET;
    const y1 = Math.floor((y + r) / cs) + OFFSET;
    for (let cx = x0; cx <= x1; cx++) {
      for (let cy = y0; cy <= y1; cy++) {
        const cell = this.cells.get(cx * 65536 + cy);
        if (cell) {
          for (let i = 0; i < cell.length; i++) out.push(cell[i]);
        }
      }
    }
    return out;
  }
}
