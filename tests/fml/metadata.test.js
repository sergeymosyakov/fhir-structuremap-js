import { describe, it, expect } from 'vitest';
import { extractMetadata } from '../../src/fml/metadata.js';
import { parseFMLToJSON } from '../../src/fml/index.js';

describe('extractMetadata', () => {
  it('extracts simple primitive metadata fields', () => {
    const text = `
      /// title = 'My Map'
      /// status = 'active'
      /// experimental = true
      /// version = 1.0.0
    `;
    expect(extractMetadata(text)).toEqual({ title: 'My Map', status: 'active', experimental: true, version: '1.0.0' });
  });

  it('parses a bare unquoted false', () => {
    expect(extractMetadata('/// experimental = false')).toEqual({ experimental: false });
  });

  it('accepts double-quoted values too', () => {
    expect(extractMetadata('/// title = "My Map"')).toEqual({ title: 'My Map' });
  });

  it('ignores unknown complex field names not in COMPLEX_METADATA_SCHEMA', () => {
    expect(extractMetadata("/// useContext.code.system = urn:x")).toEqual({});
  });

  it('ignores unknown field names', () => {
    expect(extractMetadata('/// notAField = 1')).toEqual({});
  });

  it('ignores plain comments that are not metadata', () => {
    expect(extractMetadata('// just a comment\n/// also not = valid = weird')).toEqual({});
  });

  it('extracts a multi-line """markdown""" value, without a /// prefix on continuation lines', () => {
    const text = [
      '/// description = """',
      'Line one.',
      'Line two.',
      '"""',
    ].join('\n');
    expect(extractMetadata(text)).toEqual({ description: '\nLine one.\nLine two.\n' });
  });

  it('extracts a """markdown""" value that opens and closes on the same line', () => {
    expect(extractMetadata('/// description = """short"""')).toEqual({ description: 'short' });
  });

  it('extracts a multi-line value followed by further ordinary metadata lines', () => {
    const text = [
      '/// description = """',
      'multi',
      'line',
      '"""',
      "/// status = 'active'",
    ].join('\n');
    expect(extractMetadata(text)).toEqual({ description: '\nmulti\nline\n', status: 'active' });
  });

  it('takes the rest of the text when a """ value is never closed', () => {
    const text = ['/// description = """', 'unterminated'].join('\n');
    expect(extractMetadata(text)).toEqual({ description: '\nunterminated' });
  });
});

describe('extractMetadata — dotted/repeating complex properties (§7.8.0.3)', () => {
  it('matches the spec\'s own worked example exactly', () => {
    const text = [
      '/// jurisdiction =',
      '/// jurisdiction.coding =',
      "/// jurisdiction.coding.system = 'urn:iso:std:iso:3166'",
      "/// jurisdiction.coding.code = 'AQ'",
    ].join('\n');
    expect(extractMetadata(text)).toEqual({
      jurisdiction: [{ coding: [{ system: 'urn:iso:std:iso:3166', code: 'AQ' }] }],
    });
  });

  it('supports a dotted path directly, without a preceding bare "name =" line', () => {
    const text = ["/// jurisdiction.coding.code = 'AQ'"].join('\n');
    expect(extractMetadata(text)).toEqual({ jurisdiction: [{ coding: [{ code: 'AQ' }] }] });
  });

  it('a repeated leaf property starts a new instance at the nearest repeating ancestor', () => {
    const text = [
      "/// jurisdiction.coding.system = 'urn:iso:std:iso:3166'",
      "/// jurisdiction.coding.code = 'AQ'",
      "/// jurisdiction.coding.system = 'urn:iso:std:iso:3166'",
      "/// jurisdiction.coding.code = 'AU'",
    ].join('\n');
    expect(extractMetadata(text)).toEqual({
      jurisdiction: [{
        coding: [
          { system: 'urn:iso:std:iso:3166', code: 'AQ' },
          { system: 'urn:iso:std:iso:3166', code: 'AU' },
        ],
      }],
    });
  });

  it('a bare "name =" line starts a new top-level instance even mid-stream', () => {
    const text = [
      "/// jurisdiction.coding.code = 'AQ'",
      '/// jurisdiction =',
      "/// jurisdiction.coding.code = 'AU'",
    ].join('\n');
    expect(extractMetadata(text)).toEqual({
      jurisdiction: [{ coding: [{ code: 'AQ' }] }, { coding: [{ code: 'AU' }] }],
    });
  });

  it('supports the other hardcoded complex field, contact (ContactDetail[] -> ContactPoint[])', () => {
    const text = [
      "/// contact.name = 'Grahame Grieve'",
      "/// contact.telecom.system = 'email'",
      "/// contact.telecom.value = 'grahame@example.org'",
    ].join('\n');
    expect(extractMetadata(text)).toEqual({
      contact: [{ name: 'Grahame Grieve', telecom: [{ system: 'email', value: 'grahame@example.org' }] }],
    });
  });

  it('ignores an unsupported nested field name under a known complex root, with no side effect', () => {
    expect(extractMetadata("/// jurisdiction.notAField = 'x'")).toEqual({});
  });
});

describe('parseFMLToJSON — metadata integration', () => {
  it('applies /// metadata lines onto the resulting StructureMap JSON', () => {
    const json = parseFMLToJSON(`
      /// title = 'My Title'
      /// status = 'active'
      map "http://example.org/u" = X
      group g(source a, target b) {}
    `);
    expect(json.title).toBe('My Title');
    expect(json.status).toBe('active');
    expect(json.url).toBe('http://example.org/u');
  });

  it('defaults status to draft when no metadata overrides it', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source a, target b) {}');
    expect(json.status).toBe('draft');
  });
});
