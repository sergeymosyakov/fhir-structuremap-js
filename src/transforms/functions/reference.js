// reference(source) — "return a string that references the provided tree properly."
// §7.8.0.8.2. Requires a resource-shaped value (resourceType + id).
import { EngineError } from '../../engine/errors.js';

export function reference(ctx, params) {
  const [source] = params;
  if (!source || typeof source.resourceType !== 'string' || !source.id) {
    throw new EngineError('reference: source must have resourceType and id');
  }
  return `${source.resourceType}/${source.id}`;
}
