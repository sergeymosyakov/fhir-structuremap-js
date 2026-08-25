// §7.8.0.3 Metadata (`/// name{.property}* = value` lines). Simple, single-line,
// primitive top-level fields are supported, plus `"""..."""` multi-line markdown
// values (verified against the official HAPI/HL7 Java reference implementation's
// `render()`, which emits exactly this shape for e.g. a multi-line `description`).
//
// Dotted/repeating properties (e.g. `jurisdiction.coding.system`) ARE defined by the
// spec, with a worked example — this is NOT a spec gap (an earlier version of this
// comment wrongly assumed it was, from reading the reference implementation's own
// incomplete handling). What's genuinely bounded here: correctly nesting a dotted
// path requires knowing which segments are FHIR repeating (0..*) vs singular (0..1)
// elements. That's fixed by the FHIR datatype definitions (not host/data-dependent
// like the "no bundled StructureDefinitions" principle elsewhere), so it's hardcoded
// below for the handful of complex StructureMap metadata fields realistically used in
// hand-written FML: `jurisdiction` (CodeableConcept[]) and `contact` (ContactDetail[]).
// Other complex fields (e.g. `useContext`, whose `value[x]` is a polymorphic choice)
// are still silently ignored, matching the reference implementation for those.
const SIMPLE_METADATA_FIELDS = new Set([
  'url', 'name', 'title', 'status', 'experimental', 'description', 'publisher', 'version', 'date', 'purpose', 'copyright',
]);

/** Cardinality of each supported complex field's own children — 'array' (FHIR 0..*)
 * vs 'scalar' (0..1) — per the fixed FHIR R5 CodeableConcept/Coding/ContactDetail/
 * ContactPoint datatype definitions. */
const COMPLEX_METADATA_SCHEMA = {
  jurisdiction: {
    cardinality: 'array', // CodeableConcept[]
    children: {
      text: { cardinality: 'scalar' },
      coding: {
        cardinality: 'array', // Coding[]
        children: {
          system: { cardinality: 'scalar' },
          version: { cardinality: 'scalar' },
          code: { cardinality: 'scalar' },
          display: { cardinality: 'scalar' },
          userSelected: { cardinality: 'scalar' },
        },
      },
    },
  },
  contact: {
    cardinality: 'array', // ContactDetail[]
    children: {
      name: { cardinality: 'scalar' },
      telecom: {
        cardinality: 'array', // ContactPoint[]
        children: {
          system: { cardinality: 'scalar' },
          value: { cardinality: 'scalar' },
          use: { cardinality: 'scalar' },
          rank: { cardinality: 'scalar' },
        },
      },
    },
  },
};

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

/** Assigns one dotted `///` metadata value into `metadata[path[0]]` (always an array),
 * building nested arrays/objects per COMPLEX_METADATA_SCHEMA's cardinality. Per
 * §7.8.0.3 "Additional items with the same name represent repeats" — repeat detection
 * (via `touched`, keyed by object identity so the output stays plain JSON, nothing
 * injected onto it) applies only at the segment actually being set on THIS line (the
 * leaf, or a bare complex value), never to intermediate segments merely being
 * revisited across several lines to populate the same entry further. Returns false if
 * `path`'s root or any segment isn't in the schema (caller then ignores the line). */
function assignDottedMetadata(metadata, path, value, touched) {
  const [rootName, ...rest] = path;
  const schema = COMPLEX_METADATA_SCHEMA[rootName];
  if (!schema) return false;

  // Validate the whole path against the schema before mutating anything, so an
  // unsupported nested field name has no partial side effect.
  let cursor = schema;
  for (const seg of rest) {
    cursor = cursor.children?.[seg];
    if (!cursor) return false;
  }

  if (!metadata[rootName]) metadata[rootName] = [];
  const rootArray = metadata[rootName];

  const touchedSetFor = (obj) => {
    let set = touched.get(obj);
    if (!set) { set = new Set(); touched.set(obj, set); }
    return set;
  };

  if (rest.length === 0) {
    // Bare "name =" (complex value, per spec always empty) marks an explicit instance
    // boundary — every occurrence, including the first, starts a fresh entry.
    rootArray.push({});
    return true;
  }

  if (rootArray.length === 0) rootArray.push({});
  let node = rootArray[rootArray.length - 1];
  let parentArray = rootArray;
  let schemaNode = schema;

  for (let i = 0; i < rest.length; i++) {
    const seg = rest[i];
    const isLast = i === rest.length - 1;
    const childSchema = schemaNode.children[seg];

    if (isLast) {
      const set = touchedSetFor(node);
      if (set.has(seg)) {
        node = {};
        parentArray.push(node);
      }
      touchedSetFor(node).add(seg);
      if (childSchema.cardinality === 'scalar') {
        node[seg] = value;
      } else if (!node[seg]) {
        node[seg] = [{}];
      }
      return true;
    }

    if (!node[seg]) node[seg] = [];
    parentArray = node[seg];
    if (parentArray.length === 0) parentArray.push({});
    node = parentArray[parentArray.length - 1];
    schemaNode = childSchema;
  }
  return true;
}

export function extractMetadata(text) {
  const metadata = {};
  const touched = new WeakMap();
  const lines = text.split('\n');
  for (let li = 0; li < lines.length; li++) {
    // §7.8.0.3: metadata is "the first part of a mapping file" — stop once the `map`
    // statement starts, so a `///`-shaped line inside a group/rule body later in the
    // file (a coincidental doc-comment, say) is never mistaken for metadata. `map` is
    // a reserved keyword, so this is an unambiguous boundary.
    if (/^\s*map\b/.test(lines[li])) break;
    const m = /^\s*\/\/\/\s*([A-Za-z][A-Za-z.]*)\s*=\s*(.*)$/.exec(lines[li]);
    if (!m) continue;
    const [, name, rawValue] = m;
    const path = name.split('.');
    if (path.length > 1 || COMPLEX_METADATA_SCHEMA[path[0]]) {
      const trimmed = rawValue.trim();
      assignDottedMetadata(metadata, path, parseMetadataValue(trimmed), touched);
      continue;
    }
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
