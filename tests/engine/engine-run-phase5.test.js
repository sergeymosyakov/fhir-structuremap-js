import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from './real-evaluator.js';

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('StructureMapEngine.run — constants', () => {
  it('makes a constant available as %name inside a target evaluate() expression', () => {
    const doc = docWith({
      const: [{ name: 'defaultStatus', value: "'final'" }],
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'status', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: '%defaultStatus' }] }],
        }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: {}, tgt: {} });
    expect(result.tgt.status).toBe('final');
  });

  it('allows a constant to be used directly as a source context', () => {
    const doc = docWith({
      const: [{ name: 'greeting', value: "'hello'" }],
      group: [{
        name: 'main',
        input: [{ name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'greeting' }],
          target: [{ context: 'tgt', element: 'note', transform: 'copy', parameter: [{ valueId: 'greeting' }] }],
        }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { tgt: {} });
    expect(result.tgt.note).toBe('hello');
  });
});

describe('StructureMapEngine.run — imports', () => {
  it('invokes a dependent group defined in an imported map', () => {
    const helperDoc = docWith({
      name: 'helper-map',
      group: [{
        name: 'setName',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'name', transform: 'copy', parameter: [{ valueId: 'src' }] }] }],
      }],
    });
    const mainDoc = docWith({
      import: ['http://example.org/StructureMap/helper-map'],
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], dependent: [{ name: 'setName', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }] }],
      }],
    });

    const engine = new StructureMapEngine({
      evaluator: realEvaluator,
      structureMapResolver: (url) => (url.endsWith('helper-map') ? [helperDoc] : []),
    });
    const result = engine.run(mainDoc, { src: 'Alice', tgt: {} });
    expect(result.tgt.name).toBe('Alice');
  });

  it('resolves %constants against the owning document of the invoked group, not the caller\'s (§7.8.0.6)', () => {
    const helperDoc = docWith({
      name: 'helper-map',
      const: [{ name: 'suffix', value: "' (helper)'" }],
      group: [{
        name: 'setName',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'name', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: '$this + %suffix' }] }] }],
      }],
    });
    const mainDoc = docWith({
      import: ['http://example.org/StructureMap/helper-map'],
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], dependent: [{ name: 'setName', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }] }],
      }],
    });

    const engine = new StructureMapEngine({
      evaluator: realEvaluator,
      structureMapResolver: (url) => (url.endsWith('helper-map') ? [helperDoc] : []),
    });
    const result = engine.run(mainDoc, { src: 'Alice', tgt: {} });
    expect(result.tgt.name).toBe('Alice (helper)');
  });

  it('does not leak a constant from the caller\'s document into an imported group\'s scope', () => {
    const helperDoc = docWith({
      name: 'helper-map',
      group: [{
        name: 'setName',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'name', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: '%onlyInMain' }] }] }],
      }],
    });
    const mainDoc = docWith({
      import: ['http://example.org/StructureMap/helper-map'],
      const: [{ name: 'onlyInMain', value: "'top-level-value'" }],
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'src' }], dependent: [{ name: 'setName', parameter: [{ valueId: 'src' }, { valueId: 'tgt' }] }] }],
      }],
    });

    const engine = new StructureMapEngine({
      evaluator: realEvaluator,
      structureMapResolver: (url) => (url.endsWith('helper-map') ? [helperDoc] : []),
    });
    expect(() => engine.run(mainDoc, { src: 'Alice', tgt: {} })).toThrow(/onlyInMain/);
  });
});
