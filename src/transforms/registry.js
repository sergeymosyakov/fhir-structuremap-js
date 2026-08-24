// Factory/registry for target transform functions — mirrors the NODE_REGISTRY /
// MODAL_REGISTRY pattern: a Map<name, handler>, populated by a factory function.
// New transforms (or overrides) are added by registering a name, never by editing
// engine dispatch code.
import { TRANSFORM_NAMES } from './names.js';
import * as fns from './functions/index.js';

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

// Maps each spec-defined transform name to its real handler (src/transforms/functions/).
// `evaluate` is exported as `evaluateTransform` to avoid shadowing the engine's own
// evaluator helpers — the registry key is still the spec name "evaluate".
const DEFAULT_HANDLERS = {
  create: fns.create,
  copy: fns.copy,
  truncate: fns.truncate,
  escape: fns.escape,
  cast: fns.cast,
  append: fns.append,
  translate: fns.translate,
  reference: fns.reference,
  dateOp: fns.dateOp,
  uuid: fns.uuid,
  pointer: fns.pointer,
  evaluate: fns.evaluateTransform,
  cc: fns.cc,
  c: fns.c,
  qty: fns.qty,
  id: fns.id,
  cp: fns.cp,
};

/** Builds a registry with every spec-defined transform name wired to its real handler. */
export function createDefaultTransformRegistry() {
  const registry = new TransformRegistry();
  for (const name of TRANSFORM_NAMES) {
    registry.register(name, DEFAULT_HANDLERS[name]);
  }
  return registry;
}
