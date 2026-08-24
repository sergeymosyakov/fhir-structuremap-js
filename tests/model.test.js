import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { StructureMapDocument } from '../src/model/index.js';

const fixturePath = fileURLToPath(new URL('./fixtures/simple-map.json', import.meta.url));
const fixtureJSON = JSON.parse(readFileSync(fixturePath, 'utf-8'));

describe('StructureMapDocument.fromJSON', () => {
  it('parses top-level metadata and structure refs', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    expect(doc.url).toBe('http://example.org/StructureMap/simple-test');
    expect(doc.name).toBe('SimpleTest');
    expect(doc.status).toBe('draft');
    expect(doc.structure).toHaveLength(2);
    expect(doc.structure[0].mode).toBe('source');
    expect(doc.structure[1].mode).toBe('target');
  });

  it('parses constants', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    expect(doc.const).toHaveLength(1);
    expect(doc.const[0].name).toBe('defaultStatus');
    expect(doc.const[0].value).toBe("'final'");
  });

  it('parses groups and exposes lookup + default group', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    expect(doc.group).toHaveLength(2);
    expect(doc.defaultGroup.name).toBe('main');
    expect(doc.getGroup('logNote')).toBeDefined();
    expect(doc.getGroup('doesNotExist')).toBeUndefined();
  });

  it('parses group inputs with mode/type', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    const main = doc.getGroup('main');
    expect(main.input).toHaveLength(2);
    expect(main.input[0]).toMatchObject({ name: 'src', type: 'Patient', mode: 'source' });
    expect(main.input[1]).toMatchObject({ name: 'tgt', type: 'Observation', mode: 'target' });
  });

  it('parses rule source content fully', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    const rule = doc.getGroup('main').rule[1];
    const source = rule.source[0];
    expect(source).toMatchObject({
      context: 'src',
      element: 'name',
      type: 'HumanName',
      min: 0,
      max: '*',
      listMode: 'first',
      variable: 'nm',
      condition: 'nm.given.exists()',
      check: 'nm.family.exists()',
      logMessage: 'mapping name',
      defaultValue: "'Unknown'",
    });
  });

  it('parses rule target with parameters normalized from value[x]', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    const rule = doc.getGroup('main').rule[1];
    const target = rule.target[0];
    expect(target.context).toBe('tgt');
    expect(target.element).toBe('note');
    expect(target.transform).toBe('evaluate');
    expect(target.listMode).toEqual(['first']);
    expect(target.parameter).toHaveLength(2);
    expect(target.parameter[0]).toMatchObject({ kind: 'id', value: 'nm' });
    expect(target.parameter[1]).toMatchObject({ kind: 'string', value: "given.first() + ' ' + family" });
  });

  it('parses nested rules and dependent invocations', () => {
    const doc = StructureMapDocument.fromJSON(fixtureJSON);
    const rule = doc.getGroup('main').rule[1];
    expect(rule.rule).toHaveLength(1);
    expect(rule.rule[0].name).toBe('nestedNoop');
    expect(rule.dependent).toHaveLength(1);
    expect(rule.dependent[0]).toMatchObject({ name: 'logNote' });
    expect(rule.dependent[0].parameter[0]).toMatchObject({ kind: 'id', value: 'noteVar' });
  });

  it('rejects a resourceType mismatch', () => {
    expect(() => StructureMapDocument.fromJSON({ ...fixtureJSON, resourceType: 'Bundle' })).toThrow(/resourceType/);
  });

  it('rejects a document with no groups', () => {
    expect(() => StructureMapDocument.fromJSON({ ...fixtureJSON, group: [] })).toThrow(/at least one/);
  });

  it('rejects a rule with no source', () => {
    const bad = JSON.parse(JSON.stringify(fixtureJSON));
    bad.group[0].rule[0].source = [];
    expect(() => StructureMapDocument.fromJSON(bad)).toThrow(/at least one/);
  });

  it('rejects a target with an element but no context (smp-1)', () => {
    expect(() => StructureMapDocument.fromJSON({
      ...fixtureJSON,
      group: [{
        name: 'bad',
        input: [{ name: 'a', mode: 'source' }, { name: 'b', mode: 'target' }],
        rule: [{ name: 'r', source: [{ context: 'a' }], target: [{ element: 'x' }] }],
      }],
    })).toThrow(/smp-1/);
  });
});
