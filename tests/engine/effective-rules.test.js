import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { getEffectiveRules } from '../../src/engine/effective-rules.js';
import { EngineError } from '../../src/engine/errors.js';

function docWith(groups) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', group: groups,
  });
}

describe('getEffectiveRules', () => {
  it('returns a group\'s own rules when it does not extend anything', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }], rule: [{ name: 'r1', source: [{ context: 'a' }] }] }]);
    const rules = getEffectiveRules(doc, doc.getGroup('g'));
    expect(rules.map((r) => r.name)).toEqual(['r1']);
  });

  it('prepends the extended group\'s rules before the group\'s own', () => {
    const doc = docWith([
      { name: 'base', input: [{ name: 'a', mode: 'source' }], rule: [{ name: 'baseRule', source: [{ context: 'a' }] }] },
      { name: 'derived', extends: 'base', input: [{ name: 'a', mode: 'source' }], rule: [{ name: 'ownRule', source: [{ context: 'a' }] }] },
    ]);
    const rules = getEffectiveRules(doc, doc.getGroup('derived'));
    expect(rules.map((r) => r.name)).toEqual(['baseRule', 'ownRule']);
  });

  it('throws when extending an unknown group', () => {
    const doc = docWith([{ name: 'g', extends: 'nope', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    expect(() => getEffectiveRules(doc, doc.getGroup('g'))).toThrow(EngineError);
  });

  it('throws on a circular extends chain', () => {
    const doc = docWith([
      { name: 'a', extends: 'b', input: [{ name: 'x', mode: 'source' }], rule: [] },
      { name: 'b', extends: 'a', input: [{ name: 'x', mode: 'source' }], rule: [] },
    ]);
    expect(() => getEffectiveRules(doc, doc.getGroup('a'))).toThrow(/circular/);
  });
});
