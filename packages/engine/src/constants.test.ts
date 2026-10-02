import { describe, expect, it } from 'vitest';
import { FLEET } from './constants.js';

describe('FLEET', () => {
  it('has 5 ships occupying 17 cells in total', () => {
    expect(FLEET).toHaveLength(5);
    expect(FLEET.reduce((sum, s) => sum + s.size, 0)).toBe(17);
  });
});
