import { randomInt, randomUUID } from 'node:crypto';
import * as engine from '@pixelfleet/engine';
import type { Presence, RoomMeta } from '@pixelfleet/protocol';

/** Без схожих символів 0/O і 1/I. */
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 5;
const MAX_CODE_ATTEMPTS = 100;

/** Усе випадкове приходить ззовні, тому менеджер легко тестувати. */
export interface RoomEnv {
  randomCode(): string;
  randomToken(): string;
  /** Хто стріляє першим. */
  coinFlip(): engine.PlayerId;
  /** Число від 0 до 1 для бота (розстановка, вибір пострілу). За замовчуванням Math.random. */
  random?(): number;
}

export const defaultEnv: RoomEnv = {
  randomCode: () =>
    Array.from({ length: CODE_LENGTH }, () =>
      CODE_ALPHABET.charAt(randomInt(CODE_ALPHABET.length)),
    ).join(''),
  randomToken: () => randomUUID(),
  coinFlip: () => (randomInt(2) === 0 ? 'a' : 'b'),
};

export interface RoomConfig {
  /** Скільки мілісекунд на хід. */
  turnMs: number;
  /** Скільки гравець може бути не на зв'язку, перш ніж програти. */
  graceMs: number;
  /** Через скільки кімната, де ніхто не на зв'язку, видаляється. */
  roomTtlMs: number;
  /** Скільки ходів поспіль можна пропустити до технічної поразки. */
  maxSkips: number;
  /** Бот «думає» випадковий час між цими двома значеннями. */
  botMinMs: number;
  botMaxMs: number;
}

export const defaultConfig: RoomConfig = {
  turnMs: 60_000,
  graceMs: 60_000,
  roomTtlMs: 30 * 60_000,
  maxSkips: 2,
  botMinMs: 700,
  botMaxMs: 1400,
};

interface Seat {
  token: string;
  connected: boolean;
  offlineSince: number | null;
}

interface BotState {
  difficulty: engine.BotDifficulty;
  /** Коли бот зробить постріл. `null`, якщо зараз не його хід. */
  dueAt: number | null;
}

interface Room {
  code: string;
  game: engine.Game;
  seats: Partial<Record<engine.PlayerId, Seat>>;
  turnDeadline: number | null;
  /** Скільки ходів поспіль гравець пропустив. */
  skips: Record<engine.PlayerId, number>;
  rematch: Record<engine.PlayerId, boolean>;
  lastActivity: number;
  /** Якщо кімната з ботом, бот завжди займає місце `b`. */
  bot: BotState | null;
}

interface SeatRef {
  code: string;
  player: engine.PlayerId;
}

export type { Presence };

export type RoomErrorCode = 'room_not_found' | 'room_full' | 'unknown_token';
export type ManagerError = { code: RoomErrorCode } | engine.GameError;

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
  private readonly config: RoomConfig;
  private readonly now: () => number;

  constructor(
    env: RoomEnv = defaultEnv,
    config: Partial<RoomConfig> = {},
    now: () => number = () => Date.now(),
  ) {
    this.env = env;
    this.config = { ...defaultConfig, ...config };
    this.now = now;
  }

  createRoom(): Joined {
    return this.open(null);
  }

  /** Кімната, де суперник бот: другого гравця чекати не треба, бот розставляє флот одразу. */
  createBotRoom(difficulty: engine.BotDifficulty): Joined {
    return this.open(difficulty);
  }

  joinRoom(code: string): Joined | Failure {
    const room = this.rooms.get(code);
    if (!room) return fail('room_not_found');
    if (room.seats.b) return fail('room_full');

    const token = this.env.randomToken();
    room.seats.b = { token, connected: true, offlineSince: null };
    this.seats.set(token, { code, player: 'b' });
    room.lastActivity = this.now();

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

    const room = this.rooms.get(ref.code);
    const seat = room?.seats[ref.player];
    if (room && seat) {
      const now = this.now();
      if (connected) seat.offlineSince = null;
      else if (seat.connected) seat.offlineSince = now;
      seat.connected = connected;
      room.lastActivity = now;
    }
    return ref;
  }

  placeFleet(token: string, ships: readonly engine.PlacedShip[]): SeatOk | Failure {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const result = engine.placeFleet(found.room.game, found.player, ships);
    if (!result.ok) return result;

    found.room.game = result.game;
    this.afterChange(found.room);
    return { ok: true, code: found.room.code, player: found.player };
  }

  shoot(token: string, at: engine.Coord): ShootActionResult {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const result = engine.shoot(found.room.game, found.player, at);
    if (!result.ok) return result;

    found.room.game = result.game;
    found.room.skips[found.player] = 0;
    this.afterChange(found.room);
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
    this.afterChange(found.room);
    return { ok: true, code: found.room.code, player: found.player };
  }

  /** Реванш починається, коли його попросили обидва гравці. Бот погоджується одразу. */
  requestRematch(token: string): SeatOk | Failure {
    const found = this.locate(token);
    if (!found) return fail('unknown_token');

    const { room, player } = found;
    if (room.game.phase !== 'finished') return { ok: false, error: { code: 'wrong_phase' } };

    room.rematch[player] = true;
    if (room.bot) room.rematch.b = true;

    const bothAsked = room.rematch.a && room.rematch.b;
    if (bothAsked && room.seats.a && room.seats.b) {
      // Першим стріляє той, хто в минулій партії ходив другим.
      room.game = engine.createGame(engine.opponentOf(room.game.firstPlayer));
      room.rematch = { a: false, b: false };
      room.skips = { a: 0, b: 0 };
      this.seatBot(room);
    }

    this.afterChange(room);
    return { ok: true, code: room.code, player };
  }

  /**
   * Застосовує правила часу: ходи ботів, технічні поразки, пропуск ходу, видалення старих кімнат.
   * Повертає коди кімнат, у яких змінився стан (їх треба розіслати гравцям).
   */
  sweep(): string[] {
    const now = this.now();
    const changed: string[] = [];

    for (const room of [...this.rooms.values()]) {
      if (this.isStale(room, now)) {
        this.remove(room);
        continue;
      }
      const botMoved = this.botMove(room, now);
      const ruled = this.enforce(room, now);
      if (botMoved || ruled) changed.push(room.code);
    }
    return changed;
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

  /** Таймер, стан реваншу і чи грає людина проти бота. */
  meta(code: string): Partial<Record<engine.PlayerId, RoomMeta>> {
    const room = this.rooms.get(code);
    const result: Partial<Record<engine.PlayerId, RoomMeta>> = {};
    if (!room) return result;

    const remaining =
      room.turnDeadline === null ? null : Math.max(0, room.turnDeadline - this.now());

    for (const player of ['a', 'b'] as const) {
      if (!room.seats[player]) continue;
      result[player] = {
        turnRemainingMs: remaining,
        rematch: { you: room.rematch[player], opponent: room.rematch[engine.opponentOf(player)] },
        bot: room.bot?.difficulty ?? null,
      };
    }
    return result;
  }

  presence(code: string): Record<engine.PlayerId, Presence> | undefined {
    const room = this.rooms.get(code);
    if (!room) return undefined;

    const state = (seat: Seat | undefined): Presence =>
      !seat ? 'empty' : seat.connected ? 'online' : 'offline';
    return { a: state(room.seats.a), b: state(room.seats.b) };
  }

  private open(difficulty: engine.BotDifficulty | null): Joined {
    const code = this.freeCode();
    const token = this.env.randomToken();
    const now = this.now();

    const room: Room = {
      code,
      game: engine.createGame(this.env.coinFlip()),
      seats: { a: { token, connected: true, offlineSince: null } },
      turnDeadline: null,
      skips: { a: 0, b: 0 },
      rematch: { a: false, b: false },
      lastActivity: now,
      bot: difficulty ? { difficulty, dueAt: null } : null,
    };
    if (difficulty) {
      // Токен бота нікому не видається: діє він лише зсередини менеджера.
      room.seats.b = { token: 'bot', connected: true, offlineSince: null };
    }

    this.rooms.set(code, room);
    this.seats.set(token, { code, player: 'a' });
    this.seatBot(room);

    return { ok: true, code, token, player: 'a' };
  }

  private get random(): () => number {
    return this.env.random ?? Math.random;
  }

  /** Бот розставляє флот одразу, щоб людині не довелося його чекати. */
  private seatBot(room: Room): void {
    if (!room.bot) return;
    const result = engine.placeFleet(room.game, 'b', engine.randomFleet(this.random));
    if (result.ok) room.game = result.game;
  }

  /** Після будь-якої зміни стану: оновлюємо активність, таймер ходу й чергу бота. */
  private afterChange(room: Room): void {
    const now = this.now();
    room.lastActivity = now;
    room.turnDeadline = room.game.phase === 'battle' ? now + this.config.turnMs : null;
    this.scheduleBot(room, now);
  }

  private scheduleBot(room: Room, now: number): void {
    const bot = room.bot;
    if (!bot) return;

    if (room.game.phase !== 'battle' || room.game.turn !== 'b') {
      bot.dueAt = null;
      return;
    }
    const { botMinMs, botMaxMs } = this.config;
    bot.dueAt = now + botMinMs + this.random() * (botMaxMs - botMinMs);
  }

  /** Бот стріляє, коли настав його час. Якщо влучив, ходить знову (після нової паузи). */
  private botMove(room: Room, now: number): boolean {
    const bot = room.bot;
    if (!bot || bot.dueAt === null || now < bot.dueAt) return false;

    const humanBoard = room.game.boards.a;
    if (room.game.phase !== 'battle' || room.game.turn !== 'b' || !humanBoard) {
      bot.dueAt = null;
      return false;
    }

    // Бот бачить лише те, що бачив би гравець: свої постріли й потоплені кораблі.
    const at = engine.chooseShot(engine.viewOpponentBoard(humanBoard), bot.difficulty, this.random);
    const result = engine.shoot(room.game, 'b', at);
    if (!result.ok) {
      bot.dueAt = null;
      return false;
    }

    room.game = result.game;
    this.afterChange(room);
    return true;
  }

  private enforce(room: Room, now: number): boolean {
    if (room.game.phase === 'finished') return false;

    // Гравець надто довго не на зв'язку, а суперник на місці: технічна поразка.
    for (const player of ['a', 'b'] as const) {
      const seat = room.seats[player];
      const opponent = room.seats[engine.opponentOf(player)];
      const gone =
        seat !== undefined &&
        !seat.connected &&
        seat.offlineSince !== null &&
        now - seat.offlineSince >= this.config.graceMs;

      if (gone && opponent?.connected) return this.forfeit(room, player, 'abandoned');
    }

    // Час на хід вийшов: пропускаємо хід, а після кількох пропусків поспіль програємо.
    // Хід бота таймером не обмежується: він сам ходить за секунду.
    const turn = room.game.turn;
    if (
      room.game.phase === 'battle' &&
      turn !== null &&
      !(room.bot && turn === 'b') &&
      room.turnDeadline !== null &&
      now >= room.turnDeadline
    ) {
      room.skips[turn] += 1;
      if (room.skips[turn] >= this.config.maxSkips) return this.forfeit(room, turn, 'timeout');

      const result = engine.skipTurn(room.game, turn);
      if (!result.ok) return false;
      room.game = result.game;
      this.afterChange(room);
      return true;
    }

    return false;
  }

  private forfeit(room: Room, loser: engine.PlayerId, reason: 'timeout' | 'abandoned'): boolean {
    const result = engine.forfeit(room.game, loser, reason);
    if (!result.ok) return false;

    room.game = result.game;
    this.afterChange(room);
    return true;
  }

  private isStale(room: Room, now: number): boolean {
    // Бот завжди «на зв'язку», тож у кімнаті з ботом рахуємо лише людину.
    const humans = room.bot ? [room.seats.a] : Object.values(room.seats);
    const anyoneConnected = humans.some((seat) => seat?.connected);
    return !anyoneConnected && now - room.lastActivity >= this.config.roomTtlMs;
  }

  private remove(room: Room): void {
    for (const seat of Object.values(room.seats)) {
      if (seat) this.seats.delete(seat.token);
    }
    this.rooms.delete(room.code);
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
