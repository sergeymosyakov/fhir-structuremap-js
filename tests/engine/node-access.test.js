import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { matchesType } from '../../src/engine/node-access.js';

function loadFixture(name) {
  return JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf-8'));
}

const humanName = loadFixture('structuredefinition-humanname.json');
const resolver = (type) => (type === 'HumanName' ? humanName : undefined);

describe('matchesType', () => {
  it('matches by resourceType when present', () => {
    expect(matchesType({ resourceType: 'Patient' }, 'Patient')).toBe(true);
    expect(matchesType({ resourceType: 'Observation' }, 'Patient')).toBe(false);
  });

  it('matches JS primitives against FHIR primitive type names', () => {
    expect(matchesType('x', 'string')).toBe(true);
    expect(matchesType(true, 'boolean')).toBe(true);
    expect(matchesType('x', 'boolean')).toBe(false);
  });

  it('is permissive for a complex value with no resolver available', () => {
    expect(matchesType({ family: 'Smith' }, 'HumanName')).toBe(true);
  });

  it('checks structurally against a resolved StructureDefinition when available', () => {
    expect(matchesType({ family: 'Smith', given: 'Alice' }, 'HumanName', resolver)).toBe(true);
    expect(matchesType({ notAField: 1 }, 'HumanName', resolver)).toBe(false);
  });

  it('is permissive when the resolver has no definition for the type', () => {
    expect(matchesType({ anything: 1 }, 'Unknown', resolver)).toBe(true);
  });
});
