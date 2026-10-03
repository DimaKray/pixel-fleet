import { BOARD_SIZE, FLEET, canPlaceShip, validatePlacement } from '@pixelfleet/engine';
import type { Orientation, PlacedShip, ShipType } from '@pixelfleet/engine';

export type Draft = readonly PlacedShip[];

export function without(draft: Draft, type: ShipType): PlacedShip[] {
  return draft.filter((ship) => ship.type !== type);
}

/** Ставить корабель (або переносить, якщо такий вже є). `null`, якщо місце не підходить. */
export function placeShip(draft: Draft, ship: PlacedShip): PlacedShip[] | null {
  const others = without(draft, ship.type);
  return canPlaceShip(others, ship) ? [...others, ship] : null;
}

/** Перший корабель із флоту, який ще не поставлено. */
export function nextUnplaced(draft: Draft): ShipType | null {
  return FLEET.find((entry) => !draft.some((ship) => ship.type === entry.type))?.type ?? null;
}

export function isComplete(draft: Draft): boolean {
  return validatePlacement(draft).ok;
}

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

/** `random` передається ззовні, щоб у тестах результат був відтворюваний. */
export function randomFleet(random: () => number = Math.random): PlacedShip[] {
  for (let attempt = 0; attempt < 100; attempt++) {
    const fleet = tryRandomFleet(random);
    if (fleet) return fleet;
  }
  throw new Error('Could not generate a random fleet');
}
