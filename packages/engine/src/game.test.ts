import { describe, expect, it } from 'vitest';
import { validFleet } from './fixtures.js';
import { createGame, placeFleet, resign, shoot, viewGame } from './game.js';
import type { Game, GameResult, PlayerId } from './game.js';
import { shipCells } from './geometry.js';
import type { Coord } from './types.js';

function must(result: GameResult): Game {
  if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
  return result.game;
}

function mustShoot(game: Game, player: PlayerId, at: Coord) {
  const result = shoot(game, player, at);
  if (!result.ok) throw new Error(`unexpected error: ${JSON.stringify(result.error)}`);
  return result;
}

/** Гра, де обидва гравці вже розставили флот і починається бій. */
function started(first: PlayerId = 'a'): Game {
  let game = createGame(first);
  for (const player of ['a', 'b'] as const) {
    game = must(placeFleet(game, player, validFleet()));
  }
  return game;
}

describe('createGame', () => {
  it('starts in the placement phase with nothing placed', () => {
    const game = createGame();

    expect(game.phase).toBe('placement');
    expect(game.boards).toEqual({});
    expect(game.turn).toBeNull();
    expect(game.winner).toBeNull();
    expect(game.endReason).toBeNull();
  });
});

describe('placeFleet', () => {
  it('rejects an invalid fleet and reports why', () => {
    const result = placeFleet(createGame(), 'a', validFleet().slice(1));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('invalid_placement');
  });

  it('starts the battle only when both players are ready', () => {
    const afterA = must(placeFleet(createGame('b'), 'a', validFleet()));
    expect(afterA.phase).toBe('placement');
    expect(afterA.turn).toBeNull();

    const afterB = must(placeFleet(afterA, 'b', validFleet()));
    expect(afterB.phase).toBe('battle');
    expect(afterB.turn).toBe('b');
  });

  it('does not allow placing twice', () => {
    const game = must(placeFleet(createGame(), 'a', validFleet()));

    expect(placeFleet(game, 'a', validFleet())).toEqual({
      ok: false,
      error: { code: 'already_placed' },
    });
  });

  it('does not allow placing during the battle', () => {
    expect(placeFleet(started(), 'a', validFleet())).toEqual({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });
});

describe('shoot', () => {
  it('is not allowed before the battle starts', () => {
    expect(shoot(createGame(), 'a', { x: 0, y: 0 })).toEqual({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('is not allowed out of turn', () => {
    expect(shoot(started('a'), 'b', { x: 0, y: 0 })).toEqual({
      ok: false,
      error: { code: 'not_your_turn' },
    });
  });

  it('passes the turn to the opponent after a miss', () => {
    const result = mustShoot(started('a'), 'a', { x: 9, y: 9 });

    expect(result.shot.outcome).toBe('miss');
    expect(result.game.turn).toBe('b');
  });

  it('lets the shooter go again after a hit', () => {
    const result = mustShoot(started('a'), 'a', { x: 0, y: 0 });

    expect(result.shot.outcome).toBe('hit');
    expect(result.game.turn).toBe('a');
  });

  it('refuses a repeated shot and leaves the game unchanged', () => {
    const afterHit = mustShoot(started('a'), 'a', { x: 0, y: 0 }).game;
    const repeated = shoot(afterHit, 'a', { x: 0, y: 0 });

    expect(repeated).toEqual({ ok: false, error: { code: 'already_shot' } });
    expect(afterHit.turn).toBe('a');
  });

  it('refuses a shot outside the board', () => {
    expect(shoot(started(), 'a', { x: 10, y: 0 })).toEqual({
      ok: false,
      error: { code: 'out_of_bounds' },
    });
  });

  it('finishes the game when the whole enemy fleet is sunk', () => {
    let game = started('a');

    for (const ship of validFleet()) {
      for (const cell of shipCells(ship)) {
        game = mustShoot(game, 'a', cell).game;
      }
    }

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe('a');
    expect(game.turn).toBeNull();
    expect(game.endReason).toBe('all_sunk');
    expect(shoot(game, 'a', { x: 9, y: 9 })).toEqual({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('does not mutate the original game', () => {
    const game = started('a');
    shoot(game, 'a', { x: 0, y: 0 });

    expect(game.turn).toBe('a');
    expect(game.boards.b?.shots).toHaveLength(0);
  });
});

describe('resign', () => {
  it('gives the win to the opponent during the battle', () => {
    const game = must(resign(started(), 'a'));

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe('b');
    expect(game.endReason).toBe('resigned');
    expect(game.turn).toBeNull();
  });

  it('works during the placement phase too', () => {
    const game = must(resign(createGame(), 'b'));

    expect(game.phase).toBe('finished');
    expect(game.winner).toBe('a');
  });

  it('is not allowed once the game is finished', () => {
    const finished = must(resign(started(), 'a'));

    expect(resign(finished, 'b')).toEqual({ ok: false, error: { code: 'wrong_phase' } });
  });
});

describe('viewGame', () => {
  it('shows placement progress without leaking the opponent fleet', () => {
    const game = must(placeFleet(createGame(), 'a', validFleet()));

    const viewA = viewGame(game, 'a');
    expect(viewA.ownBoard).not.toBeNull();
    expect(viewA.opponentReady).toBe(false);

    const viewB = viewGame(game, 'b');
    expect(viewB.ownBoard).toBeNull();
    expect(viewB.opponentReady).toBe(true);
    expect(viewB.opponentBoard).toBeNull();
    expect(JSON.stringify(viewB)).not.toContain('carrier');
  });

  it('hides the opponent ships during the battle', () => {
    const view = viewGame(started(), 'a');

    expect(view.phase).toBe('battle');
    expect(view.opponentBoard?.shipsRemaining).toBe(5);
    expect(JSON.stringify(view.opponentBoard)).not.toContain('origin');
    expect(view.opponentFleet).toBeNull();
  });

  it('tells each player whether it is their turn', () => {
    const game = started('a');

    expect(viewGame(game, 'a').yourTurn).toBe(true);
    expect(viewGame(game, 'b').yourTurn).toBe(false);
  });

  it('reveals the opponent fleet only after the game is over', () => {
    const game = must(resign(started(), 'b'));
    const view = viewGame(game, 'a');

    expect(view.winner).toBe('a');
    expect(view.opponentFleet).toEqual(validFleet());
  });
});