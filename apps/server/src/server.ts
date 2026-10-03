import { createServer } from 'node:http';
import cors from 'cors';
import express from 'express';
import { Server } from 'socket.io';
import type { Socket } from 'socket.io';
import type { PlayerId } from '@pixelfleet/engine';
import { FireSchema, JoinRoomSchema, PlaceFleetSchema, ResumeSchema } from '@pixelfleet/protocol';
import type {
  ActionAck,
  ClientToServerEvents,
  ErrorCode,
  ResumeAck,
  SeatAck,
  ServerToClientEvents,
  WireError,
} from '@pixelfleet/protocol';
import { RoomManager, defaultEnv } from './rooms.js';
import type { RoomConfig, RoomEnv } from './rooms.js';

interface SocketData {
  token?: string;
  code?: string;
  player?: PlayerId;
}

type InterServerEvents = Record<string, never>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export interface GameServerOptions {
  clientOrigin: string;
  env?: RoomEnv;
  config?: Partial<RoomConfig>;
  /** Як часто перевіряємо таймери й старі кімнати. */
  sweepIntervalMs?: number;
  now?: () => number;
}

const failure = (code: ErrorCode): { ok: false; error: WireError } => ({
  ok: false,
  error: { code },
});

/** Клієнт міг не передати колбек. Тоді відповідати нікуди, але падати не можна. */
function safeAck<R>(ack: unknown): (reply: R) => void {
  return typeof ack === 'function' ? (ack as (reply: R) => void) : () => undefined;
}

const seatRoom = (code: string, player: PlayerId): string => `${code}:${player}`;

export function createGameServer({
  clientOrigin,
  env = defaultEnv,
  config,
  sweepIntervalMs = 1000,
  now,
}: GameServerOptions) {
  const app = express();
  app.use(cors({ origin: clientOrigin }));
  app.get('/health', (_req, res) => {
    res.json({ ok: true });
  });

  const httpServer = createServer(app);
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    { cors: { origin: clientOrigin } },
  );
  const manager = new RoomManager(env, config, now);
  /** Токен → id сокета, який зараз «володіє» цим місцем. */
  const activeSockets = new Map<string, string>();

  function broadcastState(code: string): void {
    const views = manager.views(code);
    const metas = manager.meta(code);
    for (const player of ['a', 'b'] as const) {
      const view = views[player];
      if (view) io.to(seatRoom(code, player)).emit('game:state', view);
      const meta = metas[player];
      if (meta) io.to(seatRoom(code, player)).emit('room:meta', meta);
    }
  }

  function broadcastPresence(code: string): void {
    const presence = manager.presence(code);
    if (!presence) return;
    io.to(seatRoom(code, 'a')).emit('opponent:presence', presence.b);
    io.to(seatRoom(code, 'b')).emit('opponent:presence', presence.a);
  }

  function seat(socket: GameSocket, token: string, code: string, player: PlayerId): void {
    socket.data.token = token;
    socket.data.code = code;
    socket.data.player = player;
    activeSockets.set(token, socket.id);
    void socket.join(seatRoom(code, player));
  }

  /** Спільна обгортка для дій усередині кімнати: бо вони відрізняються лише викликом менеджера. */
  function act(
    socket: GameSocket,
    ack: unknown,
    run: (token: string) => { ok: true; code: string } | { ok: false; error: WireError },
  ): void {
    const done = safeAck<ActionAck>(ack);
    const { token } = socket.data;
    if (!token) {
      done(failure('not_in_room'));
      return;
    }

    const result = run(token);
    if (!result.ok) {
      done({ ok: false, error: result.error });
      return;
    }

    done({ ok: true });
    broadcastState(result.code);
  }

  io.on('connection', (socket) => {
    socket.on('room:create', (ack) => {
      const done = safeAck<SeatAck>(ack);
      if (socket.data.token) {
        done(failure('already_in_room'));
        return;
      }

      const room = manager.createRoom();
      seat(socket, room.token, room.code, room.player);
      done({ ok: true, code: room.code, token: room.token, player: room.player });
      broadcastState(room.code);
      broadcastPresence(room.code);
    });

    socket.on('room:join', (payload, ack) => {
      const done = safeAck<SeatAck>(ack);
      const parsed = JoinRoomSchema.safeParse(payload);
      if (!parsed.success) {
        done(failure('invalid_payload'));
        return;
      }
      if (socket.data.token) {
        done(failure('already_in_room'));
        return;
      }

      const result = manager.joinRoom(parsed.data.code);
      if (!result.ok) {
        done({ ok: false, error: result.error });
        return;
      }

      seat(socket, result.token, result.code, result.player);
      done({ ok: true, code: result.code, token: result.token, player: result.player });
      broadcastState(result.code);
      broadcastPresence(result.code);
    });

    socket.on('room:resume', (payload, ack) => {
      const done = safeAck<ResumeAck>(ack);
      const parsed = ResumeSchema.safeParse(payload);
      if (!parsed.success) {
        done(failure('invalid_payload'));
        return;
      }

      const { token } = parsed.data;
      if (socket.data.token && socket.data.token !== token) {
        done(failure('already_in_room'));
        return;
      }

      const result = manager.resume(token);
      if (!result.ok) {
        done({ ok: false, error: result.error });
        return;
      }

      const previous = activeSockets.get(token);
      seat(socket, token, result.code, result.player);
      // Старий сокет цього гравця (якщо ще живий) більше не потрібен.
      if (previous && previous !== socket.id) io.sockets.sockets.get(previous)?.disconnect(true);

      done({ ok: true, code: result.code, player: result.player });
      broadcastState(result.code);
      broadcastPresence(result.code);
    });

    socket.on('fleet:place', (payload, ack) => {
      const parsed = PlaceFleetSchema.safeParse(payload);
      if (!parsed.success) {
        safeAck<ActionAck>(ack)(failure('invalid_payload'));
        return;
      }
      act(socket, ack, (token) => manager.placeFleet(token, parsed.data.ships));
    });

    socket.on('shot:fire', (payload, ack) => {
      const parsed = FireSchema.safeParse(payload);
      if (!parsed.success) {
        safeAck<ActionAck>(ack)(failure('invalid_payload'));
        return;
      }
      act(socket, ack, (token) => manager.shoot(token, parsed.data));
    });

    socket.on('game:resign', (ack) => {
      act(socket, ack, (token) => manager.resign(token));
    });

    socket.on('game:rematch', (ack) => {
      act(socket, ack, (token) => manager.requestRematch(token));
    });

    socket.on('disconnect', () => {
      const { token } = socket.data;
      // Запізніле відключення старого сокета не повинно позначати гравця офлайн.
      if (!token || activeSockets.get(token) !== socket.id) return;

      activeSockets.delete(token);
      const ref = manager.setConnected(token, false);
      if (ref) broadcastPresence(ref.code);
    });
  });

  // Таймери ходу, технічні поразки й видалення старих кімнат.
  const sweeper = setInterval(() => {
    for (const code of manager.sweep()) broadcastState(code);
  }, sweepIntervalMs);
  sweeper.unref();

  async function close(): Promise<void> {
    clearInterval(sweeper);
    await new Promise<void>((resolve) => {
      void io.close(() => resolve());
    });
  }

  return { httpServer, io, manager, close };
}
