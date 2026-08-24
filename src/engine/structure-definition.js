// Minimal helpers over a StructureDefinition JSON (snapshot.element[] with .path /
// .type[].code) — not a validator. Used for a structural "does this look like type X"
// heuristic and for resolving a child element's declared type, both bounded to what's
// needed for type-filtered sources and default-mapping-group dispatch (§7.8.0.8.3,
// §7.8.0.10). Full profile-based validation is explicitly out of scope (see
// copilot-instructions.md "Non-goals" — no bundled StructureDefinitions).
function elements(structureDefinition) {
  return structureDefinition?.snapshot?.element ?? structureDefinition?.differential?.element ?? [];
}

/** First-level child element names declared directly on the type's root path. */
export function getDeclaredChildKeys(structureDefinition) {
  const root = structureDefinition?.type;
  if (!root) return [];
  const prefix = `${root}.`;
  const keys = new Set();
  for (const el of elements(structureDefinition)) {
    if (!el.path?.startsWith(prefix)) continue;
    const rest = el.path.slice(prefix.length);
    if (rest.includes('.')) continue; // only direct children, not grandchildren
    keys.add(rest.replace(/\[x]$/, ''));
  }
  return [...keys];
}

/** The declared type code of a direct child element, or undefined if unknown/ambiguous. */
export function resolveChildType(structureDefinition, elementName) {
  const root = structureDefinition?.type;
  if (!root) return undefined;
  const path = `${root}.${elementName}`;
  const el = elements(structureDefinition).find((e) => e.path === path);
  const types = el?.type;
  if (!types || types.length !== 1) return undefined; // choice types are ambiguous here
  return types[0].code;
}
