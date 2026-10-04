import { BOARD_SIZE, FLEET } from './constants.js';
import { canPlaceShip } from './placement.js';
import type { Orientation, PlacedShip } from './types.js';

function tryRandomFleet(random: () => number): PlacedShip[] | null {
  const placed: PlacedShip[] = [];

  for (const { type } of FLEET) {
    let done = false;
    for (let attempt = 0; attempt < 200 && !done; attempt++) {
      const orientation: Orientation = random() < 0.5 ? 'horizontal' : 'vertical';
      const ship: PlacedShip = {
        type,
        orientation,
        origin: {
          x: Math.floor(random() * BOARD_SIZE),
          y: Math.floor(random() * BOARD_SIZE),
        },
      };
      if (canPlaceShip(placed, ship)) {
        placed.push(ship);
        done = true;
      }
    }
    if (!done) return null;
  }
  return placed;
}

/** Випадкова коректна розстановка. `random` передається ззовні, щоб у тестах вона була відтворюваною. */
export function randomFleet(random: () => number = Math.random): PlacedShip[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const fleet = tryRandomFleet(random);
    if (fleet) return fleet;
  }
  throw new Error('Could not generate a random fleet');
}
