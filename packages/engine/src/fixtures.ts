import { createBoard, fire } from './board.js';
import type { Board } from './board.js';
import type { Coord, PlacedShip } from './types.js';

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

export function newBoard(): Board {
  const result = createBoard(validFleet());
  if (!result.ok) throw new Error('fixture fleet must be valid');
  return result.board;
}

export function mustFire(board: Board, at: Coord) {
  const result = fire(board, at);
  if (!result.ok) throw new Error(`unexpected error: ${result.error}`);
  return result;
}