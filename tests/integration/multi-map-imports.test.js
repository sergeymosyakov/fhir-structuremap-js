// Realistic composed scenario: a "main" map imports a shared "library" map (wildcard
// import) and invokes its groups as dependents. Proves group resolution across
// documents AND per-document constants scoping (Phase 9) together in one real flow.
import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('integration — multi-map composition via imports', () => {
  const libraryDoc = docWith({
    name: 'library',
    const: [{ name: 'unknownLabel', value: "'Unknown'" }],
    group: [
      {
        name: 'formatName',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'formatted', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: "given + ' ' + family"}] }],
        }],
      },
      {
        name: 'labelOrUnknown',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'src' }],
          target: [{ context: 'tgt', element: 'label', transform: 'evaluate', parameter: [{ valueId: 'src' }, { valueString: "iif($this = '', %unknownLabel, $this)" }] }],
        }],
      },
    ],
  });

  const mainDoc = docWith({
    name: 'main-map',
    import: ['http://example.org/StructureMap/library*'],
    group: [{
      name: 'main',
      input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
      rule: [
        { name: 'r1', source: [{ context: 'src', element: 'name', variable: 'n' }], dependent: [{ name: 'formatName', parameter: [{ valueId: 'n' }, { valueId: 'tgt' }] }] },
        { name: 'r2', source: [{ context: 'src', element: 'nickname', variable: 'nick' }], dependent: [{ name: 'labelOrUnknown', parameter: [{ valueId: 'nick' }, { valueId: 'tgt' }] }] },
      ],
    }],
  });

  const engine = new StructureMapEngine({
    evaluator: realEvaluator,
    structureMapResolver: (pattern) => (pattern.startsWith('http://example.org/StructureMap/library') ? [libraryDoc] : []),
  });

  it('invokes both imported groups and produces the combined result', () => {
    const result = engine.run(mainDoc, { src: { name: { given: 'Alice', family: 'Smith' }, nickname: 'Al' }, tgt: {} });
    expect(result.tgt.formatted).toBe('Alice Smith');
    expect(result.tgt.label).toBe('Al');
  });

  it("the library's own %unknownLabel constant resolves inside its own group, not the caller's document", () => {
    const result = engine.run(mainDoc, { src: { name: { given: 'Bob', family: 'Jones' }, nickname: '' }, tgt: {} });
    expect(result.tgt.label).toBe('Unknown');
  });

  it("main-map does not define %unknownLabel itself — proving the value truly came from library, not a coincidence", () => {
    expect(mainDoc.const).toEqual([]);
  });
});
