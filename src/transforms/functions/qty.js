// qty(text) | qty(value, unit[, system, code]) — "Create a quantity. Parameters =
// (text) or (value, unit, [system, code]) where text = the natural representation
// e.g. [comparator]value[space]unit." §7.8.0.8.2.
import { EngineError } from '../../engine/errors.js';

const NATURAL_QTY = /^\s*(<=|>=|<|>)?\s*(-?\d+(?:\.\d+)?)\s*(\S.*)?$/;

export function qty(ctx, params) {
  if (params.length === 1) {
    const match = NATURAL_QTY.exec(String(params[0]));
    if (!match) throw new EngineError(`qty: could not parse natural-text quantity "${params[0]}"`);
    const [, comparator, value, unit] = match;
    const result = { value: Number(value) };
    if (comparator) result.comparator = comparator;
    if (unit) result.unit = unit;
    return result;
  }
  const [value, unit, system, code] = params;
  const result = { value: Number(value), unit };
  if (system !== undefined) result.system = system;
  if (code !== undefined) result.code = code;
  return result;
}
