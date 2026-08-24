import { describe, it, expect } from 'vitest';
import { VariableScope } from '../../src/engine/scope.js';
import { matchRule, cartesianProduct } from '../../src/engine/rule-matcher.js';
import { EngineError } from '../../src/engine/errors.js';
import { Rule } from '../../src/model/rule.js';
import { realEvaluator } from './real-evaluator.js';

const ctx = { evaluator: realEvaluator };

describe('cartesianProduct', () => {
  it('combines multiple lists into all ordered tuples', () => {
    expect(cartesianProduct([[1, 2], ['a', 'b']])).toEqual([
      [1, 'a'], [1, 'b'], [2, 'a'], [2, 'b'],
    ]);
  });

  it('a single empty list yields no combinations', () => {
    expect(cartesianProduct([[1, 2], []])).toEqual([]);
  });
});

describe('matchRule — single source', () => {
  it('fires once per matched element, binding the variable each time', () => {
    const scope = new VariableScope().set('src', { name: ['Alice', 'Bob'] });
    const rule = Rule.fromJSON({
      source: [{ context: 'src', element: 'name', variable: 'n' }],
    });
    const scopes = matchRule(rule, scope, ctx);
    expect(scopes.map((s) => s.get('n'))).toEqual(['Alice', 'Bob']);
  });

  it('does not fire when the source has no match', () => {
    const scope = new VariableScope().set('src', {});
    const rule = Rule.fromJSON({ source: [{ context: 'src', element: 'missing', variable: 'n' }] });
    expect(matchRule(rule, scope, ctx)).toEqual([]);
  });
});

describe('matchRule — the spec\'s own multi-source worked example (§7.8.0.8.1)', () => {
  // "for src.row as row, row.firstName as firstName" — a later source's context can
  // itself be a variable from an earlier source in the same rule.
  const rule = Rule.fromJSON({
    source: [
      { context: 'src', element: 'row', variable: 'row' },
      { context: 'row', element: 'firstName', variable: 'firstName' },
    ],
  });

  it('fires 4 times (full cross product, not positional pairing) when every row has a firstName', () => {
    const scope = new VariableScope().set('src', {
      row: [{ firstName: 'John' }, { firstName: 'Peter' }],
    });
    const scopes = matchRule(rule, scope, ctx);
    const pairs = scopes.map((s) => [s.get('row').firstName, s.get('firstName')]);
    expect(pairs).toHaveLength(4);
    expect(new Set(pairs.map((p) => JSON.stringify(p)))).toEqual(new Set([
      JSON.stringify(['John', 'John']),
      JSON.stringify(['John', 'Peter']),
      JSON.stringify(['Peter', 'John']),
      JSON.stringify(['Peter', 'Peter']),
    ]));
  });

  it('never fires when no row has a firstName', () => {
    const scope = new VariableScope().set('src', {
      row: [{ family: 'John' }, { family: 'Peter' }],
    });
    expect(matchRule(rule, scope, ctx)).toEqual([]);
  });
});

describe('matchRule — unbound context', () => {
  it('throws an EngineError when a source context is neither an outer variable nor a same-rule chain', () => {
    const scope = new VariableScope();
    const rule = Rule.fromJSON({ source: [{ context: 'nope' }] });
    expect(() => matchRule(rule, scope, ctx)).toThrow(EngineError);
  });
});
