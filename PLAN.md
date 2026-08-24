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
  not-yet-implemented marker — Phase 3 fills in real behavior. Registering happens by
  name so a consumer can override/extend without touching engine code.
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

## Phase 3 — Target transform execution (all 17 functions, for real)

Spec: §7.8.0.8.2 (Target Transform + full function table), §7.8.0.8.3 (Type Wrangling).

- Real implementations for all transform functions, each in its own module under
  `src/transforms/functions/`, registered via the Phase-1 registry:
  - `copy`, `truncate` (FHIRPath `substring`), `escape`, `cast`, `append`
    (string/element concatenation), `reference`, `pointer`, `uuid` (RFC4122 v4, injected
    RNG for testability), `dateOp`.
  - `evaluate` — runs the injected FHIRPath evaluator; implements the 0/1/many-results
    rules exactly as specified (empty → no element; single → set value; many + repeating
    target → one instance per value; many + non-repeating target → error). Implements the
    `()`-shorthand context-implicit form.
  - `create` — via an injected "create instance" callback (Mapping Support API), or a
    minimal built-in default (empty object of the requested type) when none is supplied.
  - `translate` — via an injected ConceptMap-translate callback (`%terminologies.translate()`
    equivalent); output selector (`code|system|display|Coding|CodeableConcept`).
  - `cc`, `c`, `qty`, `id`, `cp` — structured-value factories per the exact parameter
    shapes in the spec table.
- List-mode handling for targets (`first | share | last | single`) — implemented even
  though the spec marks this "TODO" upstream; document our interpretation and test it
  explicitly since this is exactly the kind of ambiguity that causes silent bugs.
- Auto-create (no `transform` specified): error on primitive/ambiguous-choice types per
  spec; else auto-create using the injected create-instance callback.
- Tests: one fixture set per transform function, plus the type-wrangling error cases.

## Phase 4 — Dependent rules, nested rules, groups, default mapping groups

Spec: §7.8.0.7 (Groups, extends, `<<types>>`/`<<type+>>`), §7.8.0.8.4 (Dependent Rules),
§7.8.0.9 (Simple Form / identity transform), §7.8.0.10 (Default mapping groups).

- Nested rule execution (`rule.rule[]`) inheriting parent variable scope.
- Named dependent-rule / group invocation (`rule.dependent[]`) — parameter binding by
  position + mode (source/target) validation per spec.
- `extends` — group inherits another group's rules; validate identical input
  signature (mode/name/type) as the spec requires.
- Default mapping groups (`typeMode: types | type-and-types`) — engine looks up the
  matching default group by (source type, target type) when a rule has no explicit
  transform/dependent and both ends have a variable — i.e. the identity-transform simple
  form (`src.element -> tgt.element;`) and the even-shorter `src -> tgt: a, b, c;` form.
- Tests: recursive/nested rule fixtures, extends-inheritance fixture, default-group
  dispatch fixture reproducing the spec's own identity-transform example.

## Phase 5 — Imports & constants

Spec: §7.8.0.5 (Map Imports), §7.8.0.6 (Constants).

- `imports[]` resolution via an injected `structureMapResolver(url)` callback, including
  the `*` wildcard-suffix matching rule.
- `const[]` (`let name = expression;`) — lazy evaluation, single evaluation per run,
  local-variable shadowing rules, circular-reference detection → engine error.
- Tests: multi-file map fixture (main map + imported datatype map), constants fixture
  including the shadowing and circularity error cases.

## Phase 6 — Type-aware features

Spec: §7.8.0.4 (Structure Definition References — `queried`/`produced` modes),
§7.8.0.8.3 (Type Wrangling).

- `structureDefinitionResolver` wiring for `type`-filtered sources and `cast()`/auto-create
  type resolution.
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
