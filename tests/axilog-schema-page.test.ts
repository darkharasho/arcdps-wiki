import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
// @ts-expect-error — plain .mjs helper, no type declarations
import {
  blobUrl,
  buildPage,
  linkRepoPaths,
  readProvenance,
  stripLeadingH1,
  stripProvenance,
} from '../scripts/lib/axilog-schema-page.mjs';

const read = (rel: string) =>
  readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8');

const source = JSON.parse(read('../data/axilog-source.json'));
const snapshot = read('../data/axilog-native-format.md');

describe('linkRepoPaths', () => {
  it('turns a code-span repo path into a link to the pinned ref', () => {
    const out = linkRepoPaths('See `docs/EI-PARITY.md` for details.', {
      repo: 'o/r',
      ref: 'abc123',
    });
    expect(out).toBe(
      'See [`docs/EI-PARITY.md`](https://github.com/o/r/blob/abc123/docs/EI-PARITY.md) for details.',
    );
  });

  it('leaves ordinary code spans alone', () => {
    const md = 'The `coverage` map uses `not_computed`, never `null`.';
    expect(linkRepoPaths(md, source)).toBe(md);
  });

  it('does not touch a path that is already a link label', () => {
    const md = '[`docs/X.md`](https://example.com/x)';
    expect(linkRepoPaths(md, source)).toBe(md);
  });

  it('does not rewrite inside fenced code blocks', () => {
    const md = ['```sh', 'cat docs/EI-PARITY.md `crates/a/b.rs`', '```'].join('\n');
    expect(linkRepoPaths(md, source)).toBe(md);
  });

  it('is idempotent', () => {
    const once = linkRepoPaths(snapshot, source);
    expect(linkRepoPaths(once, source)).toBe(once);
  });
});

describe('stripLeadingH1', () => {
  it('removes the source document H1 so Starlight does not render two', () => {
    expect(stripLeadingH1('# Title\n\nBody.\n')).toBe('Body.\n');
  });

  it('leaves a document that starts at H2 untouched', () => {
    const md = '## Section\n\nBody.\n';
    expect(stripLeadingH1(md)).toBe(md);
  });
});

describe('the committed snapshot', () => {
  it('carries provenance naming the pinned ref from data/axilog-source.json', () => {
    const p = readProvenance(snapshot);
    expect(p).not.toBeNull();
    expect(p.repo).toBe(source.repo);
    expect(p.ref).toBe(source.ref);
    expect(p.path).toBe(source.path);
  });

  it('is pinned to a full commit sha, never a branch', () => {
    expect(source.ref).toMatch(/^[0-9a-f]{40}$/);
  });

  it('still describes the schema version the page claims', () => {
    expect(stripProvenance(snapshot)).toContain(`Native format ${source.describes}`);
  });
});

describe('buildPage', () => {
  const page = buildPage({
    title: 'axilog output schema',
    description: 'desc',
    snapshot,
    intro: read('../data/axilog-schema-page/intro.md'),
    eiSurface: read('../data/axilog-schema-page/ei-surface.md'),
    source,
  });

  it('emits valid frontmatter with a source the content schema allows', () => {
    expect(page.startsWith('---\n')).toBe(true);
    expect(page).toContain('source: generated');
  });

  it('does not leak the provenance comment into the rendered page', () => {
    expect(page).not.toContain('Snapshotted by scripts/snapshot-axilog-schema.mjs');
  });

  it('emits no H1 — Starlight renders the frontmatter title as one', () => {
    expect(page.split('\n').filter((l) => /^# /.test(l))).toEqual([]);
  });

  it('orders intro, generated body, then the hand-written EI surface', () => {
    const intro = page.indexOf('has two JSON outputs');
    const generated = page.indexOf('## The six top-level keys');
    const ei = page.indexOf('## The EI-compat surface');
    expect(intro).toBeGreaterThan(-1);
    expect(generated).toBeGreaterThan(intro);
    expect(ei).toBeGreaterThan(generated);
  });

  it('tells the reader where corrections belong', () => {
    expect(page).toContain('single source of truth');
    expect(page).toContain(blobUrl(source, 'docs/NATIVE-FORMAT.md'));
  });

  it('is deterministic — no clock, no network, same input same bytes', () => {
    const again = buildPage({
      title: 'axilog output schema',
      description: 'desc',
      snapshot,
      intro: read('../data/axilog-schema-page/intro.md'),
      eiSurface: read('../data/axilog-schema-page/ei-surface.md'),
      source,
    });
    expect(again).toBe(page);
  });
});
