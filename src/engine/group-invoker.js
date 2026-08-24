// Invokes a named group by binding its inputs positionally to the supplied argument
// values (§7.8.0.8.4: "The parameters provided must match the parameters required by
// the dependent group, in order"), then executes every effective rule (including
// inherited ones via `extends`) against the new scope. The group may live in an
// imported map (§7.8.0.5) — resolved via resolveImportedGroup.
import { EngineError } from './errors.js';
import { VariableScope } from './scope.js';
import { getEffectiveRules } from './effective-rules.js';
import { executeRule } from './rule-executor.js';
import { resolveImportedGroup } from './import-resolver.js';

function bindPositionalInputs(group, argValues, constants) {
  if (argValues.length !== group.input.length) {
    throw new EngineError(`Group "${group.name}": expected ${group.input.length} argument(s), got ${argValues.length}`);
  }
  const scope = new VariableScope(null, constants);
  group.input.forEach((input, i) => {
    scope.set(input.name, argValues[i]);
    scope.setType(input.name, input.type);
  });
  return scope;
}

export function invokeGroup(doc, groupName, argValues, ctx, listPlan) {
  const found = resolveImportedGroup(doc, groupName, ctx);
  if (!found) throw new EngineError(`invokeGroup: unknown group "${groupName}"`);
  const { doc: owningDoc, group } = found;

  const scope = bindPositionalInputs(group, argValues, ctx.constants);
  for (const rule of getEffectiveRules(owningDoc, group)) {
    executeRule(rule, scope, ctx, listPlan);
  }
}
