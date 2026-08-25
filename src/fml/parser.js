// Recursive-descent parser for the FHIR Mapping Language concrete syntax, grounded in
// https://www.hl7.org/fhir/mapping.g4. Produces an AST close to the grammar's own
// node names; `ast-to-json.js` converts that AST into the StructureMap JSON shape our
// model layer already consumes.
//
// Two deliberate deviations from the published (buggy, per multiple known reports)
// grammar, documented here rather than silently applied:
//  1. `fhirPath` positions (default/where/check/log, and evaluate()'s expression
//     argument) capture the RAW SOURCE TEXT between balanced parens, instead of trying
//     to tokenize FHIRPath itself (which this lexer does not attempt to fully cover).
//  2. The bare `(expr)` target shorthand for `evaluate($this, expr)` (§7.8.0.8.2) is
//     supported even though the published `transform` grammar rule omits it.
// Multi-level `src -> tgt: a, b, c;` shorthand (not in the published grammar at all)
// is intentionally NOT supported — see PLAN.md Phase 7.
import { tokenize } from './lexer.js';
import { FMLSyntaxError } from './fml-syntax-error.js';

const LITERAL_TYPES = new Set(['STRING', 'INTEGER', 'NUMBER', 'BOOL', 'DATE', 'DATETIME', 'TIME']);
const IDENT_LIKE_TYPES = new Set(['IDENT', 'KEYWORD', 'DELIMITED_ID']);

class Parser {
  #text;
  #tokens;
  #i = 0;

  constructor(text) {
    this.#text = text;
    this.#tokens = tokenize(text);
  }

  #peek(offset = 0) {
    return this.#tokens[this.#i + offset];
  }

  #next() {
    return this.#tokens[this.#i++];
  }

  #err(message, tok = this.#peek()) {
    throw new FMLSyntaxError(`${message} — got ${tok.type} "${tok.value}"`, tok.line, tok.col);
  }

  #isPunct(value, offset = 0) {
    const t = this.#peek(offset);
    return t.type === 'PUNCT' && t.value === value;
  }

  #isKeyword(value, offset = 0) {
    const t = this.#peek(offset);
    return t.type === 'KEYWORD' && t.value === value;
  }

  #expectPunct(value) {
    if (!this.#isPunct(value)) this.#err(`Expected "${value}"`);
    return this.#next();
  }

  #expectKeyword(value) {
    if (!this.#isKeyword(value)) this.#err(`Expected keyword "${value}"`);
    return this.#next();
  }

  /** Grammar's `id`/`identifier`: accepts IDENT, a reserved word, or a backtick-quoted name. */
  #expectIdentLike() {
    const t = this.#peek();
    if (!IDENT_LIKE_TYPES.has(t.type)) this.#err('Expected an identifier');
    return this.#next().value;
  }

  /** `url`: our lexer has no dedicated URL token — any string-like literal qualifies. */
  #expectUrl() {
    const t = this.#peek();
    if (t.type !== 'STRING' && t.type !== 'DELIMITED_ID') this.#err('Expected a url');
    return this.#next().value;
  }

  #parseLiteral() {
    const t = this.#peek();
    if (!LITERAL_TYPES.has(t.type)) this.#err('Expected a literal');
    this.#next();
    return { kind: 'literal', literalType: t.type, value: t.value };
  }

  /**
   * Captures raw FHIRPath source text between balanced parens, given the character
   * offset right after an already-consumed opening '('. Skips past whatever tokens
   * fall inside that span, then consumes the matching ')'.
   */
  #captureParenExpr() {
    let i = this.#peek(-1)?.end; // wait: caller consumes '(' immediately before calling
    let depth = 1;
    const start = i;
    while (i < this.#text.length) {
      const ch = this.#text[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      else if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch; i++;
        while (i < this.#text.length && this.#text[i] !== quote) { if (this.#text[i] === '\\') i++; i++; }
      }
      i++;
    }
    if (i >= this.#text.length) this.#err('Unterminated expression (missing closing ")")');
    const raw = this.#text.slice(start, i).trim();
    while (this.#peek() && this.#peek().start < i) this.#i++;
    this.#expectPunct(')');
    return raw;
  }

  /** `';'`-terminated raw FHIRPath, for `const`. */
  #captureUntilSemicolon() {
    let i = this.#peek().start;
    const start = i;
    while (i < this.#text.length && this.#text[i] !== ';') {
      if (this.#text[i] === "'" || this.#text[i] === '"') {
        const quote = this.#text[i]; i++;
        while (i < this.#text.length && this.#text[i] !== quote) { if (this.#text[i] === '\\') i++; i++; }
      }
      i++;
    }
    if (i >= this.#text.length) this.#err('Unterminated constant (missing ";")');
    const raw = this.#text.slice(start, i).trim();
    while (this.#peek() && this.#peek().start < i) this.#i++;
    this.#expectPunct(';');
    return raw;
  }

  // structureMap : mapId structure* imports* const* group+ EOF
  parseStructureMap() {
    const { url, name } = this.#parseMapId();
    const structures = [];
    while (this.#isKeyword('uses')) structures.push(this.#parseStructure());
    const imports = [];
    while (this.#isKeyword('imports')) imports.push(this.#parseImports());
    const consts = [];
    while (this.#isLet()) consts.push(this.#parseConst());
    const groups = [];
    while (!this.#isEOF()) groups.push(this.#parseGroup());
    if (groups.length === 0) this.#err('Expected at least one group');
    return { url, name, structures, imports, consts, groups };
  }

  #isLet() {
    return this.#peek().type === 'IDENT' && this.#peek().value === 'let';
  }

  #isEOF() {
    return this.#peek().type === 'EOF';
  }

  // mapId : 'map' url '=' identifier
  #parseMapId() {
    this.#expectKeyword('map');
    const url = this.#expectUrl();
    this.#expectPunct('=');
    const name = this.#expectIdentLike();
    return { url, name };
  }

  // structure : 'uses' url structureAlias? 'as' modelMode
  #parseStructure() {
    this.#expectKeyword('uses');
    const url = this.#expectUrl();
    let alias;
    if (this.#isKeyword('alias')) { this.#next(); alias = this.#expectIdentLike(); }
    this.#expectKeyword('as');
    const mode = this.#expectKeyword_modelMode();
    return { url, alias, mode };
  }

  #expectKeyword_modelMode() {
    const t = this.#peek();
    if (t.type === 'KEYWORD' && ['source', 'queried', 'target', 'produced'].includes(t.value)) return this.#next().value;
    this.#err('Expected a structure mode (source|queried|target|produced)');
    return undefined;
  }

  // imports : 'imports' url
  #parseImports() {
    this.#expectKeyword('imports');
    return this.#expectUrl();
  }

  // const : 'let' id '=' fhirPath ';'
  #parseConst() {
    this.#next(); // 'let' (IDENT, not a reserved keyword)
    const name = this.#expectIdentLike();
    this.#expectPunct('=');
    const value = this.#captureUntilSemicolon();
    return { name, value };
  }

  // group : 'group' id parameters extends? typeMode? rules
  #parseGroup() {
    this.#expectKeyword('group');
    const name = this.#expectIdentLike();
    const inputs = this.#parseParameters();
    let extendsName;
    if (this.#isKeyword('extends')) { this.#next(); extendsName = this.#expectIdentLike(); }
    let typeMode = 'none';
    if (this.#isPunct('<<')) {
      this.#next();
      typeMode = this.#parseGroupTypeMode();
      this.#expectPunct('>>');
    }
    const rules = this.#parseRules();
    return { name, inputs, extends: extendsName, typeMode, rules };
  }

  #parseGroupTypeMode() {
    if (this.#isKeyword('types')) { this.#next(); return 'types'; }
    if (this.#peek().type === 'KEYWORD' && this.#peek().value === 'type' && this.#isPunct('+', 1)) {
      this.#next(); this.#next();
      return 'type-and-types';
    }
    this.#err('Expected "types" or "type+"');
    return undefined;
  }

  // parameters : '(' parameter (',' parameter)* ')'  — allows a single input (spec
  // prose permits this for a map's first group; the published grammar's `+` is a bug).
  #parseParameters() {
    this.#expectPunct('(');
    const params = [this.#parseParameter()];
    while (this.#isPunct(',')) { this.#next(); params.push(this.#parseParameter()); }
    this.#expectPunct(')');
    return params;
  }

  // parameter : inputMode id type?
  #parseParameter() {
    const mode = this.#expectKeyword_inputMode();
    const name = this.#expectIdentLike();
    let type;
    if (this.#isPunct(':')) { this.#next(); type = this.#expectIdentLike(); }
    return { mode, name, type };
  }

  #expectKeyword_inputMode() {
    const t = this.#peek();
    if (t.type === 'KEYWORD' && (t.value === 'source' || t.value === 'target')) return this.#next().value;
    this.#err('Expected "source" or "target"');
    return undefined;
  }

  // rules : '{' rule* '}'
  #parseRules() {
    this.#expectPunct('{');
    const rules = [];
    while (!this.#isPunct('}')) rules.push(this.#parseRule());
    this.#expectPunct('}');
    return rules;
  }

  // rule : ruleSources ('->' ruleTargets)? dependent? ruleName? ';'
  #parseRule() {
    const sources = this.#parseRuleSources();
    let targets = [];
    if (this.#isPunct('->')) { this.#next(); targets = this.#parseRuleTargets(); }
    let dependent = null;
    if (this.#isKeyword('then')) dependent = this.#parseDependent();
    let name;
    if (!this.#isPunct(';')) name = this.#expectIdentLike();
    this.#expectPunct(';');
    return { sources, targets, dependent, name };
  }

  #parseRuleSources() {
    const sources = [this.#parseRuleSource()];
    while (this.#isPunct(',')) { this.#next(); sources.push(this.#parseRuleSource()); }
    return sources;
  }

  // ruleSource : ruleContext sourceType? sourceCardinality? sourceDefault? sourceListMode? alias? whereClause? checkClause? log?
  #parseRuleSource() {
    const [context, element, extra] = this.#parseRuleContextForSource();
    let type;
    if (this.#isPunct(':')) { this.#next(); type = this.#expectIdentLike(); }
    let min; let max;
    if (this.#peek().type === 'INTEGER' && this.#isPunct('..', 1)) {
      min = this.#next().value; this.#next();
      max = this.#isPunct('*') ? (this.#next(), '*') : this.#next().value;
    }
    let defaultValue;
    if (this.#isKeyword('default')) {
      this.#next(); this.#expectPunct('('); defaultValue = this.#captureParenExpr();
    }
    let listMode;
    if (this.#isSourceListModeToken()) listMode = this.#next().value;
    let variable;
    if (this.#isKeyword('as')) { this.#next(); variable = this.#expectIdentLike(); }
    let condition;
    if (this.#isKeyword('where')) { this.#next(); this.#expectPunct('('); condition = this.#captureParenExpr(); }
    let check;
    if (this.#isKeyword('check')) { this.#next(); this.#expectPunct('('); check = this.#captureParenExpr(); }
    let logMessage;
    if (this.#isKeyword('log')) {
      this.#next(); this.#expectPunct('('); logMessage = this.#captureParenExpr();
    }
    return { context, element, extra, type, min, max, defaultValue, listMode, variable, condition, check, logMessage };
  }

  #isSourceListModeToken() {
    const t = this.#peek();
    return t.type === 'KEYWORD' && ['first', 'not_first', 'last', 'not_last', 'only_one'].includes(t.value);
  }

  // ruleContext : identifier ('.' identifier)* — for a source, only 1 or 2 segments
  // are meaningful (context[.element]); 3+ is not supported (see module doc comment).
  #parseRuleContextForSource() {
    const segs = [this.#expectIdentLike()];
    while (this.#isPunct('.')) { this.#next(); segs.push(this.#expectIdentLike()); }
    if (segs.length > 2) this.#err('Source context with more than one "." is not supported');
    return [segs[0], segs[1], segs.slice(2)];
  }

  #parseRuleTargets() {
    const targets = [this.#parseRuleTarget()];
    while (this.#isPunct(',')) { this.#next(); targets.push(this.#parseRuleTarget()); }
    return targets;
  }

  // ruleTarget : ruleContext ('=' transform)? alias? targetListMode?
  //            | invocation alias?
  #parseRuleTarget() {
    // A bare invocation with no target context at all (pure "then group(...)"-style
    // call used as a target, e.g. an implicit dependent-group shorthand) — rare; the
    // common case below (ruleContext '=' transform) covers virtually all real FML.
    const segs = [this.#expectIdentLike()];
    while (this.#isPunct('.')) { this.#next(); segs.push(this.#expectIdentLike()); }
    const context = segs[0];
    const elementChain = segs.slice(1); // supports subElement chaining (§7.8.0.8.2)

    let transform;
    if (this.#isPunct('=')) {
      this.#next();
      transform = this.#parseTransform();
    }
    let variable;
    if (this.#isKeyword('as')) { this.#next(); variable = this.#expectIdentLike(); }
    let listMode;
    if (this.#isTargetListModeToken()) listMode = this.#next().value;
    return { context, elementChain, transform, variable, listMode };
  }

  #isTargetListModeToken() {
    const t = this.#peek();
    return t.type === 'KEYWORD' && ['first', 'share', 'last', 'single'].includes(t.value);
  }

  // transform : literal | ruleContext | invocation | '(' fhirPath ')'  (last is our
  // documented addition for the evaluate() shorthand, §7.8.0.8.2).
  #parseTransform() {
    if (this.#isPunct('(')) {
      this.#next();
      const expr = this.#captureParenExpr();
      return { kind: 'shorthandEvaluate', expr };
    }
    if (LITERAL_TYPES.has(this.#peek().type)) return this.#parseLiteral();
    // Distinguish `invocation` (name '(' ...) from a bare `ruleContext` variable copy.
    if (IDENT_LIKE_TYPES.has(this.#peek().type) && this.#isPunct('(', 1)) return this.#parseInvocation();
    const segs = [this.#expectIdentLike()];
    while (this.#isPunct('.')) { this.#next(); segs.push(this.#expectIdentLike()); }
    return { kind: 'contextRef', segments: segs };
  }

  // invocation : identifier '(' paramList? ')'
  #parseInvocation() {
    const name = this.#expectIdentLike();
    this.#expectPunct('(');
    if (name === 'evaluate') {
      // evaluate(context, fhirPathExpr) — 2nd argument is raw FHIRPath, not `literal | id`
      // (a known gap in the published `param` grammar rule).
      const context = this.#parseParam();
      let expr = '';
      if (this.#isPunct(',')) { this.#next(); expr = this.#captureRestAsExprUntilCloseParen(); }
      else this.#expectPunct(')');
      return { kind: 'invocation', name, params: [context, { kind: 'literal', literalType: 'STRING', value: expr }] };
    }
    const params = [];
    if (!this.#isPunct(')')) {
      params.push(this.#parseParam());
      while (this.#isPunct(',')) { this.#next(); params.push(this.#parseParam()); }
    }
    this.#expectPunct(')');
    return { kind: 'invocation', name, params };
  }

  /** Captures the remaining raw text up to (not including) the matching ')', for
   * evaluate()'s 2nd argument — reuses the same balanced-paren scanner, just entered
   * mid-argument-list rather than right after '('. */
  #captureRestAsExprUntilCloseParen() {
    let i = this.#peek().start;
    const start = i;
    let depth = 1;
    while (i < this.#text.length) {
      const ch = this.#text[i];
      if (ch === '(') depth++;
      else if (ch === ')') { depth--; if (depth === 0) break; }
      else if (ch === "'" || ch === '"' || ch === '`') {
        const quote = ch; i++;
        while (i < this.#text.length && this.#text[i] !== quote) { if (this.#text[i] === '\\') i++; i++; }
      }
      i++;
    }
    if (i >= this.#text.length) this.#err('Unterminated evaluate() expression');
    const raw = this.#text.slice(start, i).trim();
    while (this.#peek() && this.#peek().start < i) this.#i++;
    this.#expectPunct(')');
    return raw;
  }

  #parseParam() {
    if (LITERAL_TYPES.has(this.#peek().type)) return this.#parseLiteral();
    return { kind: 'idRef', name: this.#expectIdentLike() };
  }

  // dependent : 'then' (invocation (',' invocation)* rules? | rules)
  #parseDependent() {
    this.#expectKeyword('then');
    if (this.#isPunct('{')) return { invocations: [], rules: this.#parseRules() };
    const invocations = [this.#parseInvocation()];
    while (this.#isPunct(',')) { this.#next(); invocations.push(this.#parseInvocation()); }
    const rules = this.#isPunct('{') ? this.#parseRules() : [];
    return { invocations, rules };
  }
}

export function parseFML(text) {
  return new Parser(text).parseStructureMap();
}
