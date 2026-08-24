// StructureMap.group.rule.target — spec §7.8.0.8.2 (Target Transform) /
// https://www.hl7.org/fhir/structuremap.html (group.rule.target.*)
// Constraint smp-1: element requires context (enforced below).
import { Parameter } from './parameter.js';

export class RuleTarget {
  constructor({ context, element, variable, listMode, listRuleId, transform, parameter }) {
    if (element !== undefined && element !== null && (context === undefined || context === null)) {
      throw new Error('RuleTarget: "element" requires "context" (constraint smp-1)');
    }
    this.context = context;
    this.element = element;
    this.variable = variable;
    this.listMode = listMode ?? []; // first | share | last | single (repeatable)
    this.listRuleId = listRuleId;
    this.transform = transform; // undefined => auto-create, no explicit transform function
    this.parameter = parameter ?? []; // Parameter[]
  }

  static fromJSON(json) {
    return new RuleTarget({
      context: json.context,
      element: json.element,
      variable: json.variable,
      listMode: json.listMode,
      listRuleId: json.listRuleId,
      transform: json.transform,
      parameter: (json.parameter ?? []).map(Parameter.fromJSON),
    });
  }
}
