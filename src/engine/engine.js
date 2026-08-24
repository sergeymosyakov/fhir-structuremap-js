// Public engine entry point — wires the injected FHIRPath evaluator into the
// scoping/matching building blocks. Target-transform execution (`run()`) lands in
// Phase 3; this phase exposes the primitives it will be built on.
import { bindGroupInputs } from './group-binder.js';
import { matchRule } from './rule-matcher.js';

export class StructureMapEngine {
  /** @param {{ evaluator: import('./evaluator.js').FhirPathEvaluator, env?: object, onLog?: (msg: unknown) => void }} deps */
  constructor({ evaluator, env, onLog } = {}) {
    this.evaluator = evaluator;
    this.env = env;
    this.onLog = onLog;
  }

  #ctx() {
    return { evaluator: this.evaluator, env: this.env, onLog: this.onLog };
  }

  bindGroupInputs(group, inputs) {
    return bindGroupInputs(group, inputs);
  }

  matchRule(rule, scope) {
    return matchRule(rule, scope, this.#ctx());
  }
}
