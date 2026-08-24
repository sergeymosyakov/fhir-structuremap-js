// Implements the identity-transform simple form (§7.8.0.9): a rule target with no
// transform, in a rule with no dependent/nested rules, implicitly means
// `create(targetType)` + invoke the matching default-mapping group (§7.8.0.10).
// Requires real type resolution (structureDefinitionResolver + tracked scope types) —
// falls back to plain untyped auto-create (the caller's job) when types can't be
// determined, rather than guessing or erroring.
import { findDefaultGroup } from './default-mapping.js';
import { resolveChildType } from './structure-definition.js';

function resolveType(scope, contextName, elementName, resolver) {
  const containingType = scope.getType(contextName);
  if (!elementName) return containingType;
  if (!containingType || !resolver) return undefined;
  const sd = resolver(containingType);
  return sd ? resolveChildType(sd, elementName) : undefined;
}

/** A rule is only eligible for the implicit identity form with no explicit follow-up. */
export function isIdentityShorthandEligible(rule) {
  return rule.dependent.length === 0 && rule.rule.length === 0;
}

/**
 * Attempts default-mapping-group dispatch for a no-transform target. Returns true if
 * it fully handled the target (created the instance + invoked the group); false if
 * the caller should fall back to plain untyped auto-create instead.
 */
export function applyIdentityShorthand(rule, ruleTarget, scope, ctx, listPlan) {
  if (!ruleTarget.element || !ctx.structureDefinitionResolver || !ctx.invokeGroup || !ctx.doc) return false;

  const primarySource = rule.source[0];
  const sourceType = primarySource.type
    ?? resolveType(scope, primarySource.context, primarySource.element, ctx.structureDefinitionResolver);
  const targetType = resolveType(scope, ruleTarget.context, ruleTarget.element, ctx.structureDefinitionResolver);
  if (!sourceType || !targetType) return false;

  const group = findDefaultGroup(ctx.doc, sourceType, targetType);
  if (!group) return false;

  const contextNode = scope.get(ruleTarget.context);
  const created = ctx.createInstance ? ctx.createInstance(targetType) : {};
  contextNode[ruleTarget.element] = created;
  if (ruleTarget.variable) {
    scope.set(ruleTarget.variable, created);
    scope.setType(ruleTarget.variable, targetType);
  }

  const sourceValue = primarySource.element ? scope.get(primarySource.variable) : scope.get(primarySource.context);
  ctx.invokeGroup(group.name, [sourceValue, created], listPlan);
  return true;
}
