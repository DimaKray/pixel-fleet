import { FLEET, canPlaceShip, validatePlacement } from '@pixelfleet/engine';
import type { PlacedShip, ShipType } from '@pixelfleet/engine';

/** Випадкова розстановка тепер живе в рушії: її ж використовує бот на сервері. */
export { randomFleet } from '@pixelfleet/engine';

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
