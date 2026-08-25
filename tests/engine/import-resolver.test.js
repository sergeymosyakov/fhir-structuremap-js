import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { resolveImportedGroup } from '../../src/engine/import-resolver.js';

function docWith(groups, imports = []) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', import: imports, group: groups,
  });
}

describe('resolveImportedGroup', () => {
  it('finds a group defined directly in the document', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    const found = resolveImportedGroup(doc, 'g', {});
    expect(found.doc).toBe(doc);
    expect(found.group.name).toBe('g');
  });

  it('returns undefined for an unknown group with no resolver configured', () => {
    const doc = docWith([{ name: 'g', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    expect(resolveImportedGroup(doc, 'missing', {})).toBeUndefined();
  });

  it('finds a group in an imported map via the injected structureMapResolver', () => {
    const imported = docWith([{ name: 'helper', input: [{ name: 'a', mode: 'source' }], rule: [] }]);
    const doc = docWith([{ name: 'main', input: [{ name: 'a', mode: 'source' }], rule: [] }], ['http://example.org/StructureMap/*helper']);
    const ctx = { structureMapResolver: (pattern) => (pattern.includes('helper') ? [imported] : []) };
    const found = resolveImportedGroup(doc, 'helper', ctx);
    expect(found.doc).toBe(imported);
    expect(found.group.name).toBe('helper');
  });

  it('tolerates a structureMapResolver that returns undefined for a pattern', () => {
    const doc = docWith([{ name: 'main', input: [{ name: 'a', mode: 'source' }], rule: [] }], ['http://example.org/StructureMap/unmatched']);
    const ctx = { structureMapResolver: () => undefined };
    expect(resolveImportedGroup(doc, 'missing', ctx)).toBeUndefined();
  });

  it('does not infinite-loop on a circular import chain', () => {
    const a = docWith([{ name: 'gA', input: [{ name: 'x', mode: 'source' }], rule: [] }], ['b']);
    const b = docWith([{ name: 'gB', input: [{ name: 'x', mode: 'source' }], rule: [] }], ['a']);
    const ctx = { structureMapResolver: (pattern) => (pattern === 'a' ? [a] : pattern === 'b' ? [b] : []) };
    expect(resolveImportedGroup(a, 'nonexistent', ctx)).toBeUndefined();
  });
});
