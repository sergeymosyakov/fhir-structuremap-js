import { describe, it, expect } from 'vitest';
import { tokenize } from '../../src/fml/lexer.js';
import { FMLSyntaxError } from '../../src/fml/fml-syntax-error.js';

function types(tokens) {
  return tokens.map((t) => t.type);
}

describe('tokenize', () => {
  it('tokenizes keywords, identifiers, and punctuation', () => {
    const tokens = tokenize('group Foo(source src, target tgt) { }');
    expect(types(tokens)).toEqual([
      'KEYWORD', 'IDENT', 'PUNCT', 'KEYWORD', 'IDENT', 'PUNCT', 'KEYWORD', 'IDENT', 'PUNCT', 'PUNCT', 'PUNCT', 'EOF',
    ]);
  });

  it('tokenizes single- and double-quoted strings identically', () => {
    const [a, b] = tokenize("'hello' \"hello\"");
    expect(a).toMatchObject({ type: 'STRING', value: 'hello' });
    expect(b).toMatchObject({ type: 'STRING', value: 'hello' });
  });

  it('tokenizes a backtick-delimited identifier', () => {
    const [t] = tokenize('`not-a-keyword`');
    expect(t).toMatchObject({ type: 'DELIMITED_ID', value: 'not-a-keyword' });
  });

  it('tokenizes integers and decimals', () => {
    const tokens = tokenize('10 3.14');
    expect(tokens[0]).toMatchObject({ type: 'INTEGER', value: 10 });
    expect(tokens[1]).toMatchObject({ type: 'NUMBER', value: 3.14 });
  });

  it('tokenizes booleans distinctly from identifiers', () => {
    const [t] = tokenize('true');
    expect(t).toMatchObject({ type: 'BOOL', value: true });
  });

  it('tokenizes @date / @dateTime / @time literals', () => {
    const [d, dt, t] = tokenize('@2020-01-01 @2020-01-01T10:00:00Z @T10:00:00');
    expect(d).toMatchObject({ type: 'DATE', value: '@2020-01-01' });
    expect(dt).toMatchObject({ type: 'DATETIME', value: '@2020-01-01T10:00:00Z' });
    expect(t).toMatchObject({ type: 'TIME', value: '@T10:00:00' });
  });

  it('recognizes multi-char punctuation greedily', () => {
    const tokens = tokenize('-> .. << >>');
    expect(tokens.map((t) => t.value).slice(0, 4)).toEqual(['->', '..', '<<', '>>']);
  });

  it('skips line comments, block comments, and whitespace', () => {
    const tokens = tokenize('a // comment\n/* block */ b');
    expect(types(tokens)).toEqual(['IDENT', 'IDENT', 'EOF']);
  });

  it('handles escape sequences inside quoted strings', () => {
    const [t] = tokenize("'line1\\nline2 \\'quoted\\''");
    expect(t.value).toBe("line1\nline2 'quoted'");
  });

  it('records start/end character offsets for each token', () => {
    const tokens = tokenize('foo bar');
    expect(tokens[0]).toMatchObject({ start: 0, end: 3 });
    expect(tokens[1]).toMatchObject({ start: 4, end: 7 });
  });

  it('tokenizes unrecognized characters permissively as OTHER (FHIRPath syntax this lexer does not model)', () => {
    const tokens = tokenize('a % b > c');
    expect(types(tokens)).toEqual(['IDENT', 'OTHER', 'IDENT', 'OTHER', 'IDENT', 'EOF']);
  });

  it('throws on an unterminated string', () => {
    expect(() => tokenize("'unterminated")).toThrow(FMLSyntaxError);
  });
});
