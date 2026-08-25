// Realistic composed scenario: a repeating source list processed through every
// source listMode together (first/not_first/last/not_last/only_one) plus
// where()/cardinality, producing coded output via cc()/c() — a shape resembling a
// real "conditions list -> coded summary" mapping.
import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('integration — repeating source + listMode + coded output', () => {
  const doc = docWith({
    group: [{
      name: 'main',
      input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
      rule: [
        // Active conditions only (where), each becomes a Coding in a repeating list,
        // 'share' listMode so all rules firing per-item append to the same array.
        {
          name: 'activeCodes',
          source: [{ context: 'src', element: 'conditions', variable: 'c', condition: "status = 'active'" }],
          target: [],
          rule: [{
            name: 'r',
            source: [{ context: 'c', element: 'code', variable: 'code' }],
            target: [{ context: 'tgt', element: 'activeCodings', transform: 'c', parameter: [{ valueString: 'http://example.org/condition-codes' }, { valueId: 'code' }], listMode: 'share', listRuleId: 'activeList' }],
          }],
        },
        { name: 'firstCondition', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'first' }], target: [{ context: 'tgt', element: 'firstCode', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] },
        { name: 'lastCondition', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'last' }], target: [{ context: 'tgt', element: 'lastCode', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] },
        { name: 'notFirstCodes', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'not_first' }], target: [{ context: 'tgt', element: 'notFirstCodes', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] },
        { name: 'notLastCodes', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'not_last' }], target: [{ context: 'tgt', element: 'notLastCodes', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] },
      ],
    }],
  });

  const conditions = [
    { code: 'flu', status: 'active' },
    { code: 'cold', status: 'resolved' },
    { code: 'asthma', status: 'active' },
  ];

  it('applies each source listMode independently and builds a shared coded list via target listMode "share"', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { conditions }, tgt: { activeCodings: [] } });

    expect(result.tgt.activeCodings).toEqual([
      { system: 'http://example.org/condition-codes', code: 'flu' },
      { system: 'http://example.org/condition-codes', code: 'asthma' },
    ]);
    expect(result.tgt.firstCode).toBe('flu');
    expect(result.tgt.lastCode).toBe('asthma');
    // notFirst/notLast target no listMode -> each firing overwrites; last processed wins.
    expect(result.tgt.notFirstCodes).toBe('asthma');
    expect(result.tgt.notLastCodes).toBe('cold');
  });

  it('honors the "only_one" listMode as a hard guard: succeeds with a single-item list', () => {
    const single = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'only_one' }], target: [{ context: 'tgt', element: 'code', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(single, { src: { conditions: [{ code: 'flu' }] }, tgt: {} });
    expect(result.tgt.code).toBe('flu');
  });

  it('"only_one" yields no match (not an error) when there is more than one candidate', () => {
    const single = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src', element: 'conditions', variable: 'c', listMode: 'only_one' }], target: [{ context: 'tgt', element: 'code', transform: 'evaluate', parameter: [{ valueId: 'c' }, { valueString: 'code' }] }] }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(single, { src: { conditions }, tgt: {} });
    expect(result.tgt.code).toBeUndefined();
  });
});
