import { describe, it, expect } from 'vitest';
import { parseExports } from '../scripts/lib/parse-exports.mjs';

const SAMPLE = `
	[Ordinal/Name Pointer] Table
	[  19] +base[  20]  0000 ApplyCompatResolutionQuirking
	[   5] +base[   6]  0048 addextension2
	[   8] +base[   9]  004d e0
	[   5] +base[   6]  0048 addextension2
`;

describe('parseExports', () => {
  it('extracts the trailing symbol name from each table row', () => {
    expect(parseExports(SAMPLE)).toEqual(['ApplyCompatResolutionQuirking', 'addextension2', 'e0']);
  });

  it('sorts and de-duplicates', () => {
    const out = parseExports(SAMPLE);
    expect(out).toEqual([...out].sort());
    expect(new Set(out).size).toBe(out.length);
  });

  it('ignores non-row lines', () => {
    expect(parseExports('Export Address Table\nrandom noise\n')).toEqual([]);
  });
});
