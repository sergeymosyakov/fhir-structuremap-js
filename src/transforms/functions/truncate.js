// truncate(source, length) — FHIRPath equivalent: substring(0, length). §7.8.0.8.2.
import { EngineError } from '../../engine/errors.js';

export function truncate(ctx, params) {
  const [source, length] = params;
  if (source === undefined || source === null) return source;
  if (typeof length !== 'number') {
    throw new EngineError('truncate: "length" parameter must be a number');
  }
  return String(source).substring(0, length);
}
