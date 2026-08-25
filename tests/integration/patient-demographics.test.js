// Realistic composed scenario: Patient -> Person demographics using several
// transforms together in one map (copy, translate, cast, evaluate, listMode
// first/last, where/check) — proving they combine correctly, not just in isolation.
import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('integration — Patient demographics normalization', () => {
  const doc = docWith({
    group: [{
      name: 'main',
      input: [{ name: 'patient', mode: 'source' }, { name: 'person', mode: 'target' }],
      rule: [
        {
          name: 'name',
          source: [{ context: 'patient', element: 'name', variable: 'n' }],
          target: [{ context: 'person', element: 'name', transform: 'copy', parameter: [{ valueId: 'n' }] }],
        },
        {
          name: 'gender',
          source: [{ context: 'patient', element: 'gender', variable: 'g', check: "$this != ''" }],
          target: [{
            context: 'person',
            element: 'gender',
            transform: 'translate',
            parameter: [{ valueId: 'g' }, { valueString: 'http://example.org/ConceptMap/gender' }, { valueString: 'code' }],
          }],
        },
        {
          name: 'birthDate',
          source: [{ context: 'patient', element: 'birthDate', variable: 'b' }],
          target: [{ context: 'person', element: 'birthDateStr', transform: 'cast', parameter: [{ valueId: 'b' }, { valueString: 'string' }] }],
        },
        {
          name: 'primaryPhone',
          source: [{ context: 'patient', element: 'telecom', variable: 't', listMode: 'first', condition: "system='phone'" }],
          target: [{ context: 'person', element: 'primaryPhone', transform: 'evaluate', parameter: [{ valueId: 't' }, { valueString: 'value' }] }],
        },
        {
          name: 'secondaryPhone',
          source: [{ context: 'patient', element: 'telecom', variable: 't', listMode: 'last', condition: "system='phone'" }],
          target: [{ context: 'person', element: 'secondaryPhone', transform: 'evaluate', parameter: [{ valueId: 't' }, { valueString: 'value' }] }],
        },
        {
          name: 'location',
          source: [{ context: 'patient', element: 'address', variable: 'a' }],
          target: [{ context: 'person', element: 'location', transform: 'evaluate', parameter: [{ valueId: 'a' }, { valueString: 'city' }] }],
        },
      ],
    }],
  });

  const translate = (source) => (source === 'male' ? { code: 'M' } : { code: 'U' });

  it('maps every field correctly in one run', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator, translate });
    const patient = {
      resourceType: 'Patient',
      name: 'Alice Smith',
      gender: 'male',
      birthDate: '1990-05-14',
      telecom: [
        { system: 'phone', value: '555-1111', use: 'home' },
        { system: 'email', value: 'alice@example.org' },
        { system: 'phone', value: '555-2222', use: 'work' },
      ],
      address: { line: 'Main St 1', city: 'Springfield' },
    };
    const result = engine.run(doc, { patient, person: {} });

    expect(result.person).toEqual({
      name: 'Alice Smith',
      gender: 'M',
      birthDateStr: '1990-05-14',
      primaryPhone: '555-1111',
      secondaryPhone: '555-2222',
      location: 'Springfield',
    });
  });

  it('the check() clause fails the run when gender is blank', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator, translate });
    const patient = { resourceType: 'Patient', name: 'Bob', gender: '', birthDate: '2000-01-01', telecom: [], address: {} };
    expect(() => engine.run(doc, { patient, person: {} })).toThrow(/check failed/);
  });

  it('the source where() filter (system=phone) excludes non-phone telecom entries', () => {
    const engine = new StructureMapEngine({ evaluator: realEvaluator, translate });
    const patient = {
      resourceType: 'Patient', name: 'Carol', gender: 'male', birthDate: '1985-03-03',
      telecom: [{ system: 'email', value: 'carol@example.org' }],
      address: { city: 'Metropolis' },
    };
    const result = engine.run(doc, { patient, person: {} });
    expect(result.person.primaryPhone).toBeUndefined();
    expect(result.person.secondaryPhone).toBeUndefined();
  });
});
