import { BOARD_SIZE, FLEET } from './constants.js';
import type { Coord, PlacedShip, ShipType } from './types.js';

export function shipSize(type: ShipType): number {
  const entry = FLEET.find((s) => s.type === type);
  if (!entry) throw new Error(`Unknown ship type: ${type}`);
  return entry.size;
}

/** Усі клітинки, які займає корабель. */
export function shipCells(ship: PlacedShip): Coord[] {
  const size = shipSize(ship.type);
  return Array.from({ length: size }, (_, i) => ({
    x: ship.origin.x + (ship.orientation === 'horizontal' ? i : 0),
    y: ship.origin.y + (ship.orientation === 'vertical' ? i : 0),
  }));
}

export function inBounds({ x, y }: Coord): boolean {
  return (
    Number.isInteger(x) &&
    Number.isInteger(y) &&
    x >= 0 &&
    y >= 0 &&
    x < BOARD_SIZE &&
    y < BOARD_SIZE
  );
}
