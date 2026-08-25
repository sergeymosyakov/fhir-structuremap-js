// dateOp(date, operation, value, unit) — §7.8.0.8.2 table lists this transform's own
// parameters as "?? | Perform a date operation. Parameters to be documented", so the
// StructureMap spec itself defines nothing here. Rather than leave it unimplemented or
// invent arbitrary syntax, this grounds the parameter shape in FHIRPath's own
// standardized date/time arithmetic (FHIRPath spec §6.5.1) — the engine already hard-
// depends on an injected FHIRPath evaluator for everything else, so `+`/`-` with a
// calendar-duration unit is the natural, non-arbitrary place to anchor an
// underspecified date transform, verified against the real `fhirpath` npm package's
// accepted unit vocabulary (year(s)/month(s)/week(s)/day(s)/hour(s)/minute(s)/
// second(s)/millisecond(s), or the quoted UCUM short forms 'wk'/'d'/'h'/'min'/'s'/'ms').
import { EngineError } from '../../engine/errors.js';
import { evaluateSingle } from '../../engine/evaluator.js';

const WORD_UNITS = new Set([
  'year', 'years', 'month', 'months', 'week', 'weeks', 'day', 'days',
  'hour', 'hours', 'minute', 'minutes', 'second', 'seconds', 'millisecond', 'milliseconds',
]);
const UCUM_UNITS = new Set(['wk', 'd', 'h', 'min', 's', 'ms']);
const DATE_LITERAL = /^@?\d{4}(-\d{2}(-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})?)?)?)?$/;

export function dateOp(ctx, params) {
  const [date, operation, value, unit] = params;
  if (operation !== '+' && operation !== '-') {
    throw new EngineError(`dateOp: unsupported operation "${operation}" (expected "+" or "-")`);
  }
  if (typeof date !== 'string' || !DATE_LITERAL.test(date)) {
    throw new EngineError(`dateOp: "${date}" is not a valid date/dateTime literal`);
  }
  let unitLiteral;
  if (WORD_UNITS.has(unit)) unitLiteral = unit;
  else if (UCUM_UNITS.has(unit)) unitLiteral = `'${unit}'`;
  else throw new EngineError(`dateOp: unsupported unit "${unit}"`);

  const literal = date.startsWith('@') ? date : `@${date}`;
  return evaluateSingle(ctx.evaluator, undefined, `${literal} ${operation} ${value} ${unitLiteral}`, ctx.env);
}
