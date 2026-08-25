// Direct model-layer branch coverage not exercised via the big fixture-based
// StructureMapDocument test in model.test.js.
import { describe, it, expect } from 'vitest';
import { requireField } from '../src/model/validate.js';
import { Group } from '../src/model/group.js';
import { Parameter } from '../src/model/parameter.js';
import { RuleTarget } from '../src/model/rule-target.js';

describe('requireField', () => {
  it('returns the value when present', () => {
    expect(requireField({ name: 'x' }, 'name', 'Thing')).toBe('x');
  });

  it('throws when the field is missing', () => {
    expect(() => requireField({}, 'name', 'Thing')).toThrow('Thing: missing required field "name"');
  });
});

describe('Group.fromJSON', () => {
  it('throws when input is an empty array', () => {
    expect(() => Group.fromJSON({ name: 'g', input: [] })).toThrow(/"input" must have at least one entry/);
  });
});

describe('Parameter.fromJSON', () => {
  it('throws when no recognized value[x] key is present', () => {
    expect(() => Parameter.fromJSON({})).toThrow(/no recognized value\[x\]/);
  });
});

describe('RuleTarget', () => {
  it('defaults parameter to an empty array when constructed without one', () => {
    const rt = new RuleTarget({ context: 'tgt', element: 'a' });
    expect(rt.parameter).toEqual([]);
  });

  it('enforces constraint smp-1: element requires context', () => {
    expect(() => new RuleTarget({ element: 'a' })).toThrow(/constraint smp-1/);
  });
});
