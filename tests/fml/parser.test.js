import { describe, it, expect } from 'vitest';
import { parseFMLToJSON } from '../../src/fml/index.js';
import { FMLSyntaxError } from '../../src/fml/fml-syntax-error.js';

function group(json, i = 0) {
  return json.group[i];
}
function rule(json, gi = 0, ri = 0) {
  return group(json, gi).rule[ri];
}

describe('parseFMLToJSON — map header', () => {
  it('parses url and name from the map statement', () => {
    const json = parseFMLToJSON('map "http://example.org/StructureMap/X" = X\ngroup g(source a, target b) {}');
    expect(json.url).toBe('http://example.org/StructureMap/X');
    expect(json.name).toBe('X');
    expect(json.resourceType).toBe('StructureMap');
  });

  it('accepts single-quoted map urls too', () => {
    const json = parseFMLToJSON("map 'http://x' = X\ngroup g(source a, target b) {}");
    expect(json.url).toBe('http://x');
  });
});

describe('parseFMLToJSON — structure references (uses)', () => {
  it('parses source/target/queried/produced modes and an alias', () => {
    const json = parseFMLToJSON(`
      map "u" = X
      uses "http://hl7.org/fhir/StructureDefinition/Patient" alias Pat as source
      uses "http://hl7.org/fhir/StructureDefinition/Person" as target
      uses "http://hl7.org/fhir/StructureDefinition/Observation" as queried
      uses "http://hl7.org/fhir/StructureDefinition/Bundle" as produced
      group g(source a, target b) {}
    `);
    expect(json.structure).toEqual([
      { url: 'http://hl7.org/fhir/StructureDefinition/Patient', mode: 'source', alias: 'Pat' },
      { url: 'http://hl7.org/fhir/StructureDefinition/Person', mode: 'target', alias: undefined },
      { url: 'http://hl7.org/fhir/StructureDefinition/Observation', mode: 'queried', alias: undefined },
      { url: 'http://hl7.org/fhir/StructureDefinition/Bundle', mode: 'produced', alias: undefined },
    ]);
  });
});

describe('parseFMLToJSON — imports', () => {
  it('parses one or more import statements', () => {
    const json = parseFMLToJSON(`
      map "u" = X
      imports "http://example.org/StructureMap/a"
      imports "http://example.org/StructureMap/*b"
      group g(source a, target b) {}
    `);
    expect(json.import).toEqual(['http://example.org/StructureMap/a', 'http://example.org/StructureMap/*b']);
  });
});

describe('parseFMLToJSON — constants', () => {
  it('parses a let-constant with a raw FHIRPath value', () => {
    const json = parseFMLToJSON(`
      map "u" = X
      let status = 'final';
      group g(source a, target b) {}
    `);
    expect(json.const).toEqual([{ name: 'status', value: "'final'" }]);
  });

  it('captures a multi-token FHIRPath expression as the constant value verbatim', () => {
    const json = parseFMLToJSON(`
      map "u" = X
      let age = %patient.birthDate;
      group g(source a, target b) {}
    `);
    expect(json.const[0].value).toBe('%patient.birthDate');
  });
});

describe('parseFMLToJSON — groups', () => {
  it('parses a single-input group (allowed for the map\'s first group)', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source a) {}');
    expect(group(json).input).toEqual([{ name: 'a', mode: 'source', type: undefined }]);
  });

  it('parses input types', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source a : Patient, target b : Person) {}');
    expect(group(json).input).toEqual([
      { name: 'a', mode: 'source', type: 'Patient' },
      { name: 'b', mode: 'target', type: 'Person' },
    ]);
  });

  it('parses "extends"', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup base(source a, target b) {}\ngroup g(source a, target b) extends base {}');
    expect(group(json, 1).extends).toBe('base');
  });

  it('parses "<<types>>" and "<<type+>>" typeMode', () => {
    const json = parseFMLToJSON(`
      map "u" = X
      group g1(source a : X, target b : Y) <<types>> {}
      group g2(source a : X, target b : Y) <<type+>> {}
    `);
    expect(group(json, 0).typeMode).toBe('types');
    expect(group(json, 1).typeMode).toBe('type-and-types');
  });

  it('defaults typeMode to "none"', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source a, target b) {}');
    expect(group(json).typeMode).toBe('none');
  });

  it('parses multiple groups', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g1(source a) {}\ngroup g2(source a) {}');
    expect(json.group.map((g) => g.name)).toEqual(['g1', 'g2']);
  });
});

describe('parseFMLToJSON — rule sources', () => {
  const wrap = (ruleText) => `map "u" = X\ngroup g(source src, target tgt) {\n${ruleText}\n}`;

  it('parses context, element, and alias', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v;'));
    expect(rule(json).source[0]).toMatchObject({ context: 'src', element: 'value', variable: 'v' });
  });

  it('parses a type filter', () => {
    const json = parseFMLToJSON(wrap('src.value : integer as v -> tgt.value = v;'));
    expect(rule(json).source[0].type).toBe('integer');
  });

  it('parses cardinality with a numeric upper bound', () => {
    const json = parseFMLToJSON(wrap('src.value 1..5 as v -> tgt.value = v;'));
    expect(rule(json).source[0]).toMatchObject({ min: 1, max: 5 });
  });

  it('parses cardinality with a "*" upper bound', () => {
    const json = parseFMLToJSON(wrap('src.value 0..* as v -> tgt.value = v;'));
    expect(rule(json).source[0]).toMatchObject({ min: 0, max: '*' });
  });

  it('parses a default() clause as raw FHIRPath', () => {
    const json = parseFMLToJSON(wrap("src.value default('fallback') as v -> tgt.value = v;"));
    expect(rule(json).source[0].defaultValue).toBe("'fallback'");
  });

  it.each(['first', 'not_first', 'last', 'not_last', 'only_one'])('parses source listMode "%s"', (mode) => {
    const json = parseFMLToJSON(wrap(`src.value ${mode} as v -> tgt.value = v;`));
    expect(rule(json).source[0].listMode).toBe(mode);
  });

  it('parses where() and check() as raw FHIRPath', () => {
    const json = parseFMLToJSON(wrap('src.value as v where(v > 1) check(v < 100) -> tgt.value = v;'));
    expect(rule(json).source[0].condition).toBe('v > 1');
    expect(rule(json).source[0].check).toBe('v < 100');
  });

  it('parses log() as raw FHIRPath', () => {
    const json = parseFMLToJSON(wrap("src.value as v log('mapping value') -> tgt.value = v;"));
    expect(rule(json).source[0].logMessage).toBe("'mapping value'");
  });

  it('parses multiple comma-separated sources', () => {
    const json = parseFMLToJSON(wrap('src.a as x, src.b as y -> tgt.value = x;'));
    expect(rule(json).source).toHaveLength(2);
    expect(rule(json).source.map((s) => s.element)).toEqual(['a', 'b']);
  });

  it('rejects a source context with more than one dot', () => {
    expect(() => parseFMLToJSON(wrap('src.a.b as v -> tgt.value = v;'))).toThrow(FMLSyntaxError);
  });
});

describe('parseFMLToJSON — rule targets / transforms', () => {
  const wrap = (ruleText) => `map "u" = X\ngroup g(source src, target tgt) {\n${ruleText}\n}`;

  it('a bare literal target compiles to copy(literal)', () => {
    const json = parseFMLToJSON(wrap("src.value as v -> tgt.status = 'final';"));
    expect(rule(json).target[0]).toMatchObject({ transform: 'copy', parameter: [{ valueString: 'final' }] });
  });

  it('a bare variable reference compiles to copy(variable)', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v;'));
    expect(rule(json).target[0]).toMatchObject({ transform: 'copy', parameter: [{ valueId: 'v' }] });
  });

  it('parses a named invocation with literal and id params', () => {
    const json = parseFMLToJSON(wrap("src.value as v -> tgt.code = c('http://sys', v, 'Display');"));
    expect(rule(json).target[0]).toMatchObject({
      transform: 'c',
      parameter: [{ valueString: 'http://sys' }, { valueId: 'v' }, { valueString: 'Display' }],
    });
  });

  it('parses evaluate() with a raw FHIRPath 2nd argument', () => {
    const json = parseFMLToJSON(wrap("src.value as v -> tgt.note = evaluate(v, given.first() + ' ' + family);"));
    expect(rule(json).target[0].transform).toBe('evaluate');
    expect(rule(json).target[0].parameter).toEqual([{ valueId: 'v' }, { valueString: "given.first() + ' ' + family" }]);
  });

  it('parses the bare "(expr)" evaluate shorthand using the target context as implicit $this', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.note = (v + 1);'));
    expect(rule(json).target[0].transform).toBe('evaluate');
    expect(rule(json).target[0].parameter).toEqual([{ valueId: 'tgt' }, { valueString: 'v + 1' }]);
  });

  it('parses a target variable alias', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.child = create(\'string\') as c;'));
    expect(rule(json).target[0].variable).toBe('c');
  });

  it.each(['first', 'share', 'last', 'single'])('parses target listMode "%s"', (mode) => {
    const json = parseFMLToJSON(wrap(`src.value as v -> tgt.value = v ${mode};`));
    expect(rule(json).target[0].listMode).toEqual([mode]);
  });

  it('defaults to an empty listMode array', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v;'));
    expect(rule(json).target[0].listMode).toEqual([]);
  });

  it('parses multiple comma-separated targets', () => {
    const json = parseFMLToJSON(wrap("src.value as v -> tgt.a = v, tgt.b = 'x';"));
    expect(rule(json).target).toHaveLength(2);
  });

  it('rejects a direct multi-segment copy without binding a variable first', () => {
    expect(() => parseFMLToJSON(wrap('src.value as v -> tgt.a = src.value;'))).toThrow(/binding it to a variable/);
  });
});

describe('parseFMLToJSON — subElement chaining desugars into nested auto-create rules', () => {
  it('desugars a 2-level target chain (tgt.a.b) into one nested rule', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source src, target tgt) {\nsrc.value as v -> tgt.a.b = v;\n}');
    const r = rule(json);
    expect(r.target[0].element).toBe('a');
    expect(r.target[0].transform).toBeUndefined(); // auto-create
    expect(r.rule).toHaveLength(1);
    const nested = r.rule[0];
    expect(nested.source[0].context).toBe(r.target[0].variable);
    expect(nested.target[0]).toMatchObject({ element: 'b', transform: 'copy', parameter: [{ valueId: 'v' }] });
  });

  it('desugars a 3-level target chain (tgt.a.b.c) into two nested rules', () => {
    const json = parseFMLToJSON('map "u" = X\ngroup g(source src, target tgt) {\nsrc.value as v -> tgt.a.b.c = v;\n}');
    const r = rule(json);
    expect(r.target[0].element).toBe('a');
    const level1 = r.rule[0];
    expect(level1.target[0].element).toBe('b');
    expect(level1.target[0].transform).toBeUndefined();
    const level2 = level1.rule[0];
    expect(level2.target[0]).toMatchObject({ element: 'c', transform: 'copy', parameter: [{ valueId: 'v' }] });
  });
});

describe('parseFMLToJSON — dependent rules', () => {
  const wrap = (ruleText) => `map "u" = X\ngroup g(source src, target tgt) {\n${ruleText}\n}`;

  it('parses "then group(args)" as a named dependent invocation', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v then helper(v, tgt);'));
    expect(rule(json).dependent).toEqual([{ name: 'helper', parameter: [{ valueId: 'v' }, { valueId: 'tgt' }] }]);
  });

  it('parses multiple comma-separated dependent invocations', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v then a(v), b(v);'));
    expect(rule(json).dependent.map((d) => d.name)).toEqual(['a', 'b']);
  });

  it('parses "then { nested rules }" as literal nested rules', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v then {\n  v.child as c -> tgt.other = c;\n};'));
    expect(rule(json).rule).toHaveLength(1);
    expect(rule(json).rule[0].source[0].context).toBe('v');
  });

  it('parses a ruleName after the dependent clause', () => {
    const json = parseFMLToJSON(wrap('src.value as v -> tgt.value = v myRuleName;'));
    expect(rule(json).name).toBe('myRuleName');
  });
});

describe('parseFMLToJSON — Simple Form: Identity Transform batch (src -> tgt: a, b, c;)', () => {
  const wrap = (ruleText) => `map "u" = X\ngroup g(source src, target tgt) {\n${ruleText}\n}`;

  it('desugars into one identity rule per element', () => {
    const json = parseFMLToJSON(wrap('src -> tgt: name, gender, birthDate;'));
    const rules = group(json).rule;
    expect(rules).toHaveLength(3);
    expect(rules.map((r) => r.source[0].element)).toEqual(['name', 'gender', 'birthDate']);
    expect(rules.map((r) => r.target[0].element)).toEqual(['name', 'gender', 'birthDate']);
    for (const r of rules) {
      expect(r.source[0].context).toBe('src');
      expect(r.target[0].context).toBe('tgt');
      expect(r.target[0].transform).toBeUndefined(); // plain identity form, not an explicit create()
    }
  });

  it('accepts an optional trailing ruleName used as a name prefix', () => {
    const json = parseFMLToJSON(wrap('src -> tgt: name, gender "demographics";'));
    expect(group(json).rule.map((r) => r.name)).toEqual(['demographics_name', 'demographics_gender']);
  });

  it('accepts a quoted ruleName', () => {
    const json = parseFMLToJSON(wrap('src -> tgt: name "demographics";'));
    expect(group(json).rule[0].name).toBe('demographics_name');
  });

  it('is not triggered when the source or target already has an element', () => {
    // A bare `:` here is the ordinary source-type-annotation colon, not the batch form.
    const json = parseFMLToJSON(wrap('src.value : string as v -> tgt.value = v;'));
    expect(group(json).rule).toHaveLength(1);
    expect(group(json).rule[0].source[0].type).toBe('string');
  });
});

describe('parseFMLToJSON — comments and whitespace', () => {
  it('ignores line and block comments anywhere', () => {
    const json = parseFMLToJSON(`
      // top comment
      map "u" = X /* inline */
      group g(source a, target b) { // group comment
        a.value as v -> b.value = v; /* rule comment */
      }
    `);
    expect(json.name).toBe('X');
    expect(rule(json).target[0].parameter).toEqual([{ valueId: 'v' }]);
  });
});
