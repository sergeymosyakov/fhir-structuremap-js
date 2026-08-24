// Public engine entry point — wires the injected FHIRPath evaluator and Mapping
// Support API callbacks (createInstance, translate, uuidFactory) into the
// scoping/matching/target-application building blocks, plus the top-level `run()`.
import { bindGroupInputs } from './group-binder.js';
import { matchRule } from './rule-matcher.js';
import { getEffectiveRules } from './effective-rules.js';
import { executeRule } from './rule-executor.js';
import { invokeGroup } from './group-invoker.js';
import { ListPlan } from './list-plan.js';
import { EngineError } from './errors.js';
import { createDefaultTransformRegistry } from '../transforms/registry.js';

export class StructureMapEngine {
  /**
   * @param {{ evaluator: import('./evaluator.js').FhirPathEvaluator, env?: object,
   *   onLog?: (msg: unknown) => void, registry?: import('../transforms/registry.js').TransformRegistry,
   *   createInstance?: (type: string|undefined) => object, translate?: (source: unknown, mapUri: string) => object,
   *   uuidFactory?: () => string }} deps
   */
  constructor({ evaluator, env, onLog, registry, createInstance, translate, uuidFactory } = {}) {
    this.evaluator = evaluator;
    this.env = env;
    this.onLog = onLog;
    this.registry = registry ?? createDefaultTransformRegistry();
    this.createInstance = createInstance;
    this.translate = translate;
    this.uuidFactory = uuidFactory;
  }

  #ctx(doc) {
    const ctx = {
      evaluator: this.evaluator,
      env: this.env,
      onLog: this.onLog,
      registry: this.registry,
      createInstance: this.createInstance,
      translate: this.translate,
      uuidFactory: this.uuidFactory,
    };
    ctx.invokeGroup = (name, args, listPlan) => invokeGroup(doc, name, args, ctx, listPlan);
    return ctx;
  }

  bindGroupInputs(group, inputs) {
    return bindGroupInputs(group, inputs);
  }

  matchRule(rule, scope, doc) {
    return matchRule(rule, scope, this.#ctx(doc));
  }

  /**
   * Runs a StructureMapDocument: binds `inputs` (by name) to the resolved group's
   * inputs, executes every effective rule, flushes deferred target-list assembly, and
   * returns the (possibly mutated) values of every target-mode input.
   */
  run(doc, inputs, groupName) {
    const group = groupName ? doc.getGroup(groupName) : doc.defaultGroup;
    if (!group) throw new EngineError(`run: group "${groupName}" not found`);

    const scope = bindGroupInputs(group, inputs);
    const ctx = this.#ctx(doc);
    const listPlan = new ListPlan();

    for (const rule of getEffectiveRules(doc, group)) {
      executeRule(rule, scope, ctx, listPlan);
    }
    listPlan.flush();

    const targets = {};
    for (const input of group.input) {
      if (input.mode === 'target') targets[input.name] = scope.get(input.name);
    }
    return targets;
  }
}

