import type { ShipType } from './types.js';

export const BOARD_SIZE = 10;

export const FLEET: readonly { type: ShipType; size: number }[] = [
  { type: 'carrier', size: 5 },
  { type: 'battleship', size: 4 },
  { type: 'cruiser', size: 3 },
  { type: 'submarine', size: 3 },
  { type: 'destroyer', size: 2 },
];
