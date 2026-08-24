// translate(source, map_uri, output) — uses the host-injected ConceptMap translate
// operation (Mapping Support API, §7.8.0.1 / %terminologies.translate()). §7.8.0.8.2.
import { EngineError } from '../../engine/errors.js';

const OUTPUT_KINDS = new Set(['code', 'system', 'display', 'Coding', 'CodeableConcept']);

export function translate(ctx, params) {
  const [source, mapUri, output] = params;
  if (!ctx.translate) {
    throw new EngineError('translate: no translate() callback was injected (Mapping Support API)');
  }
  if (!OUTPUT_KINDS.has(output)) {
    throw new EngineError(`translate: unknown output kind "${output}"`);
  }
  const match = ctx.translate(source, mapUri);
  if (!match) return undefined;
  if (output === 'code') return match.code;
  if (output === 'system') return match.system;
  if (output === 'display') return match.display;
  if (output === 'Coding') return { system: match.system, code: match.code, display: match.display };
  return { coding: [{ system: match.system, code: match.code, display: match.display }] }; // CodeableConcept
}
