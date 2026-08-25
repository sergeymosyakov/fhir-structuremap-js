import { describe, it, expect, vi } from 'vitest';
import { EngineError } from '../../src/engine/errors.js';
import { realEvaluator } from '../engine/real-evaluator.js';
import * as fns from '../../src/transforms/functions/index.js';

const ctx = { evaluator: realEvaluator };

describe('create', () => {
  it('returns an empty object with no injected createInstance', () => {
    expect(fns.create(ctx, ['Patient'])).toEqual({});
  });

  it('delegates to ctx.createInstance when supplied', () => {
    const createInstance = vi.fn(() => ({ resourceType: 'Patient' }));
    expect(fns.create({ ...ctx, createInstance }, ['Patient'])).toEqual({ resourceType: 'Patient' });
    expect(createInstance).toHaveBeenCalledWith('Patient');
  });
});

describe('copy', () => {
  it('returns the source as-is', () => {
    expect(fns.copy(ctx, [42])).toBe(42);
  });
});

describe('truncate', () => {
  it('truncates a string to the given length', () => {
    expect(fns.truncate(ctx, ['hello world', 5])).toBe('hello');
  });

  it('passes nullish source through unchanged', () => {
    expect(fns.truncate(ctx, [undefined, 5])).toBeUndefined();
    expect(fns.truncate(ctx, [null, 5])).toBeNull();
  });

  it('throws when length is not a number', () => {
    expect(() => fns.truncate(ctx, ['hello', '5'])).toThrow(EngineError);
  });
});

describe('escape', () => {
  it('escapes xml entities', () => {
    expect(fns.escape(ctx, ['<a>&"\'', 'string', 'xml'])).toBe('&lt;a&gt;&amp;&quot;&apos;');
  });

  it('unescapes xml entities', () => {
    expect(fns.escape(ctx, ['&lt;a&gt;', 'xml', 'string'])).toBe('<a>');
  });

  it('passes nullish source through unchanged', () => {
    expect(fns.escape(ctx, [undefined, 'string', 'xml'])).toBeUndefined();
  });

  it('is a no-op passthrough when both formats are identical', () => {
    expect(fns.escape(ctx, ['x', 'text', 'text'])).toBe('x');
  });

  it('throws for an unsupported conversion', () => {
    expect(() => fns.escape(ctx, ['x', 'json', 'xml'])).toThrow(EngineError);
  });
});

describe('cast', () => {
  it('casts to string/integer/decimal/boolean', () => {
    expect(fns.cast(ctx, [42, 'string'])).toBe('42');
    expect(fns.cast(ctx, ['42', 'integer'])).toBe(42);
    expect(fns.cast(ctx, ['4.2', 'decimal'])).toBe(4.2);
    expect(fns.cast(ctx, ['true', 'boolean'])).toBe(true);
    expect(fns.cast(ctx, ['false', 'boolean'])).toBe(false);
    expect(fns.cast(ctx, [true, 'boolean'])).toBe(true); // already a boolean -> passthrough
  });

  it('casts to Reference', () => {
    expect(fns.cast(ctx, ['Patient/1', 'Reference'])).toEqual({ reference: 'Patient/1' });
  });

  it('requires an explicit type', () => {
    expect(() => fns.cast(ctx, ['x'])).toThrow(/explicit type/);
  });

  it('throws on an unparseable value', () => {
    expect(() => fns.cast(ctx, ['nope', 'integer'])).toThrow(EngineError);
    expect(() => fns.cast(ctx, ['nope', 'decimal'])).toThrow(EngineError);
    expect(() => fns.cast(ctx, ['nope', 'boolean'])).toThrow(EngineError);
  });

  it('throws for an unsupported target type', () => {
    expect(() => fns.cast(ctx, ['x', 'bogus'])).toThrow(EngineError);
  });
});

describe('append', () => {
  it('concatenates all parameters, treating nullish as empty string', () => {
    expect(fns.append(ctx, ['a', null, 'b', undefined, 'c'])).toBe('abc');
  });
});

describe('translate', () => {
  it('selects the requested output kind from the injected callback', () => {
    const translate = vi.fn(() => ({ system: 'sys', code: 'c1', display: 'D1' }));
    const t = { ...ctx, translate };
    expect(fns.translate(t, ['src', 'map', 'code'])).toBe('c1');
    expect(fns.translate(t, ['src', 'map', 'system'])).toBe('sys');
    expect(fns.translate(t, ['src', 'map', 'display'])).toBe('D1');
    expect(fns.translate(t, ['src', 'map', 'Coding'])).toEqual({ system: 'sys', code: 'c1', display: 'D1' });
    expect(fns.translate(t, ['src', 'map', 'CodeableConcept'])).toEqual({ coding: [{ system: 'sys', code: 'c1', display: 'D1' }] });
  });

  it('throws when no translate callback is injected', () => {
    expect(() => fns.translate(ctx, ['src', 'map', 'code'])).toThrow(/no translate/);
  });

  it('throws for an unknown output kind', () => {
    expect(() => fns.translate({ ...ctx, translate: () => ({}) }, ['s', 'm', 'nope'])).toThrow(EngineError);
  });

  it('returns undefined when the injected callback finds no match', () => {
    const t = { ...ctx, translate: () => undefined };
    expect(fns.translate(t, ['src', 'map', 'code'])).toBeUndefined();
  });
});

describe('reference / pointer', () => {
  it('builds a ResourceType/id reference string', () => {
    expect(fns.reference(ctx, [{ resourceType: 'Patient', id: '123' }])).toBe('Patient/123');
    expect(fns.pointer(ctx, [{ resourceType: 'Patient', id: '123' }])).toBe('Patient/123');
  });

  it('throws when the source is not a resource', () => {
    expect(() => fns.reference(ctx, [{}])).toThrow(EngineError);
  });
});

describe('dateOp', () => {
  it('adds a calendar-duration quantity to a date', () => {
    expect(fns.dateOp(ctx, ['2020-01-01', '+', 3, 'months'])).toBe('2020-04-01');
    expect(fns.dateOp(ctx, ['2020-01-01', '+', 1, 'year'])).toBe('2021-01-01');
  });

  it('subtracts a calendar-duration quantity from a dateTime', () => {
    // No explicit timezone in the input -> FHIRPath adds the local offset, so match
    // the date/time prefix only (keeps the test stable across CI timezones).
    expect(fns.dateOp(ctx, ['2020-01-15T10:00:00', '-', 2, 'days'])).toMatch(/^2020-01-13T10:00:00/);
  });

  it('accepts a quoted UCUM short unit form', () => {
    expect(fns.dateOp(ctx, ['2020-01-01', '+', 1, 'wk'])).toBe('2020-01-08');
  });

  it('throws for an unsupported operation', () => {
    expect(() => fns.dateOp(ctx, ['2020-01-01', '*', 1, 'day'])).toThrow(/unsupported operation/);
  });

  it('throws for an invalid date literal', () => {
    expect(() => fns.dateOp(ctx, ['not-a-date', '+', 1, 'day'])).toThrow(/not a valid date/);
  });

  it('throws for an unsupported unit', () => {
    expect(() => fns.dateOp(ctx, ['2020-01-01', '+', 1, 'fortnight'])).toThrow(/unsupported unit/);
  });
});

describe('uuid', () => {
  it('uses the injected uuidFactory and lowercases the result', () => {
    expect(fns.uuid({ ...ctx, uuidFactory: () => 'ABC-123' })).toBe('abc-123');
  });

  it('falls back to crypto.randomUUID() and produces a valid v4 UUID', () => {
    const value = fns.uuid(ctx);
    expect(value).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });
});

describe('evaluateTransform', () => {
  it('returns the raw FHIRPath result collection', () => {
    expect(fns.evaluateTransform(ctx, [{ a: [1, 2, 3] }, 'a.where($this > 1)'])).toEqual([2, 3]);
    expect(fns.evaluateTransform(ctx, [{}, 'missing'])).toEqual([]);
    expect(fns.evaluateTransform(ctx, [{ a: 5 }, 'a'])).toEqual([5]);
  });

  it('supports the 1-parameter context-implicit shorthand (real HL7 examples use this)', () => {
    expect(fns.evaluateTransform(ctx, ["'draft'"])).toEqual(['draft']);
  });
});

describe('cc (CodeableConcept)', () => {
  it('builds a text-only CodeableConcept from a single parameter', () => {
    expect(fns.cc(ctx, ['free text'])).toEqual({ text: 'free text' });
  });

  it('builds a coded CodeableConcept from system/code/display', () => {
    expect(fns.cc(ctx, ['sys', 'code1', 'Display'])).toEqual({ coding: [{ system: 'sys', code: 'code1', display: 'Display' }] });
  });

  it('omits display when not provided', () => {
    expect(fns.cc(ctx, ['sys', 'code1'])).toEqual({ coding: [{ system: 'sys', code: 'code1' }] });
  });
});

describe('c (Coding)', () => {
  it('builds a Coding from system/code[/display]', () => {
    expect(fns.c(ctx, ['sys', 'code1'])).toEqual({ system: 'sys', code: 'code1' });
    expect(fns.c(ctx, ['sys', 'code1', 'Display'])).toEqual({ system: 'sys', code: 'code1', display: 'Display' });
  });
});

describe('qty (Quantity)', () => {
  it('parses natural-text form', () => {
    expect(fns.qty(ctx, ['5.5 mg'])).toEqual({ value: 5.5, unit: 'mg' });
    expect(fns.qty(ctx, ['>=10'])).toEqual({ value: 10, comparator: '>=' });
  });

  it('builds from explicit value/unit/system/code', () => {
    expect(fns.qty(ctx, [5, 'mg', 'http://unitsofmeasure.org', 'mg'])).toEqual({
      value: 5, unit: 'mg', system: 'http://unitsofmeasure.org', code: 'mg',
    });
  });

  it('omits system/code when not provided in the explicit form', () => {
    expect(fns.qty(ctx, [5, 'mg'])).toEqual({ value: 5, unit: 'mg' });
  });

  it('throws when natural text cannot be parsed', () => {
    expect(() => fns.qty(ctx, ['not a quantity'])).toThrow(EngineError);
  });
});

describe('id (Identifier)', () => {
  it('builds an Identifier, wrapping type as a CodeableConcept', () => {
    expect(fns.id(ctx, ['sys', 'val'])).toEqual({ system: 'sys', value: 'val' });
    expect(fns.id(ctx, ['sys', 'val', 'MR'])).toEqual({ system: 'sys', value: 'val', type: { coding: [{ code: 'MR' }] } });
  });
});

describe('cp (ContactPoint)', () => {
  it('infers system from content when omitted', () => {
    expect(fns.cp(ctx, ['a@b.com'])).toEqual({ system: 'email', value: 'a@b.com' });
    expect(fns.cp(ctx, ['+1 555 123 4567'])).toEqual({ system: 'phone', value: '+1 555 123 4567' });
    expect(fns.cp(ctx, ['https://example.org'])).toEqual({ system: 'url', value: 'https://example.org' });
  });

  it('falls back to "other" when the content matches no known pattern', () => {
    expect(fns.cp(ctx, ['just some text'])).toEqual({ system: 'other', value: 'just some text' });
  });

  it('uses the explicit system when given', () => {
    expect(fns.cp(ctx, ['fax', '555-0000'])).toEqual({ system: 'fax', value: '555-0000' });
  });
});
