import { describe, it, expect } from 'vitest';
import { applySourceListMode } from '../../src/engine/list-mode.js';
import { EngineError } from '../../src/engine/errors.js';

describe('applySourceListMode', () => {
  it('returns items unchanged when no listMode is given', () => {
    expect(applySourceListMode([1, 2, 3], undefined)).toEqual([1, 2, 3]);
  });

  it('applies each known mode', () => {
    expect(applySourceListMode([1, 2, 3], 'first')).toEqual([1]);
    expect(applySourceListMode([1, 2, 3], 'not_first')).toEqual([2, 3]);
    expect(applySourceListMode([1, 2, 3], 'last')).toEqual([3]);
    expect(applySourceListMode([1, 2, 3], 'not_last')).toEqual([1, 2]);
    expect(applySourceListMode([1], 'only_one')).toEqual([1]);
    expect(applySourceListMode([1, 2], 'only_one')).toEqual([]);
  });

  it('throws for an unknown listMode', () => {
    expect(() => applySourceListMode([1], 'bogus')).toThrow(EngineError);
  });
});
