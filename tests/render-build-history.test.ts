import { describe, it, expect } from 'vitest';
import { renderBuildHistoryPage } from '../scripts/lib/render-build-history.mjs';

const entry = (over = {}) => ({
  dllVersion: '1.2026.718.905',
  md5: '753f00b01829bb9088c00dcc32d19077',
  observedAt: '2026-08-10',
  exportsAdded: [], exportsRemoved: [], uiStringsAdded: [], uiStringsRemoved: [],
  ...over,
});

describe('renderBuildHistoryPage', () => {
  it('emits frontmatter with source: generated and the overwrite warning', () => {
    const page = renderBuildHistoryPage([entry()]);
    expect(page.startsWith('---\n')).toBe(true);
    expect(page).toContain('source: generated');
    expect(page).toContain('machine-written');
  });

  it('renders one section per build, version and date in the heading', () => {
    const page = renderBuildHistoryPage([
      entry({ dllVersion: '1.2026.800.1', observedAt: '2026-09-01' }),
      entry(),
    ]);
    expect(page).toContain('## 1.2026.800.1 (2026-09-01)');
    expect(page).toContain('## 1.2026.718.905 (2026-08-10)');
    expect(page.indexOf('1.2026.800.1')).toBeLessThan(page.indexOf('1.2026.718.905'));
  });

  it('lists diff items and marks no-change builds', () => {
    const page = renderBuildHistoryPage([
      entry({ exportsAdded: ['e10'], uiStringsRemoved: ['old label'] }),
      entry(),
    ]);
    expect(page).toContain('`e10`');
    expect(page).toContain('`old label`');
    expect(page).toContain('binary-only update');
  });

  it('falls back to an md5 prefix heading when the version string is missing', () => {
    const page = renderBuildHistoryPage([entry({ dllVersion: '' })]);
    expect(page).toContain('## 753f00b01829 (2026-08-10)');
  });
});
