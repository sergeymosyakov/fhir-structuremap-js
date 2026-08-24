// §7.8.0.8.1 — "If a cardinality is specified and the cardinality of the element in
// the source is not within the specified cardinality, the mapping engine raises an
// error instead of completing the transformation." Checked against the raw
// context.element{:type} match, before listMode selection.
import { EngineError } from './errors.js';

export function checkCardinality(candidates, ruleSource) {
  const { min, max } = ruleSource;
  if (min === undefined && max === undefined) return;
  const count = candidates.length;
  const label = `${ruleSource.context}${ruleSource.element ? '.' + ruleSource.element : ''}`;
  if (min !== undefined && count < min) {
    throw new EngineError(`RuleSource "${label}": expected at least ${min} element(s), found ${count}`);
  }
  if (max !== undefined && max !== '*' && count > Number(max)) {
    throw new EngineError(`RuleSource "${label}": expected at most ${max} element(s), found ${count}`);
  }
}
