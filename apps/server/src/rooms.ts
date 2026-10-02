import { randomInt, randomUUID } from 'node:crypto';
import * as engine from '@pixelfleet/engine';

/** Без схожих символів 0/O і 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_CODE_ATTEMPTS = 100;

/** Усе недетерміноване приходить ззовні, тому менеджер легко тестувати. */
export interface RoomEnv {
  randomCode(): string;
  randomToken(): string;
  /** Хто стріляє першим. */
  coinFlip(): engine.PlayerId;
}

export const defaultEnv: RoomEnv = {
  randomCode: () =>
    Array.from({ length: CODE_LENGTH }, () =>
      CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length)),
    ).join(''),
  randomToken: () => randomUUID(),
  coinFlip: () => (randomInt(2) === 0 ? 'a' : 'b'),
};

interface Seat {
  token: string;
  connected: boolean;
}

interface Room {
  code: string;
  game: engine.Game;
  seats: Partial<Record<engine.PlayerId, Seat>>;
}

interface SeatRef {
  code: string;
  player: engine.PlayerId;
}

export type RoomErrorCode = 'room_not_found' | 'room_full' | 'unknown_token';
export type ManagerError = { code: RoomErrorCode } | engine.GameError;
export type Presence = 'empty' | 'online' | 'offline';

export type Failure = { ok: false; error: ManagerError };
export type SeatOk = { ok: true; code: string; player: engine.PlayerId };
export type Joined = SeatOk & { token: string };
export type ShootActionResult =
  (SeatOk & { shot: engine.Shot; sunkShip?: engine.PlacedShip }) | Failure;

const fail = (code: RoomErrorCode): Failure => ({ ok: false, error: { code } });

export class RoomManager {
  private readonly rooms = new Map<string, Room>();
  /** Токен → місце. Токен секретний, тож за ним сервер упізнає гравця. */
  private readonly seats = new Map<string, SeatRef>();
  private readonly env: RoomEnv;

  constructor(env: RoomEnv = defaultEnv) {
    this.env = env;
  }

  createRoom(): Joined {
    const code = this.freeCode();
    const token = this.env.randomToken();

    this.rooms.set(code, {
      code,
      game: engine.createGame(this.env.coinFlip()),
      seats: { a: { token, connected: true } },
    });
    this.seats.set(token, { code, player: 'a' });

    return { ok: true, code, token, player: 'a' };
  }

  joinRoom(code: string): Joined | Failure {
    const room = this.rooms.get(code);
    if (!room) return fail('room_not_found');
    if (room.seats.b) return fail('room_full');

    const token = this.env.randomToken();
    room.seats.b = { token, connected: true };
    this.seats.set(token, { code, player: 'b' });

    return { ok: true, code, token, player: 'b' };
  }

  /** Повернення гравця за токеном (перезавантаження сторінки, втрата зв'язку). */
  resume(token: string): SeatOk | Failure {
    const ref = this.setConnected(token, true);
    if (!ref) return fail('unknown_token');
    return { ok: true, ...ref };
  }

  /** Повертає місце, щоб викликач міг повідомити суперника. */
  setConnected(token: string, connected: boolean): SeatRef | undefined {
    const ref = this.seats.get(token);
    if (!ref) return undefined;

    const seat = this.rooms.get(ref.code)?.seats[ref.player];
    if (seat) seat.connected = connected;
    return ref;
  }

  placeFleet(token: string, ships: readonly engine.PlacedShip[]): SeatOk | Failure {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const result = engine.placeFleet(found.room.game, found.player, ships);
    if (!result.ok) return result;

    found.room.game = result.game;
    return { ok: true, code: found.room.code, player: found.player };
  }

  shoot(token: string, at: engine.Coord): ShootActionResult {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const result = engine.shoot(found.room.game, found.player, at);
    if (!result.ok) return result;

    found.room.game = result.game;
    return {
      ok: true,
      code: found.room.code,
      player: found.player,
      shot: result.shot,
      ...(result.sunkShip ? { sunkShip: result.sunkShip } : {}),
    };
  }

  resign(token: string): SeatOk | Failure {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const result = engine.resign(found.room.game, found.player);
    if (!result.ok) return result;

    found.room.game = result.game;
    return { ok: true, code: found.room.code, player: found.player };
  }

  /** Проєкції для кожного гравця, що сидить у кімнаті. Тільки їх можна віддавати клієнтам. */
  views(code: string): Partial<Record<engine.PlayerId, engine.GameView>> {
    const room = this.rooms.get(code);
    const views: Partial<Record<engine.PlayerId, engine.GameView>> = {};
    if (!room) return views;

    for (const player of ['a', 'b'] as const) {
      if (room.seats[player]) views[player] = engine.viewGame(room.game, player);
    }
    return views;
  }

  presence(code: string): Record<engine.PlayerId, Presence> | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const state = (seat: Seat | undefined): Presence =>
      !seat ? 'empty' : seat.connected ? 'online' : 'offline';
    return { a: state(room.seats.a), b: state(room.seats.b) };
  }

  private locate(token: string): { room: Room; player: engine.PlayerId } | undefined {
    const ref = this.seats.get(token);
    const room = ref ? this.rooms.get(ref.code) : undefined;
    return ref && room ? { room, player: ref.player } : undefined;
  }

  private freeCode(): string {
    for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
      const code = this.env.randomCode();
      if (!this.rooms.has(code)) return code;
    }
    throw new Error('Could not allocate a free room code');
  }
}
