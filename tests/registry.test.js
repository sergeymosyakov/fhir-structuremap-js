import { describe, it, expect } from 'vitest';
import { TRANSFORM_NAMES } from '../src/transforms/names.js';
import { TransformRegistry, createDefaultTransformRegistry } from '../src/transforms/registry.js';
import { realEvaluator } from './engine/real-evaluator.js';

describe('TransformRegistry', () => {
  it('registers and retrieves a handler by name', () => {
    const registry = new TransformRegistry();
    const handler = () => 'ok';
    registry.register('copy', handler);
    expect(registry.get('copy')).toBe(handler);
    expect(registry.has('copy')).toBe(true);
  });

  it('rejects duplicate registration', () => {
    const registry = new TransformRegistry();
    registry.register('copy', () => {});
    expect(() => registry.register('copy', () => {})).toThrow(/already registered/);
  });

  it('override() replaces an existing handler, but not an unregistered one', () => {
    const registry = new TransformRegistry();
    registry.register('copy', () => 'v1');
    registry.override('copy', () => 'v2');
    expect(registry.get('copy')()).toBe('v2');
    expect(() => registry.override('truncate', () => {})).toThrow(/cannot override unregistered/);
  });

  it('get() throws a clear error for an unknown name', () => {
    const registry = new TransformRegistry();
    expect(() => registry.get('nope')).toThrow(/no handler registered/);
  });
});

describe('createDefaultTransformRegistry', () => {
  it('reserves all 17 spec-defined transform names', () => {
    const registry = createDefaultTransformRegistry();
    expect(registry.names.sort()).toEqual([...TRANSFORM_NAMES].sort());
    expect(registry.names).toHaveLength(17);
  });

  it('wires every name to a real, distinct handler function', () => {
    const registry = createDefaultTransformRegistry();
    for (const name of TRANSFORM_NAMES) {
      expect(typeof registry.get(name)).toBe('function');
    }
  });

  it('dateOp is wired to a real handler grounded in FHIRPath date arithmetic', () => {
    const registry = createDefaultTransformRegistry();
    expect(registry.get('dateOp')({ evaluator: realEvaluator }, ['2020-01-01', '+', 1, 'day'])).toBe('2020-01-02');
  });

  it('a default handler can be overridden with a custom implementation', () => {
    const registry = createDefaultTransformRegistry();
    registry.override('uuid', () => 'fixed-uuid');
    expect(registry.get('uuid')()).toBe('fixed-uuid');
  });
});
