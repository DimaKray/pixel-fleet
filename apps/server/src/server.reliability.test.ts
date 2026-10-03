import type { AddressInfo } from 'node:net';
import { io as connect } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GameView, PlacedShip } from '@pixelfleet/engine';
import type {
  ActionAck,
  ClientToServerEvents,
  RoomMeta,
  SeatAck,
  ServerToClientEvents,
} from '@pixelfleet/protocol';
import type { RoomConfig, RoomEnv } from './rooms.js';
import { createGameServer } from './server.js';

type ClientSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

interface TestClient {
  socket: ClientSocket;
  states: GameView[];
  metas: RoomMeta[];
}

const cleanups: (() => Promise<void> | void)[] = [];

afterEach(async () => {
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

function ask<T>(send: (callback: (reply: T) => void) => void): Promise<T> {
  return new Promise((resolve) => send(resolve));
}

async function connectClient(url: string): Promise<TestClient> {
  const socket: ClientSocket = connect(url, { transports: ['websocket'], forceNew: true });
  const client: TestClient = { socket, states: [], metas: [] };

  socket.on('game:state', (view) => client.states.push(view));
  socket.on('room:meta', (meta) => client.metas.push(meta));
  cleanups.push(() => {
    socket.disconnect();
  });

  await new Promise<void>((resolve) => socket.on('connect', () => resolve()));
  return client;
}

/** Двоє гравців у кімнаті, обидва вже розставили флот. Першим ходить host. */
async function battle(config: Partial<RoomConfig> = {}) {
  let codeN = 0;
  let tokenN = 0;
  const env: RoomEnv = {
    randomCode: () => `ROOM${'ABCDEFGH'.charAt(codeN++)}`,
    randomToken: () => `token-${++tokenN}`,
    coinFlip: () => 'a',
  };

  const server = createGameServer({ clientOrigin: '*', env, config, sweepIntervalMs: 25 });
  await new Promise<void>((resolve) => server.httpServer.listen(0, resolve));
  cleanups.push(() => server.close());
  const { port } = server.httpServer.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  const host = await connectClient(url);
  const created = await ask<SeatAck>((cb) => host.socket.emit('room:create', cb));
  if (!created.ok) throw new Error('room creation failed');

  const guest = await connectClient(url);
  const joined = await ask<SeatAck>((cb) =>
    guest.socket.emit('room:join', { code: created.code }, cb),
  );
  if (!joined.ok) throw new Error('joining failed');

  await ask<ActionAck>((cb) => host.socket.emit('fleet:place', { ships: fleet() }, cb));
  await ask<ActionAck>((cb) => guest.socket.emit('fleet:place', { ships: fleet() }, cb));

  return { host, guest };
}

describe('turn timer over the socket', () => {
  it('announces the remaining time when the battle starts', async () => {
    const { host } = await battle();

    await vi.waitFor(() => expect(host.metas.at(-1)?.turnRemainingMs).toBeGreaterThan(0));
    expect(host.metas.at(-1)?.turnRemainingMs).toBeLessThanOrEqual(60_000);
  });

  it('passes the turn on its own when time runs out', async () => {
    const { host } = await battle({ turnMs: 200 });

    await vi.waitFor(() => expect(host.states.some((state) => state.yourTurn)).toBe(true));
    await vi.waitFor(() => expect(host.states.at(-1)?.yourTurn).toBe(false));
  });
});

describe('rematch over the socket', () => {
  it('is refused while the game is still going', async () => {
    const { host } = await battle();

    const reply = await ask<ActionAck>((cb) => host.socket.emit('game:rematch', cb));
    expect(reply).toEqual({ ok: false, error: { code: 'wrong_phase' } });
  });

  it('restarts the placement once both players ask for it', async () => {
    const { host, guest } = await battle();

    await ask<ActionAck>((cb) => host.socket.emit('game:resign', cb));
    await vi.waitFor(() => expect(guest.states.at(-1)?.phase).toBe('finished'));

    expect(await ask<ActionAck>((cb) => host.socket.emit('game:rematch', cb))).toEqual({
      ok: true,
    });
    await vi.waitFor(() =>
      expect(guest.metas.at(-1)?.rematch).toEqual({ you: false, opponent: true }),
    );

    await ask<ActionAck>((cb) => guest.socket.emit('game:rematch', cb));
    await vi.waitFor(() => expect(host.states.at(-1)?.phase).toBe('placement'));
    expect(host.states.at(-1)?.ownBoard).toBeNull();
  });
});
