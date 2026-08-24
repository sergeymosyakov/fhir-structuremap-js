import { describe, it, expect, vi } from 'vitest';
import { VariableScope } from '../../src/engine/scope.js';
import { executeRule } from '../../src/engine/rule-executor.js';
import { ListPlan } from '../../src/engine/list-plan.js';
import { Rule } from '../../src/model/rule.js';
import { createDefaultTransformRegistry } from '../../src/transforms/registry.js';
import { realEvaluator } from './real-evaluator.js';

const registry = createDefaultTransformRegistry();
const baseCtx = { evaluator: realEvaluator, registry };

describe('executeRule', () => {
  it('applies target statements for each firing, appending in order', () => {
    const tgt = { note: [] };
    const scope = new VariableScope().set('src', { name: ['A', 'B'] }).set('tgt', tgt);
    const rule = Rule.fromJSON({
      source: [{ context: 'src', element: 'name', variable: 'n' }],
      target: [{ context: 'tgt', element: 'note', transform: 'copy', parameter: [{ valueId: 'n' }] }],
    });
    const plan = new ListPlan();
    executeRule(rule, scope, baseCtx, plan);
    plan.flush();
    expect(tgt.note).toEqual(['A', 'B']);
  });

  it('recurses into nested rules, inheriting the firing scope', () => {
    const tgt = {};
    const scope = new VariableScope().set('src', { patient: { first: 'Alice' } }).set('tgt', tgt);
    const rule = Rule.fromJSON({
      source: [{ context: 'src', element: 'patient', variable: 'p' }],
      rule: [{
        source: [{ context: 'p', element: 'first', variable: 'f' }],
        target: [{ context: 'tgt', element: 'name', variable: 'n' }, { context: 'n', element: 'given', transform: 'copy', parameter: [{ valueId: 'f' }] }],
      }],
    });
    executeRule(rule, scope, baseCtx, new ListPlan());
    expect(tgt.name.given).toBe('Alice');
  });

  it('invokes a dependent group with resolved positional arguments', () => {
    const tgt = {};
    const scope = new VariableScope().set('src', { val: 'x' }).set('tgt', tgt);
    const rule = Rule.fromJSON({
      source: [{ context: 'src' }],
      dependent: [{ name: 'helper', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }],
    });
    const invokeGroup = vi.fn();
    executeRule(rule, scope, { ...baseCtx, invokeGroup }, new ListPlan());
    expect(invokeGroup).toHaveBeenCalledWith('helper', [{ val: 'x' }, tgt], expect.any(ListPlan));
  });

  it('does nothing when the rule does not match', () => {
    const scope = new VariableScope().set('src', {});
    const rule = Rule.fromJSON({ source: [{ context: 'src', element: 'missing' }] });
    const invokeGroup = vi.fn();
    executeRule(rule, scope, { ...baseCtx, invokeGroup }, new ListPlan());
    expect(invokeGroup).not.toHaveBeenCalled();
  });
});

