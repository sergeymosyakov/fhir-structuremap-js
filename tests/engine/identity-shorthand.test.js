import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { VariableScope } from '../../src/engine/scope.js';
import { applyIdentityShorthand, isIdentityShorthandEligible } from '../../src/engine/identity-shorthand.js';
import { Rule } from '../../src/model/rule.js';
import { StructureMapDocument } from '../../src/model/structure-map-document.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8'));
}

const SD = {
  Patient: loadFixture('structuredefinition-patient.json'),
  Envelope: loadFixture('structuredefinition-envelope.json'),
};

function docWith(groups) {
  return StructureMapDocument.fromJSON({
    resourceType: 'StructureMap', url: 'u', name: 'n', status: 'draft', group: groups,
  });
}

describe('applyIdentityShorthand', () => {
  it('binds the target\'s "as" variable (with tracked type) to the created instance', () => {
    const doc = docWith([
      { name: 'main', input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', type: 'Envelope', mode: 'target' }], rule: [] },
      { name: 'nameToDisplay', typeMode: 'types', input: [{ name: 'src', type: 'HumanName', mode: 'source' }, { name: 'tgt', type: 'DisplayName', mode: 'target' }], rule: [] },
    ]);
    const patient = { resourceType: 'Patient', name: { family: 'Smith' } };
    const envelope = { resourceType: 'Envelope' };
    const scope = new VariableScope();
    scope.set('patient', patient); scope.setType('patient', 'Patient');
    scope.set('envelope', envelope); scope.setType('envelope', 'Envelope');

    const rule = Rule.fromJSON({
      source: [{ context: 'patient', element: 'name', variable: 'n' }],
      target: [{ context: 'envelope', element: 'label', variable: 'v' }],
    });
    expect(isIdentityShorthandEligible(rule)).toBe(true);

    let invoked;
    const ctx = {
      structureDefinitionResolver: (type) => SD[type],
      doc,
      invokeGroup: (name, args) => { invoked = { name, args }; },
      createInstance: () => ({}),
    };
    const handled = applyIdentityShorthand(rule, rule.target[0], scope, ctx, null);

    expect(handled).toBe(true);
    expect(invoked.name).toBe('nameToDisplay');
    expect(scope.get('v')).toBe(envelope.label);
    expect(scope.getType('v')).toBe('DisplayName');
  });

  it('returns false (no dispatch) when the target has no element or no resolver is available', () => {
    const rule = Rule.fromJSON({ source: [{ context: 'src' }], target: [{ context: 'tgt' }] });
    const scope = new VariableScope();
    scope.set('tgt', {});
    expect(applyIdentityShorthand(rule, rule.target[0], scope, {}, null)).toBe(false);
  });

  it('resolves the source type from a bare (element-less) source context directly', () => {
    const doc = docWith([
      { name: 'main', input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', type: 'Envelope', mode: 'target' }], rule: [] },
      { name: 'patientToDisplay', typeMode: 'types', input: [{ name: 'src', type: 'Patient', mode: 'source' }, { name: 'tgt', type: 'DisplayName', mode: 'target' }], rule: [] },
    ]);
    const patient = { resourceType: 'Patient', name: { family: 'Smith' } };
    const envelope = { resourceType: 'Envelope' };
    const scope = new VariableScope();
    scope.set('patient', patient); scope.setType('patient', 'Patient');
    scope.set('envelope', envelope); scope.setType('envelope', 'Envelope');

    const rule = Rule.fromJSON({ source: [{ context: 'patient' }], target: [{ context: 'envelope', element: 'label' }] });
    let invoked;
    const ctx = {
      structureDefinitionResolver: (type) => SD[type],
      doc,
      invokeGroup: (name, args) => { invoked = { name, args }; },
      createInstance: () => ({}),
    };
    expect(applyIdentityShorthand(rule, rule.target[0], scope, ctx, null)).toBe(true);
    expect(invoked.name).toBe('patientToDisplay');
    expect(invoked.args[0]).toBe(patient); // bare source context -> the whole node, not scope.get(variable)
  });

  it('returns false when the source\'s type cannot be resolved at all', () => {
    const doc = docWith([
      { name: 'main', input: [{ name: 'patient', mode: 'source' }, { name: 'envelope', type: 'Envelope', mode: 'target' }], rule: [] },
    ]);
    const scope = new VariableScope();
    scope.set('patient', {}); // no setType — type is genuinely unknown
    scope.set('envelope', {}); scope.setType('envelope', 'Envelope');

    const rule = Rule.fromJSON({ source: [{ context: 'patient' }], target: [{ context: 'envelope', element: 'label' }] });
    const ctx = { structureDefinitionResolver: (type) => SD[type], doc, invokeGroup: () => {}, createInstance: () => ({}) };
    expect(applyIdentityShorthand(rule, rule.target[0], scope, ctx, null)).toBe(false);
  });

  it('returns false when the target context has an element but no tracked containing type', () => {
    const doc = docWith([{ name: 'main', input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', mode: 'target' }], rule: [] }]);
    const scope = new VariableScope();
    scope.set('patient', { name: { family: 'Smith' } }); scope.setType('patient', 'Patient');
    scope.set('envelope', {}); // no setType on envelope — containingType is unknown

    const rule = Rule.fromJSON({ source: [{ context: 'patient', element: 'name' }], target: [{ context: 'envelope', element: 'label' }] });
    const ctx = { structureDefinitionResolver: (type) => SD[type], doc, invokeGroup: () => {}, createInstance: () => ({}) };
    expect(applyIdentityShorthand(rule, rule.target[0], scope, ctx, null)).toBe(false);
  });

  it('returns false when the resolver has no StructureDefinition for the containing type', () => {
    const doc = docWith([{ name: 'main', input: [{ name: 'patient', type: 'Patient', mode: 'source' }, { name: 'envelope', type: 'UnknownType', mode: 'target' }], rule: [] }]);
    const scope = new VariableScope();
    scope.set('patient', { name: { family: 'Smith' } }); scope.setType('patient', 'Patient');
    scope.set('envelope', {}); scope.setType('envelope', 'UnknownType'); // not in SD map

    const rule = Rule.fromJSON({ source: [{ context: 'patient', element: 'name' }], target: [{ context: 'envelope', element: 'label' }] });
    const ctx = { structureDefinitionResolver: (type) => SD[type], doc, invokeGroup: () => {}, createInstance: () => ({}) };
    expect(applyIdentityShorthand(rule, rule.target[0], scope, ctx, null)).toBe(false);
  });
});

