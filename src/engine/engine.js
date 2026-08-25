// Public engine entry point — wires the injected FHIRPath evaluator and Mapping
// Support API callbacks (createInstance, translate, uuidFactory, structureMapResolver,
// structureDefinitionResolver, queryInstances, produceInstance) into the
// scoping/matching/target-application building blocks, plus the top-level `run()`.
import { bindGroupInputs } from './group-binder.js';
import { matchRule } from './rule-matcher.js';
import { getEffectiveRules } from './effective-rules.js';
import { executeRule } from './rule-executor.js';
import { invokeGroup } from './group-invoker.js';
import { ListPlan } from './list-plan.js';
import { ConstantResolver } from './constants.js';
import { EngineError } from './errors.js';
import { createDefaultTransformRegistry } from '../transforms/registry.js';

export class StructureMapEngine {
  #constantsCache;

  /**
   * @param {{ evaluator: import('./evaluator.js').FhirPathEvaluator, env?: object,
   *   onLog?: (msg: unknown) => void, registry?: import('../transforms/registry.js').TransformRegistry,
   *   createInstance?: (type: string|undefined) => object, translate?: (source: unknown, mapUri: string) => object,
   *   uuidFactory?: () => string, structureMapResolver?: (pattern: string) => object[]|undefined,
   *   structureDefinitionResolver?: (type: string) => object|undefined,
   *   queryInstances?: (type: string) => unknown[], produceInstance?: (type: string) => unknown }} deps
   */
  constructor({
    evaluator, env, onLog, registry, createInstance, translate, uuidFactory,
    structureMapResolver, structureDefinitionResolver, queryInstances, produceInstance,
  } = {}) {
    this.evaluator = evaluator;
    this.env = env;
    this.onLog = onLog;
    this.registry = registry ?? createDefaultTransformRegistry();
    this.createInstance = createInstance;
    this.translate = translate;
    this.uuidFactory = uuidFactory;
    this.structureMapResolver = structureMapResolver;
    this.structureDefinitionResolver = structureDefinitionResolver;
    this.queryInstances = queryInstances;
    this.produceInstance = produceInstance;
    this.#constantsCache = new WeakMap();
  }

  /** One ConstantResolver per document (§7.8.0.6 scopes const names to "a single
   * mapping source file") — cached so repeated invocations of groups in the same
   * imported map reuse the same lazy/circular-safe resolver instance. */
  #constantsFor(doc) {
    if (!doc) return new ConstantResolver(doc, this.evaluator, this.env); // e.g. matchRule() called standalone, without a document
    if (!this.#constantsCache.has(doc)) {
      this.#constantsCache.set(doc, new ConstantResolver(doc, this.evaluator, this.env));
    }
    return this.#constantsCache.get(doc);
  }

  #ctx(doc) {
    const constants = this.#constantsFor(doc);
    const ctx = {
      doc,
      evaluator: this.evaluator,
      env: constants.asEnv(),
      onLog: this.onLog,
      registry: this.registry,
      createInstance: this.createInstance,
      translate: this.translate,
      uuidFactory: this.uuidFactory,
      structureMapResolver: this.structureMapResolver,
      structureDefinitionResolver: this.structureDefinitionResolver,
      queryInstances: this.queryInstances,
      produceInstance: this.produceInstance,
      constants,
    };
    ctx.invokeGroup = (name, args, listPlan) => invokeGroup(doc, name, args, ctx, listPlan);
    ctx.forDoc = (d) => this.#ctx(d);
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
   * returns the (possibly mutated) values of every target-mode input. `doc.const[]`
   * (§7.8.0.6) are resolved per-document — a group invoked from an imported map sees
   * that map's own constants, not the top-level run() document's.
   */
  run(doc, inputs, groupName) {
    const group = groupName ? doc.getGroup(groupName) : doc.defaultGroup;
    if (!group) throw new EngineError(`run: group "${groupName}" not found`);

    const ctx = this.#ctx(doc);
    const scope = bindGroupInputs(group, inputs, ctx.constants);
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


