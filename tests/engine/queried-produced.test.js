import { describe, it, expect } from 'vitest';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';
import { StructureMapEngine } from '../../src/engine/engine.js';
import { createDefaultTransformRegistry } from '../../src/transforms/registry.js';
import { realEvaluator } from './real-evaluator.js';

// §7.8.0.4: `queried`/`produced` structure modes ask the host (via the Mapping
// Support API) for instances of a type, rather than receiving/creating them directly.
// The spec gives no dedicated concrete-syntax hook for this beyond the API itself, so
// it's exposed as ctx.queryInstances/ctx.produceInstance for a custom transform (or a
// future FML-parser feature) to call — this proves the wiring reaches a transform.
describe('queryInstances / produceInstance wiring', () => {
  it('are reachable from a custom registered transform', () => {
    const registry = createDefaultTransformRegistry();
    registry.register('lookupPatient', (ctx) => ctx.queryInstances('Patient')[0]);
    registry.register('makeObservation', (ctx) => ctx.produceInstance('Observation'));

    const doc = StructureMapDocument.fromJSON({
      resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft',
      group: [{
        name: 'main',
        input: [{ name: 'src', mode: 'source' }, { name: 'tgt', mode: 'target' }],
        rule: [
          { name: 'r1', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'subject', transform: 'lookupPatient', parameter: [] }] },
          { name: 'r2', source: [{ context: 'src' }], target: [{ context: 'tgt', element: 'component', transform: 'makeObservation', parameter: [] }] },
        ],
      }],
    });

    const engine = new StructureMapEngine({
      evaluator: realEvaluator,
      registry,
      queryInstances: (type) => (type === 'Patient' ? [{ resourceType: 'Patient', id: '1' }] : []),
      produceInstance: (type) => ({ resourceType: type, status: 'preliminary' }),
    });
    const result = engine.run(doc, { src: {}, tgt: {} });

    expect(result.tgt.subject).toEqual({ resourceType: 'Patient', id: '1' });
    expect(result.tgt.component).toEqual({ resourceType: 'Observation', status: 'preliminary' });
  });
});
