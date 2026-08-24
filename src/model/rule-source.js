// StructureMap.group.rule.source — spec §7.8.0.8.1 (Source Content) /
// https://www.hl7.org/fhir/structuremap.html (group.rule.source.*)
import { requireField } from './validate.js';

export class RuleSource {
  constructor({ context, min, max, type, defaultValue, element, listMode, variable, condition, check, logMessage }) {
    this.context = context; // required — type or variable this rule applies to
    this.min = min;
    this.max = max; // number or '*'
    this.type = type; // rule only applies if source has this type
    this.defaultValue = defaultValue; // FHIRPath literal, primitives only
    this.element = element; // optional child element name
    this.listMode = listMode; // first | not_first | last | not_last | only_one
    this.variable = variable; // named context for `element`, if specified
    this.condition = condition; // FHIRPath — `where`
    this.check = check; // FHIRPath — `check` (hard error if false)
    this.logMessage = logMessage; // FHIRPath — `log`
  }

  static fromJSON(json) {
    const context = requireField(json, 'context', 'RuleSource');
    return new RuleSource({
      context,
      min: json.min,
      max: json.max,
      type: json.type,
      defaultValue: json.defaultValue,
      element: json.element,
      listMode: json.listMode,
      variable: json.variable,
      condition: json.condition,
      check: json.check,
      logMessage: json.logMessage,
    });
  }
}
