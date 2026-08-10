// Generic object pool with swap-remove iteration.
// Active objects live in [0, count). Release swaps to the tail — never
// releases mid-iteration except via releaseAt(i) which is iteration-safe
// when looping backwards, or when the caller re-checks index i.

export class Pool<T> {
  items: T[] = [];
  count = 0;
  private factory: () => T;
  private capacity: number;

  constructor(factory: () => T, capacity: number) {
    this.factory = factory;
    this.capacity = capacity;
  }

  /** Get a slot, or null when at capacity. */
  spawn(): T | null {
    if (this.count >= this.capacity) return null;
    if (this.count === this.items.length) this.items.push(this.factory());
    return this.items[this.count++];
  }

  /** Like spawn, but recycles the oldest slot when full (for particles). */
  spawnOrRecycle(): T {
    const s = this.spawn();
    if (s) return s;
    // Recycle slot 0: swap it to the tail-1 position and reuse.
    const oldest = this.items[0];
    this.items[0] = this.items[this.count - 1];
    this.items[this.count - 1] = oldest;
    return oldest;
  }

  /** Remove item at index i (swap with last active). Safe in backward loops. */
  releaseAt(i: number): void {
    this.count--;
    const tmp = this.items[i];
    this.items[i] = this.items[this.count];
    this.items[this.count] = tmp;
  }

  clear(): void {
    this.count = 0;
  }
}
