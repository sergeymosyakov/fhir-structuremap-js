// StructureMap.const — §7.8.0.6 Constants: lazy (only evaluated on first reference),
// cached (evaluated once per run), circular-reference detection. Exposed as FHIRPath
// %name env vars via a Proxy so laziness holds even for constants referenced only
// inside an arbitrary FHIRPath expression string the engine never parses itself.
import { EngineError } from './errors.js';
import { evaluateSingle } from './evaluator.js';

export class ConstantResolver {
  #doc;
  #evaluator;
  #baseEnv;
  #cache = new Map();
  #inProgress = new Set();

  constructor(doc, evaluator, baseEnv = {}) {
    this.#doc = doc;
    this.#evaluator = evaluator;
    this.#baseEnv = baseEnv;
  }

  has(name) {
    return this.#doc.const.some((c) => c.name === name);
  }

  resolve(name) {
    if (this.#cache.has(name)) return this.#cache.get(name);
    if (this.#inProgress.has(name)) {
      throw new EngineError(`Constant "${name}": circular reference`);
    }
    const def = this.#doc.const.find((c) => c.name === name);
    if (!def) throw new EngineError(`Constant "${name}" is not defined`);

    this.#inProgress.add(name);
    try {
      const value = evaluateSingle(this.#evaluator, undefined, def.value, this.asEnv());
      this.#cache.set(name, value);
      return value;
    } finally {
      this.#inProgress.delete(name);
    }
  }

  /** A FHIRPath env object where every constant is a lazily-evaluated getter. */
  asEnv() {
    const resolver = this;
    return new Proxy({ ...this.#baseEnv }, {
      get(target, prop) {
        if (typeof prop === 'string' && !(prop in target) && resolver.has(prop)) {
          return resolver.resolve(prop);
        }
        return target[prop];
      },
      has(target, prop) {
        return prop in target || (typeof prop === 'string' && resolver.has(prop));
      },
    });
  }
}
