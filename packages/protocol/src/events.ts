import type { GameView, PlacementError, PlayerId } from '@pixelfleet/engine';
import type { FirePayload, JoinRoomPayload, PlaceFleetPayload, ResumePayload } from './schemas.js';

export type Presence = 'empty' | 'online' | 'offline';

export type ErrorCode =
  | 'invalid_payload'
  | 'not_in_room'
  | 'already_in_room'
  | 'room_not_found'
  | 'room_full'
  | 'unknown_token'
  | 'wrong_phase'
  | 'already_placed'
  | 'not_your_turn'
  | 'out_of_bounds'
  | 'already_shot'
  | 'invalid_placement';

export interface WireError {
  code: ErrorCode;
  /** Заповнено лише для `invalid_placement`: що саме не так з розстановкою. */
  errors?: PlacementError[];
}

export type Ack<T = Record<never, never>> = ({ ok: true } & T) | { ok: false; error: WireError };

export type SeatAck = Ack<{ code: string; token: string; player: PlayerId }>;
export type ResumeAck = Ack<{ code: string; player: PlayerId }>;
export type ActionAck = Ack;

export interface ClientToServerEvents {
  'room:create': (ack: (reply: SeatAck) => void) => void;
  'room:join': (payload: JoinRoomPayload, ack: (reply: SeatAck) => void) => void;
  'room:resume': (payload: ResumePayload, ack: (reply: ResumeAck) => void) => void;
  'fleet:place': (payload: PlaceFleetPayload, ack: (reply: ActionAck) => void) => void;
  'shot:fire': (payload: FirePayload, ack: (reply: ActionAck) => void) => void;
  'game:resign': (ack: (reply: ActionAck) => void) => void;
}

export interface ServerToClientEvents {
  /** Повна проєкція гри для цього гравця. Надсилається після кожної зміни. */
  'game:state': (view: GameView) => void;
  /** Стан суперника: чи є він у кімнаті й чи на зв'язку. */
  'opponent:presence': (status: Presence) => void;
}
