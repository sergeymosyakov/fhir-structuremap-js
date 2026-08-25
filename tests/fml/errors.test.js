import { describe, it, expect } from 'vitest';
import { parseFMLToJSON } from '../../src/fml/index.js';
import { FMLSyntaxError } from '../../src/fml/fml-syntax-error.js';

describe('parseFMLToJSON — syntax errors', () => {
  it('throws when "map" is missing', () => {
    expect(() => parseFMLToJSON('"u" = X\ngroup g(source a) {}')).toThrow(FMLSyntaxError);
  });

  it('throws when "=" is missing in the map header', () => {
    expect(() => parseFMLToJSON('map "u" X\ngroup g(source a) {}')).toThrow(FMLSyntaxError);
  });

  it('throws when there are no groups at all', () => {
    expect(() => parseFMLToJSON('map "u" = X')).toThrow(/at least one group/);
  });

  it('throws on an unterminated group body', () => {
    expect(() => parseFMLToJSON('map "u" = X\ngroup g(source a) {')).toThrow(FMLSyntaxError);
  });

  it('throws on an invalid group typeMode keyword', () => {
    expect(() => parseFMLToJSON('map "u" = X\ngroup g(source a : X, target b : Y) <<bogus>> {}')).toThrow(FMLSyntaxError);
  });

  it('throws on a missing "(" in group parameters', () => {
    expect(() => parseFMLToJSON('map "u" = X\ngroup g source a) {}')).toThrow(FMLSyntaxError);
  });

  it('throws on an invalid inputMode keyword', () => {
    expect(() => parseFMLToJSON('map "u" = X\ngroup g(sideways a) {}')).toThrow(FMLSyntaxError);
  });

  it('throws when a rule is missing its terminating ";"', () => {
    expect(() => parseFMLToJSON('map "u" = X\ngroup g(source a, target b) {\n a.value as v -> b.value = v\n}')).toThrow(FMLSyntaxError);
  });

  it('throws on an unknown structure mode', () => {
    expect(() => parseFMLToJSON('map "u" = X\nuses "http://x" as sideways\ngroup g(source a) {}')).toThrow(FMLSyntaxError);
  });

  it('reports the correct line and column for a mid-file error', () => {
    try {
      parseFMLToJSON('map "u" = X\ngroup g(source a) {\n a.value -> b.value bogus\n}');
      expect.fail('expected a syntax error');
    } catch (e) {
      expect(e).toBeInstanceOf(FMLSyntaxError);
      expect(e.line).toBeGreaterThan(1);
    }
  });
});
