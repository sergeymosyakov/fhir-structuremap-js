// Executes one rule against a scope: matches its source content, applies its target
// statements, recurses into nested rules, and invokes any named dependent groups
// (§7.8.0.8 Transform Rules, §7.8.0.8.4 Dependent Rules).
import { matchRule } from './rule-matcher.js';
import { applyTarget } from './target-applier.js';
import { applyIdentityShorthand, isIdentityShorthandEligible } from './identity-shorthand.js';
import { resolveParameters } from '../transforms/param-resolution.js';

export function executeRule(rule, scope, ctx, listPlan) {
  const firings = matchRule(rule, scope, ctx);
  const shorthandEligible = isIdentityShorthandEligible(rule);
  for (const firingScope of firings) {
    for (const ruleTarget of rule.target) {
      const tryShorthand = shorthandEligible && !ruleTarget.transform;
      if (!(tryShorthand && applyIdentityShorthand(rule, ruleTarget, firingScope, ctx, listPlan))) {
        applyTarget(ruleTarget, firingScope, ctx, listPlan, rule);
      }
    }
    for (const nestedRule of rule.rule) {
      executeRule(nestedRule, firingScope, ctx, listPlan);
    }
    for (const dependent of rule.dependent) {
      const args = resolveParameters(dependent.parameter, firingScope);
      ctx.invokeGroup(dependent.name, args, listPlan);
    }
  }
}
