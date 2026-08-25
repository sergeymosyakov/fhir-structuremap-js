// Realistic composed scenario: a sizable FML-text program (not JSON) combining
// metadata header, extends, dependent group invocation, default-mapping-group
// dispatch by type, and the identity-batch shorthand in one coherent map.
import { describe, it, expect } from 'vitest';
import { parseFMLToDocument, parseFMLToJSON } from '../../src/fml/index.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

const FML = `
  /// title = 'Clinical Note Composer'
  /// status = 'active'
  /// description = """
  Builds a simple clinical note summary from a patient encounter record.
  Combines extends, dependent groups, default-mapping dispatch, and the
  identity-batch shorthand.
  """
  map "http://example.org/StructureMap/ClinicalNote" = ClinicalNoteComposer

  group base(source src, target tgt) {
    src.encounterId as id -> tgt.encounterId = id;
  }

  group main(source src : Encounter, target tgt : Note) extends base {
    src.patient as p -> tgt.subject = p then formatSubject(p, tgt);
    src -> tgt: status, class;
  }

  group formatSubject(source p, target tgt) {
    p.name as n -> tgt.subjectLabel = evaluate(p, name + ' (' + id + ')');
  }
`;

describe('integration — FML-authored clinical note composer', () => {
  const doc = parseFMLToDocument(FML);

  it('parses the metadata header correctly', () => {
    const json = parseFMLToJSON(FML);
    expect(json.title).toBe('Clinical Note Composer');
    expect(json.status).toBe('active');
    expect(json.description).toContain('Builds a simple clinical note summary');
  });

  it('runs extends + dependent group + identity-batch together end to end', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const encounter = {
      encounterId: 'enc-1',
      patient: { name: 'Alice Smith', id: 'pat-1' },
      status: 'finished',
      class: 'ambulatory',
    };
    const result = engine.run(doc, { src: encounter, tgt: {} }, 'main');

    // from the extended "base" group
    expect(result.tgt.encounterId).toBe('enc-1');
    // from the dependent "formatSubject" group
    expect(result.tgt.subjectLabel).toBe('Alice Smith (pat-1)');
    // from the identity-batch shorthand (untyped auto-create — no resolver injected)
    expect(result.tgt.status).toEqual({});
    expect(result.tgt.class).toEqual({});
  });

  it('the identity-batch shorthand dispatches to a real default-mapping group when types are resolvable', () => {
    // A second, smaller map exercising just the identity-batch + default-mapping-group
    // combination with a real structureDefinitionResolver, so the batch elements are
    // genuinely mapped (not just untyped auto-create).
    const typedFML = `
      map "u" = X
      group main(source src : Patient, target tgt : Person) {
        src -> tgt: name;
      }
      group nameCopy(source src : HumanName, target tgt : PersonName) <<types>> {
        src.text as t -> tgt.text = t;
      }
    `;
    const typedDoc = parseFMLToDocument(typedFML);
    const SD = {
      Patient: { resourceType: 'StructureDefinition', type: 'Patient', snapshot: { element: [{ path: 'Patient.name', type: [{ code: 'HumanName' }] }] } },
      Person: { resourceType: 'StructureDefinition', type: 'Person', snapshot: { element: [{ path: 'Person.name', type: [{ code: 'PersonName' }] }] } },
    };
    const engine = new StructureMapEngine({ evaluator: realEvaluator, structureDefinitionResolver: (t) => SD[t] });
    const result = engine.run(typedDoc, { src: { resourceType: 'Patient', name: { text: 'Bob Jones' } }, tgt: { resourceType: 'Person' } });
    expect(result.tgt.name).toEqual({ text: 'Bob Jones' });
  });
});
