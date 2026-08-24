// StructureMapSourceListMode — https://www.hl7.org/fhir/valueset-map-source-list-mode.html
// Each mode is a guard/filter on which of a source's matched elements fire the rule,
// not a hard error condition (per the value set's own definitions).
import { EngineError } from './errors.js';

const HANDLERS = new Map([
  ['first', (items) => items.slice(0, 1)],
  ['not_first', (items) => items.slice(1)],
  ['last', (items) => items.slice(-1)],
  ['not_last', (items) => items.slice(0, -1)],
  ['only_one', (items) => (items.length === 1 ? items : [])],
]);

export function applySourceListMode(items, listMode) {
  if (!listMode) return items;
  const handler = HANDLERS.get(listMode);
  if (!handler) throw new EngineError(`Unknown source listMode "${listMode}"`);
  return handler(items);
}
