import { describe, it, expect } from 'vitest';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { Group } from '../../src/model/group.js';
import { Rule } from '../../src/model/rule.js';
import { realEvaluator } from './real-evaluator.js';

describe('StructureMapEngine', () => {
  it('binds group inputs and matches a rule end to end', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const group = Group.fromJSON({
      name: 'main',
      input: [{ name: 'src', type: 'Patient', mode: 'source' }],
    });
    const rule = Rule.fromJSON({
      source: [{ context: 'src', element: 'name', variable: 'n', condition: 'length() > 3' }],
    });

    const scope = engine.bindGroupInputs(group, { src: { name: ['Al', 'Alice'] } });
    const fired = engine.matchRule(rule, scope);

    expect(fired.map((s) => s.get('n'))).toEqual(['Alice']);
  });
});
