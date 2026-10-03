import { describe, expect, it } from 'vitest';
import { validatePlacement } from '@pixelfleet/engine';
import type { PlacedShip } from '@pixelfleet/engine';
import { isComplete, nextUnplaced, placeShip, randomFleet, without } from './draft';

/** Простий детермінований генератор, щоб тести не залежали від Math.random. */
function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const destroyer = (x: number, y: number): PlacedShip => ({
  type: 'destroyer',
  origin: { x, y },
  orientation: 'horizontal',
});

describe('randomFleet', () => {
  it('always produces a valid fleet', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(validatePlacement(randomFleet(seeded(seed))), `seed ${seed}`).toEqual({ ok: true });
    }
  });

  it('is reproducible for the same random source', () => {
    expect(randomFleet(seeded(7))).toEqual(randomFleet(seeded(7)));
  });
});

describe('placeShip', () => {
  it('adds a ship to an empty draft', () => {
    expect(placeShip([], destroyer(0, 0))).toEqual([destroyer(0, 0)]);
  });

  it('moves a ship instead of duplicating it', () => {
    const moved = placeShip([destroyer(0, 0)], destroyer(5, 5));
    expect(moved).toEqual([destroyer(5, 5)]);
  });

  it('allows putting a ship back onto its own previous cells', () => {
    expect(placeShip([destroyer(0, 0)], destroyer(1, 0))).toEqual([destroyer(1, 0)]);
  });

  it('rejects a ship that touches another one', () => {
    const cruiser: PlacedShip = {
      type: 'cruiser',
      origin: { x: 0, y: 1 },
      orientation: 'horizontal',
    };
    expect(placeShip([destroyer(0, 0)], cruiser)).toBeNull();
  });

  it('rejects a ship that sticks out of the board', () => {
    expect(placeShip([], destroyer(9, 0))).toBeNull();
  });
});

describe('nextUnplaced', () => {
  it('starts with the biggest ship and skips the ones already placed', () => {
    expect(nextUnplaced([])).toBe('carrier');
    expect(
      nextUnplaced([{ type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' }]),
    ).toBe('battleship');
  });

  it('returns null when the whole fleet is placed', () => {
    expect(nextUnplaced(randomFleet(seeded(3)))).toBeNull();
  });
});

describe('without / isComplete', () => {
  it('removes a ship by type', () => {
    expect(without([destroyer(0, 0)], 'destroyer')).toEqual([]);
  });

  it('is complete only for a full valid fleet', () => {
    const fleet = randomFleet(seeded(5));
    expect(isComplete(fleet)).toBe(true);
    expect(isComplete(fleet.slice(1))).toBe(false);
    expect(isComplete([])).toBe(false);
  });
});
