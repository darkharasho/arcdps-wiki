import { describe, it, expect } from 'vitest';
import { diffSnapshots } from '../scripts/lib/build-history-diff.mjs';

const ui = (over: Partial<Record<'configKeys' | 'elementIds' | 'uiText', string[]>> = {}) => ({
  configKeys: [], elementIds: [], uiText: [], ...over,
});

describe('diffSnapshots', () => {
  it('reports added and removed exports', () => {
    const d = diffSnapshots({
      oldExports: { exports: ['A', 'B'] },
      newExports: { exports: ['B', 'C'] },
      oldUi: ui(), newUi: ui(),
    });
    expect(d.exportsAdded).toEqual(['C']);
    expect(d.exportsRemoved).toEqual(['A']);
  });

  it('flattens the three UI pools into one string diff', () => {
    const d = diffSnapshots({
      oldExports: { exports: [] }, newExports: { exports: [] },
      oldUi: ui({ configKeys: ['boon_table'], uiText: ['old tooltip'] }),
      newUi: ui({ configKeys: ['boon_table'], elementIds: ['##newpanel'], uiText: [] }),
    });
    expect(d.uiStringsAdded).toEqual(['##newpanel']);
    expect(d.uiStringsRemoved).toEqual(['old tooltip']);
  });

  it('returns four empty arrays for identical snapshots', () => {
    const d = diffSnapshots({
      oldExports: { exports: ['A'] }, newExports: { exports: ['A'] },
      oldUi: ui({ uiText: ['x'] }), newUi: ui({ uiText: ['x'] }),
    });
    expect(d).toEqual({ exportsAdded: [], exportsRemoved: [], uiStringsAdded: [], uiStringsRemoved: [] });
  });

  it('deduplicates strings appearing in multiple UI pools', () => {
    const d = diffSnapshots({
      oldExports: { exports: [] }, newExports: { exports: [] },
      // "tooltip" appears in both elementIds and uiText in the new snapshot
      oldUi: ui(), newUi: ui({ elementIds: ['tooltip'], uiText: ['tooltip'] }),
    });
    // Should appear exactly once in uiStringsAdded, not twice
    expect(d.uiStringsAdded).toEqual(['tooltip']);
    expect(d.uiStringsRemoved).toEqual([]);
  });

  it('asserts all UI fields are empty when inputs are all empty', () => {
    const d = diffSnapshots({
      oldExports: { exports: [] }, newExports: { exports: [] },
      oldUi: ui(), newUi: ui(),
    });
    expect(d.uiStringsAdded).toEqual([]);
    expect(d.uiStringsRemoved).toEqual([]);
  });
});
