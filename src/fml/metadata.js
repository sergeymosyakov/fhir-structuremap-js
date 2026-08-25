// §7.8.0.3 Metadata (`/// name = value` lines). Simple, single-line, primitive
// top-level fields are supported, plus `"""..."""` multi-line markdown values
// (verified against the official HAPI/HL7 Java reference implementation's `render()`,
// which emits exactly this shape for e.g. a multi-line `description`). Dotted/complex
// properties (e.g. `jurisdiction.coding.system`) are still out of scope — the
// reference implementation itself silently drops any metadata name it doesn't
// recognize, so this is not a deviation from it.
const SIMPLE_METADATA_FIELDS = new Set([
  'url', 'name', 'title', 'status', 'experimental', 'description', 'publisher', 'version', 'date', 'purpose', 'copyright',
]);

function parseMetadataValue(raw) {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  const quoted = /^'(.*)'$/.exec(raw) ?? /^"(.*)"$/.exec(raw);
  return quoted ? quoted[1] : raw;
}

/** Reads a `"""..."""` value starting mid-line (after the opening `"""` was already
 * stripped). Unlike ordinary `///` lines, the body is raw verbatim text — no `///`
 * prefix on continuation lines. Returns [value, indexOfLastLineConsumed]. */
function readTripleQuoted(lines, startLi, firstLineRemainder) {
  const closeIdx = firstLineRemainder.indexOf('"""');
  if (closeIdx !== -1) return [firstLineRemainder.slice(0, closeIdx), startLi];
  const collected = [firstLineRemainder];
  for (let li = startLi + 1; li < lines.length; li++) {
    const idx = lines[li].indexOf('"""');
    if (idx !== -1) {
      collected.push(lines[li].slice(0, idx));
      return [collected.join('\n'), li];
    }
    collected.push(lines[li]);
  }
  return [collected.join('\n'), lines.length - 1]; // unterminated — take the rest of the text
}

export function extractMetadata(text) {
  const metadata = {};
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    const m = /^\s*\/\/\/\s*([A-Za-z]+)\s*=\s*(.*)$/.exec(lines[li]);
    if (!m) continue;
    const [, name, rawValue] = m;
    if (!SIMPLE_METADATA_FIELDS.has(name)) continue;
    const trimmed = rawValue.trim();
    if (trimmed.startsWith('"""')) {
      const [value, endLi] = readTripleQuoted(lines, li, trimmed.slice(3));
      metadata[name] = value;
      li = endLi;
      continue;
    }
    metadata[name] = parseMetadataValue(trimmed);
  }
  return metadata;
}
