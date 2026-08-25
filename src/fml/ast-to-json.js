// Converts the FML parser's AST into the StructureMap JSON shape our model layer
// (`StructureMapDocument.fromJSON`) already consumes. The only structurally
// non-trivial part is target subElement chaining (`tgt.a.b.c = X`), which the spec
// (§7.8.0.8.2) describes as sugar for nested auto-create rules — desugared here into
// real nested `rule.rule[]` entries with synthetic variable names.
import { FMLSyntaxError } from './fml-syntax-error.js';

function literalToParam(lit) {
  const key = { STRING: 'valueString', INTEGER: 'valueInteger', NUMBER: 'valueDecimal', BOOL: 'valueBoolean', DATE: 'valueDate', DATETIME: 'valueDateTime', TIME: 'valueTime' }[lit.literalType];
  return { [key]: lit.value };
}

function convertParam(p) {
  if (p.kind === 'literal') return literalToParam(p);
  if (p.kind === 'idRef') return { valueId: p.name };
  throw new FMLSyntaxError(`Unsupported parameter shape "${p.kind}"`);
}

/** @param {object} transformAst @param {string} outerContext - the enclosing target's own context variable, used as the implicit `$this` for the `(expr)` shorthand. */
function convertTransform(transformAst, outerContext) {
  if (!transformAst) return {};
  if (transformAst.kind === 'literal') {
    return { transform: 'copy', parameter: [literalToParam(transformAst)] };
  }
  if (transformAst.kind === 'contextRef') {
    if (transformAst.segments.length > 1) {
      throw new FMLSyntaxError(`Copying from a nested path ("${transformAst.segments.join('.')}") requires binding it to a variable first (e.g. "as x") — direct multi-segment copy targets are not supported`);
    }
    return { transform: 'copy', parameter: [{ valueId: transformAst.segments[0] }] };
  }
  if (transformAst.kind === 'shorthandEvaluate') {
    return { transform: 'evaluate', parameter: [{ valueId: outerContext }, { valueString: transformAst.expr }] };
  }
  // invocation
  return { transform: transformAst.name, parameter: transformAst.params.map(convertParam) };
}

let syntheticCounter = 0;

function buildTargetJSON(context, element, transformAst, variable, listMode, outerContext) {
  const json = { context, element, variable, listMode: listMode ? [listMode] : [] };
  Object.assign(json, convertTransform(transformAst, outerContext ?? context));
  return json;
}

/** Desugars `tgt.a.b.c = X` into a chain of auto-create targets + nested rules. */
function desugarTarget(t) {
  if (t.elementChain.length <= 1) {
    return { target: buildTargetJSON(t.context, t.elementChain[0], t.transform, t.variable, t.listMode), extraRules: [] };
  }
  function buildLevel(varName, idx) {
    const element = t.elementChain[idx];
    const isLast = idx === t.elementChain.length - 1;
    if (isLast) {
      return {
        source: [{ context: varName }],
        target: [buildTargetJSON(varName, element, t.transform, t.variable, t.listMode)],
        rule: [],
        dependent: [],
      };
    }
    const nextVar = `_sub${syntheticCounter++}`;
    return {
      source: [{ context: varName }],
      target: [buildTargetJSON(varName, element, undefined, nextVar, undefined)],
      rule: [buildLevel(nextVar, idx + 1)],
      dependent: [],
    };
  }
  const outerVar = `_sub${syntheticCounter++}`;
  const outerTarget = buildTargetJSON(t.context, t.elementChain[0], undefined, outerVar, undefined);
  return { target: outerTarget, extraRules: [buildLevel(outerVar, 1)] };
}

function convertRuleSource(s) {
  return {
    context: s.context,
    element: s.element,
    type: s.type,
    min: s.min,
    max: s.max,
    defaultValue: s.defaultValue,
    listMode: s.listMode,
    variable: s.variable,
    condition: s.condition,
    check: s.check,
    logMessage: s.logMessage,
  };
}

function convertRule(r) {
  const targets = [];
  const extraNestedRules = [];
  for (const t of r.targets) {
    const { target, extraRules } = desugarTarget(t);
    targets.push(target);
    extraNestedRules.push(...extraRules);
  }
  const dependent = (r.dependent?.invocations ?? []).map((inv) => ({
    name: inv.name,
    parameter: inv.params.map(convertParam),
  }));
  const nestedRules = [...(r.dependent?.rules ?? []).map(convertRule), ...extraNestedRules];
  return {
    name: r.name,
    source: r.sources.map(convertRuleSource),
    target: targets,
    rule: nestedRules,
    dependent,
  };
}

/** Desugars a Simple Form: Identity Transform batch (`src -> tgt: a, b, c;`) into N
 * sibling plain identity rules (no explicit transform — same shape as `src.x -> tgt.x;`,
 * so it flows through the engine's existing identity-shorthand/auto-create dispatch). */
function convertIdentityBatch(b) {
  return b.elements.map((element) => ({
    name: b.name ? `${b.name}_${element}` : element,
    source: [{ context: b.sourceContext, element }],
    target: [{ context: b.targetContext, element }],
    rule: [],
    dependent: [],
  }));
}

function convertGroup(g) {
  return {
    name: g.name,
    extends: g.extends,
    typeMode: g.typeMode,
    input: g.inputs.map((i) => ({ name: i.name, mode: i.mode, type: i.type })),
    rule: g.rules.flatMap((r) => (r.identityBatch ? convertIdentityBatch(r.identityBatch) : [convertRule(r)])),
  };
}

/** Converts a parsed FML AST (see parser.js) into a StructureMap JSON resource. */
export function astToJSON(ast) {
  syntheticCounter = 0;
  return {
    resourceType: 'StructureMap',
    url: ast.url,
    name: ast.name,
    status: 'draft',
    structure: ast.structures.map((s) => ({ url: s.url, mode: s.mode, alias: s.alias })),
    import: ast.imports,
    const: ast.consts.map((c) => ({ name: c.name, value: c.value })),
    group: ast.groups.map(convertGroup),
  };
}
