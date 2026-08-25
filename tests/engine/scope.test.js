import { describe, it, expect } from 'vitest';
import { VariableScope } from '../../src/engine/scope.js';

describe('VariableScope', () => {
  it('sets and gets a binding', () => {
    const scope = new VariableScope();
    scope.set('a', 1);
    expect(scope.get('a')).toBe(1);
    expect(scope.has('a')).toBe(true);
  });

  it('falls back to the parent scope when a name is not local', () => {
    const parent = new VariableScope();
    parent.set('a', 1);
    const child = parent.child();
    child.set('b', 2);
    expect(child.get('a')).toBe(1);
    expect(child.get('b')).toBe(2);
    expect(child.has('a')).toBe(true);
    expect(parent.has('b')).toBe(false);
  });

  it('a child binding shadows the parent binding of the same name', () => {
    const parent = new VariableScope();
    parent.set('a', 1);
    const child = parent.child();
    child.set('a', 2);
    expect(child.get('a')).toBe(2);
    expect(parent.get('a')).toBe(1);
  });

  it('returns undefined for an unbound name', () => {
    const scope = new VariableScope();
    expect(scope.get('nope')).toBeUndefined();
    expect(scope.has('nope')).toBe(false);
  });

  it('getType() falls back to the parent scope\'s tracked type', () => {
    const parent = new VariableScope();
    parent.setType('a', 'Patient');
    const child = parent.child();
    expect(child.getType('a')).toBe('Patient');
    expect(child.getType('nope')).toBeUndefined();
  });
});
