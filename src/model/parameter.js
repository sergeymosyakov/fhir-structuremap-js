// StructureMap.group.rule.*.parameter — normalizes the FHIR value[x] polymorphism
// (valueId / valueString / valueBoolean / valueInteger / valueDecimal / valueDate /
// valueTime / valueDateTime) into a single { kind, value } shape.
// Spec: https://www.hl7.org/fhir/structuremap.html (group.rule.target.parameter.value[x])
const VALUE_KEYS = [
  'valueId',
  'valueString',
  'valueBoolean',
  'valueInteger',
  'valueDecimal',
  'valueDate',
  'valueTime',
  'valueDateTime',
];

export class Parameter {
  constructor(kind, value) {
    this.kind = kind; // 'id' | 'string' | 'boolean' | 'integer' | 'decimal' | 'date' | 'time' | 'dateTime'
    this.value = value;
  }

  static fromJSON(json) {
    for (const key of VALUE_KEYS) {
      if (json[key] !== undefined) {
        const kind = key.slice(5, 6).toLowerCase() + key.slice(6);
        return new Parameter(kind, json[key]);
      }
    }
    throw new Error('Parameter: no recognized value[x] present');
  }
}
