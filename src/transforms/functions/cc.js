// cc(text) | cc(system, code[, display]) — "Create a CodeableConcept from the
// parameters provided." §7.8.0.8.2.
export function cc(ctx, params) {
  if (params.length === 1) return { text: params[0] };
  const [system, code, display] = params;
  const coding = { system, code };
  if (display !== undefined) coding.display = display;
  return { coding: [coding] };
}
