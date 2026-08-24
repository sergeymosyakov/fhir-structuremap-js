// Default mapping group lookup — §7.8.0.10: groups marked `types`/`type-and-types`
// (StructureMap.group.typeMode) are the implicit target of the identity-transform
// simple form (`src.element -> tgt.element;`) for a given (source type, target type).
// A default-mapping group's first two inputs are (source, target), both typed.
export function findDefaultGroup(doc, sourceType, targetType) {
  for (const group of doc.group) {
    if (group.typeMode !== 'types' && group.typeMode !== 'type-and-types') continue;
    const [srcInput, tgtInput] = group.input;
    if (!srcInput || !tgtInput || srcInput.type !== sourceType) continue;
    // `type-and-types` also acts as the default for a not-yet-fixed (choice) target
    // type, as long as the source type matches — the spec's own "type+" behavior.
    if (group.typeMode === 'types' && tgtInput.type !== targetType) continue;
    if (group.typeMode === 'type-and-types' && targetType && tgtInput.type !== targetType) continue;
    return group;
  }
  return undefined;
}
