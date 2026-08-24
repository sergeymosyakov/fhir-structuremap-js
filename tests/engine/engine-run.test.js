import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from './real-evaluator.js';

function docWith(groups) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', group: groups,
  });
}

describe('StructureMapEngine.run', () => {
  it('runs a Patient -> Observation map using copy and evaluate', () => {
    const doc = docWith([{
      name: 'main',
      input: [{ name: 'src', type: 'Patient', mode: 'source' }, { name: 'tgt', type: 'Observation', mode: 'target' }],
      rule: [
        {
          name: 'setStatus',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'status', transform: 'copy', parameter: [{ valueString: 'final' }] }],
        },
        {
          name: 'noteFromName',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'note', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: "name.given.first() + ' ' + name.family" }] }],
        },
      ],
    }]);

    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const patient = { resourceType: 'Patient', name: [{ given: ['Alice'], family: 'Smith' }] };
    const observation = { resourceType: 'Observation' };
    const result = engine.run(doc, { src: patient, tgt: observation });

    expect(result.tgt.status).toBe('final');
    expect(result.tgt.note).toBe('Alice Smith');
  });

  it('runs a rule with a dependent group invocation end to end', () => {
    const doc = docWith([
      {
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src' }],
          dependent: [{ name: 'setName', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }],
        }],
      },
      {
        name: 'setName',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'name', transform: 'copy', parameter: [{ valueId: 'src' }] }],
        }],
      },
    ]);

    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: 'Alice', tgt: {} });
    expect(result.tgt.name).toBe('Alice');
  });

  it('assembles a repeating target across sibling rules honoring first/last', () => {
    const doc = docWith([{
      name: 'main',
      input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
      rule: [
        {
          name: 'mid',
          source: [{ context: 'src', element: 'items', variable: 'i' }],
          target: [{ context: 'tgt', element: 'list', transform: 'copy', parameter: [{ valueId: 'i' }] }],
        },
        {
          name: 'head',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'list', listMode: ['first'], transform: 'copy', parameter: [{ valueString: 'HEAD' }] }],
        },
        {
          name: 'tail',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'list', listMode: ['last'], transform: 'copy', parameter: [{ valueString: 'TAIL' }] }],
        },
      ],
    }]);

    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { items: ['a', 'b'] }, tgt: { list: [] } });
    expect(result.tgt.list).toEqual(['HEAD', 'a', 'b', 'TAIL']);
  });

  it('throws when the requested group does not exist', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { a: {} }, 'missing')).toThrow(/not found/);
  });
});
