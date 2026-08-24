// Single source of truth for the 17 FML target transform functions (§7.8.0.8.2 table).
// Real implementations land in Phase 3 (src/transforms/functions/); Phase 1 only
// establishes the registry shape and reserves every spec-defined name.
export const TRANSFORM_NAMES = Object.freeze([
  'create',
  'copy',
  'truncate',
  'escape',
  'cast',
  'append',
  'translate',
  'reference',
  'dateOp',
  'uuid',
  'pointer',
  'evaluate',
  'cc',
  'c',
  'qty',
  'id',
  'cp',
]);
