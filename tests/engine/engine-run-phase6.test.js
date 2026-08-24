import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from './real-evaluator.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8'));
}

const SD = {
  Patient: loadFixture('structuredefinition-patient.json'),
  HumanName: loadFixture('structuredefinition-humanname.json'),
  Envelope: loadFixture('structuredefinition-envelope.json'),
  DisplayName: loadFixture('structuredefinition-displayname.json'),
};

function docWith(json) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', ...json,
  });
}

describe('StructureMapEngine.run — identity-shorthand default-mapping-group dispatch', () => {
  it('resolves types via structureDefinitionResolver and dispatches to the matching default group', () => {
    const doc = docWith({
      group: [
        {
          name: 'main',
          input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', type: 'Envelope', mode: 'target' }],
          rule: [{
            name: 'r',
            source: [{ context: 'patient', element: 'name', variable: 'n' }],
            target: [{ context: 'envelope', element: 'label' }], // no transform -> identity shorthand
          }],
        },
        {
          name: 'nameToDisplay',
          typeMode: 'types',
          input: [{ name: 'src', type: 'HumanName', mode: 'source' }, { name: 'tgt', type: 'DisplayName', mode: 'target' }],
          rule: [{
            name: 'r',
            source: [{ context: 'src', element: 'family', variable: 'f' }],
            target: [{ context: 'tgt', element: 'text', transform: 'copy', parameter: [{ valueId: 'f' }] }],
          }],
        },
      ],
    });

    const engine = new StructureMapEngine({
      evaluator: realEvaluator,
      structureDefinitionResolver: (type) => SD[type],
    });
    const patient = { resourceType: 'Patient', name: { family: 'Smith' } };
    const envelope = { resourceType: 'Envelope' };
    const result = engine.run(doc, { patient, envelope });

    expect(result.envelope.label).toEqual({ text: 'Smith' });
  });

  it('falls back to plain untyped auto-create when no default group matches', () => {
    const doc = docWith({
      group: [{
        name: 'main',
        input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', type: 'Envelope', mode: 'target' }],
        rule: [{
          name: 'r',
          source: [{ context: 'patient', element: 'name', variable: 'n' }],
          target: [{ context: 'envelope', element: 'label' }],
        }],
      }],
    });
    const engine = new StructureMapEngine({ evaluator: realEvaluator, structureDefinitionResolver: (type) => SD[type] });
    const result = engine.run(doc, { patient: { resourceType: 'Patient', name: { family: 'Smith' } }, envelope: {} });
    expect(result.envelope.label).toEqual({});
  });
});
