import { describe, expect, it } from 'vitest';
import type { PlayerId } from '@pixelfleet/engine';
import { RoomManager } from './rooms.js';
import type { RoomEnv } from './rooms.js';

const TTL = 60_000;
const GRACE = 5_000;

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

function humanFleet() {
  return [
    { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  ] as const;
}

/** Кімната з ботом і годинником, яким керує тест. Людина завжди гравець `a`. */
function setup(first: PlayerId = 'a', difficulty: 'easy' | 'normal' | 'hard' = 'normal') {
  const clock = { now: 0 };
  const random = seeded(42);
  let codeN = 0;
  let tokenN = 0;
  const env: RoomEnv = {
    randomCode: () => `ROOM${'ABCDEFGH'.charAt(codeN++)}`,
    randomToken: () => `token-${++tokenN}`,
    coinFlip: () => first,
    random,
  };
  const manager = new RoomManager(
    env,
    { turnMs: 30_000, graceMs: GRACE, roomTtlMs: TTL, botMinMs: 700, botMaxMs: 1400 },
    () => clock.now,
  );
  const room = manager.createBotRoom(difficulty);
  return { manager, clock, code: room.code, token: room.token };
}

describe('createBotRoom', () => {
  it('seats the human as player a and the bot as player b, already waiting', () => {
    const { manager, code } = setup();

    expect(manager.presence(code)).toEqual({ a: 'online', b: 'online' });
    expect(manager.views(code).a?.opponentReady).toBe(true);
    expect(manager.meta(code).a?.bot).toBe('normal');
  });

  it('does not let anyone else join the bot seat', () => {
    const { manager, code } = setup();

    expect(manager.joinRoom(code)).toEqual({ ok: false, error: { code: 'room_full' } });
  });

  it('keeps regular rooms free of a bot', () => {
    const manager = new RoomManager({
      randomCode: () => 'ROOMA',
      randomToken: () => 'token-1',
      coinFlip: () => 'a',
    });
    const room = manager.createRoom();

    expect(manager.meta(room.code).a?.bot).toBeNull();
  });
});

describe('bot turns', () => {
  it('starts the battle as soon as the human places a fleet', () => {
    const { manager, code, token } = setup('a');
    expect(manager.placeFleet(token, [...humanFleet()]).ok).toBe(true);

    expect(manager.views(code).a?.phase).toBe('battle');
    expect(manager.views(code).a?.yourTurn).toBe(true);
  });

  it('waits for the human when the human shoots first', () => {
    const { manager, clock, token } = setup('a');
    manager.placeFleet(token, [...humanFleet()]);

    clock.now = 10_000;
    expect(manager.sweep()).toEqual([]);
  });

  it('shoots by itself after a pause when it moves first', () => {
    const { manager, clock, code, token } = setup('b');
    manager.placeFleet(token, [...humanFleet()]);
    expect(manager.views(code).a?.yourTurn).toBe(false);

    clock.now = 600;
    expect(manager.sweep()).toEqual([]);

    clock.now = 1500;
    expect(manager.sweep()).toEqual([code]);
    expect(manager.views(code).a?.ownBoard?.shots).toHaveLength(1);
  });

  it('keeps the turn after a hit and passes it back after a miss', () => {
    const { manager, clock, code, token } = setup('b');
    manager.placeFleet(token, [...humanFleet()]);

    for (let i = 0; i < 30; i++) {
      const view = manager.views(code).a;
      if (view?.phase !== 'battle' || view.yourTurn) break;
      clock.now += 1500;
      manager.sweep();

      const shots = manager.views(code).a?.ownBoard?.shots ?? [];
      const last = shots[shots.length - 1];
      expect(manager.views(code).a?.yourTurn).toBe(last?.outcome === 'miss');
    }
  });

  it('never shoots the same cell twice and eventually ends a long game', () => {
    const { manager, clock, code, token } = setup('b', 'hard');
    manager.placeFleet(token, [...humanFleet()]);

    // Людина ходить по клітинках поспіль, бот відповідає за таймером.
    const cells = Array.from({ length: 100 }, (_, i) => ({ x: i % 10, y: Math.floor(i / 10) }));
    let next = 0;
    for (let step = 0; step < 600; step++) {
      const view = manager.views(code).a;
      if (view?.phase === 'finished') break;
      if (view?.yourTurn) {
        const at = cells[next++];
        if (at) manager.shoot(token, at);
      } else {
        clock.now += 1500;
        manager.sweep();
      }
    }

    const view = manager.views(code).a;
    expect(view?.phase).toBe('finished');
    const shots = view?.ownBoard?.shots ?? [];
    expect(new Set(shots.map((s) => `${s.at.x},${s.at.y}`)).size).toBe(shots.length);
  });

  it('does not limit its own turn with the turn timer', () => {
    const { manager, clock, code, token } = setup('b');
    manager.placeFleet(token, [...humanFleet()]);

    clock.now = 100_000;
    manager.sweep();

    // Бот встиг походити (а не програв за таймером).
    expect(manager.views(code).a?.phase).toBe('battle');
  });
});

describe('rematch with a bot', () => {
  it('restarts at once and the bot has its fleet ready again', () => {
    const { manager, code, token } = setup('a');
    manager.placeFleet(token, [...humanFleet()]);
    manager.resign(token);
    expect(manager.views(code).a?.phase).toBe('finished');

    expect(manager.requestRematch(token).ok).toBe(true);

    expect(manager.views(code).a?.phase).toBe('placement');
    expect(manager.views(code).a?.ownBoard).toBeNull();
    expect(manager.views(code).a?.opponentReady).toBe(true);
    expect(manager.meta(code).a?.rematch).toEqual({ you: false, opponent: false });
  });
});

describe('leaving a bot room', () => {
  it('removes the room after the TTL when the human is gone, even though the bot stays', () => {
    const { manager, clock, code, token } = setup();

    manager.setConnected(token, false);
    clock.now = TTL;
    manager.sweep();

    expect(manager.presence(code)).toBeUndefined();
    expect(manager.resume(token)).toEqual({ ok: false, error: { code: 'unknown_token' } });
  });

  it('gives the win to the bot when the human stays away too long', () => {
    const { manager, clock, code, token } = setup();
    manager.placeFleet(token, [...humanFleet()]);

    manager.setConnected(token, false);
    clock.now = GRACE;

    expect(manager.sweep()).toEqual([code]);
    expect(manager.views(code).b?.winner).toBe('b');
    expect(manager.views(code).b?.endReason).toBe('abandoned');
  });
});
