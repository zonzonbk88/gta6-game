// A tiny seeded random generator (mulberry32) plus helpers.
// The world is built from a fixed seed so every visit — and every screenshot
// scene — lays the same city out the same way.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Rng {
  constructor(seed) {
    this.next = mulberry32(seed);
  }
  /** Float in [min, max). */
  range(min, max) {
    return min + this.next() * (max - min);
  }
  /** Integer in [min, max], both ends included. */
  int(min, max) {
    return Math.floor(this.range(min, max + 1));
  }
  pick(list) {
    return list[Math.floor(this.next() * list.length) % list.length];
  }
  chance(p) {
    return this.next() < p;
  }
  /** Shuffle a copy of a list. */
  shuffled(list) {
    const out = list.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out;
  }
}
