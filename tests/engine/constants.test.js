import { describe, it, expect, vi } from 'vitest';
import { ConstantResolver } from '../../src/engine/constants.js';
import { EngineError } from '../../src/engine/errors.js';
import { realEvaluator } from './real-evaluator.js';

function docWithConsts(consts) {
  return { const: consts.map(([name, value]) => ({ name, value })) };
}

describe('ConstantResolver', () => {
  it('resolves a simple literal constant', () => {
    const doc = docWithConsts([['status', "'final'"]]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    expect(resolver.resolve('status')).toBe('final');
  });

  it('evaluates each constant only once (cached)', () => {
    const evaluate = vi.fn(realEvaluator.evaluate);
    const doc = docWithConsts([['x', '1 + 1']]);
    const resolver = new ConstantResolver(doc, { evaluate });
    resolver.resolve('x');
    resolver.resolve('x');
    expect(evaluate).toHaveBeenCalledTimes(1);
  });

  it('never evaluates a constant that is never referenced (laziness)', () => {
    const doc = docWithConsts([['broken', 'this is not( valid fhirpath'], ['fine', "'ok'"]]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    // Resolving 'fine' must not trip over 'broken's invalid expression at all.
    expect(resolver.resolve('fine')).toBe('ok');
  });

  it('throws for an undefined constant', () => {
    const doc = docWithConsts([]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    expect(() => resolver.resolve('nope')).toThrow(EngineError);
  });

  it('detects a circular constant reference', () => {
    const doc = docWithConsts([['a', '%b'], ['b', '%a']]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    expect(() => resolver.resolve('a')).toThrow(EngineError);
  });

  it('lets one constant reference another', () => {
    const doc = docWithConsts([['unit', "'mg'"], ['label', "%unit + '/day'"]]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    expect(resolver.resolve('label')).toBe('mg/day');
  });

  it('asEnv() exposes constants lazily as %name for the injected evaluator', () => {
    const doc = docWithConsts([['greeting', "'hi'"]]);
    const resolver = new ConstantResolver(doc, realEvaluator);
    const env = resolver.asEnv();
    expect(realEvaluator.evaluate({}, '%greeting', env)).toEqual(['hi']);
  });
});
