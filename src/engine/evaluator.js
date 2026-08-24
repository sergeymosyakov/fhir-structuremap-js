// Thin helpers around the host-injected FHIRPath evaluator. The engine never bundles
// its own FHIRPath implementation — the host supplies `{ evaluate(node, expr, env) }`
// (e.g. a wrapper around the `fhirpath` npm package).

/** @typedef {{ evaluate: (node: unknown, expression: string, env?: object) => unknown[] }} FhirPathEvaluator */

export function evaluateAll(evaluator, node, expression, env) {
  return evaluator.evaluate(node, expression, env);
}

/** FML boolean contexts (`where`/`check`) treat anything but a single `true` as false. */
export function evaluateBoolean(evaluator, node, expression, env) {
  const result = evaluateAll(evaluator, node, expression, env);
  return result.length === 1 && result[0] === true;
}

/** For `defaultValue`/`log` — a FHIRPath expression expected to yield at most one value. */
export function evaluateSingle(evaluator, node, expression, env) {
  const result = evaluateAll(evaluator, node, expression, env);
  return result[0];
}
