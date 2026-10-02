import { FLEET } from './constants.js';
import { inBounds, shipCells } from './geometry.js';
import type { Coord, PlacedShip, ShipType } from './types.js';

export type PlacementError =
  | { code: 'wrong_fleet' }
  | { code: 'out_of_bounds'; ship: ShipType }
  | { code: 'overlap'; ships: [ShipType, ShipType] }
  | { code: 'touching'; ships: [ShipType, ShipType] };

export type PlacementResult = { ok: true } | { ok: false; errors: PlacementError[] };

/** Найменша відстань між клітинками двох кораблів (діагональ теж 1). */
function minDistance(a: Coord[], b: Coord[]): number {
  let min = Infinity;
  for (const p of a) {
    for (const q of b) {
      min = Math.min(min, Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y)));
    }
  }
  return min;
}

function hasExactFleet(ships: readonly PlacedShip[]): boolean {
  const expected = FLEET.map((s) => s.type).sort();
  const actual = ships.map((s) => s.type).sort();
  return expected.length === actual.length && expected.every((type, i) => type === actual[i]);
}

export function validatePlacement(ships: readonly PlacedShip[]): PlacementResult {
  const errors: PlacementError[] = [];

  if (!hasExactFleet(ships)) {
    return { ok: false, errors: [{ code: 'wrong_fleet' }] };
  }

  const cells = ships.map(shipCells);

  ships.forEach((ship, i) => {
    if (!cells[i]?.every(inBounds)) {
      errors.push({ code: 'out_of_bounds', ship: ship.type });
    }
  });

  for (let i = 0; i < ships.length; i++) {
    for (let j = i + 1; j < ships.length; j++) {
      const a = ships[i];
      const b = ships[j];
      const cellsA = cells[i];
      const cellsB = cells[j];
      if (!a || !b || !cellsA || !cellsB) continue;

      const distance = minDistance(cellsA, cellsB);
      if (distance === 0) errors.push({ code: 'overlap', ships: [a.type, b.type] });
      else if (distance === 1) errors.push({ code: 'touching', ships: [a.type, b.type] });
    }
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}
