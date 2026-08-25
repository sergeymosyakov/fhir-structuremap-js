# Changelog

Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). Not yet
published to npm — versions below track implementation milestones, not releases.

## [Unreleased]

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
