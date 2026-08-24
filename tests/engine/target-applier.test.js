import { describe, it, expect } from 'vitest';
import { VariableScope } from '../../src/engine/scope.js';
import { applyTarget } from '../../src/engine/target-applier.js';
import { ListPlan } from '../../src/engine/list-plan.js';
import { EngineError } from '../../src/engine/errors.js';
import { RuleTarget } from '../../src/model/rule-target.js';
import { createDefaultTransformRegistry } from '../../src/transforms/registry.js';
import { realEvaluator } from './real-evaluator.js';

const registry = createDefaultTransformRegistry();
const ctx = { evaluator: realEvaluator, registry };

function scopeWith(vars) {
  const scope = new VariableScope();
  for (const [k, v] of Object.entries(vars)) scope.set(k, v);
  return scope;
}

describe('applyTarget', () => {
  it('throws when the target context is unbound', () => {
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'status', transform: 'copy', parameter: [{ valueString: 'final' }] });
    expect(() => applyTarget(rt, new VariableScope(), ctx, new ListPlan(), 'r')).toThrow(EngineError);
  });

  it('auto-creates a plain object when no transform is given', () => {
    const tgt = {};
    const scope = scopeWith({ tgt });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'address' });
    applyTarget(rt, scope, ctx, new ListPlan(), 'r');
    expect(tgt.address).toEqual({});
  });

  it('delegates auto-create to ctx.createInstance when supplied', () => {
    const tgt = {};
    const scope = scopeWith({ tgt });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'address' });
    applyTarget(rt, scope, { ...ctx, createInstance: () => ({ line: [] }) }, new ListPlan(), 'r');
    expect(tgt.address).toEqual({ line: [] });
  });

  it('writes a scalar value via the copy transform and binds the variable', () => {
    const tgt = {};
    const scope = scopeWith({ tgt });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'status', variable: 'v', transform: 'copy', parameter: [{ valueString: 'final' }] });
    applyTarget(rt, scope, ctx, new ListPlan(), 'r');
    expect(tgt.status).toBe('final');
    expect(scope.get('v')).toBe('final');
  });

  it('evaluate() with an empty result creates nothing', () => {
    const tgt = {};
    const scope = scopeWith({ tgt, src: {} });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'note', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: 'missing' }] });
    applyTarget(rt, scope, ctx, new ListPlan(), 'r');
    expect(tgt.note).toBeUndefined();
  });

  it('evaluate() with a single result sets a scalar', () => {
    const tgt = {};
    const scope = scopeWith({ tgt, src: { a: 'hello' } });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'note', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: 'a' }] });
    applyTarget(rt, scope, ctx, new ListPlan(), 'r');
    expect(tgt.note).toBe('hello');
  });

  it('evaluate() with many results fans out into a pre-existing repeating target', () => {
    const tgt = { tag: [] };
    const scope = scopeWith({ tgt, src: { a: [1, 2, 3] } });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'tag', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: 'a' }] });
    const plan = new ListPlan();
    applyTarget(rt, scope, ctx, plan, 'r');
    plan.flush();
    expect(tgt.tag).toEqual([1, 2, 3]);
  });

  it('evaluate() with many results throws for a non-repeating target', () => {
    const tgt = {};
    const scope = scopeWith({ tgt, src: { a: [1, 2] } });
    const rt = RuleTarget.fromJSON({ context: 'tgt', element: 'note', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: 'a' }] });
    expect(() => applyTarget(rt, scope, ctx, new ListPlan(), 'r')).toThrow(EngineError);
  });

  it('a target with no element only computes and binds a variable', () => {
    const scope = scopeWith({ tgt: {} });
    const rt = RuleTarget.fromJSON({ context: 'tgt', variable: 'v', transform: 'copy', parameter: [{ valueString: 'x' }] });
    applyTarget(rt, scope, ctx, new ListPlan(), 'r');
    expect(scope.get('v')).toBe('x');
  });
});
