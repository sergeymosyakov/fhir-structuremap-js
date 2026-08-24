import { describe, it, expect } from 'vitest';
import { bindGroupInputs } from '../../src/engine/group-binder.js';
import { EngineError } from '../../src/engine/errors.js';
import { Group } from '../../src/model/group.js';

const group = Group.fromJSON({
  name: 'main',
  input: [
    { name: 'src', type: 'Patient', mode: 'source' },
    { name: 'tgt', type: 'Observation', mode: 'target' },
  ],
});

describe('bindGroupInputs', () => {
  it('binds each declared input to its supplied value', () => {
    const src = { resourceType: 'Patient' };
    const tgt = { resourceType: 'Observation' };
    const scope = bindGroupInputs(group, { src, tgt });
    expect(scope.get('src')).toBe(src);
    expect(scope.get('tgt')).toBe(tgt);
  });

  it('throws when a required input is missing', () => {
    expect(() => bindGroupInputs(group, { src: {} })).toThrow(EngineError);
  });
});
