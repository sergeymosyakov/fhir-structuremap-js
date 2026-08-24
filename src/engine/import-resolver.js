// Resolves a group by name across the current map and its imports (§7.8.0.5 Map
// Imports, §7.8.0.8.4: "Groups are resolved by name by looking through all the groups
// in all the available maps referenced by ... imports"). Import entries may contain a
// `*` wildcard; matching "available maps" against a pattern is the host's job — the
// injected `ctx.structureMapResolver(pattern)` always returns an array (empty if none),
// whether or not the pattern is a wildcard.
export function resolveImportedGroup(doc, groupName, ctx, visited = new Set()) {
  if (visited.has(doc)) return undefined;
  visited.add(doc);

  const own = doc.getGroup(groupName);
  if (own) return { doc, group: own };

  if (!ctx.structureMapResolver) return undefined;
  for (const pattern of doc.import) {
    const importedDocs = ctx.structureMapResolver(pattern) ?? [];
    for (const importedDoc of importedDocs) {
      const found = resolveImportedGroup(importedDoc, groupName, ctx, visited);
      if (found) return found;
    }
  }
  return undefined;
}
