// Factory/registry for target transform functions — mirrors the NODE_REGISTRY /
// MODAL_REGISTRY pattern: a Map<name, handler>, populated by a factory function.
// New transforms (or overrides) are added by registering a name, never by editing
// engine dispatch code.
import { TRANSFORM_NAMES } from './names.js';

/**
 * @typedef {(ctx: object, params: import('../model/parameter.js').Parameter[]) => unknown} TransformHandler
 * ctx (defined in the Phase 2/3 engine) carries the current variable scope and any
 * injected services (FHIRPath evaluator, create-instance callback, translate callback).
 */

export class TransformRegistry {
  #handlers = new Map();

  /** @param {string} name @param {TransformHandler} handler */
  register(name, handler) {
    if (this.#handlers.has(name)) {
      throw new Error(`TransformRegistry: "${name}" is already registered`);
    }
    this.#handlers.set(name, handler);
  }

  /** Replace an already-registered handler (explicit, so overrides are never silent). */
  override(name, handler) {
    if (!this.#handlers.has(name)) {
      throw new Error(`TransformRegistry: cannot override unregistered "${name}"`);
    }
    this.#handlers.set(name, handler);
  }

  get(name) {
    const handler = this.#handlers.get(name);
    if (!handler) {
      throw new Error(`TransformRegistry: no handler registered for "${name}"`);
    }
    return handler;
  }

  has(name) {
    return this.#handlers.has(name);
  }

  get names() {
    return [...this.#handlers.keys()];
  }
}

const notImplemented = (name) => () => {
  throw new Error(`TransformRegistry: "${name}" is reserved but not yet implemented (see PLAN.md Phase 3)`);
};

/** Builds a registry with every spec-defined transform name reserved. */
export function createDefaultTransformRegistry() {
  const registry = new TransformRegistry();
  for (const name of TRANSFORM_NAMES) {
    registry.register(name, notImplemented(name));
  }
  return registry;
}
