import { describe, expect, it } from 'vitest';
import { portraits } from './assets';
import { captainsFor, opponentPortrait } from './avatars';

const codes = ['ROOMA', 'WRYKT', 'K3M9X', 'ABCDE', 'ZZZZ2', 'HJ7QP', 'N4T8V', 'C2D5F'];

describe('captainsFor', () => {
  it('is the same on every call, so both clients agree', () => {
    for (const code of codes) expect(captainsFor(code)).toEqual(captainsFor(code));
  });

  it('never gives both players the same captain', () => {
    for (const code of codes) {
      const { a, b } = captainsFor(code);
      expect(a).not.toBe(b);
    }
  });

  it('only uses known portraits', () => {
    for (const code of codes) {
      const { a, b } = captainsFor(code);
      expect(portraits).toContain(a);
      expect(portraits).toContain(b);
    }
  });

  it('varies between rooms', () => {
    expect(new Set(codes.map((code) => captainsFor(code).a)).size).toBeGreaterThan(1);
  });
});

describe('opponentPortrait', () => {
  it('shows each player the other captain', () => {
    const captains = captainsFor('WRYKT');
    expect(opponentPortrait('WRYKT', 'a')).toBe(captains.b);
    expect(opponentPortrait('WRYKT', 'b')).toBe(captains.a);
  });
});
