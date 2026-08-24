// StructureMap.const — a reusable named FHIRPath expression (§7.8.0.6 Constants).
// Evaluated lazily by the engine on first reference, not at parse time.
import { requireField } from './validate.js';

export class ConstDef {
  constructor({ name, value }) {
    this.name = name;
    this.value = value; // FHIRPath expression, as a raw string
  }

  static fromJSON(json) {
    const name = requireField(json, 'name', 'ConstDef');
    const value = requireField(json, 'value', 'ConstDef');
    return new ConstDef({ name, value });
  }
}
