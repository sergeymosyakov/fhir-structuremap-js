// id(system, value[, type]) — "Create an identifier. where type is a code from the
// identifier type value set." §7.8.0.8.2. Identifier.type is a CodeableConcept, so a
// bare type code is wrapped accordingly.
export function id(ctx, params) {
  const [system, value, type] = params;
  const result = { system, value };
  if (type !== undefined) result.type = { coding: [{ code: type }] };
  return result;
}
