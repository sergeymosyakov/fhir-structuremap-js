// Reserved keywords for the FHIR Mapping Language concrete syntax (§7.8.0.13).
// Cannot be used as bare identifiers unless backtick-delimited.
export const RESERVED_WORDS = new Set([
  'map', 'uses', 'as', 'alias', 'imports', 'group', 'extends', 'default',
  'where', 'check', 'log', 'then', 'true', 'false', 'types', 'type', 'first',
  'not_first', 'last', 'not_last', 'only_one', 'share', 'single', 'source',
  'target', 'queried', 'produced', 'conceptMap', 'prefix',
]);
