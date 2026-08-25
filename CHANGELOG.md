# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- Identity Transform "Simple Form" batch shorthand (`src -> tgt: a, b, c;`).
- `"""markdown"""` multi-line `///` metadata values (e.g. `description`).
- Coverage reporting (`vitest.config.js`, v8 provider, 97% threshold, CI artifact upload).
- `tests/integration/` suite: 5 realistic multi-feature scenarios through the full engine.
- Direct multi-segment copy (`tgt.a = src.b.c`, no `as x` needed) — desugars into
  `evaluate(src, 'b.c')` instead of throwing.
- `dateOp(date, '+'|'-', value, unit)` — implemented on top of FHIRPath's own
  date/time arithmetic instead of throwing "not implemented".
- Dotted/repeating `///` metadata properties (`jurisdiction`, `contact`) per §7.8.0.3.

### Fixed
- `%constants` now resolve against the owning document of the currently-executing
  group (§7.8.0.6), not always the top-level `run()` document — a real deviation
  found by cross-checking the official HAPI/HL7 Java reference implementation.
- `extractMetadata()` no longer absorbs a coincidentally `///`-shaped line found deep
  inside a rule body — metadata scanning now stops at the `map` statement.
- Multi-line `"""..."""` metadata broke the FML parser pipeline outside of
  `extractMetadata()` isolation — lexer now skips un-prefixed continuation lines.
- Identity-batch desugared rules didn't bind a source variable, crashing typed
  default-mapping dispatch.
- Upgraded `vitest`/`@vitest/coverage-v8` to 4.1.11, resolving transitive
  `vite`/`esbuild` vulnerabilities in the old 2.x line.

## [1.0.0] - 2026-08-25

### Added
- Phase 1: core StructureMap JSON model (`StructureMapDocument.fromJSON()`) and the
  transform-function registry factory.
- Phase 2: execution engine skeleton — variable scoping and full source-content rule
  matching (cardinality, listMode, where/check/log, multi-source permutation).
- Phase 3: real implementations for all 17 target transform functions.
- Phase 4: target-value application (deferred `ListPlan` first/last/share/single
  assembly), nested rules, dependent rule/group invocation, `extends`.
- Phase 5: `import[]` resolution and lazy, cached, circular-safe constants.
- Phase 6: structural type checks via an injected `structureDefinitionResolver`,
  default-mapping-group dispatch (identity-transform simple form), `queried`/`produced`
  structure modes.
- Phase 7: hand-written FML concrete-syntax parser (lexer + recursive-descent parser),
  grounded in the official `mapping.g4` grammar.
- Phase 8: regression suite against the official HL7 StructureMap example resources;
  fixed a real `evaluate()` 1-parameter shorthand gap it surfaced; README and this
  changelog.

See [`PLAN.md`](PLAN.md) for the full phase-by-phase design rationale and spec
citations.
