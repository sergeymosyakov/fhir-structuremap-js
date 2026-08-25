// Realistic composed scenario: proving the engine fails clearly and correctly for
// real error conditions, through the full engine.run() pipeline (not isolated units).
import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { EngineError } from '../../src/engine/errors.js';
import { realEvaluator } from '../engine/real-evaluator.js';

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('integration — error paths through the full engine', () => {
  it('throws when a repeating source violates an explicit max cardinality', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src', element: 'items', variable: 'i', max: '1' }],
          target: [{ context: 'tgt', element: 'item', transform: 'evaluate', parameter: [{ valueId: 'i' }, { valueString: '$this' }] }],
        }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: { items: ['a', 'b'] }, tgt: {} })).toThrow(/expected at most 1 element/);
  });

  it('throws when a check() clause fails', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src', element: 'age', variable: 'a', check: '$this >= 0' }],
          target: [{ context: 'tgt', element: 'age', transform: 'copy', parameter: [{ valueId: 'a' }] }],
        }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: { age: -1 }, tgt: {} })).toThrow(/check failed/);
  });

  it('throws a clear error when a dependent group is not found (not defined, not imported)', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], dependent: [{ name: 'missingGroup', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }] }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: {}, tgt: {} })).toThrow(/unknown group "missingGroup"/);
  });

  it('throws a clear error for a circular "extends" chain', () => {
    const doc = docWith({
      group: [
        { name: 'a', extends: 'b', input: [{ name: 'src', mode: 'source' }], rule: [] },
        { name: 'b', extends: 'a', input: [{ name: 'src', mode: 'source' }], rule: [] },
      ],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: {} }, 'a')).toThrow(/circular "extends"/);
  });

  it('throws a clear error when run() is asked for a group that does not exist', () => {
    const doc = docWith({ group: [{ name: 'main', input: [{ name: 'src', mode: 'source' }], rule: [] }] });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: {} }, 'nope')).toThrow(EngineError);
  });

  it('throws when two sibling rules both claim "first" for the same repeating target list', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [
          { name: 'r1', source: [{ context: 'src', element: 'a', variable: 'v' }], target: [{ context: 'tgt', element: 'list', transform: 'copy', parameter: [{ valueId: 'v' }], listMode: 'first' }] },
          { name: 'r2', source: [{ context: 'src', element: 'b', variable: 'v' }], target: [{ context: 'tgt', element: 'list', transform: 'copy', parameter: [{ valueId: 'v' }], listMode: 'first' }] },
        ],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: { a: 'x', b: 'y' }, tgt: { list: [] } })).toThrow(/more than one rule claims "first"/);
  });

  it('an unbound source context variable produces a clear error rather than a crash deep in evaluation', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'typo' }], target: [] }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    expect(() => engine.run(doc, { src: {}, tgt: {} })).toThrow(/context variable "typo" is not bound/);
  });
});
