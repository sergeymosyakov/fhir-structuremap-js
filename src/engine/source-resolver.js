// Resolves one RuleSource against the current scope into the final list of candidate
// values that will fire the rule — §7.8.0.8.1 (Source Content), in spec order:
// element+type match -> cardinality check -> listMode selection -> defaultValue
// fallback -> where (condition) filter -> check (hard error) -> log.
import { EngineError } from './errors.js';
import { getChildren, matchesType } from './node-access.js';
import { applySourceListMode } from './list-mode.js';
import { checkCardinality } from './cardinality.js';
import { evaluateBoolean, evaluateSingle } from './evaluator.js';

export function resolveSource(ruleSource, scope, ctx) {
  if (!scope.has(ruleSource.context)) {
    throw new EngineError(`RuleSource: context variable "${ruleSource.context}" is not bound`);
  }
  const contextNode = scope.get(ruleSource.context);

  let candidates = ruleSource.element ? getChildren(contextNode, ruleSource.element) : [contextNode];
  if (ruleSource.element && ruleSource.type) {
    candidates = candidates.filter((c) => matchesType(c, ruleSource.type));
  }

  checkCardinality(candidates, ruleSource);
  candidates = applySourceListMode(candidates, ruleSource.listMode);

  if (candidates.length === 0 && ruleSource.defaultValue !== undefined) {
    candidates = [evaluateSingle(ctx.evaluator, contextNode, ruleSource.defaultValue, ctx.env)];
  }

  const matched = [];
  for (const candidate of candidates) {
    if (ruleSource.condition && !evaluateBoolean(ctx.evaluator, candidate, ruleSource.condition, ctx.env)) {
      continue; // `where` false -> this element simply has no match, not an error
    }
    if (ruleSource.check && !evaluateBoolean(ctx.evaluator, candidate, ruleSource.check, ctx.env)) {
      throw new EngineError(`RuleSource "${ruleSource.context}" check failed: ${ruleSource.check}`);
    }
    if (ruleSource.logMessage && ctx.onLog) {
      ctx.onLog(evaluateSingle(ctx.evaluator, candidate, ruleSource.logMessage, ctx.env));
    }
    matched.push(candidate);
  }
  return matched;
}
