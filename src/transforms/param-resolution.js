// A transform parameter is either a variable reference (`valueId`, looked up in the
// current scope) or a literal (any other value[x] kind, used as-is).
export function resolveParameter(parameter, scope) {
  if (parameter.kind === 'id') return scope.get(parameter.value);
  return parameter.value;
}

export function resolveParameters(parameters, scope) {
  return parameters.map((p) => resolveParameter(p, scope));
}
