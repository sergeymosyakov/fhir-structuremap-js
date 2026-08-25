import { describe, it, expect } from 'vitest';
import { checkCardinality } from '../../src/engine/cardinality.js';
import { EngineError } from '../../src/engine/errors.js';

describe('checkCardinality', () => {
  it('does nothing when neither min nor max is specified', () => {
    expect(() => checkCardinality([1, 2, 3], { context: 'src' })).not.toThrow();
  });

  it('throws when fewer than min elements are found', () => {
    expect(() => checkCardinality([1], { context: 'src', element: 'x', min: 2 }))
      .toThrow(/expected at least 2 element\(s\), found 1/);
  });

  it('throws when more than max elements are found', () => {
    expect(() => checkCardinality([1, 2, 3], { context: 'src', element: 'x', max: 2 }))
      .toThrow(EngineError);
    expect(() => checkCardinality([1, 2, 3], { context: 'src', element: 'x', max: 2 }))
      .toThrow(/expected at most 2 element\(s\), found 3/);
  });

  it('treats max "*" as unbounded', () => {
    expect(() => checkCardinality([1, 2, 3, 4], { context: 'src', max: '*' })).not.toThrow();
  });
});
