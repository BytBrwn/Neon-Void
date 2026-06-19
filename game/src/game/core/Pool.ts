/**
 * Fixed-capacity object pool.
 *
 * All slots are pre-allocated at construction — zero heap allocation after
 * init. This eliminates GC pauses from bullet/particle bursts during gameplay
 * and lets ML rollouts run without GC interference.
 *
 * Two removal strategies:
 *   compact(dead) — write-cursor compaction, preserves relative order
 *   removeAt(i)   — O(1) swap-with-last, does NOT preserve order (use for enemies)
 *
 * When capacity is reached, next() ring-overwrites the oldest slot (bullets,
 * particles). For enemies use a large enough capacity that this never triggers.
 */
export class Pool<T> {
  readonly buf: T[];
  count = 0;
  private ring = 0;

  constructor(readonly capacity: number, create: () => T) {
    this.buf = Array.from({ length: capacity }, create);
  }

  /**
   * Returns a pre-allocated slot to be initialized by the caller.
   * Ring-overwrites oldest entry when at capacity.
   */
  next(): T {
    if (this.count < this.capacity) {
      return this.buf[this.count++];
    }
    return this.buf[this.ring++ % this.capacity];
  }

  /**
   * O(1) removal — swaps the target slot with the last active slot and
   * decrements count. Does NOT preserve insertion order.
   */
  removeAt(i: number): void {
    const last = --this.count;
    if (i !== last) {
      const tmp = this.buf[i];
      this.buf[i] = this.buf[last];
      this.buf[last] = tmp;
    }
  }

  /** Linear scan for reference equality. O(n) but n is small for enemies. */
  indexOf(item: T): number {
    for (let i = 0; i < this.count; i++) {
      if (this.buf[i] === item) return i;
    }
    return -1;
  }

  /**
   * Write-cursor compaction — removes dead items while preserving order of
   * survivors. Use for bullets and particles where order matters for rendering.
   */
  compact(dead: (item: T) => boolean): void {
    let w = 0;
    for (let r = 0; r < this.count; r++) {
      if (!dead(this.buf[r])) {
        if (w !== r) {
          const tmp = this.buf[w];
          this.buf[w] = this.buf[r];
          this.buf[r] = tmp;
        }
        w++;
      }
    }
    this.count = w;
  }

  /** Deactivate all slots without deallocating. */
  reset(): void {
    this.count = 0;
    this.ring = 0;
  }

  [Symbol.iterator](): Iterator<T> {
    let i = 0;
    const { buf } = this;
    const { count } = this;
    return {
      next(): IteratorResult<T> {
        return i < count
          ? { value: buf[i++], done: false }
          : { value: undefined as never, done: true };
      },
    };
  }
}
