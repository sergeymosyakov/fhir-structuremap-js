// Parent-chained variable bindings — mirrors FML's nested-rule variable visibility:
// a nested rule sees its own bindings plus everything bound in its containing rule/group.
export class VariableScope {
  #parent;
  #vars = new Map();

  constructor(parent = null) {
    this.#parent = parent;
  }

  set(name, value) {
    this.#vars.set(name, value);
    return this;
  }

  has(name) {
    return this.#vars.has(name) || (this.#parent?.has(name) ?? false);
  }

  get(name) {
    if (this.#vars.has(name)) return this.#vars.get(name);
    return this.#parent ? this.#parent.get(name) : undefined;
  }

  /** A new scope nested under this one, e.g. for a rule's own variable bindings. */
  child() {
    return new VariableScope(this);
  }
}
