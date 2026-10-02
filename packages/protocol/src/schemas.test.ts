import { describe, expect, it } from 'vitest';
import type { PlacedShip } from '@pixelfleet/engine';
import { FireSchema, JoinRoomSchema, PlaceFleetSchema } from './schemas.js';

describe('JoinRoomSchema', () => {
  it('normalizes the room code', () => {
    const parsed = JoinRoomSchema.safeParse({ code: '  abcde ' });
    expect(parsed.success && parsed.data.code).toBe('ABCDE');
  });

  it('rejects malformed room codes', () => {
    expect(JoinRoomSchema.safeParse({ code: 'ABC' }).success).toBe(false);
    expect(JoinRoomSchema.safeParse({ code: 'ABCDEF' }).success).toBe(false);
    expect(JoinRoomSchema.safeParse({ code: 'AB-DE' }).success).toBe(false);
    expect(JoinRoomSchema.safeParse({}).success).toBe(false);
  });
});

describe('FireSchema', () => {
  it('accepts integer coordinates', () => {
    expect(FireSchema.safeParse({ x: 3, y: 7 }).success).toBe(true);
  });

  it('rejects fractions, strings, NaN and extra fields', () => {
    expect(FireSchema.safeParse({ x: 1.5, y: 2 }).success).toBe(false);
    expect(FireSchema.safeParse({ x: '1', y: 2 }).success).toBe(false);
    expect(FireSchema.safeParse({ x: Number.NaN, y: 2 }).success).toBe(false);
    expect(FireSchema.safeParse({ x: 1, y: 2, extra: true }).success).toBe(false);
  });
});

describe('PlaceFleetSchema', () => {
  const ship = { type: 'destroyer', origin: { x: 0, y: 0 }, orientation: 'horizontal' };

  it('accepts the expected shape and matches the engine type', () => {
    const parsed = PlaceFleetSchema.safeParse({ ships: [ship] });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      const ships: PlacedShip[] = parsed.data.ships; // compile-time check
      expect(ships).toHaveLength(1);
    }
  });

  it('rejects unknown ship types and orientations', () => {
    expect(PlaceFleetSchema.safeParse({ ships: [{ ...ship, type: 'raft' }] }).success).toBe(false);
    expect(
      PlaceFleetSchema.safeParse({ ships: [{ ...ship, orientation: 'diagonal' }] }).success,
    ).toBe(false);
  });

  it('rejects an oversized payload', () => {
    expect(PlaceFleetSchema.safeParse({ ships: Array(11).fill(ship) }).success).toBe(false);
  });
});
