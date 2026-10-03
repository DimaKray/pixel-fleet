import { createBoard, fire } from './board.js';
import type { Board } from './board.js';
import type { PlacementError } from './placement.js';
import { viewOpponentBoard, viewOwnBoard } from './projection.js';
import type { OpponentBoardView, OwnBoardView } from './projection.js';
import type { Coord, PlacedShip, Shot } from './types.js';

export type PlayerId = 'a' | 'b';
export type GamePhase = 'placement' | 'battle' | 'finished';
export type EndReason = 'all_sunk' | 'resigned' | 'timeout' | 'abandoned';

/** Повний стан партії. Живе лише на сервері, клієнтам віддаємо тільки `GameView`. */
export interface Game {
  readonly phase: GamePhase;
  readonly boards: Readonly<Partial<Record<PlayerId, Board>>>;
  readonly firstPlayer: PlayerId;
  readonly turn: PlayerId | null;
  readonly winner: PlayerId | null;
  readonly endReason: EndReason | null;
}

type SimpleErrorCode =
  'wrong_phase' | 'already_placed' | 'not_your_turn' | 'out_of_bounds' | 'already_shot';

export type GameError =
  { code: SimpleErrorCode } | { code: 'invalid_placement'; errors: PlacementError[] };

export type GameResult = { ok: true; game: Game } | { ok: false; error: GameError };

export type ShootResult =
  { ok: true; game: Game; shot: Shot; sunkShip?: PlacedShip } | { ok: false; error: GameError };

function fail(code: SimpleErrorCode): { ok: false; error: GameError } {
  return { ok: false, error: { code } };
}

export function opponentOf(player: PlayerId): PlayerId {
  return player === 'a' ? 'b' : 'a';
}

/** `firstPlayer` передається ззовні, щоб рушій не залежав від випадковості. */
export function createGame(firstPlayer: PlayerId = 'a'): Game {
  return {
    phase: 'placement',
    boards: {},
    firstPlayer,
    turn: null,
    winner: null,
    endReason: null,
  };
}

export function placeFleet(game: Game, player: PlayerId, ships: readonly PlacedShip[]): GameResult {
  if (game.phase !== 'placement') return fail('wrong_phase');
  if (game.boards[player]) return fail('already_placed');

  const created = createBoard(ships);
  if (!created.ok) {
    return { ok: false, error: { code: 'invalid_placement', errors: created.errors } };
  }

  const boards: Partial<Record<PlayerId, Board>> = { ...game.boards, [player]: created.board };
  const ready = boards.a !== undefined && boards.b !== undefined;

  return {
    ok: true,
    game: {
      ...game,
      boards,
      phase: ready ? 'battle' : 'placement',
      turn: ready ? game.firstPlayer : null,
    },
  };
}

export function shoot(game: Game, player: PlayerId, at: Coord): ShootResult {
  if (game.phase !== 'battle') return fail('wrong_phase');
  if (game.turn !== player) return fail('not_your_turn');

  const defender = opponentOf(player);
  const board = game.boards[defender];
  if (!board) return fail('wrong_phase');

  const result = fire(board, at);
  if (!result.ok) return fail(result.error);

  const boards: Partial<Record<PlayerId, Board>> = { ...game.boards, [defender]: result.board };

  const next: Game = result.gameOver
    ? { ...game, boards, phase: 'finished', turn: null, winner: player, endReason: 'all_sunk' }
    : // Влучив чи потопив: стріляє ще раз. Промах передає хід.
      { ...game, boards, turn: result.shot.outcome === 'miss' ? defender : player };

  return {
    ok: true,
    game: next,
    shot: result.shot,
    ...(result.sunkShip ? { sunkShip: result.sunkShip } : {}),
  };
}

/** Гравець програє не через постріли: здався, не ходив або залишив гру. */
export function forfeit(
  game: Game,
  loser: PlayerId,
  reason: Exclude<EndReason, 'all_sunk'>,
): GameResult {
  if (game.phase === 'finished') return fail('wrong_phase');

  return {
    ok: true,
    game: {
      ...game,
      phase: 'finished',
      turn: null,
      winner: opponentOf(loser),
      endReason: reason,
    },
  };
}

export function resign(game: Game, player: PlayerId): GameResult {
  return forfeit(game, player, 'resigned');
}

/** Передає хід суперникові, якщо гравець не встиг стрельнути. */
export function skipTurn(game: Game, player: PlayerId): GameResult {
  if (game.phase !== 'battle') return fail('wrong_phase');
  if (game.turn !== player) return fail('not_your_turn');

  return { ok: true, game: { ...game, turn: opponentOf(player) } };
}

/** Те, що клієнт отримує від сервера. Єдине місце, де вирішується, що можна бачити. */
export interface GameView {
  phase: GamePhase;
  you: PlayerId;
  yourTurn: boolean;
  winner: PlayerId | null;
  endReason: EndReason | null;
  ownBoard: OwnBoardView | null;
  opponentBoard: OpponentBoardView | null;
  opponentReady: boolean;
  /** Розстановка суперника: тільки коли гру закінчено. */
  opponentFleet: PlacedShip[] | null;
}

export function viewGame(game: Game, player: PlayerId): GameView {
  const own = game.boards[player];
  const other = game.boards[opponentOf(player)];

  return {
    phase: game.phase,
    you: player,
    yourTurn: game.turn === player,
    winner: game.winner,
    endReason: game.endReason,
    ownBoard: own ? viewOwnBoard(own) : null,
    opponentBoard: game.phase !== 'placement' && other ? viewOpponentBoard(other) : null,
    opponentReady: other !== undefined,
    opponentFleet: game.phase === 'finished' && other ? viewOwnBoard(other).ships : null,
  };
}
