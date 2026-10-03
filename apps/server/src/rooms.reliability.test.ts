import { describe, expect, it } from 'vitest';
import type { PlacedShip, PlayerId } from '@pixelfleet/engine';
import { RoomManager } from './rooms.js';
import type { RoomEnv } from './rooms.js';

const TURN = 1000;
const GRACE = 5000;
const TTL = 60_000;

function fleet(): PlacedShip[] {
  return [
    { type: 'carrier', origin: { x: 0, y: 0 }, orientation: 'horizontal' },
    { type: 'battleship', origin: { x: 0, y: 2 }, orientation: 'horizontal' },
    { type: 'cruiser', origin: { x: 0, y: 4 }, orientation: 'horizontal' },
    { type: 'submarine', origin: { x: 0, y: 6 }, orientation: 'horizontal' },
    { type: 'destroyer', origin: { x: 0, y: 8 }, orientation: 'horizontal' },
  ];
}

/** Кімната з двома гравцями і годинником, яким керує тест. host = 'a', guest = 'b'. */
function setup(first: PlayerId = 'a') {
  const clock = { now: 0 };
  let codeN = 0;
  let tokenN = 0;
  const env: RoomEnv = {
    randomCode: () => `ROOM${'ABCDEFGH'.charAt(codeN++)}`,
    randomToken: () => `token-${++tokenN}`,
    coinFlip: () => first,
  };
  const manager = new RoomManager(
    env,
    { turnMs: TURN, graceMs: GRACE, roomTtlMs: TTL, maxSkips: 2 },
    () => clock.now,
  );

  const host = manager.createRoom();
  const guest = manager.joinRoom(host.code);
  if (!guest.ok) throw new Error('guest must be able to join');

  const room = { manager, clock, code: host.code, hostToken: host.token, guestToken: guest.token };
  return {
    ...room,
    placeBoth() {
      expect(manager.placeFleet(room.hostToken, fleet()).ok).toBe(true);
      expect(manager.placeFleet(room.guestToken, fleet()).ok).toBe(true);
    },
  };
}

describe('turn timer', () => {
  it('starts when the battle begins and counts down', () => {
    const { manager, clock, code, placeBoth } = setup();
    expect(manager.meta(code).a?.turnRemainingMs).toBeNull();

    placeBoth();
    expect(manager.meta(code).a?.turnRemainingMs).toBe(TURN);

    clock.now = 400;
    expect(manager.meta(code).a?.turnRemainingMs).toBe(600);
  });

  it('does nothing before the deadline', () => {
    const { manager, clock, placeBoth } = setup();
    placeBoth();

    clock.now = TURN - 1;
    expect(manager.sweep()).toEqual([]);
  });

  it('passes the turn when time runs out and restarts the timer', () => {
    const { manager, clock, code, guestToken, placeBoth } = setup('a');
    placeBoth();

    clock.now = TURN;
    expect(manager.sweep()).toEqual([code]);
    expect(manager.views(code).b?.yourTurn).toBe(true);
    expect(manager.meta(code).b?.turnRemainingMs).toBe(TURN);
    expect(manager.shoot(guestToken, { x: 9, y: 9 }).ok).toBe(true);
  });

  it('forfeits a player who skips two turns in a row', () => {
    const { manager, clock, code, guestToken, placeBoth } = setup('a');
    placeBoth();

    clock.now = TURN;
    manager.sweep(); // a пропустив перший хід
    manager.shoot(guestToken, { x: 9, y: 9 }); // b промахнувся, хід знову в a

    clock.now = TURN * 2;
    expect(manager.sweep()).toEqual([code]);

    const view = manager.views(code).b;
    expect(view?.phase).toBe('finished');
    expect(view?.winner).toBe('b');
    expect(view?.endReason).toBe('timeout');
    expect(manager.meta(code).b?.turnRemainingMs).toBeNull();
  });

  it('resets the skip counter after a shot', () => {
    const { manager, clock, code, hostToken, guestToken, placeBoth } = setup('a');
    placeBoth();

    clock.now = TURN;
    manager.sweep(); // a: пропуск 1, хід b
    manager.shoot(guestToken, { x: 9, y: 9 }); // промах, хід a
    manager.shoot(hostToken, { x: 9, y: 8 }); // a стрільнув, лічильник скинуто, хід b

    clock.now = TURN * 2;
    manager.sweep(); // b: пропуск 1, хід a
    clock.now = TURN * 3;
    manager.sweep(); // a: знову пропуск 1, а не 2

    expect(manager.views(code).a?.phase).toBe('battle');
  });
});

describe('disconnects', () => {
  it('forfeits a player who stays offline longer than the grace period', () => {
    const { manager, clock, code, hostToken } = setup();

    manager.setConnected(hostToken, false);
    clock.now = GRACE - 1;
    expect(manager.sweep()).toEqual([]);

    clock.now = GRACE;
    expect(manager.sweep()).toEqual([code]);

    const view = manager.views(code).b;
    expect(view?.winner).toBe('b');
    expect(view?.endReason).toBe('abandoned');
  });

  it('does not forfeit anyone when both players are offline', () => {
    const { manager, clock, code, hostToken, guestToken } = setup();

    manager.setConnected(hostToken, false);
    manager.setConnected(guestToken, false);
    clock.now = GRACE * 2;

    expect(manager.sweep()).toEqual([]);
    expect(manager.views(code).a?.phase).toBe('placement');
  });

  it('cancels the countdown when the player comes back in time', () => {
    const { manager, clock, hostToken } = setup();

    manager.setConnected(hostToken, false);
    clock.now = GRACE - 1000;
    expect(manager.resume(hostToken).ok).toBe(true);

    clock.now = GRACE * 3;
    expect(manager.sweep()).toEqual([]);
  });
});

describe('room cleanup', () => {
  it('removes a room nobody is connected to after the TTL', () => {
    const { manager, clock, code, hostToken, guestToken } = setup();

    manager.setConnected(hostToken, false);
    manager.setConnected(guestToken, false);
    clock.now = TTL;
    manager.sweep();

    expect(manager.presence(code)).toBeUndefined();
    expect(manager.resume(hostToken)).toEqual({ ok: false, error: { code: 'unknown_token' } });
  });

  it('keeps a room while somebody is connected', () => {
    const { manager, clock, code } = setup();

    clock.now = TTL * 2;
    expect(manager.sweep()).toEqual([]);
    expect(manager.presence(code)).toEqual({ a: 'online', b: 'online' });
  });
});

describe('rematch', () => {
  it('is refused while the game is still going', () => {
    const { manager, hostToken } = setup();

    expect(manager.requestRematch(hostToken)).toEqual({
      ok: false,
      error: { code: 'wrong_phase' },
    });
  });

  it('rejects an unknown token', () => {
    const { manager } = setup();

    expect(manager.requestRematch('nope')).toEqual({
      ok: false,
      error: { code: 'unknown_token' },
    });
  });

  it('waits for both players, then restarts with the other player moving first', () => {
    const { manager, code, hostToken, guestToken, placeBoth } = setup('a');
    placeBoth();
    manager.resign(hostToken);

    expect(manager.requestRematch(hostToken).ok).toBe(true);
    expect(manager.meta(code).a?.rematch).toEqual({ you: true, opponent: false });
    expect(manager.meta(code).b?.rematch).toEqual({ you: false, opponent: true });
    expect(manager.views(code).a?.phase).toBe('finished');

    expect(manager.requestRematch(guestToken).ok).toBe(true);
    expect(manager.views(code).a?.phase).toBe('placement');
    expect(manager.views(code).a?.ownBoard).toBeNull();
    expect(manager.meta(code).a?.rematch).toEqual({ you: false, opponent: false });

    placeBoth();
    expect(manager.views(code).b?.yourTurn).toBe(true);
  });
});
