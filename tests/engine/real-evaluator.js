// Real `fhirpath` package as the injected evaluator — no fakes, so `where`/`check`/
// `defaultValue` tests exercise genuine FHIRPath semantics, matching the "injected
// evaluator" architecture principle.
import fhirpath from 'fhirpath';

export const realEvaluator = {
  evaluate: (node, expression, env) => fhirpath.evaluate(node, expression, env),
};
