// escape(source, format1, format2) — "Change the internal escaping of a string
// element." §7.8.0.8.2 table. The spec defines no concrete vocabulary for format1/
// format2, so this covers only the practically common 'xml' <-> plain-text case;
// anything else is an explicit error rather than a silent no-op.
import { EngineError } from '../../engine/errors.js';

const XML_ENTITIES = [['&', '&amp;'], ['<', '&lt;'], ['>', '&gt;'], ['"', '&quot;'], ["'", '&apos;']];

function xmlEscape(str) {
  return XML_ENTITIES.reduce((acc, [ch, ent]) => acc.split(ch).join(ent), str);
}

function xmlUnescape(str) {
  return XML_ENTITIES.reduceRight((acc, [ch, ent]) => acc.split(ent).join(ch), str);
}

export function escape(ctx, params) {
  const [source, format1, format2] = params;
  if (source === undefined || source === null) return source;
  const str = String(source);
  if (format1 === 'string' && format2 === 'xml') return xmlEscape(str);
  if (format1 === 'xml' && format2 === 'string') return xmlUnescape(str);
  if (format1 === format2) return str;
  throw new EngineError(`escape: unsupported format conversion "${format1}" -> "${format2}"`);
}
