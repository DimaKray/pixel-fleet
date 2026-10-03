import { describe, expect, it } from 'vitest';
import type { GameView } from '@pixelfleet/engine';
import { gameStatus } from './status';

function view(overrides: Partial<GameView>): GameView {
  return {
    phase: 'battle',
    you: 'a',
    yourTurn: false,
    winner: null,
    endReason: null,
    ownBoard: null,
    opponentBoard: null,
    opponentReady: true,
    opponentFleet: null,
    ...overrides,
  };
}

describe('gameStatus', () => {
  it('waits during placement', () => {
    expect(gameStatus(view({ phase: 'placement' }))).toBe('waiting');
  });

  it('tells whose turn it is during the battle', () => {
    expect(gameStatus(view({ yourTurn: true }))).toBe('your_turn');
    expect(gameStatus(view({ yourTurn: false }))).toBe('opponent_turn');
  });

  it('reports the result when the game is finished', () => {
    expect(gameStatus(view({ phase: 'finished', winner: 'a' }))).toBe('won');
    expect(gameStatus(view({ phase: 'finished', winner: 'b' }))).toBe('lost');
  });
});
