import { isSunk } from './board.js';
import type { Board } from './board.js';
import type { PlacedShip, Shot } from './types.js';

/** Те, що гравець бачить на власному полі. */
export interface OwnBoardView {
  ships: PlacedShip[];
  shots: Shot[];
}

/**
 * Те, що гравець бачить на полі суперника.
 * Навмисно НЕ містить поля `ships`: розстановка непотопленого флоту сюди не потрапляє.
 */
export interface OpponentBoardView {
  shots: Shot[];
  sunkShips: PlacedShip[];
  shipsRemaining: number;
}

const copyShip = (ship: PlacedShip): PlacedShip => ({
  type: ship.type,
  origin: { x: ship.origin.x, y: ship.origin.y },
  orientation: ship.orientation,
});

const copyShot = (shot: Shot): Shot => ({
  at: { x: shot.at.x, y: shot.at.y },
  outcome: shot.outcome,
});

export function viewOwnBoard(board: Board): OwnBoardView {
  return {
    ships: board.ships.map(copyShip),
    shots: board.shots.map(copyShot),
  };
}

export function viewOpponentBoard(board: Board): OpponentBoardView {
  const sunkShips = board.ships.filter((ship) => isSunk(ship, board.shots)).map(copyShip);

  return {
    shots: board.shots.map(copyShot),
    sunkShips,
    shipsRemaining: board.ships.length - sunkShips.length,
  };
}
