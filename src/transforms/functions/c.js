// c(system, code[, display]) — "Create a Coding from the parameters provided." §7.8.0.8.2.
export function c(ctx, params) {
  const [system, code, display] = params;
  const coding = { system, code };
  if (display !== undefined) coding.display = display;
  return coding;
}
