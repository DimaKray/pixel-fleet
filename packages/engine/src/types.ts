export interface Coord {
  x: number;
  y: number;
}

export type Orientation = 'horizontal' | 'vertical';

export type ShipType = 'carrier' | 'battleship' | 'cruiser' | 'submarine' | 'destroyer';

export interface PlacedShip {
  type: ShipType;
  /** Клітинка, де знаходиться ніс корабля (початок). */
  origin: Coord;
  orientation: Orientation;
}

export type ShotOutcome = 'miss' | 'hit' | 'sunk';

export interface Shot {
  at: Coord;
  outcome: ShotOutcome;
}

export type Phase = 'lobby' | 'placement' | 'battle' | 'finished';
