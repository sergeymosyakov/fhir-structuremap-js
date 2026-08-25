# Implementation Plan — fhir-structuremap-js

Standalone, dependency-light, browser-capable engine that executes FHIR `StructureMap`
resources (the FHIR Mapping Language, FML) against real data. Positioned as a
self-sufficient library: usable standalone (`npm install fhir-structuremap-js`),
not tied to any particular host application.

Grounded directly in the HL7 specification:
- Mapping Language (concrete syntax + execution semantics): https://www.hl7.org/fhir/mapping-language.html
- StructureMap resource (abstract syntax / JSON schema): https://www.hl7.org/fhir/structuremap.html

Full spec coverage is the goal — every section below maps to a spec section, and no
phase is considered "done" until its slice of the spec is implemented and tested, not
just stubbed.

## Architecture principles (apply throughout, not just phase 1)

- **Factory / registry pattern, not a monolith.** Every extensible concept (transform
  functions, source list-modes, target list-modes, default-value coercions) is a
  `Map<key, handler>` populated by a `createDefault*Registry()` factory, mirroring the
  `NODE_REGISTRY` / `MODAL_REGISTRY` pattern already proven in the sibling
  `fhir-questionnaire-builder` project. Adding a new transform function means adding one
  registration call, never touching the engine's dispatch code.
- **One concern per file.** Model classes, the transform registry, the execution engine,
  and the (later) FML text parser each live in their own module tree. No god-file.
- **Model layer is pure data + parsing (no execution).** `StructureMapDocument.fromJSON()`
  builds an object graph; it never evaluates anything. The engine consumes that graph.
- **Engine depends on an injected FHIRPath evaluator, not a bundled one.** The host
  application supplies `{ evaluate }` (e.g. the `fhirpath` npm package, or a project's
  own wrapper) — `fhirpath` stays a peer dependency, never vendored in, so a browser app
  that already ships a FHIRPath engine (like `fhir-questionnaire-builder`) doesn't pay for
  a second copy.
- **No bundled base StructureDefinitions.** Type-checking/dispatch that needs profile
  data asks an injected resolver (`structureDefinitionResolver(url)`), same shape as the
  Mapping Support API the spec itself describes (§7.8.0.1) — this is what keeps the
  package small and avoids the multi-MB profile dumps we found unacceptable in the
  npm-registry alternative we evaluated.
- **Every phase ships with unit tests against hand-written StructureMap JSON fixtures**
  (and, once available, official FHIR test-case fixtures) — no phase is "done" on
  vibes.

## Phase 1 — Core data model & transform registry (starting now)

Spec: §7.8.0.3–§7.8.0.7 (Metadata, Structure Definition References, Imports, Constants,
Groups), §7.9.5 (StructureMap resource schema).

- `src/model/` — parsed object graph, built by `StructureMapDocument.fromJSON(json)`:
  - `StructureMapDocument` (url, name, status, structures[], imports[], consts[], groups: Map<name, Group>)
  - `StructureDefRef` (url, mode: source|queried|target|produced, alias)
  - `ConstDef` (name, value — raw FHIRPath expression string, lazily evaluated later)
  - `Group` (name, extends, typeMode: none|types|type-and-types, inputs[], rules[])
  - `GroupInput` (name, type, mode: source|target)
  - `Rule` (name, source[], target[], rules[] (nested/dependent literal rules), dependent[] (named group invocations))
  - `RuleSource` (context, element, type, min, max, listMode, variable, condition, check, logMessage, defaultValue)
  - `RuleTarget` (context, element, variable, listMode[], transform, parameter[])
  - `Parameter` — normalizes FHIR's `value[x]` polymorphism (valueId/valueString/valueBoolean/…) into `{ kind, value }`
- `src/transforms/registry.js` — `TransformRegistry` class (`register(name, handler)`,
  `get(name)`, `has(name)`) + `createDefaultTransformRegistry()` factory that registers
  all 17 spec-defined transform names (§7.8.0.8.2 table): `create, copy, truncate,
  escape, cast, append, translate, reference, dateOp, uuid, pointer, evaluate, cc, c,
  qty, id, cp`. Phase 1 registers each with a documented signature and a
  not-yet-implemented marker; Phase 3 replaced every marker with a real handler (see
  below). Registering happens by name so a consumer can override/extend without
  touching engine code.
- Unit tests: round-trip a hand-written StructureMap JSON fixture through
  `StructureMapDocument.fromJSON()` and assert the object graph shape; assert the
  registry has all 17 names and rejects duplicate registration.

## Phase 2 — Execution engine skeleton: variable scoping & rule matching

Spec: §7.8.0.8 (Transform Rules, overview), §7.8.0.8.1 (Source Content).

- `src/engine/scope.js` — `VariableScope` (parent-chained map of name → value/node,
  mirrors FML's nested-rule variable visibility rules).
- `src/engine/engine.js` — `StructureMapEngine` — entry point `run(structureMap, inputs)`.
  Resolves the first/named group, binds `inputs` to group `input[]` by mode+name.
- Source-content resolution per rule: `context.element`, cardinality check (`min..max`
  → engine error if violated), `type` filter, `listMode` (`first | not_first | last |
  not_last | only_one`), `defaultValue` (FHIRPath literal, primitives only), `variable`
  binding, `condition` (`where`) filtering, `check` (hard error if false), `logMessage`
  (§7.8.0.8.1.1, equivalent to FHIRPath `trace()`).
- Multi-source permutation semantics: when a rule has multiple source statements, the
  rule fires once per combination of matching elements (§7.8.0.8.1 example with `for
  src.row as row, row.firstName as firstName`) — implement exactly as specified,
  including the "no value → rule never fires" case.
- Tests: each source-content feature gets its own fixture + assertion, including the
  4-firings permutation example from the spec itself.

## Phase 3 — Target transform execution (all 17 functions, for real) — DONE

Spec: §7.8.0.8.2 (Target Transform + full function table).

Delivered: each transform is its own module under `src/transforms/functions/`, wired
into `createDefaultTransformRegistry()`, with a `resolveParameter`/`resolveParameters`
helper (`src/transforms/param-resolution.js`) that turns a `Parameter` (`valueId` means
variable lookup, anything else is a literal) into the plain value a handler receives.

- `create` (injected `ctx.createInstance`, else `{}`), `copy`, `truncate`
  (`String#substring`), `escape` (xml-to-plain-text only — the spec defines no format
  vocabulary beyond that), `cast` (string/integer/decimal/boolean/Reference; explicit
  type required, implicit inference needs Phase 6), `append`, `translate` (injected
  `ctx.translate`, all 5 output kinds), `reference`/`pointer` (`ResourceType/id`),
  `uuid` (injected `ctx.uuidFactory`, else `crypto.randomUUID()`), `cc`, `c`, `qty`
  (natural-text and explicit forms), `id`, `cp` (system inference from content).
- `evaluate` (`src/transforms/functions/evaluate.js`) runs the injected FHIRPath
  evaluator and returns the raw result collection — interpreting 0/1/many results
  against a target's cardinality is target-application logic, deliberately deferred
  (see below).
- `dateOp` intentionally throws a documented error: the spec's own table lists its
  parameters as `??` — inventing semantics the spec never defined would violate THE
  MUST rule 3 (spec fidelity over shortcuts).
- Tests: one `describe` block per function in `tests/transforms/functions.test.js`,
  covering both happy paths and the documented error cases.

**Scope correction (discovered mid-implementation, documented here for honesty):**
actually writing a computed value into a target tree — auto-create for
`transform`-less targets, target `listMode` (`first | share | last | single`) assembly
across sibling rules targeting the same list, and turning `evaluate`'s multi-value
result into multiple target instances — all require bookkeeping shared across a whole
group's rule executions (which rule claimed "first", what a shared list already
contains, etc.). That is inherently the same kind of per-group execution state Phase 4
needs for dependent-rule execution, so target-value application (the write side) moves
to Phase 4, done together with dependent rules rather than half-built twice here. Phase
3 as delivered covers every transform function as a pure, fully-tested computation —
the missing piece is only the "write the computed value into the tree" plumbing, not
the transforms themselves.

## Phase 4 — Target-value application, dependent rules, groups, default mapping groups — DONE

Spec: §7.8.0.7 (Groups, extends), §7.8.0.8.3 (Type Wrangling), §7.8.0.8.4 (Dependent
Rules).

Absorbs the target-value application work deferred from Phase 3 (see its "Scope
correction" note): writing a rule's computed target values into the actual tree,
auto-create for `transform`-less targets with the type-wrangling error cases, target
`listMode` (`first | share | last | single`) assembly across sibling rules sharing a
target list, and expanding `evaluate`'s multi-value results into multiple target
instances (error if the target is non-repeating) — all naturally need the same
per-group execution bookkeeping as dependent-rule execution — DONE:

- `src/engine/list-plan.js` (`ListPlan`) — deferred first/middle/last buckets flushed
  once per `run()` (so rule execution order never affects final placement, matching
  "first must come first regardless of which rule ran when"), plus `share`/`single`
  cursor-based merge into existing items. Both are a concrete, tested interpretation of
  the spec's own acknowledged "TODO: what do these do?" for target list modes.
- `src/engine/target-applier.js` (`applyTarget`) — dispatches to the transform
  registry (or untyped auto-create when no `transform`), unwraps `evaluate()`'s 0/1/many
  result collection, and infers "is this element repeating" only from a pre-existing
  array or an explicit `listMode` — never merely from getting multiple values back,
  which instead throws for a target with no such signal (a real bug caught by its own
  test: the first draft treated "many values" as automatic proof of repeating-ness).
- `src/engine/rule-executor.js` (`executeRule`) — recurses into nested `rule.rule[]`
  inheriting the firing scope, and invokes `rule.dependent[]` by name with positionally
  resolved arguments.
- `src/engine/group-invoker.js` / `src/engine/effective-rules.js` — positional input
  binding for dependent group invocation, and `extends` (base group's rules run before
  the derived group's own, with circular-chain detection).
- `StructureMapEngine.run(doc, inputs, groupName?)` — the real top-level entry point:
  binds inputs, executes every effective rule of the resolved group, flushes the
  `ListPlan`, and returns the target-mode inputs.
- Tests: `tests/engine/{list-plan,target-applier,rule-executor,effective-rules,
  group-invoker,engine-run}.test.js` — nested rules, dependent invocation, extends
  inheritance, and a full Patient→Observation `run()` reproducing the same shape
  verified live in the browser-integration research earlier in this project's history.

**Deferred to Phase 6 (documented here, not silently dropped):** default mapping
groups (`typeMode: types | type-and-types`) and the identity-transform simple form
(`src.element -> tgt.element;`) both require knowing the *target* element's expected
type to dispatch correctly — which needs a real `structureDefinitionResolver`, not
available until Phase 6. Implementing a guessed type-inference now would violate THE
MUST rule 3; it lands alongside Phase 6's type-aware work instead.

## Phase 5 — Imports & constants — DONE

Spec: §7.8.0.5 (Map Imports), §7.8.0.6 (Constants).

- `src/engine/import-resolver.js` (`resolveImportedGroup`) — `rule.dependent[]` group
  lookup now searches the current map, then recursively through `doc.import[]` via an
  injected `ctx.structureMapResolver(pattern)` (always returns an array — matching a
  `*` wildcard pattern against "available maps" is the host's job, since the engine
  has no built-in registry of what maps exist), with a visited-set guarding circular
  import chains. `getEffectiveRules` runs against whichever document actually owns the
  resolved group (so an imported group's own `extends` resolves within its own map).
- `src/engine/constants.js` (`ConstantResolver`) — `doc.const[]` resolved genuinely
  lazily: `resolve(name)` only evaluates a constant's FHIRPath expression the first
  time it's referenced, caches the result, and detects circular constant-to-constant
  references. `asEnv()` wraps the FHIRPath env in a `Proxy` so laziness holds even for
  constants referenced only inside an arbitrary condition/`evaluate()` expression string
  the engine never parses — the underlying `fhirpath` library reads env vars by plain
  property access, so the Proxy's `get` trap resolves on demand.
- `VariableScope` gained an optional constants fallback (root scope only, inherited
  through the parent chain) so a constant name can be used directly as a rule's source
  `context`, per "the names are available as source variables".
- **Documented simplification:** constants are resolved once from the top-level
  document passed to `run()` and used for the whole run, including inside rules
  belonging to a group invoked from an imported map — the spec scopes constant names
  "within a single mapping source file", so a fully faithful implementation would swap
  the constants resolver at every import-crossing. That's a meaningfully bigger change
  (ctx would need to carry a per-owning-document constants resolver) for a rare case;
  flagged here rather than silently assumed.
- Tests: `tests/engine/{constants,import-resolver}.test.js` (laziness, caching,
  circular-reference detection, cross-map group resolution, circular-import safety)
  plus `tests/engine/engine-run-phase5.test.js` (full `run()` using a constant as
  `%name` in an `evaluate()` expression, a constant used directly as source `context`,
  and a dependent group invoked from an imported map).

## Phase 6 — Type-aware features (incl. default mapping group dispatch, deferred from Phase 4) — DONE

Spec: §7.8.0.4 (Structure Definition References — `queried`/`produced` modes),
§7.8.0.8.3 (Type Wrangling), §7.8.0.9 (Simple Form / identity transform), §7.8.0.10
(Default mapping groups, `<<types>>`/`<<type+>>`).

- `src/engine/structure-definition.js` — minimal StructureDefinition helpers
  (`getDeclaredChildKeys`, `resolveChildType`) over `snapshot.element[]`/
  `differential.element[]` — not a validator, just enough to check "does this value's
  own shape fit type X" and "what's the declared type of this child element".
- `matchesType` (node-access.js) now checks structurally against an injected
  `ctx.structureDefinitionResolver(type)` for complex values with no `resourceType` tag,
  instead of always accepting them.
- `VariableScope` gained parallel, best-effort declared-type tracking (`setType`/
  `getType`) — seeded from `group.input[].type`, an explicit `RuleSource.type`, or an
  explicit `create("Type")` call — used only to drive default-mapping-group dispatch,
  never required for value binding.
- `src/engine/default-mapping.js` (`findDefaultGroup`) + `src/engine/identity-shorthand.js`
  (`applyIdentityShorthand`) — a target with no `transform`, in a rule with no
  `dependent`/nested `rule[]`, resolves both ends' types (via the tracked scope types +
  `structureDefinitionResolver`) and, if a matching `types`/`type-and-types` group
  exists, auto-creates the target instance and invokes that group — the identity
  transform simple form. Falls back to plain untyped auto-create (Phase 4's behavior)
  whenever the types can't be resolved, rather than erroring.
- `queried`/`produced` structure modes — the spec gives no dedicated concrete-syntax
  hook beyond the Mapping Support API itself, so `ctx.queryInstances(type)` /
  `ctx.produceInstance(type)` are exposed on the engine and reachable from any
  registered transform (built-in or custom) — proven end to end in
  `tests/engine/queried-produced.test.js`.
- Tests: `tests/engine/{structure-definition,node-access,default-mapping}.test.js`
  (unit-level) plus `tests/engine/engine-run-phase6.test.js` (full `run()` dispatching
  Patient.name (HumanName) → Envelope.label (DisplayName) through a real default
  group, and the graceful fallback when no default group matches) — all against small,
  hand-written StructureDefinition fixtures in `tests/fixtures/`, never a bundled
  profile dump.

## Phase 7 — FML concrete-syntax parser (optional round-trip layer) — DONE

Spec: full §7.8.0 (concrete syntax), formal grammar at https://www.hl7.org/fhir/mapping.g4.
We investigated adopting `@synanetics/fhir-fml-convert` (MIT, ANTLR4-generated from
HL7's own grammar) instead of hand-writing this — its own README documents unsupported
`const`/`check`/`listMode`, all of which our engine already implements, so a hand-written
parser was chosen to keep full feature parity with the JSON-execution path.

Delivered as `src/fml/`: `lexer.js` (hand-written tokenizer) → `parser.js`
(recursive-descent, one method per grammar production) → `ast-to-json.js` (AST → the
same StructureMap JSON shape `StructureMapDocument.fromJSON()` already consumes) →
`index.js` (`parseFMLToJSON`/`parseFMLToDocument`).

Two deliberate, documented deviations from the published grammar (which multiple
implementers, including `fhir-fml-convert`'s own README, report as buggy):
- `fhirPath` positions (`default()`, `where()`, `check()`, `log()`, and `evaluate()`'s
  2nd argument) capture **raw source text** between balanced parens, rather than
  tokenizing FHIRPath itself — the published grammar treats `fhirPath` as a bare
  `literal` placeholder, which cannot represent real expressions like
  `given.first() + ' ' + family`. The lexer is deliberately permissive (an `OTHER`
  token for any character it doesn't model, e.g. `%`, `>`, `!=`) precisely so raw-span
  capture can coexist with whole-file upfront tokenization.
- The bare `(expr)` target shorthand for `evaluate($this, expr)` (§7.8.0.8.2) is
  supported even though the published `transform` rule omits it.
- The published grammar requires 2+ group parameters (`parameter (',' parameter)+`);
  relaxed to 1+ to match the prose's explicit single-input exception for a map's first
  group.

**Known limitations (bounded, documented, not silently guessed around):**
- The `src -> tgt: a, b, c;` colon-list shorthand is not in the published grammar at
  all and is not supported.
- Copying directly from a multi-segment path as a target's value (`tgt.a = src.b.c`
  without first binding `src.b.c as x`) is rejected with a clear error — our JSON
  model's `copy` parameter is a single bound variable, not a path expression.
- `/// name = value` metadata supports only simple, single-line, primitive fields
  (`url`, `name`, `title`, `status`, `experimental`, `description`, `publisher`,
  `version`, `date`, `purpose`, `copyright`) — dotted/complex properties (e.g.
  `jurisdiction.coding.system`) and multi-line `"""markdown"""` values are ignored.

**A genuinely useful side effect:** building and testing this parser surfaced two real
engine bugs from earlier phases that JSON-only tests hadn't hit — a `listMode`
double-wrapping bug that silently turned a non-repeating target into an array, and a
non-idempotent auto-create that overwrote an already-populated element when subElement
chaining crossed a value another sibling rule had already set. Both are now fixed with
regression tests in `tests/engine/`, not just `tests/fml/`.

Tests: `tests/fml/{lexer,parser,metadata,errors}.test.js` (every grammar production,
both list-mode vocabularies, subElement-chain desugaring, `<<types>>`/`<<type+>>`,
extends, dependent invocations vs. nested `then {}` blocks, and a battery of syntax-error
cases) plus `tests/fml/end-to-end.test.js`, which parses real FML text and runs it
through the actual `StructureMapEngine` — proving the parser's output isn't just
shaped correctly but genuinely executable. 221 tests pass project-wide.

## Phase 8 — Hardening, docs, packaging — DONE

- Ran the engine against the two official example StructureMaps published at
  [structuremap-examples.html](https://www.hl7.org/fhir/structuremap-examples.html)
  (saved verbatim, narrative HTML stripped, as `tests/fixtures/hl7-official/*.json`),
  wired into `tests/integration/hl7-examples.test.js`.
- **Real bug found and fixed**: `evaluate()` assumed exactly 2 parameters
  (`evaluate(resource, expr)`), but HL7's own `supplyrequest-transform` example uses the
  spec's documented 1-parameter, context-implicit shorthand — `evaluate('draft')`
  (§7.8.0.8.2, "no explicit context ... implicit through $this"). Fixed in
  `src/transforms/functions/evaluate.js` to detect arity and treat a single argument as
  the expression with `resource=undefined`; unit-level regression test added alongside
  the existing `evaluateTransform` suite.
- **Real quirk in HL7's own example, documented not "fixed"**: `supplyrequest-transform`
  has both a `category` rule and a `quantity` rule that both target `target.category`
  (the `quantity` rule almost certainly meant `target.quantity` — likely a typo in HL7's
  published example). Rules execute in array order, so the later parameter-less
  `copy()` overwrites the earlier value with `undefined`. Per "never guess", this is
  faithfully reproduced and called out in the test comments rather than "corrected".
- Public API docs: [`README.md`](README.md) — install, quick-start (JSON + FML text),
  the full injected Mapping Support API table, architecture summary, and explicit
  "Supported" / "Known gaps" sections.
- [`CHANGELOG.md`](CHANGELOG.md) added (Keep a Changelog format, `Unreleased` — no npm
  version has actually been published yet).
- `package.json` metadata (name, description, `exports`, `files`, `repository`,
  `keywords`, `license`) reviewed and already publish-ready from Phase 1; no publish
  workflow or version bump added — per this repo's own rule ("No npm/release automation
  for now"), actual `npm publish` stays a manual, explicitly-authorized future step.

Tests: 226 pass project-wide (221 from Phases 1-7 + 1 new unit test for the `evaluate()`
1-param fix + 4 new HL7-official-example integration tests). Lint clean.

## Phase 9 — Spec-fidelity fixes (cross-checked against the reference implementation) — DONE

Re-examined every item in README's "Known gaps" against the official HAPI/HL7 Java
reference implementation (`org.hl7.fhir.r5.utils.structuremap.StructureMapUtilities`,
fetched from `hapifhir/org.hl7.fhir.core`) instead of guessing. Result: some "gaps"
were real missed features; some turned out to match the reference implementation's own
behavior and were mislabeled.

**Fixed (real gaps, now closed):**
- **Identity Transform "Simple Form" batch** (`src -> tgt: a, b, c ["name"];`,
  §"Simple Form: Identity Transform") — confirmed as a real, spec-documented shorthand
  the reference implementation parses (desugars into N sibling identity rules); our
  parser previously rejected it outright with an incorrect "not in the grammar" claim.
  Implemented in `src/fml/parser.js` (`#parseIdentityBatch`) + `src/fml/ast-to-json.js`
  (`convertIdentityBatch`) — desugars into plain no-transform identity rules, reusing
  the existing identity-shorthand/untyped-auto-create dispatch rather than a bespoke
  copy path.
- **Constants scoped per-document** (§7.8.0.6: const names scoped to "a single mapping
  source file") — `StructureMapEngine` now caches one `ConstantResolver` per document
  (`#constantsFor`, `WeakMap`-keyed) and `group-invoker.js` re-scopes `ctx` to the
  invoked group's *owning* document (`ctx.forDoc(owningDoc)`), confirmed against the
  reference implementation's own per-`map` constant resolution. Previously all
  `%constants` resolved against the top-level `run()` document only.
- **Multi-line `"""markdown"""` metadata values** (e.g. `/// description = """..."""`)
  — the reference implementation's `render()` emits exactly this form for multi-line
  descriptions; `src/fml/metadata.js` now scans past `///`-per-line and captures raw
  verbatim text up to the closing `"""`.

**Reclassified (not gaps — reference implementation does the same):**
- `dateOp` — the official reference implementation also throws "not supported yet".
  README reworded to cite this instead of apologizing.
- Dotted/complex `///` metadata properties (`jurisdiction.coding.system`) — the
  reference implementation's own parser silently drops any metadata name it doesn't
  special-case; matching, not deviating.
- "No bundled StructureDefinitions/FHIRPath/terminology" moved to a new README
  "Design non-goals" section — an architectural choice, not a shortfall.

**Left as a documented, deliberately-not-guessed limitation:**
- Direct multi-segment `copy` (`tgt.a = src.b.c` without `as x`) — the reference
  parser's grammar accepts a dotted parameter, but its executor (`getParam`) does a
  flat variable-name lookup with no path traversal, so it's unclear this path actually
  works there either. Not replicated without a real test against the reference
  implementation confirming intended behavior.

Tests: 236 pass project-wide (226 from Phases 1-8 + 3 new constants-scoping tests + 4
new identity-batch parser tests + 1 end-to-end test + 3 new metadata multi-line tests
+ existing suite adjustments). Lint clean.

## Phase 10 — Coverage reporting + integration test suite — DONE

- Added `vitest.config.js`: v8 coverage provider (text/html/json-summary reporters,
  `coverage/` output, `include: ['src/**']`), matching the fhir-qb repo's convention.
  Upgraded `vitest`/`@vitest/coverage-v8` 2.x -> 4.1.11 (fhir-qb's version) in the same
  change — the old 2.x pulled in a vulnerable transitive `vite`/`esbuild`; 0 vulnerabilities
  after the bump. `npm run test:coverage` script added.
- CI (`ci.yml`): runs `npm run test:coverage` and uploads the `coverage/` directory as a
  build artifact (downloadable from the Actions run — no GitHub Pages for this repo).
- Coverage threshold locked at 97% (statements/branches/functions/lines) — comfortably
  below the achieved ~99%/98%/100%/100%, leaving headroom while still failing CI on a
  real regression.
- Closed nearly every coverage gap the report surfaced with real, meaningful tests
  (not padding) — each uncovered line was a genuine untested branch: cardinality
  max-exceeded, unknown listMode, default-mapping type-mismatch branches, identity-shorthand
  variable-binding, `ConstantResolver`'s Proxy fallback, unterminated block
  comment/unterminated triple-quote/unrecognized escape in the lexer, the `evaluate()`
  1-arg-no-comma FML form, `Group`/`Parameter`/`RuleTarget`/`validate.js` edge cases, and
  several transform-function branch pairs (cast boolean 'false'/invalid, cc/qty optional
  params, escape identical-format passthrough, cp's 'other' fallback, translate's
  no-match `undefined` return, truncate's nullish-source passthrough).
- New `tests/integration/` suite (5 files, 19 tests) — realistic, multi-feature composed
  scenarios through the real `engine.run()`/FML pipeline, not isolated units:
  `patient-demographics.test.js`, `multi-map-imports.test.js` (imports + Phase 9's
  per-document constants together), `repeating-and-conditions.test.js` (every source
  listMode + target `share`), `fml-authored-clinical-note.test.js` (a full FML-text
  program: metadata, extends, dependent groups, identity-batch, typed default-mapping
  dispatch), `error-paths.test.js` (cardinality/check/missing-group/circular-extends/
  unknown-run-group/duplicate-first-claim/unbound-context, all through the full engine).
- **Two real bugs found and fixed by the integration suite** (exactly why it's valuable
  beyond unit coverage): (1) multi-line `"""..."""` metadata worked in `extractMetadata()`
  isolation but broke the actual FML parse pipeline, because the lexer never learned to
  skip un-prefixed continuation lines — fixed in `src/fml/lexer.js`. (2) The identity-batch
  shorthand's desugared rules (Phase 9) never bound a source `variable`, so
  `applyIdentityShorthand`'s typed default-mapping dispatch crashed with a bogus
  "Constant \"undefined\" is not defined" instead of working — fixed in
  `src/fml/ast-to-json.js` (`convertIdentityBatch` now binds a synthetic variable).

Tests: 311 pass project-wide. Lint clean. Coverage: 99.24% statements / 98.36% branches
/ 100% functions / 100% lines.

## Non-goals (explicitly out of scope, to keep the library self-sufficient and small)

- No bundled StructureDefinitions/profile dumps for R4/R5/STU3 — always via injected
  resolver.
- No bundled FHIRPath engine — always a peer dependency / injected evaluator.
- No terminology server client — `translate()`/ValueSet validation are injected
  callbacks (Mapping Support API), same as the spec itself mandates the host application
  provide.
