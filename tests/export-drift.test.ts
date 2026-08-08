import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { collectDocumentedExports } from '../scripts/lib/documented-exports.mjs';

const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/arcdps-exports.json', import.meta.url)), 'utf8'),
);
const refDir = fileURLToPath(new URL('../src/content/docs/reference/', import.meta.url));
const documented = collectDocumentedExports(refDir);
const snap = new Set(snapshot.exports);

describe('export drift', () => {
  it('every documented symbol exists in the DLL snapshot', () => {
    const unknown = [...documented].filter((s) => !snap.has(s));
    expect(unknown).toEqual([]);
  });

  // Task 9: exports/*.md now cover all 91 symbols via exportSymbols frontmatter.
  it('every DLL export is documented on some page', () => {
    const missing = snapshot.exports.filter((s) => !documented.has(s));
    expect(missing).toEqual([]);
  });
});
