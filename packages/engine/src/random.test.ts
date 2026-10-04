import { describe, expect, it } from 'vitest';
import { validatePlacement } from './placement.js';
import { randomFleet } from './random.js';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

describe('randomFleet', () => {
  it('always produces a valid fleet', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(validatePlacement(randomFleet(seeded(seed)))).toEqual({ ok: true });
    }
  });

  it('is reproducible for the same random source', () => {
    expect(randomFleet(seeded(7))).toEqual(randomFleet(seeded(7)));
  });
});
