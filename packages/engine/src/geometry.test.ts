import { describe, expect, it } from 'vitest';
import { inBounds, shipCells, shipSize } from './geometry.js';

describe('shipSize', () => {
  it('returns the length from the fleet definition', () => {
    expect(shipSize('carrier')).toBe(5);
    expect(shipSize('destroyer')).toBe(2);
  });
});

describe('shipCells', () => {
  it('expands a horizontal ship to the right', () => {
    expect(
      shipCells({ type: 'destroyer', origin: { x: 3, y: 4 }, orientation: 'horizontal' }),
    ).toEqual([
      { x: 3, y: 4 },
      { x: 4, y: 4 },
    ]);
  });

  it('expands a vertical ship downwards', () => {
    expect(shipCells({ type: 'cruiser', origin: { x: 1, y: 1 }, orientation: 'vertical' })).toEqual(
      [
        { x: 1, y: 1 },
        { x: 1, y: 2 },
        { x: 1, y: 3 },
      ],
    );
  });
});

describe('inBounds', () => {
  it('accepts corners of the board', () => {
    expect(inBounds({ x: 0, y: 0 })).toBe(true);
    expect(inBounds({ x: 9, y: 9 })).toBe(true);
  });

  it('rejects coordinates outside the board or non-integers', () => {
    expect(inBounds({ x: -1, y: 0 })).toBe(false);
    expect(inBounds({ x: 10, y: 0 })).toBe(false);
    expect(inBounds({ x: 0, y: 10 })).toBe(false);
    expect(inBounds({ x: 1.5, y: 2 })).toBe(false);
  });
});
