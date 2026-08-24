import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { invokeGroup } from '../../src/engine/group-invoker.js';
import { EngineError } from '../../src/engine/errors.js';
import { createDefaultTransformRegistry } from '../../src/transforms/registry.js';
import { ListPlan } from '../../src/engine/list-plan.js';
import { realEvaluator } from './real-evaluator.js';

function docWith(groups) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', group: groups,
  });
}

const registry = createDefaultTransformRegistry();

describe('invokeGroup', () => {
  it('binds arguments positionally and executes the group\'s rules', () => {
    const doc = docWith([{
      name: 'setStatus',
      input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
      rule: [{
        name: 'r',
        source: [{ context: 'src' }],
        target: [{ context: 'tgt', element: 'status', transform: 'copy', parameter: [{ valueString: 'final' }] }],
      }],
    }]);
    const tgt = {};
    const ctx = { evaluator: realEvaluator, registry, invokeGroup: (name, args, plan) => invokeGroup(doc, name, args, ctx, plan) };
    invokeGroup(doc, 'setStatus', [{}, tgt], ctx, new ListPlan());
    expect(tgt.status).toBe('final');
  });

  it('throws for an unknown group', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    const ctx = { evaluator: realEvaluator, registry };
    expect(() => invokeGroup(doc, 'nope', [], ctx, new ListPlan())).toThrow(EngineError);
  });

  it('throws when the argument count does not match the group\'s inputs', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }, { name: 'b', mode: 'target' }], rule: [] }]);
    const ctx = { evaluator: realEvaluator, registry };
    expect(() => invokeGroup(doc, 'g', [{}], ctx, new ListPlan())).toThrow(EngineError);
  });

  it('executes inherited rules from an extended group too', () => {
    const doc = docWith([
      {
        name: 'base',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r1', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'a', transform: 'copy', parameter: [{ valueString: 'A' }] }] }],
      },
      {
        name: 'derived',
        extends: 'base',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r2', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'b', transform: 'copy', parameter: [{ valueString: 'B' }] }] }],
      },
    ]);
    const tgt = {};
    const ctx = { evaluator: realEvaluator, registry };
    invokeGroup(doc, 'derived', [{}, tgt], ctx, new ListPlan());
    expect(tgt).toEqual({ a: 'A', b: 'B' });
  });
});
