// Reads children of a plain-JS-object data tree by element name, and a best-effort
// type check. Real StructureDefinition-based typing (Phase 6) will refine `matchesType`;
// until then this is deliberately conservative (accepts unknown/complex types) rather
// than silently dropping valid data.
export function getChildren(node, elementName) {
  const value = node?.[elementName];
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

const PRIMITIVE_JS_TYPE = { string: 'string', boolean: 'boolean', integer: 'number', decimal: 'number' };

export function matchesType(value, type) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object' && typeof value.resourceType === 'string') {
    return value.resourceType === type;
  }
  const expectedJsType = PRIMITIVE_JS_TYPE[type];
  if (expectedJsType) return typeof value === expectedJsType;
  return true; // complex/unknown type without a resourceType tag — accept pending Phase 6
}
