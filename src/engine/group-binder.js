// Binds a group's declared inputs (§7.8.0.7 Groups) to the values supplied by the host
// application, producing the root VariableScope the group's rules execute against.
import { EngineError } from './errors.js';
import { VariableScope } from './scope.js';

export function bindGroupInputs(group, inputs, constants = null) {
  const scope = new VariableScope(null, constants);
  for (const input of group.input) {
    if (!(input.name in inputs)) {
      throw new EngineError(`Group "${group.name}": missing required input "${input.name}"`);
    }
    scope.set(input.name, inputs[input.name]);
  }
  return scope;
}
