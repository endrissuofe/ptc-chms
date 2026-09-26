import { describe, it, expect } from 'vitest';
import {
  clampCount,
  isUnusualChange,
  percentChange,
  totalCount,
  MAX_COUNT,
} from '@/lib/attendance';

describe('clampCount', () => {
  it('keeps typed and tapped counts to whole numbers from 0 up to the limit', () => {
    expect(clampCount('42')).toBe(42);
    expect(clampCount(7.9)).toBe(7);
    expect(clampCount(-1)).toBe(0);
    expect(clampCount('')).toBe(0);
    expect(clampCount('abc')).toBe(0);
    expect(clampCount(MAX_COUNT + 5)).toBe(MAX_COUNT);
  });
});

describe('totalCount', () => {
  it('adds the four groups', () => {
    expect(totalCount({ men: 40, women: 60, teens: 10, children: 20 })).toBe(130);
    expect(totalCount({ men: 5 })).toBe(5);
  });
});

describe('percentChange', () => {
  it('compares with the previous count, or gives null when there is none', () => {
    expect(percentChange(110, 100)).toBe(10);
    expect(percentChange(90, 120)).toBe(-25);
    expect(percentChange(50, 0)).toBeNull();
    expect(percentChange(50, undefined)).toBeNull();
  });
});

describe('isUnusualChange', () => {
  it('flags swings of 50% or more, which are usually typos', () => {
    expect(isUnusualChange(524)).toBe(true);
    expect(isUnusualChange(-50)).toBe(true);
    expect(isUnusualChange(-4)).toBe(false);
    expect(isUnusualChange(null)).toBe(false);
  });
});
