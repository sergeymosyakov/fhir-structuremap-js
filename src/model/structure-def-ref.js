// StructureMap.structure — a StructureDefinition referenced by this map, and how it's
// used (§7.8.0.4 Structure Definition References).
import { requireField } from './validate.js';

export class StructureDefRef {
  constructor({ url, mode, alias, documentation }) {
    this.url = url;
    this.mode = mode; // 'source' | 'queried' | 'target' | 'produced'
    this.alias = alias; // name used for the type inside the mapping language
    this.documentation = documentation;
  }

  static fromJSON(json) {
    const url = requireField(json, 'url', 'StructureDefRef');
    const mode = requireField(json, 'mode', 'StructureDefRef');
    return new StructureDefRef({ url, mode, alias: json.alias, documentation: json.documentation });
  }
}
