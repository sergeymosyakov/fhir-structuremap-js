// cast(source, type?) — "cast source from one type to another." §7.8.0.8.2 table.
// An implicit (omitted) type requires knowing the single possible target type, which
// needs a real StructureDefinition resolver (Phase 6) — until then, type is required.
import { EngineError } from '../../engine/errors.js';

const CASTERS = new Map([
  ['string', (v) => String(v)],
  ['integer', (v) => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) throw new EngineError(`cast: "${v}" is not a valid integer`);
    return n;
  }],
  ['decimal', (v) => {
    const n = Number(v);
    if (Number.isNaN(n)) throw new EngineError(`cast: "${v}" is not a valid decimal`);
    return n;
  }],
  ['boolean', (v) => {
    if (typeof v === 'boolean') return v;
    if (v === 'true') return true;
    if (v === 'false') return false;
    throw new EngineError(`cast: "${v}" is not a valid boolean`);
  }],
  ['Reference', (v) => ({ reference: v })],
]);

export function cast(ctx, params) {
  const [source, type] = params;
  if (!type) {
    throw new EngineError('cast: an explicit type is required (implicit inference needs Phase 6\'s StructureDefinition resolver)');
  }
  const caster = CASTERS.get(type);
  if (!caster) throw new EngineError(`cast: unsupported target type "${type}"`);
  return caster(source);
}
