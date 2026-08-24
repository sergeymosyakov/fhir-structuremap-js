// Resolves a group's effective rule list, including inherited rules from `extends`
// (§7.8.0.7 Groups: "the rules in the other group also apply"). Pure data traversal —
// no mutation. Extended group's rules run before the group's own (base-then-derived).
import { EngineError } from './errors.js';

export function getEffectiveRules(doc, group, seen = new Set()) {
  if (seen.has(group.name)) {
    throw new EngineError(`Group "${group.name}": circular "extends" chain`);
  }
  seen.add(group.name);

  if (!group.extends) return group.rule;

  const base = doc.getGroup(group.extends);
  if (!base) {
    throw new EngineError(`Group "${group.name}" extends unknown group "${group.extends}"`);
  }
  return [...getEffectiveRules(doc, base, seen), ...group.rule];
}
