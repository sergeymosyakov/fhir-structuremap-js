# fhir-structuremap-js

A standalone, dependency-light, browser-capable JavaScript engine that executes FHIR
`StructureMap` resources — the [FHIR Mapping Language](https://www.hl7.org/fhir/mapping-language.html)
(FML). Spun out of [fhir-questionnaire-builder](https://github.com/sergeymosyakov/fhir-questionnaire-builder),
but usable standalone in any Node.js or browser project.

No FHIRPath engine, no base FHIR profiles, and no terminology server are bundled — you
inject them. This keeps the package small and lets you reuse whatever `fhirpath`
implementation, StructureDefinitions, and terminology access your host application
already has.

## Install

```sh
npm install fhir-structuremap-js fhirpath
```

`fhirpath` is a peer dependency — bring your own version (or any object with a
compatible `evaluate(resource, expression, env)` signature).

## Quick start

### Execute a StructureMap (JSON)

```js
import { StructureMapDocument, StructureMapEngine } from 'fhir-structuremap-js';
import fhirpath from 'fhirpath';

const doc = StructureMapDocument.fromJSON(structureMapJson);
const engine = new StructureMapEngine({
  evaluator: { evaluate: (resource, expr, env) => fhirpath.evaluate(resource, expr, env) },
});

const result = engine.run(doc, { source: patientResource, target: {} });
// result.target is the populated Observation/whatever your map's target input produces
```

### Parse FML text instead of JSON

```js
import { parseFMLToDocument } from 'fhir-structuremap-js';

const doc = parseFMLToDocument(`
  map "http://example.org/StructureMap/PatientToPerson" = PatientToPerson
  group main(source src : Patient, target tgt : Person) {
    src.name as n -> tgt.name = n;
  }
`);
```

## Injected dependencies (Mapping Support API)

The spec's own "Mapping Support API" (§7.8.0.1) is deliberately not built in — pass
whichever of these your use case needs to `new StructureMapEngine({ ... })`:

| Option | Used for |
|---|---|
| `evaluator` | Required. `{ evaluate(resource, expr, env) => unknown[] }` — any FHIRPath implementation. |
| `env` | Extra FHIRPath environment variables (`%name`), merged with `doc.const[]`. |
| `registry` | Override/extend transform functions — defaults to `createDefaultTransformRegistry()`. |
| `createInstance(type)` | Backs `create()` and untyped auto-create. Defaults to `{}`. |
| `translate(source, mapUri)` | Backs the `translate()` transform (ConceptMap lookups). |
| `uuidFactory()` | Backs `uuid()`. Defaults to `crypto.randomUUID()`. |
| `structureMapResolver(pattern)` | Resolves `import[]` entries (incl. `*` wildcards) to an array of `StructureMapDocument`s. |
| `structureDefinitionResolver(type)` | Backs type-filtered sources, `cast()`, and default-mapping-group dispatch. |
| `queryInstances(type)` / `produceInstance(type)` | Backs `queried`/`produced` structure modes for custom transforms. |
| `onLog(message)` | Receives `log()` source-clause output. |

## Architecture

- **Factory/registry pattern** for every extensible concept (`TransformRegistry`,
  `createDefaultTransformRegistry()`) — add a transform by registering a name, never by
  editing engine dispatch code.
- **Model layer is pure data + parsing** (`src/model/`) — `StructureMapDocument.fromJSON()`
  never evaluates anything.
- **One concern per file** across `src/model/`, `src/engine/`, `src/transforms/`, `src/fml/`.

See [`PLAN.md`](PLAN.md) for the full phased build history and the spec citations behind
every design decision.

## Supported

All 8 implementation phases are complete:

- Full StructureMap JSON model (metadata, structure refs, imports, constants, groups,
  rules, sources, targets, parameters, nested rules, dependent invocations).
- Multi-source rule matching (cartesian permutation, same-rule context chaining),
  cardinality, `listMode` (source: `first`/`not_first`/`last`/`not_last`/`only_one`),
  `where`/`check`/`log`, `defaultValue`.
- All 18 target transform functions (`create`, `copy`, `truncate`, `escape`, `cast`,
  `append`, `translate`, `reference`, `uuid`, `pointer`, `evaluate`, `cc`, `c`, `qty`,
  `id`, `cp`, `dateOp`).
- Target `listMode` (`first`/`share`/`last`/`single`) assembly, order-independent of
  rule execution order.
- Nested rules, dependent rule/group invocation, `extends`, default mapping groups
  (`typeMode: types | type-and-types`) and the identity-transform simple form, plus its
  batch/list shorthand (`src -> tgt: a, b, c;`, §"Simple Form: Identity Transform").
- Imports (incl. `*` wildcard resolution) and lazy, cached, circular-safe constants,
  correctly re-scoped per document — a group invoked from an imported map sees that
  map's own `const[]`, not the caller's (§7.8.0.6).
- Type-aware structural checks and `queried`/`produced` structure modes via injected
  resolvers.
- A hand-written FML concrete-syntax parser (lexer + recursive-descent parser),
  grounded in [`mapping.g4`](https://www.hl7.org/fhir/mapping.g4) and cross-checked
  against the official HAPI/HL7 Java reference implementation
  (`org.hl7.fhir.r5.utils.structuremap.StructureMapUtilities`) for shapes the published
  grammar omits, e.g. the identity-transform batch shorthand above and multi-line
  `"""markdown"""` metadata values (`/// description = """..."""`).
- Direct multi-segment copy (`tgt.a = src.b.c`, no `as x` binding needed) — desugared
  at parse time into `evaluate(src, 'b.c')`, reusing the already-injected FHIRPath
  evaluator rather than requiring a flat variable-name lookup.
- `dateOp(date, '+'|'-', value, unit)` — the StructureMap spec's own table leaves this
  transform's parameters undefined ("??"); grounded instead in FHIRPath's own
  standardized date/time arithmetic (§6.5.1), since the engine already hard-depends on
  an injected FHIRPath evaluator for everything else. Verified against the real
  `fhirpath` npm package's accepted calendar-duration units (year(s)/month(s)/week(s)/
  day(s)/hour(s)/minute(s)/second(s)/millisecond(s), plus the quoted UCUM short forms
  `'wk'`/`'d'`/`'h'`/`'min'`/`'s'`/`'ms'`).
- Validated against the official example StructureMaps published at
  [structuremap-examples.html](https://www.hl7.org/fhir/structuremap-examples.html)
  (see `tests/integration/hl7-examples.test.js`).
- Dotted/repeating `///` metadata properties (`name{.property}*`, e.g.
  `jurisdiction.coding.system`) per §7.8.0.3, incl. repeat detection ("additional
  items with the same name represent repeats") — for the two complex StructureMap
  metadata fields realistically used in hand-written FML, `jurisdiction`
  (CodeableConcept[]) and `contact` (ContactDetail[]); metadata parsing correctly stops
  at the `map` statement so a coincidental `///`-shaped line later in the file (e.g. a
  rule-body comment) is never mistaken for metadata.

## Known gaps (honest, not silently guessed around)

- **Auto-create is untyped by default** — without an injected
  `structureDefinitionResolver` that resolves both ends' types, a transform-less target
  auto-creates a plain `{}` rather than dispatching to the identity-transform's
  default-mapping-group. Not a defect — this is the expected result of the "no
  StructureDefinitions bundled" design choice below when no resolver is supplied.

## Design non-goals (deliberate, not gaps)

- **No bundled StructureDefinitions, FHIRPath engine, or terminology client** — always
  via an injected resolver/evaluator/callback, to keep the library small and
  host-agnostic. See PLAN.md "Non-goals".

## License

MIT
