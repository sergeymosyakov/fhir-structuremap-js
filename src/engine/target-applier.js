// Writes a rule target's computed value into the target tree (§7.8.0.8.2 Target
// Transform + Type Wrangling). Auto-create (no `transform`) is untyped by default —
// identity-shorthand dispatch (§7.8.0.9/§7.8.0.10, see identity-shorthand.js) is tried
// first by the caller when a structureDefinitionResolver is available.
import { EngineError } from './errors.js';
import { resolveParameters } from '../transforms/param-resolution.js';

function computeValue(ruleTarget, scope, ctx) {
  if (!ruleTarget.transform) {
    return ctx.createInstance ? [ctx.createInstance(undefined)] : [{}];
  }
  const params = resolveParameters(ruleTarget.parameter, scope);
  const handler = ctx.registry.get(ruleTarget.transform);
  const result = handler(ctx, params);
  // `evaluate` alone yields a raw FHIRPath collection (§7.8.0.8.2): 0 results -> no
  // element created, 1 -> that value, many -> one target instance per value (only
  // valid for a repeating target — enforced by the caller).
  return ruleTarget.transform === 'evaluate' ? result : [result];
}

/** Tracks the created instance's type from an explicit `create("Type")` call, so a
 * later nested rule can use it for its own identity-shorthand dispatch. */
function trackCreatedType(ruleTarget, scope, value) {
  if (ruleTarget.transform === 'create' && ruleTarget.parameter[0]?.kind === 'string') {
    scope.setType(ruleTarget.variable, ruleTarget.parameter[0].value);
  }
  return value;
}

/**
 * Applies one target statement for a single rule firing. Writes into
 * `scope.get(ruleTarget.context)[ruleTarget.element]` when an element is given;
 * always binds `ruleTarget.variable` (to the last produced value) when present.
 */
export function applyTarget(ruleTarget, scope, ctx, listPlan, claimant) {
  if (!scope.has(ruleTarget.context)) {
    throw new EngineError(`RuleTarget: context variable "${ruleTarget.context}" is not bound`);
  }
  const contextNode = scope.get(ruleTarget.context);
  const values = computeValue(ruleTarget, scope, ctx);

  if (values.length === 0) return undefined; // evaluate() -> empty collection: nothing created

  if (!ruleTarget.element) {
    const value = values[values.length - 1];
    if (ruleTarget.variable) trackCreatedType(ruleTarget, scope, scope.set(ruleTarget.variable, value));
    return value;
  }

  // Repeating-ness is inferred from what's already there (pre-existing array) or an
  // explicit listMode — NOT merely from getting multiple values back from evaluate(),
  // which must error for a target with no such signal (§7.8.0.8.2: "more than one
  // value and the element is non-repeating ... treated as an error").
  const repeating = ruleTarget.listMode.length > 0 || Array.isArray(contextNode[ruleTarget.element]);

  if (repeating) {
    if (!Array.isArray(contextNode[ruleTarget.element])) contextNode[ruleTarget.element] = [];
    const targetArray = contextNode[ruleTarget.element];
    let last;
    for (const value of values) {
      last = listPlan.add(targetArray, value, ruleTarget.listMode, ruleTarget.listRuleId, claimant);
    }
    if (ruleTarget.variable) trackCreatedType(ruleTarget, scope, scope.set(ruleTarget.variable, last));
    return last;
  }

  if (values.length > 1) {
    throw new EngineError(`RuleTarget "${ruleTarget.context}.${ruleTarget.element}": evaluate() produced multiple values for a non-repeating target`);
  }
  const value = values[0];
  contextNode[ruleTarget.element] = value;
  if (ruleTarget.variable) trackCreatedType(ruleTarget, scope, scope.set(ruleTarget.variable, value));
  return value;
}
