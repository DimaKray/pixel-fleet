import { describe, expect, it } from 'vitest';
import type { PlacedShip, PlayerId } from '@pixelfleet/engine';
import { RoomManager } from './rooms.js';
import type { RoomEnv } from './rooms.js';

function testEnv(first: PlayerId = 'a', codes: string[] = []): RoomEnv {
  let codeN = 0;
  let tokenN = 0;
  return {
    randomCode: () => codes.shift() ?? `ROOM${++codeN}`,
    randomToken: () => `token-${++tokenN}`,
    coinFlip: () => first,
  };
}

function fleet(): PlacedShip[] {
  return [
    { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  ];
}

/** Кімната з двома гравцями: host = 'a', guest = 'b'. */
function twoPlayers(first: PlayerId = 'a') {
  const manager = new RoomManager(testEnv(first));
  const host = manager.createRoom();
  const guest = manager.joinRoom(host.code);
  if (!guest.ok) throw new Error('guest must be able to join');
  return { manager, code: host.code, hostToken: host.token, guestToken: guest.token };
}

describe('createRoom', () => {
  it('seats the creator as player a and waits for the opponent', () => {
    const manager = new RoomManager(testEnv());
    const room = manager.createRoom();

    expect(room).toEqual({ ok: true, code: 'ROOM1', token: 'token-1', player: 'a' });
    expect(manager.presence('ROOM1')).toEqual({ a: 'online', b: 'empty' });
  });

  it('never reuses a code that is already taken', () => {
    const manager = new RoomManager(testEnv('a', ['ROOM1', 'ROOM1', 'ROOM2']));

    expect(manager.createRoom().code).toBe('ROOM1');
    expect(manager.createRoom().code).toBe('ROOM2');
  });
});

describe('joinRoom', () => {
  it('seats the guest as player b', () => {
    const manager = new RoomManager(testEnv());
    const { code } = manager.createRoom();

    expect(manager.joinRoom(code)).toEqual({ ok: true, code, token: 'token-2', player: 'b' });
    expect(manager.presence(code)).toEqual({ a: 'online', b: 'online' });
  });

  it('fails for an unknown room', () => {
    const manager = new RoomManager(testEnv());

    expect(manager.joinRoom('NOPE1')).toEqual({ ok: false, error: { code: 'room_not_found' } });
  });

  it('fails when the room is already full', () => {
    const { manager, code } = twoPlayers();

    expect(manager.joinRoom(code)).toEqual({ ok: false, error: { code: 'room_full' } });
  });
});

describe('connection state', () => {
  it('marks a player offline and back online after resume', () => {
    const { manager, code, hostToken } = twoPlayers();

    manager.setConnected(hostToken, false);
    expect(manager.presence(code)).toEqual({ a: 'offline', b: 'online' });

    expect(manager.resume(hostToken)).toEqual({ ok: true, code, player: 'a' });
    expect(manager.presence(code)).toEqual({ a: 'online', b: 'online' });
  });

  it('rejects an unknown token', () => {
    const manager = new RoomManager(testEnv());

    expect(manager.resume('nope')).toEqual({ ok: false, error: { code: 'unknown_token' } });
  });
});

describe('actions', () => {
  it('rejects actions with an unknown token', () => {
    const manager = new RoomManager(testEnv());
    const unknown = { ok: false, error: { code: 'unknown_token' } };

    expect(manager.placeFleet('nope', fleet())).toEqual(unknown);
    expect(manager.shoot('nope', { x: 0, y: 0 })).toEqual(unknown);
    expect(manager.resign('nope')).toEqual(unknown);
  });

  it('plays from placement to the first shots, respecting turn order', () => {
    const { manager, hostToken, guestToken } = twoPlayers('b');

    expect(manager.placeFleet(hostToken, fleet()).ok).toBe(true);
    expect(manager.placeFleet(guestToken, fleet()).ok).toBe(true);

    // Першим ходить b (guest).
    expect(manager.shoot(hostToken, { x: 9, y: 9 })).toEqual({
      ok: false,
      error: { code: 'not_your_turn' },
    });

    const miss = manager.shoot(guestToken, { x: 9, y: 9 });
    expect(miss.ok && miss.shot.outcome).toBe('miss');

    // Після промаху черга переходить до host.
    expect(manager.shoot(hostToken, { x: 0, y: 0 }).ok).toBe(true);
  });
});

describe('views', () => {
  it('returns views only for seated players', () => {
    const manager = new RoomManager(testEnv());
    const { code } = manager.createRoom();

    expect(Object.keys(manager.views(code))).toEqual(['a']);
  });

  it('does not leak a fleet to the opponent during placement', () => {
    const { manager, code, hostToken } = twoPlayers();
    manager.placeFleet(hostToken, fleet());

    const views = manager.views(code);
    expect(views.a?.ownBoard).not.toBeNull();
    expect(views.b?.opponentReady).toBe(true);
    expect(JSON.stringify(views.b)).not.toContain('carrier');
  });
});
