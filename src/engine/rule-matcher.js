// Multi-source permutation semantics — §7.8.0.8.1: "If there are multiple source
// statements, the rule applies for the permutation of the source elements from each
// source statement... If any of the source data elements have no value, then the rule
// never applies; only existing permutations are executed."
//
// A later source's context may itself be a variable declared by an earlier source in
// the same rule (e.g. `for src.row as row, row.firstName as firstName`). Per the spec's
// own worked example, this is NOT resolved positionally/paired — every earlier
// candidate is expanded and the results are unioned, then ALL sources' candidate lists
// (including this one) are cartesian-multiplied together.
import { EngineError } from './errors.js';
import { resolveSource } from './source-resolver.js';

export function cartesianProduct(lists) {
  return lists.reduce(
    (acc, list) => acc.flatMap((combo) => list.map((item) => [...combo, item])),
    [[]],
  );
}

/**
 * Matches a rule's source content against `scope`, returning one child VariableScope
 * per firing (each with that firing's source variables bound). Empty array = the rule
 * does not fire for this scope at all.
 */
export function matchRule(rule, scope, ctx) {
  const resolved = []; // { ruleSource, candidates }[]

  for (const ruleSource of rule.source) {
    const chainedFrom = resolved.find((r) => r.ruleSource.variable === ruleSource.context);
    let candidates;
    if (chainedFrom) {
      candidates = chainedFrom.candidates.flatMap((value) => {
        const tmpScope = scope.child().set(ruleSource.context, value);
        return resolveSource(ruleSource, tmpScope, ctx);
      });
    } else if (scope.has(ruleSource.context)) {
      candidates = resolveSource(ruleSource, scope, ctx);
    } else {
      throw new EngineError(`RuleSource: context variable "${ruleSource.context}" is not bound`);
    }
    resolved.push({ ruleSource, candidates });
  }

  if (resolved.some((r) => r.candidates.length === 0)) return [];

  const combos = cartesianProduct(resolved.map((r) => r.candidates));
  return combos.map((combo) => {
    const childScope = scope.child();
    resolved.forEach(({ ruleSource }, i) => {
      if (ruleSource.variable) {
        childScope.set(ruleSource.variable, combo[i]);
        childScope.setType(ruleSource.variable, ruleSource.type); // author-declared type, if any
      }
    });
    return childScope;
  });
}

