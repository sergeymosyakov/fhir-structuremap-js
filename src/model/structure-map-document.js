// StructureMap — top-level parsed object graph (§7.9.5 Resource Content).
// Pure data + parsing: StructureMapDocument.fromJSON() never evaluates anything;
// the engine (later phases) consumes this graph.
import { requireField } from './validate.js';
import { StructureDefRef } from './structure-def-ref.js';
import { ConstDef } from './const-def.js';
import { Group } from './group.js';

export class StructureMapDocument {
  constructor({ url, name, status, structure, import: imports, const: consts, group }) {
    this.url = url;
    this.name = name;
    this.status = status;
    this.structure = structure; // StructureDefRef[]
    this.import = imports; // string[] — canonical URLs, may include '*' wildcard suffix
    this.const = consts; // ConstDef[]
    this.group = group; // Group[] — at least one required; group[0] is invoked by default

    this._groupsByName = new Map(group.map((g) => [g.name, g]));
  }

  /** Look up a group by name — undefined if not found in this document. */
  getGroup(name) {
    return this._groupsByName.get(name);
  }

  /** The group invoked when no name is given (§7.8.0.7 — "The first group is special"). */
  get defaultGroup() {
    return this.group[0];
  }

  static fromJSON(json) {
    if (json.resourceType !== undefined && json.resourceType !== 'StructureMap') {
      throw new Error(`StructureMapDocument: expected resourceType "StructureMap", got "${json.resourceType}"`);
    }
    const url = requireField(json, 'url', 'StructureMapDocument');
    const name = requireField(json, 'name', 'StructureMapDocument');
    const status = requireField(json, 'status', 'StructureMapDocument');
    const groupJson = requireField(json, 'group', 'StructureMapDocument');
    if (groupJson.length === 0) {
      throw new Error('StructureMapDocument: "group" must have at least one entry');
    }
    return new StructureMapDocument({
      url,
      name,
      status,
      structure: (json.structure ?? []).map(StructureDefRef.fromJSON),
      import: json.import ?? [],
      const: (json.const ?? []).map(ConstDef.fromJSON),
      group: groupJson.map(Group.fromJSON),
    });
  }
}
