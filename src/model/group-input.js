// StructureMap.group.input — a named instance passed into a group when invoked
// (§7.8.0.7 Groups).
import { requireField } from './validate.js';

export class GroupInput {
  constructor({ name, type, mode, documentation }) {
    this.name = name;
    this.type = type;
    this.mode = mode; // 'source' | 'target'
    this.documentation = documentation;
  }

  static fromJSON(json) {
    const name = requireField(json, 'name', 'GroupInput');
    const mode = requireField(json, 'mode', 'GroupInput');
    return new GroupInput({ name, type: json.type, mode, documentation: json.documentation });
  }
}
