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

## Phase 6 — Type-aware features (incl. default mapping group dispatch, deferred from Phase 4)

Spec: §7.8.0.4 (Structure Definition References — `queried`/`produced` modes),
§7.8.0.8.3 (Type Wrangling), §7.8.0.9 (Simple Form / identity transform), §7.8.0.10
(Default mapping groups, `<<types>>`/`<<type+>>`).

- `structureDefinitionResolver` wiring for `type`-filtered sources and `cast()`/auto-create
  type resolution.
- Default mapping groups (`typeMode: types | type-and-types`) — engine looks up the
  matching default group by (source type, target type) once real type resolution can
  answer "what type does this target element expect"; drives the identity-transform
  simple form (`src.element -> tgt.element;` and `src -> tgt: a, b, c;`).
- `queried` / `produced` structure modes — the map asks the host (via callback) for
  instances of a type, rather than receiving/creating them directly.
- Tests against a couple of real, small StructureDefinitions (not a bundled profile
  dump — fixtures only).

## Phase 7 — FML concrete-syntax parser (optional round-trip layer)

Spec: full §7.8.0 (concrete syntax), formal grammar at https://www.hl7.org/fhir/mapping.g4.

- Only needed if we want to accept raw `.map`/FML text (not just StructureMap JSON) as
  input, or to author/edit maps as text. Most real-world consumption (canonical URL →
  StructureMap resource) is already JSON, so this phase is explicitly lower priority than
  1–6 and is deferred until the JSON-execution path is solid and tested end to end.
- If built: a small recursive-descent or PEG parser (not a full ANTLR toolchain, to keep
  the package light) producing the same `StructureMapDocument` object graph as
  `fromJSON()`, so the engine never needs to know which input form was used.

## Phase 8 — Hardening, docs, packaging

- Run against official FHIR StructureMap test/example resources
  (structuremap-examples.html) as an integration/regression suite.
- Public API docs (README), versioned CHANGELOG, npm publish config.
- Explicit "supported subset / known gaps" section in the README — honesty about
  coverage is part of "full spec support", not an afterthought.

## Non-goals (explicitly out of scope, to keep the library self-sufficient and small)

- No bundled StructureDefinitions/profile dumps for R4/R5/STU3 — always via injected
  resolver.
- No bundled FHIRPath engine — always a peer dependency / injected evaluator.
- No terminology server client — `translate()`/ValueSet validation are injected
  callbacks (Mapping Support API), same as the spec itself mandates the host application
  provide.
