import { describe, expect, it } from 'vitest';
import { allSunk, createBoard, fire } from './board.js';
import type { Board } from './board.js';
import { validFleet } from './fixtures.js';
import { shipCells } from './geometry.js';
import type { Coord } from './types.js';

function newBoard(): Board {
  const result = createBoard(validFleet());
  if (!result.ok) throw new Error('fixture fleet must be valid');
  return result.board;
}

function mustFire(board: Board, at: Coord) {
  const result = fire(board, at);
  if (!result.ok) throw new Error(`unexpected error: ${result.error}`);
  return result;
}

describe('createBoard', () => {
  it('creates an empty board from a valid fleet', () => {
    const result = createBoard(validFleet());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.board.ships).toHaveLength(5);
      expect(result.board.shots).toEqual([]);
    }
  });

  it('refuses an invalid fleet and reports errors', () => {
    const result = createBoard(validFleet().slice(1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors[0]?.code).toBe('wrong_fleet');
  });
});

describe('fire', () => {
  it('reports a miss on empty water', () => {
    const result = mustFire(newBoard(), { x: 9, y: 9 });
    expect(result.shot.outcome).toBe('miss');
    expect(result.sunkShip).toBeUndefined();
    expect(result.gameOver).toBe(false);
  });

  it('reports a hit on a ship that is still afloat', () => {
    const result = mustFire(newBoard(), { x: 0, y: 0 });
    expect(result.shot.outcome).toBe('hit');
    expect(result.sunkShip).toBeUndefined();
  });

  it('reports sunk when the last cell of a ship is hit', () => {
    const first = mustFire(newBoard(), { x: 0, y: 8 });
    expect(first.shot.outcome).toBe('hit');

    const second = mustFire(first.board, { x: 1, y: 8 });
    expect(second.shot.outcome).toBe('sunk');
    expect(second.sunkShip?.type).toBe('destroyer');
    expect(second.gameOver).toBe(false);
  });

  it('refuses to shoot the same cell twice', () => {
    const first = mustFire(newBoard(), { x: 5, y: 5 });
    expect(fire(first.board, { x: 5, y: 5 })).toEqual({ ok: false, error: 'already_shot' });
  });

  it('refuses shots outside the board', () => {
    expect(fire(newBoard(), { x: 10, y: 0 })).toEqual({ ok: false, error: 'out_of_bounds' });
    expect(fire(newBoard(), { x: -1, y: 3 })).toEqual({ ok: false, error: 'out_of_bounds' });
  });

  it('does not mutate the original board', () => {
    const board = newBoard();
    fire(board, { x: 0, y: 0 });
    expect(board.shots).toHaveLength(0);
  });

  it('ends the game only after every ship cell is hit', () => {
    let board = newBoard();
    const results: ReturnType<typeof mustFire>[] = [];

    for (const ship of validFleet()) {
      for (const cell of shipCells(ship)) {
        const result = mustFire(board, cell);
        board = result.board;
        results.push(result);
      }
    }

    expect(results).toHaveLength(17);
    expect(results.slice(0, -1).every((r) => !r.gameOver)).toBe(true);
    expect(results.at(-1)?.gameOver).toBe(true);
    expect(allSunk(board)).toBe(true);
  });
});
