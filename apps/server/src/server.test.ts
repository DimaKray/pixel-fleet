import type { AddressInfo } from 'node:net';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView, PlacedShip, PlayerId } from '@pixelfleet/engine';
import type {
  ActionAck,
  ClientToServerEvents,
  Presence,
  ResumeAck,
  SeatAck,
  ServerToClientEvents,
} from '@pixelfleet/protocol';
import type { RoomEnv } from './rooms.js';
import { createGameServer } from './server.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TestClient {
  socket: ClientSocket;
  states: GameView[];
  presence: Presence[];
}

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
  // Спочатку закриваємо клієнтів, потім сервер.
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

function fleet(): PlacedShip[] {
  return [
    { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  ];
}

/** Перетворює виклик із колбеком на проміс. */
function ask<T>(send: (callback: (reply: T) => void) => void): Promise<T> {
  return new Promise((resolve) => send(resolve));
}

async function startServer(first: PlayerId = 'a') {
  let codeN = 0;
  let tokenN = 0;
  const env: RoomEnv = {
    // Коди мають проходити схему кімнати: 5 символів із A-Z та 2-9 (без 0, 1, O, I).
    randomCode: () => `ROOM${'ABCDEFGH'.charAt(codeN++)}`,
    randomToken: () => `token-${++tokenN}`,
    coinFlip: () => first,
  };

  const server = createGameServer({ clientOrigin: '*', env });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  cleanups.push(() => server.close());

  const { port } = server.httpServer.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}` };
}

async function connectClient(url: string): Promise<TestClient> {
  const socket: ClientSocket = connect(url, { transports: ['websocket'], forceNew: true });
  const client: TestClient = { socket, states: [], presence: [] };

  socket.on('game:state', (view) => client.states.push(view));
  socket.on('opponent:presence', (status) => client.presence.push(status));
  cleanups.push(() => {
    socket.disconnect();
  });

  await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
  return client;
}

/** Кімната з двома гравцями: host = 'a', guest = 'b'. */
async function twoPlayers(first: PlayerId = 'a') {
  const server = await startServer(first);

  const host = await connectClient(server.url);
  const created = await ask<SeatAck>((cb) => host.socket.emit('room:create', cb));
  if (!created.ok) throw new Error('room creation failed');

  const guest = await connectClient(server.url);
  const joined = await ask<SeatAck>((cb) =>
    guest.socket.emit('room:join', { code: created.code }, cb),
  );
  if (!joined.ok) throw new Error('joining failed');

  return { server, host, guest, code: created.code, hostToken: created.token };
}

describe('rooms over the socket', () => {
  it('creates a room and lets a guest join', async () => {
    const server = await startServer();
    const host = await connectClient(server.url);

    const created = await ask<SeatAck>((cb) => host.socket.emit('room:create', cb));
    expect(created).toEqual({ ok: true, code: 'ROOMA', token: 'token-1', player: 'a' });

    await vi.waitFor(() => expect(host.states).toHaveLength(1));
    expect(host.states[0]?.phase).toBe('placement');
    expect(host.presence).toEqual(['empty']);

    const guest = await connectClient(server.url);
    // Код з малими літерами: сервер має нормалізувати регістр.
    const joined = await ask<SeatAck>((cb) =>
      guest.socket.emit('room:join', { code: 'rooma' }, cb),
    );
    expect(joined).toEqual({ ok: true, code: 'ROOMA', token: 'token-2', player: 'b' });

    await vi.waitFor(() => expect(host.presence.at(-1)).toBe('online'));
    await vi.waitFor(() => expect(guest.states.at(-1)?.you).toBe('b'));
  });

  it('rejects malformed payloads and unknown rooms', async () => {
    const server = await startServer();
    const client = await connectClient(server.url);

    const malformed = await ask<SeatAck>((cb) =>
      client.socket.emit('room:join', { code: 'x' }, cb),
    );
    expect(malformed).toEqual({ ok: false, error: { code: 'invalid_payload' } });

    const unknown = await ask<SeatAck>((cb) =>
      client.socket.emit('room:join', { code: 'ZZZZZ' }, cb),
    );
    expect(unknown).toEqual({ ok: false, error: { code: 'room_not_found' } });
  });

  it('refuses actions from a socket that is not seated in a room', async () => {
    const server = await startServer();
    const client = await connectClient(server.url);
    const notInRoom = { ok: false, error: { code: 'not_in_room' } };

    expect(
      await ask<ActionAck>((cb) => client.socket.emit('fleet:place', { ships: fleet() }, cb)),
    ).toEqual(notInRoom);
    expect(
      await ask<ActionAck>((cb) => client.socket.emit('shot:fire', { x: 0, y: 0 }, cb)),
    ).toEqual(notInRoom);
    expect(await ask<ActionAck>((cb) => client.socket.emit('game:resign', cb))).toEqual(notInRoom);
  });
});

describe('a full game over the socket', () => {
  it('runs from placement to shots and never leaks the enemy fleet', async () => {
    const { host, guest } = await twoPlayers('a');

    const placedHost = await ask<ActionAck>((cb) =>
      host.socket.emit('fleet:place', { ships: fleet() }, cb),
    );
    const placedGuest = await ask<ActionAck>((cb) =>
      guest.socket.emit('fleet:place', { ships: fleet() }, cb),
    );
    expect(placedHost).toEqual({ ok: true });
    expect(placedGuest).toEqual({ ok: true });

    await vi.waitFor(() => expect(host.states.at(-1)?.phase).toBe('battle'));

    // Першим ходить host, тому постріл guest має бути відхилений.
    const early = await ask<ActionAck>((cb) => guest.socket.emit('shot:fire', { x: 9, y: 9 }, cb));
    expect(early).toEqual({ ok: false, error: { code: 'not_your_turn' } });

    const hit = await ask<ActionAck>((cb) => host.socket.emit('shot:fire', { x: 0, y: 0 }, cb));
    expect(hit).toEqual({ ok: true });

    // Захисник бачить влучання на своєму полі...
    await vi.waitFor(() =>
      expect(guest.states.at(-1)?.ownBoard?.shots).toEqual([
        { at: { x: 0, y: 0 }, outcome: 'hit' },
      ]),
    );

    // ...а нападник бачить лише результат, без розстановки.
    await vi.waitFor(() => expect(host.states.at(-1)?.opponentBoard?.shots).toHaveLength(1));
    const hostView = host.states.at(-1);
    expect(hostView?.yourTurn).toBe(true);
    expect(JSON.stringify(hostView?.opponentBoard)).not.toContain('carrier');
  });
});

describe('reconnecting', () => {
  it('marks a player offline, then restores the state on resume', async () => {
    const { server, host, guest, code, hostToken } = await twoPlayers();
    await ask<ActionAck>((cb) => host.socket.emit('fleet:place', { ships: fleet() }, cb));

    host.socket.disconnect();
    await vi.waitFor(() => expect(guest.presence.at(-1)).toBe('offline'));

    const returning = await connectClient(server.url);
    const resumed = await ask<ResumeAck>((cb) =>
      returning.socket.emit('room:resume', { token: hostToken }, cb),
    );
    expect(resumed).toEqual({ ok: true, code, player: 'a' });

    await vi.waitFor(() => expect(guest.presence.at(-1)).toBe('online'));
    await vi.waitFor(() => expect(returning.states.at(-1)?.ownBoard?.ships).toHaveLength(5));
  });

  it('rejects an unknown token', async () => {
    const server = await startServer();
    const client = await connectClient(server.url);

    const resumed = await ask<ResumeAck>((cb) =>
      client.socket.emit('room:resume', { token: 'nope' }, cb),
    );
    expect(resumed).toEqual({ ok: false, error: { code: 'unknown_token' } });
  });

  it('does not mark a player offline when a replaced socket disconnects late', async () => {
    const { server, host, guest, hostToken } = await twoPlayers();
    const kicked = new Promise<void>((resolve) => host.socket.on('disconnect', () => resolve()));

    const second = await connectClient(server.url);
    const resumed = await ask<ResumeAck>((cb) =>
      second.socket.emit('room:resume', { token: hostToken }, cb),
    );
    expect(resumed.ok).toBe(true);

    await kicked;
    await vi.waitFor(() => expect(guest.presence.at(-1)).toBe('online'));
    expect(guest.presence).not.toContain('offline');
  });
});
