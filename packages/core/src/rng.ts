import type { RNG } from "./types";

/**
 * Сидируемый mulberry32 — быстрый, достаточно хороший для геймплейной симуляции.
 * Не криптографический. Детерминированный при одинаковом seed.
 */
export function createRng(seed: number): RNG {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const int = (min: number, maxExclusive: number): number => {
    return min + Math.floor(next() * (maxExclusive - min));
  };

  const pick = <T>(arr: readonly T[]): T => {
    if (arr.length === 0) throw new Error("Cannot pick from empty array");
    return arr[int(0, arr.length)]!;
  };

  const pickMaybe = <T>(arr: readonly T[]): T | undefined => {
    if (arr.length === 0) return undefined;
    return arr[int(0, arr.length)];
  };

  const sample = <T>(arr: readonly T[], n: number): T[] => {
    const copy = arr.slice();
    const out: T[] = [];
    const take = Math.min(n, copy.length);
    for (let i = 0; i < take; i++) {
      const idx = int(0, copy.length);
      out.push(copy[idx]!);
      copy.splice(idx, 1);
    }
    return out;
  };

  const shuffle = <T>(arr: readonly T[]): T[] => {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = int(0, i + 1);
      const tmp = out[i]!;
      out[i] = out[j]!;
      out[j] = tmp;
    }
    return out;
  };

  const bool = (p = 0.5): boolean => next() < p;

  return { next, int, pick, pickMaybe, sample, shuffle, bool, seed };
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}
