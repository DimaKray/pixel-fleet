import { describe, expect, it } from 'vitest';
import type { GameView, Shot } from '@pixelfleet/engine';
import { soundsForTransition } from './cues';

const shot = (outcome: Shot['outcome'], x = 0): Shot => ({ at: { x, y: 0 }, outcome });

function view(overrides: Partial<GameView> = {}): GameView {
  return {
    phase: 'battle',
    you: 'a',
    yourTurn: true,
    winner: null,
    endReason: null,
    ownBoard: { ships: [], shots: [] },
    opponentBoard: { shots: [], sunkShips: [], shipsRemaining: 5 },
    opponentReady: true,
    opponentFleet: null,
    ...overrides,
  };
}

const mine = (shots: Shot[]): Partial<GameView> => ({
  opponentBoard: { shots, sunkShips: [], shipsRemaining: 5 },
});
const theirs = (shots: Shot[]): Partial<GameView> => ({ ownBoard: { ships: [], shots } });

describe('soundsForTransition', () => {
  it('is silent for the very first state', () => {
    expect(soundsForTransition(null, view())).toEqual([]);
  });

  it('is silent when nothing changed', () => {
    expect(soundsForTransition(view(), view())).toEqual([]);
  });

  it('plays the start horn when the battle begins', () => {
    const prev = view({ phase: 'placement', yourTurn: false });
    expect(soundsForTransition(prev, view())).toEqual([{ name: 'start', delayMs: 0 }]);
  });

  it('plays a cannon and a splash for my miss', () => {
    const next = view({ ...mine([shot('miss')]), yourTurn: true });
    expect(soundsForTransition(view(), next)).toEqual([
      { name: 'fire', delayMs: 0 },
      { name: 'splash', delayMs: 220 },
    ]);
  });

  it('plays the impact of an enemy hit on my board', () => {
    const next = view(theirs([shot('hit')]));
    expect(soundsForTransition(view(), next)).toEqual([
      { name: 'fire', delayMs: 0 },
      { name: 'hit', delayMs: 220 },
    ]);
  });

  it('distinguishes a sunk ship', () => {
    const next = view(mine([shot('sunk')]));
    expect(soundsForTransition(view(), next).map((c) => c.name)).toEqual(['fire', 'sunk']);
  });

  it('pings when the turn passes to me after the opponent missed', () => {
    const prev = view({ yourTurn: false });
    const next = view({ ...theirs([shot('miss')]), yourTurn: true });
    expect(soundsForTransition(prev, next).map((c) => c.name)).toEqual(['fire', 'splash', 'turn']);
  });

  it('pings the turn right away when it changed without a shot (timeout)', () => {
    const prev = view({ yourTurn: false });
    expect(soundsForTransition(prev, view({ yourTurn: true }))).toEqual([
      { name: 'turn', delayMs: 0 },
    ]);
  });

  it('does not ping when the turn goes to the opponent', () => {
    const next = view({ ...mine([shot('miss')]), yourTurn: false });
    expect(soundsForTransition(view(), next).map((c) => c.name)).toEqual(['fire', 'splash']);
  });

  it('plays the final shot and then the victory jingle', () => {
    const next = view({ ...mine([shot('sunk')]), phase: 'finished', winner: 'a', yourTurn: false });
    expect(soundsForTransition(view(), next)).toEqual([
      { name: 'fire', delayMs: 0 },
      { name: 'sunk', delayMs: 220 },
      { name: 'win', delayMs: 1100 },
    ]);
  });

  it('plays the defeat sound when the opponent wins', () => {
    const next = view({ phase: 'finished', winner: 'b', yourTurn: false });
    expect(soundsForTransition(view(), next)).toEqual([{ name: 'lose', delayMs: 0 }]);
  });

  it('is silent when a rematch resets the game', () => {
    const prev = view({ phase: 'finished', winner: 'a' });
    expect(soundsForTransition(prev, view({ phase: 'placement', ownBoard: null }))).toEqual([]);
  });

  it('plays only the latest shots after a burst (reconnect)', () => {
    const burst = [shot('miss', 1), shot('miss', 2), shot('hit', 3), shot('sunk', 4)];
    const cues = soundsForTransition(view(), view(mine(burst)));

    expect(cues.map((c) => c.name)).toEqual(['fire', 'hit', 'fire', 'sunk']);
    expect(cues.map((c) => c.delayMs)).toEqual([0, 220, 600, 820]);
  });
});
