import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { findDefaultGroup } from '../../src/engine/default-mapping.js';

function docWith(groups) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', group: groups,
  });
}

describe('findDefaultGroup', () => {
  it('finds a "types" group matching both source and target types exactly', () => {
    const doc = docWith([
      { name: 'notDefault', typeMode: 'none', input: [{ name: 'a', mode: 'source' }], rule: [] },
      { name: 'nameToDisplay', typeMode: 'types', input: [{ name: 'src', type: 'HumanName', mode: 'source' }, { name: 'tgt', type: 'DisplayName', mode: 'target' }], rule: [] },
    ]);
    expect(findDefaultGroup(doc, 'HumanName', 'DisplayName')?.name).toBe('nameToDisplay');
  });

  it('returns undefined when no group matches', () => {
    const doc = docWith([{ name: 'g', typeMode: 'types', input: [{ name: 'a', type: 'X', mode: 'source' }, { name: 'b', type: 'Y', mode: 'target' }], rule: [] }]);
    expect(findDefaultGroup(doc, 'HumanName', 'DisplayName')).toBeUndefined();
  });

  it('"type-and-types" also matches when the target type is not yet fixed', () => {
    const doc = docWith([{ name: 'g', typeMode: 'type-and-types', input: [{ name: 'a', type: 'HumanName', mode: 'source' }, { name: 'b', type: 'DisplayName', mode: 'target' }], rule: [] }]);
    expect(findDefaultGroup(doc, 'HumanName', undefined)?.name).toBe('g');
  });

  it('ignores groups whose typeMode is "none"', () => {
    const doc = docWith([{ name: 'g', typeMode: 'none', input: [{ name: 'a', type: 'HumanName', mode: 'source' }, { name: 'b', type: 'DisplayName', mode: 'target' }], rule: [] }]);
    expect(findDefaultGroup(doc, 'HumanName', 'DisplayName')).toBeUndefined();
  });
});
