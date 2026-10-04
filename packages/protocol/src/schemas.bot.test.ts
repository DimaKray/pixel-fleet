import { describe, expect, it } from 'vitest';
import { CreateBotSchema } from './schemas.js';

describe('CreateBotSchema', () => {
  it('accepts the three difficulty levels', () => {
    for (const difficulty of ['easy', 'normal', 'hard']) {
      expect(CreateBotSchema.safeParse({ difficulty }).success).toBe(true);
    }
  });

  it('rejects unknown levels, a missing level and extra fields', () => {
    expect(CreateBotSchema.safeParse({ difficulty: 'impossible' }).success).toBe(false);
    expect(CreateBotSchema.safeParse({}).success).toBe(false);
    expect(CreateBotSchema.safeParse({ difficulty: 'easy', extra: 1 }).success).toBe(false);
  });
});
