// Parent-chained variable bindings — mirrors FML's nested-rule variable visibility:
// a nested rule sees its own bindings plus everything bound in its containing rule/group.
// The root scope may carry a ConstantResolver — §7.8.0.6 constants "are available as
// source variables", so they're the final fallback after the parent chain.
export class VariableScope {
  #parent;
  #vars = new Map();
  #constants;

  constructor(parent = null, constants = null) {
    this.#parent = parent;
    this.#constants = constants;
  }

  set(name, value) {
    this.#vars.set(name, value);
    return this;
  }

  has(name) {
    if (this.#vars.has(name)) return true;
    if (this.#parent) return this.#parent.has(name);
    return this.#constants ? this.#constants.has(name) : false;
  }

  get(name) {
    if (this.#vars.has(name)) return this.#vars.get(name);
    if (this.#parent) return this.#parent.get(name);
    return this.#constants ? this.#constants.resolve(name) : undefined;
  }

  /** A new scope nested under this one, e.g. for a rule's own variable bindings. */
  child() {
    return new VariableScope(this);
  }
}
