// evaluate(resource, expression) — "Execute the supplied FHIRPath expression... in
// the context of the first parameter." §7.8.0.8.2. Unlike the other transforms, a
// FHIRPath expression naturally yields a *collection* — this handler returns that raw
// collection; interpreting 0/1/many results against the target's cardinality (no
// element / single value / one instance per value) is the target-application layer's
// job (Phase 4), not this pure computation.
//
// Real official StructureMap examples (structuremap-examples.html,
// e.g. supplyrequest-transform) use a 1-parameter form too — `evaluate('draft')` —
// the context-implicit shorthand (§7.8.0.8.2: "no explicit context ... implicit
// through $this"), compiled with just the expression and no resource argument.
import { evaluateAll } from '../../engine/evaluator.js';

export function evaluateTransform(ctx, params) {
  const [resource, expression] = params.length === 1 ? [undefined, params[0]] : params;
  return evaluateAll(ctx.evaluator, resource, expression, ctx.env);
}

