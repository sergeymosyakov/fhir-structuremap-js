// dateOp — §7.8.0.8.2 table lists this as "?? | Perform a date operation. Parameters
// to be documented" — the spec itself never defines this transform's parameters or
// behavior. Rather than invent semantics, this is intentionally left unimplemented;
// per THE MUST rule 3 (spec fidelity over shortcuts), a guessed behavior would be
// worse than an honest error.
import { EngineError } from '../../engine/errors.js';

export function dateOp() {
  throw new EngineError('dateOp: not implemented — the FHIR spec itself leaves this transform\'s parameters undefined ("??")');
}
