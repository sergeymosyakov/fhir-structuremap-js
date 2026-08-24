// pointer(resource) — "Return the appropriate string to put in a Reference that
// refers to the resource provided as a parameter." §7.8.0.8.2. The spec gives no
// distinguishing detail from `reference()` beyond wording — same behavior here.
import { reference } from './reference.js';

export function pointer(ctx, params) {
  return reference(ctx, params);
}
