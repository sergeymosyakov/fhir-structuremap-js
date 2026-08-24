// StructureMap.group.rule — a single transform rule (§7.8.0.8 Transform Rules).
// A rule has source content, target transforms, and optional dependent rules
// (either nested literal rules, or named group/rule invocations).
import { requireField } from './validate.js';
import { RuleSource } from './rule-source.js';
import { RuleTarget } from './rule-target.js';
import { DependentInvocation } from './dependent-invocation.js';

export class Rule {
  constructor({ name, source, target, rule, dependent }) {
    this.name = name;
    this.source = source; // RuleSource[] — at least one required
    this.target = target; // RuleTarget[]
    this.rule = rule; // Rule[] — nested rules, inherit this rule's variable scope
    this.dependent = dependent; // DependentInvocation[] — named group/rule invocations
  }

  static fromJSON(json) {
    const sourceJson = requireField(json, 'source', 'Rule');
    if (sourceJson.length === 0) {
      throw new Error('Rule: "source" must have at least one entry');
    }
    return new Rule({
      name: json.name,
      source: sourceJson.map(RuleSource.fromJSON),
      target: (json.target ?? []).map(RuleTarget.fromJSON),
      rule: (json.rule ?? []).map(Rule.fromJSON),
      dependent: (json.dependent ?? []).map(DependentInvocation.fromJSON),
    });
  }
}
