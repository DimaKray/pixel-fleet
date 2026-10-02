import { describe, expect, it } from 'vitest';
import { validatePlacement } from './placement.js';
import type { PlacedShip, ShipType } from './types.js';

/** Правильний флот: кожен корабель в окремому рядку, між рядками порожні клітинки. */
function fleet(overrides: Partial<Record<ShipType, PlacedShip>> = {}): PlacedShip[] {
  const base: Record<ShipType, PlacedShip> = {
    carrier: { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    battleship: { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    cruiser: { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    submarine: { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    destroyer: { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  };
  return Object.values({ ...base, ...overrides });
}

function codes(ships: PlacedShip[]): string[] {
  const result = validatePlacement(ships);
  return result.ok ? [] : result.errors.map((e) => e.code);
}

describe('validatePlacement', () => {
  it('accepts a valid fleet', () => {
    expect(validatePlacement(fleet())).toEqual({ ok: true });
  });

  it('rejects a ship sticking out to the right', () => {
    const ships = fleet({
      carrier: { type: 'carrier', origin: { x: 6, y: 0 }, orientation: 'horizontal' },
    });
    expect(codes(ships)).toContain('out_of_bounds');
  });

  it('rejects a ship sticking out at the bottom', () => {
    const ships = fleet({
      destroyer: { type: 'destroyer', origin: { x: 9, y: 9 }, orientation: 'vertical' },
    });
    expect(codes(ships)).toContain('out_of_bounds');
  });

  it('rejects negative coordinates', () => {
    const ships = fleet({
      destroyer: { type: 'destroyer', origin: { x: -1, y: 8 }, orientation: 'horizontal' },
    });
    expect(codes(ships)).toContain('out_of_bounds');
  });

  it('rejects overlapping ships', () => {
    const ships = fleet({
      battleship: { type: 'battleship', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    });
    expect(codes(ships)).toContain('overlap');
  });

  it('rejects ships touching by a side', () => {
    const ships = fleet({
      battleship: { type: 'battleship', origin: { x: 0, y: 1 }, orientation: 'horizontal' },
    });
    expect(codes(ships)).toContain('touching');
  });

  it('rejects ships touching diagonally', () => {
    // carrier ends at (4,0), battleship starts at (5,1)
    const ships = fleet({
      battleship: { type: 'battleship', origin: { x: 5, y: 1 }, orientation: 'horizontal' },
    });
    expect(codes(ships)).toContain('touching');
  });

  it('rejects a fleet with a missing ship', () => {
    expect(codes(fleet().slice(1))).toContain('wrong_fleet');
  });

  it('rejects a fleet with a duplicated ship type', () => {
    const ships = fleet();
    ships[4] = { type: 'cruiser', origin: { x: 0, y: 8 }, orientation: 'horizontal' };
    expect(codes(ships)).toContain('wrong_fleet');
  });
});
