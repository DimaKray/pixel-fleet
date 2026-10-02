import { describe, expect, it } from 'vitest';
import { mustFire, newBoard, validFleet } from './fixtures.js';
import { viewOpponentBoard, viewOwnBoard } from './projection.js';

describe('viewOwnBoard', () => {
  it('shows the full fleet and the shots received', () => {
    const { board } = mustFire(newBoard(), { x: 0, y: 0 });
    const view = viewOwnBoard(board);

    expect(view.ships).toEqual(validFleet());
    expect(view.shots).toEqual([{ at: { x: 0, y: 0 }, outcome: 'hit' }]);
  });

  it('returns copies, so changing the view does not touch the board', () => {
    const board = newBoard();
    const view = viewOwnBoard(board);

    view.shots.push({ at: { x: 9, y: 9 }, outcome: 'miss' });
    view.ships.pop();

    expect(board.shots).toHaveLength(0);
    expect(board.ships).toHaveLength(5);
  });
});

describe('viewOpponentBoard', () => {
  it('hides the whole fleet before any shot', () => {
    const view = viewOpponentBoard(newBoard());

    expect(view.shots).toEqual([]);
    expect(view.sunkShips).toEqual([]);
    expect(view.shipsRemaining).toBe(5);
    expect('ships' in view).toBe(false);
  });

  it('reveals only the shot result after a hit, not the ship', () => {
    const { board } = mustFire(newBoard(), { x: 0, y: 0 });
    const view = viewOpponentBoard(board);

    expect(view.shots).toEqual([{ at: { x: 0, y: 0 }, outcome: 'hit' }]);
    expect(view.sunkShips).toEqual([]);
    expect(view.shipsRemaining).toBe(5);

    const json = JSON.stringify(view);
    expect(json).not.toContain('carrier');
    expect(json).not.toContain('origin');
    expect(json).not.toContain('orientation');
  });

  it('reveals a ship only after it is sunk, and only that ship', () => {
    let board = newBoard();
    board = mustFire(board, { x: 0, y: 8 }).board;
    board = mustFire(board, { x: 1, y: 8 }).board; // destroyer sunk
    board = mustFire(board, { x: 0, y: 0 }).board; // carrier only hit

    const view = viewOpponentBoard(board);

    expect(view.sunkShips).toEqual([
      { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
    ]);
    expect(view.shipsRemaining).toBe(4);
    expect(JSON.stringify(view)).not.toContain('carrier');
  });
});