// Public FML entry point: FHIR Mapping Language concrete-syntax text -> StructureMap
// JSON (or, conveniently, straight to a parsed StructureMapDocument).
import { parseFML as parseAST } from './parser.js';
import { astToJSON } from './ast-to-json.js';
import { extractMetadata } from './metadata.js';
import { StructureMapDocument } from '../model/structure-map-document.js';

/** Parses FML text into a StructureMap JSON resource. */
export function parseFMLToJSON(text) {
  const ast = parseAST(text);
  const json = astToJSON(ast);
  return { ...json, ...extractMetadata(text) };
}

/** Parses FML text directly into a StructureMapDocument. */
export function parseFMLToDocument(text) {
  return StructureMapDocument.fromJSON(parseFMLToJSON(text));
}
