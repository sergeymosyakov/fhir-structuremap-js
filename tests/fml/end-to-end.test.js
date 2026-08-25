import { describe, it, expect } from 'vitest';
import { parseFMLToDocument } from '../../src/fml/index.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { realEvaluator } from '../engine/real-evaluator.js';

describe('FML end-to-end — parsed text actually executes through the real engine', () => {
  it('runs a simple copy + evaluate map', () => {
    const doc = parseFMLToDocument(`
      map "http://example.org/StructureMap/PatientToPerson" = PatientToPerson
      group main(source src : Patient, target tgt : Person) {
        src.name as n -> tgt.name = n;
        src.name as n -> tgt.note = evaluate(n, given + ' ' + family);
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { name: { given: 'Alice', family: 'Smith' } }, tgt: {} });
    expect(result.tgt.name).toEqual({ given: 'Alice', family: 'Smith' });
    expect(result.tgt.note).toBe('Alice Smith');
  });

  it('runs a map using a constant referenced as %name inside evaluate()', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      let defaultStatus = 'final';
      group main(source src, target tgt) {
        src -> tgt.status = evaluate(src, %defaultStatus);
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: {}, tgt: {} });
    expect(result.tgt.status).toBe('final');
  });

  it('runs a dependent group invocation end to end', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group main(source src, target tgt) {
        src -> tgt.name = 'placeholder' then setReal(src, tgt);
      }
      group setReal(source src, target tgt) {
        src.value as v -> tgt.name = v;
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { value: 'Alice' }, tgt: {} });
    expect(result.tgt.name).toBe('Alice');
  });

  it('runs nested "then { }" rules end to end', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group main(source src, target tgt) {
        src.patient as p -> tgt.subject = p then {
          p.id as pid -> tgt.subject.reference = evaluate(pid, 'Patient/' + $this);
        };
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { patient: { id: '123' } }, tgt: {} });
    expect(result.tgt.subject.reference).toBe('Patient/123');
  });

  it('runs an extends chain end to end', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group base(source src, target tgt) {
        src -> tgt.a = 'A';
      }
      group derived(source src, target tgt) extends base {
        src -> tgt.b = 'B';
      }
      group main(source src, target tgt) {
        src -> tgt.x = 'x' then derived(src, tgt);
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: {}, tgt: {} }, 'main');
    expect(result.tgt).toMatchObject({ a: 'A', b: 'B' });
  });

  it('runs subElement chaining desugared into a nested auto-create', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group main(source src, target tgt) {
        src.value as v -> tgt.name.family = v;
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { value: 'Smith' }, tgt: {} });
    expect(result.tgt.name.family).toBe('Smith');
  });

  it('honors source where()/check() conditions at runtime', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group main(source src, target tgt) {
        src.values as v where($this > 2) -> tgt.big = v;
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, { src: { values: [1, 2, 3, 4] }, tgt: { big: [] } });
    expect(result.tgt.big).toEqual([3, 4]);
  });

  it('runs the Simple Form: Identity Transform batch shorthand (src -> tgt: a, b, c;)', () => {
    const doc = parseFMLToDocument(`
      map "u" = X
      group main(source src, target tgt) {
        src -> tgt: name, gender, birthDate;
      }
    `);
    const engine = new StructureMapEngine({ evaluator: realEvaluator });
    const result = engine.run(doc, {
      src: { name: 'Alice', gender: 'female', birthDate: '1990-01-01' },
      tgt: {},
    });
    // No structureDefinitionResolver injected, so each desugared identity rule falls
    // back to plain untyped auto-create (same as a manually-written `src.x -> tgt.x;`
    // rule with no resolver — see tests/engine/target-applier.test.js) rather than
    // copying the scalar value; this proves the batch form reuses the exact same
    // identity/auto-create pipeline, not a special-cased copy.
    expect(result.tgt).toEqual({ name: {}, gender: {}, birthDate: {} });
  });
});
