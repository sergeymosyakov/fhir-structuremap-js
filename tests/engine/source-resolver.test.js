import { describe, it, expect, vi } from 'vitest';
import { VariableScope } from '../../src/engine/scope.js';
import { resolveSource } from '../../src/engine/source-resolver.js';
import { EngineError } from '../../src/engine/errors.js';
import { RuleSource } from '../../src/model/rule-source.js';
import { realEvaluator } from './real-evaluator.js';

function scopeWith(vars) {
  const scope = new VariableScope();
  for (const [k, v] of Object.entries(vars)) scope.set(k, v);
  return scope;
}

const ctx = { evaluator: realEvaluator };

describe('resolveSource', () => {
  it('throws if the context variable is unbound', () => {
    const scope = new VariableScope();
    const rs = RuleSource.fromJSON({ context: 'src' });
    expect(() => resolveSource(rs, scope, ctx)).toThrow(/not bound/);
  });

  it('resolves the context itself when no element is given', () => {
    const scope = scopeWith({ src: { a: 1 } });
    const rs = RuleSource.fromJSON({ context: 'src' });
    expect(resolveSource(rs, scope, ctx)).toEqual([{ a: 1 }]);
  });

  it('resolves a repeating element to all its values', () => {
    const scope = scopeWith({ src: { name: ['Alice', 'Bob'] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'name' });
    expect(resolveSource(rs, scope, ctx)).toEqual(['Alice', 'Bob']);
  });

  it('filters by type using resourceType when a type is specified', () => {
    const scope = scopeWith({ src: { item: [{ resourceType: 'Patient' }, { resourceType: 'Observation' }] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'item', type: 'Patient' });
    expect(resolveSource(rs, scope, ctx)).toEqual([{ resourceType: 'Patient' }]);
  });

  it('raises an EngineError when cardinality is violated', () => {
    const scope = scopeWith({ src: { name: ['Alice'] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'name', min: 2 });
    expect(() => resolveSource(rs, scope, ctx)).toThrow(EngineError);
  });

  it.each([
    ['first', ['a']],
    ['not_first', ['b', 'c']],
    ['last', ['c']],
    ['not_last', ['a', 'b']],
  ])('applies listMode "%s"', (listMode, expected) => {
    const scope = scopeWith({ src: { v: ['a', 'b', 'c'] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'v', listMode });
    expect(resolveSource(rs, scope, ctx)).toEqual(expected);
  });

  it('"only_one" fires when there is exactly one, else the rule does not fire', () => {
    const one = scopeWith({ src: { v: ['a'] } });
    const many = scopeWith({ src: { v: ['a', 'b'] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'v', listMode: 'only_one' });
    expect(resolveSource(rs, one, ctx)).toEqual(['a']);
    expect(resolveSource(rs, many, ctx)).toEqual([]);
  });

  it('falls back to defaultValue only when nothing matched', () => {
    const scope = scopeWith({ src: {} });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'missing', defaultValue: "'fallback'" });
    expect(resolveSource(rs, scope, ctx)).toEqual(['fallback']);
  });

  it('filters candidates using the `where` condition', () => {
    const scope = scopeWith({ src: { v: [1, 2, 3, 4] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'v', condition: '$this > 2' });
    expect(resolveSource(rs, scope, ctx)).toEqual([3, 4]);
  });

  it('raises an EngineError when `check` fails', () => {
    const scope = scopeWith({ src: { v: [1] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'v', check: '$this > 10' });
    expect(() => resolveSource(rs, scope, ctx)).toThrow(EngineError);
  });

  it('invokes onLog with the evaluated logMessage for each matched candidate', () => {
    const scope = scopeWith({ src: { v: ['x', 'y'] } });
    const rs = RuleSource.fromJSON({ context: 'src', element: 'v', logMessage: '$this' });
    const onLog = vi.fn();
    resolveSource(rs, scope, { ...ctx, onLog });
    expect(onLog).toHaveBeenCalledTimes(2);
    expect(onLog).toHaveBeenCalledWith('x');
    expect(onLog).toHaveBeenCalledWith('y');
  });
});
