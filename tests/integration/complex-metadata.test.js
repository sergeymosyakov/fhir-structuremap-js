// Realistic composed scenarios for §7.8.0.3 metadata: a full multi-field header
// (simple + repeating complex properties + multi-line markdown) combined with an
// actual executable map, through the real FML -> JSON -> engine pipeline — proving
// metadata parsing neither corrupts nor is corrupted by the rest of the file.
import { describe, it, expect } from 'vitest';
import { parseFMLToJSON, parseFMLToDocument } from '../../src/fml/index.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

describe('integration — complex metadata header combined with a real executable map', () => {
  const FML = `
    /// url = 'http://example.org/StructureMap/PatientNormalize'
    /// name = 'PatientNormalize'
    /// title = 'Patient Normalization Map'
    /// status = 'active'
    /// experimental = true
    /// publisher = 'Example Health'
    /// jurisdiction =
    /// jurisdiction.coding.system = 'urn:iso:std:iso:3166'
    /// jurisdiction.coding.code = 'US'
    /// jurisdiction =
    /// jurisdiction.coding.system = 'urn:iso:std:iso:3166'
    /// jurisdiction.coding.code = 'CA'
    /// contact.name = 'Data Team'
    /// contact.telecom.system = 'email'
    /// contact.telecom.value = 'data@example.org'
    /// contact.telecom.system = 'phone'
    /// contact.telecom.value = '+1-555-0100'
    /// description = """
    Normalizes patient demographics across US and CA jurisdictions.
    Maintained by the Data Team.
    """
    map "http://example.org/StructureMap/PatientNormalize" = PatientNormalize
    group main(source src : Patient, target tgt : Person) {
      src.name as n -> tgt.name = n;
      src.birthDate as b -> tgt.birthDate = b;
    }
  `;

  it('produces every metadata field correctly, including two repeating jurisdictions and a contact with two telecoms', () => {
    const json = parseFMLToJSON(FML);
    expect(json.title).toBe('Patient Normalization Map');
    expect(json.status).toBe('active');
    expect(json.experimental).toBe(true);
    expect(json.publisher).toBe('Example Health');
    expect(json.description).toContain('Normalizes patient demographics across US and CA jurisdictions.');
    expect(json.jurisdiction).toEqual([
      { coding: [{ system: 'urn:iso:std:iso:3166', code: 'US' }] },
      { coding: [{ system: 'urn:iso:std:iso:3166', code: 'CA' }] },
    ]);
    expect(json.contact).toEqual([{
      name: 'Data Team',
      telecom: [
        { system: 'email', value: 'data@example.org' },
        { system: 'phone', value: '+1-555-0100' },
      ],
    }]);
  });

  it('the map still executes correctly — metadata parsing does not corrupt the rule body', () => {
    const doc = parseFMLToDocument(FML);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { name: 'Alice', birthDate: '1990-01-01' }, tgt: {} });
    expect(result.tgt).toEqual({ name: 'Alice', birthDate: '1990-01-01' });
  });

  it('StructureMapDocument.fromJSON builds successfully despite the extra jurisdiction/contact/description fields it does not model', () => {
    expect(() => parseFMLToDocument(FML)).not.toThrow();
  });
});

describe('integration — metadata section boundary (§7.8.0.3: "the first part of a mapping file")', () => {
  it('a triple-slash-shaped line deep inside a rule body is NOT mistaken for metadata', () => {
    const fml = `
      /// status = 'active'
      map "u" = X
      group main(source src, target tgt) {
        // just a regular comment, not metadata
        src.a -> tgt.a;
        /// jurisdiction.coding.code = 'SNEAKY'
      }
    `;
    const json = parseFMLToJSON(fml);
    expect(json.status).toBe('active');
    expect(json.jurisdiction).toBeUndefined();
  });

  it('a real map with metadata-shaped rule comments still parses and runs the rule normally', () => {
    const fml = `
      /// status = 'draft'
      map "u" = X
      group main(source src, target tgt) {
        src.value as v -> tgt.value = v; /// title = 'not real metadata'
      }
    `;
    const json = parseFMLToJSON(fml);
    expect(json.title).toBeUndefined(); // trailing comment after ';' is not a metadata line
    const doc = parseFMLToDocument(fml);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { value: 'x' }, tgt: {} });
    expect(result.tgt.value).toBe('x');
  });
});

describe('integration — metadata mixed with imports/constants/multiple groups', () => {
  it('metadata, imports, constants and groups all coexist correctly in one file', () => {
    const fml = `
      /// title = 'Composite Map'
      /// jurisdiction.coding.code = 'US'
      map "http://example.org/StructureMap/Composite" = Composite
      imports "http://example.org/StructureMap/helper*"
      let greeting = 'hello';
      group main(source src, target tgt) {
        src -> tgt.greeting = evaluate(src, %greeting);
      }
    `;
    const json = parseFMLToJSON(fml);
    expect(json.title).toBe('Composite Map');
    expect(json.jurisdiction).toEqual([{ coding: [{ code: 'US' }] }]);
    expect(json.import).toEqual(['http://example.org/StructureMap/helper*']);
    expect(json.const).toEqual([{ name: 'greeting', value: "'hello'" }]);

    const doc = parseFMLToDocument(fml);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: {}, tgt: {} });
    expect(result.tgt.greeting).toBe('hello');
  });
});
