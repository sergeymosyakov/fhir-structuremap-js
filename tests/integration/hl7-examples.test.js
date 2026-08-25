// Regression suite against the two official StructureMap examples from
// https://www.hl7.org/fhir/structuremap-examples.html (saved verbatim as JSON in
// tests/fixtures/hl7-official/). Goal: prove the engine handles *real*, messy,
// externally-authored StructureMaps without crashing — not just our own clean
// hand-written fixtures. Assertions reflect actually-observed behavior, including
// two real quirks in HL7's own "supplyrequest-transform" example (see comments).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/hl7-official/${name}`, import.meta.url), 'utf-8'));
}

describe('HL7 official example — "example" (id: example)', () => {
  const doc = StructureMapDocument.fromJSON(loadFixture('example.json'));

  it('parses without error', () => {
    expect(doc.name).toBe('ExampleMap');
    expect(doc.group).toHaveLength(1);
  });

  it('runs without crashing; copy() with no parameter (as published) yields no value', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { testSrc: { test: 'hello' }, testTgt: {} });
    // The published example's rule is `testTgt.testValue = copy();` — copy() with
    // zero arguments. Our copy() reads params[0], which is undefined here — an
    // honest, non-crashing outcome for a source example that itself omits the
    // parameter copy() requires, not a gap in our implementation.
    expect(result.testTgt.testValue).toBeUndefined();
  });
});

describe('HL7 official example — "supplyrequest-transform"', () => {
  const doc = StructureMapDocument.fromJSON(loadFixture('supplyrequest-transform.json'));

  it('parses without error', () => {
    expect(doc.name).toBe('TransformFromAnActivityDefinitionToASupplyRequest');
    expect(doc.group[0].rule).toHaveLength(7);
  });

  it('runs without crashing and produces the actually-computed fields', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const source = { id: 'act1', quantity: { value: 5, unit: 'mg' }, code: { text: 'Widget' } };
    const result = engine.run(doc, { source, target: {} });

    expect(result.target.status).toBe('draft'); // evaluate('draft'), 1-param shorthand
    expect(result.target.priority).toBe('routine');

    // Real quirk in the published example: both the "category" rule
    // (target.category = evaluate('non-stock')) and the "quantity" rule
    // (target.category = copy()) target the SAME element "category" — almost
    // certainly meant to be "target.quantity" in the "quantity" rule. Rules run in
    // array order, so the later, parameter-less copy() overwrites the earlier
    // 'non-stock' value with undefined. This is the example's own bug, faithfully
    // reproduced rather than "corrected" by guessing the intended fix.
    expect(result.target.category).toBeUndefined();

    // "item" rule: create() (no type param) then copy() (no param) onto it —
    // both parameter-less, so item ends up an empty object.
    expect(result.target.item).toEqual({});

    // "when"/"authoredOn" both call evaluate('now()') — real, current timestamps.
    expect(typeof result.target.occurrence).toBe('string');
    expect(result.target.occurrence).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(typeof result.target.authoredOn).toBe('string');
  });
});
