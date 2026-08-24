// Reads children of a plain-JS-object data tree by element name, and a best-effort
// type check. When a structureDefinitionResolver is injected (Phase 6), a complex
// value without a resourceType tag is checked structurally (its own keys must be a
// subset of the type's declared children) rather than always accepted.
import { getDeclaredChildKeys } from './structure-definition.js';

export function getChildren(node, elementName) {
  const value = node?.[elementName];
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

const PRIMITIVE_JS_TYPE = { string: 'string', boolean: 'boolean', integer: 'number', decimal: 'number' };

export function matchesType(value, type, structureDefinitionResolver) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'object' && typeof value.resourceType === 'string') {
    return value.resourceType === type;
  }
  const expectedJsType = PRIMITIVE_JS_TYPE[type];
  if (expectedJsType) return typeof value === expectedJsType;

  if (structureDefinitionResolver && typeof value === 'object') {
    const sd = structureDefinitionResolver(type);
    if (sd) {
      const declared = getDeclaredChildKeys(sd);
      return Object.keys(value).every((k) => declared.includes(k));
    }
  }
  return true; // complex/unknown type, nothing to check it against — accept
}
