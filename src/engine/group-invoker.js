// Invokes a named group by binding its inputs positionally to the supplied argument
// values (§7.8.0.8.4: "The parameters provided must match the parameters required by
// the dependent group, in order"), then executes every effective rule (including
// inherited ones via `extends`) against the new scope.
import { EngineError } from './errors.js';
import { VariableScope } from './scope.js';
import { getEffectiveRules } from './effective-rules.js';
import { executeRule } from './rule-executor.js';

function bindPositionalInputs(group, argValues) {
  if (argValues.length !== group.input.length) {
    throw new EngineError(`Group "${group.name}": expected ${group.input.length} argument(s), got ${argValues.length}`);
  }
  const scope = new VariableScope();
  group.input.forEach((input, i) => scope.set(input.name, argValues[i]));
  return scope;
}

export function invokeGroup(doc, groupName, argValues, ctx, listPlan) {
  const group = doc.getGroup(groupName);
  if (!group) throw new EngineError(`invokeGroup: unknown group "${groupName}"`);

  const scope = bindPositionalInputs(group, argValues);
  for (const rule of getEffectiveRules(doc, group)) {
    executeRule(rule, scope, ctx, listPlan);
  }
}
