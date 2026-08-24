// uuid() — "Generate a random UUID (in lowercase). No Parameters." §7.8.0.8.2.
// Uses an injected `ctx.uuidFactory()` when supplied (for deterministic tests),
// falling back to the platform's crypto.randomUUID().
export function uuid(ctx) {
  const value = ctx.uuidFactory ? ctx.uuidFactory() : crypto.randomUUID();
  return value.toLowerCase();
}
