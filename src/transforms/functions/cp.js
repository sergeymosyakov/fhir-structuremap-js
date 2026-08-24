// cp(value) | cp(system, value) — "Create a contact detail. If no system is provided,
// the system should be inferred from the content of the value." §7.8.0.8.2.
function inferSystem(value) {
  const str = String(value);
  if (str.includes('@')) return 'email';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(str)) return 'url';
  if (/^\+?[0-9()\s-]+$/.test(str)) return 'phone';
  return 'other';
}

export function cp(ctx, params) {
  if (params.length === 1) {
    const [value] = params;
    return { system: inferSystem(value), value };
  }
  const [system, value] = params;
  return { system, value };
}
