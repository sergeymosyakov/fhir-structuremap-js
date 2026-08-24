// StructureMap.group — a named, reusable set of transform rules (§7.8.0.7 Groups).
// typeMode: 'none' | 'types' | 'type-and-types' — the last two mark a group as a
// "default mapping group" dispatched by (source type[, target type]), per
// §7.8.0.10 Default mapping groups.
import { requireField } from './validate.js';
import { GroupInput } from './group-input.js';
import { Rule } from './rule.js';

export class Group {
  constructor({ name, extends: extendsName, typeMode, input, rule, documentation }) {
    this.name = name;
    this.extends = extendsName;
    this.typeMode = typeMode ?? 'none';
    this.input = input; // GroupInput[] — at least one required
    this.rule = rule; // Rule[]
    this.documentation = documentation;
  }

  static fromJSON(json) {
    const name = requireField(json, 'name', 'Group');
    const inputJson = requireField(json, 'input', 'Group');
    if (inputJson.length === 0) {
      throw new Error('Group: "input" must have at least one entry');
    }
    return new Group({
      name,
      extends: json.extends,
      typeMode: json.typeMode,
      input: inputJson.map(GroupInput.fromJSON),
      rule: (json.rule ?? []).map(Rule.fromJSON),
      documentation: json.documentation,
    });
  }
}
