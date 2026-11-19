import { describe, expect, it } from 'vitest';
import { meetsMinimumResolution } from '../utils/viewport';

describe('meetsMinimumResolution', () => {
  it('accepts exactly 1024x768 and larger', () => {
    expect(meetsMinimumResolution(1024, 768)).toBe(true);
    expect(meetsMinimumResolution(1920, 1080)).toBe(true);
  });

  it('rejects either dimension below the minimum', () => {
    expect(meetsMinimumResolution(1023, 768)).toBe(false);
    expect(meetsMinimumResolution(1024, 767)).toBe(false);
  });
});
