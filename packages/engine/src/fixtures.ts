import type { PlacedShip } from './types.js';

/** Правильний флот: кожен корабель в окремому рядку, між рядками порожні клітинки. */
export function validFleet(): PlacedShip[] {
  return [
    { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  ];
}