import { describe, expect, it } from 'vitest';
import { createBoard, fire } from './board.js';
import type { Board } from './board.js';
import { BOT_DIFFICULTIES, chooseShot } from './bot.js';
import type { BotDifficulty } from './bot.js';
import { viewOpponentBoard } from './projection.js';
import type { OpponentBoardView } from './projection.js';
import { randomFleet } from './random.js';
import type { PlacedShip, Shot, ShotOutcome } from './types.js';

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

const shot = (x: number, y: number, outcome: ShotOutcome): Shot => ({ at: { x, y }, outcome });

function view(shots: Shot[], sunkShips: PlacedShip[] = []): OpponentBoardView {
  return { shots, sunkShips, shipsRemaining: 5 - sunkShips.length };
}

const destroyer: PlacedShip = {
  type: 'destroyer',
  origin: { x: 0, y: 0 },
  orientation: 'horizontal',
};

describe('chooseShot', () => {
  it('never shoots a cell that was already shot, on any level', () => {
    const shots = [shot(0, 0, 'miss'), shot(1, 0, 'miss'), shot(2, 0, 'miss'), shot(5, 5, 'hit')];
    for (const level of BOT_DIFFICULTIES) {
      for (let seed = 1; seed <= 40; seed++) {
        const at = chooseShot(view(shots), level, seeded(seed));
        expect(shots.some((s) => s.at.x === at.x && s.at.y === at.y)).toBe(false);
        expect(at.x >= 0 && at.x < 10 && at.y >= 0 && at.y < 10).toBe(true);
      }
    }
  });

  it('finishes off a damaged ship by shooting next to the hit (normal and hard)', () => {
    const shots = [shot(5, 5, 'hit')];
    const next = (x: number, y: number) => Math.abs(x - 5) + Math.abs(y - 5) === 1;
    for (const level of ['normal', 'hard'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const at = chooseShot(view(shots), level, seeded(seed));
        expect(next(at.x, at.y)).toBe(true);
      }
    }
  });

  it('follows the line when two hits are in a row (normal and hard)', () => {
    const shots = [shot(3, 4, 'hit'), shot(4, 4, 'hit')];
    for (const level of ['normal', 'hard'] as const) {
      for (let seed = 1; seed <= 40; seed++) {
        const at = chooseShot(view(shots), level, seeded(seed));
        expect([`2,4`, `5,4`]).toContain(`${at.x},${at.y}`);
      }
    }
  });

  it('does not waste shots around a sunk ship, because ships cannot touch', () => {
    const shots = [shot(0, 0, 'hit'), shot(1, 0, 'sunk')];
    for (const level of BOT_DIFFICULTIES) {
      for (let seed = 1; seed <= 60; seed++) {
        const at = chooseShot(view(shots, [destroyer]), level, seeded(seed));
        expect(at.x <= 2 && at.y <= 1).toBe(false);
      }
    }
  });

  it('does not treat hits on a sunk ship as an unfinished target', () => {
    const shots = [shot(0, 0, 'hit'), shot(1, 0, 'sunk')];
    const at = chooseShot(view(shots, [destroyer]), 'normal', seeded(3));
    expect(Math.abs(at.x - 1) + Math.abs(at.y - 0) === 1).toBe(false);
  });
});

function playGame(level: BotDifficulty, seed: number): number {
  const random = seeded(seed);
  const created = createBoard(randomFleet(random));
  if (!created.ok) throw new Error('fleet must be valid');

  let board: Board = created.board;
  const seen = new Set<string>();

  for (let turn = 1; turn <= 100; turn++) {
    const at = chooseShot(viewOpponentBoard(board), level, random);
    const cell = `${at.x},${at.y}`;
    if (seen.has(cell)) throw new Error(`repeated shot ${cell}`);
    seen.add(cell);

    const result = fire(board, at);
    if (!result.ok) throw new Error(`illegal shot ${cell}: ${result.error}`);
    board = result.board;
    if (result.gameOver) return turn;
  }
  throw new Error('the game did not finish within 100 shots');
}

function average(level: BotDifficulty): number {
  let total = 0;
  const games = 30;
  for (let seed = 1; seed <= games; seed++) total += playGame(level, seed);
  return total / games;
}

describe('full games against a random fleet', () => {
  it('every level finishes without repeating or breaking a rule', () => {
    for (const level of BOT_DIFFICULTIES) {
      for (let seed = 100; seed < 110; seed++) {
        expect(playGame(level, seed)).toBeLessThan(101);
      }
    }
  });

  it('smarter levels need fewer shots on average', () => {
    const easy = average('easy');
    const normal = average('normal');
    const hard = average('hard');

    expect(normal).toBeLessThan(easy);
    expect(hard).toBeLessThan(normal);
  });
});
