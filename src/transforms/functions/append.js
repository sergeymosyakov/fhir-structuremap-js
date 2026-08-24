// append(source...) — "source is element or string - just append them all together."
// FHIRPath equivalent: & (string concatenation, treats missing as ''). §7.8.0.8.2.
export function append(ctx, params) {
  return params.map((p) => (p === undefined || p === null ? '' : String(p))).join('');
}
