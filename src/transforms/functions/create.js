// create(type) — "use the standard API to create a new instance of data." §7.8.0.8.2.
// Delegates to an injected `ctx.createInstance(type)` (Mapping Support API); falls
// back to a minimal empty object when none is supplied, since without a
// StructureDefinition resolver (Phase 6) the engine can't know the real shape.
export function create(ctx, params) {
  const [type] = params;
  if (ctx.createInstance) return ctx.createInstance(type);
  return {};
}
