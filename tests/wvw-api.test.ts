import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const wvw = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/wvw.json', import.meta.url)), 'utf8'),
);

describe('wvw data API source', () => {
  it('assigns every team id to exactly one colour', () => {
    const seen = new Map<number, string>();
    for (const [colour, ids] of Object.entries<number[]>(wvw.teams.colors)) {
      for (const id of ids) {
        expect(Number.isInteger(id) && id > 0, `bad team id ${id}`).toBe(true);
        expect(seen.has(id), `team id ${id} in ${seen.get(id)} and ${colour}`).toBe(false);
        seen.set(id, colour);
      }
    }
  });

  it('only uses red/blue/green colours', () => {
    expect(Object.keys(wvw.teams.colors).sort()).toEqual(['blue', 'green', 'red']);
  });

  it('gives every map a name and role, keyed by a numeric id', () => {
    for (const [id, m] of Object.entries<{ name: string; role: string }>(wvw.maps.entries)) {
      expect(Number.isInteger(Number(id)), `map key ${id} not numeric`).toBe(true);
      expect(typeof m.name).toBe('string');
      expect(m.name.length).toBeGreaterThan(0);
      expect(typeof m.role).toBe('string');
      expect(m.role.length).toBeGreaterThan(0);
    }
  });

  it('keeps the unofficial-team-ids disclaimer present', () => {
    expect(wvw.teams.disclaimer).toMatch(/CBTS_WVWTEAMS/);
  });
});
