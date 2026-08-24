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
});

describe('resolveChildType', () => {
  it('resolves a direct child\'s declared type', () => {
    expect(resolveChildType(patient, 'name')).toBe('HumanName');
    expect(resolveChildType(humanName, 'family')).toBe('string');
  });

  it('returns undefined for an unknown element', () => {
    expect(resolveChildType(patient, 'nope')).toBeUndefined();
  });
});
