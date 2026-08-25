import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { getDeclaredChildKeys, resolveChildType } from '../../src/engine/structure-definition.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8'));
}

const humanName = loadFixture('structuredefinition-humanname.json');
const patient = loadFixture('structuredefinition-patient.json');

describe('getDeclaredChildKeys', () => {
  it('lists direct child element names', () => {
    expect(getDeclaredChildKeys(humanName).sort()).toEqual(['family', 'given', 'use']);
  });

  it('returns an empty list when there is no type', () => {
    expect(getDeclaredChildKeys({})).toEqual([]);
  });

  it('skips grandchild paths (only direct children are declared)', () => {
    const sd = { type: 'Patient', snapshot: { element: [
      { path: 'Patient.name', type: [{ code: 'HumanName' }] },
      { path: 'Patient.name.family', type: [{ code: 'string' }] },
    ] } };
    expect(getDeclaredChildKeys(sd)).toEqual(['name']);
  });
});

describe('resolveChildType', () => {
  it('returns undefined when there is no type', () => {
    expect(resolveChildType({}, 'x')).toBeUndefined();
  });

  it('resolves a direct child\'s declared type', () => {
    expect(resolveChildType(patient, 'name')).toBe('HumanName');
    expect(resolveChildType(humanName, 'family')).toBe('string');
  });

  it('returns undefined for an unknown element', () => {
    expect(resolveChildType(patient, 'nope')).toBeUndefined();
  });

  it('returns undefined for an ambiguous choice-typed element (type[] with more than one entry)', () => {
    const choiceType = { type: 'Observation', snapshot: { element: [{ path: 'Observation.value', type: [{ code: 'string' }, { code: 'Quantity' }] }] } };
    expect(resolveChildType(choiceType, 'value')).toBeUndefined();
  });

  it('falls back to differential.element when there is no snapshot', () => {
    const differentialOnly = { type: 'Patient', differential: { element: [{ path: 'Patient.name', type: [{ code: 'HumanName' }] }] } };
    expect(resolveChildType(differentialOnly, 'name')).toBe('HumanName');
    expect(getDeclaredChildKeys(differentialOnly)).toEqual(['name']);
  });

  it('treats a type with neither snapshot nor differential as having no elements', () => {
    expect(resolveChildType({ type: 'Patient' }, 'name')).toBeUndefined();
    expect(getDeclaredChildKeys({ type: 'Patient' })).toEqual([]);
  });
});
