// §7.8.0.3 Metadata (`/// name = value` lines). Only simple, single-line, primitive
// top-level fields are supported — dotted/complex properties (e.g. `jurisdiction.
// coding.system`) and multi-line markdown (`"""..."""`) are explicitly out of scope
// for this phase, matching the bounded, honestly-documented approach taken elsewhere.
const SIMPLE_METADATA_FIELDS = new Set([
  'url', 'name', 'title', 'status', 'experimental', 'description', 'publisher', 'version', 'date', 'purpose', 'copyright',
]);

function parseMetadataValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const quoted = /^'(.*)'$/.exec(raw) ?? /^"(.*)"$/.exec(raw);
  return quoted ? quoted[1] : raw;
}

export function extractMetadata(text) {
  const metadata = {};
  for (const line of text.split('\n')) {
    const m = /^\s*\/\/\/\s*([A-Za-z]+)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    const [, name, rawValue] = m;
    if (!SIMPLE_METADATA_FIELDS.has(name)) continue;
    metadata[name] = parseMetadataValue(rawValue.trim());
  }
  return metadata;
}
