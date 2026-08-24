// Shared validation helper — DRY error reporting across model classes.
export function requireField(json, field, context) {
  const value = json?.[field];
  if (value === undefined || value === null) {
    throw new Error(`${context}: missing required field "${field}"`);
  }
  return value;
}
