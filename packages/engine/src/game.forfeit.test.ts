import { describe, expect, it } from 'vitest';
import { validFleet } from './fixtures.js';
import { createGame, forfeit, placeFleet, skipTurn } from './game.js';
import type { Game, PlayerId } from './game.js';

function started(first: PlayerId = 'a'): Game {
  let game = createGame(first);
  for (const player of ['a', 'b'] as const) {
    const result = placeFleet(game, player, validFleet());
    if (!result.ok) throw new Error('fixture fleet must be valid');
    game = result.game;
  }
  return game;
}

describe('skipTurn', () => {
  it('passes the turn to the opponent', () => {
    const result = skipTurn(started('a'), 'a');

    expect(result.ok && result.game.turn).toBe('b');
  });

  it('is refused out of turn', () => {
    expect(skipTurn(started('a'), 'b')).toEqual({ ok: false, error: { code: 'not_your_turn' } });
  });

  it('is refused outside the battle', () => {
    expect(skipTurn(createGame(), 'a')).toEqual({ ok: false, error: { code: 'wrong_phase' } });
  });
});

describe('forfeit', () => {
  it('records the reason and gives the win to the opponent', () => {
    const result = forfeit(started(), 'a', 'timeout');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.game.phase).toBe('finished');
      expect(result.game.winner).toBe('b');
      expect(result.game.endReason).toBe('timeout');
      expect(result.game.turn).toBeNull();
    }
  });

  it('works during the placement phase', () => {
    const result = forfeit(createGame(), 'b', 'abandoned');

    expect(result.ok && result.game.winner).toBe('a');
  });

  it('is refused once the game is over', () => {
    const finished = forfeit(started(), 'a', 'timeout');
    if (!finished.ok) throw new Error('must finish');

    expect(forfeit(finished.game, 'b', 'abandoned')).toEqual({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});
