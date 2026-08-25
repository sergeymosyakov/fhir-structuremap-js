import { describe, it, expect } from 'vitest';
import { ListPlan } from '../../src/engine/list-plan.js';
import { EngineError } from '../../src/engine/errors.js';

describe('ListPlan', () => {
  it('appends unannotated contributions in call order', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'a', [], null, 'ruleA');
    plan.add(arr, 'b', [], null, 'ruleA');
    plan.flush();
    expect(arr).toEqual(['a', 'b']);
  });

  it('treats a missing listModes argument the same as an empty array', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'a', undefined, null, 'ruleA');
    plan.flush();
    expect(arr).toEqual(['a']);
  });

  it('places "first" items before unannotated ones regardless of call order', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'middle', [], null, 'ruleA');
    plan.add(arr, 'head', ['first'], null, 'ruleB');
    plan.flush();
    expect(arr).toEqual(['head', 'middle']);
  });

  it('places "last" items after unannotated ones regardless of call order', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'tail', ['last'], null, 'ruleB');
    plan.add(arr, 'middle', [], null, 'ruleA');
    plan.flush();
    expect(arr).toEqual(['middle', 'tail']);
  });

  it('throws when two different rules both claim "last" for the same target list', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'a', ['last'], null, 'ruleA');
    expect(() => plan.add(arr, 'b', ['last'], null, 'ruleB')).toThrow(EngineError);
  });

  it('throws when two different claimants both claim "first" for the same list', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'a', ['first'], null, 'ruleA');
    expect(() => plan.add(arr, 'b', ['first'], null, 'ruleB')).toThrow(EngineError);
  });

  it('allows the same claimant to repeat "first" across multiple firings', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'a', ['first'], null, 'ruleA');
    plan.add(arr, 'b', ['first'], null, 'ruleA');
    plan.flush();
    expect(arr).toEqual(['a', 'b']);
  });

  it('"share"/"single" reuse the item at the same cursor position instead of appending a new one', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, { name: 'Alice' }, ['share'], 'r1', 'ruleA');
    plan.add(arr, { name: 'Bob' }, ['share'], 'r1', 'ruleA');
    plan.add(arr, { age: 30 }, ['share'], 'r2', 'ruleB');
    plan.add(arr, { age: 40 }, ['share'], 'r2', 'ruleB');
    plan.flush();
    expect(arr).toEqual([{ name: 'Alice', age: 30 }, { name: 'Bob', age: 40 }]);
  });

  it('does not merge when the shared slot already holds a non-object value', () => {
    const plan = new ListPlan();
    const arr = [];
    plan.add(arr, 'first', ['share'], 'r1', 'ruleA'); // middle[0] = 'first'
    const reused = plan.add(arr, 'second', ['share'], 'r2', 'ruleB'); // cursor 0 for r2 -> existing = 'first', not an object
    expect(reused).toBe('first');
  });
});
