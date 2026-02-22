// Mulberry32 – fast, deterministic 32-bit PRNG
export function createRng(seed: number) {
  let s = seed | 0;
  function next(): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  /** uniform [min, max) */
  function range(min: number, max: number) {
    return min + next() * (max - min);
  }
  /** normal-ish via Box-Muller lite */
  function normal(mean = 0, std = 1) {
    const u1 = next() || 0.0001;
    const u2 = next();
    return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  /** pick from weighted array */
  function weightedPick<T extends { weight: number }>(items: T[]): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = next() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return item;
    }
    return items[items.length - 1];
  }
  return { next, range, normal, weightedPick, getSeed: () => s };
}

export type Rng = ReturnType<typeof createRng>;
