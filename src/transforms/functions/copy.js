// copy(source) — "simply copy the source to the target as is (only allowed when the
// types in source and target match)". §7.8.0.8.2 table.
export function copy(ctx, params) {
  return params[0];
}
