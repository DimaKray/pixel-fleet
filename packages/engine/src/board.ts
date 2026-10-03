import { inBounds, shipCells } from './geometry.js';
import { validatePlacement } from './placement.js';
import type { PlacementError } from './placement.js';
import type { Coord, PlacedShip, Shot, ShotOutcome } from './types.js';

/** Стан поля одного гравця: його флот і постріли, які суперник вже зробив по ньому. */
export interface Board {
  readonly ships: readonly PlacedShip[];
  readonly shots: readonly Shot[];
}

export type CreateBoardResult =
  { ok: true; board: Board } | { ok: false; errors: PlacementError[] };

export type FireError = 'out_of_bounds' | 'already_shot';

export type FireResult =
  | {
      ok: true;
      board: Board;
      shot: Shot;
      /** Заповнено лише коли цим пострілом потоплено корабель. */
      sunkShip?: PlacedShip;
      gameOver: boolean;
    }
  | { ok: false; error: FireError };

const sameCoord = (a: Coord, b: Coord): boolean => a.x === b.x && a.y === b.y;

export function createBoard(ships: readonly PlacedShip[]): CreateBoardResult {
  const validation = validatePlacement(ships);
  if (!validation.ok) return validation;
  return { ok: true, board: { ships: [...ships], shots: [] } };
}

export function shipAt(board: Board, at: Coord): PlacedShip | undefined {
  return board.ships.find((ship) => shipCells(ship).some((cell) => sameCoord(cell, at)));
}

/** Корабель потоплено, якщо по кожній його клітинці вже стріляли. */
export function isSunk(ship: PlacedShip, shots: readonly Shot[]): boolean {
  return shipCells(ship).every((cell) => shots.some((shot) => sameCoord(shot.at, cell)));
}

export function allSunk(board: Board): boolean {
  return board.ships.every((ship) => isSunk(ship, board.shots));
}

export function fire(board: Board, at: Coord): FireResult {
  if (!inBounds(at)) return { ok: false, error: 'out_of_bounds' };
  if (board.shots.some((shot) => sameCoord(shot.at, at))) {
    return { ok: false, error: 'already_shot' };
  }

  const target = shipAt(board, at);
  // Рахуємо «потоплено» з урахуванням цього пострілу.
  const shotsAfter = [...board.shots, { at, outcome: 'hit' as const }];
  const sunk = target !== undefined && isSunk(target, shotsAfter);

  const outcome: ShotOutcome = target === undefined ? 'miss' : sunk ? 'sunk' : 'hit';
  const shot: Shot = { at: { x: at.x, y: at.y }, outcome };
  const next: Board = { ships: board.ships, shots: [...board.shots, shot] };

  return {
    ok: true,
    board: next,
    shot,
    ...(sunk && target ? { sunkShip: target } : {}),
    gameOver: allSunk(next),
  };
}
