// StructureMap.group.rule.dependent — named group/rule invocation (§7.8.0.8.4 Dependent Rules).
import { requireField } from './validate.js';
import { Parameter } from './parameter.js';

export class DependentInvocation {
  constructor({ name, parameter }) {
    this.name = name; // rule or group name to invoke
    this.parameter = parameter; // Parameter[] — positional, matched to the target's inputs
  }

  static fromJSON(json) {
    const name = requireField(json, 'name', 'DependentInvocation');
    const parameter = requireField(json, 'parameter', 'DependentInvocation');
    return new DependentInvocation({ name, parameter: parameter.map(Parameter.fromJSON) });
  }
}
