# GitHub Copilot Instructions for fhir-structuremap-js

> **Critical workflow rules for AI agents working on this codebase.**
> Full plan: [PLAN.md](../PLAN.md)

---

## 🚨 THE MUST — highest priority, no exceptions

0. **Announce every step — wait for yes/no.** Before any action (edit, run, push, read, create) output:
   > **Plan:** [numbered list of all steps you intend to take]

   Then **STOP** and wait for explicit "да" / "yes" / "go". Only after confirmation — execute step 1. If more steps remain — stop again after each one and wait. Do NOT chain actions silently. Do NOT proceed on assumption of approval.
1. **Stop and ask after one failed attempt.** If a bug or issue is not resolved on the first real attempt — STOP immediately. Ask the user to reproduce manually and provide more details. Do NOT keep iterating or running more diagnostics.
   **STOP command is absolute.** If the user writes "стоп", "stop", "стоять", "прекрати", "остановись", "стой" — immediately stop ALL actions, output one sentence max, and wait. No explanations, no tool calls, no "I'll just quickly check one more thing". Zero tolerance.
2. **Never guess. Never infer. Ask.** If any detail is unclear or missing — stop and ask exactly what information is needed. Do not proceed on assumptions.
3. **Spec fidelity over shortcuts.** This library's whole purpose is a spec-faithful FHIR StructureMap/Mapping Language engine (see PLAN.md). No phase is "done" on a partial/stubbed implementation — every feature claimed as implemented must be backed by a real handler and a real test, not a placeholder that silently does the wrong thing.

---

## ⚠️ WORKFLOW RULES — MANDATORY

1. **git commit/push only on explicit user instruction.** Never automatically.
   - `commit` and `push` are **two separate operations** — each requires explicit permission.
   - **Neither commit nor push is EVER included in a proposed plan automatically.** Do not commit or push until the user explicitly says so ("да", "камить", "пушай", "commit", "push", etc.).
   - "commit and push" / "пушай" = permission for both in one step.
   - "move / create / fix" without explicit commit/push instruction = only edit files, do NOT commit or push.
2. **Before every push** — announce "I'm about to push, running pre-push checklist first", then: run `npm run lint` (must pass, zero errors); run `npx vitest run` (must pass); update `PLAN.md` if a phase's scope or status changed; update `README.md` only for major changes (public API, usage, supported-subset summary).
3. **No npm/release automation for now.** No `npm publish`, no version bumps, no release workflow — this repo is implementation-only until explicitly told otherwise.
4. **English only** — all code comments, doc strings, commit messages, README, PLAN.md, any in-repo text must be in English. No Russian anywhere in the codebase.
5. **Every phase ships with tests.** New model classes, transform functions, or engine behavior land with unit tests against real StructureMap JSON fixtures (see `tests/fixtures/`) proving the spec behavior, not just that the code runs. A feature is not "done" until its PLAN.md phase's tests pass.
6. **New rules go into the repo, not just memory** — whenever a new rule is established (in conversation, from a bug, from a lesson learned), add it immediately to this file, without asking.
7. **Always run tests in an observable way — never blind-buffer.** Any test run (Vitest) must be launched so its live state can be inspected at any moment. Do NOT pipe the command through `tail`/`head`/`grep` (that hides all output until the process ends). Run plain `npx vitest run`, then filter a saved log afterwards if a summary is needed.
8. **Lean comments & commits — essence only.** Comments: one-line file/class headers, comment only the non-obvious _why_ (usually a spec citation here); no multi-paragraph doc comments. Commit messages: subject + short essence-only bullets, no essays.

---

## Project Context

- **What this is**: a standalone, browser-capable JS engine that executes FHIR `StructureMap` resources (the FHIR Mapping Language). Positioned as a self-sufficient library — installable and usable independently of any host application (e.g. `fhir-questionnaire-builder`, which is the project this was spun out of).
- **Architecture principles** (apply to every phase, not just early ones — see PLAN.md "Architecture principles" for the full list):
  - Factory/registry pattern for every extensible concept (transform functions today; source/target list-mode handlers, etc. later) — a `Map<key, handler>` populated by a `createDefault*Registry()` factory. Adding a feature means registering a name, never editing engine dispatch code.
  - Model layer (`src/model/`) is pure data + parsing — `StructureMapDocument.fromJSON()` never evaluates anything.
  - The engine depends on an **injected** FHIRPath evaluator and **injected** resolvers (StructureDefinition, StructureMap imports, ConceptMap translate, create-instance) — never bundles its own copy of FHIRPath or base FHIR profiles. This is a deliberate reaction to evaluating an existing npm alternative that bundled ~28MB of profile dumps into any consumer's bundle.
  - One concern per file — no god-files.
- **Grounded in spec, not memory**: https://www.hl7.org/fhir/mapping-language.html (concrete syntax + execution semantics) and https://www.hl7.org/fhir/structuremap.html (resource schema). Cite the relevant spec section in comments/commits when implementing a feature.
- **Tooling**: ESM only (`"type": "module"`), Vitest for tests, ESLint flat config. No TypeScript (yet) — plain JS with JSDoc type hints where useful.
