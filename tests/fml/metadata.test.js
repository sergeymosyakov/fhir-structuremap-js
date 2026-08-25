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

  it('ignores dotted/complex property lines', () => {
    expect(extractMetadata('/// jurisdiction.coding.system = urn:x')).toEqual({});
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
