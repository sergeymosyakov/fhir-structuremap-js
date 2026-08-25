// Hand-written lexer for the FHIR Mapping Language concrete syntax (§7.8.0, grammar at
// https://www.hl7.org/fhir/mapping.g4). Deliberately does not distinguish the
// grammar's `id` vs `IDENTIFIER` productions (both become IDENT) — that split exists
// upstream only to slightly restrict a few positions, and no real FML text depends on
// it. Also accepts double-quoted strings alongside the grammar's single-quoted STRING,
// since real-world FML (including the spec's own examples) uses double quotes for
// `map "url" = name` — the published grammar omits this token, a known upstream gap.
import { RESERVED_WORDS } from './reserved-words.js';
import { FMLSyntaxError } from './fml-syntax-error.js';

const MULTI_CHAR_PUNCT = ['->', '..', '<<', '>>'];
const SINGLE_CHAR_PUNCT = new Set(['(', ')', '{', '}', ',', ';', ':', '.', '=', '+', '*']);

function isIdentStart(ch) {
  return /[A-Za-z_]/.test(ch);
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_]/.test(ch);
}
function isDigit(ch) {
  return ch >= '0' && ch <= '9';
}

export class Lexer {
  #text;
  #pos = 0;
  #line = 1;
  #col = 1;

  constructor(text) {
    this.#text = text;
  }

  #peek(offset = 0) {
    return this.#text[this.#pos + offset];
  }

  #advance() {
    const ch = this.#text[this.#pos++];
    if (ch === '\n') { this.#line++; this.#col = 1; } else { this.#col++; }
    return ch;
  }

  #error(message) {
    throw new FMLSyntaxError(message, this.#line, this.#col);
  }

  #skipTrivia() {
    for (;;) {
      const ch = this.#peek();
      if (ch === undefined) return;
      if (/\s/.test(ch)) { this.#advance(); continue; }
      if (ch === '/' && this.#peek(1) === '/') {
        const lineStart = this.#pos;
        while (this.#peek() !== undefined && this.#peek() !== '\n') this.#advance();
        // A `/// name = """` metadata line left an odd number of `"""` markers open —
        // its multi-line markdown body (§7.8.0.3) has no `///` prefix on continuation
        // lines, so keep skipping raw text (across newlines) through the closing
        // `"""`, otherwise the parser would choke on the prose as if it were FML.
        const tripleCount = (this.#text.slice(lineStart, this.#pos).match(/"""/g) ?? []).length;
        if (tripleCount % 2 === 1) {
          while (this.#peek() !== undefined
            && !(this.#peek() === '"' && this.#peek(1) === '"' && this.#peek(2) === '"')) this.#advance();
          if (this.#peek() !== undefined) { this.#advance(); this.#advance(); this.#advance(); }
        }
        continue;
      }
      if (ch === '/' && this.#peek(1) === '*') {
        this.#advance(); this.#advance();
        while (this.#peek() !== undefined && !(this.#peek() === '*' && this.#peek(1) === '/')) this.#advance();
        if (this.#peek() === undefined) this.#error('Unterminated block comment');
        this.#advance(); this.#advance();
        continue;
      }
      return;
    }
  }

  #readQuoted(quote) {
    this.#advance(); // opening quote
    let value = '';
    while (this.#peek() !== quote) {
      if (this.#peek() === undefined) this.#error(`Unterminated ${quote}-quoted literal`);
      if (this.#peek() === '\\') {
        this.#advance();
        const esc = this.#advance();
        const map = { n: '\n', r: '\r', t: '\t', f: '\f', "'": "'", '"': '"', '\\': '\\', '/': '/' };
        value += map[esc] ?? esc;
      } else {
        value += this.#advance();
      }
    }
    this.#advance(); // closing quote
    return value;
  }

  tokenize() {
    const tokens = [];
    for (;;) {
      this.#skipTrivia();
      const line = this.#line;
      const col = this.#col;
      const start = this.#pos;
      const ch = this.#peek();
      let tok;

      if (ch === undefined) {
        tok = { type: 'EOF', value: null, line, col };
      } else if (ch === "'" || ch === '"') {
        tok = { type: 'STRING', value: this.#readQuoted(ch), line, col };
      } else if (ch === '`') {
        tok = { type: 'DELIMITED_ID', value: this.#readQuoted('`'), line, col };
      } else if (ch === '@') {
        tok = this.#readDateTimeLike(line, col);
      } else if (isDigit(ch)) {
        tok = this.#readNumber(line, col);
      } else if (isIdentStart(ch)) {
        let value = '';
        while (this.#peek() !== undefined && isIdentPart(this.#peek())) value += this.#advance();
        if (value === 'true' || value === 'false') {
          tok = { type: 'BOOL', value: value === 'true', line, col };
        } else if (RESERVED_WORDS.has(value)) {
          tok = { type: 'KEYWORD', value, line, col };
        } else {
          tok = { type: 'IDENT', value, line, col };
        }
      } else {
        const two = ch + (this.#peek(1) ?? '');
        if (MULTI_CHAR_PUNCT.includes(two)) {
          this.#advance(); this.#advance();
          tok = { type: 'PUNCT', value: two, line, col };
        } else if (SINGLE_CHAR_PUNCT.has(ch)) {
          this.#advance();
          tok = { type: 'PUNCT', value: ch, line, col };
        } else {
          // Anything else (%, >, <, !, |, &, ~, ...) is FHIRPath syntax this lexer
          // doesn't need to understand — the parser only ever fast-forwards past
          // these inside a raw-text-captured fhirPath span (see parser.js), so a
          // permissive catch-all token here (rather than a hard lex error) lets
          // whole-file tokenization succeed regardless of what any FHIRPath
          // expression elsewhere in the file contains.
          this.#advance();
          tok = { type: 'OTHER', value: ch, line, col };
        }
      }

      tok.start = start;
      tok.end = this.#pos;
      tokens.push(tok);
      if (tok.type === 'EOF') break;
    }
    return tokens;
  }

  #readNumber(line, col) {
    let value = '';
    while (this.#peek() !== undefined && isDigit(this.#peek())) value += this.#advance();
    if (this.#peek() === '.' && isDigit(this.#peek(1))) {
      value += this.#advance(); // '.'
      while (this.#peek() !== undefined && isDigit(this.#peek())) value += this.#advance();
      return { type: 'NUMBER', value: Number(value), line, col };
    }
    return { type: 'INTEGER', value: Number(value), line, col };
  }

  // @YYYY[-MM[-DD]] / @YYYY-MM-DDTHH:mm:ss(.s+)?(Z|+HH:mm|-HH:mm)? / @THH:mm:ss
  #readDateTimeLike(line, col) {
    let value = this.#advance(); // '@'
    if (this.#peek() === 'T') {
      value += this.#advance();
      while (this.#peek() !== undefined && /[0-9:.]/.test(this.#peek())) value += this.#advance();
      return { type: 'TIME', value, line, col };
    }
    while (this.#peek() !== undefined && /[0-9-]/.test(this.#peek())) value += this.#advance();
    if (this.#peek() === 'T') {
      value += this.#advance();
      while (this.#peek() !== undefined && /[0-9:.Z+-]/.test(this.#peek())) value += this.#advance();
      return { type: 'DATETIME', value, line, col };
    }
    return { type: 'DATE', value, line, col };
  }
}

export function tokenize(text) {
  return new Lexer(text).tokenize();
}
